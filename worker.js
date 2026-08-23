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

// UKŁAD PLIKÓW — treść mieszka osobno od logiki (rozdzielone 19.08.2026):
//   content-public.js    CHUNKS          — 53 fragmenty publiczne
//   content-internal.js  INTERNAL_CHUNKS — 41 fragmentów wewnętrznych
// Bundler wkleja je z powrotem przy deployu, więc `main` w wrangler.toml
// i rozmiar uploadu się nie zmieniają. Kontrola przed commitem obejmuje
// teraz WSZYSTKIE pliki: node --check na każdym plus wrangler deploy --dry-run,
// bo sam node --check worker.js nie złapie błędu w module treści ani
// literówki w ścieżce importu.
// KLIENCI — tablica klientów i indeks host → klient. Treść (CHUNKS,
// INTERNAL_CHUNKS) wchodzi teraz przez nią, bo należy do konkretnej firmy,
// a nie do produktu. Docelowo ten jeden import zastąpi zapytanie do D1.
import { KLIENCI, HOSTY_INDEX } from "./klienci.js";
import { PANEL_INTERNAL_HTML } from "./panel-internal.js";
import { PANEL_HTML } from "./panel.js";
import { APP_INTERNAL_HTML } from "./app-internal.js";

const TOP_K = 8; // podniesione z 6 — krótkie, ogólne pytania miały za mało kandydatów
const MIN_CHUNKS = 2;
const MIN_SIMILARITY = 0.35;
const CITATION_THRESHOLD = 0.48; // podniesione z 0.42 — przy długich odpowiedziach 0.42 przepuszczało zbyt wiele

// Próg dla zdań KRÓTKICH — obniżony, bo cosinus krótkiego zdania wobec długiego
// fragmentu jest niski NIEZALEŻNIE od tego, czy zdanie jest w nim zawarte.
// Zmierzone 19.08.2026 na 89 zdaniach z przebiegu wewnętrznego: najniższe
// przechodzące zdanie 1–3-słowowe miało 0.520, a wycinane były 0.458
// („poprawek robót") i 0.466 („Zatwierdza to zarząd") — oba z pokryciem
// we fragmentach. Próg 0.45 domyka tę lukę, nie ruszając niczego, co dziś
// przechodzi. Prompt wewnętrzny produkuje takie zdania seryjnie, bo każe
// wypisywać kroki w osobnych liniach — bez tego progu obie warstwy pracują
// przeciwko sobie.
const CITATION_THRESHOLD_KROTKIE = 0.45;
const KROTKIE_ZDANIE_SLOW = 3; // do tylu słów zdanie liczy się jako krótkie

// Deduplikacja: dwa warunki naraz, nie jeden. Pokrycie mówi, ile zdanie
// POWTARZA, a druga stała — ile wnosi NOWEGO. Zdanie wnoszące tyle nowych słów
// treściowych jest rozwinięciem i zostaje, choćby powtarzało wszystko z poprzedniego.
const DUPLIKAT_POKRYCIE = 0.6;
const DUPLIKAT_NOWE_SLOWA = 4;
const HISTORY_TURNS = 6;
const MAX_QUESTION_LENGTH = 3000; // realni klienci piszą długie, opisowe wiadomości
const TOP_K_LONG = 10; // przy długich, wielowątkowych pytaniach pobierz więcej fragmentów
const LONG_QUESTION_CHARS = 400; // od tylu znaków traktujemy pytanie jako złożone
const RATE_LIMIT_PER_HOUR = 30;
const LOG_RETENTION_DAYS = 90; // po tylu dniach wpisy w logu wygasają automatycznie
// Nazwa firmy i zdanie odmowne ZALEŻĄ OD KLIENTA — mieszkają w klienci.js.
// Została po nich jedna reguła, której złamanie jest niewidoczne aż do pomiaru:
// handleAsk() rozpoznaje brak odpowiedzi wyrażeniem /nie mam takich informacji/i
// na SUROWYM tekście modelu, więc zdanie odmowne KAŻDEGO klienta musi tę frazę
// zawierać. Sprawdzamy to przy starcie modułu, żeby błąd konfiguracji nowego
// klienta wyszedł przy `wrangler deploy --dry-run`, a nie u niego na stronie.
const FRAZA_ODMOWY = /nie mam takich informacji/i;
for (const k of Object.values(KLIENCI)) {
  if (!FRAZA_ODMOWY.test(k.prompt.fallback)) {
    throw new Error(`Klient ${k.id}: zdanie odmowne musi zawierać frazę „nie mam takich informacji".`);
  // Nazwy kategorii w panelu muszą pokrywać słownik branżowy. Bez tej asercji
  // dodanie kategorii do słownika daje w panelu kartę z surowym `id`, a literówka
  // w kluczu — kartę, która nigdy się nie zapala. Oba błędy są ciche.
  const zeSlownika = (k.eskalacja?.kategorie || []).map((c) => c.id).sort().join(",");
  const zNazw = Object.keys(k.ui?.nazwyEskalacji || {}).sort().join(",");
  if (zeSlownika !== zNazw) {
    throw new Error(`Klient ${k.id}: ui.nazwyEskalacji nie pokrywa się ze słownikiem eskalacji.\n` +
      `  słownik: ${zeSlownika}\n  nazwy:   ${zNazw}`);
  }
  }
}

// ============================================================
// PRZESTRZENIE WIEDZY — separacja na poziomie danych, nie promptu
// ============================================================
//
// Publiczny widget i bot dla pracowników korzystają z tego samego indeksu,
// ale z ROZŁĄCZNYCH przestrzeni nazw (namespaces) w bazie wektorowej.
// Zapytanie do przestrzeni `public` fizycznie nie widzi wektorów z `internal` —
// to filtr po stronie bazy, wykonany zanim cokolwiek trafi do modelu.
//
// DLACZEGO NIE PROMPTEM
// Instrukcja w prompcie („nie ujawniaj treści wewnętrznych") jest sugestią dla
// modelu — działa, dopóki model współpracuje. Prompt injection, nietypowe
// sformułowanie pytania albo nowa wersja modelu ją omijają. Separacja
// namespace'ami nie ma tej klasy podatności: fragmentu, którego baza nie zwróci,
// model nie ma jak zacytować, bo nigdy go nie zobaczył.
//
// DLACZEGO PRZESTRZEŃ PUBLICZNA JEST WPISANA NA SZTYWNO
// Publiczny endpoint NIE przyjmuje nazwy przestrzeni jako parametru — ani z
// ciała żądania, ani z query stringa, ani z nagłówka. Gdyby przyjmował, cała
// separacja wisiałaby na poprawności sprawdzenia autoryzacji, czyli na kodzie,
// w którym da się zrobić błąd. Przy wpisaniu na sztywno błąd w autoryzacji
// **nadal nie otwiera** dostępu do wiedzy wewnętrznej: publiczny widget nie ma
// fizycznej możliwości poprosić o `internal`, bo nie ma czym.
//
// DRUGI WYMIAR — KLIENT (od 21.08.2026)
// Poniższe nazwy to RODZAJE przestrzeni, nie ich fizyczne nazwy w Vectorize.
// Rodzaj przychodzi z routingu (jak dotąd), klient — z hosta. Fizyczną nazwę
// składa `przestrzenFizyczna()` wewnątrz granicy dostawcy i nigdzie indziej.
// Dzięki temu `askedFrom`, pole `space` w logu, filtr w /stats i tryb promptu
// znaczą dokładnie to samo, co przed dodaniem drugiego klienta.
const SPACE_PUBLIC = "public";
const SPACE_INTERNAL = "internal";
const SPACES_ALLOWED = [SPACE_PUBLIC, SPACE_INTERNAL];

// Przestrzenie przeszukiwane przez poszczególne endpointy. Listy są stałymi
// modułowymi, nie da się ich złożyć z danych z żądania.
const SPACES_FOR_PUBLIC = [SPACE_PUBLIC];
const SPACES_FOR_INTERNAL = [SPACE_PUBLIC, SPACE_INTERNAL]; // pracownik widzi też to, co firma obiecuje klientom

// Rola widzącego fragment. Na starcie wszyscy widzą wszystko, ale u klientów
// premium (kancelarie, medycyna) role będą konieczne — a dopisanie tego pola
// później oznacza ponowne indeksowanie u każdego klienta. Dlatego jest teraz,
// mimo że nic jeszcze po nim nie filtruje.
const DEFAULT_ROLE = "all";

// ============================================================
// GRANICA DOSTAWCY — jedyne miejsce, które wie, że pod spodem jest Cloudflare
// ============================================================
//
// PO CO TO ISTNIEJE
// Cloudflare wystarcza na dziś i na dziesiątki klientów, ale ma dwie luki:
// brak gwarancji rezydencji danych w UE poza planem enterprise oraz katalog
// modeli zmieniający się bez uprzedzenia (raz już nas to trafiło — model został
// wycofany między sesjami). Segment premium (kancelarie, medycyna, finanse)
// będzie wymagał hostingu w UE. Ta granica ma pozwolić obsłużyć takiego klienta
// TĄ SAMĄ BAZĄ KODU, zmieniając wyłącznie obiekt PROVIDER i wnętrza funkcji
// poniżej — bez dotykania logiki RAG, progów, promptu i weryfikacji.
//
// CZEGO NIE WOLNO PRZEZ NIĄ PRZEPUSZCZAĆ
// - Żaden kod poza tą sekcją nie odwołuje się do `env.AI` ani `env.VECTORIZE`.
//   Jeśli piszesz `env.AI.run(...)` gdziekolwiek indziej — granica jest złamana.
// - Nazwy modeli i wymiarowość embeddingów żyją wyłącznie w PROVIDER. Nigdzie
//   indziej nie ma prawa pojawić się literał `@cf/...`.
// - Kształt odpowiedzi dostawcy (`res.data`, `res.response`, `results.matches`)
//   nie wychodzi na zewnątrz. Funkcje zwracają zwykłe tablice i stringi, więc
//   inny dostawca o innym kształcie odpowiedzi nie przecieka do reszty kodu.
// - W drugą stronę: do tych funkcji nie trafiają obiekty specyficzne dla
//   dostawcy — tylko teksty, wektory i liczby.
//
// `env` jest pierwszym argumentem, bo w Workerach bindingi żyją per-request
// i nie ma do nich dostępu z zasięgu modułu.

const PROVIDER = {
  name: "cloudflare-workers-ai",
  generation: {
    // Nie wracać do 8B — powód w DECYZJE.md, sekcja „Dlaczego 70B".
    model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    temperature: 0.3,
    maxTokens: 1200,
  },
  embedding: {
    model: "@cf/baai/bge-m3",
    dimensions: 1024, // musi zgadzać się z wymiarowością indeksu wektorowego
  },
};

// embed(env, texts) → tablica wektorów, w kolejności wejścia.
// Jedno wywołanie na całą tablicę: Cloudflare ma limit 50 podzapytań na
// wywołanie Workera, więc wsadowość jest wymogiem, nie optymalizacją.
async function embed(env, texts) {
  const res = await env.AI.run(PROVIDER.embedding.model, { text: texts });
  return res.data;
}

// generate(env, systemPrompt, messages, opts) → gotowy tekst odpowiedzi.
// `messages` to historia rozmowy BEZ wiadomości systemowej — składa ją ta
// funkcja, żeby wywołujący nie musiał znać konwencji ról danego dostawcy.
async function generate(env, systemPrompt, messages, opts = {}) {
  const result = await env.AI.run(PROVIDER.generation.model, {
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    temperature: opts.temperature ?? PROVIDER.generation.temperature,
    max_tokens: opts.maxTokens ?? PROVIDER.generation.maxTokens,
  });
  return (result.response || result.choices?.[0]?.message?.content || "").trim();
}

// Sprawdza, że przestrzeń jest jedną ze znanych. Rzuca zamiast zwracać wartość
// domyślną: cicha zamiana nieznanej przestrzeni na `public` byłaby dokładnie tym
// błędem, który mógłby kiedyś pokazać treść wewnętrzną nie tej stronie.
function assertSpaces(rodzaje) {
  if (!Array.isArray(rodzaje) || rodzaje.length === 0) {
    throw new Error("Nie podano przestrzeni wiedzy do przeszukania.");
  }
  for (const r of rodzaje) {
    if (!SPACES_ALLOWED.includes(r)) {
      throw new Error(`Nieznana przestrzeń wiedzy: ${r}`);
    }
  }
  return rodzaje;
}

// Klient jest OBOWIĄZKOWY wszędzie, gdzie w grę wchodzi treść. Rzucamy zamiast
// podstawiać cokolwiek domyślnego — z tego samego powodu, dla którego nie ma
// wartości domyślnej dla przestrzeni: cichy wybór klienta to dokładnie ten błąd,
// który kiedyś pokazałby dokumentację jednej firmy komuś z drugiej.
function wymagajKlienta(klient) {
  if (!klient || !klient.id) {
    throw new Error("Brak klienta — bez niego nie da się wskazać przestrzeni wiedzy.");
  }
  return klient;
}

// Fizyczna nazwa przestrzeni w Vectorize: dwa wymiary w jednym stringu.
// Nazwy są WPISANE w tablicy klienta, nie generowane ze wzorca — dzięki temu
// BudMax mógł zostać przy `public`/`internal` bez reindeksu i migracji.
function przestrzenFizyczna(klient, rodzaj) {
  const [r] = assertSpaces([rodzaj]);
  const ns = wymagajKlienta(klient).przestrzenie[r];
  if (!ns) throw new Error(`Klient ${klient.id} nie ma przestrzeni „${r}".`);
  return ns;
}

// vectorSearch(env, vector, opts) → tablica dopasowań: { id, score, values, metadata }.
// Wektory (`values`) są potrzebne weryfikacji zdanie-po-zdaniu, metadane —
// budowie promptu. Zwracamy zawsze tablicę, nigdy undefined.
//
// `opts.rodzaje` i `opts.klient` są OBOWIĄZKOWE i nie mają wartości domyślnych —
// wywołujący musi świadomie powiedzieć, CZYJĄ i KTÓRĄ przestrzeń przeszukuje. Vectorize przeszukuje
// jedną przestrzeń na zapytanie, więc przy kilku robimy tyle zapytań i scalamy
// wyniki po wyniku podobieństwa, jakby przyszły z jednego.
async function vectorSearch(env, vector, opts = {}) {
  const klient = wymagajKlienta(opts.klient);
  const rodzaje = assertSpaces(opts.rodzaje);
  const topK = opts.topK ?? TOP_K;

  const perSpace = await Promise.all(
    rodzaje.map((rodzaj) =>
      env.VECTORIZE.query(vector, {
        namespace: przestrzenFizyczna(klient, rodzaj),
        topK,
        returnMetadata: true,
        returnValues: true,
      })
    )
  );

  const merged = [];
  for (const results of perSpace) {
    for (const m of results.matches || []) merged.push(m);
  }
  merged.sort((a, b) => b.score - a.score);
  return merged.slice(0, topK);
}

// Zapis i usuwanie z indeksu — używane tylko przez /reindex i /purge, ale muszą
// być tutaj: inaczej `env.VECTORIZE` wyciekłoby poza granicę.
//
// `upsert`, nie `insert`: insert po cichu POMIJA wektory o istniejącym ID, więc
// zmiana treści fragmentu nigdy nie docierała do indeksu — poprawka wymagała
// wcześniej usunięcia wpisu przez /purge. Upsert nadpisuje, dzięki czemu
// /reindex jest idempotentny i faktycznie odzwierciedla CHUNKS.
async function vectorUpsert(env, vectors, klient, rodzaj) {
  const ns = przestrzenFizyczna(klient, rodzaj);
  await env.VECTORIZE.upsert(vectors.map((v) => ({ ...v, namespace: ns })));
}

