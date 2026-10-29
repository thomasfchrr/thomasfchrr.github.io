---
title: Charge et décharge d'un condensateur
subtitle: Du modèle RC à la simulation numérique, étude complète d'un transitoire du premier ordre
date: 2026-10-27
status: termine
kind: Théorie et simulation
domain: Analogique
tags: [RC, Régime transitoire, Intégration numérique, SPICE, Filtre passe-bas]
summary: Solution analytique du circuit RC, comparaison à trois schémas d'intégration (écarts, ordres de convergence et stabilité mesurés), énergie dissipée, effet des tolérances. Simulateur interactif et données reproductibles.
repo: https://github.com/thomasfchrr/thomasfchrr.github.io/tree/main/projects/rc-charge-decharge
paper: paper.pdf
order: 1
---

::: abstract
Le circuit RC série est le plus simple des systèmes du premier ordre ; c'est la brique de base des filtres, des temporisations et des étages d'alimentation. On établit la réponse d'un condensateur à un échelon et à un créneau de tension, puis on la confronte à trois schémas d'intégration numérique (Euler explicite, Euler implicite, trapèzes). Les ordres de convergence mesurés sont $1{,}01$, $0{,}99$ et $2{,}00$, et la condition de stabilité $h < 2\tau$ du schéma explicite est vérifiée. On montre aussi que l'énergie dissipée dans la résistance pendant une charge vaut $\tfrac{1}{2}CV^2$ quelle que soit $R$, et on quantifie l'effet des tolérances sur $\tau$. Ce travail est **théorique et numérique** : aucune mesure sur banc n'a encore été faite (voir la section *Perspectives*).
:::

::: results
63,2 % | de $V$ atteint à $t=\tau$
$2{,}2\,\tau$ | temps de montée 10–90 %
$2{,}00$ | ordre de convergence mesuré, schéma des trapèzes
50 % | de l'énergie de charge dissipée dans $R$, quelle que soit $R$
:::

## Position du problème

Une source de tension $v_s(t)$ charge un condensateur $C$ à travers une résistance $R$ (@fig:circuit). On cherche la tension $v_C(t)$ aux bornes du condensateur et le courant $i(t)$, d'abord pour un échelon $v_s = V$ appliqué à $t = 0$ (condensateur initialement déchargé), puis pour un créneau qui charge et décharge alternativement le condensateur.

::: figure src=figures/rc-circuit.svg id=circuit width=520px caption="Circuit RC série. La tension $v_C$ et le courant $i$ sont orientés en convention récepteur pour le condensateur."
:::

