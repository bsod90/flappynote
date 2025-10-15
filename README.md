# 🎵 Flappy Note

A browser-based pitch-matching game that helps you learn musical intervals and scales through singing! Control a flying musical note by singing different pitches and navigate through gates representing scale degrees.

**Play now at: [flappynote.com](https://flappynote.com)**

![Flappy Note Game](https://img.shields.io/badge/Built%20with-AI-blueviolet?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)

## 🎮 How to Play

1. **Select your settings**: Choose a root note, musical mode, and direction (ascending/descending)
2. **Click "Start Game"**: Grant microphone access when prompted
3. **Sing to fly**: Your voice controls the musical note's vertical position
4. **Match the pitch**: Sing the correct note to pass through each gate
5. **Complete the scale**: Navigate through all gates to win!

## 🎼 Features

### Musical Modes
- **Scales**: Major, Natural Minor, Harmonic Minor, Melodic Minor, Pentatonic, Blues, Chromatic
- **Modes**: Dorian, Mixolydian
- **Chords**: Major Triad, Minor Triad (arpeggios)
- **Advanced**: Whole Tone, Diminished

### Game Features
- **Real-time pitch detection** using the YIN algorithm
- **Automatic Gain Control (AGC)** - works at any distance from your mic
- **Direction control** - practice ascending or descending scales
- **Visual feedback** - gates light up when you sing correctly
- **Solfège notation** - learn with Do-Re-Mi syllables
- **Multiple octave support** - sing any octave of the target note

## 🛠️ Built With

This entire project was **created using AI** (Claude by Anthropic) - from initial concept to final implementation, including:
- Game logic and physics
- Pitch detection engine
- Visual design and animations
- Musical theory implementation
- Test suite

### Technologies
- **Vite** - Build tool and dev server
- **Vanilla JavaScript** - No frameworks, just pure JS
- **Web Audio API** - Microphone input and audio processing
- **Canvas API** - 2D rendering
- **Pitchfinder** - YIN algorithm for pitch detection
- **Vitest** - Unit testing
- **Playwright** - End-to-end testing

## 🚀 Development

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

# Run browser tests
npm run test:browser

# Build for production
npm run build
```

### Project Structure
```
src/
├── audio/           # Tone playback for reference notes
├── config/          # Game configuration and scale definitions
├── game/            # Core game logic (GameState, Ball, Gate, ScaleManager)
├── pitch-engine/    # Pitch detection (AudioAnalyzer, PitchDetector, FrequencyConverter)
├── rendering/       # Canvas rendering
└── ui/              # UI styles and debug overlay
```

## 🎯 Educational Value

Flappy Note helps you develop:
- **Pitch recognition** - Train your ear to identify musical intervals
- **Vocal control** - Practice singing accurate pitches
- **Music theory** - Learn scales, modes, and their relationships
- **Intonation** - Improve your singing accuracy

## 📝 License

MIT License - feel free to use this project for learning or create your own variations!

## 🤖 About This Project

This game is a testament to what's possible with AI-assisted development. Every line of code, every design decision, and every feature was created through conversation with Claude (Anthropic's AI assistant).

The project demonstrates:
- Real-time audio processing in the browser
- Advanced pitch detection algorithms
- Game physics and collision detection
- Responsive canvas-based graphics
- Comprehensive test coverage
- Musical theory implementation

## 🔗 Links

- **Play the game**: [flappynote.com](https://flappynote.com)
- **GitHub repository**: [github.com/bsod90/flappynote](https://github.com/bsod90/flappynote)

---

Made with ❤️ and AI
