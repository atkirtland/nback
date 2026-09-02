package com.nback

import kotlin.random.Random

class GameEngine(
    val settings: GameSettings,
    private val random: Random = Random.Default,
) {
    companion object {
        val colors = listOf(0xffff6347.toInt(), 0xff4169e1.toInt(), 0xff32cd32.toInt(), 0xffffd700.toInt(), 0xffff69b4.toInt(), 0xff00ced1.toInt(), 0xffff8c00.toInt(), 0xff9370db.toInt())
        val shapes = listOf("square", "circle", "triangle", "diamond")
    }

    val history = mutableListOf<Stimulus>()
    private val responses = mutableMapOf<Int, MutableSet<Modality>>()
    val current: Stimulus? get() = history.lastOrNull()
    val isWarmup get() = history.size <= settings.currentLevel
    val isComplete get() = history.size == settings.currentLevel + settings.gameTrials

    fun next(): Stimulus {
        check(!isComplete)
        val number = history.size + 1
        val reference = if (number > settings.currentLevel) history[number - settings.currentLevel - 1] else null
        fun <T> choose(enabled: Boolean, values: List<T>, old: T?): T? {
            if (!enabled) return null
            if (old == null) return values.random(random)
            if (random.nextDouble() < settings.matchProbability) return old
            return values.filterNot { it == old }.random(random)
        }
        return Stimulus(
            number,
            choose(Modality.POSITION in settings.enabledModalities, (0 until settings.gridSize * settings.gridSize).toList(), reference?.position),
            choose(Modality.AUDIO in settings.enabledModalities, ('A'..'Z').toList(), reference?.letter),
            choose(Modality.COLOR in settings.enabledModalities, colors, reference?.color),
            choose(Modality.SHAPE in settings.enabledModalities, shapes, reference?.shape),
        ).also(history::add)
    }

    fun respond(modality: Modality): Boolean {
        val stimulus = current ?: return false
        if (isWarmup || modality !in settings.enabledModalities) return false
        return responses.getOrPut(stimulus.number) { mutableSetOf() }.add(modality)
    }

    fun responsesForCurrent(): Set<Modality> = current?.let { responses[it.number]?.toSet() }.orEmpty()

    fun score(): Score {
        check(isComplete)
        val result = settings.enabledModalities.associateWith { modality ->
            var matrix = Matrix()
            history.drop(settings.currentLevel).forEach { stimulus ->
                val previous = history[stimulus.number - settings.currentLevel - 1]
                val match = value(stimulus, modality) == value(previous, modality)
                val pressed = modality in responses[stimulus.number].orEmpty()
                matrix = when {
                    match && pressed -> matrix.copy(tp = matrix.tp + 1)
                    !match && pressed -> matrix.copy(fp = matrix.fp + 1)
                    match -> matrix.copy(fn = matrix.fn + 1)
                    else -> matrix.copy(tn = matrix.tn + 1)
                }
            }
            matrix
        }
        return Score(result)
    }

    private fun value(stimulus: Stimulus, modality: Modality): Any? = when (modality) {
        Modality.POSITION -> stimulus.position
        Modality.AUDIO -> stimulus.letter
        Modality.COLOR -> stimulus.color
        Modality.SHAPE -> stimulus.shape
    }
}
