// Test warstw weryfikacji: deduplikacja, próg zależny od długości, cytat dosłowny.
//
// Uruchomienie:  node test-weryfikacja.mjs
//
// Powstał przy naprawie isDuplicate() 20.08.2026. Ta warstwa usuwała zdania
// PO CICHU — bez licznika `trimmed` — więc jej defekt był niewidoczny w każdym
// pomiarze przez wiele sesji. Test istnieje po to, żeby zmiana progów albo
// stemmera nie przywróciła tego stanu niezauważenie.

import {
  isDuplicate, progCytowania, wystepujeDoslownie, numbersAreGrounded,
  PROMPT_PUBLICZNY, PROMPT_WEWNETRZNY,
} from "./worker.js";

let zdane = 0;
const oblane = [];

function sprawdz(nazwa, wynik, oczekiwane) {
  const ok = wynik === oczekiwane;
  if (ok) zdane++;
  else oblane.push(`${nazwa} — oczekiwano ${oczekiwane}, dostano ${wynik}`);
  console.log(`${ok ? "OK  " : "BŁĄD"} ${nazwa}`);
}

// ---------------------------------------------------------------
// isDuplicate — PRAWDZIWE powtórzenia muszą nadal wypadać
// ---------------------------------------------------------------
console.log("--- prawdziwe powtórzenia (mają być łapane) ---");

sprawdz(
  "parafraza tej samej treści",
  isDuplicate("Wstępną wycenę przygotowuje biuro po wizji lokalnej.",
    ["Wstępny kosztorys przygotowuje biuro po wizji lokalnej."]),
  true
);
sprawdz(
  "to samo zdanie innym szykiem",
  isDuplicate("Reklamację rozpatrujemy w terminie czternastu dni roboczych.",
    ["Reklamacje rozpatrywane są w terminie czternastu dni roboczych."]),
  true
);
sprawdz(
  "powtórzenie z jednym dodatkowym słowem",
  isDuplicate("Zgłoś uszkodzenie sprzętu brygadziście tego samego dnia.",
    ["Zgłoś uszkodzenie brygadziście tego samego dnia."]),
  true
);
sprawdz(
  "powtórzenie po kilku innych zdaniach",
  isDuplicate("Wycenę przygotowuje biuro po wizji lokalnej.",
    ["Budowa domu trwa 6-9 miesięcy.", "Wycenę przygotowuje biuro po wizji lokalnej u klienta."]),
  true
);

// ---------------------------------------------------------------
// isDuplicate — ROZWINIĘCIA muszą zostać
// ---------------------------------------------------------------
console.log("\n--- rozwinięcia (mają zostać) ---");

// Przypadek, który wywołał tę poprawkę: zdanie merytoryczne o uprawnieniach
// inspektora znikało jako „duplikat" zdania sprostowującego adresata.
sprawdz(
  "i25: treść merytoryczna po zdaniu sprostowującym",
  isDuplicate(
    "Inspektor ma prawo wydawać kierownikowi budowy polecenia wpisem do dziennika budowy, żądać poprawek albo ponownego wykonania wadliwie wykonanych robót, a także żądać wstrzymania dalszych robót, gdyby ich kontynuacja groziła wypadkiem albo niezgodnością z projektem.",
    ["Inspektor nadzoru inwestorskiego nie wydaje poleceń bezpośrednio Tobie, ale kierownikowi budowy."]
  ),
  false
);
// i23: dwa różne kroki tej samej procedury, wspólne słownictwo.
sprawdz(
  "i23: odrębny krok procedury",
  isDuplicate(
    "Przed zakryciem wykonaj dokumentację zdjęciową z widoczną miarą i datą i zapisz ją w folderze budowy.",
    ["Nie zakrywaj zbrojenia przed odbiorem — zakrycie bez odbioru oznacza odkrywkę na nasz koszt."]
  ),
  false
);
sprawdz(
  "linia źródła nigdy nie jest duplikatem",
  isDuplicate("Podstawa: Dziennik budowy — kto i co wpisuje",
    ["Prawo wpisu do dziennika budowy mają wyłącznie kierownik budowy, inspektor nadzoru inwestorskiego i inwestor."]),
  false
);
sprawdz(
  "zdanie o czym innym",
  isDuplicate("Stan surowy zamknięty wymaga kolejnych 3-4 tygodni.",
    ["Wycenę przygotowuje biuro po wizji lokalnej."]),
  false
);

