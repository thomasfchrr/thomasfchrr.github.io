// Formatage des nombres à la française et utilitaires de texte.

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const sup = (n) => String(n).split('').map((c) => SUP[c] || c).join('');

export function fixed(v, d) {
  let s = Math.abs(v).toFixed(d);
  if (/^0(\.0*)?$/.test(s)) return s.replace('.', ',');
  let [i, f] = s.split('.');
  i = i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (v < 0 ? '−' : '') + i + (f ? ',' + f : '');
}

// Nombre avec `digits` chiffres significatifs, notation scientifique si nécessaire.
export function fmt(v, digits = 3) {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e6 || a < 1e-3) {
    const e = Math.floor(Math.log10(a));
    const m = v / Math.pow(10, e);
    return `${fixed(m, Math.max(0, digits - 1))}×10${sup(e)}`;
  }
  const dec = Math.max(0, digits - 1 - Math.floor(Math.log10(a)));
  return fixed(v, Math.min(dec, 9));
}

const PREFIX = [
  [1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''],
  [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p'], [1e-15, 'f'],
];

// 4,70 kΩ, 220 nF, 1,00 ms…
export function eng(v, unit = '', digits = 3) {
  if (!isFinite(v)) return '—';
  if (v === 0) return `0 ${unit}`.trim();
  const a = Math.abs(v);
  let pick = PREFIX[PREFIX.length - 1];
  for (const p of PREFIX) {
    if (a >= p[0] * 0.9995) { pick = p; break; }
  }
  const x = v / pick[0];
  const dec = Math.max(0, digits - 1 - Math.floor(Math.log10(Math.abs(x))));
  return `${fixed(x, Math.min(dec, 6))} ${pick[1]}${unit}`;
}

export function slugify(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(iso || '');
  if (!m) return iso || '';
  const mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const mm = mois[Number(m[2]) - 1];
  return m[3] ? `${Number(m[3])} ${mm} ${m[1]}` : `${mm} ${m[1]}`;
}

export const STATUS = {
  termine: 'Terminé',
  'en-cours': 'En cours',
  planifie: 'Planifié',
};
