package com.nback

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import org.json.JSONArray
import org.json.JSONObject

private val Context.dataStore by preferencesDataStore("nback")

class GameRepository(private val context: Context) {
    private val settingsKey = stringPreferencesKey("settings")
    private val statsKey = stringPreferencesKey("stats")

    val settings: Flow<GameSettings> = context.dataStore.data.map { prefs ->
        prefs[settingsKey]?.let { runCatching { parseSettings(JSONObject(it)) }.getOrNull() }
            ?: GameSettings()
    }
    val records: Flow<List<GameRecord>> = context.dataStore.data.map { prefs ->
        prefs[statsKey]?.let { runCatching { parseRecords(JSONArray(it), GameSettings()) }.getOrNull() }
            ?: emptyList()
    }

    suspend fun saveSettings(value: GameSettings) {
        context.dataStore.edit { it[settingsKey] = settingsJson(value).toString() }
    }

    suspend fun addRecord(value: GameRecord) {
        val all = records.first() + value
        context.dataStore.edit { it[statsKey] = recordsJson(all).toString() }
    }

    suspend fun clearRecords() = context.dataStore.edit { it.remove(statsKey) }

    suspend fun export(): String {
        val root = JSONObject()
            .put("settings", settingsJson(settings.first()))
            .put("stats", recordsJson(records.first()))
            .put("exportDate", isoNow())
            .put("version", "2.0")
        return root.toString(2)
    }

    suspend fun import(text: String): Int {
        val start = text.indexOf('{')
        val end = text.lastIndexOf('}')
        require(start >= 0 && end >= start) { "No JSON object found" }
        val root = JSONObject(text.substring(start, end + 1))
        require(root.has("settings") && root.has("stats") && root.has("exportDate")) { "Invalid backup" }
        val importedSettings = parseSettings(root.getJSONObject("settings"))
        val importedRecords = parseRecords(root.getJSONArray("stats"), importedSettings)
        context.dataStore.edit {
            it[settingsKey] = settingsJson(importedSettings).toString()
            it[statsKey] = recordsJson(importedRecords).toString()
        }
        return importedRecords.size
    }

    private fun parseSettings(json: JSONObject): GameSettings {
        // Move the old default thresholds to the new scale; retain custom thresholds.
        val migrateDefaults = !json.has("scoringMethod") &&
            json.optInt("winThreshold", 90) == 90 && json.optInt("lossThreshold", 70) == 70
        val enabled = buildSet {
            if (json.optBoolean("enablePosition", true)) add(Modality.POSITION)
            if (json.optBoolean("enableAudio", true)) add(Modality.AUDIO)
            if (json.optBoolean("enableColor", false)) add(Modality.COLOR)
            if (json.optBoolean("enableShape", false)) add(Modality.SHAPE)
        }
        return GameSettings(
            currentLevel = json.optInt("currentLevel", 2),
            gridSize = json.optInt("gridSize", 3),
            trialDelayMillis = (json.optDouble("trialDelay", 3.0) * 1000).toLong(),
            gameTrials = json.optInt("gameTrials", 20),
            matchProbability = json.optDouble("matchProbability", .3),
            winThreshold = if (migrateDefaults) 80 else json.optInt("winThreshold", 80),
            lossThreshold = if (migrateDefaults) 50 else json.optInt("lossThreshold", 50),
            consecutiveWinsForLevelUp = json.optInt("consecutiveWinsForLevelUp", 3),
            consecutiveLossesForLevelDown = json.optInt("consecutiveLossesForLevelDown", 2),
            enabledModalities = enabled,
        ).normalized()
    }

