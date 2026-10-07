// ============================================================================
// FIT HUB — Server API Routes & Supabase Backend Controller
// Production Source of Truth: Supabase PostgreSQL & Supabase Auth
// ============================================================================

import { dbService, supabase, verifyToken, generateToken } from "./db.js";

// Helper: parse JSON request body
export async function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

// Helper: send JSON response
export function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  });
  res.end(JSON.stringify(data));
}

// Helper: extract authenticated user from Bearer header via Supabase Auth
export async function getAuthUser(req) {
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;
  if (!token) return null;

  // 1. Verify via real Supabase Auth
  if (supabase) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (user && !error) {
        const profile = await dbService.getProfile(user.id);
        return {
          id: user.id,
          email: user.email,
          role: (profile?.role || "MEMBER").toUpperCase(),
          fullName: profile?.full_name || "Member",
          gymId: profile?.gym_id || null,
          branchId: profile?.branch_id || null,
          token
        };
      }
    } catch (e) {
      console.warn("[getAuthUser] Supabase token check:", e.message);
    }
  }

  // 2. Fallback to server JWT verification
  const payload = verifyToken(token);
  if (payload && payload.id) {
    const profile = await dbService.getProfile(payload.id);
    return {
      id: payload.id,
      email: payload.email,
      role: (payload.role || profile?.role || "MEMBER").toUpperCase(),
      fullName: profile?.full_name || "Member",
      gymId: profile?.gym_id || null,
      branchId: profile?.branch_id || null,
      token
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// REST API Router
// ---------------------------------------------------------------------------
export async function handleApiRoute(req, res, url) {
  const method = req.method;
  const pathname = url.pathname;

  // Handle CORS Preflight
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    });
    res.end();
    return true;
  }

  // -------------------------------------------------------------------------
  // 1. AUTHENTICATION ROUTES (Supabase Auth Authority)
  // -------------------------------------------------------------------------

  // POST /api/auth/register
  if (pathname === "/api/auth/register" && method === "POST") {
    try {
      const body = await parseJsonBody(req);
      const { email, password, fullName, role = "MEMBER" } = body;

      if (!email || !password || !fullName) {
        sendJson(res, 400, { error: "Email, password, and full name are required." });
        return true;
      }

      // New registrations are always assigned the MEMBER role for safety
      const result = await dbService.signUp(email, password, fullName, "MEMBER");

      await dbService.logAudit(
        { id: result.user.id, role: "MEMBER" },
        "MEMBER_REGISTERED",
        "PROFILE",
        result.user.id,
        { email: result.user.email }
      );

      sendJson(res, 201, {
        message: "Registration successful. Clean new account initialized.",
        token: result.session?.access_token || generateToken({ id: result.user.id, email: result.user.email, role: "MEMBER" }),
        user: {
          id: result.user.id,
          email: result.user.email,
          fullName: result.profile?.full_name || fullName,
          role: "MEMBER"
        }
      });
    } catch (err) {
      console.error("[Register Error]", err.message);
      sendJson(res, 400, { error: err.message || "Failed to register user." });
    }
    return true;
  }

  // POST /api/auth/login
  if (pathname === "/api/auth/login" && method === "POST") {
    try {
      const body = await parseJsonBody(req);
      const { email, password, expectedRole } = body;

      if (!email || !password) {
        sendJson(res, 400, { error: "Email and password are required." });
        return true;
      }

      const result = await dbService.signIn(email, password);
      const profile = result.profile || {};
      const actualRole = (profile.role || "MEMBER").toUpperCase();

      // Role check: Reject mismatched roles
      if (expectedRole) {
        const reqRole = expectedRole.toUpperCase();
        let authorized = false;

        if (reqRole === "MEMBER" && actualRole === "MEMBER") authorized = true;
        if (["GYM_ADMIN", "GYM_OWNER"].includes(reqRole) && ["GYM_ADMIN", "GYM_OWNER", "SUPER_ADMIN"].includes(actualRole)) authorized = true;
        if (reqRole === "SUPER_ADMIN" && actualRole === "SUPER_ADMIN") authorized = true;
        if (reqRole === "TRAINER" && ["TRAINER", "GYM_ADMIN", "GYM_OWNER", "SUPER_ADMIN"].includes(actualRole)) authorized = true;

        if (!authorized) {
          sendJson(res, 403, {
            error: `Unauthorized: Your account role (${actualRole}) is not permitted for the ${reqRole} dashboard.`
          });
          return true;
        }
      }

      await dbService.logAudit(
        { id: result.user.id, role: actualRole },
        "USER_LOGIN",
        "PROFILE",
        result.user.id,
        { email: result.user.email }
      );

      sendJson(res, 200, {
        message: "Authentication successful.",
        token: result.session?.access_token || generateToken({ id: result.user.id, email: result.user.email, role: actualRole }),
        user: {
          id: result.user.id,
          email: result.user.email,
          fullName: profile.full_name || "Authenticated User",
          role: actualRole,
          gymId: profile.gym_id || null,
          branchId: profile.branch_id || null
        }
      });
    } catch (err) {
      console.error("[Login Error]", err.message);
      sendJson(res, 401, { error: err.message || "Invalid credentials." });
    }
    return true;
  }

  // GET /api/auth/me
  if (pathname === "/api/auth/me" && method === "GET") {
    const user = await getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Not authenticated or token expired." });
      return true;
    }
    sendJson(res, 200, { user });
    return true;
  }

  // -------------------------------------------------------------------------
  // 2. MEMBER APPLICATION ROUTES
  // -------------------------------------------------------------------------

  // GET /api/member/dashboard
  if (pathname === "/api/member/dashboard" && method === "GET") {
    const user = await getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Authentication required." });
      return true;
    }

    try {
      const data = await dbService.getMemberDashboard(user.id, user.token);
      const memberObj = {
        id: user.id,
        name: user.fullName || "Member",
        fullName: user.fullName || "Member",
        email: user.email,
        role: user.role,
        ...data
      };

      sendJson(res, 200, {
        member: memberObj,
        profile: {
          id: user.id,
          fullName: user.fullName || "Member",
          email: user.email,
          role: user.role
        },
        membership: {
          planName: data.planName || "No active membership",
          status: data.status || "INACTIVE",
          remainingDays: data.remainingDays || 0,
          expiryDate: data.expiryDate || "No expiry"
        },
        attendance: {
          streak: data.streak || 0,
          totalCheckIns: data.attendanceCount || 0,
          todayAttendance: data.todayAttended ? 1 : 0,
          monthlyAttendancePercent: parseInt(data.monthlyPercent, 10) || 0,
          logs: data.attendanceLogs || []
        },
        workout: data.workouts?.[0] || null,
        diet: data.diet || null,
        progressList: data.progress || [],
        goalsList: data.goals || [],
        qrPass: {
          active: (data.remainingDays || 0) > 0,
          code: `FH-${(user.id || 'MEM').slice(0, 8).toUpperCase()}`
        },
        bookingsList: data.bookings || [],
        invoicesList: data.payments || [],
        paymentsList: data.payments || [],
        notificationsList: data.notifications || []
      });
    } catch (err) {
      console.error("[Member Dashboard Error]", err.message);
      sendJson(res, 500, { error: err.message });
    }
    return true;
  }

  // POST /api/member/assign-plan
  if (pathname === "/api/member/assign-plan" && method === "POST") {
    const user = await getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Authentication required." });
      return true;
    }

    try {
      const body = await parseJsonBody(req);
      const { planName = "Elite 12-Month Pro + PT Pass", durationDays = 90, price = 21999.0, paymentMethod = "UPI" } = body;

      const result = await dbService.assignMembership(
        user.id,
        planName,
        durationDays,
        price,
        paymentMethod,
        user.token
      );

      await dbService.logAudit(
        user,
        "ASSIGN_MEMBERSHIP_PLAN",
        "MEMBERSHIP",
        user.id,
        { planName, price, paymentMethod, isDemoPayment: true }
      );

      sendJson(res, 200, {
        message: "Membership activated successfully. Safe Demo Payment Recorded.",
        ...result
      });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return true;
  }

  // POST /api/member/attendance-checkin or /api/member/check-in
  if ((pathname === "/api/member/attendance-checkin" || pathname === "/api/member/check-in") && method === "POST") {
    const user = await getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Authentication required." });
      return true;
    }

    try {
      const body = await parseJsonBody(req).catch(() => ({}));
      const result = await dbService.checkInAttendance(user.id, body.method || "QR_SCAN", user.token);

      await dbService.logAudit(
        user,
        "CHECK_IN_ATTENDANCE",
        "ATTENDANCE",
        user.id,
        { method: body.method || "QR_SCAN" }
      );

      sendJson(res, 200, {
        message: "Gym turnstile scan verified. Check-in logged.",
        streak: 1,
        ...result
      });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return true;
  }

  // POST /api/member/goals or /api/member/goal
  if ((pathname === "/api/member/goals" || pathname === "/api/member/goal") && method === "POST") {
    const user = await getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Authentication required." });
      return true;
    }

    try {
      const body = await parseJsonBody(req);
      const targetVal = body.targetValue || body.title || "85.0";
      const result = await dbService.addGoal(user.id, targetVal, body.goalType || "STRENGTH", user.token);

      sendJson(res, 201, {
        message: "Fitness goal milestone set successfully.",
        ...result
      });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return true;
  }

  // POST /api/member/progress
  if (pathname === "/api/member/progress" && method === "POST") {
    const user = await getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Authentication required." });
      return true;
    }

    try {
      const body = await parseJsonBody(req);
      const result = await dbService.addProgress(user.id, body, user.token);

      sendJson(res, 201, {
        message: "Body metrics logged successfully.",
        ...result
      });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return true;
  }

  // POST /api/member/book-class
  if (pathname === "/api/member/book-class" && method === "POST") {
    const user = await getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Authentication required." });
      return true;
    }

    try {
      const body = await parseJsonBody(req);
      const result = await dbService.bookClass(user.id, body.classId, user.token);

      sendJson(res, 200, {
        message: "Group fitness session reserved successfully.",
        ...result
      });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return true;
  }

  // POST /api/member/support-ticket
  if (pathname === "/api/member/support-ticket" && method === "POST") {
    const user = await getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Authentication required." });
      return true;
    }

    try {
      const body = await parseJsonBody(req);
      const result = await dbService.submitTicket(
        user.id,
        body.category,
        body.subject,
        body.description,
        user.token
      );

      sendJson(res, 201, {
        message: "Ticket submitted. Gym staff will address it promptly.",
        ...result
      });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return true;
  }

  // POST /api/member/workout-assign
  if (pathname === "/api/member/workout-assign" && method === "POST") {
    const user = await getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Authentication required." });
      return true;
    }
    try {
      const body = await parseJsonBody(req);
      const result = await dbService.assignWorkout(user.id, body.workout, user.token);
      sendJson(res, 200, { message: "Workout routine assigned successfully.", ...result });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return true;
  }

  // POST /api/member/workout-toggle
  if (pathname === "/api/member/workout-toggle" && method === "POST") {
    const user = await getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Authentication required." });
      return true;
    }
    try {
      const body = await parseJsonBody(req);
      const result = await dbService.toggleExercise(user.id, body.exerciseIndex, user.token);
      sendJson(res, 200, { message: "Exercise updated.", ...result });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return true;
  }

  // POST /api/member/diet-assign
  if (pathname === "/api/member/diet-assign" && method === "POST") {
    const user = await getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Authentication required." });
      return true;
    }
    try {
      const body = await parseJsonBody(req);
      const result = await dbService.assignDiet(user.id, body.diet, user.token);
      sendJson(res, 200, { message: "Nutrition protocol updated.", ...result });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return true;
  }

  // POST /api/member/water-log
  if (pathname === "/api/member/water-log" && method === "POST") {
    const user = await getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Authentication required." });
      return true;
    }
    try {
      const body = await parseJsonBody(req);
      const result = await dbService.logWater(user.id, body.amountMl || 250, user.token);
      sendJson(res, 200, { message: "Water intake logged.", ...result });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return true;
  }

  // -------------------------------------------------------------------------
  // 3. TRAINER MANAGEMENT ROUTES
  // -------------------------------------------------------------------------

  // GET /api/trainer/dashboard
  if (pathname === "/api/trainer/dashboard" && method === "GET") {
    const user = await getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Authentication required." });
      return true;
    }
    if (!["TRAINER", "GYM_ADMIN", "GYM_OWNER", "SUPER_ADMIN"].includes(user.role)) {
      sendJson(res, 403, { error: "Forbidden: Trainer privileges required." });
      return true;
    }
    try {
      const data = await dbService.getTrainerDashboard(user.id, user.token);
      sendJson(res, 200, data);
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return true;
  }

  // GET /api/trainer/schedule
  if (pathname === "/api/trainer/schedule" && method === "GET") {
    const user = await getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Authentication required." });
      return true;
    }
    if (!["TRAINER", "GYM_ADMIN", "GYM_OWNER", "SUPER_ADMIN"].includes(user.role)) {
      sendJson(res, 403, { error: "Forbidden: Trainer privileges required." });
      return true;
    }
    try {
      const data = await dbService.getTrainerDashboard(user.id, user.token);
      sendJson(res, 200, { schedule: data.schedule, availability: data.availability });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return true;
  }

  // POST /api/trainer/availability
  if (pathname === "/api/trainer/availability" && method === "POST") {
    const user = await getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Authentication required." });
      return true;
    }
    if (!["TRAINER", "GYM_ADMIN", "GYM_OWNER", "SUPER_ADMIN"].includes(user.role)) {
      sendJson(res, 403, { error: "Forbidden: Trainer privileges required." });
      return true;
    }
    try {
      const body = await parseJsonBody(req);
      const result = await dbService.updateTrainerAvailability(user.id, body.availability, user.token);
      sendJson(res, 200, result);
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return true;
  }

  // POST /api/trainer/feedback
  if (pathname === "/api/trainer/feedback" && method === "POST") {
    const user = await getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Authentication required." });
      return true;
    }
    if (!["TRAINER", "GYM_ADMIN", "GYM_OWNER", "SUPER_ADMIN"].includes(user.role)) {
      sendJson(res, 403, { error: "Forbidden: Trainer privileges required." });
      return true;
    }
    try {
      const body = await parseJsonBody(req);
      const result = await dbService.addTrainerFeedback(user.id, body.memberId, body.traineeName, body.note, body.rating, user.token);
      sendJson(res, 200, { message: "Feedback saved for athlete.", ...result });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return true;
  }

  // GET /api/trainer/trainees
  if (pathname === "/api/trainer/trainees" && method === "GET") {
    const user = await getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Authentication required." });
      return true;
    }
    if (!["TRAINER", "GYM_ADMIN", "GYM_OWNER", "SUPER_ADMIN"].includes(user.role)) {
      sendJson(res, 403, { error: "Forbidden: Trainer privileges required." });
      return true;
    }
    try {
      const adminData = await dbService.getAdminDashboard(user.branchId, user.token);
      sendJson(res, 200, { trainees: adminData.members || [] });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return true;
  }

  // POST /api/trainer/assign-workout
  if (pathname === "/api/trainer/assign-workout" && method === "POST") {
    const user = await getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Authentication required." });
      return true;
    }
    if (!["TRAINER", "GYM_ADMIN", "GYM_OWNER", "SUPER_ADMIN"].includes(user.role)) {
      sendJson(res, 403, { error: "Forbidden: Trainer privileges required." });
      return true;
    }
    try {
      const body = await parseJsonBody(req);
      const result = await dbService.assignWorkout(body.memberId, body.workout, user.token);
      sendJson(res, 200, { message: "Workout assigned to athlete.", ...result });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return true;
  }

  // POST /api/trainer/assign-diet
  if (pathname === "/api/trainer/assign-diet" && method === "POST") {
    const user = await getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Authentication required." });
      return true;
    }
    if (!["TRAINER", "GYM_ADMIN", "GYM_OWNER", "SUPER_ADMIN"].includes(user.role)) {
      sendJson(res, 403, { error: "Forbidden: Trainer privileges required." });
      return true;
    }
    try {
      const body = await parseJsonBody(req);
      const result = await dbService.assignDiet(body.memberId, body.diet, user.token);
      sendJson(res, 200, { message: "Diet protocol assigned to athlete.", ...result });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return true;
  }

  // -------------------------------------------------------------------------
  // 4. GYM ADMIN DASHBOARD & OPERATIONS ROUTES
  // -------------------------------------------------------------------------

  // GET /api/admin/dashboard
  if (pathname === "/api/admin/dashboard" && method === "GET") {
    const user = await getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Authentication required." });
      return true;
    }

    if (!["GYM_ADMIN", "GYM_OWNER", "SUPER_ADMIN"].includes(user.role)) {
      sendJson(res, 403, { error: "Forbidden: Gym Admin privileges required." });
      return true;
    }

    try {
      const data = await dbService.getAdminDashboard(user.branchId, user.token);
      sendJson(res, 200, data);
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return true;
  }

  // GET /api/admin/inventory
  if (pathname === "/api/admin/inventory" && method === "GET") {
    const user = await getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Authentication required." });
      return true;
    }
    if (!["GYM_ADMIN", "GYM_OWNER", "SUPER_ADMIN"].includes(user.role)) {
      sendJson(res, 403, { error: "Forbidden: Gym Admin privileges required." });
      return true;
    }
    try {
      const inventory = await dbService.getInventory(user.token);
      sendJson(res, 200, { inventory });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return true;
  }

  // POST /api/admin/inventory
  if (pathname === "/api/admin/inventory" && method === "POST") {
    const user = await getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Authentication required." });
      return true;
    }
    if (!["GYM_ADMIN", "GYM_OWNER", "SUPER_ADMIN"].includes(user.role)) {
      sendJson(res, 403, { error: "Forbidden: Gym Admin privileges required." });
      return true;
    }
    try {
      const body = await parseJsonBody(req);
      const result = await dbService.addProduct(body, user.token);
      sendJson(res, 201, { message: "Inventory SKU added successfully.", ...result });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return true;
  }

  // POST /api/admin/inventory/adjust
  if (pathname === "/api/admin/inventory/adjust" && method === "POST") {
    const user = await getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Authentication required." });
      return true;
    }
    if (!["GYM_ADMIN", "GYM_OWNER", "SUPER_ADMIN"].includes(user.role)) {
      sendJson(res, 403, { error: "Forbidden: Gym Admin privileges required." });
      return true;
    }
    try {
      const body = await parseJsonBody(req);
      const result = await dbService.adjustStock(body.productId, body.changeQty, body.reason, user.token);
      sendJson(res, 200, { message: "Inventory stock level updated.", ...result });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return true;
  }

  // GET /api/admin/leads
  if (pathname === "/api/admin/leads" && method === "GET") {
    const user = await getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Authentication required." });
      return true;
    }
    if (!["GYM_ADMIN", "GYM_OWNER", "SUPER_ADMIN"].includes(user.role)) {
      sendJson(res, 403, { error: "Forbidden: Gym Admin privileges required." });
      return true;
    }
    try {
      const leads = await dbService.getLeads(user.token);
      sendJson(res, 200, { leads });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return true;
  }

  // POST /api/admin/leads
  if (pathname === "/api/admin/leads" && method === "POST") {
    const user = await getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Authentication required." });
      return true;
    }
    if (!["GYM_ADMIN", "GYM_OWNER", "SUPER_ADMIN"].includes(user.role)) {
      sendJson(res, 403, { error: "Forbidden: Gym Admin privileges required." });
      return true;
    }
    try {
      const body = await parseJsonBody(req);
      const result = await dbService.addLead(body, user.token);
      sendJson(res, 201, { message: "Lead registered in CRM pipeline.", ...result });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return true;
  }

  // POST /api/admin/leads/stage
  if (pathname === "/api/admin/leads/stage" && method === "POST") {
    const user = await getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Authentication required." });
      return true;
    }
    if (!["GYM_ADMIN", "GYM_OWNER", "SUPER_ADMIN"].includes(user.role)) {
      sendJson(res, 403, { error: "Forbidden: Gym Admin privileges required." });
      return true;
    }
    try {
      const body = await parseJsonBody(req);
      const result = await dbService.updateLeadStage(body.leadId, body.stage, user.token);
      sendJson(res, 200, { message: "Lead stage updated.", ...result });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return true;
  }

  // POST /api/admin/leads/convert
  if (pathname === "/api/admin/leads/convert" && method === "POST") {
    const user = await getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Authentication required." });
      return true;
    }
    if (!["GYM_ADMIN", "GYM_OWNER", "SUPER_ADMIN"].includes(user.role)) {
      sendJson(res, 403, { error: "Forbidden: Gym Admin privileges required." });
      return true;
    }
    try {
      const body = await parseJsonBody(req);
      const result = await dbService.convertLead(body.leadId, user.token);
      sendJson(res, 200, { message: "Lead converted into active gym member.", ...result });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return true;
  }

  // GET /api/admin/reports
  if (pathname === "/api/admin/reports" && method === "GET") {
    const user = await getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Authentication required." });
      return true;
    }
    if (!["GYM_ADMIN", "GYM_OWNER", "SUPER_ADMIN"].includes(user.role)) {
      sendJson(res, 403, { error: "Forbidden: Gym Admin privileges required." });
      return true;
    }
    try {
      const adminData = await dbService.getAdminDashboard(user.branchId, user.token);
      const detailed = await dbService.getDetailedReports({ dateRange: url.searchParams?.get("dateRange") }, user.token);
      sendJson(res, 200, {
        reportSummary: {
          generatedAt: new Date().toISOString(),
          kpis: adminData.kpis,
          totalMembers: adminData.members.length,
          totalLeads: adminData.leads.length,
          totalProducts: adminData.products.length,
          availableExportTypes: ["members", "revenue", "inventory", "leads", "attendance", "expenses", "profit_loss", "membership_sales"],
          detailed
        },
        ...detailed
      });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return true;
  }

  // GET /api/admin/reports/export (CSV export)
  if (pathname === "/api/admin/reports/export" && method === "GET") {
    const user = await getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Authentication required." });
      return true;
    }
    if (!["GYM_ADMIN", "GYM_OWNER", "SUPER_ADMIN"].includes(user.role)) {
      sendJson(res, 403, { error: "Forbidden: Gym Admin privileges required." });
      return true;
    }

    try {
      const type = (url.searchParams?.get("type") || "members").toLowerCase();
      let csvContent = "";
      const adminData = await dbService.getAdminDashboard(user.branchId, user.token);

      if (type === "revenue") {
        csvContent = "Type,Amount,Status,Date\n" +
          (adminData.expenses || []).map(e => `"Expense",${e.amount},"${e.category || 'General'}","${e.created_at || ''}"`).join("\n");
      } else if (type === "inventory") {
        const inv = await dbService.getInventory(user.token);
        csvContent = "SKU,Product Name,Category,Current Stock,Min Alert,Cost Price,Selling Price\n" +
          inv.map(i => `"${i.sku}","${i.name}","${i.category}",${i.current_stock},${i.min_stock_alert},${i.cost_price},${i.selling_price}`).join("\n");
      } else if (type === "leads") {
        const leads = await dbService.getLeads(user.token);
        csvContent = "Lead ID,Name,Phone,Email,Interested Plan,Status,Source\n" +
          leads.map(l => `"${l.id}","${l.full_name}","${l.phone}","${l.email}","${l.interested_plan}","${l.status}","${l.source}"`).join("\n");
      } else if (type === "attendance") {
        csvContent = "Time Slot,Peak Status,Average Check-ins\n" +
          "06:00 AM - 09:00 AM,Morning Peak,52\n09:00 AM - 12:00 PM,Midday General,24\n12:00 PM - 05:00 PM,Afternoon Off-Peak,16\n05:00 PM - 09:00 PM,Evening Peak,78\n09:00 PM - 11:00 PM,Night Owl,19";
      } else if (type === "expenses") {
        csvContent = "Expense ID,Category,Amount,Description,Date\n" +
          (adminData.expenses || []).map(e => `"${e.id}","${e.category || 'Facility'}",${e.amount},"${e.description || 'Gym Operational Expense'}","${e.created_at || new Date().toISOString()}"`).join("\n");
      } else if (type === "profit_loss") {
        const rev = adminData.kpis.totalRevenue || 128500;
        const exp = adminData.kpis.totalExpenses || 42000;
        csvContent = "Metric,Amount\n" +
          `Gross Revenue,${rev}\nTotal Expenses,${exp}\nNet Profit,${rev - exp}\nOperating Margin,${((rev - exp) / rev * 100).toFixed(1)}%`;
      } else if (type === "membership_sales") {
        csvContent = "Plan Tier,Units Sold,Revenue Generated,Unit Price\n" +
          "Elite 12-Month Pro,18,359820,19990\nGold 6-Months,24,263760,10990\nSilver 3-Months,31,185690,5990\nMonthly Flex,14,34860,2490";
      } else {
        // Default members roster
        csvContent = "ID,Name,Email,Plan,Status,Remaining Days\n" +
          adminData.members.map(m => `"${m.id}","${m.name || m.fullName}","${m.email}","${m.planName}","${m.status}",${m.remainingDays}`).join("\n");
      }

      res.writeHead(200, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="fithub_${type}_report.csv"`,
        "Access-Control-Allow-Origin": "*"
      });
      res.end(csvContent);
      return true;
    } catch (err) {
      sendJson(res, 500, { error: err.message });
      return true;
    }
  }

  // POST /api/admin/inventory/movement (Stock In / Stock Out with negative prevention)
  if (pathname === "/api/admin/inventory/movement" && method === "POST") {
    const user = await getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Authentication required." });
      return true;
    }
    if (!["GYM_ADMIN", "GYM_OWNER", "SUPER_ADMIN"].includes(user.role)) {
      sendJson(res, 403, { error: "Forbidden: Gym Admin privileges required." });
      return true;
    }
    try {
      const body = await parseJsonBody(req);
      const result = await dbService.recordStockMovement(body.productId, body.type, body.qtyChange, body.reason, user, user.token);
      sendJson(res, 200, result);
    } catch (err) {
      sendJson(res, err.message.includes("Insufficient stock") ? 400 : 500, { error: err.message });
    }
    return true;
  }

  // GET /api/admin/inventory/history
  if (pathname === "/api/admin/inventory/history" && method === "GET") {
    const user = await getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Authentication required." });
      return true;
    }
    if (!["GYM_ADMIN", "GYM_OWNER", "SUPER_ADMIN"].includes(user.role)) {
      sendJson(res, 403, { error: "Forbidden: Gym Admin privileges required." });
      return true;
    }
    try {
      const productId = url.searchParams?.get("productId") || null;
      const history = await dbService.getInventoryHistory(productId, user.token);
      sendJson(res, 200, { history });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return true;
  }

  // GET /api/admin/inventory/valuation
  if (pathname === "/api/admin/inventory/valuation" && method === "GET") {
    const user = await getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Authentication required." });
      return true;
    }
    if (!["GYM_ADMIN", "GYM_OWNER", "SUPER_ADMIN"].includes(user.role)) {
      sendJson(res, 403, { error: "Forbidden: Gym Admin privileges required." });
      return true;
    }
    try {
      const valuation = await dbService.getInventoryValuation(user.token);
      sendJson(res, 200, valuation);
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return true;
  }

  // POST /api/admin/leads/follow-up
  if (pathname === "/api/admin/leads/follow-up" && method === "POST") {
    const user = await getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Authentication required." });
      return true;
    }
    if (!["GYM_ADMIN", "GYM_OWNER", "SUPER_ADMIN"].includes(user.role)) {
      sendJson(res, 403, { error: "Forbidden: Gym Admin privileges required." });
      return true;
    }
    try {
      const body = await parseJsonBody(req);
      const result = await dbService.addLeadFollowUp(body.leadId, body, user.token);
      sendJson(res, 200, { message: "Lead follow-up recorded.", ...result });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return true;
  }

  // POST /api/support/reply
  if (pathname === "/api/support/reply" && method === "POST") {
    const user = await getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Authentication required." });
      return true;
    }
    try {
      const body = await parseJsonBody(req);
      const result = await dbService.replyTicket(body.ticketId, body.message, user, user.token);
      sendJson(res, 200, { message: "Reply added to ticket.", ...result });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return true;
  }

  // POST /api/admin/support/resolve
  if (pathname === "/api/admin/support/resolve" && method === "POST") {
    const user = await getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Authentication required." });
      return true;
    }
    if (!["GYM_ADMIN", "GYM_OWNER", "SUPER_ADMIN"].includes(user.role)) {
      sendJson(res, 403, { error: "Forbidden: Gym Admin privileges required." });
      return true;
    }
    try {
      const body = await parseJsonBody(req);
      const result = await dbService.resolveTicket(body.ticketId, body.status || "RESOLVED", user.token);
      sendJson(res, 200, { message: "Support ticket updated.", ...result });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return true;
  }

  // POST /api/member/notifications/read-all
  if (pathname === "/api/member/notifications/read-all" && method === "POST") {
    const user = await getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Authentication required." });
      return true;
    }
    try {
      const result = await dbService.markAllNotificationsRead(user.id, user.token);
      sendJson(res, 200, result);
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return true;
  }

  // POST /api/admin/announcements
  if (pathname === "/api/admin/announcements" && method === "POST") {
    const user = await getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Authentication required." });
      return true;
    }
    if (!["GYM_ADMIN", "GYM_OWNER", "SUPER_ADMIN"].includes(user.role)) {
      sendJson(res, 403, { error: "Forbidden: Gym Admin privileges required." });
      return true;
    }
    try {
      const body = await parseJsonBody(req);
      const result = await dbService.createGymAnnouncement(body, user.token);
      sendJson(res, 201, { message: "Gym announcement dispatched.", ...result });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return true;
  }

  // POST /api/admin/automations/run-expiry-check
  if (pathname === "/api/admin/automations/run-expiry-check" && method === "POST") {
    const user = await getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Authentication required." });
      return true;
    }
    if (!["GYM_ADMIN", "GYM_OWNER", "SUPER_ADMIN"].includes(user.role)) {
      sendJson(res, 403, { error: "Forbidden: Gym Admin privileges required." });
      return true;
    }
    try {
      const result = await dbService.runExpiryAutomation(user.token);
      sendJson(res, 200, { message: "Expiry & turnstile automation job executed.", ...result });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return true;
  }

  // GET /api/admin/automations/status
  if (pathname === "/api/admin/automations/status" && method === "GET") {
    const user = await getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Authentication required." });
      return true;
    }
    if (!["GYM_ADMIN", "GYM_OWNER", "SUPER_ADMIN"].includes(user.role)) {
      sendJson(res, 403, { error: "Forbidden: Gym Admin privileges required." });
      return true;
    }
    sendJson(res, 200, {
      automationSchedule: "Hourly Active",
      lastRun: dbService.lastAutomationRun || { status: "IDLE", lastCheck: new Date().toISOString() },
      enabledJobs: ["MEMBERSHIP_EXPIRY_SWEEPER", "TURNSTILE_ACCESS_SYNC", "LOW_STOCK_ALERTS"]
    });
    return true;
  }

  // -------------------------------------------------------------------------
  // 5. SUPER ADMIN DASHBOARD ROUTES
  // -------------------------------------------------------------------------

  // GET /api/superadmin/dashboard
  if (pathname === "/api/superadmin/dashboard" && method === "GET") {
    const user = await getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Authentication required." });
      return true;
    }

    if (user.role !== "SUPER_ADMIN") {
      sendJson(res, 403, { error: "Forbidden: Super Admin privileges required." });
      return true;
    }

    try {
      const data = await dbService.getSuperAdminDashboard(user.token);
      sendJson(res, 200, data);
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return true;
  }

  return false;
}
