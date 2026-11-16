-- =============================================================================
-- MediCare Hospital Management System - Database Schema & Security Architecture
-- Database: PostgreSQL (Supabase)
-- Module: Staff RBAC, Patient Registration, Patient Directory, Concurrency-Safe ID Minting
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. STAFF PROFILES & ROLE-BASED ACCESS CONTROL (RBAC)
-- =============================================================================

-- Define allowed staff roles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'staff_role') THEN
        CREATE TYPE public.staff_role AS ENUM ('receptionist', 'doctor', 'nurse', 'admin');
    END IF;
END $$;

-- Table: public.staff_profiles
-- Extends Supabase auth.users with medical staff identity and access roles.
CREATE TABLE IF NOT EXISTS public.staff_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role public.staff_role NOT NULL DEFAULT 'receptionist',
    department VARCHAR(100) NOT NULL DEFAULT 'Reception',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for staff lookups and auth verification
CREATE INDEX IF NOT EXISTS idx_staff_profiles_role ON public.staff_profiles(role);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_is_active ON public.staff_profiles(is_active);

-- Helper function: Returns current authenticated staff role (Security Definer to prevent RLS recursion)
CREATE OR REPLACE FUNCTION public.get_current_staff_role()
RETURNS public.staff_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    staff_user_role public.staff_role;
BEGIN
    SELECT role INTO staff_user_role
    FROM public.staff_profiles
    WHERE id = auth.uid() AND is_active = TRUE;
    
    RETURN staff_user_role;
END;
$$;

-- Helper function: Verifies if current user is active medical staff
CREATE OR REPLACE FUNCTION public.is_active_staff()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.staff_profiles
        WHERE id = auth.uid() AND is_active = TRUE
    );
END;
$$;

-- Helper function: Verifies if current user is an authorized administrator
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.staff_profiles
        WHERE id = auth.uid() AND role = 'admin' AND is_active = TRUE
    );
END;
$$;

-- =============================================================================
-- 2. PATIENTS TABLE & CONCURRENCY-SAFE ID GENERATION
-- =============================================================================

-- Dedicated sequence for atomic, multi-receptionist Patient ID generation
CREATE SEQUENCE IF NOT EXISTS public.patient_id_seq START WITH 1 INCREMENT BY 1;

-- Table: public.patients
-- Complete clinical and demographic patient repository with soft-deletion.
CREATE TABLE IF NOT EXISTS public.patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id VARCHAR(25) UNIQUE NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(25) NOT NULL,
    blood_group VARCHAR(5),
    marital_status VARCHAR(25),
    phone VARCHAR(25) NOT NULL,
    email VARCHAR(100),
    street_address TEXT,
    city VARCHAR(50),
    country VARCHAR(50),
    postal_code VARCHAR(25),
    emergency_contact_name VARCHAR(100),
    emergency_relationship VARCHAR(50),
    emergency_phone VARCHAR(25),
    medical_conditions VARCHAR(500),
    allergies VARCHAR(500),
    current_medications VARCHAR(500),
    previous_medical_history VARCHAR(500),
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    archived_at TIMESTAMPTZ,
    archived_by UUID REFERENCES auth.users(id),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT chk_first_name_length CHECK (char_length(trim(first_name)) >= 2),
    CONSTRAINT chk_last_name_length CHECK (char_length(trim(last_name)) >= 2),
    CONSTRAINT chk_dob_not_future CHECK (date_of_birth <= CURRENT_DATE),
    CONSTRAINT chk_gender_valid CHECK (gender IN ('Male', 'Female', 'Other', 'Prefer not to say')),
    CONSTRAINT chk_blood_group_valid CHECK (blood_group IS NULL OR blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'))
);

