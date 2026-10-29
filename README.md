# thomasfchrr.github.io

Portfolio d'électronique : notes techniques, simulations et projets de PCB. Site statique (aucune étape de build côté serveur), publié par GitHub Pages depuis `main`.

## Ajouter un projet

1. Créer `projects/<nom-du-projet>/index.md`.
2. En-tête (front matter) :

```yaml
---
title: Titre
subtitle: Sous-titre
date: 2026-10-27
status: termine        # termine | en-cours | planifie
kind: Théorie et simulation
domain: Analogique
tags: [RC, simulation]
summary: Une ou deux phrases pour la liste.
repo: thomasfchrr/autre-depot   # optionnel
paper: paper.pdf                # optionnel
order: 1
---
```

3. Écrire en Markdown. Mathématiques KaTeX : `$…$`, `$$…$$ {#eq:id}`. Références : `@fig:id`, `@tab:id`, `@eq:id`.
4. Blocs `::: nom` disponibles : figure, gallery, plot, sim, circuitjs, pdf, youtube, video, table, abstract, note, aside, results, specs. Voir `projects/rc-charge-decharge/index.md` pour des exemples.
5. Régénérer la liste : `node tools/build.mjs` (`--check` pour valider seulement). Le workflow `.github/workflows/manifest.yml` le fait automatiquement après un push.

## Note LaTeX

`projects/rc-charge-decharge/paper/` : `paper.tex` (XeLaTeX), `make_figures.py` produit figures et `numbers.tex` depuis `data/`. `build.sh` compile, puis copier le PDF en `paper.pdf`.

## Commentaires (Giscus)

Désactivés par défaut. Configurer sur https://giscus.app, puis renseigner dans `site.json` : `"comments": {"repo": "...", "repoId": "...", "category": "...", "categoryId": "..."}`.

## Test local

`python3 -m http.server` à la racine, puis http://localhost:8000.
