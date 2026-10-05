// FIT HUB Server API Routes & Business Logic
import { db, hashPassword, verifyPassword, generateToken, verifyToken } from "./db.js";

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

// Helper: extract authenticated user from Bearer header
export function getAuthUser(req) {
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload || !payload.id) return null;
  const user = db.data.profiles.find(p => p.id === payload.id && p.is_active !== false);
  return user || null;
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
  // 1. AUTHENTICATION ROUTES
  // -------------------------------------------------------------------------
  
  // POST /api/auth/register
  if (pathname === "/api/auth/register" && method === "POST") {
    const body = await parseJsonBody(req);
    const { email, password, fullName, phone, role = "MEMBER", branchId } = body;

    if (!email || !password || !fullName) {
      sendJson(res, 400, { error: "Email, password, and full name are required." });
      return true;
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = db.data.profiles.find(p => p.email.toLowerCase() === cleanEmail);
    if (existing) {
      sendJson(res, 400, { error: "An account with this email already exists." });
      return true;
    }

    // Default to Downtown Central branch if none provided
    const targetBranchId = branchId || db.data.branches[0].id;
    const targetGymId = db.data.branches[0].gym_id;

    // Normal signups are always assigned the MEMBER role for safety
    const assignedRole = role === "MEMBER" ? "MEMBER" : "MEMBER";

    const newProfile = {
      id: crypto.randomUUID(),
      email: cleanEmail,
      password_hash: hashPassword(password),
      role: assignedRole,
      full_name: fullName.trim(),
      phone: phone || "",
      gym_id: targetGymId,
      branch_id: targetBranchId,
      is_active: true,
      created_at: new Date().toISOString()
    };

    // Store new profile in DB
    db.data.profiles.push(newProfile);

    // IMPORTANT: A brand new member starts with 100% clean data (0 plans, 0 attendance, empty arrays)
    // No mock plans or fake metrics are added here!

    // Generate unique QR code token for member
    db.data.qr_codes.push({
      id: crypto.randomUUID(),
      member_id: newProfile.id,
      token: `FITHUB-QR-${newProfile.id.substring(0, 8).toUpperCase()}`,
      is_revoked: false
    });

    db.save();

    db.logAudit(newProfile, "MEMBER_REGISTERED", "PROFILE", newProfile.id, { email: cleanEmail });

    const token = generateToken({ id: newProfile.id, email: newProfile.email, role: newProfile.role });
    sendJson(res, 201, {
      message: "Registration successful. Clean new account initialized.",
      token,
      user: {
        id: newProfile.id,
        email: newProfile.email,
        fullName: newProfile.full_name,
        role: newProfile.role,
        branchId: newProfile.branch_id
      }
    });
    return true;
  }

  // POST /api/auth/login
  if (pathname === "/api/auth/login" && method === "POST") {
    const body = await parseJsonBody(req);
    const { email, password, expectedRole } = body;

    if (!email || !password) {
      sendJson(res, 400, { error: "Email and password are required." });
      return true;
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = db.data.profiles.find(p => p.email.toLowerCase() === cleanEmail);

    if (!user || !verifyPassword(password, user.password_hash)) {
      sendJson(res, 401, { error: "Invalid email or password." });
      return true;
    }

    // Role verification: check if user matches expected portal role
    if (expectedRole && user.role !== expectedRole) {
      if (expectedRole === "SUPER_ADMIN" && user.role !== "SUPER_ADMIN") {
        sendJson(res, 403, { error: "Access denied: Super Admin credentials required." });
        return true;
      }
      if (expectedRole === "GYM_ADMIN" && !["GYM_ADMIN", "GYM_OWNER", "SUPER_ADMIN"].includes(user.role)) {
        sendJson(res, 403, { error: "Access denied: Gym Admin privileges required." });
        return true;
      }
    }

    const token = generateToken({ id: user.id, email: user.email, role: user.role });
    db.logAudit(user, "USER_LOGIN", "SESSION", user.id, { ip: req.socket.remoteAddress });

    sendJson(res, 200, {
      message: "Login successful.",
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        branchId: user.branch_id,
        gymId: user.gym_id
      }
    });
    return true;
  }

  // GET /api/auth/me
  if (pathname === "/api/auth/me" && method === "GET") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Unauthorized or session expired." });
      return true;
    }
    const branch = db.data.branches.find(b => b.id === user.branch_id);
    sendJson(res, 200, {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        phone: user.phone,
        branchId: user.branch_id,
        branchName: branch ? branch.name : "FitHub Downtown Central"
      }
    });
    return true;
  }

  // -------------------------------------------------------------------------
  // 2. MEMBER APPLICATION ROUTES
  // -------------------------------------------------------------------------

  // GET /api/member/dashboard
  if (pathname === "/api/member/dashboard" && method === "GET") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Unauthorized access." });
      return true;
    }

    const memberId = user.id;

    // Load active membership for this user (if any)
    const membership = db.data.memberships.find(m => m.member_id === memberId && m.status === "ACTIVE");
    let remainingDays = 0;
    if (membership && membership.expiry_date) {
      const exp = new Date(membership.expiry_date);
      const now = new Date();
      remainingDays = Math.max(0, Math.ceil((exp - now) / 86400000));
    }

    // Attendance stats
    const todayStr = new Date().toISOString().split("T")[0];
    const userAttendance = db.data.attendance.filter(a => a.member_id === memberId);
    const todayCheckin = userAttendance.find(a => a.date === todayStr);

    // Calculate streak
    let streak = 0;
    const sortedAttendance = [...userAttendance].sort((a, b) => new Date(b.date) - new Date(a.date));
    if (sortedAttendance.length > 0) {
      streak = sortedAttendance.length;
    }

    // Workout and Diet assignments
    const workout = db.data.workout_assignments.find(w => w.member_id === memberId && w.status === "ACTIVE") || null;
    const diet = db.data.diet_assignments.find(d => d.member_id === memberId && d.status === "ACTIVE") || null;

    // Progress and Goals
    const progressList = db.data.progress_records.filter(p => p.member_id === memberId);
    const goalsList = db.data.goals.filter(g => g.member_id === memberId);

    // Bookings and Invoices
    const bookingsList = db.data.class_bookings.filter(b => b.member_id === memberId && b.booking_status === "BOOKED");
    const invoicesList = db.data.invoices.filter(i => i.member_id === memberId);
    const paymentsList = db.data.payments.filter(p => p.member_id === memberId);

    // Notifications
    const notificationsList = db.data.notifications.filter(n => n.recipient_id === memberId);

    // QR Pass
    const qr = db.data.qr_codes.find(q => q.member_id === memberId);

    sendJson(res, 200, {
      profile: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        branchId: user.branch_id
      },
      membership: membership ? {
        id: membership.id,
        planName: membership.plan_name,
        status: membership.status,
        startDate: membership.start_date,
        expiryDate: membership.expiry_date,
        remainingDays,
        balanceDue: membership.balance_due || 0
      } : {
        planName: "No active membership",
        status: "No active membership",
        remainingDays: 0,
        balanceDue: 0
      },
      attendance: {
        totalCheckIns: userAttendance.length,
        todayAttendance: todayCheckin ? 1 : 0,
        streak,
        monthlyAttendancePercent: Math.min(100, Math.round((userAttendance.length / 26) * 100)),
        records: userAttendance
      },
      workout,
      diet,
      progressList,
      goalsList,
      bookingsList,
      invoicesList,
      paymentsList,
      notificationsList,
      qrPass: {
        token: qr ? qr.token : `FITHUB-QR-${user.id.substring(0, 8).toUpperCase()}`,
        isLocked: remainingDays <= 0
      }
    });
    return true;
  }

  // POST /api/member/assign-plan
  if (pathname === "/api/member/assign-plan" && method === "POST") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Unauthorized access." });
      return true;
    }

    const body = await parseJsonBody(req);
    const { planId } = body;
    const plan = db.data.membership_plans.find(p => p.id === planId) || db.data.membership_plans[0];

    const startDate = new Date();
    const expiryDate = new Date(startDate.getTime() + plan.duration_months * 30 * 86400000);
    const durationDays = plan.duration_months * 30;

    // Deactivate previous active memberships
    db.data.memberships.forEach(m => {
      if (m.member_id === user.id && m.status === "ACTIVE") {
        m.status = "EXPIRED";
      }
    });

    const newMembership = {
      id: crypto.randomUUID(),
      member_id: user.id,
      plan_id: plan.id,
      plan_name: plan.name,
      gym_id: user.gym_id || db.data.gyms[0].id,
      branch_id: user.branch_id || db.data.branches[0].id,
      status: "ACTIVE",
      start_date: startDate.toISOString().split("T")[0],
      expiry_date: expiryDate.toISOString().split("T")[0],
      remaining_days: durationDays,
      balance_due: 0.0,
      created_at: new Date().toISOString()
    };
    db.data.memberships.push(newMembership);

    // Generate Invoice with 18% GST
    const basePrice = plan.price;
    const taxAmount = Number((basePrice * 0.18).toFixed(2));
    const totalAmount = Number((basePrice + taxAmount).toFixed(2));
    const invoiceNumber = `INV-${Math.floor(100000 + Math.random() * 900000)}`;

    const newInvoice = {
      id: crypto.randomUUID(),
      invoice_number: invoiceNumber,
      gym_id: newMembership.gym_id,
      branch_id: newMembership.branch_id,
      member_id: user.id,
      membership_id: newMembership.id,
      item_title: plan.name,
      base_amount: basePrice,
      discount_amount: 0.0,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      due_date: startDate.toISOString().split("T")[0],
      status: "PAID",
      created_at: new Date().toISOString()
    };
    db.data.invoices.push(newInvoice);

    // Record Payment (Demo/Test Payment Mode: updates ledger, never moves real money)
    const newPayment = {
      id: crypto.randomUUID(),
      invoice_id: newInvoice.id,
      member_id: user.id,
      gym_id: newMembership.gym_id,
      branch_id: newMembership.branch_id,
      amount: totalAmount,
      payment_method: body.paymentMethod || "UPI",
      transaction_ref: `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      status: "PAID",
      payment_date: new Date().toISOString()
    };
    db.data.payments.push(newPayment);

    // Dispatch In-App Notification
    db.data.notifications.push({
      id: crypto.randomUUID(),
      recipient_id: user.id,
      gym_id: newMembership.gym_id,
      branch_id: newMembership.branch_id,
      type: "PAYMENT_SUCCESS",
      title: "Membership Activated! ⚡",
      message: `Your ${plan.name} has been activated. Digital gate pass and facility access are now unlocked for ${durationDays} days.`,
      is_read: false,
      created_at: new Date().toISOString()
    });

    db.save();
    db.logAudit(user, "MEMBERSHIP_ASSIGNED", "MEMBERSHIP", newMembership.id, { plan: plan.name, amount: totalAmount });

    sendJson(res, 201, {
      message: "Membership assigned and activated successfully.",
      membership: newMembership,
      invoice: newInvoice,
      payment: newPayment
    });
    return true;
  }

  // POST /api/member/attendance-checkin
  if (pathname === "/api/member/attendance-checkin" && method === "POST") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Unauthorized access." });
      return true;
    }

    const membership = db.data.memberships.find(m => m.member_id === user.id && m.status === "ACTIVE");
    if (!membership) {
      sendJson(res, 403, { error: "Turnstile access locked: You do not have an active membership plan." });
      return true;
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const todayCheckin = db.data.attendance.find(a => a.member_id === user.id && a.date === todayStr);

    if (todayCheckin) {
      sendJson(res, 400, { error: "Already checked in today. Duplicate check-ins prevented." });
      return true;
    }

    const newAttendance = {
      id: crypto.randomUUID(),
      member_id: user.id,
      gym_id: user.gym_id || db.data.gyms[0].id,
      branch_id: user.branch_id || db.data.branches[0].id,
      date: todayStr,
      check_in_time: new Date().toISOString(),
      check_out_time: null,
      method: "QR_SCAN",
      status: "PRESENT",
      created_at: new Date().toISOString()
    };
    db.data.attendance.push(newAttendance);
    db.save();

    db.logAudit(user, "ATTENDANCE_CHECKIN", "ATTENDANCE", newAttendance.id, { method: "QR_SCAN" });

    sendJson(res, 201, {
      message: "Check-in verified. Turnstile gate opened.",
      attendance: newAttendance
    });
    return true;
  }

  // POST /api/member/workout-assign
  if (pathname === "/api/member/workout-assign" && method === "POST") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Unauthorized access." });
      return true;
    }

    const template = db.data.workout_plans[0];
    const assignment = {
      id: crypto.randomUUID(),
      member_id: user.id,
      workout_plan_id: template.id,
      title: template.title,
      status: "ACTIVE",
      trainer_name: "Coach Kabir Sen",
      exercises: template.exercises.map(e => ({ ...e, completed: false }))
    };

    // Remove existing
    db.data.workout_assignments = db.data.workout_assignments.filter(w => w.member_id !== user.id);
    db.data.workout_assignments.push(assignment);
    db.save();

    db.logAudit(user, "WORKOUT_ASSIGNED", "WORKOUT", assignment.id, { title: assignment.title });
    sendJson(res, 201, { message: "Workout routine assigned successfully.", workout: assignment });
    return true;
  }

  // POST /api/member/workout-toggle
  if (pathname === "/api/member/workout-toggle" && method === "POST") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Unauthorized access." });
      return true;
    }

    const body = await parseJsonBody(req);
    const { exerciseIndex } = body;
    const assignment = db.data.workout_assignments.find(w => w.member_id === user.id && w.status === "ACTIVE");

    if (assignment && assignment.exercises[exerciseIndex] !== undefined) {
      assignment.exercises[exerciseIndex].completed = !assignment.exercises[exerciseIndex].completed;
      db.save();
      sendJson(res, 200, { message: "Exercise status updated.", exercises: assignment.exercises });
      return true;
    }

    sendJson(res, 400, { error: "Exercise not found." });
    return true;
  }

  // POST /api/member/diet-assign
  if (pathname === "/api/member/diet-assign" && method === "POST") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Unauthorized access." });
      return true;
    }

    const template = db.data.diet_plans[0];
    const assignment = {
      id: crypto.randomUUID(),
      member_id: user.id,
      diet_plan_id: template.id,
      title: template.title,
      target_calories: template.target_calories,
      target_protein_g: template.target_protein_g,
      target_carbs_g: template.target_carbs_g,
      target_fat_g: template.target_fat_g,
      water_target_ml: template.water_target_ml,
      water_consumed_ml: 1250,
      status: "ACTIVE"
    };

    db.data.diet_assignments = db.data.diet_assignments.filter(d => d.member_id !== user.id);
    db.data.diet_assignments.push(assignment);
    db.save();

    db.logAudit(user, "DIET_ASSIGNED", "DIET", assignment.id, { title: assignment.title });
    sendJson(res, 201, { message: "Diet protocol assigned successfully.", diet: assignment });
    return true;
  }

  // POST /api/member/diet-water
  if (pathname === "/api/member/diet-water" && method === "POST") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Unauthorized access." });
      return true;
    }

    const body = await parseJsonBody(req);
    const amountMl = Number(body.amountMl || 250);
    const assignment = db.data.diet_assignments.find(d => d.member_id === user.id && d.status === "ACTIVE");

    if (assignment) {
      assignment.water_consumed_ml = (assignment.water_consumed_ml || 0) + amountMl;
      db.save();
      sendJson(res, 200, { message: "Water logged.", consumed: assignment.water_consumed_ml });
      return true;
    }

    sendJson(res, 400, { error: "No active diet plan found." });
    return true;
  }

  // POST /api/member/progress
  if (pathname === "/api/member/progress" && method === "POST") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Unauthorized access." });
      return true;
    }

    const body = await parseJsonBody(req);
    const weight = Number(body.weightKg);
    const height = Number(body.heightCm || 175);

    if (!weight || weight <= 0) {
      sendJson(res, 400, { error: "Valid weight in kg is required." });
      return true;
    }

    const bmi = Number((weight / Math.pow(height / 100, 2)).toFixed(1));
    const newRecord = {
      id: crypto.randomUUID(),
      member_id: user.id,
      date: new Date().toISOString().split("T")[0],
      weight_kg: weight,
      height_cm: height,
      bmi,
      body_fat_percent: body.bodyFatPercent ? Number(body.bodyFatPercent) : null,
      chest_cm: body.chestCm ? Number(body.chestCm) : null,
      arms_cm: body.armsCm ? Number(body.armsCm) : null,
      waist_cm: body.waistCm ? Number(body.waistCm) : null,
      notes: body.notes || "Member logged weigh-in."
    };

    db.data.progress_records.push(newRecord);
    db.save();

    db.logAudit(user, "PROGRESS_LOGGED", "PROGRESS", newRecord.id, { weight, bmi });
    sendJson(res, 201, { message: "Body progress recorded.", record: newRecord });
    return true;
  }

  // POST /api/member/goals
  if (pathname === "/api/member/goals" && method === "POST") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Unauthorized access." });
      return true;
    }

    const body = await parseJsonBody(req);
    if (!body.title) {
      sendJson(res, 400, { error: "Goal title is required." });
      return true;
    }

    const newGoal = {
      id: crypto.randomUUID(),
      member_id: user.id,
      title: body.title.trim(),
      target_date: body.targetDate || "60 days",
      goal_type: body.goalType || "FITNESS",
      status: "IN_PROGRESS",
      created_at: new Date().toISOString()
    };

    db.data.goals.push(newGoal);
    db.save();

    db.logAudit(user, "GOAL_CREATED", "GOAL", newGoal.id, { title: newGoal.title });
    sendJson(res, 201, { message: "Goal milestone created.", goal: newGoal });
    return true;
  }

  // POST /api/member/book-class
  if (pathname === "/api/member/book-class" && method === "POST") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Unauthorized access." });
      return true;
    }

    const body = await parseJsonBody(req);
    const classId = body.classId;
    const targetClass = db.data.classes.find(c => c.id === classId);

    if (!targetClass) {
      sendJson(res, 404, { error: "Class not found." });
      return true;
    }

    // Check double-booking
    const existingBooking = db.data.class_bookings.find(b => b.member_id === user.id && b.session_id === classId && b.booking_status === "BOOKED");
    if (existingBooking) {
      // Cancel booking
      existingBooking.booking_status = "CANCELLED";
      targetClass.booked_count = Math.max(0, targetClass.booked_count - 1);
      db.save();
      sendJson(res, 200, { message: "Booking cancelled.", isBooked: false });
      return true;
    }

    // Capacity check
    if (targetClass.booked_count >= targetClass.capacity) {
      sendJson(res, 400, { error: "Class is fully booked." });
      return true;
    }

    const newBooking = {
      id: crypto.randomUUID(),
      session_id: classId,
      class_title: targetClass.title,
      member_id: user.id,
      booking_status: "BOOKED",
      booking_time: new Date().toISOString()
    };

    db.data.class_bookings.push(newBooking);
    targetClass.booked_count += 1;
    db.save();

    db.logAudit(user, "CLASS_BOOKED", "CLASS", classId, { title: targetClass.title });
    sendJson(res, 201, { message: "Slot reserved successfully.", isBooked: true, booking: newBooking });
    return true;
  }

  // POST /api/member/support-ticket
  if (pathname === "/api/member/support-ticket" && method === "POST") {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Unauthorized access." });
      return true;
    }

    const body = await parseJsonBody(req);
    if (!body.subject || !body.description) {
      sendJson(res, 400, { error: "Subject and description are required." });
      return true;
    }

    const ticketNumber = `TCK-${Math.floor(100 + Math.random() * 900)}`;
    const newTicket = {
      id: crypto.randomUUID(),
      member_id: user.id,
      gym_id: user.gym_id || db.data.gyms[0].id,
      branch_id: user.branch_id || db.data.branches[0].id,
      ticket_number: ticketNumber,
      category: body.category || "GENERAL",
      priority: body.priority || "MEDIUM",
      subject: body.subject.trim(),
      description: body.description.trim(),
      status: "OPEN",
      resolution_notes: null,
      created_at: new Date().toISOString()
    };

    db.data.support_tickets.push(newTicket);
    db.save();

    db.logAudit(user, "TICKET_CREATED", "TICKET", newTicket.id, { ticketNumber });
    sendJson(res, 201, { message: "Support ticket submitted.", ticket: newTicket });
    return true;
  }

  // -------------------------------------------------------------------------
  // 3. GYM ADMIN APPLICATION ROUTES
  // -------------------------------------------------------------------------

  // GET /api/admin/dashboard
  if (pathname === "/api/admin/dashboard" && method === "GET") {
    const user = getAuthUser(req);
    if (!user || !["GYM_ADMIN", "GYM_OWNER", "SUPER_ADMIN"].includes(user.role)) {
      sendJson(res, 403, { error: "Access denied: Gym Admin privileges required." });
      return true;
    }

    const branchId = user.branch_id || db.data.branches[0].id;
    const branchMembers = db.data.profiles.filter(p => p.role === "MEMBER" && p.branch_id === branchId);
    const branchMemberships = db.data.memberships.filter(m => m.branch_id === branchId);

    const activeMembers = branchMemberships.filter(m => m.status === "ACTIVE").length;
    const expiredMembers = branchMemberships.filter(m => m.status === "EXPIRED").length;
    const totalMembers = branchMembers.length;

    // Financials
    const branchPayments = db.data.payments.filter(p => p.branch_id === branchId && p.status === "PAID");
    const totalRevenue = branchPayments.reduce((sum, p) => sum + Number(p.amount), 0);

    const branchExpenses = db.data.expenses.filter(e => e.branch_id === branchId);
    const totalExpenses = branchExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const netIncome = totalRevenue - totalExpenses;

    // Today's attendance
    const todayStr = new Date().toISOString().split("T")[0];
    const todayCheckIns = db.data.attendance.filter(a => a.branch_id === branchId && a.date === todayStr).length;

    sendJson(res, 200, {
      metrics: {
        totalMembers,
        activeMembers,
        expiredMembers,
        newMembers: Math.min(totalMembers, 4),
        todayCheckIns,
        totalRevenue,
        totalExpenses,
        netIncome,
        pendingPayments: branchMemberships.reduce((sum, m) => sum + (m.balance_due || 0), 0)
      },
      members: branchMembers.map(m => {
        const msh = branchMemberships.find(ms => ms.member_id === m.id && ms.status === "ACTIVE");
        return {
          id: m.id,
          name: m.full_name,
          email: m.email,
          phone: m.phone,
          planName: msh ? msh.plan_name : "No active membership",
          status: msh ? "ACTIVE" : "INACTIVE",
          remainingDays: msh ? msh.remaining_days : 0
        };
      }),
      plans: db.data.membership_plans,
      trainers: db.data.trainers,
      classes: db.data.classes,
      expenses: branchExpenses,
      inventory: db.data.products.filter(p => p.branch_id === branchId),
      leads: db.data.leads.filter(l => l.branch_id === branchId),
      auditLogs: db.data.audit_logs.filter(l => l.branch_id === branchId).slice(0, 10)
    });
    return true;
  }

  // POST /api/admin/expenses
  if (pathname === "/api/admin/expenses" && method === "POST") {
    const user = getAuthUser(req);
    if (!user || !["GYM_ADMIN", "GYM_OWNER", "SUPER_ADMIN"].includes(user.role)) {
      sendJson(res, 403, { error: "Access denied." });
      return true;
    }

    const body = await parseJsonBody(req);
    const newExpense = {
      id: crypto.randomUUID(),
      gym_id: user.gym_id,
      branch_id: user.branch_id,
      category: body.category || "OTHER",
      title: body.title || "Facility Operational Expense",
      amount: Number(body.amount || 0),
      date: new Date().toISOString().split("T")[0],
      vendor: body.vendor || "Vendor",
      payment_method: body.paymentMethod || "CASH"
    };

    db.data.expenses.unshift(newExpense);
    db.save();

    db.logAudit(user, "EXPENSE_RECORDED", "EXPENSE", newExpense.id, { amount: newExpense.amount, title: newExpense.title });
    sendJson(res, 201, { message: "Expense recorded.", expense: newExpense });
    return true;
  }

  // POST /api/admin/inventory
  if (pathname === "/api/admin/inventory" && method === "POST") {
    const user = getAuthUser(req);
    if (!user || !["GYM_ADMIN", "GYM_OWNER", "SUPER_ADMIN"].includes(user.role)) {
      sendJson(res, 403, { error: "Access denied." });
      return true;
    }

    const body = await parseJsonBody(req);
    const newProduct = {
      id: crypto.randomUUID(),
      gym_id: user.gym_id,
      branch_id: user.branch_id,
      sku: body.sku || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
      name: body.name || "Fitness Equipment / Supplement",
      category: body.category || "SUPPLEMENTS",
      cost_price: Number(body.costPrice || 0),
      selling_price: Number(body.sellingPrice || 0),
      current_stock: Number(body.currentStock || 10),
      minimum_stock_alert: 5,
      is_active: true
    };

    db.data.products.push(newProduct);
    db.save();

    db.logAudit(user, "INVENTORY_CREATED", "PRODUCT", newProduct.id, { name: newProduct.name });
    sendJson(res, 201, { message: "Inventory item added.", product: newProduct });
    return true;
  }

  // POST /api/admin/leads
  if (pathname === "/api/admin/leads" && method === "POST") {
    const user = getAuthUser(req);
    if (!user || !["GYM_ADMIN", "GYM_OWNER", "SUPER_ADMIN"].includes(user.role)) {
      sendJson(res, 403, { error: "Access denied." });
      return true;
    }

    const body = await parseJsonBody(req);
    const newLead = {
      id: crypto.randomUUID(),
      gym_id: user.gym_id,
      branch_id: user.branch_id,
      full_name: body.fullName || "Prospective Member",
      phone: body.phone || "+91 98000 00000",
      email: body.email || "",
      source: body.source || "WALK_IN",
      interested_plan: body.interestedPlan || "Gold 3-Months",
      status: body.status || "NEW",
      notes: body.notes || "Trial requested."
    };

    db.data.leads.push(newLead);
    db.save();

    db.logAudit(user, "LEAD_CREATED", "LEAD", newLead.id, { name: newLead.full_name });
    sendJson(res, 201, { message: "Lead added to pipeline.", lead: newLead });
    return true;
  }

  // -------------------------------------------------------------------------
  // 4. SUPER ADMIN APPLICATION ROUTES
  // -------------------------------------------------------------------------

  // GET /api/superadmin/dashboard
  if (pathname === "/api/superadmin/dashboard" && method === "GET") {
    const user = getAuthUser(req);
    if (!user || user.role !== "SUPER_ADMIN") {
      sendJson(res, 403, { error: "Access denied: Platform Super Admin role required." });
      return true;
    }

    const totalGyms = db.data.gyms.length;
    const totalBranches = db.data.branches.length;
    const totalMembers = db.data.profiles.filter(p => p.role === "MEMBER").length;
    const platformRevenue = db.data.payments.reduce((sum, p) => sum + Number(p.amount), 0);

    sendJson(res, 200, {
      metrics: {
        totalGyms,
        totalBranches,
        totalMembers,
        platformRevenue,
        activeGymsCount: totalGyms,
        systemAuditEntries: db.data.audit_logs.length
      },
      gyms: db.data.gyms,
      branches: db.data.branches,
      admins: db.data.profiles.filter(p => ["GYM_ADMIN", "GYM_OWNER"].includes(p.role)),
      recentAuditLogs: db.data.audit_logs.slice(0, 15)
    });
    return true;
  }

  // Route not found
  return false;
}
