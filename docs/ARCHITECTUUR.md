# Architectuur

## Ontwerpprincipe: bijdragen mogen elkaar niet raken

Bij 100 gelijktijdige bijdragers is integratie de bottleneck, niet het aantal
tokens. Daarom is de code verdeeld in **zones** (`tools/lib/zones.mjs`):

| Zone | Bestanden | Eigenaar | Waarom zo |
| --- | --- | --- | --- |
| players | `content/players/*.json` | community | 1 bestand per personage: nul merge-conflicten |
| boards | `content/boards/*.json` | community | data, volledig gevalideerd |
| modes | `content/modes/*.js` | community, extra review | code, maar achter een vast contract |
| tests, docs | `test/`, `docs/` | community | altijd welkom |
| core, tooling | `game/`, `server/`, `tools/`, `.github/` | kernteam | klein, stabiel, CODEOWNERS |

Een nieuwe bijdrage is bijna altijd **een nieuw bestand**. Er is geen centraal
register dat iedereen moet aanpassen; de loader leest de mappen zelf. Zo
kunnen 100 agents tegelijk werken zonder elkaars werk te breken.

## Contracten in plaats van afspraken

Een agent hoeft de hele game niet te begrijpen, alleen het contract van zijn zone:

- **Content-schema** (`tools/lib/validate-content.mjs`): strikte velden,
  balansbudget, palet, verwijzingen. Foutmeldingen zeggen wat er mis is en hoe
  het moet. Een agent kan zichzelf corrigeren.
- **Mode-contract** (`game/core/modes.js`): een handvol pure functies.
  Determinisme is verplicht (alle toeval via `ctx.rng`), zodat CI elke modus
  reproduceerbaar kan afspelen.
- **Simulatie** (`tools/simulate.mjs`): speelt elke modus op elk bord met 100
  bots. Vangt crashes, spellen die niet eindigen, kapotte standen en
  niet-deterministisch gedrag. Rapporteert ook of vaardigheid ertoe doet.

"De build is groen" betekent hier dus meer dan "het compileert": het spel is
honderden keren gespeeld.

## Eén engine, drie afnemers

```
game/core/  (pure logica, geen DOM, geen I/O)
  board.js      geometrie en scoren van een dart
  throw.js      gooimodel: mikpunt + normaalverdeelde afwijking
  match.js      een wedstrijd: simultane rondes van 3 darts
  lineup.js     veld van 100: mensen, community-spelers, opvullers
  snapshot.js   wat één speler te zien krijgt

  ├── game/ui/        browser: solo (LocalSession) en online (OnlineSession)
  ├── server/         online kamers: autoritatieve Match per kamer
  └── tools/          simulatie en tests in Node
```

## Online spelen

`server/server.mjs` is een enkel Node-bestand zonder dependencies:

- `POST /api/rooms`, `POST /api/rooms/:code/join`, `.../start`, `.../throw`
- `GET /api/rooms/:code/events`: Server-Sent Events met een persoonlijke snapshot
- Een ronde sluit zodra alle verbonden mensen gegooid hebben, of na
  `ROUND_SECONDS` (standaard 30). Wie niet gooit, gooit drie keer mis.
- De server scoort de landingspunten zelf. Het mikken (het zwabberende vizier)
  gebeurt in de browser; voor een vriendenspel is dat voldoende.

## Het takenproces

1. Een maintainer zet een issue (formulier `task.yml`) op `task:ready`. Dat
   label is de vertrouwensgrens: de worker accepteert alleen taken waarbij het
   label gezet is door iemand uit `tasks/maintainers.json` op `main`.
2. `npm run worker` claimt met een commentaar. Het eerste claim-commentaar na
   de laatste vrijgave wint, dus twee workers tegelijk is geen probleem.
3. `.github/workflows/claims.yml` werkt de labels bij (vrijwilligers hebben
   meestal geen labelrechten) en geeft claims zonder PR na 3 uur vrij.
4. De agent werkt binnen de scope van de taak. De worker controleert
   `npm test` en de scope voordat er een PR komt; de agent krijgt één
   herkansing.
5. CI herhaalt alle checks en zet een simulatie- en scoperapport in de PR.
6. Een mens reviewt (CODEOWNERS voor kernzones) en merget.
7. Elke merge naar `main` levert direct een speelbare build op GitHub Pages.

## Beveiliging

- Geen gedeelde accounts of tokens. Iedereen gebruikt zijn eigen `gh` en agent-CLI.
- Issue-tekst is input voor agents. Daarom is alleen door maintainers
  goedgekeurde tekst geldig, staat in de prompt dat de taak een specificatie
  is en geen vrijbrief, en mag de Claude-agent standaard alleen bestanden
  bewerken en de testcommando's draaien (`tools/agents.json`).
- Spelmodi worden statisch gecontroleerd (geen imports, I/O, klok of
  `Math.random`), maar dat is geen sandbox. Menselijke review van elke
  modus blijft verplicht.
- `pull_request_target`-workflows checken nooit PR-code uit.
