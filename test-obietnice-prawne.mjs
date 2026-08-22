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

console.log("\n---");
console.log(`zdane: ${zdane}, oblane: ${oblane.length}`);
if (oblane.length) {
  for (const o of oblane) console.log(`  ${o}`);
  process.exit(1);
}