async function vectorDelete(env, ids) {
  await env.VECTORIZE.deleteByIds(ids);
}

// ============================================================
// TREŚĆ — w osobnych plikach, importowana na górze tego pliku
// ============================================================
// CHUNKS → content-public.js, INTERNAL_CHUNKS → content-internal.js.
// Tu nie ma czego szukać: to jedyne miejsce, w którym stała treść firmowa
// stykała się z logiką, i właśnie dlatego dało się ją odsunąć bez ryzyka.
// ============================================================

// Lista, nie pojedyncza wartość — przy wielu klientach każdy będzie miał własną
// stronę, z której wolno wołać Workera. Wpisy to **sama domena bez ścieżki**,
// bo przeglądarka wysyła w nagłówku Origin tylko protokół i host.
//
// Kolejność ma znaczenie tylko dla pierwszego wpisu: jest odpowiedzią domyślną,
// gdy Origin nie pasuje do niczego. Nieznany origin i tak zostanie zablokowany
// przez przeglądarkę — chodzi o to, żeby nie odsyłać mu jego własnej wartości.
// ============================================================
// HOSTY KLIENTA — jedyne miejsce w kodzie z nazwami adresów
// ============================================================
//
// Trzy hosty, trzy role. Nazwa hostu jest jedynym nośnikiem roli: Worker nie ma
// listy uprawnionych ani pola roli w tokenie — patrz DECYZJE.md → „Panel
// właściciela na Access".
//
// DOPASOWANIE JEST DOKŁADNE, NIE PODCIĄGIEM. Do 21.08.2026 role rozpoznawał
// `hostname.includes("wewnetrzny")` i `includes("-panel.")`. Zmiana nazw hostów
// w aplikacjach Access (`budmax-wewnetrzny` → `budmax-pracownik`,
// `budmax-panel` → `budmax-wlasciciel`) **po cichu odebrałaby rolę obu hostom**:
// żadna nowa nazwa nie pasowała do żadnego wzorca, więc tryb pracowniczy
// i panel przestałyby działać, a nikt by tego nie zauważył przed pomiarem.
// Dokładne dopasowanie ma też lepszą stronę awaryjną: host, którego tu nie ma,
// **nie dostaje żadnej roli** — także stary adres, gdyby trasa gdzieś została.
// TABLICA HOSTÓW PRZENIOSŁA SIĘ DO `klienci.js` (21.08.2026), bo host należy
// do klienta, nie do produktu. Zasada dopasowania NIE ZMIENIŁA SIĘ: jest
// dokładne (`Map.get` po pełnej nazwie), nigdy przez podciąg. Host, którego
// w tablicy nie ma, nie dostaje ani klienta, ani roli — i nie dostaje
// odpowiedzi. To ta sama strona awaryjna co dotąd, tylko szersza.
//
// Jedno rozpoznanie daje OBA wymiary naraz: czyj to host i w jakiej roli.
function rozpoznajHost(url) {
  return HOSTY_INDEX.get(url.hostname) || null;
}

// Który KLIENT stoi pod tym adresem. Jedyne miejsce, które o tym decyduje —
// przy przejściu na D1 zmieni się ta funkcja i nic poza nią.
function rozpoznajKlienta(url) {
  const t = rozpoznajHost(url);
  return t ? t.klient : null;
}

// Która ROLA: `publiczny`, `pracownik` albo `wlasciciel`.
function rolaHosta(url) {
  const t = rozpoznajHost(url);
  return t ? t.rola : null;
}

const ALLOWED_ORIGINS = [
  "https://p0rk1.github.io",              // widget publiczny — GitHub Pages
  // Hosty wszystkich klientów. Adresy `stare` celowo NIE wchodzą: mają dalej
  // przyjmować żądania, ale nie są miejscem, z którego ktokolwiek osadza widget.
  ...[...HOSTY_INDEX.entries()].filter(([, t]) => !t.stary).map(([host]) => `https://${host}`),
];

// Host PRACOWNICZY — aplikacja asystenta budowy, cały host za Access.
// Osobna funkcja, a nie wklejony warunek: przy multi-tenant zmieni się tu
// jedno miejsce, nie trzy.
function hostPracownika(url) {
  return rolaHosta(url) === "pracownik";
}

// Host WŁAŚCICIELA — oba panele analityczne. Osobny host, nie ścieżka na hoście
// pracowniczym, i to jest sedno rozwiązania ról: pracownik i właściciel wchodzą
// pod różne adresy, objęte różnymi aplikacjami Access z różnymi politykami.
// Dzięki temu rola wynika z HOSTA i nie trzeba jej sprawdzać w kodzie — nie
// powstaje żaden system ról, lista uprawnionych ani pole w tokenie.
//
// Wariant „panel na hoście pracowniczym, rola z polityki" odrzucony: wymagałby
// albo aplikacji Access na ścieżce (wzorzec odrzucony wcześniej — ochrona
// stałaby na poprawnie wpisanym polu `Path`), albo listy e-maili w kodzie.
// Przy One-time PIN token nie niesie grup, więc nie ma się na czym oprzeć.
function hostWlasciciela(url) {
  return rolaHosta(url) === "wlasciciel";
}

// INTERFEJSU CHRONIONEJ POWIERZCHNI NIE SERWUJEMY, DOPÓKI OCHRONY NIE MA.
//
// `/app`, `/panel` i `GET /` na hostach za Access są tylko skorupą — dane i tak
// wymagają tokenu. Ale zanim aplikacja Access powstanie, host odpowiada bez
// żadnego logowania, więc skorupa wisi publicznie. Zmierzone 21.08.2026 zaraz
// po utworzeniu hostu panelowego: `GET /` oddawało panel każdemu.
//
// Dlatego HTML też jest zależny od konfiguracji: brak zmiennych = 503 z nazwą
// tego, czego brakuje. To ta sama reguła, co przy `/internal` — czytelny błąd
// konfiguracji zamiast cichej odmowy albo, co gorsza, cichej zgody.
function odpowiedzBrakKonfiguracji(url, env, request) {
  const { missing } = accessConfig(env, url);
  if (!missing.length) return null;
  const czego = hostWlasciciela(url) ? "Panel właściciela" : "Tryb wewnętrzny";
  return new Response(
    `${czego} nie jest jeszcze skonfigurowany.\n\n` +
    `Brakujące zmienne: ${missing.join(", ")}\n` +
    `Co zrobić: uzupełnij [vars] w wrangler.toml i wdroż ponownie.\n` +
    `Krok po kroku: ZERO-TRUST.md w repozytorium.\n`,
    { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", ...corsHeaders(request) } }
  );
}

// ============================================================
// MOTYW I TREŚĆ INTERFEJSU — składane z pól klienta (24.08.2026)
//
// Silnik nie zna żadnej branży ani żadnej palety: bierze `klient.motyw`
// i `klient.ui` i zamienia je na kawałki HTML/CSS wstrzykiwane przez
// istniejący mechanizm `{{klucz}}`. Trzecia branża to dopisanie palety
// i kroju w `klienci.js`, bez dotykania plików interfejsu.
//
// Wszystkie trzy interfejsy miały do 24.08.2026 własną kopię tego samego
// bloku `:root` — trzy duplikaty, które rozjechałyby się przy pierwszej zmianie.
// ============================================================

// Blok `:root` motywu. Nazwy zmiennych zostają te same, co przed zmianą,
// więc wszystkie reguły CSS w plikach interfejsu działają bez przeróbek.
function motywCss(klient) {
  const m = klient.motyw;
  const k = m.kolory;
  return `:root{
  --void:${k.void};--deck:${k.deck};--panel:${k.panel};
  --line:${k.line};--line-soft:${k.lineSoft};
  --chalk:${k.chalk};--mute:${k.mute};--dim:${k.dim};
  --hi:${k.hi};--blue:${k.blue};--ok:${k.ok};--warn:${k.warn};--danger:${k.danger};
  --cien:${k.cien};
  --promien:${m.promien};
  --trop:${m.tropNaglowka};
  --font-naglowek:${m.fontNaglowek};
  --font-tekst:${m.fontTekst};
  --font-mono:${m.fontMono};
  --siatka-rozmiar:${m.siatka.rozmiar};
  --siatka-krycie:${m.siatka.widoczna ? m.siatka.krycie : "0"};
  --ramka-akcentu:${m.akcentRamki ? "1" : "0"};
  --rozmycie:${m.rozmycie};
  --sp:cubic-bezier(.22,1,.36,1);
}`;
}

function linkFontow(klient) {
  return `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${klient.motyw.fontyUrl}" rel="stylesheet">`;
}

// Kafle szybkiego startu. Numer w monospace zamiast emoji — ten sam język,
// którego używają nagłówki bloków w panelach, i jeden mechanizm dla każdej branży.
function kafleHtml(klient) {
  return (klient.ui.kafle || [])
    .map((kafel, i) => {
      const nr = String(i + 1).padStart(2, "0");
      const klasa = kafel.pilny ? "chip danger-chip" : "chip";
      return `<button class="${klasa}" data-q="${escapeHtml(kafel.pytanie)}">` +
        `<span class="chip-nr">/ ${nr}</span>${escapeHtml(kafel.etykieta)}</button>`;
    })
    .join("\n      ");
}

// Kategorie eskalacji dla panelu: nazwa z `ui`, pilność ze SŁOWNIKA.
// Pilność nie jest przepisywana ręcznie, żeby panel nie mógł pokazać czegoś
// jako spokojne, gdy słownik uznał to za pilne.
function eskalacjeJson(klient) {
  const pilne = new Map((klient.eskalacja?.kategorie || []).map((c) => [c.id, !!c.pilne]));
  const out = {};
  for (const [id, nazwa] of Object.entries(klient.ui.nazwyEskalacji || {})) {
    out[id] = { nazwa, pilne: pilne.get(id) === true };
  }
  return JSON.stringify(out);
}

function escapeHtml(t) {
  return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// PODSTAWIANIE NAZW W SZABLONACH HTML.
// Szablony są stringami z placeholderami `{{klucz}}`, wypełnianymi z `klient.ui`.
// Bez frameworka i bez logiki w szablonie: to ma zamieniać nazwy, a nie budować
// widoki. Nieznany placeholder zostaje w tekście — widać go od razu na ekranie,
// zamiast cicho zniknąć.
function renderHtml(szablon, klient, env, rola) {
  const dane = {
    ...klient.ui,
    przelacznikDemo: przelacznikDemo(env, klient, rola),
    motywCss: motywCss(klient),
    fontyLink: linkFontow(klient),
    themeColor: klient.motyw.themeColor,
    kafle: kafleHtml(klient),
    eskalacjeJson: eskalacjeJson(klient),
  };
  return szablon.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in dane ? dane[k] : m));
}

// PRZEŁĄCZNIK DEMONSTRACYJNY — narzędzie prezentacyjne, nie funkcja produktu.
//
// Istnieje WYŁĄCZNIE przy `DEMO = "1"` w [vars]. U klienta tej zmiennej nie ma,
// więc przełącznika nie ma FIZYCZNIE w wysłanym HTML-u — nie jest ukryty CSS-em
// ani schowany za warunkiem w JavaScripcie, który da się obejść konsolą.
//
// To LISTA LINKÓW do hostów drugiego klienta, a nie kontrolka zmieniająca stan.
// Nie istnieje ścieżka, w której kliknięcie zmienia przeszukiwaną przestrzeń:
// zmienia adres, a klient nadal wynika z hosta. Dzięki temu przełącznik nie ma
// czym niczego zepsuć — najgorsze, co robi, to prowadzi pod adres, który
// odpowie 404.
function przelacznikDemo(env, klient, rola) {
  if (env.DEMO !== "1") return "";
  const inni = Object.values(KLIENCI).filter((k) => k.id !== klient.id && k.hosty[rola]);
  if (!inni.length) return "";
  const linki = inni
    .map((k) => `<a href="https://${k.hosty[rola]}/" style="color:inherit">${k.ui.etykietaPrzelacznika}</a>`)
    .join(" · ");
  return `<div style="position:fixed;left:0;right:0;bottom:0;padding:4px 10px;font:11px/1.4 ui-monospace,monospace;` +
    `color:#8a8a8a;background:rgba(0,0,0,.55);text-align:center;letter-spacing:.04em;z-index:9999">` +
    `demo · ${klient.ui.nazwaKrotka} · przełącz na ${linki}</div>`;
}

function corsHeaders(request) {
  const origin = request?.headers?.get("Origin") || "";
  const dozwolony = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": dozwolony,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    // Odpowiedź zależy od nagłówka Origin — bez tego pośrednik mógłby podać
    // jednemu klientowi odpowiedź zbuforowaną dla drugiego.
    "Vary": "Origin",
  };
}

// Klucz administracyjny żyje w sekrecie Workera, nie w kodzie. Fail-closed:
// jeśli sekret nie jest ustawiony, żaden klucz z URL-a nie otwiera endpointu.
//
// UWAGA: `isAdmin` chroni WYŁĄCZNIE endpointy administracyjne (/reindex, /purge,
// /stats, /debug). Na /internal ten klucz **nie działa** — patrz sekcja niżej.
function isAdmin(url, env) {
  const secret = env.REINDEX_SECRET;
  if (!secret) return false;
  return url.searchParams.get("key") === secret;
}

// ============================================================
// TOŻSAMOŚĆ — Cloudflare Zero Trust Access (tylko /internal)
// ============================================================
//
// PO CO TO ISTNIEJE
// Do etapu 1 /internal chodził na tym samym sekrecie co /reindex i /purge, więc
// pracownik dostający dostęp do bota dostawał też prawo skasowania indeksu.
// Teraz uprawnienia są rozdzielone:
//   - /reindex, /purge, /stats, /debug → REINDEX_SECRET (administrator)
//   - /internal                        → tożsamość z Access (pracownik)
// Sekret na /internal **przestał działać** i nie ma tam żadnej ścieżki obejścia.
//
// CZEGO NIE ROBIMY
// Nie ufamy samej obecności nagłówka `Cf-Access-Jwt-Assertion`. Nagłówek może
// dopisać każdy, kto trafi do Workera z pominięciem Access (choćby przez adres
// workers.dev). Dlatego token jest weryfikowany kryptograficznie: podpis
// przeciwko kluczom publicznym zespołu, wystawca, odbiorca (AUD) i ważność.
// Bez kompletu tych czterech sprawdzeń nagłówek jest bezwartościowy.

const ACCESS_CERTS_TTL_MS = 3_600_000; // klucze zespołu rotują rzadko
const ACCESS_CLOCK_SKEW_S = 60;        // tolerancja rozjazdu zegarów

// Cache kluczy w zasięgu modułu — izolat Workera bywa użyty do wielu żądań,
// więc oszczędza to pobrania. Cache jest per-izolat, nie globalny: wygaśnięcie
// klucza po stronie Cloudflare zostanie podchwycone najpóźniej po TTL.
let accessCertsCache = { teamDomain: null, fetchedAt: 0, keys: null };

function base64UrlToBytes(input) {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlToJson(input) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(input)));
}

