// eskalacja-budowlana.js — SŁOWNIK BRANŻOWY warstwy eskalacji dla budownictwa.
//
// CO TU JEST, A CZEGO TU NIE MA
// Tu mieszkają wyłącznie WZORCE I TEKSTY — to, co zmienia się razem z branżą.
// Mechanizm został w worker.js i jest wspólny dla wszystkich klientów: weto ramy
// informacyjnej, zasada „rdzeń dwuznaczny wyzwala dopiero ze swoim dopełnieniem",
// rozstrzyganie przy wielu trafieniach (pilne → liczba sygnałów → kolejność)
// i pozycja ramki wobec treści. Rozdzielenie zrobione 21.08.2026 przy dodawaniu
// drugiego klienta — i jest zarazem odpowiedzią na pytanie, ile z tej warstwy
// było protezą pod budowlankę: proteza to ten plik, reszta została.
//
// KOŃCÓWKA OSOBOWA — reguła z 24.08.2026, łamana najłatwiej ze wszystkich.
// Polski czas przeszły to RDZEŃ + „ł" + końcówka osoby: spadł, spadła, spadło,
// spadłem, spadli. Po zdjęciu ogonków „ł" jest zwykłym „l", więc rdzeń zapisany
// do samego „l" (`zlama`, `doznal`, `przygniot`) pokrywa CAŁY paradygmat —
// pierwszą osobę i formę bezosobową także. Wzorzec psuje się dopiero wtedy, gdy
// PO tym „l" doklei się cokolwiek na sztywno: spację, przyimek albo „sie".
// `spadl z` znało wyłącznie trzecią osobę, więc „spadlem z rusztowania" nie
// wyzwalało niczego — a to właśnie tak pisze ten, komu się stało.
//
// REGUŁA: nigdy nie doklejaj niczego bezpośrednio za „l" czasu przeszłego.
// Wstaw między nie `[a-z]{0,4}` — tyle liczy najdłuższa końcówka osobowa
// („spadliśmy" to rdzeń + „ismy", „jebnąłem" to rdzeń + „alem").
// Zmierzone 24.08.2026: eskalacja wyzwalała się na 5 z 12 realnych zgłoszeń.
//
// Wszystkie wzorce są zapisane BEZ OGONKÓW i małymi literami — porównywane
// z pytaniem przepuszczonym przez bezOgonkow(). Powód: pracownik pisze z telefonu
// na budowie („zlamal noge", „grozi sadem"). Granicy wyrazu pilnuje
// `(?<![a-z0-9])`, nie `` — `` w JavaScripcie zna wyłącznie ASCII.

// DOPEŁNIENIA rdzeni dwuznacznych. To warunki, nie listy sformułowań wypadku:
// wypadków wyliczyć się nie da, części ciała i wysokości owszem. Rozstrzyga
// DOPEŁNIENIE — czym jest to, co zostało złamane, potrącone albo z czego ktoś
// spadł. Dlatego każdy rdzeń ma własny warunek, a nie wspólną listę.
// Rejestr POTOCZNY jest częścią tej listy od 24.08.2026 i to nie jest ozdobnik.
// Zmierzone: „pekla mi dupa" nie dostawało ramki ani odpowiedzi, bo słownik znał
// wyłącznie nazwy z orzeczenia lekarskiego. Człowiek z urwanym palcem nie pisze
// „doznałem urazu kończyny górnej". Lista części ciała jest skończona — lista
// sposobów ich nazwania w rejestrze potocznym też, i dlatego wolno ją wyliczyć.
const CIALO = /(?<![a-z0-9])(nog[aei]|rek[aei]|reka|dlon|palec|palca|palce|kciuk|glow[aey]|leb(?![a-z])|lba|lbie|stop[aey]|kregoslup|zebro|zebra|obojczyk|kostk|kolano|bark|ramie|ramien|nadgarstek|lokie|lokc|kark|klatk|oko|oczy|ucho|plecy|czaszk|biodr|lydk|udo(?![a-z])|golen|pieta|piet[ey]|brzuch|dup[aeoy]|grab[ay]|kulas|kutas|krwi|krew|ran[aey]|opatrun|szpital|karetk|pogotowi|bol[iu]|zwichn|siniak)/;
// Uwaga na CELOWNIK OSOBY („urwało MI palec"). Kusi, żeby dopisać tu „mi|mu|nam",
// bo to on niesie informację, KOMU się stało — ale nie niesie informacji, CZY się
// stało: „potrącą mi z wypłaty" ma ten sam celownik co „urwało mi palec".
// Celownik odpowiada na pytanie KTO, a rozstrzygać ma CZY — i to robi część ciała.
// Dlatego konstrukcje bezosobowe z celownikiem obsługuje dopełnienie CIALO,
// a nie zaimek. Sprawdzone na zestawie negatywnym 24.08.2026.
const OFIARA = /(?<![a-z0-9])(pracownik|pracownic|koleg|koledz|brygadzist|majstr|majster|monter|murarz|ciesl|elektryk|dekarz|operator|mlod|czlowiek|osob|poszkodowan|kogos|ktos)/;
const WYSOKOSC = /(?<![a-z0-9])(rusztowani|drabin|dach|stropu|stropie|wysokosc|pietr|schod|podest|wykop|pomost)/;
// Upadek z wysokości i uderzenie ciała to ta sama klasa zdarzeń opisywana raz
// przez miejsce, raz przez skutek — stąd jedno dopełnienie złożone z obu.
const CIALO_LUB_WYSOKOSC = new RegExp(`${CIALO.source}|${WYSOKOSC.source}`);

