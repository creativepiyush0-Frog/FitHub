package com.example.ui.admin

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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.example.data.GymRepository
import com.example.model.*
import com.example.ui.components.*
import com.example.ui.theme.*

@Composable
fun AdminDashboardScreen(
    repository: GymRepository,
    modifier: Modifier = Modifier
) {
    val language by repository.currentLanguage.collectAsState()
    val branch by repository.selectedBranch.collectAsState()
    val members by repository.members.collectAsState()
    val plans by repository.plans.collectAsState()
    val attendanceRecords by repository.attendanceRecords.collectAsState()
    val trainers by repository.trainers.collectAsState()
    val groupClasses by repository.groupClasses.collectAsState()
    val payments by repository.payments.collectAsState()
    val inventory by repository.inventory.collectAsState()
    val leads by repository.leads.collectAsState()
    val tickets by repository.tickets.collectAsState()
    val expenses by repository.expenses.collectAsState()

    var selectedTab by remember { mutableStateOf(0) }
    var searchQuery by remember { mutableStateOf("") }
    var statusFilter by remember { mutableStateOf<MemberStatus?>(null) }
    var selectedMemberForDetails by remember { mutableStateOf<Member?>(null) }
    var showAddMemberDialog by remember { mutableStateOf(false) }
    var showResolveTicketDialog by remember { mutableStateOf<SupportTicket?>(null) }
    var toastMessage by remember { mutableStateOf<String?>(null) }

    val adminTabs = listOf(
        Pair(if (language == "hi") "ओवरव्यू" else "Overview", Icons.Default.Dashboard),
        Pair(if (language == "hi") "सदस्य प्रबंधन" else "Members", Icons.Default.People),
        Pair(if (language == "hi") "अटेंडेंस गेट" else "Attendance Gate", Icons.Default.QrCodeScanner),
        Pair(if (language == "hi") "प्लान्स" else "Plans", Icons.Default.CardMembership),
        Pair(if (language == "hi") "ट्रेनर्स" else "Trainers", Icons.Default.FitnessCenter),
        Pair(if (language == "hi") "क्लासेस" else "Classes", Icons.Default.Event),
        Pair(if (language == "hi") "बिलिंग व खाते" else "Billing & P&L", Icons.Default.AccountBalance),
        Pair(if (language == "hi") "इन्वेंट्री" else "Inventory", Icons.Default.Inventory),
        Pair(if (language == "hi") "CRM लीड्स" else "CRM Leads", Icons.Default.Campaign),
        Pair(if (language == "hi") "सपोर्ट डेस्क" else "Tickets", Icons.Default.SupportAgent)
    )

    Column(modifier = modifier.fillMaxSize().background(GymDarkBg)) {
        // Tab Header
        ScrollableTabRow(
            selectedTabIndex = selectedTab,
            containerColor = GymDarkSurface,
            contentColor = GymSecondary,
            edgePadding = 12.dp,
            divider = { HorizontalDivider(color = GymDarkBorder) }
        ) {
            adminTabs.forEachIndexed { index, (title, icon) ->
                Tab(
                    selected = selectedTab == index,
                    onClick = { selectedTab = index },
                    text = {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = icon,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp),
                                tint = if (selectedTab == index) GymSecondary else GymTextSecondaryDark
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = title,
                                fontSize = 12.sp,
                                fontWeight = if (selectedTab == index) FontWeight.Bold else FontWeight.Normal,
                                color = if (selectedTab == index) GymSecondary else GymTextSecondaryDark
                            )
                        }
                    }
                )
            }
        }

        // Action Toast Banner
        toastMessage?.let { msg ->
            Surface(
                color = GymSecondary.copy(alpha = 0.2f),
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
                shape = RoundedCornerShape(8.dp),
                border = BorderStroke(1.dp, GymSecondary)
            ) {
                Row(
                    modifier = Modifier.padding(10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(text = msg, fontSize = 12.sp, color = Color.White, fontWeight = FontWeight.SemiBold)
                    IconButton(onClick = { toastMessage = null }, modifier = Modifier.size(20.dp)) {
                        Icon(Icons.Default.Close, contentDescription = null, tint = Color.White, modifier = Modifier.size(14.dp))
                    }
                }
            }
        }

        // Tab views
        Box(modifier = Modifier.weight(1f)) {
            when (selectedTab) {
                0 -> AdminOverviewTab(
                    branch = branch,
                    members = members,
                    attendanceRecords = attendanceRecords,
                    payments = payments,
                    expenses = expenses,
                    trainers = trainers,
                    classes = groupClasses,
                    language = language
                )
                1 -> AdminMembersTab(
                    members = members,
                    searchQuery = searchQuery,
                    onSearchChange = { searchQuery = it },
                    statusFilter = statusFilter,
                    onFilterSelect = { statusFilter = it },
                    onSelectMember = { selectedMemberForDetails = it },
                    onAddMember = { showAddMemberDialog = true },
                    onExportCsv = { toastMessage = "Exported ${members.size} members to members_export_2026.csv" },
                    language = language
                )
                2 -> AdminAttendanceTerminalTab(
                    branch = branch,
                    members = members,
                    attendanceRecords = attendanceRecords,
                    onSimulateCheckIn = { memberId ->
                        val m = members.find { it.id == memberId }
                        if (m != null) {
                            repository.toggleCheckInToday()
                            toastMessage = "Gate turnstile opened for ${m.name} (${m.id})"
                        }
                    },
                    language = language
                )
                3 -> AdminPlansTab(plans = plans, language = language)
                4 -> AdminTrainersTab(trainers = trainers, language = language)
                5 -> AdminClassesTab(classes = groupClasses, language = language)
                6 -> AdminBillingTab(payments = payments, expenses = expenses, language = language)
                7 -> AdminInventoryTab(
                    inventory = inventory,
                    onStockChange = { id, delta -> repository.updateInventoryStock(id, delta) },
                    language = language
                )
                8 -> AdminCrmLeadsTab(
                    leads = leads,
                    onStageChange = { id, stage -> repository.updateLeadStage(id, stage) },
                    onTriggerCampaign = { lead, campaign ->
                        toastMessage = "Triggered WhatsApp template '$campaign' to ${lead.name} (${lead.phone})"
                    },
                    language = language
                )
                9 -> AdminSupportDeskTab(
                    tickets = tickets,
                    onResolveClick = { showResolveTicketDialog = it },
                    language = language
                )
            }
        }
    }

    // Member 360 Details Modal
    selectedMemberForDetails?.let { member ->
        AdminMemberDetailsModal(
            member = member,
            onDismiss = { selectedMemberForDetails = null },
            onFreeze = { days ->
                repository.freezeMembership(member.id, days)
                selectedMemberForDetails = null
                toastMessage = "Membership frozen for $days days."
            },
            onExtend = { days ->
                repository.extendMembership(member.id, days)
                selectedMemberForDetails = null
                toastMessage = "Added $days bonus days to membership."
            },
            onRenew = {
                repository.updateMemberStatus(member.id, MemberStatus.ACTIVE)
                selectedMemberForDetails = null
                toastMessage = "Membership renewed successfully."
            },
            language = language
        )
    }

    // Add Member Dialog
    if (showAddMemberDialog) {
        AdminAddMemberDialog(
            branch = branch,
            plans = plans,
            trainers = trainers,
            onMemberAdded = { newMem ->
                repository.addMember(newMem)
                showAddMemberDialog = false
                toastMessage = "New member ${newMem.name} registered with ID ${newMem.id}!"
            },
            onDismiss = { showAddMemberDialog = false },
            language = language
        )
    }

    // Resolve Ticket Dialog
    showResolveTicketDialog?.let { ticket ->
        AdminResolveTicketDialog(
            ticket = ticket,
            onResolve = { note ->
                repository.resolveTicket(ticket.id, note)
                showResolveTicketDialog = null
                toastMessage = "Ticket #${ticket.id} marked as Resolved."
            },
            onDismiss = { showResolveTicketDialog = null },
            language = language
        )
    }
}

