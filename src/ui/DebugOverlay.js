/**
 * DebugOverlay - Visual debug information for pitch detection
 */

export class DebugOverlay {
  constructor(containerId = 'debug-overlay') {
    this.container = null;
    this.enabled = false;
    this.containerId = containerId;
  }

  /**
   * Initialize and show the debug overlay
   */
  show() {
    if (this.container) return;

    this.enabled = true;
    this.container = document.createElement('div');
    this.container.id = this.containerId;
    this.container.className = 'debug-overlay';
    this.container.innerHTML = `
      <div class="debug-header">
        <h3>Debug Info</h3>
        <button id="close-debug">×</button>
      </div>
      <div class="debug-section">
        <h4>Detector</h4>
        <div class="debug-row">
          <span>Algorithm:</span>
          <span id="detector-type">--</span>
        </div>
        <div class="debug-row">
          <span>Status:</span>
          <span id="detector-status">--</span>
        </div>
      </div>
      <div class="debug-section">
        <h4>Audio Input</h4>
        <div class="debug-row">
          <span>RMS Level:</span>
          <div class="progress-bar">
            <div id="rms-bar" class="progress-fill"></div>
          </div>
          <span id="rms-value">0.000</span>
        </div>
        <div class="debug-row">
          <span>Threshold:</span>
          <span id="threshold-value">0.01</span>
        </div>
        <div class="debug-row">
          <span>Correlation:</span>
          <div class="progress-bar">
            <div id="correlation-bar" class="progress-fill"></div>
          </div>
          <span id="correlation-value">0.00</span>
        </div>
        <div class="debug-row">
          <span>Sample Rate:</span>
          <span id="sample-rate">--</span>
        </div>
      </div>
      <div class="debug-section">
        <h4>Pitch Detection</h4>
        <div class="debug-row">
          <span>Frequency:</span>
          <span id="debug-freq">-- Hz</span>
        </div>
        <div class="debug-row">
          <span>Note:</span>
          <span id="debug-note">--</span>
        </div>
        <div class="debug-row">
          <span>Cents Off:</span>
          <span id="debug-cents">--</span>
        </div>
        <div class="debug-row">
          <span>MIDI:</span>
          <span id="debug-midi">--</span>
        </div>
      </div>
      <div class="debug-section">
        <h4>Pitch Visualizer</h4>
        <div id="pitch-visualizer">
          <div class="chromatic-notes">
            ${this.generateChromaticNotes()}
          </div>
          <div id="pitch-indicator" class="pitch-indicator"></div>
        </div>
      </div>
      <div class="debug-section">
        <h4>Target Info</h4>
        <div class="debug-row">
          <span>Target Note:</span>
          <span id="target-note">--</span>
        </div>
        <div class="debug-row">
          <span>Target Freq:</span>
          <span id="target-freq">-- Hz</span>
        </div>
        <div class="debug-row">
          <span>Cents from Target:</span>
          <span id="target-cents">--</span>
        </div>
        <div class="debug-row">
          <span>Matching:</span>
          <span id="is-matching">--</span>
        </div>
      </div>
    `;

    document.body.appendChild(this.container);

    // Add close button handler
    document.getElementById('close-debug').addEventListener('click', () => {
      this.hide();
    });
  }

  /**
   * Generate chromatic note labels
   */
  generateChromaticNotes() {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return notes.map(note => `<div class="note-label">${note}</div>`).join('');
  }

  /**
   * Hide the debug overlay
   */
  hide() {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    this.enabled = false;
  }

