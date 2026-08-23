// klienci.js — TABLICA KLIENTÓW. Jedno miejsce, w którym mieszka wszystko,
// co zależy od firmy, a nie od produktu.
//
// PO CO TO ISTNIEJE I DOKĄD PROWADZI
// To jest pierwsza rata multi-tenanta, spłacona wcześniej niż reszta, bo bez
// niej nie da się odpowiedzieć na pytanie, ile zabezpieczeń tego projektu jest
// uniwersalnych, a ile było protezą pod budowlankę. Docelowo ta tablica staje
// się tabelą w D1, a `rozpoznajKlienta()` w worker.js — zapytaniem do niej.
// Reszta systemu nie widzi różnicy: nikt poza tą funkcją nie wie, skąd klient
// się wziął.
//
// KLIENT WYNIKA Z HOSTA — TAK SAMO JAK ROLA
// Nazwa klienta NIE PRZYCHODZI Z ŻĄDANIA: ani z ciała, ani z query, ani
// z nagłówka. To ta sama zasada, na której stoi separacja przestrzeni wiedzy,
// tylko w drugim wymiarze. Gdyby przychodziła z żądania, cała rozłączność
// klientów wisiałaby na poprawności sprawdzenia autoryzacji — czyli na kodzie,
// w którym da się zrobić błąd. Host spoza tej tablicy nie dostaje ŻADNEGO
// klienta i nie dostaje odpowiedzi.
//
// DWA WYMIARY PRZESTRZENI, NIE JEDEN
// `rodzaj` (public / internal) przychodzi z ROUTINGU i jest wpisany na sztywno.
// `klient` przychodzi z HOSTA. Fizyczna nazwa przestrzeni w Vectorize powstaje
// z obu, wewnątrz granicy dostawcy. Dzięki temu `askedFrom`, pole `space`
// w logu, filtr w /stats i tryb promptu zachowują dotychczasowe znaczenie.
//
// Nazwy przestrzeni są tu WPISANE JAWNIE, nie generowane ze wzorca. BudMax
// zostaje przy `public`/`internal` — dzięki temu zmiana nie wymaga reindeksu
// ani migracji istniejących wektorów na działającej produkcji. Niesymetrycznie,
// ale prawdziwie: w D1 i tak będzie to kolumna z konkretną wartością.

import { CHUNKS } from "./content-public.js";
import { INTERNAL_CHUNKS } from "./content-internal.js";
import { ESKALACJA_BUDOWLANA } from "./eskalacja-budowlana.js";
import { CHUNKS_KANCELARIA } from "./content-kancelaria-public.js";
import { INTERNAL_CHUNKS_KANCELARIA } from "./content-kancelaria-internal.js";
import { ESKALACJA_PRAWNA } from "./eskalacja-prawna.js";

// Zdanie odmowne. MUSI zawierać frazę „nie mam takich informacji" — handleAsk()
// rozpoznaje brak odpowiedzi wyrażeniem /nie mam takich informacji/i na surowym
// tekście modelu, więc inne sformułowanie po cichu rozjeżdża tę ścieżkę.
// Pilnuje tego asercja w worker.js, uruchamiana przy starcie modułu.
const FALLBACK_BUDMAX = "Nie mam takich informacji w mojej dokumentacji — polecam kontakt z biurem.";

