# 01 — Goal: Ljust premium-omtag av EDGE by Tofi

**Datum:** 2026-06-26
**Typ:** Autonom byggorder för Claude Code — körs via /goal.
**Vad detta är:** Den enda ingångspunkten för körningen. Läs filen först, bygg punkt för punkt, committa och pusha så Cloudflare deployar.

---

## Utgångsläge — var projektet står

- Statisk sajt (ren HTML/CSS/JS, **inga byggsteg**) i repo-roten. Repo: `ZivarMahmod/Fris-ren`.
- Deploy: **Cloudflare Pages**, auto från GitHub `main`. Output-katalog = roten, inget byggkommando (statisk site).
- Filer: `index.html`, `css/style.css`, `js/main.js`, `assets/` (SVG-platshållare för bilder).
- Nuläget är ett ljust "cream"-tema. Grunden är bra (typsystem, tillgänglighet, responsivt) men känns lite mall-/AI-aktig. Vi gör ett **ljust premium-omtag** med EN mässing-accent och en redaktionell tjänstmeny.
- Alla bokningar går till Bokadirekt: `https://www.bokadirekt.se/places/edge-by-tofi-136651` (redan kopplat via `[data-boka]` + `BOKA_URL` i `js/main.js` — rör ej).

## Uppdraget

Bygg om **utseendet** enligt spec nedan: ljust, varmt, premium, med mässing som enda accent och en redaktionell prismeny utan numrering. Behåll all struktur, fonterna (Tenor Sans + Cormorant Garamond) och all funktion (sticky header, hero-bildspel, mobilmeny, scroll-reveal). En commit per punkt, pusha till `main`, verifiera live till slut.

## Autonomi-regler

- Du fattar alla tekniska val själv — fråga aldrig droppvis.
- En commit per punkt (F1…F9); verifiera lokalt + pusha innan nästa.
- Allt via kod — ingen manuell dashboard.
- **Statisk site, inget byggsteg.** Verifiera varje punkt genom att serva lokalt (`python -m http.server`) och kontrollera visuellt + att konsolen är ren (inga JS-fel).
- Genuint mänskliga steg (husnummer, riktiga foton, om-text) är batchade sist och **blockerar aldrig** — använd angivna platshållare.
- Rör inte bokningsflödet eller Bokadirekt-URL:en.

## Beslut som redan är fattade — stanna inte för dessa

- **Ljust tema, INTE mörkt.** Varmt off-white papper, aldrig rent vitt.
- **EN accent: mässing/brass.** Solid `--brass: #A8772E`; accenttext på papper `--brass-ink: #8A6520`.
- **Behåll hero-bildspelet** (3 slides, autorotation, pilar, dots, roterande rubrik) — kunden vill ha det. Bara putsa.
- **Behåll tjänsten "Just Tighten It Up – 199 kr".** "Like Da Boss" (finns på Bokadirekt) ska INTE in.
- **Tjänstelistan blir en redaktionell meny UTAN 01/02-numrering**, grupperad i kategorier.
- **"Om salongen": texten blir en tydlig PLACEHOLDER** (kunden fyller i). Ta bort nuvarande generiska stycken.
- **Ta bort** marken "100% hantverk" och footer-raden "Designad med omsorg.".
- **Betyg: 5,0 och 12 betyg** (inte 11), med länk till Bokadirekt.
- **Öppettider (bekräftade på Bokadirekt):** Mån–Fre 10:00–18:00, Lör 11:00–17:00, Sön stängt.
- **Adress:** "Folkungaallén 1A, 582 41 Linköping" (komplett, bekräftad av Zivar).
- **Avslutande CTA-sektion och footer ska vara LJUSA** — inte de gamla mörka banden. Enda mörka ytan kvar är hero-bilderna.

## Palett & tokens — kanon, använd exakt

Lägg i `:root` (ersätt/utöka cream-paletten, behåll fonter, `--step-*`, layout- och motion-tokens):

```
--paper:      #F4F1EA;   /* sidans bas, varmt off-white */
--paper-2:    #EEEADF;   /* alternerande sektion / kort / CTA / footer */
--ink:        #1A1714;   /* primär text + rubriker */
--ink-soft:   #5A5247;   /* brödtext / sekundär */
--muted:      #6B645A;   /* små etiketter, beskrivningar */
--brass:      #A8772E;   /* solid accent: knappar, fyllningar */
--brass-ink:  #8A6520;   /* accenttext på papper: ögonbryn, grupprubriker, länkar, hover */
--brass-line: #C9A45E;   /* dekorativ linje / hover-leader */
--hair:       #DDD6C8;   /* sektionslinjer */
--hair-soft:  #E6E0D2;   /* radlinjer i menyn */
--leader:     #C7BFAE;   /* prickad leader-linje */
--on-brass:   #F8F4EC;   /* text på mässing */
```

