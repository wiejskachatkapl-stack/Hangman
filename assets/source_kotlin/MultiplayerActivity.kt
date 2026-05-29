package com.example.wisielec

import android.content.Intent
import android.content.pm.ActivityInfo
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch

class MultiplayerActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE

        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = Color.Black) {
                    MultiplayerRoot()
                }
            }
        }
    }
}

private enum class MpScreen { LOBBY, ROOM }

@Composable
private fun MultiplayerRoot() {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()

    val repo = remember { RoomsRepository() }
    val playerRepo = remember { PlayerRepository(ctx.applicationContext) }

    val nick by playerRepo.playerName.collectAsState(initial = "")
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    var screen by remember { mutableStateOf(MpScreen.LOBBY) }
    var currentRoomCode by remember { mutableStateOf<String?>(null) }
    var joinCode by remember { mutableStateOf("") }

    // Auth anon
    LaunchedEffect(Unit) {
        try {
            FirebaseSession.ensureSignedIn()
        } catch (e: Exception) {
            error = e.message ?: "Błąd logowania Firebase"
        }
    }

    BackHandler {
        if (screen == MpScreen.ROOM) {
            screen = MpScreen.LOBBY
            currentRoomCode = null
        } else {
            (ctx as? ComponentActivity)?.finish()
        }
    }

    when (screen) {
        MpScreen.LOBBY -> LobbyScreen(
            nick = nick.ifBlank { "(brak nicku)" },
            joinCode = joinCode,
            onJoinCodeChange = { joinCode = it.uppercase().take(8) },
            onCreateRoom = {
                scope.launch {
                    busy = true
                    error = null
                    try {
                        val code = repo.createRoom(nick.ifBlank { "Gracz" })
                        currentRoomCode = code
                        screen = MpScreen.ROOM
                    } catch (e: Exception) {
                        error = e.message ?: "Błąd tworzenia pokoju"
                    } finally {
                        busy = false
                    }
                }
            },
            onJoinRoom = {
                scope.launch {
                    busy = true
                    error = null
                    try {
                        val code = joinCode.trim().uppercase()
                        if (code.length < 4) throw IllegalStateException("Wpisz kod pokoju")
                        repo.joinRoom(code, nick.ifBlank { "Gracz" })
                        currentRoomCode = code
                        screen = MpScreen.ROOM
                    } catch (e: Exception) {
                        error = e.message ?: "Błąd dołączania"
                    } finally {
                        busy = false
                    }
                }
            },
            onQuickMatch = {
                scope.launch {
                    busy = true
                    error = null
                    try {
                        val code = repo.quickMatch(nick.ifBlank { "Gracz" })
                        currentRoomCode = code
                        screen = MpScreen.ROOM
                    } catch (e: Exception) {
                        error = e.message ?: "Błąd szybkiego meczu"
                    } finally {
                        busy = false
                    }
                }
            },
            onMenu = { (ctx as? ComponentActivity)?.finish() },
            error = error,
            busy = busy
        )

        MpScreen.ROOM -> RoomScreen(
            code = currentRoomCode ?: "",
            repo = repo,
            nick = nick.ifBlank { "Gracz" },
            onExit = {
                screen = MpScreen.LOBBY
                currentRoomCode = null
            },
            onStartGame = { cat, phr ->
                val i = Intent(ctx, GameActivity::class.java).apply {
                    putExtra("category", cat)
                    putExtra("phrase", phr)
                }
                ctx.startActivity(i)
                // po starcie wracamy do menu głównego (jak w single)
                screen = MpScreen.LOBBY
                currentRoomCode = null
            }
        )
    }
}

