package com.example.ui.components

import androidx.compose.animation.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.example.model.*
import com.example.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GymTopAppBar(
    currentRole: UserRole,
    onRoleSelected: (UserRole) -> Unit,
    selectedBranch: Branch,
    branches: List<Branch>,
    onBranchSelected: (Branch) -> Unit,
    currentLanguage: String,
    onLanguageToggle: () -> Unit,
    onNotificationClick: () -> Unit
) {
    var showRoleMenu by remember { mutableStateOf(false) }
    var showBranchMenu by remember { mutableStateOf(false) }

    Surface(
        color = GymDarkSurface,
        modifier = Modifier.fillMaxWidth(),
        border = BorderStroke(1.dp, GymDarkBorder)
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Brand logo & title
                Row(verticalAlignment = Alignment.CenterVertically) {
                    com.example.ui.auth.FitHubLogo(fontSize = 22)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = if (currentLanguage == "hi") "• फिटनेस इकोसिस्टम" else "• Fitness Ecosystem",
                        fontSize = 11.sp,
                        color = FitHubTextSecondary
                    )
                }

                // Controls: Language toggle & Role Switcher
                Row(verticalAlignment = Alignment.CenterVertically) {
                    // Language Switcher
                    OutlinedButton(
                        onClick = onLanguageToggle,
                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                        shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.outlinedButtonColors(
                            contentColor = GymSecondary
                        ),
                        border = BorderStroke(1.dp, GymDarkBorder),
                        modifier = Modifier.height(34.dp)
                    ) {
                        Text(
                            text = if (currentLanguage == "en") "हिन्दी" else "EN",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Spacer(modifier = Modifier.width(8.dp))

                    // Notifications
                    IconButton(
                        onClick = onNotificationClick,
                        modifier = Modifier.size(36.dp)
                    ) {
                        BadgedBox(
                            badge = {
                                Badge(containerColor = GymPrimary, contentColor = Color.Black) {
                                    Text("3", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        ) {
                            Icon(
                                imageVector = Icons.Default.Notifications,
                                contentDescription = "Notifications",
                                tint = Color.White,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Sub-row: Active Role & Branch selector pills
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Role Picker Pill
                Box {
                    Surface(
                        color = when (currentRole) {
                            UserRole.SUPER_ADMIN -> Color(0xFF3B1E54)
                            UserRole.BRANCH_ADMIN -> Color(0xFF1B3B36)
                            UserRole.MEMBER -> Color(0xFF263300)
                        },
                        shape = RoundedCornerShape(20.dp),
                        border = BorderStroke(
                            1.dp,
                            when (currentRole) {
                                UserRole.SUPER_ADMIN -> GymAccentPurple
                                UserRole.BRANCH_ADMIN -> GymSecondary
                                UserRole.MEMBER -> GymPrimary
                            }
                        ),
                        modifier = Modifier.clickable { showRoleMenu = true }
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
                        ) {
                            Icon(
                                imageVector = when (currentRole) {
                                    UserRole.SUPER_ADMIN -> Icons.Default.Shield
                                    UserRole.BRANCH_ADMIN -> Icons.Default.AdminPanelSettings
                                    UserRole.MEMBER -> Icons.Default.Person
                                },
                                contentDescription = null,
                                tint = when (currentRole) {
                                    UserRole.SUPER_ADMIN -> GymAccentPurple
                                    UserRole.BRANCH_ADMIN -> GymSecondary
                                    UserRole.MEMBER -> GymPrimary
                                },
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = if (currentLanguage == "hi") currentRole.displayNameHi else currentRole.displayNameEn,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                            Icon(
                                imageVector = Icons.Default.ArrowDropDown,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }

                    DropdownMenu(
                        expanded = showRoleMenu,
                        onDismissRequest = { showRoleMenu = false },
                        modifier = Modifier.background(GymDarkCard)
                    ) {
                        UserRole.values().forEach { role ->
                            DropdownMenuItem(
                                text = {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(
                                            imageVector = when (role) {
                                                UserRole.SUPER_ADMIN -> Icons.Default.Shield
                                                UserRole.BRANCH_ADMIN -> Icons.Default.AdminPanelSettings
                                                UserRole.MEMBER -> Icons.Default.Person
                                            },
                                            contentDescription = null,
                                            tint = if (role == currentRole) GymPrimary else GymTextSecondaryDark,
                                            modifier = Modifier.size(18.dp)
                                        )
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text(
                                            text = if (currentLanguage == "hi") role.displayNameHi else role.displayNameEn,
                                            color = if (role == currentRole) GymPrimary else Color.White,
                                            fontWeight = if (role == currentRole) FontWeight.Bold else FontWeight.Normal
                                        )
                                    }
                                },
                                onClick = {
                                    onRoleSelected(role)
                                    showRoleMenu = false
                                }
                            )
                        }
                    }
                }

                // Branch Picker Pill
                Box {
                    Surface(
                        color = GymDarkCard,
                        shape = RoundedCornerShape(20.dp),
                        border = BorderStroke(1.dp, GymDarkBorder),
                        modifier = Modifier.clickable { showBranchMenu = true }
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.LocationOn,
                                contentDescription = null,
                                tint = GymSecondary,
                                modifier = Modifier.size(14.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = selectedBranch.name.replace("IronPulse ", ""),
                                fontSize = 11.sp,
                                color = GymTextPrimaryDark,
                                maxLines = 1
                            )
                            Icon(
                                imageVector = Icons.Default.ArrowDropDown,
                                contentDescription = null,
                                tint = GymTextSecondaryDark,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }

                    DropdownMenu(
                        expanded = showBranchMenu,
                        onDismissRequest = { showBranchMenu = false },
                        modifier = Modifier.background(GymDarkCard)
                    ) {
                        branches.forEach { branch ->
                            DropdownMenuItem(
                                text = {
                                    Column {
                                        Text(
                                            text = branch.name,
                                            color = if (branch.id == selectedBranch.id) GymSecondary else Color.White,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 13.sp
                                        )
                                        Text(
                                            text = "${branch.city} • ${branch.activeMembers} Members",
                                            fontSize = 11.sp,
                                            color = GymTextSecondaryDark
                                        )
                                    }
                                },
                                onClick = {
                                    onBranchSelected(branch)
                                    showBranchMenu = false
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun StatMetricCard(
    title: String,
    value: String,
    subtext: String,
    icon: ImageVector,
    accentColor: Color,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
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
                Text(
                    text = title,
                    fontSize = 12.sp,
                    color = GymTextSecondaryDark,
                    fontWeight = FontWeight.Medium
                )
                Box(
                    modifier = Modifier
                        .size(30.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(accentColor.copy(alpha = 0.15f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        tint = accentColor,
                        modifier = Modifier.size(16.dp)
                    )
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = value,
                fontSize = 20.sp,
                fontWeight = FontWeight.Black,
                color = Color.White
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = subtext,
                fontSize = 11.sp,
                color = accentColor,
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}

@Composable
fun StatusBadge(status: MemberStatus, language: String) {
    val (bgColor, textColor, label) = when (status) {
        MemberStatus.ACTIVE -> Triple(
            GymSuccess.copy(alpha = 0.15f),
            GymSuccess,
            if (language == "hi") MemberStatus.ACTIVE.labelHi else MemberStatus.ACTIVE.labelEn
        )
        MemberStatus.EXPIRED -> Triple(
            GymError.copy(alpha = 0.15f),
            GymError,
            if (language == "hi") MemberStatus.EXPIRED.labelHi else MemberStatus.EXPIRED.labelEn
        )
        MemberStatus.FROZEN -> Triple(
            GymSecondary.copy(alpha = 0.15f),
            GymSecondary,
            if (language == "hi") MemberStatus.FROZEN.labelHi else MemberStatus.FROZEN.labelEn
        )
        MemberStatus.PENDING -> Triple(
            GymWarning.copy(alpha = 0.15f),
            GymWarning,
            if (language == "hi") MemberStatus.PENDING.labelHi else MemberStatus.PENDING.labelEn
        )
    }

    Surface(
        color = bgColor,
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, textColor.copy(alpha = 0.4f))
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(6.dp)
                    .clip(CircleShape)
                    .background(textColor)
            )
            Spacer(modifier = Modifier.width(5.dp))
            Text(
                text = label,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = textColor
            )
        }
    }
}

@Composable
fun PersonalQrCard(
    member: Member,
    isCheckedIn: Boolean,
    onScanToggle: () -> Unit,
    language: String
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = GymDarkCard),
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, if (isCheckedIn) GymSuccess else GymPrimary)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = if (language == "hi") "व्यक्तिगत क्यूआर पास" else "DIGITAL ACCESS PASS",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = GymTextSecondaryDark,
                        letterSpacing = 1.sp
                    )
                    Text(
                        text = member.name,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Black,
                        color = Color.White
                    )
                }
                Surface(
                    color = if (isCheckedIn) GymSuccess.copy(alpha = 0.2f) else GymDarkBg,
                    shape = RoundedCornerShape(8.dp),
                    border = BorderStroke(1.dp, if (isCheckedIn) GymSuccess else GymDarkBorder)
                ) {
                    Text(
                        text = if (isCheckedIn) (if (language == "hi") "जिम में उपस्थित" else "IN GYM") else (if (language == "hi") "बाहर" else "OUT"),
                        color = if (isCheckedIn) GymSuccess else GymTextSecondaryDark,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Visual QR Representation
            Surface(
                color = Color.White,
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.size(160.dp)
            ) {
                Box(
                    modifier = Modifier.fillMaxSize().padding(12.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            imageVector = Icons.Default.QrCode,
                            contentDescription = "QR Code",
                            tint = Color.Black,
                            modifier = Modifier.size(110.dp)
                        )
                        Text(
                            text = member.id,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Black,
                            color = Color.Black
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            Text(
                text = if (language == "hi") "गेट टर्नस्टाइल स्कैनर पर यह कोड दिखाएं" else "Scan at turnstile scanner for automatic gate unlock",
                fontSize = 11.sp,
                color = GymTextSecondaryDark,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(12.dp))

            Button(
                onClick = onScanToggle,
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (isCheckedIn) GymError else GymPrimary,
                    contentColor = if (isCheckedIn) Color.White else Color.Black
                ),
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(
                    imageVector = if (isCheckedIn) Icons.Default.ExitToApp else Icons.Default.QrCodeScanner,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = if (isCheckedIn) {
                        if (language == "hi") "चेक-आउट करें (बाहर निकलें)" else "Simulate Turnstile Check-Out"
                    } else {
                        if (language == "hi") "चेक-इन करें (प्रवेश करें)" else "Simulate Turnstile Check-In"
                    },
                    fontWeight = FontWeight.Bold,
                    fontSize = 13.sp
                )
            }
        }
    }
}

@Composable
fun InvoiceDialog(
    payment: PaymentRecord,
    onDismiss: () -> Unit,
    language: String
) {
    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            colors = CardDefaults.cardColors(containerColor = GymDarkSurface),
            shape = RoundedCornerShape(16.dp),
            border = BorderStroke(1.dp, GymDarkBorder)
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "IRONPULSE FITNESS",
                            fontWeight = FontWeight.Black,
                            fontSize = 16.sp,
                            color = GymPrimary
                        )
                        Text(
                            text = "GSTIN: 27AABCI8912P1ZS",
                            fontSize = 10.sp,
                            color = GymTextSecondaryDark
                        )
                    }
                    Surface(
                        color = GymSuccess.copy(alpha = 0.2f),
                        shape = RoundedCornerShape(6.dp)
                    ) {
                        Text(
                            text = "PAID",
                            color = GymSuccess,
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))
                HorizontalDivider(color = GymDarkBorder)
                Spacer(modifier = Modifier.height(14.dp))

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(text = "Invoice #:", fontSize = 12.sp, color = GymTextSecondaryDark)
                    Text(text = payment.invoiceNumber, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White)
                }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(text = "Date:", fontSize = 12.sp, color = GymTextSecondaryDark)
                    Text(text = payment.date, fontSize = 12.sp, color = Color.White)
                }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(text = "Billed To:", fontSize = 12.sp, color = GymTextSecondaryDark)
                    Text(text = payment.memberName, fontSize = 12.sp, color = Color.White)
                }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(text = "Payment Mode:", fontSize = 12.sp, color = GymTextSecondaryDark)
                    Text(text = payment.paymentMethod, fontSize = 12.sp, color = GymSecondary)
                }

                Spacer(modifier = Modifier.height(14.dp))
                HorizontalDivider(color = GymDarkBorder)
                Spacer(modifier = Modifier.height(14.dp))

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(text = payment.planName, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color.White)
                    Text(text = "₹${String.format("%.2f", payment.baseAmount)}", fontSize = 13.sp, color = Color.White)
                }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(text = "GST (18%):", fontSize = 12.sp, color = GymTextSecondaryDark)
                    Text(text = "₹${String.format("%.2f", payment.gstAmount)}", fontSize = 12.sp, color = GymTextSecondaryDark)
                }
                if (payment.discountAmount > 0) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(text = "Discount:", fontSize = 12.sp, color = GymSuccess)
                        Text(text = "-₹${String.format("%.2f", payment.discountAmount)}", fontSize = 12.sp, color = GymSuccess)
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))
                HorizontalDivider(color = GymDarkBorder)
                Spacer(modifier = Modifier.height(10.dp))

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(text = "Total Paid:", fontSize = 15.sp, fontWeight = FontWeight.Black, color = Color.White)
                    Text(text = "₹${String.format("%.2f", payment.totalAmount)}", fontSize = 16.sp, fontWeight = FontWeight.Black, color = GymPrimary)
                }

                Spacer(modifier = Modifier.height(18.dp))

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedButton(
                        onClick = onDismiss,
                        modifier = Modifier.weight(1f),
                        border = BorderStroke(1.dp, GymDarkBorder)
                    ) {
                        Text("Close", color = Color.White)
                    }
                    Button(
                        onClick = onDismiss,
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = GymPrimary, contentColor = Color.Black)
                    ) {
                        Icon(imageVector = Icons.Default.Download, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Receipt PDF", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    }
                }
            }
        }
    }
}
