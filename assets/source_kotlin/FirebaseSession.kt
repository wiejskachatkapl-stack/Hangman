package com.example.wisielec

import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.tasks.await

/**
 * Trzymamy autoryzację w jednym miejscu.
 * Używamy Anonymous Auth (w konsoli Firebase: Authentication -> Sign-in method -> Anonymous = ON).
 */
object FirebaseSession {

    suspend fun ensureSignedIn() {
        val auth = FirebaseAuth.getInstance()
        if (auth.currentUser != null) return
        auth.signInAnonymously().await()
    }

    fun uidOrNull(): String? = FirebaseAuth.getInstance().currentUser?.uid
}
