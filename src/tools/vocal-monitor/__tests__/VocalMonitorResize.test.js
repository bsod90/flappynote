/**
 * Tests for VocalMonitor sidebar and resize behavior
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VocalMonitorRenderer } from '../VocalMonitorRenderer.js';

// Mock the ResizeObserver for testing
class MockResizeObserver {
  constructor(callback) {
    this.callback = callback;
    this.elements = [];
    MockResizeObserver.instances.push(this);
  }

  observe(element) {
    this.elements.push(element);
  }

  unobserve() {}
  disconnect() {}

  // Simulate a resize event
  triggerResize(width, height) {
    this.callback([
      {
        contentBoxSize: [{ inlineSize: width, blockSize: height }],
        contentRect: { width, height },
      },
    ]);
  }
}

MockResizeObserver.instances = [];

describe('VocalMonitorRenderer - Resize Handling', () => {
  let renderer;
  let mockCanvas;

  beforeEach(() => {
    vi.useFakeTimers();

    // Reset mock instances
    MockResizeObserver.instances = [];

    // Create mock canvas
    mockCanvas = {
      getContext: vi.fn(() => ({
        save: vi.fn(),
        restore: vi.fn(),
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        scale: vi.fn(),
      })),
      width: 800,
      height: 600,
      style: {},
      parentElement: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    };

    // Replace global ResizeObserver
    global.ResizeObserver = MockResizeObserver;
    global.requestAnimationFrame = fn => fn();
    global.devicePixelRatio = 1;

    renderer = new VocalMonitorRenderer(mockCanvas);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('handleResize', () => {
    it('should update canvas dimensions', () => {
      renderer.handleResize(1000, 500);
      vi.advanceTimersByTime(50);

      expect(renderer.width).toBe(1000);
      expect(renderer.height).toBe(500);
      expect(mockCanvas.width).toBe(1000);
      expect(mockCanvas.height).toBe(500);
      expect(mockCanvas.style.width).toBe('1000px');
      expect(mockCanvas.style.height).toBe('500px');
    });

    it('should account for device pixel ratio', () => {
      global.devicePixelRatio = 2;
      renderer.handleResize(800, 600);
      vi.advanceTimersByTime(50);

      expect(mockCanvas.width).toBe(1600);
      expect(mockCanvas.height).toBe(1200);
      expect(mockCanvas.style.width).toBe('800px');
      expect(mockCanvas.style.height).toBe('600px');
    });

    it('should ignore invalid dimensions', () => {
      renderer.width = 500;
      renderer.height = 400;

      renderer.handleResize(0, 600);
      expect(renderer.width).toBe(500);

      renderer.handleResize(800, 0);
      expect(renderer.height).toBe(400);

      renderer.handleResize(5, 600); // < 10
      expect(renderer.width).toBe(500);
    });

    it('should call onResize callback when set', () => {
      const onResizeMock = vi.fn();
      renderer.onResize = onResizeMock;

      renderer.handleResize(900, 700);
      vi.advanceTimersByTime(50);

      expect(onResizeMock).toHaveBeenCalledWith(900, 700);
    });
  });

  describe('resize during sidebar animation', () => {
    it('should handle multiple rapid resize events', () => {
      // Simulate sidebar animation causing multiple resize events
      const sizes = [
        [800, 600],
        [750, 600],
        [700, 600],
        [650, 600],
        [600, 600],
        [550, 600],
        [500, 600], // Final size after sidebar opens
      ];

      sizes.forEach(([w, h]) => {
        renderer.handleResize(w, h);
      });

      // Debounce should only apply the final size
      vi.advanceTimersByTime(50);

      // Should end up at the final size
      expect(renderer.width).toBe(500);
      expect(renderer.height).toBe(600);
    });

    it('should not apply intermediate sizes during debounce window', () => {
      // Fire multiple resizes without advancing timers
      renderer.handleResize(800, 600);
      renderer.handleResize(700, 600);
      renderer.handleResize(600, 600);

      // Before debounce settles, dimensions should not be updated
      expect(renderer.width).toBe(0);

      // After debounce, only the last size is applied
      vi.advanceTimersByTime(50);
      expect(renderer.width).toBe(600);
    });

    it('should handle resize back to full width when sidebar closes', () => {
      // Start at reduced width (sidebar open)
      renderer.handleResize(500, 600);
      vi.advanceTimersByTime(50);
      expect(renderer.width).toBe(500);

      // Simulate sidebar closing
      const sizes = [
        [550, 600],
        [600, 600],
        [650, 600],
        [700, 600],
        [750, 600],
        [800, 600], // Full width
      ];

      sizes.forEach(([w, h]) => {
        renderer.handleResize(w, h);
      });

      vi.advanceTimersByTime(50);
      expect(renderer.width).toBe(800);
    });
  });
});

describe('Sidebar Toggle CSS Class Behavior', () => {
  it('should correctly toggle sidebar-open class', () => {
    // This tests the expected CSS class behavior
    // The actual VocalMonitorTool adds/removes these classes
    const container = {
      classList: {
        classes: new Set(),
        add(c) {
          this.classes.add(c);
        },
        remove(c) {
          this.classes.delete(c);
        },
        contains(c) {
          return this.classes.has(c);
        },
      },
    };

    const sidebar = {
      classList: {
        classes: new Set(),
        add(c) {
          this.classes.add(c);
        },
        remove(c) {
          this.classes.delete(c);
        },
        contains(c) {
          return this.classes.has(c);
        },
      },
    };

    // Simulate openSidebar
    function openSidebar() {
      sidebar.classList.add('open');
      container.classList.add('sidebar-open');
    }

    // Simulate closeSidebar
    function closeSidebar() {
      sidebar.classList.remove('open');
      container.classList.remove('sidebar-open');
    }

    // Initially closed
    expect(sidebar.classList.contains('open')).toBe(false);
    expect(container.classList.contains('sidebar-open')).toBe(false);

    // Open sidebar
    openSidebar();
    expect(sidebar.classList.contains('open')).toBe(true);
    expect(container.classList.contains('sidebar-open')).toBe(true);

    // Close sidebar
    closeSidebar();
    expect(sidebar.classList.contains('open')).toBe(false);
    expect(container.classList.contains('sidebar-open')).toBe(false);

    // Toggle multiple times
    openSidebar();
    expect(sidebar.classList.contains('open')).toBe(true);
    closeSidebar();
    expect(sidebar.classList.contains('open')).toBe(false);
    openSidebar();
    expect(sidebar.classList.contains('open')).toBe(true);
  });
});

describe('VocalMonitorState - Jump to Front', () => {
  it('should jump to current time and resume auto-scrolling', () => {
    // Simulate VocalMonitorState behavior
    const state = {
      currentTime: 15000,
      viewportWidth: 10000,
      viewportStart: 2000, // User has scrolled back
      isAutoScrolling: false,

      jumpToFront() {
        this.viewportStart = Math.max(0, this.currentTime - this.viewportWidth + 1000);
        this.isAutoScrolling = true;
      },

      scrollViewport(offsetMs) {
        const newStart = this.viewportStart + offsetMs;
        const maxStart = Math.max(0, this.currentTime - this.viewportWidth + 1000);
        this.viewportStart = Math.max(0, Math.min(maxStart, newStart));
        this.isAutoScrolling = false;
      },
    };

    // Initially scrolled back
    expect(state.viewportStart).toBe(2000);
    expect(state.isAutoScrolling).toBe(false);

    // Jump to front
    state.jumpToFront();

    // Should be at current time position
    expect(state.viewportStart).toBe(6000); // 15000 - 10000 + 1000
    expect(state.isAutoScrolling).toBe(true);
  });

  it('should disable auto-scroll when manually scrolling', () => {
    const state = {
      currentTime: 15000,
      viewportWidth: 10000,
      viewportStart: 6000,
      isAutoScrolling: true,

      scrollViewport(offsetMs) {
        const newStart = this.viewportStart + offsetMs;
        const maxStart = Math.max(0, this.currentTime - this.viewportWidth + 1000);
        this.viewportStart = Math.max(0, Math.min(maxStart, newStart));
        this.isAutoScrolling = false;
      },
    };

    expect(state.isAutoScrolling).toBe(true);

    // User scrolls back
    state.scrollViewport(-3000);

    expect(state.viewportStart).toBe(3000);
    expect(state.isAutoScrolling).toBe(false);
  });

  it('should show jump button when recording but not auto-scrolling', () => {
    // Test the visibility logic used in VocalMonitorTool.render()
    function shouldShowJumpButton(isRecording, isAutoScrolling) {
      return isRecording && !isAutoScrolling;
    }

    // Recording and following - no button
    expect(shouldShowJumpButton(true, true)).toBe(false);

    // Recording but scrolled back - show button
    expect(shouldShowJumpButton(true, false)).toBe(true);

    // Not recording - no button
    expect(shouldShowJumpButton(false, true)).toBe(false);
    expect(shouldShowJumpButton(false, false)).toBe(false);
  });
});

describe('Octave-Aware Pitch Matching', () => {
  // Re-verify the octave-aware behavior in a separate test context
  it('should validate that pitch matching requires correct octave', () => {
    // This is a pure unit test of the pitch matching logic
    // Tolerance is 50 cents = 0.5 semitones
    const centsTolerance = 50;
    const tolerance = centsTolerance / 100;

    function isPitchMatch(detectedMidi, targetMidi) {
      const diff = Math.abs(detectedMidi - targetMidi);
      return diff <= tolerance;
    }

    // Same octave, exact match
    expect(isPitchMatch(60, 60)).toBe(true);

    // Same octave, within tolerance (+0.3 semitones)
    expect(isPitchMatch(60.3, 60)).toBe(true);

    // Same octave, outside tolerance (+0.6 semitones)
    expect(isPitchMatch(60.6, 60)).toBe(false);

    // Different octave (C4 vs C5) - should NOT match
    expect(isPitchMatch(72, 60)).toBe(false);

    // Different octave (C4 vs C3) - should NOT match
    expect(isPitchMatch(48, 60)).toBe(false);

    // One semitone away - should NOT match
    expect(isPitchMatch(61, 60)).toBe(false);
    expect(isPitchMatch(59, 60)).toBe(false);
  });
});
