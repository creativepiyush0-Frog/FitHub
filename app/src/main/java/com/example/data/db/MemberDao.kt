package com.example.data.db

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface MemberDao {
    @Query("SELECT * FROM members ORDER BY name ASC")
    fun getAllMembers(): Flow<List<MemberEntity>>

    @Query("SELECT * FROM members WHERE id = :id LIMIT 1")
    suspend fun getMemberById(id: String): MemberEntity?

    @Query("SELECT * FROM members WHERE branchId = :branchId")
    fun getMembersByBranch(branchId: String): Flow<List<MemberEntity>>

    @Query("SELECT * FROM members WHERE status = :status")
    fun getMembersByStatus(status: String): Flow<List<MemberEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMember(member: MemberEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAllMembers(members: List<MemberEntity>)

    @Query("UPDATE members SET status = :status WHERE id = :memberId")
    suspend fun updateMemberStatus(memberId: String, status: String)

    @Query("UPDATE members SET remainingDays = remainingDays + :days, status = 'ACTIVE' WHERE id = :memberId")
    suspend fun extendMembership(memberId: String, days: Int)

    @Query("UPDATE members SET balanceDue = 0.0 WHERE id = :memberId")
    suspend fun clearMemberDue(memberId: String)

    @Delete
    suspend fun deleteMember(member: MemberEntity)
}
