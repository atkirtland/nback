package com.nback

import org.junit.Assert.assertEquals
import org.junit.Test

class ScoreTest {
    @Test fun catchingHalfTheTargetsScoresHalfEvenWithPerfectRejections() {
        val matrix = Matrix(tp = 3, fn = 3, tn = 14)
        assertEquals(85.0, matrix.accuracy, 0.001)
        assertEquals(50.0, matrix.scorePercent, 0.001)
        assertEquals(50.0, Score(mapOf(Modality.POSITION to matrix)).scorePercent, 0.001)
    }

    @Test fun falseAlarmsAndMissesBothPenalizeTheScore() {
        assertEquals(60.0, Matrix(tp = 6, fp = 2, fn = 2).scorePercent, 0.001)
        assertEquals(100.0, Matrix(tp = 6, tn = 14).scorePercent, 0.001)
    }

    @Test fun poolsCountsRatherThanAveragingModalityPercentages() {
        val score = Score(mapOf(
            Modality.POSITION to Matrix(tp = 1, fn = 1, tn = 18),
            Modality.AUDIO to Matrix(tp = 6, fp = 2, tn = 12),
        ))
        assertEquals(70.0, score.scorePercent, 0.001)
    }

    @Test fun silenceAndNoTargetsNeverEarnFreePoints() {
        assertEquals(0.0, Matrix(fn = 6, tn = 14).scorePercent, 0.001)
        assertEquals(0.0, Matrix(tn = 20).scorePercent, 0.001)
        assertEquals(0.0, Score(emptyMap()).scorePercent, 0.001)
        assertEquals(0.0, Score(mapOf(Modality.AUDIO to Matrix(tn = 20))).scorePercent, 0.001)
    }
}
