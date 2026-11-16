/**
 * MediCare Hospital Management System - Staff Login Logic (login.js)
 * =============================================================================
 * Handles staff authentication, form validation, password visibility toggle,
 * password reset flow, and connection settings management.
 * =============================================================================
 */

document.addEventListener('DOMContentLoaded', async () => {
  'use strict';

  // DOM Elements Cache
  const form = document.getElementById('staffLoginForm');
  const emailInput = document.getElementById('loginEmail');
  const passwordInput = document.getElementById('loginPassword');
  const rememberMeCheckbox = document.getElementById('rememberMe');
  const signInBtn = document.getElementById('signInBtn');
  const signInSpinner = document.getElementById('signInSpinner');
  const passwordToggleBtn = document.getElementById('passwordToggleBtn');
  const eyeOpenIcon = document.getElementById('eyeOpenIcon');
  const eyeClosedIcon = document.getElementById('eyeClosedIcon');
  const statusBanner = document.getElementById('loginStatusBanner');
  const toastContainer = document.getElementById('toastContainer');

  // Modals
  const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
  const forgotPasswordModal = document.getElementById('forgotPasswordModal');
  const forgotPasswordForm = document.getElementById('forgotPasswordForm');
  const resetEmailInput = document.getElementById('resetEmail');
  const cancelResetBtn = document.getElementById('cancelResetBtn');
  const sendResetBtn = document.getElementById('sendResetBtn');

  const updatePasswordModal = document.getElementById('updatePasswordModal');
  const updatePasswordForm = document.getElementById('updatePasswordForm');
  const newPasswordInput = document.getElementById('newPassword');
  const confirmNewPasswordInput = document.getElementById('confirmNewPassword');

  const configSupabaseBtn = document.getElementById('configSupabaseBtn');
  const supabaseConfigModal = document.getElementById('supabaseConfigModal');
  const supabaseConfigForm = document.getElementById('supabaseConfigForm');
  const configUrlInput = document.getElementById('configUrl');
  const configAnonKeyInput = document.getElementById('configAnonKey');
  const closeConfigBtn = document.getElementById('closeConfigBtn');

  /**
   * Displays an inline alert message inside the login card.
   * @param {string} message
   * @param {'error'|'success'|'warning'|'info'} [type='error']
   */
  const showBanner = (message, type = 'error') => {
    if (!statusBanner) return;
    statusBanner.className = `alert-banner alert-${type}`;
    statusBanner.textContent = message;
    statusBanner.style.display = 'block';
  };

  const hideBanner = () => {
    if (!statusBanner) return;
    statusBanner.style.display = 'none';
    statusBanner.textContent = '';
  };

  /**
   * Displays an auto-dismissing toast notification.
   * @param {string} message
   * @param {'success'|'error'} [type='success']
   */
  const showToast = (message, type = 'success') => {
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const textSpan = document.createElement('span');
    textSpan.textContent = message;
    toast.appendChild(textSpan);
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-fadeout');
      setTimeout(() => toast.remove(), 250);
    }, 4000);
  };

  /**
   * Toggles password input visibility between text and password.
   */
  if (passwordToggleBtn && passwordInput) {
    passwordToggleBtn.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';

      if (eyeOpenIcon && eyeClosedIcon) {
        eyeOpenIcon.style.display = isPassword ? 'none' : 'block';
        eyeClosedIcon.style.display = isPassword ? 'block' : 'none';
      }

      passwordToggleBtn.setAttribute(
        'aria-label',
        isPassword ? 'Hide password' : 'Show password'
      );
    });
  }

  /**
   * Form Field Error Helpers
   */
  const setFieldError = (fieldId, message) => {
    const errorEl = document.getElementById(`${fieldId}-error`);
    const field = document.getElementById(fieldId);
    if (errorEl) errorEl.textContent = message;
    if (field) {
      field.classList.add('is-invalid');
      field.setAttribute('aria-invalid', 'true');
    }
  };

  const clearFieldError = (fieldId) => {
    const errorEl = document.getElementById(`${fieldId}-error`);
    const field = document.getElementById(fieldId);
    if (errorEl) errorEl.textContent = '';
    if (field) {
      field.classList.remove('is-invalid');
      field.removeAttribute('aria-invalid');
    }
  };

  [emailInput, passwordInput].forEach((input) => {
    if (!input) return;
    input.addEventListener('input', () => {
      clearFieldError(input.id);
      hideBanner();
    });
  });

  /**
   * Checks for URL query parameters (e.g. logged out, error codes)
   */
  const handleUrlParams = () => {
    const params = new URLSearchParams(window.location.search);

    if (params.get('logged_out') === 'true') {
      showBanner('You have been signed out successfully.', 'success');
    } else if (params.get('setup') === 'required') {
      showBanner('Database connection settings are required. Click "Database Connection Settings" below to connect.', 'warning');
    } else if (params.get('error') === 'inactive') {
      showBanner('Your staff account is currently inactive. Please contact the hospital administrator.', 'error');
    } else if (params.get('error') === 'no_profile') {
      showBanner('No medical staff profile is linked to this account.', 'error');
    } else if (params.get('error') === 'auth_failed') {
      showBanner('Authentication session expired or failed. Please sign in again.', 'error');
    }

    // Clean URL without page reload
    if (window.history && window.history.replaceState && window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  handleUrlParams();

  /**
   * Check for Password Recovery tokens in URL hash (Supabase Auth reset link)
   */
  const checkPasswordRecovery = () => {
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      if (updatePasswordModal) {
        updatePasswordModal.showModal();
      }
    }
  };

  checkPasswordRecovery();

  /**
   * If already logged in with an active staff account, redirect straight to dashboard
   */
  const checkExistingSession = async () => {
    // 1. Check local demo session
    try {
      const demoSessionStr = sessionStorage.getItem('hms_staff_session');
      if (demoSessionStr) {
        const demoSession = JSON.parse(demoSessionStr);
        if (demoSession && demoSession.profile && demoSession.profile.is_active) {
          window.location.replace('index.html');
          return;
        }
      }
    } catch (e) { }

    // 2. Check Supabase session
    const supabase = window.HMS_SUPABASE ? window.HMS_SUPABASE.getClient() : null;
    if (!supabase) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && session.user) {
        const profile = await window.HMS_AUTH.fetchStaffProfile(supabase, session.user.id);
        if (profile && profile.is_active) {
          window.location.replace('index.html');
        }
      }
    } catch (e) {
      // Ignored
    }
  };

  await checkExistingSession();

  /**
   * Demo Credentials Quick-Fill Buttons
   */
  document.querySelectorAll('.btn-demo-fill').forEach((btn) => {
    btn.addEventListener('click', () => {
      emailInput.value = btn.getAttribute('data-email') || '';
      passwordInput.value = btn.getAttribute('data-password') || '';
      clearFieldError('loginEmail');
      clearFieldError('loginPassword');
      hideBanner();
    });
  });

  /**
   * Staff Sign In Submission Handler
   */
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideBanner();

      const email = emailInput.value.trim();
      const password = passwordInput.value;

      let hasError = false;

      if (!email) {
        setFieldError('loginEmail', 'Please enter your staff email.');
        hasError = true;
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        setFieldError('loginEmail', 'Please enter a valid email address.');
        hasError = true;
      }

      if (!password) {
        setFieldError('loginPassword', 'Please enter your password.');
        hasError = true;
      }

      if (hasError) return;

      // Check if credentials match one of the predefined demo staff accounts
      const matchingDemo = window.HMS_AUTH && Array.isArray(window.HMS_AUTH.DEMO_ACCOUNTS)
        ? window.HMS_AUTH.DEMO_ACCOUNTS.find(
          (acc) => acc.email.toLowerCase() === email.toLowerCase() && acc.password === password
        )
        : null;

      const supabase = window.HMS_SUPABASE ? window.HMS_SUPABASE.getClient() : null;

      // If credentials match a demo staff account, allow immediate entry
      if (matchingDemo) {
        sessionStorage.setItem('hms_staff_session', JSON.stringify({
          user: { id: 'demo-' + matchingDemo.role, email: matchingDemo.email },
          profile: matchingDemo
        }));
        showToast(`Signed in as ${matchingDemo.full_name} (${matchingDemo.role})! Redirecting...`, 'success');
        setTimeout(() => {
          window.location.replace('index.html');
        }, 300);
        return;
      }

      if (!supabase) {
        showBanner('Supabase is not configured yet. Please use one of the Demo Accounts above or click "Database Connection Settings" below.', 'warning');
        return;
      }

      // Start loading state
      signInBtn.disabled = true;
      const originalText = signInBtn.querySelector('.btn-text').textContent;
      signInBtn.querySelector('.btn-text').textContent = 'Signing in...';
      if (signInSpinner) signInSpinner.style.display = 'inline-block';

      try {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (authError) {
          console.error('Sign in error:', authError.message);
          if (authError.message.toLowerCase().includes('invalid login credentials')) {
            showBanner('Invalid email or password. Please verify your credentials.', 'error');
          } else {
            showBanner(authError.message || 'Authentication failed. Please try again.', 'error');
          }
          return;
        }

        if (!authData || !authData.user) {
          showBanner('Sign in response incomplete. Please try again.', 'error');
          return;
        }

        // Fetch and verify staff role
        const profile = await window.HMS_AUTH.fetchStaffProfile(supabase, authData.user.id);

        if (!profile) {
          await supabase.auth.signOut();
          showBanner('Access denied: No staff profile found for this account. Contact your administrator.', 'error');
          return;
        }

        if (!profile.is_active) {
          await supabase.auth.signOut();
          showBanner('Access denied: Your hospital staff account has been deactivated.', 'error');
          return;
        }

        showToast('Signed in successfully! Redirecting...', 'success');
        setTimeout(() => {
          window.location.replace('index.html');
        }, 300);
      } catch (err) {
        console.error('Sign in exception:', err);
        showBanner('A network error occurred while connecting to the authentication server.', 'error');
      } finally {
        signInBtn.disabled = false;
        signInBtn.querySelector('.btn-text').textContent = originalText;
        if (signInSpinner) signInSpinner.style.display = 'none';
      }
    });
  }

  /**
   * Forgot Password Flow
   */
  if (forgotPasswordBtn && forgotPasswordModal) {
    forgotPasswordBtn.addEventListener('click', () => {
      if (resetEmailInput) {
        resetEmailInput.value = emailInput.value.trim();
        clearFieldError('resetEmail');
      }
      forgotPasswordModal.showModal();
    });
  }

  if (cancelResetBtn && forgotPasswordModal) {
    cancelResetBtn.addEventListener('click', () => {
      forgotPasswordModal.close();
    });
  }

  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = resetEmailInput.value.trim();

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        setFieldError('resetEmail', 'Please enter a valid staff email address.');
        return;
      }

      const supabase = window.HMS_SUPABASE ? window.HMS_SUPABASE.getClient() : null;
      if (!supabase) {
        showToast('Database connection is not configured.', 'error');
        return;
      }

      sendResetBtn.disabled = true;
      sendResetBtn.textContent = 'Sending...';

      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}${window.location.pathname}`
        });

        if (error) {
          setFieldError('resetEmail', error.message || 'Could not send reset email.');
        } else {
          forgotPasswordModal.close();
          showToast('Password reset link sent! Check your email inbox.', 'success');
        }
      } catch (err) {
        setFieldError('resetEmail', 'Failed to send password reset request.');
      } finally {
        sendResetBtn.disabled = false;
        sendResetBtn.textContent = 'Send Reset Link';
      }
    });
  }

  /**
   * Update Password Submission (via Recovery Link)
   */
  if (updatePasswordForm) {
    updatePasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newPassword = newPasswordInput.value;
      const confirmPassword = confirmNewPasswordInput.value;

      clearFieldError('newPassword');
      clearFieldError('confirmNewPassword');

      if (!newPassword || newPassword.length < 6) {
        setFieldError('newPassword', 'Password must be at least 6 characters.');
        return;
      }

      if (newPassword !== confirmPassword) {
        setFieldError('confirmNewPassword', 'Passwords do not match.');
        return;
      }

      const supabase = window.HMS_SUPABASE ? window.HMS_SUPABASE.getClient() : null;
      if (!supabase) return;

      const saveBtn = document.getElementById('saveNewPasswordBtn');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Updating...';

      try {
        const { error } = await supabase.auth.updateUser({
          password: newPassword
        });

        if (error) {
          setFieldError('newPassword', error.message || 'Failed to update password.');
        } else {
          updatePasswordModal.close();
          showToast('Password updated successfully! Please sign in with your new password.', 'success');
          // Clear URL hash
          window.location.hash = '';
        }
      } catch (err) {
        setFieldError('newPassword', 'Exception while updating password.');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Update Password';
      }
    });
  }

  /**
   * Supabase Connection Settings Modal
   */
  if (configSupabaseBtn && supabaseConfigModal) {
    configSupabaseBtn.addEventListener('click', () => {
      const { url, anonKey, isConfigured } = window.HMS_SUPABASE.getCredentials();
      if (configUrlInput) configUrlInput.value = isConfigured ? url : '';
      if (configAnonKeyInput) configAnonKeyInput.value = isConfigured ? anonKey : '';
      supabaseConfigModal.showModal();
    });
  }

  if (closeConfigBtn && supabaseConfigModal) {
    closeConfigBtn.addEventListener('click', () => {
      supabaseConfigModal.close();
    });
  }

  if (supabaseConfigForm) {
    supabaseConfigForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const url = configUrlInput.value.trim();
      const anonKey = configAnonKeyInput.value.trim();

      if (!url || !url.startsWith('https://')) {
        alert('Please enter a valid HTTPS Supabase project URL.');
        return;
      }

      if (!anonKey) {
        alert('Please enter your Supabase anon/publishable key.');
        return;
      }

      const ok = window.HMS_SUPABASE.saveCredentials(url, anonKey);
      if (ok) {
        supabaseConfigModal.close();
        showToast('Supabase credentials saved successfully!', 'success');
        hideBanner();
        // Reload to initialize client with fresh credentials
        setTimeout(() => window.location.reload(), 400);
      } else {
        alert('Failed to save credentials in local storage.');
      }
    });
  }
});

