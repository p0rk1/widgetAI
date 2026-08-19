// Test warstwy eskalacji (`wykryjEskalacje`).
//
// Uruchomienie:  node test-eskalacja.mjs
//
// Po co osobny test, skoro jest /debug: ta warstwa jest DETERMINISTYCZNA i nie
// dotyka ani modelu, ani bazy wektorowej. Sprawdzenie jej przez API kosztowałoby
// wywołanie modelu na przypadek i dawało wynik zależny od losowości generowania —
// tutaj 40 przypadków przechodzi w kilkadziesiąt milisekund i zawsze tak samo.
//
// Połowa przypadków to NEGATYWNE: pytania tematycznie bliskie, które eskalacji
// wyzwolić NIE MOGĄ. To one pilnują wniosku z reguły adresata — lista fraz
// odpala się zbyt chętnie, a ramka pokazywana bez powodu nauczy pracownika
// ignorować ją wtedy, gdy będzie potrzebna.

import { wykryjEskalacje, zlozZEskalacja } from "./worker.js";

const WEW = "internal";
const PUB = "public";

// [pytanie, oczekiwana kategoria (null = brak eskalacji), przestrzeń]
const PRZYPADKI = [
  // --- wypadek i uraz ---
  ["Pracownik spadł z rusztowania i złamał nogę, co robić?", "wypadek", WEW],
  ["Doszło do wypadku na budowie, poszkodowany leży przy wykopie", "wypadek", WEW],
  ["Kolegę przygniotło płytą, jest przytomny ale krwawi", "wypadek", WEW],
  ["Pracownik zasłabł w upale, co mam zrobić", "wypadek", WEW],
  ["Murarz skaleczył się szlifierką, dużo krwi", "wypadek", WEW],
  ["Trzeba wezwać karetkę do pracownika czy dzwonić do kierownika", "wypadek", WEW],
  // Świadome nadwyzwolenie: pytanie o REGUŁĘ, ale dotyczy wypadku śmiertelnego.
  // Weto ramy informacyjnej celowo NIE działa w kategoriach pilnych.
  ["Kto i w jakim czasie zgłasza wypadek śmiertelny do inspekcji pracy?", "wypadek", WEW],

  // --- zagrożenie życia lub zdrowia ---
  ["Czuć gaz przy kontenerze socjalnym, co robić?", "zagrozenie_zycia", WEW],
  ["Rusztowanie grozi zawaleniem, pod nim pracują ludzie", "zagrozenie_zycia", WEW],
  ["Kolega nie oddycha po porażeniu prądem", "zagrozenie_zycia", WEW],
  ["Wykop się osunął i zasypało pracownika", "zagrozenie_zycia", WEW],
  ["Pali się kontener z chemią budowlaną", "zagrozenie_zycia", WEW],

  // --- spór prawny i groźba roszczenia ---
  ["Sąsiad grozi sądem za zabłoconą drogę dojazdową", "spor_prawny", WEW],
  ["Klient żąda odszkodowania za opóźnienie etapu", "spor_prawny", WEW],
  ["Przyszło wezwanie do zapłaty od podwykonawcy", "spor_prawny", WEW],
  ["Klient przyjechał na budowę z adwokatem", "spor_prawny", WEW],

  // --- kontakt z organami kontroli ---
  ["Na budowę przyjechał inspektor pracy, co mam robić?", "kontrola", WEW],
  ["Jest kontrola z PIP na placu, pytają o szkolenia", "kontrola", WEW],
  ["Nadzór budowlany żąda okazania dziennika budowy", "kontrola", WEW],
  ["Sanepid zjawił się na budowie bez zapowiedzi", "kontrola", WEW],

  // --- decyzje finansowe powyżej progów ---
  ["Czy mogę dać klientowi 5 procent rabatu?", "finanse_prog", WEW],
  ["Jaką marżę mogę zejść przy zleceniu za 500 tysięcy złotych?", "finanse_prog", WEW],
  ["Czy mogę kupić materiał za 800 złotych bez zgody kierownika?", "finanse_prog", WEW],

  // --- NEGATYWNE: te same obszary, ale pytanie o regułę, nie o zdarzenie ---
  ["Jakie środki ochrony muszę nosić przy szlifowaniu betonu?", null, WEW],
  ["Co ile odnawiamy szkolenie BHP?", null, WEW],
  ["Jak zabezpieczyć wykop o głębokości 2 metrów?", null, WEW],
  ["Czy mogę pracować na dachu przy wietrze 12 metrów na sekundę?", null, WEW],
  ["Kto może wpisywać do dziennika budowy?", null, WEW],
  ["Co zrobić przed zakryciem zbrojenia?", null, WEW],
  ["Z jakim wyprzedzeniem zamawiać beton towarowy?", null, WEW],
  ["Jaki jest termin zgłoszenia do inspekcji pracy?", null, WEW],
  ["Ile wynosi standardowa marża na robociznę?", null, WEW],
  ["Czy mogę dać klientowi 2 procent rabatu?", null, WEW],
  ["Ile mam urlopu przy 12 latach pracy?", null, WEW],
  ["Kiedy muszę powiadomić o zwolnieniu lekarskim?", null, WEW],
  ["Klient chce wejść na teren budowy, co mam zrobić?", null, WEW],
  ["Sąsiad skarży się na hałas przy pracach", null, WEW],
  ["Pracownik spóźnił się na zmianę, co z tym zrobić?", null, WEW],
  ["Jak rozliczyć delegację samochodem prywatnym?", null, WEW],

  // --- BEZ OGONKÓW: tak pisze pracownik z telefonu na budowie ---
  // Pierwsza wersja warstwy milczała na wszystkich tych pytaniach, bo wzorce
  // wymagały „sądem" i „żąda". Milczenie tej warstwy to dokładnie ten błąd,
  // przed którym ma chronić, więc przypadki zostają w teście na stałe.
  ["Pracownik spadl z rusztowania i zlamal noge", "wypadek", WEW],
  ["Kolege przygniotlo plyta, krwawi", "wypadek", WEW],
  ["Sasiad grozi sadem za zablocona droge", "spor_prawny", WEW],
  ["Klient zada odszkodowania za opoznienie", "spor_prawny", WEW],
  ["Nadzor budowlany zada dziennika budowy", "kontrola", WEW],
  ["Czy moge dac klientowi 5 procent rabatu?", "finanse_prog", WEW],
  ["Czuc gaz przy kontenerze", "zagrozenie_zycia", WEW],
  // …i to samo zabezpieczenie nie może zacząć łapać zwykłych słów:
  // „zadanie" i „zadaj" nie są formami „żąda".
  ["Jakie zadanie mam wykonac po szkoleniu z inspekcji pracy?", null, WEW],

  // --- Tryb publiczny NIGDY nie eskaluje ---
  ["Pracownik spadł z rusztowania i złamał nogę, co robić?", null, PUB],
  ["Sąsiad grozi sądem za zabłoconą drogę dojazdową", null, PUB],
];

