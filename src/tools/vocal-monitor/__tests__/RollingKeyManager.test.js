/**
 * Tests for RollingKeyManager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RollingKeyManager } from '../RollingKeyManager.js';

describe('RollingKeyManager', () => {
  let manager;

  beforeEach(() => {
    manager = new RollingKeyManager();
  });

  describe('initial state', () => {
    it('should default to static mode', () => {
      expect(manager.mode).toBe('static');
      expect(manager.isRolling()).toBe(false);
    });

    it('should have default range C3 to G4', () => {
      expect(manager.lowestRoot).toBe(48); // C3
      expect(manager.highestRoot).toBe(67); // G4
    });

    it('should default to ascending direction', () => {
      expect(manager.direction).toBe('ascending');
    });

    it('should default to semitone steps', () => {
      expect(manager.stepType).toBe('semitone');
    });
  });

  describe('configure', () => {
    it('should update mode', () => {
      manager.configure({ mode: 'rolling' });
      expect(manager.mode).toBe('rolling');
      expect(manager.isRolling()).toBe(true);
    });

    it('should update range', () => {
      manager.configure({ lowestRoot: 36, highestRoot: 72 });
      expect(manager.lowestRoot).toBe(36);
      expect(manager.highestRoot).toBe(72);
    });

    it('should update direction', () => {
      manager.configure({ direction: 'descending' });
      expect(manager.direction).toBe('descending');
    });

    it('should update step type', () => {
      manager.configure({ stepType: 'wholeTone' });
      expect(manager.stepType).toBe('wholeTone');
    });
  });

  describe('reset', () => {
    it('should reset to lowest root when ascending', () => {
      manager.configure({ mode: 'rolling', lowestRoot: 48, highestRoot: 60 });
      manager.currentRootMidi = 55;
      manager.reset();

      expect(manager.currentRootMidi).toBe(48);
      expect(manager.isComplete()).toBe(false);
    });

    it('should reset to highest root when descending', () => {
      manager.configure({
        mode: 'rolling',
        lowestRoot: 48,
        highestRoot: 60,
        direction: 'descending',
      });
      manager.currentRootMidi = 55;
      manager.reset();

      expect(manager.currentRootMidi).toBe(60);
    });

    it('should accept explicit starting root', () => {
      manager.configure({ mode: 'rolling' });
      manager.reset(55);

      expect(manager.currentRootMidi).toBe(55);
    });
  });

  describe('getCurrentRootNote', () => {
    it('should return note name with octave', () => {
      manager.currentRootMidi = 48; // C3
      expect(manager.getCurrentRootNote()).toBe('C3');

      manager.currentRootMidi = 61; // C#4
      expect(manager.getCurrentRootNote()).toBe('C#4');
    });
  });

  describe('advanceToNextKey - semitone', () => {
    beforeEach(() => {
      manager.configure({
        mode: 'rolling',
        lowestRoot: 48,
        highestRoot: 51,
        direction: 'ascending',
        stepType: 'semitone',
      });
      manager.reset();
    });

    it('should advance by one semitone', () => {
      expect(manager.currentRootMidi).toBe(48);

      const advanced = manager.advanceToNextKey();
      expect(advanced).toBe(true);
      expect(manager.currentRootMidi).toBe(49);
    });

    it('should wrap to lowest root at end of ascending range', () => {
      manager.currentRootMidi = 51; // At highest
      const advanced = manager.advanceToNextKey();

      expect(advanced).toBe(true);
      expect(manager.currentRootMidi).toBe(48); // Wrapped to lowest
    });

    it('should not advance in static mode', () => {
      manager.configure({ mode: 'static' });
      const advanced = manager.advanceToNextKey();

      expect(advanced).toBe(false);
    });
  });

  describe('advanceToNextKey - whole tone', () => {
    beforeEach(() => {
      manager.configure({
        mode: 'rolling',
        lowestRoot: 48,
        highestRoot: 54,
        direction: 'ascending',
        stepType: 'wholeTone',
      });
      manager.reset();
    });

    it('should advance by two semitones', () => {
      expect(manager.currentRootMidi).toBe(48);

      manager.advanceToNextKey();
      expect(manager.currentRootMidi).toBe(50);

      manager.advanceToNextKey();
      expect(manager.currentRootMidi).toBe(52);
    });

    it('should wrap at range boundary', () => {
      manager.currentRootMidi = 54;
      const advanced = manager.advanceToNextKey();

      expect(advanced).toBe(true);
      expect(manager.currentRootMidi).toBe(48); // Wrapped to lowest
    });
  });

  describe('advanceToNextKey - descending', () => {
    beforeEach(() => {
      manager.configure({
        mode: 'rolling',
        lowestRoot: 48,
        highestRoot: 51,
        direction: 'descending',
        stepType: 'semitone',
      });
      manager.reset();
    });

    it('should start at highest and descend', () => {
      expect(manager.currentRootMidi).toBe(51);

      manager.advanceToNextKey();
      expect(manager.currentRootMidi).toBe(50);
    });

    it('should wrap to highest root at end of descending range', () => {
      manager.currentRootMidi = 48;
      const advanced = manager.advanceToNextKey();

      expect(advanced).toBe(true);
      expect(manager.currentRootMidi).toBe(51); // Wrapped to highest
    });
  });

  describe('wrap count', () => {
    beforeEach(() => {
      manager.configure({
        mode: 'rolling',
        lowestRoot: 48,
        highestRoot: 50,
        direction: 'ascending',
        stepType: 'semitone',
      });
      manager.reset();
    });

    it('should increment wrap count on each full traversal', () => {
      expect(manager.getWrapCount()).toBe(0);

      // 48 → 49 → 50 → wrap → 48
      manager.advanceToNextKey(); // 49
      manager.advanceToNextKey(); // 50
      manager.advanceToNextKey(); // wraps to 48

      expect(manager.getWrapCount()).toBe(1);

      // Another full traversal
      manager.advanceToNextKey(); // 49
      manager.advanceToNextKey(); // 50
      manager.advanceToNextKey(); // wraps to 48

      expect(manager.getWrapCount()).toBe(2);
    });

    it('should reset wrap count on reset()', () => {
      manager.advanceToNextKey();
      manager.advanceToNextKey();
      manager.advanceToNextKey(); // wraps

      expect(manager.getWrapCount()).toBe(1);

      manager.reset();
      expect(manager.getWrapCount()).toBe(0);
    });
  });

  describe('getProgress', () => {
    beforeEach(() => {
      manager.configure({
        mode: 'rolling',
        lowestRoot: 48,
        highestRoot: 58, // 10 semitone range
        direction: 'ascending',
      });
      manager.reset();
    });

    it('should return 0 at start of ascending', () => {
      expect(manager.getProgress()).toBe(0);
    });

    it('should return 0.5 at middle', () => {
      manager.currentRootMidi = 53;
      expect(manager.getProgress()).toBe(0.5);
    });

    it('should return 1 at end', () => {
      manager.currentRootMidi = 58;
      expect(manager.getProgress()).toBe(1);
    });

    it('should always return 1 in static mode', () => {
      manager.configure({ mode: 'static' });
      expect(manager.getProgress()).toBe(1);
    });
  });

  describe('getTotalKeys', () => {
    it('should calculate correct count for semitone steps', () => {
      manager.configure({
        lowestRoot: 48,
        highestRoot: 53,
        stepType: 'semitone',
      });

      expect(manager.getTotalKeys()).toBe(6); // 48, 49, 50, 51, 52, 53
    });

    it('should calculate correct count for whole tone steps', () => {
      manager.configure({
        lowestRoot: 48,
        highestRoot: 54,
        stepType: 'wholeTone',
      });

      expect(manager.getTotalKeys()).toBe(4); // 48, 50, 52, 54
    });
  });

  describe('getState', () => {
    it('should return complete state object', () => {
      manager.configure({
        mode: 'rolling',
        lowestRoot: 48,
        highestRoot: 60,
        direction: 'ascending',
        stepType: 'semitone',
      });
      manager.reset();

      const state = manager.getState();

      expect(state.mode).toBe('rolling');
      expect(state.lowestRoot).toBe(48);
      expect(state.highestRoot).toBe(60);
      expect(state.direction).toBe('ascending');
      expect(state.stepType).toBe('semitone');
      expect(state.currentRootMidi).toBe(48);
      expect(state.currentRootNote).toBe('C3');
      expect(state.isComplete).toBe(false);
      expect(state.wrapCount).toBe(0);
      expect(state.progress).toBe(0);
    });
  });
});