  /**
   * Update debug information
   */
  update(pitchData, debugInfo, targetGate, isSinging) {
    if (!this.enabled || !this.container) return;

    // Update detector info
    if (debugInfo.detector) {
      const detectorInfo = debugInfo.detector;
      const detectorTypeEl = document.getElementById('detector-type');
      const detectorStatusEl = document.getElementById('detector-status');

      if (detectorTypeEl) {
        const typeNames = {
          'hybrid': 'Hybrid (MPM+YIN)',
          'crepe': 'CREPE (TensorFlow.js)',
          'crepe-tf': 'CREPE (TensorFlow.js)',
        };
        const activeName = detectorInfo.active || detectorInfo.type;
        detectorTypeEl.textContent = typeNames[activeName] || activeName;
      }

      if (detectorStatusEl) {
        detectorStatusEl.textContent = detectorInfo.ready ? '✓ Ready' : '⏳ Loading...';
        detectorStatusEl.style.color = detectorInfo.ready ? '#2ecc71' : '#f39c12';
      }
    }

    // Update audio input stats
    const rmsValue = debugInfo.rms || 0;
    const rmsPercent = Math.min((rmsValue / 0.1) * 100, 100);
    document.getElementById('rms-bar').style.width = `${rmsPercent}%`;
    document.getElementById('rms-value').textContent = rmsValue.toFixed(4);
    document.getElementById('threshold-value').textContent = debugInfo.threshold.toFixed(3);

    const correlation = debugInfo.correlation || 0;
    const corrPercent = correlation * 100;
    document.getElementById('correlation-bar').style.width = `${corrPercent}%`;
    document.getElementById('correlation-value').textContent = correlation.toFixed(2);

    document.getElementById('sample-rate').textContent = `${debugInfo.sampleRate} Hz`;

    // Update pitch detection info
    if (pitchData) {
      document.getElementById('debug-freq').textContent = `${pitchData.frequency.toFixed(2)} Hz`;
      document.getElementById('debug-note').textContent = pitchData.noteName;
      document.getElementById('debug-cents').textContent = `${pitchData.centsOff >= 0 ? '+' : ''}${pitchData.centsOff.toFixed(1)}¢`;
      document.getElementById('debug-midi').textContent = pitchData.midiNote;

      // Update pitch visualizer
      this.updatePitchVisualizer(pitchData);
    } else {
      document.getElementById('debug-freq').textContent = '-- Hz';
      document.getElementById('debug-note').textContent = '--';
      document.getElementById('debug-cents').textContent = '--';
      document.getElementById('debug-midi').textContent = '--';

      // Hide pitch indicator
      const indicator = document.getElementById('pitch-indicator');
      if (indicator) indicator.style.display = 'none';
    }

    // Update target info
    if (targetGate) {
      document.getElementById('target-note').textContent = targetGate.degreeLabel;
      document.getElementById('target-freq').textContent = `${targetGate.targetFrequency.toFixed(2)} Hz`;

      if (pitchData) {
        const cents = 1200 * Math.log2(pitchData.frequency / targetGate.targetFrequency);
        document.getElementById('target-cents').textContent = `${cents >= 0 ? '+' : ''}${cents.toFixed(1)}¢`;
      } else {
        document.getElementById('target-cents').textContent = '--';
      }

      document.getElementById('is-matching').textContent = isSinging ? '✓ YES' : '✗ NO';
      document.getElementById('is-matching').style.color = isSinging ? '#2ecc71' : '#e74c3c';
    } else {
      document.getElementById('target-note').textContent = '--';
      document.getElementById('target-freq').textContent = '-- Hz';
      document.getElementById('target-cents').textContent = '--';
      document.getElementById('is-matching').textContent = '--';
    }
  }

  /**
   * Update the pitch visualizer position
   */
  updatePitchVisualizer(pitchData) {
    const indicator = document.getElementById('pitch-indicator');
    if (!indicator) return;

    indicator.style.display = 'block';

    // Calculate position based on note within octave
    const noteIndex = pitchData.midiNote % 12;
    const centsOffset = pitchData.centsOff;

    // Each note is 1/12 of the width
    const noteWidth = 100 / 12;
    const position = (noteIndex * noteWidth) + (centsOffset / 100 * noteWidth);

    indicator.style.left = `${position}%`;

    // Color based on accuracy
    if (Math.abs(centsOffset) < 10) {
      indicator.style.backgroundColor = '#2ecc71'; // Green - perfect
    } else if (Math.abs(centsOffset) < 25) {
      indicator.style.backgroundColor = '#f39c12'; // Orange - close
    } else {
      indicator.style.backgroundColor = '#e74c3c'; // Red - off
    }
  }

  /**
   * Toggle debug overlay
   */
  toggle() {
    if (this.enabled) {
      this.hide();
    } else {
      this.show();
    }
  }
}