Kontrast (ska hålla AA): ink/paper ≈ 13:1, ink-soft ≈ 8:1, muted ≈ 5,5:1, brass-ink/paper ≈ 5:1, on-brass/brass ≈ 4,6:1.

---

## F1 — Palett, tokens & globala ytor

**Mål:** hela sidan blir ljus, varm och premium med mässing-accent.

**Krav/Bygg:**
- Lägg in token-värdena ovan i `:root`. Behåll fonter och `--step`-skalan.
- `body`: `background: var(--paper); color: var(--ink);`.
- Sektionsbakgrunder: hero behålls (mörka bild-band, se F2). `section-services`, `section-about`, `section-plats`, `section-cta`, `footer` → ljusa, vä).växla `--paper` / `--paper-2` för rytm Inga mörka band kvar utom hero.
- Alla hairlines (gamla `rgba(42,31,24,…)`) → `var(--hair)` / `var(--hair-soft)`.
- `.site-header.is-scrolled` → ljus pappersbakgrund `rgba(244,241,234,0.9)` + blur, border `var(--hair)`.
- Knappar: `.btn-primary { background: var(--brass); color: var(--on-brass); }`, hover `background: var(--brass-ink);`.
- `::selection` → brass.
- Kartfilter: en ljus, dämpad look (t.ex. `grayscale(.2) sepia(.08) contrast(.98)`) — INTE den mörka inverteringen.

**Klar när:**
- [ ] `:root` innehåller alla tokens ovan med exakta värden.
- [ ] `body`-bakgrund är `var(--paper)`; ingen sektion utom hero har mörk bakgrund.
- [ ] Alla CTA-knappar är mässingsfärgade, hover → brass-ink.
- [ ] Ingen text understiger 4.5:1 mot sin bakgrund.
- [ ] Sidan renderar utan fel i konsolen.

## F2 — Hero (behåll bildspel, putsa)

**Mål:** starkare, mer redaktionell hero — utan att röra funktionen.

**Krav/Bygg:**
- Behåll 3 slides + autorotation + pilar/dots + roterande rubrik (`js/main.js` orört).
- Accenter gold → brass (`.hero-eyebrow` m.fl.). Säkerställ kontrast mot de mörka bilderna (ljus brass eller cream).
- Behåll vänsterställd, asymmetrisk komposition; stor dominerande display-rubrik (Tenor). Behåll veil/overlay så texten är läsbar.

**Klar när:**
- [ ] Bildspelet fungerar (auto + pilar + dots + rubrikbyte) som tidigare.
- [ ] Hero-accenter använder brass, inte gold.
- [ ] Rubriken är vänsterställd och dominerande; text läsbar mot bild.

## F3 — Tjänster: redaktionell meny utan numrering (HUVUDPUNKT)

**Mål:** ersätt den numrerade listan med en grupperad, redaktionell prismeny.

**Krav/Bygg:**
- Ta bort `.service-num` (01–09) helt.
- Gruppera i fyra kategorier med diskreta rubriker: **Klippning & skägg**, **Klippning**, **Skägg**, **Barn & ungdom**.
- Varje rad: tjänstnamn (Tenor, versal) vänster, prickad leader-linje, pris höger; kort beskrivning (Cormorant kursiv, muted) under namnet.
- Signatur-tag (Cormorant kursiv, brass) på "with EDGE"-raderna (549 och 299).
- Behåll alla 9 tjänster inkl. **Just Tighten It Up – 199 kr**.
- EN signatur-mikrorörelse: rad-hover → namn blir brass + leader får brass-ton + liten `padding-left`-förskjutning. Respektera `prefers-reduced-motion`.