// ---------------- Admin Sub-Tabs ----------------

@Composable
fun AdminOverviewTab(
    branch: Branch,
    members: List<Member>,
    attendanceRecords: List<AttendanceRecord>,
    payments: List<PaymentRecord>,
    expenses: List<Pair<String, Double>>,
    trainers: List<Trainer>,
    classes: List<GroupClass>,
    language: String
) {
    val totalRevenue = payments.sumOf { it.totalAmount }
    val totalExpenses = expenses.sumOf { it.second }
    val netProfit = totalRevenue - totalExpenses
    val totalDues = members.sumOf { it.balanceDue }
    val activeCount = members.count { it.status == MemberStatus.ACTIVE }
    val expiredCount = members.count { it.status == MemberStatus.EXPIRED }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // Branch Header
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
                        Column {
                            Text(
                                text = branch.name,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Black,
                                color = Color.White
                            )
                            Text(
                                text = "${branch.address} • Manager: ${branch.managerName}",
                                fontSize = 11.sp,
                                color = GymTextSecondaryDark
                            )
                        }
                        Surface(
                            color = GymSecondary.copy(alpha = 0.15f),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text(
                                text = "Branch Active",
                                color = GymSecondary,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    // Live Capacity Gauge
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Current Floor Occupancy",
                            fontSize = 12.sp,
                            color = GymTextSecondaryDark
                        )
                        Text(
                            text = "${branch.currentOccupancy} / ${branch.maxCapacity} Athletes",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = GymPrimary
                        )
                    }
                    Spacer(modifier = Modifier.height(6.dp))
                    LinearProgressIndicator(
                        progress = { (branch.currentOccupancy.toFloat() / branch.maxCapacity).coerceIn(0f, 1f) },
                        modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)),
                        color = GymPrimary,
                        trackColor = GymDarkBorder
                    )
                }
            }
        }

        // Stats Grid Row 1
        item {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                StatMetricCard(
                    title = if (language == "hi") "सक्रिय सदस्य" else "Active Members",
                    value = "$activeCount",
                    subtext = "${members.size} Total Registered",
                    icon = Icons.Default.People,
                    accentColor = GymPrimary,
                    modifier = Modifier.weight(1f)
                )
                StatMetricCard(
                    title = if (language == "hi") "समाप्त सदस्यता" else "Expired Members",
                    value = "$expiredCount",
                    subtext = "Needs Renewal Trigger",
                    icon = Icons.Default.Warning,
                    accentColor = GymError,
                    modifier = Modifier.weight(1f)
                )
            }
        }

        // Stats Grid Row 2 (Financials)
        item {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                StatMetricCard(
                    title = if (language == "hi") "कुल आय (Revenue)" else "Total Collections",
                    value = "₹${String.format("%.0f", totalRevenue)}",
                    subtext = "GST Inc. (Q3)",
                    icon = Icons.Default.MonetizationOn,
                    accentColor = GymSuccess,
                    modifier = Modifier.weight(1f)
                )
                StatMetricCard(
                    title = if (language == "hi") "शुद्ध लाभ (Net Profit)" else "Net Profit",
                    value = "₹${String.format("%.0f", netProfit)}",
                    subtext = "After OpEx ₹${String.format("%.0f", totalExpenses)}",
                    icon = Icons.Default.TrendingUp,
                    accentColor = GymSecondary,
                    modifier = Modifier.weight(1f)
                )
            }
        }

        // Quick Highlights Row: Check-ins, Pending Dues, Active Trainers
        item {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Surface(
                    color = GymDarkCard,
                    shape = RoundedCornerShape(10.dp),
                    border = BorderStroke(1.dp, GymDarkBorder),
                    modifier = Modifier.weight(1f)
                ) {
                    Column(modifier = Modifier.padding(10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(text = "Today Scans", fontSize = 10.sp, color = GymTextSecondaryDark)
                        Text(text = "${attendanceRecords.size}", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = GymPrimary)
                    }
                }
                Surface(
                    color = GymDarkCard,
                    shape = RoundedCornerShape(10.dp),
                    border = BorderStroke(1.dp, GymDarkBorder),
                    modifier = Modifier.weight(1f)
                ) {
                    Column(modifier = Modifier.padding(10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(text = "Pending Dues", fontSize = 10.sp, color = GymTextSecondaryDark)
                        Text(text = "₹${String.format("%.0f", totalDues)}", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = GymError)
                    }
                }
                Surface(
                    color = GymDarkCard,
                    shape = RoundedCornerShape(10.dp),
                    border = BorderStroke(1.dp, GymDarkBorder),
                    modifier = Modifier.weight(1f)
                ) {
                    Column(modifier = Modifier.padding(10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(text = "Trainers on Duty", fontSize = 10.sp, color = GymTextSecondaryDark)
                        Text(text = "${trainers.size}", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = GymSecondary)
                    }
                }
            }
        }

        // Peak Gym Hours Distribution
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = GymDarkCard),
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, GymDarkBorder)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = if (language == "hi") "पीक ऑवर्स विश्लेषण (Peak Gym Hours)" else "PEAK GYM OCCUPANCY HOURS",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = GymAccentOrange
                    )
                    Spacer(modifier = Modifier.height(10.dp))

                    val hours = listOf(
                        Pair("06-08 AM", 0.90f),
                        Pair("08-10 AM", 0.65f),
                        Pair("10-04 PM", 0.30f),
                        Pair("04-06 PM", 0.55f),
                        Pair("06-09 PM", 0.95f),
                        Pair("09-11 PM", 0.40f)
                    )

                    hours.forEach { (slot, fraction) ->
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(text = slot, fontSize = 10.sp, color = GymTextSecondaryDark, modifier = Modifier.width(65.dp))
                            LinearProgressIndicator(
                                progress = { fraction },
                                modifier = Modifier.weight(1f).height(6.dp).clip(RoundedCornerShape(3.dp)),
                                color = if (fraction > 0.8f) GymAccentOrange else GymSecondary,
                                trackColor = GymDarkBorder
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(text = "${(fraction * 100).toInt()}%", fontSize = 10.sp, color = Color.White, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun AdminMembersTab(
    members: List<Member>,
    searchQuery: String,
    onSearchChange: (String) -> Unit,
    statusFilter: MemberStatus?,
    onFilterSelect: (MemberStatus?) -> Unit,
    onSelectMember: (Member) -> Unit,
    onAddMember: () -> Unit,
    onExportCsv: () -> Unit,
    language: String
) {
    val filtered = members.filter { m ->
        (statusFilter == null || m.status == statusFilter) &&
        (searchQuery.isBlank() || m.name.contains(searchQuery, ignoreCase = true) || m.phone.contains(searchQuery) || m.id.contains(searchQuery, ignoreCase = true))
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Search & Add Member Bar
        item {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = onSearchChange,
                    placeholder = { Text(if (language == "hi") "नाम, आईडी या फोन खोजें..." else "Search member ID, name, phone...", fontSize = 11.sp, color = GymTextMutedDark) },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = GymTextSecondaryDark, modifier = Modifier.size(18.dp)) },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(10.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = GymSecondary,
                        unfocusedBorderColor = GymDarkBorder,
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White
                    ),
                    singleLine = true
                )

                Button(
                    onClick = onAddMember,
                    colors = ButtonDefaults.buttonColors(containerColor = GymPrimary, contentColor = Color.Black),
                    shape = RoundedCornerShape(10.dp),
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp),
                    modifier = Modifier.height(48.dp)
                ) {
                    Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(text = "Add", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                }
            }
        }

        // Filter chips and Export action
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    item {
                        FilterChip(
                            selected = statusFilter == null,
                            onClick = { onFilterSelect(null) },
                            label = { Text("All (${members.size})", fontSize = 11.sp) }
                        )
                    }
                    items(MemberStatus.values()) { st ->
                        FilterChip(
                            selected = statusFilter == st,
                            onClick = { onFilterSelect(st) },
                            label = { Text(if (language == "hi") st.labelHi else st.labelEn, fontSize = 11.sp) }
                        )
                    }
                }

                IconButton(onClick = onExportCsv) {
                    Icon(Icons.Default.FileDownload, contentDescription = "Export CSV", tint = GymSecondary)
                }
            }
        }

        // Member List Items
        items(filtered) { member ->
            Card(
                modifier = Modifier.fillMaxWidth().clickable { onSelectMember(member) },
                colors = CardDefaults.cardColors(containerColor = GymDarkCard),
                shape = RoundedCornerShape(12.dp),
                border = BorderStroke(1.dp, GymDarkBorder)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(14.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .clip(CircleShape)
                                .background(GymDarkSurface),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = member.name.take(2).uppercase(),
                                fontWeight = FontWeight.Bold,
                                color = GymPrimary,
                                fontSize = 14.sp
                            )
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(text = member.name, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color.White)
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(text = "#${member.id}", fontSize = 10.sp, color = GymTextSecondaryDark)
                            }
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = "${member.planName} • Trainer: ${member.trainerName}",
                                fontSize = 11.sp,
                                color = GymTextSecondaryDark
                            )
                            if (member.balanceDue > 0) {
                                Text(text = "Due: ₹${member.balanceDue}", fontSize = 11.sp, color = GymError, fontWeight = FontWeight.Bold)
                            }
                        }
                    }

                    Column(horizontalAlignment = Alignment.End) {
                        StatusBadge(status = member.status, language = language)
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(text = "${member.remainingDays}d left", fontSize = 10.sp, color = GymTextMutedDark)
                    }
                }
            }
        }
    }
}

