#!/usr/bin/env python3
"""Charge et décharge d'un condensateur à travers une résistance.

Compare la solution analytique du circuit RC à trois schémas d'intégration
(Euler explicite, Euler implicite, trapèzes), mesure l'ordre de convergence,
et produit les fichiers de données utilisés par la page du projet.

Usage :  python3 simulate.py          (dépend uniquement de NumPy)
Sortie : ../data/*.csv et ../data/results.json  (déterministe, aucune graine aléatoire)
"""
import json
import pathlib

import numpy as np

HERE = pathlib.Path(__file__).resolve().parent
DATA = HERE.parent / "data"
DATA.mkdir(exist_ok=True)

# --- Paramètres du circuit de référence -------------------------------------
R = 1e3      # Ω
C = 1e-6     # F
V = 5.0      # V
TAU = R * C  # 1 ms


# --- Solution analytique ----------------------------------------------------
def v_exact(t, v0=0.0, target=V, tau=TAU):
    """Solution de tau dv/dt + v = target avec v(0) = v0."""
    return target + (v0 - target) * np.exp(-np.asarray(t) / tau)


# --- Schémas numériques pour  dv/dt = (V - v) / tau --------------------------
# Chaque schéma s'écrit v[k+1] = a * v[k] + b ; a est le facteur d'amplification.
def step_coeffs(method, h, tau=TAU, target=V):
    x = h / tau
    if method == "euler_expl":
        return 1 - x, x * target
    if method == "euler_impl":
        return 1 / (1 + x), x * target / (1 + x)
    if method == "trap":
        return (1 - x / 2) / (1 + x / 2), x * target / (1 + x / 2)
    raise ValueError(method)


def integrate(method, h, t_end, v0=0.0):
    n = int(round(t_end / h))
    a, b = step_coeffs(method, h)
    v = np.empty(n + 1)
    v[0] = v0
    for k in range(n):
        v[k + 1] = a * v[k] + b
    return np.arange(n + 1) * h, v


def write_csv(path, columns):
    """columns : dict nom -> liste ; les colonnes plus courtes sont complétées par des cases vides."""
    n = max(len(c) for c in columns.values())
    with open(path, "w", encoding="utf-8") as f:
        f.write(",".join(columns) + "\n")
        for i in range(n):
            f.write(",".join(f"{c[i]:.9g}" if i < len(c) else "" for c in columns.values()) + "\n")


results = {"R_ohm": R, "C_F": C, "V_V": V, "tau_s": TAU}

# --- 1. Réponse indicielle : analytique contre schémas, pas h = tau/2 ---------
t_end = 6 * TAU
t_dense = np.linspace(0, t_end, 601)
h = TAU / 2
cols = {"t_ms": t_dense * 1e3, "v_exact": v_exact(t_dense)}
for m in ("euler_expl", "euler_impl", "trap"):
    tn, vn = integrate(m, h, t_end)
    cols[f"t_{m}_ms"] = tn * 1e3
    cols[f"v_{m}"] = vn
write_csv(DATA / "transient.csv", cols)

# --- 2. Stabilité d'Euler explicite : h = 0,5 tau ; 1,5 tau ; 2,5 tau ----------
t_dense_n = np.linspace(0, 8, 801)  # en unités de tau
cols = {"t_tau": t_dense_n, "v_exact": v_exact(t_dense_n * TAU) / V}
stability = {}
for label, ratio in (("h05", 0.5), ("h15", 1.5), ("h25", 2.5)):
    tn, vn = integrate("euler_expl", ratio * TAU, 8 * TAU)
    cols[f"t_{label}"] = tn / TAU
    cols[f"v_{label}"] = vn / V
    stability[label] = {"h_over_tau": ratio, "amplification": step_coeffs("euler_expl", ratio * TAU)[0],
                        "v_last_over_V": float(vn[-1] / V), "n_steps": int(len(tn) - 1)}
write_csv(DATA / "stability.csv", cols)
results["stability"] = stability

# --- 3. Convergence : erreur maximale sur [0, 6 tau] selon h -----------------
rows = {"h_over_tau": [], "err_euler_expl": [], "err_euler_impl": [], "err_trap": []}
for n in (6, 12, 24, 48, 96, 192, 384, 768, 1536):
    h = t_end / n
    rows["h_over_tau"].append(h / TAU)
    for m in ("euler_expl", "euler_impl", "trap"):
        t, v = integrate(m, h, t_end)
        rows[f"err_{m}"].append(float(np.max(np.abs(v - v_exact(t))) / V))  # erreur relative à V
