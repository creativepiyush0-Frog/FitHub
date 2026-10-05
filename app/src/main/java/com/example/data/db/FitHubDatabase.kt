package com.example.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [
        UserEntity::class,
        MemberEntity::class,
        AttendanceEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class FitHubDatabase : RoomDatabase() {

    abstract fun userDao(): UserDao
    abstract fun memberDao(): MemberDao
    abstract fun attendanceDao(): AttendanceDao

    companion object {
        @Volatile
        private var INSTANCE: FitHubDatabase? = null

        fun getInstance(context: Context): FitHubDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    FitHubDatabase::class.java,
                    "fithub_database"
                )
                .fallbackToDestructiveMigration()
                .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
