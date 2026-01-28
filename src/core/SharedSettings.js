/**
 * SharedSettings - Centralized settings management with localStorage persistence
 * All tools share the same settings instance
 */

const STORAGE_KEY = 'vocal-trainer-settings';
const DEFAULT_SETTINGS = {
  // Musical settings
  rootNote: 'D',
  scaleType: 'major',
  direction: 'up',
  droneEnabled: true,

  // Pitch range for vocal monitor (MIDI note numbers)
  pitchRangeMin: 36, // C2
  pitchRangeMax: 84, // C6

  // UI preferences
  lastTool: null,

  // First-time user flags
  onboardingSeen: false,
};

export class SharedSettings {
  constructor() {
    this.settings = { ...DEFAULT_SETTINGS };
    this.listeners = new Set();
    this.load();
  }

  /**
   * Load settings from localStorage
   */
  load() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.settings = { ...DEFAULT_SETTINGS, ...parsed };
      }

      // Migrate from old flappynote-settings if exists
      this.migrateOldSettings();
    } catch (error) {
      console.warn('Failed to load settings:', error);
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  /**
   * Migrate settings from old flappynote format
   */
  migrateOldSettings() {
    try {
      const oldSettings = localStorage.getItem('flappynote-settings');
      if (oldSettings) {
        const parsed = JSON.parse(oldSettings);
        if (parsed.rootNote) this.settings.rootNote = parsed.rootNote;
        if (parsed.scaleType) this.settings.scaleType = parsed.scaleType;
        if (parsed.direction) this.settings.direction = parsed.direction;
        if (parsed.droneEnabled !== undefined) this.settings.droneEnabled = parsed.droneEnabled;
        // Don't delete old settings to maintain backward compatibility
        this.save();
      }

      // Check onboarding flag
      const onboardingSeen = localStorage.getItem('flappynote-onboarding-seen');
      if (onboardingSeen === 'true') {
        this.settings.onboardingSeen = true;
        this.save();
      }
    } catch (error) {
      // Ignore migration errors
    }
  }

  /**
   * Save settings to localStorage
   */
  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      // Also save to old format for backward compatibility
      localStorage.setItem('flappynote-settings', JSON.stringify({
        rootNote: this.settings.rootNote,
        scaleType: this.settings.scaleType,
        direction: this.settings.direction,
        droneEnabled: this.settings.droneEnabled,
      }));
    } catch (error) {
      console.warn('Failed to save settings:', error);
    }
  }

  /**
   * Get a setting value
   * @param {string} key - Setting key
   * @returns {*} Setting value
   */
  get(key) {
    return this.settings[key];
  }

  /**
   * Set a setting value
   * @param {string} key - Setting key
   * @param {*} value - Setting value
   */
  set(key, value) {
    const oldValue = this.settings[key];
    if (oldValue === value) return;

    this.settings[key] = value;
    this.save();
    this.notifyListeners(key, value, oldValue);
  }

  /**
   * Set multiple settings at once
   * @param {object} updates - Key-value pairs to update
   */
  setMultiple(updates) {
    const changes = [];
    for (const [key, value] of Object.entries(updates)) {
      const oldValue = this.settings[key];
      if (oldValue !== value) {
        this.settings[key] = value;
        changes.push({ key, value, oldValue });
      }
    }

    if (changes.length > 0) {
      this.save();
      changes.forEach(({ key, value, oldValue }) => {
        this.notifyListeners(key, value, oldValue);
      });
    }
  }

  /**
   * Get all settings
   * @returns {object}
   */
  getAll() {
    return { ...this.settings };
  }

  /**
   * Get root note with octave for ScaleManager
   * @returns {string} e.g., "D3" or "D#3"
   */
  getRootNoteWithOctave() {
    const rootNote = this.settings.rootNote;
    // Check if already has octave (ends with digit)
    if (/\d$/.test(rootNote)) {
      return rootNote;
    }
    // Add default octave 3
    return `${rootNote}3`;
  }

  /**
   * Subscribe to settings changes
   * @param {function} callback - Called with (key, newValue, oldValue)
   * @returns {function} Unsubscribe function
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify listeners of a setting change
   * @param {string} key
   * @param {*} newValue
   * @param {*} oldValue
   */
  notifyListeners(key, newValue, oldValue) {
    this.listeners.forEach(callback => {
      try {
        callback(key, newValue, oldValue);
      } catch (error) {
        console.error('Settings listener error:', error);
      }
    });
  }

  /**
   * Reset all settings to defaults
   */
  reset() {
    this.settings = { ...DEFAULT_SETTINGS };
    this.save();
    // Notify all listeners
    for (const [key, value] of Object.entries(this.settings)) {
      this.notifyListeners(key, value, undefined);
    }
  }
}
