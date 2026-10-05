package com.example.ui.superadmin

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.GymRepository
import com.example.model.*
import com.example.ui.components.StatMetricCard
import com.example.ui.theme.*

@Composable
fun SuperAdminDashboardScreen(
    repository: GymRepository,
    modifier: Modifier = Modifier
) {
    val language by repository.currentLanguage.collectAsState()
    val branches by repository.branches.collectAsState()
    val selectedBranch by repository.selectedBranch.collectAsState()
    val staffList by repository.staffList.collectAsState()
    val auditLogs by repository.auditLogs.collectAsState()

    var selectedTab by remember { mutableStateOf(0) }
    var toastMessage by remember { mutableStateOf<String?>(null) }

    val superTabs = listOf(
        Pair(if (language == "hi") "मल्टी-जिम नेटवर्क" else "Multi-Gym Network", Icons.Default.Business),
        Pair(if (language == "hi") "एडमिन व अनुमतियाँ" else "Admin Permissions", Icons.Default.Security),
        Pair(if (language == "hi") "सुरक्षा ऑडिट लॉग" else "Audit Logs", Icons.Default.History),
        Pair(if (language == "hi") "सिस्टम सेटिंग्स व बैकअप" else "Settings & Backup", Icons.Default.Settings)
    )

    Column(modifier = modifier.fillMaxSize().background(GymDarkBg)) {
        // Tab Header
        ScrollableTabRow(
            selectedTabIndex = selectedTab,
            containerColor = GymDarkSurface,
            contentColor = GymAccentPurple,
            edgePadding = 12.dp,
            divider = { HorizontalDivider(color = GymDarkBorder) }
        ) {
            superTabs.forEachIndexed { index, (title, icon) ->
                Tab(
                    selected = selectedTab == index,
                    onClick = { selectedTab = index },
                    text = {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = icon,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp),
                                tint = if (selectedTab == index) GymAccentPurple else GymTextSecondaryDark
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = title,
                                fontSize = 12.sp,
                                fontWeight = if (selectedTab == index) FontWeight.Bold else FontWeight.Normal,
                                color = if (selectedTab == index) GymAccentPurple else GymTextSecondaryDark
                            )
                        }
                    }
                )
            }
        }

        toastMessage?.let { msg ->
            Surface(
                color = GymAccentPurple.copy(alpha = 0.2f),
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
                shape = RoundedCornerShape(8.dp),
                border = BorderStroke(1.dp, GymAccentPurple)
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

        Box(modifier = Modifier.weight(1f)) {
            when (selectedTab) {
                0 -> SuperAdminMultiBranchTab(
                    branches = branches,
                    selectedBranch = selectedBranch,
                    onBranchSelect = {
                        repository.selectBranch(it)
                        toastMessage = "Switched active management view to ${it.name}"
                    },
                    language = language
                )
                1 -> SuperAdminPermissionsTab(
                    staffList = staffList,
                    onTogglePermission = { staffId, perm ->
                        repository.toggleStaffPermission(staffId, perm)
                        toastMessage = "Permission '$perm' toggled for staff #$staffId"
                    },
                    language = language
                )
                2 -> SuperAdminAuditLogsTab(
                    auditLogs = auditLogs,
                    language = language
                )
                3 -> SuperAdminSettingsAndBackupTab(
                    onBackupExport = {
                        toastMessage = "Full encrypted database backup generated (ironpulse_backup_20261005.json) - 4.2 MB"
                    },
                    onRestore = {
                        toastMessage = "Database snapshot restored successfully. All integrity checks passed."
                    },
                    language = language
                )
            }
        }
    }
}

// ---------------- Super Admin Tabs ----------------

