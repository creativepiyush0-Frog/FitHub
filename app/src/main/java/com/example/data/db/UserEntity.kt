package com.example.data.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "users")
data class UserEntity(
    @PrimaryKey val id: String,
    val email: String,
    val phone: String,
    val role: String, // "MEMBER", "BRANCH_ADMIN", "SUPER_ADMIN"
    val displayName: String,
    val branchId: String,
    val createdAt: Long = System.currentTimeMillis()
)
