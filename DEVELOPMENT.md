# Development Guide

## Project Setup

This project uses Vite for development and building, Vitest for unit testing, and Playwright for browser testing.

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
├── pitch-engine/          # Standalone pitch detection module
│   ├── AudioAnalyzer.js      - Microphone input & autocorrelation
│   ├── FrequencyConverter.js - Musical frequency utilities
│   ├── PitchDetector.js      - Main pitch detection API
│   └── __tests__/            - Unit tests (44 tests)
│
├── game/                  # Game logic (framework-agnostic)
│   ├── Ball.js               - Ball entity with physics
│   ├── Gate.js               - Gate obstacles
│   ├── ScaleManager.js       - Musical scale management
│   └── GameState.js          - Main game controller
│
├── rendering/             # Rendering abstraction
│   ├── Renderer.js           - Abstract base class
│   ├── Renderer2D.js         - Canvas 2D implementation
│   └── Renderer3D.js         - (Future) Three.js
│
├── config/                # Configuration
│   ├── scales.js             - Musical scale definitions
│   └── gameConfig.js         - Game tuning parameters
│
├── ui/
│   └── styles.css            - UI styling
│
└── main.js                # Application entry point
```

## Key Design Patterns

### 1. Module Isolation
The pitch engine is completely independent and can be extracted:

```javascript
import { PitchDetector } from './pitch-engine/index.js';

const detector = new PitchDetector({
  onPitchDetected: (pitch) => console.log(pitch)
});

await detector.start();
```

### 2. Strategy Pattern (Rendering)
Easy swap between 2D and future 3D rendering:

```javascript
// Use 2D
const renderer = new Renderer2D(canvas);

// Future: Use 3D
const renderer = new Renderer3D(canvas);

// Same interface
renderer.render(gameState);
```

### 3. Configuration-Driven Scales
Add new musical modes easily:

```javascript
// src/config/scales.js
export const SCALES = {
  newMode: {
    name: 'My New Mode',
    intervals: [0, 2, 3, 5, 7, 8, 10, 12],
    degrees: ['Do', 'Re', 'Me', 'Fa', 'Sol', 'Le', 'Te', 'Do'],
  }
};
```

## Common Development Tasks

### Tuning Game Physics

Edit `src/config/gameConfig.js`:

```javascript
export const GAME_CONFIG = {
  GRAVITY: 0.5,              // Increase for harder
  LIFT_FORCE: -1.2,          // Increase for easier
  PITCH_TOLERANCE_CENTS: 50, // Decrease for harder
};
```

### Adding a New Scale

1. Edit `src/config/scales.js`
2. Add your scale definition
3. Update HTML `<select>` in `public/index.html`
4. Test with different root notes

### Improving Pitch Detection

The autocorrelation algorithm is in `src/pitch-engine/AudioAnalyzer.js`:

```javascript
detectPitch(buffer) {
  // Your algorithm here
  // Current: Autocorrelation
  // Alternatives: YIN, CREPE, etc.
}
```

### Extending to 3D

1. Create `src/rendering/Renderer3D.js`
2. Implement the `Renderer` interface
3. Use Three.js for rendering
4. Swap in `main.js`:

```javascript
import { Renderer3D } from './rendering/Renderer3D.js';
const renderer = new Renderer3D(canvas);
```

## Debugging Tips

### Pitch Detection Issues

Enable console logging in `AudioAnalyzer.js`:

```javascript
detectPitch(buffer) {
  const frequency = this.analyzer.detectPitch(buffer);
  console.log('Detected frequency:', frequency);
  return frequency;
}
```

### Physics Tuning

Add visual debug info in `Renderer2D.js`:

```javascript
// Draw velocity vectors
this.ctx.strokeStyle = 'yellow';
this.ctx.beginPath();
this.ctx.moveTo(ball.x, ball.y);
this.ctx.lineTo(ball.x + ball.velocityX * 10, ball.y + ball.velocityY * 10);
this.ctx.stroke();
```

### Gate Positioning

Log gate positions in console:

```javascript
// src/game/GameState.js
initializeGates() {
  // ...
  console.table(this.gates.map(g => ({
    degree: g.degreeLabel,
    frequency: g.targetFrequency,
    y: g.targetY
  })));
}
```

## Performance Profiling

### Pitch Detection Performance

```javascript
// src/pitch-engine/PitchDetector.js
_detectAndNotify() {
  const start = performance.now();
  const buffer = this.analyzer.getAudioBuffer();
  const frequency = this.analyzer.detectPitch(buffer);
  console.log('Pitch detection took:', performance.now() - start, 'ms');
}
```

### Render Performance

Use browser DevTools:
- Chrome: Performance tab
- Enable "Paint flashing" to see repaints
- Monitor FPS in rendering tab

## Code Style

- Use ES6 modules
- Document public APIs with JSDoc
- Keep functions small and focused
- Prefer composition over inheritance
- Write tests for new algorithms

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes and test
npm test

# Commit with descriptive message
git commit -m "Add chromatic scale support"

# Push and create PR
git push origin feature/my-feature
```

## Troubleshooting

### Microphone not working
- Check browser permissions
- Must use HTTPS in production
- Some browsers block audio in iframes

### Tests failing
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm test
```

### Build errors
```bash
# Check Vite config
# Ensure public/index.html exists
# Verify all imports use .js extension
```

## Resources

- [Web Audio API Docs](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Autocorrelation for Pitch Detection](https://en.wikipedia.org/wiki/Autocorrelation)
- [Music Theory: Scales and Modes](https://en.wikipedia.org/wiki/Mode_(music))
- [Vite Documentation](https://vitejs.dev/)
- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)

## Next Steps

See [CLAUDE.md](./CLAUDE.md) for:
- Architectural details
- Extension ideas
- 3D migration path
- Advanced pitch detection algorithms
