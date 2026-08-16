// worker.js — RAG (embeddingi + Vectorize) + weryfikacja zdanie-po-zdaniu +
// pamięć konwersacji. Dokumentacja oparta o realne przepisy (KC, WT2021,
// KSeF, Czyste Powietrze) przepisane na fikcyjną firmę BudMax.
//
// BINDINGI (Worker → Settings → Bindings → Add):
//   1. "Workers AI"     → Variable name: AI
//   2. "KV Namespace"   → Variable name: RATE_LIMIT_KV
//   3. "Vectorize"      → Variable name: VECTORIZE (indeks: 1024 wymiarów, cosine)
//   4. "Secret"         → Variable name: REINDEX_SECRET (klucz endpointów administracyjnych)
//
// Sekret ustawiasz poza kodem — `wrangler secret put REINDEX_SECRET` albo
// Worker → Settings → Variables → Add secret. Nigdy w repo: jest publiczne.
// Bez niego endpointy administracyjne zwracają 403 (fail-closed).
//
// PO WDROŻENIU — jednorazowo zaindeksuj treść:
//   https://twoj-worker.workers.dev/reindex?key=TWOJ_SEKRET
// Rób to za każdym razem, gdy zmienisz CHUNKS.

const MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fast";
const EMBED_MODEL_ID = "@cf/baai/bge-m3";
const TOP_K = 8; // podniesione z 6 — krótkie, ogólne pytania miały za mało kandydatów
const MIN_CHUNKS = 2;
const MIN_SIMILARITY = 0.35;
const CITATION_THRESHOLD = 0.48; // podniesione z 0.42 — przy długich odpowiedziach 0.42 przepuszczało zbyt wiele
const HISTORY_TURNS = 6;
const MAX_QUESTION_LENGTH = 3000; // realni klienci piszą długie, opisowe wiadomości
const TOP_K_LONG = 10; // przy długich, wielowątkowych pytaniach pobierz więcej fragmentów
const LONG_QUESTION_CHARS = 400; // od tylu znaków traktujemy pytanie jako złożone
const RATE_LIMIT_PER_HOUR = 30;
const LOG_RETENTION_DAYS = 90; // po tylu dniach wpisy w logu wygasają automatycznie
const COMPANY_NAME = "BudMax Sp. z o.o.";
const FALLBACK_MESSAGE = "Nie mam takich informacji w mojej dokumentacji — polecam kontakt z biurem.";