@Composable
fun SuperAdminMultiBranchTab(
    branches: List<Branch>,
    selectedBranch: Branch,
    onBranchSelect: (Branch) -> Unit,
    language: String
) {
    val totalRevenue = branches.sumOf { it.monthlyRevenue }
    val totalActiveMembers = branches.sumOf { it.activeMembers }

    LazyColumn(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        // Enterprise Headline
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = GymDarkCard),
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, GymAccentPurple.copy(alpha = 0.5f))
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = if (language == "hi") "कंसोलिडेटेड एंटरप्राइज मेट्रिक्स" else "CONSOLIDATED ENTERPRISE ANALYTICS",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = GymAccentPurple
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        StatMetricCard(
                            title = "Total Chain Revenue",
                            value = "₹${String.format("%.0f", totalRevenue)}",
                            subtext = "${branches.size} Branches Active",
                            icon = Icons.Default.MonetizationOn,
                            accentColor = GymPrimary,
                            modifier = Modifier.weight(1f)
                        )
                        StatMetricCard(
                            title = "Chain Total Members",
                            value = "$totalActiveMembers",
                            subtext = "Across 3 Metros",
                            icon = Icons.Default.Groups,
                            accentColor = GymSecondary,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }
        }

        item {
            Text(
                text = if (language == "hi") "शाखा नेटवर्क (Branch Comparison)" else "Branch Network Performance",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
        }

        items(branches) { b ->
            val isCurrent = b.id == selectedBranch.id
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = if (isCurrent) Color(0xFF231C2E) else GymDarkCard
                ),
                shape = RoundedCornerShape(14.dp),
                border = BorderStroke(1.dp, if (isCurrent) GymAccentPurple else GymDarkBorder)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(text = b.name, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Color.White)
                                if (isCurrent) {
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Surface(color = GymAccentPurple, shape = RoundedCornerShape(4.dp)) {
                                        Text(text = "CURRENT", color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp))
                                    }
                                }
                            }
                            Text(text = "${b.city} • ${b.address}", fontSize = 11.sp, color = GymTextSecondaryDark)
                            Text(text = "Manager: ${b.managerName} • Phone: ${b.phone}", fontSize = 10.sp, color = GymTextMutedDark)
                        }

                        Button(
                            onClick = { onBranchSelect(b) },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (isCurrent) GymDarkSurface else GymAccentPurple,
                                contentColor = Color.White
                            ),
                            shape = RoundedCornerShape(8.dp),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                            modifier = Modifier.height(30.dp)
                        ) {
                            Text(if (isCurrent) "Active View" else "Manage Branch", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(text = "Members: ${b.activeMembers} Athletes", fontSize = 12.sp, color = GymPrimary, fontWeight = FontWeight.SemiBold)
                        Text(text = "Occupancy: ${b.currentOccupancy}/${b.maxCapacity}", fontSize = 12.sp, color = GymSecondary, fontWeight = FontWeight.SemiBold)
                        Text(text = "Rev: ₹${String.format("%.0f", b.monthlyRevenue)}", fontSize = 12.sp, color = Color.White, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
fun SuperAdminPermissionsTab(
    staffList: List<AdminStaff>,
    onTogglePermission: (String, String) -> Unit,
    language: String
) {
    LazyColumn(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            Column {
                Text(
                    text = if (language == "hi") "एडमिन स्टाफ व अनुमतियाँ (Role-Based Access Control)" else "Admin Staff & Granular Permissions",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
                Text(
                    text = if (language == "hi") "सुपर एडमिन प्रत्येक एडमिन के अधिकारों को व्यक्तिगत रूप से नियंत्रित कर सकता है" else "Configure individual read/write permissions per branch administrator",
                    fontSize = 11.sp,
                    color = GymTextSecondaryDark
                )
            }
        }

        items(staffList) { staff ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = GymDarkCard),
                shape = RoundedCornerShape(14.dp),
                border = BorderStroke(1.dp, GymDarkBorder)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Column {
                            Text(text = staff.name, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Color.White)
                            Text(text = "${staff.role} • ${staff.branchName}", fontSize = 11.sp, color = GymTextSecondaryDark)
                            Text(text = "Email: ${staff.email} • Last login: ${staff.lastLogin}", fontSize = 10.sp, color = GymTextMutedDark)
                        }
                        Surface(color = GymSuccess.copy(alpha = 0.2f), shape = RoundedCornerShape(6.dp)) {
                            Text(text = staff.status, color = GymSuccess, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))
                    Text(text = "Permission Matrix:", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = GymAccentPurple)
                    Spacer(modifier = Modifier.height(6.dp))

                    // Permission Matrix Checkboxes/Switches Row
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            PermToggleChip(
                                label = "Manage Members",
                                isGranted = staff.canMembers,
                                onToggle = { onTogglePermission(staff.id, "members") },
                                modifier = Modifier.weight(1f)
                            )
                            PermToggleChip(
                                label = "Manage Payments",
                                isGranted = staff.canPayments,
                                onToggle = { onTogglePermission(staff.id, "payments") },
                                modifier = Modifier.weight(1f)
                            )
                        }
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            PermToggleChip(
                                label = "Manage Expenses",
                                isGranted = staff.canExpenses,
                                onToggle = { onTogglePermission(staff.id, "expenses") },
                                modifier = Modifier.weight(1f)
                            )
                            PermToggleChip(
                                label = "View Reports",
                                isGranted = staff.canReports,
                                onToggle = { onTogglePermission(staff.id, "reports") },
                                modifier = Modifier.weight(1f)
                            )
                        }
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            PermToggleChip(
                                label = "Delete Member",
                                isGranted = staff.canDeleteMember,
                                onToggle = { onTogglePermission(staff.id, "delete") },
                                modifier = Modifier.weight(1f)
                            )
                            PermToggleChip(
                                label = "System Settings",
                                isGranted = staff.canSettings,
                                onToggle = { onTogglePermission(staff.id, "settings") },
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun PermToggleChip(
    label: String,
    isGranted: Boolean,
    onToggle: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        color = if (isGranted) GymSuccess.copy(alpha = 0.12f) else GymDarkSurface,
        shape = RoundedCornerShape(8.dp),
        border = BorderStroke(1.dp, if (isGranted) GymSuccess.copy(alpha = 0.4f) else GymDarkBorder),
        modifier = modifier.clickable { onToggle() }
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(text = label, fontSize = 11.sp, color = if (isGranted) Color.White else GymTextSecondaryDark)
            Text(
                text = if (isGranted) "✅" else "❌",
                fontSize = 11.sp
            )
        }
    }
}

@Composable
fun SuperAdminAuditLogsTab(
    auditLogs: List<AuditLog>,
    language: String
) {
    LazyColumn(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Column {
                Text(
                    text = if (language == "hi") "सुरक्षा ऑडिट लॉग (Real-time Audit Trail)" else "Immutable Security Audit Logs",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
                Text(
                    text = if (language == "hi") "प्रत्येक महत्वपूर्ण एडमिन क्रियाकलाप का रिकॉर्ड (कोई भी बदलाव छुपा नहीं रहेगा)" else "Tamper-proof record of every system mutation, gate scan, and financial update",
                    fontSize = 11.sp,
                    color = GymTextSecondaryDark
                )
            }
        }

        items(auditLogs) { log ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = GymDarkCard),
                shape = RoundedCornerShape(10.dp),
                border = BorderStroke(1.dp, GymDarkBorder)
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Fingerprint, contentDescription = null, tint = GymAccentPurple, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(text = "${log.actorName} (${log.actorRole})", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White)
                        }
                        Text(text = log.timestamp, fontSize = 10.sp, color = GymTextMutedDark)
                    }

                    Spacer(modifier = Modifier.height(4.dp))
                    Text(text = "${log.action} • ${log.entity}", fontSize = 12.sp, color = GymPrimary, fontWeight = FontWeight.SemiBold)
                    Text(text = log.details, fontSize = 11.sp, color = GymTextSecondaryDark)
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(text = "IP: ${log.ipAddress} • Device: ${log.device}", fontSize = 9.sp, color = GymTextMutedDark)
                }
            }
        }
    }
}

