import { useEffect } from 'react';

/**
 * Mirrors the OS color scheme onto the <html> element by toggling the
 * `dark` class. shadcn/ui and Tailwind read this class for theming.
 */
export function useColorScheme() {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = (matches) => {
      document.documentElement.classList.toggle('dark', matches);
    };

    apply(media.matches);

    const onChange = (event) => apply(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
}
