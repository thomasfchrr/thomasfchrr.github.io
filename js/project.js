import { loadConfig, loadManifest } from './site.js';
import { parseFrontMatter } from './engine/frontmatter.js';
import { render } from './engine/markdown.js';
import { STATUS, formatDate, escapeHtml as e } from './engine/format.js';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const slug = (params.get('p') || '').trim();

function fail(msg) {
  $('#paper-root').innerHTML = `<div class="error-page"><h1>Projet introuvable</h1><p>${e(msg)}</p><p><a href="./#projets">← Retour à la liste des projets</a></p></div>`;
  document.title = 'Projet introuvable — Thomas';
}

function setMeta(name, content, attr = 'name') {
  let m = document.head.querySelector(`meta[${attr}="${name}"]`);
  if (!m) {
    m = document.createElement('meta');
    m.setAttribute(attr, name);
    document.head.appendChild(m);
  }
  m.setAttribute('content', content);
}

function buildToc(toc) {
  if (toc.length < 3) return { side: '', mobile: '' };
  const items = toc.map((t) => `<li class="l${t.level}"><a href="#${t.id}">${e(t.text)}</a></li>`).join('');
  return {
    side: `<nav class="toc" aria-label="Sommaire"><p class="toc-title">Sommaire</p><ol>${items}</ol></nav>`,
    mobile: `<details class="toc-mobile"><summary>Sommaire</summary><ol>${toc.filter((t) => t.level === 2).map((t) => `<li><a href="#${t.id}">${e(t.text)}</a></li>`).join('')}</ol></details>`,
  };
}

function spy(root) {
  const links = new Map([...root.querySelectorAll('.toc a')].map((a) => [a.getAttribute('href').slice(1), a]));
  if (!links.size || !('IntersectionObserver' in window)) return;
  const heads = [...links.keys()].map((id) => document.getElementById(id)).filter(Boolean);
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          links.forEach((a) => a.classList.remove('active'));
          links.get(en.target.id)?.classList.add('active');
        }
      });
    },
    { rootMargin: '-80px 0px -70% 0px' }
  );
  heads.forEach((h) => io.observe(h));
}

function giscus(conf, slug) {
  const g = conf && conf.comments;
  if (!g || !g.repo || !g.repoId || !g.categoryId) return '';
  const s = document.createElement('script');
  s.src = 'https://giscus.app/client.js';
  Object.entries({
    repo: g.repo,
    'repo-id': g.repoId,
    category: g.category || 'Commentaires',
    'category-id': g.categoryId,
    mapping: 'specific',
    term: `projet:${slug}`,
    strict: '0',
    'reactions-enabled': '1',
    'emit-metadata': '0',
    'input-position': 'top',
    theme: 'preferred_color_scheme',
    lang: 'fr',
    loading: 'lazy',
  }).forEach(([k, v]) => s.setAttribute(`data-${k}`, v));
  s.crossOrigin = 'anonymous';
  s.async = true;
  setTimeout(() => $('#comments')?.appendChild(s), 0);
  return '<section class="comments" id="comments"><h2>Commentaires</h2></section>';
}

async function main() {
  if (!/^[\w-]+$/.test(slug)) return fail('Aucun projet n\'est indiqué dans l\'adresse.');
  const conf = await loadConfig();
  let all = [];
  try { all = await loadManifest(); } catch (err) { console.warn(err); }

  const res = await fetch(`projects/${slug}/index.md`, { cache: 'no-cache' });
  if (!res.ok) return fail(`Le projet « ${slug} » n'existe pas (HTTP ${res.status}).`);
  const { meta, body } = parseFrontMatter(await res.text());
  if (!meta.title) meta.title = slug;

  const out = render(body, { base: `projects/${slug}/` });
  const toc = buildToc(out.toc);

  const status = STATUS[meta.status];
  const tags = Array.isArray(meta.tags) ? meta.tags : [];
  const repo = conf.repo || '';
  const branch = conf.branch || 'main';
  const idx = all.findIndex((p) => p.slug === slug);
  const prev = idx > 0 ? all[idx - 1] : null;
  const next = idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null;

  const links = [];
  if (meta.repo) links.push(`<span>Code : <a href="${e(meta.repo)}" rel="noopener">dépôt GitHub ↗</a></span>`);
  if (meta.paper) links.push(`<span>Papier : <a href="projects/${slug}/${e(meta.paper)}">PDF</a></span>`);
  links.push('<span><a href="#" id="print-link">Imprimer / PDF</a></span>');

  const issue = repo
    ? `<a href="https://github.com/${repo}/issues/new?title=${encodeURIComponent(`[${meta.title}] `)}" rel="noopener">Signaler une erreur ou poser une question ↗</a>`
    : '';
  const edit = repo ? `<a href="https://github.com/${repo}/blob/${branch}/projects/${slug}/index.md" rel="noopener">Source de cette page ↗</a>` : '';

  $('#paper-root').innerHTML = `
    <header class="paper-head">
      <div class="crumb"><a href="./">Accueil</a> / <a href="./#projets">Projets</a> / ${e(slug)}</div>
      <p class="kicker">
        ${status ? `<span class="status status-${e(meta.status)}"><span class="status-label">${status}</span></span>` : ''}
        ${meta.kind ? `<span>${e(meta.kind)}</span>` : ''}
        ${meta.domain ? `<span>${e(meta.domain)}</span>` : ''}
        ${meta.date ? `<span>${formatDate(String(meta.date))}</span>` : ''}
      </p>
      <h1>${e(meta.title)}</h1>
      ${meta.subtitle ? `<p class="subtitle">${e(meta.subtitle)}</p>` : ''}
      <div class="paper-meta">
        ${tags.length ? `<span class="tags">${tags.map((t) => `<span>${e(t)}</span>`).join('')}</span>` : ''}
        ${links.join('')}
      </div>
    </header>
    <div class="paper">
      ${toc.side}
      <article class="paper-body">
        ${toc.mobile}
        <div class="prose" id="prose">${out.html}</div>
        <footer class="paper-end">
          <div class="nav">
            ${prev ? `<a href="project.html?p=${encodeURIComponent(prev.slug)}">← ${e(prev.title)}</a>` : '<span></span>'}
            ${next ? `<a href="project.html?p=${encodeURIComponent(next.slug)}">${e(next.title)} →</a>` : '<span></span>'}
          </div>
          <div>${[issue, edit].filter(Boolean).join(' · ')}</div>
        </footer>
        ${giscus(conf, slug)}
      </article>
      <div></div>
    </div>`;

  document.title = `${meta.title} — Thomas`;
  const desc = meta.summary || meta.subtitle || '';
  if (desc) { setMeta('description', String(desc)); setMeta('og:description', String(desc), 'property'); }
  setMeta('og:title', meta.title, 'property');

  out.mount($('#prose'));
  spy($('#paper-root'));
  $('#print-link')?.addEventListener('click', (ev) => { ev.preventDefault(); window.print(); });

  if (location.hash) {
    const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (el) setTimeout(() => el.scrollIntoView(), 50);
  }
}

main().catch((err) => {
  console.error(err);
  fail(`Erreur de chargement : ${err.message}`);
});
