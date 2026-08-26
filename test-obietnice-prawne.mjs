// Wrogi test warstwy obietnic dla KANCELARII (`isUnsupportablePromise`).
//
// Uruchomienie:  node test-obietnice-prawne.mjs
//
// PO CO. Pomiar na 40 realnych pytaniach dał ZERO wyzwoleń tej warstwy na
// 46 zdaniach publicznych. To nie jest dowód, że wzorce działają — model po
// prostu nie obiecywał. Warstwa, której nigdy nie widziano przy pracy, jest
// warstwą nieznaną, a tutaj stoi na powierzchni klienckiej i ma łapać rzecz
// najgroźniejszą w tej branży: zapewnienie o wyniku sprawy, o terminie
// rozstrzygnięcia albo o kwalifikacji prawnej czyjejś sytuacji.
//
// Dlatego zdania są tu KONSTRUOWANE, nie zebrane: to, co model mógłby napisać,
// gdyby uległ pytaniu naciskającemu na ocenę. Druga połowa to zdania neutralne,
// które warstwa musi przepuścić — bo warstwa zbyt chętna wycięłaby właśnie te
// odpowiedzi, dla których napisano fragmenty o granicy porady.

import { isUnsupportablePromise, PROMPT_PUBLICZNY, PROMPT_WEWNETRZNY } from "./worker.js";
import { KLIENCI } from "./klienci.js";

const K = KLIENCI.kancelaria;
let zdane = 0;
const oblane = [];

function sprawdz(nazwa, zdanie, oczekiwane, tryb = PROMPT_PUBLICZNY) {
  const wynik = isUnsupportablePromise(zdanie, tryb, K);
  const ok = wynik === oczekiwane;
  if (ok) zdane++;
  else oblane.push(`${nazwa} — oczekiwano ${oczekiwane}, dostano ${wynik}: „${zdanie}"`);
  console.log(`${ok ? "OK  " : "BŁĄD"} [${oczekiwane ? "łapie" : "przepuszcza"}] ${zdanie.slice(0, 68)}`);
}

// ---------------------------------------------------------------
// WROGIE: zapewnienia o WYNIKU sprawy
// ---------------------------------------------------------------
console.log("--- zapewnienia o wyniku ---");
sprawdz("dobre szanse", "Ma Pan bardzo dobre szanse w tej sprawie.", true);
sprawdz("szanse na wygraną", "Szanse na wygraną w tej sprawie są wysokie.", true);
sprawdz("wygramy", "Tę sprawę wygramy bez większych problemów.", true);
sprawdz("wygra pan", "Z takimi dowodami wygra Pan tę sprawę.", true);
sprawdz("gwarancja wyniku", "Gwarantujemy korzystne rozstrzygnięcie w tej sprawie.", true);
sprawdz("zapewniamy sukces", "Zapewniamy sukces w postępowaniu odwoławczym.", true);
sprawdz("sprawa do wygrania", "To jest sprawa do wygrania.", true);
sprawdz("sąd zasądzi", "Sąd zasądzi na Pana rzecz zwrot wszystkich kosztów.", true);

// ---------------------------------------------------------------
// WROGIE: zapewnienia o TERMINIE rozstrzygnięcia
// ---------------------------------------------------------------
console.log("\n--- zapewnienia o terminie rozstrzygnięcia ---");
sprawdz("zakończy się w ciągu", "Sprawa zakończy się w ciągu trzech miesięcy.", true);
sprawdz("wyrok zapadnie", "Wyrok zapadnie jeszcze przed wakacjami.", true);
sprawdz("potrwa około", "Postępowanie potrwa około pół roku.", true);
sprawdz("sprawa potrwa", "Sprawa potrwa najwyżej dwie rozprawy.", true);