// Konfiguracja Access. Obie wartości są jawne (nie są sekretami) i mieszkają
// w [vars] w wrangler.toml — dzięki temu deploy z CLI ich nie zgubi.
// AUD zależy od HOSTA, nie jest jedną wartością na Workera.
//
// Każda aplikacja Access ma własny AUD, a mamy ich teraz dwie: host wewnętrzny
// (pracownicy) i host panelowy (właściciel). Sprawdzanie „którykolwiek ze znanych
// AUD-ów" byłoby dziurą — token pracownika z hosta wewnętrznego otwierałby panel
// właściciela. Dlatego oczekiwany AUD wybiera host, a nie lista.
//
// To jest pierwsza rata długu zapisanego w DECYZJE.md → „Adresy i domeny":
// przy multi-tenant `ACCESS_AUD` i tak musi stać się mapą `host → AUD`.
// Tutaj jest minimalna, dwuelementowa wersja tej mapy.
function accessConfig(env, url = null) {
  const teamDomain = (env.ACCESS_TEAM_DOMAIN || "")
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
  // Nazwa zmiennej z AUD-em przychodzi z tablicy klienta, po ROLI hosta.
  // Host nierozpoznany dostaje `ACCESS_AUD` — dokładnie jak przed wprowadzeniem
  // klientów. To nie jest furtka: żadna trasa nie woła weryfikacji tokenu
  // wcześniej niż po ustaleniu roli hosta, więc ta gałąź jest osiągalna tylko
  // w teście jednostkowym, który podstawia własny host.
  const klient = url ? rozpoznajKlienta(url) : null;
  const rola = url ? rolaHosta(url) : null;
  const nazwaAud = (klient && rola && klient.audVars && klient.audVars[rola]) || "ACCESS_AUD";
  const aud = (env[nazwaAud] || "").trim();
  const missing = [];
  if (!teamDomain) missing.push("ACCESS_TEAM_DOMAIN");
  if (!aud) missing.push(nazwaAud);
  return { teamDomain, aud, missing, nazwaAud };
}

async function fetchAccessCerts(teamDomain, { force = false } = {}) {
  const swieze =
    accessCertsCache.keys &&
    accessCertsCache.teamDomain === teamDomain &&
    Date.now() - accessCertsCache.fetchedAt < ACCESS_CERTS_TTL_MS;
  if (swieze && !force) return accessCertsCache.keys;

  const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!res.ok) {
    throw new Error(`klucze zespołu niedostępne (HTTP ${res.status} z ${teamDomain})`);
  }
  const body = await res.json();
  const keys = Array.isArray(body.keys) ? body.keys : [];
  if (!keys.length) {
    throw new Error(`zespół ${teamDomain} nie zwrócił żadnych kluczy publicznych`);
  }
  accessCertsCache = { teamDomain, fetchedAt: Date.now(), keys };
  return keys;
}

// Zwraca { ok: true, identity } albo { ok: false, status, error, szczegoly }.
// Nigdy nie rzuca — wywołujący ma dostać czytelny powód, nie milczące 403.
async function verifyAccessJwt(request, env) {
  // Host z żądania wybiera, którą aplikację Access uznajemy za właściwą.
  let urlZadania = null;
  try { urlZadania = new URL(request.url); } catch { urlZadania = null; }
  const { teamDomain, aud, missing } = accessConfig(env, urlZadania);
  const czegoDotyczy = urlZadania && hostWlasciciela(urlZadania) ? "Panel właściciela" : "Tryb wewnętrzny";

  // Ścieżka awaryjna: Access nieskonfigurowany. 503, nie 403 — to nie jest
  // odmowa dostępu, tylko brak konfiguracji, i komunikat ma to mówić wprost.
  if (missing.length) {
    return {
      ok: false,
      status: 503,
      error: `${czegoDotyczy} nie jest jeszcze skonfigurowany — brak połączenia z Cloudflare Zero Trust Access.`,
      szczegoly: {
        brakujace_zmienne: missing,
        co_zrobic: "Uzupełnij [vars] w wrangler.toml i wdroż ponownie. Krok po kroku: ZERO-TRUST.md w repozytorium.",
      },
    };
  }

  const token =
    request.headers.get("Cf-Access-Jwt-Assertion") ||
    (request.headers.get("Cookie") || "").match(/(?:^|;\s*)CF_Authorization=([^;]+)/)?.[1] ||
    "";

  if (!token) {
    const uzytoKlucza = new URL(request.url).searchParams.has("key");
    return {
      ok: false,
      status: 401,
      error: "Brak tokenu tożsamości Cloudflare Access.",
      szczegoly: {
        powod: "Żądanie nie przeszło przez Access — brak nagłówka Cf-Access-Jwt-Assertion i ciasteczka CF_Authorization.",
        co_zrobic: uzytoKlucza
          ? "Klucz administracyjny (?key=) NIE otwiera już trybu wewnętrznego. Wejdź przez adres objęty aplikacją Access i zaloguj się przez Google albo Microsoft."
          : "Wejdź przez adres objęty aplikacją Access i zaloguj się przez Google albo Microsoft.",
      },
    };
  }

  const czesci = token.split(".");
  if (czesci.length !== 3) {
    return { ok: false, status: 401, error: "Token tożsamości ma nieprawidłową budowę." };
  }

  let naglowek, ladunek;
  try {
    naglowek = base64UrlToJson(czesci[0]);
    ladunek = base64UrlToJson(czesci[1]);
  } catch {
    return { ok: false, status: 401, error: "Nie udało się odczytać tokenu tożsamości." };
  }

  if (naglowek.alg !== "RS256") {
    return { ok: false, status: 401, error: `Nieobsługiwany algorytm podpisu: ${naglowek.alg}.` };
  }

  // Podpis sprawdzamy PRZED zaufaniem czemukolwiek z ładunku.
  let keys;
  try {
    keys = await fetchAccessCerts(teamDomain);
  } catch (e) {
    return {
      ok: false,
      status: 502,
      error: "Nie udało się pobrać kluczy publicznych zespołu Access — token nie może zostać zweryfikowany.",
      szczegoly: { powod: e.message },
    };
  }

  let jwk = keys.find((k) => k.kid === naglowek.kid);
  if (!jwk) {
    // Klucz mógł się przed chwilą zrotować — jedna próba odświeżenia cache.
    try {
      keys = await fetchAccessCerts(teamDomain, { force: true });
      jwk = keys.find((k) => k.kid === naglowek.kid);
    } catch { /* niżej i tak odrzucimy */ }
  }
  if (!jwk) {
    return { ok: false, status: 401, error: "Token podpisano kluczem nieznanym dla tego zespołu." };
  }

  const podpisOk = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    await crypto.subtle.importKey(
      "jwk",
      { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    ),
    base64UrlToBytes(czesci[2]),
    new TextEncoder().encode(`${czesci[0]}.${czesci[1]}`)
  );
  if (!podpisOk) {
    return { ok: false, status: 401, error: "Podpis tokenu tożsamości jest nieprawidłowy." };
  }

  // Dopiero teraz ładunek jest wiarygodny.
  const oczekiwanyIss = `https://${teamDomain}`;
  if (ladunek.iss !== oczekiwanyIss) {
    return { ok: false, status: 401, error: `Token wystawiony przez inny zespół (${ladunek.iss || "brak"}).` };
  }

  const odbiorcy = Array.isArray(ladunek.aud) ? ladunek.aud : [ladunek.aud].filter(Boolean);
  if (!odbiorcy.includes(aud)) {
    return {
      ok: false,
      status: 401,
      error: "Token wystawiony dla innej aplikacji Access.",
      szczegoly: { powod: "Wartość AUD w tokenie nie zgadza się z ACCESS_AUD tego Workera." },
    };
  }

  const teraz = Math.floor(Date.now() / 1000);
  if (typeof ladunek.exp !== "number" || ladunek.exp + ACCESS_CLOCK_SKEW_S < teraz) {
    return { ok: false, status: 401, error: "Token tożsamości wygasł — zaloguj się ponownie." };
  }
  if (typeof ladunek.nbf === "number" && ladunek.nbf - ACCESS_CLOCK_SKEW_S > teraz) {
    return { ok: false, status: 401, error: "Token tożsamości nie jest jeszcze ważny." };
  }

  // E-mail i domena — podstawa przyszłego rozpoznawania klienta w architekturze
  // wielu firm. Na razie tylko odczytane i przekazane dalej, nic po nich nie filtruje.
  const email = (ladunek.email || "").toLowerCase();
  const domena = email.includes("@") ? email.split("@").pop() : null;

  return {
    ok: true,
    identity: {
      email: email || null,
      domena,
      sub: ladunek.sub || null,
      wygasa: ladunek.exp,
    },
  };
}