**Kanonisk CSS:**
```
.menu-group { margin-top: clamp(2rem, 4vw, 3rem); }
.menu-group:first-of-type { margin-top: 0; }
.menu-group-title { font-family: var(--font-display); font-size: .72rem; letter-spacing: .3em;
  text-transform: uppercase; color: var(--brass-ink); padding-bottom: .7rem; border-bottom: 1px solid var(--hair); }
.menu-item { padding: clamp(.9rem, 2vw, 1.1rem) 0; border-bottom: 1px solid var(--hair-soft);
  transition: padding-left .25s var(--ease); }
.menu-item:hover { padding-left: .4rem; }
.menu-row { display: flex; align-items: baseline; gap: .6rem; }
.menu-name { font-family: var(--font-display); font-size: clamp(1rem, 2.5vw, 1.15rem);
  letter-spacing: .03em; text-transform: uppercase; color: var(--ink); transition: color .25s var(--ease); }
.menu-item:hover .menu-name { color: var(--brass-ink); }
.menu-tag { font-family: var(--font-body); font-style: italic; font-size: .8em; text-transform: none;
  letter-spacing: 0; color: var(--brass-ink); }
.menu-leader { flex: 1; border-bottom: 1px dotted var(--leader); transform: translateY(-.3em);
  transition: border-color .25s var(--ease); }
.menu-item:hover .menu-leader { border-color: var(--brass-line); }
.menu-price { font-family: var(--font-display); font-size: clamp(.95rem, 2vw, 1.1rem);
  letter-spacing: .02em; color: var(--ink); white-space: nowrap; }
.menu-desc { font-family: var(--font-body); font-style: italic; font-size: var(--step-0);
  color: var(--muted); margin-top: .25rem; max-width: 46ch; }
```

**Kanoniskt innehåll (markup-mönster per rad — upprepa för alla 9):**
```
<div class="menu-group">
  <p class="menu-group-title">Klippning &amp; skägg</p>
  <div class="menu-item">
    <div class="menu-row">
      <span class="menu-name">Make Me Look Expensive with EDGE</span>
      <span class="menu-tag">signatur</span>
      <span class="menu-leader"></span>
      <span class="menu-price">549 kr</span>
    </div>
    <p class="menu-desc">Klippning, skägg, varmt &amp; kallt omslag, noggrann rakning.</p>
  </div>
  ...
</div>
```

Fullständig lista, grupperad:

**Klippning & skägg**
- Make Me Look Expensive with EDGE — 549 kr — "Klippning, skägg, varmt & kallt omslag, noggrann rakning." *(signatur)*
- Make Me Look Expensive — 499 kr — "Herrklippning & skäggtrimning, anpassad efter dig."

**Klippning**
- As Usual — 349 kr — "Herrklippning efter stil, hårtyp och huvudform."
- No Clippers Today — 399 kr — "Saxklippning, formad helt för hand."
- Just Tighten It Up — 199 kr — "Finjustering med rena linjer. Skinfade ingår ej."

**Skägg**
- Handle The Beard with EDGE — 299 kr — "Skäggtrimning, varmt omslag och rakning." *(signatur)*
- Handle the Beard — 249 kr — "Skäggtrimning efter din ansiktsform."

**Barn & ungdom**
- Cut It Like the Big Guys — 299 kr — "Klippning för ungdom, 10–15 år."
- Like Dad, Please — 249 kr — "Klippning för barn, 0–9 år."

Behåll en avslutande rad + Boka-knapp (`.btn-primary`) under menyn.

**Klar när:**
- [ ] Ingen "01/02"-numrering finns kvar i tjänstesektionen.
- [ ] Tjänsterna är grupperade i de fyra kategorierna ovan.
- [ ] Alla 9 tjänster finns med, inkl. "Just Tighten It Up – 199 kr"; "Like Da Boss" finns INTE.
- [ ] Varje rad har namn + prickad leader + pris + beskrivning.
- [ ] Hover ändrar namnfärg till brass (mikrorörelse) och respekterar reduced-motion.

## F4 — Om salongen: placeholder + städa marks

**Mål:** gör om-texten till en tydlig platshållare, ta bort fejk-statistik.

**Krav/Bygg:**
- Ersätt de två styckena med en tydligt markerad platshållare:
  ```
  <!-- OM-TEXT: fylls i av kund. Ersätt stycket nedan. -->
  <p class="about-paragraph">[Här kommer en kort text om EDGE by Tofi — fylls i av salongen.]</p>
  ```
- `about-marks`: ta bort "100% hantverk". Behåll "5,0★ snittbetyg" och ändra "11 omdömen" → "12 betyg". Gör betyg-marken till en länk till Bokadirekt-sidan.
- Behåll bild-platshållaren (gradient) tills riktigt foto finns.

**Klar när:**
- [ ] Om-styckena är ersatta med en markerad placeholder (+ HTML-kommentar).
- [ ] "100% hantverk" är borttagen.
- [ ] Marks visar 5,0★ och "12 betyg"; betyg länkar till Bokadirekt.

