import { Lock } from 'lucide-react';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { FrequencyConverter } from '../../pitch-engine/index.js';
import { useSharedSettingValues } from './useSharedSettings.js';
import { ROLLING_KEY_LOWS, ROLLING_KEY_HIGHS } from './rollingKeyOptions.js';

const ROOT_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const ROOT_NOTE_LABELS = {
  'C#': 'C# / Db',
  'D#': 'D# / Eb',
  'F#': 'F# / Gb',
  'G#': 'G# / Ab',
  'A#': 'A# / Bb',
};

const SCALE_GROUPS = [
  {
    label: 'Scales',
    options: [
      { value: 'major', label: 'Major' },
      { value: 'minor', label: 'Natural Minor' },
      { value: 'harmonicMinor', label: 'Harmonic Minor' },
      { value: 'melodicMinor', label: 'Melodic Minor' },
      { value: 'pentatonic', label: 'Pentatonic Major' },
      { value: 'blues', label: 'Blues' },
      { value: 'chromatic', label: 'Chromatic' },
    ],
  },
  {
    label: 'Modes',
    options: [
      { value: 'dorian', label: 'Dorian' },
      { value: 'mixolydian', label: 'Mixolydian' },
    ],
  },
  {
    label: 'Advanced',
    options: [
      { value: 'wholeTone', label: 'Whole Tone' },
      { value: 'diminished', label: 'Diminished' },
    ],
  },
];

const EXERCISE_GROUPS = [
  {
    label: 'Ladders',
    options: [
      { value: 'ascendingMajorLadder', label: 'Ascending Major Ladder' },
      { value: 'ascendingMinorLadder', label: 'Ascending Minor Ladder' },
      { value: 'descendingMajorLadder', label: 'Descending Major Ladder' },
      { value: 'descendingMinorLadder', label: 'Descending Minor Ladder' },
      { value: 'tonicReturnMajor', label: 'Tonic Return (Major)' },
      { value: 'tonicReturnMinor', label: 'Tonic Return (Minor)' },
    ],
  },
  {
    label: 'Triads & Chords',
    options: [
      { value: 'majorTriad', label: 'Major Triad (1-3-5-8)' },
      { value: 'minorTriad', label: 'Minor Triad (1-3-5-8)' },
      { value: 'majorSeventh', label: 'Major Seventh (1-3-5-7-8)' },
      { value: 'minorSeventh', label: 'Minor Seventh (1-3-5-7-8)' },
    ],
  },
  {
    label: 'Intervals',
    options: [
      { value: 'semitoneUp', label: 'Semitone Up' },
      { value: 'semitoneDown', label: 'Semitone Down' },
      { value: 'toneUp', label: 'Whole Tone Up' },
      { value: 'toneDown', label: 'Whole Tone Down' },
      { value: 'minorThirdUp', label: 'Minor Third Up' },
      { value: 'majorThirdUp', label: 'Major Third Up' },
      { value: 'minorThirdDown', label: 'Minor Third Down' },
      { value: 'majorThirdDown', label: 'Major Third Down' },
      { value: 'fourthUp', label: 'Perfect Fourth Up' },
      { value: 'fourthDown', label: 'Perfect Fourth Down' },
      { value: 'fifthUp', label: 'Perfect Fifth Up' },
      { value: 'fifthDown', label: 'Perfect Fifth Down' },
    ],
  },
];

const ROLLING_FLOOR_MIDI = FrequencyConverter.noteNameToMidi(ROLLING_KEY_LOWS[0]);
const ROLLING_CEILING_MIDI = FrequencyConverter.noteNameToMidi(
  ROLLING_KEY_HIGHS[ROLLING_KEY_HIGHS.length - 1]
);

const SETTINGS_KEYS = [
  'rootNote',
  'scaleType',
  'droneEnabled',
  'droneMode',
  'exerciseEnabled',
  'exerciseType',
  'exerciseShowLyrics',
  'rollingKeyEnabled',
  'rollingKeyLowestRoot',
  'rollingKeyHighestRoot',
  'rollingKeyDirection',
  'rollingKeyStepType',
];

