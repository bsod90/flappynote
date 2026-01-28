/**
 * ToolBase - Abstract base class for all vocal training tools
 * Provides common interface and shared functionality
 */

export class ToolBase {
  constructor(name, description) {
    if (new.target === ToolBase) {
      throw new Error('ToolBase is abstract and cannot be instantiated directly');
    }

    this.name = name;
    this.description = description;

    // Shared systems (set by ToolSelector)
    this.pitchContext = null;
    this.scaleManager = null;
    this.droneManager = null;
    this.settings = null;

    // State
    this.isInitialized = false;
    this.isActive = false;

    // Subscriptions
    this._pitchUnsubscribe = null;
    this._settingsUnsubscribe = null;

    // Navigation callback
    this.onNavigateBack = null;
  }

  // ==========================================
  // Connection methods (called by ToolSelector)
  // ==========================================

  /**
   * Connect to shared pitch context
   * @param {PitchContext} context
   */
  connectPitchContext(context) {
    this.pitchContext = context;
  }

  /**
   * Connect to shared scale manager
   * @param {ScaleManager} manager
   */
  connectScaleManager(manager) {
    this.scaleManager = manager;
  }

  /**
   * Connect to shared drone manager
   * @param {DroneManager} manager
   */
  connectDroneManager(manager) {
    this.droneManager = manager;
  }

  /**
   * Connect to shared settings
   * @param {SharedSettings} settings
   */
  connectSettings(settings) {
    this.settings = settings;
  }

  // ==========================================
  // Lifecycle methods (override in subclass)
  // ==========================================

  /**
   * Initialize the tool (called once before first use)
   * Override in subclass for setup that only needs to happen once
   * @returns {Promise<void>}
   */
  async initialize() {
    this.isInitialized = true;
  }

  /**
   * Start the tool (called when tool becomes active)
   * Subscribe to pitch updates and start any tool-specific logic
   * @returns {Promise<void>}
   */
  async start() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    this.isActive = true;

    // Subscribe to pitch updates
    if (this.pitchContext) {
      this._pitchUnsubscribe = this.pitchContext.subscribe(
        (pitchData) => this.onPitchDetected(pitchData)
      );
    }

    // Subscribe to settings changes
    if (this.settings) {
      this._settingsUnsubscribe = this.settings.subscribe(
        (key, newValue, oldValue) => this.onSettingsChanged(key, newValue, oldValue)
      );
    }
  }

  /**
   * Stop the tool (called when tool becomes inactive)
   * Unsubscribe from updates and pause any tool-specific logic
   */
  stop() {
    this.isActive = false;

    // Unsubscribe from pitch updates
    if (this._pitchUnsubscribe) {
      this._pitchUnsubscribe();
      this._pitchUnsubscribe = null;
    }

    // Unsubscribe from settings changes
    if (this._settingsUnsubscribe) {
      this._settingsUnsubscribe();
      this._settingsUnsubscribe = null;
    }
  }

  /**
   * Dispose of the tool (called when tool is completely removed)
   * Clean up all resources
   */
  dispose() {
    this.stop();
    this.isInitialized = false;
  }

  // ==========================================
  // Event handlers (override in subclass)
  // ==========================================

  /**
   * Called when pitch is detected
   * Override in subclass to handle pitch updates
   * @param {object|null} pitchData - Pitch data from detector
   */
  onPitchDetected(pitchData) {
    // Override in subclass
  }

  /**
   * Called when settings change
   * Override in subclass to react to setting changes
   * @param {string} key - Setting key that changed
   * @param {*} newValue - New value
   * @param {*} oldValue - Previous value
   */
  onSettingsChanged(key, newValue, oldValue) {
    // Override in subclass
  }

  // ==========================================
  // Render loop methods (override in subclass)
  // ==========================================

  /**
   * Update tool state
   * Called every frame when tool is active
   * @param {number} deltaTime - Time since last update in ms
   */
  update(deltaTime) {
    // Override in subclass
  }

  /**
   * Render the tool
   * Called every frame when tool is active
   */
  render() {
    // Override in subclass
  }

  // ==========================================
  // UI methods (override in subclass)
  // ==========================================

  /**
   * Get the tool's container element
   * @returns {HTMLElement|null}
   */
  getContainer() {
    return null;
  }

  /**
   * Show the tool's UI
   */
  show() {
    const container = this.getContainer();
    if (container) {
      container.style.display = '';
    }
  }

  /**
   * Hide the tool's UI
   */
  hide() {
    const container = this.getContainer();
    if (container) {
      container.style.display = 'none';
    }
  }

  // ==========================================
  // Navigation
  // ==========================================

  /**
   * Navigate back to tool selection
   */
  navigateBack() {
    if (this.onNavigateBack) {
      this.onNavigateBack();
    }
  }

  // ==========================================
  // Utility methods
  // ==========================================

  /**
   * Check if tool is currently active
   * @returns {boolean}
   */
  getIsActive() {
    return this.isActive;
  }

  /**
   * Get tool metadata for display
   * @returns {object}
   */
  getMetadata() {
    return {
      name: this.name,
      description: this.description,
    };
  }
}
