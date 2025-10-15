/**
 * FrequencyConverter - Utilities for converting between frequencies and musical notes
 */

export class FrequencyConverter {
  // A4 = 440 Hz is the standard reference
  static A4_FREQUENCY = 440;
  static A4_MIDI_NUMBER = 69;

  static NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  /**
   * Convert frequency to MIDI note number
   * @param {number} frequency - Frequency in Hz
   * @returns {number} MIDI note number (0-127)
   */
  static frequencyToMidi(frequency) {
    if (frequency <= 0) return 0;
    return 12 * Math.log2(frequency / this.A4_FREQUENCY) + this.A4_MIDI_NUMBER;
  }

  /**
   * Convert MIDI note number to frequency
   * @param {number} midiNote - MIDI note number (0-127)
   * @returns {number} Frequency in Hz
   */
  static midiToFrequency(midiNote) {
    return this.A4_FREQUENCY * Math.pow(2, (midiNote - this.A4_MIDI_NUMBER) / 12);
  }

  /**
   * Get note name from MIDI number
   * @param {number} midiNote - MIDI note number
   * @returns {string} Note name with octave (e.g., "C4")
   */
  static midiToNoteName(midiNote) {
    const octave = Math.floor(midiNote / 12) - 1;
    const noteIndex = Math.round(midiNote) % 12;
    return `${this.NOTE_NAMES[noteIndex]}${octave}`;
  }

  /**
   * Parse note name to MIDI number
   * @param {string} noteName - Note name (e.g., "C4", "A#3")
   * @returns {number} MIDI note number
   */
  static noteNameToMidi(noteName) {
    const match = noteName.match(/^([A-G]#?)(\d+)$/);
    if (!match) throw new Error(`Invalid note name: ${noteName}`);

    const [, note, octave] = match;
    const noteIndex = this.NOTE_NAMES.indexOf(note);
    if (noteIndex === -1) throw new Error(`Invalid note: ${note}`);

    return (parseInt(octave) + 1) * 12 + noteIndex;
  }

  /**
   * Convert frequency to note name
   * @param {number} frequency - Frequency in Hz
   * @returns {object} Object with noteName and centsOff
   */
  static frequencyToNote(frequency) {
    const midiNote = this.frequencyToMidi(frequency);
    const roundedMidi = Math.round(midiNote);
    const centsOff = (midiNote - roundedMidi) * 100;

    return {
      noteName: this.midiToNoteName(roundedMidi),
      midiNote: roundedMidi,
      centsOff: centsOff,
      frequency: frequency
    };
  }

  /**
   * Get cents difference between two frequencies
   * @param {number} freq1 - First frequency in Hz
   * @param {number} freq2 - Second frequency in Hz
   * @returns {number} Difference in cents
   */
  static getCentsDifference(freq1, freq2) {
    return 1200 * Math.log2(freq2 / freq1);
  }
}
