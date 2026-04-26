import { useEffect, useState } from 'react';
import { HelpCircle, Maximize, Minimize } from 'lucide-react';

import GithubIcon from './icons/GithubIcon.jsx';

const isFullscreenSupported = () =>
  document.fullscreenEnabled ||
  document.webkitFullscreenEnabled ||
  document.mozFullScreenEnabled ||
  document.msFullscreenEnabled;

const isStandalonePWA = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);

function getCurrentFullscreenElement() {
  return (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement
  );
}

async function requestFullscreen() {
  const el = document.documentElement;
  if (el.requestFullscreen) await el.requestFullscreen();
  else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
  else if (el.mozRequestFullScreen) await el.mozRequestFullScreen();
  else if (el.msRequestFullscreen) await el.msRequestFullscreen();
}

async function exitFullscreen() {
  if (document.exitFullscreen) await document.exitFullscreen();
  else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
  else if (document.mozCancelFullScreen) await document.mozCancelFullScreen();
  else if (document.msExitFullscreen) await document.msExitFullscreen();
}

export default function AppFooter() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [supported, setSupported] = useState(true);
  const [iosTipVisible, setIosTipVisible] = useState(false);

  useEffect(() => {
    setSupported(isFullscreenSupported() || isIOS());

    const onChange = () => {
      const wasFs = !!getCurrentFullscreenElement();
      setIsFullscreen(wasFs);
      // Trigger canvas re-layout after the browser finishes its transition
      setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
      setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    document.addEventListener('mozfullscreenchange', onChange);
    document.addEventListener('MSFullscreenChange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
      document.removeEventListener('mozfullscreenchange', onChange);
      document.removeEventListener('MSFullscreenChange', onChange);
    };
  }, []);

  const handleFullscreenClick = async (e) => {
    e.preventDefault();
    if (isStandalonePWA()) return; // Already fullscreen
    if (!isFullscreenSupported() && isIOS()) {
      setIosTipVisible(true);
      setTimeout(() => setIosTipVisible(false), 8000);
      return;
    }
    if (getCurrentFullscreenElement()) await exitFullscreen();
    else await requestFullscreen();
  };

  if (isStandalonePWA()) {
    // Already fullscreen as PWA — no toggle needed; keep links visible
    return (
      <footer className="border-t bg-background/95 py-2 text-xs text-muted-foreground">
        <div className="container flex items-center justify-center gap-4">
          <FooterLink href="/help.html"><HelpCircle className="h-3.5 w-3.5" /> Help</FooterLink>
          <FooterLink
            href="https://github.com/bsod90/flappynote"
            target="_blank"
            rel="noopener noreferrer"
          >
            <GithubIcon className="h-3.5 w-3.5" /> GitHub
          </FooterLink>
        </div>
      </footer>
    );
  }

  return (
    <>
      <footer className="border-t bg-background/95 py-2 text-xs text-muted-foreground">
        <div className="container flex items-center justify-center gap-4">
          <FooterLink href="/help.html">
            <HelpCircle className="h-3.5 w-3.5" /> Help
          </FooterLink>
          <FooterLink
            href="https://github.com/bsod90/flappynote"
            target="_blank"
            rel="noopener noreferrer"
          >
            <GithubIcon className="h-3.5 w-3.5" /> GitHub
          </FooterLink>
          {supported && (
            <button
              type="button"
              onClick={handleFullscreenClick}
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              {isFullscreen ? (
                <>
                  <Minimize className="h-3.5 w-3.5" /> Exit fullscreen
                </>
              ) : (
                <>
                  <Maximize className="h-3.5 w-3.5" /> Fullscreen
                </>
              )}
            </button>
          )}
        </div>
      </footer>

      {iosTipVisible && (
        <div className="fixed bottom-12 left-1/2 z-50 -translate-x-1/2 rounded-md border bg-popover px-4 py-3 text-center text-sm text-popover-foreground shadow-lg">
          <strong>Install for fullscreen experience</strong>
          <br />
          Tap <span className="font-mono">Share</span> → <strong>Add to Home Screen</strong>
        </div>
      )}
    </>
  );
}

function FooterLink({ href, children, ...rest }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1 hover:text-foreground"
      {...rest}
    >
      {children}
    </a>
  );
}