function jsonResponse(obj, extraHeaders, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

async function embedText(env, text) {
  const vectors = await embed(env, [text]);
  return vectors[0];
}

// Która tablica zasila którą przestrzeń. Mapa jest jawna, żeby nie dało się
// przypadkiem zaindeksować treści wewnętrznej do przestrzeni publicznej.
function chunksForSpace(klient, rodzaj) {
  const [r] = assertSpaces([rodzaj]);
  const tresc = wymagajKlienta(klient).tresc[r];
  if (!tresc) throw new Error(`Klient ${klient.id} nie ma treści dla przestrzeni „${r}".`);
  return tresc;
}

async function handleReindex(env, klient, rodzaj) {
  const source = chunksForSpace(klient, rodzaj);
  const BATCH_SIZE = 10; // grupujemy, żeby nie przekroczyć limitu subrequestów na jedno wywołanie Workera
  let inserted = 0;
  for (let i = 0; i < source.length; i += BATCH_SIZE) {
    const batch = source.slice(i, i + BATCH_SIZE);
    const texts = batch.map((c) => `${c.title}\n${c.text}`);
    const embedded = await embed(env, texts);
    const vectors = batch.map((chunk, idx) => ({
      id: chunk.id,
      values: embedded[idx],
      metadata: {
        title: chunk.title,
        text: chunk.text,
        space: rodzaj,
        // Pole `klient` w metadanych jest dopisywane teraz, choć nic po nim
        // jeszcze nie filtruje — dokładnie z tego samego powodu co `role`:
        // dopisanie go później znaczy reindeks u każdego klienta.
        klient: klient.id,
        role: chunk.role || DEFAULT_ROLE,
      },
    }));
    await vectorUpsert(env, vectors, klient, rodzaj);
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

// LICZEBNIKI ZAPISANE SŁOWNIE — tylko po stronie ŹRÓDŁA (od 22.08.2026).
//
// SKĄD SIĘ WZIĘŁO. Pomiar kancelarii: fragment mówi „apelację wnosi się
// w terminie DWÓCH TYGODNI od doręczenia", model odpowiedział „termin na
// apelację wynosi 14 dni od doręczenia" — i zdanie zostało wycięte, bo cyfry
// `14` nie ma w dokumentacji dosłownie. Odpowiedź była poprawna.
//
// To NIE jest specyfika kancelarii. Dokumenty formalne — umowy, regulaminy,
// pisma urzędowe, akty prawne — zapisują terminy słownie z zasady, więc ta
// kolizja czeka u większości klientów. W BudMaksie nie wystąpiła tylko dlatego,
// że jego dokumentacja pisze cyframi („22%", „300 zł", „2 metry").
//
// CZEGO TO NIE ROZLUŹNIA — i to jest cała różnica:
// rozszerzamy wyłącznie ZBIÓR LICZB UZIEMIAJĄCYCH, czyli to, co dokumentacja
// już mówi, tylko innym zapisem. Liczby ze zdania modelu nadal muszą trafić
// w ten zbiór. Liczba, której w źródle nie ma w żadnej postaci — ani cyfrą,
// ani słownie — wypada tak samo jak dotąd, łącznie z arytmetyką modelu.
// Rozszerzenie działa TYLKO w tę stronę: liczebnik w odpowiedzi nie jest
// zamieniany na cyfrę, bo to zaostrzyłoby warstwę i wycinałoby zdania, które
// dziś przechodzą.
const LICZEBNIKI = new Map(Object.entries({
  jeden: 1, jednego: 1, jedna: 1, jednej: 1, jedno: 1, jednym: 1,
  dwa: 2, dwoch: 2, dwie: 2, dwu: 2, dwoma: 2,
  trzy: 3, trzech: 3, trzema: 3,
  cztery: 4, czterech: 4, czterema: 4,
  piec: 5, pieciu: 5, szesc: 6, szesciu: 6,
  siedem: 7, siedmiu: 7, osiem: 8, osmiu: 8,
  dziewiec: 9, dziewieciu: 9, dziesiec: 10, dziesieciu: 10,
  jedenascie: 11, jedenastu: 11, dwanascie: 12, dwunastu: 12,
  trzynascie: 13, trzynastu: 13, czternascie: 14, czternastu: 14,
  pietnascie: 15, pietnastu: 15, szesnascie: 16, szesnastu: 16,
  siedemnascie: 17, siedemnastu: 17, osiemnascie: 18, osiemnastu: 18,
  dziewietnascie: 19, dziewietnastu: 19,
  dwadziescia: 20, dwudziestu: 20, trzydziesci: 30, trzydziestu: 30,
  czterdziesci: 40, czterdziestu: 40, piecdziesiat: 50, piecdziesieciu: 50,
  szescdziesiat: 60, szescdziesieciu: 60, sto: 100, stu: 100,
}));

// Jednostki, których przeliczenie jest STAŁE i sprawdzalne. Miesięcy i lat tu
// nie ma celowo — miesiąc nie ma stałej liczby dni, więc przeliczenie byłoby
// zgadywaniem, a nie zapisem tej samej wartości innym zapisem.
const TYDZIEN_DNI = 7;

// Zbiór liczb, którymi ŹRÓDŁO może uziemić zdanie: cyfry wprost, liczebniki
// zapisane słownie oraz tygodnie przeliczone na dni.
function liczbyZeZrodla(text) {
  const zbior = new Set(extractNumbers(text));
  const t = bezOgonkow(text);

  // Liczebniki zapisane słownie → wartość liczbowa.
  for (const [slowo, wartosc] of LICZEBNIKI) {
    const re = new RegExp(`(?<![a-z0-9])${slowo}(?![a-z0-9])`);
    if (re.test(t)) zbior.add(String(wartosc));
  }

  // „dwóch tygodni" → 14 dni, „tygodnia" → 7 dni. Liczebnik musi stać PRZY
  // jednostce, nie gdziekolwiek w tekście — inaczej „dwóch świadków" w jednym
  // zdaniu i „tygodnia" w drugim uziemiłyby liczbę, której nikt nie napisał.
  for (const m of t.matchAll(/(?<![a-z0-9])([a-z]+|\d+)\s+(tygodni|tygodnie|tygodniami)(?![a-z])/g)) {
    const n = /^\d+$/.test(m[1]) ? Number(m[1]) : LICZEBNIKI.get(m[1]);
    if (n) zbior.add(String(n * TYDZIEN_DNI));
  }
  // Sam „tygodnia"/„tydzień" bez liczebnika to jeden tydzień — tak zapisuje się
  // termin tygodniowy w pismach („w terminie tygodnia od ogłoszenia").
  if (/(?<![a-z0-9])(tygodnia|tydzien|tygodniu)(?![a-z])/.test(t)) zbior.add(String(TYDZIEN_DNI));

  return zbior;
}

// Sprawdza, czy każda liczba ze zdania występuje w treści któregokolwiek
// z pobranych fragmentów. To wyłapuje zmyślone ceny i terminy wplecione
// w skądinąd poprawnie brzmiące zdanie — czego weryfikacja semantyczna nie widzi.
//
// PYTANIE JAKO ŹRÓDŁO UZIEMIENIA — ROZSTRZYGNIĘTE PO TRYBIE, 20.08.2026.
//
// W trybie PUBLICZNYM pytanie nie jest źródłem i nigdy nim nie będzie. Klient
// jest stroną negocjacji: gdyby liczba z jego pytania uziemiała zdanie, na
// "Czy remont kosztuje 1200 zł/m²?" potwierdzenie przeszłoby weryfikację.
// `isUnsupportablePromise()` tego NIE łapie — zmierzone. To jedyna warstwa,
// która tam stoi, i zostaje bez zmian.
//
// W trybie WEWNĘTRZNYM pracownik nie negocjuje sam ze sobą — podaje parametr
// ("przy silniku 1600 cm3", "za 7000 zł"), na który dokumentacja ma odpowiedź.
// Mierzone 20.08.2026 na czterech zbiorach: reguła surowa wycinała 13 zdań na 40
// i redukowała 7 z 16 odpowiedzi do samej linii `Podstawa:`, w tym zdania
// ODMOWNE ("Nie, nie możesz dać rabatu 15 procent") — czyli dokładnie te,
// dla których pracownik zadał pytanie.
//
// Czego to NIE rozluźnia: liczba, która nie pochodzi ani z fragmentów, ani
// z pytania, wypada nadal w obu trybach. Dzięki temu liczba WYLICZONA przez
// model ("za 200 km otrzymasz 230 złotych") jest wycinana tak samo jak dotąd.
//
// Dlaczego nie po budowie zdania: sprawdzono. Rozdzielenie "kontekstu" od
// "przypisania firmie" pozycją liczby, przyimkiem czy czasownikiem daje 9/14
// na korpusie przypadków — gubi zdania odmowne i przepuszcza zdanie mieszane
// ("kosztuje 1200 zł, a zaliczka wynosi 10 procent"). Różnica leży w znaczeniu,
// a warstwa oceniająca znaczenie jest zawodna z definicji. `DECYZJE.md` →
// "Uziemienie liczb".
//
// Domyślny tryb jest PUBLICZNY celowo: wywołanie, które o trybie zapomni,
// dostaje wariant surowy, nie luźny.
function numbersAreGrounded(sentence, filtered, tryb = PROMPT_PUBLICZNY, userQuestion = "") {
  const nums = extractNumbers(sentence);
  if (!nums.length) return true;
  const corpus = filtered.map((m) => m.metadata.text + " " + m.metadata.title).join(" ");
  // Zbiór uziemiający, nie sam wykaz cyfr — patrz `liczbyZeZrodla()`.
  const corpusNums = liczbyZeZrodla(corpus);
  // Jedyne miejsce, w którym pytanie w ogóle wchodzi do gry — i tylko wewnętrznie.
  const zPytania = tryb === PROMPT_WEWNETRZNY
    ? new Set(extractNumbers(userQuestion || ""))
    : new Set();
  return nums.every((n) => corpusNums.has(n) || zPytania.has(n));
}

// Normalizacja do porównań dosłownych: małe litery, interpunkcja na spacje,
// spacje sklejone. Bez tego „okulary ochronne," nie zrówna się z „okulary
// ochronne" we fragmencie.
function normalizujDoPorownania(s) {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

// Czy zdanie występuje DOSŁOWNIE w treści któregoś z pobranych fragmentów.
// Jeśli tak, cosinus nie musi o niczym decydować: zdania, które fizycznie
// stoi w dokumentacji, nie da się uznać za niepokryte. To jest właściwa
// odpowiedź na „Nie uznawaj roszczenia i nie obiecuj naprawy ani odszkodowania"
// (0.467, zdanie żywcem z i33) — nie obniżanie progu dla wszystkich.
//
// PUŁAPKA, KTÓRĄ TO OMIJA: zgubione zaprzeczenie. „zakrywaj zbrojenia" jest
// dosłownym podciągiem „nie zakrywaj zbrojenia", więc sam `includes` przepuściłby
// zdanie o odwróconym znaczeniu. Dlatego trafienie poprzedzone partykułą
// przeczącą się nie liczy — musi istnieć wystąpienie bez niej.
const PRZECZENIA = ["nie", "bez", "nigdy", "ani", "żadn"];

function wystepujeDoslownie(sentence, filtered) {
  const igla = normalizujDoPorownania(sentence);
  if (igla.length < 12) return false; // za krótkie, żeby cokolwiek potwierdzać
  for (const m of filtered) {
    const stog = normalizujDoPorownania(`${m.metadata.text} ${m.metadata.title}`);
    let od = 0;
    for (;;) {
      const i = stog.indexOf(igla, od);
      if (i === -1) break;
      const przed = stog.slice(Math.max(0, i - 12), i).trim().split(" ").pop() || "";
      if (!PRZECZENIA.some((p) => przed.startsWith(p))) return true;
      od = i + 1;
    }
  }
  return false;
}

// Próg cytowania zależny od długości zdania — patrz komentarz przy
// CITATION_THRESHOLD_KROTKIE.
function progCytowania(sentence) {
  const slow = normalizujDoPorownania(sentence).split(" ").filter(Boolean).length;
  return slow <= KROTKIE_ZDANIE_SLOW ? CITATION_THRESHOLD_KROTKIE : CITATION_THRESHOLD;
}

// Zdania, których dokumentacja z natury nie może potwierdzić: deklaracje
// dostępności terminów, obietnice zdążenia, potwierdzenia przypuszczeń klienta
// o rabatach czy podatkach. Model chętnie je generuje, bo brzmią uprzejmie.
//
// WARSTWA ZNA TRYB — od 19.08.2026. Wzorce rabatowe i cenowe powstały po to,
// żeby bot nie potwierdził klientowi rabatu, którego firma nie dała. Pracownikowi
// te same zdania trzeba podać: „Przysługuje ci rabat do 3 procent" to dokładnie
// treść i39, po którą przyszedł. Wzorce o wolnych terminach i o zdążeniu
// zostają w OBU trybach — zmyślony termin szkodzi wewnątrz tak samo.
function isUnsupportablePromise(s, tryb = PROMPT_PUBLICZNY, klient = null) {
  const t = s.toLowerCase();

  // Zdanie zaprzeczające ("nie oferujemy rabatów") albo odsyłające do biura
  // ("kwestię rabatów potwierdzi biuro") NIE jest obietnicą — przeciwnie,
  // to dokładnie takie zachowanie, jakiego oczekujemy. Nie wycinamy go.
  // WZORCE ODPORNE NA WYJĄTEK DLA ZAPRZECZEŃ — sprawdzane PRZED nim.
  //
  // Wyjątek niżej jest testem PODCIĄGU: wystarczy „nie" albo „bez" gdziekolwiek
  // w zdaniu, żeby wyłączyć całą warstwę. Zmierzone 22.08.2026 zestawem wrogim:
  // „Tę sprawę wygramy bez większych problemów" przechodziło przez „bez ",
  // a „Proszę się nie martwić, to zwykła formalność" przez „nie ". Obietnica
  // z wtrąconym zaprzeczeniem jest nadal obietnicą.
  //
  // Dlaczego nie zwężono samego wyjątku: zdanie odmowne („nie oferujemy
  // rabatów", „nie gwarantujemy wyniku") ma przechodzić i to jest ważniejsze,
  // a odróżnienie zaprzeczenia ODNOSZĄCEGO SIĘ DO OBIETNICY od zaprzeczenia
  // stojącego obok niej wymaga rozumienia zdania, nie dopasowania wzorca.
  // Zamiast tego klient wskazuje wzorce, które MAJĄ obowiązywać mimo wyjątku —
  // a każdy z nich niesie własne `(?<!nie )`, więc „nie wygramy" i „nie
  // gwarantujemy" nadal są przepuszczane.
  const bezwyjatku = klient ? (klient.obietniceBezwyjatku || []) : [];
  if (tryb !== PROMPT_WEWNETRZNY && bezwyjatku.some((p) => p.test(t))) return true;

  const isNegationOrDeferral = /\b(nie |bez |brak |nie mam|potwierdzi biuro|potwierdzi (nasze )?biuro|skontaktuj|kontakt z biurem|ustali biuro|zależy od indywidualn)/.test(t);
  if (isNegationOrDeferral) return false;

  // Obowiązują w obu trybach: dokumentacja nie zna grafiku ekip, więc ani
  // klientowi, ani pracownikowi nie wolno deklarować wolnego terminu.
  const wspolne = [
    /mamy wolne terminy|dysponujemy terminami|termin.{0,20}dostępn/,
    /(będziemy się starać|postaramy się|zdążymy|jesteśmy w stanie zdążyć)/,
  ];

  // Wyłącznie tryb publiczny: wzorce BRANŻOWE, z tablicy klienta. Wewnątrz to
  // nie jest obietnica złożona klientowi, tylko informacja o progach decyzyjnych.
  //
  // Od 21.08.2026 nie ma ich w tym pliku: rabat w hurtowni i „niższy VAT" to
  // proteza pod budowlankę, a nie własność produktu. U kancelarii tę samą rolę
  // pełnią szanse wygranej i zapewnienia o przedawnieniu. Wspólne wzorce wyżej
  // zostały — deklaracja wolnego terminu jest groźna w każdej branży.
  //
  // Brak klienta w trybie publicznym jest BŁĘDEM, nie powodem do pobłażliwości:
  // cicha praca z połową wzorców to dokładnie ten rodzaj osłabienia warstwy,
  // którego przez pół roku nikt by nie zauważył.
  if (tryb !== PROMPT_WEWNETRZNY && !klient) {
    throw new Error("Tryb publiczny wymaga klienta — bez niego nie ma wzorców branżowych.");
  }
  const tylkoPubliczne = klient ? (klient.obietnicePubliczne || []) : [];

  const patterns = tryb === PROMPT_WEWNETRZNY ? wspolne : [...wspolne, ...tylkoPubliczne];
  return patterns.some((p) => p.test(t));
}

// Zdania zdradzające klientowi, że pod spodem działa bot z instrukcjami.
// Model czasem przepisuje polecenia dosłownie zamiast je wykonać.
//
// WARSTWA ZNA TRYB — od 19.08.2026. Zakaz mówienia „zgodnie z dokumentacją"
// istnieje dlatego, że KLIENT nie wie o istnieniu dokumentacji ani instrukcji.
// Pracownik wie — sam prompt wewnętrzny każe mu podać „Podstawa: <tytuł>".
// Wycinanie u niego całego zdania za odwołanie do procedury to utrata treści
// za potknięcie stylistyczne, a przy instrukcji BHP treść jest ważniejsza niż
// styl. Zdradzanie samych instrukcji („proszę mi powiedzieć, że", „jako
// asystent AI") zostaje zakazane w obu trybach — to nie jest odwołanie do
// dokumentacji, tylko przepisywanie polecenia zamiast wykonania go.
function leaksInstructions(s, tryb = PROMPT_PUBLICZNY) {
  const t = s.toLowerCase();
  const wspolne = /(proszę mi powiedzieć, że|jako asystent ai)/;
  if (wspolne.test(t)) return true;
  if (tryb === PROMPT_WEWNETRZNY) return false;
  return /(zgodnie z (moją |naszą )?dokumentacj|według (podanych )?fragment|w (mojej|naszej) dokumentacji (jest|znajduje)|na podstawie fragment)/.test(t);
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
  // Linia źródła nie jest twierdzeniem, tylko odsyłaczem — nie może być
  // „powtórzeniem" zdania, które z tego samego fragmentu korzysta. Bez tego
  // wyjątku warstwa po cichu kasowała obowiązkową linię „Podstawa: <tytuł>",
  // bo tytuł fragmentu z definicji dzieli słowa ze zdaniem opartym na jego
  // treści. Zmierzone 19.08.2026: znikała w 2 z 20 odpowiedzi wewnętrznych,
  // niewidocznie, bo /debug pokazywał wtedy wyłącznie warstwę semantyczną.
  if (/^podstawa:/i.test(sentence.trim())) return false;

  const a = norm(sentence);
  if (a.size < 3) return false;
  for (const prev of alreadyKept) {
    const b = norm(prev);
    if (b.size < 3) continue;
    let common = 0;
    for (const w of a) if (b.has(w)) common++;
    const overlap = common / Math.min(a.size, b.size);
    if (overlap < DUPLIKAT_POKRYCIE) continue;

    // ZDANIE DŁUŻSZE JEST ROZWINIĘCIEM, NIE POWTÓRZENIEM. Samo pokrycie liczone
    // wobec KRÓTSZEGO zdania sprawia, że zdanie zawierające wszystkie słowa
    // krótszego ma pokrycie 1.0 — nawet gdy dokłada dwa razy tyle treści.
    // Zmierzone 19.08.2026 na i25: zdanie o uprawnieniach inspektora
    // (podobieństwo 0.775, kilkanaście nowych słów) znikało jako „duplikat"
    // zdania sprostowującego adresata, które sami dodaliśmy regułą promptu.
    // Dlatego liczy się nie samo pokrycie, ale ile NOWEGO zdanie wnosi.
    const nowe = a.size - common;
    if (nowe >= DUPLIKAT_NOWE_SLOWA) continue;

    return true;
  }
  return false;
}

async function verifyClaims(fullText, filtered, env, klient, tryb = PROMPT_PUBLICZNY, userQuestion = "") {
  const claims = splitSentences(fullText);
  const toCheck = claims.length ? claims : [fullText];

  const claimVectors = await embed(env, toCheck);
  const usedSources = new Set();
  const kept = [];
  let removed = 0;
  const cicho = { duplikat: 0, instrukcje: 0 };

  for (let i = 0; i < toCheck.length; i++) {
    const claimVector = claimVectors[i];
    let bestSim = 0, bestTitle = null;
    for (const m of filtered) {
      const sim = cosineSimilarity(claimVector, m.values);
      if (sim > bestSim) { bestSim = sim; bestTitle = m.metadata.title; }
    }

    const numbersOk = numbersAreGrounded(toCheck[i], filtered, tryb, userQuestion);
    const promiseOk = !isUnsupportablePromise(toCheck[i], tryb, klient);

    // Zdania zdradzające instrukcje lub powtarzające już powiedzianą treść
    // usuwamy po cichu — to defekt formy, nie brak pokrycia w dokumentacji,
    // więc nie zwiększamy licznika "niepotwierdzonych" pokazywanego klientowi.
    // Te dwie warstwy usuwają zdanie PO CICHU — nie zwiększają licznika
    // `trimmed` pokazywanego pytającemu, bo to defekt formy, nie brak pokrycia.
    // Ale „po cichu dla pytającego" nie znaczy „bez śladu": oba przypadki są
    // liczone i trafiają do logu, a stamtąd do /stats. Bez tego licznika
    // deduplikacja przez pół roku kasowała treść niewidocznie.
    if (leaksInstructions(toCheck[i], tryb)) { cicho.instrukcje++; continue; }
    if (isDuplicate(toCheck[i], kept)) { cicho.duplikat++; continue; }

    // Pokrycie ma dwie drogi: podobieństwo powyżej progu ZALEŻNEGO OD DŁUGOŚCI
    // albo dosłowne wystąpienie zdania we fragmencie. Druga droga zastępuje
    // wyłącznie sprawdzenie semantyczne — liczby i obietnice są sprawdzane
    // tak samo, bo dosłowność zdania nie usprawiedliwia zmyślonej liczby
    // dostawionej obok.
    const pokryte = bestSim >= progCytowania(toCheck[i]) || wystepujeDoslownie(toCheck[i], filtered);

    if (pokryte && numbersOk && promiseOk) {
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
    return { ok: false, fallback: wymagajKlienta(klient).prompt.fallback, cicho };
  }

  let text = kept.join(" ");
  if (removed > 0) {
    text += "\n\nW pozostałych kwestiach nie mam potwierdzonych informacji w dokumentacji — te szczegóły potwierdzi biuro.";
  }

  return { ok: true, text, source: [...usedSources].slice(0, 4).join(", "), removed, cicho };
}

// Rozpoznaje zdania, które nie zawierają twierdzeń faktycznych o firmie —
// powitania, podziękowania, zaproszenia do kontaktu. Te wolno zachować
// nawet bez pokrycia w dokumentacji, bo niczego nie obiecują.
// Czy odpowiedź modelu jest ODMOWĄ W CAŁOŚCI, czy zawiera treść obok odmowy.
//
// SKĄD SIĘ WZIĘŁO. `handleAsk()` rozpoznaje brak odpowiedzi frazą na surowym
// tekście modelu i zamienia CAŁĄ odpowiedź na fallback. Przy treści, której
// sensem jest odmowa („nie podajemy przewidywanego czasu trwania sprawy, bo
// zależy on od sądu"), model potrafi dopisać frazę odmowną obok wyjaśnienia —
// i wtedy klient traci wyjaśnienie, które było w pobranym materiale.
//
// CZEGO TO NIE ROZLUŹNIA. Odpowiedź złożona z samego zdania odmownego — także
// z odmowy plus grzeczności („Nie mam takich informacji. Zapraszamy do
// kontaktu.") — nadal zapada w fallback, bo prawdziwe „nie wiem" ma zostać
// widoczne w metrykach jako luka. Zmienia się wyłącznie przypadek, w którym
// obok odmowy STOI TREŚĆ: wtedy odmowa jest usuwana, a treść idzie do pełnej
// weryfikacji zdanie po zdaniu, bez żadnej taryfy ulgowej.
function tylkoOdmowa(tekst) {
  const zdania = splitSentences(tekst);
  const lista = zdania.length ? zdania : [tekst];
  if (!lista.some((z) => FRAZA_ODMOWY.test(z))) return false; // odmowy w ogóle nie ma
  // Zdanie odmowne trzeba odsiać OSOBNO, zanim odsieje się grzecznościowe:
  // samo zdanie odmowne kończy się odesłaniem do biura, więc `isConnectiveSentence`
  // klasyfikuje je jako grzecznościowe i lista „istotnych" robi się pusta
  // z niewłaściwego powodu. Złapane testem przy wdrożeniu tej zmiany.
  const tresc = lista.filter((z) => !FRAZA_ODMOWY.test(z) && !isConnectiveSentence(z));
  return tresc.length === 0;
}

// Usuwa zdania odmowne, zostawiając treść. Wywoływane wyłącznie wtedy, gdy
// `tylkoOdmowa()` jest fałszem — czyli gdy obok odmowy jest co zostawić.
function usunZdaniaOdmowne(tekst) {
  const zdania = splitSentences(tekst);
  if (!zdania.length) return tekst;
  const zostaje = zdania.filter((z) => !FRAZA_ODMOWY.test(z));
  return zostaje.length ? zostaje.join(" ") : tekst;
}

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

// ============================================================
// ESKALACJA — trzeci stan odpowiedzi, wyłącznie w trybie wewnętrznym
// ============================================================
//
// PO CO TO ISTNIEJE
// Przy wypadku, zagrożeniu życia albo sporze prawnym bot nie może być jedynym
// źródłem decyzji — pracownik działa pod presją, a niepełna odpowiedź kosztuje
// zdrowie albo odpowiedzialność firmy. Nie może też milczeć: ktoś musi wiedzieć,
// co zrobić w pierwszej minucie. Dlatego odpowiedź eskalacyjna zawiera JEDNO
// I DRUGIE — kroki z dokumentacji ORAZ twarde skierowanie do przełożonego.
//
// DLACZEGO WZORCE, A NIE OCENA MODELU
// Ta warstwa jest deterministyczna z tego samego powodu co numbersAreGrounded():
// przy BHP błąd nie kosztuje złej recenzji, tylko zdrowia. Model, który raz na
// dwadzieścia odpowiedzi „uzna, że to nie jest pilne", jest bezużyteczny jako
// zabezpieczenie.
//
// CZEGO NAUCZYŁA REGUŁA ADRESATA
// Lista fraz odpala się zbyt chętnie (patrz DECYZJE.md → „Prompt: trzy podejścia
// do adresata"). Dlatego rozróżnienie nie idzie po TEMACIE, tylko po tym, czy
// pytanie opisuje ZDARZENIE, czy odpytuje REGUŁĘ. „Jakie środki ochrony przy
// szlifowaniu" i „co ile odnawiamy szkolenie BHP" to tematycznie BHP, ale nikt
// tam nie leży na ziemi — słownictwo tematyczne (rusztowanie, wysokość,
// szkolenie, środki ochrony) świadomie NIE wyzwala eskalacji. Wyzwala je
// słownictwo zdarzeniowe: „spadł", „krwawi", „przygniotło", „grozi sądem".
//
// PRÓG JEST RÓŻNY DLA RÓŻNYCH KATEGORII, BO KOSZT POMYŁKI JEST RÓŻNY
// Przy wypadku i zagrożeniu życia fałszywy alarm kosztuje jedno zdanie za dużo,
// a przeoczenie — zdrowie. Tam wyzwalamy szeroko i NIE stosujemy weta ramy
// informacyjnej. Przy sporze, kontroli i finansach fałszywy alarm to szum, który
// nauczy pracownika ignorować ramkę — tam wymagamy DWÓCH niezależnych sygnałów
// i wetujemy pytania o samą regułę.
//
// DLACZEGO WERYFIKACJA TEGO NIE ZJADA
// Tekst eskalacji NIE PRZECHODZI przez verifyClaims() — jest doklejany po niej,
// ze stałej w kodzie. To nie jest twierdzenie o dokumentacji, tylko reguła
// operacyjna firmy, więc nie ma czego weryfikować względem fragmentów. Osłabienie
// weryfikacji dla reszty odpowiedzi byłoby jedynym innym wyjściem i byłoby złe:
// verifyClaims widzi wyłącznie tekst modelu i ma go traktować tak samo surowo
// jak dotąd. Z tego samego powodu isDuplicate() nigdy nie widzi ramki i nie ma
// jej jak skasować.

// Pytanie jest normalizowane PRZED dopasowaniem: małe litery i zdjęte ogonki.
// Powód jest praktyczny, nie estetyczny — pracownik pisze z telefonu na budowie
// i pisze „grozi sadem", „zlamal noge", „zadaja dokumentow". Wzorzec wymagający
// „sądem" po prostu milczy, a milczenie tej warstwy to dokładnie ten błąd,
// przed którym ma chronić. Dlatego wszystkie wzorce niżej są zapisane BEZ
// OGONKÓW — porównujemy tekst znormalizowany z wzorcem znormalizowanym.
//
// Druga pułapka, już naprawiona: `\b` w JavaScripcie zna wyłącznie ASCII, więc
// `\bmarż\b` NIE dopasuje się do „marżę". Po normalizacji problem znika, ale
// początek wyrazu i tak pilnujemy przez `(?<![a-z0-9])` — dopasowanie ma się
// zaczynać na granicy wyrazu, a wolno mu przejść w dowolną końcówkę fleksyjną.
function bezOgonkow(s) {
  return s
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Rama informacyjna — pytanie o REGUŁĘ, nie o zdarzenie. Wetuje eskalację
// wyłącznie w kategoriach o niskiej pilności.
const RAMA_INFORMACYJNA = /(?<![a-z0-9])(co ile|jak czesto|jakie sa zasady|jaki jest (wymog|termin|limit)|ile wynosi|kto (zglasza|prowadzi|odpowiada)|w jakim (czasie|terminie)|czy musze miec|co obejmuje|jak dokumentujemy|z jakim wyprzedzeniem|jakie srodki ochrony|kiedy odnawiamy)/;

// SŁOWNIKI BRANŻOWE PRZENIOSŁY SIĘ DO OSOBNYCH PLIKÓW (21.08.2026).
// Tablica kategorii, dopełnienia rdzeni dwuznacznych (części ciała, wysokość,
// konstrukcja), progi decyzyjne i teksty ramek żyją w `eskalacja-budowlana.js`
// i przychodzą tu przez `klient.eskalacja`. Tutaj został MECHANIZM: weto ramy
// informacyjnej, zasada „rdzeń dwuznaczny wyzwala dopiero ze swoim
// dopełnieniem", rozstrzyganie przy wielu trafieniach i pozycja ramki.
//
// Rozdzielenie jest zarazem odpowiedzią na pytanie, po co była druga branża:
// protezą pod budowlankę okazały się WZORCE, nie reguły. Reguły przeniosły się
// bez zmian — u kancelarii `pilne` przestaje znaczyć „ktoś leży na ziemi"
// i zaczyna znaczyć „termin jest nieodwracalny", ale sposób rozstrzygania
// między kategoriami jest ten sam.

// Czy w pytaniu pada kwota albo procent powyżej progu, od którego decyzja
// przestaje należeć do pracownika. Same wartości są branżowe i przychodzą
// z `klient.eskalacja.progi` — u BudMaksu 3% i 300 zł, z fragmentów i39 i i41.
function przekroczonyProgDecyzyjny(pytanie, progi) {
  if (!progi) throw new Error("Kategoria z progiem decyzyjnym wymaga progów klienta.");
  const t = bezOgonkow(pytanie);
  const procenty = [...t.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:procent|proc\.|%)/g)]
    .map((m) => parseFloat(m[1].replace(",", ".")));
  if (procenty.some((p) => p > progi.procent)) return true;
  return extractNumbers(t).map(Number).some((k) => k >= progi.kwota);
}

// Wykrywa kategorię eskalacji. Zwraca null albo { id, pilne, tekst }.
// Patrzy WYŁĄCZNIE na treść pytania — nie na odpowiedź modelu i nie na to,
// co znalazł retrieval. Dzięki temu wynik nie zależy od tego, czy dokumentacja
// akurat coś na ten temat zawiera: przy wypadku bez pokrycia w dokumentacji
// skierowanie do przełożonego jest potrzebne bardziej, nie mniej.
// Drugi sygnał dla rdzeni dwuznacznych: czy w zdaniu w ogóle występuje CZŁOWIEK
// albo część ciała. „Potrącimy z faktury" nie ma podmiotu ludzkiego, „wózek
// potrącił pracownika" ma. To jest warunek, nie lista sformułowań wypadku —
// wypadków nie da się wyliczyć, ludzi i części ciała owszem.
// Sama obecność człowieka NIE wystarcza jako drugi sygnał: na budowie ktoś
// występuje prawie w każdym zdaniu, więc „brygadzista złamał procedurę" nadal
// wyzwalałoby ramkę wypadkową. Zmierzone 21.08.2026 — to była pierwsza,
// odrzucona wersja tego warunku.
//
// Rozstrzyga DOPEŁNIENIE: czym jest to, co zostało złamane, potrącone albo
// z czego ktoś spadł. Dlatego każdy rdzeń dwuznaczny ma własny warunek, a nie
// wspólną listę. To nadal warunek, nie lista sformułowań wypadku: wypadków
// wyliczyć się nie da, części ciała i wysokości owszem.
// Same słowniki dopełnień są w pliku branżowym — każdy rdzeń dwuznaczny niesie
// swój warunek ze sobą, w polu `kontekst`.

// Ile NIEZALEŻNYCH sygnałów przemawia za tą kategorią.
// Liczymy różne dopasowania, nie liczbę znaków: dwa różne słowa alarmowe to
// mocniejsza przesłanka niż jedno powtórzone.
function liczbaSygnalow(k, t, pytanie, progi) {
  let ile = 0;
  if (k.zdarzenie && k.zdarzenie.test(t)) ile++;
  if (dwuznacznyZKontekstem(k, t)) ile++;
  if (k.drugiSygnal && k.drugiSygnal.test(t)) ile++;
  if (k.prog && przekroczonyProgDecyzyjny(pytanie, progi)) ile++;
  return ile;
}

// Czy któryś rdzeń dwuznaczny tej kategorii wystąpił RAZEM ze swoim warunkiem.
function dwuznacznyZKontekstem(k, t) {
  if (!k.dwuznaczne) return false;
  return k.dwuznaczne.some((d) => d.wzorzec.test(t) && d.kontekst().test(t));
}

// ROZSTRZYGANIE PRZY WIELU TRAFIENIACH — zasada, nie kolejność w tablicy.
//
// Do 21.08.2026 wygrywała pierwsza pasująca kategoria, więc „pismo z kancelarii,
// że potrąci nam 20 000 zł" dostawało ramkę wypadkową z numerem 112: `potrac`
// pasowało do wypadku, a wypadek stał wyżej w tablicy. Odwrócenie kolejności
// przeniosłoby tylko problem gdzie indziej.
//
// Reguła wynika z kosztu pomyłki:
//  1. Kategoria z WIĘKSZĄ liczbą niezależnych sygnałów wygrywa — więcej
//     przesłanek to mniejsza szansa, że trafiliśmy na homonim.
//  2. Przy remisie wygrywa kategoria PILNA, czyli ta kierująca do człowieka
//     szybciej. Przy równych przesłankach koszt przeoczenia wypadku jest
//     wyższy niż koszt jednej ramki za dużo.
//  3. Przy dalszym remisie decyduje kolejność w tablicy — jest stabilna
//     i przewidywalna.
//
// Uwaga: punkt 1 NIE pozwala kategorii niepilnej wygrać z pilną samą liczbą
// sygnałów. Gdyby tak było, „wypadek, przyjechała PIP" wybrałoby kontrolę,
// bo ta ma dwa sygnały z definicji. Dlatego porównanie liczby sygnałów
// odbywa się WEWNĄTRZ tego samego poziomu pilności.
// Dopasowanie kategorii — WSPÓLNY mechanizm dla eskalacji wewnętrznej i ramki
// bezpieczeństwa w trybie publicznym. Wydzielone 22.08.2026: obie warstwy mają
// rozstrzygać tak samo, a dwie kopie tej pętli rozjechałyby się przy pierwszej
// poprawce progu.
//
// `dopuszczalna` decyduje, które kategorie w ogóle biorą udział — to jedyna
// różnica między trybami.
function dopasujKategorie(pytanie, klient, dopuszczalna) {
  const pakiet = wymagajKlienta(klient).eskalacja;
  if (!pakiet || !Array.isArray(pakiet.kategorie)) {
    throw new Error(`Klient ${klient.id} nie ma słownika eskalacji.`);
  }
  const t = bezOgonkow(pytanie);
  const informacyjne = RAMA_INFORMACYJNA.test(t);

  const trafione = [];
  for (const k of pakiet.kategorie) {
    if (!dopuszczalna(k)) continue;
    const jednoznaczne = k.zdarzenie && k.zdarzenie.test(t);
    const przezDwuznaczny = dwuznacznyZKontekstem(k, t);
    if (!jednoznaczne && !przezDwuznaczny) continue;
    if (k.drugiSygnal && !k.drugiSygnal.test(t)) continue;
    if (k.prog && !przekroczonyProgDecyzyjny(pytanie, pakiet.progi)) continue;
    // Weto ramy informacyjnej obowiązuje TYLKO tam, gdzie fałszywy alarm boli
    // bardziej niż przeoczenie. Przy wypadku i zagrożeniu życia nie obowiązuje:
    // „kto zgłasza wypadek śmiertelny" dostanie ramkę i dobrze, bo koszt to
    // jedno zdanie za dużo, a koszt przeoczenia to zdrowie.
    if (!k.pilne && informacyjne) continue;
    trafione.push({ k, sygnaly: liczbaSygnalow(k, t, pytanie, pakiet.progi), kolejnosc: trafione.length });
  }
  if (!trafione.length) return null;

  trafione.sort((a, b) => {
    if (a.k.pilne !== b.k.pilne) return a.k.pilne ? -1 : 1;   // 2. pilne przed niepilnym
    if (a.sygnaly !== b.sygnaly) return b.sygnaly - a.sygnaly; // 1. więcej sygnałów
    return a.kolejnosc - b.kolejnosc;                          // 3. kolejność w tablicy
  });
  return trafione[0].k;
}

// Eskalacja wewnętrzna — wszystkie kategorie słownika, tekst dla pracownika.
function wykryjEskalacje(pytanie, askedFrom, klient) {
  if (askedFrom !== SPACE_INTERNAL) return null; // publiczny bot nie eskaluje do przełożonego
  const w = dopasujKategorie(pytanie, klient, () => true);
  return w ? { id: w.id, pilne: w.pilne, tekst: w.tekst } : null;
}

// RAMKA BEZPIECZEŃSTWA — TRYB PUBLICZNY, od 22.08.2026.
//
// SKĄD SIĘ WZIĘŁA. Pomiar kancelarii: na pytanie „Mąż mi grozi i boję się
// wrócić do domu" model odpowiedział między innymi „Możesz zadzwonić na numer
// alarmowy 112", a `numbersAreGrounded()` WYCIĄŁ to zdanie, bo `112` nie
// występuje w dokumentacji klienta. Warstwa zadziałała dokładnie tak, jak
// zaprojektowano — i usunęła numer alarmowy osobie w zagrożeniu.
//
// DLACZEGO NIE WYJĄTEK W WARSTWIE LICZB. Rozważone i odrzucone. Biała lista
// numerów uziemiałaby je w KAŻDYM zdaniu, więc „cena wynosi 997 zł" albo
// „odszkodowanie 112 tysięcy" przechodziłyby weryfikację jako liczby „pokryte".
// Warunkowanie listy kontekstem („zadzwoń pod…") byłoby listą fraz, a nie
// warunkiem — czyli tym, czego ten projekt konsekwentnie nie robi. Furtka
// w jedynej warstwie stojącej na powierzchni klienckiej jest za drogim
// rozwiązaniem problemu, który da się rozwiązać obok niej.
//
// DLACZEGO RAMKA. Numer alarmowy nie jest twierdzeniem o dokumentacji klienta,
// tylko stałą operacyjną — dokładnie jak skierowanie do przełożonego w trybie
// wewnętrznym. Tekst ramki nie przechodzi przez `verifyClaims()`, więc żadna
// warstwa nie ma go jak wyciąć, a weryfikacja reszty odpowiedzi NIE JEST
// w niczym osłabiona.
//
// CO JĄ OGRANICZA — trzy rzeczy, świadomie:
// 1. Wyzwalają WYŁĄCZNIE kategorie, którym klient jawnie dopisał pole
//    `publiczna`. Domyślnie żadna, więc dodanie ramki jest decyzją, nie skutkiem
//    ubocznym. BudMax dziś nie ma ani jednej — jego bot publiczny to widget
//    sprzedażowy i jego zachowanie zostaje niezmienione.
// 2. Tekst jest OSOBNY od tekstu eskalacji wewnętrznej: klient nie jest
//    pracownikiem, nie ma przełożonego i nie prowadzi akt.
// 3. Rozstrzyganie jest to samo co przy eskalacji — ten sam `dopasujKategorie`.
function wykryjOstrzezenie(pytanie, askedFrom, klient) {
  if (askedFrom === SPACE_INTERNAL) return null; // wewnątrz działa pełna eskalacja
  const w = dopasujKategorie(pytanie, klient, (k) => Boolean(k.publiczna));
  return w ? { id: w.id, pilne: w.pilne, tekst: w.publiczna } : null;
}

// Skleja odpowiedź z ramką eskalacji. Przy kategoriach pilnych skierowanie idzie
// PRZED treścią — pracownik pod presją czyta pierwszą linię i może nie doczytać
// do końca. Przy pozostałych na końcu, żeby nie odpychać od właściwej odpowiedzi.
//
// Ramka trafia też do pola `answer`, nie tylko do osobnego pola JSON: widget
// i panel nie znają nowego pola, a odpowiedź musi być kompletna także dla
// klienta, który go nie obsługuje.
function zlozZEskalacja(tekst, esk) {
  if (!esk) return tekst;
  return esk.pilne ? `${esk.tekst}\n\n${tekst}` : `${tekst}\n\n${esk.tekst}`;
}

// ============================================================
// PROMPTY — dwa tryby, jeden rdzeń rzetelności
//
// Publiczny i wewnętrzny różnią się TYM, KOMU odpowiadają, a nie tym, ile
// wolno im zmyślić. Reguły chroniące przed halucynacją są wspólne i mieszkają
// w PROMPT_RDZEN — dopisując regułę rzetelności, dopisz ją TAM, a nie do
// jednego z wariantów.
//
// Wariant publiczny jest kalibrowany od wielu sesji i **nie zmienił się przy
// rozdzieleniu** — składa się z tych samych łańcuchów co wcześniej, co
// sprawdza test porównujący go bajt w bajt z wersją sprzed rozdzielenia.
// Zmiana tonu należy do wariantu wewnętrznego; publicznego nie ruszamy przy
// okazji.
// ============================================================

// Stała pomocnicza — łamanie linii wewnątrz szablonu promptu. Sekwencja
// ucieczki w miejscu sklejania listy zakazów jest trudna do odczytania
// i łatwa do zepsucia przy edycji skryptem.
const NOWA_LINIA = "\n";

// Rdzeń rzetelności — obowiązuje w OBU trybach. Tryb wewnętrzny zmienia to,
// co wolno powiedzieć rozmówcy, a nie to, czy wolno to zmyślić.
const PROMPT_RDZEN = {
  laczenieFragmentow: `Możesz łączyć informacje z kilku fragmentów, żeby dać pełniejszą odpowiedź, ale NIE WOLNO Ci tworzyć nowego twierdzenia, którego żaden pojedynczy fragment wprost nie potwierdza.`,
  liczby: `NIGDY nie podawaj żadnej liczby (ceny, kwoty, terminu, procentu, okresu gwarancji), której nie ma dosłownie w powyższych fragmentach. Nie szacuj, nie podawaj "orientacyjnie", nie mów "od X do Y".`,
  // Zdanie musi zostać dosłowne w obu trybach: handleAsk() rozpoznaje brak
  // odpowiedzi wyrażeniem /nie mam takich informacji/i na surowym tekście
  // modelu. Inne sformułowanie w trybie wewnętrznym rozjechałoby tę ścieżkę.
  // Zdanie odmowne należy do klienta, więc rdzeń dostaje je parametrem zamiast
  // wklejać stałą. Reguła się nie zmienia: sformułowanie musi być DOSŁOWNE,
  // bo handleAsk() rozpoznaje po nim brak odpowiedzi.
  brakInformacji: (fallback) => `Jeśli żaden fragment nie zawiera wprost odpowiedzi na pytanie, powiedz dokładnie: "${fallback}" i nic więcej. Jeżeli natomiast fragmenty WYJAŚNIAJĄ, dlaczego danej informacji nie podajemy albo dlaczego nie da się jej podać — to wyjaśnienie JEST odpowiedzią. Podaj je wtedy i NIE używaj zdania odmownego.`,
};

const PROMPT_PUBLICZNY = "publiczny";
const PROMPT_WEWNETRZNY = "wewnetrzny";

// Który tryb promptu obowiązuje na której przestrzeni. Mapa jest jawna i nie
// ma wartości domyślnej — z tego samego powodu, dla którego nie ma jej
// vectorSearch(): cicha zamiana trybu jest dokładnie tym błędem, który
// kiedyś odpowiedziałby klientowi tonem instrukcji wewnętrznej.
function trybPromptu(space) {
  if (space === SPACE_PUBLIC) return PROMPT_PUBLICZNY;
  if (space === SPACE_INTERNAL) return PROMPT_WEWNETRZNY;
  throw new Error(`Nieznana przestrzeń dla trybu promptu: ${space}`);
}

function buildSystemPrompt(contextChunks, tryb, klient) {
  wymagajKlienta(klient);
  if (tryb === PROMPT_PUBLICZNY) return buildPublicSystemPrompt(contextChunks, klient);
  if (tryb === PROMPT_WEWNETRZNY) return buildInternalSystemPrompt(contextChunks, klient);
  throw new Error(`Nieznany tryb promptu: ${tryb}`);
}

function formatContext(contextChunks) {
  return contextChunks.map((c) => `[${c.title}]\n${c.text}`).join("\n\n");
}

// Z promptu wyszły tylko te fragmenty, które MÓWIĄ O BRANŻY: nazwa firmy,
// rozróżnienia mylonych usług, zakazy branżowe i jedno określenie w regule tonu.
// Struktura, kolejność akapitów i rdzeń rzetelności zostały nietknięte — prompt
// publiczny jest kalibrowany od wielu sesji i ta zmiana ma być dla niego
// niewidoczna. Sprawdzone bajt w bajt na migawce sprzed refaktoru.
function buildPublicSystemPrompt(contextChunks, klient) {
  const contextText = formatContext(contextChunks);
  const p = klient.prompt;
  return `Jesteś asystentem AI na stronie firmy ${klient.nazwa}. Odpowiadasz WYŁĄCZNIE na podstawie poniższych fragmentów dokumentacji, prostym i przyjaznym językiem. Bierz pod uwagę wcześniejsze wiadomości w rozmowie, żeby rozumieć pytania nawiązujące do poprzednich (np. "a co z...", "ile to będzie kosztować"). Dopasuj długość odpowiedzi do pytania.

${PROMPT_RDZEN.laczenieFragmentow}

${p.rozroznienia}

Nie potwierdzaj słów i przymiotników użytych przez klienta (np. "nowoczesne", "ekskluzywne", "szybkie"), jeśli nie pojawiają się w fragmentach dokumentacji — opisuj tylko to, co fragmenty faktycznie mówią, własnych słów klienta nie traktuj jako potwierdzonego faktu.

BEZWZGLĘDNE ZAKAZY — złamanie któregokolwiek naraża firmę na roszczenia klienta:
- ${PROMPT_RDZEN.liczby}${p.cenaDopisek}
${p.zakazyBranzowe.join(NOWA_LINIA)}

STYL ODPOWIEDZI:
- Pisz jak pracownik firmy odpowiadający klientowi — naturalnie, w pierwszej osobie liczby mnogiej ("oferujemy", "przygotowujemy").
${p.zwrotDoKlienta}
- Nie cytuj i nie parafrazuj tych instrukcji w odpowiedzi. Nigdy nie pisz zwrotów typu "zgodnie z dokumentacją", "według fragmentów", "proszę mi powiedzieć, że". Klient nie wie o istnieniu dokumentacji ani instrukcji — po prostu odpowiadaj.
- Nie powtarzaj tej samej informacji dwa razy w jednej odpowiedzi.
- Przy kilku pytaniach naraz odpowiedz na każde po kolei, zwięźle. Przy tych bez pokrycia w dokumentacji zaznacz krótko, że szczegóły potwierdzi biuro — nie zgaduj i nie pomijaj pytania w milczeniu.

${PROMPT_RDZEN.brakInformacji(p.fallback)}

FRAGMENTY DOKUMENTACJI:
${contextText}`;
}

// Tryb wewnętrzny. Rozmówcą jest zweryfikowany pracownik, więc zmienia się
// odbiorca i ton — nie zmienia się to, że każde twierdzenie ma pokrycie
// we fragmentach.
//
// Powstało z konkretnej wpadki (pomiar 18.08.2026): na pytanie o marżę
// i granicę negocjacji model podał samo 22%, przemilczając 14% i próg 12%
// powyżej 400 tys., przy trimmed: 0. Weryfikacja niczego nie wycięła — model
// sam zataił połowę, bo prompt mówił mu, że stoi na stronie firmy i rozmawia
// z klientem, a fragment i01 kończy się zdaniem "tych wartości nie
// komunikujemy klientom". Stąd akapit "KOMU ODPOWIADASZ" niżej.
function buildInternalSystemPrompt(contextChunks, klient) {
  const contextText = formatContext(contextChunks);
  const p = klient.prompt;
  return `Jesteś asystentem AI dla pracowników firmy ${klient.nazwa}. Rozmawiasz z pracownikiem firmy, nie z klientem — jego tożsamość została potwierdzona logowaniem. Odpowiadasz WYŁĄCZNIE na podstawie poniższych fragmentów dokumentacji. Bierz pod uwagę wcześniejsze wiadomości w rozmowie, żeby rozumieć pytania nawiązujące do poprzednich. Dopasuj długość odpowiedzi do pytania.

${PROMPT_RDZEN.laczenieFragmentow}

KOMU ODPOWIADASZ — to jest różnica wobec trybu publicznego:
- Pracownikowi wolno znać treści wewnętrzne. Wartości oznaczone w dokumentacji jako niekomunikowane klientom — widełki marży, progi decyzyjne, granice negocjacji, koszty wewnętrzne — podajesz mu WPROST, z liczbami.
- Zdanie we fragmencie w rodzaju "tych wartości nie komunikujemy klientom" dotyczy rozmowy z klientem. NIE jest poleceniem zatajenia ich przed pracownikiem. Pominięcie takiej liczby jest błędem — po to istnieje ten tryb.
- Nie odsyłaj do biura, działu ani przełożonego w sprawie, na którą fragmenty odpowiadają. Odesłanie ma sens tylko wtedy, gdy fragmenty wymagają czyjejś zgody (np. akceptacji zarządu) albo gdy odpowiedzi w nich nie ma.

ODPOWIADAJ NA CAŁE PYTANIE:
- Jeśli pytanie ma kilka części, odpowiedz na KAŻDĄ. Gdy fragmenty zawierają wartość standardową i jej granicę, próg albo wyjątek — podaj oba, nie samą wartość standardową.
- Niepełna odpowiedź jest tu groźniejsza niż w trybie publicznym: pracownik nie wie, czego nie dostał, i podejmie decyzję na połowie danych.

TON — instruktażowy, nie sprzedażowy:
- Pisz w trybie rozkazującym, do wykonania: ${p.przykladyRozkazow}. Nie pisz "firma prowadzi procedurę zgłoszenia" ani "pracownicy powinni rozważyć".
- Gdy fragment opisuje CZYNNOŚCI DO WYKONANIA, wypisz je jako kroki w kolejności wykonania — każdy krok w osobnej linii, zaczynając od czasownika.
- Gdy fragment opisuje stan rzeczy, uprawnienia, definicję albo zakres czyjejś roli, odpowiedz zwykłymi zdaniami. NIE zamieniaj opisu w listę poleceń i nie dorabiaj kroków tam, gdzie fragment żadnej procedury nie zawiera. Lista kroków wyciągnięta z opisu gubi połowę treści i sugeruje procedurę, której nie ma.
- ZACHOWAJ ADRESATA Z FRAGMENTU, nawet wbrew pytaniu. Jeśli fragment mówi, że coś robi albo coś dostaje ${p.przykladyRol} — napisz to o nich, nie o rozmówcy. Rozkazujący ton dotyczy tego, co ma zrobić rozmówca, a nie tego, czyje są cudze obowiązki.
- Pytanie bywa postawione z błędnym założeniem, kogo dotyczy — ${p.przykladSprostowania}. Wtedy nie przejmuj tego założenia: sprostuj je pierwszym zdaniem, a dopiero potem podaj treść. Powtórzenie cudzego błędu w adresacie jest w instrukcji równie groźne jak zmyślona liczba — pracownik wykona cudzy obowiązek albo zaniecha własnego.
- Sprostowanie dopisuj WYŁĄCZNIE wtedy, gdy samo pytanie przypisuje rozmówcy obowiązek, który we fragmencie należy do kogoś innego. Gdy pytanie brzmi neutralnie — ${p.przykladyNeutralne} — po prostu odpowiedz, kto. Nie zaczynaj wtedy od zdania o tym, czego rozmówca nie robi, i nie wciągaj do odpowiedzi cudzych obowiązków, o które nikt nie pytał.
- Podawaj konkrety dokładnie tak, jak stoją we fragmentach: liczby, progi, terminy, nazwy stanowisk odpowiedzialnych i wymagany sprzęt.
- Nie zwracaj się per Pan/Pani i nie prowadź rozmowy handlowej. To narzędzie pracy, nie kontakt z klientem.

ŹRÓDŁO — obowiązkowe, ważniejsze niż w trybie publicznym:
- Zakończ odpowiedź osobną, ostatnią linią w formacie: Podstawa: <tytuł fragmentu>
- Przy kilku wykorzystanych fragmentach wymień tytuły po przecinku, w tej linii.
- Pracownik musi móc sprawdzić podstawę w dokumencie — ${p.stawkaWewnetrzna}.
- Sam tytuł w linii "Podstawa:" wystarcza. Nie pisz w treści odpowiedzi zwrotów typu "zgodnie z dokumentacją", "według fragmentów" ani "na podstawie fragmentów".

BEZWZGLĘDNE ZAKAZY — obowiązują tak samo jak w trybie publicznym:
- ${PROMPT_RDZEN.liczby} Zatajać liczb nie wolno, ale wymyślać ich nie wolno tym bardziej — brak liczby we fragmentach znaczy, że jej nie podajesz.
- NIGDY nie opisuj procedury, kroku ani kolejności, których nie ma we fragmentach. ${p.zakazUzupelniania}
- NIGDY nie podawaj wartości wewnętrznej, której we fragmentach nie ma, tylko dlatego że rozmawiasz z pracownikiem. Ten tryb zdejmuje zakaz ujawniania, nie zakaz zmyślania.
- Nie myl wymagań obowiązkowych z zalecanymi — jeśli fragment mówi "wymaga", nie pisz "warto".

${PROMPT_RDZEN.brakInformacji(p.fallback)}

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
// `space` mówi, z którego endpointu przyszło pytanie. Panel właściciela firmy
// pokazuje analitykę publicznego widgetu — pytania pracowników nie mają się tam
// mieszać, nawet zanim bot wewnętrzny dostanie własny panel.
//
// `eskalacja` (opcjonalny) — obiekt eskalacji z wykryjEskalacje(). Zapisujemy
// tylko ID kategorii, żeby panel wewnętrzny mógł pokazać statystyki zdarzeń.
async function logQuestion(env, question, gap, source, space = SPACE_PUBLIC, cicho = null, eskalacja = null, klientId = null) {
  if (!env.RATE_LIMIT_KV) return;
  try {
    const key = `log:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    const entry = JSON.stringify({
      q: question.slice(0, 300),
      gap,
      source: source || null,
      space,
      // Wpisy są od 21.08.2026 podpisane klientem. Bez tego panel właściciela
      // jednej firmy pokazywałby pytania zadane drugiej — jeden log, jeden KV.
      ...(klientId ? { klient: klientId } : {}),
      // Ślad po warstwach usuwających zdania bez informowania pytającego.
      // Zapisujemy tylko wtedy, gdy coś faktycznie zniknęło — pusty obiekt
      // w każdym wpisie logu to koszt bez wartości.
      ...(cicho && (cicho.duplikat || cicho.instrukcje) ? { cicho } : {}),
      // Kategoria eskalacji — panel wewnętrzny liczy ile razy wystrzelił
      // każdy typ. Pole pojawia się wyłącznie przy pytaniach wewnętrznych.
      ...(eskalacja ? { eskalacja: eskalacja.id } : {}),
      ts: Date.now(),
    });
    await env.RATE_LIMIT_KV.put(key, entry, { expirationTtl: LOG_RETENTION_DAYS * 86400 });
  } catch {
    // Log jest funkcją poboczną — jego awaria nie może zepsuć odpowiedzi dla klienta.
  }
}

// Czy wpis w logu należy do tego klienta. Wpisy sprzed 21.08.2026 nie mają
// pola `klient` i przypadają temu, który ma `przejmujeStareWpisy` — jawnie
// w tablicy, nie przez zgadywanie po hoście.
function wpisKlienta(e, klient) {
  if (e.klient) return e.klient === klient.id;
  return Boolean(klient.przejmujeStareWpisy);
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

    // KLIENT WYNIKA Z HOSTA i jest ustalany RAZ, na wejściu. Wszystko poniżej
    // dostaje go parametrem — nic nie odczytuje go z żądania po drodze.
    // Host spoza tablicy nie dostaje żadnego klienta i nie dostaje odpowiedzi:
    // ta sama zasada, która od 21.08.2026 nie daje mu żadnej roli.
    const klient = rozpoznajKlienta(url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(request) });
    }

    if (url.pathname === "/reindex" && request.method === "GET") {
      if (!isAdmin(url, env)) {
        return new Response("Brak dostępu.", { status: 403, headers: corsHeaders(request) });
      }
      try {
        // Domyślnie `public` — zachowuje dotychczasowe zachowanie /reindex bez
        // parametru. Treść wewnętrzną trzeba zaindeksować świadomie: ?space=internal
        const space = url.searchParams.get("space") || SPACE_PUBLIC;
        if (!SPACES_ALLOWED.includes(space)) {
          return new Response(`Nieznana przestrzeń: ${space}. Dozwolone: ${SPACES_ALLOWED.join(", ")}.`, { status: 400, headers: corsHeaders(request) });
        }
        // Klienta wolno tu wskazać parametrem — i tylko tu. To narzędzie
        // wdrożeniowe za sekretem, a nie powierzchnia kliencka: indeksować
        // trzeba móc także tego klienta, którego host jeszcze nie odpowiada.
        // Parametr wybiera WPIS Z ZAMKNIĘTEJ TABLICY, nigdy nazwę przestrzeni —
        // nazwę i tak składa `przestrzenFizyczna()`, po stronie serwera.
        const idKlienta = url.searchParams.get("klient");
        const doIndeksu = idKlienta ? KLIENCI[idKlienta] : klient;
        if (!doIndeksu) {
          return new Response(`Nieznany klient: ${idKlienta || "(brak — host nierozpoznany)"}. Znani: ${Object.keys(KLIENCI).join(", ")}.`, { status: 400, headers: corsHeaders(request) });
        }
        const n = await handleReindex(env, doIndeksu, space);
        return new Response(`Zaindeksowano ${n} fragmentów klienta "${doIndeksu.id}" w przestrzeni "${space}".`, { headers: corsHeaders(request) });
      } catch (e) {
        return new Response(`Błąd indeksowania: ${e.message}.`, { status: 500, headers: corsHeaders(request) });
      }
    }

    // Panel właściciela firmy — analityka publicznego widgetu.
    //
    // OD 21.08.2026 NA TOŻSAMOŚCI Z ACCESS, NIE NA `REINDEX_SECRET`. Wcześniej
    // właściciel firmy dostawał ten sam klucz, który otwiera `/purge` i `/reindex`,
    // czyli mógł skasować własną bazę wiedzy pomyłką albo przez kogoś, kto podejrzy
    // mu ekran. To jest ta sama zmiana, którą `/internal` przeszedł 18.08.2026.
    //
    // Host panelowy jest warunkiem, nie ozdobnikiem: na nim stoi aplikacja Access
    // z polityką dopuszczającą właściciela, a nie cały zespół.
    if (url.pathname === "/stats" && request.method === "GET") {
      if (!hostWlasciciela(url)) {
        return jsonResponse({ error: "Panel właściciela działa wyłącznie na jego własnym hoście." }, corsHeaders(request), 404);
      }
      const auth = await verifyAccessJwt(request, env);
      if (!auth.ok) {
        return jsonResponse({ error: auth.error, szczegoly: auth.szczegoly }, corsHeaders(request), auth.status);
      }
      try {
        // Panel należy do właściciela firmy i dotyczy publicznego widgetu.
        // Pytania pracowników z /internal odfiltrowujemy — wpisy sprzed
        // separacji nie mają pola `space` i liczą się jako publiczne.
        const wszystkie = (await readLog(env)).filter((e) => wpisKlienta(e, klient));
        const entries = wszystkie.filter((e) => (e.space || SPACE_PUBLIC) !== SPACE_INTERNAL);

        // Diagnostyka warstw usuwających zdania po cichu — SAME LICZBY, bez
        // treści pytań, więc liczona po WSZYSTKICH wpisach, także wewnętrznych.
        // Właściciel firmy nie zobaczy tu pytań pracowników, a my zobaczymy,
        // gdy któraś warstwa znowu zacznie zjadać odpowiedzi niewidocznie.
        const cichoSuma = { duplikat: 0, instrukcje: 0 };
        let odpowiedziZUbytkiem = 0;
        for (const e of wszystkie) {
          if (!e.cicho) continue;
          odpowiedziZUbytkiem++;
          cichoSuma.duplikat += e.cicho.duplikat || 0;
          cichoSuma.instrukcje += e.cicho.instrukcje || 0;
        }
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
          // Nowe pole. Panel go nie zna i nie musi — jest dla nas.
          diagnostyka: {
            odpowiedzi_z_cichym_usunieciem: odpowiedziZUbytkiem,
            zdania_usuniete_po_cichu: cichoSuma,
            wpisow_w_logu: wszystkie.length,
          },
          topSources,
          timeline,
        }, corsHeaders(request));
      } catch (e) {
        return jsonResponse({ error: e.message }, corsHeaders(request), 500);
      }
    }

    // Interfejs asystenta dla pracowników (Etap 5).
    // WYŁĄCZNIE na hoście wewnętrznym — tam, gdzie przed Workerem stoi Access.
    // Bez tego warunku `/app` i `/panel` odpowiadały 200 także na publicznej
    // domenie klienta i na workers.dev (zmierzone 20.08.2026). Danych to nie
    // wystawiało — obie strony wołają `/internal` i `/stats-internal`, które bez
    // tokenu zwracają 401 — ale interfejs pracowniczy nie ma czego szukać pod
    // adresem, na który wchodzi klient.
    if ((url.pathname === "/app" || url.pathname === "/") && hostPracownika(url) && request.method === "GET") {
      const brak = odpowiedzBrakKonfiguracji(url, env, request);
      if (brak) return brak;
      return new Response(renderHtml(APP_INTERNAL_HTML, klient, env, "pracownik"), {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          ...corsHeaders(request),
        },
      });
    }

    // Panel właściciela — analityka publicznego widgetu. Wejście na host panelowy.
    if (url.pathname === "/" && hostWlasciciela(url) && request.method === "GET") {
      const brak = odpowiedzBrakKonfiguracji(url, env, request);
      if (brak) return brak;
      return new Response(renderHtml(PANEL_HTML, klient, env, "wlasciciel"), {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          ...corsHeaders(request),
        },
      });
    }

    // Panel analityczny bota wewnętrznego (Etap 6) — przeniesiony 21.08.2026
    // z hostu wewnętrznego na PANELOWY. Treść jest dla właściciela, więc ma
    // stać za polityką właściciela, a nie za polityką zespołu.
    if (url.pathname === "/panel" && hostWlasciciela(url) && request.method === "GET") {
      const brak = odpowiedzBrakKonfiguracji(url, env, request);
      if (brak) return brak;
      return new Response(renderHtml(PANEL_INTERNAL_HTML, klient, env, "wlasciciel"), {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          ...corsHeaders(request),
        },
      });
    }

    // Statystyki dla panelu bota wewnętrznego (pytania pracowników, luki szkoleniowe, eskalacje).
    // Dostęp wyłącznie przez token Cloudflare Access (JWT) — brak logowania hasłem/kluczem admina.
    // Analityka bota wewnętrznego — też należy do WŁAŚCICIELA, nie do zespołu.
    // Do 21.08.2026 stała na samym „token Access jest ważny", a że mieszkała na
    // hoście wewnętrznym, wystarczyło być pracownikiem: każdy z dostępu do bota
    // mógł zobaczyć luki szkoleniowe, eskalacje i listę zadanych pytań.
    if (url.pathname === "/stats-internal" && request.method === "GET") {
      if (!hostWlasciciela(url)) {
        return jsonResponse({ error: "Panel właściciela działa wyłącznie na jego własnym hoście." }, corsHeaders(request), 404);
      }
      const auth = await verifyAccessJwt(request, env);
      if (!auth.ok) {
        return jsonResponse({ error: auth.error, szczegoly: auth.szczegoly }, corsHeaders(request), auth.status);
      }
      try {
        const wszystkie = (await readLog(env)).filter((e) => wpisKlienta(e, klient));
        // Bierzemy wyłącznie pytania zadane do bota wewnętrznego
        const entries = wszystkie.filter((e) => (e.space || SPACE_PUBLIC) === SPACE_INTERNAL);

        const total = entries.length;
        const gaps = entries.filter((e) => e.gap);
        const answered = entries.filter((e) => !e.gap);

        // Najczęściej sprawdzane procedury wewnętrzne
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

        // Statystyki eskalacji zdarzeniowych (BHP, wypadki, spory, kontrole)
        const byKategoria = {};
        let totalEskalacji = 0;
        for (const e of entries) {
          if (!e.eskalacja) continue;
          totalEskalacji++;
          byKategoria[e.eskalacja] = (byKategoria[e.eskalacja] || 0) + 1;
        }

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
          recentQuestions: entries.slice(0, 50).map((e) => ({
            q: e.q,
            gap: e.gap,
            source: e.source,
            eskalacja: e.eskalacja || null,
            ts: e.ts,
          })),
          topSources,
          eskalacje: {
            total: totalEskalacji,
            byKategoria,
          },
          timeline,
        }, corsHeaders(request));
      } catch (e) {
        return jsonResponse({ error: e.message }, corsHeaders(request), 500);
      }
    }

    if (url.pathname === "/purge" && request.method === "GET") {
      if (!isAdmin(url, env)) {
        return new Response("Brak dostępu.", { status: 403, headers: corsHeaders(request) });
      }
      try {
        // Usuwa z indeksu wpisy o ID, których już nie ma w CHUNKS (pozostałości
        // po starszych wersjach dokumentacji). Podaj stare ID przez ?ids=c33,c34
        const idsParam = url.searchParams.get("ids") || "";
        const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
        if (!ids.length) {
          return new Response("Podaj ID do usunięcia, np. /purge?key=...&ids=c33,c34", { headers: corsHeaders(request) });
        }
        await vectorDelete(env, ids);
        return new Response(`Usunięto z indeksu: ${ids.join(", ")}`, { headers: corsHeaders(request) });
      } catch (e) {
        return new Response(`Błąd usuwania: ${e.message}`, { status: 500, headers: corsHeaders(request) });
      }
    }

    if (url.pathname === "/debug" && request.method === "GET") {
      if (!isAdmin(url, env)) {
        return new Response("Brak dostępu.", { status: 403, headers: corsHeaders(request) });
      }
      const q = url.searchParams.get("q");
      if (!q) return new Response("Podaj pytanie: /debug?key=...&q=twoje pytanie", { headers: corsHeaders(request) });
      try {
        const qVector = await embedText(env, q);
        // /debug jest administracyjny, więc może zajrzeć do obu przestrzeni —
        // ale też wyłącznie do tych wskazanych jawnie: ?space=public|internal|obie
        const spaceParam = url.searchParams.get("space") || SPACE_PUBLIC;
        const spaces = spaceParam === "obie" ? SPACES_FOR_INTERNAL : [spaceParam];
        // Jak w /reindex: klient z parametru albo z hosta, wpis z zamkniętej tablicy.
        const idKlientaDbg = url.searchParams.get("klient");
        const klientDbg = idKlientaDbg ? KLIENCI[idKlientaDbg] : klient;
        if (!klientDbg) {
          return new Response(`Nieznany klient: ${idKlientaDbg || "(brak — host nierozpoznany)"}. Znani: ${Object.keys(KLIENCI).join(", ")}.`, { status: 400, headers: corsHeaders(request) });
        }
        const matches = await vectorSearch(env, qVector, { topK: TOP_K, klient: klientDbg, rodzaje: spaces });
        const filtered = matches.filter((m, idx) => idx < MIN_CHUNKS || m.score >= MIN_SIMILARITY);

        // Tryb promptu bierze się z zakresu przeszukania: gdy w grze jest
        // przestrzeń wewnętrzna, /debug pokazuje to, co zobaczyłby pracownik.
        const przestrzenPytania = spaces.includes(SPACE_INTERNAL) ? SPACE_INTERNAL : SPACE_PUBLIC;
        const trybProm = trybPromptu(przestrzenPytania);
        const eskalacjaDbg = wykryjEskalacje(q, przestrzenPytania, klientDbg);
        const ostrzezenieDbg = wykryjOstrzezenie(q, przestrzenPytania, klientDbg);
        const ramkaDbg = eskalacjaDbg || ostrzezenieDbg;
        const systemPrompt = buildSystemPrompt(filtered.map((m) => m.metadata), trybProm, klientDbg);
        const answer = await generate(env, systemPrompt, [{ role: "user", content: q }]);

        const sentences = splitSentences(answer);
        const toCheck = sentences.length ? sentences : [answer];
        const sentenceVectors = await embed(env, toCheck);
        // /debug uruchamia WSZYSTKIE warstwy weryfikacji, nie samą semantyczną.
        // Do 19.08.2026 pokazywał wyłącznie cosinus, więc jego liczba wycięć
        // była dolnym oszacowaniem, a konfliktu warstwy obietnic z trybem
        // wewnętrznym nie dało się na nim zobaczyć w ogóle.
        const juzZachowane = [];
        const sentenceScores = toCheck.map((s, i) => {
          let best = 0, title = null;
          for (const m of filtered) {
            const sim = cosineSimilarity(sentenceVectors[i], m.values);
            if (sim > best) { best = sim; title = m.metadata.title; }
          }
          const prog = progCytowania(s);
          const doslownie = wystepujeDoslownie(s, filtered);
          const liczbyOk = numbersAreGrounded(s, filtered, trybProm, q);
          const obietnica = isUnsupportablePromise(s, trybProm, klientDbg);
          const instrukcje = leaksInstructions(s, trybProm);
          const duplikat = isDuplicate(s, juzZachowane);
          const passes = (best >= prog || doslownie) && liczbyOk && !obietnica;
          const connective = isConnectiveSentence(s);
          if (!instrukcje && !duplikat && (passes || (connective && liczbyOk && !obietnica))) {
            juzZachowane.push(s);
          }
          // Kolejność jak w verifyClaims: instrukcje i duplikaty odpadają
          // po cichu PRZED sprawdzeniem pokrycia, więc i tu decydują pierwsze.
          let akcja;
          if (instrukcje) akcja = "USUNIĘTE (instrukcje)";
          else if (duplikat) akcja = "USUNIĘTE (duplikat)";
          else if (passes) akcja = "zachowane";
          else if (connective && liczbyOk && !obietnica) akcja = "zachowane (grzecznościowe)";
          else if (!liczbyOk) akcja = "WYCIĘTE (liczba bez pokrycia)";
          else if (obietnica) akcja = "WYCIĘTE (obietnica)";
          else akcja = "WYCIĘTE (brak pokrycia)";

          return {
            zdanie: s,
            najlepsze_dopasowanie: title,
            podobienstwo: best.toFixed(3),
            prog: prog.toFixed(2),
            doslownie,
            liczby_ok: liczbyOk,
            obietnica,
            instrukcje,
            duplikat,
            przechodzi: passes,
            grzecznosciowe: connective,
            akcja,
          };
        });

        return jsonResponse({
          pytanie: q,
          klient: klientDbg.id,
          przeszukane_przestrzenie: spaces,
          tryb_promptu: trybProm,
          eskalacja: eskalacjaDbg ? { kategoria: eskalacjaDbg.id, pilne: eskalacjaDbg.pilne } : null,
          bezpieczenstwo: ostrzezenieDbg ? { kategoria: ostrzezenieDbg.id, pilne: ostrzezenieDbg.pilne } : null,
          progi: { MIN_SIMILARITY, CITATION_THRESHOLD, CITATION_THRESHOLD_KROTKIE, KROTKIE_ZDANIE_SLOW },
          znalezione_fragmenty: matches.map((m) => ({
            tytul: m.metadata.title,
            wynik: m.score.toFixed(3),
            przestrzen: m.metadata.space || "(brak — fragment sprzed separacji)",
          })),
          po_filtrze: filtered.length,
          odpowiedz: answer,
          // Tak, jak zobaczy to pracownik: z doklejoną ramką eskalacji.
          odpowiedz_z_eskalacja: zlozZEskalacja(answer, ramkaDbg),
          weryfikacja_zdan: sentenceScores,
        }, corsHeaders(request));
      } catch (e) {
        return jsonResponse({ blad: e.message }, corsHeaders(request), 500);
      }
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders(request) });
    }

    // Bot dla pracowników. Przestrzenie podaje TA linia, nie żądanie.
    // Dostęp wyłącznie na tożsamość z Cloudflare Access — REINDEX_SECRET tu
    // nie działa, celowo: pracownik nie ma mieć prawa do /reindex ani /purge.
    if (url.pathname === "/internal") {
      if (!klient) {
        return jsonResponse({ error: "Nieznany adres." }, corsHeaders(request), 404);
      }
      const auth = await verifyAccessJwt(request, env);
      if (!auth.ok) {
        return jsonResponse({ error: auth.error, szczegoly: auth.szczegoly }, corsHeaders(request), auth.status);
      }
      return handleAsk(request, env, klient, SPACES_FOR_INTERNAL, SPACE_INTERNAL, auth.identity);
    }

    // Publiczny widget. `SPACES_FOR_PUBLIC` to stała modułowa — nie ma ścieżki,
    // którą żądanie mogłoby wpłynąć na zakres przeszukiwania.
    // Host spoza tablicy klientów nie dostaje odpowiedzi. Do 21.08.2026
    // wpadał tutaj i dostawał dokumentację BudMaksu — przy jednym kliencie
    // to była teoria, przy dwóch byłby to wyciek treści nie tej firmy.
    if (!klient) {
      return jsonResponse({ error: "Nieznany adres." }, corsHeaders(request), 404);
    }
    return handleAsk(request, env, klient, SPACES_FOR_PUBLIC, SPACE_PUBLIC);
  },
};