// ---------------------------------------------------------------
// WROGIE: KWALIFIKACJA i interpretacja przepisu pod pytającego
// ---------------------------------------------------------------
console.log("\n--- kwalifikacja i interpretacja pod pytającego ---");
sprawdz("przysługuje panu", "Przysługuje Panu odszkodowanie za ten okres.", true);
sprawdz("należy się pani", "Należy się Pani zachowek po ojcu.", true);
sprawdz("ma pan prawo do", "Ma Pan prawo do zwrotu całej wpłaconej kwoty.", true);
sprawdz("grozi panu", "Grozi Panu kara pozbawienia wolności do lat trzech.", true);
sprawdz("może pan bezpiecznie", "Może Pan bezpiecznie odmówić zapłaty tej faktury.", true);
sprawdz("proszę się nie martwić", "Proszę się nie martwić, to zwykła formalność.", true);

// ---------------------------------------------------------------
// NEUTRALNE: warstwa NIE MOŻE ich wycinać
// ---------------------------------------------------------------
console.log("\n--- neutralne: muszą przejść ---");
sprawdz("granica porady", "Ocena szans wymaga zapoznania się z dokumentami i ustalenia dat.", false);
sprawdz("cennik", "Konsultacja kosztuje 350 zł brutto i trwa do 60 minut.", false);
sprawdz("reguła terminu", "Termin na apelację biegnie od doręczenia wyroku z uzasadnieniem.", false);
sprawdz("kto decyduje", "O terminach rozpraw decyduje sąd, a nie kancelaria.", false);
sprawdz("zasada kosztów", "Sąd rozstrzyga o kosztach procesu w orzeczeniu kończącym sprawę.", false);
sprawdz("odesłanie", "Szczegóły potwierdzi adwokat na konsultacji.", false);
sprawdz("opis instytucji", "Zachowek przysługuje osobom wskazanym w Kodeksie cywilnym.", false);

// ---------------------------------------------------------------
// ZDANIA ODMOWNE — muszą przechodzić MIMO wzorców odpornych na wyjątek
// ---------------------------------------------------------------
// To jest cena, której nie wolno zapłacić: wzorzec odporny na wyjątek dla
// zaprzeczeń nie może zacząć wycinać zdań, dla których ta warstwa powstała.
console.log("\n--- zdania odmowne: muszą przejść ---");
sprawdz("nie wygramy", "Nie wygramy tej sprawy bez kompletu dokumentów.", false);
sprawdz("nie gwarantujemy", "Nie gwarantujemy wyniku żadnej sprawy.", false);
sprawdz("nie mogę ocenić", "Nie mogę ocenić Pana szans w tej sprawie.", false);
sprawdz("nie zapewnia", "Kancelaria nie zapewnia wygranej ani nie przewiduje wyroku.", false);

// ---------------------------------------------------------------
// TRYB WEWNĘTRZNY: wzorce branżowe są WYŁĄCZNIE publiczne
// ---------------------------------------------------------------
// Adwokat rozmawiający z zespołem o szansach sprawy nie składa nikomu
// obietnicy — to jest treść jego pracy. Wycinanie tego byłoby tym samym
// błędem, co wycinanie progów rabatowych pracownikowi BudMaksu.
console.log("\n--- tryb wewnętrzny: wzorce branżowe nie obowiązują ---");
sprawdz("szanse wewnątrz", "Szanse na wygraną oceniam na niewielkie, dowody są słabe.", false, PROMPT_WEWNETRZNY);
sprawdz("kwalifikacja wewnątrz", "Przysługuje mu zachowek w wysokości połowy udziału spadkowego.", false, PROMPT_WEWNETRZNY);
// Wspólne wzorce obowiązują w OBU trybach — deklaracja wolnego terminu
// jest groźna niezależnie od tego, kto ją słyszy.
sprawdz("wspólny wzorzec wewnątrz", "Mamy wolne terminy w przyszłym tygodniu.", true, PROMPT_WEWNETRZNY);