// ---------------------------------------------------------------
// progCytowania i cytat dosłowny
// ---------------------------------------------------------------
console.log("\n--- próg zależny od długości i cytat dosłowny ---");

sprawdz("zdanie 2-słowowe ma próg obniżony", progCytowania("okulary ochronne"), 0.45);
sprawdz("zdanie 3-słowowe ma próg obniżony", progCytowania("Zatwierdza to zarząd."), 0.45);
sprawdz("zdanie dłuższe ma próg pełny",
  progCytowania("Nie uznawaj roszczenia i nie obiecuj naprawy ani odszkodowania."), 0.48);

const fragmenty = [{
  metadata: {
    title: "Roboty zanikające",
    text: "Nie zakrywaj zbrojenia, izolacji przeciwwilgociowej ani przyłączy przed odbiorem.",
  },
}];
sprawdz("cytat dosłowny rozpoznany",
  wystepujeDoslownie("nie zakrywaj zbrojenia", fragmenty), true);
sprawdz("zgubione zaprzeczenie NIE jest cytatem",
  wystepujeDoslownie("zakrywaj zbrojenia, izolacji", fragmenty), false);
sprawdz("zdanie spoza fragmentu nie jest cytatem",
  wystepujeDoslownie("zakrywaj wszystko bez odbioru", fragmenty), false);

// ---------------------------------------------------------------
// numbersAreGrounded — uziemienie zależne od TRYBU
//
// PUBLICZNIE pytanie nie uziemia liczby i nigdy nie będzie: klient jest stroną
// negocjacji, więc potwierdzenie jego ceny nie może przejść weryfikacji.
// WEWNĘTRZNIE liczba z pytania jest dopuszczona — pracownik podaje parametr,
// a nie negocjuje sam ze sobą. Przypadki wrogie niżej pilnują, żeby wariant
// publiczny nie rozluźnił się przy okazji zmian w wewnętrznym.
// ---------------------------------------------------------------
console.log("\n--- numbersAreGrounded (uziemienie zależne od trybu) ---");

const fragmentyZLiczybami = [{
  metadata: {
    title: "Delegacje i ryczałt",
    text: "Stawka wynosi 1,15 złotego za kilometr przy pojemności powyżej 900 cm3 oraz 0,89 złotego do 900 cm3.",
  },
}];

sprawdz(
  "liczba dosłownie z fragmentu przechodzi",
  numbersAreGrounded("Stawka wynosi 1,15 zł za kilometr.", fragmentyZLiczybami),
  true
);

sprawdz(
  "zmyślona liczba bez pokrycia w bazie i pytaniu ODPADA",
  numbersAreGrounded("Stawka wynosi 2,50 zł za kilometr.", fragmentyZLiczybami),
  false
);

sprawdz(
  "WEWNĘTRZNIE: liczba z pytania (1600 cm3) uziemia zdanie",
  numbersAreGrounded(
    "Dla silnika 1600 cm3 przysługuje stawka 1,15 zł.",
    fragmentyZLiczybami, PROMPT_WEWNETRZNY,
    "Czy przy silniku 1600 cm3 przysługuje stawka 1,15 zł?"
  ),
  true
);