// Wspólna obsługa pytania dla obu endpointów. `spaces` przychodzi wyłącznie
// z routingu powyżej i nigdy z danych żądania — to jest ten jeden szczegół,
// na którym stoi cała separacja.
// `identity` przychodzi tylko z /internal (z zweryfikowanego tokenu Access).
// Na razie jest wyłącznie odczytane i odsyłane w odpowiedzi — nic po nim nie
// filtruje. Będzie podstawą rozpoznawania klienta przy wielu firmach.
async function handleAsk(request, env, klient, rodzaje, askedFrom, identity = null) {
  let question, history;
  try {
    const body = await request.json();
    question = (body.question || "").toString().trim();
    history = sanitizeHistory(body.history);
  } catch {
    return jsonResponse({ error: "Nieprawidłowe zapytanie" }, corsHeaders(request), 400);
  }

  if (!question || question.length > MAX_QUESTION_LENGTH) {
    return jsonResponse({
      answer: question ? `Twoja wiadomość jest za długa (limit ${MAX_QUESTION_LENGTH} znaków). Spróbuj podzielić ją na kilka krótszych pytań.` : "Pytanie nie może być puste.",
      source: null,
      gap: false,
    }, corsHeaders(request), 400);
  }

  // Kategoria eskalacji zależy WYŁĄCZNIE od pytania i od tego, z którego
  // endpointu przyszło — nie od tego, co znalazł retrieval ani co napisał model.
  // Przy wypadku, którego dokumentacja nie pokrywa, skierowanie do przełożonego
  // jest potrzebne bardziej, nie mniej.
  const eskalacja = wykryjEskalacje(question, askedFrom, klient);
  // Ramka bezpieczeństwa działa w trybie publicznym, eskalacja w wewnętrznym —
  // są rozłączne z definicji, więc do złożenia odpowiedzi idzie ta, która jest.
  const ostrzezenie = wykryjOstrzezenie(question, askedFrom, klient);
  const ramka = eskalacja || ostrzezenie;
  const poleEskalacji = {
    ...(eskalacja ? { eskalacja: { kategoria: eskalacja.id, pilne: eskalacja.pilne } } : {}),
    // Osobne pole, nie `eskalacja`: interfejs klienta ma prawo pokazać to inaczej,
    // a panel liczy eskalacje pracownicze i nie może ich pomieszać z ostrzeżeniami.
    ...(ostrzezenie ? { bezpieczenstwo: { kategoria: ostrzezenie.id, pilne: ostrzezenie.pilne } } : {}),
  };

  if (env.RATE_LIMIT_KV) {
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    const bucket = Math.floor(Date.now() / 3600000);
    const key = `rl:${ip}:${bucket}`;
    const current = parseInt((await env.RATE_LIMIT_KV.get(key)) || "0", 10);
    if (current >= RATE_LIMIT_PER_HOUR) {
      return jsonResponse({ answer: "Zbyt wiele zapytań z tego adresu. Spróbuj za chwilę.", source: null, gap: false }, corsHeaders(request), 429);
    }
    await env.RATE_LIMIT_KV.put(key, String(current + 1), { expirationTtl: 3600 });
  }

  try {
    const recentUserMsgs = history.filter((h) => h.role === "user").slice(-2).map((h) => h.content);
    const retrievalQuery = [...recentUserMsgs, question].join("\n");

    const isLongQuestion = question.length >= LONG_QUESTION_CHARS;
    const topK = isLongQuestion ? TOP_K_LONG : TOP_K;

    const qVector = await embedText(env, retrievalQuery);
    const allMatches = await vectorSearch(env, qVector, { topK, klient, rodzaje });
    const filtered = allMatches.filter((m, idx) => idx < MIN_CHUNKS || m.score >= MIN_SIMILARITY);

    if (filtered.length === 0) {
      await logQuestion(env, question, true, null, askedFrom, null, eskalacja, klient.id);
      return jsonResponse({ answer: zlozZEskalacja(klient.prompt.fallback, ramka), source: null, gap: true, ...poleEskalacji }, corsHeaders(request));
    }

    // Tryb promptu, jak przestrzenie, przychodzi wyłącznie z routingu.
    // Jeden tryb dla promptu i dla weryfikacji. Rozjechanie ich znaczyłoby,
    // że model dostaje polecenie podania wartości wewnętrznej, a warstwa
    // weryfikacji wycina mu ją z odpowiedzi.
    const tryb = trybPromptu(askedFrom);
    const systemPrompt = buildSystemPrompt(filtered.map((m) => m.metadata), tryb, klient);
    const messages = [...history, { role: "user", content: question }];

    const rawAnswer = await generate(env, systemPrompt, messages);

    // Do 22.08.2026 warunkiem było samo wystąpienie frazy gdziekolwiek
    // w odpowiedzi. Zmierzone na kancelarii: fragment, którego treścią jest
    // wyjaśnienie odmowy, zamieniał całą odpowiedź w nagi fallback.
    if (!rawAnswer || tylkoOdmowa(rawAnswer)) {
      await logQuestion(env, question, true, null, askedFrom, null, eskalacja, klient.id);
      return jsonResponse({ answer: zlozZEskalacja(klient.prompt.fallback, ramka), source: null, gap: true, ...poleEskalacji }, corsHeaders(request));
    }

    // Odmowa dopisana OBOK treści jest usuwana, żeby odpowiedź nie zawierała
    // zdania zaprzeczającego temu, co mówi reszta. Reszta przechodzi weryfikację
    // w całości i bez ulg.
    const trescDoWeryfikacji = usunZdaniaOdmowne(rawAnswer);
    const verdict = await verifyClaims(trescDoWeryfikacji, filtered, env, klient, tryb, question);
    if (!verdict.ok) {
      // Licznik `cicho` MUSI dostać dane także tutaj. To jest ścieżka, na której
      // po weryfikacji nie zostało ani jedno twierdzenie — czyli jedyny przypadek,
      // w którym deduplikacja mogła zjeść CAŁĄ odpowiedź. Przekazywanie tu `null`
      // (stan sprzed 20.08.2026) wycinało z metryk dokładnie ten przypadek,
      // dla którego licznik powstał.
      await logQuestion(env, question, true, null, askedFrom, verdict.cicho, eskalacja, klient.id);
      return jsonResponse({ answer: zlozZEskalacja(verdict.fallback, ramka), source: null, gap: true, ...poleEskalacji }, corsHeaders(request));
    }

    await logQuestion(env, question, false, verdict.source, askedFrom, verdict.cicho, eskalacja, klient.id);
    return jsonResponse({
      answer: zlozZEskalacja(verdict.text, ramka),
      source: verdict.source,
      gap: false,
      trimmed: verdict.removed || 0,
      // Trzeci stan odpowiedzi obok normalnej i „brak w dokumentacji".
      // Osobne pole, żeby interfejs mógł ją pokazać inaczej — sam tekst
      // ramki jest już w `answer`, dla klientów, które tego pola nie znają.
      ...poleEskalacji,
      // Publiczna odpowiedź zachowuje dotychczasowy kształt — pole dochodzi
      // tylko wtedy, gdy pytający jest zalogowany.
      ...(identity ? { zalogowany: { email: identity.email, domena: identity.domena } } : {}),
    }, corsHeaders(request));
  } catch (e) {
    return jsonResponse({ answer: `Błąd: ${e.message}. Sprawdź bindingi AI i VECTORIZE.`, source: null, gap: false }, corsHeaders(request), 502);
  }
}

