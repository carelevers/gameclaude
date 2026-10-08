# Handboek voor maintainers

## Eenmalige setup

1. **Labels en backlog**
   ```sh
   node tools/backlog.mjs --labels
   node tools/backlog.mjs --dry-run          # 107 taken, waarvan 87 spelers
   node tools/backlog.mjs --create --ready   # alleen als maintainer: --ready = goedgekeurd
   ```
2. **Maintainers**: zet de GitHub-logins van het kernteam in
   `tasks/maintainers.json`. De worker vertrouwt alleen `task:ready`-labels van hen.
3. **Branch protection op `main`**: verplicht de CI-check `test`, minstens
   één review en "Require review from Code Owners".
4. **GitHub Pages**: Settings → Pages → Source: *GitHub Actions*. Elke merge
   levert een speelbare solo-build op.
5. **Online server** (optioneel): elke Node-host werkt.
   `PORT=8080 node server/server.mjs`, of bouw de `Dockerfile`. Zet hem achter HTTPS.

## Dagelijks werk

- **Triage**: nieuwe Task-issues aanscherpen (scope, acceptatiecriteria) en
  op `task:ready` zetten. Zet `needs:human` op alles waar eerst een
  ontwerpbeslissing nodig is. Agents slaan die over.
- **Review**: begin bij het CI-rapport (simulatie en scope). Content-PR's
  kun je vaak in een minuut beoordelen via de galerij. Spelmodi en kernzones
  vragen een echte code-review.
- **Afwijzen mag**: sluit de PR met uitleg. De claims-workflow zet de taak
  dan automatisch terug in de wachtrij.
- **Metrics**: `npm run metrics` (of `-- --markdown` voor een issue/post).

## Hoe houd je de 101e deelnemer winstgevend?

Coördinatiekosten groeien met integratiewerk en reviewtijd. Stuur daarop:

| Signaal in `npm run metrics` | Ingreep |
| --- | --- |
| reviewcommentaren per merge stijgen | taken scherper formuleren; validatieregels toevoegen voor terugkerende fouten |
| afkeurpercentage > 30% | taken kleiner maken; voorbeelden toevoegen aan AGENTS.md |
| uren tot merge stijgen | meer reviewers voor community-zones; content-PR's sneller doorlaten |
| merged per vrijwilliger daalt | de backlog raakt op of taken overlappen: nieuwe zones openen (bijv. nieuwe contenttypes) |

Elke fout die een reviewer twee keer ziet, hoort een validatieregel of test
te worden. Zo neemt de reviewlast per bijdrage af naarmate het project groeit.
