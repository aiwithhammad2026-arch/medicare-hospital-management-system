/**
 * MediCare Hospital Management System - Supabase Client Configuration
 * =============================================================================
 * Configures the official Supabase JavaScript Client.
 * Uses ONLY the public Project URL and Anon/Publishable Key.
 * NEVER expose the service_role key in frontend code.
 * =============================================================================
 */

(function () {
  'use strict';

  // Default configuration placeholders.
  // Replace these with your actual Supabase project credentials,
  // or enter them via the interactive setup modal in the browser.
  const DEFAULT_SUPABASE_URL = 'https://your-project-id.supabase.co';
  const DEFAULT_SUPABASE_ANON_KEY = 'your-anon-publishable-key-here';

  // Storage key for credentials entered via the in-browser setup modal
  const STORAGE_KEYS = {
    url: 'hms_supabase_url',
    anonKey: 'hms_supabase_anon_key'
  };

  /**
   * Retrieves the current Supabase configuration.
   * Priority: Local Storage (manual setup) -> Global window.ENV -> Defaults
   * @returns {{ url: string, anonKey: string, isConfigured: boolean }}
   */
  function getCredentials() {
    let savedUrl = '';
    let savedAnonKey = '';

    try {
      savedUrl = localStorage.getItem(STORAGE_KEYS.url) || '';
      savedAnonKey = localStorage.getItem(STORAGE_KEYS.anonKey) || '';
    } catch (e) {
      // localStorage may fail in restricted sandbox or private mode
    }

    const url = savedUrl || (window.ENV && window.ENV.SUPABASE_URL) || DEFAULT_SUPABASE_URL;
    const anonKey = savedAnonKey || (window.ENV && window.ENV.SUPABASE_ANON_KEY) || DEFAULT_SUPABASE_ANON_KEY;

    const isConfigured =
      Boolean(url) &&
      Boolean(anonKey) &&
      url !== DEFAULT_SUPABASE_URL &&
      anonKey !== DEFAULT_SUPABASE_ANON_KEY &&
      url.startsWith('https://');

    return { url, anonKey, isConfigured };
  }

  /**
   * Saves updated credentials to localStorage.
   * @param {string} url
   * @param {string} anonKey
   */
  function saveCredentials(url, anonKey) {
    try {
      localStorage.setItem(STORAGE_KEYS.url, url.trim());
      localStorage.setItem(STORAGE_KEYS.anonKey, anonKey.trim());
      return true;
    } catch (e) {
      console.error('Failed to save Supabase credentials:', e);
      return false;
    }
  }

  /**
   * Clears saved Supabase credentials.
   */
  function clearCredentials() {
    try {
      localStorage.removeItem(STORAGE_KEYS.url);
      localStorage.removeItem(STORAGE_KEYS.anonKey);
    } catch (e) {
      // Ignored
    }
  }

  let clientInstance = null;

  /**
   * Initializes and returns the singleton Supabase client instance.
   * @returns {Object|null}
   */
  function getClient() {
    if (clientInstance) return clientInstance;

    const { url, anonKey, isConfigured } = getCredentials();

    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      console.error('Supabase JS library not loaded. Ensure the CDN script is included.');
      return null;
    }

    if (!isConfigured) {
      return null;
    }

    try {
      clientInstance = window.supabase.createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.localStorage
        }
      });
      return clientInstance;
    } catch (err) {
      console.error('Error initializing Supabase client:', err);
      return null;
    }
  }

  // Export to global namespace
  window.HMS_SUPABASE = {
    getClient,
    getCredentials,
    saveCredentials,
    clearCredentials
  };
})();

