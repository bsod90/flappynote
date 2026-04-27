import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronsLeft, ChevronsRight, Settings2 } from 'lucide-react';

import { SharedSettings } from '@/core';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { trackEvent } from '@/lib/analytics';

import CircleOfFifths from './CircleOfFifths.jsx';
import Sidebar from './Sidebar.jsx';
import { DiatonicChordRow } from './KeyHub.jsx';
import { ChordSynth } from './ChordSynth.js';
import { diatonicChords as buildDiatonic, MAJOR_KEYS } from './musicTheory.js';
import { useSharedSettingValues } from '../vocal-monitor/useSharedSettings.js';

const SETTINGS_KEYS = [
  'circleSelectedPos',
  'circleSelectedMode',
  'circleVoicing',
  'circleArticulation',
  'circleVolume',
  'circleShowSecondaryDoms',
  'circleShowTritoneSubs',
  'circleShowParallel',
  'settingsCollapsed',
];

export default function CircleOfFifthsPage() {
  const settings = useMemo(() => new SharedSettings(), []);
  const v = useSharedSettingValues(settings, SETTINGS_KEYS);

  const selectedPos = v.circleSelectedPos ?? 0;
  const selectedMode = v.circleSelectedMode ?? 'major';
  const voicing = v.circleVoicing ?? 'triad';
  const articulation = v.circleArticulation ?? 'block';
  const volume = v.circleVolume ?? 0.6;
  const overlays = useMemo(() => ({
    secondary: !!v.circleShowSecondaryDoms,
    tritone: !!v.circleShowTritoneSubs,
    parallel: !!v.circleShowParallel,
  }), [v.circleShowSecondaryDoms, v.circleShowTritoneSubs, v.circleShowParallel]);
  const sidebarCollapsed = !!v.settingsCollapsed;

  const synthRef = useRef(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );

  // Watch for theme changes (followed by useColorScheme on the html root)
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return;
    const root = document.documentElement;
    const obs = new MutationObserver(() => {
      setIsDark(root.classList.contains('dark'));
    });
    obs.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  // Lazy-init the synth on mount; dispose on unmount.
  useEffect(() => {
    trackEvent('tool_open', { tool: 'circle-of-fifths' });
    const synth = new ChordSynth();
    synth.setVolume(volume);
    synthRef.current = synth;
    return () => {
      synth.dispose();
      synthRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push volume changes through to the synth
  useEffect(() => {
    synthRef.current?.setVolume(volume);
  }, [volume]);

  // Compute the diatonic chord descriptors for the selected key.
  const major = MAJOR_KEYS[selectedPos];
  const tonicSemi = selectedMode === 'major'
    ? major.semitone
    : ((major.semitone - 3) + 12) % 12;
  const diatonic = useMemo(
    () => buildDiatonic(tonicSemi, major.accType, selectedMode),
    [tonicSemi, major.accType, selectedMode]
  );

  const handleSelect = (pos, ring) => {
    const newMode = ring === 'minor' ? 'minor' : 'major';
    settings.set('circleSelectedPos', pos);
    settings.set('circleSelectedMode', newMode);
    // Play the tonic chord of the newly-selected key
    const newMajor = MAJOR_KEYS[pos];
    const newTonicSemi = newMode === 'major'
      ? newMajor.semitone
      : ((newMajor.semitone - 3) + 12) % 12;
    const tonicChord = {
      semitones: newTonicSemi,
      type: newMode === 'minor' ? 'minor' : 'major',
    };
    const synth = synthRef.current;
    if (synth) {
      synth.unlock();
      synth.playChord(tonicChord, { voicing, articulation });
    }
  };

  const handleHubChord = (chord) => {
    const synth = synthRef.current;
    if (!synth) return;
    synth.unlock();
    synth.playChord(chord, { voicing, articulation });
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

      {/* Mobile-only Settings button — opens the Sheet drawer */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open settings"
        className="absolute right-3 top-3 z-10 gap-2 shadow-sm lg:hidden"
      >
        <Settings2 className="h-4 w-4" />
        <span>Settings</span>
      </Button>

      {/* Main area — wheel centered */}
      <div className="no-scrollbar flex flex-1 min-w-0 flex-col items-center justify-center gap-3 overflow-y-auto p-3 sm:p-4">
        <CircleOfFifths
          selectedPos={selectedPos}
          selectedMode={selectedMode}
          onSelect={handleSelect}
          diatonicChords={diatonic}
          onPlayChord={handleHubChord}
          isDark={isDark}
          overlays={overlays}
        />
        {/* Mobile-only diatonic chord row — desktop renders it inside the hub */}
        <div className="w-full max-w-md px-1 sm:hidden">
          <DiatonicChordRow chords={diatonic} onChordClick={handleHubChord} />
        </div>
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
