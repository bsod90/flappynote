import { useEffect, useRef, useState } from 'react';
import { Crosshair } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { VocalMonitorController } from './VocalMonitorController.js';

export default function PitchCanvas({ services, onControllerReady, onStateChange }) {
  const canvasRef = useRef(null);
  const controllerRef = useRef(null);
  const [jumpVisible, setJumpVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new VocalMonitorController({
      canvas: canvasRef.current,
      settings: services.settings,
      scaleManager: services.scaleManager,
      pitchContext: services.pitchContext,
      droneManager: services.droneManager,
      onStateChange: (state) => {
        if (cancelled) return;
        setJumpVisible(state.jumpToFrontVisible);
        onStateChange?.(state);
      },
    });
    controllerRef.current = controller;

    controller.mount().then(() => {
      if (!cancelled) onControllerReady?.(controller);
    });

    return () => {
      cancelled = true;
      controller.dispose();
      controllerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRecapture = (e) => {
    // Fire on pointerup (works reliably on touch + mouse) and prevent the
    // canvas's touch listeners below from receiving the same gesture as a
    // drag-start.
    e.preventDefault();
    e.stopPropagation();
    controllerRef.current?.jumpToFront();
  };

  return (
    <div className="relative h-full w-full overflow-hidden rounded-md border bg-card">
      <canvas ref={canvasRef} className="block h-full w-full" />
      {jumpVisible && (
        <Button
          onPointerUp={handleRecapture}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          aria-label="Re-capture playhead"
          className="absolute bottom-4 right-4 z-10 shadow-lg"
          style={{ touchAction: 'manipulation' }}
        >
          <Crosshair className="h-4 w-4" />
          Re-capture
        </Button>
      )}
    </div>
  );
}
