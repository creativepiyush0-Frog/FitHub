package com.example.ui.auth

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.model.UserRole
import com.example.ui.theme.*

/**
 * Clean text-based FIT HUB logo matching the visual specification:
 * - "FIT" in vivid orange #F0441D
 * - "HUB" in white #FFFFFF
 * - uppercase, bold condensed athletic typography
 * - compact horizontal wordmark
 * - clean sharp letterforms, no gradient, no shadow, no icon attached
 */
@Composable
fun FitHubLogo(
    fontSize: Int = 32,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = "FIT",
            color = FitHubPrimary,
            fontSize = fontSize.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 1.sp
        )
        Text(
            text = "HUB",
            color = FitHubWhite,
            fontSize = fontSize.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 1.sp
        )
    }
}

/**
 * Role Selection Screen matching the FitHub visual design:
 * - FIT HUB logo at top
 * - "Your complete fitness ecosystem" subtitle
 * - "CHOOSE YOUR ROLE" condensed uppercase heading
 * - 3 large stacked cards (Member, Gym Owner / Admin, Super Admin)
 */
@Composable
fun RoleSelectionScreen(
    onRoleSelected: (UserRole) -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(FitHubBg)
            .padding(horizontal = 20.dp, vertical = 24.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .widthIn(max = 440.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Brand Wordmark
            FitHubLogo(fontSize = 38)
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "Your complete fitness ecosystem",
                fontSize = 13.sp,
                color = FitHubTextSecondary,
                fontWeight = FontWeight.Medium
            )

            Spacer(modifier = Modifier.height(36.dp))

            // Section Heading
            Text(
                text = "CHOOSE YOUR ROLE",
                fontSize = 20.sp,
                fontWeight = FontWeight.Black,
                color = FitHubWhite,
                letterSpacing = 1.5.sp,
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Start
            )

            Spacer(modifier = Modifier.height(18.dp))

            // 3 Large Vertically Stacked Cards
            RoleOptionCard(
                title = "Member",
                description = "Find gyms, track attendance, manage membership",
                icon = Icons.Default.Person,
                onClick = { onRoleSelected(UserRole.MEMBER) }
            )

            Spacer(modifier = Modifier.height(14.dp))

            RoleOptionCard(
                title = "Gym Owner / Admin",
                description = "Manage members, view enquiries, track activity",
                icon = Icons.Default.Storefront,
                onClick = { onRoleSelected(UserRole.BRANCH_ADMIN) }
            )

            Spacer(modifier = Modifier.height(14.dp))

            RoleOptionCard(
                title = "Super Admin",
                description = "Full platform control — all gyms and members",
                icon = Icons.Default.Shield,
                onClick = { onRoleSelected(UserRole.SUPER_ADMIN) }
            )
        }
    }
}

@Composable
fun RoleOptionCard(
    title: String,
    description: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = FitHubCard),
        border = BorderStroke(1.dp, FitHubBorder)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Icon box
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .background(FitHubSurface, RoundedCornerShape(10.dp))
                    .border(1.dp, FitHubBorder, RoundedCornerShape(10.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = FitHubPrimary,
                    modifier = Modifier.size(22.dp)
                )
            }

            Spacer(modifier = Modifier.width(16.dp))

            // Text
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    color = FitHubWhite
                )
                Spacer(modifier = Modifier.height(3.dp))
                Text(
                    text = description,
                    fontSize = 12.sp,
                    color = FitHubTextSecondary,
                    lineHeight = 16.sp
                )
            }

            Spacer(modifier = Modifier.width(8.dp))

            // Right Chevron
            Icon(
                imageVector = Icons.Default.ChevronRight,
                contentDescription = null,
                tint = FitHubTextMuted,
                modifier = Modifier.size(20.dp)
            )
        }
    }
}

/**
 * Dedicated FitHub Login Screen for a chosen role:
 * - Back button: "← Back to roles"
 * - FIT HUB Logo
 * - Large condensed uppercase page title ("WELCOME BACK", "GYM OWNER LOGIN", "SUPER ADMIN")
 * - Form fields with uppercase small muted labels ("EMAIL / MOBILE", "PASSWORD")
 * - Full width orange #F0441D sign-in button
 * - Demo Credentials Card with 1-tap fill
 */
