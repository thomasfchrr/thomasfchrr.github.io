// Éléments communs : bascule clair/sombre, année du pied de page, configuration du site.

const KEY = 'theme';

function effectiveTheme() {
  const t = document.documentElement.dataset.theme;
  if (t) return t;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function initChrome() {
  const btn = document.querySelector('.theme-toggle');
  if (btn) {
    const sync = () => btn.setAttribute('aria-label', effectiveTheme() === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre');
    sync();
    btn.addEventListener('click', () => {
      const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem(KEY, next); } catch (e) { /* stockage indisponible : ignoré */ }
      sync();
      window.dispatchEvent(new Event('themechange'));
    });
  }
  const y = document.querySelector('[data-year]');
  if (y) y.textContent = new Date().getFullYear();
}

export async function loadConfig() {
  try {
    const r = await fetch('site.json', { cache: 'no-cache' });
    if (r.ok) return await r.json();
  } catch (e) { /* configuration facultative */ }
  return {};
}

export async function loadManifest() {
  const r = await fetch('projects/index.json', { cache: 'no-cache' });
  if (!r.ok) throw new Error(`projects/index.json : HTTP ${r.status}`);
  const data = await r.json();
  return data.projects || [];
}

initChrome();
