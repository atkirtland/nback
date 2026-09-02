package com.nback

import android.content.Context
import android.media.AudioAttributes
import android.media.SoundPool

class LetterPlayer(context: Context) {
    private val pool = SoundPool.Builder().setMaxStreams(2).setAudioAttributes(
        AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build()
    ).build()
    private val sounds = mapOf(
        'A' to R.raw.a, 'B' to R.raw.b, 'C' to R.raw.c, 'D' to R.raw.d, 'E' to R.raw.e,
        'F' to R.raw.f, 'G' to R.raw.g, 'H' to R.raw.h, 'I' to R.raw.i, 'J' to R.raw.j,
        'K' to R.raw.k, 'L' to R.raw.l, 'M' to R.raw.m, 'N' to R.raw.n, 'O' to R.raw.o,
        'P' to R.raw.p, 'Q' to R.raw.q, 'R' to R.raw.r, 'S' to R.raw.s, 'T' to R.raw.t,
        'U' to R.raw.u, 'V' to R.raw.v, 'W' to R.raw.w, 'X' to R.raw.x, 'Y' to R.raw.y, 'Z' to R.raw.z,
    ).mapValues { pool.load(context, it.value, 1) }

    fun play(letter: Char?) { sounds[letter]?.let { pool.play(it, 1f, 1f, 1, 0, 1f) } }
    fun release() = pool.release()
}
