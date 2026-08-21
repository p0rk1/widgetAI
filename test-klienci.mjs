// Test wymiaru KLIENTA: rozpoznanie po hoście, składanie przestrzeni,
// obowiązkowość klienta w warstwach, które bez niego cichłyby po cichu.
//
// Uruchomienie:  node test-klienci.mjs
//
// Po co: przy jednym kliencie każdy z tych błędów jest niewidoczny. Cichy
// wybór klienta, cicha praca bez wzorców branżowych albo cicha eskalacja
// zwracająca null pokażą się dopiero przy drugiej firmie — czyli u kogoś,
// kto zobaczy nie swoją dokumentację albo nie dostanie ramki przy wypadku.

import {
  rozpoznajKlienta, rolaHosta, przestrzenFizyczna,
  wykryjEskalacje, isUnsupportablePromise, buildSystemPrompt, renderHtml,
  PROMPT_PUBLICZNY,
} from "./worker.js";
import { KLIENCI, HOSTY_INDEX } from "./klienci.js";
import { APP_INTERNAL_HTML } from "./app-internal.js";
import { PANEL_HTML } from "./panel.js";
import { PANEL_INTERNAL_HTML } from "./panel-internal.js";

let zdane = 0;
const oblane = [];

function sprawdz(nazwa, wynik, oczekiwane) {
  const ok = wynik === oczekiwane;
  if (ok) zdane++;
  else oblane.push(`${nazwa} — oczekiwano ${oczekiwane}, dostano ${wynik}`);
  console.log(`${ok ? "OK  " : "BŁĄD"} ${nazwa}`);
}

function rzuca(nazwa, fn) {
  let rzucil = false;
  try { fn(); } catch { rzucil = true; }
  sprawdz(nazwa, rzucil, true);
}

const u = (host, sciezka = "/") => new URL(`https://${host}${sciezka}`);
const B = KLIENCI.budmax;

// ---------------------------------------------------------------
// Rozpoznanie klienta i roli po hoście — DOKŁADNE, nie po podciągu
// ---------------------------------------------------------------
console.log("--- host → klient, host → rola ---");

sprawdz("host publiczny → budmax", rozpoznajKlienta(u(B.hosty.publiczny))?.id, "budmax");
sprawdz("host pracowniczy → rola pracownik", rolaHosta(u(B.hosty.pracownik)), "pracownik");
sprawdz("host właściciela → rola wlasciciel", rolaHosta(u(B.hosty.wlasciciel)), "wlasciciel");
sprawdz("stary workers.dev nadal działa", rozpoznajKlienta(u("knowbase-budmax.rezi7608.workers.dev"))?.id, "budmax");

// Podciąg nie może wystarczyć — to jest ten sam błąd, który 21.08.2026 po cichu
// odebrał rolę obu hostom przy zmianie ich nazw.
sprawdz("podszywający się podciąg nie dostaje klienta", rozpoznajKlienta(u("budmax.know-base.app.zly.example")), null);
sprawdz("prefiks nie dostaje klienta", rozpoznajKlienta(u("zly-budmax.know-base.app")), null);
sprawdz("nieznany host nie dostaje klienta", rozpoznajKlienta(u("cokolwiek.example")), null);
sprawdz("nieznany host nie dostaje roli", rolaHosta(u("cokolwiek.example")), null);

// ---------------------------------------------------------------
// Składanie przestrzeni — dwa wymiary, żadnej wartości domyślnej
// ---------------------------------------------------------------
console.log("--- przestrzeń = klient × rodzaj ---");

sprawdz("budmax + public", przestrzenFizyczna(B, "public"), "public");
sprawdz("budmax + internal", przestrzenFizyczna(B, "internal"), "internal");
rzuca("nieznany rodzaj rzuca", () => przestrzenFizyczna(B, "wszystko"));
rzuca("brak klienta rzuca", () => przestrzenFizyczna(null, "public"));
rzuca("klient bez tej przestrzeni rzuca", () => przestrzenFizyczna({ id: "x", przestrzenie: {} }, "public"));

// ---------------------------------------------------------------
// WROGIE: warstwy, które bez klienta miałyby cichnąć
// ---------------------------------------------------------------
console.log("--- wrogie: brak klienta musi być błędem, nie ciszą ---");

