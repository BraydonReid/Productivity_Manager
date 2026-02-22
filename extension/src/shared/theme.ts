export type Theme = 'dark' | 'light';

export async function getTheme(): Promise<Theme> {
  const { theme } = await chrome.storage.local.get('theme');
  return theme === 'light' ? 'light' : 'dark';
}

export async function setTheme(theme: Theme): Promise<void> {
  await chrome.storage.local.set({ theme });
  applyTheme(theme);
}

export function applyTheme(theme: Theme): void {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
  } else {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
  }
}