Hypothèses du modèle : composants linéaires et idéaux (pas de résistance série équivalente, pas de fuite, pas d'inductance parasite), source idéale d'impédance de sortie nulle, commutation instantanée. La dernière section discute ce qui change quand ces hypothèses sont levées.

## Modèle analytique

La loi des mailles donne $v_s = R\,i + v_C$, et le condensateur impose $i = C\,\dd v_C/\dd t$. On en déduit l'équation différentielle du premier ordre

$$ \tau\,\frac{\dd v_C}{\dd t} + v_C = v_s(t), \qquad \tau = RC $$ {#eq:ode}

Pour une source constante $v_s = V$ et une condition initiale $v_C(0) = v_0$, la solution est

$$ v_C(t) = V + (v_0 - V)\,\ee^{-t/\tau}, \qquad i(t) = \frac{V - v_0}{R}\,\ee^{-t/\tau} $$ {#eq:sol}

La charge depuis zéro correspond à $v_0 = 0$, soit $v_C = V\left(1 - \ee^{-t/\tau}\right)$ ; la décharge vers une source nulle à $V = 0$, soit $v_C = v_0\,\ee^{-t/\tau}$. Le courant est maximal à la commutation, $\lvert i(0^+)\rvert = \lvert V - v_0\rvert / R$, puis décroît avec la même constante de temps.

### Jalons du transitoire

Les repères utiles se déduisent de @eq:sol, en posant $v_C/V = 1 - \ee^{-n}$ pour $t = n\tau$.

::: table id=jalons caption="Avancement de la charge en fonction du temps réduit $t/\tau$ (calculé avec la solution analytique)."
| $t/\tau$ | $v_C/V$ | Interprétation |
|---:|---:|:---|
| $0{,}693$ | $50{,}0\ \%$ | temps de demi-charge, $\tau\ln 2$ |
| $1$ | $63{,}2\ \%$ | définition pratique de $\tau$ |
| $2$ | $86{,}5\ \%$ | |
| $3$ | $95{,}0\ \%$ | |
| $4$ | $98{,}2\ \%$ | |
| $5$ | $99{,}3\ \%$ | charge considérée comme terminée |
:::

Le temps de montée 10–90 % se calcule directement : $v_C = 0{,}1\,V$ à $t_{10} = -\tau\ln 0{,}9$ et $v_C = 0{,}9\,V$ à $t_{90} = -\tau\ln 0{,}1$, d'où

$$ t_r = t_{90} - t_{10} = \tau\ln 9 \approx 2{,}197\,\tau $$ {#eq:tr}

Comme le circuit est aussi un filtre passe-bas de fréquence de coupure à $-3\ \text{dB}$ égale à $f_c = 1/(2\pi\tau)$, on obtient la relation classique $t_r\,f_c = \ln 9/(2\pi) \approx 0{,}350$, que l'on retrouve dans la règle empirique $t_r \approx 0{,}35/f_c$ [1].

::: aside
Cette relation relie le domaine temporel (vitesse d'établissement) au domaine fréquentiel (bande passante). Elle sert à estimer la bande passante d'un oscilloscope ou d'une sonde à partir du temps de montée mesuré.
:::

### Énergie

L'énergie dissipée dans la résistance pendant la charge depuis zéro vaut

$$ E_R = \int_0^{\infty} R\,i^2\,\dd t = \frac{V^2}{R}\cdot\frac{\tau}{2} = \tfrac{1}{2}CV^2 $$ {#eq:energy}

Elle **ne dépend pas de $R$**. La source fournit au total $\int V\,i\,\dd t = CV^2$ ; le condensateur en stocke la moitié, $\tfrac{1}{2}CV^2$, et l'autre moitié est perdue en chaleur : le rendement d'une charge à travers une résistance est de 50 %, quelle que soit la vitesse de charge. C'est l'une des motivations des alimentations à découpage, qui transfèrent l'énergie par une inductance plutôt que par une résistance.

### Simulateur interactif

Le simulateur ci-dessous évalue @eq:sol avec des valeurs normalisées de la série E12. Il permet d'observer l'effet de $\tau$ sur la forme de la réponse, et en particulier le passage entre trois régimes selon le rapport de la demi-période à $\tau$ (voir plus bas).

::: sim rc R=1k C=1u V=5 f=100 id=sim caption="Simulateur du modèle RC (solution analytique exacte). Passer la souris sur la courbe pour lire les valeurs ; activer le courant pour voir $i(t)$."
:::

## Simulation du circuit

Pour vérifier le modèle sur un circuit « câblé » plutôt que sur une formule, on peut utiliser un simulateur de circuits. La figure suivante intègre CircuitJS (version JavaScript du simulateur de P. Falstad, développée avec I. Sharp [4]) : une source carrée 0–5 V à 1 Hz alimente $R = 1\ \text{k}\Omega$ et $C = 100\ \mu\text{F}$, soit $\tau = 0{,}1\ \text{s}$ ; la demi-période de 0,5 s vaut donc $5\tau$. Les valeurs sont modifiables en cliquant sur les composants.

::: circuitjs id=cjs height=480 caption="Circuit RC dans CircuitJS (simulateur externe chargé depuis lushprojects.com). Le tracé du bas montre la source et la tension du condensateur."
$ 1 0.002 1.5625 50 5 50 5e-11
v 176 304 176 144 0 2 1 2.5 2.5 0 0.5
r 176 144 304 144 0 1000
c 304 144 304 304 0 0.0001 0 0
w 304 304 176 304 0
g 176 304 176 336 0 0
o 0 2 0 4099 5 0.1 0 2 2 0
:::

Le même circuit, avec $R = 1\ \text{k}\Omega$, $C = 1\ \mu\text{F}$ et une source à 100 Hz, s'écrit en syntaxe SPICE ci-dessous ; il est fourni pour reproduction dans ngspice ou LTspice. La simulation de référence de cet article reste celle de la section suivante, dont je maîtrise chaque ligne.

```spice
* Circuit RC série : créneau 0/5 V, 100 Hz
V1 in 0 PULSE(0 5 0 1u 1u 5m 10m)
R1 in out 1k
C1 out 0 1u IC=0
.tran 10u 30m UIC
.end
```

## Simulation numérique de référence

Un simulateur de circuits résout les équations par intégration numérique ; SPICE utilise par défaut la méthode des trapèzes [3]. Pour comprendre ce que cela change, j'ai écrit un script Python (NumPy seul) qui résout @eq:ode avec trois schémas de pas constant $h$ et les compare à la solution exacte @eq:sol. Avec $x = h/\tau$ et $v_{k+1} = a\,v_k + b$, le facteur d'amplification $a$ gouverne la stabilité :

::: table id=schemas caption="Schémas d'intégration pour $\tau\,\dot v = V - v$ ; $x = h/\tau$."
| Schéma | Facteur d'amplification $a$ | Ordre | Condition de stabilité |
|:---|:---:|:---:|:---|
| Euler explicite | $1 - x$ | 1 | $\lvert 1 - x\rvert < 1$, soit $h < 2\tau$ |
| Euler implicite | $\dfrac{1}{1 + x}$ | 1 | stable pour tout $h > 0$ |
| Trapèzes | $\dfrac{1 - x/2}{1 + x/2}$ | 2 | stable pour tout $h > 0$ |
:::

### Écart à la solution exacte

La figure suivante montre l'échelon de charge avec un pas volontairement grossier, $h = \tau/2$ (soit 12 pas jusqu'à $6\tau$). L'erreur maximale, rapportée à $V$, vaut $11{,}8\ \%$ pour Euler explicite, $7{,}7\ \%$ pour Euler implicite et $0{,}79\ \%$ pour les trapèzes.

::: plot data=data/transient.csv x=t_ms y=v_exact,v_euler_expl@t_euler_expl_ms,v_euler_impl@t_euler_impl_ms,v_trap@t_trap_ms legend="Exacte|Euler explicite|Euler implicite|Trapèzes" style=line,linepoints,linepoints,linepoints xlabel="Temps t (ms)" ylabel="Tension du condensateur (V)" id=transient caption="Charge de $C = 1\ \mu\text{F}$ à travers $R = 1\ \text{k}\Omega$ sous $V = 5\ \text{V}$ ($\tau = 1\ \text{ms}$), pas de calcul $h = \tau/2$. Euler explicite surestime la tension à chaque pas, Euler implicite la sous-estime, et les trapèzes restent presque confondus avec la solution exacte."
:::

### Stabilité du schéma explicite

Le facteur d'amplification d'Euler explicite, $1 - h/\tau$, devient négatif pour $h > \tau$ : la solution numérique oscille autour de la valeur finale. Pour $h > 2\tau$, son module dépasse 1 et l'oscillation diverge, alors que la solution physique est un simple exponentiel monotone.

::: plot data=data/stability.csv x=t_tau y=v_exact,v_h05@t_h05,v_h15@t_h15,v_h25@t_h25 legend="Exacte|h = 0,5 τ|h = 1,5 τ|h = 2,5 τ" style=line,linepoints,linepoints,linepoints xlabel="Temps réduit t/τ" ylabel="Tension réduite v/V" hlines="1:valeur finale" id=stab caption="Euler explicite avec trois pas. $h = 0{,}5\,\tau$ : convergence monotone ($a = 0{,}5$). $h = 1{,}5\,\tau$ : convergence oscillante ($a = -0{,}5$). $h = 2{,}5\,\tau$ : divergence ($a = -1{,}5$) ; après 3 pas, $v = 4{,}4\,V$, soit 4,4 fois la valeur finale."
:::

Ce phénomène n'est pas propre au circuit RC : dès qu'un circuit contient des constantes de temps très différentes (« raideur »), les schémas explicites imposent un pas dicté par la plus petite d'entre elles, ce qui motive l'usage de schémas implicites dans les simulateurs de circuits [2].

### Ordre de convergence

On fait varier $h$ de $\tau$ à $\tau/256$ environ et on relève l'erreur maximale sur $[0,\,6\tau]$ rapportée à $V$. En échelle logarithmique, une méthode d'ordre $p$ donne une droite de pente $p$. Les pentes ajustées sur les six plus petits pas sont $1{,}01$ (Euler explicite), $0{,}99$ (Euler implicite) et $2{,}00$ (trapèzes).

::: plot data=data/convergence.csv x=h_over_tau y=err_euler_expl,err_euler_impl,err_trap logx logy legend="Euler explicite|Euler implicite|Trapèzes" style=linepoints xlabel="Pas réduit h/τ" ylabel="Erreur maximale / V" id=conv caption="Erreur maximale en fonction du pas, échelles logarithmiques. Diviser le pas par 2 divise l'erreur par 2 pour les schémas d'ordre 1 et par 4 pour les trapèzes (de $1{,}2\times10^{-4}$ à $3{,}0\times10^{-5}$ entre $h/\tau = 0{,}0625$ et $0{,}03125$)."
:::

À précision égale, les trapèzes permettent donc un pas bien plus grand, ce qui explique qu'ils soient la méthode par défaut des simulateurs de circuits. Leur facteur d'amplification tend vers $-1$ quand $h \to \infty$ : sur un circuit raide et avec un pas trop grand, ils peuvent produire des oscillations non amorties, défaut que n'ont pas les schémas implicites d'ordre 1.

## Réponse à un créneau

Quand la source est un créneau de période $T$, le condensateur est chargé puis déchargé à chaque demi-période $T/2$. Le comportement dépend du rapport $(T/2)/\tau$ :

- $T/2 \gg \tau$ : la charge est complète à chaque alternance, le condensateur « suit » la source en arrondissant les fronts ;
- $T/2 \approx \tau$ : la charge est partielle, la tension oscille entre deux valeurs intermédiaires ;
- $T/2 \ll \tau$ : le circuit se comporte en intégrateur, la tension est quasi triangulaire autour de la valeur moyenne $V/2$.

En régime périodique établi, avec $a = \ee^{-T/(2\tau)}$, les extrema de la tension valent

$$ v_{\min} = V\,\frac{a}{1 + a}, \qquad v_{\max} = \frac{V}{1 + a} $$ {#eq:steady}

::: plot data=data/regimes.csv x=t_ms y=source,tau_0_2ms,tau_2ms,tau_20ms legend="Source|τ = 0,2 ms|τ = 2 ms|τ = 20 ms" style=step,line,line,line colors=muted,1,2,3 xlabel="Temps t (ms)" ylabel="Tension (V)" id=regimes caption="Réponse à un créneau 0/5 V de période $T = 10\ \text{ms}$ (100 Hz) pour trois constantes de temps. Rapports $(T/2)/\tau$ : 25, 2,5 et 0,25."
:::

Pour $\tau = 20\ \text{ms}$ ($(T/2)/\tau = 0{,}25$), @eq:steady donne $v_{\min} = 2{,}19\ \text{V}$ et $v_{\max} = 2{,}81\ \text{V}$, soit une ondulation de $0{,}62\ \text{V}$ crête à crête. L'approximation linéaire $\Delta v \approx VT/(4\tau) = 0{,}625\ \text{V}$ est cohérente avec ce résultat. Pour $\tau = 2\ \text{ms}$ ($(T/2)/\tau = 2{,}5$), la tension atteint seulement $4{,}59\ \text{V}$ à la fin de la première alternance, et oscille ensuite entre $0{,}38\ \text{V}$ et $4{,}62\ \text{V}$.

## Énergie dissipée

Pour vérifier @eq:energy, on intègre numériquement $R\,i^2$ sur $40\,\tau$ pour trois valeurs de $R$, avec $C = 1\ \mu\text{F}$ et $V = 5\ \text{V}$ :

::: table id=energie caption="Énergie dissipée dans $R$ pendant la charge ($\tfrac{1}{2}CV^2 = 12{,}5\ \mu\text{J}$)."
| $R$ | $\tau$ | $E_R$ | $E_R\,/\,\tfrac{1}{2}CV^2$ |
|---:|---:|---:|---:|
| $100\ \Omega$ | $0{,}1\ \text{ms}$ | $12{,}5\ \mu\text{J}$ | $1{,}000$ |
| $1\ \text{k}\Omega$ | $1\ \text{ms}$ | $12{,}5\ \mu\text{J}$ | $1{,}000$ |
| $10\ \text{k}\Omega$ | $10\ \text{ms}$ | $12{,}5\ \mu\text{J}$ | $1{,}000$ |
:::

Le résultat est identique pour les trois résistances, comme le prévoit la théorie : $R$ fixe la durée de la charge, pas l'énergie perdue.

## Dimensionnement et tolérances

**Choix des composants.** Pour un temps de montée visé de $1\ \text{ms}$ avec $C = 100\ \text{nF}$, @eq:tr donne $\tau = 0{,}455\ \text{ms}$, donc $R = 4{,}55\ \text{k}\Omega$. La valeur la plus proche de la série E12 est $4{,}7\ \text{k}\Omega$, qui conduit à $t_r = 1{,}033\ \text{ms}$, soit $+3{,}3\ \%$ par rapport à la cible. Une résistance de la série E96 ($4{,}53\ \text{k}\Omega$) réduirait cet écart, au prix d'une tolérance plus serrée à acheter.

**Tolérances.** Comme $\tau = RC$, les tolérances relatives s'ajoutent au premier ordre : $\delta\tau/\tau \approx \delta R/R + \delta C/C$. Avec $R$ à $\pm1\ \%$ et $C$ à $\pm10\ \%$, le pire cas donne $-10{,}9\ \%$ et $+11{,}1\ \%$ sur $\tau$. Si l'on suppose des lois uniformes indépendantes sur les deux tolérances, l'écart type relatif est $\sqrt{(0{,}01^2 + 0{,}10^2)/3} = 5{,}8\ \%$. C'est donc la tolérance du condensateur qui domine.

## Limites du modèle

Le modèle idéal est une première approximation. Les écarts suivants sont à prévoir sur un circuit réel :

- **Résistance série équivalente (ESR) et inductance parasite** du condensateur : l'ESR s'ajoute à $R$ ; l'inductance parasite limite le comportement aux hautes fréquences et modifie les fronts très rapides.
- **Courant de fuite** : modélisé par une résistance $R_p$ en parallèle sur $C$, il fait tendre la tension finale vers $V R_p/(R + R_p)$ avec la constante de temps $(R\,\|\,R_p)\,C$. Négligeable pour un condensateur céramique ou film avec des $R$ de quelques kilo-ohms, il compte pour des $R$ de l'ordre du mégaohm.
- **Variation de la capacité effective** : pour les céramiques de classe 2 (X7R, X5R), la capacité diminue sous tension continue et varie avec la température ; il faut consulter les courbes du fabricant plutôt que la valeur nominale.
- **Impédance de la source et de l'instrument** : une sonde d'oscilloscope charge le circuit (de l'ordre du mégaohm en parallèle avec quelques dizaines de picofarads) et modifie $\tau$ si $R$ est grande.
- **Absorption diélectrique** : après une décharge, certains diélectriques « récupèrent » une partie de la tension ; le modèle à une seule constante de temps ne le décrit pas.

::: note title="Perspectives : validation sur banc"
Ce projet n'a pas encore été confronté à des mesures. L'étape suivante est de monter le circuit ($R = 1\ \text{k}\Omega$ à 1 %, $C = 1\ \mu\text{F}$ au film pour limiter les dérives), de l'exciter avec un générateur 0–5 V à 100 Hz, de relever $v_C(t)$ à l'oscilloscope et de comparer $\tau$ et $t_r$ mesurés aux prévisions de @eq:sol et @eq:tr, en tenant compte des tolérances et de la sonde. Cette page sera complétée avec les résultats.
:::

## Reproductibilité

Toutes les courbes de cette page proviennent de fichiers du dépôt, dans le dossier du projet :

::: specs title="Fichiers du projet"
`sim/simulate.py` | script Python (NumPy) qui génère toutes les données
`data/transient.csv` | échelon, solution exacte et trois schémas (@fig:transient)
`data/stability.csv` | stabilité d'Euler explicite (@fig:stab)
`data/convergence.csv` | erreur maximale selon le pas (@fig:conv)
`data/regimes.csv` | réponse à un créneau pour trois $\tau$ (@fig:regimes)
`data/results.json` | pentes, énergies, dimensionnement, tolérances
`paper.pdf` | note technique LaTeX (section suivante)
:::

Le cœur du calcul tient en quelques lignes : chaque schéma s'écrit $v_{k+1} = a\,v_k + b$.

```python
def step_coeffs(method, h, tau=TAU, target=V):
    x = h / tau
    if method == "euler_expl":
        return 1 - x, x * target
    if method == "euler_impl":
        return 1 / (1 + x), x * target / (1 + x)
    if method == "trap":
        return (1 - x / 2) / (1 + x / 2), x * target / (1 + x / 2)

def integrate(method, h, t_end, v0=0.0):
    n = int(round(t_end / h))
    a, b = step_coeffs(method, h)
    v = [v0]
    for _ in range(n):
        v.append(a * v[-1] + b)
    return v
```

## Note technique en LaTeX

Le même travail est rédigé sous forme de note technique compilée avec XeLaTeX. Le fichier est intégré ci-dessous ; les valeurs numériques y sont lues directement dans `data/results.json`, sans recopie manuelle.

::: pdf src=paper.pdf height=860 caption="Note technique (3 pages), source LaTeX dans le dossier `paper/` du projet."
:::

## Références

1. P. Horowitz, W. Hill, *The Art of Electronics*, 3<sup>e</sup> éd., Cambridge University Press, 2015.
2. E. Hairer, G. Wanner, *Solving Ordinary Differential Equations II : Stiff and Differential-Algebraic Problems*, 2<sup>e</sup> éd., Springer, 1996.
3. L. W. Nagel, *SPICE2 : A Computer Program to Simulate Semiconductor Circuits*, mémo ERL-M520, University of California, Berkeley, 1975.
4. CircuitJS, version JavaScript du simulateur de circuits de P. Falstad, développée avec I. Sharp, <https://lushprojects.com/circuitjs>.
