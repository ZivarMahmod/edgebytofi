# 02 — Goal: Live-betyg från Bokadirekt — schemalagt dagligen kl. 06:00

**Datum:** 2026-06-26
**Typ:** Autonom byggorder för Claude Code — körs via /goal.
**Vad detta är:** Den enda ingångspunkten för körningen. Läs filen först.

---

## Utgångsläge — var projektet står

- Sajten (ljust Brass-tema) är live på **www.edgebytofi.se** via Cloudflare Pages (auto från GitHub `main`, output = roten, inget byggkommando). Repo: `ZivarMahmod/Fris-ren`.
- Betyget visas idag **hårdkodat** i "Om salongen": `5,0★` och `12 betyg` (länkat till Bokadirekt). Se `.about-marks` i `index.html`.
- Mål nu: gör siffrorna **live**, uppdaterade via ett **schemalagt pass varje morgon** så de är färska före öppning — utan att rutan någonsin blir tom.

## Uppdraget

En **schemalagd Cloudflare Worker** hämtar betyg + antal från Bokadirekt en gång per dygn på morgonen och skriver dem till **KV**. En **Pages Function** `/api/rating` läser KV och returnerar JSON. Front-end hämtar den och uppdaterar siffrorna progressivt, med dagens hårdkodade tal som fallback.

## Beslut som redan är fattade — stanna inte för dessa

- **Källa: Bokadirekt** (inte Google). Sida: `https://www.bokadirekt.se/places/edge-by-tofi-136651`.
- **Schemalagt dagligen på morgonen** via Cron Trigger (Worker). Cron körs i **UTC** → använd `0 4 * * *` (≈ 06:00 svensk tid: 05:00 vintertid / 06:00 sommartid). Alltid klart före öppning kl. 10:00. Exakt 06:00 året runt går inte pga sommartid — och behövs inte.
- **Lagring i KV** (`RATING_KV`), en liten post `{ rating, count, updated }`. KV free tier räcker (1 skrivning/dygn, läsningar cachade).
- **Fallback:** om hämtning/parsning failar → behåll förra KV-värdet; om KV är tomt → returnera hårdkodat `{ rating: 5.0, count: 12 }`. HTML:ens default får aldrig ge tom ruta.
- Ingen API-nyckel, inget tredjeparts-skript.

## Autonomi-regler

- Du fattar alla tekniska val själv; en commit per punkt; verifiera + pusha.
- Allt via kod / `wrangler` — undvik manuell dashboard. Om KV-bindning till Pages ändå kräver dashboarden → batcha som en kort manuell uppgift sist (exakta steg), blockera inte resten.
- Respektera Bokadirekt: vanlig `User-Agent`, en hämtning per dygn. Det är kundens egen listning.

---

## F1 — KV-namespace + schemalagd Worker (morgonpass)

**Mål:** ett dagligt pass som hämtar betyget och lägger det i KV.

**Krav/Bygg:**
- Skapa KV-namespace `RATING_KV` (`wrangler kv namespace create RATING_KV`).
- Skapa en Worker (egen mapp, t.ex. `worker/rating-cron/`) med `wrangler.toml`:
  - `[triggers] crons = ["0 4 * * *"]`
  - KV-binding `RATING_KV`.
- `scheduled`-handler: `fetch` Bokadirekt-sidan med vanlig User-Agent. Parsa **aggregateRating** ur JSON-LD (`<script type="application/ld+json">` → `ratingValue`, `reviewCount`/`ratingCount`). Saknas JSON-LD → regex-fallback på HTML (`5,0`/`5.0` och `N betyg`).
- Skriv `{ rating:<nummer>, count:<heltal>, updated:<ISO> }` till `RATING_KV` under nyckeln `rating`.
- Felhantering: vid icke-200 eller parsfel → logga och **behåll** förra KV-värdet (skriv inte över med skräp).
- Lägg även en manuell trigger för test (Worker `fetch`-handler som kör samma logik vid GET `?run=1`), så passet kan provköras utan att vänta på kl. 06.

**Klar när:**
- [ ] KV-namespace `RATING_KV` finns och är bundet till Workern.
- [ ] Workern har `crons = ["0 4 * * *"]` i `wrangler.toml`.
- [ ] Manuell provkörning skriver `{rating:5.0, count:12, updated:…}` till KV (verifiera med `wrangler kv key get`).
- [ ] Vid simulerat hämtningsfel skrivs INTE skräp över ett tidigare giltigt värde.