// ============================================================
// TREŚĆ FIRMOWA — 52 fragmenty, oparte o realne przepisy (KC, WT2021,
// KSeF, Czyste Powietrze) przepisane na fikcyjną firmę BudMax.
// ============================================================
const CHUNKS = [
  // --- Kontakt i obsługa klienta ---
  { id: "c01", title: "Godziny pracy i kontakt", text: "Biuro czynne jest od poniedziałku do piątku w godzinach 7:00–16:00. Kontakt telefoniczny: sekretariat, e-mail: biuro@budmax.przyklad.pl. W pilnych sprawach związanych z realizowaną budową klient kontaktuje się bezpośrednio z kierownikiem budowy." },
  { id: "c02", title: "Umawianie wizji lokalnej", text: "Wizję lokalną umawia się telefonicznie lub mailowo, zwykle z wyprzedzeniem 3-5 dni roboczych. Spotkanie trwa około godziny i obejmuje ocenę działki, dostępu, warunków gruntowych oraz wstępne omówienie oczekiwań klienta." },
  { id: "c03", title: "Kanały zgłaszania spraw", text: "Sprawy pilne (bezpieczeństwo, awarie na budowie) zgłasza się telefonicznie do kierownika budowy. Sprawy niepilne (pytania, zmiany, dokumenty) przez e-mail lub formularz na stronie — czas odpowiedzi do 2 dni roboczych." },
  { id: "c04", title: "RODO i ochrona danych klienta", text: "Dane osobowe klientów przetwarzane są wyłącznie w celu realizacji umowy, zgodnie z RODO. Administratorem danych jest BudMax Sp. z o.o. Dane nie są przekazywane podmiotom trzecim poza wykonawcami niezbędnymi do realizacji budowy (podwykonawcy, bank przy kredycie). Klient ma prawo wglądu, poprawy i żądania usunięcia danych po zakończeniu okresu przechowywania wymaganego przepisami podatkowymi." },

  // --- Oferta i wycena ---
  { id: "c05", title: "Zakres oferowanych usług", text: "Budowa domów jednorodzinnych w stanie surowym i deweloperskim, remonty kompleksowe, nadzór budowlany, usługi projektowe we współpracy z pracownią architektoniczną, adaptacje projektów gotowych, doradztwo przy wyborze technologii." },
  { id: "c06", title: "Proces przygotowania wyceny", text: "Wstępna wycena jest bezpłatna, gotowa w 5 dni roboczych od wizji lokalnej. Zależy od zakresu prac, materiałów i terminu. Ostateczny kosztorys może różnić się od wstępnego o maksymalnie 10%, chyba że klient zmieni zakres w trakcie." },
  { id: "c07", title: "Co wchodzi w skład kosztorysu", text: "Kosztorys obejmuje materiały budowlane, robociznę, wynajem sprzętu ciężkiego oraz koszty utylizacji odpadów budowlanych. Nie obejmuje projektu architektonicznego, opłat urzędowych ani wyposażenia ruchomego (meble, AGD)." },
  { id: "c08", title: "Stan surowy otwarty, zamknięty, deweloperski", text: "Stan surowy otwarty: fundamenty, ściany, strop, bez dachu i okien. Stan surowy zamknięty: dodatkowo dach, okna, drzwi zewnętrzne. Stan deweloperski: dodatkowo tynki, instalacje, wylewki — gotowe do wykończenia przez klienta." },
  { id: "c09", title: "Umowa o roboty budowlane — co zawiera", text: "Zgodnie z art. 647 Kodeksu cywilnego umowa określa zobowiązanie wykonawcy do oddania obiektu zgodnie z projektem, oraz obowiązki inwestora: przekazanie terenu budowy, dostarczenie projektu i zapłatę wynagrodzenia. Nasza umowa dodatkowo precyzuje harmonogram, standard materiałów, zasady odbiorów częściowych i warunki wprowadzania zmian w trakcie realizacji." },

  // --- Etapy i harmonogram ---
  { id: "c10", title: "Etapy realizacji projektu", text: "Współpraca przebiega w pięciu etapach: spotkanie i wizja lokalna, wycena i umowa, harmonogram, realizacja z odbiorami częściowymi po każdym etapie, odbiór końcowy z przekazaniem dokumentacji powykonawczej." },
  { id: "c11", title: "Czas realizacji fundamentów", text: "Wykonanie fundamentów dla typowego domu 120-160 m² trwa 2-3 tygodnie, w zależności od warunków gruntowych i pogody. Obejmuje wykop, izolację, zbrojenie i zalanie ław lub płyty fundamentowej." },
  { id: "c12", title: "Czas realizacji stanu surowego", text: "Stan surowy otwarty realizowany jest zwykle w 6-8 tygodni. Stan surowy zamknięty (dodatkowo dach, okna, drzwi) wymaga kolejnych 3-4 tygodni po zamknięciu stanu otwartego." },
  { id: "c13", title: "Czas instalacji i wykończeń", text: "Instalacje (elektryczne, hydrauliczne, wentylacyjne) i wykończenia zajmują 8-12 tygodni, zależnie od standardu. Łączny czas budowy domu w stanie deweloperskim to zwykle 6-9 miesięcy od wejścia na plac budowy." },
  { id: "c14", title: "Co wydłuża harmonogram budowy", text: "Najczęstsze przyczyny opóźnień: niekorzystne warunki pogodowe zimą, zmiany zakresu prac zgłoszone w trakcie realizacji, opóźnienia w dostawach materiałów specjalnych oraz nieprzewidziane warunki gruntowe." },
  { id: "c15", title: "Dziennik budowy — dokument formalny", text: "Dziennik budowy jest urzędowym dokumentem prowadzonym od dnia rozpoczęcia robót, w którym kierownik budowy odnotowuje przebieg prac, ważne zdarzenia i odbiory. Prowadzimy go zgodnie z wymogami prawa budowlanego i przekazujemy klientowi wraz z dokumentacją powykonawczą po zakończeniu inwestycji." },

  // --- Materiały i technologia ---
  { id: "c16", title: "Standardy wykończenia", text: "Trzy standardy: ekonomiczny, standardowy, podwyższony — różnią się klasą materiałów wykończeniowych (płytki, armatura, stolarka). Materiały konstrukcyjne są tej samej, sprawdzonej jakości niezależnie od wybranego standardu." },
  { id: "c17", title: "Technologia murowana, szkieletowa, prefabrykowana", text: "Technologia murowana: najbardziej uniwersalna, dłuższy czas budowy, wysoka akumulacja ciepła. Szkieletowa drewniana: szybsza realizacja, dobra izolacyjność. Prefabrykowana: najkrótszy czas budowy, ograniczona możliwość zmian w trakcie." },
  { id: "c18", title: "Materiały konstrukcyjne", text: "Do prac konstrukcyjnych używamy betonu towarowego z certyfikowanych węzłów betoniarskich, stali zbrojeniowej z atestami, bloczków ceramicznych lub silikatowych oraz więźby dachowej z drewna klasy C24." },
  { id: "c19", title: "Materiały własne klienta", text: "Klient może zaproponować własnych dostawców materiałów wykończeniowych. Wymaga to zgłoszenia na etapie kosztorysowania i akceptacji — wpływa na harmonogram dostaw i może wymagać korekty terminu realizacji." },

  // --- Formalności i prawo ---
  { id: "c20", title: "Pomoc w formalnościach budowlanych", text: "Pomagamy skompletować dokumentację do zgłoszenia budowy lub pozwolenia, we współpracy z biurem projektowym. Usługa jest płatna osobno, wyceniana według stopnia skomplikowania sprawy." },
  { id: "c21", title: "Zgłoszenie a pozwolenie na budowę", text: "Zgłoszenie budowy wystarcza dla domów jednorodzinnych o określonej powierzchni i przeznaczeniu, jeśli nie wymagają oceny oddziaływania na środowisko. Pozwolenie na budowę jest wymagane w pozostałych przypadkach — czas oczekiwania jest dłuższy." },
  { id: "c22", title: "Warunki zabudowy i decyzja środowiskowa", text: "Dla działek bez miejscowego planu zagospodarowania konieczne jest uzyskanie warunków zabudowy. W niektórych lokalizacjach wymagana jest też decyzja środowiskowa — pomagamy ustalić, czy dotyczy to konkretnej działki." },
  { id: "c23", title: "Geodezja i tyczenie budynku", text: "Przed rozpoczęciem prac ziemnych zlecamy uprawnionemu geodecie tyczenie budynku, czyli wyznaczenie jego dokładnego położenia na działce zgodnie z projektem. Po zakończeniu budowy geodeta wykonuje inwentaryzację powykonawczą, niezbędną do zgłoszenia zakończenia budowy." },
  { id: "c24", title: "Odbiór robót od wykonawcy — procedura formalna", text: "Odbiór częściowy i końcowy potwierdzany jest protokołem podpisanym przez klienta i kierownika budowy, wskazującym ewentualne usterki do poprawy w wyznaczonym terminie. Podpisanie protokołu odbioru bez zastrzeżeń jest podstawą do wystawienia faktury za dany etap." },
  { id: "c25", title: "Odbiory urzędowe po budowie", text: "Po zakończeniu budowy klient zgłasza zakończenie do nadzoru budowlanego, dołączając dziennik budowy, atesty materiałów i schematy instalacji, które przekazujemy w komplecie dokumentacji powykonawczej." },

  // --- Finanse, płatności, dotacje ---
  { id: "c26", title: "Harmonogram płatności", text: "Rozliczenie w transzach powiązanych z etapami realizacji, na podstawie faktur VAT po każdym odbiorze częściowym. Pierwsza wpłata (zaliczka) wynosi standardowo 10% wartości kontraktu, płatna przy podpisaniu umowy." },
  { id: "c27", title: "Kredyt budowlany i współpraca z bankami", text: "Współpracujemy z kilkoma bankami przy kredytach budowlanych. Na życzenie klienta przygotowujemy dokumenty (kosztorys, harmonogram, umowa) wymagane przez bank do uruchamiania kolejnych transz kredytu." },
  { id: "c28", title: "Faktury i rozliczenia przez KSeF", text: "Jak wystawiamy faktury i jak wygląda rozliczenie dokumentów: od 1 lutego 2026 roku obowiązkowy KSeF (Krajowy System e-Faktur) objął duże firmy, a od 1 kwietnia 2026 roku obejmuje pozostałych przedsiębiorców, w tym BudMax. Wszystkie nasze faktury VAT dla firm wystawiane są ustrukturyzowanie przez KSeF — klient biznesowy otrzymuje fakturę z systemu Krajowej Administracji Skarbowej z nadanym numerem KSeF." },
  { id: "c29", title: "Stawki VAT w budownictwie mieszkaniowym", text: "Dla budownictwa mieszkaniowego objętego społecznym programem mieszkaniowym stosujemy obniżoną stawkę VAT zgodnie z obowiązującymi przepisami. Dokładną stawkę potwierdzamy indywidualnie przy wycenie, w zależności od metrażu i przeznaczenia." },
  { id: "c30", title: "Program Czyste Powietrze — dofinansowanie", text: "Pomagamy klientom skorzystać z rządowego programu Czyste Powietrze, który w zależności od progu dochodowego oferuje dofinansowanie do 66 000 zł, 99 000 zł lub nawet 136 200 zł na termomodernizację i wymianę źródła ciepła, a przy kompleksowej termomodernizacji z gruntową pompą ciepła — do 170 100 zł. Program wymaga obowiązkowego audytu energetycznego przed złożeniem wniosku." },
  { id: "c31", title: "Inne dotacje i ulgi termomodernizacyjne", text: "Poza programem Czyste Powietrze doradzamy też w zakresie ulgi termomodernizacyjnej w rozliczeniu PIT oraz lokalnych programów dopłat, jeśli są dostępne w danej gminie. Ostateczną kwalifikację i wniosek klient składa samodzielnie lub z pomocą doradcy finansowego." },

  // --- Bezpieczeństwo i ubezpieczenie ---
  { id: "c32", title: "Ubezpieczenie budowy", text: "Każda budowa objęta jest ubezpieczeniem OC działalności budowlanej oraz ubezpieczeniem budowy w trakcie realizacji na sumę odpowiadającą wartości kontraktu. Kopię polisy przekazujemy klientowi przy podpisaniu umowy." },
  { id: "c33", title: "Zabezpieczenie terenu budowy", text: "Teren budowy jest ogrodzony i oznakowany zgodnie z przepisami BHP przez cały okres realizacji. Dostęp osób postronnych jest ograniczony, a materiały i sprzęt przechowywane są w zamykanych kontenerach." },
  { id: "c34", title: "BHP i szkolenia pracowników", text: "Każda osoba na budowie nosi kask, obuwie z podnoskiem i kamizelkę odblaskową. Praca na wysokości powyżej 2 metrów wymaga szelek i asekuracji. Szkolenie BHP jest obowiązkowe i odnawiane co 12 miesięcy." },
  { id: "c35", title: "Wjazd na budowę i logistyka dostaw", text: "Dostawy materiałów i sprzętu koordynowane są przez kierownika budowy, zwykle w godzinach 7:00-15:00 w dni robocze. Klient jest informowany z wyprzedzeniem o większych dostawach (beton, więźba dachowa), które mogą czasowo ograniczyć dojazd do działki." },
  { id: "c36", title: "Media i przyłącza (prąd, woda, kanalizacja)", text: "Organizujemy wykonanie przyłączy energetycznych, wodociągowych i kanalizacyjnych we współpracy z lokalnymi dostawcami mediów. Czas oczekiwania na przyłącze energetyczne zależy od operatora sieci i zwykle wynosi od kilku tygodni do kilku miesięcy — warto złożyć wniosek jak najwcześniej, równolegle z formalnościami budowlanymi." },

  // --- Zespół i realizacja ---
  { id: "c37", title: "Własny zespół i podwykonawcy", text: "Prace konstrukcyjne wykonuje stały zespół zatrudniony na umowę o pracę. Do prac instalacyjnych (elektryka, hydraulika, wentylacja) współpracujemy ze sprawdzonymi podwykonawcami z wieloletnimi umowami ramowymi." },
  { id: "c38", title: "Rola kierownika budowy", text: "Kierownik budowy nadzoruje realizację, odpowiada za zgodność z projektem i przepisami, prowadzi dziennik budowy oraz jest głównym punktem kontaktu dla klienta w sprawach bieżących związanych z postępem prac na miejscu." },
  { id: "c39", title: "Raportowanie postępu klientowi", text: "Klient jest informowany o postępach standardowo raz w tygodniu przez kierownika budowy — telefonicznie, mailowo lub podczas wizyty na budowie, w zależności od preferencji ustalonych na starcie współpracy." },

  // --- Wykończenia wnętrz ---
  { id: "c40", title: "Wykończenie wnętrz — zakres usług", text: "Oferujemy pełne wykończenie wnętrz: tynki, malowanie, podłogi, glazurę, biały montaż, zabudowy meblowe na zamówienie. Zakres i standard ustalany jest indywidualnie na etapie kosztorysowania." },
  { id: "c41", title: "Łazienki i kuchnie pod klucz", text: "Realizujemy łazienki i kuchnie w formule pod klucz, od hydrauliki i elektryki po montaż płytek, armatury i mebli. Czas realizacji jednego pomieszczenia to zwykle 2-4 tygodnie, zależnie od zakresu." },

  // --- Otoczenie budynku: ogrody i ogrodzenia rozdzielone wyraźnie ---
  { id: "c42", title: "Ogrody i tereny zielone — pielęgnacja krajobrazu", text: "Czy zakładamy ogrody i zieleń wokół domu: po zakończeniu budowy oferujemy podstawowe zagospodarowanie terenu zielonego: niwelację gruntu, obsianie trawnikiem, nasadzenia roślin i zieleni. Bardziej rozbudowane projekty ogrodowe realizujemy we współpracy z zewnętrznymi architektami krajobrazu. To usługa dotycząca roślinności i zieleni — nie obejmuje ogrodzeń ani utwardzonych powierzchni (patrz osobny fragment: Ogrodzenia, bramy i podjazdy)." },
  { id: "c43", title: "Ogrodzenia, bramy i podjazdy — infrastruktura działki", text: "Wykonujemy ogrodzenia (panelowe, murowane, drewniane), bramy wjazdowe oraz podjazdy i place utwardzone kostką brukową lub betonem. Wyceniane są osobno od budowy głównej, na podstawie odrębnego kosztorysu. To usługa dotycząca infrastruktury i ogrodzeń działki — nie obejmuje zieleni ani nasadzeń (patrz osobny fragment: Ogrody i tereny zielone)." },

  // --- Gwarancja i rękojmia, poprawnie rozdzielone prawnie ---
  { id: "c44", title: "Rękojmia na roboty budowlane — prawo ustawowe", text: "Zgodnie z art. 568 §1 Kodeksu cywilnego inwestorowi przysługuje ustawowa rękojmia za wady obiektu budowlanego przez 5 lat od dnia odbioru, a przy umowach obejmujących wyłącznie remont lub wykończenie — przez 2 lata. Rękojmia obowiązuje z mocy samego prawa, niezależnie od tego, czy BudMax dodatkowo udzieli gwarancji. W jej ramach klient może żądać usunięcia wady, obniżenia wynagrodzenia lub, w skrajnych przypadkach, odstąpienia od umowy." },
  { id: "c45", title: "Gwarancja umowna — dodatkowa ochrona", text: "Niezależnie od ustawowej rękojmi, BudMax udziela dodatkowej gwarancji umownej na wykonane prace, potwierdzonej kartą gwarancyjną przekazywaną przy odbiorze. Gwarancja nie obejmuje uszkodzeń powstałych w wyniku nieprawidłowego użytkowania obiektu, samowolnych zmian konstrukcyjnych wykonanych przez inne firmy po odbiorze, ani zdarzeń losowych." },
  { id: "c46", title: "Różnica między rękojmią a gwarancją", text: "Rękojmia to prawo ustawowe, obowiązujące zawsze i niezależnie od woli wykonawcy (5 lat na roboty budowlane, 2 lata na remont). Gwarancja to dodatkowe, dobrowolne zobowiązanie BudMax, opisane w karcie gwarancyjnej. Klient może skorzystać najpierw z gwarancji, a jeśli sprawa nie zostanie załatwiona — skorzystać z rękojmi, która daje szersze uprawnienia." },
  { id: "c47", title: "Proces zgłaszania reklamacji", text: "Co zrobić, gdy po odbiorze pojawi się usterka lub wada: reklamację zgłasza się telefonicznie, mailowo lub przez formularz na stronie. Termin rozpatrzenia to 14 dni roboczych. Usterki zagrażające bezpieczeństwu są obsługiwane priorytetowo, w ciągu 48 godzin od zgłoszenia." },
  { id: "c48", title: "Serwis pogwarancyjny", text: "Po zakończeniu okresu gwarancji oferujemy odpłatny serwis pogwarancyjny: przeglądy instalacji, drobne naprawy, konserwację elewacji i dachu. Wycena serwisu ustalana jest indywidualnie po zgłoszeniu." },

  // --- Standard energetyczny, oparty o realne wartości WT2021 ---
  { id: "c49", title: "Standard energetyczny budynków — wymagania WT2021", text: "Wszystkie realizowane przez nas domy spełniają obowiązujące od 31 grudnia 2020 roku warunki techniczne WT2021: współczynnik przenikania ciepła dachu nie przekracza 0,15 W/(m²K), ścian zewnętrznych 0,20 W/(m²K), a podłogi na gruncie 0,30 W/(m²K). W praktyce oznacza to zwykle 25-35 cm izolacji dachu i 15-20 cm izolacji ścian, w zależności od materiału." },
  { id: "c50", title: "Fotowoltaika i pompy ciepła", text: "Przygotowujemy instalację pod montaż fotowoltaiki i pompy ciepła już na etapie budowy (odpowiednie okablowanie, miejsce na urządzenia). Sam montaż realizujemy we współpracy z certyfikowanymi partnerami technologicznymi, dobierając urządzenia kwalifikujące się do dofinansowania z programu Czyste Powietrze." },

  // --- Zmiany i obszar działania ---
  { id: "c51", title: "Zmiany w trakcie budowy", text: "Zmiana zakresu prac wymaga pisemnego aneksu do umowy z aktualizacją kosztorysu. Zmiany zgłoszone przed rozpoczęciem danego etapu nie generują dodatkowych kosztów administracyjnych, zgłoszone później — mogą generować." },
  { id: "c52", title: "Obszar działania i dojazd", text: "Gdzie działamy i gdzie realizujemy budowy: na terenie województwa zachodniopomorskiego, głównie w okolicach Szczecina i Kołobrzegu. Obsługujemy klientów z tego regionu. Dla budów powyżej 60 km od siedziby doliczamy ryczałt transportowy ustalany indywidualnie." },
];
// ============================================================