-- Performance and Query Optimization Indexes
CREATE INDEX IF NOT EXISTS idx_patients_patient_id ON public.patients(patient_id);
CREATE INDEX IF NOT EXISTS idx_patients_is_archived ON public.patients(is_archived);
CREATE INDEX IF NOT EXISTS idx_patients_created_at ON public.patients(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patients_name ON public.patients(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON public.patients(phone);
CREATE INDEX IF NOT EXISTS idx_patients_search ON public.patients(first_name, last_name, patient_id, phone, city);

-- Concurrency-Safe Trigger Function: Generates PT-YYYY-000001 atomically on database insert
CREATE OR REPLACE FUNCTION public.fn_generate_patient_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    current_year TEXT;
    next_seq_val BIGINT;
    candidate_id TEXT;
BEGIN
    -- Only generate if patient_id is not manually supplied
    IF NEW.patient_id IS NULL OR trim(NEW.patient_id) = '' THEN
        current_year := TO_CHAR(NOW(), 'YYYY');
        next_seq_val := nextval('public.patient_id_seq');
        candidate_id := 'PT-' || current_year || '-' || LPAD(next_seq_val::TEXT, 6, '0');
        NEW.patient_id := candidate_id;
    END IF;

    -- Assign creator if authenticated
    IF NEW.created_by IS NULL THEN
        NEW.created_by := auth.uid();
    END IF;

    NEW.created_at := COALESCE(NEW.created_at, NOW());
    NEW.updated_at := NOW();

    RETURN NEW;
END;
$$;

-- Attach Trigger for Patient ID Generation
DROP TRIGGER IF EXISTS trg_generate_patient_id ON public.patients;
CREATE TRIGGER trg_generate_patient_id
BEFORE INSERT ON public.patients
FOR EACH ROW
EXECUTE FUNCTION public.fn_generate_patient_id();

-- Concurrency-Safe Trigger Function: Updates `updated_at` timestamp on record change
CREATE OR REPLACE FUNCTION public.fn_update_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_patients_timestamp ON public.patients;
CREATE TRIGGER trg_update_patients_timestamp
BEFORE UPDATE ON public.patients
FOR EACH ROW
EXECUTE FUNCTION public.fn_update_timestamp();

DROP TRIGGER IF EXISTS trg_update_staff_profiles_timestamp ON public.staff_profiles;
CREATE TRIGGER trg_update_staff_profiles_timestamp
BEFORE UPDATE ON public.staff_profiles
FOR EACH ROW
EXECUTE FUNCTION public.fn_update_timestamp();

-- =============================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable Row Level Security on all application tables
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Staff Profiles Policies
-- -----------------------------------------------------------------------------

-- Drop existing policies if any
DROP POLICY IF EXISTS "Staff can view their own profile" ON public.staff_profiles;
DROP POLICY IF EXISTS "Active staff can view colleague names" ON public.staff_profiles;
DROP POLICY IF EXISTS "Admins can manage all staff profiles" ON public.staff_profiles;

-- 1. Any staff member can view their own account profile
CREATE POLICY "Staff can view their own profile"
    ON public.staff_profiles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

-- 2. Active staff can view basic staff directory info (name, department, role)
CREATE POLICY "Active staff can view colleague names"
    ON public.staff_profiles
    FOR SELECT
    TO authenticated
    USING (public.is_active_staff());

-- 3. Admins have full management access over staff profiles
CREATE POLICY "Admins can manage all staff profiles"
    ON public.staff_profiles
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- -----------------------------------------------------------------------------
-- Patients Table Policies (RBAC Enforced)
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Staff can view active patients" ON public.patients;
DROP POLICY IF EXISTS "Authorized staff can view archived patients" ON public.patients;
DROP POLICY IF EXISTS "Authorized staff can insert patients" ON public.patients;
DROP POLICY IF EXISTS "Authorized staff can update patient records" ON public.patients;
DROP POLICY IF EXISTS "Prevent hard deletion of patient records" ON public.patients;

-- 1. SELECT: Active medical staff can view active (non-archived) patient records
CREATE POLICY "Staff can view active patients"
    ON public.patients
    FOR SELECT
    TO authenticated
    USING (
        public.is_active_staff() AND is_archived = FALSE
    );

-- 2. SELECT (Archived): Receptionists, Doctors, and Admins can access archived patients when needed
CREATE POLICY "Authorized staff can view archived patients"
    ON public.patients
    FOR SELECT
    TO authenticated
    USING (
        public.is_active_staff() AND is_archived = TRUE AND
        public.get_current_staff_role() IN ('receptionist', 'doctor', 'admin')
    );

-- 3. INSERT: Receptionists and Admins can register new patients
CREATE POLICY "Authorized staff can insert patients"
    ON public.patients
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_active_staff() AND
        public.get_current_staff_role() IN ('receptionist', 'admin')
    );

-- 4. UPDATE: Receptionists, Doctors, and Admins can update clinical/demographic info or soft-delete (archive)
CREATE POLICY "Authorized staff can update patient records"
    ON public.patients
    FOR UPDATE
    TO authenticated
    USING (
        public.is_active_staff() AND
        public.get_current_staff_role() IN ('receptionist', 'doctor', 'admin')
    )
    WITH CHECK (
        public.is_active_staff() AND
        public.get_current_staff_role() IN ('receptionist', 'doctor', 'admin')
    );

-- 5. HARD DELETE: Strictly restricted to administrators only (prevents accidental data destruction)
CREATE POLICY "Prevent hard deletion of patient records"
    ON public.patients
    FOR DELETE
    TO authenticated
    USING (
        public.is_admin()
    );

-- =============================================================================
-- 4. AUTOMATIC STAFF PROFILE CREATION TRIGGER (ON SUPABASE AUTH SIGNUP)
-- =============================================================================

-- Creates a corresponding public.staff_profiles record when a new user is created in Supabase Auth
CREATE OR REPLACE FUNCTION public.fn_handle_new_staff_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    assigned_role public.staff_role;
    raw_role TEXT;
    staff_name TEXT;
BEGIN
    raw_role := LOWER(COALESCE(NEW.raw_user_meta_data->>'role', 'receptionist'));
    staff_name := COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1));

    -- Validate role or fallback to receptionist
    IF raw_role IN ('admin', 'doctor', 'nurse', 'receptionist') THEN
        assigned_role := raw_role::public.staff_role;
    ELSE
        assigned_role := 'receptionist'::public.staff_role;
    END IF;

    INSERT INTO public.staff_profiles (id, email, full_name, role, department, is_active)
    VALUES (
        NEW.id,
        NEW.email,
        staff_name,
        COALESCE(NEW.raw_user_meta_data->>'department', 'Reception'),
        assigned_role,
        TRUE
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        updated_at = NOW();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.fn_handle_new_staff_user();

