#!/bin/sh
# Reconstruit la note technique : données → figures → PDF, puis copie le PDF à la racine du projet.
set -e
cd "$(dirname "$0")"
python3 ../sim/simulate.py > /dev/null
python3 make_figures.py
xelatex -interaction=nonstopmode -halt-on-error paper.tex > /dev/null
xelatex -interaction=nonstopmode -halt-on-error paper.tex > /dev/null
cp paper.pdf ../paper.pdf
rm -f paper.aux paper.log paper.out build1.log build2.log
echo "paper.pdf mis à jour"
