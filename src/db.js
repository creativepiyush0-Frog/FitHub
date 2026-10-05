// FIT HUB Database & Supabase Integration Layer
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, "../data/fithub.db.json");

// ---------------------------------------------------------------------------
// 1. Supabase Client Setup (When credentials are provided)
// ---------------------------------------------------------------------------
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes("your-project-id"));

export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;

// ---------------------------------------------------------------------------
// 2. Cryptographic Helper Functions (Secure hashing & tokens)
// ---------------------------------------------------------------------------
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(":")) return false;
  const [salt, originalHash] = storedHash.split(":");
  const testHash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return testHash === originalHash;
}

export function generateToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + 7 * 86400; // 7 days expiration
  const data = Buffer.from(JSON.stringify({ ...payload, exp })).toString("base64url");
  const secret = process.env.JWT_SECRET || "fithub-platform-secure-jwt-secret-2026";
  const signature = crypto.createHmac("sha256", secret).update(`${header}.${data}`).digest("base64url");
  return `${header}.${data}.${signature}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, data, signature] = parts;
  const secret = process.env.JWT_SECRET || "fithub-platform-secure-jwt-secret-2026";
  const expectedSig = crypto.createHmac("sha256", secret).update(`${header}.${data}`).digest("base64url");
  if (signature !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    return payload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 3. Database Initial State (Production Schema Tables)
// ---------------------------------------------------------------------------
function getInitialDbState() {
  const defaultGymId = "gym-00000000-0000-0000-0000-000000000001";
  const branchCentralId = "br-00000000-0000-0000-0000-000000000001";
  const branchWestId = "br-00000000-0000-0000-0000-000000000002";
  const branchMetroId = "br-00000000-0000-0000-0000-000000000003";

  return {
    platform_settings: {
      id: crypto.randomUUID(),
      platform_name: "FIT HUB",
      currency: "INR",
      currency_symbol: "₹",
      default_tax_percent: 18.0,
      support_email: "support@fithub.com"
    },
    gyms: [
      {
        id: defaultGymId,
        name: "FIT HUB Elite Fitness",
        legal_name: "FitHub Global Fitness India Pvt Ltd",
        slug: "fithub-elite",
        email: "contact@fithub.com",
        phone: "+91 98200 11223",
        is_active: true,
        created_at: new Date().toISOString()
      }
    ],
    branches: [
      {
        id: branchCentralId,
        gym_id: defaultGymId,
        name: "FitHub Downtown Central",
        code: "BR-01",
        city: "Mumbai",
        address: "Plot 14, MG Road, Nariman Point",
        phone: "+91 98200 11223",
        capacity: 450,
        is_active: true,
        created_at: new Date().toISOString()
      },
      {
        id: branchWestId,
        gym_id: defaultGymId,
        name: "FitHub Westside Pro",
        code: "BR-02",
        city: "Pune",
        address: "Level 3, Amanora Town Centre",
        phone: "+91 98200 44556",
        capacity: 320,
        is_active: true,
        created_at: new Date().toISOString()
      },
      {
        id: branchMetroId,
        gym_id: defaultGymId,
        name: "FitHub Metro Flagship",
        code: "BR-03",
        city: "Bengaluru",
        address: "88, 100ft Road, Indiranagar",
        phone: "+91 98200 77889",
        capacity: 600,
        is_active: true,
        created_at: new Date().toISOString()
      }
    ],
    membership_plans: [
      {
        id: "plan-monthly-silver",
        gym_id: defaultGymId,
        name: "Silver 1-Month",
        code: "SLV-01",
        duration_months: 1,
        price: 2999.0,
        joining_fee: 500.0,
        tax_percent: 18.0,
        freeze_days_allowed: 0,
        pt_sessions_included: 0,
        allowed_facilities: ["Gym Floor", "Cardio Area"],
        multi_branch_access: false,
        description: "Standard month-to-month gym floor access.",
        is_active: true
      },
      {
        id: "plan-quarterly-gold",
        gym_id: defaultGymId,
        name: "Gold 3-Months",
        code: "GLD-03",
        duration_months: 3,
        price: 7499.0,
        joining_fee: 500.0,
        tax_percent: 18.0,
        freeze_days_allowed: 7,
        pt_sessions_included: 2,
        allowed_facilities: ["Gym Floor", "Cardio Area", "Yoga Studio", "Steam Room"],
        multi_branch_access: false,
        description: "Includes steam bath & 2 free personal training sessions.",
        is_active: true
      },
      {
        id: "plan-halfyearly-platinum",
        gym_id: defaultGymId,
        name: "Platinum 6-Months",
        code: "PLT-06",
        duration_months: 6,
        price: 12999.0,
        joining_fee: 0.0,
        tax_percent: 18.0,
        freeze_days_allowed: 15,
        pt_sessions_included: 6,
        allowed_facilities: ["Full Facility", "Zumba", "HIIT", "Steam"],
        multi_branch_access: false,
        description: "Zero joining fee + 15 days membership freeze.",
        is_active: true
      },
      {
        id: "plan-yearly-elite",
        gym_id: defaultGymId,
        name: "Elite 12-Month Pro + PT Pass",
        code: "ELT-12",
        duration_months: 12,
        price: 21999.0,
        joining_fee: 0.0,
        tax_percent: 18.0,
        freeze_days_allowed: 30,
        pt_sessions_included: 12,
        allowed_facilities: ["All Facilities", "CrossFit", "Zumba", "Yoga", "Sauna", "All Branches"],
        multi_branch_access: true,
        description: "Multi-branch passport + 12 PT sessions + 30 days freeze.",
        is_active: true
      }
    ],
    profiles: [
      {
        id: "usr-superadmin-01",
        email: "platform@fithub.com",
        password_hash: hashPassword("password123"),
        role: "SUPER_ADMIN",
        full_name: "FitHub Platform Director",
        phone: "+91 99999 00000",
        gym_id: defaultGymId,
        branch_id: branchCentralId,
        is_active: true,
        created_at: new Date().toISOString()
      },
      {
        id: "usr-gymadmin-01",
        email: "admin@downtown.fithub.com",
        password_hash: hashPassword("password123"),
        role: "GYM_ADMIN",
        full_name: "Vikram Malhotra",
        phone: "+91 98200 11223",
        gym_id: defaultGymId,
        branch_id: branchCentralId,
        is_active: true,
        created_at: new Date().toISOString()
      },
      {
        id: "usr-trainer-01",
        email: "kabir.sen@fithub.com",
        password_hash: hashPassword("password123"),
        role: "TRAINER",
        full_name: "Coach Kabir Sen",
        phone: "+91 98200 99001",
        gym_id: defaultGymId,
        branch_id: branchCentralId,
        is_active: true,
        created_at: new Date().toISOString()
      },
      // Dedicated Demo Member (Isolated strictly for development testing)
      {
        id: "usr-demomember-01",
        email: "demo.member@fithub.com",
        password_hash: hashPassword("password123"),
        role: "MEMBER",
        full_name: "Demo Member (Test Seed)",
        phone: "+91 98765 00000",
        gym_id: defaultGymId,
        branch_id: branchCentralId,
        is_active: true,
        created_at: new Date().toISOString()
      }
    ],
    trainers: [
      {
        id: "trn-01",
        profile_id: "usr-trainer-01",
        gym_id: defaultGymId,
        branch_id: branchCentralId,
        name: "Coach Kabir Sen",
        specialty: "Strength & Conditioning / Hypertrophy",
        experience_years: 8,
        rating: 4.9,
        monthly_salary: 45000.0,
        is_available: true
      },
      {
        id: "trn-02",
        profile_id: crypto.randomUUID(),
        gym_id: defaultGymId,
        branch_id: branchCentralId,
        name: "Pooja Hegde",
        specialty: "Yoga, Mobility & Flexibility",
        experience_years: 6,
        rating: 4.8,
        monthly_salary: 38000.0,
        is_available: true
      }
    ],
    // Dedicated demo member sample records (Will NOT be applied to normal members)
    memberships: [
      {
        id: "msh-demo-01",
        member_id: "usr-demomember-01",
        plan_id: "plan-yearly-elite",
        plan_name: "Elite 12-Month Pro + PT Pass",
        gym_id: defaultGymId,
        branch_id: branchCentralId,
        status: "ACTIVE",
        start_date: new Date().toISOString().split("T")[0],
        expiry_date: new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0],
        remaining_days: 90,
        balance_due: 0.0,
        created_at: new Date().toISOString()
      }
    ],
    attendance: [
      {
        id: "att-demo-01",
        member_id: "usr-demomember-01",
        gym_id: defaultGymId,
        branch_id: branchCentralId,
        date: new Date().toISOString().split("T")[0],
        check_in_time: new Date(Date.now() - 3600000).toISOString(),
        check_out_time: null,
        method: "QR_SCAN",
        status: "PRESENT",
        created_at: new Date().toISOString()
      }
    ],
    qr_codes: [
      {
        id: "qr-demo-01",
        member_id: "usr-demomember-01",
        token: "FITHUB-QR-DEMO-001",
        is_revoked: false
      }
    ],
    workout_plans: [
      {
        id: "wod-template-01",
        gym_id: defaultGymId,
        title: "Foundation Push & Core",
        difficulty: "BEGINNER",
        goal_category: "HYPERTROPHY",
        description: "Balanced routine focusing on chest, anterior delts, triceps, and abdominal stability.",
        exercises: [
          { name: "Dumbbell Bench Press", sets: 3, reps: "10-12", weight_kg: 15.0, rest_seconds: 60, target_muscle: "Chest" },
          { name: "Incline Push-Ups", sets: 3, reps: "12", weight_kg: 0.0, rest_seconds: 45, target_muscle: "Upper Chest" },
          { name: "Overhead Tricep Extension", sets: 3, reps: "12", weight_kg: 10.0, rest_seconds: 45, target_muscle: "Triceps" },
          { name: "Plank Hold", sets: 3, reps: "45 secs", weight_kg: 0.0, rest_seconds: 45, target_muscle: "Core" }
        ]
      }
    ],
    workout_assignments: [
      {
        id: "wa-demo-01",
        member_id: "usr-demomember-01",
        workout_plan_id: "wod-template-01",
        title: "Foundation Push & Core",
        status: "ACTIVE",
        trainer_name: "Coach Kabir Sen",
        exercises: [
          { name: "Dumbbell Bench Press", sets: 3, reps: "10-12", weight_kg: 15.0, rest_seconds: 60, target_muscle: "Chest", completed: true },
          { name: "Incline Push-Ups", sets: 3, reps: "12", weight_kg: 0.0, rest_seconds: 45, target_muscle: "Upper Chest", completed: false },
          { name: "Overhead Tricep Extension", sets: 3, reps: "12", weight_kg: 10.0, rest_seconds: 45, target_muscle: "Triceps", completed: false }
        ]
      }
    ],
    workout_logs: [],
    diet_plans: [
      {
        id: "diet-template-01",
        gym_id: defaultGymId,
        title: "Lean Muscle Hypertrophy Protocol",
        target_calories: 2350,
        target_protein_g: 155,
        target_carbs_g: 220,
        target_fat_g: 65,
        water_target_ml: 3500,
        meals: [
          { meal_type: "BREAKFAST", title: "Oatmeal with Almond Milk & Whey", calories: 480, protein_g: 35, time: "08:30 AM" },
          { meal_type: "LUNCH", title: "Grilled Paneer/Chicken + Rice + Greens", calories: 680, protein_g: 48, time: "01:30 PM" },
          { meal_type: "SNACK", title: "Greek Yogurt with Berries & Walnuts", calories: 320, protein_g: 20, time: "05:00 PM" },
          { meal_type: "DINNER", title: "Dal/Lentils + Roti + Sautéed Vegetables", calories: 550, protein_g: 30, time: "08:30 PM" }
        ]
      }
    ],
    diet_assignments: [
      {
        id: "da-demo-01",
        member_id: "usr-demomember-01",
        diet_plan_id: "diet-template-01",
        title: "Lean Muscle Hypertrophy Protocol",
        target_calories: 2350,
        target_protein_g: 155,
        target_carbs_g: 220,
        target_fat_g: 65,
        water_target_ml: 3500,
        water_consumed_ml: 1750,
        status: "ACTIVE"
      }
    ],
    goals: [
      {
        id: "goal-demo-01",
        member_id: "usr-demomember-01",
        title: "Bench Press 90kg Milestone",
        target_date: "2026-12-31",
        goal_type: "STRENGTH",
        status: "IN_PROGRESS"
      }
    ],
    progress_records: [
      {
        id: "pr-demo-01",
        member_id: "usr-demomember-01",
        date: new Date().toISOString().split("T")[0],
        weight_kg: 74.5,
        height_cm: 178.0,
        bmi: 23.5,
        body_fat_percent: 15.2,
        chest_cm: 102.0,
        arms_cm: 38.5,
        waist_cm: 81.0,
        bench_press_max_kg: 85.0,
        squat_max_kg: 115.0,
        deadlift_max_kg: 140.0,
        notes: "Solid energy levels throughout training."
      }
    ],
    classes: [
      {
        id: "cls-01",
        gym_id: defaultGymId,
        branch_id: branchCentralId,
        title: "Power Vinyasa Yoga",
        category: "YOGA",
        trainer_name: "Pooja Hegde",
        time: "06:30 AM",
        duration_mins: 60,
        room: "Studio A",
        capacity: 20,
        booked_count: 14,
        is_active: true
      },
      {
        id: "cls-02",
        gym_id: defaultGymId,
        branch_id: branchCentralId,
        title: "High-Octane CrossFit",
        category: "CROSSFIT",
        trainer_name: "Coach Kabir Sen",
        time: "07:30 AM",
        duration_mins: 50,
        room: "Box Arena",
        capacity: 15,
        booked_count: 12,
        is_active: true
      },
      {
        id: "cls-03",
        gym_id: defaultGymId,
        branch_id: branchCentralId,
        title: "Zumba Dance Carnival",
        category: "ZUMBA",
        trainer_name: "Simran D'Souza",
        time: "06:00 PM",
        duration_mins: 60,
        room: "Studio B",
        capacity: 25,
        booked_count: 19,
        is_active: true
      }
    ],
    class_bookings: [],
    invoices: [
      {
        id: "inv-demo-01",
        invoice_number: "INV-2026-8801",
        gym_id: defaultGymId,
        branch_id: branchCentralId,
        member_id: "usr-demomember-01",
        item_title: "Elite 12-Month Pro + PT Pass",
        base_amount: 18643.22,
        discount_amount: 0.0,
        tax_amount: 3355.78,
        total_amount: 21999.0,
        due_date: new Date().toISOString().split("T")[0],
        status: "PAID",
        created_at: new Date().toISOString()
      }
    ],
    payments: [
      {
        id: "pay-demo-01",
        invoice_id: "inv-demo-01",
        member_id: "usr-demomember-01",
        gym_id: defaultGymId,
        branch_id: branchCentralId,
        amount: 21999.0,
        payment_method: "UPI",
        transaction_ref: "UPI-TXN-20268801-DEMO",
        status: "PAID",
        payment_date: new Date().toISOString()
      }
    ],
    expenses: [
      {
        id: "exp-01",
        gym_id: defaultGymId,
        branch_id: branchCentralId,
        category: "RENT",
        title: "Facility Lease - Downtown Central",
        amount: 165000.0,
        date: "2026-10-01",
        vendor: "Nariman Commercial Properties",
        payment_method: "NET_BANKING"
      },
      {
        id: "exp-02",
        gym_id: defaultGymId,
        branch_id: branchCentralId,
        category: "ELECTRICITY",
        title: "HVAC & Lighting Power Bill",
        amount: 48000.0,
        date: "2026-10-02",
        vendor: "State Electricity Board",
        payment_method: "ONLINE"
      },
      {
        id: "exp-03",
        gym_id: defaultGymId,
        branch_id: branchCentralId,
        category: "SALARY",
        title: "Trainer & Staff Payroll Q3",
        amount: 145000.0,
        date: "2026-10-01",
        vendor: "Staff Accounts",
        payment_method: "NET_BANKING"
      }
    ],
    products: [
      {
        id: "prd-01",
        gym_id: defaultGymId,
        branch_id: branchCentralId,
        sku: "SUP-WHEY-01",
        name: "Optimum Nutrition Gold Standard Whey 2kg",
        category: "SUPPLEMENTS",
        cost_price: 4800.0,
        selling_price: 6200.0,
        current_stock: 18,
        minimum_stock_alert: 5,
        is_active: true
      },
      {
        id: "prd-02",
        gym_id: defaultGymId,
        branch_id: branchCentralId,
        sku: "SUP-CREA-01",
        name: "Micronized Creatine Monohydrate 250g",
        category: "SUPPLEMENTS",
        cost_price: 750.0,
        selling_price: 1199.0,
        current_stock: 24,
        minimum_stock_alert: 8,
        is_active: true
      },
      {
        id: "prd-03",
        gym_id: defaultGymId,
        branch_id: branchCentralId,
        sku: "APP-TEE-01",
        name: "FIT HUB Athletic Dri-Fit Performance Tee",
        category: "APPAREL",
        cost_price: 380.0,
        selling_price: 899.0,
        current_stock: 45,
        minimum_stock_alert: 10,
        is_active: true
      }
    ],
    leads: [
      {
        id: "ld-01",
        gym_id: defaultGymId,
        branch_id: branchCentralId,
        full_name: "Rohit Deshmukh",
        phone: "+91 98450 11223",
        email: "rohit.d@example.com",
        source: "INSTAGRAM_AD",
        interested_plan: "Gold 3-Months",
        status: "TRIAL_BOOKED",
        trial_date: "2026-10-06",
        notes: "Interested in evening CrossFit sessions."
      },
      {
        id: "ld-02",
        gym_id: defaultGymId,
        branch_id: branchCentralId,
        full_name: "Natasha Patel",
        phone: "+91 98450 44556",
        email: "natasha.p@example.com",
        source: "REFERRAL",
        interested_plan: "Elite 12-Month Pro",
        status: "NEW",
        trial_date: null,
        notes: "Referred by member. Prefers morning workouts."
      }
    ],
    notifications: [
      {
        id: "notif-01",
        recipient_id: "usr-demomember-01",
        gym_id: defaultGymId,
        branch_id: branchCentralId,
        type: "ANNOUNCEMENT",
        title: "Welcome to FIT HUB!",
        message: "Your digital fitness passport is active. Explore your workouts, nutrition goals, and class schedules.",
        is_read: false,
        created_at: new Date().toISOString()
      }
    ],
    support_tickets: [
      {
        id: "tck-01",
        member_id: "usr-demomember-01",
        gym_id: defaultGymId,
        branch_id: branchCentralId,
        ticket_number: "TCK-101",
        category: "EQUIPMENT",
        priority: "MEDIUM",
        subject: "Cable crossover pulley maintenance",
        description: "Right pulley on station #2 squeaking during chest flyes.",
        status: "IN_PROGRESS",
        resolution_notes: "Technician scheduled for inspection today.",
        created_at: new Date().toISOString()
      }
    ],
    audit_logs: [
      {
        id: "log-01",
        gym_id: defaultGymId,
        branch_id: branchCentralId,
        actor_id: "usr-gymadmin-01",
        actor_role: "GYM_ADMIN",
        action: "INITIALIZE_BRANCH",
        entity: "BRANCH",
        entity_id: branchCentralId,
        metadata: { branch: "FitHub Downtown Central" },
        timestamp: new Date().toISOString()
      }
    ]
  };
}

// ---------------------------------------------------------------------------
// 4. Persistence Engine (Synchronous File DB with in-memory caching)
// ---------------------------------------------------------------------------
class DatabaseEngine {
  constructor() {
    this.data = null;
    this.init();
  }

  init() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, "utf8");
        this.data = JSON.parse(raw);
      } else {
        this.data = getInitialDbState();
        this.save();
      }
    } catch (err) {
      console.error("[DB Engine] Read error, resetting to initial state:", err);
      this.data = getInitialDbState();
      this.save();
    }
  }

  save() {
    try {
      const dir = path.dirname(DATA_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2), "utf8");
    } catch (err) {
      console.error("[DB Engine] Write error:", err);
    }
  }

  // --- Audit Log Utility ---
  logAudit(actor, action, entity, entityId, metadata = {}, gymId = null, branchId = null) {
    const entry = {
      id: crypto.randomUUID(),
      gym_id: gymId || actor?.gym_id || "gym-00000000-0000-0000-0000-000000000001",
      branch_id: branchId || actor?.branch_id || "br-00000000-0000-0000-0000-000000000001",
      actor_id: actor?.id || null,
      actor_role: actor?.role || "SYSTEM",
      action,
      entity,
      entity_id: entityId ? String(entityId) : null,
      metadata,
      timestamp: new Date().toISOString()
    };
    this.data.audit_logs.unshift(entry);
    this.save();
    return entry;
  }
}

export const db = new DatabaseEngine();
