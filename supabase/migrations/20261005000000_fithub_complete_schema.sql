-- ============================================================================
-- FIT HUB — Complete Multi-Tenant Gym Management System Production Schema
-- Version: 1.0.0
-- Migration: 20261005000000_fithub_complete_schema.sql
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. PLATFORM & TENANCY (Gyms, Branches, Settings)
-- ============================================================================

CREATE TABLE IF NOT EXISTS platform_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_name VARCHAR(100) NOT NULL DEFAULT 'FIT HUB',
    logo_url TEXT,
    support_email VARCHAR(255) DEFAULT 'support@fithub.com',
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    currency_symbol VARCHAR(5) NOT NULL DEFAULT '₹',
    default_tax_percent NUMERIC(5,2) NOT NULL DEFAULT 18.00,
    maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gyms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    slug VARCHAR(100) UNIQUE NOT NULL,
    owner_id UUID,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    website VARCHAR(255),
    logo_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    city VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    phone VARCHAR(50) NOT NULL,
    capacity INT NOT NULL DEFAULT 500,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_gym_branch_code UNIQUE (gym_id, code)
);

CREATE TABLE IF NOT EXISTS gym_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL UNIQUE REFERENCES gyms(id) ON DELETE CASCADE,
    allow_cross_branch_access BOOLEAN NOT NULL DEFAULT FALSE,
    auto_freeze_days_allowed INT NOT NULL DEFAULT 15,
    tax_number VARCHAR(50),
    invoice_prefix VARCHAR(10) NOT NULL DEFAULT 'INV-',
    terms_and_conditions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS branch_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL UNIQUE REFERENCES branches(id) ON DELETE CASCADE,
    opening_time TIME NOT NULL DEFAULT '06:00:00',
    closing_time TIME NOT NULL DEFAULT '22:00:00',
    max_checkins_per_day INT NOT NULL DEFAULT 2,
    qr_refresh_interval_secs INT NOT NULL DEFAULT 30,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. USER PROFILES & ROLES
-- ============================================================================

CREATE TYPE user_role AS ENUM (
    'SUPER_ADMIN',
    'GYM_OWNER',
    'GYM_ADMIN',
    'TRAINER',
    'MEMBER'
);

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE, -- References auth.users(id) in Supabase Auth
    email VARCHAR(255) UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'MEMBER',
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    avatar_url TEXT,
    gym_id UUID REFERENCES gyms(id) ON DELETE SET NULL,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    dob DATE,
    gender VARCHAR(20),
    blood_group VARCHAR(10),
    emergency_contact VARCHAR(50),
    height_cm NUMERIC(5,2),
    weight_kg NUMERIC(5,2),
    fitness_goal VARCHAR(255),
    medical_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trainers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    specialty VARCHAR(255) NOT NULL,
    experience_years INT NOT NULL DEFAULT 0,
    rating NUMERIC(3,2) NOT NULL DEFAULT 5.00,
    bio TEXT,
    monthly_salary NUMERIC(12,2) DEFAULT 0.00,
    commission_percent NUMERIC(5,2) DEFAULT 0.00,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trainer_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_active_trainer_assignment UNIQUE (member_id, status)
);

-- ============================================================================
-- 3. MEMBERSHIPS & PLANS
-- ============================================================================

CREATE TABLE IF NOT EXISTS membership_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    duration_months INT NOT NULL CHECK (duration_months > 0),
    price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    joining_fee NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    tax_percent NUMERIC(5,2) NOT NULL DEFAULT 18.00,
    freeze_days_allowed INT NOT NULL DEFAULT 0,
    pt_sessions_included INT NOT NULL DEFAULT 0,
    allowed_facilities TEXT[] DEFAULT ARRAY['Gym Floor'],
    multi_branch_access BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES membership_plans(id) ON DELETE RESTRICT,
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'FROZEN', 'CANCELLED', 'PENDING')),
    start_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    freeze_days_remaining INT NOT NULL DEFAULT 0,
    is_frozen BOOLEAN NOT NULL DEFAULT FALSE,
    frozen_until DATE,
    balance_due NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. ATTENDANCE & QR CODES
-- ============================================================================

