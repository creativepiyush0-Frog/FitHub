package com.example.ui.theme

import androidx.compose.ui.graphics.Color

// FIT HUB Official Brand Colors
val FitHubPrimary = Color(0xFFF0441D) // Official Vivid Athletic Orange
val FitHubPrimaryHover = Color(0xFFFF542B) // Hover / Pressed Orange
val FitHubWhite = Color(0xFFFFFFFF)

// Surfaces & Backgrounds (Exact FitHub Visual Design System)
val FitHubBg = Color(0xFF0A0A0A) // Primary near-black background
val FitHubSurface = Color(0xFF171717) // Secondary surface
val FitHubCard = Color(0xFF1D1D1D) // Card surface (14-18px radius)
val FitHubInput = Color(0xFF242424) // Input surface
val FitHubBorder = Color(0xFF393939) // Thin gray border

// Text & Content Hierarchy
val FitHubTextPrimary = Color(0xFFFFFFFF)
val FitHubTextSecondary = Color(0xFFB5B5B5)
val FitHubTextMuted = Color(0xFF858585)

// Status Accents
val FitHubSuccess = Color(0xFF22C55E) // Controlled subtle green
val FitHubWarning = Color(0xFFF59E0B) // Controlled subtle amber
val FitHubError = Color(0xFFEF4444) // Controlled red

// Legacy mapping for backwards-compatibility across existing screens
val GymPrimary = FitHubPrimary
val GymPrimaryDark = Color(0xFFD03814)
val GymPrimaryLight = FitHubPrimaryHover
val GymPrimaryContainer = Color(0xFF33160E)

val GymSecondary = Color(0xFF00E5FF)
val GymSecondaryContainer = Color(0xFF004D57)
val GymAccentOrange = FitHubPrimary
val GymAccentPurple = Color(0xFF8A2BE2)

val GymDarkBg = FitHubBg
val GymDarkSurface = FitHubSurface
val GymDarkCard = FitHubCard
val GymDarkCardHover = Color(0xFF282828)
val GymDarkBorder = FitHubBorder

val GymLightBg = Color(0xFFF4F6F8)
val GymLightSurface = Color(0xFFFFFFFF)
val GymLightCard = Color(0xFFFFFFFF)
val GymLightBorder = Color(0xFFE2E8F0)

val GymSuccess = FitHubSuccess
val GymWarning = FitHubWarning
val GymError = FitHubError
val GymInfo = Color(0xFF2979FF)

val GymTextPrimaryDark = FitHubTextPrimary
val GymTextSecondaryDark = FitHubTextSecondary
val GymTextMutedDark = FitHubTextMuted

val GymTextPrimaryLight = Color(0xFF0F172A)
val GymTextSecondaryLight = Color(0xFF475569)
val GymTextMutedLight = Color(0xFF94A3B8)
