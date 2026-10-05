-- ============================================================================
-- FIT HUB — Safe Additive Reconciliation Migration
-- Migration: 20261005000001_safe_additive_reconciliation.sql
-- NON-DESTRUCTIVE: Adds missing columns, missing tables, and non-conflicting policies
-- NEVER drops existing tables, columns, constraints, or user data.
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. SAFE COLUMN ADDITIONS TO EXISTING TABLES

-- Table: profiles
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS dob DATE;
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS blood_group VARCHAR(10);
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(50);
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS height_cm NUMERIC(5,2);
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(5,2);
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS fitness_goal VARCHAR(255);
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS medical_notes TEXT;

-- Table: gyms
ALTER TABLE IF EXISTS gyms ADD COLUMN IF NOT EXISTS legal_name VARCHAR(255);
ALTER TABLE IF EXISTS gyms ADD COLUMN IF NOT EXISTS slug VARCHAR(100);
ALTER TABLE IF EXISTS gyms ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE IF EXISTS gyms ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE IF EXISTS gyms ADD COLUMN IF NOT EXISTS website VARCHAR(255);
ALTER TABLE IF EXISTS gyms ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE IF EXISTS gyms ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Table: branches
ALTER TABLE IF EXISTS branches ADD COLUMN IF NOT EXISTS code VARCHAR(50);
ALTER TABLE IF EXISTS branches ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE IF EXISTS branches ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE IF EXISTS branches ADD COLUMN IF NOT EXISTS capacity INT NOT NULL DEFAULT 500;
ALTER TABLE IF EXISTS branches ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Table: membership_plans
ALTER TABLE IF EXISTS membership_plans ADD COLUMN IF NOT EXISTS code VARCHAR(50);
ALTER TABLE IF EXISTS membership_plans ADD COLUMN IF NOT EXISTS duration_months INT NOT NULL DEFAULT 1;
ALTER TABLE IF EXISTS membership_plans ADD COLUMN IF NOT EXISTS allowed_facilities TEXT[];
ALTER TABLE IF EXISTS membership_plans ADD COLUMN IF NOT EXISTS multi_branch_access BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS membership_plans ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Table: memberships
ALTER TABLE IF EXISTS memberships ADD COLUMN IF NOT EXISTS plan_name VARCHAR(255);
ALTER TABLE IF EXISTS memberships ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE IF EXISTS memberships ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'PAID';
ALTER TABLE IF EXISTS memberships ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE IF EXISTS memberships ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE IF EXISTS memberships ADD COLUMN IF NOT EXISTS balance_due NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE IF EXISTS memberships ADD COLUMN IF NOT EXISTS remaining_days INT DEFAULT 0;
ALTER TABLE IF EXISTS memberships ADD COLUMN IF NOT EXISTS notes TEXT;

-- Table: attendance
ALTER TABLE IF EXISTS attendance ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;
ALTER TABLE IF EXISTS attendance ADD COLUMN IF NOT EXISTS check_in_time TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE IF EXISTS attendance ADD COLUMN IF NOT EXISTS check_out_time TIMESTAMPTZ;
ALTER TABLE IF EXISTS attendance ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'PRESENT';

-- Table: workout_plans
ALTER TABLE IF EXISTS workout_plans ADD COLUMN IF NOT EXISTS title VARCHAR(255) DEFAULT 'Standard Training Protocol';
ALTER TABLE IF EXISTS workout_plans ADD COLUMN IF NOT EXISTS difficulty VARCHAR(50) DEFAULT 'INTERMEDIATE';
ALTER TABLE IF EXISTS workout_plans ADD COLUMN IF NOT EXISTS goal_category VARCHAR(100) DEFAULT 'GENERAL_FITNESS';
ALTER TABLE IF EXISTS workout_plans ADD COLUMN IF NOT EXISTS exercises JSONB;
ALTER TABLE IF EXISTS workout_plans ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE;

