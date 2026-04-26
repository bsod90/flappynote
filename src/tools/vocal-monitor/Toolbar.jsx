import { Eraser, Play, RotateCcw, Settings2, Square } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export default function Toolbar({
  isRecording,
  starting,
  canRestart,
  onStart,
  onStop,
  onClear,
  onRestart,
  onOpenSettings,
}) {
  return (
    <div className="flex items-center gap-2 border-b bg-background/60 p-2 backdrop-blur">
      {isRecording ? (
        <Button onClick={onStop} variant="destructive">
          <Square className="h-4 w-4" />
          Stop
        </Button>
      ) : (
        <Button onClick={onStart} disabled={starting}>
          <Play className="h-4 w-4" />
          {starting ? 'Starting…' : 'Start'}
        </Button>
      )}

      <Button variant="outline" onClick={onClear}>
        <Eraser className="h-4 w-4" />
        Clear
      </Button>

      {canRestart && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRestart}
              aria-label="Restart practice"
              className="text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Restart from beginning</TooltipContent>
        </Tooltip>
      )}

      <div className="ml-auto flex items-center gap-2 lg:hidden">
        <Button variant="outline" size="sm" onClick={onOpenSettings}>
          <Settings2 className="h-4 w-4" />
          Settings
        </Button>
      </div>
    </div>
  );
}