@Composable
fun FitHubLoginScreen(
    role: UserRole,
    onLoginSuccess: (email: String) -> Unit,
    onBackToRoles: () -> Unit,
    modifier: Modifier = Modifier
) {
    val pageTitle = when (role) {
        UserRole.MEMBER -> "WELCOME BACK"
        UserRole.BRANCH_ADMIN -> "GYM OWNER LOGIN"
        UserRole.SUPER_ADMIN -> "SUPER ADMIN"
    }

    val defaultEmail = when (role) {
        UserRole.MEMBER -> "creative.piyush0@gmail.com"
        UserRole.BRANCH_ADMIN -> "admin@downtown.fithub.com"
        UserRole.SUPER_ADMIN -> "platform@fithub.com"
    }

    var emailOrMobile by remember { mutableStateOf(defaultEmail) }
    var password by remember { mutableStateOf("••••••••") }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(FitHubBg)
            .padding(horizontal = 20.dp, vertical = 20.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .widthIn(max = 420.dp)
        ) {
            // Back button
            TextButton(
                onClick = onBackToRoles,
                contentPadding = PaddingValues(0.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.ArrowBack,
                        contentDescription = "Back",
                        tint = Color(0xFFAAAAAA),
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Back to roles",
                        fontSize = 13.sp,
                        color = Color(0xFFAAAAAA),
                        fontWeight = FontWeight.Medium
                    )
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // FIT HUB Logo
            FitHubLogo(fontSize = 32)
            Spacer(modifier = Modifier.height(8.dp))

            // Large condensed uppercase page title
            Text(
                text = pageTitle,
                fontSize = 24.sp,
                fontWeight = FontWeight.Black,
                color = FitHubWhite,
                letterSpacing = 1.sp
            )

            Spacer(modifier = Modifier.height(24.dp))

            // Form Fields
            // Label 1: EMAIL / MOBILE
            Text(
                text = "EMAIL / MOBILE",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = FitHubTextSecondary,
                letterSpacing = 1.sp
            )
            Spacer(modifier = Modifier.height(6.dp))
            OutlinedTextField(
                value = emailOrMobile,
                onValueChange = { emailOrMobile = it },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(10.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = FitHubInput,
                    unfocusedContainerColor = FitHubInput,
                    focusedBorderColor = FitHubPrimary,
                    unfocusedBorderColor = FitHubBorder,
                    focusedTextColor = FitHubWhite,
                    unfocusedTextColor = FitHubWhite
                ),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Label 2: PASSWORD
            Text(
                text = "PASSWORD",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = FitHubTextSecondary,
                letterSpacing = 1.sp
            )
            Spacer(modifier = Modifier.height(6.dp))
            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(10.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = FitHubInput,
                    unfocusedContainerColor = FitHubInput,
                    focusedBorderColor = FitHubPrimary,
                    unfocusedBorderColor = FitHubBorder,
                    focusedTextColor = FitHubWhite,
                    unfocusedTextColor = FitHubWhite
                ),
                singleLine = true,
                visualTransformation = PasswordVisualTransformation()
            )

            Spacer(modifier = Modifier.height(24.dp))

            // Primary Full-Width Orange Button
            Button(
                onClick = { onLoginSuccess(emailOrMobile) },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = FitHubPrimary,
                    contentColor = FitHubWhite
                )
            ) {
                Text(
                    text = when (role) {
                        UserRole.MEMBER -> "SIGN IN"
                        UserRole.BRANCH_ADMIN -> "SIGN IN AS ADMIN"
                        UserRole.SUPER_ADMIN -> "ACCESS SUPER ADMIN"
                    },
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 1.sp
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Demo Credentials Info Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = FitHubCard),
                border = BorderStroke(1.dp, FitHubPrimary.copy(alpha = 0.4f))
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text(
                        text = "DEMO CREDENTIALS",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Black,
                        color = FitHubPrimary,
                        letterSpacing = 1.sp
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Pre-configured for development testing ($emailOrMobile). Tap 'SIGN IN' above for instant verified access.",
                        fontSize = 11.sp,
                        color = FitHubTextSecondary,
                        lineHeight = 15.sp
                    )
                }
            }
        }
    }
}