export const KLIENCI = {
  budmax: {
    id: "budmax",
    nazwa: "BudMax Sp. z o.o.",
    branza: "budowlana",

    // Trzy hosty na klienta. `stare` to adresy, które mają dalej działać mimo
    // przeprowadzki na własną domenę — wpisane JAWNIE, bo dopasowanie hostów
    // jest dokładne i nic nie wpada tu przez przypadek.
    hosty: {
      publiczny: "budmax.know-base.app",
      pracownik: "budmax-pracownik.know-base.app",
      wlasciciel: "budmax-wlasciciel.know-base.app",
    },
    stare: {
      // Odwołują się do niego na sztywno index.html i panel.html (WORKER_URL).
      "knowbase-budmax.rezi7608.workers.dev": "publiczny",
    },

    // Nazwy zmiennych z [vars], nie ich wartości. AUD zależy od HOSTA: gdyby
    // Worker sprawdzał „którykolwiek ze znanych AUD-ów", token pracownika
    // otwierałby panel właściciela.
    audVars: {
      pracownik: "ACCESS_AUD",
      wlasciciel: "ACCESS_AUD_PANEL",
    },

    przestrzenie: { public: "public", internal: "internal" },
    tresc: { public: CHUNKS, internal: INTERNAL_CHUNKS },

    eskalacja: ESKALACJA_BUDOWLANA,

    // Wzorce obietnic działające WYŁĄCZNIE w trybie publicznym. Wspólne
    // (deklaracja wolnego terminu, „zdążymy") zostały w silniku — nie są
    // branżowe. Te są: rabat w hurtowni to proteza pod budowlankę, u kancelarii
    // groźne będzie co innego (szanse wygranej, „to się przedawni").
    obietnicePubliczne: [
      /(oferujemy|udzielamy|mamy|przysługuj|możemy zaoferować).{0,30}(rabat|zniżk|upust)/,
      /(rabat|zniżk|upust).{0,30}(oferujemy|udzielamy|możliwe|dostępn)/,
      /niższy vat|lepsze ceny w hurtown|taniej w hurtown/,
      /płacisz z góry|płatność z góry/,
    ],

    // Fragmenty promptów zależne od firmy i branży. RDZEŃ RZETELNOŚCI
    // (PROMPT_RDZEN) jest wspólny i nie ma tu czego szukać — tryb i branża
    // zmieniają to, co wolno powiedzieć rozmówcy, a nie to, czy wolno zmyślić.
    prompt: {
      fallback: FALLBACK_BUDMAX,
      opisFirmy: "firmą budowlaną",
      // Forma zwracania się do klienta. Przeniesiona tu 22.08.2026 z części
      // wspólnej promptu — reguła była kalibrowana na budowlance i dryfowała
      // u drugiego klienta (model pisał „Twojej sprawy" mimo zakazu).
      // TEKST BUDMAKSU JEST PRZEPISANY BEZ ZMIANY ANI JEDNEGO ZNAKU: prompt
      // publiczny ma wyjść z tej zmiany bajt w bajt taki sam.
      zwrotDoKlienta: `- Zwracaj się do klienta per Pan/Pani albo bezosobowo ("zapraszamy do kontaktu", "wycenę przygotowuje biuro"). NIGDY po imieniu ani na "ty" — to pierwszy kontakt z firmą budowlaną, nie rozmowa ze znajomym. Zachowaj uprzejmy, profesjonalny dystans.`,
      cenaDopisek: " Przy pytaniu o cenę bez pokrycia w dokumentacji — poinformuj, że wycenę przygotowuje biuro po wizji lokalnej.",
      rozroznienia: `Zachowaj szczególną ostrożność przy podobnie brzmiących, ale różnych usługach — to częsty błąd, którego musisz unikać:
- "ogród" (zieleń, rośliny, krajobraz) to NIE to samo co "ogrodzenie" (płot, brama, infrastruktura działki) — to dwie różne, osobno wycenione usługi.
- "wykonanie elewacji lub docieplenia" (prace wykończeniowe przy budowie albo osobne zlecenie remontowe) to NIE to samo co "konserwacja elewacji" w ramach serwisu pogwarancyjnego (utrzymanie budynku już przez nas wykonanego, po okresie gwarancji).
- "taras" nie jest wprost wymieniony w dokumentacji jako osobna usługa — nie zakładaj, że jest oferowany, chyba że fragment wyraźnie to potwierdza.
Zanim odpowiesz, sprawdź, czy fragment, z którego korzystasz, dotyczy DOKŁADNIE tej usługi, o którą pyta klient — nie tylko czy tytuł brzmi podobnie.`,
      zakazyBranzowe: [
        `- NIGDY nie deklaruj dostępności terminów ani nie obiecuj, że firma zdąży w oczekiwanym przez klienta czasie. Nie wiesz, jaki jest grafik ekip.`,
        `- NIGDY nie potwierdzaj przypuszczeń klienta o rabatach, zniżkach w hurtowniach czy stawkach podatkowych, nawet jeśli brzmią rozsądnie. Jeśli fragmenty tego nie mówią — nie mów tego.`,
        `- Nie myl gwarancji z rękojmią — to dwie różne instytucje opisane w osobnych fragmentach.`,
      ],
      // Tryb wewnętrzny — same przykłady i nazwy stanowisk. Struktura promptu
      // (kroki tylko przy procedurze, zachowanie adresata, linia „Podstawa:")
      // jest wspólna i została w silniku.
      przykladyRozkazow: `"przerwij pracę", "powiadom kierownika budowy", "zgłoś w raporcie tygodniowym do piątku do 14"`,
      przykladyRol: `kierownik budowy, brygadzista czy kadry`,
      przykladSprostowania: `na przykład "czego inspektor może żądać ODE MNIE", podczas gdy fragment mówi, że polecenia inspektora odbiera kierownik budowy`,
      przykladyNeutralne: `"kto może wpisywać do dziennika", "kto zamawia materiał"`,
      stawkaWewnetrzna: `przy BHP i kadrach zależy od tego jego bezpieczeństwo i rozliczenie czasu pracy`,
      zakazUzupelniania: `Nie uzupełniaj procedury BHP ani kadrowej "zdrowym rozsądkiem" — brakujący krok w instrukcji jest groźniejszy niż brak instrukcji.`,
    },

    // Wpisy w logu sprzed wprowadzenia klientów (21.08.2026) nie mają pola
    // `klient`. Przypisujemy je JAWNIE jednemu klientowi, zamiast zgadywać po
    // hoście: to ta sama konwencja, którą zastosowano przy polu `space`.
    // U kolejnego klienta tego pola nie ma i mieć nie może — jego panel nie
    // ma prawa zobaczyć historii cudzych pytań.
    przejmujeStareWpisy: true,

    // Nazwy widoczne w interfejsach. Podstawiane w szablonach HTML po {{klucz}}.
    ui: {
      marka: "BUDMAX",
      nazwaKrotka: "BudMax",
      tytulApp: "BudMax — Asystent Budowy",
      naglowekApp: "Asystent Budowy",
      tytulPanel: "BudMax — panel asystenta",
      tytulPanelWew: "BudMax — panel procedur i szkoleń",
      domenaLogowania: "@budmax.pl",

      // TRESC INTERFEJSU — branżowa, tak jak słownik eskalacji. Do 24.08.2026
      // była wpisana na sztywno w `app-internal.js` i `panel-internal.js`,
      // więc kancelaria dostawała kafel „Odbiór zbrojenia" i kartę „Wypadki (BHP)".
      etykietaPrzelacznika: "BudMax",
      opisTytul: "Asystent pracownika budowy",
      opisTekst: "Wyszukuje procedury BHP, instrukcje na budowie, zasady delegacji, zakupów i odbiorów. W sytuacjach wypadkowych natychmiast wskazuje pierwsze kroki.",
      podtytulPanelWew: "procedury, bhp i luki szkoleniowe",
      zrodloPytan: "z budowy",
      przelozonyPilne: "Wymagany natychmiastowy kontakt z kierownikiem budowy / służbami.",
      przelozonyStandard: "Wymaga zgody kierownika budowy lub zarządu.",

      // Kafle szybkiego startu. Bez emoji od 24.08.2026 — numeracja monospace
      // jest tym samym językiem, którego używają nagłówki bloków w panelach.
      kafle: [
        { etykieta: "Wypadek na budowie", pilny: true, pytanie: "Pracownik spadł z rusztowania, co robić natychmiast?" },
        { etykieta: "Praca powyżej 2 m", pytanie: "Jakie środki ochrony i zasady obowiązują przy pracy powyżej 2 metrów?" },
        { etykieta: "Odbiór zbrojenia", pytanie: "Co muszę sprawdzić przed zakryciem zbrojenia lub izolacji?" },
        { etykieta: "Rozliczenie delegacji", pytanie: "Ile wynosi ryczałt i stawka za kilometr samochodem prywatnym w delegacji?" },
        { etykieta: "Zakup na budowie", pytanie: "Do jakiej kwoty brygadzista może zrobić zakup drobny na budowie?" },
        { etykieta: "Dziennik budowy", pytanie: "Kto ma prawo dokonywać wpisów w dzienniku budowy?" },
      ],

      // Nazwy kategorii eskalacji w panelu. Klucze muszą zgadzać się z `id`
      // w słowniku branżowym — pilność bierze się ze słownika, nie stąd.
      nazwyEskalacji: {
        wypadek: "Wypadki (BHP)",
        zagrozenie_zycia: "Zagrożenie życia / awaria",
        spor_prawny: "Spór prawny / roszczenie",
        kontrola: "Kontrola organu (PIP/PINB)",
        finanse_prog: "Próg finansowy",
      },
    },

    // MOTYW — język wizualny klienta. Trzecia branża to dopisanie palety
    // i kroju, nie edycja plików interfejsu.
    //
    // BudMax: rysunek techniczny i hi-vis. Względem stanu sprzed 24.08.2026
    // siatka jest rzadsza i słabsza (48 px / .45 → 64 px / .16), znika podwójna
    // ramka wokół znacznika marki, tło schodzi niżej, a linie idą w górę —
    // mniej ozdób, więcej porządku.
    motyw: {
      schemat: "ciemny",
      themeColor: "#090C10",
      fontyUrl: "https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&family=Instrument+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap",
      fontNaglowek: "'Archivo',system-ui,sans-serif",
      fontTekst: "'Instrument Sans',system-ui,sans-serif",
      fontMono: "'JetBrains Mono',ui-monospace,monospace",
      promien: "0px",
      siatka: { widoczna: true, rozmiar: "64px", krycie: "0.16" },
      akcentRamki: false,
      tropNaglowka: ".08em",
      kolory: {
        void: "#090C10", deck: "#0F1418", panel: "#151B21",
        line: "#273039", lineSoft: "#1B242B",
        chalk: "#EDF0F2", mute: "#93A0AC", dim: "#6E7A85",
        hi: "#FF6A1F", blue: "#4CC9F0", ok: "#3DDC97", warn: "#FFB84D", danger: "#FF5A5A",
        cien: "0 24px 70px -24px rgba(0,0,0,.75)",
      },
    },
  },

  // ============================================================
  // DRUGA BRANŻA — fikcyjna kancelaria adwokacka (22.08.2026)
  // ============================================================
  // Istnieje po to, żeby zmierzyć, ile zabezpieczeń tego projektu jest
  // uniwersalnych. Ryzyko jest tu inne niż w budowlance: najgroźniejsze nie
  // jest zmyślenie ceny, tylko UDZIELENIE PORADY PRAWNEJ zamiast informacji —
  // ocena szans, kwalifikacja czynu, interpretacja przepisu pod czyjś stan
  // faktyczny. Zdanie „ma Pan dobre szanse" kosztuje więcej niż wymyślona
  // stawka za godzinę.
  //
  // TRASY I ACCESS: hosty są tu wpisane, ale w `wrangler.toml` nie ma jeszcze
  // dla nich `[[routes]]`, a `ACCESS_AUD_KANCELARIA*` nie są ustawione. To jest
  // stan zamierzony i bezpieczny: host nie odpowiada, a gdyby trasa powstała
  // przed aplikacją Access, `odpowiedzBrakKonfiguracji()` odda 503 z nazwą
  // brakującej zmiennej zamiast wystawić interfejs bez ochrony. Diagnostykę
  // prowadzi się przez `/reindex?klient=kancelaria` i `/debug?klient=kancelaria`,
  // które nie wymagają ani trasy, ani Access.
  kancelaria: {
    id: "kancelaria",
    nazwa: "Kancelaria Adwokacka Zaremba i Wspólnicy sp.k.",
    branza: "prawna",

    hosty: {
      publiczny: "kancelaria.know-base.app",
      pracownik: "kancelaria-pracownik.know-base.app",
      wlasciciel: "kancelaria-wlasciciel.know-base.app",
    },

    audVars: {
      pracownik: "ACCESS_AUD_KANCELARIA",
      wlasciciel: "ACCESS_AUD_KANCELARIA_PANEL",
    },

    przestrzenie: { public: "kancelaria-public", internal: "kancelaria-internal" },
    tresc: { public: CHUNKS_KANCELARIA, internal: INTERNAL_CHUNKS_KANCELARIA },

    eskalacja: ESKALACJA_PRAWNA,

    // Wzorce obietnic — u kancelarii nie chodzi o rabaty, tylko o zapewnienia
    // co do WYNIKU, TERMINU i KWALIFIKACJI PRAWNEJ. Te trzy rzeczy klient
    // usłyszy jako poradę i podejmie na ich podstawie decyzję procesową.
    //
    // Wzorce działają na tekście z ogonkami (isUnsupportablePromise używa
    // toLowerCase, nie bezOgonkow) — inaczej niż wzorce eskalacji.
    obietnicePubliczne: [
      // wynik sprawy
      /(szanse na wygran|dobre szanse|duże szanse|realne szanse|sprawa jest (wygrana|do wygrania)|wygramy|wygra pan|wygra pani|na pewno wygra|sąd przyzna|sąd zasądzi|sąd orzeknie)/,
      /(gwarantujemy|zapewniamy|obiecujemy).{0,25}(wygran|sukces|skuteczn|korzystn|uniewinnien)/,
      // termin rozstrzygnięcia
      /(sprawa potrwa|zakończy się w ciągu|sąd rozstrzygnie w|wyrok zapadnie|potrwa (około|maksymalnie|nie dłużej)|sprawa zakończy się do)/,
      // kwalifikacja i interpretacja pod pytającego
      /(przysługuje panu|przysługuje pani|należy się panu|należy się pani|ma pan prawo do|ma pani prawo do|grozi panu|grozi pani|zostanie pan skazan|to jest przestępstw|pana roszczenie|pani roszczenie).{0,40}(przedawni)?/,
      /(może pan bezpiecznie|może pani bezpiecznie)/,
      // „sprawa do wygrania" bez wyrazu „jest" — zmierzone, model tak pisze.
      /sprawa (jest )?do wygrania/,
    ],

    // Wzorce obowiązujące MIMO wyjątku dla zaprzeczeń — patrz komentarz przy
    // `isUnsupportablePromise()`. Każdy niesie własne `(?<!nie )`, więc zdanie
    // odmowne („nie wygramy tej sprawy", „nie gwarantujemy wyniku") nadal
    // przechodzi. Tu trafiają wyłącznie sformułowania, w których zaprzeczenie
    // stoi OBOK obietnicy, a nie znosi jej: uspokajanie klienta jest w tej
    // branży formą zapewnienia o wyniku.
    obietniceBezwyjatku: [
      /(?<!nie )(wygramy|wygra pan|wygra pani|wygrasz)/,
      /(?<!nie )(gwarantujemy|zapewniamy)\s+(wygran|sukces|korzystn|uniewinnien|skuteczn)/,
      /(proszę się nie martwić|nie ma się czym martwić|nic (panu|pani) nie grozi|to zwykła formalność)/,
    ],

    prompt: {
      fallback: "Nie mam takich informacji w mojej dokumentacji — proszę o kontakt z sekretariatem kancelarii.",
      opisFirmy: "kancelarią adwokacką",
      // Wersja MOCNIEJSZA niż u BudMaksu, bo zmierzono, że tu reguła pęka:
      // w czterech odpowiedziach z sondy model pisał „Twojej sprawy",
      // „podejmowałbyś". Sam zakaz nie wystarczał — dopisane są formy, które
      // model faktycznie produkował, oraz gotowe zamienniki.
      zwrotDoKlienta: `- Zwracaj się do klienta per Pan/Pani albo bezosobowo ("zapraszamy na konsultację", "ocenę sprawy wydaje adwokat"). NIGDY po imieniu ani na "ty". Dotyczy to także form dzierżawczych i osobowych: nie pisz "Twoja sprawa", "Twoje roszczenie", "podejmowałbyś", "możesz" — pisz "Pana/Pani sprawa", "sprawa, o którą Pan/Pani pyta", "może Pan/Pani". Osoba pytająca kancelarię jest często w trudnej sytuacji i pierwszy kontakt ma być uprzejmy i zdystansowany, nie poufały.`,
      cenaDopisek: " Przy pytaniu o wysokość honorarium w konkretnej sprawie — poinformuj, że stawkę ustala adwokat przed przyjęciem sprawy, po zapoznaniu się z nią na konsultacji.",
      rozroznienia: `Zachowaj szczególną ostrożność przy pojęciach, które brzmią podobnie, a znaczą co innego — to częsty błąd, którego musisz unikać:
- "honorarium kancelarii" to NIE to samo co "koszty sądowe i opłaty" (opłata od pozwu, zaliczka na biegłego, opłata skarbowa od pełnomocnictwa) — te drugie trafiają do sądu, nie do kancelarii.
- "termin procesowy" (na apelację, zażalenie, sprzeciw — liczony od doręczenia pisma) to NIE to samo co "przedawnienie roszczenia" (liczone od wymagalności, niezależnie od tego, czy sprawa trafiła do sądu).
- "konsultacja" to NIE to samo co "prowadzenie sprawy" — prowadzenie zaczyna się dopiero od umowy i pełnomocnictwa, a do tego czasu terminami zarządza sam klient.
- "tajemnica adwokacka" to NIE to samo co "ochrona danych osobowych i RODO" — to dwie różne podstawy i dwa różne zakresy.
Zanim odpowiedzisz, sprawdź, czy fragment, z którego korzystasz, dotyczy DOKŁADNIE tej instytucji, o którą pyta klient — nie tylko czy brzmi podobnie.`,
      zakazyBranzowe: [
        `- NIGDY nie oceniaj szans sprawy, nie przewiduj rozstrzygnięcia sądu i nie mów, ile sprawa potrwa. Nie znasz akt, a klient podejmie na tej podstawie decyzję procesową, której nie da się cofnąć. Przy takim pytaniu wyjaśnij, że ocena sprawy wymaga zapoznania się z dokumentami na konsultacji.`,
        `- NIGDY nie kwalifikuj czynu, nie interpretuj przepisu pod sytuację pytającego i nie mów, co komu przysługuje, co się przedawniło ani co grozi. To jest porada prawna, której udziela wyłącznie adwokat po zapoznaniu się ze sprawą — Ty podajesz wyłącznie informację o tym, jak wygląda procedura i jak liczy się bieg terminu w typowej sytuacji.`,
        `- Termin procesowy podawaj ZAWSZE razem ze zdarzeniem, od którego biegnie (najczęściej doręczenie pisma), i nigdy jako liczbę dni pozostałą pytającemu. Sama liczba dni bez zdarzenia początkowego jest informacją fałszywą, choć liczba się zgadza.`,
        `- Nie myl honorarium kancelarii z kosztami sądowymi ani terminu procesowego z przedawnieniem — to osobne instytucje opisane w osobnych fragmentach.`,
      ],
      przykladyRozkazow: `"sprawdź datę doręczenia na potwierdzeniu odbioru", "wpisz termin do kalendarza sprawy tego samego dnia", "powiadom adwokata prowadzącego"`,
      przykladyRol: `adwokat prowadzący, wspólnik zarządzający, aplikant czy sekretariat`,
      przykladSprostowania: `na przykład "jak mam ocenić, czy warto składać apelację", podczas gdy fragment mówi, że ocena sprawy i decyzja o zaskarżeniu należą do adwokata prowadzącego, a do sekretariatu — ustalenie i pilnowanie terminu`,
      przykladyNeutralne: `"kto zakłada teczkę sprawy", "kto odbiera korespondencję z sądu"`,
      stawkaWewnetrzna: `przy terminach procesowych i tajemnicy adwokackiej zależy od tego sytuacja procesowa klienta i odpowiedzialność zawodowa kancelarii`,
      zakazUzupelniania: `Nie uzupełniaj procedury ani terminu "zdrowym rozsądkiem" — zmyślony dzień upływu terminu jest groźniejszy niż brak odpowiedzi, bo terminu procesowego nie da się cofnąć inaczej niż wnioskiem o przywrócenie, który ma własny termin i własne przesłanki.`,
    },

    ui: {
      marka: "ZAREMBA",
      nazwaKrotka: "Zaremba",
      tytulApp: "Zaremba — Asystent kancelarii",
      naglowekApp: "Asystent kancelarii",
      tytulPanel: "Zaremba — panel kancelarii",
      tytulPanelWew: "Zaremba — panel spraw i terminów",
      domenaLogowania: "@zaremba.przyklad.pl",

      etykietaPrzelacznika: "kancelarię",
      opisTytul: "Asystent kancelarii",
      opisTekst: "Wyszukuje procedury kancelarii, terminy procesowe, zasady rozmowy z klientem i obiegu akt. Przy sprawach pilnych wskazuje pierwsze czynności i osobę do kontaktu.",
      podtytulPanelWew: "terminy, procedury i luki szkoleniowe",
      zrodloPytan: "z kancelarii",
      przelozonyPilne: "Wymagany natychmiastowy kontakt z adwokatem prowadzącym lub wspólnikiem dyżurnym.",
      przelozonyStandard: "Wymaga zgody adwokata prowadzącego.",

      kafle: [
        { etykieta: "Termin upływa dziś", pilny: true, pytanie: "Co zrobić, gdy termin na apelację upływa jutro, a adwokat jest na rozprawie?" },
        { etykieta: "Klient zatrzymany", pilny: true, pytanie: "Klienta zatrzymała policja wczoraj wieczorem, co mam zrobić?" },
        { etykieta: "Konflikt interesów", pytanie: "Jak sprawdzić konflikt interesów przed przyjęciem sprawy?" },
        { etykieta: "Rozmowa z rodziną", pytanie: "Dzwoni matka klienta i pyta o jego sprawę, co mogę powiedzieć?" },
        { etykieta: "Bieg terminu", pytanie: "Jak wpisujemy termin procesowy do kalendarza sprawy?" },
        { etykieta: "Wydanie akt", pytanie: "Klient prosi o wydanie oryginałów dokumentów, co robię?" },
      ],

      nazwyEskalacji: {
        termin_procesowy: "Terminy procesowe",
        zatrzymanie: "Zatrzymanie klienta",
        zagrozenie_osoby: "Zagrożenie osoby",
        naruszenie_danych: "Naruszenie ochrony danych",
        konflikt_interesow: "Konflikt interesów",
        poza_kompetencjami: "Poza kompetencjami",
        porada_dla_nieklienta: "Porada dla nieklienta",
        decyzja_finansowa: "Decyzje finansowe",
        ustepstwo_wobec_klienta: "Ustępstwa wobec klienta",
      },
    },

    // Kancelaria: narzędzie do pracy z dokumentem, nie panel SaaS. Jasne tło
    // papierowe, szeryf w nagłówkach, jeden stonowany akcent (butelkowa zieleń),
    // zero siatki, poblasku i gradientów. Kontrast wobec BudMaksu ma być
    // widoczny od pierwszego spojrzenia — inny produkt, nie inna nazwa.
    motyw: {
      schemat: "jasny",
      themeColor: "#F6F4F0",
      fontyUrl: "https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap",
      fontNaglowek: "'Source Serif 4',Georgia,serif",
      fontTekst: "'Inter',system-ui,sans-serif",
      fontMono: "'IBM Plex Mono',ui-monospace,monospace",
      promien: "3px",
      siatka: { widoczna: false, rozmiar: "64px", krycie: "0" },
      akcentRamki: false,
      tropNaglowka: "0",
      kolory: {
        void: "#F6F4F0", deck: "#FFFFFF", panel: "#FFFFFF",
        line: "#D9D3C9", lineSoft: "#EAE5DD",
        chalk: "#16191C", mute: "#5A6069", dim: "#6F757E",
        hi: "#1B4D3E", blue: "#2F5E72", ok: "#1B4D3E", warn: "#8A6520", danger: "#8F2E27",
        cien: "0 10px 30px -12px rgba(22,25,28,.14)",
      },
    },
  },
};

// Indeks host → { klient, rola }. Budowany raz, przy starcie modułu.
// Dopasowanie jest DOKŁADNE, nigdy przez podciąg: podciąg już raz po cichu
// odebrał rolę obu hostom przy zmianie ich nazw (21.08.2026).
export const HOSTY_INDEX = (() => {
  const idx = new Map();
  for (const klient of Object.values(KLIENCI)) {
    for (const [rola, host] of Object.entries(klient.hosty)) {
      if (idx.has(host)) throw new Error(`Host ${host} przypisany dwóm klientom.`);
      idx.set(host, { klient, rola });
    }
    for (const [host, rola] of Object.entries(klient.stare || {})) {
      if (idx.has(host)) throw new Error(`Host ${host} przypisany dwóm klientom.`);
      idx.set(host, { klient, rola, stary: true });
    }
  }
  return idx;
})();
