import { useEffect, useState } from 'react';

/**
 * Tracks the SDK's dark class, reactively.
 *
 * The theme toggle flips `.dark` on `documentElement` and re-renders ITSELF, so
 * anything computing styles from the theme higher up the tree never heard about
 * it. That was fine while dark mode was pure CSS — but org colours are applied
 * as INLINE custom properties, and an inline style beats the `.dark .kyc-root`
 * rules, so a branded flow kept its light background after toggling to dark.
 * Observing the class is what lets the dark palette be swapped in on toggle.
 */
export function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const sync = () => setIsDark(root.classList.contains('dark'));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}
