/**
 * Apply the workflow's configured initial theme to the SDK's theme root — the
 * SdkFrame's shadow portal frame when the mount is isolated (pass it as
 * `themeRoot`), else the document root (hosted page).
 *
 * 'light' / 'dark' pin the mode; 'system' follows the device's
 * prefers-color-scheme — live, so an OS-level switch mid-session repaints the
 * flow (the in-flow ThemeToggle still works; a later OS change simply
 * re-asserts the system preference). Returns a cleanup that detaches the
 * media-query listener; undefined when there is nothing to clean up. The
 * user's ThemeToggle choice and unset themes are left alone.
 */
export function applyConfiguredTheme(
  theme: 'light' | 'dark' | 'system' | undefined,
  themeRoot?: HTMLElement | null,
): (() => void) | undefined {
  if (!theme || typeof document === 'undefined') return undefined;
  const root = themeRoot ?? document.documentElement;
  if (theme === 'system') {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => root.classList.toggle('dark', mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }
  root.classList.toggle('dark', theme === 'dark');
  return undefined;
}