@Composable
private fun LobbyScreen(
    nick: String,
    joinCode: String,
    onJoinCodeChange: (String) -> Unit,
    onCreateRoom: () -> Unit,
    onJoinRoom: () -> Unit,
    onQuickMatch: () -> Unit,
    onMenu: () -> Unit,
    error: String?,
    busy: Boolean
) {
    Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
        // tło
        FullscreenBackground(resId = R.drawable.bg_menu_forest_gallows_2)

        // tytuł (mniejszy, nad obrazem, na środku)
        Text(
            text = "GRA PODWÓJNA (pokoje)",
            style = TextStyle(
                fontFamily = FontFamily.Serif,
                fontSize = 18.sp,
                fontWeight = FontWeight.Black,
                color = GoldTxt
            ),
            modifier = Modifier
                .align(Alignment.TopCenter)
                .padding(top = 10.dp)
        )

        // lewy obrazek (podniesiony i szerszy)
        Box(
            modifier = Modifier
                .align(Alignment.CenterStart)
                .padding(start = 14.dp, top = 30.dp, bottom = 26.dp)
                .fillMaxWidth(0.56f)
                .fillMaxHeight(0.82f)
        ) {
            Image(
                painter = painterResource(R.drawable.btn_rooms),
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = androidx.compose.ui.layout.ContentScale.Fit
            )
        }

        // prawy panel
        Column(
            modifier = Modifier
                .align(Alignment.CenterEnd)
                .padding(end = 16.dp, top = 40.dp, bottom = 30.dp)
                .fillMaxWidth(0.38f)
                .background(Color.Black.copy(alpha = 0.28f), RoundedCornerShape(14.dp))
                .padding(14.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "Nick: $nick",
                style = TextStyle(
                    fontFamily = FontFamily.Serif,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                ),
                modifier = Modifier.align(Alignment.Start)
            )

            Spacer(Modifier.height(8.dp))

            // UTWÓRZ POKÓJ (mniejszy, wysoko pod Nick)
            DrawableButton(
                resId = R.drawable.btn_create_room,
                onClick = onCreateRoom,
                enabled = !busy,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(38.dp)
            )

            Spacer(Modifier.height(10.dp))

            // pole kodu + wejście
            OutlinedTextField(
                value = joinCode,
                onValueChange = onJoinCodeChange,
                singleLine = true,
                placeholder = { Text("Kod pokoju") },
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(Modifier.height(8.dp))

            DrawableButton(
                resId = R.drawable.btn_go_room,
                onClick = onJoinRoom,
                enabled = !busy,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(38.dp)
            )

            Spacer(Modifier.height(10.dp))

            // SZYBKI MECZ (na razie plank z tekstem, żeby działało)
            PlankButton(
                text = "SZYBKI MECZ (świat)",
                onClick = onQuickMatch,
                enabled = !busy,
                modifier = Modifier.fillMaxWidth(),
                heightDp = 46,
                textSize = 14
            )

            if (!error.isNullOrBlank()) {
                Spacer(Modifier.height(8.dp))
                Text(
                    text = error,
                    color = Color(0xFFFFB4B4),
                    style = TextStyle(fontSize = 12.sp, fontFamily = FontFamily.Serif)
                )
            }
        }

        // małe MENU po lewej na dole
        DrawableButton(
            resId = R.drawable.btn_menu,
            onClick = onMenu,
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(start = 14.dp, bottom = 12.dp)
                .width(90.dp)
                .height(28.dp)
        )
    }
}