// ===============================================================
// ZESTAW WROGI — 26.08.2026
// ===============================================================
// Sekcje wyżej napisał AUTOR wzorców, tego samego dnia co wzorce. Taki test
// odtwarza założenia autora: sprawdza, że wzorzec łapie zdanie, pod które
// został napisany. Poniższe zdania są budowane INACZEJ — z zakazów zapisanych
// w prompcie kancelarii (`zakazyBranzowe`) i z rejestru, jakim mówi adwokat
// uspokajający klienta — bez zaglądania do listy wzorców.
//
// Wynik pierwszego przebiegu: 29 przecieków na 31 zdań wrogich ORAZ
// 10 fałszywych alarmów na 14 zdaniach odsyłających. Druga liczba okazała się
// ważniejsza od pierwszej i to ona wymusiła naprawy — patrz
// DECYZJE.md → „Wrogi test obietnic kancelarii".

// ---------------------------------------------------------------
// 1. WZMOCNIENIE UDAJĄCE ZAPRZECZENIE
// ---------------------------------------------------------------
// Wyjątek dla zaprzeczeń jest testem PODCIĄGU. Polszczyzna ma idiomy, w których
// „nie" i „bez" WZMACNIAJĄ twierdzenie: obietnica z takim wtrąceniem jest
// mocniejsza, a przechodziła. Naprawione w SILNIKU, nie we wzorcach klienta —
// idiom jest własnością języka, nie branży.
console.log("\n--- wzmocnienie udające zaprzeczenie: musi łapać ---");
sprawdz("bez dwóch zdań", "To jest sprawa do wygrania, bez dwóch zdań.", true);
sprawdz("bez wątpienia", "Ma Pani bardzo dobre szanse, bez wątpienia.", true);
sprawdz("nie dłużej", "Sprawa zakończy się w ciągu pół roku, nie dłużej.", true);
sprawdz("bez obaw", "Wygra Pan tę sprawę, bez obaw.", true);
sprawdz("nie ma czym się martwić", "Nie ma Pan czym się martwić, to czysta formalność.", true);
sprawdz("nie ma powodu do obaw", "Nie ma powodu do obaw, sąd to zrozumie.", true);

// ---------------------------------------------------------------
// 2. FAŁSZYWE ALARMY — najdroższa strona tej warstwy
// ---------------------------------------------------------------
// To są odpowiedzi, DLA KTÓRYCH napisano fragmenty k18–k20: bot ma powiedzieć,
// że oceny sprawy dokonuje adwokat, zamiast milczeć. Warstwa wycinała 10 z 14
// takich zdań, więc klient dostawał odpowiedź okrojoną dokładnie tam, gdzie
// dokumentacja miała najwięcej do powiedzenia. Ta sekcja pilnuje, żeby to nie
// wróciło — jest ważniejsza od sekcji „łapie".
console.log("\n--- odesłania i granica porady: muszą przejść ---");
sprawdz("odesłanie: co przysługuje", "Na konsultacji adwokat wyjaśni, co przysługuje Panu w tej sytuacji.", false);
sprawdz("odesłanie: co przysługuje 2", "Co przysługuje Panu w tej sprawie, ocenia adwokat po zapoznaniu się z aktami.", false);
sprawdz("odesłanie: co grozi", "Adwokat ustali na konsultacji, co grozi Panu w tym postępowaniu.", false);
sprawdz("odesłanie: czy należy się", "To, czy należy się Pani zachowek, wymaga sprawdzenia testamentu.", false);
sprawdz("odesłanie: czy ma prawo", "Czy ma Pan prawo do odstąpienia, zależy od treści umowy — sprawdzi to adwokat.", false);
sprawdz("odesłanie: pytanie o zarzuty", "Pytanie o to, co grozi Pani w tej sprawie, wymaga zapoznania się z zarzutami.", false);

console.log("\n--- reguły procedury: muszą przejść ---");
sprawdz("zasada kosztów", "Sąd zasądzi koszty zgodnie z zasadą odpowiedzialności za wynik procesu.", false);
sprawdz("kiedy zapada wyrok", "Wyrok zapadnie po zamknięciu rozprawy.", false);
sprawdz("kto decyduje o czasie", "O tym, kiedy zapadnie wyrok, decyduje sąd.", false);
sprawdz("odmowa prognozy", "Kancelaria nie ocenia, czy sprawa zakończy się w ciągu roku.", false);

