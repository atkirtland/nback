package com.nback

import android.app.Application
import android.os.SystemClock
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

enum class GamePhase { COUNTDOWN, PLAYING, PAUSED, FINISHED }

data class GameUiState(
    val phase: GamePhase,
    val countdown: Int = 3,
    val stimulus: Stimulus? = null,
    val warmup: Boolean = true,
    val scoredTrial: Int = 0,
    val pressed: Set<Modality> = emptySet(),
    val result: Score? = null,
    val outcome: Outcome? = null,
    val session: SessionProgress = SessionProgress(),
    val levelChange: Int = 0,
    val nextLevel: Int? = null,
    val audioToken: Int = 0,
)

class AppViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = GameRepository(application)
    val settings: StateFlow<GameSettings> = repository.settings.stateIn(viewModelScope, SharingStarted.Eagerly, GameSettings())
    val records: StateFlow<List<GameRecord>> = repository.records.stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())
    val game = MutableStateFlow<GameUiState?>(null)

    private var engine: GameEngine? = null
    private var timer: Job? = null
    private var deadline = 0L
    private var remaining = 0L
    private var session = SessionProgress()

    fun updateSettings(value: GameSettings) = viewModelScope.launch { repository.saveSettings(value.normalized()) }

    fun startGame(keepSession: Boolean = false) {
        timer?.cancel()
        if (!keepSession) session = SessionProgress()
        engine = GameEngine(settings.value.normalized())
        game.value = GameUiState(GamePhase.COUNTDOWN, session = session)
        runCountdown(resume = false)
    }

    private fun runCountdown(resume: Boolean) {
        timer = viewModelScope.launch {
            for (count in 3 downTo 1) {
                game.value = game.value?.copy(phase = GamePhase.COUNTDOWN, countdown = count)
                delay(1_000)
            }
            if (resume) {
                val current = requireNotNull(engine).current
                deadline = SystemClock.elapsedRealtime() + remaining.coerceAtLeast(1)
                game.value = game.value?.copy(
                    phase = GamePhase.PLAYING, stimulus = current,
                    pressed = requireNotNull(engine).responsesForCurrent(), audioToken = (game.value?.audioToken ?: 0) + 1,
                )
                scheduleDeadline()
            } else beginFirstTrial()
        }
    }

    private fun beginFirstTrial() {
        show(requireNotNull(engine).next())
        deadline = SystemClock.elapsedRealtime() + requireNotNull(engine).settings.trialDelayMillis
        scheduleDeadline()
    }

    private fun show(stimulus: Stimulus) {
        val e = requireNotNull(engine)
        game.value = game.value?.copy(
            phase = GamePhase.PLAYING,
            stimulus = stimulus,
            warmup = e.isWarmup,
            scoredTrial = (stimulus.number - e.settings.currentLevel).coerceAtLeast(0),
            pressed = emptySet(),
            audioToken = (game.value?.audioToken ?: 0) + 1,
        )
    }

    private fun scheduleDeadline() {
        timer = viewModelScope.launch {
            delay((deadline - SystemClock.elapsedRealtime()).coerceAtLeast(0))
            advance()
        }
    }

    private fun advance() {
        val e = engine ?: return
        if (e.isComplete) {
            finish(e)
            return
        }
        show(e.next())
        deadline += e.settings.trialDelayMillis
        if (deadline <= SystemClock.elapsedRealtime()) deadline = SystemClock.elapsedRealtime() + e.settings.trialDelayMillis
        scheduleDeadline()
    }

    fun respond(modality: Modality) {
        val state = game.value ?: return
        if (state.phase != GamePhase.PLAYING) return
        if (SystemClock.elapsedRealtime() >= deadline) {
            timer?.cancel(); advance(); return
        }
        if (requireNotNull(engine).respond(modality)) game.value = state.copy(pressed = state.pressed + modality)
    }

    private fun finish(e: GameEngine) {
        timer?.cancel()
        val score = e.score()
        val outcome = when {
            score.scorePercent >= e.settings.winThreshold -> Outcome.WIN
            score.scorePercent <= e.settings.lossThreshold -> Outcome.LOSS
            else -> Outcome.NEUTRAL
        }
        session = SessionProgress(session.outcomes + outcome)
        var newLevel = e.settings.currentLevel
        if (session.consecutive(Outcome.WIN) >= e.settings.consecutiveWinsForLevelUp) newLevel = (newLevel + 1).coerceAtMost(8)
        else if (session.consecutive(Outcome.LOSS) >= e.settings.consecutiveLossesForLevelDown) newLevel = (newLevel - 1).coerceAtLeast(1)
        val changed = newLevel - e.settings.currentLevel
        if (changed != 0) {
            session = SessionProgress()
            updateSettings(e.settings.copy(currentLevel = newLevel))
        }
        val record = GameRecord(
            isoDate(), e.settings.currentLevel, score.scorePercent, score.matrices, e.settings.gridSize,
            e.settings.trialDelayMillis, e.settings.gameTrials, e.settings.matchProbability,
            e.settings.enabledModalities, outcome, e.settings.winThreshold, e.settings.lossThreshold,
            ScoringMethod.BRAIN_WORKSHOP,
        )
        viewModelScope.launch { repository.addRecord(record) }
        game.value = game.value?.copy(phase = GamePhase.FINISHED, result = score, outcome = outcome, session = session, levelChange = changed, nextLevel = newLevel)
    }

    fun pauseGame() {
        val state = game.value ?: return
        if (state.phase != GamePhase.PLAYING && state.phase != GamePhase.COUNTDOWN) return
        if (state.phase == GamePhase.PLAYING) remaining = (deadline - SystemClock.elapsedRealtime()).coerceAtLeast(1)
        timer?.cancel()
        game.value = state.copy(phase = GamePhase.PAUSED)
    }

    fun resumeGame() {
        if (game.value?.phase == GamePhase.PAUSED) runCountdown(resume = engine?.current != null)
    }

    fun exitGame() { timer?.cancel(); engine = null; session = SessionProgress(); game.value = null }
    fun playAgain() = startGame(keepSession = true)
    fun clearRecords() = viewModelScope.launch { repository.clearRecords() }
    suspend fun exportData() = repository.export()
    suspend fun importData(text: String) = repository.import(text)
}

private fun isoDate(): String = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).apply {
    timeZone = java.util.TimeZone.getTimeZone("UTC")
}.format(java.util.Date())
