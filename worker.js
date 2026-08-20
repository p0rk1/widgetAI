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
import { CHUNKS } from "./content-public.js";
import { INTERNAL_CHUNKS } from "./content-internal.js";
import { PANEL_INTERNAL_HTML } from "./panel-internal.js";
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
const COMPANY_NAME = "BudMax Sp. z o.o.";
const FALLBACK_MESSAGE = "Nie mam takich informacji w mojej dokumentacji — polecam kontakt z biurem.";

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
function assertSpaces(namespaces) {
  if (!Array.isArray(namespaces) || namespaces.length === 0) {
    throw new Error("Nie podano przestrzeni wiedzy do przeszukania.");
  }
  for (const ns of namespaces) {
    if (!SPACES_ALLOWED.includes(ns)) {
      throw new Error(`Nieznana przestrzeń wiedzy: ${ns}`);
    }
  }
  return namespaces;
}

// vectorSearch(env, vector, opts) → tablica dopasowań: { id, score, values, metadata }.
// Wektory (`values`) są potrzebne weryfikacji zdanie-po-zdaniu, metadane —
// budowie promptu. Zwracamy zawsze tablicę, nigdy undefined.
//
// `opts.namespaces` jest OBOWIĄZKOWE i nie ma wartości domyślnej — wywołujący
// musi świadomie powiedzieć, którą przestrzeń przeszukuje. Vectorize przeszukuje
// jedną przestrzeń na zapytanie, więc przy kilku robimy tyle zapytań i scalamy
// wyniki po wyniku podobieństwa, jakby przyszły z jednego.
async function vectorSearch(env, vector, opts = {}) {
  const namespaces = assertSpaces(opts.namespaces);
  const topK = opts.topK ?? TOP_K;

  const perSpace = await Promise.all(
    namespaces.map((ns) =>
      env.VECTORIZE.query(vector, {
        namespace: ns,
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
async function vectorUpsert(env, vectors, namespace) {
  const [ns] = assertSpaces([namespace]);
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
const ALLOWED_ORIGINS = [
  "https://p0rk1.github.io",              // widget publiczny — GitHub Pages
  "https://budmax.know-base.app",         // publiczny host klienta
  "https://budmax-wewnetrzny.know-base.app", // bot dla pracowników (za Access)
];

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
function accessConfig(env) {
  const teamDomain = (env.ACCESS_TEAM_DOMAIN || "")
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
  const aud = (env.ACCESS_AUD || "").trim();
  const missing = [];
  if (!teamDomain) missing.push("ACCESS_TEAM_DOMAIN");
  if (!aud) missing.push("ACCESS_AUD");
  return { teamDomain, aud, missing };
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
  const { teamDomain, aud, missing } = accessConfig(env);

  // Ścieżka awaryjna: Access nieskonfigurowany. 503, nie 403 — to nie jest
  // odmowa dostępu, tylko brak konfiguracji, i komunikat ma to mówić wprost.
  if (missing.length) {
    return {
      ok: false,
      status: 503,
      error: "Tryb wewnętrzny nie jest jeszcze skonfigurowany — brak połączenia z Cloudflare Zero Trust Access.",
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
function chunksForSpace(space) {
  if (space === SPACE_PUBLIC) return CHUNKS;
  if (space === SPACE_INTERNAL) return INTERNAL_CHUNKS;
  throw new Error(`Nieznana przestrzeń wiedzy: ${space}`);
}

async function handleReindex(env, space) {
  const source = chunksForSpace(space);
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
        space,
        role: chunk.role || DEFAULT_ROLE,
      },
    }));
    await vectorUpsert(env, vectors, space);
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
// z pobranych fragmentów LUB dosłownie w pytaniu użytkownika. To wyłapuje
// zmyślone ceny i terminy wplecione w skądinąd poprawnie brzmiące zdanie,
// jednocześnie nie kasując zdań, w których model odnosi się do parametrów
// podanych przez pytającego (np. "dla silnika 1600 cm3").
function numbersAreGrounded(sentence, filtered, userQuestion = "") {
  const nums = extractNumbers(sentence);
  if (!nums.length) return true;
  const corpus = filtered.map((m) => m.metadata.text + " " + m.metadata.title).join(" ") + " " + (userQuestion || "");
  const corpusNums = new Set(extractNumbers(corpus));
  return nums.every((n) => corpusNums.has(n));
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
function isUnsupportablePromise(s, tryb = PROMPT_PUBLICZNY) {
  const t = s.toLowerCase();

  // Zdanie zaprzeczające ("nie oferujemy rabatów") albo odsyłające do biura
  // ("kwestię rabatów potwierdzi biuro") NIE jest obietnicą — przeciwnie,
  // to dokładnie takie zachowanie, jakiego oczekujemy. Nie wycinamy go.
  const isNegationOrDeferral = /\b(nie |bez |brak |nie mam|potwierdzi biuro|potwierdzi (nasze )?biuro|skontaktuj|kontakt z biurem|ustali biuro|zależy od indywidualn)/.test(t);
  if (isNegationOrDeferral) return false;

  // Obowiązują w obu trybach: dokumentacja nie zna grafiku ekip, więc ani
  // klientowi, ani pracownikowi nie wolno deklarować wolnego terminu.
  const wspolne = [
    /mamy wolne terminy|dysponujemy terminami|termin.{0,20}dostępn/,
    /(będziemy się starać|postaramy się|zdążymy|jesteśmy w stanie zdążyć)/,
  ];

  // Wyłącznie tryb publiczny: rabaty, upusty i stawki. Wewnątrz to nie jest
  // obietnica złożona klientowi, tylko informacja o progach decyzyjnych.
  const tylkoPubliczne = [
    /(oferujemy|udzielamy|mamy|przysługuj|możemy zaoferować).{0,30}(rabat|zniżk|upust)/,
    /(rabat|zniżk|upust).{0,30}(oferujemy|udzielamy|możliwe|dostępn)/,
    /niższy vat|lepsze ceny w hurtown|taniej w hurtown/,
    /płacisz z góry|płatność z góry/,
  ];

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

async function verifyClaims(fullText, filtered, env, tryb = PROMPT_PUBLICZNY, userQuestion = "") {
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

    const numbersOk = numbersAreGrounded(toCheck[i], filtered, userQuestion);
    const promiseOk = !isUnsupportablePromise(toCheck[i], tryb);

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
    return { ok: false, fallback: FALLBACK_MESSAGE, cicho };
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

const ESKALACJA_KONTAKT = "kierownik budowy";

// Rama informacyjna — pytanie o REGUŁĘ, nie o zdarzenie. Wetuje eskalację
// wyłącznie w kategoriach o niskiej pilności.
const RAMA_INFORMACYJNA = /(?<![a-z0-9])(co ile|jak czesto|jakie sa zasady|jaki jest (wymog|termin|limit)|ile wynosi|kto (zglasza|prowadzi|odpowiada)|w jakim (czasie|terminie)|czy musze miec|co obejmuje|jak dokumentujemy|z jakim wyprzedzeniem|jakie srodki ochrony|kiedy odnawiamy)/;

const KATEGORIE_ESKALACJI = [
  {
    id: "wypadek",
    pilne: true,
    // Słownictwo ZDARZENIOWE, nie tematyczne. Nie ma tu „rusztowania",
    // „wysokości" ani „szkolenia" — to tematy, przy których nikt nie leży
    // na ziemi. Właśnie ta różnica ma odsiewać fałszywe wyzwolenia.
    zdarzenie: /(?<![a-z0-9])(wypad(ek|ku|kiem|ki)|poszkodowan|uraz|ranny|zrani|skalecz|zlama|przygniot|potrac|poparz|oparzen|krwaw|nieprzytomn|stracil przytomnosc|zaslab|zemdla|doznal|spadl z|upadl z|karetk|pogotowi)/,
    tekst: `NAJPIERW POWIADOM: przy urazie zagrażającym życiu dzwoń pod 112, zaraz potem do kierownika budowy — zanim wykonasz cokolwiek z poniższego. Wypadku nie rozliczasz sam: o zgłoszeniach i terminach decyduje kierownik budowy.`,
  },
  {
    id: "zagrozenie_zycia",
    pilne: true,
    zdarzenie: /(?<![a-z0-9])(zagrozenie zycia|zagraza zyciu|nie oddycha|reanimac|pozar|pali sie|ulatnia sie|(czuc|zapach|wyciek|ulatnia).{0,20}gaz|porazeni|porazi|iskrzy|grozi zawaleniem|zawali|osuna|osune|osunal|zerwal sie|urwal sie|uwiezion|przysypa|zasypa)/,
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

// Czy w pytaniu pada kwota powyżej najniższego progu decyzyjnego (300 zł)
// albo procent powyżej samodzielnego rabatu handlowca (3%). Progi pochodzą
// z i39 i i41 — gdy tam się zmienią, tu też trzeba je zmienić.
function przekroczonyProgDecyzyjny(pytanie) {
  const t = bezOgonkow(pytanie);
  const procenty = [...t.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:procent|proc\.|%)/g)]
    .map((m) => parseFloat(m[1].replace(",", ".")));
  if (procenty.some((p) => p > 3)) return true;
  return extractNumbers(t).map(Number).some((k) => k >= 300);
}

// Wykrywa kategorię eskalacji. Zwraca null albo { id, pilne, tekst }.
// Patrzy WYŁĄCZNIE na treść pytania — nie na odpowiedź modelu i nie na to,
// co znalazł retrieval. Dzięki temu wynik nie zależy od tego, czy dokumentacja
// akurat coś na ten temat zawiera: przy wypadku bez pokrycia w dokumentacji
// skierowanie do przełożonego jest potrzebne bardziej, nie mniej.
function wykryjEskalacje(pytanie, askedFrom) {
  if (askedFrom !== SPACE_INTERNAL) return null; // publiczny bot nie eskaluje do brygadzisty
  const t = bezOgonkow(pytanie);
  const informacyjne = RAMA_INFORMACYJNA.test(t);

  for (const k of KATEGORIE_ESKALACJI) {
    if (!k.zdarzenie.test(t)) continue;
    if (k.drugiSygnal && !k.drugiSygnal.test(t)) continue;
    if (k.prog && !przekroczonyProgDecyzyjny(pytanie)) continue;
    // Weto ramy informacyjnej obowiązuje TYLKO tam, gdzie fałszywy alarm boli
    // bardziej niż przeoczenie. Przy wypadku i zagrożeniu życia nie obowiązuje:
    // „kto zgłasza wypadek śmiertelny" dostanie ramkę i dobrze, bo koszt to
    // jedno zdanie za dużo, a koszt przeoczenia to zdrowie.
    if (!k.pilne && informacyjne) continue;
    return { id: k.id, pilne: k.pilne, tekst: k.tekst };
  }
  return null;
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

// Rdzeń rzetelności — obowiązuje w OBU trybach. Tryb wewnętrzny zmienia to,
// co wolno powiedzieć rozmówcy, a nie to, czy wolno to zmyślić.
const PROMPT_RDZEN = {
  laczenieFragmentow: `Gdy pytanie dotyczy kilku kwestii lub zagadnienia opisanego w kilku fragmentach, POŁĄCZ informacje ze wszystkich relewantnych fragmentów w jedną kompletną odpowiedź. Nie pomijaj żadnego aspektu, o który pyta użytkownik ani progów wynikających z fragmentów. Pamiętaj jednak: NIE WOLNO Ci tworzyć nowego twierdzenia, którego żaden pojedynczy fragment wprost nie potwierdza.`,
  liczby: `NIGDY nie podawaj żadnej liczby (ceny, kwoty, terminu, procentu, okresu gwarancji), której nie ma dosłownie w powyższych fragmentach. Nie szacuj, nie podawaj "orientacyjnie", nie mów "od X do Y".`,
  // Zdanie musi zostać dosłowne w obu trybach: handleAsk() rozpoznaje brak
  // odpowiedzi wyrażeniem /nie mam takich informacji/i na surowym tekście
  // modelu. Inne sformułowanie w trybie wewnętrznym rozjechałoby tę ścieżkę.
  brakInformacji: `Jeśli żaden fragment nie zawiera wprost odpowiedzi na pytanie, powiedz dokładnie: "${FALLBACK_MESSAGE}" i nic więcej.`,
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

function buildSystemPrompt(contextChunks, tryb) {
  if (tryb === PROMPT_PUBLICZNY) return buildPublicSystemPrompt(contextChunks);
  if (tryb === PROMPT_WEWNETRZNY) return buildInternalSystemPrompt(contextChunks);
  throw new Error(`Nieznany tryb promptu: ${tryb}`);
}

function formatContext(contextChunks) {
  return contextChunks.map((c) => `[${c.title}]\n${c.text}`).join("\n\n");
}

function buildPublicSystemPrompt(contextChunks) {
  const contextText = formatContext(contextChunks);
  return `Jesteś asystentem AI na stronie firmy ${COMPANY_NAME}. Odpowiadasz WYŁĄCZNIE na podstawie poniższych fragmentów dokumentacji, prostym i przyjaznym językiem. Bierz pod uwagę wcześniejsze wiadomości w rozmowie, żeby rozumieć pytania nawiązujące do poprzednich (np. "a co z...", "ile to będzie kosztować"). Dopasuj długość odpowiedzi do pytania.

${PROMPT_RDZEN.laczenieFragmentow}

Zachowaj szczególną ostrożność przy podobnie brzmiących, ale różnych usługach — to częsty błąd, którego musisz unikać:
- "ogród" (zieleń, rośliny, krajobraz) to NIE to samo co "ogrodzenie" (płot, brama, infrastruktura działki) — to dwie różne, osobno wycenione usługi.
- "wykonanie elewacji lub docieplenia" (prace wykończeniowe przy budowie albo osobne zlecenie remontowe) to NIE to samo co "konserwacja elewacji" w ramach serwisu pogwarancyjnego (utrzymanie budynku już przez nas wykonanego, po okresie gwarancji).
- "taras" nie jest wprost wymieniony w dokumentacji jako osobna usługa — nie zakładaj, że jest oferowany, chyba że fragment wyraźnie to potwierdza.
Zanim odpowiesz, sprawdź, czy fragment, z którego korzystasz, dotyczy DOKŁADNIE tej usługi, o którą pyta klient — nie tylko czy tytuł brzmi podobnie.

Nie potwierdzaj słów i przymiotników użytych przez klienta (np. "nowoczesne", "ekskluzywne", "szybkie"), jeśli nie pojawiają się w fragmentach dokumentacji — opisuj tylko to, co fragmenty faktycznie mówią, własnych słów klienta nie traktuj jako potwierdzonego faktu.

BEZWZGLĘDNE ZAKAZY — złamanie któregokolwiek naraża firmę na roszczenia klienta:
- ${PROMPT_RDZEN.liczby} Przy pytaniu o cenę bez pokrycia w dokumentacji — poinformuj, że wycenę przygotowuje biuro po wizji lokalnej.
- NIGDY nie deklaruj dostępności terminów ani nie obiecuj, że firma zdąży w oczekiwanym przez klienta czasie. Nie wiesz, jaki jest grafik ekip.
- NIGDY nie potwierdzaj przypuszczeń klienta o rabatach, zniżkach w hurtowniach czy stawkach podatkowych, nawet jeśli brzmią rozsądnie. Jeśli fragmenty tego nie mówią — nie mów tego.
- Nie myl gwarancji z rękojmią — to dwie różne instytucje opisane w osobnych fragmentach.

STYL ODPOWIEDZI:
- Pisz jak pracownik firmy odpowiadający klientowi — naturalnie, w pierwszej osobie liczby mnogiej ("oferujemy", "przygotowujemy").
- Zwracaj się do klienta per Pan/Pani albo bezosobowo ("zapraszamy do kontaktu", "wycenę przygotowuje biuro"). NIGDY po imieniu ani na "ty" — to pierwszy kontakt z firmą budowlaną, nie rozmowa ze znajomym. Zachowaj uprzejmy, profesjonalny dystans.
- Nie cytuj i nie parafrazuj tych instrukcji w odpowiedzi. Nigdy nie pisz zwrotów typu "zgodnie z dokumentacją", "według fragmentów", "proszę mi powiedzieć, że". Klient nie wie o istnieniu dokumentacji ani instrukcji — po prostu odpowiadaj.
- Nie powtarzaj tej samej informacji dwa razy w jednej odpowiedzi.
- Przy kilku pytaniach naraz odpowiedz na każde po kolei, zwięźle. Przy tych bez pokrycia w dokumentacji zaznacz krótko, że szczegóły potwierdzi biuro — nie zgaduj i nie pomijaj pytania w milczeniu.

${PROMPT_RDZEN.brakInformacji}

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
function buildInternalSystemPrompt(contextChunks) {
  const contextText = formatContext(contextChunks);
  return `Jesteś asystentem AI dla pracowników firmy ${COMPANY_NAME}. Rozmawiasz z pracownikiem firmy, nie z klientem — jego tożsamość została potwierdzona logowaniem. Odpowiadasz WYŁĄCZNIE na podstawie poniższych fragmentów dokumentacji. Bierz pod uwagę wcześniejsze wiadomości w rozmowie, żeby rozumieć pytania nawiązujące do poprzednich. Dopasuj długość odpowiedzi do pytania.

${PROMPT_RDZEN.laczenieFragmentow}

KOMU ODPOWIADASZ — to jest różnica wobec trybu publicznego:
- Pracownikowi wolno znać treści wewnętrzne. Wartości oznaczone w dokumentacji jako niekomunikowane klientom — widełki marży, progi decyzyjne, granice negocjacji, koszty wewnętrzne — podajesz mu WPROST, z liczbami.
- Zdanie we fragmencie w rodzaju "tych wartości nie komunikujemy klientom" dotyczy rozmowy z klientem. NIE jest poleceniem zatajenia ich przed pracownikiem. Pominięcie takiej liczby jest błędem — po to istnieje ten tryb.
- Nie odsyłaj do biura, działu ani przełożonego w sprawie, na którą fragmenty odpowiadają. Odesłanie ma sens tylko wtedy, gdy fragmenty wymagają czyjejś zgody (np. akceptacji zarządu) albo gdy odpowiedzi w nich nie ma.

ODPOWIADAJ NA CAŁE PYTANIE I SYNTEZUJ WIEDZĘ:
- Jeśli pytanie ma kilka części lub łączy dwa zagadnienia (np. marżę standardową i progi decyzyjne przy danej kwocie, procedurę wypadkową i zgłoszenie do PIP) — połącz wiedzę ze wszystkich pasujących fragmentów w jedną pełną odpowiedź.
- Gdy fragmenty zawierają wartość standardową i jej granicę, próg kwotowy albo wyjątek — podaj oba, nie samą wartość standardową.
- Niepełna odpowiedź jest tu groźniejsza niż w trybie publicznym: pracownik nie wie, czego nie dostał, i podejmie decyzję na połowie danych.

TON — instruktażowy, nie sprzedażowy:
- Pisz w trybie rozkazującym, do wykonania: "przerwij pracę", "powiadom kierownika budowy", "zgłoś w raporcie tygodniowym do piątku do 14". Nie pisz "firma prowadzi procedurę zgłoszenia" ani "pracownicy powinni rozważyć".
- Gdy fragment opisuje CZYNNOŚCI DO WYKONANIA, wypisz je jako kroki w kolejności wykonania — każdy krok w osobnej linii, zaczynając od czasownika.
- Gdy fragment opisuje stan rzeczy, uprawnienia, definicję albo zakres czyjejś roli, odpowiedz zwykłymi zdaniami. NIE zamieniaj opisu w listę poleceń i nie dorabiaj kroków tam, gdzie fragment żadnej procedury nie zawiera. Lista kroków wyciągnięta z opisu gubi połowę treści i sugeruje procedurę, której nie ma.
- ZACHOWAJ ADRESATA Z FRAGMENTU, nawet wbrew pytaniu. Jeśli fragment mówi, że coś robi albo coś dostaje kierownik budowy, brygadzista czy kadry — napisz to o nich, nie o rozmówcy. Rozkazujący ton dotyczy tego, co ma zrobić rozmówca, a nie tego, czyje są cudze obowiązki.
- Pytanie bywa postawione z błędnym założeniem, kogo dotyczy — na przykład "czego inspektor może żądać ODE MNIE", podczas gdy fragment mówi, że polecenia inspektora odbiera kierownik budowy. Wtedy nie przejmuj tego założenia: sprostuj je pierwszym zdaniem, a dopiero potem podaj treść. Powtórzenie cudzego błędu w adresacie jest w instrukcji równie groźne jak zmyślona liczba — pracownik wykona cudzy obowiązek albo zaniecha własnego.
- Sprostowanie dopisuj WYŁĄCZNIE wtedy, gdy samo pytanie przypisuje rozmówcy obowiązek, który we fragmencie należy do kogoś innego. Gdy pytanie brzmi neutralnie — "kto może wpisywać do dziennika", "kto zamawia materiał" — po prostu odpowiedz, kto. Nie zaczynaj wtedy od zdania o tym, czego rozmówca nie robi, i nie wciągaj do odpowiedzi cudzych obowiązków, o które nikt nie pytał.
- Podawaj konkrety dokładnie tak, jak stoją we fragmentach: liczby, progi, terminy, nazwy stanowisk odpowiedzialnych i wymagany sprzęt.
- Nie zwracaj się per Pan/Pani i nie prowadź rozmowy handlowej. To narzędzie pracy, nie kontakt z klientem.

ŹRÓDŁO — obowiązkowe, ważniejsze niż w trybie publicznym:
- Zakończ odpowiedź osobną, ostatnią linią w formacie: Podstawa: <tytuł fragmentu>
- Przy kilku wykorzystanych fragmentach wymień tytuły po przecinku, w tej linii.
- Pracownik musi móc sprawdzić podstawę w dokumencie — przy BHP i kadrach zależy od tego jego bezpieczeństwo i rozliczenie czasu pracy.
- Sam tytuł w linii "Podstawa:" wystarcza. Nie pisz w treści odpowiedzi zwrotów typu "zgodnie z dokumentacją", "według fragmentów" ani "na podstawie fragmentów".

BEZWZGLĘDNE ZAKAZY — obowiązują tak samo jak w trybie publicznym:
- ${PROMPT_RDZEN.liczby} Zatajać liczb nie wolno, ale wymyślać ich nie wolno tym bardziej — brak liczby we fragmentach znaczy, że jej nie podajesz.
- NIGDY nie opisuj procedury, kroku ani kolejności, których nie ma we fragmentach. Nie uzupełniaj procedury BHP ani kadrowej "zdrowym rozsądkiem" — brakujący krok w instrukcji jest groźniejszy niż brak instrukcji.
- NIGDY nie podawaj wartości wewnętrznej, której we fragmentach nie ma, tylko dlatego że rozmawiasz z pracownikiem. Ten tryb zdejmuje zakaz ujawniania, nie zakaz zmyślania.
- Nie myl wymagań obowiązkowych z zalecanymi — jeśli fragment mówi "wymaga", nie pisz "warto".

${PROMPT_RDZEN.brakInformacji}

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
async function logQuestion(env, question, gap, source, space = SPACE_PUBLIC, cicho = null, eskalacja = null) {
  if (!env.RATE_LIMIT_KV) return;
  try {
    const key = `log:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    const entry = JSON.stringify({
      q: question.slice(0, 300),
      gap,
      source: source || null,
      space,
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
        const n = await handleReindex(env, space);
        return new Response(`Zaindeksowano ${n} fragmentów w przestrzeni "${space}".`, { headers: corsHeaders(request) });
      } catch (e) {
        return new Response(`Błąd indeksowania: ${e.message}.`, { status: 500, headers: corsHeaders(request) });
      }
    }

    if (url.pathname === "/stats" && request.method === "GET") {
      if (!isAdmin(url, env)) {
        return jsonResponse({ error: "Brak dostępu." }, corsHeaders(request), 403);
      }
      try {
        // Panel należy do właściciela firmy i dotyczy publicznego widgetu.
        // Pytania pracowników z /internal odfiltrowujemy — wpisy sprzed
        // separacji nie mają pola `space` i liczą się jako publiczne.
        const wszystkie = await readLog(env);
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
    // Serwowany na dedykowanym hoście wewnętrznym (GET /) lub ścieżce /app.
    if ((url.pathname === "/app" || (url.pathname === "/" && url.hostname.includes("wewnetrzny"))) && request.method === "GET") {
      return new Response(APP_INTERNAL_HTML, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          ...corsHeaders(request),
        },
      });
    }

    // Panel analityczny dla bota wewnętrznego (Etap 6).
    // Zwraca interfejs HTML chroniony przez Cloudflare Access.
    if (url.pathname === "/panel" && request.method === "GET") {
      return new Response(PANEL_INTERNAL_HTML, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          ...corsHeaders(request),
        },
      });
    }

    // Statystyki dla panelu bota wewnętrznego (pytania pracowników, luki szkoleniowe, eskalacje).
    // Dostęp wyłącznie przez token Cloudflare Access (JWT) — brak logowania hasłem/kluczem admina.
    if (url.pathname === "/stats-internal" && request.method === "GET") {
      const auth = await verifyAccessJwt(request, env);
      if (!auth.ok) {
        return jsonResponse({ error: auth.error, szczegoly: auth.szczegoly }, corsHeaders(request), auth.status);
      }
      try {
        const wszystkie = await readLog(env);
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
        const matches = await vectorSearch(env, qVector, { topK: TOP_K, namespaces: spaces });
        const filtered = matches.filter((m, idx) => idx < MIN_CHUNKS || m.score >= MIN_SIMILARITY);

        // Tryb promptu bierze się z zakresu przeszukania: gdy w grze jest
        // przestrzeń wewnętrzna, /debug pokazuje to, co zobaczyłby pracownik.
        const przestrzenPytania = spaces.includes(SPACE_INTERNAL) ? SPACE_INTERNAL : SPACE_PUBLIC;
        const trybProm = trybPromptu(przestrzenPytania);
        const eskalacjaDbg = wykryjEskalacje(q, przestrzenPytania);
        const systemPrompt = buildSystemPrompt(filtered.map((m) => m.metadata), trybProm);
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
          const liczbyOk = numbersAreGrounded(s, filtered, q);
          const obietnica = isUnsupportablePromise(s, trybProm);
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
          przeszukane_przestrzenie: spaces,
          tryb_promptu: trybProm,
          eskalacja: eskalacjaDbg ? { kategoria: eskalacjaDbg.id, pilne: eskalacjaDbg.pilne } : null,
          progi: { MIN_SIMILARITY, CITATION_THRESHOLD, CITATION_THRESHOLD_KROTKIE, KROTKIE_ZDANIE_SLOW },
          znalezione_fragmenty: matches.map((m) => ({
            tytul: m.metadata.title,
            wynik: m.score.toFixed(3),
            przestrzen: m.metadata.space || "(brak — fragment sprzed separacji)",
          })),
          po_filtrze: filtered.length,
          odpowiedz: answer,
          // Tak, jak zobaczy to pracownik: z doklejoną ramką eskalacji.
          odpowiedz_z_eskalacja: zlozZEskalacja(answer, eskalacjaDbg),
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
      const auth = await verifyAccessJwt(request, env);
      if (!auth.ok) {
        return jsonResponse({ error: auth.error, szczegoly: auth.szczegoly }, corsHeaders(request), auth.status);
      }
      return handleAsk(request, env, SPACES_FOR_INTERNAL, SPACE_INTERNAL, auth.identity);
    }

    // Publiczny widget. `SPACES_FOR_PUBLIC` to stała modułowa — nie ma ścieżki,
    // którą żądanie mogłoby wpłynąć na zakres przeszukiwania.
    return handleAsk(request, env, SPACES_FOR_PUBLIC, SPACE_PUBLIC);
  },
};

// Wspólna obsługa pytania dla obu endpointów. `spaces` przychodzi wyłącznie
// z routingu powyżej i nigdy z danych żądania — to jest ten jeden szczegół,
// na którym stoi cała separacja.
// `identity` przychodzi tylko z /internal (z zweryfikowanego tokenu Access).
// Na razie jest wyłącznie odczytane i odsyłane w odpowiedzi — nic po nim nie
// filtruje. Będzie podstawą rozpoznawania klienta przy wielu firmach.
async function handleAsk(request, env, spaces, askedFrom, identity = null) {
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
  const eskalacja = wykryjEskalacje(question, askedFrom);
  const poleEskalacji = eskalacja ? { eskalacja: { kategoria: eskalacja.id, pilne: eskalacja.pilne } } : {};

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
    const allMatches = await vectorSearch(env, qVector, { topK, namespaces: spaces });
    const filtered = allMatches.filter((m, idx) => idx < MIN_CHUNKS || m.score >= MIN_SIMILARITY);

    if (filtered.length === 0) {
      await logQuestion(env, question, true, null, askedFrom, null, eskalacja);
      return jsonResponse({ answer: zlozZEskalacja(FALLBACK_MESSAGE, eskalacja), source: null, gap: true, ...poleEskalacji }, corsHeaders(request));
    }

    // Tryb promptu, jak przestrzenie, przychodzi wyłącznie z routingu.
    // Jeden tryb dla promptu i dla weryfikacji. Rozjechanie ich znaczyłoby,
    // że model dostaje polecenie podania wartości wewnętrznej, a warstwa
    // weryfikacji wycina mu ją z odpowiedzi.
    const tryb = trybPromptu(askedFrom);
    const systemPrompt = buildSystemPrompt(filtered.map((m) => m.metadata), tryb);
    const messages = [...history, { role: "user", content: question }];

    const rawAnswer = await generate(env, systemPrompt, messages);

    if (!rawAnswer || /nie mam takich informacji/i.test(rawAnswer)) {
      await logQuestion(env, question, true, null, askedFrom, null, eskalacja);
      return jsonResponse({ answer: zlozZEskalacja(FALLBACK_MESSAGE, eskalacja), source: null, gap: true, ...poleEskalacji }, corsHeaders(request));
    }

    const verdict = await verifyClaims(rawAnswer, filtered, env, tryb, question);
    if (!verdict.ok) {
      await logQuestion(env, question, true, null, askedFrom, null, eskalacja);
      return jsonResponse({ answer: zlozZEskalacja(verdict.fallback, eskalacja), source: null, gap: true, ...poleEskalacji }, corsHeaders(request));
    }

    await logQuestion(env, question, false, verdict.source, askedFrom, verdict.cicho, eskalacja);
    return jsonResponse({
      answer: zlozZEskalacja(verdict.text, eskalacja),
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
  wykryjEskalacje, zlozZEskalacja, KATEGORIE_ESKALACJI,
  PROMPT_PUBLICZNY, PROMPT_WEWNETRZNY,
};

function resetAccessCertsCache() {
  accessCertsCache = { teamDomain: null, fetchedAt: 0, keys: null };
}