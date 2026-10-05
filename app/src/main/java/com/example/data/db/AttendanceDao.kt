package com.example.data.db

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface AttendanceDao {
    @Query("SELECT * FROM attendance ORDER BY date DESC, checkInTime DESC")
    fun getAllAttendance(): Flow<List<AttendanceEntity>>

    @Query("SELECT * FROM attendance WHERE memberId = :memberId ORDER BY date DESC")
    fun getAttendanceForMember(memberId: String): Flow<List<AttendanceEntity>>

    @Query("SELECT * FROM attendance WHERE date = :date ORDER BY checkInTime DESC")
    fun getAttendanceForDate(date: String): Flow<List<AttendanceEntity>>

    @Query("SELECT * FROM attendance WHERE branchId = :branchId AND date = :date")
    fun getAttendanceForBranchAndDate(branchId: String, date: String): Flow<List<AttendanceEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAttendance(attendance: AttendanceEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAllAttendance(records: List<AttendanceEntity>)

    @Query("UPDATE attendance SET checkOutTime = :checkOutTime, status = 'Completed' WHERE id = :id")
    suspend fun updateCheckOut(id: String, checkOutTime: String)
}
