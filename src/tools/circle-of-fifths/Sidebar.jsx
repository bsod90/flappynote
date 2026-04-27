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
import { cn } from '@/lib/utils';

import { useSharedSettingValues } from '../vocal-monitor/useSharedSettings.js';

const KEYS = [
  'circleVoicing',
  'circleArticulation',
  'circleVolume',
  'circleShowSecondaryDoms',
  'circleShowTritoneSubs',
  'circleShowParallel',
];

export default function Sidebar({ settings }) {
  const v = useSharedSettingValues(settings, KEYS);
  const voicing = v.circleVoicing ?? 'triad';
  const articulation = v.circleArticulation ?? 'block';
  const volume = v.circleVolume ?? 0.6;
  const showSec = !!v.circleShowSecondaryDoms;
  const showTri = !!v.circleShowTritoneSubs;
  const showPar = !!v.circleShowParallel;

  return (
    <div className="flex flex-col gap-3 p-1">
      <Section title="Show on the wheel">
        <div className="flex flex-col gap-1.5">
          <OverlayToggle
            label="Secondary dominants"
            sub="V/X — chords that resolve into the diatonic ones"
            color="hsl(var(--super-accent))"
            active={showSec}
            onClick={() => settings.set('circleShowSecondaryDoms', !showSec)}
          />
          <OverlayToggle
            label="Tritone substitutions"
            sub="♭II — alternate dominants (a tritone away)"
            color="hsl(var(--primary))"
            active={showTri}
            onClick={() => settings.set('circleShowTritoneSubs', !showTri)}
          />
          <OverlayToggle
            label="Parallel key"
            sub="Same tonic, opposite mode"
            color="hsl(var(--super-accent))"
            active={showPar}
            onClick={() => settings.set('circleShowParallel', !showPar)}
          />
        </div>
      </Section>

      <Separator />

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
    </div>
  );
}

function OverlayToggle({ label, sub, color, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex items-start gap-2 rounded-md border px-2 py-1.5 text-left transition-colors',
        active
          ? 'border-current bg-current/10'
          : 'border-border bg-background/50 hover:bg-accent'
      )}
      style={{ color: active ? color : undefined }}
    >
      <span
        className={cn(
          'mt-0.5 inline-block h-3 w-3 shrink-0 rounded-sm border',
          active ? 'border-current' : 'border-muted-foreground/40'
        )}
        style={active ? { backgroundColor: color, borderColor: color } : undefined}
      />
      <span className="flex flex-col leading-tight">
        <span className={cn(
          'text-xs font-semibold',
          active ? 'text-current' : 'text-foreground'
        )}>
          {label}
        </span>
        <span className="text-[10px] text-muted-foreground">{sub}</span>
      </span>
    </button>
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
