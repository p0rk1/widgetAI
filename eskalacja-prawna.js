// eskalacja-prawna.js — SŁOWNIK BRANŻOWY warstwy eskalacji dla kancelarii.
//
// CO TU JEST, A CZEGO TU NIE MA
// Tylko wzorce i teksty. Mechanizm (weto ramy informacyjnej, zasada „rdzeń
// dwuznaczny wyzwala dopiero ze swoim dopełnieniem", rozstrzyganie przy wielu
// trafieniach, pozycja ramki) został w worker.js i jest wspólny z budowlanką.
//
// CO JEST TU ODPOWIEDNIKIEM WYPADKU — I DLACZEGO NIE JEST NIM „SPRAWA KARNA"
// Kategorie NIE powstały przez analogię do budowy. Pytanie brzmiało: co w tej
// branży jest NIEODWRACALNE i kosztuje najwięcej, gdy zostanie przeoczone.
// Odpowiedź jest inna niż na budowie, bo tu nikt nie leży na ziemi:
//
// 1. TERMIN PROCESOWY, który upływa albo już upłynął. To jest tutejszy wypadek:
//    po jego przekroczeniu sprawy nie da się naprawić dobrą pracą, a jedyne
//    wyjście — wniosek o przywrócenie terminu — ma własny, tygodniowy termin
//    i własne przesłanki. Koszt przeoczenia jest całkowity i natychmiastowy.
// 2. ZATRZYMANIE, gdzie terminy liczy się w godzinach, nie w dniach.
// 3. ZAGROŻENIE OSOBY, gdzie stawką jest bezpieczeństwo, nie sprawa.
//
// UWAGA NA RÓŻNICĘ, KTÓRA NIE PRZENIOSŁA SIĘ Z BUDOWLANKI
// U BudMaksu wyzwalaczem jest ZDARZENIE („spadł", „krwawi"). Tutaj przy terminie
// zdarzeniem NIE jest samo istnienie terminu — pytania o terminy to najczęstsze
// pytania zespołu i ramka przy każdym z nich nauczyłaby ją ignorować. Wyzwala
// dopiero BLISKOŚĆ albo NARUSZENIE terminu: „jutro", „został jeden dzień",
// „minął", „po terminie". Dlatego `termin_procesowy` jest kategorią pilną,
// a mimo to wymaga drugiego sygnału — czego na budowie nie robi żadna kategoria
// pilna. Weto ramy informacyjnej i tak jej nie dotyczy, więc „ile mam czasu na
// apelację" nie wyzwoli ramki przez brak sygnału bliskości, a nie przez weto.
//
// Wszystkie wzorce zapisane BEZ OGONKÓW i małymi literami — tekst przechodzi
// przez bezOgonkow(). Granicy wyrazu pilnuje `(?<![a-z0-9])`, nie `\b`.

// DOPEŁNIENIA rdzeni dwuznacznych — warunki, nie listy sformułowań.

// Czynności i pisma procesowe. Rdzeń `termin` bez tego dopełnienia znaczy
// w kancelarii najczęściej „termin spotkania" albo „termin płatności".
const CZYNNOSC_PROCESOWA = /(?<![a-z0-9])(apelacj|zazalen|sprzeciw|zarzut|odwolani|kasacj|skarg|uzasadnieni|pozew|pozwu|odpowiedz na pozew|wniosk|pism[aoieu]|sad|sadu|sadem|sadzie|prokuratur|rozpraw|nakaz|wyrok|postanowieni|doreczen)/;

// Bliskość albo naruszenie terminu. To jest właściwy wyzwalacz tej kategorii.
// Świadomie NIE ma tu samego „uplywa" ani „konczy sie": „kiedy upływa termin
// na apelację" to pytanie o regułę, nie o sprawę, która się pali.
const PILNOSC_TERMINU = /(?<![a-z0-9])(dzis|dzisiaj|jutro|wczoraj|ostatni dzien|zostal[oy]? (jeden|dwa|trzy|\d+) dni|zostal jeden dzien|za (jeden|dwa|trzy|\d+) dni|minal|minelo|po terminie|przekroczy|przekroczyl|przegapi|przeoczy|nie zdazy|zdazymy|za pozno|uchybi|przywrocenie terminu|w ostatniej chwili)/;