// Eskalacja bez pakietu branżowego zwracałaby null, czyli wyłączyłaby się
// w całości — przy wypadku bez jednego śladu w logu.
rzuca("eskalacja bez klienta rzuca", () => wykryjEskalacje("pracownik spadl z rusztowania i zlamal noge", "internal", null));
rzuca("eskalacja z klientem bez słownika rzuca", () => wykryjEskalacje("pracownik zlamal noge", "internal", { id: "x" }));
sprawdz("eskalacja działa z pakietem branżowym",
  wykryjEskalacje("pracownik spadl z rusztowania i zlamal noge", "internal", B)?.id, "wypadek");

// Obietnice: tryb publiczny bez klienta = połowa wzorców, po cichu.
rzuca("obietnice publiczne bez klienta rzucają", () => isUnsupportablePromise("Udzielamy rabatu 5%", PROMPT_PUBLICZNY, null));
sprawdz("wzorzec branżowy działa z klientem",
  isUnsupportablePromise("Udzielamy rabatu na materiały", PROMPT_PUBLICZNY, B), true);
sprawdz("wspólny wzorzec działa bez wzorców branżowych",
  isUnsupportablePromise("Mamy wolne terminy w czerwcu", "wewnetrzny"), true);

rzuca("prompt bez klienta rzuca", () => buildSystemPrompt([{ title: "t", text: "x" }], PROMPT_PUBLICZNY, null));

// ---------------------------------------------------------------
// Spójność tablicy klientów
// ---------------------------------------------------------------
console.log("--- spójność tablicy ---");

for (const k of Object.values(KLIENCI)) {
  sprawdz(`${k.id}: zdanie odmowne zawiera frazę rozpoznawaną przez handleAsk`,
    /nie mam takich informacji/i.test(k.prompt.fallback), true);
  sprawdz(`${k.id}: ma treść dla obu przestrzeni`,
    Array.isArray(k.tresc.public) && Array.isArray(k.tresc.internal), true);
  sprawdz(`${k.id}: ma słownik eskalacji z progami`,
    Boolean(k.eskalacja?.kategorie?.length && k.eskalacja?.progi), true);
  sprawdz(`${k.id}: ma nazwy zmiennych AUD dla obu chronionych ról`,
    Boolean(k.audVars.pracownik && k.audVars.wlasciciel), true);
}

// Jeden host = jeden klient. Kolizja przy dodawaniu drugiej firmy jest łatwa
// do popełnienia i niemożliwa do zauważenia bez tego sprawdzenia.
sprawdz("indeks hostów nie ma kolizji",
  HOSTY_INDEX.size, Object.values(KLIENCI).reduce((n, k) => n + Object.keys(k.hosty).length + Object.keys(k.stare || {}).length, 0));

// Dokładnie jeden klient przejmuje wpisy w logu sprzed wprowadzenia klientów.
sprawdz("stare wpisy w logu przejmuje dokładnie jeden klient",
  Object.values(KLIENCI).filter((k) => k.przejmujeStareWpisy).length, 1);

// ---------------------------------------------------------------
// Interfejsy: podstawianie nazw i przełącznik demonstracyjny
// ---------------------------------------------------------------
console.log("--- szablony HTML ---");

const SZABLONY = [
  ["aplikacja pracownicza", APP_INTERNAL_HTML, "pracownik"],
  ["panel właściciela", PANEL_HTML, "wlasciciel"],
  ["panel wewnętrzny", PANEL_INTERNAL_HTML, "wlasciciel"],
];

for (const [nazwa, szablon, rola] of SZABLONY) {
  const bezDema = renderHtml(szablon, B, {}, rola);
  sprawdz(`${nazwa}: żaden placeholder nie został surowy`, /\{\{\w+\}\}/.test(bezDema), false);
  sprawdz(`${nazwa}: nazwa klienta podstawiona`, bezDema.includes(B.ui.marka), true);
  // Bez DEMO paska NIE MA W HTML-u — nie jest ukryty, tylko nieobecny.
  sprawdz(`${nazwa}: bez DEMO nie ma paska`, bezDema.includes("przelacz na"), false);

  // Przy jednym kliencie pasek jest pusty także z DEMO — nie ma dokąd przełączać.
  const zDemem = renderHtml(szablon, B, { DEMO: "1" }, rola);
  sprawdz(`${nazwa}: DEMO przy jednym kliencie nie pokazuje paska`, zDemem.includes("przelacz na"), false);
}

console.log("\n---");
console.log(`zdane: ${zdane}, oblane: ${oblane.length}`);
if (oblane.length) {
  for (const o of oblane) console.log(`  ${o}`);
  process.exit(1);
}
