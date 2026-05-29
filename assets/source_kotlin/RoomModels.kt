package com.example.wisielec

/**
 * Model pokoju multiplayer.
 *
 * Dokument: rooms/{code}
 * Subkolekcja: rooms/{code}/players/{uid}
 */
data class Room(
    val code: String = "",
    val hostUid: String = "",
    val hostNick: String = "",
    val status: String = "waiting",     // waiting / started
    val mode: String = "code",          // code / quick
    val playersCount: Int = 0,
    val seed: Long? = null,
    val cat: String? = null,
    val phr: String? = null
)

data class RoomPlayer(
    val uid: String = "",
    val nick: String = "",
    val isHost: Boolean = false
)
