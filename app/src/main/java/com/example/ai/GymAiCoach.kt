package com.example.ai

import com.example.model.DietPlan
import com.example.model.FitnessProgressEntry
import com.example.model.Member
import com.example.model.WorkoutDay

data class AiChatMessage(
    val id: String,
    val sender: String, // "user" or "ai"
    val textEn: String,
    val textHi: String,
    val timestamp: String
)

object GymAiCoach {

    fun generateAnswer(
        question: String,
        member: Member,
        workout: WorkoutDay,
        diet: DietPlan,
        progress: List<FitnessProgressEntry>,
        language: String
    ): Pair<String, String> {
        val qLower = question.lowercase()

        // 1. "आज मेरा workout क्या है?" / "What is my workout today?"
        if (qLower.contains("workout") || qLower.contains("वर्कआउट") || qLower.contains("कसरत") || qLower.contains("exercise")) {
            val completedCount = workout.exercises.count { it.isCompleted }
            val totalCount = workout.exercises.size
            val exerciseList = workout.exercises.joinToString("\n• ") {
                "${it.name} (${it.sets} sets × ${it.reps}, Target: ${it.targetWeightKg}kg) ${if (it.isCompleted) "✅" else "⏳"}"
            }

            val en = """
                🏋️ **Today's Assigned Workout: ${workout.title}**
                • Status: $completedCount of $totalCount exercises completed.
                • Assigned Coach: ${member.trainerName}
                • Coach Note: "${workout.trainerNotes}"
                
                **Exercise Routine:**
                • $exerciseList
                
                💡 *Pro Tip:* Keep rest between compound lifts to 90 seconds for optimal hypertrophic tension!
            """.trimIndent()

            val hi = """
                🏋️ **आज का आपका वर्कआउट: ${workout.title}**
                • प्रगति: $totalCount में से $completedCount एक्सरसाइज पूरी हो चुकी हैं।
                • आपके ट्रेनर: ${member.trainerName}
                • कोच की सलाह: "${workout.trainerNotes}"
                
                **आज का रूटीन:**
                • $exerciseList
                
                💡 *टिप:* भारी सेट के बीच 90 सेकंड का आराम लें ताकि मसल रिकवरी और स्ट्रेंथ बनी रहे!
            """.trimIndent()

            return Pair(en, hi)
        }

        // 2. "मेरे goal के हिसाब से diet क्या है?" / "What is my diet according to my goal?"
        if (qLower.contains("diet") || qLower.contains("डाइट") || qLower.contains("खाना") || qLower.contains("nutrition") || qLower.contains("protein") || qLower.contains("goal")) {
            val eatenCal = diet.meals.filter { it.isEaten }.sumOf { it.calories }
            val eatenProt = diet.meals.filter { it.isEaten }.sumOf { it.proteinG }

            val en = """
                🥗 **Custom Nutrition Plan for Goal: ${member.fitnessGoal}**
                
                • **Daily Calorie Target:** ${diet.targetCalories} kcal (Consumed: $eatenCal kcal)
                • **Protein Target:** ${diet.targetProteinG}g (Consumed: $eatenProt g)
                • **Carbs Target:** ${diet.targetCarbsG}g | **Fats:** ${diet.targetFatG}g
                • **Hydration Status:** ${diet.waterConsumedMl}ml / ${diet.waterTargetMl}ml
                
                **Meal Plan Breakdown:**
                ${diet.meals.joinToString("\n") { "• ${it.mealType}: ${it.title} (${it.calories} kcal, ${it.proteinG}g P) ${if (it.isEaten) "✅" else "⏳"}" }}
                
                💡 *Nutritionist Note:* You are at ${(eatenProt * 100) / diet.targetProteinG}% of your daily protein. Remember to drink 500ml water around your workout window!
            """.trimIndent()

            val hi = """
                🥗 **आपके लक्ष्य (${member.fitnessGoal}) के अनुसार डाइट प्लान:**
                
                • **दैनिक कैलोरी लक्ष्य:** ${diet.targetCalories} kcal (अब तक: $eatenCal kcal)
                • **प्रोटीन लक्ष्य:** ${diet.targetProteinG}g (अब तक: $eatenProt g)
                • **कार्ब्स:** ${diet.targetCarbsG}g | **फैट्स:** ${diet.targetFatG}g
                • **पानी की मात्रा:** ${diet.waterConsumedMl}ml / ${diet.waterTargetMl}ml
                
                **मील्स का विवरण:**
                ${diet.meals.joinToString("\n") { "• ${it.mealType}: ${it.title} (${it.calories} kcal, ${it.proteinG}g प्रोटीन) ${if (it.isEaten) "✅" else "⏳"}" }}
                
                💡 *सलाह:* आपका प्रोटीन लक्ष्य ${(eatenProt * 100) / diet.targetProteinG}% पूरा हो गया है। कसरत के तुरंत बाद व्हे प्रोटीन और हाइड्रेशन पर ध्यान दें!
            """.trimIndent()

            return Pair(en, hi)
        }

        // 3. "मेरा पिछले महीने कितना weight कम हुआ?" / "How much weight did I lose last month?"
        if (qLower.contains("weight") || qLower.contains("वजन") || qLower.contains("कम") || qLower.contains("progress") || qLower.contains("progress") || qLower.contains("fat")) {
            val latest = progress.getOrNull(0)
            val prev = progress.getOrNull(1)

            val diffWeight = if (latest != null && prev != null) {
                String.format("%.1f", prev.weightKg - latest.weightKg)
            } else "1.5"

            val diffWaist = if (latest != null && prev != null) {
                String.format("%.1f", prev.waistCm - latest.waistCm)
            } else "2.5"

            val en = """
                📊 **Your Fitness Progress Analysis:**
                
                • **Weight Change:** You lost **$diffWeight kg** over the last 30 days (from ${prev?.weightKg ?: 78.0} kg down to ${latest?.weightKg ?: 76.5} kg)! 🎉
                • **Waist Reduction:** Lost **$diffWaist cm** around the waistline.
                • **Current BMI:** ${latest?.bmi ?: 24.1} (Healthy / Athletic range).
                • **Body Fat %:** Dropped from ${prev?.bodyFatPercent ?: 16.2}% to ${latest?.bodyFatPercent ?: 14.8}%.
                • **Strength Record:** Bench press peaked at ${latest?.benchPressMaxKg ?: 95.0} kg (+5 kg gain).
                
                🔥 *Analysis:* You are successfully achieving **body recomposition** (losing fat while retaining muscle mass). Keep maintaining your 500 kcal deficit!
            """.trimIndent()

            val hi = """
                📊 **आपकी फिटनेस प्रगति रिपोर्ट:**
                
                • **वजन में बदलाव:** पिछले 30 दिनों में आपका वजन **$diffWeight kg** कम हुआ है (${prev?.weightKg ?: 78.0} kg से घटकर ${latest?.weightKg ?: 76.5} kg हो गया)! 🎉
                • **कमर का माप:** कमर में **$diffWaist cm** की कमी आई है।
                • **वर्तमान BMI:** ${latest?.bmi ?: 24.1} (स्वस्थ और फिट श्रेणी)।
                • **बॉडी फैट %:** ${prev?.bodyFatPercent ?: 16.2}% से कम होकर ${latest?.bodyFatPercent ?: 14.8}% हुआ।
                • **स्ट्रेंथ रिकॉर्ड:** बेंच प्रेस क्षमता बढ़कर ${latest?.benchPressMaxKg ?: 95.0} kg हो गई (+5 kg की वृद्धि)।
                
                🔥 *विश्लेषण:* आप फैट कम करते हुए मांसपेशियां बनाए रखने में सफल रहे हैं। इसी तरह डाइट और कसरत जारी रखें!
            """.trimIndent()

            return Pair(en, hi)
        }

        // Generic query fallback
        val en = """
            🤖 **IronPulse AI Coach Answer:**
            
            Based on your active membership at **${member.branchName}** and goals (${member.fitnessGoal}):
            
            • You have an active **${member.attendanceStreak}-day attendance streak**!
            • Membership valid for **${member.remainingDays} more days** under the ${member.planName}.
            • Current Weight: ${member.weightKg} kg | Height: ${member.heightCm} cm.
            
            Feel free to ask me about your workout sets, target macros, or recovery recommendations!
        """.trimIndent()

        val hi = """
            🤖 **IronPulse AI कोच का उत्तर:**
            
            **${member.branchName}** में आपकी सक्रिय सदस्यता और लक्ष्य (${member.fitnessGoal}) के आधार पर:
            
            • आपकी **${member.attendanceStreak} दिनों की निरंतर उपस्थिति (Streak)** है!
            • आपकी ${member.planName} सदस्यता अभी **${member.remainingDays} दिन** और वैध है।
            • वर्तमान वजन: ${member.weightKg} kg | कद: ${member.heightCm} cm।
            
            आप मुझसे कभी भी आज के वर्कआउट, डाइट मैक्रोज़ या बॉडी रिकवरी के बारे में पूछ सकते हैं!
        """.trimIndent()

        return Pair(en, hi)
    }
}
