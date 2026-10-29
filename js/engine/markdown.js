// Moteur de rendu des pages de projet.
//
// Markdown (marked) + équations LaTeX (KaTeX) + blocs « ::: nom » (figures, graphiques,
// simulateurs, PDF…). Voir README.md pour la syntaxe complète.
//
// Dépendances chargées globalement avant ce module : window.marked, window.katex.

import { slugify, escapeHtml } from './format.js';
import { runDirective } from './blocks.js';

const MACROS = {
  '\\unit': '\\,\\mathrm{#1}',
  '\\ohm': '\\Omega',
  '\\micro': '\\mu',
  '\\dd': '\\mathrm{d}',
  '\\ee': '\\mathrm{e}',
  '\\ii': '\\mathrm{i}',
};

export function parseArgs(str) {
  const args = {};
  const re = /([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;
  let m;
  while ((m = re.exec(str || ''))) {
    args[m[1]] = m[2] ?? m[3] ?? m[4] ?? true;
  }
  return args;
}

class Ctx {
  constructor(base) {
    this.base = base || '';
    this.n = { fig: 0, tab: 0, eq: 0 };
    this.ids = { fig: {}, tab: {}, eq: {} };
    this.stash = [];
    this.plain = [];
    this.mounts = [];
    this.toc = [];
  }

  // Met un fragment HTML de côté (il ne sera pas retraité par marked ni par le post-traitement).
  keep(html, plain = '') {
    this.stash.push(html);
    this.plain.push(plain);
    return `@@S${this.stash.length - 1}@@`;
  }

  // Chemin relatif au dossier du projet → chemin utilisable depuis la page.
  url(p) {
    if (!p) return p;
    if (/^([a-z][a-z0-9+.-]*:|\/\/|\/|#)/i.test(p)) return p;
    return this.base + p;
  }

  // Numérotation Figure / Tableau / Équation, avec référence croisée @fig:id.
  number(kind, id) {
    const n = ++this.n[kind];
    const key = id || `n${n}`;
    this.ids[kind][key] = { n, id: `${kind}-${key}` };
    return this.ids[kind][key];
  }

  // Markdown « en ligne » (légendes, cellules…) avec maths et références.
  inline(md) {
    const t = protect(String(md ?? ''), this);
    let html = window.marked.parseInline(t, { gfm: true });
    html = restoreStash(html, this);
    return html;
  }

  // Markdown « bloc » sans directives (corps d'une note, d'un tableau…).
  block(md) {
    const t = protect(String(md ?? ''), this);
    let html = window.marked.parse(t, { gfm: true });
    html = postprocess(html, this, false);
    return restoreStash(html, this);
  }

  mount(fn) {
    this.mounts.push(fn);
    return `<div class="mount" data-mount="${this.mounts.length - 1}"></div>`;
  }
}

function katexHtml(tex, display) {
  try {
    return window.katex.renderToString(tex, {
      displayMode: display,
      throwOnError: false,
      strict: 'ignore',
      macros: { ...MACROS },
    });
  } catch (e) {
    return `<code class="math-error">${escapeHtml(tex)}</code>`;
  }
}

// Découpe en segments « code / non-code » pour ne rien toucher dans le code.
function splitCode(text) {
  return text.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g).map((t, i) => ({ code: i % 2 === 1, t }));
}

function protect(text, ctx) {
  const parts = splitCode(text);
  for (const p of parts) {
    if (p.code) continue;
    let t = p.t.replace(/\\\$/g, '@@DOLLAR@@');
    // Équations hors-texte $$ … $$ (étiquette facultative : {#eq:nom})
    t = t.replace(/\$\$([\s\S]+?)\$\$(?:[ \t]*\{#eq:([\w-]+)\})?/g, (_, tex, label) => {
      let num = '';
      let id = '';
      if (label) {
        const r = ctx.number('eq', label);
        num = `<div class="eq-num">(${r.n})</div>`;
        id = ` id="${r.id}"`;
      }
      return `\n\n${ctx.keep(`<div class="eq"${id}><div class="eq-body">${katexHtml(tex.trim(), true)}</div>${num}</div>`)}\n\n`;
    });
    // Équations en ligne $ … $
    t = t.replace(/(^|[^\\$\w])\$([^\s$](?:[^$\n]*?[^\s$])?)\$(?![\w])/g, (_, pre, tex) => pre + ctx.keep(katexHtml(tex, false), tex));
    // Références croisées
    t = t.replace(/@(fig|tab|eq):([\w-]+)/g, (_, k, id) => `@@REF${k}:${id}@@`);
    p.t = t;
  }
  return parts.map((p) => p.t).join('');
}

function restoreStash(html, ctx) {
  let guard = 0;
  while (/@@S\d+@@/.test(html) && guard++ < 6) {
    html = html.replace(/<p>\s*@@S(\d+)@@\s*<\/p>/g, (_, n) => ctx.stash[n]);
    html = html.replace(/@@S(\d+)@@/g, (_, n) => ctx.stash[n]);
  }
  return html.replace(/@@DOLLAR@@/g, '$');
}

function resolveRefs(html, ctx) {
  return html.replace(/@@REF(fig|tab|eq):([\w-]+)@@/g, (_, k, id) => {
    const r = ctx.ids[k][id];
    if (!r) {
      console.warn(`Référence inconnue : @${k}:${id}`);
      return '<span class="ref-missing">?</span>';
    }
    const label = k === 'fig' ? `Fig. ${r.n}` : k === 'tab' ? `Tableau ${r.n}` : `éq. (${r.n})`;
    return `<a class="ref" href="#${r.id}">${label}</a>`;
  });
}

function postprocess(html, ctx, top) {
  // Titres : identifiants, ancres, sommaire
  const used = new Set();
  html = html.replace(/<h([1-4])>([\s\S]*?)<\/h\1>/g, (_, lvl, inner) => {
    const level = Number(lvl);
    let id = slugify(inner.replace(/@@S(\d+)@@/g, (_, n) => ctx.plain[n] || '')) || 'section';
    let k = 2;
    const base = id;
    while (used.has(id)) id = `${base}-${k++}`;
    used.add(id);
    if (top && (level === 2 || level === 3)) {
      const plain = inner.replace(/@@S(\d+)@@/g, (_, n) => ctx.plain[n] || '').replace(/<[^>]+>/g, '');
      ctx.toc.push({ level, id, text: plain });
    }
    return `<h${level} id="${id}">${inner}<a class="anchor" href="#${id}" aria-label="Lien vers cette section">§</a></h${level}>`;
  });
  // Chemins relatifs des images et liens
  html = html.replace(/(<img\b[^>]*?\ssrc=")([^"]+)(")/g, (_, a, src, b) => `${a}${ctx.url(src)}${b}`);
  html = html.replace(/<img\b(?![^>]*\sloading=)/g, '<img loading="lazy" ');
  html = html.replace(/(<a\b[^>]*?\shref=")([^"]+)(")/g, (_, a, href, b) => {
    if (/^(#|mailto:|[a-z][a-z0-9+.-]*:)/i.test(href)) {
      return /^https?:/i.test(href) ? `${a}${href}${b} rel="noopener"` : `${a}${href}${b}`;
    }
    return `${a}${ctx.url(href)}${b}`;
  });
  // Tableaux défilables sur mobile
  html = html.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, '</table></div>');
  return html;
}

function extractDirectives(src, ctx) {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let fence = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const f = /^\s{0,3}(```+|~~~+)/.exec(line);
    if (fence) {
      out.push(line);
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length && /^\s*(```+|~~~+)\s*$/.test(line)) fence = null;
      continue;
    }
    if (f) {
      fence = f[1];
      out.push(line);
      continue;
    }
    const d = /^:::\s*([a-zA-Z][\w-]*)\s*(.*)$/.exec(line);
    if (!d) {
      out.push(line);
      continue;
    }
    const body = [];
    let inner = null;
    i++;
    while (i < lines.length) {
      const g = /^\s{0,3}(```+|~~~+)/.exec(lines[i]);
      if (g) {
        if (!inner) inner = g[1];
        else if (g[1][0] === inner[0] && g[1].length >= inner.length) inner = null;
      }
      if (!inner && /^:::\s*$/.test(lines[i])) break;
      body.push(lines[i]);
      i++;
    }
    let html;
    try {
      html = runDirective(d[1], parseArgs(d[2]), body.join('\n'), ctx);
    } catch (e) {
      console.error(e);
      html = `<div class="callout error">Bloc « ${escapeHtml(d[1])} » invalide : ${escapeHtml(e.message)}</div>`;
    }
    out.push('', ctx.keep(html), '');
  }
  return out.join('\n');
}

export function render(src, opts = {}) {
  const ctx = new Ctx(opts.base);
  let text = extractDirectives(src, ctx);
  text = protect(text, ctx);
  let html = window.marked.parse(text, { gfm: true, breaks: false });
  html = postprocess(html, ctx, true); // avant restoreStash : le HTML des blocs n'est pas retraité
  html = restoreStash(html, ctx);
  html = resolveRefs(html, ctx);
  return {
    html,
    toc: ctx.toc,
    // À appeler une fois le HTML inséré dans le DOM : active graphiques et simulateurs.
    mount(root) {
      root.querySelectorAll('[data-mount]').forEach((el) => {
        const fn = ctx.mounts[Number(el.dataset.mount)];
        if (!fn) return;
        Promise.resolve(fn(el)).catch((e) => {
          console.error(e);
          el.innerHTML = `<div class="callout error">Impossible d'afficher cet élément : ${escapeHtml(e.message)}</div>`;
        });
      });
    },
  };
}