const PODMIOT_KONSTRUKCJA = /(?<![a-z0-9])(scian|strop|wykop|skarp|rusztowani|budynek|budynku|budynkiem|dach|mur|nasyp|szalunek|szalunk|konstrukcj|belk|nadproz)/;

const KATEGORIE_ESKALACJI_BUDOWLANE = [
  {
    id: "wypadek",
    pilne: true,
    // Słownictwo ZDARZENIOWE, nie tematyczne. Nie ma tu „rusztowania",
    // „wysokości" ani „szkolenia" — to tematy, przy których nikt nie leży
    // na ziemi. Właśnie ta różnica ma odsiewać fałszywe wyzwolenia.
    // Rdzenie JEDNOZNACZNE — wyzwalają same, bo w mowie budowlanej nie znaczą
    // nic innego niż zdarzenie z człowiekiem.
    // `uraz(?![ae])` rozbraja homonim morfologicznie, nie kontekstem: uraz jako
    // szkoda na zdrowiu odmienia się „uraz/urazu/urazie", a uraza jako pretensja
    // — „uraza/urazę" (po zdjęciu ogonków: „uraze"). Warunek kontekstowy był tu
    // za wąski: „Pracownika ukąsiła żmija, doznał urazu" nie nazywa części ciała.
    // RZECZOWNIKI URAZOWE dodane 21.08.2026. Wzorzec miał wyłącznie rdzenie
    // czasownikowe i przymiotnikowe (`krwaw` łapie „krwawi"), więc gubił
    // najczęstszą formę potoczną: „leci krew". Pytanie o gwóźdź w stopie nie
    // zawierało ani nazwy urazu, ani rdzenia `krwaw` — tylko rzeczownik.
    //
    // `krew` NIE wymaga warunku kontekstowego jak rdzenie dwuznaczne: sam
    // rzeczownik wystarcza, bo poza dwoma idiomami nie znaczy nic innego.
    // Oba idiomy są wyłączone jawnie i zmierzone: „zachowaj zimną krew"
    // (rozmowa z klientem) oraz „krew z nosa" (byle na jutro).
    zdarzenie: /(?<![a-z0-9])(wypad(ek|ku|kiem|ki)|poszkodowan|uraz(?![ae])|doznal|ranny|zrani|skalecz|przygniot|poparz|oparzen|krwaw|krwotok|(?<!zimna )(krew|krwi)(?! z nosa)|ran[aey]|rozcie(c|t)|obrazen|opatrun|nadzia|nieprzytomn|stracil[a-z]{0,4} przytomnosc|zaslab|zemdla|karetk|pogotowi)/,
    // Rdzenie DWUZNACZNE — te same litery znaczą na budowie coś innego:
    // „potrącimy z faktury", „złamał procedurę", „ma do mnie urazę", „koszt
    // spadł z 40 zł". Zmierzone 21.08.2026: siedem na dziesięć zwykłych zdań
    // z budowy dostawało ramkę PILNE. Dlatego wyzwalają dopiero z drugim
    // sygnałem — obecnością człowieka albo części ciała.
    // Każdy rdzeń z własnym warunkiem — patrz CIALO / OFIARA / WYSOKOSC wyżej.
    dwuznaczne: [
      { wzorzec: /(?<![a-z0-9])zlama/, kontekst: () => CIALO },
      { wzorzec: /(?<![a-z0-9])potrac/, kontekst: () => OFIARA },
      // PRZYIMEK ZOSTAJE, KOŃCÓWKA SIĘ OTWIERA. „z/ze" niesie tu znaczenie —
      // odróżnia upadek Z wysokości od „spadła wydajność NA rusztowaniu"
      // i od „koszt spadł z 40 zł" (tam wetuje brak dopełnienia WYSOKOSC).
      // Otwiera się to, co niosło wyłącznie osobę: końcówka po „l".
      { wzorzec: /(?<![a-z0-9])((s|u)padl|zlecial|runal)[a-z]{0,4} ze?(?![a-z])/, kontekst: () => WYSOKOSC },
      // Drugie czytanie tego samego czasownika: nie „ktoś spadł Z czegoś", tylko
      // „coś spadło NA kogoś" — „spadł mi młotek na nogę". Przyimka nie ma czym
      // związać, więc rozstrzyga wyłącznie część ciała.
      { wzorzec: /(?<![a-z0-9])(s|u)padl[a-z]{0,4}(?![a-z])/, kontekst: () => CIALO },
      // KLASA CZASOWNIKÓW USZKODZENIA — konstrukcje bezosobowe z celownikiem
      // („urwało mi palec", „pękła mi ręka") i pierwszoosobowe („przyciąłem
      // sobie palec"). Sprawcy w zdaniu nie ma, poszkodowany jest — i to część
      // ciała, nie zaimek, rozstrzyga, czy mowa o urazie. Bez tego warunku
      // „urwało mi się połączenie" i „pękła mi opona" dostawałyby ramkę PILNE.
      // `urwa(?!nie)` rozbraja idiom „urwanie głowy" morfologicznie — tak samo
      // jak `uraz(?![ae])` rozbraja „urazę".
      { wzorzec: /(?<![a-z0-9])(urwa(?!nie)|pek|przycia|przytrzasn|zmiazdz|zgniot|uderzy|rozwali|skrec|przebi)/, kontekst: () => CIALO },
      // Ten sam kształt w rejestrze wulgarnym. To nie jest lista wyzwisk, tylko
      // klasa czasowników uderzenia i upadku — warunek jest ten sam co wyżej.
      // `zajeb(?!i)` odcina „zajebiście", które na budowie znaczy „dobrze".
      { wzorzec: /(?<![a-z0-9])(jebn|pierdoln|zajeb(?!i)|walna|przywali|rabn|huknal|gruchn)/, kontekst: () => CIALO },
      // …a przy upadku dopełnieniem jest miejsce, z którego się spadło.
      { wzorzec: /(?<![a-z0-9])(jebn|pierdoln|zajeb(?!i)|walna|rabn|gruchn)[a-z]{0,4} (sie )?ze?(?![a-z])/, kontekst: () => CIALO_LUB_WYSOKOSC },
    ],
    tekst: `NAJPIERW POWIADOM: przy urazie zagrażającym życiu dzwoń pod 112, zaraz potem do kierownika budowy — zanim wykonasz cokolwiek z poniższego. Wypadku nie rozliczasz sam: o zgłoszeniach i terminach decyduje kierownik budowy.`,
  },
  {
    id: "zagrozenie_zycia",
    pilne: true,
    zdarzenie: /(?<![a-z0-9])(zagrozenie zycia|zagraza zyciu|nie oddycha|reanimac|pozar|pali sie|ulatnia sie|(czuc|zapach|wyciek|ulatnia).{0,20}gaz|porazeni|porazi|iskrzy|grozi zawaleniem|osun|(ze|u)rwal[a-z]{0,4} sie|uwiezion|przysypa|zasypa)/,
    // „zawalił termin" i „ekipa zawaliła robotę" to najczęstsze zdania na
    // budowie, a nie katastrofa budowlana. Samo „grozi zawaleniem" zostaje
    // wyżej jako jednoznaczne.
    dwuznaczne: [
      { wzorzec: /(?<![a-z0-9])(zawali|zawal[ae])/, kontekst: () => PODMIOT_KONSTRUKCJA },
    ],
    tekst: `NAJPIERW POWIADOM: dzwoń pod 112, zaraz potem do kierownika budowy — natychmiast, zanim zrobisz cokolwiek innego. Przy bezpośrednim zagrożeniu życia decyzję podejmują służby i kierownik budowy, nie ten bot.`,
  },
  {
    id: "spor_prawny",
    pilne: false,
    zdarzenie: /(?<![a-z0-9])(grozi (sadem|pozwem)|pozew|pozwie|do sadu|roszczen|odszkodowan|zadoscuczynien|adwokat|radc[aey] prawn|kancelari|wezwanie do zaplaty|przedsadow|sprawa sadowa|poda[c] nas do sadu)/,
    tekst: `SKIERUJ DO PRZEŁOŻONEGO: nie odpowiadaj na roszczenie ani groźbę na własną rękę i nie składaj żadnych oświadczeń. Zgłoś sprawę kierownikowi budowy tego samego dnia — to on decyduje o kontakcie z biurem i obsługą prawną.`,
  },
  {
    id: "kontrola",
    pilne: false,
    // DWA sygnały naraz: organ ORAZ jego obecność albo żądanie. Sam „PIP"
    // w pytaniu o terminy zgłoszeń to pytanie o regułę, nie kontrola na placu.
    zdarzenie: /(?<![a-z0-9])(pip(?![a-z])|inspekcj[aie] pracy|inspektor(a|owi|em)? pracy|nadzor(u|owi|em)? budowlan|pinb(?![a-z])|sanepid|straz(y)? pozarn)/,
    // `zada` z ograniczonym ogonem, żeby „żąda" nie łapało „zadanie" i „zadaj".
    drugiSygnal: /(?<![a-z0-9])(przyjecha[l]|przysz(edl|la)|jest na budowie|na miejscu|kontrol|zada(c|l|la|ja)?(?![a-z])|wezwa|zjawi[l]|legitymuje|zabezpiecz(a|yl) dokument)/,
    tekst: `SKIERUJ DO PRZEŁOŻONEGO: rozmowę z kontrolą prowadzi wyłącznie kierownik budowy. Powiadom go natychmiast i nie ustalaj niczego z kontrolującym samodzielnie.`,
  },
  {
    id: "finanse_prog",
    pilne: false,
    // Trzy sygnały: pieniądze + decyzja + przekroczony próg z dokumentacji
    // (3% rabatu handlowca, 300 zł zakupu drobnego brygadzisty).
    zdarzenie: /(?<![a-z0-9])(rabat|upust|znizk|marz|zaliczk|gotowk|kwot|zlot|tysiecy|procent)/,
    drugiSygnal: /(?<![a-z0-9])(czy moge|mam prawo|moge (zejsc|dac|kupic|zamowic|udzielic)|czy dac|zatwierdz|akceptacj|zgod[aey]|decyduj|podpisa|obniz)/,
    prog: true,
    tekst: `SKIERUJ DO PRZEŁOŻONEGO: tej decyzji nie podejmujesz sam. Zgodę wydaje osoba wskazana w progach decyzyjnych — uzyskaj ją PRZED rozmową z klientem, nie po niej.`,
  },
];

// PROGI DECYZYJNE — kwota i procent, powyżej których decyzja nie należy już do
// pracownika. Pochodzą z fragmentów i39 i i41 (rabat handlowca 3%, zakup drobny
// brygadzisty 300 zł). Gdy zmienią się w treści, trzeba je zmienić także tutaj.
const PROGI_DECYZYJNE = { procent: 3, kwota: 300 };

// Osoba, do której kieruje ramka. Nazwa stanowiska jest branżowa — u kancelarii
// nie ma kierownika budowy.
const KONTAKT = "kierownik budowy";

export const ESKALACJA_BUDOWLANA = {
  kontakt: KONTAKT,
  kategorie: KATEGORIE_ESKALACJI_BUDOWLANE,
  progi: PROGI_DECYZYJNE,
};
