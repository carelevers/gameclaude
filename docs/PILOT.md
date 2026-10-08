# Pilot: 100 deelnemers, 4 weken

## Doel

Niet "een complete game in vier weken", maar meten hoeveel bruikbare
functionaliteit een netwerk van vrijwilligers met AI-agents oplevert, en wat
dat aan menselijke coördinatie kost.

## Hypotheses

1. Taken van één bestand met een strikt contract worden in meer dan 70% van de
   gevallen zonder inhoudelijke wijzigingen geaccepteerd.
2. De reviewtijd per geaccepteerde bijdrage daalt van week 1 naar week 4,
   omdat terugkerende fouten validatieregels worden.
3. Het aantal merges per week groeit ongeveer lineair met het aantal actieve
   vrijwilligers, zolang er content-zones met open taken zijn.

## Rollen

| Rol | Aantal | Taak |
| --- | --- | --- |
| Game director | 1 | visie, toon, eindbeslissingen |
| Kernteam | 2-4 | engine, server, tooling, review van code |
| Content-reviewers | 3-6 | review van spelers en borden via de galerij |
| Vrijwilligers | ~100 | `npm run worker` met eigen agent; playtesten |

## Planning

| Week | Focus | Klaar als |
| --- | --- | --- |
| 1: Basis | Kernteam bevriest contracten; 107 starttaken op `task:ready`; eerste 20 vrijwilligers | 20+ spelers gemerged, CI stabiel |
| 2: Parallel | Iedereen doet mee; spelmodi en borden | 99 stoelen ontworpen, 4+ nieuwe modi |
| 3: Content en integratie | Kernfeatures (geluid, vertaling, reacties); playtestavonden met 100 echte mensen online | Een online avond met 100 spelers zonder crash |
| 4: Stabilisatie | Bugs, balans (simulatierapport), release | Versie 1.0 op GitHub Pages en een publieke server |

Elke week een **playtestavond**: één online kamer, zoveel mogelijk deelnemers
tegelijk. Feedback gaat via het formulier *Playtest feedback* en wordt nieuwe taken.

## Wat we meten (`npm run metrics`)

- geaccepteerde PR's per agent-uur, per agent (Claude Code, Codex, ...)
- afkeurpercentage
- mediane agenttijd per taak en mediane tijd tot merge
- reviewcommentaren per merge (menselijke reviewlast)
- per week: actieve vrijwilligers, merges, merges per vrijwilliger en totale reviewlast

De kernvraag staat in de weektabel: stijgen de merges sneller dan de
reviewlast als er meer vrijwilligers bijkomen?

## Stopregels

- Afkeurpercentage boven 50% in een zone: zone pauzeren, taken herschrijven.
- Reviewers structureel meer dan 1 uur per dag kwijt: instroom tijdelijk
  begrenzen door minder taken op `task:ready` te zetten.
