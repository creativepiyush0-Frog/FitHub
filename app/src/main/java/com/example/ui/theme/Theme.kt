package com.example.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val FitHubDarkColorScheme = darkColorScheme(
    primary = FitHubPrimary,
    onPrimary = Color.White,
    primaryContainer = Color(0xFF38150D),
    onPrimaryContainer = Color(0xFFFFD4C7),
    secondary = FitHubPrimaryHover,
    onSecondary = Color.White,
    background = FitHubBg,
    onBackground = FitHubTextPrimary,
    surface = FitHubSurface,
    onSurface = FitHubTextPrimary,
    surfaceVariant = FitHubCard,
    onSurfaceVariant = FitHubTextSecondary,
    outline = FitHubBorder,
    error = FitHubError,
    onError = Color.White
)

private val FitHubLightColorScheme = lightColorScheme(
    primary = FitHubPrimary,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFFFD4C7),
    onPrimaryContainer = Color(0xFF38150D),
    secondary = FitHubPrimaryHover,
    onSecondary = Color.White,
    background = FitHubBg,
    onBackground = FitHubTextPrimary,
    surface = FitHubSurface,
    onSurface = FitHubTextPrimary,
    surfaceVariant = FitHubCard,
    onSurfaceVariant = FitHubTextSecondary,
    outline = FitHubBorder,
    error = FitHubError,
    onError = Color.White
)

@Composable
fun MyApplicationTheme(
    darkTheme: Boolean = true,
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = FitHubDarkColorScheme,
        typography = Typography,
        content = content
    )
}
