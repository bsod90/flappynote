/**
 * Game configuration constants
 */

export const GAME_CONFIG = {
  // Canvas dimensions (will be updated dynamically by renderer)
  CANVAS_WIDTH: 1200,
  CANVAS_HEIGHT: 600,

  // Ball properties
  BALL_RADIUS: 15,
  BALL_COLOR: '#FF6B6B',

  // Ball start position (calculated dynamically)
  get BALL_START_X() {
    return this.getGateStartX() - 80; // Start before first gate
  },

  get BALL_START_Y() {
    return this.CANVAS_HEIGHT / 2; // Start at middle height
  },

  // Physics
  GRAVITY: 0.5,
  LIFT_FORCE: -0.6,           // Upward force when singing (reduced for smoother control)
  FORWARD_VELOCITY: 1.5,      // Horizontal movement when singing
  MAX_VELOCITY_Y: 10,         // Reduced max velocity for better control
  DRAG: 0.98,

  // Gates - dynamically calculated
  GATE_THICKNESS: 50,         // 5x thicker for Flappy Bird style
  GATE_COLOR: '#4ECDC4',
  HOLE_HEIGHT: 80,
  HOLE_TOLERANCE: 20,         // Extra space for forgiveness

  // Pitch matching
  PITCH_TOLERANCE_CENTS: 50,  // How accurate the pitch must be
  MINIMUM_SINGING_DURATION: 100, // ms - minimum time singing to apply force

  // Scoring
  POINTS_PER_GATE: 100,
  PERFECT_PITCH_BONUS: 50,    // Bonus for very accurate pitch

  // UI
  NOTE_LABEL_OFFSET_Y: -30,

  // Calculate gate spacing based on canvas width and number of gates
  getGateSpacing(numGates = 8) {
    // For many gates (like chromatic scale = 13 notes), use wider spacing
    // For chromatic or scales with many notes, allow horizontal scrolling
    const minSpacing = 150; // Minimum comfortable spacing
    const maxSpacing = 250; // Maximum spacing for better gameplay

    // Calculate based on canvas, but enforce minimum spacing
    const availableWidth = this.CANVAS_WIDTH * 0.6;
    const calculatedSpacing = availableWidth / (numGates - 1);

    // Use wider spacing for many gates (allows scrolling)
    if (numGates > 10) {
      return Math.max(minSpacing, Math.min(maxSpacing, 180));
    }

    // For narrow screens, ensure minimum spacing
    return Math.max(minSpacing, calculatedSpacing);
  },

  getGateStartX() {
    return this.CANVAS_WIDTH * 0.25; // Start at 25% from left
  },
};
