import { lazy } from 'react';
import { Aperture, AudioLines, CircleGauge } from 'lucide-react';

const VocalMonitorPage = lazy(() => import('./vocal-monitor/VocalMonitorPage.jsx'));
const MetronomePage = lazy(() => import('./metronome/MetronomePage.jsx'));
const CircleOfFifthsPage = lazy(() => import('./circle-of-fifths/CircleOfFifthsPage.jsx'));

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
      'Big interactive circle of fifths with diatonic chord highlighting, key signatures, audible chords for ear training, and genre-tagged chord progressions.',
    icon: Aperture,
    Component: CircleOfFifthsPage,
  },
];

export function getTool(id) {
  return tools.find((t) => t.id === id);
}

export function getToolByPath(path) {
  return tools.find((t) => t.path === path);
}