@Composable
fun SuperAdminSettingsAndBackupTab(
    onBackupExport: () -> Unit,
    onRestore: () -> Unit,
    language: String
) {
    var gymName by remember { mutableStateOf("IronPulse Fitness Global") }
    var gstin by remember { mutableStateOf("27AABCI8912P1ZS") }
    var currency by remember { mutableStateOf("INR (₹)") }
    var twoFactorAuth by remember { mutableStateOf(true) }

    LazyColumn(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            Text(
                text = if (language == "hi") "सिस्टम सेटिंग्स और डेटा बैकअप" else "Platform Settings & Data Protection",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
        }

        // Branding & Tax Settings
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = GymDarkCard),
                shape = RoundedCornerShape(14.dp),
                border = BorderStroke(1.dp, GymDarkBorder)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(text = "ORGANIZATION BRANDING & TAX", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = GymAccentPurple)
                    Spacer(modifier = Modifier.height(10.dp))

                    OutlinedTextField(
                        value = gymName,
                        onValueChange = { gymName = it },
                        label = { Text("Organization Name", fontSize = 11.sp) },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp),
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = GymAccentPurple, unfocusedBorderColor = GymDarkBorder, focusedTextColor = Color.White, unfocusedTextColor = Color.White)
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = gstin,
                        onValueChange = { gstin = it },
                        label = { Text("GSTIN Tax ID", fontSize = 11.sp) },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp),
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = GymAccentPurple, unfocusedBorderColor = GymDarkBorder, focusedTextColor = Color.White, unfocusedTextColor = Color.White)
                    )
                }
            }
        }

        // Security Policies
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = GymDarkCard),
                shape = RoundedCornerShape(14.dp),
                border = BorderStroke(1.dp, GymDarkBorder)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(text = "SECURITY POLICIES", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = GymSecondary)
                    Spacer(modifier = Modifier.height(10.dp))

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Column {
                            Text(text = "Enforce 2-Factor Authentication (2FA)", fontSize = 13.sp, color = Color.White)
                            Text(text = "Mandatory OTP / Authenticator for all Admins", fontSize = 11.sp, color = GymTextSecondaryDark)
                        }
                        Switch(
                            checked = twoFactorAuth,
                            onCheckedChange = { twoFactorAuth = it },
                            colors = SwitchDefaults.colors(checkedThumbColor = GymSecondary, checkedTrackColor = GymSecondaryContainer)
                        )
                    }
                }
            }
        }

        // Database Backup & Recovery Actions
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = GymDarkCard),
                shape = RoundedCornerShape(14.dp),
                border = BorderStroke(1.dp, GymPrimary.copy(alpha = 0.3f))
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(text = "AUTOMATIC CLOUD BACKUP & RESTORE", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = GymPrimary)
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(text = "Last automated cloud snapshot: Today at 04:00 AM (Retained for 90 days)", fontSize = 11.sp, color = GymTextSecondaryDark)

                    Spacer(modifier = Modifier.height(14.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Button(
                            onClick = onBackupExport,
                            colors = ButtonDefaults.buttonColors(containerColor = GymPrimary, contentColor = Color.Black),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Default.CloudDownload, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Export Backup", fontWeight = FontWeight.Bold, fontSize = 11.sp)
                        }
                        OutlinedButton(
                            onClick = onRestore,
                            border = BorderStroke(1.dp, GymSecondary),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Default.Restore, contentDescription = null, tint = GymSecondary, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Restore Point", color = GymSecondary, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                        }
                    }
                }
            }
        }
    }
}
