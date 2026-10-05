package com.example.ui.member

import androidx.compose.animation.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.example.ai.AiChatMessage
import com.example.ai.GymAiCoach
import com.example.data.GymRepository
import com.example.model.*
import com.example.ui.components.*
import com.example.ui.theme.*

@Composable
fun MemberDashboardScreen(
    repository: GymRepository,
    modifier: Modifier = Modifier
) {
    val language by repository.currentLanguage.collectAsState()
    val member by repository.currentMember.collectAsState()
    val workout by repository.todayWorkout.collectAsState()
    val diet by repository.dietPlan.collectAsState()
    val attendanceRecords by repository.attendanceRecords.collectAsState()
    val isCheckedIn by repository.isMemberCheckedInToday.collectAsState()
    val groupClasses by repository.groupClasses.collectAsState()
    val payments by repository.payments.collectAsState()
    val progressList by repository.fitnessProgress.collectAsState()
    val tickets by repository.tickets.collectAsState()

    var selectedTab by remember { mutableStateOf(0) }
    var showRestTimer by remember { mutableStateOf(false) }
    var restTimerSeconds by remember { mutableStateOf(60) }
    var showPaymentModal by remember { mutableStateOf(false) }
    var selectedPaymentForInvoice by remember { mutableStateOf<PaymentRecord?>(null) }
    var showNewTicketDialog by remember { mutableStateOf(false) }

    val tabs = listOf(
        Pair(if (language == "hi") "डैशबोर्ड" else "Home", Icons.Default.Dashboard),
        Pair(if (language == "hi") "वर्कआउट" else "Workout", Icons.Default.FitnessCenter),
        Pair(if (language == "hi") "डाइट" else "Diet", Icons.Default.LocalDining),
        Pair(if (language == "hi") "प्रगति" else "Progress", Icons.Default.TrendingUp),
        Pair(if (language == "hi") "क्यूआर पास" else "QR Pass", Icons.Default.QrCode),
        Pair(if (language == "hi") "क्लासेस व बिल" else "Classes & Pay", Icons.Default.Receipt),
        Pair(if (language == "hi") "AI कोच" else "AI Coach", Icons.Default.AutoAwesome),
        Pair(if (language == "hi") "सपोर्ट" else "Support", Icons.Default.SupportAgent)
    )

    Column(modifier = modifier.fillMaxSize().background(GymDarkBg)) {
        // Scrollable Sub-tabs bar
        ScrollableTabRow(
            selectedTabIndex = selectedTab,
            containerColor = GymDarkSurface,
            contentColor = GymPrimary,
            edgePadding = 12.dp,
            divider = { HorizontalDivider(color = GymDarkBorder) }
        ) {
            tabs.forEachIndexed { index, (title, icon) ->
                Tab(
                    selected = selectedTab == index,
                    onClick = { selectedTab = index },
                    text = {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = icon,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp),
                                tint = if (selectedTab == index) GymPrimary else GymTextSecondaryDark
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = title,
                                fontSize = 12.sp,
                                fontWeight = if (selectedTab == index) FontWeight.Bold else FontWeight.Normal,
                                color = if (selectedTab == index) GymPrimary else GymTextSecondaryDark
                            )
                        }
                    }
                )
            }
        }

        // Tab Content
        Box(modifier = Modifier.weight(1f)) {
            when (selectedTab) {
                0 -> MemberHomeOverview(
                    member = member,
                    workout = workout,
                    diet = diet,
                    isCheckedIn = isCheckedIn,
                    onScanToggle = { repository.toggleCheckInToday() },
                    onNavigateTab = { selectedTab = it },
                    onPayClick = { showPaymentModal = true },
                    language = language
                )
                1 -> MemberWorkoutScreen(
                    workout = workout,
                    onToggleExercise = { repository.toggleExercise(it) },
                    onStartTimer = { seconds ->
                        restTimerSeconds = seconds
                        showRestTimer = true
                    },
                    language = language
                )
                2 -> MemberDietScreen(
                    diet = diet,
                    onToggleMeal = { repository.toggleMeal(it) },
                    onAddWater = { repository.addWater(it) },
                    language = language
                )
                3 -> MemberProgressScreen(
                    member = member,
                    progressList = progressList,
                    language = language
                )
                4 -> MemberQrAccessScreen(
                    member = member,
                    isCheckedIn = isCheckedIn,
                    attendanceRecords = attendanceRecords,
                    onScanToggle = { repository.toggleCheckInToday() },
                    language = language
                )
                5 -> MemberClassesAndBillingScreen(
                    groupClasses = groupClasses,
                    payments = payments,
                    onBookClass = { repository.bookClass(it) },
                    onViewInvoice = { selectedPaymentForInvoice = it },
                    language = language
                )
                6 -> MemberAiCoachScreen(
                    member = member,
                    workout = workout,
                    diet = diet,
                    progressList = progressList,
                    language = language
                )
                7 -> MemberSupportScreen(
                    tickets = tickets,
                    onCreateTicket = { showNewTicketDialog = true },
                    language = language
                )
            }
        }
    }

    // Rest Timer Dialog
    if (showRestTimer) {
        RestTimerDialog(
            seconds = restTimerSeconds,
            onDismiss = { showRestTimer = false },
            language = language
        )
    }

    // Payment Dialog
    if (showPaymentModal) {
        MemberPayDialog(
            member = member,
            onPayConfirmed = { amount, method, plan ->
                repository.recordPayment(member.id, amount, method, plan)
                showPaymentModal = false
            },
            onDismiss = { showPaymentModal = false },
            language = language
        )
    }

    // Invoice Dialog
    selectedPaymentForInvoice?.let { payment ->
        InvoiceDialog(
            payment = payment,
            onDismiss = { selectedPaymentForInvoice = null },
            language = language
        )
    }

    // Create Support Ticket Dialog
    if (showNewTicketDialog) {
        CreateTicketDialog(
            onSubmit = { category, subject, message, priority ->
                repository.createTicket(category, subject, message, priority)
                showNewTicketDialog = false
            },
            onDismiss = { showNewTicketDialog = false },
            language = language
        )
    }
}

// ---------------- Sub-Screens ----------------