const ALLOWED_ORIGIN = "https://p0rk1.github.io";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

// Klucz administracyjny żyje w sekrecie Workera, nie w kodzie. Fail-closed:
// jeśli sekret nie jest ustawiony, żaden klucz z URL-a nie otwiera endpointu.
function isAdmin(url, env) {
  const secret = env.REINDEX_SECRET;
  if (!secret) return false;
  return url.searchParams.get("key") === secret;
}

function jsonResponse(obj, extraHeaders, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

async function embedText(env, text) {
  const res = await env.AI.run(EMBED_MODEL_ID, { text: [text] });
  return res.data[0];
}

async function handleReindex(env) {
  const BATCH_SIZE = 10; // grupujemy, żeby nie przekroczyć limitu subrequestów na jedno wywołanie Workera
  let inserted = 0;
  for (let i = 0; i < CHUNKS.length; i += BATCH_SIZE) {
    const batch = CHUNKS.slice(i, i + BATCH_SIZE);
    const texts = batch.map((c) => `${c.title}\n${c.text}`);
    const embedResult = await env.AI.run(EMBED_MODEL_ID, { text: texts });
    const vectors = batch.map((chunk, idx) => ({
      id: chunk.id,
      values: embedResult.data[idx],
      metadata: { title: chunk.title, text: chunk.text },
    }));
    await env.VECTORIZE.insert(vectors);
    inserted += batch.length;
  }
  return inserted;
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Skróty, po których kropka NIE kończy zdania — bez tego "m.in." rozbija
// zdanie na pół i obie połówki trafiają do weryfikacji jako osobne twierdzenia.
const ABBREVIATIONS = ["m.in", "np", "itp", "itd", "tj", "tzn", "ok", "godz", "min", "mln", "tys", "zł", "ul", "nr", "art", "pkt", "ust", "poz", "str", "sp. z o.o", "s.c", "r", "w"];

function splitSentences(text) {
  let masked = text;
  // Chwilowo zastępujemy kropki w skrótach, żeby nie rozbijały zdania
  ABBREVIATIONS.forEach((abbr, i) => {
    const re = new RegExp(abbr.replace(/\./g, "\\.") + "\\.", "gi");
    masked = masked.replace(re, `__ABBR${i}__`);
  });

  const parts = masked
    // Dzielimy po kropce/wykrzykniku/pytajniku ORAZ po nowej linii —
    // listy punktowane nie mają kropek, a są osobnymi twierdzeniami.
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => {
      let out = s.trim();
      ABBREVIATIONS.forEach((abbr, i) => {
        out = out.replace(new RegExp(`__ABBR${i}__`, "g"), abbr + ".");
      });
      // Usuwamy wiodące myślniki/punktory z list
      return out.replace(/^[-–—•*]\s*/, "").trim();
    })
    .filter((s) => s.length >= 12);

  return parts;
}

// Wyciąga wszystkie liczby ze zdania (ceny, terminy, procenty, okresy).
// Ignoruje liczby zapisane słownie — te i tak trafiają do weryfikacji semantycznej.
function extractNumbers(text) {
  const matches = text.match(/\d+(?:[.,]\d+)?/g) || [];
  return matches.map((n) => n.replace(",", ".")).filter((n) => parseFloat(n) > 0);
}

// Sprawdza, czy każda liczba ze zdania występuje w treści któregokolwiek
// z pobranych fragmentów. To wyłapuje zmyślone ceny i terminy wplecione
// w skądinąd poprawnie brzmiące zdanie — czego weryfikacja semantyczna nie widzi.
function numbersAreGrounded(sentence, filtered) {
  const nums = extractNumbers(sentence);
  if (!nums.length) return true;
  const corpus = filtered.map((m) => m.metadata.text + " " + m.metadata.title).join(" ");
  const corpusNums = new Set(extractNumbers(corpus));
  return nums.every((n) => corpusNums.has(n));
}

// Zdania, których dokumentacja z natury nie może potwierdzić: deklaracje
// dostępności terminów, obietnice zdążenia, potwierdzenia przypuszczeń klienta
// o rabatach czy podatkach. Model chętnie je generuje, bo brzmią uprzejmie.
function isUnsupportablePromise(s) {
  const t = s.toLowerCase();

  // Zdanie zaprzeczające ("nie oferujemy rabatów") albo odsyłające do biura
  // ("kwestię rabatów potwierdzi biuro") NIE jest obietnicą — przeciwnie,
  // to dokładnie takie zachowanie, jakiego oczekujemy. Nie wycinamy go.
  const isNegationOrDeferral = /\b(nie |bez |brak |nie mam|potwierdzi biuro|potwierdzi (nasze )?biuro|skontaktuj|kontakt z biurem|ustali biuro|zależy od indywidualn)/.test(t);
  if (isNegationOrDeferral) return false;

  const patterns = [
    /mamy wolne terminy|dysponujemy terminami|termin.{0,20}dostępn/,
    /(będziemy się starać|postaramy się|zdążymy|jesteśmy w stanie zdążyć)/,
    /(oferujemy|udzielamy|mamy|przysługuj|możemy zaoferować).{0,30}(rabat|zniżk|upust)/,
    /(rabat|zniżk|upust).{0,30}(oferujemy|udzielamy|możliwe|dostępn)/,
    /niższy vat|lepsze ceny w hurtown|taniej w hurtown/,
    /płacisz z góry|płatność z góry/,
  ];
  return patterns.some((p) => p.test(t));
}

// Zdania zdradzające klientowi, że pod spodem działa bot z instrukcjami.
// Model czasem przepisuje polecenia dosłownie zamiast je wykonać.
function leaksInstructions(s) {
  const t = s.toLowerCase();
  return /(proszę mi powiedzieć, że|zgodnie z (moją |naszą )?dokumentacj|według (podanych )?fragment|w (mojej|naszej) dokumentacji (jest|znajduje)|na podstawie fragment|jako asystent ai)/.test(t);
}

// Usuwa zdania powtarzające treść już zawartą w odpowiedzi. Porównuje
// znormalizowany zbiór słów — łapie parafrazy, nie tylko dosłowne kopie.
function isDuplicate(sentence, alreadyKept) {
  // Przycinamy końcówki fleksyjne — "wstępny"/"wstępna", "gotowy"/"gotowa"
  // to dla porównania to samo słowo. Prymitywne, ale wystarcza do wykrycia
  // powtórzeń tej samej treści innymi słowami.
  const stem = (w) => w.replace(/(ego|emu|ymi|imi|ach|ami|om|ie|ia|ie|y|a|e|i|ą|ę|u|o)$/u, "");
  const norm = (s) => new Set(
    s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/)
      .filter((w) => w.length > 3).map(stem).filter((w) => w.length > 2)
  );
  const a = norm(sentence);
  if (a.size < 3) return false;
  for (const prev of alreadyKept) {
    const b = norm(prev);
    if (b.size < 3) continue;
    let common = 0;
    for (const w of a) if (b.has(w)) common++;
    const overlap = common / Math.min(a.size, b.size);
    if (overlap >= 0.6) return true;
  }
  return false;
}

