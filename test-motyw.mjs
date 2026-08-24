// test-motyw.mjs — motyw i treść interfejsu jako pola klienta.
//
//   node test-motyw.mjs
//
// Pilnuje trzech rzeczy, z których każda była kiedyś zepsuta albo mogła być:
//  1. żaden szablon nie wychodzi do przeglądarki z surowym `{{placeholderem}}`,
//  2. w interfejsie jednego klienta nie ma słownictwa drugiego — do 24.08.2026
//     kancelaria dostawała kafel „Odbiór zbrojenia" i kartę „Wypadki (BHP)",
//  3. motywy obu klientów naprawdę się różnią — inaczej „przełączenie na
//     prezentacji" pokazuje ten sam produkt z inną nazwą.
//
// Warstwa jest czysto deterministyczna, więc testuje się ją bez sieci i modelu.

import { renderHtml, motywCss, kafleHtml, eskalacjeJson } from "./worker.js";
import { KLIENCI } from "./klienci.js";
import { APP_INTERNAL_HTML } from "./app-internal.js";
import { PANEL_INTERNAL_HTML } from "./panel-internal.js";
import { PANEL_HTML } from "./panel.js";

let zdane = 0, oblane = 0;
function sprawdz(opis, warunek, szczegol = "") {
  if (warunek) { zdane++; return; }
  oblane++;
  console.log(`  OBLANE: ${opis}${szczegol ? "\n          " + szczegol : ""}`);
}

const SZABLONY = [
  ["app-internal", APP_INTERNAL_HTML, "pracownik"],
  ["panel-internal", PANEL_INTERNAL_HTML, "wlasciciel"],
  ["panel", PANEL_HTML, "wlasciciel"],
];

// Słownictwo, które nie ma prawa pojawić się u drugiego klienta.
const OBCE = {
  budmax: [/kancelari/i, /adwokat/i, /apelacj/i, /procesow/i],
  kancelaria: [/(?<![a-ząćęłńóśźż])budow/i, /rusztowan/i, /zbrojeni/i, /brygadzist/i, /\bBHP\b/, /delegacj/i],
};

console.log("\n=== 1. Szablony bez surowych placeholderów ===");
for (const klient of Object.values(KLIENCI)) {
  for (const [nazwa, szablon, rola] of SZABLONY) {
    const html = renderHtml(szablon, klient, {}, rola);
    const zostale = [...new Set(html.match(/\{\{\w+\}\}/g) || [])];
    sprawdz(`${klient.id}/${nazwa}: brak nieuzupełnionych pól`, zostale.length === 0, zostale.join(" "));
  }
}

console.log("=== 2. Brak słownictwa cudzej branży ===");
for (const klient of Object.values(KLIENCI)) {
  for (const [nazwa, szablon, rola] of SZABLONY) {
    const html = renderHtml(szablon, klient, {}, rola);
    // Sam adres fontów i nazwy zmiennych CSS nie są treścią — patrzymy na ciało.
    const cialo = html.slice(html.indexOf("<body"));
    for (const wzor of OBCE[klient.id]) {
      sprawdz(`${klient.id}/${nazwa}: brak ${wzor}`, !wzor.test(cialo),
        (cialo.match(wzor) || []).join(""));
    }
  }
}

console.log("=== 3. Motywy klientów są różne ===");
const motywy = Object.values(KLIENCI).map((k) => motywCss(k));
sprawdz("dwa motywy nie są identyczne", new Set(motywy).size === motywy.length);
for (const klient of Object.values(KLIENCI)) {
  const css = motywCss(klient);
  for (const zmienna of ["--void", "--chalk", "--hi", "--font-naglowek", "--promien", "--siatka-krycie"]) {
    sprawdz(`${klient.id}: motyw definiuje ${zmienna}`, css.includes(zmienna + ":"));
  }
  sprawdz(`${klient.id}: brak pustej wartości w motywie`, !/--[\w-]+:\s*(;|\})/.test(css), css);
}

console.log("=== 4. Kafle szybkiego startu ===");
for (const klient of Object.values(KLIENCI)) {
  const html = kafleHtml(klient);
  const ile = (html.match(/<button/g) || []).length;
  sprawdz(`${klient.id}: kafle są`, ile === klient.ui.kafle.length, `${ile} z ${klient.ui.kafle.length}`);
  sprawdz(`${klient.id}: kafle bez emoji`, !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(html));
  sprawdz(`${klient.id}: numeracja monospace`, /class="chip-nr">\/ 01</.test(html));
  sprawdz(`${klient.id}: cudzysłów w pytaniu jest ekranowany`, !/data-q="[^"]*"[^>]*"/.test(html));
}