@Composable
fun MemberHomeOverview(
    member: Member,
    workout: WorkoutDay,
    diet: DietPlan,
    isCheckedIn: Boolean,
    onScanToggle: () -> Unit,
    onNavigateTab: (Int) -> Unit,
    onPayClick: () -> Unit,
    language: String
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Hero Member Pass Card with countdown
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = GymDarkCard),
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, GymDarkBorder)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            Brush.horizontalGradient(
                                listOf(Color(0xFF1E2818), Color(0xFF161B22))
                            )
                        )
                        .padding(18.dp)
                ) {
                    Column {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = if (language == "hi") "नमस्ते, ${member.name}!" else "Welcome, ${member.name}!",
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.Black,
                                    color = Color.White
                                )
                                Text(
                                    text = if (member.remainingDays > 0) "${member.planName} • ${member.branchName}" else "No active membership",
                                    fontSize = 12.sp,
                                    color = GymTextSecondaryDark
                                )
                            }
                            if (member.remainingDays > 0) {
                                StatusBadge(status = member.status, language = language)
                            } else {
                                Surface(
                                    color = FitHubInput,
                                    shape = RoundedCornerShape(6.dp),
                                    border = BorderStroke(1.dp, FitHubBorder)
                                ) {
                                    Text(
                                        text = "INACTIVE",
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = FitHubTextMuted,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(14.dp))

                        // Stats row: Expiry countdown & Attendance Streak
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Surface(
                                color = GymDarkBg.copy(alpha = 0.8f),
                                shape = RoundedCornerShape(10.dp),
                                border = BorderStroke(1.dp, if (member.remainingDays > 0) GymPrimary.copy(alpha = 0.3f) else GymDarkBorder),
                                modifier = Modifier.weight(1f)
                            ) {
                                Column(modifier = Modifier.padding(10.dp)) {
                                    Text(
                                        text = if (language == "hi") "बचे हुए दिन" else "DAYS REMAINING",
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = GymTextSecondaryDark
                                    )
                                    Text(
                                        text = "${member.remainingDays} Days",
                                        fontSize = 18.sp,
                                        fontWeight = FontWeight.Black,
                                        color = if (member.remainingDays > 0) GymPrimary else FitHubTextMuted
                                    )
                                    Text(
                                        text = if (member.remainingDays > 0) "Expires: ${member.expiryDate}" else "No active plan",
                                        fontSize = 10.sp,
                                        color = GymTextMutedDark
                                    )
                                }
                            }

                            Surface(
                                color = GymDarkBg.copy(alpha = 0.8f),
                                shape = RoundedCornerShape(10.dp),
                                border = BorderStroke(1.dp, if (member.attendanceStreak > 0) GymSecondary.copy(alpha = 0.3f) else GymDarkBorder),
                                modifier = Modifier.weight(1f)
                            ) {
                                Column(modifier = Modifier.padding(10.dp)) {
                                    Text(
                                        text = if (language == "hi") "उपस्थिति स्ट्रीक" else "ATTENDANCE STREAK",
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = GymTextSecondaryDark
                                    )
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(
                                            text = "${member.attendanceStreak} Days",
                                            fontSize = 18.sp,
                                            fontWeight = FontWeight.Black,
                                            color = if (member.attendanceStreak > 0) GymSecondary else FitHubWhite
                                        )
                                    }
                                    Text(
                                        text = if (isCheckedIn) "Checked In Today" else "Not yet scanned today",
                                        fontSize = 10.sp,
                                        color = if (isCheckedIn) GymSuccess else GymTextMutedDark
                                    )
                                }
                            }
                        }

                        if (member.remainingDays == 0) {
                            Spacer(modifier = Modifier.height(12.dp))
                            Button(
                                onClick = { onNavigateTab(5) },
                                colors = ButtonDefaults.buttonColors(containerColor = FitHubPrimary, contentColor = Color.White),
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("Choose a Membership Plan", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                        }

                        // Pending balance alert if any
                        if (member.balanceDue > 0) {
                            Spacer(modifier = Modifier.height(12.dp))
                            Surface(
                                color = GymError.copy(alpha = 0.15f),
                                shape = RoundedCornerShape(8.dp),
                                border = BorderStroke(1.dp, GymError.copy(alpha = 0.4f))
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth().padding(10.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(imageVector = Icons.Default.Warning, contentDescription = null, tint = GymError, modifier = Modifier.size(16.dp))
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text(
                                            text = "Pending Dues: ₹${member.balanceDue}",
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = GymError
                                        )
                                    }
                                    Button(
                                        onClick = onPayClick,
                                        colors = ButtonDefaults.buttonColors(containerColor = GymError, contentColor = Color.White),
                                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                                        shape = RoundedCornerShape(6.dp),
                                        modifier = Modifier.height(28.dp)
                                    ) {
                                        Text("Pay Now", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Quick QR Check-in Box
        item {
            PersonalQrCard(
                member = member,
                isCheckedIn = isCheckedIn,
                onScanToggle = onScanToggle,
                language = language
            )
        }

        // Today's Workout Snapshot
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = GymDarkCard),
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, GymDarkBorder)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(32.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(GymPrimary.copy(alpha = 0.15f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Icons.Default.FitnessCenter, contentDescription = null, tint = GymPrimary, modifier = Modifier.size(18.dp))
                            }
                            Spacer(modifier = Modifier.width(10.dp))
                            Column {
                                Text(
                                    text = if (language == "hi") "आज का वर्कआउट" else "TODAY'S WORKOUT",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = GymTextSecondaryDark
                                )
                                Text(
                                    text = workout.title,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White
                                )
                            }
                        }

                        TextButton(onClick = { onNavigateTab(1) }) {
                            Text(if (language == "hi") "सभी देखें" else "View All", color = GymPrimary, fontSize = 12.sp)
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    if (workout.exercises.isEmpty()) {
                        Text(
                            text = if (language == "hi") "कोई वर्कआउट असाइन नहीं किया गया" else "No workout assigned yet",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = FitHubTextSecondary
                        )
                        Spacer(modifier = Modifier.height(3.dp))
                        Text(
                            text = if (language == "hi") "आपके ट्रेनर ने अभी तक वर्कआउट शेड्यूल नहीं किया है।" else "Your trainer has not assigned a workout routine yet.",
                            fontSize = 11.sp,
                            color = FitHubTextMuted
                        )
                    } else {
                        val completed = workout.exercises.count { it.isCompleted }
                        LinearProgressIndicator(
                            progress = { completed.toFloat() / workout.exercises.size },
                            modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)),
                            color = GymPrimary,
                            trackColor = GymDarkBorder
                        )

                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "$completed of ${workout.exercises.size} exercises completed • Assigned by ${member.trainerName}",
                            fontSize = 11.sp,
                            color = GymTextSecondaryDark
                        )
                    }
                }
            }
        }

        // Today's Diet & Hydration Snapshot
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = GymDarkCard),
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, GymDarkBorder)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(32.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(GymSecondary.copy(alpha = 0.15f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Icons.Default.LocalDining, contentDescription = null, tint = GymSecondary, modifier = Modifier.size(18.dp))
                            }
                            Spacer(modifier = Modifier.width(10.dp))
                            Column {
                                Text(
                                    text = if (language == "hi") "आज का पोषण लक्ष्य" else "NUTRITION & HYDRATION",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = GymTextSecondaryDark
                                )
                                Text(
                                    text = if (diet.targetCalories > 0) "${diet.targetCalories} kcal • ${diet.targetProteinG}g Protein" else "No diet assigned yet",
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White
                                )
                            }
                        }

                        TextButton(onClick = { onNavigateTab(2) }) {
                            Text(if (language == "hi") "डाइट लॉग" else "Diet Log", color = GymSecondary, fontSize = 12.sp)
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    if (diet.meals.isEmpty()) {
                        Text(
                            text = if (language == "hi") "कोई डाइट प्लान असाइन नहीं किया गया" else "No diet assigned yet",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = FitHubTextSecondary
                        )
                        Spacer(modifier = Modifier.height(3.dp))
                        Text(
                            text = if (language == "hi") "आपके न्यूट्रिशनिस्ट ने अभी तक कोई मील प्लान असाइन नहीं किया है।" else "Your nutritionist has not assigned a diet plan yet.",
                            fontSize = 11.sp,
                            color = FitHubTextMuted
                        )
                    } else {
                        // Water intake pill
                        Surface(
                            color = GymDarkSurface,
                            shape = RoundedCornerShape(10.dp),
                            border = BorderStroke(1.dp, GymDarkBorder)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(12.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(imageVector = Icons.Default.WaterDrop, contentDescription = null, tint = GymSecondary, modifier = Modifier.size(20.dp))
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Column {
                                        Text(text = "Water Hydration Target", fontSize = 12.sp, color = GymTextSecondaryDark)
                                        Text(text = "${diet.waterConsumedMl} / ${diet.waterTargetMl} ml", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color.White)
                                    }
                                }
                                Text(
                                    text = "${((diet.waterConsumedMl.toFloat() / diet.waterTargetMl) * 100).toInt()}%",
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Black,
                                    color = GymSecondary
                                )
                            }
                        }
                    }
                }
            }
        }

        // Assigned Trainer Contact Card
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = GymDarkCard),
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, GymDarkBorder)
            ) {
                if (member.trainerId.isNotEmpty() && member.trainerName != "No trainer assigned") {
                    Row(
                        modifier = Modifier.padding(16.dp).fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(46.dp)
                                    .clip(CircleShape)
                                    .background(Brush.linearGradient(listOf(GymAccentOrange, GymPrimary))),
                                contentAlignment = Alignment.Center
                            ) {
                                val initials = member.trainerName.split(" ").mapNotNull { it.firstOrNull()?.toString() }.take(2).joinToString("")
                                Text(
                                    text = initials.ifEmpty { "PT" },
                                    fontWeight = FontWeight.Black,
                                    color = Color.Black,
                                    fontSize = 16.sp
                                )
                            }
                            Spacer(modifier = Modifier.width(12.dp))
                            Column {
                                Text(
                                    text = member.trainerName,
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White
                                )
                                Text(
                                    text = "Personal Coach • Assigned Trainer",
                                    fontSize = 11.sp,
                                    color = GymTextSecondaryDark
                                )
                            }
                        }

                        Surface(
                            color = GymPrimary.copy(alpha = 0.15f),
                            shape = RoundedCornerShape(8.dp),
                            border = BorderStroke(1.dp, GymPrimary.copy(alpha = 0.3f))
                        ) {
                            Text(
                                text = "⭐ 4.9",
                                color = GymPrimary,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                    }
                } else {
                    Row(
                        modifier = Modifier.padding(16.dp).fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .clip(CircleShape)
                                .background(GymDarkSurface),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Person, contentDescription = null, tint = GymTextMutedDark, modifier = Modifier.size(20.dp))
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(
                                text = if (language == "hi") "कोई पर्सनल ट्रेनर असाइन नहीं किया गया" else "No personal coach assigned yet",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                            Text(
                                text = if (language == "hi") "ट्रेनर सहायता के लिए रिसेप्शन या ऐप से संपर्क करें।" else "Personal coaching can be assigned with your membership package.",
                                fontSize = 11.sp,
                                color = GymTextSecondaryDark
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun MemberWorkoutScreen(
    workout: WorkoutDay,
    onToggleExercise: (String) -> Unit,
    onStartTimer: (Int) -> Unit,
    language: String
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        if (workout.exercises.isEmpty()) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp),
                    colors = CardDefaults.cardColors(containerColor = FitHubCard),
                    shape = RoundedCornerShape(16.dp),
                    border = BorderStroke(1.dp, FitHubBorder)
                ) {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(Icons.Default.FitnessCenter, contentDescription = null, tint = FitHubPrimary, modifier = Modifier.size(40.dp))
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = if (language == "hi") "कोई वर्कआउट असाइन नहीं किया गया" else "No workout assigned yet",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = if (language == "hi") "आपके ट्रेनर ने अभी तक कोई वर्कआउट शेड्यूल नहीं किया है।" else "Your trainer has not assigned a workout yet. Contact your trainer or request a personalized routine.",
                            fontSize = 12.sp,
                            color = FitHubTextSecondary,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }
        } else {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = GymDarkCard),
                    shape = RoundedCornerShape(14.dp),
                    border = BorderStroke(1.dp, GymPrimary.copy(alpha = 0.4f))
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = if (language == "hi") "आज का वर्कआउट रूटीन" else "ASSIGNED WORKOUT PLAN",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = GymPrimary
                        )
                        Text(
                            text = workout.title,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Black,
                            color = Color.White
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "Trainer Notes: \"${workout.trainerNotes}\"",
                            fontSize = 12.sp,
                            color = GymTextSecondaryDark
                        )
                    }
                }
            }

            items(workout.exercises) { ex ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = if (ex.isCompleted) Color(0xFF162316) else GymDarkCard
                ),
                shape = RoundedCornerShape(14.dp),
                border = BorderStroke(
                    1.dp,
                    if (ex.isCompleted) GymSuccess.copy(alpha = 0.4f) else GymDarkBorder
                )
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = ex.name,
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (ex.isCompleted) GymSuccess else Color.White
                                )
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "${ex.sets} Sets × ${ex.reps} • Target: ${ex.targetWeightKg} kg • ${ex.targetMuscle}",
                                fontSize = 12.sp,
                                color = GymTextSecondaryDark
                            )
                        }

                        IconButton(onClick = { onToggleExercise(ex.id) }) {
                            Icon(
                                imageVector = if (ex.isCompleted) Icons.Default.CheckCircle else Icons.Default.RadioButtonUnchecked,
                                contentDescription = "Toggle Complete",
                                tint = if (ex.isCompleted) GymSuccess else GymTextSecondaryDark,
                                modifier = Modifier.size(26.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "💡 Form cue: ${ex.instructions}",
                        fontSize = 11.sp,
                        color = GymTextSecondaryDark
                    )

                    Spacer(modifier = Modifier.height(10.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        OutlinedButton(
                            onClick = { onStartTimer(ex.restSeconds) },
                            shape = RoundedCornerShape(8.dp),
                            border = BorderStroke(1.dp, GymSecondary.copy(alpha = 0.5f)),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                            modifier = Modifier.height(30.dp)
                        ) {
                            Icon(imageVector = Icons.Default.Timer, contentDescription = null, tint = GymSecondary, modifier = Modifier.size(14.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Rest Timer (${ex.restSeconds}s)", fontSize = 11.sp, color = GymSecondary)
                        }

                        Surface(
                            color = GymDarkSurface,
                            shape = RoundedCornerShape(6.dp)
                        ) {
                            Text(
                                text = if (ex.isCompleted) "Completed" else "Pending",
                                fontSize = 11.sp,
                                color = if (ex.isCompleted) GymSuccess else GymWarning,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }
                }
            }
        }
        }
    }
}

@Composable
fun MemberDietScreen(
    diet: DietPlan,
    onToggleMeal: (String) -> Unit,
    onAddWater: (Int) -> Unit,
    language: String
) {
    val totalCaloriesEaten = diet.meals.filter { it.isEaten }.sumOf { it.calories }
    val totalProteinEaten = diet.meals.filter { it.isEaten }.sumOf { it.proteinG }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        if (diet.meals.isEmpty()) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp),
                    colors = CardDefaults.cardColors(containerColor = FitHubCard),
                    shape = RoundedCornerShape(16.dp),
                    border = BorderStroke(1.dp, FitHubBorder)
                ) {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(Icons.Default.LocalDining, contentDescription = null, tint = FitHubPrimary, modifier = Modifier.size(40.dp))
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = if (language == "hi") "कोई डाइट प्लान असाइन नहीं किया गया" else "No diet assigned yet",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = if (language == "hi") "आपके न्यूट्रिशनिस्ट ने अभी तक कोई मील प्लान असाइन नहीं किया है।" else "Your nutritionist has not assigned a diet plan yet. Request a customized meal protocol from your coach.",
                            fontSize = 12.sp,
                            color = FitHubTextSecondary,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }
        } else {
            // Macro Dashboard Card
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = GymDarkCard),
                    shape = RoundedCornerShape(16.dp),
                    border = BorderStroke(1.dp, GymDarkBorder)
                ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = if (language == "hi") "दैनिक पोषण लक्ष्य" else "DAILY MACROS & CALORIES",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = GymSecondary
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.Bottom
                    ) {
                        Text(
                            text = "$totalCaloriesEaten / ${diet.targetCalories} kcal",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Black,
                            color = Color.White
                        )
                        Text(
                            text = "${((totalCaloriesEaten.toFloat() / diet.targetCalories) * 100).toInt()}% Done",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = GymPrimary
                        )
                    }

                    Spacer(modifier = Modifier.height(8.dp))
                    LinearProgressIndicator(
                        progress = { (totalCaloriesEaten.toFloat() / diet.targetCalories).coerceIn(0f, 1f) },
                        modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)),
                        color = GymPrimary,
                        trackColor = GymDarkBorder
                    )

                    Spacer(modifier = Modifier.height(14.dp))

                    // 3 Macros Pills
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Surface(
                            color = GymDarkSurface,
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Column(modifier = Modifier.padding(8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(text = "Protein", fontSize = 10.sp, color = GymTextSecondaryDark)
                                Text(text = "$totalProteinEaten / ${diet.targetProteinG}g", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = GymSecondary)
                            }
                        }
                        Surface(
                            color = GymDarkSurface,
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Column(modifier = Modifier.padding(8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(text = "Carbs", fontSize = 10.sp, color = GymTextSecondaryDark)
                                Text(text = "Target ${diet.targetCarbsG}g", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = GymAccentOrange)
                            }
                        }
                        Surface(
                            color = GymDarkSurface,
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Column(modifier = Modifier.padding(8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(text = "Fats", fontSize = 10.sp, color = GymTextSecondaryDark)
                                Text(text = "Target ${diet.targetFatG}g", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = GymWarning)
                            }
                        }
                    }
                }
            }
        }

        // Water Hydration Logger
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = GymDarkCard),
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, GymSecondary.copy(alpha = 0.3f))
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.WaterDrop, contentDescription = null, tint = GymSecondary, modifier = Modifier.size(22.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Column {
                                Text(text = if (language == "hi") "जल सेवन ट्रैकर" else "HYDRATION GOAL", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = GymTextSecondaryDark)
                                Text(text = "${diet.waterConsumedMl} / ${diet.waterTargetMl} ml", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Color.White)
                            }
                        }

                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Button(
                                onClick = { onAddWater(250) },
                                colors = ButtonDefaults.buttonColors(containerColor = GymSecondaryContainer, contentColor = GymSecondary),
                                shape = RoundedCornerShape(8.dp),
                                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                                modifier = Modifier.height(32.dp)
                            ) {
                                Text("+250ml", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                            Button(
                                onClick = { onAddWater(500) },
                                colors = ButtonDefaults.buttonColors(containerColor = GymSecondary, contentColor = Color.Black),
                                shape = RoundedCornerShape(8.dp),
                                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                                modifier = Modifier.height(32.dp)
                            ) {
                                Text("+500ml", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }

        // Meals List
        items(diet.meals) { meal ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = if (meal.isEaten) Color(0xFF162316) else GymDarkCard
                ),
                shape = RoundedCornerShape(14.dp),
                border = BorderStroke(1.dp, if (meal.isEaten) GymSuccess.copy(alpha = 0.4f) else GymDarkBorder)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(14.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Surface(
                                color = GymDarkSurface,
                                shape = RoundedCornerShape(4.dp)
                            ) {
                                Text(
                                    text = meal.mealType,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = GymSecondary,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(text = meal.time, fontSize = 11.sp, color = GymTextSecondaryDark)
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = meal.title,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = if (meal.isEaten) GymSuccess else Color.White
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "${meal.calories} kcal • ${meal.proteinG}g Protein • ${meal.carbsG}g Carbs",
                            fontSize = 11.sp,
                            color = GymTextSecondaryDark
                        )
                    }

                    IconButton(onClick = { onToggleMeal(meal.id) }) {
                        Icon(
                            imageVector = if (meal.isEaten) Icons.Default.CheckCircle else Icons.Default.RadioButtonUnchecked,
                            contentDescription = "Toggle Meal",
                            tint = if (meal.isEaten) GymSuccess else GymTextSecondaryDark,
                            modifier = Modifier.size(24.dp)
                        )
                    }
                }
            }
        }
        }
    }
}

