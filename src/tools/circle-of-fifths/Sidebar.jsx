import { Volume2 } from 'lucide-react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

import { useSharedSettingValues } from '../vocal-monitor/useSharedSettings.js';

const KEYS = [
  'circleVoicing',
  'circleArticulation',
  'circleVolume',
  'circleProgressionTempo',
];

export default function Sidebar({ settings }) {
  const v = useSharedSettingValues(settings, KEYS);
  const voicing = v.circleVoicing ?? 'triad';
  const articulation = v.circleArticulation ?? 'block';
  const volume = v.circleVolume ?? 0.6;
  const tempo = v.circleProgressionTempo ?? 90;

  return (
    <div className="flex flex-col gap-3 p-1">
      <Section title="Sound">
        <Field label="Voicing">
          <Select
            value={voicing}
            onValueChange={(val) => settings.set('circleVoicing', val)}
          >
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="triad">Triad</SelectItem>
              <SelectItem value="seventh">7th chord</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Articulation">
          <Select
            value={articulation}
            onValueChange={(val) => settings.set('circleArticulation', val)}
          >
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="block">Block chord</SelectItem>
              <SelectItem value="arpeggio">Arpeggio</SelectItem>
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
              onChange={(e) => settings.set('circleVolume', e.target.valueAsNumber / 100)}
              className="w-full accent-primary"
            />
          </div>
        </Field>
      </Section>

      <Separator />

      <Section title="Progressions">
        <Field label={`Tempo — ${tempo} BPM`}>
          <input
            type="range"
            min={50}
            max={180}
            value={tempo}
            onChange={(e) => settings.set('circleProgressionTempo', e.target.valueAsNumber)}
            className="w-full accent-primary"
          />
        </Field>
      </Section>

      <Separator />

      <div className="space-y-1.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          How to use
        </h3>
        <ul className="space-y-1 text-[11px] leading-snug text-muted-foreground">
          <li>• <strong>Click any wedge</strong> to set it as I (or i for the minor ring) and hear the chord.</li>
          <li>• Adjacent wedges show the diatonic <strong>I-IV-V</strong> relationships.</li>
          <li>• The <strong>center hub</strong> shows the key signature and all seven diatonic chords — click any to play.</li>
          <li>• Pick a <strong>genre</strong> below the wheel to browse progressions in your selected key.</li>
        </ul>
      </div>
    </div>
  );
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
