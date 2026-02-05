/**
 * Tests for ScaleTimeline
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ScaleTimeline } from '../ScaleTimeline.js';

describe('ScaleTimeline', () => {
  let timeline;

  beforeEach(() => {
    timeline = new ScaleTimeline();
  });

  describe('initial state', () => {
    it('should have default initial key', () => {
      const key = timeline.getKeyAtTime(0);
      expect(key.rootNote).toBe('C3');
      expect(key.scaleType).toBe('major');
    });

    it('should have no key changes initially', () => {
      expect(timeline.getKeyChangeCount()).toBe(0);
    });
  });

  describe('setInitialKey', () => {
    it('should set the initial key', () => {
      timeline.setInitialKey('D3', 'minor');
      const key = timeline.getKeyAtTime(0);
      expect(key.rootNote).toBe('D3');
      expect(key.scaleType).toBe('minor');
    });
  });

  describe('addKeyChange', () => {
    it('should add a key change', () => {
      timeline.addKeyChange(1000, 'E3', 'major');
      expect(timeline.getKeyChangeCount()).toBe(1);
    });

    it('should maintain sorted order when adding key changes', () => {
      timeline.addKeyChange(3000, 'G3', 'major');
      timeline.addKeyChange(1000, 'E3', 'major');
      timeline.addKeyChange(2000, 'F3', 'major');

      const changes = timeline.getAllKeyChanges();
      expect(changes[0].time).toBe(1000);
      expect(changes[1].time).toBe(2000);
      expect(changes[2].time).toBe(3000);
    });

    it('should update existing key change if same time', () => {
      timeline.addKeyChange(1000, 'E3', 'major');
      timeline.addKeyChange(1000, 'F3', 'minor');

      expect(timeline.getKeyChangeCount()).toBe(1);
      const key = timeline.getKeyAtTime(1000);
      expect(key.rootNote).toBe('F3');
      expect(key.scaleType).toBe('minor');
    });
  });

  describe('getKeyAtTime', () => {
    beforeEach(() => {
      timeline.setInitialKey('C3', 'major');
      timeline.addKeyChange(1000, 'D3', 'major');
      timeline.addKeyChange(2000, 'E3', 'major');
      timeline.addKeyChange(3000, 'F3', 'minor');
    });

    it('should return initial key for time before any changes', () => {
      const key = timeline.getKeyAtTime(500);
      expect(key.rootNote).toBe('C3');
    });

    it('should return correct key at exact change time', () => {
      const key = timeline.getKeyAtTime(1000);
      expect(key.rootNote).toBe('D3');
    });

    it('should return correct key between changes', () => {
      const key = timeline.getKeyAtTime(1500);
      expect(key.rootNote).toBe('D3');
    });

    it('should return most recent key after all changes', () => {
      const key = timeline.getKeyAtTime(5000);
      expect(key.rootNote).toBe('F3');
      expect(key.scaleType).toBe('minor');
    });

    it('should handle binary search correctly with many changes', () => {
      const manyTimeline = new ScaleTimeline();
      for (let i = 0; i < 100; i++) {
        manyTimeline.addKeyChange(i * 100, `Note${i}`, 'major');
      }

      const key = manyTimeline.getKeyAtTime(5050);
      expect(key.rootNote).toBe('Note50');
    });
  });

  describe('getSegmentsInRange', () => {
    beforeEach(() => {
      timeline.setInitialKey('C3', 'major');
      timeline.addKeyChange(1000, 'D3', 'major');
      timeline.addKeyChange(2000, 'E3', 'major');
      timeline.addKeyChange(3000, 'F3', 'minor');
    });

    it('should return single segment when no key changes in range', () => {
      const segments = timeline.getSegmentsInRange(500, 900);
      expect(segments).toHaveLength(1);
      expect(segments[0].rootNote).toBe('C3');
      expect(segments[0].startTime).toBe(500);
      expect(segments[0].endTime).toBe(900);
    });

    it('should return multiple segments when key changes occur in range', () => {
      const segments = timeline.getSegmentsInRange(500, 2500);
      expect(segments).toHaveLength(3);

      expect(segments[0].rootNote).toBe('C3');
      expect(segments[0].startTime).toBe(500);
      expect(segments[0].endTime).toBe(1000);

      expect(segments[1].rootNote).toBe('D3');
      expect(segments[1].startTime).toBe(1000);
      expect(segments[1].endTime).toBe(2000);

      expect(segments[2].rootNote).toBe('E3');
      expect(segments[2].startTime).toBe(2000);
      expect(segments[2].endTime).toBe(2500);
    });

    it('should handle range that starts after some key changes', () => {
      const segments = timeline.getSegmentsInRange(1500, 2500);
      expect(segments).toHaveLength(2);
      expect(segments[0].rootNote).toBe('D3');
      expect(segments[1].rootNote).toBe('E3');
    });

    it('should return empty array for invalid range', () => {
      const segments = timeline.getSegmentsInRange(1000, 1000);
      expect(segments).toHaveLength(0);
    });

    it('should return empty array for reversed range', () => {
      const segments = timeline.getSegmentsInRange(2000, 1000);
      expect(segments).toHaveLength(0);
    });
  });

  describe('clear', () => {
    it('should remove all key changes', () => {
      timeline.addKeyChange(1000, 'D3', 'major');
      timeline.addKeyChange(2000, 'E3', 'major');
      timeline.clear();

      expect(timeline.getKeyChangeCount()).toBe(0);
    });

    it('should preserve initial key after clear', () => {
      timeline.setInitialKey('D3', 'minor');
      timeline.addKeyChange(1000, 'E3', 'major');
      timeline.clear();

      const key = timeline.getKeyAtTime(0);
      expect(key.rootNote).toBe('D3');
      expect(key.scaleType).toBe('minor');
    });
  });

  describe('reset', () => {
    it('should clear changes and set new initial key', () => {
      timeline.addKeyChange(1000, 'E3', 'major');
      timeline.reset('F3', 'minor');

      expect(timeline.getKeyChangeCount()).toBe(0);
      const key = timeline.getKeyAtTime(0);
      expect(key.rootNote).toBe('F3');
      expect(key.scaleType).toBe('minor');
    });
  });
});
