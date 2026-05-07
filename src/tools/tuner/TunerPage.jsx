import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronsLeft,
  ChevronsRight,
  Mic,
  MicOff,
  Settings2,
} from 'lucide-react';

import { SharedSettings, PitchContext } from '@/core';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { trackEvent } from '@/lib/analytics';
import { useWakeLock } from '@/lib/useWakeLock';

import {
  cents as centsBetween,
  findClosestString,
  nearestSemitone,
  tuningStatus,
  IN_TUNE_CENTS,
} from './tunerLogic.js';
import { getStrings, isChromatic } from './tunings.js';
import TunerVisualizer from './TunerVisualizer.jsx';
import StringRow from './StringRow.jsx';
import Sidebar from './Sidebar.jsx';
import { useSharedSettingValues } from '../vocal-monitor/useSharedSettings.js';

const SETTINGS_KEYS = [
  'tunerInstrument',
  'tunerTuning',
  'tunerReferenceA4',
  'tunerAutoDetect',
  'tunerSelectedString',
  'settingsCollapsed',
];

// How many consecutive "in-tune" frames before we stamp a string as tuned.
// At ~50ms/frame this is about 0.5s of stable detection.
const IN_TUNE_STREAK = 10;

export default function TunerPage() {
  const settings = useMemo(() => new SharedSettings(), []);
  const v = useSharedSettingValues(settings, SETTINGS_KEYS);

  const instrument = v.tunerInstrument ?? 'guitar';
  const tuning = v.tunerTuning ?? 'standard';
  const referenceA4 = v.tunerReferenceA4 ?? 440;
  const autoDetect = v.tunerAutoDetect ?? true;
  const selectedString = v.tunerSelectedString ?? 0;
  const sidebarCollapsed = !!v.settingsCollapsed;

  const strings = useMemo(
    () => getStrings(instrument, tuning, referenceA4),
    [instrument, tuning, referenceA4]
  );
  const chromatic = isChromatic(instrument);

  // Demo mode: ?demoFreq=146.83&demoTuned=0,1,5 lets the page render a
  // "live" tuner without a microphone. Used for marketing screenshots and
  // for tests that don't want to spin up audio. Resolved once at mount time
  // and consumed by the various state initializers below so React's effect
  // ordering doesn't reset them.
  const demo = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const freq = parseFloat(params.get('demoFreq'));
    if (!Number.isFinite(freq)) return null;
    const tunedParam = params.get('demoTuned') ?? '';
    const tuned = new Set(
      tunedParam
        .split(',')
        .map((s) => parseInt(s, 10))
        .filter((n) => Number.isFinite(n))
    );
    return { freq, tuned };
  }, []);

  // Pitch detection
  const pitchContextRef = useRef(null);
  const [isRecording, setIsRecording] = useState(!!demo);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);

  // Live reading. Kept in state so the visualizer rerenders smoothly.
  const [reading, setReading] = useState(() =>
    demo ? { frequency: demo.freq, confidence: 1, timestamp: Date.now() } : null
  );
  // Tracks indices of strings that have hit "in tune" for IN_TUNE_STREAK frames
  // since the session started. Cleared on Stop or when the tuning changes.
  const [tunedSet, setTunedSet] = useState(() => (demo ? demo.tuned : new Set()));
  const streakRef = useRef({ index: -1, count: 0 });

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useWakeLock(isRecording);

  useEffect(() => {
    trackEvent('tool_open', { tool: 'tuner' });
    const ctx = new PitchContext({
      detector: 'hybrid',     // No model load — fast start, plenty accurate for monophonic strings
      updateInterval: 50,
      threshold: 0.0001,
      bufferSize: 4096,
      minFrequency: 30,       // covers bass low E1 (41Hz) with margin
      maxFrequency: 1500,
      highPassFreq: 30,       // avoid filtering out low strings
      enableVocalAnalysis: false,
    });
    pitchContextRef.current = ctx;
    return () => {
      ctx.dispose?.();
      pitchContextRef.current = null;
    };
  }, []);

  // Reset the "tuned" set whenever the tuning shape changes — old indices no
  // longer point at the same notes. We compare against the previous combo
  // (rather than an "is-first-mount" boolean) so React 18 strict-mode's
  // double effect run doesn't wipe the initial state on the second pass.
  const lastTuningRef = useRef(`${instrument}|${tuning}|${referenceA4}`);
  useEffect(() => {
    const key = `${instrument}|${tuning}|${referenceA4}`;
    if (lastTuningRef.current === key) return;
    lastTuningRef.current = key;
    setTunedSet(new Set());
    streakRef.current = { index: -1, count: 0 };
  }, [instrument, tuning, referenceA4]);

  // Subscribe to pitch updates while recording
  useEffect(() => {
    const ctx = pitchContextRef.current;
    if (!ctx) return;
    return ctx.subscribe((pitchData) => {
      if (!pitchData) {
        setReading(null);
        streakRef.current = { index: -1, count: 0 };
        return;
      }
      setReading({
        frequency: pitchData.frequency,
        confidence: pitchData.confidence,
        timestamp: pitchData.timestamp,
      });
    });
  }, []);

  // Compute the active string + cents from the reading.
  const view = useMemo(() => {
    const freq = reading?.frequency ?? null;
    if (chromatic) {
      const snap = freq ? nearestSemitone(freq, referenceA4) : null;
      return {
        noteName: snap?.noteName ?? '—',
        cents: snap?.cents ?? null,
        targetFrequency: snap?.target ?? null,
        activeIndex: -1,
      };
    }

    if (autoDetect) {
      const match = findClosestString(freq, strings);
      return {
        noteName: match?.string?.noteName ?? '—',
        cents: match?.cents ?? null,
        targetFrequency: match?.string?.frequency ?? null,
        activeIndex: match?.index ?? -1,
      };
    }

    // Manual mode — compare against the user-picked string.
    const target = strings[selectedString] ?? strings[0] ?? null;
    return {
      noteName: target?.noteName ?? '—',
      cents: target && freq ? centsBetween(freq, target.frequency) : null,
      targetFrequency: target?.frequency ?? null,
      activeIndex: target ? selectedString : -1,
    };
  }, [reading, strings, autoDetect, selectedString, referenceA4, chromatic]);

  const status = tuningStatus(view.cents);

  // Streak tracking — accumulates "in tune" frames per active string and
  // marks the string as tuned in the tunedSet.
  useEffect(() => {
    if (!isRecording || chromatic) return;
    const idx = view.activeIndex;
    if (idx < 0 || view.cents == null) {
      streakRef.current = { index: -1, count: 0 };
      return;
    }
    const inTune = Math.abs(view.cents) <= IN_TUNE_CENTS;
    if (!inTune) {
      streakRef.current = { index: -1, count: 0 };
      return;
    }
    const s = streakRef.current;
    if (s.index !== idx) {
      streakRef.current = { index: idx, count: 1 };
      return;
    }
    s.count += 1;
    if (s.count === IN_TUNE_STREAK && !tunedSet.has(idx)) {
      setTunedSet((prev) => {
        const next = new Set(prev);
        next.add(idx);
        return next;
      });
    }
  }, [view.activeIndex, view.cents, isRecording, chromatic, tunedSet]);

  const handleStart = async () => {
    const ctx = pitchContextRef.current;
    if (!ctx) return;
    setStarting(true);
    setError(null);
    try {
      await ctx.start();
      setIsRecording(true);
    } catch (e) {
      console.error('Failed to start tuner:', e);
      setError(
        e?.name === 'NotAllowedError'
          ? 'Microphone permission denied. Allow microphone access in your browser to use the tuner.'
          : 'Could not start the microphone. Try a different browser or check permissions.'
      );
    } finally {
      setStarting(false);
    }
  };

  const handleStop = () => {
    pitchContextRef.current?.stop();
    setIsRecording(false);
    setReading(null);
    setTunedSet(new Set());
    streakRef.current = { index: -1, count: 0 };
  };

  const handleStringSelect = (idx) => {
    settings.set('tunerSelectedString', idx);
    settings.set('tunerAutoDetect', false);
  };

  return (
    <div className="relative flex h-full">
      {/* Main panel */}
      <div className="flex flex-1 min-w-0 flex-col">
        {/* Toolbar */}
        <div className="flex items-center gap-2 border-b bg-background/60 p-2 backdrop-blur">
          {isRecording ? (
            <Button onClick={handleStop} variant="destructive">
              <MicOff className="h-4 w-4" />
              Stop
            </Button>
          ) : (
            <Button onClick={handleStart} disabled={starting}>
              <Mic className="h-4 w-4" />
              {starting ? 'Starting…' : 'Start'}
            </Button>
          )}

          <div className="ml-auto flex items-center gap-2 lg:hidden">
            <Button variant="outline" size="sm" onClick={() => setSidebarOpen(true)}>
              <Settings2 className="h-4 w-4" />
              Settings
            </Button>
          </div>
        </div>

        {error && (
          <div className="border-b bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Centered visualizer + strings */}
        <div className="no-scrollbar flex flex-1 flex-col items-center justify-center gap-10 overflow-y-auto p-6 sm:p-8">
          <TunerVisualizer
            noteName={view.noteName}
            cents={view.cents}
            frequency={reading?.frequency ?? null}
            targetFrequency={view.targetFrequency}
            isRecording={isRecording}
            status={status}
          />

          {!chromatic && strings.length > 0 && (
            <div className="flex w-full flex-col items-center gap-3">
              <StringRow
                strings={strings}
                activeIndex={view.activeIndex}
                selectedIndex={selectedString}
                tunedSet={tunedSet}
                autoDetect={autoDetect}
                cents={view.cents}
                onSelect={handleStringSelect}
              />
              <p className="text-center text-[11px] text-muted-foreground">
                {autoDetect
                  ? 'Auto-detect on — play any string and it will snap to the closest target.'
                  : 'Manual mode — pick a string above; auto-detect re-engages from settings.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Desktop sidebar */}
      {sidebarCollapsed && (
        <Button
          variant="outline"
          size="icon"
          onClick={() => settings.set('settingsCollapsed', false)}
          aria-label="Expand settings"
          className="absolute right-3 top-3 z-10 hidden h-8 w-8 shadow-sm lg:inline-flex"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
      )}

      {!sidebarCollapsed && (
        <aside className="no-scrollbar hidden w-80 shrink-0 overflow-y-auto border-l bg-background lg:block">
          <div className="flex justify-end px-2 pt-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => settings.set('settingsCollapsed', true)}
              aria-label="Collapse settings"
              className="text-muted-foreground hover:text-foreground"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="px-4 pb-4">
            <Sidebar settings={settings} />
          </div>
        </aside>
      )}

      {/* Mobile settings drawer */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="right" className="no-scrollbar w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Settings</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <Sidebar settings={settings} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