## F2 — Pages Function `/functions/api/rating.js`

**Mål:** endpoint som läser KV och alltid svarar tryggt.

**Krav/Bygg:**
- Skapa `functions/api/rating.js` (mappas till `/api/rating`). Binda `RATING_KV` till Pages-projektet (via `wrangler.toml`/Pages-config; om dashboard krävs → batchad uppgift, se nedan).
- Vid GET: läs `rating` från KV → returnera JSON med kort `Cache-Control` (t.ex. `s-maxage=600`) så besökare träffar edge-cache mellan morgonpassen.
- Om KV är tomt (innan första cron-körningen): gör en **engångshämtning** från Bokadirekt, skriv KV, returnera.
- Om allt failar: returnera `{ rating: 5.0, count: 12, source: "fallback" }`. **Aldrig 500.**

**Klar när:**
- [ ] `GET /api/rating` returnerar giltig JSON (`rating` nummer, `count` heltal).
- [ ] Tomt KV → endpointen self-populerar och svarar ändå.
- [ ] Allt-fel → fallback-JSON, ingen 500.

## F3 — Front-end: progressiv uppdatering + HTML-fallback

**Mål:** visa live-siffrorna utan risk för tom ruta eller layout shift.

**Krav/Bygg:**
- I `index.html`, märk betyg-elementen i `.about-marks` med `data-rating-value` (talet "5,0") och `data-rating-count` (talet i "12 betyg"). Behåll den hårdkodade texten som default.
- I `js/main.js`, ny funktion: `fetch('/api/rating')` i `try/catch`. Vid ok + giltiga siffror → uppdatera elementen. Formatera betyg svenskt (`5,0`) och antal som heltal. Uppdatera bara om värdet skiljer sig.
- Om fetch failar → gör inget, HTML-defaulten står kvar. Inga konsolfel.

**Klar när:**
- [ ] `index.html` har `data-rating-value` + `data-rating-count`, default `5,0` / `12` kvar.
- [ ] Funktionen live → siffrorna kommer från `/api/rating`.
- [ ] Funktionen nere/404 → HTML visar fortfarande `5,0` / `12`, inga konsolfel, ingen layout shift.

## F4 — Deploy, bindningar & verifiering live

**Krav/Bygg:**
- Commit per punkt, pusha `main`. Deploya Workern (`wrangler deploy`) och Pages (auto via push).
- Säkerställ att `RATING_KV` är bundet till **både** Workern och Pages-projektet.
- Efter deploy: provkör morgonpasset manuellt (Worker `?run=1`), verifiera KV, och att `https://www.edgebytofi.se/api/rating` ger rätt siffror; about-rutan visar dem.

**Klar när:**
- [ ] Workern är deployad med cron `0 4 * * *` (synlig i `wrangler deployments`/dashboard).
- [ ] `https://www.edgebytofi.se/api/rating` svarar med giltig JSON.
- [ ] Betyg-rutan på sajten visar siffror från endpointen.
- [ ] Fallback verifierad (KV tomt + källa nere → HTML-default kvar).

## När du är klar

Rapportera commits (hash), Worker-deploy + cron-schema, live-URL till `/api/rating`, och att siffrorna matchar Bokadirekt. Notera om Bokadirekt blockerade serverhämtning (då håller fallbacken sajten hel och vi får överväga Google).

## Batchade uppföljningar — kräver människa, blockerar inte

- **Om KV-bindning till Pages kräver dashboarden:** Pages-projekt → Settings → Functions → KV namespace bindings → lägg `RATING_KV`. (Annars gör Code allt via `wrangler`.) Lämna exakta steg till Zivar om så behövs.
- Om Bokadirekt konsekvent blockerar CF-hämtning → byt källa till Google Places API (nyckel + Place ID). Flagga till Zivar.

## Versionshistorik

| Version | Datum | Ändring |
|---|---|---|
| 1.0 | 2026-06-26 | Live-betyg från Bokadirekt via Pages Function + Cache API, HTML-fallback. |
| 2.0 | 2026-06-26 | Schemalagt morgonpass (Cron Worker `0 4 * * *` ≈ 06:00 svensk tid) + KV-lagring; Pages Function läser KV. Färskt före öppning. |