let zdane = 0;
const oblane = [];

for (const [pytanie, oczekiwana, przestrzen] of PRZYPADKI) {
  const wynik = wykryjEskalacje(pytanie, przestrzen);
  const got = wynik ? wynik.id : null;
  const ok = got === oczekiwana;
  if (ok) zdane++;
  else oblane.push({ pytanie, przestrzen, oczekiwana, got });
  const znak = ok ? "OK  " : "BŁĄD";
  const opis = got === null ? "brak eskalacji" : `${got}${wynik.pilne ? " (PILNE)" : ""}`;
  console.log(`${znak} [${przestrzen.padEnd(8)}] ${opis.padEnd(28)} ${pytanie.slice(0, 62)}`);
}

// --- Składanie odpowiedzi: pozycja ramki i ścieżka bez pokrycia ---
//
// Ścieżki „brak w dokumentacji" nie da się sprawdzić przez /debug, bo /debug
// zawsze generuje odpowiedź. A to najważniejszy przypadek: przy wypadku, którego
// dokumentacja nie opisuje, bot NIE MOŻE milczeć.
console.log("\n--- składanie odpowiedzi ---");

const TRESC = "Zabezpiecz miejsce zdarzenia.";
const BRAK = "Nie mam takich informacji w mojej dokumentacji — polecam kontakt z biurem.";

const zlozenia = [
  ["pilne: ramka PRZED treścią",
   zlozZEskalacja(TRESC, wykryjEskalacje("Pracownik spadł z rusztowania", WEW)),
   (s) => s.startsWith("NAJPIERW POWIADOM") && s.trimEnd().endsWith(TRESC)],
  ["niepilne: ramka PO treści",
   zlozZEskalacja(TRESC, wykryjEskalacje("Sąsiad grozi sądem", WEW)),
   (s) => s.startsWith(TRESC) && s.trimEnd().endsWith("nie po niej.") === false && s.includes("SKIERUJ DO PRZEŁOŻONEGO")],
  ["brak pokrycia + wypadek: ramka mimo braku odpowiedzi",
   zlozZEskalacja(BRAK, wykryjEskalacje("Pracownika ukąsiła żmija, doznał urazu", WEW)),
   (s) => s.startsWith("NAJPIERW POWIADOM") && s.includes(BRAK)],
  ["brak eskalacji: tekst nietknięty",
   zlozZEskalacja(TRESC, wykryjEskalacje("Kto może wpisywać do dziennika budowy?", WEW)),
   (s) => s === TRESC],
];

for (const [nazwa, wynik, sprawdz] of zlozenia) {
  const ok = sprawdz(wynik);
  if (ok) zdane++;
  else oblane.push({ pytanie: nazwa, przestrzen: "składanie", oczekiwana: "poprawny układ", got: wynik.slice(0, 60) });
  console.log(`${ok ? "OK  " : "BŁĄD"} ${nazwa}`);
}

console.log("\n---");
for (const o of oblane) {
  console.log(`BŁĄD: "${o.pytanie}" [${o.przestrzen}] — oczekiwano ${o.oczekiwana}, dostano ${o.got}`);
}
console.log(`zdane: ${zdane}, oblane: ${oblane.length}`);
if (oblane.length) process.exitCode = 1;