// Eksporty wyłącznie na potrzeby testu weryfikacji tokenu (test-access.mjs).
// Cloudflare uruchamia `export default` — te nazwy nie zmieniają zachowania
// Workera, pozwalają za to sprawdzić ścieżkę „ważny token" bez klikania w panelu.
// Eksport na potrzeby testów i analiz offline. Chodzi o to, żeby skrypt
// diagnostyczny uruchamiał TE funkcje, a nie ich przepisaną kopię — kopia
// rozjeżdża się z produkcją przy pierwszej poprawce i wtedy pomiar kłamie.
export {
  verifyAccessJwt, accessConfig, resetAccessCertsCache,
  isUnsupportablePromise, leaksInstructions, isDuplicate, numbersAreGrounded,
  wystepujeDoslownie, progCytowania, splitSentences, isConnectiveSentence,
  liczbyZeZrodla,
  wykryjEskalacje, wykryjOstrzezenie, zlozZEskalacja,
  tylkoOdmowa, usunZdaniaOdmowne,
  PROMPT_PUBLICZNY, PROMPT_WEWNETRZNY,
  // Rozpoznanie klienta i składanie nazwy przestrzeni — testowalne osobno,
  // bo to jedyne dwa miejsca decydujące, czyją dokumentację widzi pytający.
  rozpoznajKlienta, rolaHosta, przestrzenFizyczna,
  // Podstawianie nazw w szablonach — test pilnuje, żeby nowy klient nie zostawił
  // w interfejsie surowego `{{placeholdera}}` ani cudzej nazwy.
  renderHtml,
  // Skladanie motywu i tresci interfejsu z pol klienta.
  motywCss, linkFontow, kafleHtml, eskalacjeJson,
  buildSystemPrompt,
};

function resetAccessCertsCache() {
  accessCertsCache = { teamDomain: null, fetchedAt: 0, keys: null };
}