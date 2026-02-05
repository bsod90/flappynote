/**
 * TonePlayer - Simple synthesizer for playing reference tones
 */

export class TonePlayer {
  constructor() {
    this.audioContext = null;
    this.masterGain = null; // Master gain node for all sounds
    this.droneOscillators = null;
    this.droneGainNode = null;
    this.droneLFO = null;
    this.droneFilterLFO = null;
  }

  /**
   * Initialize audio context
   */
  initialize() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

      // Create master gain node for all sounds
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 1.0;
      this.masterGain.connect(this.audioContext.destination);
    }
  }

  /**
   * Play a single tone with harmonics for better mobile speaker audibility
   * @param {number} frequency - Frequency in Hz
   * @param {number} duration - Duration in seconds
   * @param {number} startTime - When to start (audioContext.currentTime + offset)
   * @returns {Promise} Resolves when tone finishes
   */
  playTone(frequency, duration = 0.5, startTime = null) {
    this.initialize();

    const start = startTime || this.audioContext.currentTime;
    const end = start + duration;

    // Create multiple oscillators for harmonics to make tones audible on mobile speakers
    // Mobile speakers struggle with low frequencies, so we add higher harmonics
    const oscillators = [];
    const gainNodes = [];

    // Fundamental frequency (original pitch)
    const fundamental = this.createOscillator(frequency, 0.4, start, end);
    oscillators.push(fundamental.oscillator);
    gainNodes.push(fundamental.gainNode);

    // Add octave above (2x frequency) for better audibility on small speakers
    const octave = this.createOscillator(frequency * 2, 0.3, start, end);
    oscillators.push(octave.oscillator);
    gainNodes.push(octave.gainNode);

    // Add higher harmonic (3x frequency) for brightness
    const harmonic = this.createOscillator(frequency * 3, 0.15, start, end);
    oscillators.push(harmonic.oscillator);
    gainNodes.push(harmonic.gainNode);

    return new Promise(resolve => {
      setTimeout(() => resolve(), duration * 1000);
    });
  }

  /**
   * Create an oscillator with gain envelope
   * @param {number} frequency - Frequency in Hz
   * @param {number} volume - Peak volume (0-1)
   * @param {number} start - Start time
   * @param {number} end - End time
   * @returns {object} Object with oscillator and gainNode
   */
  createOscillator(frequency, volume, start, end) {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain); // Connect to master gain instead of destination

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    // Envelope: fade in and out to avoid clicks
    gainNode.gain.setValueAtTime(0, start);
    gainNode.gain.linearRampToValueAtTime(volume, start + 0.05);
    gainNode.gain.setValueAtTime(volume, end - 0.05);
    gainNode.gain.linearRampToValueAtTime(0, end);

    oscillator.start(start);
    oscillator.stop(end);

    return { oscillator, gainNode };
  }

  /**
   * Play a sequence of tones
   * @param {Array<{frequency: number, duration: number}>} sequence
   * @returns {Promise} Resolves when sequence finishes
   */
  async playSequence(sequence) {
    this.initialize();

    let currentTime = this.audioContext.currentTime;

    for (const note of sequence) {
      this.playTone(note.frequency, note.duration, currentTime);
      currentTime += note.duration + 0.1; // Small gap between notes
    }

    // Wait for the entire sequence to finish
    const totalDuration = sequence.reduce((sum, note) => sum + note.duration + 0.1, 0);
    return new Promise(resolve => {
      setTimeout(() => resolve(), totalDuration * 1000);
    });
  }

  /**
   * Start playing a drone on the root note with subtle modulation
   * @param {number} frequency - Root note frequency in Hz
   */
  startDrone(frequency) {
    this.stopDrone(); // Stop any existing drone
    this.initialize();

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // Create main gain node for the drone
    this.droneGainNode = ctx.createGain();
    this.droneGainNode.gain.setValueAtTime(0, now);
    this.droneGainNode.gain.linearRampToValueAtTime(0.22, now + 2); // Slow fade in over 2 seconds (increased from 0.15)
    this.droneGainNode.connect(this.masterGain); // Connect to master gain instead of destination

    // Create a low-pass filter for warmth
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    filter.Q.value = 1;
    filter.connect(this.droneGainNode);

    // LFO for subtle filter modulation
    this.droneFilterLFO = ctx.createOscillator();
    const filterLFOGain = ctx.createGain();
    filterLFOGain.gain.value = 150; // Modulation depth
    this.droneFilterLFO.frequency.value = 0.3; // Slow modulation
    this.droneFilterLFO.connect(filterLFOGain);
    filterLFOGain.connect(filter.frequency);
    this.droneFilterLFO.start(now);

    // LFO for subtle amplitude modulation (creates a gentle pulse)
    this.droneLFO = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02; // Very subtle amplitude modulation
    this.droneLFO.frequency.value = 0.2; // Slow breathing effect
    this.droneLFO.connect(lfoGain);
    lfoGain.connect(this.droneGainNode.gain);
    this.droneLFO.start(now);

    // Create multiple oscillators for a richer drone sound
    this.droneOscillators = [];

    // Fundamental
    const osc1 = ctx.createOscillator();
    const osc1Gain = ctx.createGain();
    osc1.frequency.value = frequency;
    osc1.type = 'sine';
    osc1Gain.gain.value = 0.5;
    osc1.connect(osc1Gain);
    osc1Gain.connect(filter);
    osc1.start(now);
    this.droneOscillators.push(osc1);

    // Slightly detuned fundamental for chorus effect
    const osc2 = ctx.createOscillator();
    const osc2Gain = ctx.createGain();
    osc2.frequency.value = frequency * 1.002; // Very slight detune
    osc2.type = 'sine';
    osc2Gain.gain.value = 0.3;
    osc2.connect(osc2Gain);
    osc2Gain.connect(filter);
    osc2.start(now);
    this.droneOscillators.push(osc2);

    // Octave below for depth
    const osc3 = ctx.createOscillator();
    const osc3Gain = ctx.createGain();
    osc3.frequency.value = frequency / 2;
    osc3.type = 'sine';
    osc3Gain.gain.value = 0.4;
    osc3.connect(osc3Gain);
    osc3Gain.connect(filter);
    osc3.start(now);
    this.droneOscillators.push(osc3);

    // Fifth above for harmony
    const osc4 = ctx.createOscillator();
    const osc4Gain = ctx.createGain();
    osc4.frequency.value = frequency * 1.5; // Perfect fifth
    osc4.type = 'sine';
    osc4Gain.gain.value = 0.15;
    osc4.connect(osc4Gain);
    osc4Gain.connect(filter);
    osc4.start(now);
    this.droneOscillators.push(osc4);

    // Octave above (for mobile speaker audibility)
    const osc5 = ctx.createOscillator();
    const osc5Gain = ctx.createGain();
    osc5.frequency.value = frequency * 2;
    osc5.type = 'sine';
    osc5Gain.gain.value = 0.2;
    osc5.connect(osc5Gain);
    osc5Gain.connect(filter);
    osc5.start(now);
    this.droneOscillators.push(osc5);

    // Two octaves above (even more mobile audibility)
    const osc6 = ctx.createOscillator();
    const osc6Gain = ctx.createGain();
    osc6.frequency.value = frequency * 4;
    osc6.type = 'sine';
    osc6Gain.gain.value = 0.12;
    osc6.connect(osc6Gain);
    osc6Gain.connect(filter);
    osc6.start(now);
    this.droneOscillators.push(osc6);
  }

  /**
   * Stop the drone
   * @returns {Promise} Resolves when fade-out completes and oscillators are stopped
   */
  stopDrone() {
    return new Promise((resolve) => {
      if (!this.droneOscillators) {
        resolve();
        return;
      }

      const now = this.audioContext.currentTime;

      // Fade out over 1 second
      if (this.droneGainNode) {
        this.droneGainNode.gain.cancelScheduledValues(now);
        this.droneGainNode.gain.setValueAtTime(this.droneGainNode.gain.value, now);
        this.droneGainNode.gain.linearRampToValueAtTime(0, now + 1);
      }

      // Stop oscillators after fade out
      setTimeout(() => {
        if (this.droneOscillators) {
          this.droneOscillators.forEach(osc => {
            try {
              osc.stop();
            } catch (e) {
              // Oscillator may already be stopped
            }
          });
          this.droneOscillators = null;
        }

        if (this.droneLFO) {
          try {
            this.droneLFO.stop();
          } catch (e) {
            // LFO may already be stopped
          }
          this.droneLFO = null;
        }

        if (this.droneFilterLFO) {
          try {
            this.droneFilterLFO.stop();
          } catch (e) {
            // LFO may already be stopped
          }
          this.droneFilterLFO = null;
        }

        this.droneGainNode = null;
        resolve();
      }, 1100);
    });
  }

  /**
   * Update drone frequency (for when root note changes)
   * @param {number} frequency - New root note frequency
   */
  updateDroneFrequency(frequency) {
    if (this.droneOscillators && this.audioContext) {
      const now = this.audioContext.currentTime;
      // Smoothly transition to new frequency
      this.droneOscillators[0].frequency.linearRampToValueAtTime(frequency, now + 0.5);
      this.droneOscillators[1].frequency.linearRampToValueAtTime(frequency * 1.002, now + 0.5);
      this.droneOscillators[2].frequency.linearRampToValueAtTime(frequency / 2, now + 0.5);
      this.droneOscillators[3].frequency.linearRampToValueAtTime(frequency * 1.5, now + 0.5);
      this.droneOscillators[4].frequency.linearRampToValueAtTime(frequency * 2, now + 0.5);
      this.droneOscillators[5].frequency.linearRampToValueAtTime(frequency * 4, now + 0.5);
    }
  }

  /**
   * Start playing a chord drone (root, third, fifth)
   * @param {number} rootFrequency - Root note frequency in Hz
   * @param {string} chordType - 'major' or 'minor'
   */
  startChordDrone(rootFrequency, chordType = 'major') {
    this.stopChordDrone(); // Stop any existing chord drone
    this.initialize();

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // Calculate chord tones
    const thirdOffset = chordType === 'minor' ? 3 : 4; // Minor third = 3, Major third = 4 semitones
    const thirdFrequency = rootFrequency * Math.pow(2, thirdOffset / 12);
    const fifthFrequency = rootFrequency * Math.pow(2, 7 / 12); // Perfect fifth = 7 semitones

    // Create main gain node for the chord drone
    this.chordDroneGainNode = ctx.createGain();
    this.chordDroneGainNode.gain.setValueAtTime(0, now);
    this.chordDroneGainNode.gain.linearRampToValueAtTime(0.18, now + 2); // Slow fade in
    this.chordDroneGainNode.connect(this.masterGain);

    // Create a low-pass filter for warmth
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    filter.Q.value = 0.8;
    filter.connect(this.chordDroneGainNode);

    // LFO for subtle amplitude modulation
    this.chordDroneLFO = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.015;
    this.chordDroneLFO.frequency.value = 0.15;
    this.chordDroneLFO.connect(lfoGain);
    lfoGain.connect(this.chordDroneGainNode.gain);
    this.chordDroneLFO.start(now);

    // Store oscillators and their metadata
    this.chordDroneOscillators = [];
    this.chordDroneOscGains = [];
    this.chordType = chordType;
    this.chordRootFrequency = rootFrequency;

    // Create oscillators for each chord tone
    const createChordOsc = (frequency, volume) => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.frequency.value = frequency;
      osc.type = 'sine';
      oscGain.gain.value = volume;
      osc.connect(oscGain);
      oscGain.connect(filter);
      osc.start(now);
      this.chordDroneOscillators.push(osc);
      this.chordDroneOscGains.push(oscGain);
    };

    // Root - fundamental and octave
    createChordOsc(rootFrequency, 0.45);
    createChordOsc(rootFrequency / 2, 0.3); // Sub-octave
    createChordOsc(rootFrequency * 2, 0.15); // Octave above

    // Third
    createChordOsc(thirdFrequency, 0.35);
    createChordOsc(thirdFrequency * 2, 0.1); // Octave above

    // Fifth
    createChordOsc(fifthFrequency, 0.38);
    createChordOsc(fifthFrequency * 2, 0.12); // Octave above
  }

  /**
   * Stop the chord drone
   * @returns {Promise} Resolves when fade-out completes and oscillators are stopped
   */
  stopChordDrone() {
    return new Promise((resolve) => {
      if (!this.chordDroneOscillators) {
        resolve();
        return;
      }

      const now = this.audioContext.currentTime;

      // Fade out over 1 second
      if (this.chordDroneGainNode) {
        this.chordDroneGainNode.gain.cancelScheduledValues(now);
        this.chordDroneGainNode.gain.setValueAtTime(this.chordDroneGainNode.gain.value, now);
        this.chordDroneGainNode.gain.linearRampToValueAtTime(0, now + 1);
      }

      // Stop oscillators after fade out
      setTimeout(() => {
        if (this.chordDroneOscillators) {
          this.chordDroneOscillators.forEach(osc => {
            try {
              osc.stop();
            } catch (e) {
              // Oscillator may already be stopped
            }
          });
          this.chordDroneOscillators = null;
          this.chordDroneOscGains = null;
        }

        if (this.chordDroneLFO) {
          try {
            this.chordDroneLFO.stop();
          } catch (e) {
            // LFO may already be stopped
          }
          this.chordDroneLFO = null;
        }

        this.chordDroneGainNode = null;
        resolve();
      }, 1100);
    });
  }

  /**
   * Update chord drone frequency and type
   * @param {number} rootFrequency - New root frequency
   * @param {string} chordType - 'major' or 'minor'
   */
  updateChordDroneFrequency(rootFrequency, chordType = 'major') {
    if (this.chordDroneOscillators && this.audioContext) {
      const now = this.audioContext.currentTime;

      // Calculate new chord tones
      const thirdOffset = chordType === 'minor' ? 3 : 4;
      const thirdFrequency = rootFrequency * Math.pow(2, thirdOffset / 12);
      const fifthFrequency = rootFrequency * Math.pow(2, 7 / 12);

      // Update oscillators (order matches creation order)
      // Root: 0, 1, 2
      this.chordDroneOscillators[0].frequency.linearRampToValueAtTime(rootFrequency, now + 0.5);
      this.chordDroneOscillators[1].frequency.linearRampToValueAtTime(rootFrequency / 2, now + 0.5);
      this.chordDroneOscillators[2].frequency.linearRampToValueAtTime(rootFrequency * 2, now + 0.5);

      // Third: 3, 4
      this.chordDroneOscillators[3].frequency.linearRampToValueAtTime(thirdFrequency, now + 0.5);
      this.chordDroneOscillators[4].frequency.linearRampToValueAtTime(thirdFrequency * 2, now + 0.5);

      // Fifth: 5, 6
      this.chordDroneOscillators[5].frequency.linearRampToValueAtTime(fifthFrequency, now + 0.5);
      this.chordDroneOscillators[6].frequency.linearRampToValueAtTime(fifthFrequency * 2, now + 0.5);

      this.chordType = chordType;
      this.chordRootFrequency = rootFrequency;
    }
  }

  /**
   * Check if chord drone is playing
   * @returns {boolean}
   */
  isChordDronePlaying() {
    return this.chordDroneOscillators != null;
  }

  /**
   * Stop all sounds
   */
  async stop() {
    await Promise.all([
      this.stopDrone(),
      this.stopChordDrone(),
    ]);
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
