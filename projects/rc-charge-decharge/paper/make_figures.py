#!/usr/bin/env python3
"""Génère les figures (PDF vectoriel) et numbers.tex pour la note technique.

Les nombres cités dans paper.tex proviennent de ../data/results.json : aucune recopie manuelle.
Dépendances : NumPy, Matplotlib. Lancer d'abord ../sim/simulate.py.
"""
import json
import pathlib

import matplotlib
import numpy as np

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager, ticker

HERE = pathlib.Path(__file__).resolve().parent
DATA = HERE.parent / "data"
res = json.load(open(DATA / "results.json", encoding="utf-8"))

# Police Latin Modern si elle est installée (cohérence avec le texte LaTeX)
for p in pathlib.Path("/usr/share/texmf/fonts/opentype/public/lm").glob("lmroman10-*.otf"):
    font_manager.fontManager.addfont(str(p))
names = {f.name for f in font_manager.fontManager.ttflist}
plt.rcParams.update({
    "font.family": "Latin Modern Roman" if "Latin Modern Roman" in names else "serif",
    "mathtext.fontset": "cm",
    "font.size": 9.5,
    "axes.linewidth": 0.7,
    "axes.grid": True,
    "grid.color": "#dcdcdc",
    "grid.linewidth": 0.5,
    "legend.frameon": False,
    "axes.unicode_minus": False,
})
BLUE, VERM, GREEN, GREY = "#0072B2", "#D55E00", "#009E73", "#777777"
comma = ticker.FuncFormatter(lambda v, _: f"{v:g}".replace(".", ","))


def load(name):
    return np.genfromtxt(DATA / name, delimiter=",", names=True)


# --- Figure 1 : échelon, schémas à h = tau/2 ---------------------------------
d = load("transient.csv")
fig, ax = plt.subplots(figsize=(6.0, 3.0))
ax.plot(d["t_ms"], d["v_exact"], color="black", lw=1.4, label="solution exacte")
for key, col, mk, lab in (("euler_expl", VERM, "o", "Euler explicite"), ("euler_impl", GREEN, "s", "Euler implicite"), ("trap", BLUE, "^", "trapèzes")):
    t, v = d[f"t_{key}_ms"], d[f"v_{key}"]
    ok = ~np.isnan(t)
    ax.plot(t[ok], v[ok], color=col, lw=0.8, marker=mk, ms=3.6, label=lab)
ax.set_xlabel("temps $t$ (ms)")
ax.set_ylabel("tension $v_C$ (V)")
ax.xaxis.set_major_formatter(comma)
ax.yaxis.set_major_formatter(comma)
ax.legend(loc="lower right")
fig.tight_layout()
fig.savefig(HERE / "fig-transient.pdf")
plt.close(fig)

# --- Figure 2 : convergence --------------------------------------------------
c = load("convergence.csv")
fig, ax = plt.subplots(figsize=(6.0, 3.0))
ax.loglog(c["h_over_tau"], c["err_euler_expl"], color=VERM, marker="o", ms=3.6, lw=0.9, label="Euler explicite")
ax.loglog(c["h_over_tau"], c["err_euler_impl"], color=GREEN, marker="s", ms=3.6, lw=0.9, label="Euler implicite")
ax.loglog(c["h_over_tau"], c["err_trap"], color=BLUE, marker="^", ms=3.6, lw=0.9, label="trapèzes")
h = np.array([c["h_over_tau"][-1], c["h_over_tau"][0]])
ax.loglog(h, 0.6 * h, color=GREY, ls="--", lw=0.8)
ax.loglog(h, 0.06 * h**2, color=GREY, ls="--", lw=0.8)
ax.text(0.012, 0.012, "pente 1", color=GREY, rotation=22, fontsize=8)
ax.text(0.012, 4e-6, "pente 2", color=GREY, rotation=40, fontsize=8)
ax.set_xlabel("pas réduit $h/\\tau$")
ax.set_ylabel("erreur maximale / $V$")
ax.legend(loc="lower right")
fig.tight_layout()
fig.savefig(HERE / "fig-convergence.pdf")
plt.close(fig)


# --- numbers.tex ---------------------------------------------------------------
def dec(x, n=2):
    return f"{x:.{n}f}".replace(".", "{,}")


conv, err, st, des, tol, reg = res["convergence"], res["err_at_half_tau"], res["stability"], res["design"], res["tolerance"], res["regimes"]
macros = {
    "slopeEE": dec(conv["slope_euler_expl"]),
    "slopeBE": dec(conv["slope_euler_impl"]),
    "slopeTR": dec(conv["slope_trap"]),
    "errEE": dec(err["euler_expl"] * 100, 1),
    "errBE": dec(err["euler_impl"] * 100, 1),
    "errTR": dec(err["trap"] * 100, 2),
    "vLastTwoFive": dec(st["h25"]["v_last_over_V"], 1),
    "RIdeal": dec(des["R_ideal_ohm"] / 1e3, 2),
    "tRreal": dec(des["t_rise_real_s"] * 1e3, 3),
    "tRerr": dec(des["error_percent"], 1),
    "tolLow": dec(tol["worst_low_percent"], 1),
    "tolHigh": dec(tol["worst_high_percent"], 1),
    "tolStd": dec(tol["std_percent_uniform"], 1),
    "ripple": dec(reg["tau_20ms"]["v_max_steady_V"] - reg["tau_20ms"]["v_min_steady_V"], 2),
    "energyJ": dec(res["energy"]["R_1000"]["E_dissipee_J"] * 1e6, 1),
}
with open(HERE / "numbers.tex", "w", encoding="utf-8") as f:
    f.write("% Généré par make_figures.py à partir de data/results.json — ne pas modifier à la main.\n")
    for k, v in macros.items():
        f.write(f"\\newcommand{{\\{k}}}{{\\ensuremath{{{v}}}}}\n")
print("figures et numbers.tex écrits")
