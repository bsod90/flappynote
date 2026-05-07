import { lazy } from 'react';
import { Aperture, AudioLines, CircleGauge, Guitar } from 'lucide-react';

const VocalMonitorPage = lazy(() => import('./vocal-monitor/VocalMonitorPage.jsx'));
const MetronomePage = lazy(() => import('./metronome/MetronomePage.jsx'));
const CircleOfFifthsPage = lazy(() => import('./circle-of-fifths/CircleOfFifthsPage.jsx'));
const TunerPage = lazy(() => import('./tuner/TunerPage.jsx'));

export const tools = [
  {
    id: 'vocal-monitor',
    path: '/vocal-monitor',
    name: 'Vocal Monitor',
    tagline: 'Real-time pitch on a piano roll',
    description:
      'Visualize your voice as a continuous line over time. Practice scales, intervals, and ladders with built-in exercises.',
    icon: AudioLines,
    Component: VocalMonitorPage,
  },
  {
    id: 'metronome',
    path: '/metronome',
    name: 'Metronome',
    tagline: 'Big-dial click with skip patterns and tap tempo',
    description:
      'A digital metronome with a rotating BPM dial, accent patterns, tap tempo, and a skip pattern for practicing without the click.',
    icon: CircleGauge,
    Component: MetronomePage,
  },
  {
    id: 'circle-of-fifths',
    path: '/circle-of-fifths',
    name: 'Circle of Fifths',
    tagline: 'Interactive, color-coded, audible',
    description:
      'Big interactive circle of fifths with diatonic chord highlighting, key signatures, audible chords for ear training, and theory overlays for secondary dominants, tritone substitutions, and parallel keys.',
    icon: Aperture,
    Component: CircleOfFifthsPage,
  },
  {
    id: 'tuner',
    path: '/tuner',
    name: 'Tuner',
    tagline: 'Chromatic tuner for guitar, bass, ukulele, violin',
    description:
      'A real-time chromatic instrument tuner. Pick a tuning preset (standard, drop D, half-step, DADGAD, open D/G, low-G ukulele, …) or chromatic mode, see cents-off on a precision strip, and watch each string light up green as it lands in tune.',
    icon: Guitar,
    Component: TunerPage,
  },
];

export function getTool(id) {
  return tools.find((t) => t.id === id);
}

export function getToolByPath(path) {
  return tools.find((t) => t.path === path);
}
