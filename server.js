import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";
import { handleApiRoute, sendJson, parseJsonBody, getAuthUser } from "./src/api.js";
import { dbService } from "./src/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.DEFAULT_APP_PORT || process.env.PORT || 3000;

// Gemini API integration on the server side using @google/genai SDK
let geminiClient = null;
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
        timeout: 12000,
      },
    });
  }
  return geminiClient;
}

// Server-side Gemini API caller with Gemini 3.8 Flash preferred and free-tier fallback
async function callGeminiApi(prompt, systemInstruction, language = "en") {
  const isHi = language === "hi";
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      errorType: "MISSING_KEY",
      answer: isHi
        ? "AI फिटनेस कोच अभी कॉन्फ़िगर नहीं है। कृपया सर्वर में GEMINI_API_KEY सेट करें।"
        : "AI Fitness Coach is not configured yet. Please set GEMINI_API_KEY in your server environment.",
    };
  }

  const ai = getGeminiClient();
  if (!ai) {
    return {
      success: false,
      errorType: "CLIENT_ERROR",
      answer: isHi
        ? "AI Coach अभी उपलब्ध नहीं है। कृपया थोड़ी देर बाद फिर कोशिश करें।"
        : "AI Coach is temporarily unavailable. Please try again later.",
    };
  }

  // Preferred model: gemini-3.8-flash, with automatic fallback to gemini-3.5-flash / gemini-3.1-flash-lite on 503/high-demand/timeout
  const candidateModels = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite"];

  for (const model of candidateModels) {
    try {
      const response = await Promise.race([
        ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction,
            temperature: 0.7,
            maxOutputTokens: 600,
          },
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 7000))
      ]);

      const text = response.text;
      if (text && text.trim()) {
        return {
          success: true,
          model,
          answer: text.trim(),
        };
      }
    } catch (err) {
      console.warn(`[Gemini API] Call with ${model} failed:`, err?.status || err?.message || err);
      const errMsg = String(err?.message || err || "").toLowerCase();

      // Check for rate limit / quota
      if (err?.status === 429 || errMsg.includes("429") || errMsg.includes("resource_exhausted") || errMsg.includes("quota")) {
        return {
          success: false,
          errorType: "RATE_LIMIT",
          answer: isHi
            ? "AI कोच की सीमा समाप्त हो गई है। कृपया थोड़ी देर बाद फिर कोशिश करें।"
            : "AI Coach usage limit reached. Please wait a moment and try again.",
        };
      }

      // If temporary 503 unavailable or timeout, try next fallback model
      if (err?.status === 503 || errMsg.includes("503") || errMsg.includes("unavailable") || errMsg.includes("timeout")) {
        continue;
      }
    }
  }

  // Friendly error message for all other failures
  return {
    success: false,
    errorType: "API_ERROR",
    answer: isHi
      ? "AI Coach अभी उपलब्ध नहीं है। कृपया थोड़ी देर बाद फिर कोशिश करें।"
      : "AI Coach is temporarily unavailable. Please try again later.",
  };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Static PWA & public asset serving
    const publicPath = path.join(__dirname, "public", url.pathname === "/" ? "" : url.pathname);
    if (url.pathname !== "/" && fs.existsSync(publicPath) && fs.statSync(publicPath).isFile()) {
      const ext = path.extname(publicPath).toLowerCase();
      const contentTypes = {
        ".json": "application/manifest+json; charset=utf-8",
        ".webmanifest": "application/manifest+json; charset=utf-8",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".js": "application/javascript; charset=utf-8",
        ".css": "text/css",
        ".ico": "image/x-icon"
      };
      res.writeHead(200, { "Content-Type": contentTypes[ext] || "application/octet-stream" });
      res.end(fs.readFileSync(publicPath));
      return;
    }

    // Health check
    if (url.pathname === "/health" || url.pathname === "/api/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "healthy", timestamp: new Date().toISOString(), database: "ready" }));
      return;
    }

    // AI Assistant Server Route (Protected & Isolated to Authenticated Member)
    if (url.pathname === "/api/ai-assistant" && req.method === "POST") {
      const user = await getAuthUser(req);
      if (!user) {
        sendJson(res, 401, { error: "Authentication required to consult the AI Coach." });
        return;
      }
      try {
        const { question, language = "en" } = await parseJsonBody(req);
        if (!question || typeof question !== "string" || !question.trim()) {
          sendJson(res, 400, { error: "Question is required." });
          return;
        }

        // Only load the authenticated member's authorized records
        const memberData = await dbService.getMemberDashboard(user.id, user.token);
        const athleteName = user.fullName || "Athlete";
        const email = user.email || "";
        const planName = memberData.planName || "No active membership";
        const status = memberData.status || "INACTIVE";
        const remainingDays = typeof memberData.remainingDays === "number" ? memberData.remainingDays : 0;
        const expiryDate = memberData.expiryDate || "No expiry";
        const streak = memberData.streak || 0;
        const totalCheckins = memberData.attendanceCount || 0;
        const todayAttended = memberData.todayAttended ? "Yes" : "No";
        const monthlyPercent = memberData.monthlyPercent || "0%";

        // Workouts
        let workoutsStr = "NONE (No workout routine has been assigned to this athlete yet)";
        if (memberData.workouts && memberData.workouts.length > 0) {
          workoutsStr = memberData.workouts.map(w => {
            const exStr = (w.exercises || []).map(e => `${e.name} (${e.sets} sets x ${e.reps} reps, ${e.weight_kg || 0}kg, completed: ${e.completed ? 'YES' : 'NO'})`).join(", ");
            return `${w.title || 'Workout'}: ${exStr || 'No exercises'}`;
          }).join("; ");
        }

        // Diet
        let dietStr = "NONE (No diet or nutrition protocol prescribed yet)";
        if (memberData.diet) {
          const d = memberData.diet;
          dietStr = `Daily Targets: ${d.target_calories || 0} kcal, Protein: ${d.target_protein_g || 0}g, Carbs: ${d.target_carbs_g || 0}g, Fats: ${d.target_fat_g || 0}g. Water Consumed: ${d.water_consumed_ml || 0} ml / ${d.water_target_ml || 3000} ml. ${d.guidelines ? `Guidelines: ${d.guidelines}` : ''}`;
        }

        // Goals
        let goalsStr = "NONE (No fitness goals set yet)";
        if (memberData.goals && memberData.goals.length > 0) {
          goalsStr = memberData.goals.map(g => `${g.title || g.goal_type || 'Goal'}: Target ${g.target_value || ''} (Target Date: ${g.target_date || g.deadline || 'Ongoing'})`).join("; ");
        }

        // Progress
        let progressStr = "NONE (No body composition records logged yet)";
        if (memberData.progress && memberData.progress.length > 0) {
          const latest = memberData.progress[memberData.progress.length - 1];
          progressStr = `Latest Record (${latest.date || latest.recorded_at || 'Recent'}): Weight: ${latest.weight_kg || 'N/A'} kg, Calculated BMI: ${latest.bmi || 'N/A'}`;
        }

        // Bookings
        let bookingsStr = "NONE (No group class or studio bookings yet)";
        if (memberData.bookings && memberData.bookings.length > 0) {
          bookingsStr = memberData.bookings.map(b => `${b.class_title || 'Class'} (${b.schedule || b.booked_at || 'Scheduled'}, Status: ${b.booking_status || 'CONFIRMED'})`).join("; ");
        }

        const langDirective = (language === "hi") ? "Hindi (हिन्दी)" : "English";

        const sysInstruction = `You are FIT HUB's elite AI Fitness Coach.
AUTHENTICATED ATHLETE FIT HUB PROFILE:
- Name: ${athleteName}
- Email: ${email}
- Membership: ${planName} (${status})
- Remaining Days: ${remainingDays} days (Expiry: ${expiryDate})
- Attendance: Current Streak: ${streak} days, Total Check-ins: ${totalCheckins}, Checked in today: ${todayAttended}, Monthly Attendance: ${monthlyPercent}
- Assigned Workout Routine: ${workoutsStr}
- Prescribed Diet & Macros: ${dietStr}
- Active Fitness Goals: ${goalsStr}
- Body Composition Progress: ${progressStr}
- Class Bookings: ${bookingsStr}

CRITICAL RULES:
1. DATA INTEGRITY & GROUNDING:
Distinguish strictly between the user's actual FitHub data above and general fitness concepts.
When the athlete asks about their personal data (such as today's workout, membership status/days left, attendance/streak, goals, diet/nutrition, progress, or booked classes):
- ONLY use the actual data listed above.
- If data is missing (e.g. Assigned Workout Routine is NONE, Prescribed Diet is NONE, Class Bookings is NONE, Active Goals is NONE, Progress is NONE):
  State clearly in ${langDirective}:
  English: "No workout has been assigned to you yet." / "No diet plan has been assigned to you yet." / "You currently have no class bookings." / "No goals have been set yet."
  Hindi: "अभी आपको कोई वर्कआउट असाइन नहीं किया गया है।" / "अभी आपको कोई डाइट प्लान असाइन नहीं किया गया है।" / "वर्तमान में आपकी कोई क्लास बुकिंग नहीं है।" / "अभी कोई गोल सेट नहीं किया गया है।"
- NEVER hallucinate, invent, or assume any fake workouts, exercises, attendance dates, weights, or membership details.

2. PRIVACY & TENANT ISOLATION:
You strictly ONLY have access to this authenticated athlete's own training and health data. You have NO access to other members, trainers, staff, or administrative financial data. If the user asks about other gym members, trainers, admin financials, or another member's profile/attendance, refuse politely and state that you can only access their personal records.

3. SAFETY & MEDICAL BOUNDARIES:
You are an encouraging fitness assistant, NOT a doctor or medical professional.
- Do not diagnose injuries or medical conditions.
- Do not recommend dangerous exercises, extreme starvation, unsafe weight cutting, or harmful supplements.
- For injuries, severe pain, or medical concerns, advise consulting a qualified doctor or healthcare specialist.

4. LANGUAGE:
Respond naturally, fluently, and appropriately in ${langDirective}. If the prompt is in Hindi or language is 'hi', reply in clean, natural Hindi. If English, reply in English.

5. CONCISENESS & FREE-TIER EFFICIENCY:
Provide crisp, direct, motivational coaching without unnecessary filler (keep under 150 words).`;

        const result = await callGeminiApi(question, sysInstruction, language);
        sendJson(res, 200, { answer: result.answer, success: result.success });
      } catch (err) {
        console.error("[AI Assistant Error]", err);
        const isHi = language === "hi";
        sendJson(res, 500, {
          error: isHi ? "AI Coach अभी उपलब्ध नहीं है। कृपया थोड़ी देर बाद फिर कोशिश करें।" : "AI Coach is temporarily unavailable. Please try again later.",
          answer: isHi ? "AI Coach अभी उपलब्ध नहीं है। कृपया थोड़ी देर बाद फिर कोशिश करें।" : "AI Coach is temporarily unavailable. Please try again later."
        });
      }
      return;
    }

    // API router
    if (url.pathname.startsWith("/api/")) {
      try {
        const handled = await handleApiRoute(req, res, url);
        if (handled) return;
        sendJson(res, 404, { error: "API endpoint not found." });
      } catch (apiErr) {
        console.error("[API Router Error]", apiErr);
        sendJson(res, 500, { error: "Internal server error." });
      }
      return;
    }

    // Serve Frontend Single-Page App
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderWebApp());
  } catch (err) {
    console.error("[HTTP Server Error]", err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<h1>Internal Server Error</h1>");
    }
  }
});

server.on("error", (err) => {
  console.error("[Fatal Server Error]", err);
});

