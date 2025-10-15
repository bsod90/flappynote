# Pitch Detection Fixes & Debug Overlay

## Issues Fixed

### 1. Pitch Detection Threshold Too High
**Problem:** The autocorrelation threshold was set to 0.9 (90% correlation), which is extremely strict and would reject most real-world vocal input.

**Solution:** Lowered the correlation threshold to 0.5 (50%), which is more realistic for human voice pitch detection.

**Files Changed:**
- `src/pitch-engine/AudioAnalyzer.js` - Line 142

### 2. RMS Threshold Too High
**Problem:** The RMS (volume) threshold was 0.1, which might be too high for some microphones or quiet singing.

**Solution:** Lowered the RMS threshold to 0.01, making the detector more sensitive to quieter input.

**Files Changed:**
- `src/pitch-engine/AudioAnalyzer.js` - Line 11

### 3. Inefficient Autocorrelation Search
**Problem:** The autocorrelation was searching all offsets, including very small ones that don't correspond to realistic pitches.

**Solution:** Added min/max period bounds based on the frequency range (60-1200 Hz), making the search more efficient and accurate.

**Files Changed:**
- `src/pitch-engine/AudioAnalyzer.js` - Lines 129-131

## Debug Overlay Added

### Features
1. **Audio Input Monitoring**
   - RMS level with visual bar
   - Correlation strength indicator
   - Sample rate display
   - Threshold values

2. **Pitch Detection Info**
   - Current frequency (Hz)
   - Note name
   - Cents deviation from nearest note
   - MIDI note number

3. **Chromatic Pitch Visualizer**
   - Visual tuner showing pitch across chromatic scale (C-B)
   - Color-coded accuracy:
     - Green: ±10 cents (perfect)
     - Orange: ±25 cents (close)
     - Red: >25 cents (off)

4. **Target Information**
   - Current target note from game
   - Target frequency
   - Cents from target
   - Match status (singing correct note)

### Usage

**In Development:**
- Debug overlay toggle button appears automatically (bottom-right corner)
- Click the 🎵 button to show/hide debug overlay
- Keyboard shortcut: `Ctrl+D` (Windows/Linux) or `Cmd+D` (Mac)

**In Production:**
- Debug toggle is hidden by default
- Can be enabled by:
  1. Opening browser console
  2. Running: `localStorage.setItem('tralala-debug', 'true')`
  3. Refreshing the page
  4. Click the 🎵 button or use `Ctrl/Cmd+D`

### Files Added
- `src/ui/DebugOverlay.js` - Debug overlay component
- Debug styles in `src/ui/styles.css` (lines 207-378)

### Files Modified
- `src/main.js` - Integrated debug overlay
- `src/pitch-engine/AudioAnalyzer.js` - Added debug info tracking
- `src/pitch-engine/PitchDetector.js` - Exposed debug info API
- `index.html` - Added debug toggle button

## Testing the Fixes

1. Start the dev server: `npm run dev`
2. Open the game in your browser
3. Click "Start Game" and allow microphone access
4. Click the 🎵 button (bottom-right) to open debug overlay
5. Sing or hum into your microphone
6. Watch the debug overlay:
   - **RMS Level** should increase when you make sound
   - **Correlation** should show >0.5 when pitch is detected
   - **Frequency** should appear and match your pitch
   - **Pitch Visualizer** should show a moving indicator

## Common Issues & Solutions

### "No pitch detected" even when singing
- Check **RMS Level**: If it's not moving, microphone isn't working
- Check **Correlation**: Should be >0.5 for pitch detection
- Try singing louder or closer to the microphone
- Ensure browser has microphone permission

### Pitch detected but ball doesn't move
- Check **Target Note** in debug overlay
- Check **Cents from Target** - should be within ±50 cents
- Check **Matching** status - should show "✓ YES" when singing correct note
- Try singing the exact note shown in the target

### Microphone not working
- Check browser permissions
- Try a different browser (Chrome/Firefox recommended)
- Check OS microphone permissions
- Ensure no other app is using the microphone

## Future Improvements

1. **Auto-calibration**: Automatically adjust RMS threshold based on user's microphone
2. **Advanced algorithms**: Implement YIN or CREPE for better pitch detection
3. **Noise filtering**: Add spectral analysis to filter out background noise
4. **Visual waveform**: Show real-time audio waveform in debug overlay
5. **Recording/playback**: Record singing attempts for analysis