@Composable
private fun RoomScreen(
    code: String,
    repo: RoomsRepository,
    nick: String,
    onExit: () -> Unit,
    onStartGame: (cat: String, phr: String) -> Unit
) {
    val ctx = LocalContext.current
    val clipboard = LocalClipboardManager.current
    val scope = rememberCoroutineScope()
    val myUid = FirebaseSession.uidOrNull() ?: ""

    val room by repo.observeRoom(code).collectAsState(initial = null)
    val players by repo.observePlayers(code).collectAsState(initial = emptyList())

    // auto-start quick match (host tylko)
    LaunchedEffect(room?.mode, room?.status, players.size) {
        val r = room ?: return@LaunchedEffect
        if (r.mode == "quick" && r.status == "waiting" && players.size >= 2 && myUid == r.hostUid) {
            try { repo.startGame(code) } catch (_: Exception) {}
        }
    }

    // start gry kiedy status=started (oba telefony)
    LaunchedEffect(room?.status, room?.cat, room?.phr) {
        val r = room ?: return@LaunchedEffect
        if (r.status == "started" && !r.cat.isNullOrBlank() && !r.phr.isNullOrBlank()) {
            onStartGame(r.cat!!, r.phr!!)
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
        FullscreenBackground(resId = R.drawable.bg_menu_forest_gallows_2)

        // lewy obrazek + kod na dole obrazu
        Box(
            modifier = Modifier
                .align(Alignment.CenterStart)
                .padding(start = 14.dp, top = 18.dp, bottom = 22.dp)
                .fillMaxWidth(0.56f)
                .fillMaxHeight(0.84f)
        ) {
            Image(
                painter = painterResource(R.drawable.btn_rooms),
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = androidx.compose.ui.layout.ContentScale.Fit
            )

            // KOD POKOJU na obrazie
            if (code.isNotBlank()) {
                Column(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = 16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "KOD POKOJU:",
                        style = TextStyle(
                            fontFamily = FontFamily.Serif,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    )
                    Text(
                        text = code,
                        style = TextStyle(
                            fontFamily = FontFamily.Serif,
                            fontSize = 26.sp,
                            fontWeight = FontWeight.Black,
                            color = Color.White
                        )
                    )
                }
            }
        }

        // prawy panel status
        Column(
            modifier = Modifier
                .align(Alignment.CenterEnd)
                .padding(end = 16.dp, top = 22.dp, bottom = 22.dp)
                .fillMaxWidth(0.38f)
                .background(Color.Black.copy(alpha = 0.28f), RoundedCornerShape(14.dp))
                .padding(14.dp)
        ) {
            Text(
                text = "JESTEŚ W POKOJU",
                style = TextStyle(
                    fontFamily = FontFamily.Serif,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Black,
                    color = Color.White
                )
            )
            Spacer(Modifier.height(8.dp))

            Text("Status: ${room?.status ?: "..." }", color = Color.White, fontSize = 13.sp, fontFamily = FontFamily.Serif)
            Text("Osób: ${players.size}/2", color = Color.White, fontSize = 13.sp, fontFamily = FontFamily.Serif)

            Spacer(Modifier.height(8.dp))
            Text("Gracze:", color = Color.White, fontSize = 13.sp, fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold)
            players.forEach { p ->
                Text("• ${p.nick}", color = Color.White, fontSize = 13.sp, fontFamily = FontFamily.Serif)
            }

            Spacer(Modifier.height(10.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                PlankButton(
                    text = "KOPIUJ KOD",
                    onClick = { clipboard.setText(AnnotatedString(code)) },
                    modifier = Modifier.weight(1f),
                    heightDp = 40,
                    textSize = 12
                )
                DrawableButton(
                    resId = R.drawable.btn_menu,
                    onClick = onExit,
                    modifier = Modifier
                        .width(90.dp)
                        .height(28.dp)
                )
            }

            Spacer(Modifier.height(10.dp))

            val r = room
            val canStart = (r != null && r.status == "waiting" && players.size >= 2 && myUid == r.hostUid && r.mode == "code")
            if (canStart) {
                // przycisk GRAJ
                PlankButton(
                    text = "GRAJ",
                    onClick = {
                        scope.launch {
                            try { repo.startGame(code) } catch (_: Exception) {}
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    heightDp = 54,
                    textSize = 18
                )
            } else {
                val msg = if (r?.mode == "quick") "Czekasz na drugiego gracza..." else "Czekasz aż host wystartuje..."
                Text(msg, color = Color.White.copy(alpha = 0.85f), fontSize = 12.sp, fontFamily = FontFamily.Serif)
            }
        }

        // mały COFNIJ (zamiast MENU) po lewej na dole
        DrawableButton(
            resId = R.drawable.btn_back,
            onClick = onExit,
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(start = 14.dp, bottom = 12.dp)
                .width(90.dp)
                .height(28.dp)
        )
    }
}
