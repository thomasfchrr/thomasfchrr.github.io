---
title: Alimentation à découpage buck-boost
subtitle: Conversion de tension, choix de composants et contrôle de la boucle
date: 2026-10
status: planifie
kind: Conception de PCB
domain: Puissance
tags: [Alimentation à découpage, Buck-boost, MOSFET, Régulation]
summary: Étude et réalisation d'un convertisseur buck-boost, avec une réflexion sur le contrôle de la boucle de régulation (analogique ou numérique).
order: 3
---

::: note title="Projet planifié"
Cette page décrit l'objectif. Elle sera complétée à mesure que le projet avance : modèle, simulation, réalisation, mesures.
:::

## Objectif

Étudier puis réaliser une alimentation à découpage de type buck-boost : dimensionnement de l'inductance et des condensateurs, choix du transistor et de son pilotage, mesure du rendement et de l'ondulation de sortie.

## Questions à traiter

- Quel modèle moyen décrit le convertisseur, et quelle fonction de transfert en boucle ouverte en résulte ?
- Quel contrôle choisir pour la boucle de régulation : un circuit analogique dédié, ou un microcontrôleur STM32 qui commande le transistor et mesure la tension de sortie ?
- Quelles protections prévoir pour qu'une erreur de commande n'endommage pas l'étage de puissance ?

Ces questions s'appuient sur le projet [Charge et décharge d'un condensateur](project.html?p=rc-charge-decharge), qui pose le vocabulaire du régime transitoire.
