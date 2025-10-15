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
   * Play a single tone
   * @param {number} frequency - Frequency in Hz
   * @param {number} duration - Duration in seconds
   * @param {number} startTime - When to start (audioContext.currentTime + offset)
   * @returns {Promise} Resolves when tone finishes
   */
  playTone(frequency, duration = 0.5, startTime = null) {
    this.initialize();

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    const start = startTime || this.audioContext.currentTime;
    const end = start + duration;

    // Envelope: fade in and out to avoid clicks
    gainNode.gain.setValueAtTime(0, start);
    gainNode.gain.linearRampToValueAtTime(0.3, start + 0.05);
    gainNode.gain.setValueAtTime(0.3, end - 0.05);
    gainNode.gain.linearRampToValueAtTime(0, end);

    oscillator.start(start);
    oscillator.stop(end);

    return new Promise(resolve => {
      setTimeout(() => resolve(), duration * 1000);
    });
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
