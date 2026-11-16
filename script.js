/**
 * Patient Management System - script.js
 * Comprehensive Patient Registration & Directory Module
 * -----------------------------------------------------------------------------
 * Stack: HTML5, CSS3, Vanilla JavaScript (Strict: No external libraries/frameworks)
 * Demo data stored locally in browser localStorage only.
 * Safe DOM creation: zero raw innerHTML injection of patient data.
 */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  /* ===========================================================================
     1. CONSTANTS & CONFIGURATION
     =========================================================================== */
  const STORAGE_KEYS = {
    patients: 'hms_demo_patients',
    counter: 'hms_demo_patient_counter'
  };

  const MAX_TEXTAREA_LENGTH = 500;
  const COUNTER_ALERT_THRESHOLD = 450;
  const DESKTOP_MEDIA_QUERY = '(min-width: 1025px)';

  /* ===========================================================================
     2. DOM ELEMENTS CACHE
     =========================================================================== */
  const DOM = {
    body: document.body,
    sidebar: document.getElementById('sidebar'),
    sidebarToggle: document.getElementById('sidebarToggle'),
    overlay: document.getElementById('overlay'),
    // Navigation items
    navItemRegistration: document.getElementById('navItemRegistration'),
    navItemPatientList: document.getElementById('navItemPatientList'),
    navRegistration: document.getElementById('navRegistration'),
    navPatientList: document.getElementById('navPatientList'),
    breadcrumbCurrent: document.getElementById('breadcrumbCurrent'),
    pageTitle: document.getElementById('pageTitle'),
    pageSubtitle: document.getElementById('pageSubtitle'),
    pageHeaderActions: document.getElementById('pageHeaderActions'),
    // Views
    registrationView: document.getElementById('registrationView'),
    patientListView: document.getElementById('patientListView'),
    // Form elements
    patientForm: document.getElementById('patientForm'),
    submitBtn: document.getElementById('submitBtn'),
    resetBtn: document.getElementById('resetBtn'),
    cancelBtn: document.getElementById('cancelBtn'),
    dobInput: document.getElementById('dob'),
    firstNameInput: document.getElementById('firstName'),
    formStatusSummary: document.getElementById('formStatusSummary'),
    toastContainer: document.getElementById('toastContainer'),
    // Directory controls
    seedPatientsBtn: document.getElementById('seedPatientsBtn'),
    exportCsvBtn: document.getElementById('exportCsvBtn'),
    newPatientBtn: document.getElementById('newPatientBtn'),
    patientSearchInput: document.getElementById('patientSearchInput'),
    filterGender: document.getElementById('filterGender'),
    filterBloodGroup: document.getElementById('filterBloodGroup'),
    patientTableWrapper: document.getElementById('patientTableWrapper'),
    patientTableBody: document.getElementById('patientTableBody'),
    patientTableCount: document.getElementById('patientTableCount'),
    clearFiltersBtn: document.getElementById('clearFiltersBtn'),
    patientEmptyState: document.getElementById('patientEmptyState'),
    emptyRegisterBtn: document.getElementById('emptyRegisterBtn'),
    emptySeedBtn: document.getElementById('emptySeedBtn'),
    // Modals
    successModal: document.getElementById('successModal'),
    modalPatientName: document.getElementById('modalPatientName'),
    modalPatientId: document.getElementById('modalPatientId'),
    modalRegDate: document.getElementById('modalRegDate'),
    copyIdBtn: document.getElementById('copyIdBtn'),
    modalRegisterAnotherBtn: document.getElementById('modalRegisterAnotherBtn'),
    modalViewInListBtn: document.getElementById('modalViewInListBtn'),
    modalCloseBtn: document.getElementById('modalCloseBtn'),
    // Dossier Modal
    dossierModal: document.getElementById('dossierModal'),
    dossierCloseXBtn: document.getElementById('dossierCloseXBtn'),
    dossierCloseBtn: document.getElementById('dossierCloseBtn'),
    dossierPrintBtn: document.getElementById('dossierPrintBtn'),
    // Confirm Dialog
    confirmModal: document.getElementById('confirmModal'),
    confirmModalTitle: document.getElementById('confirmModalTitle'),
    confirmModalMessage: document.getElementById('confirmModalMessage'),
    confirmModalConfirmBtn: document.getElementById('confirmModalConfirmBtn'),
    confirmModalCancelBtn: document.getElementById('confirmModalCancelBtn'),
    sidebarLogoutBtn: document.getElementById('sidebarLogoutBtn'),
    textareas: document.querySelectorAll('.form-textarea'),
    visualOnlyLinks: document.querySelectorAll('a.visual-only')
  };

  /* ===========================================================================
     3. STATE VARIABLES
     =========================================================================== */
  const desktopMediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
  let isStorageCorrupt = false;
  let isRegisterAnotherAction = false;
  let currentActiveView = 'registration'; // 'registration' | 'patient-list'

  /* ===========================================================================
     4. UTILITIES & REUSABLE VALIDATORS
     =========================================================================== */

  /**
   * Calculates age in years from YYYY-MM-DD birthdate string.
   * @param {string} dobStr
   * @returns {string}
   */
  const calculateAge = (dobStr) => {
    if (!dobStr) return '—';
    const birth = new Date(dobStr);
    if (isNaN(birth.getTime())) return '—';
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age -= 1;
    }
    return age >= 0 ? `${age} yrs` : '—';
  };

  /**
   * Formats ISO timestamp to human-friendly string.
   * @param {string} isoStr
   * @returns {string}
   */
  const formatDate = (isoStr) => {
    if (!isoStr) return '—';
    const date = new Date(isoStr);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  /**
   * Validates telephone numbers allowing digits, spaces, hyphens, parentheses, and leading +.
   * Requires between 10 and 15 digits after stripping non-numeric formatting.
   * @param {string} value
   * @returns {boolean}
   */
  const isValidPhone = (value) => {
    const trimmed = value.trim();
    if (!trimmed) return true;
    if (!/^\+?[0-9\s\-()]+$/.test(trimmed)) return false;
    const digitsOnly = trimmed.replace(/\D/g, '');
    return digitsOnly.length >= 10 && digitsOnly.length <= 15;
  };

  /**
   * Validates standard email address formats.
   * @param {string} value
   * @returns {boolean}
   */
  const isValidEmail = (value) => {
    const trimmed = value.trim();
    if (!trimmed) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed);
  };

  /**
   * Deduplicated Name/Text Validator.
   * @param {string} value
   * @param {Object} options
   * @returns {string}
   */
  const validateName = (value, options = {}) => {
    const {
      label = 'Name',
      required = false,
      allowPeriods = false,
      customFormatMessage = null
    } = options;

    const trimmed = value.trim();
    if (!trimmed) {
      return required ? `${label} is required.` : '';
    }

    const letterCount = (trimmed.match(/\p{L}/gu) || []).length;
    const regex = allowPeriods ? /^[\p{L}\s'’.-]+$/u : /^[\p{L}\s'’-]+$/u;

    if (trimmed.length > 50 || !regex.test(trimmed) || letterCount < 2) {
      return customFormatMessage || 'Enter a valid name.';
    }

    return '';
  };

  /**
   * Deduplicated Max Length Validator for Textareas.
   * @param {string} value
   * @param {number} [max=MAX_TEXTAREA_LENGTH]
   * @returns {string}
   */
  const validateMaxLength = (value, max = MAX_TEXTAREA_LENGTH) => {
    if (value.length > max) {
      return `Maximum ${max} characters allowed.`;
    }
    return '';
  };

  /**
   * Displays an inline error message and marks control invalid.
   * @param {HTMLElement} field
   * @param {string} message
   */
  const showError = (field, message) => {
    const errorEl = document.getElementById(`${field.id}-error`);
    if (errorEl) {
      errorEl.textContent = message;
    }
    field.classList.add('is-invalid');
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', `${field.id}-error`);
  };

  /**
   * Clears inline error messages and invalid attributes.
   * @param {HTMLElement} field
   */
  const clearError = (field) => {
    const errorEl = document.getElementById(`${field.id}-error`);
    if (errorEl) {
      errorEl.textContent = '';
    }
    field.classList.remove('is-invalid');
    field.removeAttribute('aria-invalid');
  };

  /**
   * Updates textarea character counter and handles warning threshold live announcement.
   * @param {HTMLTextAreaElement} textarea
   */
  const updateCharCounter = (textarea) => {
    const counter = document.getElementById(`${textarea.id}-counter`);
    if (!counter) return;

    const length = textarea.value.length;
    counter.textContent = `${length} / ${MAX_TEXTAREA_LENGTH}`;

    if (length >= COUNTER_ALERT_THRESHOLD) {
      counter.setAttribute('aria-live', 'polite');
    } else {
      counter.removeAttribute('aria-live');
    }

    if (length > MAX_TEXTAREA_LENGTH) {
      counter.classList.add('is-limit');
    } else {
      counter.classList.remove('is-limit');
    }
  };

  /* ===========================================================================
     5. VALIDATION RULES DICTIONARY
     =========================================================================== */
  const fieldValidators = {
    firstName: (value) =>
      validateName(value, {
        label: 'First name',
        required: true,
        allowPeriods: false,
        customFormatMessage: "Enter at least 2 letters (letters, spaces, - and ' only)."
      }),

    lastName: (value) =>
      validateName(value, {
        label: 'Last name',
        required: true,
        allowPeriods: false,
        customFormatMessage: "Enter at least 2 letters (letters, spaces, - and ' only)."
      }),

    dob: (value) => {
      const trimmed = value.trim();
      if (!trimmed) return 'Date of birth is required.';

      const parts = trimmed.split('-');
      if (parts.length !== 3) return 'Please enter a valid date of birth.';

      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const birthDate = new Date(y, m, d);

      if (
        isNaN(birthDate.getTime()) ||
        birthDate.getFullYear() !== y ||
        birthDate.getMonth() !== m ||
        birthDate.getDate() !== d
      ) {
        return 'Please enter a valid date of birth.';
      }

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      if (birthDate > today) {
        return 'Date of birth cannot be in the future.';
      }

      const minDate = new Date(now.getFullYear() - 120, now.getMonth(), now.getDate());
      if (birthDate < minDate) {
        return 'Please enter a valid date of birth.';
      }

      return '';
    },

    gender: (value) => {
      const trimmed = value.trim();
      if (!trimmed) return 'Please select a gender.';
      return '';
    },

    phone: (value) => {
      const trimmed = value.trim();
      if (!trimmed) return 'Phone number is required.';
      if (!isValidPhone(trimmed)) {
        return 'Enter a valid phone number (10 to 15 digits).';
      }
      return '';
    },

    email: (value) => {
      const trimmed = value.trim();
      if (!trimmed) return '';
      if (!isValidEmail(trimmed)) {
        return 'Enter a valid email address.';
      }
      return '';
    },

    city: (value) =>
      validateName(value, {
        label: 'City',
        required: false,
        allowPeriods: true,
        customFormatMessage: 'Enter a valid name.'
      }),

    country: (value) =>
      validateName(value, {
        label: 'Country',
        required: false,
        allowPeriods: true,
        customFormatMessage: 'Enter a valid name.'
      }),

    postalCode: (value) => {
      const trimmed = value.trim();
      if (!trimmed) return '';
      const alphanumeric = trimmed.replace(/[\s-]/g, '');
      if (alphanumeric.length < 3 || alphanumeric.length > 10 || !/^[A-Za-z0-9\s-]+$/.test(trimmed)) {
        return 'Enter a valid postal code.';
      }
      return '';
    },

    emergencyName: (value) =>
      validateName(value, {
        label: 'Contact person name',
        required: false,
        allowPeriods: false,
        customFormatMessage: 'Enter a valid name.'
      }),

    emergencyPhone: (value) => {
      const trimmed = value.trim();
      if (!trimmed) return '';
      if (!isValidPhone(trimmed)) {
        return 'Enter a valid phone number (10 to 15 digits).';
      }
      return '';
    },

    medicalConditions: (value) => validateMaxLength(value, MAX_TEXTAREA_LENGTH),
    allergies: (value) => validateMaxLength(value, MAX_TEXTAREA_LENGTH),
    medications: (value) => validateMaxLength(value, MAX_TEXTAREA_LENGTH),
    medicalHistory: (value) => validateMaxLength(value, MAX_TEXTAREA_LENGTH)
  };

  const validateField = (field) => {
    const key = field.name || field.id;
    const validator = fieldValidators[key];
    if (!validator) return '';

    const errorMessage = validator(field.value, field);
    if (errorMessage) {
      showError(field, errorMessage);
    } else {
      clearError(field);
    }
    return errorMessage;
  };

  const validateForm = (form) => {
    let firstInvalidField = null;
    let invalidCount = 0;

    const fields = form.querySelectorAll('input, select, textarea');
    fields.forEach((field) => {
      const key = field.name || field.id;
      if (fieldValidators[key]) {
        const error = validateField(field);
        if (error) {
          invalidCount += 1;
          if (!firstInvalidField) {
            firstInvalidField = field;
          }
        }
      }
    });

    if (DOM.formStatusSummary) {
      if (invalidCount > 0) {
        DOM.formStatusSummary.textContent = `Please fix ${invalidCount} error${invalidCount === 1 ? '' : 's'}.`;
      } else {
        DOM.formStatusSummary.textContent = '';
      }
    }

    if (firstInvalidField) {
      firstInvalidField.focus();
    }

    return invalidCount === 0;
  };

  /* ===========================================================================
     6. LOCAL STORAGE PERSISTENCE & ID GENERATION
     =========================================================================== */

  const loadPatients = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.patients);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        isStorageCorrupt = true;
        return [];
      }
      isStorageCorrupt = false;
      return parsed;
    } catch (e) {
      isStorageCorrupt = true;
      return [];
    }
  };

  const savePatient = (patientRecord) => {
    try {
      const patients = loadPatients();
      if (isStorageCorrupt) return false;
      patients.push(patientRecord);
      localStorage.setItem(STORAGE_KEYS.patients, JSON.stringify(patients));
      return true;
    } catch (e) {
      return false;
    }
  };

  const deletePatient = (patientId) => {
    try {
      const patients = loadPatients();
      if (isStorageCorrupt) return false;
      const updated = patients.filter((p) => p.id !== patientId);
      localStorage.setItem(STORAGE_KEYS.patients, JSON.stringify(updated));
      return true;
    } catch (e) {
      return false;
    }
  };

  const generatePatientId = () => {
    const year = new Date().getFullYear();
    const existingPatients = loadPatients();
    const existingIds = new Set(existingPatients.map((p) => p.id));

    let counter = 0;
    try {
      const storedCounter = localStorage.getItem(STORAGE_KEYS.counter);
      counter = storedCounter ? parseInt(storedCounter, 10) : 0;
      if (isNaN(counter)) counter = 0;
    } catch (e) {
      counter = 0;
    }

    let candidateId = '';
    while (true) {
      counter += 1;
      candidateId = `PT-${year}-${String(counter).padStart(6, '0')}`;
      if (!existingIds.has(candidateId)) {
        break;
      }
    }

    return { id: candidateId, nextCounter: counter };
  };

  /* ===========================================================================
     7. TOAST NOTIFICATIONS & CONFIRM DIALOGS
     =========================================================================== */

  const showToast = (message, type = 'success') => {
    if (!DOM.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    if (type === 'error') {
      toast.setAttribute('role', 'alert');
    }

    const iconSpan = document.createElement('span');
    iconSpan.className = 'toast-icon';
    iconSpan.setAttribute('aria-hidden', 'true');

    if (type === 'error') {
      iconSpan.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--color-error)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      `;
    } else {
      iconSpan.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--color-success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      `;
    }

    const textSpan = document.createElement('span');
    textSpan.textContent = message;

    toast.appendChild(iconSpan);
    toast.appendChild(textSpan);
    DOM.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-fadeout');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 4000);
  };

  const showConfirm = ({ title = 'Confirm Action', message = '', confirmText = 'Confirm', cancelText = 'Cancel' }) => {
    return new Promise((resolve) => {
      const modal = DOM.confirmModal;
      if (!modal) {
        resolve(true);
        return;
      }

      if (DOM.confirmModalTitle) DOM.confirmModalTitle.textContent = title;
      if (DOM.confirmModalMessage) DOM.confirmModalMessage.textContent = message;
      if (DOM.confirmModalConfirmBtn) DOM.confirmModalConfirmBtn.textContent = confirmText;
      if (DOM.confirmModalCancelBtn) DOM.confirmModalCancelBtn.textContent = cancelText;

      const cleanup = () => {
        DOM.confirmModalConfirmBtn.removeEventListener('click', onConfirm);
        DOM.confirmModalCancelBtn.removeEventListener('click', onCancel);
        modal.removeEventListener('close', onClose);
        modal.removeEventListener('click', onBackdrop);
      };

      const onConfirm = () => {
        cleanup();
        modal.close();
        resolve(true);
      };

      const onCancel = () => {
        cleanup();
        modal.close();
        resolve(false);
      };

      const onClose = () => {
        cleanup();
        resolve(false);
      };

      const onBackdrop = (e) => {
        if (e.target === modal) {
          cleanup();
          modal.close();
          resolve(false);
        }
      };

      DOM.confirmModalConfirmBtn.addEventListener('click', onConfirm);
      DOM.confirmModalCancelBtn.addEventListener('click', onCancel);
      modal.addEventListener('close', onClose, { once: true });
      modal.addEventListener('click', onBackdrop);

      modal.showModal();
    });
  };

  // Expose reusable confirm modal to global scope (e.g., for auth logout)
  window.showConfirmDialog = showConfirm;

  /* ===========================================================================
     8. VIEW ROUTER (Registration vs Patient List)
     =========================================================================== */

  /**
   * Switches views smoothly between 'registration' and 'patient-list'.
   * Synchronizes URL hash, breadcrumb, page headings, and sidebar active indicators.
   * @param {'registration'|'patient-list'} targetView
   */
  const switchView = (targetView) => {
    currentActiveView = targetView;

    if (targetView === 'patient-list') {
      if (DOM.registrationView) DOM.registrationView.style.display = 'none';
      if (DOM.patientListView) DOM.patientListView.style.display = 'block';

      if (DOM.navItemRegistration) DOM.navItemRegistration.classList.remove('active');
      if (DOM.navItemPatientList) DOM.navItemPatientList.classList.add('active');

      if (DOM.navRegistration) DOM.navRegistration.removeAttribute('aria-current');
      if (DOM.navPatientList) DOM.navPatientList.setAttribute('aria-current', 'page');

      if (DOM.breadcrumbCurrent) DOM.breadcrumbCurrent.textContent = 'Patient List';
      if (DOM.pageTitle) DOM.pageTitle.textContent = 'Patient Directory';
      if (DOM.pageSubtitle) DOM.pageSubtitle.textContent = 'View, search, and manage registered patient records.';
      if (DOM.pageHeaderActions) DOM.pageHeaderActions.style.display = 'flex';

      window.location.hash = '#patients';
      renderPatientList();
    } else {
      if (DOM.patientListView) DOM.patientListView.style.display = 'none';
      if (DOM.registrationView) DOM.registrationView.style.display = 'block';

      if (DOM.navItemPatientList) DOM.navItemPatientList.classList.remove('active');
      if (DOM.navItemRegistration) DOM.navItemRegistration.classList.add('active');

      if (DOM.navPatientList) DOM.navPatientList.removeAttribute('aria-current');
      if (DOM.navRegistration) DOM.navRegistration.setAttribute('aria-current', 'page');

      if (DOM.breadcrumbCurrent) DOM.breadcrumbCurrent.textContent = 'Patient Registration';
      if (DOM.pageTitle) DOM.pageTitle.textContent = 'Patient Registration';
      if (DOM.pageSubtitle) {
        DOM.pageSubtitle.innerHTML = 'Fields marked with <span class="required" aria-hidden="true">*</span> are required.';
      }
      if (DOM.pageHeaderActions) DOM.pageHeaderActions.style.display = 'none';

      window.location.hash = '#register';
    }

    // Close mobile drawer if open
    setSidebarState(false);
  };

  /* ===========================================================================
     9. PATIENT DIRECTORY & TABLE RENDERING
     =========================================================================== */

  /**
   * Filters and renders registered patients into the responsive data table.
   */
  const renderPatientList = () => {
    if (!DOM.patientTableBody) return;

    const patients = loadPatients();
    const query = (DOM.patientSearchInput ? DOM.patientSearchInput.value : '').trim().toLowerCase();
    const genderFilter = DOM.filterGender ? DOM.filterGender.value : '';
    const bloodFilter = DOM.filterBloodGroup ? DOM.filterBloodGroup.value : '';

    const hasActiveFilters = Boolean(query || genderFilter || bloodFilter);
    if (DOM.clearFiltersBtn) {
      DOM.clearFiltersBtn.style.display = hasActiveFilters ? 'inline-flex' : 'none';
    }

    const filtered = patients.filter((patient) => {
      // Search matching across multiple fields
      if (query) {
        const fullName = `${patient.firstName || ''} ${patient.lastName || ''}`.toLowerCase();
        const id = (patient.id || '').toLowerCase();
        const phone = (patient.phone || '').toLowerCase();
        const city = (patient.city || '').toLowerCase();
        const email = (patient.email || '').toLowerCase();

        const matchesQuery =
          fullName.includes(query) ||
          id.includes(query) ||
          phone.includes(query) ||
          city.includes(query) ||
          email.includes(query);

        if (!matchesQuery) return false;
      }

      // Gender filter
      if (genderFilter && patient.gender !== genderFilter) {
        return false;
      }

      // Blood group filter
      if (bloodFilter && patient.bloodGroup !== bloodFilter) {
        return false;
      }

      return true;
    });

    // Sort by registration date descending (newest first)
    filtered.sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime());

    // Update table count summary
    if (DOM.patientTableCount) {
      DOM.patientTableCount.textContent = `Showing ${filtered.length} of ${patients.length} patient${patients.length === 1 ? '' : 's'}`;
    }

    // Update Bento KPI counters
    const kpiTotal = document.getElementById('kpiTotalCount');
    if (kpiTotal) {
      kpiTotal.textContent = patients.length.toLocaleString();
    }
    const dirBadge = document.getElementById('directoryTotalBadge');
    if (dirBadge) {
      dirBadge.textContent = `${patients.length} Total Patients`;
    }

    // Toggle empty state
    if (filtered.length === 0) {
      if (DOM.patientTableWrapper) DOM.patientTableWrapper.style.display = 'none';
      if (DOM.patientEmptyState) {
        DOM.patientEmptyState.style.display = 'block';
        const emptyTitle = document.getElementById('emptyStateTitle');
        const emptyDesc = document.getElementById('emptyStateDesc');
        if (patients.length === 0) {
          if (emptyTitle) emptyTitle.textContent = 'No Patients Registered Yet';
          if (emptyDesc) emptyDesc.textContent = 'Get started by registering your first patient or load sample data.';
        } else {
          if (emptyTitle) emptyTitle.textContent = 'No Matching Records';
          if (emptyDesc) emptyDesc.textContent = 'Try adjusting your search query or filters to find what you are looking for.';
        }
      }
      DOM.patientTableBody.innerHTML = '';
      return;
    }

    if (DOM.patientTableWrapper) DOM.patientTableWrapper.style.display = 'block';
    if (DOM.patientEmptyState) DOM.patientEmptyState.style.display = 'none';

    // Clear and build table rows safely
    DOM.patientTableBody.innerHTML = '';

    filtered.forEach((patient) => {
      const tr = document.createElement('tr');

      // 1. Patient ID
      const tdId = document.createElement('td');
      const badgeId = document.createElement('span');
      badgeId.className = 'badge badge-id';
      badgeId.textContent = patient.id;
      tdId.appendChild(badgeId);
      tr.appendChild(tdId);

      // 2. Full Name
      const tdName = document.createElement('td');
      const nameStrong = document.createElement('strong');
      nameStrong.textContent = `${patient.firstName} ${patient.lastName}`;
      tdName.appendChild(nameStrong);
      tr.appendChild(tdName);

      // 3. Gender / Age
      const tdGenderAge = document.createElement('td');
      if (patient.gender) {
        const badgeGender = document.createElement('span');
        badgeGender.className = 'badge badge-gender';
        badgeGender.textContent = patient.gender;
        tdGenderAge.appendChild(badgeGender);
      }
      const ageText = document.createElement('span');
      ageText.style.marginLeft = '6px';
      ageText.textContent = calculateAge(patient.dob);
      tdGenderAge.appendChild(ageText);
      tr.appendChild(tdGenderAge);

      // 4. Blood Group
      const tdBlood = document.createElement('td');
      if (patient.bloodGroup) {
        const badgeBlood = document.createElement('span');
        badgeBlood.className = 'badge badge-blood';
        badgeBlood.textContent = patient.bloodGroup;
        tdBlood.appendChild(badgeBlood);
      } else {
        tdBlood.textContent = '—';
      }
      tr.appendChild(tdBlood);

      // 5. Phone
      const tdPhone = document.createElement('td');
      tdPhone.textContent = patient.phone || '—';
      tr.appendChild(tdPhone);

      // 6. Registered Date
      const tdDate = document.createElement('td');
      tdDate.textContent = formatDate(patient.registeredAt);
      tr.appendChild(tdDate);

      // 7. Actions
      const tdActions = document.createElement('td');
      tdActions.className = 'text-right';

      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'table-actions';

      // View Dossier button
      const viewBtn = document.createElement('button');
      viewBtn.type = 'button';
      viewBtn.className = 'btn btn-secondary btn-sm';
      viewBtn.textContent = 'View';
      viewBtn.setAttribute('aria-label', `View dossier for ${patient.firstName} ${patient.lastName}`);
      viewBtn.onclick = () => showDossierModal(patient);

      // Delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn btn-text btn-sm';
      deleteBtn.style.color = 'var(--color-error)';
      deleteBtn.textContent = 'Delete';
      deleteBtn.setAttribute('aria-label', `Delete record for ${patient.firstName} ${patient.lastName}`);
      deleteBtn.onclick = async () => {
        const confirmed = await showConfirm({
          title: 'Delete Patient Record',
          message: `Are you sure you want to delete patient record for ${patient.firstName} ${patient.lastName} (${patient.id})? This action cannot be undone in this browser.`,
          confirmText: 'Delete',
          cancelText: 'Cancel'
        });
        if (confirmed) {
          const ok = deletePatient(patient.id);
          if (ok) {
            showToast(`Patient record ${patient.id} deleted.`, 'success');
            renderPatientList();
          } else {
            showToast('Could not delete record.', 'error');
          }
        }
      };

      actionsDiv.appendChild(viewBtn);
      actionsDiv.appendChild(deleteBtn);
      tdActions.appendChild(actionsDiv);
      tr.appendChild(tdActions);

      DOM.patientTableBody.appendChild(tr);
    });
  };

  /* ===========================================================================
     10. PATIENT DOSSIER MODAL (Full Record View)
     =========================================================================== */

  /**
   * Opens the comprehensive Patient Dossier modal.
   * @param {Object} patient
   */
  const showDossierModal = (patient) => {
    const modal = DOM.dossierModal;
    if (!modal) return;

    // Set text values safely
    const setSafeText = (id, val, fallback = '—') => {
      const el = document.getElementById(id);
      if (el) el.textContent = val && val.trim ? val.trim() || fallback : fallback;
    };

    setSafeText('dossierPatientId', patient.id);
    setSafeText('dossierModalTitle', `${patient.firstName} ${patient.lastName}`);
    setSafeText('dossierRegDate', new Date(patient.registeredAt).toLocaleString());

    setSafeText('dossierDob', patient.dob);
    setSafeText('dossierAge', calculateAge(patient.dob));
    setSafeText('dossierGender', patient.gender);
    setSafeText('dossierBloodGroup', patient.bloodGroup);
    setSafeText('dossierMaritalStatus', patient.maritalStatus);

    setSafeText('dossierPhone', patient.phone);
    setSafeText('dossierEmail', patient.email);
    setSafeText('dossierAddress', patient.address);
    setSafeText('dossierCity', patient.city);
    setSafeText('dossierCountry', patient.country);
    setSafeText('dossierPostalCode', patient.postalCode);

    setSafeText('dossierEmergencyName', patient.emergencyName);
    setSafeText('dossierEmergencyRel', patient.emergencyRelationship);
    setSafeText('dossierEmergencyPhone', patient.emergencyPhone);

    setSafeText('dossierConditions', patient.medicalConditions, 'None reported');
    setSafeText('dossierAllergies', patient.allergies, 'None reported');
    setSafeText('dossierMedications', patient.medications, 'None reported');
    setSafeText('dossierHistory', patient.medicalHistory, 'None reported');

    const closeModal = () => {
      if (modal.open) modal.close();
    };

    if (DOM.dossierCloseXBtn) DOM.dossierCloseXBtn.onclick = closeModal;
    if (DOM.dossierCloseBtn) DOM.dossierCloseBtn.onclick = closeModal;

    if (DOM.dossierPrintBtn) {
      DOM.dossierPrintBtn.onclick = () => {
        window.print();
      };
    }

    modal.onclick = (e) => {
      if (e.target === modal) closeModal();
    };

    modal.showModal();
  };

  /* ===========================================================================
     11. SUCCESS MODAL & REGISTRATION ACTION
     =========================================================================== */

  const showSuccessModal = (patientRecord) => {
    const modal = DOM.successModal;
    if (!modal) return;

    if (DOM.modalPatientName) {
      DOM.modalPatientName.textContent = `${patientRecord.firstName} ${patientRecord.lastName}`;
    }
    if (DOM.modalPatientId) {
      DOM.modalPatientId.textContent = patientRecord.id;
    }
    if (DOM.modalRegDate) {
      const d = new Date(patientRecord.registeredAt);
      DOM.modalRegDate.textContent = isNaN(d.getTime()) ? new Date().toLocaleString() : d.toLocaleString();
    }

    // Copy Patient ID to Clipboard
    if (DOM.copyIdBtn) {
      DOM.copyIdBtn.textContent = 'Copy ID';
      DOM.copyIdBtn.onclick = async () => {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(patientRecord.id);
          } else {
            const ta = document.createElement('textarea');
            ta.value = patientRecord.id;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
          }
          DOM.copyIdBtn.textContent = 'Copied!';
          setTimeout(() => {
            if (DOM.copyIdBtn) DOM.copyIdBtn.textContent = 'Copy ID';
          }, 2000);
        } catch (err) {
          showToast('Could not copy to clipboard.', 'error');
        }
      };
    }

    const closeModal = () => {
      if (modal.open) {
        modal.close();
      }
    };

    if (DOM.modalCloseBtn) {
      DOM.modalCloseBtn.onclick = () => {
        isRegisterAnotherAction = false;
        closeModal();
      };
    }

    if (DOM.modalRegisterAnotherBtn) {
      DOM.modalRegisterAnotherBtn.onclick = () => {
        isRegisterAnotherAction = true;
        closeModal();
        resetFormState();
        if (DOM.firstNameInput) {
          DOM.firstNameInput.focus();
        }
      };
    }

    if (DOM.modalViewInListBtn) {
      DOM.modalViewInListBtn.onclick = () => {
        isRegisterAnotherAction = false;
        closeModal();
        switchView('patient-list');
      };
    }

    modal.onclose = () => {
      if (!isRegisterAnotherAction && DOM.submitBtn && currentActiveView === 'registration') {
        DOM.submitBtn.focus();
      }
      isRegisterAnotherAction = false;
    };

    modal.onclick = (e) => {
      if (e.target === modal) {
        isRegisterAnotherAction = false;
        closeModal();
      }
    };

    modal.showModal();
  };

  /* ===========================================================================
     12. FORM STATE MANAGEMENT & DIRTY CHECKING
     =========================================================================== */

  const isFormDirty = () => {
    if (!DOM.patientForm) return false;
    const fields = DOM.patientForm.querySelectorAll('input, select, textarea');
    for (const field of fields) {
      if (field.type === 'submit' || field.type === 'button' || field.type === 'reset') continue;
      if (field.value && field.value.trim().length > 0) {
        return true;
      }
    }
    return false;
  };

  const resetFormState = () => {
    if (!DOM.patientForm) return;
    DOM.patientForm.reset();

    if (DOM.formStatusSummary) {
      DOM.formStatusSummary.textContent = '';
    }

    const fields = DOM.patientForm.querySelectorAll('input, select, textarea');
    fields.forEach((field) => {
      clearError(field);
    });

    DOM.textareas.forEach((textarea) => {
      const counter = document.getElementById(`${textarea.id}-counter`);
      if (counter) {
        counter.textContent = `0 / ${MAX_TEXTAREA_LENGTH}`;
        counter.classList.remove('is-limit');
        counter.removeAttribute('aria-live');
      }
    });
  };

  /* ===========================================================================
     13. OFF-CANVAS SIDEBAR & RESPONSIVE DRAWER
     =========================================================================== */

  const syncSidebarInert = () => {
    if (!DOM.sidebar) return;
    if (desktopMediaQuery.matches) {
      DOM.sidebar.removeAttribute('inert');
    } else {
      if (DOM.body.classList.contains('sidebar-open')) {
        DOM.sidebar.removeAttribute('inert');
      } else {
        DOM.sidebar.setAttribute('inert', '');
      }
    }
  };

  const setSidebarState = (forceState) => {
    const isCurrentlyOpen = DOM.body.classList.contains('sidebar-open');
    const shouldOpen = typeof forceState === 'boolean' ? forceState : !isCurrentlyOpen;

    DOM.body.classList.toggle('sidebar-open', shouldOpen);

    if (DOM.sidebarToggle) {
      DOM.sidebarToggle.setAttribute('aria-expanded', String(shouldOpen));
    }

    if (DOM.sidebar) {
      if (shouldOpen) {
        DOM.sidebar.removeAttribute('inert');
        const firstLink = DOM.sidebar.querySelector('a');
        if (firstLink) firstLink.focus();
      } else {
        syncSidebarInert();
        if (!desktopMediaQuery.matches && DOM.sidebarToggle) {
          DOM.sidebarToggle.focus();
        }
      }
    }
  };

  /* ===========================================================================
     14. MOCK DATA SEEDER & CSV EXPORT
     =========================================================================== */

  const samplePatients = [
    {
      id: 'PT-2026-000001',
      firstName: 'Sarah',
      lastName: 'Jenkins',
      dob: '1988-04-12',
      gender: 'Female',
      bloodGroup: 'O+',
      maritalStatus: 'Married',
      phone: '+1 555 234 5678',
      email: 'sarah.jenkins@example.com',
      address: '742 Evergreen Terrace',
      city: 'Springfield',
      country: 'United States',
      postalCode: '97477',
      emergencyName: 'Mark Jenkins',
      emergencyRelationship: 'Spouse',
      emergencyPhone: '+1 555 234 5679',
      medicalConditions: 'Mild Asthma, Seasonal Allergies',
      allergies: 'Penicillin, Tree pollen',
      medications: 'Albuterol inhaler as needed',
      medicalHistory: 'Appendectomy (2015)',
      registeredAt: new Date(Date.now() - 86400000 * 5).toISOString()
    },
    {
      id: 'PT-2026-000002',
      firstName: 'Tariq',
      lastName: 'Mahmood',
      dob: '1975-11-23',
      gender: 'Male',
      bloodGroup: 'B+',
      maritalStatus: 'Married',
      phone: '+92 300 9876543',
      email: 'tariq.m@example.com',
      address: 'House 45, Street 12, F-8/2',
      city: 'Islamabad',
      country: 'Pakistan',
      postalCode: '44000',
      emergencyName: 'Amina Tariq',
      emergencyRelationship: 'Spouse',
      emergencyPhone: '+92 300 9876540',
      medicalConditions: 'Type 2 Diabetes, Hypertension',
      allergies: 'None',
      medications: 'Metformin 500mg BID, Lisinopril 10mg daily',
      medicalHistory: 'No prior surgeries reported.',
      registeredAt: new Date(Date.now() - 86400000 * 4).toISOString()
    },
    {
      id: 'PT-2026-000003',
      firstName: 'Elena',
      lastName: 'Rostova',
      dob: '1995-08-30',
      gender: 'Female',
      bloodGroup: 'A-',
      maritalStatus: 'Single',
      phone: '+44 20 7946 0912',
      email: 'elena.rostova@example.co.uk',
      address: '14 Kensington Square',
      city: 'London',
      country: 'United Kingdom',
      postalCode: 'W8 5HP',
      emergencyName: 'Dmitri Rostov',
      emergencyRelationship: 'Parent',
      emergencyPhone: '+44 20 7946 0910',
      medicalConditions: 'Migraines with aura',
      allergies: 'Sulfa antibiotics',
      medications: 'Sumatriptan 50mg PRN',
      medicalHistory: 'Wisdom teeth extraction (2019)',
      registeredAt: new Date(Date.now() - 86400000 * 3).toISOString()
    },
    {
      id: 'PT-2026-000004',
      firstName: 'Marcus',
      lastName: 'Chen',
      dob: '1962-02-14',
      gender: 'Male',
      bloodGroup: 'AB+',
      maritalStatus: 'Married',
      phone: '+65 6789 0123',
      email: 'm.chen@example.com.sg',
      address: 'Block 204, Bedok North Street 1',
      city: 'Singapore',
      country: 'Singapore',
      postalCode: '460204',
      emergencyName: 'Grace Chen',
      emergencyRelationship: 'Spouse',
      emergencyPhone: '+65 6789 0124',
      medicalConditions: 'Hyperlipidemia, Osteoarthritis',
      allergies: 'Latex',
      medications: 'Atorvastatin 20mg nightly, Glucosamine',
      medicalHistory: 'Right knee arthroscopy (2021)',
      registeredAt: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
      id: 'PT-2026-000005',
      firstName: 'Priya',
      lastName: 'Patel',
      dob: '2001-06-19',
      gender: 'Female',
      bloodGroup: 'O-',
      maritalStatus: 'Single',
      phone: '+91 98200 12345',
      email: 'priya.patel@example.com',
      address: 'Flat 12B, Ocean Crest Apartments',
      city: 'Mumbai',
      country: 'India',
      postalCode: '400050',
      emergencyName: 'Rajesh Patel',
      emergencyRelationship: 'Parent',
      emergencyPhone: '+91 98200 12340',
      medicalConditions: 'None',
      allergies: 'Peanuts',
      medications: 'None',
      medicalHistory: 'None',
      registeredAt: new Date(Date.now() - 86400000 * 1).toISOString()
    }
  ];

  /**
   * Seeds realistic demo patients into localStorage.
   */
  const seedDemoPatients = () => {
    try {
      const existing = loadPatients();
      const existingIds = new Set(existing.map((p) => p.id));
      const newItems = samplePatients.filter((p) => !existingIds.has(p.id));

      if (newItems.length === 0) {
        showToast('Sample patients are already loaded in this browser.', 'success');
        return;
      }

      const merged = [...existing, ...newItems];
      localStorage.setItem(STORAGE_KEYS.patients, JSON.stringify(merged));

      // Update counter to at least 5
      const currentCounter = parseInt(localStorage.getItem(STORAGE_KEYS.counter) || '0', 10);
      if (currentCounter < 5) {
        localStorage.setItem(STORAGE_KEYS.counter, '5');
      }

      showToast(`Loaded ${newItems.length} demo patient records.`, 'success');
      renderPatientList();
    } catch (e) {
      showToast('Could not seed demo records in this browser.', 'error');
    }
  };

  /**
   * Exports all stored patient records to a formatted CSV file.
   */
  const exportPatientsToCsv = () => {
    const patients = loadPatients();
    if (patients.length === 0) {
      showToast('No patient records available to export.', 'error');
      return;
    }

    const headers = [
      'Patient ID',
      'First Name',
      'Last Name',
      'Date of Birth',
      'Gender',
      'Blood Group',
      'Marital Status',
      'Phone',
      'Email',
      'Street Address',
      'City',
      'Country',
      'Postal Code',
      'Emergency Name',
      'Emergency Relationship',
      'Emergency Phone',
      'Registered At'
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = patients.map((p) => [
      escapeCsv(p.id),
      escapeCsv(p.firstName),
      escapeCsv(p.lastName),
      escapeCsv(p.dob),
      escapeCsv(p.gender),
      escapeCsv(p.bloodGroup),
      escapeCsv(p.maritalStatus),
      escapeCsv(p.phone),
      escapeCsv(p.email),
      escapeCsv(p.address),
      escapeCsv(p.city),
      escapeCsv(p.country),
      escapeCsv(p.postalCode),
      escapeCsv(p.emergencyName),
      escapeCsv(p.emergencyRelationship),
      escapeCsv(p.emergencyPhone),
      escapeCsv(p.registeredAt)
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const dateStr = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.setAttribute('download', `medicare-patients-${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Exported ${patients.length} patient records to CSV.`, 'success');
  };

  /* ===========================================================================
     15. EVENT LISTENERS WIRING
     =========================================================================== */

  // View Switching Navigation Events
  if (DOM.navRegistration) {
    DOM.navRegistration.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('registration');
    });
  }

  if (DOM.navPatientList) {
    DOM.navPatientList.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('patient-list');
    });
  }

  if (DOM.newPatientBtn) {
    DOM.newPatientBtn.addEventListener('click', () => switchView('registration'));
  }

  // Topbar + Create Button
  const topbarCreateBtn = document.getElementById('topbarCreateBtn');
  if (topbarCreateBtn) {
    topbarCreateBtn.addEventListener('click', () => switchView('registration'));
  }

  // Topbar Global Search Input
  const topbarSearchInput = document.getElementById('topbarSearchInput');
  if (topbarSearchInput) {
    topbarSearchInput.addEventListener('input', (e) => {
      if (currentActiveView !== 'patient-list') {
        switchView('patient-list');
      }
      if (DOM.patientSearchInput) {
        DOM.patientSearchInput.value = e.target.value;
        renderPatientList();
      }
    });
  }

  // Keyboard shortcut Ctrl+F / Cmd+F to focus search
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
      const activeSearch = document.getElementById('topbarSearchInput') || DOM.patientSearchInput;
      if (activeSearch && document.activeElement !== activeSearch) {
        e.preventDefault();
        activeSearch.focus();
      }
    }
  });

  if (DOM.emptyRegisterBtn) {
    DOM.emptyRegisterBtn.addEventListener('click', () => switchView('registration'));
  }

  // Seed buttons
  if (DOM.seedPatientsBtn) {
    DOM.seedPatientsBtn.addEventListener('click', seedDemoPatients);
  }

  if (DOM.emptySeedBtn) {
    DOM.emptySeedBtn.addEventListener('click', seedDemoPatients);
  }

  // Export CSV
  if (DOM.exportCsvBtn) {
    DOM.exportCsvBtn.addEventListener('click', exportPatientsToCsv);
  }

  // Live Search & Filters
  if (DOM.patientSearchInput) {
    DOM.patientSearchInput.addEventListener('input', () => renderPatientList());
  }

  if (DOM.filterGender) {
    DOM.filterGender.addEventListener('change', () => renderPatientList());
  }

  if (DOM.filterBloodGroup) {
    DOM.filterBloodGroup.addEventListener('change', () => renderPatientList());
  }

  if (DOM.clearFiltersBtn) {
    DOM.clearFiltersBtn.addEventListener('click', () => {
      if (DOM.patientSearchInput) DOM.patientSearchInput.value = '';
      if (DOM.filterGender) DOM.filterGender.value = '';
      if (DOM.filterBloodGroup) DOM.filterBloodGroup.value = '';
      renderPatientList();
    });
  }

  // Sidebar toggle button & backdrop
  if (DOM.sidebarToggle) {
    DOM.sidebarToggle.addEventListener('click', () => setSidebarState());
  }

  if (DOM.overlay) {
    DOM.overlay.addEventListener('click', () => setSidebarState(false));
  }

  // Keyboard navigation & drawer focus trap
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && DOM.body.classList.contains('sidebar-open')) {
      setSidebarState(false);
    }
  });

  if (DOM.sidebar) {
    DOM.sidebar.addEventListener('keydown', (e) => {
      if (!DOM.body.classList.contains('sidebar-open') || desktopMediaQuery.matches) return;
      if (e.key !== 'Tab') return;

      const focusables = Array.from(DOM.sidebar.querySelectorAll('a[href], button:not([disabled])'));
      if (focusables.length === 0) return;

      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    });
  }

  // Viewport breakpoint listener
  const handleBreakpointChange = (e) => {
    if (e.matches) {
      DOM.body.classList.remove('sidebar-open');
      if (DOM.sidebarToggle) DOM.sidebarToggle.setAttribute('aria-expanded', 'false');
      syncSidebarInert();
    } else {
      syncSidebarInert();
    }
  };

  if (desktopMediaQuery.addEventListener) {
    desktopMediaQuery.addEventListener('change', handleBreakpointChange);
  } else {
    desktopMediaQuery.addListener(handleBreakpointChange);
  }

  // Visual only links
  DOM.visualOnlyLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
    });
  });

  // Sidebar Logout Button (Phase 2 Auth)
  if (DOM.sidebarLogoutBtn) {
    DOM.sidebarLogoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.HMS_AUTH && typeof window.HMS_AUTH.handleLogout === 'function') {
        window.HMS_AUTH.handleLogout();
      } else {
        window.location.replace('login.html?logged_out=true');
      }
    });
  }

  // Textarea input and live counter events
  DOM.textareas.forEach((textarea) => {
    updateCharCounter(textarea);
    textarea.addEventListener('input', () => {
      updateCharCounter(textarea);
      if (textarea.classList.contains('is-invalid')) {
        validateField(textarea);
      }
    });
  });

  // Form field live blur and progressive validation
  if (DOM.patientForm) {
    const monitoredFields = DOM.patientForm.querySelectorAll('input, select, textarea');

    monitoredFields.forEach((field) => {
      const key = field.name || field.id;
      if (!fieldValidators[key]) return;

      field.addEventListener('blur', () => {
        validateField(field);
      });

      field.addEventListener('input', () => {
        if (field.classList.contains('is-invalid')) {
          validateField(field);
        }
      });

      if (field.tagName === 'SELECT') {
        field.addEventListener('change', () => {
          if (field.classList.contains('is-invalid')) {
            validateField(field);
          }
        });
      }
    });

    // Form submission flow
    DOM.patientForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const isValid = validateForm(DOM.patientForm);
      if (!isValid) return;

      const submitBtn = DOM.submitBtn;
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Registering...';

      // Subtle async feedback delay (~600ms)
      await new Promise((resolve) => setTimeout(resolve, 600));

      try {
        const formData = new FormData(DOM.patientForm);
        const data = {};
        for (const [key, val] of formData.entries()) {
          data[key] = typeof val === 'string' ? val.trim() : val;
        }

        const { id: patientId, nextCounter } = generatePatientId();
        const patientRecord = {
          id: patientId,
          registeredAt: new Date().toISOString(),
          ...data
        };

        const isSaved = savePatient(patientRecord);
        if (!isSaved) {
          showToast('Could not save the record in this browser.', 'error');
          return;
        }

        // Commit counter only after savePatient succeeds
        try {
          localStorage.setItem(STORAGE_KEYS.counter, String(nextCounter));
        } catch (counterErr) {
          // Local storage quota fallback
        }

        showToast(`Patient registered: ${patientId}`, 'success');
        showSuccessModal(patientRecord);
        resetFormState();
      } catch (err) {
        showToast('Could not save the record in this browser.', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });

    // Reset Form button with custom confirmation dialog
    if (DOM.resetBtn) {
      DOM.resetBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (isFormDirty()) {
          const confirmed = await showConfirm({
            title: 'Reset Form',
            message: 'Reset form? All entered information will be cleared.',
            confirmText: 'Reset',
            cancelText: 'Keep Editing'
          });
          if (confirmed) {
            resetFormState();
          }
        } else {
          resetFormState();
        }
      });
    }

    // Cancel button with custom confirmation dialog
    if (DOM.cancelBtn) {
      DOM.cancelBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (isFormDirty()) {
          const confirmed = await showConfirm({
            title: 'Discard Changes',
            message: 'Discard changes? All entered information will be lost.',
            confirmText: 'Discard',
            cancelText: 'Keep Editing'
          });
          if (confirmed) {
            resetFormState();
          }
        } else {
          resetFormState();
        }
      });
    }
  }

  /* ===========================================================================
     16. INITIALIZATION & HASH ROUTING
     =========================================================================== */
  // Date of Birth Max Constraint (Local Date: YYYY-MM-DD)
  if (DOM.dobInput) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    DOM.dobInput.max = `${year}-${month}-${day}`;
  }

  // Initial drawer inert state check
  syncSidebarInert();

  // Phase 2: Supabase Staff Authentication Guard
  if (window.HMS_AUTH && typeof window.HMS_AUTH.requireAuth === 'function') {
    window.HMS_AUTH.requireAuth();
  }

  // Hash route initialization
  const initialHash = window.location.hash.toLowerCase();
  if (initialHash === '#patients' || initialHash === '#list') {
    switchView('patient-list');
  } else {
    switchView('registration');
  }

  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.toLowerCase();
    if (hash === '#patients' || hash === '#list') {
      if (currentActiveView !== 'patient-list') switchView('patient-list');
    } else {
      if (currentActiveView !== 'registration') switchView('registration');
    }
  });
});