console.log("=== 5. Kategorie eskalacji pokrywają słownik ===");
for (const klient of Object.values(KLIENCI)) {
  const zJson = JSON.parse(eskalacjeJson(klient));
  const zeSlownika = (klient.eskalacja?.kategorie || []).map((c) => c.id).sort();
  sprawdz(`${klient.id}: te same klucze`, JSON.stringify(Object.keys(zJson).sort()) === JSON.stringify(zeSlownika),
    `${Object.keys(zJson).sort()} vs ${zeSlownika}`);
  // Pilność MUSI pochodzić ze słownika, nie z ręcznego przepisania.
  for (const kat of klient.eskalacja?.kategorie || []) {
    sprawdz(`${klient.id}/${kat.id}: pilność zgodna ze słownikiem`, zJson[kat.id].pilne === !!kat.pilne);
  }
}

console.log("=== 6. Przełącznik demo mówi o branży, nie o nazwie firmy ===");
for (const klient of Object.values(KLIENCI)) {
  sprawdz(`${klient.id}: ma etykietę przełącznika`, typeof klient.ui.etykietaPrzelacznika === "string"
    && klient.ui.etykietaPrzelacznika.length > 0);
  const html = renderHtml(APP_INTERNAL_HTML, klient, { DEMO: "1" }, "pracownik");
  const inni = Object.values(KLIENCI).filter((k) => k.id !== klient.id);
  for (const inny of inni) {
    sprawdz(`${klient.id}: przełącznik prowadzi do ${inny.id}`,
      html.includes(`przełącz na`) && html.includes(inny.ui.etykietaPrzelacznika));
  }
  const bezDemo = renderHtml(APP_INTERNAL_HTML, klient, {}, "pracownik");
  sprawdz(`${klient.id}: bez DEMO paska nie ma w HTML-u`, !bezDemo.includes("przełącz na"));
}

