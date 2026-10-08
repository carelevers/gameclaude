# Meedoen

Er zijn twee manieren: je AI-agent laten werken (aanbevolen), of zelf iets maken.

## A. Je ongebruikte AI-capaciteit uitlenen

Je hebt nodig: Node 20+, de [GitHub CLI](https://cli.github.com) (`gh`) en
een agent-CLI: [Claude Code](https://claude.com/claude-code) (`claude`) of
[Codex](https://github.com/openai/codex) (`codex`).

```sh
gh auth login
gh repo fork carelevers/gameclaude --clone
cd gameclaude
npm run worker -- --agent claude --dry-run   # bekijk de taak en de prompt
npm run worker -- --agent claude             # doe één taak
npm run worker -- --agent codex --tasks 3 --minutes 60   # tot 3 taken, ook grotere
```

**Wat de worker doet**

1. Zoekt een open issue met `task:ready` dat in je budget past
   (`size:s` ≈ 30 min, `size:m` ≈ 60 min; `--minutes` bepaalt je budget).
2. Controleert dat een maintainer de taak heeft goedgekeurd.
3. Claimt de taak met een commentaar en maakt een branch.
4. Start jouw agent met de taakbeschrijving en [AGENTS.md](AGENTS.md).
5. Draait `npm test` en de scope-check. Faalt iets, dan krijgt de agent één herkansing.
6. Commit, pusht naar je fork en opent een pull request.
   Lukt het niet, dan geeft hij de taak netjes vrij.

**Wat je zelf in de hand houdt**

- Je gebruikt je eigen abonnement en account. De worker ziet geen
  inloggegevens; hij roept alleen `gh`, `git` en je agent aan.
- Welke commando's de agent mag uitvoeren, staat in `tools/agents.json`.
  Overschrijf dat lokaal in `.agent-worker.json` (staat in `.gitignore`), bijvoorbeeld:

  ```json
  { "claude": { "command": "claude", "args": ["-p", "{prompt}", "--permission-mode", "default"] } }
  ```

- Kijk gerust mee en stop met Ctrl+C. Een claim zonder PR vervalt na 3 uur vanzelf.

## B. Zelf iets maken

Pak een issue met `task:ready`, zet een commentaar dat je het oppakt, en volg
dezelfde regels als de agents: blijf binnen de scope en zorg dat `npm test`
slaagt. Het makkelijkste begin is een speler ontwerpen in `content/players/`.
Bekijk het resultaat met `npm start` en open `/gallery.html`.

## Regels voor elke bijdrage

- **Eén taak = één PR = bij voorkeur één nieuw bestand.**
- Origineel werk: geen echte personen, merken of bestaande personages.
- Vriendelijke toon (zie [docs/VISIE.md](docs/VISIE.md)).
- Door bij te dragen geef je je werk vrij onder de projectlicenties: MIT
  voor code, CC BY 4.0 voor content. Door AI gegenereerde bijdragen zijn
  welkom; jij bent verantwoordelijk voor wat je instuurt.

## Wat reviewers controleren

1. Past het bij de visie: toon, stijl en balans?
2. Ziet het er goed uit in de galerij, en speelt het lekker?
3. Bij spelmodi: is de code leesbaar en doet hij wat de taak vraagt?
   Validatie en simulatie vangen veel, maar geen saaie regels.

## Een taak voorstellen

Open een issue met het formulier **Task**. Een maintainer kijkt ernaar, scherpt
het aan en zet het op `task:ready`. Pas dan pakken agents het op.
