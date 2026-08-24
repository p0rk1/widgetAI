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
import { KLIENCI } from "./klienci.js";

// Słownik eskalacji jest branżowy i przychodzi z tablicy klienta (21.08.2026).
// Test sprawdza pakiet budowlany — u kancelarii będzie własny zestaw przypadków.
const KLIENT = KLIENCI.budmax;

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

// --- HOMONIMY: te same litery, inne znaczenie na budowie (21.08.2026) ---
//
// Zmierzone przed poprawką: SIEDEM na dziesięć zwykłych zdań z budowy dostawało
// ramkę PILNE, bo `potrac`, `zlama`, `zawali`, `uraz` i `spadl z` pasowały do
// wzorców wypadkowych. „Podwykonawca zawalił termin" → „dzwoń 112". To jest ten
// rodzaj fałszywego alarmu, który uczy ignorować ramkę.
//
// Rdzeń dwuznaczny wyzwala dopiero ze SWOIM dopełnieniem: złamana część ciała,
// potrącony człowiek, upadek z wysokości, zawalenie konstrukcji. `uraz` rozbrojony
// morfologicznie (uraz/urazu kontra uraza/urazę), bo warunek kontekstowy gubił
// „doznał urazu" bez nazwanej części ciała.
PRZYPADKI.push(
  ["Klient przysłał pismo z kancelarii prawnej, że potrąci nam 20 000 zł", "spor_prawny", WEW],
  ["czy potracamy zaliczke z faktury koncowej", null, WEW],
  ["brygadzista zlamal procedure zglaszania nadgodzin", null, WEW],
  ["podwykonawca zlamal warunki umowy o terminy", null, WEW],
  ["podwykonawca zawalil termin i nie skonczyl schodow", null, WEW],
  ["ekipa zawalila robote przy tynkach", null, WEW],
  ["majster ma do mnie uraze o tamten grafik", null, WEW],
  ["koszt materialu spadl z 40 do 32 zlotych za metr", null, WEW],
  // te same rdzenie z wlasciwym dopelnieniem MUSZA wyzwalac
  ["wozek widlowy potracil pracownika na placu", "wypadek", WEW],
  ["pracownik spadl z rusztowania i zlamal noge", "wypadek", WEW],
  ["Pracownika ukasila zmija, doznal urazu", "wypadek", WEW],
  ["grozi zawaleniem sie wykop przy fundamencie", "zagrozenie_zycia", WEW],
);
// --- PIERWSZA OSOBA I FORMY BEZOSOBOWE (24.08.2026) ---
//
// Zmierzone przed poprawką: eskalacja wyzwalała się na 5 z 12 realnych zgłoszeń
// urazu pisanych potocznie. Zgłasza najczęściej TEN, KOMU SIĘ STAŁO, a słownik
// znał wyłącznie trzecią osobę: `spadl z` nie dopasowywało się do „spadlem z".
//
// Reguła jest morfologiczna, nie leksykalna: czas przeszły to rdzeń + „l" +
// końcówka osoby, więc rdzeń urwany na „l" pokrywa cały paradygmat, a wzorzec
// psuje się dopiero wtedy, gdy PO tym „l" doklei się coś na sztywno.
// Konstrukcje bezosobowe z celownikiem („urwało mi palec") rozstrzyga CZĘŚĆ
// CIAŁA, nie zaimek — celownik mówi KOMU, ale nie mówi CZY.
PRZYPADKI.push(
  // pierwsza osoba
  ["spadlem z rusztowania i nie moge wstac", "wypadek", WEW],
  ["zlecialem ze stropu, boli mnie kregoslup", "wypadek", WEW],
  ["przycialem sobie palec", "wypadek", WEW],
  ["walnalem sie w leb o belke", "wypadek", WEW],
  ["jebnalem sie z drabiny", "wypadek", WEW],
  ["stracilem przytomnosc na chwile po upadku", "wypadek", WEW],
  // formy bezosobowe z celownikiem
  ["urwalo mi palec pila tarczowa", "wypadek", WEW],
  ["pekla mi dupa", "wypadek", WEW],
  ["spadl mi mlotek na noge", "wypadek", WEW],
  ["zmiazdzylo mi stope paleta", "wypadek", WEW],
  ["urwalo sie rusztowanie przy scianie", "zagrozenie_zycia", WEW],
  ["osunela sie skarpa wykopu na ludzi", "zagrozenie_zycia", WEW],
  // rejestr potoczny w nazwie czesci ciala
  ["uderzylem sie w glowe o rusztowanie", "wypadek", WEW],
  ["kolega sie zajebal z dachu, nie rusza sie", "wypadek", WEW],

  // NEGATYWNE — te same nowe rdzenie BEZ swojego dopełnienia.
  // To one pilnują, żeby nie wrócił stan z 21.08.2026.
  ["spadlem z roweru w weekend", null, WEW],
  ["urwalo mi sie polaczenie", null, WEW],
  ["pekla mi opona w drodze na budowe", null, WEW],
  ["spadla nam wydajnosc na rusztowaniu", null, WEW],
  ["cena spadla ze 100 do 80 zlotych", null, WEW],
  ["mam urwanie glowy z tym terminem", null, WEW],
  ["peknieta rura w lazience u klienta", null, WEW],
  ["przycialem deske na wymiar", null, WEW],
  ["skrecilismy rusztowanie zgodnie z instrukcja", null, WEW],
  ["walnalem w stol z nerwow na naradzie", null, WEW],
  ["zajebiscie nam idzie robota na rusztowaniu", null, WEW],
  ["jebnal deszcz i przerwalismy prace na dachu", null, WEW],
  ["uderzenie w cene materialu po negocjacjach", null, WEW],
  ["rozwalilismy stary mur mlotem", null, WEW],
  ["przywalilo nas robota przed odbiorem", null, WEW],
  ["biodrowka i szelki - gdzie je pobrac", null, WEW],
  ["grabie i taczki sa w kontenerze", null, WEW],
);