// Organ, który zatrzymuje. „Zatrzymać" bez niego znaczy w kancelarii
// „zatrzymać fakturę", „zatrzymaj wypłatę", „zatrzymajmy się na tym".
const ORGAN_SCIGANIA = /(?<![a-z0-9])(policj|prokurator|cba(?![a-z])|abw(?![a-z])|kas[ay] skarbow|straz granicz|komisariat|areszt|izb[ay] zatrzyman|konwoj)/;

// Osoba, wobec której coś się dzieje. Świadomie węższa niż budowlana OFIARA:
// w kancelarii „klient" występuje w każdym zdaniu, więc sam nie wystarcza.
const OSOBA_ZAGROZONA = /(?<![a-z0-9])(zon[aeęy]|mez|meza|mezem|maz|partner|konkubent|ojciec|ojca|matk|dziecko|dziecka|dzieci|corka|corki|syn[aeu]?(?![a-z])|rodzin|bylym?|byla zona|sasiad|tesc|brat|siostr)/;

const KATEGORIE_ESKALACJI_PRAWNE = [
  {
    id: "termin_procesowy",
    pilne: true,
    // Domena terminowa — sama w sobie NIE wystarcza, patrz drugiSygnal.
    // Bez samego rdzenia `termin` — jest wyłącznie dwuznaczny, patrz niżej.
    // Z nim w tej linii „termin płatności faktury minął" dostawałby ramkę procesową.
    zdarzenie: /(?<![a-z0-9])(apelacj|zazalen|sprzeciw|zarzut|odwolani|kasacj|uzasadnieni|nakaz zaplaty|doreczen)/,
    // Rdzenie dwuznaczne: „termin" i „sprawa" to najczęstsze słowa w kancelarii
    // i same nie znaczą nic pilnego. „Termin spotkania z klientem w piątek"
    // i „termin płatności faktury" nie mogą wyzwalać ramki procesowej.
    dwuznaczne: [
      { wzorzec: /(?<![a-z0-9])termin/, kontekst: () => CZYNNOSC_PROCESOWA },
    ],
    // TO jest wyzwalacz: bliskość albo naruszenie. Bez tego kategoria milczy,
    // także przy pytaniu wprost o długość terminu.
    drugiSygnal: PILNOSC_TERMINU,
    tekst: `NAJPIERW POWIADOM: dzwoń natychmiast do adwokata prowadzącego, a przy jego nieobecności do wspólnika dyżurnego — zanim wykonasz cokolwiek z poniższego. Terminu procesowego nie ustalasz ani nie odpuszczasz sam: o treści pisma i o drodze jego złożenia decyduje adwokat prowadzący. Nie ustalaj z klientem, że pismo złożymy później.`,
  },
  {
    id: "zatrzymanie",
    pilne: true,
    // Jednoznaczne: w kancelarii nie znaczą nic innego.
    zdarzenie: /(?<![a-z0-9])(aresztowan|tymczasowe aresztowanie|doprowadzeni do sadu|przeszukani|postawiono zarzuty|postawili zarzuty|w charakterze podejrzanego|48 godzin|na dolku|izbie zatrzyman|nakaz doprowadzenia|list gonczy|poszukiwan listem)/,
    dwuznaczne: [
      { wzorzec: /(?<![a-z0-9])zatrzyma/, kontekst: () => ORGAN_SCIGANIA },
      { wzorzec: /(?<![a-z0-9])(zabrala|zabrali|wezwal[ai]?)/, kontekst: () => ORGAN_SCIGANIA },
    ],
    tekst: `NAJPIERW POWIADOM: dzwoń do adwokata prowadzącego natychmiast, o każdej porze — przy zatrzymaniu terminy liczy się w godzinach, nie w dniach. Zapisz godzinę zatrzymania i jednostkę, w której osoba przebywa. Nie ustalaj niczego z organem samodzielnie i nie przekazuj informacji rodzinie bez zgody adwokata.`,
  },
  {
    id: "zagrozenie_osoby",
    pilne: true,
    zdarzenie: /(?<![a-z0-9])(przemoc domow|niebiesk[aą]? kart|pobil|pobicie|dusil|udusi|nekan|neka(?![a-z])|nekaj|stalking|gwalt|zgwalc|molestowan|samobojcz|odebrac sobie zycie|boi sie o zycie|boi sie wrocic|ucieka z domu|nakaz opuszczenia|zakaz zblizania|schronisk|osrodek interwencji)/,
    // „Grozi" jest dwuznaczne w sposób szczególnie mylący w tej branży:
    // „grozi mu kara pozbawienia wolności" to opis sytuacji procesowej, nie
    // zagrożenie osoby. Dopełnieniem jest CZŁOWIEK, nie sankcja.
    dwuznaczne: [
      { wzorzec: /(?<![a-z0-9])(grozi|grozb|grozil)/, kontekst: () => OSOBA_ZAGROZONA },
      { wzorzec: /(?<![a-z0-9])(bije|bil |pobi)/, kontekst: () => OSOBA_ZAGROZONA },
    ],
    // TEKST DLA KLIENTA, nie dla zespołu — jedyna kategoria z ramką publiczną.
    // Powód jest zmierzony: 22.08.2026 osoba pytająca „mąż mi grozi, boję się
    // wrócić do domu" dostała odpowiedź, z której warstwa liczb wycięła numer
    // alarmowy, bo `112` nie występuje w dokumentacji kancelarii. Ramka nie
    // przechodzi przez weryfikację, więc nie ma jej jak wyciąć.
    publiczna: `JEŻELI JESTEŚ W NIEBEZPIECZEŃSTWIE: zadzwoń pod numer alarmowy 112. Jeżeli zagrożenie trwa albo boisz się wrócić do domu, zrób to najpierw — sprawy prawne można załatwić później, bezpieczeństwa nie da się odzyskać. Całodobowa Niebieska Linia dla osób doświadczających przemocy: 800 120 002.`,
    tekst: `NAJPIERW BEZPIECZEŃSTWO: jeżeli zagrożenie trwa, przekaż numer alarmowy 112 i nie kończ rozmowy, dopóki nie ustalisz, że rozmówca jest bezpieczny i ma się gdzie schronić. Zaraz potem powiadom adwokata prowadzącego, a przy jego nieobecności wspólnika dyżurnego — nie odkładaj na następny dzień roboczy. Nie oceniaj kwalifikacji prawnej zdarzenia ani jego skutków.`,
  },
  {
    id: "konflikt_interesow",
    pilne: false,
    zdarzenie: /(?<![a-z0-9])(konflikt interes|druga strona|strona przeciwna|przeciwnik|reprezentowalismy|prowadzilismy sprawe|ta sama sprawa|po drugiej stronie|przeciwko (naszemu|nasze[jy]|bylemu|byle[jy]))/,
    drugiSygnal: /(?<![a-z0-9])(czy mog|czy mozemy|przyjac|poprowadz|prowadzic|umowic|reprezentowa|zglosil sie|zglosila sie|przyszedl|przyszla|dzwoni|prosi o)/,
    tekst: `SKIERUJ DO PRZEŁOŻONEGO: nie umawiaj konsultacji i nie wykonuj w sprawie żadnych czynności merytorycznych. Zgłoś sprawę adwokatowi prowadzącemu rejestr klientów tego samego dnia — ocena, czy konflikt zachodzi, należy do adwokata, nie do sekretariatu. Nie zestawiaj w rozmowie okoliczności obu spraw.`,
  },
  {
    id: "poza_kompetencjami",
    pilne: false,
    zdarzenie: /(?<![a-z0-9])(patent|wzoru uzytkowego|znak[a-z]* towarow|wlasnosc przemyslow|prawo morsk|doradztwo podatkowe|optymalizacj|rozliczenia miedzynarodow|ceny transferow|europejski trybunal|strasburg|obsluga korporacyjn)/,
    drugiSygnal: /(?<![a-z0-9])(czy mog|czy mozemy|czy przyjmujemy|przyjac|poprowadz|prowadzimy|klient pyta|zglosil sie|zglosila sie|co powiedziec)/,
    tekst: `SKIERUJ DO PRZEŁOŻONEGO: nie podejmuj się sprawy nawet wstępnie i nie udzielaj informacji merytorycznej z dziedziny, której kancelaria nie prowadzi. Sprawdź w sprawie wyłącznie jedno — czy biegnie w niej termin — i przekaż zgłoszenie adwokatowi prowadzącemu.`,
  },
  {
    id: "porada_dla_nieklienta",
    pilne: false,
    zdarzenie: /(?<![a-z0-9])(nie jest naszym klientem|nie jestesmy pelnomocnik|obca osoba|ktos dzwoni|dzwoni (mama|matka|zona|maz|brat|siostra|ojciec|rodzina|pracodawca|syn|corka)|rodzina klienta|dziennikar|media|redakcj|znajomy klienta)/,
    drugiSygnal: /(?<![a-z0-9])(pyta|prosi o porad|prosi o informacj|chce wiedziec|co mam powiedziec|czy moge powiedziec|czy mozna powiedziec|udzielic informacji|potwierdzic|czy jest naszym klientem)/,
    tekst: `SKIERUJ DO PRZEŁOŻONEGO: nie udzielaj informacji o sprawie i nie potwierdzaj ani nie zaprzeczaj, że ktokolwiek jest klientem kancelarii — sam ten fakt objęty jest tajemnicą. Zaproponuj konsultację na nazwisko rozmówcy, a pytanie przekaż adwokatowi prowadzącemu.`,
  },
  {
    id: "decyzja_finansowa",
    pilne: false,
    // Kategoria finansowa nie jest kalką z budowlanki: kancelaria ma własne
    // progi (wydatek 1000 zł, obniżka honorarium 10%) opisane w ki22, a koszt
    // pomyłki jest realny — obniżka obiecana klientem przed zgodą wspólnika
    // zarządzającego jest już nie do cofnięcia bez utraty zaufania.
    zdarzenie: /(?<![a-z0-9])(honorari|zaliczk|faktur|rabat|obnizk|obniz|raty|ratach|wydatek|wydatk|kwot|zlot|procent|stawk)/,
    drugiSygnal: /(?<![a-z0-9])(czy mog|czy mozemy|mam prawo|zgod[aey]|zatwierdz|decyduj|odstapi|rozlozyc|umorzy|zrezygnowa)/,
    prog: true,
    tekst: `SKIERUJ DO PRZEŁOŻONEGO: tej decyzji nie podejmujesz sam. Zgodę wydaje osoba wskazana w progach decyzyjnych — uzyskaj ją PRZED rozmową z klientem, nie po niej.`,
  },
  {
    id: "ustepstwo_wobec_klienta",
    pilne: false,
    // OSOBNA KATEGORIA, NIE WARIANT POWYŻSZEJ — i to jest wniosek o silniku,
    // nie o kancelarii. Flaga `prog` działa na CAŁĄ kategorię, więc kategoria
    // z progiem milczy przy zgłoszeniu, w którym żadna liczba nie pada.
    // Tymczasem „rozłożenie honorarium na raty" i „odstąpienie od zaliczki"
    // wymagają zgody wspólnika zarządzającego niezależnie od kwoty (ki22).
    // W budowlance ten kształt się nie ujawnił, bo tam każde ustępstwo miało
    // postać liczby: procent rabatu albo złotówki zakupu.
    zdarzenie: /(?<![a-z0-9])(na raty|w ratach|rozlozenie|rozlozyc|odstapi(c|enie|my)? od zaliczki|bez zaliczki|umorz|darmow|pro bono|zrezygnowa(c|c z)? (z )?(honorari|zaliczk|oplat))/,
    drugiSygnal: /(?<![a-z0-9])(czy mog|czy mozemy|mam prawo|zgod[aey]|zatwierdz|decyduj|obieca|klient prosi|klient chce)/,
    tekst: `SKIERUJ DO PRZEŁOŻONEGO: ustępstwa wobec klienta nie uzgadniasz sam. Zgodę wydaje wspólnik zarządzający — uzyskaj ją PRZED rozmową z klientem, nie po niej, bo obietnicy raz złożonej nie da się cofnąć bez utraty zaufania.`,
  },
];

// PROGI DECYZYJNE — z fragmentu ki22: wydatek do 1000 zł i obniżka honorarium
// do 10 procent nie wymagają zgody wspólnika zarządzającego.
const PROGI_DECYZYJNE = { procent: 10, kwota: 1000 };

// Osoba, do której kieruje ramka. Nazwa jest branżowa — w kancelarii nie ma
// kierownika budowy, a przy nieobecności adwokata prowadzącego rolę przejmuje
// wspólnik dyżurny, co jest wpisane w teksty ramek pilnych.
const KONTAKT = "adwokat prowadzący sprawę";

export const ESKALACJA_PRAWNA = {
  kontakt: KONTAKT,
  kategorie: KATEGORIE_ESKALACJI_PRAWNE,
  progi: PROGI_DECYZYJNE,
};
