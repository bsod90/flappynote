import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

import { useSharedSettingValues } from '../vocal-monitor/useSharedSettings.js';
import { getInstruments, getTuningsFor, getDefaultTuning } from './tunings.js';

const KEYS = [
  'tunerInstrument',
  'tunerTuning',
  'tunerReferenceA4',
  'tunerAutoDetect',
];

export default function Sidebar({ settings }) {
  const v = useSharedSettingValues(settings, KEYS);
  const instrument = v.tunerInstrument ?? 'guitar';
  const tuning = v.tunerTuning ?? 'standard';
  const referenceA4 = v.tunerReferenceA4 ?? 440;
  const autoDetect = v.tunerAutoDetect ?? true;

  const instruments = getInstruments();
  const tunings = getTuningsFor(instrument);

  const handleInstrument = (val) => {
    settings.set('tunerInstrument', val);
    // Reset tuning to that instrument's default (the previous tuning id may
    // not exist in the new instrument's set).
    const def = getDefaultTuning(val);
    if (def) settings.set('tunerTuning', def);
    // Auto mode is always sane after a switch; manual selection would point
    // at a string that may not exist anymore.
    settings.set('tunerSelectedString', 0);
  };

  return (
    <div className="flex flex-col gap-4 p-1">
      <Section title="Instrument">
        <Field label="Type">
          <Select value={instrument} onValueChange={handleInstrument}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {instruments.map((i) => (
                <SelectItem key={i.id} value={i.id}>{i.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {tunings.length > 1 && (
          <Field label="Tuning">
            <Select
              value={tuning}
              onValueChange={(val) => settings.set('tunerTuning', val)}
            >
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {tunings.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
      </Section>

      <Separator />

      <Section title="Detection">
        <div className="flex items-center justify-between rounded-md border bg-background/50 px-3 py-2">
          <div className="flex flex-col leading-tight">
            <Label htmlFor="tuner-auto-detect" className="text-xs font-semibold">
              Auto-detect string
            </Label>
            <span className="text-[11px] text-muted-foreground">
              Snap to whichever open string you play
            </span>
          </div>
          <Switch
            id="tuner-auto-detect"
            checked={autoDetect}
            onCheckedChange={(checked) => settings.set('tunerAutoDetect', checked)}
          />
        </div>
      </Section>

      <Separator />

      <Section title="Reference">
        <Field label={`A4 — ${referenceA4} Hz`} hint="Most modern music tunes A4 to 440 Hz. Some orchestras use 441–443; baroque is often 415.">
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={415}
              max={446}
              step={1}
              value={referenceA4}
              onChange={(e) =>
                settings.set('tunerReferenceA4', e.target.valueAsNumber)
              }
              className="w-full accent-primary"
            />
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {[440, 441, 442, 443, 432].map((hz) => (
              <button
                key={hz}
                type="button"
                onClick={() => settings.set('tunerReferenceA4', hz)}
                className={`rounded-full border px-2 py-0.5 text-[11px] font-mono transition-colors ${
                  referenceA4 === hz
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-accent'
                }`}
              >
                {hz}
              </button>
            ))}
          </div>
        </Field>
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
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
