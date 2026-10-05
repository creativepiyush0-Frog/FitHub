package com.example.data.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "attendance")
data class AttendanceEntity(
    @PrimaryKey val id: String, // e.g. "ATT-101"
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