async function verifyClaims(fullText, filtered, env) {
  const claims = splitSentences(fullText);
  const toCheck = claims.length ? claims : [fullText];

  const embedResult = await env.AI.run(EMBED_MODEL_ID, { text: toCheck });
  const usedSources = new Set();
  const kept = [];
  let removed = 0;

  for (let i = 0; i < toCheck.length; i++) {
    const claimVector = embedResult.data[i];
    let bestSim = 0, bestTitle = null;
    for (const m of filtered) {
      const sim = cosineSimilarity(claimVector, m.values);
      if (sim > bestSim) { bestSim = sim; bestTitle = m.metadata.title; }
    }

    const numbersOk = numbersAreGrounded(toCheck[i], filtered);
    const promiseOk = !isUnsupportablePromise(toCheck[i]);

    // Zdania zdradzające instrukcje lub powtarzające już powiedzianą treść
    // usuwamy po cichu — to defekt formy, nie brak pokrycia w dokumentacji,
    // więc nie zwiększamy licznika "niepotwierdzonych" pokazywanego klientowi.
    if (leaksInstructions(toCheck[i]) || isDuplicate(toCheck[i], kept)) {
      continue;
    }

    if (bestSim >= CITATION_THRESHOLD && numbersOk && promiseOk) {
      usedSources.add(bestTitle);
      kept.push(toCheck[i]);
    } else if (isConnectiveSentence(toCheck[i]) && numbersOk && promiseOk) {
      // Zdania grzecznościowe/łączące ("Dzień dobry", "Zapraszamy do kontaktu")
      // nie niosą twierdzeń faktycznych — zachowujemy je, żeby odpowiedź
      // nie brzmiała jak wyrwana z kontekstu.
      kept.push(toCheck[i]);
    } else {
      // Zdanie zawiera twierdzenie bez pokrycia w dokumentacji — wycinamy je.
      removed++;
    }
  }

  const factualKept = kept.length - kept.filter(isConnectiveSentence).length;

  // Jeśli po wycięciu nie zostało żadne twierdzenie oparte na dokumentacji,
  // odpowiedź jest pusta merytorycznie — lepiej odesłać do biura.
  if (factualKept === 0) {
    return { ok: false, fallback: FALLBACK_MESSAGE };
  }

  let text = kept.join(" ");
  if (removed > 0) {
    text += "\n\nW pozostałych kwestiach nie mam potwierdzonych informacji w dokumentacji — te szczegóły potwierdzi biuro.";
  }

  return { ok: true, text, source: [...usedSources].slice(0, 4).join(", "), removed };
}