CREATE TABLE IF NOT EXISTS qr_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    check_in_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    check_out_time TIMESTAMPTZ,
    method VARCHAR(50) NOT NULL DEFAULT 'QR_SCAN' CHECK (method IN ('QR_SCAN', 'BIOMETRIC', 'MANUAL_ENTRY', 'CARD')),
    status VARCHAR(50) NOT NULL DEFAULT 'PRESENT' CHECK (status IN ('PRESENT', 'ABSENT', 'LATE')),
    verified_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 5. WORKOUT & EXERCISE MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS workout_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    difficulty VARCHAR(50) NOT NULL DEFAULT 'INTERMEDIATE' CHECK (difficulty IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ELITE')),
    goal_category VARCHAR(100) NOT NULL DEFAULT 'HYPERTROPHY',
    description TEXT,
    is_template BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workout_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_plan_id UUID NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    target_muscle VARCHAR(100) NOT NULL,
    sets INT NOT NULL DEFAULT 3,
    reps VARCHAR(50) NOT NULL DEFAULT '10-12',
    target_weight_kg NUMERIC(6,2) DEFAULT 0.00,
    rest_seconds INT NOT NULL DEFAULT 60,
    instructions TEXT,
    order_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workout_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_plan_id UUID NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'ARCHIVED')),
    trainer_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workout_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    workout_exercise_id UUID REFERENCES workout_exercises(id) ON DELETE SET NULL,
    exercise_name VARCHAR(255) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    set_number INT NOT NULL,
    reps_completed INT NOT NULL,
    weight_kg NUMERIC(6,2) NOT NULL DEFAULT 0.00,
    rpe INT CHECK (rpe BETWEEN 1 AND 10),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 6. DIET & NUTRITION PROTOCOLS
-- ============================================================================

CREATE TABLE IF NOT EXISTS diet_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    target_calories INT NOT NULL,
    target_protein_g INT NOT NULL,
    target_carbs_g INT NOT NULL,
    target_fat_g INT NOT NULL,
    water_target_ml INT NOT NULL DEFAULT 3000,
    notes TEXT,
    is_template BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS diet_meals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    diet_plan_id UUID NOT NULL REFERENCES diet_plans(id) ON DELETE CASCADE,
    meal_type VARCHAR(50) NOT NULL CHECK (meal_type IN ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'PRE_WORKOUT', 'POST_WORKOUT')),
    title VARCHAR(255) NOT NULL,
    time_schedule VARCHAR(50),
    calories INT NOT NULL,
    protein_g INT NOT NULL,
    carbs_g INT NOT NULL,
    fat_g INT NOT NULL,
    items_description TEXT,
    order_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS diet_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    diet_plan_id UUID NOT NULL REFERENCES diet_plans(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'ARCHIVED')),
    custom_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 7. PROGRESS TRACKING & GOALS
-- ============================================================================

CREATE TABLE IF NOT EXISTS goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    target_date DATE,
    goal_type VARCHAR(50) NOT NULL DEFAULT 'WEIGHT' CHECK (goal_type IN ('WEIGHT', 'STRENGTH', 'ATTENDANCE', 'BODY_FAT', 'OTHER')),
    target_value VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'ACHIEVED', 'ABANDONED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS progress_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    weight_kg NUMERIC(5,2) NOT NULL,
    height_cm NUMERIC(5,2),
    bmi NUMERIC(4,2),
    body_fat_percent NUMERIC(4,2),
    chest_cm NUMERIC(5,2),
    arms_cm NUMERIC(5,2),
    waist_cm NUMERIC(5,2),
    thighs_cm NUMERIC(5,2),
    bench_press_max_kg NUMERIC(6,2),
    squat_max_kg NUMERIC(6,2),
    deadlift_max_kg NUMERIC(6,2),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS progress_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    photo_url TEXT NOT NULL,
    tag VARCHAR(50) DEFAULT 'FRONT' CHECK (tag IN ('FRONT', 'SIDE', 'BACK')),
    is_private BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 8. GROUP CLASSES & BOOKINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL CHECK (category IN ('YOGA', 'ZUMBA', 'CROSSFIT', 'HIIT', 'STRENGTH', 'CARDIO', 'SPINNING')),
    default_capacity INT NOT NULL DEFAULT 20,
    duration_mins INT NOT NULL DEFAULT 60,
    room VARCHAR(100) NOT NULL DEFAULT 'Studio A',
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS class_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    trainer_id UUID REFERENCES trainers(id) ON DELETE SET NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    capacity INT NOT NULL DEFAULT 20,
    booked_count INT NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS class_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    booking_status VARCHAR(50) NOT NULL DEFAULT 'BOOKED' CHECK (booking_status IN ('BOOKED', 'WAITLISTED', 'CANCELLED', 'ATTENDED', 'NO_SHOW')),
    booking_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_member_session_booking UNIQUE (session_id, member_id)
);

