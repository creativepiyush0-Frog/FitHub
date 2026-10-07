package com.example

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.example.data.GymRepository
import com.example.model.UserRole
import com.example.ui.admin.AdminDashboardScreen
import com.example.ui.auth.FitHubLoginScreen
import com.example.ui.auth.RoleSelectionScreen
import com.example.ui.components.GymTopAppBar
import com.example.ui.member.MemberDashboardScreen
import com.example.ui.superadmin.SuperAdminDashboardScreen
import com.example.ui.theme.*

enum class AppScreen {
    SPLASH,
    ROLE_SELECT,
    LOGIN,
    DASHBOARD
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MyApplicationTheme(darkTheme = true) {
                FitHubApp()
            }
        }
    }
}

@Composable
fun FitHubApp() {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val repository = remember { GymRepository() }

    // Initialize Room Database schema with initial entities
    LaunchedEffect(Unit) {
        repository.initializeRoom(context, coroutineScope)
    }

    var currentScreen by remember { mutableStateOf(AppScreen.SPLASH) }
    var authRole by remember { mutableStateOf(UserRole.MEMBER) }

    val currentRole by repository.currentRole.collectAsState()
    val currentLanguage by repository.currentLanguage.collectAsState()
    val selectedBranch by repository.selectedBranch.collectAsState()
    val branches by repository.branches.collectAsState()

    var showNotificationsDialog by remember { mutableStateOf(false) }

    when (currentScreen) {
        AppScreen.SPLASH -> {
            FitHubSplashScreen(
                onSplashFinished = {
                    currentScreen = AppScreen.DASHBOARD
                }
            )
        }

        AppScreen.ROLE_SELECT -> {
            RoleSelectionScreen(
                onRoleSelected = { role ->
                    authRole = role
                    repository.setRole(role)
                    currentScreen = AppScreen.LOGIN
                }
            )
        }

        AppScreen.LOGIN -> {
            FitHubLoginScreen(
                role = authRole,
                onLoginSuccess = {
                    repository.setRole(authRole)
                    currentScreen = AppScreen.DASHBOARD
                },
                onBackToRoles = {
                    currentScreen = AppScreen.ROLE_SELECT
                }
            )
        }

        AppScreen.DASHBOARD -> {
            Scaffold(
                modifier = Modifier.fillMaxSize(),
                containerColor = FitHubBg,
                topBar = {
                    Column {
                        GymTopAppBar(
                            currentRole = currentRole,
                            onRoleSelected = { role ->
                                repository.setRole(role)
                                authRole = role
                            },
                            selectedBranch = selectedBranch,
                            branches = branches,
                            onBranchSelected = { repository.selectBranch(it) },
                            currentLanguage = currentLanguage,
                            onLanguageToggle = {
                                repository.setLanguage(if (currentLanguage == "en") "hi" else "en")
                            },
                            onNotificationClick = { showNotificationsDialog = true }
                        )

                        // Role Switch & Logout Sub-banner
                        Surface(
                            color = FitHubSurface,
                            modifier = Modifier.fillMaxWidth(),
                            border = BorderStroke(1.dp, FitHubBorder)
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 16.dp, vertical = 6.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                TextButton(
                                    onClick = { currentScreen = AppScreen.ROLE_SELECT },
                                    contentPadding = PaddingValues(0.dp)
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(
                                            imageVector = Icons.Default.SwapHoriz,
                                            contentDescription = null,
                                            tint = FitHubPrimary,
                                            modifier = Modifier.size(16.dp)
                                        )
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text(
                                            text = if (currentLanguage == "hi") "रोल बदलें (Switch Role)" else "Switch / Choose Role",
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = FitHubPrimary
                                        )
                                    }
                                }

                                Text(
                                    text = "${selectedBranch.name.replace("IronPulse ", "FitHub ")}",
                                    fontSize = 10.sp,
                                    color = FitHubTextSecondary
                                )
                            }
                        }
                    }
                }
            ) { innerPadding ->
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(innerPadding)
                ) {
                    when (currentRole) {
                        UserRole.MEMBER -> MemberDashboardScreen(
                            repository = repository,
                            modifier = Modifier.fillMaxSize()
                        )
                        UserRole.BRANCH_ADMIN -> AdminDashboardScreen(
                            repository = repository,
                            modifier = Modifier.fillMaxSize()
                        )
                        UserRole.SUPER_ADMIN -> SuperAdminDashboardScreen(
                            repository = repository,
                            modifier = Modifier.fillMaxSize()
                        )
                    }
                }
            }
        }
    }

    if (showNotificationsDialog) {
        NotificationsModal(
            onDismiss = { showNotificationsDialog = false },
            language = currentLanguage
        )
    }
}

@Composable
fun NotificationsModal(
    onDismiss: () -> Unit,
    language: String
) {
    val notifications = listOf(
        Triple(
            "⚡ 20% Off Nutrition Store",
            "Get 20% flat discount on Optimum Nutrition Gold Standard Whey at Downtown Central store today.",
            "2 hours ago"
        ),
        Triple(
            "🎂 Happy Birthday Month Perks!",
            "Complimentary 1-on-1 body composition assessment & protein smoothie at the recovery bar.",
            "1 day ago"
        ),
        Triple(
            "🔔 New HIIT Class Added",
            "Coach Arjun added a Friday 07:15 PM 'HIIT Metabolic Burn' session. Seats filling fast!",
            "2 days ago"
        )
    )

    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            colors = CardDefaults.cardColors(containerColor = FitHubSurface),
            shape = RoundedCornerShape(16.dp),
            border = BorderStroke(1.dp, FitHubBorder)
        ) {
            Column(modifier = Modifier.padding(18.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Notifications, contentDescription = null, tint = FitHubPrimary, modifier = Modifier.size(20.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = if (language == "hi") "सूचनाएं और घोषणाएं" else "Alerts & Announcements",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = FitHubWhite
                        )
                    }
                    IconButton(onClick = onDismiss, modifier = Modifier.size(24.dp)) {
                        Icon(Icons.Default.Close, contentDescription = null, tint = FitHubWhite, modifier = Modifier.size(16.dp))
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                notifications.forEach { (title, desc, time) ->
                    Surface(
                        color = FitHubCard,
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(1.dp, FitHubBorder),
                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(text = title, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = FitHubPrimary)
                                Text(text = time, fontSize = 10.sp, color = FitHubTextMuted)
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(text = desc, fontSize = 11.sp, color = FitHubTextSecondary)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))
                Button(
                    onClick = onDismiss,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = FitHubPrimary, contentColor = FitHubWhite),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text("Got it", fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
fun FitHubSplashScreen(onSplashFinished: () -> Unit) {
    LaunchedEffect(Unit) {
        kotlinx.coroutines.delay(1800)
        onSplashFinished()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0A0A0A))
            .padding(24.dp)
    ) {
        // Centered Brand Title & Subtitle matching the user-uploaded image
        Column(
            modifier = Modifier
                .align(Alignment.Center)
                .fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "FIT",
                fontSize = 58.sp,
                fontWeight = FontWeight.Black,
                color = FitHubPrimary,
                letterSpacing = 2.sp
            )
            Text(
                text = "HUB",
                fontSize = 62.sp,
                fontWeight = FontWeight.Black,
                color = Color.White,
                letterSpacing = (-1).sp
            )
        }

        // Bottom version & partner info matching the user splash screen
        Column(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "v1.0.0 | Total Fitness, Redefined.",
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                color = Color(0xFFE5E5E5)
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "Your Total Fitness Partner",
                fontSize = 10.sp,
                color = Color(0xFF757575)
            )
        }
    }
}

