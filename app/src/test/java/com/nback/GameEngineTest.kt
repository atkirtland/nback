package com.nback

import org.junit.Assert.*
import org.junit.Test
import kotlin.random.Random

class GameEngineTest {
    @Test fun createsExactlyWarmupsPlusScoredTrials() {
        val engine = GameEngine(GameSettings(currentLevel = 3, gameTrials = 7, enabledModalities = setOf(Modality.POSITION)), Random(1))
        repeat(10) { engine.next() }
        assertTrue(engine.isComplete)
        assertEquals(10, engine.history.size)
        assertEquals(7, engine.score().matrices.getValue(Modality.POSITION).total)
    }

    @Test fun forcedMatchesAndDuplicateResponsesScoreOnce() {
        val settings = GameSettings(currentLevel = 1, gameTrials = 4, matchProbability = 1.0, enabledModalities = setOf(Modality.POSITION))
        val engine = GameEngine(settings, Random(2))
        engine.next()
        repeat(4) { engine.next(); assertTrue(engine.respond(Modality.POSITION)); assertFalse(engine.respond(Modality.POSITION)) }
        assertEquals(Matrix(tp = 4), engine.score().matrices.getValue(Modality.POSITION))
    }

    @Test fun nonMatchesNeverAccidentallyMatch() {
        val settings = GameSettings(currentLevel = 2, gameTrials = 30, matchProbability = 0.0, enabledModalities = Modality.entries.toSet())
        val engine = GameEngine(settings, Random(3))
        repeat(32) { engine.next() }
        engine.history.drop(2).forEachIndexed { index, current ->
            val old = engine.history[index]
            assertNotEquals(old.position, current.position); assertNotEquals(old.letter, current.letter)
            assertNotEquals(old.color, current.color); assertNotEquals(old.shape, current.shape)
        }
    }

    @Test fun rejectsWarmupDisabledAndDuplicateInput() {
        val engine = GameEngine(GameSettings(currentLevel = 1, gameTrials = 1, enabledModalities = setOf(Modality.AUDIO)), Random(4))
        engine.next(); assertFalse(engine.respond(Modality.AUDIO)); engine.next()
        assertFalse(engine.respond(Modality.POSITION)); assertTrue(engine.respond(Modality.AUDIO)); assertFalse(engine.respond(Modality.AUDIO))
    }

    @Test fun settingsAreNormalizedAtStorageBoundary() {
        val value = GameSettings(currentLevel = 99, gridSize = 1, trialDelayMillis = 1, gameTrials = 0,
            enabledModalities = emptySet(), winThreshold = 50, lossThreshold = 49).normalized()
        assertEquals(8, value.currentLevel); assertEquals(2, value.gridSize); assertEquals(1_000, value.trialDelayMillis)
        assertEquals(1, value.gameTrials); assertEquals(setOf(Modality.POSITION), value.enabledModalities)
        assertTrue(value.winThreshold - value.lossThreshold >= 10)
    }
}
