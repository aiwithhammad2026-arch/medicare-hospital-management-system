/**
 * MediCare Hospital Management System - Authentication & Session Guard (auth.js)
 * =============================================================================
 * Handles session verification, staff profile lookups, role enforcement,
 * route protection for dashboard pages, and secure logout.
 * =============================================================================
 */

(function () {
  'use strict';

  // Demo staff credentials for instant local testing & role verification
  const DEMO_STAFF_ACCOUNTS = [
    {
      email: 'receptionist@medicare.com',
      password: 'Password123!',
      full_name: 'Sarah Jenkins',
      role: 'receptionist',
      department: 'Patient Admissions',
      is_active: true
    },
    {
      email: 'admin@medicare.com',
      password: 'Password123!',
      full_name: 'Dr. Marcus Vance',
      role: 'admin',
      department: 'Hospital Administration',
      is_active: true
    },
    {
      email: 'doctor@medicare.com',
      password: 'Password123!',
      full_name: 'Dr. Emily Chen, MD',
      role: 'doctor',
      department: 'Internal Medicine',
      is_active: true
    },
    {
      email: 'nurse@medicare.com',
      password: 'Password123!',
      full_name: 'James Wilson, RN',
      role: 'nurse',
      department: 'Emergency & Triage',
      is_active: true
    }
  ];

  let currentStaffProfile = null;
  let currentAuthUser = null;

  /**
   * Fetches the staff profile from public.staff_profiles for the given user ID.
   * @param {Object} supabase
   * @param {string} userId
   * @returns {Promise<Object|null>}
   */
  async function fetchStaffProfile(supabase, userId) {
    try {
      const { data, error } = await supabase
        .from('staff_profiles')
        .select('id, email, full_name, role, department, is_active')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching staff profile:', error.message);
        return null;
      }
      return data;
    } catch (err) {
      console.error('Exception fetching staff profile:', err);
      return null;
    }
  }

  /**
   * Updates the top bar header with authenticated staff credentials.
   * @param {Object} profile
   */
  function updateHeaderStaffInfo(profile) {
    if (!profile) return;

    const userNameEl = document.querySelector('.user-name');
    const userRoleEl = document.querySelector('.user-role');
    const avatarEl = document.querySelector('.avatar');

    if (userNameEl) {
      userNameEl.textContent = profile.full_name || 'Staff Member';
    }

    if (userRoleEl) {
      const roleCapitalized = profile.role
        ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1)
        : 'Staff';
      const dept = profile.department ? ` • ${profile.department}` : '';
      userRoleEl.textContent = `${roleCapitalized}${dept}`;
    }

    if (avatarEl && profile.full_name) {
      const parts = profile.full_name.trim().split(/\s+/);
      let initials = 'ST';
      if (parts.length >= 2) {
        initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      } else if (parts.length === 1 && parts[0].length >= 2) {
        initials = parts[0].slice(0, 2).toUpperCase();
      }
      avatarEl.textContent = initials;
    }
  }

  /**
   * Guards protected pages (e.g. index.html).
   * Verifies authenticated session and active staff role.
   * Redirects to login.html if unauthorized.
   * @returns {Promise<{ user: Object, profile: Object }|null>}
   */
  async function requireAuth() {
    // 1. Check for active local demo staff session
    try {
      const demoSessionStr = sessionStorage.getItem('hms_staff_session');
      if (demoSessionStr) {
        const demoSession = JSON.parse(demoSessionStr);
        if (demoSession && demoSession.profile && demoSession.profile.is_active) {
          currentStaffProfile = demoSession.profile;
          currentAuthUser = demoSession.user;
          updateHeaderStaffInfo(currentStaffProfile);

          // Dismiss loading overlay smoothly
          const guardOverlay = document.getElementById('authGuardLoading');
          if (guardOverlay) {
            guardOverlay.classList.add('fade-out');
            setTimeout(() => guardOverlay.remove(), 250);
          }
          return { user: currentAuthUser, profile: currentStaffProfile };
        }
      }
    } catch (e) {
      sessionStorage.removeItem('hms_staff_session');
    }

    // 2. Live Supabase Session Check
    const supabase = window.HMS_SUPABASE ? window.HMS_SUPABASE.getClient() : null;

    if (!supabase) {
      window.location.replace('login.html');
      return null;
    }

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session || !session.user) {
        window.location.replace('login.html');
        return null;
      }

      currentAuthUser = session.user;
      const profile = await fetchStaffProfile(supabase, session.user.id);

      if (!profile) {
        console.error('No staff profile found for authenticated user.');
        await supabase.auth.signOut();
        window.location.replace('login.html?error=no_profile');
        return null;
      }

      if (!profile.is_active) {
        console.warn('Staff account is marked inactive.');
        await supabase.auth.signOut();
        window.location.replace('login.html?error=inactive');
        return null;
      }

      currentStaffProfile = profile;
      updateHeaderStaffInfo(profile);

      // Listen for background session changes (e.g. token expired, logged out elsewhere)
      supabase.auth.onAuthStateChange((event, newSession) => {
        if (event === 'SIGNED_OUT' || !newSession) {
          window.location.replace('login.html?logged_out=true');
        }
      });

      // Dismiss auth loading overlay if present
      const guardOverlay = document.getElementById('authGuardLoading');
      if (guardOverlay) {
        guardOverlay.classList.add('fade-out');
        setTimeout(() => guardOverlay.remove(), 250);
      }

      return { user: session.user, profile };
    } catch (err) {
      console.error('Authentication guard error:', err);
      window.location.replace('login.html?error=auth_failed');
      return null;
    }
  }

  /**
   * Executes staff logout:
   * 1. Confirms action with user.
   * 2. Calls Supabase signOut() and clears demo session.
   * 3. Redirects to login.html?logged_out=true.
   */
  async function handleLogout() {
    const confirmed = typeof window.showConfirmDialog === 'function'
      ? await window.showConfirmDialog({
          title: 'Sign Out',
          message: 'Are you sure you want to sign out of the Hospital Management System?',
          confirmText: 'Sign Out',
          cancelText: 'Stay Signed In'
        })
      : window.confirm('Are you sure you want to sign out?');

    if (!confirmed) return;

    const supabase = window.HMS_SUPABASE ? window.HMS_SUPABASE.getClient() : null;

    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      // Clear demo session & memory
      sessionStorage.removeItem('hms_staff_session');
      currentStaffProfile = null;
      currentAuthUser = null;
      // Prevent browser back navigation from re-displaying cached content
      window.location.replace('login.html?logged_out=true');
    }
  }

  /**
   * Returns currently authenticated staff profile and user.
   */
  function getCurrentStaff() {
    return {
      user: currentAuthUser,
      profile: currentStaffProfile
    };
  }

  // Export to global namespace
  window.HMS_AUTH = {
    DEMO_ACCOUNTS: DEMO_STAFF_ACCOUNTS,
    requireAuth,
    handleLogout,
    getCurrentStaff,
    fetchStaffProfile,
    updateHeaderStaffInfo
  };
})();