    private fun settingsJson(s: GameSettings) = JSONObject()
        .put("scoringMethod", ScoringMethod.BRAIN_WORKSHOP.name)
        .put("currentLevel", s.currentLevel).put("gridSize", s.gridSize)
        .put("trialDelay", s.trialDelayMillis / 1000.0).put("gameTrials", s.gameTrials)
        .put("matchProbability", s.matchProbability).put("winThreshold", s.winThreshold)
        .put("lossThreshold", s.lossThreshold).put("consecutiveWinsForLevelUp", s.consecutiveWinsForLevelUp)
        .put("consecutiveLossesForLevelDown", s.consecutiveLossesForLevelDown)
        .put("enablePosition", Modality.POSITION in s.enabledModalities)
        .put("enableAudio", Modality.AUDIO in s.enabledModalities)
        .put("enableColor", Modality.COLOR in s.enabledModalities)
        .put("enableShape", Modality.SHAPE in s.enabledModalities)

    private fun parseRecords(array: JSONArray, fallback: GameSettings): List<GameRecord> = buildList {
        for (i in 0 until array.length()) {
            val j = array.getJSONObject(i)
            val enabled = buildSet {
                if (j.optBoolean("enablePosition")) add(Modality.POSITION)
                if (j.optBoolean("enableAudio")) add(Modality.AUDIO)
                if (j.optBoolean("enableColor")) add(Modality.COLOR)
                if (j.optBoolean("enableShape")) add(Modality.SHAPE)
            }.ifEmpty { fallback.enabledModalities }
            fun matrix(prefix: String) = Matrix(j.optInt("${prefix}TP"), j.optInt("${prefix}FP"), j.optInt("${prefix}TN"), j.optInt("${prefix}FN"))
            val matrices = enabled.associateWith {
                matrix(when (it) { Modality.POSITION -> "position"; Modality.AUDIO -> "audio"; Modality.COLOR -> "color"; Modality.SHAPE -> "shape" })
            }
            val accuracy = j.optDouble("accuracy", 0.0)
            val win = j.optInt("winThreshold", 90)
            val loss = j.optInt("lossThreshold", 70)
            val outcome = j.optString("outcome").takeIf { it.isNotBlank() }?.let { runCatching { Outcome.valueOf(it.uppercase()) }.getOrNull() }
                ?: if (accuracy >= win) Outcome.WIN else if (accuracy <= loss) Outcome.LOSS else Outcome.NEUTRAL
            add(GameRecord(j.optString("date", isoNow()), j.optInt("difficulty", 2), accuracy, matrices,
                j.optInt("gridSize", 3), (j.optDouble("trialDelay", 3.0) * 1000).toLong(),
                j.optInt("gameTrials", 20), j.optDouble("matchProbability", .3), enabled, outcome, win, loss,
                runCatching { ScoringMethod.valueOf(j.optString("scoringMethod")) }.getOrDefault(ScoringMethod.LEGACY_ACCURACY)))
        }
    }

    private fun recordsJson(records: List<GameRecord>) = JSONArray().also { array -> records.forEach { r ->
        val j = JSONObject().put("date", r.date).put("difficulty", r.difficulty).put("accuracy", r.accuracy)
            .put("scoringMethod", r.scoringMethod.name)
            .put("gridSize", r.gridSize).put("trialDelay", r.trialDelayMillis / 1000.0).put("gameTrials", r.gameTrials)
            .put("matchProbability", r.matchProbability).put("outcome", r.outcome.name.lowercase())
            .put("winThreshold", r.winThreshold).put("lossThreshold", r.lossThreshold)
            .put("enablePosition", Modality.POSITION in r.enabledModalities).put("enableAudio", Modality.AUDIO in r.enabledModalities)
            .put("enableColor", Modality.COLOR in r.enabledModalities).put("enableShape", Modality.SHAPE in r.enabledModalities)
        r.matrices.forEach { (m, v) ->
            val p = when (m) { Modality.POSITION -> "position"; Modality.AUDIO -> "audio"; Modality.COLOR -> "color"; Modality.SHAPE -> "shape" }
            j.put("${p}TP", v.tp).put("${p}FP", v.fp).put("${p}TN", v.tn).put("${p}FN", v.fn)
        }
        array.put(j)
    } }
}

private fun isoNow(): String = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).apply {
    timeZone = java.util.TimeZone.getTimeZone("UTC")
}.format(java.util.Date())
