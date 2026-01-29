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
        <h4>Volume (Adaptive)</h4>
        <div class="debug-row">
          <span>Raw RMS:</span>
          <span id="raw-rms-value">--</span>
        </div>
        <div class="debug-row">
          <span>Normalized:</span>
          <div class="progress-bar">
            <div id="volume-bar" class="progress-fill"></div>
          </div>
          <span id="volume-value">--</span>
        </div>
        <div class="debug-row">
          <span>Range:</span>
          <span id="rms-range">--</span>
        </div>
      </div>
      <div class="debug-section">
        <h4>Vocal Analysis</h4>
        <div class="debug-row">
          <span>Vibrato:</span>
          <span id="vibrato-status">--</span>
        </div>
        <div class="debug-row">
          <span>Vibrato Rate:</span>
          <span id="vibrato-rate">-- Hz</span>
        </div>
        <div class="debug-row">
          <span>Vibrato Extent:</span>
          <span id="vibrato-extent">-- cents</span>
        </div>
        <div class="debug-row">
          <span>Stability:</span>
          <div class="progress-bar">
            <div id="stability-bar" class="progress-fill"></div>
          </div>
          <span id="stability-value">--</span>
        </div>
        <div class="debug-row">
          <span>Brightness:</span>
          <div class="progress-bar">
            <div id="brightness-bar" class="progress-fill brightness"></div>
          </div>
          <span id="brightness-value">--</span>
        </div>
        <div class="debug-row">
          <span>Breathiness:</span>
          <div class="progress-bar">
            <div id="breathiness-bar" class="progress-fill breathiness"></div>
          </div>
          <span id="breathiness-value">--</span>
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
   * @param {object} pitchData - Current pitch data
   * @param {object} debugInfo - Debug info from pitch detector
   * @param {object} targetGate - Target gate (for game)
   * @param {boolean} isSinging - Whether currently singing
   * @param {object} volumeInfo - Optional volume tracking info {rmsMin, rmsMax}
   */
  update(pitchData, debugInfo, targetGate, isSinging, volumeInfo = null) {
    if (!this.enabled || !this.container) return;

    // Update volume info
    this.updateVolumeDisplay(pitchData, volumeInfo);

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

      // Update vocal analysis info
      this.updateVocalAnalysis(pitchData.vocalAnalysis);
    } else {
      document.getElementById('debug-freq').textContent = '-- Hz';
      document.getElementById('debug-note').textContent = '--';
      document.getElementById('debug-cents').textContent = '--';
      document.getElementById('debug-midi').textContent = '--';

      // Hide pitch indicator
      const indicator = document.getElementById('pitch-indicator');
      if (indicator) indicator.style.display = 'none';

      // Clear vocal analysis
      this.updateVocalAnalysis(null);
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
   * Update volume display
   */
  updateVolumeDisplay(pitchData, volumeInfo) {
    const rawRmsEl = document.getElementById('raw-rms-value');
    const volumeBarEl = document.getElementById('volume-bar');
    const volumeValueEl = document.getElementById('volume-value');
    const rmsRangeEl = document.getElementById('rms-range');

    // Always update range if available
    if (rmsRangeEl && volumeInfo) {
      rmsRangeEl.textContent = `${(volumeInfo.rmsMin * 1000).toFixed(1)} - ${(volumeInfo.rmsMax * 1000).toFixed(1)}`;
    }

    if (!pitchData || pitchData.rms === undefined || pitchData.rms === null) {
      if (rawRmsEl) rawRmsEl.textContent = '--';
      if (volumeBarEl) volumeBarEl.style.width = '0%';
      if (volumeValueEl) volumeValueEl.textContent = '--';
      return;
    }

    const rms = pitchData.rms;
    const normalizedRMS = pitchData.normalizedRMS ?? 0;

    if (rawRmsEl) {
      rawRmsEl.textContent = (rms * 1000).toFixed(2); // Show as x1000 for readability
    }

    if (volumeBarEl) {
      volumeBarEl.style.width = `${normalizedRMS * 100}%`;
      // Color gradient from quiet (blue) to loud (red)
      const r = Math.round(100 + normalizedRMS * 155);
      const g = Math.round(180 - normalizedRMS * 80);
      const b = Math.round(200 - normalizedRMS * 150);
      volumeBarEl.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
    }

    if (volumeValueEl) {
      volumeValueEl.textContent = `${(normalizedRMS * 100).toFixed(0)}%`;
    }
  }

  /**
   * Update vocal analysis display
   */
  updateVocalAnalysis(vocalAnalysis) {
    const vibratoStatusEl = document.getElementById('vibrato-status');
    const vibratoRateEl = document.getElementById('vibrato-rate');
    const vibratoExtentEl = document.getElementById('vibrato-extent');
    const stabilityBarEl = document.getElementById('stability-bar');
    const stabilityValueEl = document.getElementById('stability-value');
    const brightnessBarEl = document.getElementById('brightness-bar');
    const brightnessValueEl = document.getElementById('brightness-value');
    const breathinessBarEl = document.getElementById('breathiness-bar');
    const breathinessValueEl = document.getElementById('breathiness-value');

    if (!vocalAnalysis) {
      if (vibratoStatusEl) vibratoStatusEl.textContent = '--';
      if (vibratoRateEl) vibratoRateEl.textContent = '-- Hz';
      if (vibratoExtentEl) vibratoExtentEl.textContent = '-- cents';
      if (stabilityBarEl) stabilityBarEl.style.width = '0%';
      if (stabilityValueEl) stabilityValueEl.textContent = '--';
      if (brightnessBarEl) brightnessBarEl.style.width = '0%';
      if (brightnessValueEl) brightnessValueEl.textContent = '--';
      if (breathinessBarEl) breathinessBarEl.style.width = '0%';
      if (breathinessValueEl) breathinessValueEl.textContent = '--';
      return;
    }

    // Vibrato
    const vibrato = vocalAnalysis.vibrato || {};
    if (vibratoStatusEl) {
      vibratoStatusEl.textContent = vibrato.detected ? '✓ Detected' : '✗ None';
      vibratoStatusEl.style.color = vibrato.detected ? '#2ecc71' : '#95a5a6';
    }
    if (vibratoRateEl) {
      vibratoRateEl.textContent = vibrato.detected ? `${vibrato.rate.toFixed(1)} Hz` : '-- Hz';
    }
    if (vibratoExtentEl) {
      vibratoExtentEl.textContent = vibrato.detected ? `${vibrato.extent.toFixed(0)} cents` : '-- cents';
    }

    // Stability
    const stability = vocalAnalysis.stability ?? 0;
    if (stabilityBarEl) {
      stabilityBarEl.style.width = `${stability * 100}%`;
      stabilityBarEl.style.backgroundColor = stability > 0.7 ? '#2ecc71' : stability > 0.4 ? '#f39c12' : '#e74c3c';
    }
    if (stabilityValueEl) {
      stabilityValueEl.textContent = `${(stability * 100).toFixed(0)}%`;
    }

    // Brightness (spectral centroid)
    const brightness = vocalAnalysis.spectralCentroid ?? 0.5;
    if (brightnessBarEl) {
      brightnessBarEl.style.width = `${brightness * 100}%`;
      // Color gradient from cool (dark) to warm (bright)
      const r = Math.round(107 + (255 - 107) * brightness);
      const g = Math.round(122 + (200 - 122) * brightness);
      const b = Math.round(255 - (255 - 53) * brightness);
      brightnessBarEl.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
    }
    if (brightnessValueEl) {
      brightnessValueEl.textContent = `${(brightness * 100).toFixed(0)}%`;
    }

    // Breathiness (inverse of HNR)
    const breathiness = 1 - (vocalAnalysis.hnr ?? 0.5);
    if (breathinessBarEl) {
      breathinessBarEl.style.width = `${breathiness * 100}%`;
      breathinessBarEl.style.backgroundColor = breathiness > 0.5 ? '#9b59b6' : '#3498db';
    }
    if (breathinessValueEl) {
      breathinessValueEl.textContent = `${(breathiness * 100).toFixed(0)}%`;
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
