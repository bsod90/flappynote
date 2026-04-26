/**
 * Hardcoded note-name lists for the rolling-key Lowest/Highest dropdowns.
 * Shared between Sidebar (for rendering) and VocalMonitorController (for
 * clamping the effective bounds against the active exercise's reach).
 *
 * Order is ascending by pitch.
 */
export const ROLLING_KEY_LOWS = [
  'C2', 'D2', 'E2', 'F2', 'G2', 'A2', 'B2',
  'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3',
  'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4',
];

export const ROLLING_KEY_HIGHS = [
  'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3',
  'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4',
  'C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5',
];