// --- ROZSTRZYGANIE PRZY WIELU TRAFIENIACH ---
//
// Zasada z kosztu pomyłki: (1) więcej niezależnych sygnałów wygrywa,
// (2) przy remisie wygrywa kategoria PILNA — szybciej kieruje do człowieka,
// (3) potem kolejność w tablicy.
//
// Punkt 1 działa WEWNĄTRZ poziomu pilności. Inaczej „wypadek + PIP" wybrałby
// kontrolę, bo ta ma dwa sygnały z definicji — a to byłby błąd, którego koszt
// mierzy się zdrowiem.
PRZYPADKI.push(
  ["pracownik zlamal noge, przyjechala inspekcja pracy PIP", "wypadek", WEW],
  ["pracownik spadl z rusztowania a rodzina grozi pozwem", "wypadek", WEW],
  ["czuc gaz i grozi zawaleniem sciany", "zagrozenie_zycia", WEW],
  ["pismo z kancelarii prawnej i wezwanie do zaplaty", "spor_prawny", WEW],
);

// --- RZECZOWNIKI URAZOWE (21.08.2026) ---
//
// Wzorzec miał tylko rdzenie czasownikowe: `krwaw` łapie „krwawi", ale gubi
// „leci krew". Pytanie o gwóźdź w stopie nie ma ani nazwy urazu, ani rdzenia
// `krwaw` — sam rzeczownik i część ciała.
//
// `krew` wyzwala BEZ warunku kontekstowego, inaczej niż rdzenie dwuznaczne:
// poza dwoma idiomami nie znaczy nic innego. Oba idiomy wyłączone jawnie.
// `wbil sobie` ODRZUCONE jako kandydat — łapie „wbił sobie do głowy".
PRZYPADKI.push(
  ["mlody wbil sobie gwozdz z deski w stope przez but, nie mocno ale leci krew co robic", "wypadek", WEW],
  ["koledze leci krew z reki", "wypadek", WEW],
  ["kolega ma gleboka rane na dloni", "wypadek", WEW],
  ["pracownik doznal obrazen przy upadku", "wypadek", WEW],
  ["mam rozciecie na przedramieniu, trzeba opatrunku", "wypadek", WEW],
  // idiomy — nie wolno im wyzwalac
  ["zachowaj zimna krew w rozmowie z klientem", null, WEW],
  ["robimy to krew z nosa na jutro", null, WEW],
  ["majster wbil sobie do glowy ze zdazymy na piatek", null, WEW],
  ["ranna zmiana zaczyna o szostej", null, WEW],
  ["wozimy material na budowe szpitala miejskiego", null, WEW],
);

let zdane = 0;
const oblane = [];

for (const [pytanie, oczekiwana, przestrzen] of PRZYPADKI) {
  const wynik = wykryjEskalacje(pytanie, przestrzen, KLIENT);
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
   zlozZEskalacja(TRESC, wykryjEskalacje("Pracownik spadł z rusztowania", WEW, KLIENT)),
   (s) => s.startsWith("NAJPIERW POWIADOM") && s.trimEnd().endsWith(TRESC)],
  ["niepilne: ramka PO treści",
   zlozZEskalacja(TRESC, wykryjEskalacje("Sąsiad grozi sądem", WEW, KLIENT)),
   (s) => s.startsWith(TRESC) && s.trimEnd().endsWith("nie po niej.") === false && s.includes("SKIERUJ DO PRZEŁOŻONEGO")],
  ["brak pokrycia + wypadek: ramka mimo braku odpowiedzi",
   zlozZEskalacja(BRAK, wykryjEskalacje("Pracownika ukąsiła żmija, doznał urazu", WEW, KLIENT)),
   (s) => s.startsWith("NAJPIERW POWIADOM") && s.includes(BRAK)],
  ["brak eskalacji: tekst nietknięty",
   zlozZEskalacja(TRESC, wykryjEskalacje("Kto może wpisywać do dziennika budowy?", WEW, KLIENT)),
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
