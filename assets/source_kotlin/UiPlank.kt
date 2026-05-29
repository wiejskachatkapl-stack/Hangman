package com.example.wisielec

import androidx.annotation.DrawableRes
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// Kolor złotego tekstu (pasuje do klimatu gry)
val GoldTxt = Color(0xFFE7D08A)

/**
 * Tło na cały ekran (bez białych pasków).
 */
@Composable
fun FullscreenBackground(@DrawableRes resId: Int, modifier: Modifier = Modifier) {
    Image(
        painter = painterResource(resId),
        contentDescription = null,
        contentScale = ContentScale.Crop,
        modifier = modifier.fillMaxSize()
    )
}

/**
 * Przycisk jako sama grafika (PNG).
 */
@Composable
fun DrawableButton(
    @DrawableRes resId: Int,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    alpha: Float = 1f
) {
    Image(
        painter = painterResource(resId),
        contentDescription = null,
        contentScale = ContentScale.FillBounds,
        modifier = modifier
            .alpha(if (enabled) alpha else 0.45f)
            .clickable(enabled = enabled) { onClick() }
    )
}

/**
 * Przycisk menu / ekranów jako grafika.
 * (Zostawiamy oddzielną nazwę, bo używasz jej w MainActivity.)
 */
@Composable
fun ImageMenuButton(
    @DrawableRes resId: Int,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true
) {
    DrawableButton(resId = resId, onClick = onClick, modifier = modifier, enabled = enabled)
}

/**
 * Prosty "plank" z tekstem na środku (gdy nie masz dedykowanej grafiki przycisku).
 * Używa istniejącej deski `btn_budowlaniec1.png` (jeśli masz inną - podmień resId).
 */
@Composable
fun PlankButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    heightDp: Int = 52,
    textSize: Int = 16,
    enabled: Boolean = true,
    @DrawableRes plankResId: Int = R.drawable.btn_budowlaniec1
) {
    Box(
        modifier = modifier
            .height(heightDp.dp)
            .alpha(if (enabled) 1f else 0.5f)
            .clickable(enabled = enabled) { onClick() },
        contentAlignment = Alignment.Center
    ) {
        Image(
            painter = painterResource(plankResId),
            contentDescription = null,
            contentScale = ContentScale.FillBounds,
            modifier = Modifier.fillMaxSize()
        )
        Text(
            text = text,
            style = TextStyle(
                fontFamily = FontFamily.Serif,
                fontSize = textSize.sp,
                fontWeight = FontWeight.Black,
                color = Color.White
            )
        )
    }
}

/**
 * Mały "chip" / plakietka z tekstem (np. na obrazku z kodem pokoju).
 */
@Composable
fun OverlayLabel(
    text: String,
    modifier: Modifier = Modifier,
    alpha: Float = 0.55f
) {
    Box(
        modifier = modifier
            .background(Color.Black.copy(alpha = alpha), RoundedCornerShape(10.dp))
            .padding(horizontal = 10.dp, vertical = 6.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            style = TextStyle(
                fontFamily = FontFamily.Serif,
                fontSize = 18.sp,
                fontWeight = FontWeight.Black,
                color = Color.White
            )
        )
    }
}
