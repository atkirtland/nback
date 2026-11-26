package com.nback

import kotlin.math.round

enum class Modality { POSITION, AUDIO, COLOR, SHAPE }
enum class Outcome { WIN, LOSS, NEUTRAL }
enum class ScoringMethod { LEGACY_ACCURACY, BRAIN_WORKSHOP }

data class GameSettings(
    val currentLevel: Int = 2,
    val gridSize: Int = 3,
    val trialDelayMillis: Long = 3_000,
    val gameTrials: Int = 20,
    val matchProbability: Double = .3,
    val winThreshold: Int = 80,
    val lossThreshold: Int = 50,
    val consecutiveWinsForLevelUp: Int = 3,
    val consecutiveLossesForLevelDown: Int = 2,
    val enabledModalities: Set<Modality> = setOf(Modality.POSITION, Modality.AUDIO),
) {
    fun normalized() = copy(
        currentLevel = currentLevel.coerceIn(1, 8),
        gridSize = gridSize.coerceIn(2, 5),
        trialDelayMillis = ((trialDelayMillis.coerceIn(1_000, 10_000) + 250) / 500) * 500,
        gameTrials = gameTrials.coerceIn(1, 999),
        matchProbability = (round(matchProbability.coerceIn(.1, .9) * 10) / 10),
        winThreshold = winThreshold.coerceIn(10, 100),
        lossThreshold = lossThreshold.coerceIn(0, 90),
        consecutiveWinsForLevelUp = consecutiveWinsForLevelUp.coerceIn(1, 10),
        consecutiveLossesForLevelDown = consecutiveLossesForLevelDown.coerceIn(1, 10),
        enabledModalities = enabledModalities.ifEmpty { setOf(Modality.POSITION) },
    ).let { value ->
        if (value.winThreshold - value.lossThreshold >= 10) value
        else value.copy(lossThreshold = (value.winThreshold - 10).coerceAtLeast(0))
    }
}

data class Stimulus(
    val number: Int,
    val position: Int?,
    val letter: Char?,
    val color: Int?,
    val shape: String?,
)

data class Matrix(val tp: Int = 0, val fp: Int = 0, val tn: Int = 0, val fn: Int = 0) {
    val scorePercent get() = if (tp + fp + fn == 0) 0.0 else tp * 100.0 / (tp + fp + fn)
    val total get() = tp + fp + tn + fn
    val accuracy get() = if (total == 0) 0.0 else (tp + tn) * 100.0 / total
    val sensitivity get() = if (tp + fn == 0) 0.0 else tp * 100.0 / (tp + fn)
    val specificity get() = if (tn + fp == 0) 0.0 else tn * 100.0 / (tn + fp)
}

data class Score(val matrices: Map<Modality, Matrix>) {
    // Pool counts across modalities, as in Brain Workshop's default scoring.
    val scorePercent = matrices.values.let { values ->
        val hits = values.sumOf { it.tp }
        val denominator = values.sumOf { it.tp + it.fp + it.fn }
        if (denominator == 0) 0.0 else hits * 100.0 / denominator
    }
    val total = matrices.values.sumOf { it.total }
    val accuracy = if (total == 0) 100.0 else
        matrices.values.sumOf { it.tp + it.tn } * 100.0 / total
}

data class GameRecord(
    val date: String,
    val difficulty: Int,
    // Historical storage name: interpreted according to scoringMethod.
    val accuracy: Double,
    val matrices: Map<Modality, Matrix>,
    val gridSize: Int,
    val trialDelayMillis: Long,
    val gameTrials: Int,
    val matchProbability: Double,
    val enabledModalities: Set<Modality>,
    val outcome: Outcome,
    val winThreshold: Int,
    val lossThreshold: Int,
    val scoringMethod: ScoringMethod = ScoringMethod.LEGACY_ACCURACY,
)

data class SessionProgress(val outcomes: List<Outcome> = emptyList()) {
    val wins get() = outcomes.count { it == Outcome.WIN }
    val losses get() = outcomes.count { it == Outcome.LOSS }
    val neutrals get() = outcomes.count { it == Outcome.NEUTRAL }
    fun consecutive(value: Outcome) = outcomes.asReversed().takeWhile { it == value }.size
}
