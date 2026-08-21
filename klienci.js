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