console.log("=== 7. Pasek demo nie kładzie się na treści ===");
for (const klient of Object.values(KLIENCI)) {
  for (const [nazwa, szablon, rola] of SZABLONY) {
    const zDemo = renderHtml(szablon, klient, { DEMO: "1" }, rola);
    const bez = renderHtml(szablon, klient, {}, rola);
    sprawdz(`${klient.id}/${nazwa}: pasek ogłasza swoją wysokość`, /--pasek-demo:\s*\d+px/.test(zDemo));
    sprawdz(`${klient.id}/${nazwa}: układ rezerwuje na niego miejsce`,
      /body\{padding-bottom:var\(--pasek-demo\)\}/.test(zDemo));
    sprawdz(`${klient.id}/${nazwa}: bez DEMO wysokość zostaje zerowa`,
      /--pasek-demo:0px/.test(bez) && !/--pasek-demo:\s*[1-9]/.test(bez));
    sprawdz(`${klient.id}/${nazwa}: pasek nie ma własnych kolorów`, !/background:rgba\(0,0,0/.test(zDemo));
  }
}
// Dok wpisywania jest przyklejony do dołu, więc musi trzymać się NAD paskiem.
sprawdz("app-internal: dok wpisywania stoi nad paskiem",
  /position:sticky;bottom:var\(--pasek-demo\)/.test(APP_INTERNAL_HTML));

console.log("=== 8. Animacja wypisywania i jej dwa wyjątki ===");
sprawdz("app-internal: animacja istnieje", /async function wypiszOdpowiedz/.test(APP_INTERNAL_HTML));
sprawdz("app-internal: prefers-reduced-motion ją wyłącza",
  /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/.test(APP_INTERNAL_HTML));
sprawdz("app-internal: ramka pilna nie czeka na animację",
  /natychmiast\s*=\s*\(eskalacja && eskalacja\.pilne\)\s*\?\s*1\s*:\s*0/.test(APP_INTERNAL_HTML));
sprawdz("app-internal: ramka wstawiana przed pisaniem",
  APP_INTERNAL_HTML.indexOf("bubble.innerHTML = ramkaEskalacji") <
  APP_INTERNAL_HTML.indexOf("await wypisz(d, linie[i])"));
sprawdz("app-internal: kursor gaśnie przy reduced-motion",
  /@media\(prefers-reduced-motion:reduce\)\{\.pisze::after\{animation:none\}\}/.test(APP_INTERNAL_HTML));

console.log("=== 9. Strażnik szablonów ===");
// Trzeci raz w projekcie: odwrócony apostrof w komentarzu ZAMYKA szablon,
// a `node --check` tego nie widzi, bo czyta plik jako skrypt, nie moduł.
for (const [nazwa, szablon] of SZABLONY) {
  const zle = [...szablon.matchAll(/\/\/[^\n]*/g)].map((m) => m[0]).filter((c) => c.includes("`"));
  sprawdz(`${nazwa}: żaden komentarz w szablonie nie ma odwróconego apostrofu`,
    zle.length === 0, zle.join(" | ").slice(0, 120));
}

console.log("=== 10. Kontrast tekstu wobec RZECZYWISTEGO tła ===");
// Tło ramki eskalacyjnej to nie tło strony: to `color-mix(akcent X%, transparent)`
// położony na powierzchni pod spodem. Liczenie kontrastu wobec tła strony
// przepuściło 24.08.2026 tekst o kontraście 1.14 — praktycznie niewidoczny.
const doRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const jasnosc = (rgb) => {
  const c = rgb.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const kontrast = (a, b) => {
  const [l1, l2] = [jasnosc(doRgb(a)), jasnosc(doRgb(b))];
  return +((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2);
};
// Odpowiednik `color-mix(in srgb, akcent P%, transparent)` na powierzchni `pod`.
const zloz = (akcent, procent, pod) => {
  const [a, p, f] = [doRgb(akcent), doRgb(pod), procent / 100];
  return "#" + a.map((v, i) => Math.round(v * f + p[i] * (1 - f)))
    .map((v) => v.toString(16).padStart(2, "0")).join("");
};

for (const klient of Object.values(KLIENCI)) {
  const k = klient.motyw.kolory;
  const przypadki = [
    // [opis, kolor tekstu, tło rzeczywiste, próg]
    // Ramka pilna ma najwyższy próg na ekranie — to komunikat ratunkowy.
    ["ramka PILNE", k.pilneTekst, zloz(k.danger, 14, k.panel), 7],
    ["ramka PROCEDURA", k.procTekst, zloz(k.warn, 12, k.panel), 4.5],
    ["linia Podstawa:", k.podstawaTekst, k.panel, 4.5],
    ["numer kafla", k.etykietaNr, k.panel, 4.5],
    ["tag eskalacji pilny", k.tagPilnyTekst, zloz(k.danger, 15, k.void), 4.5],
    ["tag eskalacji zwykły", k.tagZwyklyTekst, zloz(k.warn, 12, k.void), 4.5],
    ["tekst na akcencie", k.naAkcencie, k.hi, 4.5],
    ["obwódka ramki pilnej", k.danger, zloz(k.danger, 14, k.panel), 3],
  ];
  for (const [opis, kolor, tlo, prog] of przypadki) {
    const w = kontrast(kolor, tlo);
    sprawdz(`${klient.id}: ${opis} — kontrast ${w} ≥ ${prog}`, w >= prog, `${kolor} na ${tlo}`);
  }
  // Ramka pilna musi być najmocniejsza spośród tekstów na powierzchniach barwnych.
  const pilny = kontrast(k.pilneTekst, zloz(k.danger, 14, k.panel));
  const proc = kontrast(k.procTekst, zloz(k.warn, 12, k.panel));
  sprawdz(`${klient.id}: ramka pilna mocniejsza od proceduralnej`, pilny >= proc, `${pilny} vs ${proc}`);
}

console.log("=== 11. Żadnego koloru poza motywem ===");
// 24.08.2026 dwa kolory tekstu ramek i jeden kolor tekstu przycisku przetrwały
// wyprowadzanie motywu, bo lista podmian była pisana ręcznie. Ten strażnik
// zastępuje listę: w plikach interfejsu nie ma prawa być ŻADNEJ wartości
// barwnej — wszystko przychodzi z `motywCss()`.
const { readFileSync } = await import("node:fs");
for (const f of ["app-internal.js", "panel-internal.js", "panel.js"]) {
  const zrodlo = readFileSync(f, "utf8");
  const hexy = [...zrodlo.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0])
    // #000 w `mask-image` to punkt maski, nie kolor interfejsu.
    .filter((h) => h !== "#000");
  const rgby = [...zrodlo.matchAll(/rgba?\(\s*\d+\s*,/g)].map((m) => m[0]);
  sprawdz(`${f}: brak wpisanych kolorów`, hexy.length === 0 && rgby.length === 0,
    [...hexy, ...rgby].join(" "));
}

console.log(`\n---\nzdane: ${zdane}, oblane: ${oblane}`);
process.exit(oblane ? 1 : 0);