@Composable
fun AdminAttendanceTerminalTab(
    branch: Branch,
    members: List<Member>,
    attendanceRecords: List<AttendanceRecord>,
    onSimulateCheckIn: (String) -> Unit,
    language: String
) {
    var quickMemberId by remember { mutableStateOf("") }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // Gate Scanner Simulator Terminal
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = GymDarkSurface),
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, GymSecondary)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Sensors, contentDescription = null, tint = GymSecondary, modifier = Modifier.size(20.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = if (language == "hi") "लाइव टर्नस्टाइल गेट टर्मिनल" else "LIVE TURNSTILE GATE TERMINAL",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Black,
                                color = Color.White
                            )
                        }
                        Surface(color = GymSuccess.copy(alpha = 0.2f), shape = RoundedCornerShape(6.dp)) {
                            Text(text = "SCANNER READY", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = GymSuccess, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    Text(
                        text = if (language == "hi") "बायोमेट्रिक, क्यूआर कोड या सदस्य आईडी द्वारा त्वरित प्रवेश:" else "Simulate barcode scan, RFID card tap, or enter Member ID:",
                        fontSize = 11.sp,
                        color = GymTextSecondaryDark
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedTextField(
                            value = quickMemberId,
                            onValueChange = { quickMemberId = it },
                            placeholder = { Text("e.g. MEM-8821", fontSize = 11.sp, color = GymTextMutedDark) },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(8.dp),
                            singleLine = true,
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = GymSecondary,
                                unfocusedBorderColor = GymDarkBorder,
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White
                            )
                        )
                        Button(
                            onClick = {
                                if (quickMemberId.isNotBlank()) {
                                    onSimulateCheckIn(quickMemberId.trim())
                                    quickMemberId = ""
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = GymSecondary, contentColor = Color.Black),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.height(52.dp)
                        ) {
                            Text("Open Turnstile", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        }
                    }
                }
            }
        }

        // Live Log Header
        item {
            Text(
                text = if (language == "hi") "आज की उपस्थिति लॉग (Realtime Logs)" else "Today's Live Check-in / Out Stream",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
        }

        items(attendanceRecords) { att ->
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
                    Column {
                        Text(text = att.memberName, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color.White)
                        Text(text = "ID: ${att.memberId} • Gate: ${att.branchName}", fontSize = 11.sp, color = GymTextSecondaryDark)
                    }

                    Column(horizontalAlignment = Alignment.End) {
                        Text(text = "In: ${att.checkInTime}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = GymPrimary)
                        Text(text = att.checkOutTime?.let { "Out: $it" } ?: "Currently Inside", fontSize = 10.sp, color = if (att.checkOutTime != null) GymTextMutedDark else GymSuccess)
                    }
                }
            }
        }
    }
}

