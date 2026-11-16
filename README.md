# MediCare Hospital Management System — Patient Registration & Directory Module

A lightweight, accessible, and responsive Patient Management web application built with vanilla HTML5, CSS3, and JavaScript. Features a complete Patient Registration form and an interactive Patient Directory with search, filtering, full-record dossiers, CSV export, and demo data seeding — all powered by browser localStorage with zero external dependencies.

---

## Table of Contents
1. [Overview & Key Features](#overview--key-features)
2. [Project Structure](#project-structure)
3. [How to Run](#how-to-run)
4. [Module 1: Patient Registration](#module-1-patient-registration)
5. [Module 2: Patient Directory](#module-2-patient-directory)
6. [Validation Rules Specification](#validation-rules-specification)
7. [Patient ID Format & Generation](#patient-id-format--generation)
8. [Demo Data Storage & Reset](#demo-data-storage--reset)
9. [Accessibility & UX Details](#accessibility--ux-details)
10. [Browser Compatibility](#browser-compatibility)
11. [Future Roadmap](#future-roadmap)

---

## Overview & Key Features

This module forms the patient intake and directory foundation for a Hospital Management System (HMS), allowing hospital receptionists to register and manage patients efficiently with zero external framework overhead.

### Registration Module
- **4 Structured Form Sections**: Personal Information, Contact Information, Emergency Contact, Medical Information
- **Comprehensive Inline Validation**: Real-time error feedback on blur with progressive correction
- **Sequential Patient ID Minting**: `PT-YYYY-000001` format with collision-safe generation
- **Success Modal & Clipboard Copy**: One-click patient ID clipboard copy with "Register Another" quick action

### Patient Directory Module
- **Searchable Data Table**: Full-text search across patient name, ID, phone, city, and email
- **Multi-Filter Support**: Dropdown filters for gender and blood group, combinable with search
- **Full Patient Dossier Modal**: Complete record view including personal details, contact info, emergency contacts, and medical notes
- **Record Management**: View and delete individual patient records with confirmation dialogs
- **Demo Data Seeder**: One-click loading of 5 realistic international patient profiles
- **CSV Export**: Download all patient records as a formatted `.csv` spreadsheet file
- **Print Support**: Print patient dossiers via browser print dialog with clean print stylesheet

### Architecture
- **Zero-Dependency Vanilla Stack**: Pure HTML5, CSS3 custom properties, and ES6+ JavaScript
- **Client-Side SPA Router**: Hash-based view switching (`#register` / `#patients`) with URL sync
- **Enterprise Design Language**: Dark teal sidebar (`#004D40`), light grey canvas (`#F5F5F5`), WCAG AA compliant contrast ratios

---

## Project Structure

```text
├── index.html       # Protected hospital dashboard: patient registration, directory, modals
├── login.html       # Staff login portal: email/password sign-in, forgot/reset password, DB setup
├── style.css        # Enterprise design system (teal #004D40, primary #00796B), login styles
├── script.js        # Dashboard application logic, form handling, validation, confirm modal
├── auth.js          # Authentication guard, session verification, RBAC header sync, secure logout
├── login.js         # Staff login authentication logic, credential validation, password toggle
├── supabase-config.js # Supabase client singleton loader (URL & public Anon key configuration)
├── schema.sql       # Supabase PostgreSQL schema, staff_profiles, patients, RLS, functions, triggers
└── README.md        # Comprehensive documentation, setup guide, security policies, and roadmap
```

---

## Supabase Database & Staff Authentication Setup

The system integrates a PostgreSQL database and Supabase Authentication with Role-Based Access Control (RBAC) and Row Level Security (RLS).

### Step 1: Execute Database Schema
1. Open your Supabase project dashboard at [supabase.com](https://supabase.com).
2. Go to the **SQL Editor**.
3. Open [`schema.sql`](schema.sql) from this repository, copy all contents, paste into the editor, and click **Run**.
4. This creates:
   - `staff_role` enum (`receptionist`, `doctor`, `nurse`, `admin`).
   - `staff_profiles` table linked to Supabase Auth (`auth.users`).
   - `patient_id_seq` sequence & trigger for concurrency-safe `PT-YYYY-000001` ID generation.
   - `patients` table with check constraints, index, soft-delete columns (`is_archived`).
   - Automated `updated_at` triggers and RLS policies for active vs archived records.

### Step 2: Configure Supabase Credentials in the App
You can configure credentials in two ways:
- **Option A (Interactive Modal):** Open `login.html`, click **Database Connection Settings** at the bottom, enter your **Project URL** and **Anon/Public Key**, and click **Save & Connect**.
- **Option B (File Configuration):** Open [`supabase-config.js`](supabase-config.js) and set `DEFAULT_SUPABASE_URL` and `DEFAULT_SUPABASE_ANON_KEY`.

> **Security Note:** Never put the `service_role` secret key in frontend code or in the setup modal. Only use the public `anon` key.

### Step 3: Provision Your First Staff User
1. In the Supabase Dashboard, go to **Authentication -> Users** and click **Add User** -> **Create User**.
2. Enter the staff email (e.g. `receptionist@medicare.com`) and a password.
3. The SQL trigger `trg_on_auth_user_created` automatically provisions a matching record in `public.staff_profiles` with `receptionist` role.
4. To set a specific role or admin privileges, run in the SQL Editor:
   ```sql
   UPDATE public.staff_profiles
   SET role = 'admin', full_name = 'Dr. Sarah Connor', department = 'Executive Management'
   WHERE email = 'receptionist@medicare.com';
   ```

### Step 4: Sign In
1. Navigate to `login.html`.
2. Sign in with the staff credentials created above.
3. Upon authentication, you will be redirected to the protected dashboard (`index.html`), and your staff name, role, and department will dynamically display in the top header.
4. Clicking **Logout** in the sidebar prompts a confirmation dialog, terminates the Supabase session, and redirects to `login.html?logged_out=true`. Unauthenticated access to `index.html` is automatically blocked.

---

## How to Run

No build tools, bundlers, compilers, or server installations are required.

1. Download or clone the repository files into a directory.
2. Double-click `index.html` to open it in any modern web browser.
3. Alternatively, serve it using any lightweight static server:
   ```bash
   # Python 3:
   python -m http.server 8080

   # Node.js:
   npx serve .
   ```
4. Navigate to `http://localhost:8080` in your browser.

### Quick Start
- The app opens on the **Patient Registration** form by default (`#register`).
- Click **Patient List** in the sidebar (or navigate to `#patients`) to view the directory.
- Click **Load Demo Patients** to seed 5 realistic sample records for testing.

---

## Module 1: Patient Registration

The registration form collects patient information across 4 fieldsets:

| Section | Fields |
|---|---|
| **Personal Information** | First Name*, Last Name*, Date of Birth*, Gender*, Blood Group, Marital Status |
| **Contact Information** | Phone Number*, Email Address, Street Address (full-width), City, Country, Postal Code |
| **Emergency Contact** | Contact Person Name, Relationship, Emergency Phone Number |
| **Medical Information** | Existing Conditions, Known Allergies, Current Medications, Previous Medical History (each with 500-char live counters) |

On successful submission:
1. A unique Patient ID is generated (`PT-2026-000001`).
2. The record is saved to `localStorage`.
3. A success modal appears with the ID, clipboard copy, and options to "Register Another" or "View in Patient List".

---

## Module 2: Patient Directory

Navigate to **Patient List** in the sidebar or open `#patients` in the URL.

### Features
- **Search Bar**: Instant full-text search across name, patient ID, phone number, city, and email address.
- **Filter Dropdowns**: Filter by gender (Male/Female/Other/Prefer not to say) and blood group (A+, A-, B+, B-, AB+, AB-, O+, O-). Filters stack with search.
- **Data Table**: Columns for Patient ID (monospace badge), Full Name, Gender/Age, Blood Group (red badge), Phone, Registration Date, and Actions.
- **View Dossier**: Opens a comprehensive modal showing all patient details across 4 sections with a print button.
- **Delete Record**: Soft-deletes a patient record from localStorage with confirmation dialog.
- **Clear Filters**: One-click filter reset button when any filter is active.
- **Empty States**: Context-aware empty states ("No Patients Registered Yet" vs "No Matching Records") with quick action buttons.
- **CSV Export**: Downloads all stored patient records as `medicare-patients-YYYY-MM-DD.csv`.
- **Demo Seeder**: Loads 5 realistic international patient profiles (USA, Pakistan, UK, Singapore, India) with medical histories.

---

## Validation Rules Specification

| Field | Required? | Validation Rule | Error Message |
|---|---|---|---|
| **First Name** | Yes | Unicode letters, spaces, hyphens, apostrophes; min 2 letters, max 50 chars | *"First name is required."* / *"Enter at least 2 letters..."* |
| **Last Name** | Yes | Same as First Name | *"Last name is required."* / *"Enter at least 2 letters..."* |
| **Date of Birth** | Yes | Valid date; not future; not >120 years ago | *"Date of birth is required."* / *"...cannot be in the future."* |
| **Gender** | Yes | Non-empty selection | *"Please select a gender."* |
| **Phone Number** | Yes | Digits, spaces, hyphens, parens, optional `+`; 10–15 digits | *"Phone number is required."* / *"Enter a valid phone number..."* |
| **Email** | Optional | Standard email format | *"Enter a valid email address."* |
| **City / Country** | Optional | Letters, spaces, hyphens, apostrophes, periods; min 2 letters | *"Enter a valid name."* |
| **Postal Code** | Optional | Alphanumeric, spaces, hyphens; 3–10 chars | *"Enter a valid postal code."* |
| **Emergency Name** | Optional | Same as name fields | *"Enter a valid name."* |
| **Emergency Phone** | Optional | Same as phone | *"Enter a valid phone number..."* |
| **Medical Textareas** | Optional | Max 500 characters each | *"Maximum 500 characters allowed."* |

---

## Patient ID Format & Generation

Each registered patient receives a unique identifier: **`PT-{YEAR}-{6-digit counter}`**

- **Example**: `PT-2026-000001`, `PT-2026-000002`
- **Collision Protection**: Checks existing IDs before assigning.
- **Atomic Counter**: Counter committed to `localStorage` only after successful record save.

---

## Demo Data Storage & Reset

> **Data Privacy Disclaimer**: This is a client-side prototype. All records are saved in browser `localStorage` only. No data is transmitted to any server. Do not enter real patient information.

### Inspect Records
```javascript
console.table(JSON.parse(localStorage.getItem('hms_demo_patients') || '[]'));
```

### Clear All Data
```javascript
localStorage.removeItem('hms_demo_patients');
localStorage.removeItem('hms_demo_patient_counter');
console.log('Demo storage cleared.');
```

---

## Accessibility & UX Details

Built to meet **WCAG 2.1 AA** standards:

1. **Color Contrast**: Primary text 16.1:1, teal buttons 4.64:1, error text 4.62:1, input borders 3:1 non-text contrast.
2. **Keyboard Navigation**: Skip link, focus trapping in off-canvas drawer, visible focus rings, Escape to close modals.
3. **Screen Readers**: Semantic `<fieldset>`/`<legend>`, `aria-live` error regions, single summary live region, threshold-based character counter announcements.
4. **Mobile**: 44px touch targets, 16px iOS text (prevents zoom), responsive stacked layout, off-canvas sidebar with `inert`.
5. **Reduced Motion**: `prefers-reduced-motion` disables all animations and transitions.
6. **Print**: Clean print stylesheet hides navigation, toolbars, and action buttons for dossier printing.

---

## Browser Compatibility

- Google Chrome 90+
- Mozilla Firefox 88+
- Apple Safari 15.4+ (native `<dialog>` and `inert`)
- Microsoft Edge 90+
- Mobile Safari (iOS 15.4+) & Chrome for Android

---

## Future Roadmap

1. **Patient Record Editing**: Inline edit form to update contact info and medical notes.
2. **Table Sorting**: Click column headers to sort by name, date, or ID (ascending/descending).
3. **Pagination**: Client-side pagination for large datasets (25/50/100 per page).
4. **PDF Intake Summary**: Generate downloadable PDF intake forms per patient.
5. **Secure Backend Integration**: REST API with JWT authentication and encrypted database.
