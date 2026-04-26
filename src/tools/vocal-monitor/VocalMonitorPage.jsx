import { useEffect, useMemo, useRef, useState } from 'react';

import { SharedSettings, PitchContext, DroneManager, ScaleManager } from '@/core';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { trackEvent } from '@/lib/analytics';
import { useWakeLock } from '@/lib/useWakeLock';

import PitchCanvas from './PitchCanvas.jsx';
import Toolbar from './Toolbar.jsx';
import Sidebar from './Sidebar.jsx';

export default function VocalMonitorPage() {
  const services = useMemo(() => createServices(), []);
  const controllerRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [starting, setStarting] = useState(false);
  const [scaleLocked, setScaleLocked] = useState(false);
  const [lockedScaleType, setLockedScaleType] = useState(null);
  const [effectiveRootName, setEffectiveRootName] = useState(null);
  const [isRollingKeyActive, setIsRollingKeyActive] = useState(false);
  const [exerciseRange, setExerciseRange] = useState(null);
  const [effectiveRollingKeyLowest, setEffectiveRollingKeyLowest] = useState(null);
  const [effectiveRollingKeyHighest, setEffectiveRollingKeyHighest] = useState(null);
  const [exerciseEnabled, setExerciseEnabled] = useState(
    () => services.settings.get('exerciseEnabled')
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState(null);

  useWakeLock(isRecording);

  useEffect(() => {
    return services.settings.subscribe((key) => {
      if (key === 'exerciseEnabled') {
        setExerciseEnabled(services.settings.get('exerciseEnabled'));
      }
    });
  }, [services.settings]);

  useEffect(() => {
    trackEvent('tool_open', { tool: 'vocal-monitor' });
    return () => {
      services.pitchContext.stop?.();
      services.droneManager.stopDrone?.();
      services.droneManager.stopChordDrone?.();
      services.pitchContext.dispose?.();
      services.droneManager.dispose?.();
    };
  }, [services]);

  const handleStart = async () => {
    if (!controllerRef.current) return;
    setStarting(true);
    setError(null);
    try {
      await controllerRef.current.start();
    } catch (e) {
      console.error('Failed to start vocal monitor:', e);
      setError(
        e?.name === 'NotAllowedError'
          ? 'Microphone permission denied. Allow microphone access in your browser to use this tool.'
          : 'Could not start the microphone. Try a different browser or check permissions.'
      );
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <Toolbar
        isRecording={isRecording}
        starting={starting}
        canRestart={exerciseEnabled || isRollingKeyActive}
        onStart={handleStart}
        onStop={() => controllerRef.current?.stop()}
        onClear={() => controllerRef.current?.clear()}
        onRestart={() => controllerRef.current?.restart()}
        onOpenSettings={() => setSidebarOpen(true)}
      />

      {error && (
        <div className="border-b bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 p-3">
          <PitchCanvas
            services={services}
            onControllerReady={(c) => {
              controllerRef.current = c;
            }}
            onStateChange={(state) => {
              setIsRecording(state.isRecording);
              setScaleLocked(state.scaleLocked);
              setLockedScaleType(state.lockedScaleType);
              setEffectiveRootName(state.effectiveRootName);
              setIsRollingKeyActive(state.isRollingKeyActive);
              setExerciseRange(state.exerciseRange);
              setEffectiveRollingKeyLowest(state.effectiveRollingKeyLowest);
              setEffectiveRollingKeyHighest(state.effectiveRollingKeyHighest);
            }}
          />
        </div>

        <aside className="hidden w-80 shrink-0 overflow-y-auto border-l bg-background lg:block">
          <div className="p-4">
            <Sidebar
              settings={services.settings}
              scaleLocked={scaleLocked}
              lockedScaleType={lockedScaleType}
              effectiveRootName={effectiveRootName}
              isRollingKeyActive={isRollingKeyActive}
              exerciseRange={exerciseRange}
              effectiveRollingKeyLowest={effectiveRollingKeyLowest}
              effectiveRollingKeyHighest={effectiveRollingKeyHighest}
            />
          </div>
        </aside>
      </div>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Settings</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <Sidebar
              settings={services.settings}
              scaleLocked={scaleLocked}
              lockedScaleType={lockedScaleType}
              effectiveRootName={effectiveRootName}
              isRollingKeyActive={isRollingKeyActive}
              exerciseRange={exerciseRange}
              effectiveRollingKeyLowest={effectiveRollingKeyLowest}
              effectiveRollingKeyHighest={effectiveRollingKeyHighest}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function createServices() {
  const settings = new SharedSettings();
  const rootNote = settings.getRootNoteWithOctave();
  const scaleType = settings.get('scaleType');
  const scaleManager = new ScaleManager(rootNote, scaleType);

  const pitchContext = new PitchContext({
    updateInterval: 30,
    threshold: 0.0001,
    bufferSize: 8192,
  });

  const droneManager = new DroneManager();

  // ScaleManager is kept in sync by VocalMonitorController via _syncScale,
  // which uses effective (not raw settings) values so rolling-key and scale-lock
  // overrides apply consistently.

  return { settings, scaleManager, pitchContext, droneManager };
}