@Composable
fun MemberProgressScreen(
    member: Member,
    progressList: List<FitnessProgressEntry>,
    language: String
) {
    val latest = progressList.firstOrNull()

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        if (progressList.isEmpty()) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp),
                    colors = CardDefaults.cardColors(containerColor = FitHubCard),
                    shape = RoundedCornerShape(16.dp),
                    border = BorderStroke(1.dp, FitHubBorder)
                ) {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(Icons.Default.TrendingUp, contentDescription = null, tint = FitHubPrimary, modifier = Modifier.size(40.dp))
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = if (language == "hi") "कोई प्रगति रिकॉर्ड नहीं मिला" else "No progress records yet",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = if (language == "hi") "शारीरिक स्थिति ट्रैक करने के लिए अपना वजन लॉग करें।" else "Log your starting weight and body measurements to begin tracking your transformation over time.",
                            fontSize = 12.sp,
                            color = FitHubTextSecondary,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }
        } else {
            // BMI & Body Stats Card
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = GymDarkCard),
                    shape = RoundedCornerShape(16.dp),
                    border = BorderStroke(1.dp, GymDarkBorder)
                ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = if (language == "hi") "शारीरिक स्थिति व बीएमआई" else "BODY COMPOSITION & BMI",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = GymPrimary
                    )

                    Spacer(modifier = Modifier.height(10.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Surface(
                            color = GymDarkSurface,
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                Text(text = "Current Weight", fontSize = 11.sp, color = GymTextSecondaryDark)
                                Text(text = "${member.weightKg} kg", fontSize = 20.sp, fontWeight = FontWeight.Black, color = Color.White)
                                Text(text = "Height: ${member.heightCm} cm", fontSize = 10.sp, color = GymTextMutedDark)
                            }
                        }

                        Surface(
                            color = GymDarkSurface,
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                Text(text = "Calculated BMI", fontSize = 11.sp, color = GymTextSecondaryDark)
                                val bmiVal = latest?.bmi ?: 0.0
                                Text(text = if (bmiVal > 0) "$bmiVal" else "N/A", fontSize = 20.sp, fontWeight = FontWeight.Black, color = GymSecondary)
                                Text(text = if (bmiVal > 0) "Recorded" else "Not calculated", fontSize = 10.sp, color = GymSuccess)
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    // Body Measurements Grid
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Surface(color = GymDarkSurface, shape = RoundedCornerShape(8.dp), modifier = Modifier.weight(1f)) {
                            Column(modifier = Modifier.padding(8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(text = "Body Fat", fontSize = 10.sp, color = GymTextSecondaryDark)
                                val bf = latest?.bodyFatPercent ?: 0.0
                                Text(text = if (bf > 0) "$bf%" else "--", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color.White)
                            }
                        }
                        Surface(color = GymDarkSurface, shape = RoundedCornerShape(8.dp), modifier = Modifier.weight(1f)) {
                            Column(modifier = Modifier.padding(8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(text = "Chest", fontSize = 10.sp, color = GymTextSecondaryDark)
                                val ch = latest?.chestCm ?: 0.0
                                Text(text = if (ch > 0) "$ch cm" else "--", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color.White)
                            }
                        }
                        Surface(color = GymDarkSurface, shape = RoundedCornerShape(8.dp), modifier = Modifier.weight(1f)) {
                            Column(modifier = Modifier.padding(8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(text = "Arms", fontSize = 10.sp, color = GymTextSecondaryDark)
                                val ar = latest?.armsCm ?: 0.0
                                Text(text = if (ar > 0) "$ar cm" else "--", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color.White)
                            }
                        }
                        Surface(color = GymDarkSurface, shape = RoundedCornerShape(8.dp), modifier = Modifier.weight(1f)) {
                            Column(modifier = Modifier.padding(8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(text = "Waist", fontSize = 10.sp, color = GymTextSecondaryDark)
                                val ws = latest?.waistCm ?: 0.0
                                Text(text = if (ws > 0) "$ws cm" else "--", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color.White)
                            }
                        }
                    }
                }
            }
        }

        // Strength Personal Records (PR)
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = GymDarkCard),
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, GymDarkBorder)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = if (language == "hi") "पर्सनल स्ट्रेंथ रिकॉर्ड्स (PRs)" else "STRENGTH PR RECORDS",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = GymAccentOrange
                    )
                    Spacer(modifier = Modifier.height(10.dp))

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Surface(color = GymDarkSurface, shape = RoundedCornerShape(10.dp), modifier = Modifier.weight(1f)) {
                            Column(modifier = Modifier.padding(10.dp)) {
                                Text(text = "Bench Press", fontSize = 11.sp, color = GymTextSecondaryDark)
                                val bp = latest?.benchPressMaxKg ?: 0.0
                                Text(text = if (bp > 0) "$bp kg" else "--", fontSize = 16.sp, fontWeight = FontWeight.Black, color = Color.White)
                            }
                        }
                        Surface(color = GymDarkSurface, shape = RoundedCornerShape(10.dp), modifier = Modifier.weight(1f)) {
                            Column(modifier = Modifier.padding(10.dp)) {
                                Text(text = "Barbell Squat", fontSize = 11.sp, color = GymTextSecondaryDark)
                                val sq = latest?.squatMaxKg ?: 0.0
                                Text(text = if (sq > 0) "$sq kg" else "--", fontSize = 16.sp, fontWeight = FontWeight.Black, color = Color.White)
                            }
                        }
                        Surface(color = GymDarkSurface, shape = RoundedCornerShape(10.dp), modifier = Modifier.weight(1f)) {
                            Column(modifier = Modifier.padding(10.dp)) {
                                Text(text = "Deadlift", fontSize = 11.sp, color = GymTextSecondaryDark)
                                val dl = latest?.deadliftMaxKg ?: 0.0
                                Text(text = if (dl > 0) "$dl kg" else "--", fontSize = 16.sp, fontWeight = FontWeight.Black, color = Color.White)
                            }
                        }
                    }
                }
            }
        }

        // Progress History Entries
        item {
            Text(
                text = if (language == "hi") "मासिक वजन और प्रगति इतिहास" else "Monthly Progress Timeline",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
        }

        items(progressList) { entry ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = GymDarkCard),
                shape = RoundedCornerShape(12.dp),
                border = BorderStroke(1.dp, GymDarkBorder)
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(text = "Check-in: ${entry.date}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = GymPrimary)
                        Text(text = "${entry.weightKg} kg (Fat: ${entry.bodyFatPercent}%)", fontSize = 13.sp, fontWeight = FontWeight.Black, color = Color.White)
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(text = "Notes: \"${entry.notes}\"", fontSize = 11.sp, color = GymTextSecondaryDark)
                }
            }
        }
        }
    }
}

