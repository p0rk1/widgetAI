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
// Wszystkie wzorce są zapisane BEZ OGONKÓW i małymi literami — porównywane
// z pytaniem przepuszczonym przez bezOgonkow(). Powód: pracownik pisze z telefonu
// na budowie („zlamal noge", „grozi sadem"). Granicy wyrazu pilnuje
// `(?<![a-z0-9])`, nie `` — `` w JavaScripcie zna wyłącznie ASCII.

// DOPEŁNIENIA rdzeni dwuznacznych. To warunki, nie listy sformułowań wypadku:
// wypadków wyliczyć się nie da, części ciała i wysokości owszem. Rozstrzyga
// DOPEŁNIENIE — czym jest to, co zostało złamane, potrącone albo z czego ktoś
// spadł. Dlatego każdy rdzeń ma własny warunek, a nie wspólną listę.
const CIALO = /(?<![a-z0-9])(nog[aeię]|rek[aeęi]|reka|dlon|palec|palca|palce|glow[aęy]|stop[aeęy]|kregoslup|zebro|zebra|obojczyk|kostk|kolano|bark|nadgarstek|kark|klatk|oko|oczy|plecy|czaszk|krwi|krew|ran[aęy]|opatrun|szpital|karetk|pogotowi|bol[iu]|zwichn|siniak)/;
const OFIARA = /(?<![a-z0-9])(pracownik|pracownic|koleg|brygadzist|majstr|majster|monter|murarz|ciesl|elektryk|dekarz|operator|mlod|czlowiek|osob|poszkodowan|kogos|ktos)/;
const WYSOKOSC = /(?<![a-z0-9])(rusztowani|drabin|dach|stropu|stropie|wysokosc|pietr|schod|podest|wykop|pomost)/;
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
    zdarzenie: /(?<![a-z0-9])(wypad(ek|ku|kiem|ki)|poszkodowan|uraz(?![ae])|doznal|ranny|zrani|skalecz|przygniot|poparz|oparzen|krwaw|krwotok|(?<!zimna )(krew|krwi)(?! z nosa)|ran[aey]|rozcie(c|t)|obrazen|opatrun|nadzia|nieprzytomn|stracil przytomnosc|zaslab|zemdla|karetk|pogotowi)/,
    // Rdzenie DWUZNACZNE — te same litery znaczą na budowie coś innego:
    // „potrącimy z faktury", „złamał procedurę", „ma do mnie urazę", „koszt
    // spadł z 40 zł". Zmierzone 21.08.2026: siedem na dziesięć zwykłych zdań
    // z budowy dostawało ramkę PILNE. Dlatego wyzwalają dopiero z drugim
    // sygnałem — obecnością człowieka albo części ciała.
    // Każdy rdzeń z własnym warunkiem — patrz CIALO / OFIARA / WYSOKOSC wyżej.
    dwuznaczne: [
      { wzorzec: /(?<![a-z0-9])zlama/, kontekst: () => CIALO },
      { wzorzec: /(?<![a-z0-9])potrac/, kontekst: () => OFIARA },
      { wzorzec: /(?<![a-z0-9])(spadl z|upadl z|spadl ze|upadl ze)/, kontekst: () => WYSOKOSC },
    ],
    tekst: `NAJPIERW POWIADOM: przy urazie zagrażającym życiu dzwoń pod 112, zaraz potem do kierownika budowy — zanim wykonasz cokolwiek z poniższego. Wypadku nie rozliczasz sam: o zgłoszeniach i terminach decyduje kierownik budowy.`,
  },
  {
    id: "zagrozenie_zycia",
    pilne: true,
    zdarzenie: /(?<![a-z0-9])(zagrozenie zycia|zagraza zyciu|nie oddycha|reanimac|pozar|pali sie|ulatnia sie|(czuc|zapach|wyciek|ulatnia).{0,20}gaz|porazeni|porazi|iskrzy|grozi zawaleniem|osuna|osune|osunal|zerwal sie|urwal sie|uwiezion|przysypa|zasypa)/,
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
