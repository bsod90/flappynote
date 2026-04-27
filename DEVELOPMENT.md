# Development Guide

## Project Overview

Musical Playground is a suite of browser-based music practice tools:
- **Vocal Monitor** — real-time pitch visualization on a piano roll, with interactive vocal exercises and rolling-key practice.
- **Metronome** — rotary BPM dial with subdivisions, accent patterns, tap tempo, skip-pattern training, timed practice sessions, and a mic listen-back mode that scores your timing in real time.
- **Circle of Fifths** — interactive color-coded SVG wheel of all 12 keys, mini key-signature staff, audible diatonic chords (triad/7th, block/arpeggio), and theory overlays for secondary dominants, tritone substitutions, and parallel keys.

All tools share dark/light theming via shadcn HSL CSS variables and run entirely in the browser — no audio leaves the device.

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
npm test                       # all unit tests
npm run test:watch             # watch mode
npm run test:pitch-engine      # only pitch-engine specs (fast)
npm run test:browser           # Playwright (requires dev server)
```

## Project Structure

```
src/
├── app/                       # React app shell
│   ├── App.jsx                  - BrowserRouter + routes + page-view tracking
│   ├── AppShell.jsx             - Top bar with brand + active-tool icon + back link
│   ├── AppFooter.jsx            - Help / GitHub / Fullscreen toggle
│   ├── ToolIndex.jsx            - "/" — tool catalog cards
│   ├── ToolFallback.jsx, NotFound.jsx
│   ├── useColorScheme.js        - Mirrors prefers-color-scheme onto <html>
│   └── icons/GithubIcon.jsx
│
├── components/ui/             # shadcn/ui primitives (Button, Select, Sheet, …)
├── lib/
│   ├── utils.js                 - cn() helper
│   └── analytics.js             - Tiny gtag wrapper
│
├── tools/
│   ├── registry.js              - Tool catalog (single source of truth)
│   │
│   ├── vocal-monitor/
│   │   ├── VocalMonitorPage.jsx
│   │   ├── VocalMonitorController.js   - DOM-agnostic canvas controller
│   │   ├── VocalMonitorRenderer.js
│   │   ├── VocalMonitorState.js
│   │   ├── PianoRoll.js, ExerciseRenderer.js
│   │   ├── PitchCanvas.jsx
│   │   ├── Sidebar.jsx, Toolbar.jsx
│   │   ├── ExerciseEngine.js
│   │   ├── ScaleTimeline.js, RollingKeyManager.js
│   │   ├── canvasTheme.js              - Reads CSS HSL vars per frame
│   │   ├── useSharedSettings.js
│   │   ├── rollingKeyOptions.js
│   │   └── exercises/                  - Individual exercise definitions
│   │
│   ├── metronome/
│   │   ├── MetronomePage.jsx
│   │   ├── MetronomeEngine.js          - Web Audio lookahead scheduler
│   │   ├── MetronomeDial.jsx           - Rotary BPM dial + visual beat ring
│   │   ├── PracticeTracker.jsx         - Session state machine
│   │   ├── ListenBackPanel.jsx         - Unified canvas: waveform / grid / hits
│   │   ├── MicListener.js              - Mic stream + AnalyserNode → detector
│   │   ├── OnsetDetector.js            - Peak-based percussion onset detection
│   │   ├── HitTracker.js               - Beat matching + flam detection + stats
│   │   ├── clickSamples.js             - Synthesized click bank
│   │   ├── sensitivity.js              - Slider ↔ detector threshold
│   │   └── Sidebar.jsx
│   │
│   └── circle-of-fifths/
│       ├── CircleOfFifthsPage.jsx      - Page composition + audio lifecycle
│       ├── CircleOfFifths.jsx          - SVG wheel + sector hit-testing + overlays
│       ├── KeyHub.jsx                  - Center hub + diatonic chord row
│       ├── ChordSynth.js               - Web Audio chord synth (triad/7th, block/arp)
│       ├── musicTheory.js              - Keys, diatonic builder, chord recipes
│       └── Sidebar.jsx                 - Voicing / articulation / overlays
│
├── core/                      # Shared, non-React systems
│   ├── PitchContext.js, ScaleManager.js, DroneManager.js
│   ├── SharedSettings.js        - localStorage-backed observable settings
│   └── index.js
│
├── pitch-engine/              # Pitch detection (CREPE / MPM+YIN)
├── audio/TonePlayer.js
├── config/scales.js
├── index.css                  # Tailwind base + shadcn HSL theme tokens
└── main.jsx                   # ReactDOM.createRoot mount
```

## Architecture

### Tool registry

`src/tools/registry.js` is the single source of truth for both the index page and the router. Each entry:

```jsx
{
  id: 'vocal-monitor',
  path: '/vocal-monitor',
  name: 'Vocal Monitor',
  tagline: '...',
  icon: AudioLines,                                // lucide-react component
  Component: lazy(() => import('./vocal-monitor/VocalMonitorPage.jsx')),
}
```

Adding a tool: drop a new entry — the router and the index page both pick it up automatically. The active tool's icon also renders in the AppShell breadcrumb.

### Vocal Monitor: React + headless controller

Stateful canvas/audio logic lives in a plain class (`VocalMonitorController.js`); React owns the DOM around it.

- `VocalMonitorPage.jsx` instantiates `SharedSettings`, `ScaleManager`, `PitchContext`, `DroneManager`.
- `PitchCanvas.jsx` mounts the controller against a `<canvas ref>` in `useEffect`, disposes on unmount.
- `Sidebar.jsx` reads/writes `SharedSettings` via `useSharedSettingValues`. The controller subscribes to the same `SharedSettings` and reacts (drone, scale lock, exercise restart, rolling-key advance).

Settings are the cross-cutting bus — both React and the controller go through `SharedSettings`. There's no React→controller imperative API for setting changes. The controller never writes to settings inside its own subscriber (avoids re-entrancy); ephemeral overrides like rolling-key root and scale lock live as controller state and are exposed via `effective*` getters.

### Metronome: JS scheduler + Web Audio listen-back

Stateful audio + onset processing lives in plain classes; React composes the UI and lifecycle.

- `MetronomeEngine.js` — Web Audio **lookahead scheduler** (25ms tick, 120ms-ahead window, anchored to `AudioContext.currentTime`). Holds bar/beat state, accent pattern, skip pattern, subdivision multiplier. Emits `onBeat({ time, beatIndex, barNumber, kind, skipped })` aligned to the audible beat. Click playback uses synthesized `AudioBuffer` samples (`clickSamples.js`) — no audio files shipped. Includes `playIntervalBeep()` for practice-session transitions (a distinct two-tone chime).
- `MetronomeDial.jsx` — rotary BPM control. Drag (mouse / touch / wheel), click-to-edit number, optional `navigator.vibrate(3)` haptic per BPM step. Renders the segment-per-beat ring with smooth fill + glow on each beat, accent beats in super-accent color.
- `PracticeTracker.jsx` — session state machine `idle → countdown(5s) → running → complete`. RAF-driven progress bar, distinct chime on every interval transition. Auto-starts/stops the engine.
- `MicListener.js` — opens the mic with `echoCancellation: false` (preserves percussive transients), attaches an `AnalyserNode` to the engine's shared `AudioContext`. Per-RAF reads time-domain samples, feeds the detector, also fires `onLevel({ time, peak })` for the live waveform.
- `OnsetDetector.js` — peak-based percussion onset detector. Sample-accurate timestamp (finds peak index within the buffer), adaptive ambient via EMA, refractory + rise-ratio gates.
- `HitTracker.js` — receives expected beats (from engine) and detected hits (from listener). Anchors each hit to a **virtual beat** projected from the latest known beat by BPM (handles the "hit just before the next click was emitted" case). Computes:
  - `gridOffsetMs` against the closest grid point (quarter / eighth / sixteenth, plus optional 8th-triplet) → drives the colored hit dot
  - `clickOffsetMs` against the closest *audible* beat → drives the "Click sync" stat
  - **Flam detection** — close-paired hits (5–80ms apart, comparable energy, BPM-aware gap cap) collapse into one main hit flagged `hasFlam: true`
- `ListenBackPanel.jsx` — single unified canvas with a 6s rolling window: subdivision grid, beat ticks (audible solid / silent dashed / accent magenta), threshold band, mirrored waveform, hit dots colored by grid status, FLAM markers along the bottom edge. Stats footer: On grid / Click sync / Hit rate.

The roundtrip latency between scheduling a click and detecting it via mic is calibrated by listening to the metronome's own clicks for 5s and recording the median delta. Default 12ms; user-editable in the sidebar.

### Circle of Fifths: SVG wheel + Web Audio chord synth

A pure-SVG concentric wheel with a small Web Audio synth attached.

- `musicTheory.js` — pure-data: 12 wheel positions for major/minor keys (semitone, accidental count + type), diatonic chord builder, MAJOR_DEGREES / MINOR_DEGREES with Roman numerals + chord types, CHORD_RECIPES (triad + 7th interval sets per chord quality).
- `CircleOfFifths.jsx` — renders three concentric annular sectors per position (major / minor / leading-tone diminished). Each sector is an SVG `<path>` built from `M + A + L + A + Z` (move, two arcs, line, close). Audio fires on `pointerdown` (not click) so iOS responds without the 300ms tap delay. The selected key's diatonic span (3 sectors × all rings) is outlined in super-accent; the tonic sector gets an additional inner outline. Optional overlays (`secondary`, `tritone`, `parallel`) layer extra labels and a dashed link line on top of the wheel.
- `KeyHub.jsx` — the HTML overlay inside the wheel hub: tonic name, mini SVG treble-clef key signature with engraved sharps/flats, and the seven diatonic chord buttons. The chord row is hidden on mobile (`hidden sm:block`) and re-rendered below the wheel by the page so it doesn't overflow the small hub area.
- `ChordSynth.js` — single-voice subtractive synth (triangle + sine harmonic + lowpass + ADSR), summed across chord tones. Block plays everything at `currentTime + 0.04s`; arpeggio staggers by 90ms per note. iOS audio handling mirrors the metronome: lazy AudioContext creation inside the first user gesture, silent `<audio playsinline>` to switch the audio session category, and a `Promise.race(resume, 400ms timeout)` before scheduling so the start time is always in the future once the context wakes. `unlock()` is intentionally non-aggressive — only recreates a `closed` context, never a `suspended` one, so rapid clicks don't keep aborting the in-flight resume.
- `CircleOfFifthsPage.jsx` — wires settings (`circleSelectedPos`, `circleSelectedMode`, `circleVoicing`, `circleArticulation`, `circleVolume`, `circleShow*` overlays), instantiates the synth on mount, renders the wheel + sidebar, and handles sector clicks (set selected key + play tonic chord) and hub-button clicks (play that diatonic chord).

### URL Routing

`react-router-dom` with `BrowserRouter`:
- `/` → tool index
- `/vocal-monitor` → Vocal Monitor
- `/metronome` → Metronome
- `/circle-of-fifths` → Circle of Fifths
- `*` → NotFound

SPA fallback is handled by CloudFront (403/404 responses redirected to `/index.html`) for the production AWS hosting; `_redirects` (Netlify) and `404.html` (GitHub Pages) are also bundled for alternate hosts.

## Key APIs

### PitchDetector

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

### MetronomeEngine

```javascript
const engine = new MetronomeEngine({
  onBeat: ({ time, beatIndex, barNumber, kind, skipped }) => { /* … */ },
});
engine.setBpm(120);
engine.setTimeSignature(4, 4);
engine.setAccentPattern(['accent', 'regular', 'regular', 'regular']);
engine.setSubdivision(2);              // 1=quarters, 2=eighths, 3=triplets, 4=sixteenths, 6=sextuplets
engine.setSkipPattern(4, 0);           // play 4 bars, skip 0
engine.setTimbre('woodblock');
await engine.start();
engine.playIntervalBeep();             // distinct two-tone chime
engine.stop();
```

### HitTracker

```javascript
const tracker = new HitTracker({ outputLatency: 0.012 });
tracker.setBpm(120);
tracker.setGridConfig({ includeTriplets: false });
tracker.addExpectedBeat({ time, beatIndex, barNumber, kind, skipped });
tracker.addHit({ time, energy });    // returns { gridOffsetMs, clickOffsetMs, hasFlam, status, … }
tracker.getStats({ now, windowSeconds: 8 });
```

### ScaleManager

```javascript
const scaleManager = new ScaleManager('D3', 'major');
scaleManager.setRootNote('E3');
scaleManager.setScaleType('minor');
const scaleInfo = scaleManager.getScaleInfo();
```

### TonePlayer

```javascript
const tonePlayer = new TonePlayer();
tonePlayer.playTone(440, 0.5);  // 440Hz for 0.5 seconds
tonePlayer.startDrone(146.83);  // sustained drone
```

## Adding a new tool

1. Create directory: `src/tools/my-tool/`
2. Build a `MyToolPage.jsx` (own services, lay out toolbar/canvas/sidebar)
3. Add the tool to `src/tools/registry.js`:

```jsx
import { Activity } from 'lucide-react';

