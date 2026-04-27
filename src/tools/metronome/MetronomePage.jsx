import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronsLeft, ChevronsRight, Headphones, Settings2 } from 'lucide-react';

import { SharedSettings } from '@/core';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

import { trackEvent } from '@/lib/analytics';
import { useWakeLock } from '@/lib/useWakeLock';

import { MetronomeEngine } from './MetronomeEngine.js';
import { MicListener } from './MicListener.js';
import { HitTracker } from './HitTracker.js';
import { sensitivityToThreshold, T_MIN } from './sensitivity.js';
import MetronomeDial from './MetronomeDial.jsx';
import Sidebar from './Sidebar.jsx';
import ListenBackPanel from './ListenBackPanel.jsx';
import PracticeTracker from './PracticeTracker.jsx';
import { useSharedSettingValues } from '../vocal-monitor/useSharedSettings.js';

const TIME_SIGNATURES = [
  { key: '2/4', beatsPerBar: 2, beatUnit: 4 },
  { key: '3/4', beatsPerBar: 3, beatUnit: 4 },
  { key: '4/4', beatsPerBar: 4, beatUnit: 4 },
  { key: '5/4', beatsPerBar: 5, beatUnit: 4 },
  { key: '6/8', beatsPerBar: 6, beatUnit: 8 },
  { key: '7/8', beatsPerBar: 7, beatUnit: 8 },
  { key: '9/8', beatsPerBar: 9, beatUnit: 8 },
  { key: '12/8', beatsPerBar: 12, beatUnit: 8 },
];

const SETTINGS_KEYS = [
  'metronomeBpm',
  'metronomeTimeSig',
  'metronomeAccentPattern',
  'metronomeTimbre',
  'metronomeVolume',
  'metronomeSkipPlay',
  'metronomeSkipSkip',
  'metronomeSubdivision',
  'metronomeListenBack',
  'metronomeListenSensitivity',
  'metronomeGridTriplets',
  'metronomeLatencyMs',
  'metronomePracticeEnabled',
  'metronomePracticeSessionMinutes',
  'metronomePracticeIntervalMinutes',
  'settingsCollapsed',
];

const TAP_WINDOW = 4;
const TAP_RESET_MS = 2000;

