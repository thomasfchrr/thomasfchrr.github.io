// Lecture de l'en-tête d'un fichier index.md :
//
//   ---
//   title: Titre du projet
//   tags: [RC, Simulation]
//   ---
//
// Format volontairement minimal (clé: valeur, liste entre crochets) :
// aucune dépendance, et le même module sert au navigateur et à tools/build.mjs.

function unquote(s) {
  const m = /^(["'])([\s\S]*)\1$/.exec(s);
  return m ? m[2] : s;
}

function coerce(v) {
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

export function parseFrontMatter(text) {
  const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const m = /^---\n([\s\S]*?)\n---[ \t]*(?:\n([\s\S]*))?$/.exec(src);
  if (!m) return { meta: {}, body: src };
  const meta = {};
  for (const line of m[1].split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const kv = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (!kv) continue;
    const raw = kv[2].trim();
    if (/^\[.*\]$/.test(raw)) {
      meta[kv[1]] = raw
        .slice(1, -1)
        .split(',')
        .map((s) => unquote(s.trim()))
        .filter(Boolean);
    } else {
      meta[kv[1]] = coerce(unquote(raw));
    }
  }
  return { meta, body: m[2] || '' };
}