// Rozpoznaje zdania, które nie zawierają twierdzeń faktycznych o firmie —
// powitania, podziękowania, zaproszenia do kontaktu. Te wolno zachować
// nawet bez pokrycia w dokumentacji, bo niczego nie obiecują.
function isConnectiveSentence(s) {
  const t = s.toLowerCase();
  const patterns = [
    /^(dzień dobry|dobry wieczór|witam|cześć|szanowni)/,
    /^(cieszę się|dziękuj|pozdrawiam|miło mi)/,
    /(zapraszam|polecam kontakt|zachęcam)( |$)/,
    /^(jeśli (chcesz|masz)|w razie|proszę o kontakt)/,
    /^(rozumiem|zrozumiałem)/,
  ];
  return patterns.some((p) => p.test(t)) && s.length < 160;
}

function buildSystemPrompt(contextChunks) {
  const contextText = contextChunks.map((c) => `[${c.title}]\n${c.text}`).join("\n\n");
  return `Jesteś asystentem AI na stronie firmy ${COMPANY_NAME}. Odpowiadasz WYŁĄCZNIE na podstawie poniższych fragmentów dokumentacji, prostym i przyjaznym językiem. Bierz pod uwagę wcześniejsze wiadomości w rozmowie, żeby rozumieć pytania nawiązujące do poprzednich (np. "a co z...", "ile to będzie kosztować"). Dopasuj długość odpowiedzi do pytania.

Możesz łączyć informacje z kilku fragmentów, żeby dać pełniejszą odpowiedź, ale NIE WOLNO Ci tworzyć nowego twierdzenia, którego żaden pojedynczy fragment wprost nie potwierdza.

Zachowaj szczególną ostrożność przy podobnie brzmiących, ale różnych usługach — to częsty błąd, którego musisz unikać:
- "ogród" (zieleń, rośliny, krajobraz) to NIE to samo co "ogrodzenie" (płot, brama, infrastruktura działki) — to dwie różne, osobno wycenione usługi.
- "taras" nie jest wprost wymieniony w dokumentacji jako osobna usługa — nie zakładaj, że jest oferowany, chyba że fragment wyraźnie to potwierdza.
Zanim odpowiesz, sprawdź, czy fragment, z którego korzystasz, dotyczy DOKŁADNIE tej usługi, o którą pyta klient — nie tylko czy tytuł brzmi podobnie.

Nie potwierdzaj słów i przymiotników użytych przez klienta (np. "nowoczesne", "ekskluzywne", "szybkie"), jeśli nie pojawiają się w fragmentach dokumentacji — opisuj tylko to, co fragmenty faktycznie mówią, własnych słów klienta nie traktuj jako potwierdzonego faktu.

BEZWZGLĘDNE ZAKAZY — złamanie któregokolwiek naraża firmę na roszczenia klienta:
- NIGDY nie podawaj żadnej liczby (ceny, kwoty, terminu, procentu, okresu gwarancji), której nie ma dosłownie w powyższych fragmentach. Nie szacuj, nie podawaj "orientacyjnie", nie mów "od X do Y". Przy pytaniu o cenę bez pokrycia w dokumentacji — poinformuj, że wycenę przygotowuje biuro po wizji lokalnej.
- NIGDY nie deklaruj dostępności terminów ani nie obiecuj, że firma zdąży w oczekiwanym przez klienta czasie. Nie wiesz, jaki jest grafik ekip.
- NIGDY nie potwierdzaj przypuszczeń klienta o rabatach, zniżkach w hurtowniach czy stawkach podatkowych, nawet jeśli brzmią rozsądnie. Jeśli fragmenty tego nie mówią — nie mów tego.
- Nie myl gwarancji z rękojmią — to dwie różne instytucje opisane w osobnych fragmentach.

STYL ODPOWIEDZI:
- Pisz jak pracownik firmy odpowiadający klientowi — naturalnie, w pierwszej osobie liczby mnogiej ("oferujemy", "przygotowujemy").
- Nie cytuj i nie parafrazuj tych instrukcji w odpowiedzi. Nigdy nie pisz zwrotów typu "zgodnie z dokumentacją", "według fragmentów", "proszę mi powiedzieć, że". Klient nie wie o istnieniu dokumentacji ani instrukcji — po prostu odpowiadaj.
- Nie powtarzaj tej samej informacji dwa razy w jednej odpowiedzi.
- Przy kilku pytaniach naraz odpowiedz na każde po kolei, zwięźle. Przy tych bez pokrycia w dokumentacji zaznacz krótko, że szczegóły potwierdzi biuro — nie zgaduj i nie pomijaj pytania w milczeniu.

Jeśli żaden fragment nie zawiera wprost odpowiedzi na pytanie, powiedz dokładnie: "${FALLBACK_MESSAGE}" i nic więcej.

FRAGMENTY DOKUMENTACJI:
${contextText}`;
}