write_csv(DATA / "convergence.csv", rows)
x = np.log10(rows["h_over_tau"][3:])  # pentes mesurées sur les h les plus petits
results["convergence"] = {
    "slope_euler_expl": float(np.polyfit(x, np.log10(rows["err_euler_expl"][3:]), 1)[0]),
    "slope_euler_impl": float(np.polyfit(x, np.log10(rows["err_euler_impl"][3:]), 1)[0]),
    "slope_trap": float(np.polyfit(x, np.log10(rows["err_trap"][3:]), 1)[0]),
    "table": {k: rows[k] for k in rows},
}
# Erreur du pas h = tau/2 utilisé à la figure 3
tn, vn = integrate("euler_expl", TAU / 2, t_end)
results["err_at_half_tau"] = {
    m: float(np.max(np.abs(integrate(m, TAU / 2, t_end)[1] - v_exact(integrate(m, TAU / 2, t_end)[0]))) / V)
    for m in ("euler_expl", "euler_impl", "trap")
}

# --- 4. Créneau 0/5 V, T = 10 ms : trois constantes de temps ------------------
T = 10e-3
half = T / 2
t = np.arange(0, 3 * T + 1e-12, 50e-6)


def square_response(tau):
    v = np.empty_like(t)
    v_start = 0.0
    for k in range(6):
        target = V if k % 2 == 0 else 0.0
        sel = (t >= k * half - 1e-12) & (t <= (k + 1) * half + 1e-12)
        v[sel] = v_exact(t[sel] - k * half, v_start, target, tau)
        v_start = float(v_exact(half, v_start, target, tau))
    return v


vs = np.where(((t / half).astype(int) % 2) == 0, V, 0.0)
vs[-1] = vs[-2]
cols = {"t_ms": t * 1e3, "source": vs}
regimes = {}
for label, tau in (("tau_0_2ms", 0.2e-3), ("tau_2ms", 2e-3), ("tau_20ms", 20e-3)):
    cols[label] = square_response(tau)
    regimes[label] = {"tau_s": tau, "half_period_over_tau": half / tau,
                      "v_end_first_half_V": float(v_exact(half, 0.0, V, tau)),
                      "v_min_steady_V": float(V * np.exp(-half / tau) / (1 + np.exp(-half / tau))),
                      "v_max_steady_V": float(V / (1 + np.exp(-half / tau)))}
write_csv(DATA / "regimes.csv", cols)
results["regimes"] = regimes

# --- 5. Énergie dissipée : indépendante de R -----------------------------------
energy = {}
for r in (100.0, 1e3, 10e3):
    tau = r * C
    tt = np.linspace(0, 40 * tau, 400001)
    i = (V - v_exact(tt, 0.0, V, tau)) / r
    e_r = float(np.trapezoid(r * i**2, tt))
    energy[f"R_{int(r)}"] = {"E_dissipee_J": e_r, "E_stockee_J": 0.5 * C * V**2,
                              "ratio_dissipee_sur_stockee": e_r / (0.5 * C * V**2)}
results["energy"] = energy

# --- 6. Jalons du transitoire ---------------------------------------------------
results["milestones"] = {f"{k}tau": float(1 - np.exp(-k)) for k in (1, 2, 3, 4, 5)}
results["t_rise_10_90_over_tau"] = float(np.log(9))
results["t_half_over_tau"] = float(np.log(2))
results["rise_time_bandwidth_product"] = float(np.log(9) / (2 * np.pi))

# --- 7. Dimensionnement : temps de montée visé 1 ms avec C = 100 nF ----------------
e12 = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2]
C2 = 100e-9
tr_target = 1e-3
r_ideal = tr_target / (np.log(9) * C2)
cands = [m * 10**e for e in range(2, 6) for m in e12]
r_e12 = min(cands, key=lambda r: abs(r - r_ideal))
results["design"] = {"C_F": C2, "t_rise_target_s": tr_target, "R_ideal_ohm": float(r_ideal), "R_e12_ohm": float(r_e12),
                     "t_rise_real_s": float(np.log(9) * r_e12 * C2),
                     "error_percent": float((np.log(9) * r_e12 * C2 / tr_target - 1) * 100)}

# --- 8. Tolérances : R ±1 %, C ±10 % (lois uniformes) ---------------------------
results["tolerance"] = {
    "worst_low_percent": float((0.99 * 0.90 - 1) * 100),
    "worst_high_percent": float((1.01 * 1.10 - 1) * 100),
    "std_percent_uniform": float(np.sqrt((0.01**2 + 0.10**2) / 3) * 100),
}

with open(DATA / "results.json", "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2, ensure_ascii=False)
print(json.dumps({k: results[k] for k in ("stability", "err_at_half_tau", "design", "tolerance")}, indent=1, ensure_ascii=False))
print("pentes :", {k: round(v, 3) for k, v in results["convergence"].items() if k.startswith("slope")})
print("energie :", {k: round(v["ratio_dissipee_sur_stockee"], 5) for k, v in energy.items()})
