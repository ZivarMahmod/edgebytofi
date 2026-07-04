# 03 — Fix: Stäng publik trigger på rating-Workern

**Datum:** 2026-06-26
**Typ:** Autonom fix-brief för Claude Code — körs via /goal.
**Vad detta är:** Den enda ingångspunkten. Läs filen först.

---

## Utgångsläge

- Morgon-Workern `edgebytofi-rating-cron` (i `worker/rating-cron/`) ligger på en publik `*.workers.dev`-URL och har en **oskyddad** `fetch`-handler med `?run=1` som kör skrapningen direkt. Worker-källan är dessutom publikt läsbar, så URL-mönstret är känt.
- Effekt: vem som helst kan trigga en Bokadirekt-skrapning via din Worker. Inget läcker (KV-id är ingen nyckel), men det ska täppas.

## Beslut som redan är fattade — stanna inte för dessa

- Lös det genom att **ta bort Workerns publika HTTP-yta** med `workers_dev = false`. Då körs Workern **bara på sitt cron-schema**; det finns ingen publik URL kvar att anropa `?run=1` på. Ingen token behövs.
- Cron-schemat (`0 4 * * *`), KV-bindningen och `/api/rating` ska vara **oförändrade**.
- KV fylls ändå: Pages Function self-populerar vid tomt KV, och cronen skriver varje morgon. Manuell provkörning blir lokal-only (`wrangler`), vilket är ok.

## Autonomi-regler

- Alla tekniska val själv; en commit; verifiera + pusha.
- Allt via kod/`wrangler`. Ingen dashboard om det går.

## FX1 — `workers_dev = false` på rating-Workern

**Mål:** Workern saknar publik URL; körs enbart på schema.

**Krav/Bygg:**
- I `worker/rating-cron/wrangler.toml`: lägg `workers_dev = false` (och gärna `preview_urls = false`).
- Behåll `[triggers] crons = ["0 4 * * *"]` och KV-bindningen `RATING_KV`.
- `?run=1`-handlern får vara kvar (nu oåtkomlig publikt) eller tas bort — valfritt.
- `wrangler deploy` av Workern. Commit + pusha `main`.

**Klar när:**
- [ ] `worker/rating-cron/wrangler.toml` innehåller `workers_dev = false`.
- [ ] Efter deploy: Workerns `*.workers.dev`-URL svarar **inte** publikt (verifiera att `…workers.dev/?run=1` ger 404/ingen route).
- [ ] `wrangler deployments` visar att cron `0 4 * * *` finns kvar.
- [ ] `https://www.edgebytofi.se/api/rating` svarar fortfarande 200 med `source:"kv"` och rätt siffror.
- [ ] Morgonpasset skriver fortfarande KV (verifiera via `wrangler` lokalt `--test-scheduled`, eller efter nästa schemalagda körning).

## När du är klar

Rapportera commit-hash, att `workers.dev`-URL:en är stängd, och att `/api/rating` + cron är intakta.

## Versionshistorik

| Version | Datum | Ändring |
|---|---|---|
| 1.0 | 2026-06-26 | Stäng publik workers.dev-URL på rating-Workern (`workers_dev = false`); cron + /api/rating oförändrade. |