export default function Sidebar({
  settings,
  scaleLocked,
  lockedScaleType,
  effectiveRootName,
  isRollingKeyActive,
  exerciseRange,
  effectiveRollingKeyLowest,
  effectiveRollingKeyHighest,
}) {
  const values = useSharedSettingValues(settings, SETTINGS_KEYS);

  const set = (key) => (value) => settings.set(key, value);
  const setBool = (key) => (checked) => settings.set(key, !!checked);

  // When an exercise is active, hide rolling-key options that would push
  // the exercise above/below the dropdown's overall range.
  const filteredHighs = exerciseRange
    ? ROLLING_KEY_HIGHS.filter(
        (n) => FrequencyConverter.noteNameToMidi(n) + exerciseRange.max <= ROLLING_CEILING_MIDI
      )
    : ROLLING_KEY_HIGHS;
  const filteredLows = exerciseRange
    ? ROLLING_KEY_LOWS.filter(
        (n) => FrequencyConverter.noteNameToMidi(n) + exerciseRange.min >= ROLLING_FLOOR_MIDI
      )
    : ROLLING_KEY_LOWS;

  // Display the controller's effective values so the dropdown shows what's
  // actually being used (clamped if needed) rather than the raw user setting.
  const displayLowest = effectiveRollingKeyLowest ?? values.rollingKeyLowestRoot;
  const displayHighest = effectiveRollingKeyHighest ?? values.rollingKeyHighestRoot;

  // The "Now in" badge appears when ephemeral overrides differ from the
  // persisted settings — i.e. rolling key has advanced, or an exercise has
  // locked the scale to a different value than the user picked.
  const rollingRootDiffers =
    isRollingKeyActive && effectiveRootName && effectiveRootName !== values.rootNote;
  const lockedScaleDiffers =
    scaleLocked && lockedScaleType && lockedScaleType !== values.scaleType;
  const showNowIn = rollingRootDiffers || lockedScaleDiffers;

  return (
    <div className="flex flex-col gap-6 p-1">
      {showNowIn && (
        <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs">
          <span className="text-muted-foreground">Now playing in</span>
          <Badge variant="secondary" className="font-mono">
            {(rollingRootDiffers ? effectiveRootName : values.rootNote)}{' '}
            {scaleLocked ? lockedScaleType : values.scaleType}
          </Badge>
        </div>
      )}
      <Section title="Scale">
        <ToggleRow
          id="rolling-key-toggle"
          label="Rolling Key"
          checked={values.rollingKeyEnabled}
          onCheckedChange={setBool('rollingKeyEnabled')}
        />

        {values.rollingKeyEnabled ? (
          <>
            <Field label="Lowest Root">
              <Select value={displayLowest} onValueChange={set('rollingKeyLowestRoot')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {filteredLows.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field
              label="Highest Root"
              hint={
                exerciseRange && exerciseRange.max > 0
                  ? `top ≤ ${noteAbove(displayHighest, exerciseRange.max)}`
                  : null
              }
            >
              <Select value={displayHighest} onValueChange={set('rollingKeyHighestRoot')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {filteredHighs.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Direction">
              <Select value={values.rollingKeyDirection} onValueChange={set('rollingKeyDirection')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ascending">Ascending</SelectItem>
                  <SelectItem value="descending">Descending</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Step Type">
              <Select value={values.rollingKeyStepType} onValueChange={set('rollingKeyStepType')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semitone">Semitone</SelectItem>
                  <SelectItem value="wholeTone">Whole Tone</SelectItem>
                  <SelectItem value="scaleDegree">Scale Degree</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </>
        ) : (
          <Field label="Root Note">
            <Select value={values.rootNote} onValueChange={set('rootNote')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROOT_NOTES.map((n) => (
                  <SelectItem key={n} value={n}>{ROOT_NOTE_LABELS[n] ?? n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        <Field label="Scale Type" hint={scaleLocked ? 'Locked by exercise' : null} hintIcon={scaleLocked ? <Lock className="h-3 w-3" /> : null}>
          <Select
            value={values.scaleType}
            onValueChange={set('scaleType')}
            disabled={scaleLocked}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SCALE_GROUPS.map((g) => (
                <SelectGroup key={g.label}>
                  <SelectLabel>{g.label}</SelectLabel>
                  {g.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <ToggleRow
          id="drone-toggle"
          label="Root Drone"
          checked={values.droneEnabled}
          onCheckedChange={setBool('droneEnabled')}
        />

        {values.droneEnabled && (
          <ToggleRow
            id="drone-chord"
            label="Play as Chord"
            checked={values.droneMode === 'chord'}
            onCheckedChange={(c) => settings.set('droneMode', c ? 'chord' : 'root')}
          />
        )}
      </Section>

      <Separator />

      <Section title="Exercise">
        <ToggleRow
          id="exercise-toggle"
          label="Exercise Mode"
          checked={values.exerciseEnabled}
          onCheckedChange={setBool('exerciseEnabled')}
        />

        {values.exerciseEnabled && (
          <>
            <Field label="Exercise Type">
              <Select value={values.exerciseType} onValueChange={set('exerciseType')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXERCISE_GROUPS.map((g) => (
                    <SelectGroup key={g.label}>
                      <SelectLabel>{g.label}</SelectLabel>
                      {g.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <ToggleRow
              id="show-lyrics"
              label="Show Solfège"
              checked={values.exerciseShowLyrics}
              onCheckedChange={setBool('exerciseShowLyrics')}
            />
          </>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, hint, hintIcon, children }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-sm">{label}</Label>
        {hint && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {hintIcon}
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function ToggleRow({ id, label, checked, onCheckedChange }) {
  return (
    <div className="flex items-center justify-between">
      <Label htmlFor={id} className="cursor-pointer text-sm">
        {label}
      </Label>
      <Switch id={id} checked={!!checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function noteAbove(rootName, semitones) {
  const midi = FrequencyConverter.noteNameToMidi(rootName) + semitones;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[midi % 12]}${octave}`;
}
