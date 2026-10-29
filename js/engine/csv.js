// Lecture d'un CSV simple : séparateur « , », « ; » ou tabulation, lignes # ignorées.
// Les cellules vides ou non numériques deviennent NaN (utile pour des colonnes de longueurs différentes).

export function parseCSV(text) {
  const lines = text.replace(/^﻿/, '').replace(/\r/g, '').split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'));
  if (!lines.length) return { header: [], cols: {}, rows: 0 };
  const first = lines[0];
  const sep = first.includes('\t') ? '\t' : first.includes(';') ? ';' : ',';
  const header = first.split(sep).map((s) => s.trim().replace(/^"|"$/g, ''));
  const cols = {};
  header.forEach((h) => (cols[h] = []));
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(sep);
    header.forEach((h, j) => {
      let c = (parts[j] ?? '').trim();
      if (sep !== ',') c = c.replace(',', '.');
      cols[h].push(c === '' ? NaN : Number(c));
    });
  }
  return { header, cols, rows: lines.length - 1 };
}