-- Table: diet_plans
ALTER TABLE IF EXISTS diet_plans ADD COLUMN IF NOT EXISTS title VARCHAR(255) DEFAULT 'Balanced Daily Nutrition';
ALTER TABLE IF EXISTS diet_plans ADD COLUMN IF NOT EXISTS target_calories INT DEFAULT 2200;
ALTER TABLE IF EXISTS diet_plans ADD COLUMN IF NOT EXISTS target_protein_g INT DEFAULT 140;
ALTER TABLE IF EXISTS diet_plans ADD COLUMN IF NOT EXISTS target_carbs_g INT DEFAULT 200;
ALTER TABLE IF EXISTS diet_plans ADD COLUMN IF NOT EXISTS target_fat_g INT DEFAULT 60;
ALTER TABLE IF EXISTS diet_plans ADD COLUMN IF NOT EXISTS meals JSONB;
ALTER TABLE IF EXISTS diet_plans ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE;

-- Table: goals
ALTER TABLE IF EXISTS goals ADD COLUMN IF NOT EXISTS title VARCHAR(255);
ALTER TABLE IF EXISTS goals ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE IF EXISTS goals ADD COLUMN IF NOT EXISTS current_value NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE IF EXISTS goals ADD COLUMN IF NOT EXISTS unit VARCHAR(20) DEFAULT 'kg';

-- Table: progress_records
ALTER TABLE IF EXISTS progress_records ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(5,2);
ALTER TABLE IF EXISTS progress_records ADD COLUMN IF NOT EXISTS height_cm NUMERIC(5,2);
ALTER TABLE IF EXISTS progress_records ADD COLUMN IF NOT EXISTS bmi NUMERIC(4,1);
ALTER TABLE IF EXISTS progress_records ADD COLUMN IF NOT EXISTS body_fat_percent NUMERIC(4,1);
ALTER TABLE IF EXISTS progress_records ADD COLUMN IF NOT EXISTS chest_cm NUMERIC(5,2);
ALTER TABLE IF EXISTS progress_records ADD COLUMN IF NOT EXISTS arms_cm NUMERIC(5,2);
ALTER TABLE IF EXISTS progress_records ADD COLUMN IF NOT EXISTS waist_cm NUMERIC(5,2);
ALTER TABLE IF EXISTS progress_records ADD COLUMN IF NOT EXISTS bench_press_max_kg NUMERIC(5,2);
ALTER TABLE IF EXISTS progress_records ADD COLUMN IF NOT EXISTS squat_max_kg NUMERIC(5,2);
ALTER TABLE IF EXISTS progress_records ADD COLUMN IF NOT EXISTS deadlift_max_kg NUMERIC(5,2);
ALTER TABLE IF EXISTS progress_records ADD COLUMN IF NOT EXISTS notes TEXT;

-- Table: classes
ALTER TABLE IF EXISTS classes ADD COLUMN IF NOT EXISTS title VARCHAR(255) DEFAULT 'Group Fitness';
ALTER TABLE IF EXISTS classes ADD COLUMN IF NOT EXISTS trainer_name VARCHAR(255);
ALTER TABLE IF EXISTS classes ADD COLUMN IF NOT EXISTS time VARCHAR(50);
ALTER TABLE IF EXISTS classes ADD COLUMN IF NOT EXISTS duration_mins INT DEFAULT 60;
ALTER TABLE IF EXISTS classes ADD COLUMN IF NOT EXISTS room VARCHAR(100) DEFAULT 'Studio A';
ALTER TABLE IF EXISTS classes ADD COLUMN IF NOT EXISTS booked_count INT DEFAULT 0;
ALTER TABLE IF EXISTS classes ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Table: invoices
ALTER TABLE IF EXISTS invoices ADD COLUMN IF NOT EXISTS item_title VARCHAR(255);
ALTER TABLE IF EXISTS invoices ADD COLUMN IF NOT EXISTS base_amount NUMERIC(10,2);
ALTER TABLE IF EXISTS invoices ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) DEFAULT 0.00;

-- Table: payments
ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'UPI';
ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS transaction_ref VARCHAR(100);

