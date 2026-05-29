package com.example.wisielec

import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import kotlin.random.Random

class RoomsRepository(
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance()
) {

    private fun rooms() = db.collection("rooms")

    fun observeRoom(code: String): Flow<Room?> = callbackFlow {
        val reg = rooms().document(code).addSnapshotListener { snap, err ->
            if (err != null) {
                trySend(null)
                return@addSnapshotListener
            }
            if (snap == null || !snap.exists()) {
                trySend(null)
                return@addSnapshotListener
            }

            val room = Room(
                code = snap.id,
                hostUid = snap.getString("hostUid") ?: "",
                hostNick = snap.getString("hostNick") ?: "",
                status = snap.getString("status") ?: "waiting",
                mode = snap.getString("mode") ?: "code",
                playersCount = (snap.getLong("playersCount") ?: 0L).toInt(),
                seed = snap.getLong("seed"),
                cat = snap.getString("cat"),
                phr = snap.getString("phr")
            )
            trySend(room)
        }
        awaitClose { reg.remove() }
    }

    fun observePlayers(code: String): Flow<List<RoomPlayer>> = callbackFlow {
        val reg = rooms().document(code)
            .collection("players")
            .orderBy("joinedAt", Query.Direction.ASCENDING)
            .addSnapshotListener { snap, err ->
                if (err != null) {
                    trySend(emptyList())
                    return@addSnapshotListener
                }
                val list = snap?.documents?.map { d ->
                    RoomPlayer(
                        uid = d.id,
                        nick = d.getString("nick") ?: "",
                        isHost = d.getBoolean("isHost") ?: false
                    )
                } ?: emptyList()
                trySend(list)
            }
        awaitClose { reg.remove() }
    }

    /**
     * Tworzy pokój NA KOD (docId = code) i dołącza hosta.
     * Zwraca code.
     */
    suspend fun createRoom(nick: String): String {
        val uid = FirebaseAuth.getInstance().currentUser?.uid ?: throw IllegalStateException("Brak zalogowanego użytkownika")
        repeat(10) {
            val code = generateRoomCode()
            val roomRef = rooms().document(code)
            try {
                db.runTransaction { tx ->
                    val snap = tx.get(roomRef)
                    if (snap.exists()) throw IllegalStateException("Kod zajęty, spróbuj ponownie")

                    tx.set(roomRef, mapOf(
                        "hostUid" to uid,
                        "hostNick" to nick,
                        "status" to "waiting",
                        "mode" to "code",
                        "playersCount" to 1,
                        "createdAt" to FieldValue.serverTimestamp()
                    ))

                    tx.set(roomRef.collection("players").document(uid), mapOf(
                        "nick" to nick,
                        "isHost" to true,
                        "joinedAt" to FieldValue.serverTimestamp()
                    ))
                }.await()
                return code
            } catch (_: Exception) {
                // spróbuj kolejny kod
            }
        }
        throw IllegalStateException("Nie udało się wygenerować kodu pokoju")
    }

    /**
     * Dołącza do istniejącego pokoju.
     */
    suspend fun joinRoom(code: String, nick: String) {
        val uid = FirebaseAuth.getInstance().currentUser?.uid ?: throw IllegalStateException("Brak zalogowanego użytkownika")
        val roomRef = rooms().document(code)

        db.runTransaction { tx ->
            val snap = tx.get(roomRef)
            if (!snap.exists()) throw IllegalStateException("Pokój nie istnieje")

            val status = snap.getString("status") ?: "waiting"
            if (status != "waiting") throw IllegalStateException("Gra już wystartowała")

            val count = (snap.getLong("playersCount") ?: 0L).toInt()
            if (count >= 2) throw IllegalStateException("Pokój jest pełny")

            tx.set(roomRef.collection("players").document(uid), mapOf(
                "nick" to nick,
                "isHost" to false,
                "joinedAt" to FieldValue.serverTimestamp()
            ))

            tx.update(roomRef, "playersCount", count + 1)
        }.await()
    }

    /**
     * Szybki mecz: jeśli jest jakiś wolny pokój quick (1/2), dołączasz.
     * Jak nie ma, tworzysz swój quick i czekasz.
     * Zwraca code.
     */
    suspend fun quickMatch(nick: String): String {
        val uid = FirebaseAuth.getInstance().currentUser?.uid ?: throw IllegalStateException("Brak zalogowanego użytkownika")

        // 1) spróbuj znaleźć wolny quick
        val open = rooms()
            .whereEqualTo("mode", "quick")
            .whereEqualTo("status", "waiting")
            .whereEqualTo("playersCount", 1)
            .orderBy("createdAt", Query.Direction.ASCENDING)
            .limit(1)
            .get()
            .await()

        val doc = open.documents.firstOrNull()
        if (doc != null) {
            val code = doc.id
            val roomRef = rooms().document(code)

            // dołącz w transakcji (żeby nie było wyścigów)
            db.runTransaction { tx ->
                val snap = tx.get(roomRef)
                if (!snap.exists()) throw IllegalStateException("Pokój zniknął")

                val count = (snap.getLong("playersCount") ?: 0L).toInt()
                val status = snap.getString("status") ?: "waiting"
                if (status != "waiting" || count != 1) throw IllegalStateException("Pokój już zajęty")

                tx.set(roomRef.collection("players").document(uid), mapOf(
                    "nick" to nick,
                    "isHost" to false,
                    "joinedAt" to FieldValue.serverTimestamp()
                ))
                tx.update(roomRef, "playersCount", 2)
            }.await()

            return code
        }

        // 2) brak -> twórz nowy quick
        repeat(10) {
            val code = generateRoomCode()
            val roomRef = rooms().document(code)
            try {
                db.runTransaction { tx ->
                    val snap = tx.get(roomRef)
                    if (snap.exists()) throw IllegalStateException("Kod zajęty")

                    tx.set(roomRef, mapOf(
                        "hostUid" to uid,
                        "hostNick" to nick,
                        "status" to "waiting",
                        "mode" to "quick",
                        "playersCount" to 1,
                        "createdAt" to FieldValue.serverTimestamp()
                    ))

                    tx.set(roomRef.collection("players").document(uid), mapOf(
                        "nick" to nick,
                        "isHost" to true,
                        "joinedAt" to FieldValue.serverTimestamp()
                    ))
                }.await()
                return code
            } catch (_: Exception) {}
        }

        throw IllegalStateException("Nie udało się utworzyć szybkiego meczu")
    }

    /**
     * Start gry (tylko host). Ustawia status=started + seed + cat/phr.
     * cat/phr bierzemy z GameData (host decyduje).
     */
    suspend fun startGame(code: String) {
        val uid = FirebaseAuth.getInstance().currentUser?.uid ?: throw IllegalStateException("Brak zalogowanego użytkownika")
        val roomRef = rooms().document(code)

        db.runTransaction { tx ->
            val snap = tx.get(roomRef)
            if (!snap.exists()) throw IllegalStateException("Pokój nie istnieje")

            val hostUid = snap.getString("hostUid") ?: ""
            if (uid != hostUid) throw IllegalStateException("Tylko host może startować")

            val status = snap.getString("status") ?: "waiting"
            if (status == "started") return@runTransaction

            val (cat, phr) = GameData.drawCategoryAndPhrase()
            val seed = System.currentTimeMillis()

            tx.update(roomRef, mapOf(
                "status" to "started",
                "seed" to seed,
                "cat" to cat,
                "phr" to phr
            ))
        }.await()
    }

    private fun generateRoomCode(): String {
        val alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        return buildString { repeat(5) { append(alphabet[Random.nextInt(alphabet.length)]) } }
    }
}
