# Visie: Darts 100

## In één zin

Een gezellige, spannende darts-avond waarop honderd mensen tegelijk gooien en
waarop iedereen elke ronde meedoet.

## Pijlers

1. **Iedereen gooit, altijd.** Geen wachten op je beurt. Elke ronde gooien
   alle actieve spelers tegelijk. Daardoor schaalt de game naar 100 spelers.
2. **Vaardigheid telt, geluk ook een beetje.** Een goede speler wint vaker,
   maar een beginner kan een ronde winnen. De simulatie bewaakt dit: de
   winnaar moet gemiddeld duidelijk beter mikken dan het veld.
3. **Een kroeg vol karakters.** De 99 tegenstanders zijn personages met een
   verhaal, ontworpen door de community. Je speelt tegen Oma Jo en Robo-Reinier,
   niet tegen "Bot 37".
4. **Snel te begrijpen.** Mikken, loslaten, klaar. Een potje Royale duurt
   ongeveer twintig rondes.

## Toon

Vriendelijk en een beetje droog, zoals een goede kroeg. Grappen over de
spelers zelf, nooit ten koste van groepen mensen. Geen echte personen, merken
of bestaande personages. Reviewers mogen alles weigeren dat hier niet past.

## Art direction

- Eén vast palet van 16 kleuren (Sweetie 16). Niets daarbuiten.
- Avatars zijn 8x8 pixels met maximaal 6 kleuren: hoofd boven, schouders onder.
- Borden mogen van kleur wisselen, maar dubbel- en triple-ringen moeten
  duidelijk zichtbaar blijven.
- De galerij (`/gallery.html`) is de plek waar reviewers de stijl bewaken.

## Balans

- Spelers: `accuracy + (100 - nerves) / 2 <= 120`. Wie heel zuiver gooit,
  heeft zenuwen. Niemand is perfect.
- Het veld van 100 moet klinken als een echte avond: ongeveer 10 sterren,
  25 sterke spelers, 30 clubspelers en 30 beginners.
- Spelmodi moeten met 1 tot 100 spelers werken en binnen `maxRounds` eindigen.

## Wat we (nog) niet doen

- Geen accounts, ranglijsten of betalingen. Eerst moet het spel leuk zijn.
- Geen vrije chat (moderatie kost meer dan het oplevert); hooguit vaste emoji.
- Geen 3D. De kracht zit in de 100 spelers, niet in de graphics.
