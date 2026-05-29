package com.example.wisielec

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlin.random.Random

class PlayerRepository(context: Context) {

    private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private val _playerName = MutableStateFlow(prefs.getString(KEY_NAME, "") ?: "")
    val playerName: StateFlow<String> = _playerName.asStateFlow()

    private val _playerId = MutableStateFlow(prefs.getString(KEY_ID, "") ?: "")
    val playerId: StateFlow<String> = _playerId.asStateFlow()

    init {
        if (_playerId.value.isBlank()) {
            val newId = generateId()
            prefs.edit().putString(KEY_ID, newId).apply()
            _playerId.value = newId
        }
    }

    fun setPlayerName(name: String) {
        val n = name.trim().take(20)
        prefs.edit().putString(KEY_NAME, n).apply()
        _playerName.value = n
    }

    fun ensurePlayerId(): String {
        val cur = _playerId.value
        if (cur.isNotBlank()) return cur
        val newId = generateId()
        prefs.edit().putString(KEY_ID, newId).apply()
        _playerId.value = newId
        return newId
    }

    private fun generateId(): String {
        val alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // bez 0/O/I/1
        return buildString {
            repeat(7) { append(alphabet[Random.nextInt(alphabet.length)]) }
        }
    }

    companion object {
        private const val PREFS = "wisielec_player"
        private const val KEY_NAME = "player_name"
        private const val KEY_ID = "player_id"
    }
}
