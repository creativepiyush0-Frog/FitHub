import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleApiRoute, sendJson, parseJsonBody } from "./src/api.js";
import { db } from "./src/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.DEFAULT_APP_PORT || process.env.PORT || 3000;

// Gemini API integration on the server side
async function callGeminiApi(prompt, systemInstruction) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return "FIT HUB AI Coach is active. (Connect GEMINI_API_KEY in environment for live model responses). Focus on high protein intake, progressive overload in compound lifts, and 7-8 hours of sleep.";
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
  };

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "Keep pushing your limits! Stay consistent with your nutrition and training.";
  } catch (err) {
    console.error("Gemini API call failed:", err);
    return "Error communicating with AI service. Focus on form and progressive overload.";
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (url.pathname === "/health" || url.pathname === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "healthy", timestamp: new Date().toISOString(), database: "ready" }));
    return;
  }

  // AI Assistant Server Route
  if (url.pathname === "/api/ai-assistant" && req.method === "POST") {
    try {
      const { question, member, language } = await parseJsonBody(req);
      const sysInstruction = `You are FIT HUB's elite AI Fitness Coach. Context: Member is ${member?.name || "Athlete"}, Plan: ${member?.planName || "No active membership"}. Provide concise, actionable advice in ${language === "hi" ? "Hindi (हिन्दी)" : "English"}.`;
      
      const answer = await callGeminiApi(question, sysInstruction);
      sendJson(res, 200, { answer });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  // API router
  if (url.pathname.startsWith("/api/")) {
    const handled = await handleApiRoute(req, res, url);
    if (handled) return;
    sendJson(res, 404, { error: "API endpoint not found." });
    return;
  }

  // Serve Frontend Single-Page App
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(renderWebApp());
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
  </style>
</head>
<body class="min-h-screen flex flex-col justify-between">

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
        <!-- Quick Role Switcher -->
        <select id="quickRoleSwitch" onchange="quickSwitchRole(this.value)" class="input-field text-xs px-2.5 py-1.5 font-semibold bg-[#171717] border border-[#393939]">
          <option value="MEMBER">Role: Member</option>
          <option value="GYM_ADMIN">Role: Gym Admin</option>
          <option value="SUPER_ADMIN">Role: Super Admin</option>
        </select>

        <!-- Notification Bell -->
        <button onclick="openModal('notificationsModal')" class="relative p-2 rounded-xl bg-[#171717] border border-[#393939] text-[#B5B5B5] hover:text-white">
          <i class="fa-solid fa-bell text-sm"></i>
          <span id="headerNotifDot" class="hidden absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#F0441D]"></span>
        </button>

        <!-- Language Button -->
        <button onclick="toggleLang()" class="px-2.5 py-1 rounded-xl bg-[#171717] border border-[#393939] text-xs font-bold text-[#B5B5B5] hover:text-white">
          <span id="langBtnText">हिन्दी</span>
        </button>

        <!-- Logout Button -->
        <button id="logoutBtn" onclick="performLogout()" class="hidden px-2.5 py-1 rounded-xl bg-[#242424] border border-[#393939] text-xs text-[#858585] hover:text-[#F0441D]">
          <i class="fa-solid fa-right-from-bracket"></i>
        </button>
      </div>
    </header>

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

    <!-- VIEW 2: AUTHENTICATION SCREEN (LOGIN / REGISTER) -->
    <div id="view-login" class="w-full max-w-md mx-auto my-auto py-8 space-y-5 hidden">
      <button onclick="navigateTo('role_select')" class="text-xs text-[#AAAAAA] hover:text-white flex items-center">
        <i class="fa-solid fa-arrow-left mr-1.5"></i> Back to roles
      </button>

      <div class="text-center space-y-1">
        <div class="fithub-logo text-3xl">
          <span class="fit">FIT</span><span class="hub">HUB</span>
        </div>
        <h2 id="loginPageTitle" class="fithub-heading text-2xl text-white mt-1">WELCOME BACK</h2>
        <p id="loginSubtitle" class="text-xs text-[#B5B5B5]">Sign in to your authenticated account</p>
      </div>

      <!-- Auth Tabs: Sign In / Register -->
      <div class="flex border-b border-[#393939] text-xs font-bold">
        <button id="authTabSignIn" onclick="setAuthMode('signin')" class="flex-1 py-2 border-b-2 border-[#F0441D] text-white">SIGN IN</button>
        <button id="authTabRegister" onclick="setAuthMode('register')" class="flex-1 py-2 text-[#858585] hover:text-white">REGISTER (NEW MEMBER)</button>
      </div>

      <div id="authAlert" class="hidden p-3 rounded-xl text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/30"></div>

      <form id="authForm" onsubmit="event.preventDefault(); performAuth();" class="space-y-4">
        <div id="fullNameGroup" class="space-y-1.5 hidden">
          <label class="text-[10px] uppercase font-bold text-[#858585]">Full Name</label>
          <input type="text" id="authFullName" class="input-field w-full p-3 text-xs" placeholder="e.g. Rahul Sharma">
        </div>

        <div class="space-y-1.5">
          <label class="text-[10px] uppercase font-bold text-[#858585]">Email Address</label>
          <input type="email" id="authEmail" class="input-field w-full p-3 text-xs" placeholder="member@example.com" required>
        </div>

        <div class="space-y-1.5">
          <label class="text-[10px] uppercase font-bold text-[#858585]">Password</label>
          <input type="password" id="authPassword" value="password123" class="input-field w-full p-3 text-xs" placeholder="••••••••" required>
        </div>

        <button type="submit" id="authSubmitBtn" class="btn-orange w-full py-3.5 text-sm uppercase tracking-wider shadow">
          SIGN IN
        </button>
      </form>

      <!-- Demo Accounts Card -->
      <div class="glass-card p-4 bg-[#171717] border border-[#393939] text-xs">
        <div class="flex items-center justify-between text-[11px] font-bold text-[#F0441D]">
          <span><i class="fa-solid fa-key mr-1"></i> TEST CREDENTIALS</span>
          <span class="text-[#858585]">Password: password123</span>
        </div>
        <div class="grid grid-cols-3 gap-2 mt-2.5 text-[10px]">
          <button onclick="fillAuthCredentials('demo.member@fithub.com', 'password123', 'MEMBER')" class="bg-[#242424] hover:bg-[#2c2c2c] p-2 rounded-lg border border-[#393939] text-center font-bold">
            Demo Member
          </button>
          <button onclick="fillAuthCredentials('admin@downtown.fithub.com', 'password123', 'GYM_ADMIN')" class="bg-[#242424] hover:bg-[#2c2c2c] p-2 rounded-lg border border-[#393939] text-center font-bold">
            Gym Admin
          </button>
          <button onclick="fillAuthCredentials('platform@fithub.com', 'password123', 'SUPER_ADMIN')" class="bg-[#242424] hover:bg-[#2c2c2c] p-2 rounded-lg border border-[#393939] text-center font-bold">
            Super Admin
          </button>
        </div>
      </div>
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
          <button onclick="setMemberTab('overview')" id="mTab-overview" class="px-3.5 py-1.5 rounded-lg active-nav-pill whitespace-nowrap">Dashboard</button>
          <button onclick="setMemberTab('workout')" id="mTab-workout" class="px-3.5 py-1.5 rounded-lg text-[#B5B5B5] hover:text-white whitespace-nowrap">Workout</button>
          <button onclick="setMemberTab('diet')" id="mTab-diet" class="px-3.5 py-1.5 rounded-lg text-[#B5B5B5] hover:text-white whitespace-nowrap">Diet</button>
          <button onclick="setMemberTab('progress')" id="mTab-progress" class="px-3.5 py-1.5 rounded-lg text-[#B5B5B5] hover:text-white whitespace-nowrap">Progress & BMI</button>
          <button onclick="setMemberTab('goals')" id="mTab-goals" class="px-3.5 py-1.5 rounded-lg text-[#B5B5B5] hover:text-white whitespace-nowrap">Goals</button>
          <button onclick="setMemberTab('qr')" id="mTab-qr" class="px-3.5 py-1.5 rounded-lg text-[#B5B5B5] hover:text-white whitespace-nowrap">QR Pass</button>
          <button onclick="setMemberTab('classes')" id="mTab-classes" class="px-3.5 py-1.5 rounded-lg text-[#B5B5B5] hover:text-white whitespace-nowrap">Classes & Billing</button>
          <button onclick="setMemberTab('aicoach')" id="mTab-aicoach" class="px-3.5 py-1.5 rounded-lg text-[#F0441D] font-bold hover:text-white whitespace-nowrap">🤖 AI Coach</button>
          <button onclick="setMemberTab('support')" id="mTab-support" class="px-3.5 py-1.5 rounded-lg text-[#B5B5B5] hover:text-white whitespace-nowrap">Support</button>
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
                <h3 class="fithub-heading text-lg text-white">AI FITNESS COACH</h3>
                <p class="text-xs text-[#B5B5B5]">Server-side Gemini AI grounded in your real profile, workout, and diet records.</p>
              </div>
            </div>

            <!-- Chat box -->
            <div id="aiChatBox" class="h-64 overflow-y-auto bg-[#0A0A0A] p-4 rounded-xl border border-[#393939] space-y-3 text-xs mb-3">
              <div class="flex items-start space-x-2">
                <div class="bg-[#242424] p-3 rounded-xl max-w-[85%] text-white">
                  👋 Hello! I am your FIT HUB AI Fitness Coach. Ask me about your assigned workout, macro targets, or form recommendations!
                </div>
              </div>
            </div>

            <div class="flex items-center space-x-2">
              <input type="text" id="aiInput" placeholder="Ask your coach anything..." class="input-field flex-1 p-2.5 text-xs">
              <button onclick="sendAiMessage()" class="btn-orange px-4 py-2.5 text-xs font-bold">
                <i class="fa-solid fa-paper-plane mr-1"></i> Send
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
          <div class="flex items-center space-x-2">
            <button onclick="openModal('recordExpenseModal')" class="btn-secondary text-xs px-3 py-2">
              <i class="fa-solid fa-receipt mr-1"></i> Add Expense
            </button>
            <button onclick="openModal('addLeadModal')" class="btn-orange text-xs px-3 py-2">
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

  <!-- CLIENT LOGIC & REST API BRIDGE -->
  <script>
    let authToken = localStorage.getItem('fithub_auth_token') || null;
    let currentUser = null;
    let currentRole = 'MEMBER';
    let currentLang = 'en';
    let authMode = 'signin';
    let memberDashboardData = null;

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
      currentRole = role;
      document.getElementById('quickRoleSwitch').value = role;
      const titleEl = document.getElementById('loginPageTitle');

      if (role === 'MEMBER') {
        titleEl.innerText = 'MEMBER PORTAL';
      } else if (role === 'GYM_ADMIN') {
        titleEl.innerText = 'GYM OWNER / ADMIN';
      } else if (role === 'SUPER_ADMIN') {
        titleEl.innerText = 'SUPER ADMIN PORTAL';
      }

      setAuthMode('signin');
      navigateTo('login');
    }

    function setAuthMode(mode) {
      authMode = mode;
      document.getElementById('authTabSignIn').className = mode === 'signin' ? 'flex-1 py-2 border-b-2 border-[#F0441D] text-white font-bold' : 'flex-1 py-2 text-[#858585] hover:text-white';
      document.getElementById('authTabRegister').className = mode === 'register' ? 'flex-1 py-2 border-b-2 border-[#F0441D] text-white font-bold' : 'flex-1 py-2 text-[#858585] hover:text-white';
      document.getElementById('fullNameGroup').classList.toggle('hidden', mode !== 'register');
      document.getElementById('authSubmitBtn').innerText = mode === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT & START';
      document.getElementById('authAlert').classList.add('hidden');
    }

    function fillAuthCredentials(email, password, role) {
      currentRole = role;
      document.getElementById('quickRoleSwitch').value = role;
      document.getElementById('authEmail').value = email;
      document.getElementById('authPassword').value = password;
      setAuthMode('signin');
    }

    async function performAuth() {
      const email = document.getElementById('authEmail').value.trim();
      const password = document.getElementById('authPassword').value;
      const fullName = document.getElementById('authFullName').value.trim();
      const alertBox = document.getElementById('authAlert');
      alertBox.classList.add('hidden');

      try {
        let res;
        if (authMode === 'register') {
          res = await apiRequest('/api/auth/register', 'POST', { email, password, fullName, role: currentRole });
        } else {
          res = await apiRequest('/api/auth/login', 'POST', { email, password, expectedRole: currentRole });
        }

        authToken = res.token;
        currentUser = res.user;
        localStorage.setItem('fithub_auth_token', authToken);

        quickSwitchRole(currentUser.role);
      } catch (err) {
        alertBox.innerText = err.message;
        alertBox.classList.remove('hidden');
      }
    }

    function performLogout() {
      authToken = null;
      currentUser = null;
      localStorage.removeItem('fithub_auth_token');
      navigateTo('role_select');
    }

    async function quickSwitchRole(role) {
      currentRole = role;
      document.getElementById('quickRoleSwitch').value = role;
      document.getElementById('subview-member').classList.toggle('hidden', role !== 'MEMBER');
      document.getElementById('subview-admin').classList.toggle('hidden', role !== 'GYM_ADMIN');
      document.getElementById('subview-superadmin').classList.toggle('hidden', role !== 'SUPER_ADMIN');

      navigateTo('dashboard');

      if (role === 'MEMBER') {
        await fetchMemberDashboard();
      } else if (role === 'GYM_ADMIN') {
        await fetchAdminDashboard();
      } else if (role === 'SUPER_ADMIN') {
        await fetchSuperAdminDashboard();
      }
    }

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

    function renderMemberDashboardUI(d) {
      document.getElementById('memberProfileName').innerText = d.profile.fullName;
      document.getElementById('memberProfileEmail').innerText = d.profile.email;

      // Status badge
      const badge = document.getElementById('memberStatusBadge');
      if (d.membership.remainingDays > 0) {
        badge.className = 'text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
        badge.innerText = 'ACTIVE MEMBER';
      } else {
        badge.className = 'text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-800 text-[#B5B5B5] border border-[#393939]';
        badge.innerText = 'No active membership';
      }

      // Hero Card
      const heroCard = document.getElementById('heroMembershipCard');
      const heroTitle = document.getElementById('heroPlanTitle');
      const heroDays = document.getElementById('heroDaysRemaining');
      const heroStreak = document.getElementById('heroStreakCount');
      const heroExpiry = document.getElementById('heroExpiryText');

      heroDays.innerText = d.membership.remainingDays;
      heroStreak.innerText = d.attendance.streak;

      if (d.membership.remainingDays > 0) {
        heroCard.className = 'glass-card p-6 bg-gradient-to-r from-[#171717] to-[#251b17] border-l-4 border-[#F0441D]';
        heroTitle.innerText = d.membership.planName.toUpperCase();
        heroDays.className = 'text-2xl font-black text-[#F0441D]';
        heroExpiry.innerText = d.membership.remainingDays + ' days left';
      } else {
        heroCard.className = 'glass-card p-6 bg-gradient-to-r from-[#171717] to-[#1D1D1D] border-l-4 border-[#393939]';
        heroTitle.innerText = 'NO ACTIVE MEMBERSHIP';
        heroDays.className = 'text-2xl font-black text-[#858585]';
        heroExpiry.innerText = 'No expiry';
      }

      // Attendance
      document.getElementById('totalCheckInCount').innerText = d.attendance.totalCheckIns;
      document.getElementById('todayAttendanceLabel').innerText = d.attendance.todayAttendance;
      document.getElementById('monthlyAttendanceLabel').innerText = d.attendance.monthlyAttendancePercent + '%';

      const gateStatus = document.getElementById('memberGateStatus');
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
            <p class="text-sm font-semibold text-white">No workout assigned yet</p>
            <p class="text-xs text-[#858585] mt-1">Your trainer has not assigned a workout routine yet.</p>
            <button onclick="apiAssignWorkout()" class="btn-secondary text-xs px-3.5 py-1.5 mt-3">
              <i class="fa-solid fa-plus mr-1"></i> Request / Assign Routine
            </button>
          </div>
        \`;
        over.innerHTML = emptyHtml;
        scr.innerHTML = \`
          <div class="glass-card p-8 text-center border border-[#393939]">
            <i class="fa-solid fa-dumbbell text-3xl text-[#858585] mb-2"></i>
            <h4 class="text-base font-bold text-white">No workout assigned yet</h4>
            <p class="text-xs text-[#858585] mt-1 max-w-sm mx-auto">Your personal coach or gym instructor has not scheduled a workout program for your profile yet.</p>
            <button onclick="apiAssignWorkout()" class="btn-orange text-xs px-4 py-2 mt-4 font-bold">
              <i class="fa-solid fa-plus mr-1"></i> Assign Training Program
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
            <p class="text-sm font-semibold text-white">No diet assigned yet</p>
            <p class="text-xs text-[#858585] mt-1">Your nutritionist has not assigned a diet plan yet.</p>
            <button onclick="apiAssignDiet()" class="btn-secondary text-xs px-3.5 py-1.5 mt-3">
              <i class="fa-solid fa-plus mr-1"></i> Request Diet Plan
            </button>
          </div>
        \`;
        over.innerHTML = emptyHtml;
        scr.innerHTML = \`
          <div class="glass-card p-8 text-center border border-[#393939]">
            <i class="fa-solid fa-utensils text-3xl text-[#858585] mb-2"></i>
            <h4 class="text-base font-bold text-white">No diet assigned yet</h4>
            <p class="text-xs text-[#858585] mt-1 max-w-sm mx-auto">No nutrition protocol or calorie target is currently active for your profile.</p>
            <button onclick="apiAssignDiet()" class="btn-orange text-xs px-4 py-2 mt-4 font-bold">
              <i class="fa-solid fa-plus mr-1"></i> Set Nutrition Targets
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
            <h4 class="text-base font-bold text-white">No progress records yet</h4>
            <p class="text-xs text-[#858585] mt-1 max-w-sm mx-auto">Track your body weight, BMI score, and measurements over time.</p>
            <button onclick="openModal('logProgressModal')" class="btn-orange text-xs px-4 py-2 mt-4 font-bold">
              <i class="fa-solid fa-plus mr-1"></i> Log Your First Weight
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
            <h4 class="text-base font-bold text-white">No goals yet</h4>
            <p class="text-xs text-[#858585] mt-1 max-w-sm mx-auto">Set target milestones for weight, personal strength records, or weekly workout frequency.</p>
            <button onclick="openModal('createGoalModal')" class="btn-orange text-xs px-4 py-2 mt-4 font-bold">
              <i class="fa-solid fa-plus mr-1"></i> Create Your First Goal
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
            <h4 class="text-base font-bold text-white">Turnstile Gate Pass Locked</h4>
            <p class="text-xs text-[#858585] mt-1">Digital QR access activates automatically when you have an active membership plan.</p>
            <button onclick="openModal('assignPlanModal')" class="btn-orange text-xs px-4 py-2 mt-4 font-bold">
              Activate Membership
            </button>
          </div>
        \`;
      } else {
        box.innerHTML = \`
          <div class="max-w-md mx-auto glass-card p-6 text-center border-2 border-[#F0441D]">
            <span class="text-[10px] uppercase font-black tracking-widest text-[#F0441D]">FIT HUB DIGITAL ACCESS PASS</span>
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
            <p class="text-sm font-bold text-white">No upcoming bookings</p>
            <p class="text-xs text-[#858585] mt-1">You have not booked any group classes yet.</p>
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
        box.innerHTML = '<p class="text-center text-[#858585] py-4">No notifications.</p>';
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
        lBox.innerHTML = d.leads.map(l => \`
          <div class="p-3 bg-[#242424] rounded-xl flex justify-between items-center">
            <div>
              <strong class="text-white block">\${l.full_name}</strong>
              <span class="text-[#858585]">\${l.phone} • Plan: \${l.interested_plan}</span>
            </div>
            <span class="text-[#F0441D] font-bold text-[10px] bg-[#F0441D]/10 px-2 py-0.5 rounded border border-[#F0441D]/30">\${l.status}</span>
          </div>
        \`).join('') || '<p class="text-[#858585]">No active leads.</p>';

        // Inventory
        const iBox = document.getElementById('admInventoryContainer');
        iBox.innerHTML = d.inventory.map(i => \`
          <div class="p-3 bg-[#242424] rounded-xl flex justify-between items-center">
            <div>
              <strong class="text-white block">\${i.name}</strong>
              <span class="text-[#858585]">Stock: \${i.current_stock} units • Retail: ₹\${i.selling_price}</span>
            </div>
            <span class="text-xs font-black text-white">₹\${i.selling_price}</span>
          </div>
        \`).join('') || '<p class="text-[#858585]">No inventory items recorded.</p>';
      } catch (err) {
        console.error('Admin dashboard error:', err);
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
        aBox.innerHTML = d.recentAuditLogs.map(l => \`
          <div class="p-3 bg-[#242424] rounded-xl flex justify-between items-center text-xs">
            <div>
              <strong class="text-white block">\${l.action}</strong>
              <span class="text-[#858585]">Actor: \${l.actor_role} • Entity: \${l.entity} (\${l.entity_id || 'Global'})</span>
            </div>
            <span class="text-[#858585] text-[10px]">\${new Date(l.timestamp).toLocaleTimeString()}</span>
          </div>
        \`).join('') || '<p class="text-[#858585]">No audit logs recorded.</p>';
      } catch (err) {
        console.error('Super admin error:', err);
      }
    }

    // AI Coach Interaction
    async function sendAiMessage() {
      const input = document.getElementById('aiInput');
      const text = input.value.trim();
      if (!text) return;

      const box = document.getElementById('aiChatBox');
      box.innerHTML += \`
        <div class="flex items-start justify-end space-x-2">
          <div class="bg-[#F0441D]/20 border border-[#F0441D]/40 p-2.5 rounded-xl max-w-[85%] text-white">
            \${text}
          </div>
        </div>
      \`;
      input.value = '';
      box.scrollTop = box.scrollHeight;

      try {
        const res = await apiRequest('/api/ai-assistant', 'POST', {
          question: text,
          member: currentUser,
          language: currentLang
        });

        box.innerHTML += \`
          <div class="flex items-start space-x-2">
            <div class="bg-[#242424] p-3 rounded-xl max-w-[85%] text-white">
              \${res.answer}
            </div>
          </div>
        \`;
        box.scrollTop = box.scrollHeight;
      } catch (err) {
        box.innerHTML += \`<div class="text-red-400 text-xs">Coach is offline temporarily.</div>\`;
      }
    }

    function toggleLang() {
      currentLang = currentLang === 'en' ? 'hi' : 'en';
      document.getElementById('langBtnText').innerText = currentLang === 'en' ? 'हिन्दी' : 'EN';
    }

    // App Initialization
    async function initApp() {
      if (authToken) {
        try {
          const res = await apiRequest('/api/auth/me');
          currentUser = res.user;
          quickSwitchRole(currentUser.role);
          return;
        } catch (e) {
          localStorage.removeItem('fithub_auth_token');
          authToken = null;
        }
      }
      navigateTo('role_select');
    }

    initApp();
  </script>
</body>
</html>
`;
}