@Composable
fun AdminPlansTab(plans: List<MembershipPlan>, language: String) {
    LazyColumn(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Text(text = if (language == "hi") "जिम सदस्यता प्लान्स कैटलॉग" else "Membership Plans & Packages", fontSize = 14.sp, fontWeight = FontWeight.Black, color = Color.White)
        }

        items(plans) { plan ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = GymDarkCard),
                shape = RoundedCornerShape(14.dp),
                border = BorderStroke(1.dp, GymDarkBorder)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Column {
                            Text(text = plan.name, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Color.White)
                            Text(text = "${plan.durationMonths} Months Duration • Freeze: ${plan.freezeDaysAllowed} Days", fontSize = 11.sp, color = GymTextSecondaryDark)
                        }
                        Text(text = "₹${plan.price.toInt()}", fontSize = 18.sp, fontWeight = FontWeight.Black, color = GymPrimary)
                    }

                    Spacer(modifier = Modifier.height(8.dp))
                    Text(text = plan.description, fontSize = 11.sp, color = GymTextSecondaryDark)
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(text = "Includes: ${plan.allowedClasses.joinToString(", ")} • PT: ${plan.ptSessionsIncluded} sessions", fontSize = 11.sp, color = GymSecondary)
                }
            }
        }
    }
}