sprawdz(
  "PUBLICZNIE: ta sama liczba z pytania NIE uziemia zdania",
  numbersAreGrounded(
    "Dla silnika 1600 cm3 przysługuje stawka 1,15 zł.",
    fragmentyZLiczybami, PROMPT_PUBLICZNY,
    "Czy przy silniku 1600 cm3 przysługuje stawka 1,15 zł?"
  ),
  false
);

sprawdz(
  "WEWNĘTRZNIE: zdanie ODMOWNE z liczbą pytającego przechodzi",
  numbersAreGrounded(
    "Nie, nie możesz zatwierdzić odstępstwa za 7000 zł.",
    [{ metadata: { title: "Progi decyzyjne", text: "Kierownik budowy zatwierdza odstępstwo do 5 tysięcy złotych." } }],
    PROMPT_WEWNETRZNY, "Czy moge zatwierdzic odstepstwo za 7000 zl?"
  ),
  true
);

sprawdz(
  "WEWNĘTRZNIE: liczba WYLICZONA przez model nadal wypada",
  numbersAreGrounded(
    "Za 200 km otrzymasz 230 złotych.",
    fragmentyZLiczybami, PROMPT_WEWNETRZNY,
    "Przejechalem 200 km, ile dostane?"
  ),
  false
);

// PRZYPADKI WROGIE — sedno tej warstwy.
// Klient podsuwa liczbę w pytaniu, model potakuje. Gdyby pytanie uziemiało
// liczby, takie zdanie wyszłoby do klienta z pieczątką weryfikacji.
// Przy cenie `isUnsupportablePromise()` NIE stanowi drugiej linii obrony —
// zmierzone 20.08.2026 — więc `numbersAreGrounded()` jest tu jedyną warstwą.
const fragmentyBezCen = [{
  metadata: {
    title: "Zakres usług",
    text: "Wykonujemy remonty mieszkań i domów. Wycenę przygotowuje biuro po wizji lokalnej.",
  },
}];

sprawdz(
  "WROGI: cena podsunięta w pytaniu klienta NIE przechodzi",
  numbersAreGrounded(
    "Tak, remont łazienki kosztuje 1200 zł za metr kwadratowy.",
    fragmentyBezCen, PROMPT_PUBLICZNY,
    "Czy remont łazienki kosztuje 1200 zł za metr kwadratowy?"
  ),
  false
);

sprawdz(
  "WROGI: termin podsunięty w pytaniu klienta NIE przechodzi",
  numbersAreGrounded(
    "Tak, zdążymy z remontem w 6 tygodni.",
    fragmentyBezCen, PROMPT_PUBLICZNY,
    "Czy zdążycie z remontem w 6 tygodni?"
  ),
  false
);

sprawdz(
  "WROGI: brak podanego trybu = wariant PUBLICZNY (surowy)",
  numbersAreGrounded(
    "Tak, remont łazienki kosztuje 1200 zł za metr kwadratowy.",
    fragmentyBezCen, undefined,
    "Czy remont łazienki kosztuje 1200 zł za metr kwadratowy?"
  ),
  false
);

sprawdz(
  "WROGI: nieznana nazwa trybu NIE otwiera wariantu luźnego",
  numbersAreGrounded(
    "Tak, remont łazienki kosztuje 1200 zł za metr kwadratowy.",
    fragmentyBezCen, "obie",
    "Czy remont łazienki kosztuje 1200 zł za metr kwadratowy?"
  ),
  false
);

// Strażnik sygnatury. `Function.length` liczy parametry PRZED pierwszym
// domyślnym, więc dwa wymagane (`sentence`, `filtered`) to nadal 2 — a `tryb`
// i `userQuestion` mają wartości domyślne. Wartość inna niż 2 oznacza, że ktoś
// uczynił tryb lub pytanie parametrem wymaganym albo przestawił kolejność;
// jedno i drugie zmienia to, co dostają wywołania dwuargumentowe.
sprawdz(
  "WROGI: funkcja ma dokładnie dwa parametry wymagane",
  numbersAreGrounded.length,
  2
);

