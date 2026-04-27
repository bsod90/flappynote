import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';

import { SharedSettings } from '@/core';
import { Button } from '@/components/ui/button';
import { trackEvent } from '@/lib/analytics';
import { useWakeLock } from '@/lib/useWakeLock';

import CircleOfFifths from './CircleOfFifths.jsx';
import Sidebar from './Sidebar.jsx';
import ProgressionLibrary from './ProgressionLibrary.jsx';
import { ChordSynth } from './ChordSynth.js';
import { diatonicChords as buildDiatonic, MAJOR_KEYS } from './musicTheory.js';
import { useSharedSettingValues } from '../vocal-monitor/useSharedSettings.js';

const SETTINGS_KEYS = [
  'circleSelectedPos',
  'circleSelectedMode',
  'circleVoicing',
  'circleArticulation',
  'circleVolume',
  'circleProgressionGenre',
  'circleProgressionBars',
  'circleProgressionTempo',
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
  const genre = v.circleProgressionGenre ?? 'pop';
  const bars = v.circleProgressionBars ?? 4;
  const tempo = v.circleProgressionTempo ?? 90;
  const sidebarCollapsed = !!v.settingsCollapsed;

  const synthRef = useRef(null);
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );
  const [playingProgressionId, setPlayingProgressionId] = useState(null);

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

  // Wake lock while a progression is playing
  useWakeLock(!!playingProgressionId);

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

  const handlePlayProgression = async (id, chords) => {
    const synth = synthRef.current;
    if (!synth) return;
    synth.unlock();
    setPlayingProgressionId(id);
    const secondsPerChord = 60 / Math.max(40, tempo);
    try {
      await synth.playProgression(chords, { secondsPerChord, voicing, articulation });
    } finally {
      // Only clear if this is still the active one (a newer click replaced us)
      setPlayingProgressionId((cur) => (cur === id ? null : cur));
    }
  };

  const handleStopProgression = () => {
    synthRef.current?.stop();
    setPlayingProgressionId(null);
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

      {/* Main area — wheel on top, progression library below */}
      <div className="no-scrollbar flex flex-1 min-w-0 flex-col items-center gap-3 overflow-y-auto p-3 sm:p-4">
        <div className="flex w-full flex-1 items-center justify-center">
          <CircleOfFifths
            selectedPos={selectedPos}
            selectedMode={selectedMode}
            onSelect={handleSelect}
            diatonicChords={diatonic}
            onPlayChord={handleHubChord}
            isDark={isDark}
          />
        </div>

        <div className="w-full self-stretch">
          <ProgressionLibrary
            selectedPos={selectedPos}
            selectedMode={selectedMode}
            genre={genre}
            onGenreChange={(g) => settings.set('circleProgressionGenre', g)}
            bars={bars}
            onBarsChange={(b) => settings.set('circleProgressionBars', b)}
            onPlayProgression={handlePlayProgression}
            onStopProgression={handleStopProgression}
            isPlaying={!!playingProgressionId}
            playingId={playingProgressionId}
          />
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
    </div>
  );
}