@Composable
fun AdminTrainersTab(trainers: List<Trainer>, language: String) {
    LazyColumn(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Text(text = if (language == "hi") "जिम ट्रेनर स्टाफ और परफॉरमेंस" else "Gym Trainers Roster & Performance", fontSize = 14.sp, fontWeight = FontWeight.Black, color = Color.White)
        }

        items(trainers) { trn ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = GymDarkCard),
                shape = RoundedCornerShape(14.dp),
                border = BorderStroke(1.dp, GymDarkBorder)
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Column {
                            Text(text = trn.name, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Color.White)
                            Text(text = trn.specialty, fontSize = 11.sp, color = GymSecondary)
                        }
                        Surface(color = GymAccentOrange.copy(alpha = 0.15f), shape = RoundedCornerShape(6.dp)) {
                            Text(text = "⭐ ${trn.rating}", color = GymAccentOrange, fontWeight = FontWeight.Bold, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(text = "Assigned Members: ${trn.assignedMembersCount}", fontSize = 11.sp, color = GymTextSecondaryDark)
                        Text(text = "Commission: ${trn.commissionPercent}%", fontSize = 11.sp, color = GymPrimary)
                    }
                    Text(text = "Base Salary: ₹${trn.monthlySalary.toInt()}/mo • Exp: ${trn.experienceYears} Years", fontSize = 11.sp, color = GymTextMutedDark)
                }
            }
        }
    }
}

@Composable
fun AdminClassesTab(classes: List<GroupClass>, language: String) {
    LazyColumn(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Text(text = if (language == "hi") "दैनिक ग्रुप क्लास शेड्यूलर" else "Daily Class Timetable & Capacities", fontSize = 14.sp, fontWeight = FontWeight.Black, color = Color.White)
        }

        items(classes) { cls ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = GymDarkCard),
                shape = RoundedCornerShape(12.dp),
                border = BorderStroke(1.dp, GymDarkBorder)
            ) {
                Row(modifier = Modifier.fillMaxWidth().padding(14.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Column {
                        Text(text = cls.title, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color.White)
                        Text(text = "${cls.time} • ${cls.room} • Coach: ${cls.trainerName}", fontSize = 11.sp, color = GymTextSecondaryDark)
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text(text = "${cls.bookedCount}/${cls.capacity} Booked", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = if (cls.bookedCount >= cls.capacity) GymError else GymSuccess)
                        Text(text = "${cls.durationMins} mins", fontSize = 10.sp, color = GymTextMutedDark)
                    }
                }
            }
        }
    }
}