sprawdz(
  "zdanie bez liczb zawsze przechodzi",
  numbersAreGrounded("Rozliczenie delegacji składa się w kadrach.", fragmentyZLiczybami),
  true
);

// ---------------------------------------------------------------
// LICZEBNIKI ZAPISANE SŁOWNIE W ŹRÓDLE (22.08.2026)
// ---------------------------------------------------------------
// Dokumenty formalne zapisują terminy słownie („w terminie dwóch tygodni"),
// a model odpowiada cyfrą („14 dni"). Rozszerzamy ZBIÓR UZIEMIAJĄCY o to,
// co źródło już mówi innym zapisem — nie o to, co model wymyślił.
console.log("\n--- liczebniki słowne po stronie źródła ---");

const fragmentSlowny = [{
  metadata: {
    title: "Terminy procesowe",
    text: "Apelację wnosi się w terminie dwóch tygodni od doręczenia wyroku z uzasadnieniem, " +
          "zażalenie w terminie tygodnia od doręczenia postanowienia, a odwołanie od wypowiedzenia " +
          "umowy o pracę w terminie 21 dni od doręczenia oświadczenia pracodawcy.",
  },
}];

sprawdz(
  "cyfra 14 uziemiona liczebnikiem „dwóch tygodni”",
  numbersAreGrounded("Termin na apelację wynosi 14 dni od doręczenia wyroku z uzasadnieniem.", fragmentSlowny),
  true
);
sprawdz(
  "cyfra 7 uziemiona zapisem „w terminie tygodnia”",
  numbersAreGrounded("Na zażalenie masz 7 dni od doręczenia postanowienia.", fragmentSlowny),
  true
);
sprawdz(
  "liczebnik sam w sobie też uziemia (2 tygodnie)",
  numbersAreGrounded("Termin wynosi 2 tygodnie.", fragmentSlowny),
  true
);
sprawdz(
  "cyfra zapisana wprost nadal działa (21 dni)",
  numbersAreGrounded("Odwołanie składa się w terminie 21 dni.", fragmentSlowny),
  true
);

// WROGIE: rozszerzenie nie może przepuścić liczby, której w źródle nie ma
// w ŻADNEJ postaci — ani cyfrą, ani słownie, ani jako przeliczenie tygodni.
sprawdz(
  "WROGI: liczba spoza źródła nadal wypada (30 dni)",
  numbersAreGrounded("Termin na apelację wynosi 30 dni.", fragmentSlowny),
  false
);
sprawdz(
  "WROGI: arytmetyka modelu nadal wypada",
  numbersAreGrounded("Łącznie zapłaci Pan 2800 złotych.", fragmentSlowny),
  false
);
sprawdz(
  "WROGI: miesiące NIE są przeliczane na dni",
  numbersAreGrounded("Masz 180 dni na złożenie wniosku.",
    [{ metadata: { title: "T", text: "Wniosek składa się w terminie sześciu miesięcy." } }]),
  false
);
sprawdz(
  "WROGI: liczebnik oderwany od jednostki nie tworzy przeliczenia",
  numbersAreGrounded("Termin wynosi 21 dni.",
    [{ metadata: { title: "T", text: "Zeznania złożyło trzech świadków. Pismo doręczono w tygodniu poprzedzającym rozprawę." } }]),
  false
);
sprawdz(
  "WROGI: liczebnik w środku wyrazu nie liczy się (stosunek ≠ sto)",
  numbersAreGrounded("Opłata wynosi 100 złotych.",
    [{ metadata: { title: "T", text: "Umowa reguluje stosunek prawny stron." } }]),
  false
);

console.log("\n---");
for (const o of oblane) console.log(`BŁĄD: ${o}`);
console.log(`zdane: ${zdane}, oblane: ${oblane.length}`);
if (oblane.length) process.exitCode = 1;
