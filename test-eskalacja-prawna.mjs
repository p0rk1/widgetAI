// Test warstwy eskalacji na słowniku KANCELARII (`eskalacja-prawna.js`).
//
// Uruchomienie:  node test-eskalacja-prawna.mjs
//
// Osobny plik od test-eskalacja.mjs celowo: to nie jest ten sam zestaw pytań
// w innym przebraniu. Mechanizm jest wspólny i sprawdza go tamten test na
// budowlance; tutaj sprawdzamy KALIBRACJĘ drugiego słownika — czyli to, czego
// nie da się odziedziczyć po pierwszej branży.
//
// Połowa przypadków jest NEGATYWNA i to one są tu najważniejsze. W kancelarii
// słowa „termin", „sprawa", „klient" i „zatrzymać" padają w każdym zdaniu,
// więc warstwa zbyt chętna nauczyłaby zespół ignorować ramkę dokładnie tak,
// jak nauczyłaby brygadę na budowie.

import { wykryjEskalacje, wykryjOstrzezenie, zlozZEskalacja } from "./worker.js";
import { KLIENCI } from "./klienci.js";

const KLIENT = KLIENCI.kancelaria;
const WEW = "internal";
const PUB = "public";

// [pytanie, oczekiwana kategoria (null = brak eskalacji), przestrzeń]
const PRZYPADKI = [
  // --- TERMIN PROCESOWY: wyzwala BLISKOŚĆ albo NARUSZENIE, nie sam termin ---
  ["Termin na apelację upływa jutro, adwokat jest na rozprawie", "termin_procesowy", WEW],
  ["Zostały dwa dni na sprzeciw od nakazu zapłaty", "termin_procesowy", WEW],
  ["Minął termin na zażalenie, co teraz zrobić", "termin_procesowy", WEW],
  ["Przegapiliśmy termin na odwołanie od wypowiedzenia", "termin_procesowy", WEW],
  ["Wniosek o uzasadnienie trzeba złożyć dzisiaj do końca dnia", "termin_procesowy", WEW],
  ["Klient przyniósł nakaz zapłaty doręczony wczoraj, a wyjeżdża na miesiąc", "termin_procesowy", WEW],
  ["Uchybiliśmy terminowi na wniesienie skargi kasacyjnej", "termin_procesowy", WEW],

  // --- NEGATYWNE: pytania o REGUŁĘ terminu, najczęstsze pytania zespołu ---
  ["Jaki jest termin na apelację od wyroku sądu okręgowego?", null, WEW],
  ["Kiedy upływa termin na złożenie zażalenia?", null, WEW],
  ["Od czego liczy się bieg terminu na sprzeciw od nakazu zapłaty?", null, WEW],
  ["Ile wynosi termin na odwołanie od wypowiedzenia umowy o pracę?", null, WEW],
  // --- NEGATYWNE: słowo „termin" w znaczeniu nieprocesowym ---
  ["Termin spotkania z klientem przesuwamy na piątek", null, WEW],
  ["Minął termin płatności faktury za tłumaczenie", null, WEW],
  ["Klient prosi o wcześniejszy termin konsultacji, najlepiej jutro", null, WEW],

  // --- ZATRZYMANIE: terminy w godzinach ---
  ["Klienta zatrzymała policja wczoraj wieczorem", "zatrzymanie", WEW],
  ["Klient jest tymczasowo aresztowany i prosi o widzenie", "zatrzymanie", WEW],
  ["Prokurator przesłuchuje klienta w charakterze podejrzanego", "zatrzymanie", WEW],
  ["Postawili zarzuty naszemu klientowi, dzwoni jego żona", "zatrzymanie", WEW],
  ["W firmie klienta trwa przeszukanie, co robić", "zatrzymanie", WEW],
  // --- NEGATYWNE: „zatrzymać" w znaczeniu biurowym ---
  ["Czy możemy zatrzymać fakturę do wyjaśnienia z klientem?", null, WEW],
  ["Zatrzymaliśmy wysyłkę pisma do czasu decyzji adwokata", null, WEW],

  // --- ZAGROŻENIE OSOBY ---
  ["Klientka mówi, że mąż jej grozi i boi się wrócić do domu", "zagrozenie_osoby", WEW],
  ["Klient zgłasza przemoc domową wobec dziecka", "zagrozenie_osoby", WEW],
  ["Były partner nęka klientkę telefonami i pod domem", "zagrozenie_osoby", WEW],
  ["Klientka pyta o nakaz opuszczenia mieszkania przez sprawcę", "zagrozenie_osoby", WEW],
  // --- NEGATYWNE: „grozi" w znaczeniu sankcji, nie zagrożenia człowieka ---
  ["Klient pyta, jaka kara grozi za jazdę po alkoholu", null, WEW],
  ["Za to przestępstwo grozi kara pozbawienia wolności do lat pięciu", null, WEW],
  ["Czy grozi nam grzywna za nieterminowe złożenie sprawozdania?", null, WEW],

  // --- KONFLIKT INTERESÓW ---
  ["Zgłosił się klient ze sprawą przeciwko byłemu klientowi kancelarii", "konflikt_interesow", WEW],
  ["Dzwoni strona przeciwna z naszej sprawy i prosi o ustalenia", "konflikt_interesow", WEW],
  ["Czy możemy przyjąć sprawę, w której druga strona była u nas na konsultacji?", "konflikt_interesow", WEW],
  // --- NEGATYWNE: pytanie o samą procedurę, nie o konkretny konflikt ---
  ["Jaka jest procedura sprawdzania konfliktu interesów?", null, WEW],
  ["Jak sprawdzamy konflikt interesów przed przyjęciem sprawy?", null, WEW],

  // --- POZA KOMPETENCJAMI ---
  ["Klient pyta, czy poprowadzimy sprawę o naruszenie patentu", "poza_kompetencjami", WEW],
  ["Czy przyjmujemy sprawy o rejestrację znaku towarowego?", "poza_kompetencjami", WEW],
  ["Zgłosiła się spółka z pytaniem o ceny transferowe, co powiedzieć", "poza_kompetencjami", WEW],
  // --- NEGATYWNE: dziedziny, które prowadzimy ---
  ["Czy prowadzimy sprawy rozwodowe z orzekaniem o winie?", null, WEW],
  ["Czy przyjmujemy sprawy o zachowek?", null, WEW],

  // --- PORADA DLA OSOBY NIEBĘDĄCEJ KLIENTEM ---
  ["Dzwoni matka klienta i pyta, co dzieje się w jego sprawie", "porada_dla_nieklienta", WEW],
  ["Dziennikarz pyta o sprawę naszego klienta, co mogę powiedzieć", "porada_dla_nieklienta", WEW],
  ["Dzwoni pracodawca klienta i chce wiedzieć, czy jest naszym klientem", "porada_dla_nieklienta", WEW],
  // --- NEGATYWNE: pyta sam klient ---
  ["Klient pyta o termin najbliższej rozprawy", null, WEW],
  ["Klient prosi o kopię pisma z sądu", null, WEW],

  // --- DECYZJA FINANSOWA POWYŻEJ PROGU (10% / 1000 zł) ---
  ["Czy mogę zgodzić się na obniżenie honorarium o 20 procent?", "decyzja_finansowa", WEW],
  ["Czy mogę zapłacić 1500 złotych za tłumaczenie przysięgłe w sprawie?", "decyzja_finansowa", WEW],
  ["Klient prosi o rozłożenie honorarium na raty, czy mogę się zgodzić?", "ustepstwo_wobec_klienta", WEW],
  ["Czy mogę odstąpić od zaliczki, klient prosi o rozpoczęcie bez wpłaty?", "ustepstwo_wobec_klienta", WEW],
  // --- NEGATYWNE: poniżej progu albo pytanie o regułę ---
  ["Czy mogę zamówić odpis z akt za 60 złotych?", null, WEW],
  ["Ile wynosi opłata skarbowa od pełnomocnictwa?", null, WEW],

  // --- BEZ OGONKÓW: tak pisze sekretariat z telefonu ---
  ["termin na apelacje uplywa jutro", "termin_procesowy", WEW],
  ["klienta zatrzymala policja, dzwoni zona", "zatrzymanie", WEW],
  ["maz grozi klientce, boi sie wrocic do domu", "zagrozenie_osoby", WEW],
  ["dzwoni matka klienta i pyta o sprawe", "porada_dla_nieklienta", WEW],

  // --- TRYB PUBLICZNY NIGDY NIE ESKALUJE ---
  ["Termin na apelację upływa jutro, co robić?", null, PUB],
  ["Mąż mi grozi i boję się wrócić do domu", null, PUB],
];