@Composable
fun MemberQrAccessScreen(
    member: Member,
    isCheckedIn: Boolean,
    attendanceRecords: List<AttendanceRecord>,
    onScanToggle: () -> Unit,
    language: String
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            PersonalQrCard(
                member = member,
                isCheckedIn = isCheckedIn,
                onScanToggle = onScanToggle,
                language = language
            )
        }

        // Digital ID Card with Barcode
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = GymDarkSurface),
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, GymDarkBorder)
            ) {
                Column(modifier = Modifier.padding(18.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "IRONPULSE MEMBERSHIP CARD",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Black,
                            color = GymPrimary,
                            letterSpacing = 1.sp
                        )
                        Text(
                            text = member.id,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text(text = "Member Name", fontSize = 10.sp, color = GymTextSecondaryDark)
                            Text(text = member.name, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Color.White)
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(text = "Emergency Contact", fontSize = 10.sp, color = GymTextSecondaryDark)
                            Text(text = member.emergencyContact, fontSize = 11.sp, color = Color.White)
                        }

                        Column(horizontalAlignment = Alignment.End) {
                            Text(text = "Blood Group", fontSize = 10.sp, color = GymTextSecondaryDark)
                            Text(text = member.bloodGroup, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = GymSecondary)
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(text = "Locker #", fontSize = 10.sp, color = GymTextSecondaryDark)
                            Text(text = member.lockerNumber, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = GymPrimary)
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))
                    HorizontalDivider(color = GymDarkBorder)
                    Spacer(modifier = Modifier.height(10.dp))

                    // Barcode illustration
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "||||||  |||||  ||||||||  ||||  |||||||||  |||||",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Black,
                            color = GymTextSecondaryDark,
                            letterSpacing = 2.sp
                        )
                    }
                }
            }
        }

        // Attendance History Logs
        item {
            Text(
                text = if (language == "hi") "हालिया उपस्थिति इतिहास" else "Recent Attendance Log",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
        }

        val myAttendance = attendanceRecords.filter { it.memberId == member.id }
        if (myAttendance.isEmpty()) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = FitHubCard),
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, FitHubBorder)
                ) {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(Icons.Default.QrCodeScanner, contentDescription = null, tint = FitHubPrimary, modifier = Modifier.size(32.dp))
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = if (language == "hi") "कोई उपस्थिति रिकॉर्ड नहीं मिला" else "No attendance records yet",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = if (language == "hi") "उपस्थिति दर्ज करने के लिए गेट पर क्यूआर कोड स्कैन करें।" else "Scan your personal QR code at gym turnstiles to log your check-ins.",
                            fontSize = 11.sp,
                            color = FitHubTextSecondary,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }
        } else {
            items(myAttendance) { att ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = GymDarkCard),
                    shape = RoundedCornerShape(10.dp),
                    border = BorderStroke(1.dp, GymDarkBorder)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.CheckCircle, contentDescription = null, tint = GymSuccess, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Column {
                                Text(text = att.date, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White)
                                Text(text = "Check In: ${att.checkInTime} • ${att.method}", fontSize = 11.sp, color = GymTextSecondaryDark)
                            }
                        }

                        Surface(
                            color = GymSuccess.copy(alpha = 0.15f),
                            shape = RoundedCornerShape(6.dp)
                        ) {
                            Text(
                                text = att.checkOutTime?.let { "Out: $it" } ?: "Active",
                                color = GymSuccess,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun MemberClassesAndBillingScreen(
    groupClasses: List<GroupClass>,
    payments: List<PaymentRecord>,
    onBookClass: (String) -> Unit,
    onViewInvoice: (PaymentRecord) -> Unit,
    language: String
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Upcoming Bookings Section
        item {
            Text(
                text = if (language == "hi") "आगामी बुकिंग" else "Upcoming Bookings",
                fontSize = 14.sp,
                fontWeight = FontWeight.Black,
                color = Color.White
            )
        }

        val myBookings = groupClasses.filter { it.isBookedByCurrentUser }
        if (myBookings.isEmpty()) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = FitHubCard),
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, FitHubBorder)
                ) {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(18.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(Icons.Default.EventBusy, contentDescription = null, tint = FitHubPrimary, modifier = Modifier.size(32.dp))
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = if (language == "hi") "कोई आगामी बुकिंग नहीं मिली" else "No upcoming bookings",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = if (language == "hi") "नीचे दी गई सूची में से ग्रुप फिटनेस स्लॉट बुक करें।" else "You have not booked any group classes yet. Choose a session below to reserve.",
                            fontSize = 11.sp,
                            color = FitHubTextSecondary,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }
        } else {
            items(myBookings) { booked ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1B2F2A)),
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, GymSecondary)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(text = booked.title, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color.White)
                            Text(text = "${booked.time} • ${booked.room} • Coach: ${booked.trainerName}", fontSize = 11.sp, color = GymTextSecondaryDark)
                        }
                        Button(
                            onClick = { onBookClass(booked.id) },
                            colors = ButtonDefaults.buttonColors(containerColor = GymError, contentColor = Color.White),
                            shape = RoundedCornerShape(6.dp),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 2.dp),
                            modifier = Modifier.height(28.dp)
                        ) {
                            Text("Cancel", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }

        // Group Classes Booking
        item {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = if (language == "hi") "ग्रुप फिटनेस क्लासेस बुक करें" else "Available Group Fitness Classes",
                fontSize = 14.sp,
                fontWeight = FontWeight.Black,
                color = Color.White
            )
        }

        items(groupClasses) { cls ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = if (cls.isBookedByCurrentUser) Color(0xFF1B2F2A) else GymDarkCard
                ),
                shape = RoundedCornerShape(14.dp),
                border = BorderStroke(
                    1.dp,
                    if (cls.isBookedByCurrentUser) GymSecondary else GymDarkBorder
                )
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Surface(
                                    color = GymDarkSurface,
                                    shape = RoundedCornerShape(4.dp)
                                ) {
                                    Text(
                                        text = cls.category,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = GymSecondary,
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                    )
                                }
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(text = "${cls.durationMins} mins", fontSize = 11.sp, color = GymTextSecondaryDark)
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(text = cls.title, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Color.White)
                        }

                        Button(
                            onClick = { onBookClass(cls.id) },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (cls.isBookedByCurrentUser) GymError else GymPrimary,
                                contentColor = if (cls.isBookedByCurrentUser) Color.White else Color.Black
                            ),
                            shape = RoundedCornerShape(8.dp),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                            modifier = Modifier.height(32.dp)
                        ) {
                            Text(
                                text = if (cls.isBookedByCurrentUser) "Cancel" else "Book Slot",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(text = "Trainer: ${cls.trainerName} • ${cls.room}", fontSize = 11.sp, color = GymTextSecondaryDark)
                        Text(
                            text = "Seats: ${cls.bookedCount}/${cls.capacity}",
                            fontSize = 11.sp,
                            color = if (cls.bookedCount >= cls.capacity) GymError else GymSuccess,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }

        // Payment History & Invoices
        item {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = if (language == "hi") "भुगतान इतिहास और रसीदें" else "Payment History & Invoices",
                fontSize = 14.sp,
                fontWeight = FontWeight.Black,
                color = Color.White
            )
        }

        if (payments.isEmpty()) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = FitHubCard),
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, FitHubBorder)
                ) {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(Icons.Default.ReceiptLong, contentDescription = null, tint = FitHubPrimary, modifier = Modifier.size(32.dp))
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = if (language == "hi") "कोई भुगतान इतिहास नहीं मिला" else "No payment history yet",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = if (language == "hi") "बकाया राशि: ₹0.00 • कोई चालान रिकॉर्ड नहीं।" else "Pending amount = ₹0.00 • Invoices and receipts will appear after subscription purchase.",
                            fontSize = 11.sp,
                            color = FitHubTextSecondary,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }
        } else {
            items(payments) { pay ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = GymDarkCard),
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, GymDarkBorder)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(text = pay.planName, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color.White)
                            Text(text = "Invoice: ${pay.invoiceNumber} • ${pay.date}", fontSize = 11.sp, color = GymTextSecondaryDark)
                            Text(text = "Via ${pay.paymentMethod}", fontSize = 11.sp, color = GymSecondary)
                        }

                        Column(horizontalAlignment = Alignment.End) {
                            Text(text = "₹${String.format("%.2f", pay.totalAmount)}", fontSize = 14.sp, fontWeight = FontWeight.Black, color = GymPrimary)
                            Spacer(modifier = Modifier.height(4.dp))
                            OutlinedButton(
                                onClick = { onViewInvoice(pay) },
                                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                                shape = RoundedCornerShape(6.dp),
                                border = BorderStroke(1.dp, GymDarkBorder),
                                modifier = Modifier.height(28.dp)
                            ) {
                                Text("Invoice", fontSize = 10.sp, color = Color.White)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun MemberAiCoachScreen(
    member: Member,
    workout: WorkoutDay,
    diet: DietPlan,
    progressList: List<FitnessProgressEntry>,
    language: String
) {
    var userPrompt by remember { mutableStateOf("") }
    var chatHistory by remember {
        mutableStateOf<List<AiChatMessage>>(
            listOf(
                AiChatMessage(
                    id = "AI-INIT",
                    sender = "ai",
                    textEn = "Hey ${member.name}! I am your IronPulse AI Fitness Coach. Ask me about your assigned workout, diet macros, or progress stats!",
                    textHi = "नमस्ते ${member.name}! मैं आपका IronPulse AI फिटनेस कोच हूँ। आप मुझसे आज के वर्कआउट, डाइट प्लान या वजन की प्रगति के बारे में पूछ सकते हैं!",
                    timestamp = "Just now"
                )
            )
        )
    }

    // Quick chips suggested by user prompt
    val quickChips = listOf(
        Pair("आज मेरा workout क्या है?", "What is my workout today?"),
        Pair("मेरे goal के हिसाब से diet क्या है?", "What is my diet according to my goal?"),
        Pair("मेरा पिछले महीने कितना weight कम हुआ?", "How much weight did I lose last month?")
    )

    fun sendQuestion(q: String) {
        if (q.isBlank()) return
        val userMsg = AiChatMessage(
            id = "U-${System.currentTimeMillis()}",
            sender = "user",
            textEn = q,
            textHi = q,
            timestamp = "Now"
        )
        val (ansEn, ansHi) = GymAiCoach.generateAnswer(
            question = q,
            member = member,
            workout = workout,
            diet = diet,
            progress = progressList,
            language = language
        )
        val aiMsg = AiChatMessage(
            id = "AI-${System.currentTimeMillis()}",
            sender = "ai",
            textEn = ansEn,
            textHi = ansHi,
            timestamp = "Now"
        )
        chatHistory = chatHistory + listOf(userMsg, aiMsg)
        userPrompt = ""
    }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        // AI Coach Header Banner
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = GymDarkCard),
            shape = RoundedCornerShape(14.dp),
            border = BorderStroke(1.dp, GymPrimary.copy(alpha = 0.3f))
        ) {
            Row(
                modifier = Modifier.padding(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(Brush.linearGradient(listOf(GymPrimary, GymSecondary))),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.AutoAwesome, contentDescription = null, tint = Color.Black, modifier = Modifier.size(20.dp))
                }
                Spacer(modifier = Modifier.width(10.dp))
                Column {
                    Text(
                        text = if (language == "hi") "AI फिटनेस कोच" else "IronPulse AI Fitness Assistant",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    Text(
                        text = if (language == "hi") "आपके जिम डेटा और लक्ष्यों के अनुसार प्रशिक्षित" else "Contextualized with your gym metrics & goal",
                        fontSize = 11.sp,
                        color = GymTextSecondaryDark
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        // Suggested prompt chips row
        Text(
            text = if (language == "hi") "त्वरित प्रश्न (Quick Questions):" else "Quick Prompt Chips:",
            fontSize = 11.sp,
            color = GymTextSecondaryDark,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(6.dp))

        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(quickChips) { (chipHi, chipEn) ->
                Surface(
                    color = GymDarkSurface,
                    shape = RoundedCornerShape(16.dp),
                    border = BorderStroke(1.dp, GymDarkBorder),
                    modifier = Modifier.clickable {
                        val text = if (language == "hi") chipHi else chipEn
                        sendQuestion(text)
                    }
                ) {
                    Text(
                        text = if (language == "hi") chipHi else chipEn,
                        fontSize = 11.sp,
                        color = GymSecondary,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        // Chat Message List
        LazyColumn(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(chatHistory) { msg ->
                val isAi = msg.sender == "ai"
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = if (isAi) Arrangement.Start else Arrangement.End
                ) {
                    Surface(
                        color = if (isAi) GymDarkCard else GymPrimaryContainer,
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, if (isAi) GymDarkBorder else GymPrimary.copy(alpha = 0.5f)),
                        modifier = Modifier.widthIn(max = 300.dp)
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text(
                                text = if (language == "hi") msg.textHi else msg.textEn,
                                fontSize = 12.sp,
                                color = if (isAi) GymTextPrimaryDark else GymPrimaryLight,
                                lineHeight = 18.sp
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = msg.timestamp,
                                fontSize = 9.sp,
                                color = GymTextMutedDark,
                                textAlign = TextAlign.End,
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        // Input bar
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedTextField(
                value = userPrompt,
                onValueChange = { userPrompt = it },
                placeholder = {
                    Text(
                        text = if (language == "hi") "कोई भी फिटनेस सवाल पूछें..." else "Ask any workout or nutrition question...",
                        fontSize = 12.sp,
                        color = GymTextMutedDark
                    )
                },
                modifier = Modifier.weight(1f),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = GymPrimary,
                    unfocusedBorderColor = GymDarkBorder,
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White
                ),
                shape = RoundedCornerShape(10.dp),
                singleLine = true
            )
            Spacer(modifier = Modifier.width(8.dp))
            Button(
                onClick = { sendQuestion(userPrompt) },
                colors = ButtonDefaults.buttonColors(containerColor = GymPrimary, contentColor = Color.Black),
                shape = RoundedCornerShape(10.dp),
                contentPadding = PaddingValues(10.dp)
            ) {
                Icon(imageVector = Icons.Default.Send, contentDescription = "Send", modifier = Modifier.size(18.dp))
            }
        }
    }
}

@Composable
fun MemberSupportScreen(
    tickets: List<SupportTicket>,
    onCreateTicket: () -> Unit,
    language: String
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = if (language == "hi") "सहायता और शिकायत टिकट" else "Help & Support Desk",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    Text(
                        text = if (language == "hi") "अपनी समस्या दर्ज करें, एडमिन 24 घंटे में समाधान करेगा" else "Submit issues regarding equipment, payments, or training",
                        fontSize = 11.sp,
                        color = GymTextSecondaryDark
                    )
                }

                Button(
                    onClick = onCreateTicket,
                    colors = ButtonDefaults.buttonColors(containerColor = GymPrimary, contentColor = Color.Black),
                    shape = RoundedCornerShape(8.dp),
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                    modifier = Modifier.height(32.dp)
                ) {
                    Icon(imageVector = Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(text = "New Ticket", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        // Trainer & Gym Review Stars Banner
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = GymDarkCard),
                shape = RoundedCornerShape(14.dp),
                border = BorderStroke(1.dp, GymDarkBorder)
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text(
                        text = if (language == "hi") "जिम और ट्रेनर रेटिंग" else "RATE YOUR TRAINER & GYM",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = GymAccentOrange
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "How was your recent session with Coach Kabir Sen?",
                        fontSize = 13.sp,
                        color = Color.White
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        repeat(5) {
                            Icon(imageVector = Icons.Default.Star, contentDescription = null, tint = GymAccentOrange, modifier = Modifier.size(24.dp))
                        }
                    }
                }
            }
        }

        items(tickets) { ticket ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = GymDarkCard),
                shape = RoundedCornerShape(12.dp),
                border = BorderStroke(1.dp, GymDarkBorder)
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Surface(
                            color = GymDarkSurface,
                            shape = RoundedCornerShape(4.dp)
                        ) {
                            Text(
                                text = "${ticket.category} • #${ticket.id}",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = GymSecondary,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }

                        Surface(
                            color = if (ticket.status == "Resolved") GymSuccess.copy(alpha = 0.2f) else GymWarning.copy(alpha = 0.2f),
                            shape = RoundedCornerShape(6.dp)
                        ) {
                            Text(
                                text = ticket.status,
                                color = if (ticket.status == "Resolved") GymSuccess else GymWarning,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))
                    Text(text = ticket.subject, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color.White)
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(text = ticket.message, fontSize = 11.sp, color = GymTextSecondaryDark)

                    ticket.resolution?.let { res ->
                        Spacer(modifier = Modifier.height(8.dp))
                        Surface(
                            color = GymDarkSurface,
                            shape = RoundedCornerShape(6.dp),
                            border = BorderStroke(1.dp, GymSuccess.copy(alpha = 0.3f))
                        ) {
                            Text(
                                text = "Admin Resolution: $res",
                                fontSize = 11.sp,
                                color = GymSuccess,
                                modifier = Modifier.padding(8.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

// ---------------- Modals ----------------

@Composable
fun RestTimerDialog(
    seconds: Int,
    onDismiss: () -> Unit,
    language: String
) {
    var timeLeft by remember { mutableStateOf(seconds) }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            colors = CardDefaults.cardColors(containerColor = GymDarkSurface),
            shape = RoundedCornerShape(20.dp),
            border = BorderStroke(2.dp, GymSecondary)
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = if (language == "hi") "रेस्ट टाइमर (विश्राम)" else "REST TIMER",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = GymSecondary,
                    letterSpacing = 1.sp
                )
                Spacer(modifier = Modifier.height(14.dp))

                Box(
                    modifier = Modifier
                        .size(130.dp)
                        .clip(CircleShape)
                        .background(GymDarkCard)
                        .border(4.dp, GymSecondary, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "${timeLeft}s",
                        fontSize = 32.sp,
                        fontWeight = FontWeight.Black,
                        color = Color.White
                    )
                }

                Spacer(modifier = Modifier.height(14.dp))
                Text(
                    text = if (language == "hi") "गहरी सांस लें और पानी पिएं" else "Breathe deep and hydrate before your next set",
                    fontSize = 11.sp,
                    color = GymTextSecondaryDark,
                    textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.height(18.dp))

                Button(
                    onClick = onDismiss,
                    colors = ButtonDefaults.buttonColors(containerColor = GymSecondary, contentColor = Color.Black),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(if (language == "hi") "सेट शुरू करें (Skip)" else "Start Next Set", fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
fun MemberPayDialog(
    member: Member,
    onPayConfirmed: (Double, String, String) -> Unit,
    onDismiss: () -> Unit,
    language: String
) {
    var selectedMethod by remember { mutableStateOf("UPI (GPay / PhonePe)") }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            colors = CardDefaults.cardColors(containerColor = GymDarkSurface),
            shape = RoundedCornerShape(16.dp),
            border = BorderStroke(1.dp, GymDarkBorder)
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text(
                    text = if (language == "hi") "जिम बकाया भुगतान" else "PAY GYM DUES",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Black,
                    color = GymPrimary
                )
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = "Billed to: ${member.name} (${member.id})",
                    fontSize = 12.sp,
                    color = GymTextSecondaryDark
                )

                Spacer(modifier = Modifier.height(14.dp))
                HorizontalDivider(color = GymDarkBorder)
                Spacer(modifier = Modifier.height(14.dp))

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(text = "Outstanding Due:", fontSize = 13.sp, color = GymTextSecondaryDark)
                    Text(text = "₹${member.balanceDue}", fontSize = 16.sp, fontWeight = FontWeight.Black, color = GymError)
                }

                Spacer(modifier = Modifier.height(14.dp))

                Text(text = "Select Payment Gateway:", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White)
                Spacer(modifier = Modifier.height(8.dp))

                listOf("UPI (GPay / PhonePe / Paytm)", "Credit / Debit Card", "Net Banking", "Cash at Reception").forEach { mode ->
                    Surface(
                        color = if (selectedMethod == mode) GymPrimary.copy(alpha = 0.15f) else GymDarkCard,
                        shape = RoundedCornerShape(8.dp),
                        border = BorderStroke(1.dp, if (selectedMethod == mode) GymPrimary else GymDarkBorder),
                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp).clickable { selectedMethod = mode }
                    ) {
                        Row(modifier = Modifier.padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                            RadioButton(
                                selected = selectedMethod == mode,
                                onClick = { selectedMethod = mode },
                                colors = RadioButtonDefaults.colors(selectedColor = GymPrimary)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(text = mode, fontSize = 12.sp, color = Color.White)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(18.dp))

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedButton(onClick = onDismiss, modifier = Modifier.weight(1f), border = BorderStroke(1.dp, GymDarkBorder)) {
                        Text("Cancel", color = Color.White)
                    }
                    Button(
                        onClick = { onPayConfirmed(member.balanceDue, selectedMethod, member.planName) },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = GymPrimary, contentColor = Color.Black)
                    ) {
                        Text("Pay ₹${member.balanceDue}", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    }
                }
            }
        }
    }
}

@Composable
fun CreateTicketDialog(
    onSubmit: (String, String, String, String) -> Unit,
    onDismiss: () -> Unit,
    language: String
) {
    var category by remember { mutableStateOf("Equipment") }
    var priority by remember { mutableStateOf("Medium") }
    var subject by remember { mutableStateOf("") }
    var message by remember { mutableStateOf("") }

    val categories = listOf("Equipment", "Payment", "Membership", "Trainer", "General")

    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            colors = CardDefaults.cardColors(containerColor = GymDarkSurface),
            shape = RoundedCornerShape(16.dp),
            border = BorderStroke(1.dp, GymDarkBorder)
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text(
                    text = if (language == "hi") "नया सहायता टिकट दर्ज करें" else "Create Support Ticket",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = GymPrimary
                )

                Spacer(modifier = Modifier.height(12.dp))

                Text(text = "Category:", fontSize = 11.sp, color = GymTextSecondaryDark)
                Spacer(modifier = Modifier.height(4.dp))
                LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    items(categories) { cat ->
                        Surface(
                            color = if (category == cat) GymSecondaryContainer else GymDarkCard,
                            shape = RoundedCornerShape(6.dp),
                            border = BorderStroke(1.dp, if (category == cat) GymSecondary else GymDarkBorder),
                            modifier = Modifier.clickable { category = cat }
                        ) {
                            Text(
                                text = cat,
                                fontSize = 11.sp,
                                color = if (category == cat) GymSecondary else Color.White,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                OutlinedTextField(
                    value = subject,
                    onValueChange = { subject = it },
                    label = { Text("Subject", fontSize = 11.sp) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = GymPrimary,
                        unfocusedBorderColor = GymDarkBorder,
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White
                    )
                )

                Spacer(modifier = Modifier.height(10.dp))

                OutlinedTextField(
                    value = message,
                    onValueChange = { message = it },
                    label = { Text("Detailed Description", fontSize = 11.sp) },
                    modifier = Modifier.fillMaxWidth().height(100.dp),
                    shape = RoundedCornerShape(8.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = GymPrimary,
                        unfocusedBorderColor = GymDarkBorder,
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White
                    )
                )

                Spacer(modifier = Modifier.height(16.dp))

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedButton(onClick = onDismiss, modifier = Modifier.weight(1f), border = BorderStroke(1.dp, GymDarkBorder)) {
                        Text("Cancel", color = Color.White)
                    }
                    Button(
                        onClick = {
                            if (subject.isNotBlank() && message.isNotBlank()) {
                                onSubmit(category, subject, message, priority)
                            }
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = GymPrimary, contentColor = Color.Black)
                    ) {
                        Text("Submit", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}
