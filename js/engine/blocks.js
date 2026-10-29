// Blocs « ::: nom … ::: » disponibles dans les pages de projet.
// Chaque bloc reçoit (args, body, ctx) et renvoie du HTML. Les blocs interactifs
// passent par ctx.mount(fn) : fn(element) est appelée une fois la page affichée.

import { escapeHtml as e } from './format.js';
import { parseCSV } from './csv.js';
import { Plot } from './plot.js';
import { mountRC } from '../sim/rc.js';

const CIRCUITJS = 'https://lushprojects.com/circuitjs/circuitjs.html';

function figure(ctx, args, inner, cls = '') {
  const caption = args.caption || '';
  if (!caption) return `<figure class="figure ${cls}">${inner}</figure>`;
  const r = ctx.number('fig', args.id);
  return `<figure class="figure ${cls}" id="${r.id}">${inner}<figcaption><span class="fig-label">Fig.&nbsp;${r.n}</span> ${ctx.inline(caption)}</figcaption></figure>`;
}

function lines(body) {
  return body.split('\n').map((l) => l.trim()).filter(Boolean);
}

function num(v, d) {
  return v === undefined || v === true || v === '' || Number.isNaN(Number(v)) ? d : Number(v);
}

async function fetchText(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} : HTTP ${r.status}`);
  return r.text();
}

// SVG en ligne : hérite des couleurs et du thème de la page (currentColor, variables CSS).
async function inlineSvg(el, url, alt) {
  const text = await fetchText(url);
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== 'svg') throw new Error('SVG invalide');
  svg.querySelectorAll('script, foreignObject').forEach((n) => n.remove());
  svg.querySelectorAll('*').forEach((n) => {
    [...n.attributes].forEach((a) => {
      if (/^on/i.test(a.name)) n.removeAttribute(a.name);
    });
  });
  svg.setAttribute('role', 'img');
  if (alt) svg.setAttribute('aria-label', alt);
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  el.replaceChildren(document.importNode(svg, true));
}

function parseMarks(str) {
  // « 1:τ|3:3τ » → [{x:1,label:'τ'},{x:3,label:'3τ'}]
  return String(str || '')
    .split('|')
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => {
      const [v, ...rest] = t.split(':');
      return { v: Number(v), label: rest.join(':') };
    })
    .filter((m) => isFinite(m.v));
}

const handlers = {
  // ::: figure src=figures/a.svg caption="Légende" id=nom
  figure(args, body, ctx) {
    if (!args.src) throw new Error('attribut src manquant');
    const url = ctx.url(args.src);
    const alt = args.alt || args.caption || '';
    const a = { ...args, caption: args.caption || body.trim() };
    const style = args.width ? ` style="max-width:${e(args.width)}"` : '';
    const inner = /\.svg$/i.test(args.src) && !args.img
      ? ctx.mount((el) => inlineSvg(el, url, alt).catch(() => { el.innerHTML = `<img src="${e(url)}" alt="${e(alt)}">`; }))
      : `<img src="${e(url)}" alt="${e(alt)}" loading="lazy"${style}>`;
    return figure(ctx, a, inner, 'figure-img');
  },

  // ::: gallery caption="…" puis lignes « chemin | légende »
  gallery(args, body, ctx) {
    const items = lines(body).map((l, i) => {
      const [src, ...cap] = l.split('|');
      const letter = String.fromCharCode(97 + i);
      return `<figure><img src="${e(ctx.url(src.trim()))}" alt="${e(cap.join('|').trim())}" loading="lazy"><figcaption>(${letter}) ${ctx.inline(cap.join('|').trim())}</figcaption></figure>`;
    });
    return figure(ctx, args, `<div class="gallery-grid">${items.join('')}</div>`, 'gallery');
  },

  // ::: plot data=data/x.csv x=t y=v1,v2@t2 xlabel="Temps t (ms)" ylabel="Tension (V)" legend="a|b" style=line,points
  plot(args, body, ctx) {
    const inline = body.trim();
    const inner = ctx.mount(async (el) => {
      el.classList.add('plot-host');
      const csv = parseCSV(inline || (await fetchText(ctx.url(args.data))));
      const xcol = args.x || csv.header[0];
      const xf = num(args.xfactor, 1);
      const yf = num(args.yfactor, 1);
      const toks = String(args.y || csv.header.slice(1).join(',')).split(',').map((t) => t.trim()).filter(Boolean);
      const names = args.legend ? String(args.legend).split('|') : [];
      const styles = args.style ? String(args.style).split(',').map((t) => t.trim()) : [];
      const colors = args.colors
        ? String(args.colors).split(',').map((t) => t.trim()).map((t) => (/^\d$/.test(t) ? `var(--plot-${t})` : /^(muted|faint|fg)$/.test(t) ? `var(--${t})` : t))
        : [];
      const series = toks.map((tok, k) => {
        const [yc, xc] = tok.split('@');
        const X = csv.cols[xc || xcol];
        const Y = csv.cols[yc];
        if (!X || !Y) throw new Error(`colonne introuvable : ${tok}`);
        let style = styles[k] || styles[0] || 'line';
        let dash;
        if (style === 'dashed') { style = 'line'; dash = '6 4'; }
        return { name: names[k] ?? yc, x: X.map((v) => v * xf), y: Y.map((v) => v * yf), style, dash, color: colors[k] };
      });
      new Plot(el, {
        series,
        xlabel: args.xlabel || '',
        ylabel: args.ylabel || '',
        logx: !!args.logx,
        logy: !!args.logy,
        xmin: args.xmin !== undefined ? Number(args.xmin) : undefined,
        xmax: args.xmax !== undefined ? Number(args.xmax) : undefined,
        ymin: args.ymin !== undefined ? Number(args.ymin) : undefined,
        ymax: args.ymax !== undefined ? Number(args.ymax) : undefined,
        height: args.height ? Number(args.height) : undefined,
        legend: args.legend !== false && series.some((s) => s.name),
        vlines: parseMarks(args.vlines).map((m) => ({ x: m.v, label: m.label })),
        hlines: parseMarks(args.hlines).map((m) => ({ y: m.v, label: m.label })),
        label: args.caption,
      });
    });
    return figure(ctx, args, inner, 'figure-plot');
  },

  // ::: sim rc R=1k C=1u V=5 f=100 caption="…"
  sim(args, body, ctx) {
    const known = { rc: mountRC };
    const name = args.name || Object.keys(args).find((k) => k in known) || 'rc';
    const fn = known[name];
    if (!fn) throw new Error(`simulateur inconnu : ${name}`);
    const parse = (v) => {
      if (typeof v !== 'string') return v;
      const m = /^([\d.]+(?:e-?\d+)?)\s*([pnµumkM]?)/.exec(v);
      if (!m) return Number(v);
      const mult = { p: 1e-12, n: 1e-9, µ: 1e-6, u: 1e-6, m: 1e-3, k: 1e3, M: 1e6 }[m[2]] || 1;
      return Number(m[1]) * mult;
    };
    const inner = ctx.mount((el) => fn(el, { R: parse(args.R), C: parse(args.C), V: parse(args.V), f: parse(args.f), mode: args.mode }));
    return figure(ctx, args, inner, 'figure-sim');
  },

  // ::: circuitjs caption="…" height=460 puis la netlist (Fichier › Exporter sous forme de texte)
  circuitjs(args, body, ctx) {
    const net = body.trim();
    if (!net) throw new Error('netlist vide');
    const params = {
      cct: encodeURI(net),
      running: args.running === 'false' ? 'false' : 'true',
      hideSidebar: args.sidebar ? 'false' : 'true',
      hideMenu: args.menu ? 'false' : 'true',
      whiteBackground: 'true',
      euroResistors: 'true',
      editable: args.editable === 'false' ? 'false' : 'true',
    };
    const url = `${CIRCUITJS}?${Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&')}`;
    const h = num(args.height, 460);
    const inner = `<div class="embed-frame" style="height:${h}px"><iframe src="${url}" title="Simulateur de circuit CircuitJS" loading="lazy" referrerpolicy="no-referrer" allow="fullscreen"></iframe></div>
      <div class="figure-tools"><a href="${url.replace(/hideSidebar=true&hideMenu=true/, 'hideSidebar=false&hideMenu=false')}" target="_blank" rel="noopener">Ouvrir en pleine page ↗</a> · <details class="inline-details"><summary>Netlist (Fichier › Importer depuis un texte)</summary><pre><code>${e(net)}</code></pre></details></div>`;
    return figure(ctx, args, inner, 'figure-embed');
  },

  // ::: pdf src=paper.pdf height=800 caption="…"
  pdf(args, body, ctx) {
    if (!args.src) throw new Error('attribut src manquant');
    const url = ctx.url(args.src);
    const h = num(args.height, 820);
    const inner = `<div class="pdf-frame" style="height:${h}px"><object data="${e(url)}#view=FitH&navpanes=0" type="application/pdf" aria-label="${e(args.caption || 'Document PDF')}">
      <p>Ce navigateur n'affiche pas les PDF intégrés. <a href="${e(url)}">Télécharger le document</a>.</p></object></div>
      <p class="figure-tools"><a href="${e(url)}" download>Télécharger le PDF</a> · <a href="${e(url)}" target="_blank" rel="noopener">Ouvrir dans un onglet ↗</a></p>`;
    return figure(ctx, args, inner, 'figure-embed figure-pdf');
  },

  // ::: youtube id=XXXXXXXXXXX caption="…"  (domaine sans cookies)
  youtube(args, body, ctx) {
    const id = String(args.id || '').replace(/[^\w-]/g, '');
    if (!id) throw new Error('attribut id manquant');
    const inner = `<div class="embed-ratio"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="${e(args.caption || 'Vidéo')}" loading="lazy" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
    return figure(ctx, args, inner, 'figure-embed');
  },

  // ::: video src=media/demo.mp4 caption="…"
  video(args, body, ctx) {
    if (!args.src) throw new Error('attribut src manquant');
    const inner = `<video controls preload="metadata" playsinline src="${e(ctx.url(args.src))}"></video>`;
    return figure(ctx, args, inner, 'figure-embed');
  },

  // ::: table id=nom caption="…" puis un tableau Markdown
  table(args, body, ctx) {
    const r = ctx.number('tab', args.id);
    const cap = args.caption ? `<div class="table-caption"><span class="fig-label">Tableau&nbsp;${r.n}</span> ${ctx.inline(args.caption)}</div>` : '';
    return `<div class="table-figure" id="${r.id}">${cap}${ctx.block(body)}</div>`;
  },

  abstract(args, body, ctx) {
    return `<div class="abstract"><p class="abstract-label">${e(args.title || 'Résumé')}</p>${ctx.block(body)}</div>`;
  },

  // ::: note title="Remarque" (kind=warning pour un avertissement)
  note(args, body, ctx) {
    const kind = args.kind === 'warning' ? 'warning' : 'note';
    const title = args.title || (kind === 'warning' ? 'Attention' : 'Remarque');
    return `<aside class="callout ${kind}"><p class="callout-title">${e(title)}</p>${ctx.block(body)}</aside>`;
  },

  // Note de marge (à côté du texte sur grand écran, intercalée sur mobile)
  aside(args, body, ctx) {
    return `<aside class="marginnote">${ctx.block(body)}</aside>`;
  },

  // ::: results puis lignes « valeur | légende »
  results(args, body, ctx) {
    const items = lines(body).map((l) => {
      const [v, ...rest] = l.split('|');
      return `<div><dt>${ctx.inline(v.trim())}</dt><dd>${ctx.inline(rest.join('|').trim())}</dd></div>`;
    });
    return `<dl class="results">${items.join('')}</dl>`;
  },

  // ::: specs puis lignes « grandeur | valeur »
  specs(args, body, ctx) {
    const rows = lines(body).map((l) => {
      const i = l.indexOf('|') >= 0 ? l.indexOf('|') : l.indexOf(':');
      return `<tr><th scope="row">${ctx.inline(l.slice(0, i).trim())}</th><td>${ctx.inline(l.slice(i + 1).trim())}</td></tr>`;
    });
    const title = args.title ? `<p class="specs-title">${e(args.title)}</p>` : '';
    return `<div class="specs">${title}<table><tbody>${rows.join('')}</tbody></table></div>`;
  },
};

export function runDirective(name, args, body, ctx) {
  const fn = handlers[name] || (name === 'callout' ? handlers.note : null);
  if (!fn) throw new Error(`bloc inconnu`);
  return fn(args, body, ctx);
}
