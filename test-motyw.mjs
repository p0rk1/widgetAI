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

console.log(`\n---\nzdane: ${zdane}, oblane: ${oblane}`);
process.exit(oblane ? 1 : 0);