export default function MetronomePage() {
  const settings = useMemo(() => new SharedSettings(), []);
  const values = useSharedSettingValues(settings, SETTINGS_KEYS);

  const bpm = values.metronomeBpm ?? 120;
  const timeSig = TIME_SIGNATURES.find((s) => s.key === values.metronomeTimeSig)
    ?? TIME_SIGNATURES[2];
  const accentPattern = normalizePattern(
    values.metronomeAccentPattern,
    timeSig.beatsPerBar,
    values.metronomeSubdivision ?? 1
  );
  const timbre = values.metronomeTimbre ?? 'woodblock';
  const volume = values.metronomeVolume ?? 0.8;
  const playBars = values.metronomeSkipPlay ?? 4;
  const skipBars = values.metronomeSkipSkip ?? 0;
  const subdivision = values.metronomeSubdivision ?? 1;
  const listenBack = !!values.metronomeListenBack;
  // Sensitivity is now a 1..100 slider value; coerce legacy raw thresholds.
  const rawSens = values.metronomeListenSensitivity;
  const sensitivity = typeof rawSens === 'number' && rawSens >= 1 ? rawSens : 50;
  const detectorThreshold = sensitivityToThreshold(sensitivity);
  const showTriplets = !!values.metronomeGridTriplets;
  const manualLatencyMs = values.metronomeLatencyMs; // null or number
  const practiceEnabled = !!values.metronomePracticeEnabled;
  const practiceSessionMin = Math.max(1, values.metronomePracticeSessionMinutes ?? 10);
  const practiceIntervalMin = Math.max(1, values.metronomePracticeIntervalMinutes ?? 1);
  const totalIntervals = Math.max(1, Math.ceil(practiceSessionMin / practiceIntervalMin));
  const intervalDurationSec = practiceIntervalMin * 60;
  const sidebarCollapsed = !!values.settingsCollapsed;

  const [isRunning, setIsRunning] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [lastBeatTime, setLastBeatTime] = useState(null);
  const [isSkippedBar, setIsSkippedBar] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const engineRef = useRef(null);
  const tapsRef = useRef([]);
  const trackerRef = useRef(null);
  const micRef = useRef(null);
  const levelBufferRef = useRef([]);
  const calibrationRef = useRef(null); // { beats: [], hits: [] } when active
  const [tapHint, setTapHint] = useState(null);
  const [listenError, setListenError] = useState(null);
  const [calibrating, setCalibrating] = useState(false);
  const [calibrationCountdown, setCalibrationCountdown] = useState(0);
  const [calibrationStatus, setCalibrationStatus] = useState(null);
  // Bumped to force the listen-back useEffect to tear down + rebuild the
  // mic listener — used when the AudioContext is recreated (iOS sleep
  // recovery) or when the mic stream's track ends underneath us.
  const [micVersion, setMicVersion] = useState(0);

  // Practice session state
  const [practiceState, setPracticeState] = useState('idle'); // idle | countdown | running | complete
  const [practiceCountdown, setPracticeCountdown] = useState(5);
  const [intervalIndex, setIntervalIndex] = useState(0);
  const [intervalRemainingSec, setIntervalRemainingSec] = useState(0);
  const sessionStartRef = useRef(0); // engine.now() at session start
  const lastIntervalRef = useRef(0); // last interval index we beeped on
  const lastWarnedIntervalRef = useRef(-1); // interval index we already warned for (5s pre-cue)

  // Keep the screen awake while the metronome is playing, listen-back is on,
  // or a practice session is running. Released as soon as everything stops.
  useWakeLock(isRunning || listenBack || practiceState !== 'idle');

  // Build the engine + tracker once. The tracker is always allocated; it
  // accumulates beats whenever the engine runs, so flipping listen-back ON
  // mid-session immediately starts plotting against the running beat stream.
  useEffect(() => {
    trackEvent('tool_open', { tool: 'metronome' });
    const tracker = new HitTracker();
    trackerRef.current = tracker;

    const engine = new MetronomeEngine({
      onBeat: (beat) => {
        setCurrentBeat(beat.beatIndex);
        setLastBeatTime(beat.time);
        setIsSkippedBar(beat.skipped);
        tracker.addExpectedBeat(beat);
        // Calibration sample collection — raw scheduled beat times
        if (calibrationRef.current && !beat.skipped && beat.kind !== 'silent') {
          calibrationRef.current.beats.push(beat.time);
        }
      },
      onAudioContextChanged: () => {
        // Engine recreated its AudioContext — any active mic listener is
        // wired to a now-closed context. Rebuild it.
        setMicVersion((v) => v + 1);
      },
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
      trackerRef.current = null;
    };
  }, []);

  // Push every settings change into the engine. Cheap and idempotent.
  useEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    e.setBpm(bpm);
    e.setTimeSignature(timeSig.beatsPerBar, timeSig.beatUnit);
    e.setAccentPattern(accentPattern);
    e.setTimbre(timbre);
    e.setVolume(volume);
    e.setSkipPattern(playBars, skipBars);
    e.setSubdivision(subdivision);

    // Tracker also needs to know BPM + grid config for offset math
    const tracker = trackerRef.current;
    if (tracker) {
      tracker.setBpm(bpm);
      tracker.setGridConfig({ includeTriplets: showTriplets, subdivision });
    }
  }, [bpm, timeSig, accentPattern, timbre, volume, playBars, skipBars, subdivision, showTriplets]);

  // Manual latency override → tracker. When manualLatencyMs is set, it
  // takes over from audioContext.outputLatency so calibration / typed
  // values feed straight into matching.
  useEffect(() => {
    const tracker = trackerRef.current;
    const engine = engineRef.current;
    if (!tracker || !engine) return;
    if (typeof manualLatencyMs === 'number') {
      tracker.setOutputLatency(manualLatencyMs / 1000);
    } else if (engine.audioContext) {
      tracker.setOutputLatency(engine.getOutputLatency());
    }
  }, [manualLatencyMs]);

  // ── Practice session lifecycle ───────────────────────────────────────

  // 5s countdown before the session begins
  useEffect(() => {
    if (practiceState !== 'countdown') return;
    setPracticeCountdown(5);
    let n = 5;
    const id = setInterval(() => {
      n -= 1;
      if (n > 0) {
        setPracticeCountdown(n);
        return;
      }
      clearInterval(id);
      // Transition into running
      const engine = engineRef.current;
      if (!engine) return;
      sessionStartRef.current = engine.now();
      lastIntervalRef.current = 0;
      lastWarnedIntervalRef.current = -1;
      setIntervalIndex(0);
      setIntervalRemainingSec(intervalDurationSec);
      // Make sure the metronome is playing
      if (!engine.isRunning) {
        engine.start().then(() => setIsRunning(true)).catch(() => {});
      }
      // Kick-off chime
      engine.playIntervalBeep();
      setPracticeState('running');
    }, 1000);
    return () => clearInterval(id);
  }, [practiceState, intervalDurationSec]);

  // Running: tick the countdown + detect interval transitions + completion
  useEffect(() => {
    if (practiceState !== 'running') return;
    const engine = engineRef.current;
    if (!engine) return;
    const totalDur = practiceSessionMin * 60;
    const intervalDur = intervalDurationSec;
    let raf;
    const tick = () => {
      const now = engine.now();
      const elapsed = now - sessionStartRef.current;
      if (elapsed >= totalDur) {
        // Final beep + stop
        engine.playIntervalBeep();
        setIntervalIndex(totalIntervals - 1);
        setIntervalRemainingSec(0);
        setPracticeState('complete');
        if (engine.isRunning) {
          engine.stop();
          setIsRunning(false);
          setCurrentBeat(-1);
          setIsSkippedBar(false);
          setLastBeatTime(null);
        }
        return;
      }
      const idx = Math.min(totalIntervals - 1, Math.floor(elapsed / intervalDur));
      if (idx > lastIntervalRef.current) {
        lastIntervalRef.current = idx;
        engine.playIntervalBeep();
      }
      // Subtle 5s heads-up before the next transition (or session end).
      // Suppressed for very short intervals where the warning would
      // overlap with the previous transition's chime.
      const remaining = Math.min(totalDur - elapsed, intervalDur - (elapsed % intervalDur));
      if (
        intervalDur > 6 &&
        remaining <= 5 &&
        remaining > 0 &&
        lastWarnedIntervalRef.current !== idx
      ) {
        lastWarnedIntervalRef.current = idx;
        engine.playIntervalWarning();
      }
      setIntervalIndex(idx);
      setIntervalRemainingSec(intervalDur - (elapsed % intervalDur));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [practiceState, practiceSessionMin, intervalDurationSec, totalIntervals]);

  // If the metronome stops externally during a session, end the session
  useEffect(() => {
    if (!isRunning && (practiceState === 'running' || practiceState === 'countdown')) {
      setPracticeState('idle');
    }
  }, [isRunning]); // eslint-disable-line react-hooks/exhaustive-deps

  // If practice mode toggle is turned off mid-session, clean up
  useEffect(() => {
    if (!practiceEnabled && practiceState !== 'idle') {
      setPracticeState('idle');
    }
  }, [practiceEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const startPracticeSession = async () => {
    const engine = engineRef.current;
    if (!engine) return;
    // Unlock synchronously inside the user gesture for iOS Safari.
    engine.unlock();
    trackEvent('practice_session_start', {
      session_minutes: practiceSessionMin,
      interval_minutes: practiceIntervalMin,
    });
    setPracticeState('countdown');
  };

  const stopPracticeSession = () => {
    setPracticeState('idle');
    const engine = engineRef.current;
    if (engine?.isRunning) {
      engine.stop();
      setIsRunning(false);
      setCurrentBeat(-1);
      setIsSkippedBar(false);
      setLastBeatTime(null);
    }
  };

  const restartPracticeSession = async () => {
    setPracticeState('idle');
    // Brief tick so the countdown effect re-fires cleanly
    await new Promise((r) => setTimeout(r, 50));
    await startPracticeSession();
  };

  // Listen-back lifecycle: open mic when toggled on, tear down when off
  useEffect(() => {
    const tracker = trackerRef.current;
    const engine = engineRef.current;
    if (!tracker || !engine) return;

    if (!listenBack) {
      micRef.current?.stop();
      micRef.current = null;
      levelBufferRef.current = [];
      tracker.reset();
      setListenError(null);
      return;
    }

    trackEvent('listen_back_enabled');

    let cancelled = false;
    (async () => {
      try {
        const ctx = engine.ensureAudio();
        if (ctx.state === 'suspended') await ctx.resume();
        // Note: do NOT call tracker.setOutputLatency() here. The
        // manualLatencyMs effect owns that and would otherwise be silently
        // overwritten with the AudioContext's auto-detected value every
        // time this effect re-runs (e.g. when micVersion bumps after
        // AudioContext recreation on iOS sleep recovery).
        const mic = new MicListener(ctx);
        await mic.start({
          threshold: detectorThreshold,
          onOnset: (onset) => {
            if (calibrationRef.current) {
              calibrationRef.current.hits.push(onset.time);
            } else {
              tracker.addHit(onset);
            }
          },
          onLevel: (sample) => {
            const buf = levelBufferRef.current;
            buf.push(sample);
            // Keep enough samples to fill the panel's full 6s window plus a
            // small safety margin, so the waveform doesn't fade out before
            // it scrolls off the left edge.
            if (buf.length > 800) {
              const cutoff = sample.time - 8;
              while (buf.length && buf[0].time < cutoff) buf.shift();
            }
          },
          onLost: () => {
            // Stream died (background, permission, device unplug). If
            // listen-back is still on, rebuild a fresh listener.
            setMicVersion((v) => v + 1);
          },
        });
        if (cancelled) {
          mic.stop();
          return;
        }
        micRef.current = mic;
        setListenError(null);
      } catch (err) {
        console.error('Listen-back failed:', err);
        setListenError(
          err?.name === 'NotAllowedError'
            ? 'Microphone permission denied.'
            : 'Could not open the microphone.'
        );
      }
    })();

    return () => {
      cancelled = true;
      micRef.current?.stop();
      micRef.current = null;
    };
    // detectorThreshold is intentionally NOT in deps — we apply it live below
    // without restarting the mic. micVersion bumps force a rebuild when the
    // engine recreates its AudioContext or the underlying mic stream dies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listenBack, micVersion]);

  // Apply sensitivity changes to the live detector without restarting.
  // During calibration we temporarily override with T_MIN, so skip the
  // user-driven threshold push until calibration finishes.
  useEffect(() => {
    if (calibrating) return;
    micRef.current?.setThreshold(detectorThreshold);
  }, [detectorThreshold, calibrating]);

  // Forget tap-tempo taps after pause
  useEffect(() => {
    const id = setInterval(() => {
      const last = tapsRef.current[tapsRef.current.length - 1];
      if (last && performance.now() - last > TAP_RESET_MS) {
        tapsRef.current = [];
        setTapHint(null);
      }
    }, 500);
    return () => clearInterval(id);
  }, []);

  const handleToggle = async () => {
    const e = engineRef.current;
    if (!e) return;
    if (isRunning) {
      e.stop();
      setIsRunning(false);
      setCurrentBeat(-1);
      setIsSkippedBar(false);
      setLastBeatTime(null);
    } else {
      // iOS Safari needs the unlock to happen *synchronously* inside the
      // tap handler (no awaits before it). Without this, the AudioContext
      // is created but output stays muted until a getUserMedia call (the
      // listen-back path) inadvertently activates the audio session.
      e.unlock();
      await e.start();
      setIsRunning(true);
    }
  };

  const handleBpmChange = (next) => settings.set('metronomeBpm', next);

  const handleTap = () => {
    const now = performance.now();
    tapsRef.current.push(now);
    if (tapsRef.current.length > TAP_WINDOW) tapsRef.current.shift();
    if (tapsRef.current.length >= 2) {
      const intervals = [];
      for (let i = 1; i < tapsRef.current.length; i++) {
        intervals.push(tapsRef.current[i] - tapsRef.current[i - 1]);
      }
      const sorted = [...intervals].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const next = Math.round(60000 / median);
      if (next >= 30 && next <= 300) {
        settings.set('metronomeBpm', next);
        setTapHint(`${next} BPM`);
      }
    } else {
      setTapHint('keep tapping…');
    }
  };

  const getNow = () => engineRef.current?.now() ?? 0;

  /**
   * Listens to the metronome's own clicks for ~5s and records the median
   * delay between scheduled click time and detected onset time. Saves the
   * result as `metronomeLatencyMs`.
   *
   * Auto-enables the mic + metronome if either is off, runs the detector at
   * maximum sensitivity (bypassing the user's slider), then restores the
   * previous state. Use speakers — the mic needs to hear the metronome.
   */
  const startCalibration = async () => {
    const engine = engineRef.current;
    if (!engine) return;

    setCalibrationStatus({ kind: 'running', message: 'Preparing…' });

    let needsWarmup = false;

    // 1. Auto-enable listen-back if it was off, and wait for the mic stream
    const enabledMicHere = !settings.get('metronomeListenBack');
    if (enabledMicHere) {
      settings.set('metronomeListenBack', true);
      let waited = 0;
      while (!micRef.current && waited < 4000) {
        await new Promise((r) => setTimeout(r, 100));
        waited += 100;
      }
      if (!micRef.current) {
        setCalibrationStatus({ kind: 'error', message: 'Could not start the microphone.' });
        settings.set('metronomeListenBack', false);
        return;
      }
      needsWarmup = true;
    }

    // 2. Auto-start metronome if it was off
    const startedEngineHere = !engine.isRunning;
    if (startedEngineHere) {
      try {
        await engine.start();
        setIsRunning(true);
      } catch {
        setCalibrationStatus({ kind: 'error', message: 'Could not start the metronome.' });
        if (enabledMicHere) settings.set('metronomeListenBack', false);
        return;
      }
      needsWarmup = true;
    }

    // 3. Audio output + mic input both need a beat to actually be flowing
    // (cold-start latency on first AudioContext use). Wait a bit longer
    // when we just turned them on, otherwise the first clicks of the 5s
    // window aren't actually audible / captured.
    if (needsWarmup) {
      setCalibrationStatus({ kind: 'running', message: 'Warming up…' });
      await new Promise((r) => setTimeout(r, 800));
    }

    // 4. Force max sensitivity on the detector for the duration of the run
    micRef.current?.setThreshold(T_MIN);

    calibrationRef.current = { beats: [], hits: [] };
    setCalibrating(true);

    const DURATION_S = 5;
    for (let s = DURATION_S; s > 0; s--) {
      setCalibrationCountdown(s);
      setCalibrationStatus({ kind: 'running', message: `Listening to clicks… ${s}s` });
      await new Promise((r) => setTimeout(r, 1000));
    }
    setCalibrationCountdown(0);

    const { beats, hits } = calibrationRef.current;
    calibrationRef.current = null;
    setCalibrating(false);

    // 4. Restore prior state — engine off, mic off — and the sensitivity
    // useEffect will re-apply the user's slider value automatically once
    // `calibrating` flips back to false.
    if (startedEngineHere) {
      engine.stop();
      setIsRunning(false);
      setCurrentBeat(-1);
      setIsSkippedBar(false);
      setLastBeatTime(null);
    }
    if (enabledMicHere) {
      settings.set('metronomeListenBack', false);
    }

    if (hits.length < 4) {
      setCalibrationStatus({
        kind: 'error',
        message: `Heard only ${hits.length} click${hits.length === 1 ? '' : 's'} in 5s. Use speakers (not headphones), raise volume, and try again.`,
      });
      return;
    }
    if (beats.length < 4) {
      setCalibrationStatus({
        kind: 'error',
        message: 'Metronome didn\'t schedule enough beats. Try again.',
      });
      return;
    }

    const deltas = [];
    for (const ht of hits) {
      let nearest = Infinity;
      for (const bt of beats) {
        const d = ht - bt;
        if (Math.abs(d) < Math.abs(nearest)) nearest = d;
      }
      if (Math.abs(nearest) < 0.3) deltas.push(nearest);
    }
    if (deltas.length < 3) {
      setCalibrationStatus({
        kind: 'error',
        message: 'Heard sounds but couldn\'t align them to the clicks. Lower background noise, raise sensitivity, or set the value manually.',
      });
      return;
    }
    deltas.sort((a, b) => a - b);
    const median = deltas[Math.floor(deltas.length / 2)];
    const latencyMs = Math.round(median * 1000);
    settings.set('metronomeLatencyMs', latencyMs);
    setCalibrationStatus({
      kind: 'success',
      message: `Calibrated to ${latencyMs}ms (from ${deltas.length} clicks).`,
    });
  };

  const resetLatency = () => {
    settings.set('metronomeLatencyMs', 12);
    setCalibrationStatus({ kind: 'success', message: 'Reset to default (12ms).' });
  };

  return (
    <div className="relative flex h-full">
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

      {/* Main metronome area */}
      <div className="no-scrollbar flex flex-1 min-w-0 flex-col items-center justify-center gap-3 overflow-y-auto p-3 sm:p-4">
        <MetronomeDial
          bpm={bpm}
          onBpmChange={handleBpmChange}
          isRunning={isRunning}
          onToggle={handleToggle}
          onTap={handleTap}
          beatsPerBar={timeSig.beatsPerBar}
          accentPattern={accentPattern}
          currentBeat={currentBeat}
          lastBeatTime={lastBeatTime}
          getNow={getNow}
          isSkippedBar={isSkippedBar}
          timeSig={timeSig.key}
          subdivision={subdivision}
        />

        {/* Action row — minimal, no-border affordances styled like the dial's
            inline "Tap to start" text. */}
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={() => settings.set('metronomeListenBack', !listenBack)}
            className={`flex items-center gap-2 text-xs uppercase tracking-wider transition-colors ${
              listenBack ? 'text-super-accent' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Headphones className="h-3.5 w-3.5" />
            <span>{listenBack ? 'Listen back · on' : 'Listen back'}</span>
          </button>

          <Button
            onClick={() => setSidebarOpen(true)}
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground lg:hidden"
          >
            <Settings2 className="h-4 w-4" />
            Settings
          </Button>

          {tapHint && <span className="text-xs text-muted-foreground">{tapHint}</span>}
        </div>

        {practiceEnabled && (
          <PracticeTracker
            state={practiceState}
            countdown={practiceCountdown}
            intervalIndex={intervalIndex}
            totalIntervals={totalIntervals}
            intervalRemainingSec={intervalRemainingSec}
            intervalDurationSec={intervalDurationSec}
            onStart={startPracticeSession}
            onStop={stopPracticeSession}
            onRestart={restartPracticeSession}
          />
        )}

        {skipBars > 0 && (
          <div className="text-xs text-muted-foreground">
            Skip pattern: play {playBars} · skip {skipBars}
          </div>
        )}

        {listenBack && trackerRef.current && (
          <div className="w-full self-stretch">
            <ListenBackPanel
              tracker={trackerRef.current}
              getNow={getNow}
              isActive={listenBack}
              bpm={bpm}
              height={140}
              showTriplets={showTriplets}
              onToggleTriplets={() => settings.set('metronomeGridTriplets', !showTriplets)}
              warning={listenError}
              threshold={detectorThreshold}
              levelBufferRef={levelBufferRef}
            />
          </div>
        )}
      </div>

      {/* Desktop sidebar */}
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
            <Sidebar
              settings={settings}
              calibrating={calibrating}
              calibrationCountdown={calibrationCountdown}
              calibrationStatus={calibrationStatus}
              onStartCalibration={startCalibration}
              onResetLatency={resetLatency}
            />
          </div>
        </aside>
      )}

      {/* Mobile sidebar (sheet) */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="right" className="no-scrollbar w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Settings</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <Sidebar
              settings={settings}
              calibrating={calibrating}
              calibrationCountdown={calibrationCountdown}
              calibrationStatus={calibrationStatus}
              onStartCalibration={startCalibration}
              onResetLatency={resetLatency}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function normalizePattern(value, beatsPerBar, subdivision = 1) {
  const desired = beatsPerBar * subdivision;
  if (Array.isArray(value) && value.length === desired) return value;
  const oldSub = Array.isArray(value) && beatsPerBar > 0
    ? Math.max(1, Math.round(value.length / beatsPerBar))
    : 1;
  const arr = [];
  for (let i = 0; i < desired; i++) {
    const beatIdx = Math.floor(i / subdivision);
    const subInBeat = i % subdivision;
    let kind;
    if (subInBeat === 0) {
      const oldIdx = beatIdx * oldSub;
      kind = (Array.isArray(value) ? value[oldIdx] : null)
        ?? (beatIdx === 0 ? 'accent' : 'regular');
    } else if (oldSub === subdivision && Array.isArray(value)) {
      kind = value[beatIdx * oldSub + subInBeat] ?? 'regular';
    } else {
      kind = 'regular';
    }
    arr.push(kind);
  }
  return arr;
}