## F5 — Plats & öppettider

**Mål:** korrekt, ren plats-sektion.

**Krav/Bygg:**
- Öppettider exakt: Mån–Fre 10:00–18:00, Lör 11:00–17:00, Sön stängt (verifiera mot nuvarande, troligen redan rätt).
- Adress: **"Folkungaallén 1A, 582 41 Linköping"** — visa komplett. Uppdatera även den inbäddade kartan så markören pekar på Folkungaallén 1A (geocoda; om svårt, behåll nuvarande och flagga).
- Behåll karta + Instagram. Kartan med ljust/dämpat filter (F1).

**Klar när:**
- [ ] Öppettiderna är exakt enligt ovan.
- [ ] Adressen visas komplett: "Folkungaallén 1A, 582 41 Linköping".
- [ ] Karta och Instagram-länk fungerar.

## F6 — Avslutande CTA (ljus)

**Mål:** gör om det mörka CTA-bandet till ljust.

**Krav/Bygg:**
- `.section-cta` → ljus (`var(--paper-2)`), ta bort de mörka/radial-gradient-effekterna; accent i brass.
- Rubrik "Redo för en ny stil?" kvar; `em` i brass-ink. Boka-knapp = `.btn-primary`.

**Klar när:**
- [ ] CTA-sektionen är ljus, ingen mörk bakgrund.
- [ ] Knappen är brass och leder till Bokadirekt.

## F7 — Footer (ljus, städa)

**Mål:** ljus, ren footer utan "gjord av"-rad.

**Krav/Bygg:**
- Footer → ljus (`var(--paper-2)`), ink-text, hairline-topp; ta bort mörka `#0F0C09`.
- Ta bort raden "Designad med omsorg." (`.footer-fineprint`).
- Behåll brand, Plats, Kontakt (Instagram), Boka. (Telefon: parkerad uppföljning.)

**Klar när:**
- [ ] Footer är ljus med läsbar text (≥4.5:1).
- [ ] "Designad med omsorg." finns inte kvar.

## F8 — Topbar (behåll, ljus)

**Mål:** behåll topbaren, gör den ljus och on-brand.

**Krav/Bygg:**
- `.topline` → ljus (papper eller svag brass-ton), brass/ink-text, behåll liten versal stil. Behåll bokningsbudskap (t.ex. "Boka enkelt online" eller "Centralt i Linköping · Boka online").

**Klar när:**
- [ ] Topbaren är kvar, ljus, läsbar, on-brand.

## F9 — Städ & konsekvens

**Mål:** ta bort spår av fel namn/mall.

**Krav/Bygg:**
- Byt stray-namnet "Tofifi Cut and Trim" i kommentarer i `css/style.css` och `js/main.js` → "EDGE by Tofi".
- Säkerställ att alla `[data-boka]`-länkar går till Bokadirekt (oförändrat).
- `prefers-reduced-motion` respekteras (oförändrat).

**Klar när:**
- [ ] Inga "Tofifi"-referenser kvar i koden.
- [ ] Alla boka-knappar går till Bokadirekt.
- [ ] Reduced-motion fungerar (ingen rörelse vid `reduce`).

---

## Commit, push & deploy

- En commit per punkt (F1…F9), tydliga meddelanden (t.ex. `F3: redaktionell tjänstmeny utan numrering`).
- Efter sista punkten: push till `main`. Cloudflare Pages deployar automatiskt (output = roten, inget byggkommando).
- **Verifiera deployen LIVE (pushat ≠ deployat):** öppna live-URL:en (CF Pages — troligen `https://<projekt>.pages.dev` eller kundens domän; bekräfta i CF-dashboarden) och kontrollera att ändringarna syns. Om bygget failar tyst — åtgärda och pusha igen.

## När du är klar

Rapportera: vilka punkter som committats (med commit-hash), att pushen gått live, live-URL:en, samt eventuella avvikelser. Lista det parkerade nedan.

## Batchade uppföljningar — kräver människa, blockerar inte bygget

- **Riktiga foton** (hero + om) → ersätt SVG-platshållarna.
- **Om-text** från kund → ersätt placeholdern i F4.
- **Telefonnummer** (Bokadirekt maskerar de två sista siffrorna) → ev. i footer/plats.
- Beslutat: "Like Da Boss" tas INTE in; "Just Tighten It Up" behålls.

## Versionshistorik

| Version | Datum | Ändring |
|---|---|---|
| 1.0 | 2026-06-26 | Första brief — ljust Brass-omtag av hela sajten. |