-- ============================================================================
-- 9. BILLING, INVOICES & PAYMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(100) NOT NULL UNIQUE,
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    membership_id UUID REFERENCES memberships(id) ON DELETE SET NULL,
    item_title VARCHAR(255) NOT NULL,
    base_amount NUMERIC(12,2) NOT NULL,
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12,2) NOT NULL,
    due_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('UPI', 'CARD', 'CASH', 'NET_BANKING', 'ONLINE')),
    transaction_ref VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'PAID' CHECK (status IN ('PAID', 'PENDING', 'FAILED', 'REFUNDED')),
    payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL,
    reason TEXT NOT NULL,
    processed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    refund_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL CHECK (category IN ('RENT', 'ELECTRICITY', 'SALARY', 'EQUIPMENT', 'MAINTENANCE', 'MARKETING', 'CLEANING', 'OTHER')),
    title VARCHAR(255) NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    vendor VARCHAR(255),
    payment_method VARCHAR(50) NOT NULL DEFAULT 'CASH',
    receipt_url TEXT,
    notes TEXT,
    recorded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 10. PRODUCTS & INVENTORY MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    sku VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL CHECK (category IN ('SUPPLEMENTS', 'APPAREL', 'ACCESSORIES', 'EQUIPMENT', 'BEVERAGES', 'OTHER')),
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    cost_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    selling_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    current_stock INT NOT NULL DEFAULT 0,
    minimum_stock_alert INT NOT NULL DEFAULT 5,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_gym_product_sku UNIQUE (gym_id, sku)
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT', 'SALE', 'DAMAGE')),
    quantity INT NOT NULL,
    unit_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    reference_id VARCHAR(100),
    recorded_by UUID REFERENCES profiles(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    invoice_number VARCHAR(100) NOT NULL,
    total_amount NUMERIC(12,2) NOT NULL,
    invoice_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PAID',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    invoice_number VARCHAR(100) NOT NULL,
    total_amount NUMERIC(12,2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'UPI',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 11. CRM, MARKETING & LEADS
-- ============================================================================

CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    source VARCHAR(100) NOT NULL DEFAULT 'WALK_IN' CHECK (source IN ('WALK_IN', 'INSTAGRAM_AD', 'FACEBOOK', 'GOOGLE', 'REFERRAL', 'FLYER', 'OTHER')),
    interested_plan VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'CONTACTED', 'TRIAL_BOOKED', 'INTERESTED', 'CONVERTED', 'LOST')),
    trial_date DATE,
    assigned_staff_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lead_followups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    contact_method VARCHAR(50) NOT NULL DEFAULT 'CALL' CHECK (contact_method IN ('CALL', 'WHATSAPP', 'EMAIL', 'IN_PERSON')),
    notes TEXT NOT NULL,
    next_followup_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    target_audience VARCHAR(100) NOT NULL DEFAULT 'EXPIRED_MEMBERS',
    channel VARCHAR(50) NOT NULL DEFAULT 'IN_APP',
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    start_date DATE NOT NULL,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL UNIQUE,
    discount_percent NUMERIC(5,2),
    discount_amount NUMERIC(10,2),
    valid_from DATE NOT NULL,
    valid_until DATE NOT NULL,
    max_uses INT NOT NULL DEFAULT 100,
    times_used INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    referee_name VARCHAR(255) NOT NULL,
    referee_phone VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONVERTED', 'REWARDED')),
    reward_granted TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 12. NOTIFICATIONS & ANNOUNCEMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'MEMBERSHIP_EXPIRY', 'PAYMENT_DUE', 'PAYMENT_SUCCESS', 
        'BOOKING_CONFIRMATION', 'CLASS_REMINDER', 'ANNOUNCEMENT', 
        'BIRTHDAY', 'WORKOUT_REMINDER', 'DIET_REMINDER', 'SUPPORT_UPDATE', 'SYSTEM'
    )),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    publish_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 13. SUPPORT TICKETS & MESSAGING
-- ============================================================================

CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    ticket_number VARCHAR(50) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL CHECK (category IN ('EQUIPMENT', 'PAYMENT', 'MEMBERSHIP', 'TRAINER', 'APP', 'GENERAL')),
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
    assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 14. AUDIT LOGGING (Immutable System Audit Trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID REFERENCES gyms(id) ON DELETE SET NULL,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    actor_role user_role,
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100),
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(50),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent unauthorized updates or deletes to audit logs
CREATE OR REPLACE RULE audit_logs_no_update AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;
CREATE OR REPLACE RULE audit_logs_no_delete AS ON DELETE TO audit_logs DO INSTEAD NOTHING;

-- ============================================================================
-- 15. PERFORMANCE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_gym_branch ON profiles(gym_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_memberships_member_id ON memberships(member_id);
CREATE INDEX IF NOT EXISTS idx_memberships_status ON memberships(status);
CREATE INDEX IF NOT EXISTS idx_attendance_member_date ON attendance(member_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_branch_date ON attendance(branch_id, date);
CREATE INDEX IF NOT EXISTS idx_workout_assignments_member ON workout_assignments(member_id, status);
CREATE INDEX IF NOT EXISTS idx_diet_assignments_member ON diet_assignments(member_id, status);
CREATE INDEX IF NOT EXISTS idx_progress_records_member ON progress_records(member_id, date);
CREATE INDEX IF NOT EXISTS idx_invoices_member_id ON invoices(member_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_payments_member_id ON payments(member_id);
CREATE INDEX IF NOT EXISTS idx_class_sessions_start_time ON class_sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_class_bookings_member ON class_bookings(member_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, is_read);
CREATE INDEX IF NOT EXISTS idx_audit_logs_gym_time ON audit_logs(gym_id, timestamp DESC);

-- ============================================================================
-- 16. ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS across all sensitive tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE gyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE diet_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE diet_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to fetch current auth user role
CREATE OR REPLACE FUNCTION get_current_user_role() RETURNS user_role AS $$
    SELECT role FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Profiles: Members see self; Admins see members of their gym; Super Admin sees all
CREATE POLICY profiles_member_select ON profiles FOR SELECT USING (
    user_id = auth.uid() OR
    get_current_user_role() = 'SUPER_ADMIN' OR
    (get_current_user_role() IN ('GYM_OWNER', 'GYM_ADMIN') AND gym_id = (SELECT gym_id FROM profiles WHERE user_id = auth.uid()))
);

CREATE POLICY profiles_member_update ON profiles FOR UPDATE USING (
    user_id = auth.uid() OR get_current_user_role() = 'SUPER_ADMIN'
);

-- Memberships: Members see self; Gym Admins see branch/gym memberships
CREATE POLICY memberships_select ON memberships FOR SELECT USING (
    member_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
    get_current_user_role() = 'SUPER_ADMIN' OR
    (get_current_user_role() IN ('GYM_OWNER', 'GYM_ADMIN') AND gym_id = (SELECT gym_id FROM profiles WHERE user_id = auth.uid()))
);

-- Attendance: Members see self; Admins see branch attendance
CREATE POLICY attendance_select ON attendance FOR SELECT USING (
    member_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
    get_current_user_role() = 'SUPER_ADMIN' OR
    (get_current_user_role() IN ('GYM_OWNER', 'GYM_ADMIN', 'TRAINER') AND branch_id = (SELECT branch_id FROM profiles WHERE user_id = auth.uid()))
);

-- Notifications: Only recipient can see their notifications
CREATE POLICY notifications_recipient ON notifications FOR SELECT USING (
    recipient_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

CREATE POLICY notifications_recipient_update ON notifications FOR UPDATE USING (
    recipient_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Progress Records & Goals: Strict Member Privacy
CREATE POLICY progress_records_member ON progress_records FOR ALL USING (
    member_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
    (get_current_user_role() IN ('TRAINER', 'GYM_ADMIN') AND member_id IN (
        SELECT member_id FROM trainer_assignments WHERE trainer_id IN (
            SELECT id FROM trainers WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
        )
    ))
);

CREATE POLICY goals_member ON goals FOR ALL USING (
    member_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Billing & Invoices: Members see own; Admins see gym's
CREATE POLICY invoices_select ON invoices FOR SELECT USING (
    member_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
    get_current_user_role() = 'SUPER_ADMIN' OR
    (get_current_user_role() IN ('GYM_OWNER', 'GYM_ADMIN') AND gym_id = (SELECT gym_id FROM profiles WHERE user_id = auth.uid()))
);
