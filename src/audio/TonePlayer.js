/**
 * TonePlayer - Simple synthesizer for playing reference tones
 */

export class TonePlayer {
  constructor() {
    this.audioContext = null;
  }

  /**
   * Initialize audio context
   */
  initialize() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
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
    gainNode.connect(this.audioContext.destination);

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
   * Stop all sounds
   */
  stop() {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
