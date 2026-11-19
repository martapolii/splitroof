export const THEME_KEY = 'splitroof-theme';

export const THEMES = [
  { id: 'color', label: 'Color' },
  { id: 'dark', label: 'Dark' },
];

export const readTheme = () => {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return THEMES.some((theme) => theme.id === stored) ? stored : 'color';
  } catch {
    return 'color';
  }
};

export const applyTheme = (theme) => {
  const next = THEMES.some((item) => item.id === theme) ? theme : 'color';
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    // Storage can be unavailable in private browsing.
  }
  return next;
};