-- Table: leads
ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS interested_plan VARCHAR(255);
ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS trial_date DATE;

-- Table: products
ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS minimum_stock_alert INT DEFAULT 5;
ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Table: notifications
ALTER TABLE IF EXISTS notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

-- Table: support_tickets
ALTER TABLE IF EXISTS support_tickets ADD COLUMN IF NOT EXISTS ticket_number VARCHAR(50);
ALTER TABLE IF EXISTS support_tickets ADD COLUMN IF NOT EXISTS member_id UUID;
ALTER TABLE IF EXISTS support_tickets ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'MEDIUM';
ALTER TABLE IF EXISTS support_tickets ADD COLUMN IF NOT EXISTS resolution_notes TEXT;

-- Table: audit_logs
ALTER TABLE IF EXISTS audit_logs ADD COLUMN IF NOT EXISTS entity VARCHAR(100);
ALTER TABLE IF EXISTS audit_logs ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ DEFAULT NOW();

-- 3. CREATE ANY MISSING AUXILIARY TABLES
CREATE TABLE IF NOT EXISTS refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID,
    amount NUMERIC(10,2) NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    discount_percent NUMERIC(5,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID,
    referred_id UUID,
    status VARCHAR(50) DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. SAFE BASE SEED DATA (Only inserted if tables are currently empty)
DO $$
DECLARE
    v_gym_id UUID;
    v_branch_id UUID;
BEGIN
    -- Check if gym exists
    SELECT id INTO v_gym_id FROM gyms LIMIT 1;
    IF v_gym_id IS NULL THEN
        INSERT INTO gyms (name, slug, email, is_active)
        VALUES ('FIT HUB Elite Fitness', 'fithub-elite', 'contact@fithub.com', TRUE)
        RETURNING id INTO v_gym_id;
    END IF;

    -- Check if branch exists
    SELECT id INTO v_branch_id FROM branches WHERE gym_id = v_gym_id LIMIT 1;
    IF v_branch_id IS NULL THEN
        INSERT INTO branches (gym_id, name, code, city, address, phone, capacity, is_active)
        VALUES (v_gym_id, 'FitHub Downtown Central', 'BR-01', 'Mumbai', 'Plot 14, MG Road, Nariman Point', '+91 98200 11223', 500, TRUE)
        RETURNING id INTO v_branch_id;
    END IF;

    -- Membership Plans Seed (If empty)
    IF NOT EXISTS (SELECT 1 FROM membership_plans WHERE gym_id = v_gym_id) THEN
        INSERT INTO membership_plans (gym_id, name, price, joining_fee, tax_percent, freeze_days_allowed, pt_sessions_included, description)
        VALUES 
            (v_gym_id, 'Silver 1-Month', 2999.00, 500.00, 18.00, 0, 0, 'Standard month-to-month gym floor access.'),
            (v_gym_id, 'Gold 3-Months', 7499.00, 500.00, 18.00, 7, 2, 'Includes steam bath & 2 free personal training sessions.'),
            (v_gym_id, 'Platinum 6-Months', 12999.00, 0.00, 18.00, 15, 6, 'Zero joining fee + 15 days membership freeze.'),
            (v_gym_id, 'Elite 12-Month Pro + PT Pass', 21999.00, 0.00, 18.00, 30, 12, 'Multi-branch passport + 12 PT sessions + 30 days freeze.');
    END IF;

    -- Classes Seed (If empty)
    IF NOT EXISTS (SELECT 1 FROM classes WHERE gym_id = v_gym_id) THEN
        INSERT INTO classes (gym_id, branch_id, category, description, capacity)
        VALUES
            (v_gym_id, v_branch_id, 'YOGA', 'Power Vinyasa Yoga for flexibility and core', 20),
            (v_gym_id, v_branch_id, 'CROSSFIT', 'High-Octane CrossFit strength & conditioning', 15),
            (v_gym_id, v_branch_id, 'ZUMBA', 'Zumba Dance Carnival cardio party', 25);
    END IF;
END $$;
