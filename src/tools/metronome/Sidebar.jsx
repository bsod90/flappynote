import { useEffect, useState } from 'react';
import { Headphones, Timer, Volume2 } from 'lucide-react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useSharedSettingValues } from '../vocal-monitor/useSharedSettings.js';
import { TIMBRE_LIST } from './clickSamples.js';

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

const KEYS = [
  'metronomeTimeSig',
  'metronomeAccentPattern',
  'metronomeTimbre',
  'metronomeVolume',
  'metronomeSkipPlay',
  'metronomeSkipSkip',
  'metronomeSubdivision',
  'metronomeListenBack',
  'metronomeListenSensitivity',
  'metronomeLatencyMs',
  'metronomePracticeEnabled',
  'metronomePracticeSessionMinutes',
  'metronomePracticeIntervalMinutes',
];

const SUBDIVISIONS = [
  { value: 1, label: 'Quarters (no subdivision)' },
  { value: 2, label: 'Eighths (×2)' },
  { value: 3, label: 'Triplets (×3)' },
  { value: 4, label: 'Sixteenths (×4)' },
  { value: 6, label: 'Sixtuplets (×6)' },
];

const BEAT_KIND_CYCLE = ['regular', 'accent', 'silent'];

export default function Sidebar({
  settings,
  calibrating = false,
  calibrationCountdown = 0,
  calibrationStatus = null,
  onStartCalibration,
  onResetLatency,
}) {
  const values = useSharedSettingValues(settings, KEYS);
  const timeSig = values.metronomeTimeSig ?? '4/4';
  const sig = TIME_SIGNATURES.find((s) => s.key === timeSig) ?? TIME_SIGNATURES[2];
  const pattern = normalizePattern(values.metronomeAccentPattern, sig.beatsPerBar);
  const timbre = values.metronomeTimbre ?? 'woodblock';
  const volume = values.metronomeVolume ?? 0.8;
  const playBars = values.metronomeSkipPlay ?? 4;
  const skipBars = values.metronomeSkipSkip ?? 0;
  const subdivision = values.metronomeSubdivision ?? 1;
  const listenBack = !!values.metronomeListenBack;
  const latencyMs = values.metronomeLatencyMs ?? 12;
  const latencyIsDefault = latencyMs === 12;
  const practiceEnabled = !!values.metronomePracticeEnabled;
  const practiceSessionMin = values.metronomePracticeSessionMinutes ?? 10;
  const practiceIntervalMin = values.metronomePracticeIntervalMinutes ?? 1;
  // Slider scale 1..100 (high = more sensitive). Older saved values that
  // looked like raw thresholds (≪ 1) get coerced to the middle.
  const rawSens = values.metronomeListenSensitivity;
  const sensitivity = typeof rawSens === 'number' && rawSens >= 1 ? rawSens : 50;

  const setSig = (newKey) => {
    const next = TIME_SIGNATURES.find((s) => s.key === newKey);
    if (!next) return;
    settings.set('metronomeTimeSig', newKey);
    // Resize accent pattern: keep existing values where possible, default new beats
    const resized = [];
    for (let i = 0; i < next.beatsPerBar; i++) {
      resized.push(pattern[i] ?? (i === 0 ? 'accent' : 'regular'));
    }
    settings.set('metronomeAccentPattern', resized);
  };

  const togglePatternBeat = (idx) => {
    const next = [...pattern];
    const cur = next[idx] ?? 'regular';
    next[idx] = BEAT_KIND_CYCLE[(BEAT_KIND_CYCLE.indexOf(cur) + 1) % BEAT_KIND_CYCLE.length];
    settings.set('metronomeAccentPattern', next);
  };

  return (
    <div className="flex flex-col gap-2 p-1">
      <Section title="Time">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Time signature">
            <Select value={timeSig} onValueChange={setSig}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIME_SIGNATURES.map((s) => (
                  <SelectItem key={s.key} value={s.key}>{s.key}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Subdivision">
            <Select
              value={String(subdivision)}
              onValueChange={(v) => settings.set('metronomeSubdivision', Number(v))}
            >
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SUBDIVISIONS.map((s) => (
                  <SelectItem key={s.value} value={String(s.value)}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field label="Accent pattern">
          <div className="flex flex-wrap gap-1.5">
            {pattern.map((kind, i) => (
              <button
                key={i}
                type="button"
                onClick={() => togglePatternBeat(i)}
                className={`h-9 min-w-9 rounded-md border px-2 text-xs font-mono ${beatButtonClass(kind)}`}
                aria-label={`Beat ${i + 1} (${kind})`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </Field>
      </Section>

      <Separator />

      <Section title="Sound">
        <div className="grid grid-cols-[1fr_1.4fr] items-end gap-2">
          <Field label="Click">
            <Select value={timbre} onValueChange={(v) => settings.set('metronomeTimbre', v)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIMBRE_LIST.map((t) => (
                  <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={`Volume — ${Math.round(volume * 100)}%`}>
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-muted-foreground" />
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(volume * 100)}
                onChange={(e) => settings.set('metronomeVolume', e.target.valueAsNumber / 100)}
                className="w-full accent-primary"
              />
            </div>
          </Field>
        </div>
      </Section>

      <Separator />

      <Section title="Skip pattern">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Play bars">
            <NumberInput
              value={playBars}
              min={1}
              max={32}
              onChange={(v) => settings.set('metronomeSkipPlay', v)}
            />
          </Field>
          <Field label="Skip bars">
            <NumberInput
              value={skipBars}
              min={0}
              max={32}
              onChange={(v) => settings.set('metronomeSkipSkip', v)}
            />
          </Field>
        </div>
        {skipBars > 0 && (
          <button
            type="button"
            onClick={() => settings.set('metronomeSkipSkip', 0)}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            Plays {playBars}, mutes {skipBars} — tap to disable
          </button>
        )}
      </Section>

      <Separator />

      <Section title="Practice">
        <div className="flex items-center justify-between">
          <Label htmlFor="practice-toggle" className="cursor-pointer text-sm">
            <span className="inline-flex items-center gap-1.5">
              <Timer className="h-4 w-4" />
              Practice mode
            </span>
          </Label>
          <Switch
            id="practice-toggle"
            checked={practiceEnabled}
            onCheckedChange={(c) => settings.set('metronomePracticeEnabled', !!c)}
          />
        </div>
        {practiceEnabled && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Session (min)">
                <NumberInput
                  value={practiceSessionMin}
                  min={1}
                  max={120}
                  onChange={(v) => settings.set('metronomePracticeSessionMinutes', v)}
                />
              </Field>
              <Field label="Interval (min)">
                <NumberInput
                  value={practiceIntervalMin}
                  min={1}
                  max={60}
                  onChange={(v) => settings.set('metronomePracticeIntervalMinutes', v)}
                />
              </Field>
            </div>
          </>
        )}
      </Section>

      <Separator />

      <Section title="Listen back">
        <div className="flex items-center justify-between">
          <Label htmlFor="listen-back-toggle" className="cursor-pointer text-sm">
            <span className="inline-flex items-center gap-1.5">
              <Headphones className="h-4 w-4" />
              Mic listen back
            </span>
          </Label>
          <Switch
            id="listen-back-toggle"
            checked={listenBack}
            onCheckedChange={(c) => settings.set('metronomeListenBack', !!c)}
          />
        </div>
        {listenBack && (
          <Field
            label={`Sensitivity — ${sensitivity}`}
            hint={(
              <>
                <strong className="text-yellow-500">Wear headphones</strong> · higher catches softer hits.
              </>
            )}
          >
            <input
              type="range"
              min={1}
              max={100}
              value={sensitivity}
              onChange={(e) =>
                settings.set('metronomeListenSensitivity', e.target.valueAsNumber)
              }
              className="w-full accent-primary"
            />
          </Field>
        )}

        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Label className="text-xs">Latency</Label>
            <LatencyInput
              value={latencyMs}
              disabled={calibrating}
              onCommit={(n) => settings.set('metronomeLatencyMs', n)}
            />
            <span className="text-xs text-muted-foreground">ms</span>
            <Button
              size="sm"
              variant={calibrating ? 'secondary' : 'outline'}
              onClick={onStartCalibration}
              disabled={calibrating}
              className="ml-auto"
            >
              {calibrating
                ? calibrationCountdown > 0
                  ? `Listening ${calibrationCountdown}s`
                  : 'Listening…'
                : 'Calibrate'}
            </Button>
          </div>
          {!latencyIsDefault && (
            <button
              type="button"
              onClick={onResetLatency}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              Reset to default (12ms)
            </button>
          )}
          {calibrationStatus && (
            <p
              className={`text-[11px] ${
                calibrationStatus.kind === 'error'
                  ? 'text-destructive'
                  : calibrationStatus.kind === 'success'
                    ? 'text-super-accent'
                    : 'text-muted-foreground'
              }`}
            >
              {calibrationStatus.message}
            </p>
          )}
        </div>
      </Section>
    </div>
  );
}

function normalizePattern(value, length) {
  if (!Array.isArray(value) || value.length !== length) {
    const arr = [];
    for (let i = 0; i < length; i++) arr.push(i === 0 ? 'accent' : 'regular');
    return arr;
  }
  return value;
}

function beatButtonClass(kind) {
  if (kind === 'accent') return 'border-primary bg-primary/15 text-primary font-bold';
  if (kind === 'silent') return 'border-dashed text-muted-foreground line-through opacity-60';
  return 'border-input bg-background hover:bg-accent';
}

function Section({ title, children }) {
  return (
    <div className="space-y-1.5">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Number input that lets the user clear the field without snapping back to
 * 0 mid-edit. The local string drives the visible value; we only push to
 * `onCommit` when the parsed number is valid. On blur with empty/invalid
 * input we revert to the last committed value.
 */
function LatencyInput({ value, disabled, onCommit }) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText(String(value));
  }, [value]);
  return (
    <input
      type="number"
      step={1}
      value={text}
      disabled={disabled}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        const n = parseInt(next, 10);
        if (Number.isFinite(n)) onCommit(n);
      }}
      onBlur={() => {
        if (text === '' || !Number.isFinite(parseInt(text, 10))) {
          setText(String(value));
        }
      }}
      className="h-8 w-16 rounded-md border border-input bg-background px-2 text-sm font-mono"
    />
  );
}

function NumberInput({ value, onChange, min, max }) {
  return (
    <div className="flex items-center gap-1">
      <Button
        size="sm"
        variant="outline"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
      >
        −
      </Button>
      <span className="flex-1 text-center font-mono">{value}</span>
      <Button
        size="sm"
        variant="outline"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
      >
        +
      </Button>
    </div>
  );
}