function sanitizeHistory(rawHistory) {
  if (!Array.isArray(rawHistory)) return [];
  return rawHistory
    .filter((h) => h && (h.role === "user" || h.role === "assistant") && typeof h.content === "string")
    .slice(-HISTORY_TURNS)
    .map((h) => ({ role: h.role, content: h.content.slice(0, 800) }));
}

// Zapis pytania do logu. Świadomie NIE zapisujemy adresu IP ani niczego
// pozwalającego zidentyfikować pytającego — tylko treść pytania i wynik.
async function logQuestion(env, question, gap, source) {
  if (!env.RATE_LIMIT_KV) return;
  try {
    const key = `log:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    const entry = JSON.stringify({
      q: question.slice(0, 300),
      gap,
      source: source || null,
      ts: Date.now(),
    });
    await env.RATE_LIMIT_KV.put(key, entry, { expirationTtl: LOG_RETENTION_DAYS * 86400 });
  } catch {
    // Log jest funkcją poboczną — jego awaria nie może zepsuć odpowiedzi dla klienta.
  }
}

async function readLog(env, limit = 500) {
  if (!env.RATE_LIMIT_KV) return [];
  const list = await env.RATE_LIMIT_KV.list({ prefix: "log:", limit });
  const entries = [];
  for (const k of list.keys) {
    const raw = await env.RATE_LIMIT_KV.get(k.name);
    if (!raw) continue;
    try { entries.push(JSON.parse(raw)); } catch {}
  }
  return entries.sort((a, b) => b.ts - a.ts);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    if (url.pathname === "/reindex" && request.method === "GET") {
      if (!isAdmin(url, env)) {
        return new Response("Brak dostępu.", { status: 403, headers: corsHeaders() });
      }
      try {
        const n = await handleReindex(env);
        return new Response(`Zaindeksowano ${n} fragmentów.`, { headers: corsHeaders() });
      } catch (e) {
        return new Response(`Błąd indeksowania: ${e.message}.`, { status: 500, headers: corsHeaders() });
      }
    }

    if (url.pathname === "/stats" && request.method === "GET") {
      if (!isAdmin(url, env)) {
        return jsonResponse({ error: "Brak dostępu." }, corsHeaders(), 403);
      }
      try {
        const entries = await readLog(env);
        const total = entries.length;
        const gaps = entries.filter((e) => e.gap);
        const answered = entries.filter((e) => !e.gap);

        // Które fragmenty dokumentacji są najczęściej wykorzystywane
        const sourceCount = {};
        for (const e of answered) {
          if (!e.source) continue;
          for (const s of e.source.split(",").map((x) => x.trim())) {
            if (s) sourceCount[s] = (sourceCount[s] || 0) + 1;
          }
        }
        const topSources = Object.entries(sourceCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([tytul, liczba]) => ({ tytul, liczba }));

        // Aktywność w ostatnich 14 dniach
        const dayCount = {};
        for (const e of entries) {
          const d = new Date(e.ts).toISOString().slice(0, 10);
          dayCount[d] = (dayCount[d] || 0) + 1;
        }
        const timeline = Object.entries(dayCount).sort((a, b) => a[0].localeCompare(b[0])).slice(-14);

        return jsonResponse({
          total,
          answered: answered.length,
          gaps: gaps.length,
          gapRate: total ? Math.round((gaps.length / total) * 100) : 0,
          gapQuestions: gaps.slice(0, 50).map((e) => ({ q: e.q, ts: e.ts })),
          recentQuestions: entries.slice(0, 50).map((e) => ({ q: e.q, gap: e.gap, source: e.source, ts: e.ts })),
          topSources,
          timeline,
        }, corsHeaders());
      } catch (e) {
        return jsonResponse({ error: e.message }, corsHeaders(), 500);
      }
    }

    if (url.pathname === "/purge" && request.method === "GET") {
      if (!isAdmin(url, env)) {
        return new Response("Brak dostępu.", { status: 403, headers: corsHeaders() });
      }
      try {
        // Usuwa z indeksu wpisy o ID, których już nie ma w CHUNKS (pozostałości
        // po starszych wersjach dokumentacji). Podaj stare ID przez ?ids=c33,c34
        const idsParam = url.searchParams.get("ids") || "";
        const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
        if (!ids.length) {
          return new Response("Podaj ID do usunięcia, np. /purge?key=...&ids=c33,c34", { headers: corsHeaders() });
        }
        await env.VECTORIZE.deleteByIds(ids);
        return new Response(`Usunięto z indeksu: ${ids.join(", ")}`, { headers: corsHeaders() });
      } catch (e) {
        return new Response(`Błąd usuwania: ${e.message}`, { status: 500, headers: corsHeaders() });
      }
    }

    if (url.pathname === "/debug" && request.method === "GET") {
      if (!isAdmin(url, env)) {
        return new Response("Brak dostępu.", { status: 403, headers: corsHeaders() });
      }
      const q = url.searchParams.get("q");
      if (!q) return new Response("Podaj pytanie: /debug?key=...&q=twoje pytanie", { headers: corsHeaders() });
      try {
        const qVector = await embedText(env, q);
        const results = await env.VECTORIZE.query(qVector, { topK: TOP_K, returnMetadata: true, returnValues: true });
        const matches = results.matches || [];
        const filtered = matches.filter((m, idx) => idx < MIN_CHUNKS || m.score >= MIN_SIMILARITY);

        const systemPrompt = buildSystemPrompt(filtered.map((m) => m.metadata));
        const result = await env.AI.run(MODEL_ID, {
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: q }],
          temperature: 0.3, max_tokens: 1200,
        });
        const answer = (result.response || "").trim();

        const sentences = splitSentences(answer);
        const toCheck = sentences.length ? sentences : [answer];
        const embedResult = await env.AI.run(EMBED_MODEL_ID, { text: toCheck });
        const sentenceScores = toCheck.map((s, i) => {
          let best = 0, title = null;
          for (const m of filtered) {
            const sim = cosineSimilarity(embedResult.data[i], m.values);
            if (sim > best) { best = sim; title = m.metadata.title; }
          }
          const passes = best >= CITATION_THRESHOLD;
          const connective = isConnectiveSentence(s);
          return {
            zdanie: s,
            najlepsze_dopasowanie: title,
            podobienstwo: best.toFixed(3),
            przechodzi: passes,
            grzecznosciowe: connective,
            akcja: passes ? "zachowane" : connective ? "zachowane (grzecznościowe)" : "WYCIĘTE",
          };
        });

        return jsonResponse({
          pytanie: q,
          progi: { MIN_SIMILARITY, CITATION_THRESHOLD },
          znalezione_fragmenty: matches.map((m) => ({ tytul: m.metadata.title, wynik: m.score.toFixed(3) })),
          po_filtrze: filtered.length,
          odpowiedz: answer,
          weryfikacja_zdan: sentenceScores,
        }, corsHeaders());
      } catch (e) {
        return jsonResponse({ blad: e.message }, corsHeaders(), 500);
      }
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders() });
    }

    let question, history;
    try {
      const body = await request.json();
      question = (body.question || "").toString().trim();
      history = sanitizeHistory(body.history);
    } catch {
      return jsonResponse({ error: "Nieprawidłowe zapytanie" }, corsHeaders(), 400);
    }

    if (!question || question.length > MAX_QUESTION_LENGTH) {
      return jsonResponse({
        answer: question ? `Twoja wiadomość jest za długa (limit ${MAX_QUESTION_LENGTH} znaków). Spróbuj podzielić ją na kilka krótszych pytań.` : "Pytanie nie może być puste.",
        source: null,
        gap: false,
      }, corsHeaders(), 400);
    }

    if (env.RATE_LIMIT_KV) {
      const ip = request.headers.get("cf-connecting-ip") || "unknown";
      const bucket = Math.floor(Date.now() / 3600000);
      const key = `rl:${ip}:${bucket}`;
      const current = parseInt((await env.RATE_LIMIT_KV.get(key)) || "0", 10);
      if (current >= RATE_LIMIT_PER_HOUR) {
        return jsonResponse({ answer: "Zbyt wiele zapytań z tego adresu. Spróbuj za chwilę.", source: null, gap: false }, corsHeaders(), 429);
      }
      await env.RATE_LIMIT_KV.put(key, String(current + 1), { expirationTtl: 3600 });
    }

    try {
      const recentUserMsgs = history.filter((h) => h.role === "user").slice(-2).map((h) => h.content);
      const retrievalQuery = [...recentUserMsgs, question].join("\n");

      const isLongQuestion = question.length >= LONG_QUESTION_CHARS;
      const topK = isLongQuestion ? TOP_K_LONG : TOP_K;

      const qVector = await embedText(env, retrievalQuery);
      const results = await env.VECTORIZE.query(qVector, { topK, returnMetadata: true, returnValues: true });
      const allMatches = results.matches || [];
      const filtered = allMatches.filter((m, idx) => idx < MIN_CHUNKS || m.score >= MIN_SIMILARITY);

      if (filtered.length === 0) {
        await logQuestion(env, question, true, null);
        return jsonResponse({ answer: FALLBACK_MESSAGE, source: null, gap: true }, corsHeaders());
      }

      const systemPrompt = buildSystemPrompt(filtered.map((m) => m.metadata));
      const messages = [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: question }];

      const result = await env.AI.run(MODEL_ID, { messages, temperature: 0.3, max_tokens: 1200 });
      const rawAnswer = (result.response || result.choices?.[0]?.message?.content || "").trim();

      if (!rawAnswer || /nie mam takich informacji/i.test(rawAnswer)) {
        await logQuestion(env, question, true, null);
        return jsonResponse({ answer: FALLBACK_MESSAGE, source: null, gap: true }, corsHeaders());
      }

      const verdict = await verifyClaims(rawAnswer, filtered, env);
      if (!verdict.ok) {
        await logQuestion(env, question, true, null);
        return jsonResponse({ answer: verdict.fallback, source: null, gap: true }, corsHeaders());
      }

      await logQuestion(env, question, false, verdict.source);
      return jsonResponse({
        answer: verdict.text,
        source: verdict.source,
        gap: false,
        trimmed: verdict.removed || 0,
      }, corsHeaders());
    } catch (e) {
      return jsonResponse({ answer: `Błąd: ${e.message}. Sprawdź bindingi AI i VECTORIZE.`, source: null, gap: false }, corsHeaders(), 502);
    }
  },
};