@Composable
fun AdminBillingTab(payments: List<PaymentRecord>, expenses: List<Pair<String, Double>>, language: String) {
    val totalRevenue = payments.sumOf { it.totalAmount }
    val totalExpenses = expenses.sumOf { it.second }

    LazyColumn(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = GymDarkSurface),
                shape = RoundedCornerShape(14.dp),
                border = BorderStroke(1.dp, GymDarkBorder)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(text = "P&L SUMMARY STATEMENT", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = GymSecondary)
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(text = "Gross Revenue Collected:", fontSize = 12.sp, color = GymTextSecondaryDark)
                        Text(text = "₹${String.format("%.2f", totalRevenue)}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = GymSuccess)
                    }
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(text = "Total Branch Expenses:", fontSize = 12.sp, color = GymTextSecondaryDark)
                        Text(text = "-₹${String.format("%.2f", totalExpenses)}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = GymError)
                    }
                    HorizontalDivider(color = GymDarkBorder, modifier = Modifier.padding(vertical = 6.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(text = "Net Operating Income:", fontSize = 14.sp, fontWeight = FontWeight.Black, color = Color.White)
                        Text(text = "₹${String.format("%.2f", totalRevenue - totalExpenses)}", fontSize = 15.sp, fontWeight = FontWeight.Black, color = GymPrimary)
                    }
                }
            }
        }

        item {
            Text(text = "Operational Expenses Breakdown", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color.White)
        }

        items(expenses) { (title, amt) ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = GymDarkCard),
                shape = RoundedCornerShape(10.dp),
                border = BorderStroke(1.dp, GymDarkBorder)
            ) {
                Row(modifier = Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(text = title, fontSize = 12.sp, color = Color.White)
                    Text(text = "₹${amt.toInt()}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = GymError)
                }
            }
        }
    }
}