// --- ROZSTRZYGANIE PRZY WIELU TRAFIENIACH ---
// Ta sama zasada co na budowie: więcej sygnałów wewnątrz poziomu pilności,
// przy remisie kategoria pilna, potem kolejność. Sprawdzamy, że przeniosła się
// na inny słownik bez zmian.
PRZYPADKI.push(
  // termin ma trzy sygnały (zdarzenie + dwuznaczny z dopełnieniem + bliskość),
  // zatrzymanie jeden — wygrywa termin, oba są pilne
  ["Klienta zatrzymała policja, a jutro mija termin na apelację", "termin_procesowy", WEW],
  // pilne wygrywa z niepilnym, choć niepilne ma dwa sygnały z definicji
  ["Dzwoni strona przeciwna i prosi o ustalenia, a klientce grozi mąż", "zagrozenie_osoby", WEW],
);

let zdane = 0;
const oblane = [];

for (const [pytanie, oczekiwana, przestrzen] of PRZYPADKI) {
  const wynik = wykryjEskalacje(pytanie, przestrzen, KLIENT);
  const dostal = wynik ? wynik.id : null;
  const ok = dostal === oczekiwana;
  if (ok) zdane++;
  else oblane.push(`„${pytanie}" — oczekiwano ${oczekiwana}, dostano ${dostal}`);
  console.log(`${ok ? "OK  " : "BŁĄD"} [${String(oczekiwana)}] ${pytanie.slice(0, 62)}`);
}

