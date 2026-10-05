package com.example.data.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "members")
data class MemberEntity(
    @PrimaryKey val id: String, // e.g. "MEM-8821"
    val userId: String,
    val name: String,
    val email: String,
    val phone: String,
    val branchId: String,
    val branchName: String,
    val planName: String,
    val status: String, // "ACTIVE", "EXPIRED", "FROZEN", "PENDING"
    val startDate: String,
    val expiryDate: String,
    val remainingDays: Int,
    val trainerName: String,
    val balanceDue: Double,
    val lockerNumber: String,
    val qrToken: String,
    val attendanceStreak: Int,
    val bloodGroup: String,
    val emergencyContact: String,
    val heightCm: Double,
    val weightKg: Double,
    val fitnessGoal: String,
    val medicalNotes: String
)