process.on("uncaughtException", (err) => {
  console.error("[Uncaught Exception]", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("[Unhandled Rejection]", reason);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[INFO] Server started on port ${PORT}.`);
});

// ---------------------------------------------------------------------------
// FIT HUB Responsive Multi-Role Frontend Web Application
// ---------------------------------------------------------------------------
function renderWebApp() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FIT HUB — Your Complete Fitness Ecosystem</title>
  <meta name="description" content="Enterprise Gym Management System with Super Admin, Branch Admin, Member portals, QR attendance, workout & diet protocols, billing, and AI coach.">
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#0A0A0A">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="FitHub">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="icon" type="image/svg+xml" href="/icon.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            brand: {
              orange: '#F0441D',
              orangeHover: '#FF542B',
              darkBg: '#0A0A0A',
              surface: '#171717',
              card: '#1D1D1D',
              input: '#242424',
              border: '#393939',
              textPrimary: '#FFFFFF',
              textSecondary: '#B5B5B5',
              textMuted: '#858585'
            }
          },
          fontFamily: {
            athletic: ['"Barlow Condensed"', 'sans-serif'],
            body: ['Inter', 'sans-serif']
          }
        }
      }
    }
  </script>
  <style>
    body {
      background-color: #0A0A0A;
      color: #FFFFFF;
      font-family: 'Inter', sans-serif;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .fithub-heading {
      font-family: 'Barlow Condensed', sans-serif;
      text-transform: uppercase;
      font-weight: 800;
      letter-spacing: 0.5px;
    }
    .fithub-logo {
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: -0.5px;
      display: inline-flex;
      align-items: center;
    }
    .fithub-logo .fit { color: #F0441D; }
    .fithub-logo .hub { color: #FFFFFF; }
    .glass-card {
      background-color: #1D1D1D;
      border: 1px solid #393939;
      border-radius: 16px;
    }
    .input-field {
      background-color: #242424;
      border: 1px solid #393939;
      border-radius: 12px;
      color: #FFFFFF;
      outline: none;
      transition: all 0.2s ease;
    }
    .input-field:focus {
      border-color: #F0441D;
      box-shadow: 0 0 0 2px rgba(240, 68, 29, 0.2);
    }
    .btn-orange {
      background-color: #F0441D;
      color: #FFFFFF;
      font-family: 'Barlow Condensed', sans-serif;
      text-transform: uppercase;
      font-weight: 800;
      border-radius: 12px;
      transition: background-color 0.15s ease, transform 0.1s ease;
    }
    .btn-orange:hover {
      background-color: #FF542B;
    }
    .btn-orange:active {
      transform: scale(0.98);
    }
    .btn-secondary {
      background-color: transparent;
      border: 1px solid #393939;
      color: #FFFFFF;
      font-family: 'Barlow Condensed', sans-serif;
      text-transform: uppercase;
      font-weight: 700;
      border-radius: 12px;
      transition: all 0.15s ease;
    }
    .btn-secondary:hover {
      border-color: #B5B5B5;
      background-color: #242424;
    }
    .active-nav-pill {
      background-color: #F0441D;
      color: #FFFFFF !important;
    }
    /* Splash Screen Styles */
    #splashScreen {
      position: fixed;
      inset: 0;
      z-index: 99999;
      background: radial-gradient(circle at 50% 50%, #171717 0%, #0A0A0A 60%, #050505 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      padding: 3rem 1.5rem 2.5rem;
      transition: opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1), visibility 0.5s;
    }
    #splashScreen.fade-out {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }
    .splash-pulse-glow {
      animation: splashPulse 2s ease-in-out infinite;
    }
    @keyframes splashPulse {
      0%, 100% { transform: scale(1); filter: drop-shadow(0 0 15px rgba(240, 68, 29, 0.35)); }
      50% { transform: scale(1.03); filter: drop-shadow(0 0 30px rgba(240, 68, 29, 0.65)); }
    }
  </style>
</head>
<body class="min-h-screen flex flex-col justify-between">

  <!-- Production App Splash Screen Matching Provided Design -->
  <div id="splashScreen">
    <div class="w-full flex-1 flex flex-col items-center justify-center relative">
      <!-- Background subtle pulse curve -->
      <div class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
        <svg viewBox="0 0 800 400" class="w-full max-w-lg">
          <path d="M 50 200 L 250 200 L 280 150 L 320 280 L 360 80 L 400 320 L 440 170 L 470 220 L 510 190 L 750 190" 
                fill="none" stroke="#F0441D" stroke-width="3" stroke-linecap="round"/>
        </svg>
      </div>

      <!-- Centered FitHub Logo Icon and Typography -->
      <div class="text-center z-10 flex flex-col items-center splash-pulse-glow">
        <img src="/icon.svg" alt="FitHub Logo" class="w-32 h-32 sm:w-40 sm:h-40 rounded-[28px] shadow-2xl mb-4 border border-[#2a2a2a]">
        <div class="fithub-heading text-5xl sm:text-6xl tracking-tight leading-none">
          <span class="text-[#F0441D]">FIT</span> <span class="text-white">HUB</span>
        </div>
      </div>
    </div>

    <!-- Bottom Version & Tagline Exactly Matching Provided Splash Screen -->
    <div class="text-center z-10 space-y-1">
      <p class="text-xs sm:text-sm font-medium text-[#E5E5E5] tracking-wider">v1.0.0 | Total Fitness, Redefined.</p>
      <p class="text-[11px] text-[#757575] font-normal tracking-wide">Your Total Fitness Partner</p>
    </div>
  </div>

  <!-- Mobile App Frame Container -->
  <div class="w-full max-w-5xl mx-auto min-h-screen flex flex-col p-3 sm:p-5">

    <!-- Top Navigation Header -->
    <header class="flex items-center justify-between py-3 border-b border-[#393939] mb-4">
      <div class="flex items-center space-x-3 cursor-pointer" onclick="navigateTo('role_select')">
        <div class="fithub-logo text-2xl tracking-tighter">
          <span class="fit">FIT</span><span class="hub">HUB</span>
        </div>
        <span class="hidden sm:inline-block text-xs text-[#858585] border-l border-[#393939] pl-3">Enterprise Gym Management</span>
      </div>

      <div class="flex items-center space-x-2">
        <!-- Notification Bell -->
        <button onclick="openModal('notificationsModal')" class="relative p-2 rounded-xl bg-[#171717] border border-[#393939] text-[#B5B5B5] hover:text-white">
          <i class="fa-solid fa-bell text-sm"></i>
          <span id="headerNotifDot" class="hidden absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#F0441D]"></span>
        </button>

        <!-- Language Switcher: EN | HI -->
        <div class="flex items-center rounded-xl bg-[#171717] border border-[#393939] p-0.5 text-xs font-bold" id="langSelector">
          <button id="langBtnEn" onclick="setLanguage('en')" class="px-2.5 py-1 rounded-lg transition text-white bg-[#F0441D]">EN</button>
          <button id="langBtnHi" onclick="setLanguage('hi')" class="px-2.5 py-1 rounded-lg transition text-[#858585] hover:text-white">HI</button>
        </div>

        <!-- Install PWA Button -->
        <button id="pwaInstallBtn" onclick="installPWA()" class="hidden px-2.5 py-1 rounded-xl bg-[#F0441D] text-white text-xs font-bold hover:bg-[#FF542B] transition flex items-center gap-1.5 shadow-md">
          <i class="fa-solid fa-download"></i> <span class="hidden sm:inline">Install App</span>
        </button>

        <!-- Logout Button -->
        <button id="logoutBtn" onclick="performLogout()" class="hidden px-2.5 py-1 rounded-xl bg-[#242424] border border-[#393939] text-xs text-[#858585] hover:text-[#F0441D]">
          <i class="fa-solid fa-right-from-bracket"></i>
        </button>
      </div>
    </header>

    <!-- Offline Connectivity Banner -->
    <div id="offlineBanner" class="hidden bg-amber-600 text-white text-xs font-bold py-1.5 px-4 text-center rounded-xl mb-4 flex items-center justify-center gap-2 border border-amber-500 shadow-lg">
      <span class="w-2 h-2 rounded-full bg-white animate-pulse"></span>
      Offline Mode — Cached FitHub data is active. Reconnect to sync turnstile check-ins and payments.
    </div>

    <!-- VIEW 1: ROLE SELECTION SCREEN -->
    <div id="view-role_select" class="w-full max-w-md mx-auto my-auto py-8 space-y-6">
      <div class="text-center space-y-2">
        <div class="fithub-logo text-4xl">
          <span class="fit">FIT</span><span class="hub">HUB</span>
        </div>
        <p class="text-xs text-[#B5B5B5] font-medium tracking-wide">Your complete fitness ecosystem</p>
        <h2 class="fithub-heading text-2xl text-white mt-4">CHOOSE YOUR ROLE</h2>
      </div>

      <div class="space-y-3.5">
        <!-- Member Card -->
        <div onclick="selectRoleAndGoToLogin('MEMBER')" class="glass-card p-4 sm:p-5 hover:border-[#F0441D] cursor-pointer transition flex items-center justify-between group">
          <div class="flex items-center space-x-4">
            <div class="w-12 h-12 rounded-xl bg-[#242424] border border-[#393939] flex items-center justify-center text-[#F0441D] text-xl group-hover:scale-105 transition">
              <i class="fa-solid fa-dumbbell"></i>
            </div>
            <div>
              <h3 class="fithub-heading text-lg text-white">MEMBER</h3>
              <p class="text-xs text-[#B5B5B5] mt-0.5">Find gyms, track attendance, manage membership</p>
            </div>
          </div>
          <i class="fa-solid fa-chevron-right text-[#858585] group-hover:text-white transition"></i>
        </div>

        <!-- Gym Owner / Admin Card -->
        <div onclick="selectRoleAndGoToLogin('GYM_ADMIN')" class="glass-card p-4 sm:p-5 hover:border-[#F0441D] cursor-pointer transition flex items-center justify-between group">
          <div class="flex items-center space-x-4">
            <div class="w-12 h-12 rounded-xl bg-[#242424] border border-[#393939] flex items-center justify-center text-[#F0441D] text-xl group-hover:scale-105 transition">
              <i class="fa-solid fa-building-user"></i>
            </div>
            <div>
              <h3 class="fithub-heading text-lg text-white">GYM OWNER / ADMIN</h3>
              <p class="text-xs text-[#B5B5B5] mt-0.5">Manage members, view enquiries, track activity</p>
            </div>
          </div>
          <i class="fa-solid fa-chevron-right text-[#858585] group-hover:text-white transition"></i>
        </div>

        <!-- Super Admin Card -->
        <div onclick="selectRoleAndGoToLogin('SUPER_ADMIN')" class="glass-card p-4 sm:p-5 hover:border-[#F0441D] cursor-pointer transition flex items-center justify-between group">
          <div class="flex items-center space-x-4">
            <div class="w-12 h-12 rounded-xl bg-[#242424] border border-[#393939] flex items-center justify-center text-[#F0441D] text-xl group-hover:scale-105 transition">
              <i class="fa-solid fa-shield-halved"></i>
            </div>
            <div>
              <h3 class="fithub-heading text-lg text-white">SUPER ADMIN</h3>
              <p class="text-xs text-[#B5B5B5] mt-0.5">Full platform control — all gyms and members</p>
            </div>
          </div>
          <i class="fa-solid fa-chevron-right text-[#858585] group-hover:text-white transition"></i>
        </div>
      </div>

      <div class="text-center pt-2">
        <span class="text-[11px] text-[#858585]">FIT HUB v1.0.0 • Connected to Secure Backend API</span>
      </div>
    </div>

    <!-- VIEW 2: AUTHENTICATION SCREEN (PRODUCTION LOGIN) -->
    <div id="view-login" class="w-full max-w-md mx-auto my-auto py-8 space-y-6 hidden">
      <button onclick="navigateTo('role_select')" class="text-xs text-[#AAAAAA] hover:text-white flex items-center transition">
        <i class="fa-solid fa-arrow-left mr-1.5"></i> Back to roles
      </button>

      <div class="text-center space-y-1.5">
        <div class="fithub-logo text-3xl">
          <span class="fit">FIT</span><span class="hub">HUB</span>
        </div>
        <h2 id="loginPageTitle" class="fithub-heading text-2xl text-white mt-1">WELCOME BACK</h2>
        <p id="loginSubtitle" class="text-xs text-[#B5B5B5]">Sign in to your authenticated account</p>
      </div>

      <div id="authAlert" class="hidden p-3 rounded-xl text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/30"></div>

      <form id="authForm" onsubmit="event.preventDefault(); performAuth();" class="space-y-4">
        <div id="fullNameGroup" class="space-y-1.5 hidden">
          <label class="text-[10px] uppercase font-bold text-[#858585]">Full Name</label>
          <input type="text" id="authFullName" class="input-field w-full p-3 text-xs" placeholder="e.g. Rahul Sharma">
        </div>

        <div class="space-y-1.5">
          <label class="text-[10px] uppercase font-bold text-[#858585]">Email / Mobile</label>
          <input type="text" id="authEmail" class="input-field w-full p-3 text-xs" placeholder="member@example.com or phone" required autocomplete="username">
        </div>

        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <label class="text-[10px] uppercase font-bold text-[#858585]">Password</label>
            <a href="#" onclick="showForgotPassword(event)" class="text-[11px] text-[#858585] hover:text-[#F0441D] transition">Forgot Password?</a>
          </div>
          <input type="password" id="authPassword" class="input-field w-full p-3 text-xs" placeholder="••••••••" required autocomplete="current-password">
        </div>

        <button type="submit" id="authSubmitBtn" class="btn-orange w-full py-3.5 text-sm uppercase tracking-wider font-bold shadow">
          SIGN IN
        </button>

        <div class="text-center pt-2">
          <span id="authTogglePrompt" class="text-xs text-[#858585]">Don't have an account?</span>
          <button type="button" id="authToggleBtn" onclick="toggleAuthMode()" class="text-xs text-[#F0441D] hover:underline font-bold ml-1">
            Create Account
          </button>
        </div>
      </form>
    </div>

    <!-- VIEW 3: MAIN APPLICATION DASHBOARDS -->
    <div id="view-dashboard" class="w-full space-y-5 hidden">
      
      <!-- ============================================================= -->
      <!-- 1. MEMBER DASHBOARD CONTAINER -->
      <!-- ============================================================= -->
      <div id="subview-member" class="space-y-6">

        <!-- Top Member Profile Strip -->
        <div class="flex flex-wrap items-center justify-between gap-3 bg-[#171717] border border-[#393939] p-3.5 rounded-xl">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 rounded-full bg-[#242424] border border-[#393939] flex items-center justify-center text-[#F0441D] font-bold text-sm">
              <i class="fa-solid fa-user"></i>
            </div>
            <div>
              <div class="flex items-center space-x-2">
                <span id="memberProfileName" class="font-bold text-white text-sm">Authenticated Member</span>
                <span id="memberStatusBadge" class="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-800 text-[#B5B5B5] border border-[#393939]">No active membership</span>
              </div>
              <p id="memberProfileEmail" class="text-xs text-[#858585]">user@fithub.com</p>
            </div>
          </div>

          <!-- Session Controls -->
          <div class="flex items-center space-x-2 text-xs">
            <span class="text-[#858585] hidden sm:inline"><i class="fa-solid fa-shield-check text-emerald-400 mr-1"></i> Authenticated</span>
            <button onclick="fetchMemberDashboard()" class="bg-[#242424] hover:bg-[#2c2c2c] border border-[#393939] text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold">
              <i class="fa-solid fa-rotate mr-1"></i> Refresh
            </button>
          </div>
        </div>

        <!-- Nav Tabs for Member -->
        <div class="flex overflow-x-auto space-x-2 border-b border-[#393939] pb-2 text-xs font-semibold">
          <button onclick="setMemberTab('overview')" id="mTab-overview" data-i18n="tab_overview" class="px-3.5 py-1.5 rounded-lg active-nav-pill whitespace-nowrap">Dashboard</button>
          <button onclick="setMemberTab('workout')" id="mTab-workout" data-i18n="tab_workout" class="px-3.5 py-1.5 rounded-lg text-[#B5B5B5] hover:text-white whitespace-nowrap">Workout</button>
          <button onclick="setMemberTab('diet')" id="mTab-diet" data-i18n="tab_diet" class="px-3.5 py-1.5 rounded-lg text-[#B5B5B5] hover:text-white whitespace-nowrap">Diet</button>
          <button onclick="setMemberTab('progress')" id="mTab-progress" data-i18n="tab_progress" class="px-3.5 py-1.5 rounded-lg text-[#B5B5B5] hover:text-white whitespace-nowrap">Progress & BMI</button>
          <button onclick="setMemberTab('goals')" id="mTab-goals" data-i18n="tab_goals" class="px-3.5 py-1.5 rounded-lg text-[#B5B5B5] hover:text-white whitespace-nowrap">Goals</button>
          <button onclick="setMemberTab('qr')" id="mTab-qr" data-i18n="tab_qr" class="px-3.5 py-1.5 rounded-lg text-[#B5B5B5] hover:text-white whitespace-nowrap">QR Pass</button>
          <button onclick="setMemberTab('classes')" id="mTab-classes" data-i18n="tab_classes" class="px-3.5 py-1.5 rounded-lg text-[#B5B5B5] hover:text-white whitespace-nowrap">Classes & Billing</button>
          <button onclick="setMemberTab('aicoach')" id="mTab-aicoach" data-i18n="tab_aicoach" class="px-3.5 py-1.5 rounded-lg text-[#F0441D] font-bold hover:text-white whitespace-nowrap">🤖 AI Coach</button>
          <button onclick="setMemberTab('support')" id="mTab-support" data-i18n="tab_support" class="px-3.5 py-1.5 rounded-lg text-[#B5B5B5] hover:text-white whitespace-nowrap">Support</button>
        </div>

        <!-- TAB 1: OVERVIEW -->
        <div id="mSec-overview" class="space-y-4">
          <!-- Hero Member Pass Card -->
          <div id="heroMembershipCard" class="glass-card p-6 bg-gradient-to-r from-[#171717] to-[#1D1D1D] border-l-4 border-[#393939]">
            <div class="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span class="text-[10px] text-[#858585] uppercase font-black tracking-widest block">MEMBERSHIP STATUS</span>
                <h2 id="heroPlanTitle" class="fithub-heading text-2xl text-white mt-1">NO ACTIVE MEMBERSHIP</h2>
                <p id="heroPlanDesc" class="text-xs text-[#B5B5B5] mt-1">You do not have an active membership. Assign or purchase a plan to unlock turnstiles and training facilities.</p>
                <div class="mt-3">
                  <button onclick="openModal('assignPlanModal')" class="btn-orange text-xs px-4 py-2 font-bold inline-flex items-center">
                    <i class="fa-solid fa-plus-circle mr-1.5"></i> Choose a Membership Plan
                  </button>
                </div>
              </div>
              <div class="flex items-center space-x-3">
                <div class="bg-[#171717] border border-[#393939] rounded-xl px-4 py-3 text-center min-w-[90px]">
                  <span class="text-[10px] text-[#858585] uppercase font-bold block">DAYS LEFT</span>
                  <span id="heroDaysRemaining" class="text-2xl font-black text-[#858585]">0</span>
                  <span id="heroExpiryText" class="text-[9px] text-[#858585] block">No expiry</span>
                </div>
                <div class="bg-[#171717] border border-[#393939] rounded-xl px-4 py-3 text-center min-w-[90px]">
                  <span class="text-[10px] text-[#858585] uppercase font-bold block">STREAK</span>
                  <span id="heroStreakCount" class="text-2xl font-black text-white">0</span>
                  <span class="text-[9px] text-[#858585] block">Days Active</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Attendance & Check-in Strip -->
          <div class="glass-card p-5 flex flex-wrap items-center justify-between gap-4">
            <div class="flex items-center space-x-4">
              <div class="w-14 h-14 bg-[#242424] border border-[#393939] rounded-xl flex items-center justify-center text-[#F0441D] text-2xl shadow">
                <i class="fa-solid fa-qrcode"></i>
              </div>
              <div>
                <h3 class="font-bold text-white text-base">Gym Gate Check-In</h3>
                <p class="text-xs text-[#B5B5B5]">Total Check-ins: <strong id="totalCheckInCount" class="text-white">0</strong> • Today: <span id="todayAttendanceLabel" class="text-white">0</span> • Monthly: <span id="monthlyAttendanceLabel" class="text-white">0%</span></p>
                <div class="mt-1.5">
                  <span id="memberGateStatus" class="inline-block px-2.5 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-[#858585] border border-[#393939]">
                    STATUS: NO CHECK-INS YET
                  </span>
                </div>
              </div>
            </div>
            <div class="flex items-center space-x-2">
              <button onclick="apiCheckInAttendance()" id="memberGateBtn" class="btn-orange px-4 py-2.5 text-xs font-bold tracking-wider uppercase">
                <i class="fa-solid fa-door-open mr-1"></i> Record Check-In
              </button>
            </div>
          </div>

          <!-- 2-Col Workout & Diet Snapshot Widget -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="glass-card p-5">
              <div class="flex justify-between items-center mb-3">
                <h3 class="fithub-heading text-sm text-white">TODAY'S WORKOUT</h3>
                <button onclick="setMemberTab('workout')" class="text-xs text-[#F0441D] hover:underline font-semibold">Details &rarr;</button>
              </div>
              <div id="overviewWorkoutContainer"></div>
            </div>

            <div class="glass-card p-5">
              <div class="flex justify-between items-center mb-3">
                <h3 class="fithub-heading text-sm text-white">DAILY NUTRITION</h3>
                <button onclick="setMemberTab('diet')" class="text-xs text-[#F0441D] hover:underline font-semibold">Details &rarr;</button>
              </div>
              <div id="overviewDietContainer"></div>
            </div>
          </div>
        </div>

        <!-- TAB 2: WORKOUT -->
        <div id="mSec-workout" class="space-y-4 hidden">
          <div class="flex justify-between items-center">
            <h3 class="fithub-heading text-xl text-white">TRAINING ROUTINE</h3>
            <button onclick="apiAssignWorkout()" class="btn-secondary text-xs px-3 py-1.5">
              <i class="fa-solid fa-plus mr-1"></i> Request / Assign Routine
            </button>
          </div>
          <div id="workoutScreenContainer"></div>
        </div>

        <!-- TAB 3: DIET -->
        <div id="mSec-diet" class="space-y-4 hidden">
          <div class="flex justify-between items-center">
            <h3 class="fithub-heading text-xl text-white">NUTRITION & MACROS</h3>
            <button onclick="apiAssignDiet()" class="btn-secondary text-xs px-3 py-1.5">
              <i class="fa-solid fa-utensils mr-1"></i> Set Nutrition Targets
            </button>
          </div>
          <div id="dietScreenContainer"></div>
        </div>

        <!-- TAB 4: PROGRESS -->
        <div id="mSec-progress" class="space-y-4 hidden">
          <div class="flex justify-between items-center">
            <h3 class="fithub-heading text-xl text-white">WEIGHT & BODY COMPOSITION</h3>
            <button onclick="openModal('logProgressModal')" class="btn-orange text-xs px-3 py-1.5">
              <i class="fa-solid fa-plus mr-1"></i> Log Weigh-In
            </button>
          </div>
          <div id="progressScreenContainer"></div>
        </div>

        <!-- TAB 5: GOALS -->
        <div id="mSec-goals" class="space-y-4 hidden">
          <div class="flex justify-between items-center">
            <h3 class="fithub-heading text-xl text-white">FITNESS MILESTONES</h3>
            <button onclick="openModal('createGoalModal')" class="btn-orange text-xs px-3 py-1.5">
              <i class="fa-solid fa-plus mr-1"></i> Create Goal
            </button>
          </div>
          <div id="goalsScreenContainer"></div>
        </div>

        <!-- TAB 6: QR ACCESS PASS -->
        <div id="mSec-qr" class="space-y-4 hidden">
          <h3 class="fithub-heading text-xl text-white">DIGITAL ACCESS PASS</h3>
          <div id="qrScreenContainer"></div>
        </div>

        <!-- TAB 7: CLASSES & BILLING -->
        <div id="mSec-classes" class="space-y-6 hidden">
          <div>
            <h3 class="fithub-heading text-lg text-white mb-2">MY UPCOMING BOOKINGS</h3>
            <div id="bookingsContainer"></div>
          </div>
          <div>
            <h3 class="fithub-heading text-lg text-white mb-2">AVAILABLE GROUP SESSIONS</h3>
            <div id="availableClassesContainer" class="space-y-2"></div>
          </div>
          <div>
            <h3 class="fithub-heading text-lg text-white mb-2">INVOICES & PAYMENT RECEIPTS</h3>
            <div id="paymentsContainer"></div>
          </div>
        </div>

        <!-- TAB 8: AI COACH -->
        <div id="mSec-aicoach" class="space-y-4 hidden">
          <div class="glass-card p-5 border border-[#393939]">
            <div class="flex items-center space-x-3 mb-3">
              <div class="w-10 h-10 rounded-full bg-[#F0441D]/20 border border-[#F0441D]/40 flex items-center justify-center text-[#F0441D] text-lg font-bold">
                <i class="fa-solid fa-robot"></i>
              </div>
              <div>
                <h3 class="fithub-heading text-lg text-white" data-i18n="ai_coach_title">AI FITNESS COACH</h3>
                <p class="text-xs text-[#B5B5B5]" data-i18n="ai_coach_desc">Server-side Gemini AI grounded in your real profile, workout, and diet records.</p>
              </div>
            </div>

            <!-- Suggested Questions Chips -->
            <div class="mb-3">
              <span class="text-[10px] uppercase font-bold text-[#858585] block mb-1.5" data-i18n="suggested_questions">Suggested Questions:</span>
              <div id="aiSuggestedQuestions" class="flex flex-wrap gap-1.5 text-xs">
                <!-- Dynamically populated chips -->
              </div>
            </div>

            <!-- Chat box -->
            <div id="aiChatBox" class="h-72 overflow-y-auto bg-[#0A0A0A] p-4 rounded-xl border border-[#393939] space-y-3 text-xs mb-3">
              <div class="flex items-start space-x-2">
                <div class="bg-[#242424] p-3 rounded-xl max-w-[85%] text-white" id="aiWelcomeMessage">
                  👋 Hello! I am your FIT HUB AI Fitness Coach. Ask me about your assigned workout, macro targets, attendance, or upcoming classes!
                </div>
              </div>
            </div>

            <!-- Loading indicator -->
            <div id="aiLoadingIndicator" class="hidden flex items-center space-x-2 px-3 py-1.5 mb-2 text-xs text-[#B5B5B5] bg-[#171717] rounded-lg border border-[#2c2c2c] w-fit">
              <span class="w-2 h-2 rounded-full bg-[#F0441D] animate-ping"></span>
              <span id="aiLoadingText">Coach is analyzing your data...</span>
            </div>

            <!-- Error banner with retry button -->
            <div id="aiErrorContainer" class="hidden p-3 rounded-xl text-xs bg-red-500/15 border border-red-500/30 text-red-300 flex items-center justify-between gap-2 mb-3">
              <span id="aiErrorMessage">AI Coach is temporarily unavailable. Please try again later.</span>
              <button id="aiRetryBtn" onclick="retryAiMessage()" class="btn-orange px-3 py-1 text-xs font-bold whitespace-nowrap">
                <i class="fa-solid fa-rotate-right mr-1"></i> <span data-i18n="btn_retry">Retry</span>
              </button>
            </div>

            <div class="flex items-center space-x-2">
              <input type="text" id="aiInput" data-i18n-placeholder="ai_input_placeholder" placeholder="Ask your coach anything..." class="input-field flex-1 p-2.5 text-xs" onkeydown="if(event.key==='Enter') sendAiMessage()">
              <button onclick="sendAiMessage()" id="aiSendBtn" class="btn-orange px-4 py-2.5 text-xs font-bold flex items-center gap-1.5">
                <i class="fa-solid fa-paper-plane"></i> <span data-i18n="btn_send">Send</span>
              </button>
            </div>
          </div>
        </div>

        <!-- TAB 9: SUPPORT -->
        <div id="mSec-support" class="space-y-4 hidden">
          <div class="flex justify-between items-center">
            <h3 class="fithub-heading text-xl text-white">SUPPORT TICKETS</h3>
            <button onclick="openModal('createTicketModal')" class="btn-orange text-xs px-3 py-1.5">
              <i class="fa-solid fa-plus mr-1"></i> New Ticket
            </button>
          </div>
          <div id="supportTicketsContainer"></div>
        </div>

      </div>

      <!-- ============================================================= -->
      <!-- 2. GYM ADMIN DASHBOARD CONTAINER -->
      <!-- ============================================================= -->
      <div id="subview-admin" class="space-y-6 hidden">
        <div class="flex flex-wrap items-center justify-between gap-4 border-b border-[#393939] pb-4">
          <div>
            <span class="text-xs text-[#F0441D] font-bold uppercase tracking-wider block">BRANCH OPERATIONS</span>
            <h2 class="fithub-heading text-2xl text-white mt-0.5">FIT HUB DOWNTOWN CENTRAL</h2>
            <p class="text-xs text-[#B5B5B5]">Plot 14, MG Road, Nariman Point • Mumbai</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button onclick="downloadReport('members')" class="btn-secondary text-xs px-2.5 py-1.5 font-semibold">
              <i class="fa-solid fa-file-csv mr-1 text-[#F0441D]"></i> Roster CSV
            </button>
            <button onclick="downloadReport('inventory')" class="btn-secondary text-xs px-2.5 py-1.5 font-semibold">
              <i class="fa-solid fa-boxes-stacked mr-1 text-[#F0441D]"></i> Stock CSV
            </button>
            <button onclick="triggerAutomations()" class="btn-secondary text-xs px-2.5 py-1.5 font-semibold">
              <i class="fa-solid fa-bolt mr-1 text-amber-400"></i> Run Jobs
            </button>
            <button onclick="openModal('addInventoryModal')" class="btn-secondary text-xs px-2.5 py-1.5 font-semibold">
              <i class="fa-solid fa-box-open mr-1"></i> New SKU
            </button>
            <button onclick="openModal('addLeadModal')" class="btn-orange text-xs px-2.5 py-1.5 font-semibold">
              <i class="fa-solid fa-user-plus mr-1"></i> New Lead
            </button>
          </div>
        </div>

        <!-- KPI Grid -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          <div class="glass-card p-4">
            <span class="text-[10px] text-[#858585] uppercase font-bold block">TOTAL MEMBERS</span>
            <span id="admTotalMembers" class="text-2xl font-black text-white mt-1 block">0</span>
            <span class="text-[10px] text-emerald-400 font-bold block mt-0.5">Active Database Roster</span>
          </div>
          <div class="glass-card p-4">
            <span class="text-[10px] text-[#858585] uppercase font-bold block">ACTIVE MEMBERSHIPS</span>
            <span id="admActiveMembers" class="text-2xl font-black text-emerald-400 mt-1 block">0</span>
            <span id="admExpiredMembers" class="text-[10px] text-red-400 font-bold block mt-0.5">0 Expired</span>
          </div>
          <div class="glass-card p-4">
            <span class="text-[10px] text-[#858585] uppercase font-bold block">TODAY'S CHECK-INS</span>
            <span id="admTodayCheckins" class="text-2xl font-black text-white mt-1 block">0</span>
            <span class="text-[10px] text-[#F0441D] font-bold block mt-0.5">Turnstile Gate Scans</span>
          </div>
          <div class="glass-card p-4">
            <span class="text-[10px] text-[#858585] uppercase font-bold block">NET BRANCH REVENUE</span>
            <span id="admTotalRevenue" class="text-2xl font-black text-white mt-1 block">₹0</span>
            <span id="admNetIncome" class="text-[10px] text-[#B5B5B5] font-bold block mt-0.5">Net Profit/Loss</span>
          </div>
        </div>

        <!-- Members Roster Table -->
        <div class="glass-card p-5">
          <div class="flex justify-between items-center mb-3">
            <h3 class="fithub-heading text-lg text-white">MEMBER ROSTER</h3>
            <button onclick="fetchAdminDashboard()" class="text-xs text-[#F0441D] hover:underline">
              <i class="fa-solid fa-rotate mr-1"></i> Refresh
            </button>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="text-[#858585] uppercase border-b border-[#393939] text-[10px]">
                <tr>
                  <th class="py-2.5">Member Name</th>
                  <th>Email</th>
                  <th>Active Plan</th>
                  <th>Status</th>
                  <th>Days Left</th>
                </tr>
              </thead>
              <tbody id="admMemberTableBody" class="divide-y divide-[#2c2c2c] text-[#B5B5B5]">
                <tr><td colspan="5" class="py-4 text-center text-[#858585]">Loading roster...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- CRM Leads Pipeline & Inventory -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="glass-card p-5">
            <h3 class="fithub-heading text-lg text-white mb-3">CRM LEADS PIPELINE</h3>
            <div id="admLeadsContainer" class="space-y-2 text-xs"></div>
          </div>
          <div class="glass-card p-5">
            <h3 class="fithub-heading text-lg text-white mb-3">SUPPLEMENTS & INVENTORY</h3>
            <div id="admInventoryContainer" class="space-y-2 text-xs"></div>
          </div>
        </div>
      </div>

      <!-- ============================================================= -->
      <!-- 2B. TRAINER DASHBOARD CONTAINER -->
      <!-- ============================================================= -->
      <div id="subview-trainer" class="space-y-6 hidden">
        <div class="flex flex-wrap items-center justify-between gap-4 border-b border-[#393939] pb-4">
          <div>
            <span class="text-xs text-[#F0441D] font-bold uppercase tracking-wider block">ATHLETE COACHING & SESSIONS</span>
            <h2 id="trainerPortalHeading" class="fithub-heading text-2xl text-white mt-0.5">TRAINER PERFORMANCE HUB</h2>
            <p id="trainerPortalSub" class="text-xs text-[#B5B5B5]">Coach Rahul • Strength & Conditioning / Hypertrophy Specialist</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button onclick="fetchTrainerDashboard()" class="btn-secondary text-xs px-2.5 py-1.5 font-semibold">
              <i class="fa-solid fa-rotate mr-1"></i> Refresh
            </button>
            <button onclick="openModal('assignRoutineModal')" class="btn-orange text-xs px-2.5 py-1.5 font-semibold">
              <i class="fa-solid fa-dumbbell mr-1"></i> Assign Routine
            </button>
            <button onclick="openModal('assignMacroModal')" class="btn-secondary text-xs px-2.5 py-1.5 font-semibold">
              <i class="fa-solid fa-utensils mr-1"></i> Set Macros
            </button>
            <button onclick="openModal('addCoachingNoteModal')" class="btn-secondary text-xs px-2.5 py-1.5 font-semibold">
              <i class="fa-solid fa-clipboard-check mr-1 text-[#F0441D]"></i> Log Note
            </button>
          </div>
        </div>

        <!-- Trainer KPI Grid -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          <div class="glass-card p-4">
            <span class="text-[10px] text-[#858585] uppercase font-bold block">ASSIGNED ATHLETES</span>
            <span id="trainerActiveClients" class="text-2xl font-black text-white mt-1 block">0</span>
            <span class="text-[10px] text-emerald-400 font-bold block mt-0.5">Active Trainees</span>
          </div>
          <div class="glass-card p-4">
            <span class="text-[10px] text-[#858585] uppercase font-bold block">SESSIONS TODAY</span>
            <span id="trainerSessionsToday" class="text-2xl font-black text-[#F0441D] mt-1 block">0</span>
            <span class="text-[10px] text-[#B5B5B5] font-bold block mt-0.5">1-on-1 PT Consultations</span>
          </div>
          <div class="glass-card p-4">
            <span class="text-[10px] text-[#858585] uppercase font-bold block">AVG CLIENT ADHERENCE</span>
            <span id="trainerAdherenceRate" class="text-2xl font-black text-emerald-400 mt-1 block">93%</span>
            <span class="text-[10px] text-white font-bold block mt-0.5">Workout Completion</span>
          </div>
          <div class="glass-card p-4">
            <span class="text-[10px] text-[#858585] uppercase font-bold block">ACTIVE PROTOCOLS</span>
            <span id="trainerActiveProtocols" class="text-2xl font-black text-white mt-1 block">4</span>
            <span class="text-[10px] text-[#B5B5B5] font-bold block mt-0.5">Push/Pull/Legs Splits</span>
          </div>
        </div>

        <!-- Assigned Trainees & Training Logs -->
        <div class="glass-card p-5">
          <div class="flex justify-between items-center mb-3">
            <h3 class="fithub-heading text-lg text-white">MY ATHLETES & TRAINING PROGRESS</h3>
            <span class="text-xs text-[#858585]">Authorized Trainee Fitness Data Only</span>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="text-[#858585] uppercase border-b border-[#393939] text-[10px]">
                <tr>
                  <th class="py-2.5">Athlete</th>
                  <th>Current Goal</th>
                  <th>Assigned Routine</th>
                  <th>Macro Protocol</th>
                  <th>Streak</th>
                  <th>Adherence</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody id="trainerTraineesTableBody" class="divide-y divide-[#2c2c2c] text-[#B5B5B5]">
                <tr><td colspan="7" class="py-4 text-center text-[#858585]">Loading trainees...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Schedule & Feedback Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- PT Schedule & Availability -->
          <div class="glass-card p-5">
            <div class="flex justify-between items-center mb-3">
              <h3 class="fithub-heading text-lg text-white">TODAY'S PT SCHEDULE & AVAILABILITY</h3>
              <span class="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-bold">On Duty</span>
            </div>
            <div id="trainerScheduleContainer" class="space-y-2 text-xs"></div>
          </div>

          <!-- Coaching Feedback & Progress Notes -->
          <div class="glass-card p-5">
            <div class="flex justify-between items-center mb-3">
              <h3 class="fithub-heading text-lg text-white">COACHING FEEDBACK & LOGS</h3>
              <button onclick="openModal('addCoachingNoteModal')" class="text-xs text-[#F0441D] hover:underline font-bold">+ New Note</button>
            </div>
            <div id="trainerFeedbackContainer" class="space-y-2 text-xs"></div>
          </div>
        </div>
      </div>

      <!-- ============================================================= -->
      <!-- 3. SUPER ADMIN DASHBOARD CONTAINER -->
      <!-- ============================================================= -->
      <div id="subview-superadmin" class="space-y-6 hidden">
        <div class="border-b border-[#393939] pb-4">
          <span class="text-xs text-[#F0441D] font-bold uppercase tracking-wider block">ENTERPRISE PLATFORM CONTROL</span>
          <h2 class="fithub-heading text-2xl text-white mt-0.5">FIT HUB GLOBAL MANAGEMENT</h2>
          <p class="text-xs text-[#B5B5B5]">Centralized platform governance across all gym franchises and regional branches.</p>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          <div class="glass-card p-4">
            <span class="text-[10px] text-[#858585] uppercase font-bold block">GYMS</span>
            <span id="supGymsCount" class="text-2xl font-black text-white mt-1 block">1</span>
            <span class="text-[10px] text-emerald-400 font-bold block mt-0.5">Registered Franchises</span>
          </div>
          <div class="glass-card p-4">
            <span class="text-[10px] text-[#858585] uppercase font-bold block">BRANCHES</span>
            <span id="supBranchesCount" class="text-2xl font-black text-white mt-1 block">3</span>
            <span class="text-[10px] text-emerald-400 font-bold block mt-0.5">Locations Active</span>
          </div>
          <div class="glass-card p-4">
            <span class="text-[10px] text-[#858585] uppercase font-bold block">TOTAL USERS</span>
            <span id="supUsersCount" class="text-2xl font-black text-white mt-1 block">0</span>
            <span class="text-[10px] text-[#858585] font-bold block mt-0.5">Global Profiles</span>
          </div>
          <div class="glass-card p-4">
            <span class="text-[10px] text-[#858585] uppercase font-bold block">PLATFORM REVENUE</span>
            <span id="supRevenue" class="text-2xl font-black text-[#F0441D] mt-1 block">₹0</span>
            <span class="text-[10px] text-[#858585] font-bold block mt-0.5">Gross Transactions</span>
          </div>
        </div>

        <!-- Audit Trail -->
        <div class="glass-card p-5">
          <h3 class="fithub-heading text-lg text-white mb-3">SYSTEM AUDIT TRAIL (IMMUTABLE LOGS)</h3>
          <div id="supAuditLogsContainer" class="space-y-2 text-xs"></div>
        </div>
      </div>

    </div>

  </div>

  <!-- MODALS -->

  <!-- Modal: Assign Plan -->
  <div id="assignPlanModal" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 hidden">
    <div class="glass-card w-full max-w-md p-6 space-y-4">
      <div class="flex justify-between items-center">
        <h3 class="fithub-heading text-xl text-white">SELECT MEMBERSHIP PLAN</h3>
        <button onclick="closeModal('assignPlanModal')" class="text-[#858585] hover:text-white"><i class="fa-solid fa-xmark text-lg"></i></button>
      </div>
      <div class="space-y-2.5 text-xs">
        <div onclick="apiAssignPlan('plan-monthly-silver')" class="p-3.5 bg-[#242424] hover:border-[#F0441D] border border-[#393939] rounded-xl cursor-pointer flex justify-between items-center transition">
          <div>
            <strong class="text-white text-sm block">Silver 1-Month</strong>
            <span class="text-[#858585]">Full floor gym access • 30 Days</span>
          </div>
          <span class="text-[#F0441D] font-black text-base">₹2,999</span>
        </div>
        <div onclick="apiAssignPlan('plan-quarterly-gold')" class="p-3.5 bg-[#242424] hover:border-[#F0441D] border border-[#393939] rounded-xl cursor-pointer flex justify-between items-center transition">
          <div>
            <strong class="text-white text-sm block">Gold 3-Months</strong>
            <span class="text-[#858585]">Floor + Yoga + Steam • 90 Days</span>
          </div>
          <span class="text-[#F0441D] font-black text-base">₹7,499</span>
        </div>
        <div onclick="apiAssignPlan('plan-yearly-elite')" class="p-3.5 bg-[#242424] hover:border-[#F0441D] border border-[#393939] rounded-xl cursor-pointer flex justify-between items-center transition">
          <div>
            <strong class="text-white text-sm block">Elite 12-Month Pro + PT Pass</strong>
            <span class="text-[#858585]">CrossFit, Zumba, Sauna + 12 PT Sessions • 365 Days</span>
          </div>
          <span class="text-[#F0441D] font-black text-base">₹21,999</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Modal: Log Progress -->
  <div id="logProgressModal" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 hidden">
    <div class="glass-card w-full max-w-sm p-6 space-y-4">
      <div class="flex justify-between items-center">
        <h3 class="fithub-heading text-lg text-white">RECORD BODY WEIGH-IN</h3>
        <button onclick="closeModal('logProgressModal')" class="text-[#858585] hover:text-white"><i class="fa-solid fa-xmark text-lg"></i></button>
      </div>
      <div class="space-y-3">
        <div>
          <label class="text-[10px] uppercase font-bold text-[#858585]">Weight (kg)</label>
          <input type="number" id="progressWeightInput" step="0.1" class="input-field w-full p-2.5 text-xs" placeholder="e.g. 74.5">
        </div>
        <div>
          <label class="text-[10px] uppercase font-bold text-[#858585]">Height (cm)</label>
          <input type="number" id="progressHeightInput" value="175" class="input-field w-full p-2.5 text-xs">
        </div>
        <button onclick="apiSubmitProgress()" class="btn-orange w-full py-2.5 text-xs font-bold">
          Save Weigh-In
        </button>
      </div>
    </div>
  </div>

  <!-- Modal: Create Goal -->
  <div id="createGoalModal" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 hidden">
    <div class="glass-card w-full max-w-sm p-6 space-y-4">
      <div class="flex justify-between items-center">
        <h3 class="fithub-heading text-lg text-white">CREATE FITNESS GOAL</h3>
        <button onclick="closeModal('createGoalModal')" class="text-[#858585] hover:text-white"><i class="fa-solid fa-xmark text-lg"></i></button>
      </div>
      <div class="space-y-3">
        <div>
          <label class="text-[10px] uppercase font-bold text-[#858585]">Goal Title</label>
          <input type="text" id="goalTitleInput" placeholder="e.g. Bench press 100 kg" class="input-field w-full p-2.5 text-xs">
        </div>
        <div>
          <label class="text-[10px] uppercase font-bold text-[#858585]">Target Date</label>
          <input type="text" id="goalDateInput" placeholder="e.g. 90 days / 2026-12-31" class="input-field w-full p-2.5 text-xs">
        </div>
        <button onclick="apiSubmitGoal()" class="btn-orange w-full py-2.5 text-xs font-bold">
          Save Milestone
        </button>
      </div>
    </div>
  </div>

  <!-- Modal: Create Ticket -->
  <div id="createTicketModal" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 hidden">
    <div class="glass-card w-full max-w-sm p-6 space-y-4">
      <div class="flex justify-between items-center">
        <h3 class="fithub-heading text-lg text-white">SUBMIT SUPPORT TICKET</h3>
        <button onclick="closeModal('createTicketModal')" class="text-[#858585] hover:text-white"><i class="fa-solid fa-xmark text-lg"></i></button>
      </div>
      <div class="space-y-3">
        <div>
          <label class="text-[10px] uppercase font-bold text-[#858585]">Subject</label>
          <input type="text" id="ticketSubjectInput" placeholder="Brief subject" class="input-field w-full p-2.5 text-xs">
        </div>
        <div>
          <label class="text-[10px] uppercase font-bold text-[#858585]">Category</label>
          <select id="ticketCategoryInput" class="input-field w-full p-2.5 text-xs">
            <option value="EQUIPMENT">Equipment Maintenance</option>
            <option value="PAYMENT">Billing & Payment</option>
            <option value="MEMBERSHIP">Membership Access</option>
            <option value="TRAINER">Trainer & Coaching</option>
            <option value="GENERAL">General Enquiry</option>
          </select>
        </div>
        <div>
          <label class="text-[10px] uppercase font-bold text-[#858585]">Description</label>
          <textarea id="ticketDescriptionInput" rows="3" placeholder="Describe the issue in detail..." class="input-field w-full p-2.5 text-xs"></textarea>
        </div>
        <button onclick="apiSubmitTicket()" class="btn-orange w-full py-2.5 text-xs font-bold">
          Submit Ticket
        </button>
      </div>
    </div>
  </div>

  <!-- Modal: Notifications -->
  <div id="notificationsModal" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 hidden">
    <div class="glass-card w-full max-w-md p-6 space-y-4">
      <div class="flex justify-between items-center">
        <h3 class="fithub-heading text-lg text-white">NOTIFICATIONS</h3>
        <button onclick="closeModal('notificationsModal')" class="text-[#858585] hover:text-white"><i class="fa-solid fa-xmark text-lg"></i></button>
      </div>
      <div id="notificationsList" class="space-y-2 text-xs max-h-72 overflow-y-auto"></div>
    </div>
  </div>

  <!-- Modal: Add Inventory SKU -->
  <div id="addInventoryModal" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 hidden">
    <div class="glass-card w-full max-w-sm p-6 space-y-4">
      <div class="flex justify-between items-center">
        <h3 class="fithub-heading text-lg text-white">NEW INVENTORY SKU</h3>
        <button onclick="closeModal('addInventoryModal')" class="text-[#858585] hover:text-white"><i class="fa-solid fa-xmark text-lg"></i></button>
      </div>
      <div class="space-y-3">
        <div>
          <label class="text-[10px] uppercase font-bold text-[#858585]">Product Name</label>
          <input type="text" id="invNameInput" placeholder="e.g. Whey Protein 1kg" class="input-field w-full p-2.5 text-xs">
        </div>
        <div>
          <label class="text-[10px] uppercase font-bold text-[#858585]">SKU Code</label>
          <input type="text" id="invSkuInput" placeholder="e.g. SUP-WHEY-100" class="input-field w-full p-2.5 text-xs">
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-[10px] uppercase font-bold text-[#858585]">Initial Stock</label>
            <input type="number" id="invStockInput" value="10" class="input-field w-full p-2.5 text-xs">
          </div>
          <div>
            <label class="text-[10px] uppercase font-bold text-[#858585]">Min Alert Qty</label>
            <input type="number" id="invMinInput" value="5" class="input-field w-full p-2.5 text-xs">
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-[10px] uppercase font-bold text-[#858585]">Cost Price (₹)</label>
            <input type="number" id="invCostInput" value="1500" class="input-field w-full p-2.5 text-xs">
          </div>
          <div>
            <label class="text-[10px] uppercase font-bold text-[#858585]">Retail Price (₹)</label>
            <input type="number" id="invPriceInput" value="2499" class="input-field w-full p-2.5 text-xs">
          </div>
        </div>
        <button onclick="apiAddInventory()" class="btn-orange w-full py-2.5 text-xs font-bold">
          Save Product SKU
        </button>
      </div>
    </div>
  </div>

  <!-- Modal: Add CRM Lead -->
  <div id="addLeadModal" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 hidden">
    <div class="glass-card w-full max-w-sm p-6 space-y-4">
      <div class="flex justify-between items-center">
        <h3 class="fithub-heading text-lg text-white">NEW CRM PROSPECT</h3>
        <button onclick="closeModal('addLeadModal')" class="text-[#858585] hover:text-white"><i class="fa-solid fa-xmark text-lg"></i></button>
      </div>
      <div class="space-y-3">
        <div>
          <label class="text-[10px] uppercase font-bold text-[#858585]">Prospect Name</label>
          <input type="text" id="leadNameInput" placeholder="Full name" class="input-field w-full p-2.5 text-xs">
        </div>
        <div>
          <label class="text-[10px] uppercase font-bold text-[#858585]">Phone / WhatsApp</label>
          <input type="tel" id="leadPhoneInput" placeholder="+91 98765 00000" class="input-field w-full p-2.5 text-xs">
        </div>
        <div>
          <label class="text-[10px] uppercase font-bold text-[#858585]">Email (Optional)</label>
          <input type="email" id="leadEmailInput" placeholder="prospect@example.com" class="input-field w-full p-2.5 text-xs">
        </div>
        <div>
          <label class="text-[10px] uppercase font-bold text-[#858585]">Interested Plan</label>
          <select id="leadPlanInput" class="input-field w-full p-2.5 text-xs">
            <option value="Elite 12-Month Pro">Elite 12-Month Pro</option>
            <option value="Gold 3-Months">Gold 3-Months</option>
            <option value="Silver 1-Month">Silver 1-Month</option>
            <option value="Personal Training Pass">Personal Training Pass</option>
          </select>
        </div>
        <button onclick="apiAddLead()" class="btn-orange w-full py-2.5 text-xs font-bold">
          Register Prospect
        </button>
      </div>
    </div>
  </div>

  <!-- Modal: Stock In / Out Operations -->
  <div id="stockMovementModal" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 hidden">
    <div class="glass-card w-full max-w-sm p-6 space-y-4">
      <div class="flex justify-between items-center">
        <h3 class="fithub-heading text-lg text-white">STOCK IN / OUT OPERATION</h3>
        <button onclick="closeModal('stockMovementModal')" class="text-[#858585] hover:text-white"><i class="fa-solid fa-xmark text-lg"></i></button>
      </div>
      <div class="space-y-3">
        <div>
          <label class="text-[10px] uppercase font-bold text-[#858585]">Select SKU / Product</label>
          <select id="stockMoveProductSelect" class="input-field w-full p-2.5 text-xs"></select>
        </div>
        <div>
          <label class="text-[10px] uppercase font-bold text-[#858585]">Movement Type</label>
          <select id="stockMoveTypeSelect" class="input-field w-full p-2.5 text-xs">
            <option value="STOCK_IN">Stock In (Restock / Purchase)</option>
            <option value="STOCK_OUT">Stock Out (Retail Sale / Consumption)</option>
            <option value="ADJUSTMENT">Inventory Audit Adjustment</option>
            <option value="RETURN">Customer Return / Restock</option>
          </select>
        </div>
        <div>
          <label class="text-[10px] uppercase font-bold text-[#858585]">Quantity Units</label>
          <input type="number" id="stockMoveQtyInput" value="5" min="1" class="input-field w-full p-2.5 text-xs">
        </div>
        <div>
          <label class="text-[10px] uppercase font-bold text-[#858585]">Reason / Reference</label>
          <input type="text" id="stockMoveReasonInput" placeholder="e.g. Supplier Shipment PO-982" class="input-field w-full p-2.5 text-xs">
        </div>
        <button onclick="apiRecordStockMovement()" class="btn-orange w-full py-2.5 text-xs font-bold">
          Submit Stock Movement
        </button>
      </div>
    </div>
  </div>

  <!-- Modal: Assign Routine to Athlete -->
  <div id="assignRoutineModal" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 hidden">
    <div class="glass-card w-full max-w-md p-6 space-y-4">
      <div class="flex justify-between items-center">
        <h3 class="fithub-heading text-lg text-white">ASSIGN WORKOUT ROUTINE</h3>
        <button onclick="closeModal('assignRoutineModal')" class="text-[#858585] hover:text-white"><i class="fa-solid fa-xmark text-lg"></i></button>
      </div>
      <div class="space-y-3">
        <div>
          <label class="text-[10px] uppercase font-bold text-[#858585]">Select Athlete</label>
          <select id="routineAthleteSelect" class="input-field w-full p-2.5 text-xs"></select>
        </div>
        <div>
          <label class="text-[10px] uppercase font-bold text-[#858585]">Routine Title</label>
          <input type="text" id="routineTitleInput" value="Pro Strength & Hypertrophy Split" class="input-field w-full p-2.5 text-xs">
        </div>
        <div>
          <label class="text-[10px] uppercase font-bold text-[#858585]">Primary Exercise 1</label>
          <div class="grid grid-cols-3 gap-2">
            <input type="text" id="routineEx1Name" value="Barbell Bench Press" placeholder="Exercise" class="input-field p-2 text-xs">
            <input type="text" id="routineEx1Sets" value="4 sets x 8-10 reps" placeholder="Sets/Reps" class="input-field p-2 text-xs">
            <input type="number" id="routineEx1Weight" value="80" placeholder="Weight kg" class="input-field p-2 text-xs">
          </div>
        </div>
        <div>
          <label class="text-[10px] uppercase font-bold text-[#858585]">Primary Exercise 2</label>
          <div class="grid grid-cols-3 gap-2">
            <input type="text" id="routineEx2Name" value="Incline DB Press" placeholder="Exercise" class="input-field p-2 text-xs">
            <input type="text" id="routineEx2Sets" value="3 sets x 10-12 reps" placeholder="Sets/Reps" class="input-field p-2 text-xs">
            <input type="number" id="routineEx2Weight" value="28" placeholder="Weight kg" class="input-field p-2 text-xs">
          </div>
        </div>
        <button onclick="apiTrainerAssignWorkout()" class="btn-orange w-full py-2.5 text-xs font-bold">
          Assign Routine to Athlete
        </button>
      </div>
    </div>
  </div>

  <!-- Modal: Assign Macro Protocol -->
  <div id="assignMacroModal" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 hidden">
    <div class="glass-card w-full max-w-sm p-6 space-y-4">
      <div class="flex justify-between items-center">
        <h3 class="fithub-heading text-lg text-white">SET MACRO NUTRITION PROTOCOL</h3>
        <button onclick="closeModal('assignMacroModal')" class="text-[#858585] hover:text-white"><i class="fa-solid fa-xmark text-lg"></i></button>
      </div>
      <div class="space-y-3">
        <div>
          <label class="text-[10px] uppercase font-bold text-[#858585]">Select Athlete</label>
          <select id="macroAthleteSelect" class="input-field w-full p-2.5 text-xs"></select>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-[10px] uppercase font-bold text-[#858585]">Target Calories</label>
            <input type="number" id="macroCalsInput" value="2600" class="input-field w-full p-2.5 text-xs">
          </div>
          <div>
            <label class="text-[10px] uppercase font-bold text-[#858585]">Protein (g)</label>
            <input type="number" id="macroProteinInput" value="180" class="input-field w-full p-2.5 text-xs">
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-[10px] uppercase font-bold text-[#858585]">Carbohydrates (g)</label>
            <input type="number" id="macroCarbsInput" value="280" class="input-field w-full p-2.5 text-xs">
          </div>
          <div>
            <label class="text-[10px] uppercase font-bold text-[#858585]">Fats (g)</label>
            <input type="number" id="macroFatInput" value="65" class="input-field w-full p-2.5 text-xs">
          </div>
        </div>
        <div>
          <label class="text-[10px] uppercase font-bold text-[#858585]">Hydration Target (ml)</label>
          <input type="number" id="macroWaterInput" value="3500" class="input-field w-full p-2.5 text-xs">
        </div>
        <button onclick="apiTrainerAssignDiet()" class="btn-orange w-full py-2.5 text-xs font-bold">
          Prescribe Macro Protocol
        </button>
      </div>
    </div>
  </div>

  <!-- Modal: Add Coaching Note -->
  <div id="addCoachingNoteModal" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 hidden">
    <div class="glass-card w-full max-w-sm p-6 space-y-4">
      <div class="flex justify-between items-center">
        <h3 class="fithub-heading text-lg text-white">LOG COACHING NOTE</h3>
        <button onclick="closeModal('addCoachingNoteModal')" class="text-[#858585] hover:text-white"><i class="fa-solid fa-xmark text-lg"></i></button>
      </div>
      <div class="space-y-3">
        <div>
          <label class="text-[10px] uppercase font-bold text-[#858585]">Select Athlete</label>
          <select id="noteAthleteSelect" class="input-field w-full p-2.5 text-xs"></select>
        </div>
        <div>
          <label class="text-[10px] uppercase font-bold text-[#858585]">Feedback & Form Correction</label>
          <textarea id="coachingNoteText" rows="3" placeholder="Form notes, progress feedback, or motivational cues..." class="input-field w-full p-2.5 text-xs"></textarea>
        </div>
        <div>
          <label class="text-[10px] uppercase font-bold text-[#858585]">Session Rating</label>
          <select id="coachingNoteRating" class="input-field w-full p-2.5 text-xs">
            <option value="5">⭐⭐⭐⭐⭐ Elite Performance (5/5)</option>
            <option value="4">⭐⭐⭐⭐ Solid Progression (4/5)</option>
            <option value="3">⭐⭐⭐ Good Effort, Form Needs Polish (3/5)</option>
          </select>
        </div>
        <button onclick="apiTrainerAddFeedback()" class="btn-orange w-full py-2.5 text-xs font-bold">
          Save Coaching Feedback
        </button>
      </div>
    </div>
  </div>

  <!-- Modal: CRM Follow-Up Note -->
  <div id="leadFollowUpModal" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 hidden">
    <div class="glass-card w-full max-w-sm p-6 space-y-4">
      <div class="flex justify-between items-center">
        <h3 class="fithub-heading text-lg text-white">CRM PROSPECT FOLLOW-UP</h3>
        <button onclick="closeModal('leadFollowUpModal')" class="text-[#858585] hover:text-white"><i class="fa-solid fa-xmark text-lg"></i></button>
      </div>
      <div class="space-y-3">
        <input type="hidden" id="followUpLeadId">
        <div>
          <label class="text-[10px] uppercase font-bold text-[#858585]">Stage Status</label>
          <select id="followUpStageSelect" class="input-field w-full p-2.5 text-xs">
            <option value="NEW">NEW</option>
            <option value="CONTACTED">CONTACTED</option>
            <option value="TRIAL">TRIAL</option>
            <option value="INTERESTED">INTERESTED</option>
            <option value="CONVERTED">CONVERTED (Active Member)</option>
            <option value="LOST">LOST</option>
          </select>
        </div>
        <div>
          <label class="text-[10px] uppercase font-bold text-[#858585]">Next Follow-up Date</label>
          <input type="date" id="followUpDateInput" class="input-field w-full p-2.5 text-xs">
        </div>
        <div>
          <label class="text-[10px] uppercase font-bold text-[#858585]">Interaction Notes</label>
          <textarea id="followUpNotesInput" rows="3" placeholder="Discussion notes, goals discussed, trial scheduled..." class="input-field w-full p-2.5 text-xs"></textarea>
        </div>
        <button onclick="apiSubmitLeadFollowUp()" class="btn-orange w-full py-2.5 text-xs font-bold">
          Update Prospect Status
        </button>
      </div>
    </div>
  </div>

  <!-- Modal: Printable / PDF-Ready Reports Dialog -->
  <div id="reportsPrintModal" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 hidden">
    <div class="glass-card w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
      <div class="flex justify-between items-center border-b border-[#393939] pb-3">
        <div class="flex items-center space-x-2">
          <span class="fithub-logo text-xl"><span class="fit">FIT</span><span class="hub">HUB</span></span>
          <span class="text-xs text-[#858585]">| Executive Operations Report</span>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="window.print()" class="btn-orange text-xs px-3 py-1 font-bold">
            <i class="fa-solid fa-print mr-1"></i> Print / Save PDF
          </button>
          <button onclick="closeModal('reportsPrintModal')" class="text-[#858585] hover:text-white"><i class="fa-solid fa-xmark text-lg"></i></button>
        </div>
      </div>
      <div id="reportsPrintContent" class="space-y-4 text-xs"></div>
    </div>
  </div>

  <!-- Modal: iOS PWA Installation Guide -->
  <div id="pwaIosModal" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 hidden">
    <div class="glass-card w-full max-w-sm p-6 space-y-4">
      <div class="flex justify-between items-center">
        <h3 class="fithub-heading text-lg text-white">INSTALL FITHUB ON IOS</h3>
        <button onclick="closeModal('pwaIosModal')" class="text-[#858585] hover:text-white"><i class="fa-solid fa-xmark text-lg"></i></button>
      </div>
      <div class="space-y-3 text-xs text-[#B5B5B5]">
        <p>Install FitHub on your iPhone or iPad home screen for instant full-screen access:</p>
        <ol class="list-decimal list-inside space-y-1.5 text-white">
          <li>Tap the <strong class="text-[#F0441D]">Share</strong> button in Safari's bottom toolbar (<i class="fa-solid fa-arrow-up-from-bracket"></i>).</li>
          <li>Scroll down and tap <strong class="text-white">Add to Home Screen</strong>.</li>
          <li>Tap <strong class="text-[#F0441D]">Add</strong> in the top-right corner.</li>
        </ol>
        <button onclick="closeModal('pwaIosModal')" class="btn-secondary w-full py-2 mt-2 font-semibold">
          Got it
        </button>
      </div>
    </div>
  </div>

  <!-- CLIENT LOGIC & REST API BRIDGE -->
  <script>
    let authToken = localStorage.getItem('fithub_auth_token') || null;
    let currentUser = null;
    let currentRole = 'MEMBER';
    let currentLang = localStorage.getItem('fithub_lang') || 'en';
    let authMode = 'signin';
    let memberDashboardData = null;
    let lastAiQuestion = '';

    // Centralized Application Translation Dictionary
    const translations = {
      en: {
        brand_subtitle: "Enterprise Gym Management",
        btn_install: "Install App",
        btn_refresh: "Refresh",
        status_authenticated: "Authenticated",
        offline_banner: "Offline Mode — Cached FitHub data is active. Reconnect to sync turnstile check-ins and payments.",
        tab_overview: "Dashboard",
        tab_workout: "Workout",
        tab_diet: "Diet",
        tab_progress: "Progress & BMI",
        tab_goals: "Goals",
        tab_qr: "QR Pass",
        tab_classes: "Classes & Billing",
        tab_aicoach: "🤖 AI Coach",
        tab_support: "Support",
        login_welcome: "WELCOME BACK",
        login_create: "CREATE ACCOUNT",
        login_sub_signin: "Sign in to your authenticated account",
        login_sub_register: "Register your clean member account",
        label_email: "Email / Mobile",
        label_password: "Password",
        label_fullname: "Full Name",
        btn_signin: "SIGN IN",
        btn_create_acc: "CREATE ACCOUNT",
        btn_forgot_pass: "Forgot Password?",
        prompt_have_acc: "Already have an account?",
        prompt_no_acc: "Don't have an account?",
        link_signin: "Sign In",
        link_register: "Create Account",
        back_to_roles: "Back to roles",
        role_select_title: "CHOOSE YOUR ROLE",
        role_select_sub: "Your complete fitness ecosystem",
        days_remaining: "DAYS REMAINING",
        attendance_streak: "ATTENDANCE STREAK",
        total_checkins: "TOTAL CHECK-INS",
        monthly_attendance: "MONTHLY ATTENDANCE",
        activate_plan: "Activate Plan",
        instant_turnstile: "Instant Turnstile Access",
        consecutive_days: "Consecutive Training",
        lifetime_scans: "Lifetime Scans",
        target_eighty: "Target 80%+",
        today_routine: "TODAY'S TRAINING ROUTINE",
        nutrition_macros: "NUTRITION & MACROS",
        view_routine: "View Full Routine",
        view_diet: "View Diet Plan",
        open_qr_pass: "Open Digital Pass",
        gate_pass_label: "Turnstile Gate Pass",
        active_member: "ACTIVE MEMBER",
        no_active_msh: "No active membership",
        no_active_msh_desc: "You do not have an active membership. Assign or purchase a plan to unlock turnstiles and training facilities.",
        no_workout_title: "No workout assigned yet",
        no_workout_sub: "Your trainer has not assigned a workout routine yet.",
        btn_request_routine: "Request / Assign Routine",
        no_diet_title: "No diet assigned yet",
        no_diet_sub: "Your nutritionist has not assigned a diet plan yet.",
        btn_request_diet: "Request Diet Plan",
        no_diet_desc: "No nutrition protocol or calorie target is currently active for your profile.",
        btn_set_nutrition: "Set Nutrition Targets",
        no_progress_title: "No progress records yet",
        no_progress_sub: "Track your body weight, BMI score, and measurements over time.",
        btn_log_weight: "Log Your First Weight",
        no_goals_title: "No goals yet",
        no_goals_sub: "Set target milestones for weight, personal strength records, or weekly workout frequency.",
        btn_create_goal: "Create Your First Goal",
        qr_locked_title: "Turnstile Gate Pass Locked",
        qr_locked_sub: "Digital QR access activates automatically when you have an active membership plan.",
        btn_activate_msh: "Activate Membership",
        no_bookings_title: "No upcoming bookings",
        no_bookings_sub: "You have not booked any group classes yet.",
        no_notifs: "No notifications.",
        no_tickets: "No support tickets.",
        branch_ops: "BRANCH OPERATIONS",
        total_members_kpi: "TOTAL MEMBERS",
        active_msh_kpi: "ACTIVE MEMBERSHIPS",
        today_checkins_kpi: "TODAY'S CHECK-INS",
        net_revenue_kpi: "NET BRANCH REVENUE",
        member_roster_title: "MEMBER ROSTER",
        crm_pipeline_title: "CRM LEADS PIPELINE",
        inventory_title: "SUPPLEMENTS & INVENTORY",
        btn_roster_csv: "Roster CSV",
        btn_stock_csv: "Stock CSV",
        btn_run_jobs: "Run Jobs",
        btn_new_sku: "New SKU",
        btn_new_lead: "New Lead",
        th_member_name: "Member Name",
        th_email: "Email",
        th_active_plan: "Active Plan",
        th_status: "Status",
        th_days_left: "Days Left",
        trainer_sub_title: "ATHLETE COACHING & SESSIONS",
        trainer_hub_title: "TRAINER PERFORMANCE HUB",
        assigned_athletes_kpi: "ASSIGNED ATHLETES",
        sessions_today_kpi: "SESSIONS TODAY",
        adherence_rate_kpi: "AVG CLIENT ADHERENCE",
        active_protocols_kpi: "ACTIVE PROTOCOLS",
        my_athletes_title: "MY ATHLETES & TRAINING PROGRESS",
        btn_assign_routine: "Assign Routine",
        btn_set_macros: "Set Macros",
        btn_log_note: "Log Note",
        th_athlete: "Athlete",
        th_current_goal: "Current Goal",
        th_assigned_routine: "Assigned Routine",
        th_macro_protocol: "Macro Protocol",
        th_streak: "Streak",
        th_adherence: "Adherence",
        th_action: "Action",
        superadmin_sub_title: "PLATFORM SUPER ADMINISTRATION",
        superadmin_hub_title: "ENTERPRISE ECOSYSTEM",
        kpi_total_gyms: "TOTAL GYMS",
        kpi_active_branches: "ACTIVE BRANCHES",
        kpi_total_users: "TOTAL USERS",
        kpi_platform_revenue: "PLATFORM REVENUE",
        superadmin_audit_title: "SYSTEM AUDIT TRAIL (IMMUTABLE LOGS)",
        ai_coach_title: "AI FITNESS COACH",
        ai_coach_desc: "Server-side Gemini AI grounded in your real profile, workout, and diet records.",
        suggested_questions: "Suggested Questions:",
        ai_welcome_msg: "👋 Hello! I am your FIT HUB AI Fitness Coach. Ask me about your assigned workout, macro targets, attendance, or upcoming classes!",
        ai_loading: "Coach is analyzing your data...",
        ai_error: "AI Coach is temporarily unavailable. Please try again later.",
        ai_input_placeholder: "Ask your coach anything...",
        btn_send: "Send",
        btn_retry: "Retry",
        notifs_modal_title: "NOTIFICATIONS",
        btn_mark_all_read: "Mark All Read",
        support_tickets_title: "SUPPORT TICKETS",
        btn_new_ticket: "New Ticket"
      },
      hi: {
        brand_subtitle: "एंटरप्राइज जिम प्रबंधन",
        btn_install: "ऐप इंस्टॉल करें",
        btn_refresh: "रिफ्रेश",
        status_authenticated: "प्रमाणित",
        offline_banner: "ऑफलाइन मोड — कैश्ड फिटहब डेटा सक्रिय है। टर्नस्टाइल चेक-इन और भुगतान सिंक करने के लिए पुनः कनेक्ट करें।",
        tab_overview: "डैशबोर्ड",
        tab_workout: "वर्कआउट",
        tab_diet: "डाइट",
        tab_progress: "प्रोग्रेस व बीएमआई",
        tab_goals: "लक्ष्य",
        tab_qr: "क्यूआर पास",
        tab_classes: "क्लासेज व बिलिंग",
        tab_aicoach: "🤖 एआई कोच",
        tab_support: "सहायता",
        login_welcome: "वापसी पर स्वागत है",
        login_create: "खाता बनाएं",
        login_sub_signin: "अपने प्रमाणित खाते में साइन इन करें",
        login_sub_register: "अपना नया सदस्य खाता पंजीकृत करें",
        label_email: "ईमेल / मोबाइल",
        label_password: "पासवर्ड",
        label_fullname: "पूरा नाम",
        btn_signin: "साइन इन",
        btn_create_acc: "खाता बनाएं",
        btn_forgot_pass: "पासवर्ड भूल गए?",
        prompt_have_acc: "क्या पहले से खाता है?",
        prompt_no_acc: "खाता नहीं है?",
        link_signin: "साइन इन करें",
        link_register: "खाता बनाएं",
        back_to_roles: "भूमिकाओं पर वापस",
        role_select_title: "अपनी भूमिका चुनें",
        role_select_sub: "आपका संपूर्ण फिटनेस इकोसिस्टम",
        days_remaining: "शेष दिन",
        attendance_streak: "उपस्थिति स्ट्रीक",
        total_checkins: "कुल चेक-इन",
        monthly_attendance: "मासिक उपस्थिति",
        activate_plan: "प्लान सक्रिय करें",
        instant_turnstile: "त्वरित टर्नस्टाइल एक्सेस",
        consecutive_days: "लगातार प्रशिक्षण",
        lifetime_scans: "कुल स्कैन",
        target_eighty: "लक्ष्य 80%+",
        today_routine: "आज का वर्कआउट रूटीन",
        nutrition_macros: "पोषण व मैक्रोज़",
        view_routine: "पूरा रूटीन देखें",
        view_diet: "डाइट प्लान देखें",
        open_qr_pass: "डिजिटल पास खोलें",
        gate_pass_label: "टर्नस्टाइल गेट पास",
        active_member: "सक्रिय सदस्य",
        no_active_msh: "कोई सक्रिय सदस्यता नहीं",
        no_active_msh_desc: "आपकी कोई सक्रिय सदस्यता नहीं है। टर्नस्टाइल और प्रशिक्षण सुविधाओं को अनलॉक करने के लिए प्लान सक्रिय करें।",
        no_workout_title: "अभी कोई वर्कआउट असाइन नहीं किया गया है",
        no_workout_sub: "आपके ट्रेनर ने अभी कोई वर्कआउट रूटीन असाइन नहीं किया है।",
        btn_request_routine: "रूटीन असाइन करें",
        no_diet_title: "अभी कोई डाइट प्लान असाइन नहीं किया गया है",
        no_diet_sub: "आपके न्यूट्रिशनिस्ट ने अभी कोई डाइट प्लान असाइन नहीं किया है।",
        btn_request_diet: "डाइट प्लान का अनुरोध करें",
        no_diet_desc: "आपकी प्रोफ़ाइल के लिए कोई पोषण प्रोटोकॉल या कैलोरी लक्ष्य सक्रिय नहीं है।",
        btn_set_nutrition: "पोषण लक्ष्य सेट करें",
        no_progress_title: "कोई प्रोग्रेस रिकॉर्ड नहीं है",
        no_progress_sub: "समय के साथ अपने शरीर के वजन, बीएमआई और मापों को ट्रैक करें।",
        btn_log_weight: "पहला वजन दर्ज करें",
        no_goals_title: "अभी कोई लक्ष्य नहीं है",
        no_goals_sub: "वजन, व्यक्तिगत शक्ति रिकॉर्ड, या साप्ताहिक वर्कआउट के लिए मील के पत्थर निर्धारित करें।",
        btn_create_goal: "पहला लक्ष्य बनाएं",
        qr_locked_title: "टर्नस्टाइल गेट पास लॉक है",
        qr_locked_sub: "सक्रिय सदस्यता प्लान होने पर डिजिटल क्यूआर एक्सेस स्वचालित रूप से सक्रिय होता है।",
        btn_activate_msh: "सदस्यता सक्रिय करें",
        no_bookings_title: "कोई आगामी बुकिंग नहीं है",
        no_bookings_sub: "आपने अभी तक कोई ग्रुप क्लास बुक नहीं की है।",
        no_notifs: "कोई नई सूचना नहीं है।",
        no_tickets: "कोई सहायता टिकट नहीं है।",
        branch_ops: "शाखा संचालन",
        total_members_kpi: "कुल सदस्य",
        active_msh_kpi: "सक्रिय सदस्यताएं",
        today_checkins_kpi: "आज के चेक-इन",
        net_revenue_kpi: "कुल शाखा राजस्व",
        member_roster_title: "सदस्य सूची",
        crm_pipeline_title: "सीआरएम लीड्स पाइपलाइन",
        inventory_title: "सप्लीमेंट्स व इन्वेंट्री",
        btn_roster_csv: "रोस्टर सीएसवी",
        btn_stock_csv: "स्टॉक सीएसवी",
        btn_run_jobs: "जॉब्स चलाएं",
        btn_new_sku: "नया एसकेयू",
        btn_new_lead: "नई लीड",
        th_member_name: "सदस्य का नाम",
        th_email: "ईमेल",
        th_active_plan: "सक्रिय प्लान",
        th_status: "स्थिति",
        th_days_left: "शेष दिन",
        trainer_sub_title: "एथलीट कोचिंग व सत्र",
        trainer_hub_title: "ट्रेनर परफॉर्मेंस हब",
        assigned_athletes_kpi: "असाइन किए गए एथलीट",
        sessions_today_kpi: "आज के सत्र",
        adherence_rate_kpi: "औसत क्लाइंट पालन",
        active_protocols_kpi: "सक्रिय प्रोटोकॉल",
        my_athletes_title: "मेरे एथलीट व प्रशिक्षण प्रोग्रेस",
        btn_assign_routine: "रूटीन असाइन करें",
        btn_set_macros: "मैक्रोज़ सेट करें",
        btn_log_note: "नोट दर्ज करें",
        th_athlete: "एथलीट",
        th_current_goal: "वर्तमान लक्ष्य",
        th_assigned_routine: "असाइन किया गया रूटीन",
        th_macro_protocol: "मैक्रो प्रोटोकॉल",
        th_streak: "स्ट्रीक",
        th_adherence: "पालन दर",
        th_action: "कार्रवाई",
        superadmin_sub_title: "प्लेटफॉर्म सुपर एडमिनिस्ट्रेशन",
        superadmin_hub_title: "एंटरप्राइज इकोसिस्टम",
        kpi_total_gyms: "कुल जिम",
        kpi_active_branches: "सक्रिय शाखाएं",
        kpi_total_users: "कुल उपयोगकर्ता",
        kpi_platform_revenue: "प्लेटफॉर्म राजस्व",
        superadmin_audit_title: "सिस्टम ऑडिट ट्रेल (अपरिवर्तनीय लॉग)",
        ai_coach_title: "एआई फिटनेस कोच",
        ai_coach_desc: "सर्वर-साइड जेमिनी एआई आपकी वास्तविक प्रोफ़ाइल, वर्कआउट और डाइट रिकॉर्ड पर आधारित।",
        suggested_questions: "सुझाए गए प्रश्न:",
        ai_welcome_msg: "👋 नमस्ते! मैं आपका FIT HUB AI फिटनेस कोच हूँ। मुझसे अपने वर्कआउट, डाइट मैक्रोज़, अटेंडेंस या आगामी क्लास के बारे में पूछें!",
        ai_loading: "कोच आपका डेटा देख रहा है...",
        ai_error: "AI Coach अभी उपलब्ध नहीं है। कृपया थोड़ी देर बाद फिर कोशिश करें।",
        ai_input_placeholder: "अपने कोच से कुछ भी पूछें...",
        btn_send: "भेजें",
        btn_retry: "पुनः प्रयास करें",
        notifs_modal_title: "सूचनाएं",
        btn_mark_all_read: "सभी को पढ़ा हुआ चिन्हित करें",
        support_tickets_title: "सहायता टिकट",
        btn_new_ticket: "नया टिकट"
      }
    };

    function t(key, fallback) {
      if (translations[currentLang] && translations[currentLang][key] !== undefined) {
        return translations[currentLang][key];
      }
      return fallback !== undefined ? fallback : (translations.en[key] || key);
    }

    const aiSuggestedQuestionsData = {
      en: [
        "What is my workout today?",
        "What is my membership status?",
        "How is my attendance?",
        "What are my current goals?",
        "Show my recent progress.",
        "What class do I have next?"
      ],
      hi: [
        "आज मेरा वर्कआउट क्या है?",
        "मेरी मेंबरशिप कब तक है?",
        "मेरी अटेंडेंस कैसी है?",
        "मेरे वर्तमान गोल क्या हैं?",
        "मेरी हाल की प्रोग्रेस बताओ।",
        "मेरी अगली क्लास कब है?"
      ]
    };

    function renderAiSuggestedQuestions() {
      const container = document.getElementById('aiSuggestedQuestions');
      if (!container) return;
      const questions = aiSuggestedQuestionsData[currentLang] || aiSuggestedQuestionsData.en;
      container.innerHTML = '';
      questions.forEach(function(q) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'px-2.5 py-1 rounded-lg bg-[#242424] hover:bg-[#2c2c2c] border border-[#393939] text-white hover:border-[#F0441D] transition text-[11px] text-left';
        btn.textContent = q;
        btn.onclick = function() { askSuggestedQuestion(q); };
        container.appendChild(btn);
      });
    }

    function askSuggestedQuestion(q) {
      const input = document.getElementById('aiInput');
      if (input) {
        input.value = q;
        sendAiMessage();
      }
    }

    function setLanguage(lang) {
      currentLang = (lang === 'hi') ? 'hi' : 'en';
      localStorage.setItem('fithub_lang', currentLang);
      applyTranslations();
    }

    function toggleLang() {
      setLanguage(currentLang === 'en' ? 'hi' : 'en');
    }

    function applyTranslations() {
      // 1. Static element text
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const translated = t(key);
        if (translated) {
          el.innerText = translated;
        }
      });

      // 2. Placeholder attributes
      document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        const translated = t(key);
        if (translated) {
          el.placeholder = translated;
        }
      });

      // 3. Switcher buttons
      const btnEn = document.getElementById('langBtnEn');
      const btnHi = document.getElementById('langBtnHi');
      if (btnEn && btnHi) {
        if (currentLang === 'hi') {
          btnHi.className = 'px-2.5 py-1 rounded-lg transition text-white bg-[#F0441D]';
          btnEn.className = 'px-2.5 py-1 rounded-lg transition text-[#858585] hover:text-white bg-transparent';
        } else {
          btnEn.className = 'px-2.5 py-1 rounded-lg transition text-white bg-[#F0441D]';
          btnHi.className = 'px-2.5 py-1 rounded-lg transition text-[#858585] hover:text-white bg-transparent';
        }
      }
      const langBtnText = document.getElementById('langBtnText');
      if (langBtnText) {
        langBtnText.innerText = currentLang === 'en' ? 'हिन्दी' : 'EN';
      }

      // 4. Update login page texts
      setAuthMode(authMode);

      // 5. Update AI coach greeting and suggested questions
      const welcomeEl = document.getElementById('aiWelcomeMessage');
      if (welcomeEl) {
        welcomeEl.innerText = t('ai_welcome_msg');
      }
      const loadingEl = document.getElementById('aiLoadingText');
      if (loadingEl) {
        loadingEl.innerText = t('ai_loading');
      }
      const errEl = document.getElementById('aiErrorMessage');
      if (errEl) {
        errEl.innerText = t('ai_error');
      }
      renderAiSuggestedQuestions();

      // 6. Dynamic active dashboard re-rendering
      if (currentRole === 'MEMBER' && memberDashboardData) {
        renderMemberDashboardUI(memberDashboardData);
      }
    }

    // Base API helper
    async function apiRequest(endpoint, method = 'GET', body = null) {
      const headers = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['Authorization'] = 'Bearer ' + authToken;
      }
      const options = { method, headers };
      if (body) options.body = JSON.stringify(body);

      const res = await fetch(endpoint, options);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Server error');
      }
      return data;
    }

    // Modal helpers
    function openModal(id) { document.getElementById(id)?.classList.remove('hidden'); }
    function closeModal(id) { document.getElementById(id)?.classList.add('hidden'); }

    // Navigation
    function navigateTo(screenId) {
      document.getElementById('view-role_select').classList.toggle('hidden', screenId !== 'role_select');
      document.getElementById('view-login').classList.toggle('hidden', screenId !== 'login');
      document.getElementById('view-dashboard').classList.toggle('hidden', screenId !== 'dashboard');
      document.getElementById('logoutBtn').classList.toggle('hidden', screenId !== 'dashboard');
    }

    function selectRoleAndGoToLogin(role) {
      setAuthMode('signin');
      navigateTo('login');
    }

    function toggleAuthMode() {
      setAuthMode(authMode === 'signin' ? 'register' : 'signin');
    }

    function setAuthMode(mode) {
      authMode = mode;
      const isReg = mode === 'register';
      const fullNameGroup = document.getElementById('fullNameGroup');
      if (fullNameGroup) fullNameGroup.classList.toggle('hidden', !isReg);
      
      const titleEl = document.getElementById('loginPageTitle');
      if (titleEl) titleEl.innerText = isReg ? t('login_create', 'CREATE ACCOUNT') : t('login_welcome', 'WELCOME BACK');

      const subtitleEl = document.getElementById('loginSubtitle');
      if (subtitleEl) subtitleEl.innerText = isReg ? t('login_sub_register', 'Register your clean member account') : t('login_sub_signin', 'Sign in to your authenticated account');

      const submitBtn = document.getElementById('authSubmitBtn');
      if (submitBtn) submitBtn.innerText = isReg ? t('btn_create_acc', 'CREATE ACCOUNT') : t('btn_signin', 'SIGN IN');

      const togglePrompt = document.getElementById('authTogglePrompt');
      if (togglePrompt) togglePrompt.innerText = isReg ? t('prompt_have_acc', 'Already have an account?') : t('prompt_no_acc', "Don't have an account?");

      const toggleBtn = document.getElementById('authToggleBtn');
      if (toggleBtn) toggleBtn.innerText = isReg ? t('link_signin', 'Sign In') : t('link_register', 'Create Account');

      const alertBox = document.getElementById('authAlert');
      if (alertBox) alertBox.classList.add('hidden');
    }

    function showForgotPassword(e) {
      if (e) e.preventDefault();
      const alertBox = document.getElementById('authAlert');
      if (!alertBox) return;
      alertBox.className = 'p-3 rounded-xl text-xs font-semibold bg-zinc-800 text-[#B5B5B5] border border-[#393939]';
      alertBox.innerText = 'To reset your password, contact your gym administrator or platform support at support@fithub.com.';
      alertBox.classList.remove('hidden');
    }

    async function performAuth() {
      const email = document.getElementById('authEmail').value.trim();
      const password = document.getElementById('authPassword').value;
      const fullName = document.getElementById('authFullName')?.value?.trim() || '';
      const alertBox = document.getElementById('authAlert');
      alertBox.className = 'hidden p-3 rounded-xl text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/30';
      alertBox.classList.add('hidden');

      if (!email || !password) {
        alertBox.innerText = 'Email and password are required.';
        alertBox.classList.remove('hidden');
        return;
      }

      try {
        let res;
        if (authMode === 'register') {
          res = await apiRequest('/api/auth/register', 'POST', { email, password, fullName });
        } else {
          // Role is determined securely from the authenticated Supabase profile on the server.
          // The user does NOT manually select a role during login.
          res = await apiRequest('/api/auth/login', 'POST', { email, password });
        }

        authToken = res.token;
        currentUser = res.user;
        localStorage.setItem('fithub_auth_token', authToken);

        // Automatically route user to permitted area based on verified Supabase account role
        await routeUserToDashboard(currentUser.role);
      } catch (err) {
        alertBox.className = 'p-3 rounded-xl text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/30';
        alertBox.innerText = err.message || 'Authentication failed.';
        alertBox.classList.remove('hidden');
      }
    }

    function performLogout() {
      authToken = null;
      currentUser = null;
      currentRole = 'MEMBER';
      localStorage.removeItem('fithub_auth_token');
      const emailInput = document.getElementById('authEmail');
      const passInput = document.getElementById('authPassword');
      if (emailInput) emailInput.value = '';
      if (passInput) passInput.value = '';
      setAuthMode('signin');
      navigateTo('login');
    }

    async function routeUserToDashboard(role) {
      const normalizedRole = (role || 'MEMBER').toUpperCase();
      currentRole = normalizedRole;

      const isMember = normalizedRole === 'MEMBER';
      const isAdmin = ['GYM_ADMIN', 'GYM_OWNER'].includes(normalizedRole);
      const isSuperAdmin = normalizedRole === 'SUPER_ADMIN';
      const isTrainer = normalizedRole === 'TRAINER';

      document.getElementById('subview-member')?.classList.toggle('hidden', !isMember);
      document.getElementById('subview-admin')?.classList.toggle('hidden', !isAdmin);
      document.getElementById('subview-superadmin')?.classList.toggle('hidden', !isSuperAdmin);
      document.getElementById('subview-trainer')?.classList.toggle('hidden', !isTrainer);

      navigateTo('dashboard');

      if (isMember) {
        await fetchMemberDashboard();
      } else if (isAdmin) {
        await fetchAdminDashboard();
      } else if (isSuperAdmin) {
        await fetchSuperAdminDashboard();
      } else if (isTrainer) {
        await fetchTrainerDashboard();
      }
    }

    // Compatibility alias
    const quickSwitchRole = routeUserToDashboard;

    // ---------------- MEMBER API CALLS ----------------
    async function fetchMemberDashboard() {
      try {
        const data = await apiRequest('/api/member/dashboard');
        memberDashboardData = data;
        renderMemberDashboardUI(data);
      } catch (err) {
        console.error('Member dashboard load error:', err);
      }
    }

    function renderMemberDashboardUI(raw) {
      if (!raw) return;
      const mem = raw.member || {};
      const profile = raw.profile || {
        id: mem.id || currentUser?.id || '',
        fullName: mem.fullName || mem.name || currentUser?.fullName || 'Athlete',
        email: mem.email || currentUser?.email || '',
        role: mem.role || currentUser?.role || 'MEMBER'
      };
      const membership = raw.membership || {
        planName: mem.planName || 'No active membership',
        status: mem.status || 'INACTIVE',
        remainingDays: typeof mem.remainingDays === 'number' ? mem.remainingDays : 0,
        expiryDate: mem.expiryDate || 'No expiry'
      };
      const attendance = raw.attendance || {
        streak: typeof mem.streak === 'number' ? mem.streak : 0,
        totalCheckIns: typeof mem.attendanceCount === 'number' ? mem.attendanceCount : 0,
        todayAttendance: mem.todayAttended ? 1 : 0,
        monthlyAttendancePercent: mem.monthlyPercent ? parseInt(mem.monthlyPercent, 10) : 0,
        logs: mem.attendanceLogs || []
      };

      const d = {
        profile,
        membership,
        attendance,
        workout: raw.workout !== undefined ? raw.workout : (mem.workouts?.[0] || null),
        diet: raw.diet !== undefined ? raw.diet : (mem.diet || null),
        progressList: raw.progressList || mem.progress || [],
        goalsList: raw.goalsList || mem.goals || [],
        qrPass: raw.qrPass || {
          active: (membership.remainingDays > 0),
          code: 'FH-' + ((profile.id || 'MEM').slice(0, 8).toUpperCase())
        },
        bookingsList: raw.bookingsList || mem.bookings || [],
        invoicesList: raw.invoicesList || mem.payments || [],
        paymentsList: raw.paymentsList || mem.payments || [],
        notificationsList: raw.notificationsList || mem.notifications || []
      };

      const nameEl = document.getElementById('memberProfileName');
      if (nameEl) nameEl.innerText = d.profile.fullName || 'Athlete';
      const emailEl = document.getElementById('memberProfileEmail');
      if (emailEl) emailEl.innerText = d.profile.email || '';

      // Status badge
      const badge = document.getElementById('memberStatusBadge');
      if (badge) {
        if (d.membership.remainingDays > 0) {
          badge.className = 'text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
          badge.innerText = 'ACTIVE MEMBER';
        } else {
          badge.className = 'text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-800 text-[#B5B5B5] border border-[#393939]';
          badge.innerText = 'No active membership';
        }
      }

      // Hero Card
      const heroCard = document.getElementById('heroMembershipCard');
      const heroTitle = document.getElementById('heroPlanTitle');
      const heroDays = document.getElementById('heroDaysRemaining');
      const heroStreak = document.getElementById('heroStreakCount');
      const heroExpiry = document.getElementById('heroExpiryText');

      if (heroDays) heroDays.innerText = d.membership.remainingDays;
      if (heroStreak) heroStreak.innerText = d.attendance.streak;

      if (heroCard && heroTitle && heroDays && heroExpiry) {
        if (d.membership.remainingDays > 0) {
          heroCard.className = 'glass-card p-6 bg-gradient-to-r from-[#171717] to-[#251b17] border-l-4 border-[#F0441D]';
          heroTitle.innerText = (d.membership.planName || '').toUpperCase();
          heroDays.className = 'text-2xl font-black text-[#F0441D]';
          heroExpiry.innerText = d.membership.remainingDays + ' days left';
        } else {
          heroCard.className = 'glass-card p-6 bg-gradient-to-r from-[#171717] to-[#1D1D1D] border-l-4 border-[#393939]';
          heroTitle.innerText = 'NO ACTIVE MEMBERSHIP';
          heroDays.className = 'text-2xl font-black text-[#858585]';
          heroExpiry.innerText = 'No expiry';
        }
      }

      // Attendance
      const totalCheckInsEl = document.getElementById('totalCheckInCount');
      if (totalCheckInsEl) totalCheckInsEl.innerText = d.attendance.totalCheckIns;
      const todayAttendanceEl = document.getElementById('todayAttendanceLabel');
      if (todayAttendanceEl) todayAttendanceEl.innerText = d.attendance.todayAttendance;
      const monthlyAttendanceEl = document.getElementById('monthlyAttendanceLabel');
      if (monthlyAttendanceEl) monthlyAttendanceEl.innerText = d.attendance.monthlyAttendancePercent + '%';

      const gateStatus = document.getElementById('memberGateStatus');
      if (gateStatus) {
        if (d.attendance.todayAttendance > 0) {
          gateStatus.className = 'inline-block px-2.5 py-0.5 rounded text-[10px] font-bold bg-[#F0441D]/20 text-[#F0441D] border border-[#F0441D]/30';
          gateStatus.innerText = 'STATUS: IN GYM (CHECKED IN TODAY)';
        } else if (d.membership.remainingDays > 0) {
          gateStatus.className = 'inline-block px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
          gateStatus.innerText = 'STATUS: READY FOR CHECK-IN';
        } else {
          gateStatus.className = 'inline-block px-2.5 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-[#858585] border border-[#393939]';
          gateStatus.innerText = 'STATUS: NO ACTIVE MEMBERSHIP';
        }
      }

      // Workout Snapshot & Screen
      renderWorkoutSection(d.workout);

      // Diet Snapshot & Screen
      renderDietSection(d.diet);

      // Progress
      renderProgressSection(d.progressList);

      // Goals
      renderGoalsSection(d.goalsList);

      // QR Pass
      renderQrScreen(d.qrPass, d.membership);

      // Classes & Invoices
      renderClassesAndBilling(d.bookingsList, d.invoicesList, d.paymentsList);

      // Support Tickets
      renderSupportTickets(d.profile.id);

      // Notifications
      renderNotificationsList(d.notificationsList);
    }

    function renderWorkoutSection(w) {
      const over = document.getElementById('overviewWorkoutContainer');
      const scr = document.getElementById('workoutScreenContainer');

      if (!w) {
        const emptyHtml = \`
          <div class="py-4 text-center">
            <p class="text-sm font-semibold text-white">\${t('no_workout_title', 'No workout assigned yet')}</p>
            <p class="text-xs text-[#858585] mt-1">\${t('no_workout_sub', 'Your trainer has not assigned a workout routine yet.')}</p>
            <button onclick="apiAssignWorkout()" class="btn-secondary text-xs px-3.5 py-1.5 mt-3">
              <i class="fa-solid fa-plus mr-1"></i> \${t('btn_request_routine', 'Request / Assign Routine')}
            </button>
          </div>
        \`;
        over.innerHTML = emptyHtml;
        scr.innerHTML = \`
          <div class="glass-card p-8 text-center border border-[#393939]">
            <i class="fa-solid fa-dumbbell text-3xl text-[#858585] mb-2"></i>
            <h4 class="text-base font-bold text-white">\${t('no_workout_title', 'No workout assigned yet')}</h4>
            <p class="text-xs text-[#858585] mt-1 max-w-sm mx-auto">\${t('no_workout_sub', 'Your personal coach or gym instructor has not scheduled a workout program for your profile yet.')}</p>
            <button onclick="apiAssignWorkout()" class="btn-orange text-xs px-4 py-2 mt-4 font-bold">
              <i class="fa-solid fa-plus mr-1"></i> \${t('btn_request_routine', 'Assign Training Program')}
            </button>
          </div>
        \`;
      } else {
        over.innerHTML = \`
          <div>
            <p class="text-sm font-semibold text-white">\${w.title}</p>
            <p class="text-xs text-[#B5B5B5] mt-1">\${w.exercises.length} exercises scheduled • Coach: \${w.trainer_name || 'Coach'}</p>
          </div>
        \`;
        scr.innerHTML = \`
          <div class="glass-card p-5 mb-3">
            <span class="text-xs text-[#F0441D] font-bold uppercase block">ACTIVE PROGRAM</span>
            <h3 class="fithub-heading text-xl text-white mt-0.5">\${w.title}</h3>
          </div>
          <div class="space-y-2">
            \${w.exercises.map((ex, idx) => \`
              <div class="glass-card p-4 flex items-center justify-between">
                <div>
                  <h4 class="font-bold text-sm text-white">\${ex.name}</h4>
                  <p class="text-xs text-[#B5B5B5]">\${ex.sets} Sets × \${ex.reps} • Target: \${ex.weight_kg} kg • \${ex.target_muscle}</p>
                </div>
                <input type="checkbox" \${ex.completed ? 'checked' : ''} onchange="apiToggleExercise(\${idx})" class="w-5 h-5 accent-[#F0441D] cursor-pointer">
              </div>
            \`).join('')}
          </div>
        \`;
      }
    }

    function renderDietSection(d) {
      const over = document.getElementById('overviewDietContainer');
      const scr = document.getElementById('dietScreenContainer');

      if (!d) {
        const emptyHtml = \`
          <div class="py-4 text-center">
            <p class="text-sm font-semibold text-white">\${t('no_diet_title', 'No diet assigned yet')}</p>
            <p class="text-xs text-[#858585] mt-1">\${t('no_diet_sub', 'Your nutritionist has not assigned a diet plan yet.')}</p>
            <button onclick="apiAssignDiet()" class="btn-secondary text-xs px-3.5 py-1.5 mt-3">
              <i class="fa-solid fa-plus mr-1"></i> \${t('btn_request_diet', 'Request Diet Plan')}
            </button>
          </div>
        \`;
        over.innerHTML = emptyHtml;
        scr.innerHTML = \`
          <div class="glass-card p-8 text-center border border-[#393939]">
            <i class="fa-solid fa-utensils text-3xl text-[#858585] mb-2"></i>
            <h4 class="text-base font-bold text-white">\${t('no_diet_title', 'No diet assigned yet')}</h4>
            <p class="text-xs text-[#858585] mt-1 max-w-sm mx-auto">\${t('no_diet_desc', 'No nutrition protocol or calorie target is currently active for your profile.')}</p>
            <button onclick="apiAssignDiet()" class="btn-orange text-xs px-4 py-2 mt-4 font-bold">
              <i class="fa-solid fa-plus mr-1"></i> \${t('btn_set_nutrition', 'Set Nutrition Targets')}
            </button>
          </div>
        \`;
      } else {
        over.innerHTML = \`
          <div>
            <p class="text-sm font-semibold text-white">Target: \${d.target_calories} kcal • \${d.target_protein_g}g Protein</p>
            <p class="text-xs text-[#B5B5B5] mt-1">Carbs: \${d.target_carbs_g}g • Fats: \${d.target_fat_g}g</p>
            <div class="flex items-center justify-between text-xs text-[#B5B5B5] mt-3 bg-[#0A0A0A] p-2 rounded-lg border border-[#393939]">
              <span>💧 Water: <strong class="text-white">\${d.water_consumed_ml || 0}</strong> / \${d.water_target_ml} ml</span>
              <button onclick="apiLogWater()" class="btn-secondary text-[10px] px-2 py-0.5">+250ml</button>
            </div>
          </div>
        \`;
        scr.innerHTML = \`
          <div class="glass-card p-5">
            <h3 class="fithub-heading text-sm text-white">DAILY NUTRITION TARGETS</h3>
            <div class="grid grid-cols-4 gap-2 mt-3 text-center">
              <div class="bg-[#0A0A0A] p-2.5 rounded-lg border border-[#393939]">
                <span class="text-[10px] text-[#858585] block font-bold">CALORIES</span>
                <span class="text-sm font-black text-white">\${d.target_calories}</span>
              </div>
              <div class="bg-[#0A0A0A] p-2.5 rounded-lg border border-[#393939]">
                <span class="text-[10px] text-[#858585] block font-bold">PROTEIN</span>
                <span class="text-sm font-black text-[#F0441D]">\${d.target_protein_g}g</span>
              </div>
              <div class="bg-[#0A0A0A] p-2.5 rounded-lg border border-[#393939]">
                <span class="text-[10px] text-[#858585] block font-bold">CARBS</span>
                <span class="text-sm font-black text-white">\${d.target_carbs_g}g</span>
              </div>
              <div class="bg-[#0A0A0A] p-2.5 rounded-lg border border-[#393939]">
                <span class="text-[10px] text-[#858585] block font-bold">FATS</span>
                <span class="text-sm font-black text-white">\${d.target_fat_g}g</span>
              </div>
            </div>
          </div>
        \`;
      }
    }

    function renderProgressSection(list) {
      const box = document.getElementById('progressScreenContainer');
      if (!list || list.length === 0) {
        box.innerHTML = \`
          <div class="glass-card p-8 text-center border border-[#393939]">
            <i class="fa-solid fa-chart-line text-3xl text-[#858585] mb-2"></i>
            <h4 class="text-base font-bold text-white">\${t('no_progress_title', 'No progress records yet')}</h4>
            <p class="text-xs text-[#858585] mt-1 max-w-sm mx-auto">\${t('no_progress_sub', 'Track your body weight, BMI score, and measurements over time.')}</p>
            <button onclick="openModal('logProgressModal')" class="btn-orange text-xs px-4 py-2 mt-4 font-bold">
              <i class="fa-solid fa-plus mr-1"></i> \${t('btn_log_weight', 'Log Your First Weight')}
            </button>
          </div>
        \`;
      } else {
        const latest = list[list.length - 1];
        box.innerHTML = \`
          <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            <div class="glass-card p-4 text-center">
              <span class="text-xs text-[#858585] block font-bold">LATEST WEIGHT</span>
              <span class="text-2xl font-black text-white">\${latest.weight_kg} kg</span>
            </div>
            <div class="glass-card p-4 text-center">
              <span class="text-xs text-[#858585] block font-bold">CALCULATED BMI</span>
              <span class="text-2xl font-black text-[#F0441D]">\${latest.bmi}</span>
            </div>
            <div class="glass-card p-4 text-center">
              <span class="text-xs text-[#858585] block font-bold">LOG DATE</span>
              <span class="text-lg font-bold text-white mt-1 block">\${latest.date}</span>
            </div>
          </div>
        \`;
      }
    }

    function renderGoalsSection(goals) {
      const box = document.getElementById('goalsScreenContainer');
      if (!goals || goals.length === 0) {
        box.innerHTML = \`
          <div class="glass-card p-8 text-center border border-[#393939]">
            <i class="fa-solid fa-bullseye text-3xl text-[#858585] mb-2"></i>
            <h4 class="text-base font-bold text-white">\${t('no_goals_title', 'No goals yet')}</h4>
            <p class="text-xs text-[#858585] mt-1 max-w-sm mx-auto">\${t('no_goals_sub', 'Set target milestones for weight, personal strength records, or weekly workout frequency.')}</p>
            <button onclick="openModal('createGoalModal')" class="btn-orange text-xs px-4 py-2 mt-4 font-bold">
              <i class="fa-solid fa-plus mr-1"></i> \${t('btn_create_goal', 'Create Your First Goal')}
            </button>
          </div>
        \`;
      } else {
        box.innerHTML = \`
          <div class="space-y-2">
            \${goals.map(g => \`
              <div class="glass-card p-4 flex justify-between items-center">
                <div>
                  <h4 class="font-bold text-white text-sm">\${g.title}</h4>
                  <p class="text-xs text-[#858585]">Target: \${g.target_date}</p>
                </div>
                <span class="text-xs text-[#F0441D] font-bold"><i class="fa-solid fa-flag mr-1"></i> Active</span>
              </div>
            \`).join('')}
          </div>
        \`;
      }
    }

    function renderQrScreen(qr, membership) {
      const box = document.getElementById('qrScreenContainer');
      if (!membership || membership.remainingDays <= 0) {
        box.innerHTML = \`
          <div class="max-w-md mx-auto glass-card p-8 text-center border border-[#393939]">
            <i class="fa-solid fa-lock text-3xl text-[#858585] mb-2"></i>
            <h4 class="text-base font-bold text-white">\${t('qr_locked_title', 'Turnstile Gate Pass Locked')}</h4>
            <p class="text-xs text-[#858585] mt-1">\${t('qr_locked_sub', 'Digital QR access activates automatically when you have an active membership plan.')}</p>
            <button onclick="openModal('assignPlanModal')" class="btn-orange text-xs px-4 py-2 mt-4 font-bold">
              \${t('btn_activate_msh', 'Activate Membership')}
            </button>
          </div>
        \`;
      } else {
        box.innerHTML = \`
          <div class="max-w-md mx-auto glass-card p-6 text-center border-2 border-[#F0441D]">
            <span class="text-[10px] uppercase font-black tracking-widest text-[#F0441D]">\${t('gate_pass_label', 'FIT HUB DIGITAL ACCESS PASS')}</span>
            <h3 class="fithub-heading text-xl text-white mt-1">\${(currentUser?.fullName || 'ATHLETE').toUpperCase()}</h3>
            <p class="text-xs text-[#B5B5B5]">\${membership.planName} • Valid</p>
            <div class="my-5 w-44 h-44 bg-white rounded-xl mx-auto flex items-center justify-center p-2 shadow-inner">
              <i class="fa-solid fa-qrcode text-8xl text-black"></i>
            </div>
            <p class="text-xs text-[#B5B5B5]">Scan at automated entrance turnstile for contact-free entry.</p>
          </div>
        \`;
      }
    }

    function renderClassesAndBilling(bookings, invoices, payments) {
      const bBox = document.getElementById('bookingsContainer');
      if (!bookings || bookings.length === 0) {
        bBox.innerHTML = \`
          <div class="glass-card p-5 text-center border border-[#393939]">
            <p class="text-sm font-bold text-white">\${t('no_bookings_title', 'No upcoming bookings')}</p>
            <p class="text-xs text-[#858585] mt-1">\${t('no_bookings_sub', 'You have not booked any group classes yet.')}</p>
          </div>
        \`;
      } else {
        bBox.innerHTML = \`
          <div class="space-y-2">
            \${bookings.map(b => \`
              <div class="glass-card p-3.5 flex justify-between items-center text-xs">
                <div>
                  <h4 class="font-bold text-white text-sm">\${b.class_title || 'Group Session'}</h4>
                  <p class="text-[#858585]">Status: \${b.booking_status}</p>
                </div>
                <button onclick="apiBookClass('\${b.session_id}')" class="text-xs text-red-400 font-bold hover:underline">Cancel Slot</button>
              </div>
            \`).join('')}
          </div>
        \`;
      }

      // Available classes catalog
      const cBox = document.getElementById('availableClassesContainer');
      cBox.innerHTML = \`
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div class="glass-card p-3.5 flex justify-between items-center">
            <div>
              <strong class="text-white block text-sm">Power Vinyasa Yoga</strong>
              <span class="text-xs text-[#858585]">06:30 AM • Studio A • 60 mins</span>
            </div>
            <button onclick="apiBookClass('cls-01')" class="btn-orange text-xs px-3 py-1.5 font-bold">Book Slot</button>
          </div>
          <div class="glass-card p-3.5 flex justify-between items-center">
            <div>
              <strong class="text-white block text-sm">High-Octane CrossFit</strong>
              <span class="text-xs text-[#858585]">07:30 AM • Box Arena • 50 mins</span>
            </div>
            <button onclick="apiBookClass('cls-02')" class="btn-orange text-xs px-3 py-1.5 font-bold">Book Slot</button>
          </div>
        </div>
      \`;

      // Invoices & Payments
      const pBox = document.getElementById('paymentsContainer');
      if (!payments || payments.length === 0) {
        pBox.innerHTML = \`
          <div class="glass-card p-5 text-center border border-[#393939]">
            <p class="text-sm font-bold text-white">No payment history yet</p>
            <p class="text-xs text-[#858585] mt-1">Pending dues: ₹0.00 • No invoices on file.</p>
          </div>
        \`;
      } else {
        pBox.innerHTML = \`
          <div class="space-y-2">
            \${payments.map(p => \`
              <div class="glass-card p-4 flex justify-between items-center text-xs">
                <div>
                  <strong class="text-white text-sm block">₹\${Number(p.amount).toLocaleString()}</strong>
                  <span class="text-[#858585]">Method: \${p.payment_method} • Ref: \${p.transaction_ref}</span>
                </div>
                <span class="text-emerald-400 font-bold text-[10px] bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/30">PAID</span>
              </div>
            \`).join('')}
          </div>
        \`;
      }
    }

    function renderSupportTickets(memberId) {
      const box = document.getElementById('supportTicketsContainer');
      box.innerHTML = \`
        <div class="glass-card p-5 text-center border border-[#393939]">
          <i class="fa-solid fa-headset text-2xl text-[#858585] mb-2"></i>
          <p class="text-sm font-bold text-white">Support Desk Active</p>
          <p class="text-xs text-[#858585] mt-1">Our branch managers and personal trainers are here to assist with any questions.</p>
          <button onclick="openModal('createTicketModal')" class="btn-orange text-xs px-4 py-2 mt-3 font-bold">
            Create Support Request
          </button>
        </div>
      \`;
    }

    function renderNotificationsList(list) {
      const dot = document.getElementById('headerNotifDot');
      const box = document.getElementById('notificationsList');
      if (!list || list.length === 0) {
        dot.classList.add('hidden');
        box.innerHTML = '<p class="text-center text-[#858585] py-4">' + t('no_notifs', 'No notifications.') + '</p>';
      } else {
        dot.classList.remove('hidden');
        box.innerHTML = list.map(n => \`
          <div class="p-3 bg-[#242424] rounded-xl border border-[#393939]">
            <strong class="text-white block text-sm">\${n.title}</strong>
            <p class="text-[#B5B5B5] text-xs mt-0.5">\${n.message}</p>
          </div>
        \`).join('');
      }
    }

    function setMemberTab(tab) {
      const tabs = ['overview', 'workout', 'diet', 'progress', 'goals', 'qr', 'classes', 'aicoach', 'support'];
      tabs.forEach(t => {
        const sec = document.getElementById('mSec-' + t);
        const btn = document.getElementById('mTab-' + t);
        if (sec) sec.classList.toggle('hidden', t !== tab);
        if (btn) {
          if (t === tab) {
            btn.className = 'px-3.5 py-1.5 rounded-lg active-nav-pill whitespace-nowrap';
          } else {
            btn.className = 'px-3.5 py-1.5 rounded-lg text-[#B5B5B5] hover:text-white whitespace-nowrap';
          }
        }
      });
    }

    // ---------------- MEMBER ACTIONS ----------------
    async function apiAssignPlan(planId) {
      try {
        await apiRequest('/api/member/assign-plan', 'POST', { planId });
        closeModal('assignPlanModal');
        await fetchMemberDashboard();
      } catch (err) {
        alert(err.message);
      }
    }

    async function apiCheckInAttendance() {
      try {
        const res = await apiRequest('/api/member/attendance-checkin', 'POST');
        alert(res.message);
        await fetchMemberDashboard();
      } catch (err) {
        alert(err.message);
      }
    }

    async function apiAssignWorkout() {
      try {
        await apiRequest('/api/member/workout-assign', 'POST');
        await fetchMemberDashboard();
      } catch (err) {
        alert(err.message);
      }
    }

    async function apiToggleExercise(idx) {
      try {
        await apiRequest('/api/member/workout-toggle', 'POST', { exerciseIndex: idx });
        await fetchMemberDashboard();
      } catch (err) {
        alert(err.message);
      }
    }

    async function apiAssignDiet() {
      try {
        await apiRequest('/api/member/diet-assign', 'POST');
        await fetchMemberDashboard();
      } catch (err) {
        alert(err.message);
      }
    }

    async function apiLogWater() {
      try {
        await apiRequest('/api/member/diet-water', 'POST', { amountMl: 250 });
        await fetchMemberDashboard();
      } catch (err) {
        alert(err.message);
      }
    }

    async function apiSubmitProgress() {
      const weight = document.getElementById('progressWeightInput').value;
      const height = document.getElementById('progressHeightInput').value;
      if (!weight) return alert('Enter weight');
      try {
        await apiRequest('/api/member/progress', 'POST', { weightKg: weight, heightCm: height });
        closeModal('logProgressModal');
        await fetchMemberDashboard();
      } catch (err) {
        alert(err.message);
      }
    }

    async function apiSubmitGoal() {
      const title = document.getElementById('goalTitleInput').value.trim();
      const targetDate = document.getElementById('goalDateInput').value;
      if (!title) return alert('Enter goal');
      try {
        await apiRequest('/api/member/goals', 'POST', { title, targetDate });
        closeModal('createGoalModal');
        await fetchMemberDashboard();
      } catch (err) {
        alert(err.message);
      }
    }

    async function apiBookClass(classId) {
      try {
        const res = await apiRequest('/api/member/book-class', 'POST', { classId });
        alert(res.message);
        await fetchMemberDashboard();
      } catch (err) {
        alert(err.message);
      }
    }

    async function apiSubmitTicket() {
      const subject = document.getElementById('ticketSubjectInput').value.trim();
      const category = document.getElementById('ticketCategoryInput').value;
      const description = document.getElementById('ticketDescriptionInput').value.trim();
      if (!subject || !description) return alert('Subject and description required');

      try {
        await apiRequest('/api/member/support-ticket', 'POST', { subject, category, description });
        closeModal('createTicketModal');
        alert('Ticket submitted successfully.');
      } catch (err) {
        alert(err.message);
      }
    }

    // ---------------- GYM ADMIN API CALLS ----------------
    async function fetchAdminDashboard() {
      try {
        const d = await apiRequest('/api/admin/dashboard');
        document.getElementById('admTotalMembers').innerText = d.metrics.totalMembers;
        document.getElementById('admActiveMembers').innerText = d.metrics.activeMembers;
        document.getElementById('admExpiredMembers').innerText = d.metrics.expiredMembers + ' Expired';
        document.getElementById('admTodayCheckins').innerText = d.metrics.todayCheckIns;
        document.getElementById('admTotalRevenue').innerText = '₹' + Number(d.metrics.totalRevenue).toLocaleString();
        document.getElementById('admNetIncome').innerText = 'Expenses: ₹' + Number(d.metrics.totalExpenses).toLocaleString();

        // Roster
        const tbody = document.getElementById('admMemberTableBody');
        tbody.innerHTML = d.members.map(m => \`
          <tr>
            <td class="py-2.5 font-bold text-white">\${m.name}</td>
            <td>\${m.email}</td>
            <td>\${m.planName}</td>
            <td><span class="px-2 py-0.5 rounded text-[10px] font-bold \${m.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-[#858585]'}">\${m.status}</span></td>
            <td>\${m.remainingDays} days</td>
          </tr>
        \`).join('') || '<tr><td colspan="5" class="py-4 text-center">No members found.</td></tr>';

        // Leads
        const lBox = document.getElementById('admLeadsContainer');
        lBox.innerHTML = (d.leads || []).map(l => {
          const isConverted = l.status === 'CONVERTED';
          return '<div class="p-3 bg-[#242424] rounded-xl flex justify-between items-center">' +
            '<div>' +
              '<strong class="text-white block">' + l.full_name + '</strong>' +
              '<span class="text-[#858585]">' + (l.phone || '') + ' • Plan: ' + (l.interested_plan || 'General') + '</span>' +
            '</div>' +
            '<div class="flex items-center gap-1.5">' +
              '<span class="text-[#F0441D] font-bold text-[10px] bg-[#F0441D]/10 px-2 py-0.5 rounded border border-[#F0441D]/30">' + l.status + '</span>' +
              (!isConverted ? '<button data-id="' + l.id + '" data-status="' + l.status + '" onclick="apiAdvanceLead(this.dataset.id, this.dataset.status)" class="btn-orange text-[10px] px-2 py-0.5 font-bold">Advance</button>' : '<span class="text-emerald-400 text-[10px] font-bold">Active</span>') +
            '</div>' +
          '</div>';
        }).join('') || '<p class="text-[#858585]">No active leads.</p>';

        // Inventory
        const iBox = document.getElementById('admInventoryContainer');
        iBox.innerHTML = (d.inventory || []).map(i => {
          const isLow = i.current_stock <= (i.min_stock_alert || 5);
          return '<div class="p-3 bg-[#242424] rounded-xl flex justify-between items-center">' +
            '<div>' +
              '<strong class="text-white block">' + i.name + '</strong>' +
              '<span class="text-[#858585]">SKU: ' + i.sku + ' • Stock: <span class="' + (isLow ? 'text-red-400 font-bold' : 'text-white font-bold') + '">' + i.current_stock + '</span> units ' + (isLow ? '<span class="bg-red-500/20 text-red-300 text-[10px] px-1.5 py-0.5 rounded font-bold ml-1">LOW STOCK</span>' : '') + '</span>' +
            '</div>' +
            '<div class="flex items-center gap-2">' +
              '<span class="text-xs font-black text-white">₹' + i.selling_price + '</span>' +
              '<button data-id="' + i.id + '" onclick="apiAdjustStock(this.dataset.id, 5)" class="btn-secondary text-[10px] px-2 py-1 font-bold">+5 Stock</button>' +
            '</div>' +
          '</div>';
        }).join('') || '<p class="text-[#858585]">No inventory items recorded.</p>';
      } catch (err) {
        console.error('Admin dashboard error:', err);
      }
    }

    // Reports Download
    function downloadReport(type) {
      window.open('/api/admin/reports/export?type=' + type, '_blank');
    }

    // Automations trigger
    async function triggerAutomations() {
      try {
        const res = await apiRequest('/api/admin/automations/run-expiry-check', 'POST');
        alert('Automations: ' + res.message + ' (Expired: ' + res.expiredCount + ')');
        await fetchAdminDashboard();
      } catch (e) {
        alert(e.message);
      }
    }

    // Stock adjustments
    async function apiAdjustStock(productId, qty) {
      try {
        await apiRequest('/api/admin/inventory/adjust', 'POST', { productId, changeQty: qty, reason: 'RESTOCK' });
        await fetchAdminDashboard();
      } catch (e) {
        alert(e.message);
      }
    }

    async function apiAddInventory() {
      const name = document.getElementById('invNameInput')?.value?.trim();
      const sku = document.getElementById('invSkuInput')?.value?.trim();
      const current_stock = document.getElementById('invStockInput')?.value;
      const min_stock_alert = document.getElementById('invMinInput')?.value;
      const cost_price = document.getElementById('invCostInput')?.value;
      const selling_price = document.getElementById('invPriceInput')?.value;

      if (!name) return alert('Product name is required');
      try {
        await apiRequest('/api/admin/inventory', 'POST', {
          name, sku, current_stock, min_stock_alert, cost_price, selling_price
        });
        closeModal('addInventoryModal');
        await fetchAdminDashboard();
      } catch (e) {
        alert(e.message);
      }
    }

    async function apiAddLead() {
      const fullName = document.getElementById('leadNameInput')?.value?.trim();
      const phone = document.getElementById('leadPhoneInput')?.value?.trim();
      const email = document.getElementById('leadEmailInput')?.value?.trim();
      const interestedPlan = document.getElementById('leadPlanInput')?.value;

      if (!fullName || !phone) return alert('Prospect name and phone are required');
      try {
        await apiRequest('/api/admin/leads', 'POST', {
          fullName, phone, email, interestedPlan, status: 'NEW'
        });
        closeModal('addLeadModal');
        await fetchAdminDashboard();
      } catch (e) {
        alert(e.message);
      }
    }

    async function apiAdvanceLead(leadId, currentStage) {
      const stages = ['NEW', 'CONTACTED', 'TRIAL', 'CONVERTED'];
      const currentIdx = stages.indexOf(currentStage);
      const nextStage = stages[Math.min(stages.length - 1, currentIdx + 1)];
      try {
        await apiRequest('/api/admin/leads/stage', 'POST', { leadId, stage: nextStage });
        await fetchAdminDashboard();
      } catch (e) {
        alert(e.message);
      }
    }

    // ---------------- SUPER ADMIN API CALLS ----------------
    async function fetchSuperAdminDashboard() {
      try {
        const d = await apiRequest('/api/superadmin/dashboard');
        document.getElementById('supGymsCount').innerText = d.metrics.totalGyms;
        document.getElementById('supBranchesCount').innerText = d.metrics.totalBranches;
        document.getElementById('supUsersCount').innerText = d.metrics.totalMembers;
        document.getElementById('supRevenue').innerText = '₹' + Number(d.metrics.platformRevenue).toLocaleString();

        const aBox = document.getElementById('supAuditLogsContainer');
        aBox.innerHTML = (d.recentAuditLogs || []).map(l => {
          return '<div class="p-3 bg-[#242424] rounded-xl flex justify-between items-center text-xs">' +
            '<div>' +
              '<strong class="text-white block">' + l.action + '</strong>' +
              '<span class="text-[#858585]">Actor: ' + l.actor_role + ' • Entity: ' + (l.entity || 'Global') + '</span>' +
            '</div>' +
            '<span class="text-[#858585] text-[10px]">' + (new Date(l.timestamp).toLocaleTimeString()) + '</span>' +
          '</div>';
        }).join('') || '<p class="text-[#858585]">No audit logs recorded.</p>';
      } catch (err) {
        console.error('Super admin error:', err);
      }
    }

    // ---------------- TRAINER API CALLS ----------------
    let trainerDashboardData = null;

    async function fetchTrainerDashboard() {
      try {
        const d = await apiRequest('/api/trainer/dashboard');
        trainerDashboardData = d;
        if (d.trainer) {
          const nameEl = document.getElementById('trainerPortalSub');
          if (nameEl) nameEl.innerText = d.trainer.name + ' • ' + d.trainer.specialization;
          document.getElementById('trainerActiveClients').innerText = d.trainer.activeClientsCount || d.trainees?.length || 0;
          document.getElementById('trainerSessionsToday').innerText = d.trainer.sessionsTodayCount || d.schedule?.length || 0;
          document.getElementById('trainerAdherenceRate').innerText = d.trainer.avgAdherenceRate || '93%';
          document.getElementById('trainerActiveProtocols').innerText = d.trainees?.length || 4;
        }

        // Populate Trainees Table
        const tbody = document.getElementById('trainerTraineesTableBody');
        if (tbody) {
          tbody.innerHTML = (d.trainees || []).map(t => {
            return '<tr>' +
              '<td class="py-2.5 font-bold text-white">' + t.fullName + '<span class="block text-[10px] text-[#858585]">' + t.email + '</span></td>' +
              '<td><span class="text-[#B5B5B5]">' + t.targetGoal + '</span></td>' +
              '<td><span class="text-white font-medium">' + t.workoutAssigned + '</span></td>' +
              '<td><span class="text-[#858585]">' + t.dietAssigned + '</span></td>' +
              '<td><span class="text-[#F0441D] font-bold">' + t.streak + 'd streak</span></td>' +
              '<td><span class="text-emerald-400 font-bold">' + t.adherenceRate + '</span></td>' +
              '<td>' +
                '<button data-id="' + t.id + '" data-name="' + t.fullName + '" onclick="quickAssignRoutine(this.dataset.id, this.dataset.name)" class="btn-orange text-[10px] px-2 py-0.5 mr-1 font-bold">Routine</button>' +
                '<button data-id="' + t.id + '" data-name="' + t.fullName + '" onclick="quickAssignMacro(this.dataset.id, this.dataset.name)" class="btn-secondary text-[10px] px-2 py-0.5 font-bold">Macros</button>' +
              '</td>' +
            '</tr>';
          }).join('') || '<tr><td colspan="7" class="py-4 text-center">No assigned trainees.</td></tr>';
        }

        // Populate Schedule
        const schedBox = document.getElementById('trainerScheduleContainer');
        if (schedBox) {
          schedBox.innerHTML = (d.schedule || []).map(s => {
            return '<div class="p-3 bg-[#242424] rounded-xl flex justify-between items-center">' +
              '<div>' +
                '<div class="flex items-center space-x-2">' +
                  '<strong class="text-white text-xs">' + s.time + '</strong>' +
                  '<span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">' + s.room + '</span>' +
                '</div>' +
                '<span class="text-[#B5B5B5] block text-[11px] mt-0.5">' + s.type + ' • <span class="text-white font-semibold">' + s.traineeName + '</span></span>' +
              '</div>' +
              '<span class="text-emerald-400 font-bold text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">' + s.status + '</span>' +
            '</div>';
          }).join('') || '<p class="text-[#858585]">No sessions scheduled today.</p>';
        }

        // Populate Feedback Notes
        const fbBox = document.getElementById('trainerFeedbackContainer');
        if (fbBox) {
          fbBox.innerHTML = (d.feedbackNotes || []).map(f => {
            return '<div class="p-3 bg-[#242424] rounded-xl space-y-1">' +
              '<div class="flex justify-between items-center">' +
                '<strong class="text-white text-xs">' + f.traineeName + '</strong>' +
                '<span class="text-[#858585] text-[10px]">' + f.date + '</span>' +
              '</div>' +
              '<p class="text-[#B5B5B5] text-[11px]">' + f.note + '</p>' +
              '<div class="text-[#F0441D] text-[10px] font-bold">Rating: ' + '★'.repeat(f.rating || 5) + '</div>' +
            '</div>';
          }).join('') || '<p class="text-[#858585]">No feedback logged.</p>';
        }

        // Populate selectors
        updateTrainerAthleteSelects(d.trainees || []);
      } catch (err) {
        console.error('Trainer dashboard error:', err);
      }
    }

    function updateTrainerAthleteSelects(trainees) {
      const selects = ['routineAthleteSelect', 'macroAthleteSelect', 'noteAthleteSelect'];
      selects.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.innerHTML = trainees.map(t => '<option value="' + t.id + '">' + t.fullName + ' (' + t.planName + ')</option>').join('');
        }
      });
    }

    function quickAssignRoutine(id, name) {
      const el = document.getElementById('routineAthleteSelect');
      if (el) el.value = id;
      openModal('assignRoutineModal');
    }

    function quickAssignMacro(id, name) {
      const el = document.getElementById('macroAthleteSelect');
      if (el) el.value = id;
      openModal('assignMacroModal');
    }

    async function apiTrainerAssignWorkout() {
      const memberId = document.getElementById('routineAthleteSelect')?.value;
      const title = document.getElementById('routineTitleInput')?.value?.trim() || 'Pro Routine';
      const ex1 = document.getElementById('routineEx1Name')?.value?.trim();
      const ex2 = document.getElementById('routineEx2Name')?.value?.trim();
      if (!memberId) return alert('Select an athlete');

      const workout = {
        title,
        trainer_name: currentUser?.fullName || 'Coach Rahul',
        exercises: [
          { name: ex1 || 'Barbell Bench Press', sets: 4, reps: '8-10', weight_kg: Number(document.getElementById('routineEx1Weight')?.value || 80), completed: false },
          { name: ex2 || 'Incline DB Press', sets: 3, reps: '10-12', weight_kg: Number(document.getElementById('routineEx2Weight')?.value || 28), completed: false }
        ]
      };

      try {
        await apiRequest('/api/trainer/assign-workout', 'POST', { memberId, workout });
        closeModal('assignRoutineModal');
        alert('Routine assigned to athlete.');
        await fetchTrainerDashboard();
      } catch (e) {
        alert(e.message);
      }
    }

    async function apiTrainerAssignDiet() {
      const memberId = document.getElementById('macroAthleteSelect')?.value;
      const calories = Number(document.getElementById('macroCalsInput')?.value || 2600);
      const protein = Number(document.getElementById('macroProteinInput')?.value || 180);
      const carbs = Number(document.getElementById('macroCarbsInput')?.value || 280);
      const fat = Number(document.getElementById('macroFatInput')?.value || 65);
      const water = Number(document.getElementById('macroWaterInput')?.value || 3500);
      if (!memberId) return alert('Select an athlete');

      const diet = {
        target_calories: calories,
        target_protein_g: protein,
        target_carbs_g: carbs,
        target_fat_g: fat,
        water_target_ml: water,
        water_consumed_ml: 1000
      };

      try {
        await apiRequest('/api/trainer/assign-diet', 'POST', { memberId, diet });
        closeModal('assignMacroModal');
        alert('Macro nutrition protocol prescribed.');
        await fetchTrainerDashboard();
      } catch (e) {
        alert(e.message);
      }
    }

    async function apiTrainerAddFeedback() {
      const select = document.getElementById('noteAthleteSelect');
      const memberId = select?.value;
      const traineeName = select?.options[select.selectedIndex]?.text?.split(' (')[0] || 'Athlete';
      const note = document.getElementById('coachingNoteText')?.value?.trim();
      const rating = document.getElementById('coachingNoteRating')?.value || 5;
      if (!note) return alert('Please enter coaching feedback text.');

      try {
        await apiRequest('/api/trainer/feedback', 'POST', { memberId, traineeName, note, rating });
        closeModal('addCoachingNoteModal');
        document.getElementById('coachingNoteText').value = '';
        alert('Feedback note saved.');
        await fetchTrainerDashboard();
      } catch (e) {
        alert(e.message);
      }
    }

    // ---------------- STOCK MOVEMENTS & INVENTORY ----------------
    function openStockMovementModal() {
      openModal('stockMovementModal');
    }

    async function apiRecordStockMovement() {
      const productId = document.getElementById('stockMoveProductSelect')?.value;
      const type = document.getElementById('stockMoveTypeSelect')?.value;
      const qtyChange = Number(document.getElementById('stockMoveQtyInput')?.value || 1);
      const reason = document.getElementById('stockMoveReasonInput')?.value?.trim();
      if (!productId) return alert('Select a product.');

      try {
        const res = await apiRequest('/api/admin/inventory/movement', 'POST', { productId, type, qtyChange, reason });
        closeModal('stockMovementModal');
        alert('Stock movement recorded. New Balance: ' + res.product.current_stock);
        await fetchAdminDashboard();
      } catch (e) {
        alert(e.message);
      }
    }

    // ---------------- CRM FOLLOW-UPS ----------------
    function openFollowUpLeadModal(leadId, currentStage) {
      document.getElementById('followUpLeadId').value = leadId;
      if (currentStage) document.getElementById('followUpStageSelect').value = currentStage;
      openModal('leadFollowUpModal');
    }

    async function apiSubmitLeadFollowUp() {
      const leadId = document.getElementById('followUpLeadId')?.value;
      const status = document.getElementById('followUpStageSelect')?.value;
      const followUpDate = document.getElementById('followUpDateInput')?.value;
      const notes = document.getElementById('followUpNotesInput')?.value?.trim();
      if (!leadId) return alert('Invalid lead');

      try {
        await apiRequest('/api/admin/leads/follow-up', 'POST', { leadId, status, followUpDate, notes, staff: currentUser?.fullName || 'Admin' });
        closeModal('leadFollowUpModal');
        alert('Lead status updated.');
        await fetchAdminDashboard();
      } catch (e) {
        alert(e.message);
      }
    }

    // ---------------- REPORTS & PRINT VIEW ----------------
    async function printReport(type = 'revenue') {
      try {
        const res = await apiRequest('/api/admin/reports?dateRange=All+Time');
        const d = res.detailed || res;
        const box = document.getElementById('reportsPrintContent');
        if (box) {
          box.innerHTML = '<div class="space-y-4">' +
            '<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">' +
              '<div class="p-3 bg-[#242424] rounded-lg"><span class="text-[#858585] block text-[10px]">TOTAL REVENUE</span><span class="text-lg font-bold text-white">₹' + Number(d.summary?.totalRevenue || 0).toLocaleString() + '</span></div>' +
              '<div class="p-3 bg-[#242424] rounded-lg"><span class="text-[#858585] block text-[10px]">TOTAL EXPENSES</span><span class="text-lg font-bold text-white">₹' + Number(d.summary?.totalExpenses || 0).toLocaleString() + '</span></div>' +
              '<div class="p-3 bg-[#242424] rounded-lg"><span class="text-[#858585] block text-[10px]">NET PROFIT</span><span class="text-lg font-bold text-emerald-400">₹' + Number(d.summary?.netProfit || 0).toLocaleString() + '</span></div>' +
              '<div class="p-3 bg-[#242424] rounded-lg"><span class="text-[#858585] block text-[10px]">OPERATING MARGIN</span><span class="text-lg font-bold text-white">' + (d.summary?.profitMargin || '0%') + '</span></div>' +
            '</div>' +
            '<div class="mt-4"><strong class="text-white block mb-2">MEMBERSHIP SALES BREAKDOWN</strong>' +
              '<table class="w-full text-left text-xs divide-y divide-[#393939]"><thead class="text-[#858585]"><tr><th>Tier</th><th>Units</th><th>Revenue</th></tr></thead>' +
              '<tbody class="divide-y divide-[#2c2c2c] text-[#B5B5B5]">' +
                (d.membershipSales || []).map(m => '<tr><td class="py-1.5">' + m.tier + '</td><td>' + m.unitsSold + '</td><td class="text-white font-bold">₹' + Number(m.revenue).toLocaleString() + '</td></tr>').join('') +
              '</tbody></table>' +
            '</div>' +
            '<div class="mt-4"><strong class="text-white block mb-2">ATTENDANCE PEAK DISTRIBUTION</strong>' +
              '<table class="w-full text-left text-xs divide-y divide-[#393939]"><thead class="text-[#858585]"><tr><th>Time Window</th><th>Period</th><th>Avg Check-ins</th></tr></thead>' +
              '<tbody class="divide-y divide-[#2c2c2c] text-[#B5B5B5]">' +
                (d.attendanceBreakdown || []).map(a => '<tr><td class="py-1.5">' + a.timeSlot + '</td><td>' + a.peakLabel + '</td><td class="text-white font-bold">' + a.avgCheckins + ' athletes</td></tr>').join('') +
              '</tbody></table>' +
            '</div>' +
          '</div>';
        }
        openModal('reportsPrintModal');
      } catch (e) {
        alert(e.message);
      }
    }

    // AI Coach Interaction
    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    async function sendAiMessage() {
      const input = document.getElementById('aiInput');
      const text = input ? input.value.trim() : '';
      if (!text) return;

      lastAiQuestion = text;
      const box = document.getElementById('aiChatBox');
      const loading = document.getElementById('aiLoadingIndicator');
      const loadingText = document.getElementById('aiLoadingText');
      const errBox = document.getElementById('aiErrorContainer');
      const errText = document.getElementById('aiErrorMessage');
      const sendBtn = document.getElementById('aiSendBtn');

      // Append user bubble
      if (box) {
        box.innerHTML += '<div class="flex items-start justify-end space-x-2">' +
          '<div class="bg-[#F0441D]/20 border border-[#F0441D]/40 p-2.5 rounded-xl max-w-[85%] text-white text-xs">' + escapeHtml(text) + '</div>' +
        '</div>';
        box.scrollTop = box.scrollHeight;
      }
      if (input) input.value = '';

      // Set UI state
      if (loading) {
        if (loadingText) loadingText.innerText = t('ai_loading');
        loading.classList.remove('hidden');
      }
      if (errBox) errBox.classList.add('hidden');
      if (sendBtn) sendBtn.disabled = true;

      try {
        const res = await apiRequest('/api/ai-assistant', 'POST', {
          question: text,
          language: currentLang
        });

        if (box) {
          box.innerHTML += '<div class="flex items-start space-x-2">' +
            '<div class="w-6 h-6 rounded-full bg-[#F0441D]/20 border border-[#F0441D]/40 flex items-center justify-center text-[#F0441D] text-[10px] shrink-0 mt-0.5"><i class="fa-solid fa-robot"></i></div>' +
            '<div class="bg-[#242424] p-3 rounded-xl max-w-[85%] text-white text-xs whitespace-pre-line leading-relaxed">' + escapeHtml(res.answer) + '</div>' +
          '</div>';
          box.scrollTop = box.scrollHeight;
        }
      } catch (err) {
        console.warn('AI Coach communication notice:', err);
        const friendlyMsg = t('ai_error');
        if (errBox && errText) {
          errText.innerText = friendlyMsg;
          errBox.classList.remove('hidden');
        }
        if (box) {
          box.innerHTML += '<div class="flex items-start space-x-2">' +
            '<div class="w-6 h-6 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 text-[10px] shrink-0 mt-0.5"><i class="fa-solid fa-triangle-exclamation"></i></div>' +
            '<div class="bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl max-w-[85%] text-red-300 text-xs">' + friendlyMsg + '</div>' +
          '</div>';
          box.scrollTop = box.scrollHeight;
        }
      } finally {
        if (loading) loading.classList.add('hidden');
        if (sendBtn) sendBtn.disabled = false;
      }
    }

    function retryAiMessage() {
      if (!lastAiQuestion) return;
      const input = document.getElementById('aiInput');
      if (input) input.value = lastAiQuestion;
      sendAiMessage();
    }

    // PWA Install & Offline Management
    let deferredPwaPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPwaPrompt = e;
      const btn = document.getElementById('pwaInstallBtn');
      if (btn) btn.classList.remove('hidden');
    });

    window.addEventListener('appinstalled', () => {
      deferredPwaPrompt = null;
      const btn = document.getElementById('pwaInstallBtn');
      if (btn) btn.classList.add('hidden');
    });

    function installPWA() {
      const isIOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
      if (isIOS) {
        openModal('pwaIosModal');
        return;
      }
      if (deferredPwaPrompt) {
        deferredPwaPrompt.prompt();
        deferredPwaPrompt.userChoice.then(() => {
          deferredPwaPrompt = null;
          const btn = document.getElementById('pwaInstallBtn');
          if (btn) btn.classList.add('hidden');
        });
      }
    }

    function updateOnlineStatus() {
      const banner = document.getElementById('offlineBanner');
      if (banner) {
        banner.classList.toggle('hidden', navigator.onLine);
      }
    }
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // App Initialization
    async function initApp() {
      // Apply persisted language configuration
      applyTranslations();

      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(err => {
          console.warn('[PWA] ServiceWorker notice:', err);
        });
      }

      const path = (window.location && window.location.pathname ? window.location.pathname : '').toLowerCase();

      if (authToken) {
        try {
          const res = await apiRequest('/api/auth/me');
          currentUser = res.user;

          // Route enforcement for dedicated URLs
          if (path.includes('trainer') && currentUser.role !== 'TRAINER' && currentUser.role !== 'SUPER_ADMIN') {
            console.warn('Redirecting unauthorized user from trainer portal');
            await routeUserToDashboard(currentUser.role);
            dismissSplashScreen();
            return;
          }

          await routeUserToDashboard(currentUser.role);
          dismissSplashScreen();
          return;
        } catch (e) {
          localStorage.removeItem('fithub_auth_token');
          authToken = null;
        }
      }

      // Unauthenticated state
      setAuthMode('signin');
      if (path === '/login/trainer' || path === '/dashboard/trainer') {
        const titleEl = document.getElementById('loginPageTitle');
        if (titleEl) titleEl.innerText = 'TRAINER PORTAL';
        const subtitleEl = document.getElementById('loginSubtitle');
        if (subtitleEl) subtitleEl.innerText = 'Sign in with your trainer credentials';
      }
      navigateTo('login');
      dismissSplashScreen();
    }

    function dismissSplashScreen() {
      const splash = document.getElementById('splashScreen');
      if (splash) {
        setTimeout(function() {
          splash.classList.add('fade-out');
          setTimeout(function() {
            splash.style.display = 'none';
          }, 500);
        }, 1200);
      }
    }

    initApp();
  </script>
</body>
</html>
`;
}
