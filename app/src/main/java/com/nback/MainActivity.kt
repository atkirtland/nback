package com.nback

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels

class MainActivity : ComponentActivity() {
    private val model by viewModels<AppViewModel>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { NBackApp(model) }
    }

    override fun onStop() {
        model.pauseGame()
        super.onStop()
    }

    override fun onStart() {
        super.onStart()
        model.resumeGame()
    }
}
