/**
 * Resolves the active shadcn/Tailwind HSL tokens into concrete color strings
 * the canvas can use. Re-read each frame so toggling the `.dark` class on
 * <html> instantly retints the visualization.
 */

function readChannels(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

function hsl(channels, alpha) {
  if (!channels) return null;
  return alpha == null ? `hsl(${channels})` : `hsl(${channels} / ${alpha})`;
}

export function getCanvasTheme() {
  const bgChannels = readChannels('--background');
  const fgChannels = readChannels('--foreground');
  const mutedFgChannels = readChannels('--muted-foreground');
  const borderChannels = readChannels('--border');
  const cardChannels = readChannels('--card');
  const primaryChannels = readChannels('--primary');

  const isDark = document.documentElement.classList.contains('dark');

  // Piano-key shades that preserve the "white = light, black = dark"
  // metaphor regardless of page theme. Tuned by hand rather than derived
  // from theme tokens so dark mode doesn't flip the visual hierarchy.
  const keys = isDark
    ? {
        keyWhite: 'hsl(220 8% 78%)',       // warm light grey
        keyWhiteBorder: 'hsl(220 10% 35%)', // darker separator
        keyBlack: 'hsl(220 12% 14%)',       // near-black with a hint of cool
        keyBlackBorder: 'hsl(220 10% 35%)', // outline so it reads against the dark canvas
        keyLabel: 'hsl(220 9% 28%)',        // dark text on light keys
      }
    : {
        keyWhite: '#ffffff',
        keyWhiteBorder: '#dddddd',
        keyBlack: '#333333',
        keyBlackBorder: null,               // no outline needed in light mode
        keyLabel: '#666666',
      };

  return {
    isDark,
    background: hsl(bgChannels) ?? '#f5f5f5',
    surface: hsl(cardChannels) ?? '#ffffff',
    muted: hsl(borderChannels, 0.6) ?? 'rgba(150,150,150,0.15)',
    gridLine: hsl(fgChannels, 0.08) ?? 'rgba(0,0,0,0.08)',
    gridLineStrong: hsl(fgChannels, 0.18) ?? 'rgba(0,0,0,0.18)',
    text: hsl(fgChannels) ?? '#111',
    textInverse: hsl(bgChannels) ?? '#fff',
    textMuted: hsl(mutedFgChannels) ?? '#999',
    overlay: hsl(fgChannels, 0.7) ?? 'rgba(0,0,0,0.7)',
    primary: hsl(primaryChannels) ?? '#4ec0ca',
    outOfScale: hsl(fgChannels, 0.05) ?? 'rgba(120,120,120,0.05)',
    ...keys,
  };
}