// --- POZYCJA RAMKI ---
console.log("\n--- pozycja ramki ---");
const TRESC = "Treść odpowiedzi z dokumentacji.";
function sprawdzPozycje(nazwa, zlozone, pilne) {
  const ok = pilne ? zlozone.startsWith("NAJPIERW") : zlozone.startsWith(TRESC);
  if (ok) zdane++;
  else oblane.push(`${nazwa} — zła pozycja ramki`);
  console.log(`${ok ? "OK  " : "BŁĄD"} ${nazwa}`);
}
sprawdzPozycje("pilne: ramka PRZED treścią",
  zlozZEskalacja(TRESC, wykryjEskalacje("Termin na apelację upływa jutro", WEW, KLIENT)), true);
sprawdzPozycje("niepilne: ramka PO treści",
  zlozZEskalacja(TRESC, wykryjEskalacje("Dzwoni matka klienta i pyta o sprawę", WEW, KLIENT)), false);

// --- RAMKA BEZPIECZEŃSTWA W TRYBIE PUBLICZNYM (22.08.2026) ---
//
// Powstała z pomiaru: warstwa liczb wycięła numer alarmowy z odpowiedzi dla
// osoby zgłaszającej zagrożenie. Ramka jest doklejana poza weryfikacją, więc
// nie ma jej jak wyciąć. Wyzwala WYŁĄCZNIE kategoria z polem `publiczna`.
console.log("\n--- ramka bezpieczeństwa (tryb publiczny) ---");

function sprawdzRamke(nazwa, pytanie, oczekiwana) {
  const o = wykryjOstrzezenie(pytanie, PUB, KLIENT);
  const dostal = o ? o.id : null;
  const ok = dostal === oczekiwana;
  if (ok) zdane++;
  else oblane.push(`ramka: „${pytanie}" — oczekiwano ${oczekiwana}, dostano ${dostal}`);
  console.log(`${ok ? "OK  " : "BŁĄD"} [${String(oczekiwana)}] ${nazwa}`);
}

sprawdzRamke("zagrożenie od osoby bliskiej", "Mąż mi grozi i boję się wrócić do domu, co mam robić?", "zagrozenie_osoby");
sprawdzRamke("to samo bez ogonków", "maz grozi mi i boje sie wrocic do domu", "zagrozenie_osoby");
sprawdzRamke("przemoc wobec dziecka", "Partner stosuje przemoc domową wobec naszego dziecka", "zagrozenie_osoby");
// NEGATYWNE: zwykłe pytania klienta nie mogą dostać ramki alarmowej
sprawdzRamke("cennik", "Ile kosztuje konsultacja u adwokata?", null);
sprawdzRamke("termin", "Ile mam czasu na apelację od wyroku?", null);
sprawdzRamke("sankcja, nie zagrożenie", "Jaka kara grozi za jazdę po alkoholu?", null);
sprawdzRamke("sprawy karne jako temat", "Czy prowadzicie sprawy karne?", null);

// Kategoria BEZ pola `publiczna` nie daje ramki publicznej, choć daje eskalację
// wewnętrzną. To zabezpieczenie przed włączeniem ramki u klienta, który jej
// nie zamawiał — u BudMaksu nie ma dziś ani jednej takiej kategorii.
{
  const pyt = "Termin na apelację upływa jutro";
  const ok = wykryjEskalacje(pyt, WEW, KLIENT)?.id === "termin_procesowy" && wykryjOstrzezenie(pyt, PUB, KLIENT) === null;
  if (ok) zdane++; else oblane.push("kategoria bez `publiczna` nie może dawać ramki publicznej");
  console.log(`${ok ? "OK  " : "BŁĄD"} kategoria bez pola publiczna: eskalacja tak, ramka nie`);
}

// Ramka pilna staje PRZED treścią, tak jak eskalacja pilna.
{
  const zl = zlozZEskalacja(TRESC, wykryjOstrzezenie("Mąż mi grozi, boję się", PUB, KLIENT));
  const ok = zl.startsWith("JEŻELI JESTEŚ W NIEBEZPIECZEŃSTWIE");
  if (ok) zdane++; else oblane.push("ramka bezpieczeństwa powinna stać przed treścią");
  console.log(`${ok ? "OK  " : "BŁĄD"} ramka bezpieczeństwa przed treścią`);
}

console.log("\n---");
console.log(`zdane: ${zdane}, oblane: ${oblane.length}`);
if (oblane.length) {
  for (const o of oblane) console.log(`  ${o}`);
  process.exit(1);
}
