package com.example.data

import android.content.Context
import com.example.data.db.*
import com.example.model.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class GymRepository {

    private var database: FitHubDatabase? = null

    fun initializeRoom(context: Context, scope: CoroutineScope) {
        if (database != null) return
        val db = FitHubDatabase.getInstance(context)
        database = db
        scope.launch(Dispatchers.IO) {
            // Seed initial users
            db.userDao().insertAllUsers(
                listOf(
                    UserEntity("USR-01", "member@fithub.com", "+91 98765 43210", "MEMBER", "Member", "BR-01"),
                    UserEntity("USR-02", "admin@downtown.fithub.com", "+91 98200 11223", "BRANCH_ADMIN", "Vikram Malhotra", "BR-01"),
                    UserEntity("USR-03", "platform@fithub.com", "+91 99999 00000", "SUPER_ADMIN", "Super Admin", "ALL")
                )
            )

            // Seed initial members into Room
            val memberEntities = _members.value.map { m ->
                MemberEntity(
                    id = m.id,
                    userId = "USR-${m.id}",
                    name = m.name,
                    email = m.email,
                    phone = m.phone,
                    branchId = m.branchId,
                    branchName = m.branchName,
                    planName = m.planName,
                    status = m.status.name,
                    startDate = m.startDate,
                    expiryDate = m.expiryDate,
                    remainingDays = m.remainingDays,
                    trainerName = m.trainerName,
                    balanceDue = m.balanceDue,
                    lockerNumber = m.lockerNumber,
                    qrToken = m.qrToken,
                    attendanceStreak = m.attendanceStreak,
                    bloodGroup = m.bloodGroup,
                    emergencyContact = m.emergencyContact,
                    heightCm = m.heightCm,
                    weightKg = m.weightKg,
                    fitnessGoal = m.fitnessGoal,
                    medicalNotes = m.medicalNotes
                )
            }
            db.memberDao().insertAllMembers(memberEntities)

            // Seed initial attendance records into Room
            val attendanceEntities = _attendanceRecords.value.map { att ->
                AttendanceEntity(
                    id = att.id,
                    memberId = att.memberId,
                    memberName = att.memberName,
                    branchId = att.branchId,
                    branchName = att.branchName,
                    checkInTime = att.checkInTime,
                    checkOutTime = att.checkOutTime,
                    date = att.date,
                    method = att.method,
                    status = att.status
                )
            }
            db.attendanceDao().insertAllAttendance(attendanceEntities)
        }
    }

    // Language selection: "en" or "hi"
    private val _currentLanguage = MutableStateFlow("en")
    val currentLanguage: StateFlow<String> = _currentLanguage.asStateFlow()

    // Active Role Switcher
    private val _currentRole = MutableStateFlow(UserRole.MEMBER)
    val currentRole: StateFlow<UserRole> = _currentRole.asStateFlow()

    // Multi-branch state
    private val _branches = MutableStateFlow(listOf(
        Branch("BR-01", "IronPulse Downtown Central", "Mumbai", "Plot 14, MG Road, Nariman Point", "+91 98200 11223", 420, 38, 75, 485000.0, "Vikram Malhotra"),
        Branch("BR-02", "IronPulse Westside Pro", "Pune", "Level 3, Amanora Town Centre", "+91 98200 44556", 295, 24, 60, 340000.0, "Anjali Sharma"),
        Branch("BR-03", "IronPulse Metro Flagship", "Bengaluru", "88, 100ft Road, Indiranagar", "+91 98200 77889", 580, 52, 90, 690000.0, "Sameer Deshmukh")
    ))
    val branches: StateFlow<List<Branch>> = _branches.asStateFlow()

    private val _selectedBranch = MutableStateFlow(_branches.value[0])
    val selectedBranch: StateFlow<Branch> = _selectedBranch.asStateFlow()

    // Currently logged-in member
    // A newly registered Member account starts with clean real-user data.
    private val _currentMember = MutableStateFlow(
        Member(
            id = "MEM-USER-01",
            name = "Member",
            email = "member@fithub.com",
            phone = "",
            dob = "",
            gender = "",
            bloodGroup = "",
            emergencyContact = "",
            heightCm = 0.0,
            weightKg = 0.0,
            fitnessGoal = "",
            joiningDate = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date()),
            planId = "",
            planName = "No active membership",
            branchId = "BR-01",
            branchName = "FitHub Downtown Central",
            status = MemberStatus.PENDING,
            startDate = "",
            expiryDate = "None",
            remainingDays = 0,
            trainerId = "",
            trainerName = "No trainer assigned",
            balanceDue = 0.0,
            lockerNumber = "None",
            qrToken = "",
            attendanceStreak = 0,
            medicalNotes = ""
        )
    )
    val currentMember: StateFlow<Member> = _currentMember.asStateFlow()

    // All members for Admin
    private val _members = MutableStateFlow(listOf(
        _currentMember.value,
        Member(
            id = "MEM-8822",
            name = "Rhea Kapoor",
            email = "rhea.k@example.com",
            phone = "+91 98111 22334",
            dob = "1999-04-20",
            gender = "Female",
            bloodGroup = "B+",
            emergencyContact = "+91 98111 99999",
            heightCm = 165.0,
            weightKg = 58.0,
            fitnessGoal = "Endurance & Agility",
            joiningDate = "2026-02-10",
            planId = "PLAN-QUARTERLY",
            planName = "Gold Quarterly",
            branchId = "BR-01",
            branchName = "FitHub Downtown Central",
            status = MemberStatus.ACTIVE,
            startDate = "2026-02-10",
            expiryDate = "2026-05-10",
            remainingDays = 12,
            trainerId = "TRN-02",
            trainerName = "Pooja Hegde (Yoga/HIIT)",
            balanceDue = 1200.0,
            lockerNumber = "L-19",
            qrToken = "FITHUB-QR-MEM8822",
            attendanceStreak = 14
        ),
        Member(
            id = "MEM-8823",
            name = "Aman Verma",
            email = "aman.v@example.com",
            phone = "+91 97222 33445",
            dob = "1994-11-03",
            gender = "Male",
            bloodGroup = "A+",
            emergencyContact = "+91 97222 88888",
            heightCm = 182.0,
            weightKg = 92.0,
            fitnessGoal = "Strength & Powerlifting",
            joiningDate = "2025-06-15",
            planId = "PLAN-MONTHLY",
            planName = "Silver Monthly",
            branchId = "BR-01",
            branchName = "FitHub Downtown Central",
            status = MemberStatus.EXPIRED,
            startDate = "2026-08-01",
            expiryDate = "2026-08-31",
            remainingDays = 0,
            trainerId = "TRN-01",
            trainerName = "Coach Kabir Sen",
            balanceDue = 3500.0,
            lockerNumber = "L-08",
            qrToken = "FITHUB-QR-MEM8823",
            attendanceStreak = 0
        )
    ))
    val members: StateFlow<List<Member>> = _members.asStateFlow()

    // Membership Plans
    private val _plans = MutableStateFlow(listOf(
        MembershipPlan("PLAN-MONTHLY", "Silver 1-Month", 1, 2999.0, 500.0, 18.0, 0, 0, listOf("Gym Floor", "Cardio Area"), false, "Standard month-to-month gym access."),
        MembershipPlan("PLAN-QUARTERLY", "Gold 3-Months", 3, 7499.0, 500.0, 18.0, 7, 2, listOf("Gym Floor", "Cardio Area", "Yoga", "Steam"), false, "Includes steam bath & 2 free PT sessions."),
        MembershipPlan("PLAN-HALF-YEARLY", "Platinum 6-Months", 6, 12999.0, 0.0, 18.0, 15, 6, listOf("Full Access", "Zumba", "HIIT", "Steam"), false, "Zero joining fee + 15 days freeze."),
        MembershipPlan("PLAN-YEARLY", "Elite 12-Month Pro + PT", 12, 21999.0, 0.0, 18.0, 30, 12, listOf("Full Access", "CrossFit", "Zumba", "Yoga", "All Classes", "Sauna"), true, "Multi-branch passport + 12 PT sessions + 30 days freeze.")
    ))
    val plans: StateFlow<List<MembershipPlan>> = _plans.asStateFlow()

    // Today's Workout (Default: No assigned workout for new members)
    private val _todayWorkout = MutableStateFlow(
        WorkoutDay(
            id = "WOD-NONE",
            title = "No workout assigned yet",
            dayOfWeek = "",
            trainerNotes = "Your trainer has not assigned a workout yet.",
            exercises = emptyList()
        )
    )
    val todayWorkout: StateFlow<WorkoutDay> = _todayWorkout.asStateFlow()

    // Diet Plan (Default: No assigned diet for new members)
    private val _dietPlan = MutableStateFlow(
        DietPlan(
            id = "DIET-NONE",
            targetCalories = 0,
            targetProteinG = 0,
            targetCarbsG = 0,
            targetFatG = 0,
            waterTargetMl = 0,
            waterConsumedMl = 0,
            meals = emptyList(),
            notes = "No diet assigned yet."
        )
    )
    val dietPlan: StateFlow<DietPlan> = _dietPlan.asStateFlow()

    // Attendance Records (Default: Empty for new members)
    private val _attendanceRecords = MutableStateFlow<List<AttendanceRecord>>(emptyList())
    val attendanceRecords: StateFlow<List<AttendanceRecord>> = _attendanceRecords.asStateFlow()

    // Today's check-in status for current member
    private val _isMemberCheckedInToday = MutableStateFlow(false)
    val isMemberCheckedInToday: StateFlow<Boolean> = _isMemberCheckedInToday.asStateFlow()

    // Payments (Default: Empty for new members)
    private val _payments = MutableStateFlow<List<PaymentRecord>>(emptyList())
    val payments: StateFlow<List<PaymentRecord>> = _payments.asStateFlow()

    // Group Classes (Default: none booked)
    private val _groupClasses = MutableStateFlow(listOf(
        GroupClass("CLS-01", "Power Vinyasa Yoga", "Yoga", "Pooja Hegde", "06:30 AM", 60, "Studio A", "BR-01", 20, 16, false),
        GroupClass("CLS-02", "High-Octane CrossFit", "CrossFit", "Coach Kabir Sen", "07:30 AM", 50, "Box Arena", "BR-01", 15, 14, false),
        GroupClass("CLS-03", "Zumba Dance Carnival", "Zumba", "Simran D'Souza", "06:00 PM", 60, "Studio B", "BR-01", 25, 18, false),
        GroupClass("CLS-04", "HIIT Metabolic Burn", "HIIT", "Arjun Rao", "07:15 PM", 45, "Functional Turf", "BR-01", 18, 12, false)
    ))
    val groupClasses: StateFlow<List<GroupClass>> = _groupClasses.asStateFlow()

    // Trainers
    private val _trainers = MutableStateFlow(listOf(
        Trainer("TRN-01", "Kabir Sen", "Strength & Conditioning / Hypertrophy", 8, 4.9, "+91 98200 99001", "kabir@ironpulse.com", 28, 45000.0, 20.0, "BR-01"),
        Trainer("TRN-02", "Pooja Hegde", "Yoga, Mobility & Flexibility", 6, 4.8, "+91 98200 99002", "pooja@ironpulse.com", 22, 38000.0, 15.0, "BR-01"),
        Trainer("TRN-03", "Arjun Rao", "Functional Movement & CrossFit", 5, 4.7, "+91 98200 99003", "arjun@ironpulse.com", 19, 36000.0, 15.0, "BR-02")
    ))
    val trainers: StateFlow<List<Trainer>> = _trainers.asStateFlow()

    // Inventory
    private val _inventory = MutableStateFlow(listOf(
        InventoryItem("INV-01", "Gold Standard Whey Protein (2kg)", "Supplements", 18, 5, 6200.0, 4800.0, "Optimum Nutrition Direct"),
        InventoryItem("INV-02", "Creatine Monohydrate 250g", "Supplements", 24, 8, 1199.0, 750.0, "MuscleBlaze India"),
        InventoryItem("INV-03", "IronPulse Athletic Dri-Fit Tee", "Apparel", 45, 10, 899.0, 380.0, "Vanguard Garments"),
        InventoryItem("INV-04", "Pro Lifting Wrist Wraps + Straps", "Accessories", 6, 8, 749.0, 320.0, "Kobo Sports"),
        InventoryItem("INV-05", "Electrolyte Hydration Shaker 700ml", "Accessories", 32, 12, 499.0, 180.0, "BlenderBottle Co.")
    ))
    val inventory: StateFlow<List<InventoryItem>> = _inventory.asStateFlow()

    // CRM Leads
    private val _leads = MutableStateFlow(listOf(
        MarketingLead("LD-01", "Rohit Deshmukh", "+91 98450 11223", "Instagram Ad", "TRIAL_BOOKED", "Gold 3-Months", "2026-10-04", "Interested in evening CrossFit."),
        MarketingLead("LD-02", "Natasha Patel", "+91 98450 44556", "Referral", "NEW", "Elite 12-Month Pro", "2026-10-03", "Referred by member."),
        MarketingLead("LD-03", "Karan Johar", "+91 98450 77889", "Walk-in", "CONTACTED", "Silver 1-Month", "2026-10-02", "Price conscious, wants corporate discount.")
    ))
    val leads: StateFlow<List<MarketingLead>> = _leads.asStateFlow()

    // Support Tickets
    private val _tickets = MutableStateFlow(listOf(
        SupportTicket("TCK-101", "MEM-8822", "Rhea Kapoor", "Equipment", "Cable crossover machine right pulley squeaking", "Right side cable on pulley station #2 needs lubrication or bearing check.", "Medium", "In Progress", "2026-10-03 11:20 AM", "Maintenance technician scheduled today at 2 PM."),
        SupportTicket("TCK-102", "MEM-8822", "Rhea Kapoor", "Payment", "Receipt copy request for tax reimbursement", "Please provide duplicate stamped receipt for Q3 corporate health allowance.", "Low", "Resolved", "2026-10-01 04:15 PM", "Invoice sent via email with stamp.")
    ))
    val tickets: StateFlow<List<SupportTicket>> = _tickets.asStateFlow()

    // Admin Staff
    private val _staffList = MutableStateFlow(listOf(
        AdminStaff("STF-01", "Vikram Malhotra", "vikram@ironpulse.com", "BR-01", "Downtown Central", "Branch Manager", canMembers = true, canPayments = true, canExpenses = true, canReports = true, canDeleteMember = false, canSettings = false, "Today 08:00 AM"),
        AdminStaff("STF-02", "Anjali Sharma", "anjali@ironpulse.com", "BR-02", "Westside Pro", "Branch Manager", canMembers = true, canPayments = true, canExpenses = true, canReports = true, canDeleteMember = false, canSettings = false, "Yesterday 06:45 PM"),
        AdminStaff("STF-03", "Kavita Rao", "kavita@ironpulse.com", "BR-01", "Downtown Central", "Front Desk Executive", canMembers = true, canPayments = true, canExpenses = false, canReports = false, canDeleteMember = false, canSettings = false, "Today 07:10 AM")
    ))
    val staffList: StateFlow<List<AdminStaff>> = _staffList.asStateFlow()

    // Audit Logs
    private val _auditLogs = MutableStateFlow(listOf(
        AuditLog("LOG-01", "Vikram Malhotra", "Branch Admin", "Checked-in Member", "Member: Rhea Kapoor", "Check-in via biometric/QR gate at Downtown Central", "Today 07:15 AM"),
        AuditLog("LOG-02", "Vikram Malhotra", "Branch Admin", "Updated Member Plan", "Member: Rhea Kapoor", "Extended Gold plan expiry by 7 freeze bonus days", "Yesterday 04:30 PM"),
        AuditLog("LOG-03", "System Automator", "System", "Auto Renewal Reminder", "Campaign: Expiry-7-Days", "Dispatched 14 WhatsApp expiry notifications", "Yesterday 09:00 AM"),
        AuditLog("LOG-04", "Super Admin", "Super Admin", "Role Permission Updated", "Staff: Kavita Rao", "Granted payment recording rights", "2026-10-01 10:15 AM")
    ))
    val auditLogs: StateFlow<List<AuditLog>> = _auditLogs.asStateFlow()

    // Progress History (Default: Empty for new members)
    private val _fitnessProgress = MutableStateFlow<List<FitnessProgressEntry>>(emptyList())
    val fitnessProgress: StateFlow<List<FitnessProgressEntry>> = _fitnessProgress.asStateFlow()

    // Expenses (Admin Accounting)
    private val _expenses = MutableStateFlow(listOf(
        Pair("Rent & Property Lease", 165000.0),
        Pair("Electricity & Air Conditioning", 48000.0),
        Pair("Trainer & Staff Salaries", 145000.0),
        Pair("Equipment Maintenance & Sanitization", 16500.0),
        Pair("Marketing & Digital Ads", 22000.0)
    ))
    val expenses: StateFlow<List<Pair<String, Double>>> = _expenses.asStateFlow()

    // ---------------- Actions ----------------

    fun assignMembership(plan: MembershipPlan) {
        val expiry = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date(System.currentTimeMillis() + plan.durationMonths * 30L * 86400000L))
        _currentMember.value = _currentMember.value.copy(
            planId = plan.id,
            planName = plan.name,
            status = MemberStatus.ACTIVE,
            remainingDays = plan.durationMonths * 30,
            expiryDate = expiry
        )
        val payment = PaymentRecord(
            id = "PAY-${System.currentTimeMillis() % 10000}",
            invoiceNumber = "INV-${System.currentTimeMillis() % 100000}",
            memberId = _currentMember.value.id,
            memberName = _currentMember.value.name,
            branchId = _currentMember.value.branchId,
            planName = plan.name,
            baseAmount = plan.price,
            gstAmount = plan.price * (plan.gstPercent / 100.0),
            discountAmount = 0.0,
            totalAmount = plan.price * (1.0 + plan.gstPercent / 100.0),
            paymentMethod = "Online UPI",
            transactionRef = "TXN-${System.currentTimeMillis()}",
            date = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date()),
            status = "PAID"
        )
        _payments.value = listOf(payment) + _payments.value
    }

    fun assignSampleWorkout() {
        _todayWorkout.value = WorkoutDay(
            id = "WOD-01",
            title = "Foundation Push & Core",
            dayOfWeek = "Active",
            trainerNotes = "Focus on form and controlled movements.",
            exercises = listOf(
                Exercise("EX-01", "Dumbbell Bench Press", 3, "10-12 reps", 15.0, 60, "Full range of motion", "Chest", false),
                Exercise("EX-02", "Incline Push-Ups", 3, "12 reps", 0.0, 60, "Keep core tight", "Chest", false),
                Exercise("EX-03", "Tricep Overhead Extension", 3, "12 reps", 10.0, 45, "Controlled tempo", "Triceps", false)
            )
        )
        _currentMember.value = _currentMember.value.copy(trainerName = "Coach Kabir Sen")
    }

    fun assignSampleDiet() {
        _dietPlan.value = DietPlan(
            id = "DIET-01",
            targetCalories = 2200,
            targetProteinG = 140,
            targetCarbsG = 210,
            targetFatG = 60,
            waterTargetMl = 3000,
            waterConsumedMl = 1250,
            meals = listOf(
                MealItem("M-01", "Breakfast", "Oatmeal with Almond Milk & Protein", 450, 30, 55, 10, "08:30 AM", true),
                MealItem("M-02", "Lunch", "Grilled Paneer/Chicken + Rice + Veggies", 650, 45, 65, 15, "01:30 PM", false)
            )
        )
    }

    fun logFitnessProgress(weightKg: Double, bmi: Double, notes: String) {
        val dateStr = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
        val record = FitnessProgressEntry(
            id = "FP-${System.currentTimeMillis() % 10000}",
            date = dateStr,
            weightKg = weightKg,
            bodyFatPercent = 0.0,
            bmi = bmi,
            chestCm = 0.0,
            armsCm = 0.0,
            waistCm = 0.0,
            thighsCm = 0.0,
            benchPressMaxKg = 0.0,
            squatMaxKg = 0.0,
            deadliftMaxKg = 0.0,
            notes = notes
        )
        _fitnessProgress.value = listOf(record) + _fitnessProgress.value
        _currentMember.value = _currentMember.value.copy(weightKg = weightKg)
    }

    fun resetToCleanNewMember() {
        _currentMember.value = Member(
            id = "MEM-USER-01",
            name = "Member",
            email = "member@fithub.com",
            phone = "",
            dob = "",
            gender = "",
            bloodGroup = "",
            emergencyContact = "",
            heightCm = 0.0,
            weightKg = 0.0,
            fitnessGoal = "",
            joiningDate = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date()),
            planId = "",
            planName = "No active membership",
            branchId = "BR-01",
            branchName = "FitHub Downtown Central",
            status = MemberStatus.PENDING,
            startDate = "",
            expiryDate = "None",
            remainingDays = 0,
            trainerId = "",
            trainerName = "No trainer assigned",
            balanceDue = 0.0,
            lockerNumber = "None",
            qrToken = "",
            attendanceStreak = 0,
            medicalNotes = ""
        )
        _todayWorkout.value = WorkoutDay("WOD-NONE", "No workout assigned yet", "", "Your trainer has not assigned a workout yet.", emptyList())
        _dietPlan.value = DietPlan("DIET-NONE", 0, 0, 0, 0, 0, 0, emptyList(), "No diet assigned yet.")
        _attendanceRecords.value = emptyList()
        _payments.value = emptyList()
        _fitnessProgress.value = emptyList()
        _isMemberCheckedInToday.value = false
    }

    fun loadDemoSeedForDevelopment() {
        _currentMember.value = Member(
            id = "MEM-DEMO",
            name = "Demo Member",
            email = "demo@fithub.com",
            phone = "+91 98765 43210",
            dob = "1998-05-12",
            gender = "Male",
            bloodGroup = "O+",
            emergencyContact = "+91 98765 00000",
            heightCm = 178.0,
            weightKg = 76.5,
            fitnessGoal = "Muscle Hypertrophy",
            joiningDate = "2026-01-01",
            planId = "PLAN-YEARLY",
            planName = "Elite 12-Month Pro + PT",
            branchId = "BR-01",
            branchName = "FitHub Downtown Central",
            status = MemberStatus.ACTIVE,
            startDate = "2026-01-01",
            expiryDate = "2026-12-31",
            remainingDays = 90,
            trainerId = "TRN-01",
            trainerName = "Coach Kabir Sen",
            balanceDue = 0.0,
            lockerNumber = "L-42",
            qrToken = "FITHUB-QR-DEMO",
            attendanceStreak = 7,
            medicalNotes = ""
        )
        _todayWorkout.value = WorkoutDay(
            id = "WOD-01",
            title = "Chest & Triceps Hypertrophy (Push A)",
            dayOfWeek = "Monday",
            trainerNotes = "Warm up shoulders thoroughly.",
            exercises = listOf(
                Exercise("EX-01", "Barbell Incline Bench Press", 4, "8-10 reps", 75.0, 90, "Retract scapulae, touch upper chest.", "Chest", true),
                Exercise("EX-02", "Flat Dumbbell Press", 4, "10-12 reps", 30.0, 75, "Deep stretch at bottom.", "Chest", true)
            )
        )
        _dietPlan.value = DietPlan(
            id = "DIET-01",
            targetCalories = 2450,
            targetProteinG = 165,
            targetCarbsG = 230,
            targetFatG = 65,
            waterTargetMl = 3500,
            waterConsumedMl = 2250,
            meals = listOf(
                MealItem("M-01", "Breakfast", "Oatmeal with Whey Protein & Blueberries", 520, 38, 62, 12, "08:30 AM", true),
                MealItem("M-02", "Lunch", "Grilled Chicken/Paneer + Brown Rice", 680, 52, 70, 16, "02:00 PM", true)
            )
        )
        _attendanceRecords.value = listOf(
            AttendanceRecord("ATT-101", "MEM-DEMO", "Demo Member", "BR-01", "FitHub Downtown Central", "07:15 AM", "08:45 AM", "2026-10-04", "QR Scan", "Completed")
        )
        _payments.value = listOf(
            PaymentRecord("PAY-901", "INV-2026-0042", "MEM-DEMO", "Demo Member", "BR-01", "Elite 12-Month Pro + PT", 18643.22, 3355.78, 0.0, 21999.0, "UPI", "UPI-TXN-1", "2026-01-01", "PAID")
        )
        _fitnessProgress.value = listOf(
            FitnessProgressEntry("FP-01", "2026-10-01", 76.5, 14.8, 24.1, 104.0, 39.5, 82.0, 59.0, 95.0, 125.0, 155.0, "Consistent progress.")
        )
    }

    fun setLanguage(lang: String) {
        _currentLanguage.value = lang
    }

    fun setRole(role: UserRole) {
        _currentRole.value = role
    }

    fun selectBranch(branch: Branch) {
        _selectedBranch.value = branch
    }

    fun toggleCheckInToday() {
        val nowCheckedIn = !_isMemberCheckedInToday.value
        _isMemberCheckedInToday.value = nowCheckedIn
        val timeStr = SimpleDateFormat("hh:mm a", Locale.getDefault()).format(Date())
        val dateStr = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())

        if (nowCheckedIn) {
            val newRecord = AttendanceRecord(
                id = "ATT-${System.currentTimeMillis() % 10000}",
                memberId = _currentMember.value.id,
                memberName = _currentMember.value.name,
                branchId = _selectedBranch.value.id,
                branchName = _selectedBranch.value.name,
                checkInTime = timeStr,
                checkOutTime = null,
                date = dateStr,
                method = "QR Scan",
                status = "Present"
            )
            _attendanceRecords.value = listOf(newRecord) + _attendanceRecords.value
            _currentMember.value = _currentMember.value.copy(
                attendanceStreak = _currentMember.value.attendanceStreak + 1
            )
            addAuditLog("Self Check-in", "Member: ${_currentMember.value.name}", "Personal QR scanned at turnstile ${_selectedBranch.value.name}")
        } else {
            val list = _attendanceRecords.value.toMutableList()
            val first = list.firstOrNull { it.memberId == _currentMember.value.id && it.checkOutTime == null }
            if (first != null) {
                val idx = list.indexOf(first)
                list[idx] = first.copy(checkOutTime = timeStr, status = "Completed")
                _attendanceRecords.value = list
            }
            addAuditLog("Self Check-out", "Member: ${_currentMember.value.name}", "Checked out of ${_selectedBranch.value.name}")
        }
    }

    fun toggleExercise(exerciseId: String) {
        val currentWod = _todayWorkout.value
        val updatedList = currentWod.exercises.map {
            if (it.id == exerciseId) it.copy(isCompleted = !it.isCompleted) else it
        }
        _todayWorkout.value = currentWod.copy(exercises = updatedList)
    }

    fun toggleMeal(mealId: String) {
        val currentDiet = _dietPlan.value
        val updated = currentDiet.meals.map {
            if (it.id == mealId) it.copy(isEaten = !it.isEaten) else it
        }
        _dietPlan.value = currentDiet.copy(meals = updated)
    }

    fun addWater(amountMl: Int) {
        val currentDiet = _dietPlan.value
        val newAmount = (currentDiet.waterConsumedMl + amountMl).coerceAtMost(6000)
        _dietPlan.value = currentDiet.copy(waterConsumedMl = newAmount)
    }

    fun bookClass(classId: String) {
        _groupClasses.value = _groupClasses.value.map {
            if (it.id == classId) {
                val newBooked = !it.isBookedByCurrentUser
                val countChange = if (newBooked) 1 else -1
                it.copy(
                    isBookedByCurrentUser = newBooked,
                    bookedCount = (it.bookedCount + countChange).coerceAtLeast(0)
                )
            } else it
        }
    }

    fun recordPayment(memberId: String, amount: Double, method: String, planName: String) {
        val invoiceNo = "INV-2026-${(100..999).random()}"
        val dateStr = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        val base = amount / 1.18
        val gst = amount - base
        val member = _members.value.find { it.id == memberId } ?: _currentMember.value

        val newPay = PaymentRecord(
            id = "PAY-${System.currentTimeMillis() % 10000}",
            invoiceNumber = invoiceNo,
            memberId = member.id,
            memberName = member.name,
            branchId = _selectedBranch.value.id,
            planName = planName,
            baseAmount = base,
            gstAmount = gst,
            discountAmount = 0.0,
            totalAmount = amount,
            paymentMethod = method,
            transactionRef = "TXN-${System.currentTimeMillis() % 1000000}",
            date = dateStr,
            status = "PAID"
        )
        _payments.value = listOf(newPay) + _payments.value

        // Clear member due if paid
        _members.value = _members.value.map {
            if (it.id == memberId) it.copy(balanceDue = 0.0, status = MemberStatus.ACTIVE) else it
        }
        if (_currentMember.value.id == memberId) {
            _currentMember.value = _currentMember.value.copy(balanceDue = 0.0, status = MemberStatus.ACTIVE)
        }

        addAuditLog("Payment Received", "Invoice $invoiceNo", "₹$amount collected via $method for $planName")
    }

    fun createTicket(category: String, subject: String, message: String, priority: String) {
        val timeStr = SimpleDateFormat("yyyy-MM-dd hh:mm a", Locale.getDefault()).format(Date())
        val newTicket = SupportTicket(
            id = "TCK-${(200..999).random()}",
            memberId = _currentMember.value.id,
            memberName = _currentMember.value.name,
            category = category,
            subject = subject,
            message = message,
            priority = priority,
            status = "Open",
            createdAt = timeStr
        )
        _tickets.value = listOf(newTicket) + _tickets.value
        addAuditLog("Ticket Created", "Category: $category", "Member ${_currentMember.value.name}: $subject")
    }

    fun resolveTicket(ticketId: String, note: String) {
        _tickets.value = _tickets.value.map {
            if (it.id == ticketId) it.copy(status = "Resolved", resolution = note) else it
        }
        addAuditLog("Ticket Resolved", "Ticket ID: $ticketId", "Resolution: $note")
    }

    fun addMember(member: Member) {
        _members.value = listOf(member) + _members.value
        addAuditLog("Added Member", "Member: ${member.name}", "Plan: ${member.planName} at ${member.branchName}")
    }

    fun updateMemberStatus(memberId: String, newStatus: MemberStatus) {
        _members.value = _members.value.map {
            if (it.id == memberId) it.copy(status = newStatus) else it
        }
        if (_currentMember.value.id == memberId) {
            _currentMember.value = _currentMember.value.copy(status = newStatus)
        }
        addAuditLog("Status Changed", "Member ID: $memberId", "New status: ${newStatus.name}")
    }

    fun freezeMembership(memberId: String, days: Int) {
        _members.value = _members.value.map {
            if (it.id == memberId) it.copy(status = MemberStatus.FROZEN) else it
        }
        addAuditLog("Membership Frozen", "Member ID: $memberId", "Frozen for $days days")
    }

    fun extendMembership(memberId: String, additionalDays: Int) {
        _members.value = _members.value.map {
            if (it.id == memberId) it.copy(
                remainingDays = it.remainingDays + additionalDays,
                status = MemberStatus.ACTIVE
            ) else it
        }
        addAuditLog("Membership Extended", "Member ID: $memberId", "Added $additionalDays days")
    }

    fun updateInventoryStock(itemId: String, delta: Int) {
        _inventory.value = _inventory.value.map {
            if (it.id == itemId) it.copy(stockQty = (it.stockQty + delta).coerceAtLeast(0)) else it
        }
        addAuditLog("Stock Updated", "Item ID: $itemId", "Stock adjusted by $delta units")
    }

    fun updateLeadStage(leadId: String, newStage: String) {
        _leads.value = _leads.value.map {
            if (it.id == leadId) it.copy(stage = newStage) else it
        }
        addAuditLog("Lead Stage Changed", "Lead ID: $leadId", "Moved to $newStage")
    }

    fun toggleStaffPermission(staffId: String, perm: String) {
        _staffList.value = _staffList.value.map { staff ->
            if (staff.id == staffId) {
                when (perm) {
                    "members" -> staff.copy(canMembers = !staff.canMembers)
                    "payments" -> staff.copy(canPayments = !staff.canPayments)
                    "expenses" -> staff.copy(canExpenses = !staff.canExpenses)
                    "reports" -> staff.copy(canReports = !staff.canReports)
                    "delete" -> staff.copy(canDeleteMember = !staff.canDeleteMember)
                    "settings" -> staff.copy(canSettings = !staff.canSettings)
                    else -> staff
                }
            } else staff
        }
        addAuditLog("Permission Toggle", "Staff ID: $staffId", "Updated permission: $perm")
    }

    fun addAuditLog(action: String, entity: String, details: String) {
        val timeStr = SimpleDateFormat("yyyy-MM-dd hh:mm a", Locale.getDefault()).format(Date())
        val log = AuditLog(
            id = "LOG-${(100..999).random()}",
            actorName = if (_currentRole.value == UserRole.SUPER_ADMIN) "Super Admin" else if (_currentRole.value == UserRole.BRANCH_ADMIN) "Branch Admin" else _currentMember.value.name,
            actorRole = _currentRole.value.displayNameEn,
            action = action,
            entity = entity,
            details = details,
            timestamp = timeStr
        )
        _auditLogs.value = listOf(log) + _auditLogs.value
    }
}