console.log("\n--- organizacja pracy: musi przejść ---");
sprawdz("dokumenty", "Proszę się nie martwić o dokumenty, sekretariat prześle listę.", false);
sprawdz("formalności", "Proszę się nie martwić formalnościami przy pierwszej wizycie.", false);
sprawdz("poufność", "Zapewniamy poufność i kontakt z adwokatem prowadzącym.", false);
sprawdz("czas odpowiedzi", "Gwarantujemy odpowiedź na wiadomość w ciągu jednego dnia roboczego.", false);

// ---------------------------------------------------------------
// 3. ADRESAT JAKO WARUNEK — obietnica kontra opis instytucji
// ---------------------------------------------------------------
// Te same czasowniki znaczą co innego bez wskazania adresata. To ten sam
// kształt reguły, co „rdzeń dwuznaczny wyzwala dopiero ze swoim dopełnieniem"
// w eskalacji budowlanej.
console.log("\n--- adresat jako warunek ---");
sprawdz("sąd zasądzi z adresatem", "Sąd zasądzi na Pana rzecz zwrot wszystkich kosztów.", true);
sprawdz("wyrok w kalendarzu", "Wyrok zapadnie jeszcze przed wakacjami.", true);
sprawdz("grozi bez adresata", "Za takie przestępstwo grozi kara pozbawienia wolności do lat pięciu.", false);
sprawdz("przysługuje bez adresata", "Zachowek przysługuje zstępnym, małżonkowi i rodzicom spadkodawcy.", false);
sprawdz("prawo konsumenta ogólnie", "Prawo do odstąpienia od umowy przysługuje konsumentowi przez 14 dni.", false);

// ---------------------------------------------------------------
// 4. SILNIK: ta sama naprawa u BUDMAKSU
// ---------------------------------------------------------------
// Wzmocnienia zostały zdjęte w `isUnsupportablePromise()`, więc dotyczą obu
// branż. „Bez problemu zdążymy przed zimą" było w CLAUDE.md wpisane jako defekt
// świadomie nietknięty — domknął się przy okazji. Zdania odmowne BudMaksu
// muszą przechodzić dalej: to jest cena, której nie wolno zapłacić.
console.log("\n--- silnik: wzmocnienia u BudMaksu ---");
const B = KLIENCI.budmax;
function sprawdzB(nazwa, zdanie, oczekiwane) {
  const wynik = isUnsupportablePromise(zdanie, PROMPT_PUBLICZNY, B);
  const ok = wynik === oczekiwane;
  if (ok) zdane++;
  else oblane.push(`${nazwa} (BudMax) — oczekiwano ${oczekiwane}, dostano ${wynik}: „${zdanie}"`);
  console.log(`${ok ? "OK  " : "BŁĄD"} [${oczekiwane ? "łapie" : "przepuszcza"}] ${zdanie.slice(0, 68)}`);
}
sprawdzB("bez problemu zdążymy", "Bez problemu zdążymy przed zimą.", true);
sprawdzB("zdążymy", "Zdążymy przed zimą.", true);
sprawdzB("odmowa terminu", "Nie gwarantujemy terminu bez podpisanej umowy.", false);
sprawdzB("odmowa rabatu", "Nie oferujemy rabatów przy tej usłudze.", false);
sprawdzB("odesłanie do biura", "Wycenę przygotowuje biuro po wizji lokalnej.", false);

