package com.example.model

enum class UserRole(val displayNameEn: String, val displayNameHi: String) {
    SUPER_ADMIN("Super Admin", "सुपर एडमिन"),
    BRANCH_ADMIN("Branch Admin", "ब्रांच एडमिन"),
    MEMBER("Member", "जिम सदस्य")
}

enum class MemberStatus(val labelEn: String, val labelHi: String) {
    ACTIVE("Active", "सक्रिय"),
    EXPIRED("Expired", "समाप्त"),
    FROZEN("Frozen", "स्थगित"),
    PENDING("Pending", "लंबित")
}

data class Branch(
    val id: String,
    val name: String,
    val city: String,
    val address: String,
    val phone: String,
    val activeMembers: Int,
    val currentOccupancy: Int,
    val maxCapacity: Int,
    val monthlyRevenue: Double,
    val managerName: String
)

data class MembershipPlan(
    val id: String,
    val name: String,
    val durationMonths: Int,
    val price: Double,
    val joiningFee: Double,
    val gstPercent: Double = 18.0,
    val freezeDaysAllowed: Int = 15,
    val ptSessionsIncluded: Int = 0,
    val allowedClasses: List<String> = emptyList(),
    val multiBranchAccess: Boolean = false,
    val description: String = ""
)

data class Member(
    val id: String,
    val name: String,
    val email: String,
    val phone: String,
    val dob: String,
    val gender: String,
    val bloodGroup: String,
    val emergencyContact: String,
    val heightCm: Double,
    val weightKg: Double,
    val fitnessGoal: String,
    val joiningDate: String,
    val planId: String,
    val planName: String,
    val branchId: String,
    val branchName: String,
    val status: MemberStatus,
    val startDate: String,
    val expiryDate: String,
    val remainingDays: Int,
    val trainerId: String,
    val trainerName: String,
    val balanceDue: Double,
    val lockerNumber: String = "L-42",
    val qrToken: String,
    val attendanceStreak: Int = 5,
    val medicalNotes: String = "No known allergies or chronic conditions."
)

data class AttendanceRecord(
    val id: String,
    val memberId: String,
    val memberName: String,
    val branchId: String,
    val branchName: String,
    val checkInTime: String,
    val checkOutTime: String?,
    val date: String,
    val method: String = "QR Scan",
    val status: String = "Present"
)

data class Exercise(
    val id: String,
    val name: String,
    val sets: Int,
    val reps: String,
    val targetWeightKg: Double,
    val restSeconds: Int = 60,
    val instructions: String,
    val targetMuscle: String,
    val isCompleted: Boolean = false
)

data class WorkoutDay(
    val id: String,
    val title: String,
    val dayOfWeek: String,
    val trainerNotes: String,
    val exercises: List<Exercise>
)

data class MealItem(
    val id: String,
    val mealType: String, // Breakfast, Lunch, Dinner, Snack
    val title: String,
    val calories: Int,
    val proteinG: Int,
    val carbsG: Int,
    val fatG: Int,
    val time: String,
    val isEaten: Boolean = false
)

data class DietPlan(
    val id: String,
    val targetCalories: Int = 2400,
    val targetProteinG: Int = 160,
    val targetCarbsG: Int = 220,
    val targetFatG: Int = 65,
    val waterTargetMl: Int = 3500,
    val waterConsumedMl: Int = 2250,
    val meals: List<MealItem>,
    val notes: String = "High protein diet with hydration focus."
)

data class FitnessProgressEntry(
    val id: String,
    val date: String,
    val weightKg: Double,
    val bodyFatPercent: Double,
    val bmi: Double,
    val chestCm: Double,
    val armsCm: Double,
    val waistCm: Double,
    val thighsCm: Double,
    val benchPressMaxKg: Double,
    val squatMaxKg: Double,
    val deadliftMaxKg: Double,
    val notes: String
)

data class PaymentRecord(
    val id: String,
    val invoiceNumber: String,
    val memberId: String,
    val memberName: String,
    val branchId: String,
    val planName: String,
    val baseAmount: Double,
    val gstAmount: Double,
    val discountAmount: Double,
    val totalAmount: Double,
    val paymentMethod: String, // UPI, Card, Net Banking, Cash
    val transactionRef: String,
    val date: String,
    val status: String // PAID, PENDING, REFUNDED
)

data class GroupClass(
    val id: String,
    val title: String,
    val category: String, // Yoga, Zumba, CrossFit, HIIT, Strength
    val trainerName: String,
    val time: String,
    val durationMins: Int,
    val room: String,
    val branchId: String,
    val capacity: Int,
    val bookedCount: Int,
    val isBookedByCurrentUser: Boolean = false
)

data class Trainer(
    val id: String,
    val name: String,
    val specialty: String,
    val experienceYears: Int,
    val rating: Double,
    val phone: String,
    val email: String,
    val assignedMembersCount: Int,
    val monthlySalary: Double,
    val commissionPercent: Double,
    val branchId: String,
    val availabilityStatus: String = "Available"
)

data class InventoryItem(
    val id: String,
    val name: String,
    val category: String, // Supplements, Apparel, Accessories, Equipment
    val stockQty: Int,
    val minStockAlert: Int,
    val unitPrice: Double,
    val costPrice: Double,
    val supplier: String
)

data class MarketingLead(
    val id: String,
    val name: String,
    val phone: String,
    val source: String, // Walk-in, Instagram, Referral, Google
    val stage: String, // NEW, CONTACTED, TRIAL_BOOKED, CONVERTED, LOST
    val interestPlan: String,
    val lastFollowUp: String,
    val notes: String
)

data class SupportTicket(
    val id: String,
    val memberId: String,
    val memberName: String,
    val category: String, // Payment, Membership, Trainer, Equipment, App, General
    val subject: String,
    val message: String,
    val priority: String, // Low, Medium, High, Urgent
    val status: String, // Open, In Progress, Resolved
    val createdAt: String,
    val resolution: String? = null
)

data class AdminStaff(
    val id: String,
    val name: String,
    val email: String,
    val branchId: String,
    val branchName: String,
    val role: String,
    val canMembers: Boolean = true,
    val canPayments: Boolean = true,
    val canExpenses: Boolean = true,
    val canReports: Boolean = true,
    val canDeleteMember: Boolean = false,
    val canSettings: Boolean = false,
    val lastLogin: String,
    val status: String = "Active"
)

data class AuditLog(
    val id: String,
    val actorName: String,
    val actorRole: String,
    val action: String,
    val entity: String,
    val details: String,
    val timestamp: String,
    val ipAddress: String = "192.168.1.104",
    val device: String = "Android Device"
)
