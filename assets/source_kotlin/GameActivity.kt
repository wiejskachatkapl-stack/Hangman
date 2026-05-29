package com.example.wisielec

import android.content.pm.ActivityInfo
import android.graphics.Color
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color.Companion.Black
import androidx.compose.ui.graphics.Color.Companion.White
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

class GameActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE

        // usuwa biały pasek po prawej (system navigation bar)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT

        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.isAppearanceLightStatusBars = false
        controller.isAppearanceLightNavigationBars = false
        controller.hide(WindowInsetsCompat.Type.systemBars())
        controller.systemBarsBehavior =
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE

        val startCategory = intent.getStringExtra("category") ?: "SPORT"
        val startPhrase = intent.getStringExtra("phrase") ?: "TEST"

        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = Black) {
                    GameScreen(
                        startCategory = startCategory,
                        startPhrase = startPhrase,
                        onExitToMenu = { finish() }
                    )
                }
            }
        }
    }
}

private enum class RoundOutcome { WIN, LOSE }

@Composable
private fun GameScreen(
    startCategory: String,
    startPhrase: String,
    onExitToMenu: () -> Unit
) {
    val ctx = LocalContext.current
    val repo = remember { GameRepository(ctx.applicationContext) }

    val totalPoints by repo.totalPoints.collectAsState(initial = 0)
    val zombiePoints by repo.zombiePoints.collectAsState(initial = 0)
    val zombieIndex by repo.currentZombieIndex.collectAsState(initial = 0)
    val lifelinesLeft by repo.lifelinesLeft.collectAsState(initial = 3)

    val maxMistakes = 6

    // aktualny zombiak
    val zombiesCount = Zombies.list.size
    val safeIndex = if (zombiesCount == 0) 0 else (zombieIndex % zombiesCount + zombiesCount) % zombiesCount
    val currentZombie = remember(safeIndex, zombiesCount) {
        if (zombiesCount == 0) null else Zombies.list[safeIndex]
    }

    // UI regulacje (łatwo zmieniać)
    val hudAlpha = 0.35f
    val panelAlpha = 0.28f
    val phrasePanelWidthFraction = 0.55f
    val keySize = 30.dp
    val keyTextSize = 16.sp
    val phraseTextSize = 28.sp
    val lifelineSize = 46.dp

    // stan rundy
    var category by rememberSaveable { mutableStateOf(startCategory) }
    var phrase by rememberSaveable { mutableStateOf(startPhrase) }
    val phraseUpper = remember(phrase) { phrase.trim().uppercase() }

    var mistakes by rememberSaveable { mutableIntStateOf(0) }
    var guessed by rememberSaveable { mutableStateOf(setOf<Char>()) }

    var roundOutcome by rememberSaveable { mutableStateOf<RoundOutcome?>(null) }

    // overlay: pytanie "grasz dalej?"
    var showRoundPrompt by rememberSaveable { mutableStateOf(false) }

    // overlay: pokaz tylko zombiaka po 300/300
    var showFinalZombieOverlay by rememberSaveable { mutableStateOf(false) }

    // blokada w momencie finalnym
    val isFinalZombieNow = zombiePoints >= GameRepository.FINAL_ZOMBIE_POINTS

    // wstecz = menu
    BackHandler { onExitToMenu() }

    // stage grafiki (0..6)
    val stage = (zombiePoints / 50).coerceIn(0, 6)
    val bgRes = remember(stage, currentZombie) {
        if (stage == 0 || currentZombie == null) {
            R.drawable.bg_game_single
        } else {
            // stage 1..6 => stagesRes[0..5]
            val idx = (stage - 1).coerceIn(0, 5)
            currentZombie.stagesRes.getOrNull(idx) ?: R.drawable.bg_game_single
        }
    }

    // sprawdź czy hasło wygrane
    val isWin = remember(phraseUpper, guessed) {
        phraseUpper
            .filter { it != ' ' && it != '-' }
            .all { guessed.contains(it) }
    }

    // rozstrzyganie rundy
    LaunchedEffect(isWin, mistakes, roundOutcome, isFinalZombieNow) {
        if (roundOutcome != null) return@LaunchedEffect
        if (showFinalZombieOverlay) return@LaunchedEffect
        if (isFinalZombieNow) return@LaunchedEffect

        if (isWin) {
            roundOutcome = RoundOutcome.WIN
            showRoundPrompt = true

            // punkty za wygraną rundę (50)
            repo.setTotalPoints(totalPoints + 50)
            repo.setZombiePoints(zombiePoints + 50)

            // jeśli to dobija do 300 -> pokaż final zombiaka
            if ((zombiePoints + 50) >= GameRepository.FINAL_ZOMBIE_POINTS) {
                showRoundPrompt = false
                showFinalZombieOverlay = true
            }
        } else if (mistakes >= maxMistakes) {
            roundOutcome = RoundOutcome.LOSE
            showRoundPrompt = true
        }
    }

    fun startNextRound() {
        // losujemy nową kategorię + hasło
        val (cat, phr) = GameData.drawCategoryAndPhrase()
        category = cat
        phrase = phr
        mistakes = 0
        guessed = emptySet()
        roundOutcome = null
        showRoundPrompt = false
    }

    fun onLetterClick(ch: Char) {
        if (isFinalZombieNow) return
        if (showRoundPrompt) return
        if (showFinalZombieOverlay) return
        if (roundOutcome != null) return
        if (guessed.contains(ch)) return

        guessed = guessed + ch
        if (!phraseUpper.contains(ch)) {
            mistakes += 1
        }
    }

    fun useLifeline() {
        if (isFinalZombieNow) return
        if (showRoundPrompt) return
        if (showFinalZombieOverlay) return
        if (roundOutcome != null) return
        if (lifelinesLeft <= 0) return

        // litery do wylosowania: takie, których jeszcze nie ma w guessed i występują w haśle
        val candidates = phraseUpper
            .asSequence()
            .filter { it != ' ' && it != '-' }
            .filter { !guessed.contains(it) }
            .toSet()
            .toList()

        if (candidates.isEmpty()) return

        val picked = candidates.random()
        guessed = guessed + picked
        repo.consumeLifeline()
    }

    // UI
    Box(modifier = Modifier.fillMaxSize().background(Black)) {
        FullscreenBackground(resId = bgRes)

        // ===== HUD górny (Punkty / Zombiak / Błędy) =====
        Row(
            modifier = Modifier
                .align(Alignment.TopStart)
                .padding(start = 12.dp, top = 10.dp)
                .background(Black.copy(alpha = hudAlpha), RoundedCornerShape(10.dp))
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            HudText("Punkty: $totalPoints")
            Spacer(Modifier.width(12.dp))
            HudText("Zombiak: ${zombiePoints.coerceIn(0, 300)}/300")
            Spacer(Modifier.width(12.dp))
            HudText("Błędy: ${mistakes.coerceIn(0, 6)}/6")
        }

        // ===== Panel hasła + kategoria + pomoc =====
        // Gdy final (300/300) -> nie pokazujemy hasła ani klawiatury
        if (!showFinalZombieOverlay && !isFinalZombieNow) {

            Column(
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(start = 12.dp, top = 70.dp)
                    .fillMaxWidth(phrasePanelWidthFraction)
                    .background(Black.copy(alpha = panelAlpha), RoundedCornerShape(10.dp))
                    .padding(10.dp)
            ) {
                // HASŁO (z odstępami między znakami, żeby było widać liczbę liter)
                Text(
                    text = maskedPhraseWithSpaces(phraseUpper, guessed),
                    style = TextStyle(
                        fontFamily = FontFamily.Serif,
                        fontSize = phraseTextSize,
                        fontWeight = FontWeight.Black,
                        color = White
                    )
                )

                Spacer(Modifier.height(10.dp))

                Text(
                    text = "Kategoria: ${category.uppercase()}",
                    style = TextStyle(
                        fontFamily = FontFamily.Serif,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = White
                    )
                )

                Spacer(Modifier.height(6.dp))

                // Koła ratunkowe
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "Pomoc: ${lifelinesLeft}/3",
                        style = TextStyle(
                            fontFamily = FontFamily.Serif,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = White
                        )
                    )
                    Spacer(Modifier.width(10.dp))

                    repeat(3) { idx ->
                        val active = idx < lifelinesLeft
                        if (active) {
                            Image(
                                painter = painterResource(R.drawable.btn_kolo_ratunek),
                                contentDescription = "Koło ratunkowe",
                                modifier = Modifier
                                    .size(lifelineSize)
                                    .clickable { useLifeline() }
                            )
                        } else {
                            Spacer(Modifier.size(lifelineSize))
                        }
                        Spacer(Modifier.width(12.dp))
                    }
                }
            }

            // ===== Klawiatura =====
            Column(
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .padding(start = 12.dp, bottom = 12.dp)
            ) {
                val rows = listOf(
                    "ABCDEFGHIJKL",
                    "MNOPRSTUWXYZ",
                    "ĄĆĘŁŃÓŚŹŻ"
                )

                rows.forEach { row ->
                    Row {
                        row.forEach { ch ->
                            if (guessed.contains(ch)) {
                                Spacer(Modifier.size(keySize))
                            } else {
                                LetterKey(
                                    ch = ch,
                                    size = keySize,
                                    textSize = keyTextSize,
                                    onClick = { onLetterClick(ch) }
                                )
                            }
                            Spacer(Modifier.width(4.dp))
                        }
                    }
                    Spacer(Modifier.height(6.dp))
                }
            }
        }

        // ===== MENU button na dole po prawej =====
        DrawableButton(
            resId = R.drawable.btn_menu,
            onClick = onExitToMenu,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 14.dp, bottom = 12.dp)
                .width(100.dp)
                .height(34.dp)
        )

        // ===== Prompt: grasz dalej? =====
        if (showRoundPrompt && roundOutcome != null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Black.copy(alpha = 0.55f))
            ) {
                Column(
                    modifier = Modifier
                        .align(Alignment.Center)
                        .background(Black.copy(alpha = 0.60f), RoundedCornerShape(14.dp))
                        .padding(18.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = if (roundOutcome == RoundOutcome.WIN) "WYGRANA" else "PRZEGRANA",
                        style = TextStyle(
                            fontFamily = FontFamily.Serif,
                            fontSize = 34.sp,
                            fontWeight = FontWeight.Black,
                            color = White
                        )
                    )

                    Spacer(Modifier.height(12.dp))

                    Text(
                        text = "Grasz dalej?",
                        style = TextStyle(
                            fontFamily = FontFamily.Serif,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = White
                        )
                    )

                    Spacer(Modifier.height(14.dp))

                    Row {
                        PlankButton(
                            text = "DALEJ",
                            onClick = { startNextRound() },
                            modifier = Modifier.width(190.dp),
                            heightDp = 52,
                            textSize = 16
                        )
                        Spacer(Modifier.width(10.dp))
                        DrawableButton(
                            resId = R.drawable.btn_menu,
                            onClick = onExitToMenu,
                            modifier = Modifier
                                .width(100.dp)
                                .height(34.dp)
                        )
                    }
                }
            }
        }

        // ===== Final: 300/300 =====
        if (showFinalZombieOverlay || isFinalZombieNow) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Black.copy(alpha = 0.45f))
            ) {
                Column(
                    modifier = Modifier
                        .align(Alignment.Center)
                        .background(Black.copy(alpha = 0.60f), RoundedCornerShape(14.dp))
                        .padding(18.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "ODKRYTO ZOMBIAKA!",
                        style = TextStyle(
                            fontFamily = FontFamily.Serif,
                            fontSize = 28.sp,
                            fontWeight = FontWeight.Black,
                            color = White
                        )
                    )

                    Spacer(Modifier.height(10.dp))

                    Text(
                        text = "Dodano do galerii.",
                        style = TextStyle(
                            fontFamily = FontFamily.Serif,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = White
                        )
                    )

                    Spacer(Modifier.height(14.dp))

                    PlankButton(
                        text = "DALEJ",
                        onClick = {
                            val id = currentZombie?.id ?: return@PlankButton
                            repo.completeZombieAndGoNext(id, Zombies.list.size)

                            startNextRound()
                            showFinalZombieOverlay = false
                        },
                        modifier = Modifier.width(220.dp),
                        heightDp = 56,
                        textSize = 16
                    )
                }
            }
        }
    }
}

@Composable
private fun HudText(text: String) {
    Text(
        text = text,
        style = TextStyle(
            fontFamily = FontFamily.Serif,
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = White
        )
    )
}

@Composable
private fun LetterKey(
    ch: Char,
    size: androidx.compose.ui.unit.Dp,
    textSize: androidx.compose.ui.unit.TextUnit,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .size(size)
            .background(Black.copy(alpha = 0.40f), RoundedCornerShape(6.dp))
            .clickable { onClick() },
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = ch.toString(),
            style = TextStyle(
                fontFamily = FontFamily.Serif,
                fontSize = textSize,
                fontWeight = FontWeight.Black,
                color = White
            )
        )
    }
}

/**
 * Odstępy między znakami, żeby było widać liczbę liter.
 */
private fun maskedPhraseWithSpaces(phraseUpper: String, guessed: Set<Char>): String {
    val parts = phraseUpper.map { ch ->
        when {
            ch == ' ' -> "   "
            ch == '-' -> " - "
            guessed.contains(ch) -> " $ch "
            else -> " _ "
        }
    }
    return parts.joinToString("")
}