const MyToolPage = lazy(() => import('./my-tool/MyToolPage.jsx'));

export const tools = [
  // …existing tools
  {
    id: 'my-tool',
    path: '/my-tool',
    name: 'My Tool',
    tagline: 'What it does in one phrase',
    description: 'Longer card description for the index.',
    icon: Activity,
    Component: MyToolPage,
  },
];
```

The router and the tool index page pick it up automatically — no changes to `App.jsx` or `index.html` are needed.

## Adding a new scale

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

Then add an entry to the `SCALE_GROUPS` constant in `src/tools/vocal-monitor/Sidebar.jsx`.

## Performance

### Pitch detection
- Runs every 30ms (configurable)
- Buffer size: 8192 samples
- Target latency: <50ms

### Metronome
- Lookahead scheduler: 25ms timer, 120ms ahead window
- Onset detection on AnalyserNode (1024 samples ≈ 23ms), peak-index timestamp ≈ ±0.5ms accuracy
- Listen-back panel canvas runs on requestAnimationFrame; per-frame stats refresh capped at 4Hz

### Rendering
- ResizeObserver handles responsive canvas
- DPR-aware rendering for retina displays

## Deployment

Production hosting is **AWS S3 + CloudFront** at `flappynote.com`. Use the bundled `deploy.sh` script:

```bash
./deploy.sh
```

It builds (`npm run build`), syncs `dist/` to the `flappynote.com` S3 bucket, and invalidates the matching CloudFront distribution. Requires `.env` with:

```
VITE_GA_MEASUREMENT_ID=G-…
AWS_ACCESS_KEY_ID=…
AWS_SECRET_ACCESS_KEY=…
AWS_ACCOUNT_ID=…
```

You can also `npm run build` to produce `dist/` and host it elsewhere.

### Hosting requirements
- HTTPS (browsers require it for microphone access)
- SPA routing — fall back any non-asset path to `index.html`. On CloudFront this is handled via Custom Error Responses (403/404 → `/index.html`, status 200). `_redirects` (Netlify) and `404.html` (GitHub Pages) are also bundled for alternate hosts.

### Environment variables
- `VITE_GA_MEASUREMENT_ID` — Google Analytics ID. When unset, the GA snippet doesn't load and `analytics.js` is a silent no-op.

## Resources

- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [TensorFlow.js](https://www.tensorflow.org/js)
- [CREPE Paper](https://arxiv.org/abs/1802.06182)
- [Vite Documentation](https://vitejs.dev/)
- [Vitest Documentation](https://vitest.dev/)
