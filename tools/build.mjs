#!/usr/bin/env node
// Génère projects/index.json à partir des dossiers projects/<nom>/index.md
// (en-tête « front matter ») et vérifie que les fichiers référencés existent.
//
//   node tools/build.mjs           écrit le manifeste
//   node tools/build.mjs --check   vérifie sans écrire (code de sortie 1 si erreur ou manifeste périmé)

import { readdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontMatter } from '../js/engine/frontmatter.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROJECTS = path.join(ROOT, 'projects');
const MANIFEST = path.join(PROJECTS, 'index.json');
const STATUS = ['termine', 'en-cours', 'planifie'];
const checkOnly = process.argv.includes('--check');

const errors = [];
const warnings = [];

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

function referencedFiles(body) {
  const refs = new Set();
  let fence = false;
  for (const line of body.split('\n')) {
    if (/^\s{0,3}(```|~~~)/.test(line)) fence = !fence;
    if (fence) continue;
    if (/^:::/.test(line)) {
      for (const m of line.matchAll(/\b(?:src|data)=(?:"([^"]+)"|'([^']+)'|(\S+))/g)) refs.add(m[1] || m[2] || m[3]);
    }
    for (const m of line.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)) refs.add(m[1]);
  }
  // les lignes d'un bloc « gallery » : « chemin | légende »
  const gal = body.match(/^::: *gallery[^\n]*\n([\s\S]*?)\n:::/gm) || [];
  gal.forEach((g) => g.split('\n').slice(1, -1).forEach((l) => { const p = l.split('|')[0].trim(); if (p) refs.add(p); }));
  return [...refs].filter((r) => !/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(r));
}

const entries = (await readdir(PROJECTS, { withFileTypes: true })).filter((d) => d.isDirectory() && !/^[._]/.test(d.name));
const projects = [];

for (const d of entries) {
  const dir = path.join(PROJECTS, d.name);
  const file = path.join(dir, 'index.md');
  if (!(await exists(file))) { warnings.push(`${d.name}: pas de index.md, dossier ignoré`); continue; }
  if (!/^[\w-]+$/.test(d.name)) { errors.push(`${d.name}: le nom du dossier ne doit contenir que lettres, chiffres, _ et -`); continue; }
  const { meta, body } = parseFrontMatter(await readFile(file, 'utf8'));
  if (meta.draft === true) { warnings.push(`${d.name}: brouillon, non listé`); continue; }
  if (!meta.title) errors.push(`${d.name}: « title » manquant`);
  if (!meta.summary) warnings.push(`${d.name}: « summary » manquant (affiché dans la liste)`);
  if (meta.status && !STATUS.includes(meta.status)) errors.push(`${d.name}: status « ${meta.status} » invalide (${STATUS.join(', ')})`);
  if (meta.date && !/^\d{4}-\d{2}(-\d{2})?$/.test(String(meta.date))) errors.push(`${d.name}: date « ${meta.date} » invalide (AAAA-MM ou AAAA-MM-JJ)`);
  const files = referencedFiles(body);
  if (meta.paper) files.push(String(meta.paper));
  if (meta.cover) files.push(String(meta.cover));
  for (const f of files) if (!(await exists(path.join(dir, f)))) errors.push(`${d.name}: fichier référencé introuvable : ${f}`);
  projects.push({
    slug: d.name,
    title: meta.title || d.name,
    subtitle: meta.subtitle || '',
    summary: meta.summary || '',
    date: meta.date ? String(meta.date) : '',
    status: meta.status || '',
    kind: meta.kind || '',
    domain: meta.domain || '',
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    order: typeof meta.order === 'number' ? meta.order : 999,
    cover: meta.cover || '',
  });
}

projects.sort((a, b) => a.order - b.order || String(b.date).localeCompare(String(a.date)) || a.title.localeCompare(b.title, 'fr'));
const json = JSON.stringify({ projects }, null, 2) + '\n';

warnings.forEach((w) => console.warn(`avertissement : ${w}`));
errors.forEach((e) => console.error(`erreur : ${e}`));

if (checkOnly) {
  const current = (await exists(MANIFEST)) ? await readFile(MANIFEST, 'utf8') : '';
  if (current !== json) { console.error('erreur : projects/index.json est périmé, lancer « node tools/build.mjs »'); process.exit(1); }
  if (errors.length) process.exit(1);
  console.log(`ok : ${projects.length} projet(s), manifeste à jour`);
} else {
  await writeFile(MANIFEST, json);
  console.log(`${projects.length} projet(s) → projects/index.json`);
  if (errors.length) process.exit(1);
}
