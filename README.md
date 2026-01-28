# Vocal Trainer

A suite of browser-based vocal training tools for singers. Practice pitch accuracy, train your ear, and visualize your voice in real-time.

**Try it now at: [flappynote.com](https://flappynote.com)**

![Built with AI](https://img.shields.io/badge/Built%20with-AI-blueviolet?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)

## Tools

### Vocal Monitor
Real-time pitch visualization on a piano roll. See your voice as a continuous line over time.

- **Piano roll display** - Watch your pitch traced across time
- **Interactive keyboard** - Click and drag to play reference notes with portamento
- **Scale highlighting** - Visual guides show scale degrees with solfege labels
- **Pitch history** - Scroll back to review your performance

### Flappy Note
A singing game where you control a bird by matching pitches. Navigate through gates by singing target notes.

- **Pitch-controlled gameplay** - Your voice controls the bird's height
- **Scale progression** - Gates represent scale degrees (Do, Re, Mi...)
- **Multiple modes** - Practice scales, modes, and chord arpeggios
- **Scoring system** - Track your accuracy and completion

## Features

### Pitch Detection
- **CREPE-based detection** - ML-inspired spectral analysis using TensorFlow.js
- **Automatic gain control** - Works at any distance from your mic
- **Octave-jump correction** - Filters out harmonic detection errors
- **Drone noise cancellation** - Reference drone doesn't interfere with detection

### Musical Options
- **12 root notes** - All chromatic notes supported
- **Scales** - Major, Minor, Harmonic Minor, Melodic Minor, Pentatonic, Blues, Chromatic
- **Modes** - Dorian, Mixolydian
- **7th Chords** - Major 7, Dominant 7, Minor 7, Half-Diminished, Diminished
- **Advanced** - Whole Tone, Diminished scales

### Progressive Web App
- **Installable** - Add to home screen for fullscreen experience on mobile
- **Fullscreen mode** - Desktop browsers can go fullscreen via footer toggle
- **URL routing** - Direct links to each tool (`/vocal-monitor`, `/flappy-note`)

## Getting Started

### Requirements
- Modern browser (Chrome, Safari, Firefox, Edge)
- Microphone access
- Headphones recommended (to avoid drone feedback)

### Usage
1. Visit [flappynote.com](https://flappynote.com)
2. Choose a tool (Vocal Monitor or Flappy Note)
3. Select your root note and scale
4. Click Start and allow microphone access
5. Sing!

## Development

### Prerequisites
- Node.js 18+ and npm

### Setup
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### Project Structure
```
src/
├── core/                  # Shared systems
│   ├── PitchContext.js       - Shared pitch detection
│   ├── ScaleManager.js       - Musical scale management
│   ├── DroneManager.js       - Reference tone playback
│   ├── SharedSettings.js     - Cross-tool settings
│   └── ToolBase.js           - Abstract tool interface
│
├── tools/                 # Individual tools
│   ├── vocal-monitor/        - Piano roll visualization
│   │   ├── VocalMonitorTool.js
│   │   ├── VocalMonitorState.js
│   │   ├── VocalMonitorRenderer.js
│   │   └── PianoRoll.js
│   │
│   └── flappy-note/          - Pitch-matching game
│       ├── FlappyNoteTool.js
│       ├── FlappyGameState.js
│       └── FlappyRenderer.js
│
├── pitch-engine/          # Pitch detection
│   ├── PitchDetector.js      - Main detection API
│   ├── AudioAnalyzer.js      - Mic input & processing
│   ├── FrequencyConverter.js - Musical utilities
│   └── detectors/
│       ├── TFCREPEDetector.js  - CREPE-style detection
│       └── HybridPitchDetector.js - MPM+YIN fallback
│
├── audio/                 # Audio playback
│   └── TonePlayer.js         - Reference tone generation
│
├── config/                # Configuration
│   ├── scales.js             - Scale definitions
│   └── gameConfig.js         - Game parameters
│
├── ui/                    # Styling
│   ├── styles.css
│   └── DebugOverlay.js
│
└── main.js                # App entry & tool selector
```

## Technical Details

### Pitch Detection Pipeline
1. Microphone input via Web Audio API
2. High-pass filter (180Hz) to reduce rumble
3. Automatic gain control for consistent levels
4. Resampling to 16kHz for CREPE compatibility
5. Autocorrelation-based pitch detection
6. Temporal smoothing with median filter
7. Octave-jump correction

### Technologies
- **Vite** - Build tool and dev server
- **TensorFlow.js** - ML runtime for pitch detection
- **Web Audio API** - Microphone and audio processing
- **Canvas API** - 2D rendering
- **Pitchy** - MPM algorithm (fallback)
- **Vitest** - Unit testing

## License

MIT License - feel free to use this project for learning or create your own variations!

## About

This project was created with AI assistance (Claude by Anthropic). It demonstrates:
- Real-time audio processing in the browser
- ML-based pitch detection
- Interactive music visualization
- Progressive Web App capabilities
- Comprehensive analytics integration

## Links

- **Website**: [flappynote.com](https://flappynote.com)
- **Vocal Monitor**: [flappynote.com/vocal-monitor](https://flappynote.com/vocal-monitor)
- **Flappy Note**: [flappynote.com/flappy-note](https://flappynote.com/flappy-note)
- **GitHub**: [github.com/bsod90/flappynote](https://github.com/bsod90/flappynote)

---

Made with AI
