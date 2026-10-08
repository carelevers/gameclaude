# Darts 100

**Een darts-game voor 100 spelers tegelijk, gebouwd door 100 mensen en hun AI-agents.**

Iedereen gooit elke ronde tegelijk drie darts. In *Royale* ligt elke ronde de
laagste 20% eruit, tot er één over is. Speel online met maximaal 100 vrienden,
of solo tegen 99 bots. Elke bot is een personage dat door een deelnemer van
het project is ontworpen.

De game is ook een **experiment**. Duizenden mensen hebben een Claude Code- of
Codex-abonnement waarvan ze de capaciteit niet volledig gebruiken. Wat
gebeurt er als je die capaciteit bundelt in één gedistribueerde
ontwikkelorganisatie? Deelnemers delen geen accounts of tokens: hun *eigen*
agent pakt op hun *eigen* machine een taak op en levert een pull request in.

> De echte vraag: voegt de 101e deelnemer nog meer productiviteit toe dan coördinatiewerk?
> Dit project is zo ontworpen dat het antwoord "ja" kan zijn, en `npm run metrics` meet het.

## Spelen

```sh
npm start          # http://localhost:8080 (solo én online kamers)
```

Geen `npm install` nodig: het project heeft nul dependencies. Node 20 of nieuwer volstaat.

- **Solo:** kies een modus en speel tegen 99 bots.
- **Online:** maak een kamer, deel de link. Lege plekken worden opgevuld met bots.
- **Galerij:** `/gallery.html` toont alle spelers, borden en modi.
- **Mikken:** beweeg je muis of vinger. Het vizier zwabbert, dus timing telt.
  Loslaten = gooien.

## Meedoen met je AI-agent (5 minuten)

```sh
gh auth login                                   # je eigen GitHub-account
gh repo fork carelevers/gameclaude --clone      # jouw fork + "upstream"-remote
cd gameclaude
npm run worker -- --agent claude --dry-run      # kijk welke taak je zou krijgen
npm run worker -- --agent claude                # of: --agent codex
```

De worker zoekt een goedgekeurde taak die in je tijdsbudget past, claimt hem,
laat jouw agent het werk doen, draait alle tests en opent een pull request.
Zie [CONTRIBUTING.md](CONTRIBUTING.md) voor de details en de spelregels.

## Hoe het in elkaar zit

```
               kernteam: visie, architectuur, review
                              │
           GitHub-issues = takenwachtrij (task:ready)
                              │
     ┌──────────────┬─────────┴────────┬──────────────┐
  vrijwilliger 1  vrijwilliger 2  ...  vrijwilliger 100
  eigen Claude    eigen Codex          eigen agent
     └──────────────┴─────────┬────────┴──────────────┘
                     pull requests (1 taak = 1 bestand)
                              │
       CI: validatie + unit tests + simulatie met 100 bots + scope-check
                              │
              menselijke review → merge → GitHub Pages-build
```

| Map | Inhoud |
| --- | --- |
| `content/players/` | De 99 tegenstanders, één JSON-bestand per personage |
| `content/boards/` | Dartborden (vorm en kleuren) |
| `content/modes/` | Spelmodi: Royale, 501 Race, Around the Clock, ... |
| `game/` | De browsergame (geen build-stap) |
| `server/` | Online kamers voor 100 mensen (Server-Sent Events, geen dependencies) |
| `tools/` | Validatie, simulatie, worker, claims, metrics, backlog |
| `tasks/` | Startbacklog en de lijst met maintainers |
| `docs/` | [Visie](docs/VISIE.md), [architectuur](docs/ARCHITECTUUR.md), [pilot](docs/PILOT.md), [content-specificatie](docs/CONTENT.md), [maintainers](docs/MAINTAINERS.md) |

## Commando's

| | |
| --- | --- |
| `npm test` | alles wat CI draait |
| `npm run simulate -- --runs 40` | balansrapport: 100 bots, alle modi en borden |
| `npm run build` | statische versie in `dist/` (solo) |
| `npm run worker` | leen je AI-capaciteit uit aan het project |
| `npm run metrics` | geaccepteerde PR's per agent-uur, afkeur%, reviewlast per week |
| `node tools/backlog.mjs` | toon of maak de startbacklog (107 taken) |

## Licentie

Code: MIT. Content (spelers, borden, teksten): CC BY 4.0. Zie [LICENSE](LICENSE).
