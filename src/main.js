/**
 * Main application entry point - Tool Selector
 * Manages tool selection, shared systems, navigation, and URL routing
 */

import { SharedSettings, PitchContext, DroneManager, ScaleManager } from './core/index.js';
import { FlappyNoteTool } from './tools/flappy-note/index.js';
import { VocalMonitorTool } from './tools/vocal-monitor/index.js';

// Tool definitions with URL paths
const TOOLS = [
  {
    id: 'flappy-note',
    path: '/flappy-note',
    name: 'Flappy Note',
    description: 'Sing to guide the bird through pipes. Match each target note to progress through the scale.',
    icon: '🐦',
    ToolClass: FlappyNoteTool,
  },
  {
    id: 'vocal-monitor',
    path: '/vocal-monitor',
    name: 'Vocal Monitor',
    description: 'Real-time pitch visualization on a piano roll. See your voice as a continuous line over time.',
    icon: '🎤',
    ToolClass: VocalMonitorTool,
  },
];

class ToolSelector {
  constructor() {
    // Shared systems
    this.settings = new SharedSettings();
    this.scaleManager = null;
    this.pitchContext = null;
    this.droneManager = null;

    // Tool instances
    this.tools = new Map();
    this.activeTool = null;

    // UI elements
    this.toolSelectionScreen = null;
    this.appContainer = null;

    this.initialize();
  }

  /**
   * Initialize the application
   */
  async initialize() {
    // Check for embedded browser
    this.checkEmbeddedBrowser();

    // Initialize shared systems
    this.initializeSharedSystems();

    // Create UI
    this.createToolSelectionUI();

    // Initialize tools
    await this.initializeTools();

    // Set up URL routing
    this.setupRouting();

    // Set up fullscreen toggle
    this.setupFullscreenToggle();

    // Route based on current URL
    this.handleRoute();

    // Track page load
    this.trackEvent('page_load', {
      root_note: this.settings.get('rootNote'),
      scale_type: this.settings.get('scaleType'),
    });
  }

  /**
   * Set up URL routing with History API
   */
  setupRouting() {
    // Handle browser back/forward buttons
    window.addEventListener('popstate', () => {
      this.handleRoute();
    });
  }

  /**
   * Handle the current URL route
   */
  handleRoute() {
    const path = window.location.pathname;

    // Find tool matching the current path
    const toolDef = TOOLS.find(t => t.path === path);

    if (toolDef) {
      // URL matches a tool - select it without updating URL (already correct)
      this.selectToolInternal(toolDef.id);
    } else if (path === '/' || path === '/index.html') {
      // Root path - show tool selection
      this.showToolSelection();
    } else {
      // Unknown path - redirect to root
      this.navigateToSelection();
    }
  }

  /**
   * Get tool definition by ID
   */
  getToolDef(toolId) {
    return TOOLS.find(t => t.id === toolId);
  }

  /**
   * Initialize shared systems
   */
  initializeSharedSystems() {
    // Create scale manager with current settings
    const rootNote = this.settings.getRootNoteWithOctave();
    const scaleType = this.settings.get('scaleType');
    this.scaleManager = new ScaleManager(rootNote, scaleType);

    // Create pitch context
    this.pitchContext = new PitchContext({
      updateInterval: 30,
      threshold: 0.0001,
      bufferSize: 8192,
    });

    // Create drone manager
    this.droneManager = new DroneManager();

    // Listen for settings changes to update shared systems
    this.settings.subscribe((key, newValue) => {
      if (key === 'rootNote') {
        const rootWithOctave = newValue.length === 1 ? `${newValue}3` : newValue;
        this.scaleManager.setRootNote(rootWithOctave);
      } else if (key === 'scaleType') {
        this.scaleManager.setScaleType(newValue);
      }
    });
  }