@Composable
fun AdminInventoryTab(
    inventory: List<InventoryItem>,
    onStockChange: (String, Int) -> Unit,
    language: String
) {
    LazyColumn(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Text(text = if (language == "hi") "जिम इन्वेंट्री व सप्लीमेंट स्टॉक" else "Gym Inventory & Supplements Stock", fontSize = 14.sp, fontWeight = FontWeight.Black, color = Color.White)
        }

        items(inventory) { item ->
            val isLowStock = item.stockQty <= item.minStockAlert
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = GymDarkCard),
                shape = RoundedCornerShape(12.dp),
                border = BorderStroke(1.dp, if (isLowStock) GymError.copy(alpha = 0.5f) else GymDarkBorder)
            ) {
                Row(modifier = Modifier.fillMaxWidth().padding(14.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Column(modifier = Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(text = item.name, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color.White)
                            if (isLowStock) {
                                Spacer(modifier = Modifier.width(6.dp))
                                Surface(color = GymError.copy(alpha = 0.2f), shape = RoundedCornerShape(4.dp)) {
                                    Text(text = "LOW", color = GymError, fontSize = 9.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp))
                                }
                            }
                        }
                        Text(text = "${item.category} • Cost: ₹${item.costPrice} | Price: ₹${item.unitPrice}", fontSize = 11.sp, color = GymTextSecondaryDark)
                        Text(text = "Supplier: ${item.supplier}", fontSize = 10.sp, color = GymTextMutedDark)
                    }

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(onClick = { onStockChange(item.id, -1) }, modifier = Modifier.size(28.dp)) {
                            Icon(Icons.Default.Remove, contentDescription = null, tint = GymTextSecondaryDark)
                        }
                        Text(text = "${item.stockQty}", fontSize = 14.sp, fontWeight = FontWeight.Black, color = if (isLowStock) GymError else GymPrimary, modifier = Modifier.padding(horizontal = 6.dp))
                        IconButton(onClick = { onStockChange(item.id, 5) }, modifier = Modifier.size(28.dp)) {
                            Icon(Icons.Default.Add, contentDescription = null, tint = GymPrimary)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun AdminCrmLeadsTab(
    leads: List<MarketingLead>,
    onStageChange: (String, String) -> Unit,
    onTriggerCampaign: (MarketingLead, String) -> Unit,
    language: String
) {
    val stages = listOf("NEW", "CONTACTED", "TRIAL_BOOKED", "CONVERTED")

    LazyColumn(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Text(text = if (language == "hi") "CRM लीड्स और ऑटोमेटेड मार्केटिंग" else "CRM Leads & Automated Campaigns", fontSize = 14.sp, fontWeight = FontWeight.Black, color = Color.White)
        }

        items(leads) { lead ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = GymDarkCard),
                shape = RoundedCornerShape(12.dp),
                border = BorderStroke(1.dp, GymDarkBorder)
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Column {
                            Text(text = lead.name, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color.White)
                            Text(text = "${lead.phone} • Source: ${lead.source}", fontSize = 11.sp, color = GymTextSecondaryDark)
                        }
                        Surface(color = GymSecondary.copy(alpha = 0.2f), shape = RoundedCornerShape(6.dp)) {
                            Text(text = lead.stage, color = GymSecondary, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))
                    Text(text = "Interested Plan: ${lead.interestPlan} • Note: ${lead.notes}", fontSize = 11.sp, color = GymTextSecondaryDark)

                    Spacer(modifier = Modifier.height(10.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Button(
                            onClick = { onTriggerCampaign(lead, "7-Day Trial Pass") },
                            shape = RoundedCornerShape(6.dp),
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = GymDarkSurface, contentColor = GymSuccess),
                            border = BorderStroke(1.dp, GymSuccess.copy(alpha = 0.4f)),
                            modifier = Modifier.height(28.dp)
                        ) {
                            Text("WhatsApp Pass", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        }
                        Button(
                            onClick = { onStageChange(lead.id, "CONVERTED") },
                            shape = RoundedCornerShape(6.dp),
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = GymPrimary, contentColor = Color.Black),
                            modifier = Modifier.height(28.dp)
                        ) {
                            Text("Convert to Member", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun AdminSupportDeskTab(
    tickets: List<SupportTicket>,
    onResolveClick: (SupportTicket) -> Unit,
    language: String
) {
    LazyColumn(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Text(text = if (language == "hi") "सदस्य सहायता टिकट डेस्क" else "Member Support Ticket Desk", fontSize = 14.sp, fontWeight = FontWeight.Black, color = Color.White)
        }

        items(tickets) { ticket ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = GymDarkCard),
                shape = RoundedCornerShape(12.dp),
                border = BorderStroke(1.dp, GymDarkBorder)
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text(text = "${ticket.category} • Member: ${ticket.memberName}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = GymSecondary)
                        Surface(
                            color = if (ticket.status == "Resolved") GymSuccess.copy(alpha = 0.2f) else GymWarning.copy(alpha = 0.2f),
                            shape = RoundedCornerShape(4.dp)
                        ) {
                            Text(text = ticket.status, color = if (ticket.status == "Resolved") GymSuccess else GymWarning, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                        }
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(text = ticket.subject, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color.White)
                    Text(text = ticket.message, fontSize = 11.sp, color = GymTextSecondaryDark)

                    if (ticket.status != "Resolved") {
                        Spacer(modifier = Modifier.height(8.dp))
                        Button(
                            onClick = { onResolveClick(ticket) },
                            colors = ButtonDefaults.buttonColors(containerColor = GymPrimary, contentColor = Color.Black),
                            shape = RoundedCornerShape(6.dp),
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                            modifier = Modifier.height(28.dp)
                        ) {
                            Text("Resolve Ticket", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

// ---------------- Admin Modals ----------------

@Composable
fun AdminMemberDetailsModal(
    member: Member,
    onDismiss: () -> Unit,
    onFreeze: (Int) -> Unit,
    onExtend: (Int) -> Unit,
    onRenew: () -> Unit,
    language: String
) {
    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            colors = CardDefaults.cardColors(containerColor = GymDarkSurface),
            shape = RoundedCornerShape(16.dp),
            border = BorderStroke(1.dp, GymDarkBorder)
        ) {
            Column(modifier = Modifier.padding(18.dp)) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Column {
                        Text(text = member.name, fontSize = 16.sp, fontWeight = FontWeight.Black, color = Color.White)
                        Text(text = "ID: ${member.id} • ${member.phone}", fontSize = 11.sp, color = GymTextSecondaryDark)
                    }
                    StatusBadge(status = member.status, language = language)
                }

                Spacer(modifier = Modifier.height(10.dp))
                HorizontalDivider(color = GymDarkBorder)
                Spacer(modifier = Modifier.height(10.dp))

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(text = "Plan:", fontSize = 12.sp, color = GymTextSecondaryDark)
                    Text(text = member.planName, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White)
                }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(text = "Expiry:", fontSize = 12.sp, color = GymTextSecondaryDark)
                    Text(text = "${member.expiryDate} (${member.remainingDays}d left)", fontSize = 12.sp, color = GymPrimary)
                }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(text = "Trainer:", fontSize = 12.sp, color = GymTextSecondaryDark)
                    Text(text = member.trainerName, fontSize = 12.sp, color = Color.White)
                }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(text = "Pending Dues:", fontSize = 12.sp, color = GymTextSecondaryDark)
                    Text(text = "₹${member.balanceDue}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = if (member.balanceDue > 0) GymError else GymSuccess)
                }

                Spacer(modifier = Modifier.height(14.dp))
                Text(text = "Management Actions:", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = GymSecondary)
                Spacer(modifier = Modifier.height(8.dp))

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Button(
                        onClick = { onFreeze(15) },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = GymDarkCard, contentColor = GymSecondary),
                        shape = RoundedCornerShape(6.dp),
                        contentPadding = PaddingValues(4.dp)
                    ) {
                        Text("Freeze (15d)", fontSize = 10.sp)
                    }
                    Button(
                        onClick = { onExtend(7) },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = GymDarkCard, contentColor = GymPrimary),
                        shape = RoundedCornerShape(6.dp),
                        contentPadding = PaddingValues(4.dp)
                    ) {
                        Text("Extend (+7d)", fontSize = 10.sp)
                    }
                    Button(
                        onClick = onRenew,
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = GymPrimary, contentColor = Color.Black),
                        shape = RoundedCornerShape(6.dp),
                        contentPadding = PaddingValues(4.dp)
                    ) {
                        Text("Renew Plan", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))
                OutlinedButton(onClick = onDismiss, modifier = Modifier.fillMaxWidth(), border = BorderStroke(1.dp, GymDarkBorder)) {
                    Text("Close", color = Color.White)
                }
            }
        }
    }
}

@Composable
fun AdminAddMemberDialog(
    branch: Branch,
    plans: List<MembershipPlan>,
    trainers: List<Trainer>,
    onMemberAdded: (Member) -> Unit,
    onDismiss: () -> Unit,
    language: String
) {
    var name by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var selectedPlan by remember { mutableStateOf(plans.first()) }
    var selectedTrainer by remember { mutableStateOf(trainers.first()) }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            colors = CardDefaults.cardColors(containerColor = GymDarkSurface),
            shape = RoundedCornerShape(16.dp),
            border = BorderStroke(1.dp, GymDarkBorder)
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text(text = if (language == "hi") "नया सदस्य जोड़ें" else "Register New Member", fontSize = 16.sp, fontWeight = FontWeight.Black, color = GymPrimary)
                Spacer(modifier = Modifier.height(10.dp))

                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Full Name", fontSize = 11.sp) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = GymPrimary, unfocusedBorderColor = GymDarkBorder, focusedTextColor = Color.White, unfocusedTextColor = Color.White)
                )
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = phone,
                    onValueChange = { phone = it },
                    label = { Text("Phone Number", fontSize = 11.sp) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = GymPrimary, unfocusedBorderColor = GymDarkBorder, focusedTextColor = Color.White, unfocusedTextColor = Color.White)
                )
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("Email Address", fontSize = 11.sp) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = GymPrimary, unfocusedBorderColor = GymDarkBorder, focusedTextColor = Color.White, unfocusedTextColor = Color.White)
                )

                Spacer(modifier = Modifier.height(14.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedButton(onClick = onDismiss, modifier = Modifier.weight(1f), border = BorderStroke(1.dp, GymDarkBorder)) {
                        Text("Cancel", color = Color.White)
                    }
                    Button(
                        onClick = {
                            if (name.isNotBlank() && phone.isNotBlank()) {
                                val id = "MEM-${(8825..8999).random()}"
                                val newMem = Member(
                                    id = id,
                                    name = name,
                                    email = email.ifBlank { "$id@example.com" },
                                    phone = phone,
                                    dob = "1998-05-10",
                                    gender = "Unspecified",
                                    bloodGroup = "B+",
                                    emergencyContact = phone,
                                    heightCm = 175.0,
                                    weightKg = 70.0,
                                    fitnessGoal = "General Fitness",
                                    joiningDate = "2026-10-04",
                                    planId = selectedPlan.id,
                                    planName = selectedPlan.name,
                                    branchId = branch.id,
                                    branchName = branch.name,
                                    status = MemberStatus.ACTIVE,
                                    startDate = "2026-10-04",
                                    expiryDate = "2027-10-04",
                                    remainingDays = selectedPlan.durationMonths * 30,
                                    trainerId = selectedTrainer.id,
                                    trainerName = selectedTrainer.name,
                                    balanceDue = 0.0,
                                    qrToken = "IRONPULSE-$id"
                                )
                                onMemberAdded(newMem)
                            }
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = GymPrimary, contentColor = Color.Black)
                    ) {
                        Text("Save Member", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
fun AdminResolveTicketDialog(ticket: SupportTicket, onResolve: (String) -> Unit, onDismiss: () -> Unit, language: String) {
    var note by remember { mutableStateOf("") }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            colors = CardDefaults.cardColors(containerColor = GymDarkSurface),
            shape = RoundedCornerShape(16.dp),
            border = BorderStroke(1.dp, GymDarkBorder)
        ) {
            Column(modifier = Modifier.padding(18.dp)) {
                Text(text = "Resolve Ticket #${ticket.id}", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = GymPrimary)
                Spacer(modifier = Modifier.height(6.dp))
                Text(text = "Subject: ${ticket.subject}", fontSize = 12.sp, color = Color.White)
                Text(text = "Member: ${ticket.memberName}", fontSize = 11.sp, color = GymTextSecondaryDark)

                Spacer(modifier = Modifier.height(10.dp))
                OutlinedTextField(
                    value = note,
                    onValueChange = { note = it },
                    label = { Text("Resolution note", fontSize = 11.sp) },
                    modifier = Modifier.fillMaxWidth().height(90.dp),
                    shape = RoundedCornerShape(8.dp),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = GymPrimary, unfocusedBorderColor = GymDarkBorder, focusedTextColor = Color.White, unfocusedTextColor = Color.White)
                )

                Spacer(modifier = Modifier.height(14.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedButton(onClick = onDismiss, modifier = Modifier.weight(1f), border = BorderStroke(1.dp, GymDarkBorder)) {
                        Text("Cancel", color = Color.White)
                    }
                    Button(
                        onClick = { if (note.isNotBlank()) onResolve(note) },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = GymSuccess, contentColor = Color.Black)
                    ) {
                        Text("Mark Resolved", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}