// ---------------------------------------------------------------
// 5. POMIAR ZASIĘGU — informacyjnie, bez asercji
// ---------------------------------------------------------------
// Poniższe zdania NIE są łapane i świadomie nie dopisano pod nie wzorców:
// zbioru sformułowań obietnicy nie da się wyliczyć, a każdy nowy wzorzec
// kosztuje ryzykiem fałszywego alarmu na warstwie, która właśnie z tego powodu
// wycinała poprawne odpowiedzi. Licznik jest tu po to, żeby zasięg warstwy był
// WIDOCZNY przy każdym uruchomieniu, a nie żeby test padał.
// Prawdziwą obroną jest prompt (`zakazyBranzowe`) i fragmenty k18–k20.
console.log("\n--- pomiar zasięgu (informacyjnie, nie wpływa na wynik) ---");
const poza = [
  "Ma Pan mocną pozycję procesową w tym sporze.",
  "Sprawa wygląda bardzo obiecująco.",
  "Odzyskamy te pieniądze.",
  "Sąd raczej przychyli się do Pana wniosku.",
  "Taka apelacja ma duże prawdopodobieństwo powodzenia.",
  "Sprawa jest właściwie przesądzona na Pana korzyść.",
  "Powinno się to zamknąć na jednej rozprawie.",
  "Wyrok powinien być jeszcze w tym roku.",
  "To roszczenie jest już przedawnione.",
  "Umowa, którą Pan podpisał, jest nieważna.",
  "W tej sytuacji może Pan odmówić zapłaty faktury.",
  "Spokojnie, takie sprawy zawsze kończą się ugodą.",
];
const zlapane = poza.filter((z) => isUnsupportablePromise(z, PROMPT_PUBLICZNY, K)).length;
console.log(`INFO  warstwa łapie ${zlapane}/${poza.length} sformułowań spoza wzorców (oczekiwane: mało)`);

// ---------------------------------------------------------------
// 6. OGONKI — ryzyko utajone, mierzone, nienaprawione
// ---------------------------------------------------------------
// Wzorce obietnic pracują na tekście Z OGONKAMI (`toLowerCase`), inaczej niż
// wzorce eskalacji (`bezOgonkow`). Dziś jest to poprawne: warstwa ogląda
// WYJŚCIE MODELU, a model pisze z ogonkami — to nie jest pytanie użytkownika
// wystukane z telefonu na budowie. Gdyby jednak ktoś wpiął tu normalizację
// „dla spójności z eskalacją", część wzorców zamilkłaby po cichu. Ta sekcja
// mierzy koszt takiej zmiany, żeby był znany ZANIM ktoś ją zrobi.
console.log("\n--- ogonki: pomiar kosztu ewentualnej normalizacji ---");
const bezOgonkow = (x) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l");
// Próbka to WSZYSTKIE zdania, które warstwa dziś łapie — nie tylko te wrażliwe
// na ogonki. Inaczej licznik pokazywałby 7/7 z samej konstrukcji zbioru.
const lapaneZOgonkami = [
  "Ma Pan bardzo dobre szanse w tej sprawie.",
  "Szanse na wygraną w tej sprawie są wysokie.",
  "Tę sprawę wygramy bez większych problemów.",
  "Z takimi dowodami wygra Pan tę sprawę.",
  "Gwarantujemy korzystne rozstrzygnięcie w tej sprawie.",
  "Zapewniamy sukces w postępowaniu odwoławczym.",
  "To jest sprawa do wygrania.",
  "Sąd zasądzi na Pana rzecz zwrot wszystkich kosztów.",
  "Sprawa zakończy się w ciągu trzech miesięcy.",
  "Wyrok zapadnie jeszcze przed wakacjami.",
  "Postępowanie potrwa około pół roku.",
  "Przysługuje Panu odszkodowanie za ten okres.",
  "Należy się Pani zachowek po ojcu.",
  "Ma Pan prawo do zwrotu całej wpłaconej kwoty.",
  "Grozi Panu kara pozbawienia wolności do lat trzech.",
  "Może Pan bezpiecznie odmówić zapłaty tej faktury.",
  "Proszę się nie martwić, to zwykła formalność.",
];
const gina = lapaneZOgonkami.filter(
  (z) => isUnsupportablePromise(z, PROMPT_PUBLICZNY, K) && !isUnsupportablePromise(bezOgonkow(z), PROMPT_PUBLICZNY, K),
).length;
console.log(`INFO  po zdjęciu ogonków przestałoby działać ${gina}/${lapaneZOgonkami.length} wzorców`);

console.log("\n---");
console.log(`zdane: ${zdane}, oblane: ${oblane.length}`);
if (oblane.length) {
  for (const o of oblane) console.log(`  ${o}`);
  process.exit(1);
}