  /**
   * Create the tool selection UI
   */
  createToolSelectionUI() {
    // Get or create app container
    this.appContainer = document.getElementById('app');

    // Create tool selection screen
    this.toolSelectionScreen = document.createElement('div');
    this.toolSelectionScreen.id = 'tool-selection-screen';
    this.toolSelectionScreen.innerHTML = `
      <div class="tool-selection-content">
        <h1 class="tool-selection-title">Vocal Trainer</h1>
        <p class="tool-selection-subtitle">Choose a training tool to get started</p>
        <div class="tool-cards" id="tool-cards">
          ${TOOLS.map(tool => `
            <button class="tool-card" data-tool-id="${tool.id}">
              <span class="tool-icon">${tool.icon}</span>
              <h2 class="tool-name">${tool.name}</h2>
              <p class="tool-description">${tool.description}</p>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    // Insert at beginning of app container
    this.appContainer.insertBefore(this.toolSelectionScreen, this.appContainer.firstChild);

    // Add click handlers
    const cards = this.toolSelectionScreen.querySelectorAll('.tool-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const toolId = card.dataset.toolId;
        this.selectTool(toolId);
      });
    });
  }

  /**
   * Initialize all tools
   */
  async initializeTools() {
    for (const toolDef of TOOLS) {
      const tool = new toolDef.ToolClass();

      // Connect shared systems
      tool.connectPitchContext(this.pitchContext);
      tool.connectScaleManager(this.scaleManager);
      tool.connectDroneManager(this.droneManager);
      tool.connectSettings(this.settings);

      // Set up navigation callback
      tool.onNavigateBack = () => this.navigateToSelection();

      this.tools.set(toolDef.id, tool);
    }
  }

  /**
   * Show tool selection screen
   */
  showToolSelection() {
    this.toolSelectionScreen.style.display = 'flex';

    // Hide all tool containers
    const flappyContainer = document.getElementById('flappy-note-container');
    const vocalContainer = document.getElementById('vocal-monitor-container');
    if (flappyContainer) flappyContainer.style.display = 'none';
    if (vocalContainer) vocalContainer.style.display = 'none';

    // Reset page title
    document.title = 'Vocal Trainer - Free Pitch Training Tools for Singers';
  }

  /**
   * Hide tool selection screen
   */
  hideToolSelection() {
    this.toolSelectionScreen.style.display = 'none';
  }

  /**
   * Select and activate a tool (with URL update)
   * @param {string} toolId
   */
  async selectTool(toolId) {
    const toolDef = this.getToolDef(toolId);
    if (!toolDef) {
      console.error(`Tool ${toolId} not found`);
      return;
    }

    // Update URL
    window.history.pushState({ toolId }, toolDef.name, toolDef.path);

    // Update page title
    document.title = `${toolDef.name} - Vocal Trainer`;

    // Select the tool internally
    await this.selectToolInternal(toolId);

    // Track tool selection
    this.trackEvent('tool_selected', { tool_id: toolId });
  }

  /**
   * Select and activate a tool (without URL update - for routing)
   * @param {string} toolId
   */
  async selectToolInternal(toolId) {
    const tool = this.tools.get(toolId);
    const toolDef = this.getToolDef(toolId);
    if (!tool || !toolDef) {
      console.error(`Tool ${toolId} not found`);
      return;
    }

    // Stop current tool if active
    if (this.activeTool) {
      this.activeTool.stop();
    }

    // Hide selection screen
    this.hideToolSelection();

    // Save last tool
    this.settings.set('lastTool', toolId);

    // Update page title
    document.title = `${toolDef.name} - Vocal Trainer`;

    // Start new tool
    this.activeTool = tool;
    await tool.start();
  }

  /**
   * Navigate back to tool selection
   */
  navigateToSelection() {
    // Stop current tool
    if (this.activeTool) {
      this.activeTool.stop();
      this.activeTool = null;
    }

    // Stop pitch detection and drone
    this.pitchContext.stop();
    this.droneManager.stopDrone();

    // Update URL to root
    window.history.pushState({}, 'Vocal Trainer', '/');

    // Update page title
    document.title = 'Vocal Trainer - Free Pitch Training Tools for Singers';

    // Show selection screen
    this.showToolSelection();

    // Track navigation
    this.trackEvent('navigate_to_selection');
  }

  /**
   * Check for embedded browser
   */
  checkEmbeddedBrowser() {
    const ua = navigator.userAgent || '';

    const isEmbedded =
      ua.includes('FBAN') ||
      ua.includes('FBAV') ||
      ua.includes('Instagram') ||
      ua.includes('LinkedIn') ||
      ua.includes('Twitter') ||
      ua.includes('Line/') ||
      ua.includes('MicroMessenger');

    if (isEmbedded) {
      this.showEmbeddedBrowserWarning();
    }
  }

  /**
   * Show embedded browser warning
   */
  showEmbeddedBrowserWarning() {
    if (document.getElementById('embedded-warning') ||
        localStorage.getItem('flappynote-embedded-warning-dismissed') === 'true') {
      return;
    }

    const warning = document.createElement('div');
    warning.id = 'embedded-warning';
    warning.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #ff6b35;
      color: white;
      padding: 12px 40px 12px 20px;
      text-align: center;
      font-weight: 600;
      z-index: 9999;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    `;
    warning.innerHTML = '⚠️ Microphone access is required. Tap the menu (⋮ or ⋯) and select "Open in Safari" or "Open in Chrome" for full functionality.';

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = `
      position: absolute;
      top: 50%;
      right: 10px;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: white;
      font-size: 28px;
      font-weight: bold;
      cursor: pointer;
      padding: 0;
      width: 30px;
      height: 30px;
      line-height: 30px;
      text-align: center;
    `;
    closeBtn.onclick = () => {
      warning.remove();
      localStorage.setItem('flappynote-embedded-warning-dismissed', 'true');
    };

    warning.appendChild(closeBtn);
    document.body.prepend(warning);
  }

  /**
   * Track analytics event
   */
  trackEvent(eventName, params = {}) {
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, params);
    }
  }

  /**
   * Set up fullscreen toggle functionality
   */
  setupFullscreenToggle() {
    const toggle = document.getElementById('fullscreen-toggle');
    const text = document.getElementById('fullscreen-text');
    const icon = document.getElementById('fullscreen-icon');

    if (!toggle) return;

    // Check if Fullscreen API is supported
    const fullscreenEnabled = document.fullscreenEnabled ||
      document.webkitFullscreenEnabled ||
      document.mozFullScreenEnabled ||
      document.msFullscreenEnabled;

    // Check if running as PWA (standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;

    // Check if iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    if (isStandalone) {
      // Already in fullscreen-like mode (PWA)
      toggle.style.display = 'none';
      return;
    }

    if (!fullscreenEnabled && isIOS) {
      // iOS doesn't support Fullscreen API - show "Add to Home Screen" prompt
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        this.showAddToHomeScreenPrompt();
      });
      if (text) text.textContent = 'Install App';
      return;
    }

    if (!fullscreenEnabled) {
      // Fullscreen not supported and not iOS
      toggle.style.display = 'none';
      return;
    }

    // Fullscreen API supported - set up toggle
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      this.toggleFullscreen();
    });

    // Update button state on fullscreen change and trigger resize
    const handleFullscreenChange = () => {
      const isFullscreen = document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement;

      if (text) {
        text.textContent = isFullscreen ? 'Exit Fullscreen' : 'Fullscreen';
      }
      if (icon) {
        // Switch between expand and compress icons
        icon.innerHTML = isFullscreen
          ? '<path d="M5.5 0a.5.5 0 0 1 .5.5v4A1.5 1.5 0 0 1 4.5 6h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5zm5 0a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 10 4.5v-4a.5.5 0 0 1 .5-.5zM0 10.5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 6 11.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5zm10 0a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0 1h-4a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4z"/>'
          : '<path d="M1.5 1a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4A1.5 1.5 0 0 1 1.5 0h4a.5.5 0 0 1 0 1h-4zM10 .5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 16 1.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5zM.5 10a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 0 14.5v-4a.5.5 0 0 1 .5-.5zm15 0a.5.5 0 0 1 .5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5z"/>';
      }

      // Trigger resize after a short delay to let the browser update layout
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 100);

      // Second resize trigger for browsers that need more time
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 300);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
  }

  /**
   * Toggle fullscreen mode
   */
  toggleFullscreen() {
    const elem = document.documentElement;
    const isFullscreen = document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement;

    if (isFullscreen) {
      // Exit fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    } else {
      // Enter fullscreen
      if (elem.requestFullscreen) {
        elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
      } else if (elem.mozRequestFullScreen) {
        elem.mozRequestFullScreen();
      } else if (elem.msRequestFullscreen) {
        elem.msRequestFullscreen();
      }
    }
  }

  /**
   * Show "Add to Home Screen" prompt for iOS
   */
  showAddToHomeScreenPrompt() {
    if (document.getElementById('add-to-home-prompt')) return;

    const prompt = document.createElement('div');
    prompt.id = 'add-to-home-prompt';
    prompt.style.cssText = `
      position: fixed;
      bottom: 60px;
      left: 50%;
      transform: translateX(-50%);
      background: #2a2a4a;
      color: white;
      padding: 16px 20px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
      z-index: 9999;
      max-width: 320px;
      text-align: center;
      font-size: 14px;
      line-height: 1.5;
    `;
    prompt.innerHTML = `
      <strong>Install for fullscreen experience</strong><br><br>
      Tap the Share button <span style="font-size: 18px;">⎙</span> then select<br>
      <strong>"Add to Home Screen"</strong>
      <button id="add-to-home-dismiss" style="
        display: block;
        margin: 12px auto 0;
        padding: 8px 16px;
        background: #4ec0ca;
        border: none;
        border-radius: 6px;
        color: white;
        font-weight: 600;
        cursor: pointer;
      ">Got it</button>
    `;

    document.body.appendChild(prompt);

    document.getElementById('add-to-home-dismiss').addEventListener('click', () => {
      prompt.remove();
    });

    // Auto-dismiss after 10 seconds
    setTimeout(() => {
      if (prompt.parentNode) {
        prompt.remove();
      }
    }, 10000);
  }

  /**
   * Clean up resources
   */
  dispose() {
    // Stop active tool
    if (this.activeTool) {
      this.activeTool.stop();
    }

    // Dispose all tools
    for (const tool of this.tools.values()) {
      tool.dispose();
    }

    // Dispose shared systems
    this.pitchContext.dispose();
    this.droneManager.dispose();
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.toolSelector = new ToolSelector();
  });
} else {
  window.toolSelector = new ToolSelector();
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  if (window.toolSelector) {
    window.toolSelector.dispose();
  }
});
