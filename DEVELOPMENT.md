# Development Guide

## Project Overview

Vocal Trainer is a suite of browser-based vocal training tools:
- **Vocal Monitor** - Real-time pitch visualization on a piano roll
- **Flappy Note** - Pitch-matching singing game

## Getting Started

```bash
# Install dependencies
npm install

# Start development server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Testing

```bash
# Run all tests
npm test

# Run pitch engine unit tests only (fast)
npm run test:pitch-engine

# Watch mode for unit tests during development
npm run test:watch

# Run browser integration tests (requires dev server)
npm run test:browser
```

## Project Structure

```
src/
├── core/                      # Shared systems (used by all tools)
│   ├── ToolBase.js               - Abstract base class for tools
│   ├── PitchContext.js           - Shared pitch detection with subscriptions
│   ├── ScaleManager.js           - Musical scale management
│   ├── DroneManager.js           - Reference tone playback
│   ├── SharedSettings.js         - Cross-tool settings (localStorage)
│   └── index.js                  - Core exports
│
├── tools/                     # Individual tools
│   ├── vocal-monitor/            - Piano roll visualization tool
│   │   ├── VocalMonitorTool.js      - Main tool class
│   │   ├── VocalMonitorState.js     - Pitch history & state
│   │   ├── VocalMonitorRenderer.js  - Canvas rendering
│   │   └── PianoRoll.js             - Piano keyboard component
│   │
│   └── flappy-note/              - Pitch-matching game
│       ├── FlappyNoteTool.js        - Main tool class
│       ├── FlappyGameState.js       - Game logic & state
│       ├── FlappyRenderer.js        - Canvas rendering
│       ├── Ball.js                  - Player entity
│       └── Gate.js                  - Target obstacles
│
├── pitch-engine/              # Pitch detection module
│   ├── PitchDetector.js          - Main detection API
│   ├── AudioAnalyzer.js          - Mic input, AGC, filtering
│   ├── FrequencyConverter.js     - Musical frequency utilities
│   ├── detectors/
│   │   ├── BasePitchDetector.js    - Detector interface
│   │   ├── TFCREPEDetector.js      - CREPE-style (TensorFlow.js)
│   │   └── HybridPitchDetector.js  - MPM+YIN fallback
│   └── __tests__/                - Unit tests
│
├── audio/                     # Audio playback
│   └── TonePlayer.js             - Reference tone generation
│
├── config/                    # Configuration
│   ├── scales.js                 - Musical scale definitions
│   └── gameConfig.js             - Game physics parameters
│
├── ui/                        # UI components
│   ├── styles.css                - All CSS styles
│   └── DebugOverlay.js           - Debug info display
│
└── main.js                    # App entry & ToolSelector class
```

## Architecture

### Tool System

All tools extend `ToolBase` and share core systems:

```javascript
class MyTool extends ToolBase {
  async initialize() {
    // Set up UI, event listeners
  }

  async start() {
    // Called when tool becomes active
  }

  stop() {
    // Called when leaving tool
  }

  onPitchDetected(pitchData) {
    // Receives pitch updates from shared PitchContext
  }
}
```

### Shared Systems

Tools receive shared instances via `connect*` methods:

```javascript
tool.connectPitchContext(pitchContext);   // Pitch detection
tool.connectScaleManager(scaleManager);   // Musical scales
tool.connectDroneManager(droneManager);   // Reference tones
tool.connectSettings(settings);           // User preferences
```

### URL Routing

The app uses History API for clean URLs:
- `/` - Tool selection screen
- `/vocal-monitor` - Vocal Monitor tool
- `/flappy-note` - Flappy Note game

## Key Components

### PitchDetector

Supports multiple detection algorithms:

```javascript
import { PitchDetector, DetectorType } from './pitch-engine/index.js';

const detector = new PitchDetector({
  detector: DetectorType.CREPE,  // or DetectorType.HYBRID
  onPitchDetected: (pitch) => console.log(pitch),
  onModelLoading: () => console.log('Loading...'),
  onModelReady: () => console.log('Ready!'),
});

await detector.start();
```

### ScaleManager

Handles all musical scale logic:

```javascript
const scaleManager = new ScaleManager('D3', 'major');
scaleManager.setRootNote('E3');
scaleManager.setScaleType('minor');

const scaleInfo = scaleManager.getScaleInfo();
// { degrees: [...], rootFrequency: 146.83 }
```

### TonePlayer

Audio playback for reference tones:

```javascript
const tonePlayer = new TonePlayer();
tonePlayer.playTone(440, 0.5);  // 440Hz for 0.5 seconds
tonePlayer.startDrone(146.83); // Sustained drone
```

## Adding a New Tool

1. Create directory: `src/tools/my-tool/`
2. Create tool class extending `ToolBase`
3. Create state management class
4. Create renderer class
5. Add HTML container to `index.html`
6. Register in `main.js` TOOLS array

```javascript
// src/tools/my-tool/MyTool.js
export class MyTool extends ToolBase {
  constructor() {
    super('My Tool', 'Description of my tool');
  }

  async initialize() {
    this.container = document.getElementById('my-tool-container');
    // ... setup
  }
}
```

## Adding a New Scale

Edit `src/config/scales.js`:

```javascript
export const SCALES = {
  myNewScale: {
    name: 'My New Scale',
    intervals: [0, 2, 4, 5, 7, 9, 11, 12],
    degrees: ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Ti', 'Do'],
  }
};
```

Then add option to HTML select elements.

## Debugging

### Debug Overlay

Press `Ctrl/Cmd + Shift + D` to toggle debug overlay showing:
- Detected frequency and note
- RMS level and threshold
- Pitch detector algorithm in use
- Confidence scores

### Console Logging

Key areas to enable logging:

```javascript
// AudioAnalyzer.js - pitch detection
console.log('Detected:', frequency, 'Hz, clarity:', clarity);

// PitchDetector.js - detector switching
console.log('Using detector:', this.activeDetector?.name);

// TFCREPEDetector.js - CREPE status
console.log('CREPE state:', this.state);
```

## Performance

### Pitch Detection
- Detection runs every 30ms (configurable)
- Buffer size: 8192 samples
- Target latency: <50ms

### Rendering
- Both tools use requestAnimationFrame
- ResizeObserver handles responsive canvas
- DPR-aware rendering for retina displays

## Deployment

### Build

```bash
npm run build
```

Output in `dist/` directory.

### Hosting Requirements

- HTTPS required (for microphone access)
- SPA routing support (redirects to index.html)
- Included: `_redirects` (Netlify), `vercel.json`, `404.html` (GitHub Pages)

### Environment Variables

- `VITE_GA_MEASUREMENT_ID` - Google Analytics ID

## Resources

- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [TensorFlow.js](https://www.tensorflow.org/js)
- [CREPE Paper](https://arxiv.org/abs/1802.06182)
- [Vite Documentation](https://vitejs.dev/)
- [Vitest Documentation](https://vitest.dev/)
