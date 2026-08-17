# KnowBase — kontekst projektu

## Czym to jest

Bot FAQ oparty na RAG, odpowiadający wyłącznie na podstawie dokumentacji firmy —
nigdy nie zmyślając. Jeden z trzech produktów lokalnego SaaS-u dla polskich MŚP
(do ~50 osób). Pozostałe dwa robią wspólnicy: BizChat (Bartek — czat z rezerwacjami),
MailPilot (Michał — wtyczka do Gmaila/Outlooka, opublikowana w sklepie Microsoftu).

Aktualny stan: działające demo na fikcyjnej firmie budowlanej **BudMax Sp. z o.o.**

## Pliki

| Plik | Co to | Gdzie żyje |
|---|---|---|
| `worker.js` | Backend — RAG, weryfikacja, endpointy | Cloudflare Worker `knowbase-budmax` |
| `index.html` | Strona firmy z osadzonym widgetem | GitHub Pages |
| `panel.html` | Panel analityczny dla właściciela firmy | GitHub Pages |
| `wrangler.toml` | Konfiguracja deployu — bindingi, zmienne Access, data kompatybilności | repo |
| `ZERO-TRUST.md` | Instrukcja konfiguracji logowania do trybu wewnętrznego | repo |
| `test-access.mjs` | Test weryfikacji tokenu Access (`node test-access.mjs`) | repo |

Adresy:
- Worker: `https://knowbase-budmax.rezi7608.workers.dev`
- Strona: `https://p0rk1.github.io/widgetAI/`
- Panel: `https://p0rk1.github.io/widgetAI/panel.html`

## Infrastruktura (Cloudflare, plan darmowy)

Bindingi Workera — **wszystkie cztery są wymagane**:
- `AI` → Workers AI
- `RATE_LIMIT_KV` → KV Namespace (rate limit + log pytań)
- `VECTORIZE` → indeks `budmax-knowledge` (1024 wymiary, cosine)
- `REINDEX_SECRET` → Secret (klucz endpointów administracyjnych)

`REINDEX_SECRET` ustawia się poza kodem: `wrangler secret put REINDEX_SECRET`
albo Worker → Settings → Variables → Add secret. **Nigdy w repo — jest publiczne.**
Bez ustawionego sekretu endpointy administracyjne zwracają 403 (fail-closed).

Sekret **jest ustawiony**, a jego wartość przechowuje właściciel projektu poza
repozytorium. Nie ma jej w kodzie, w konfiguracji ani w tym pliku — jeśli jest
potrzebna, trzeba o nią poprosić, nie zgadywać ani nie odtwarzać z historii.
Wartości `budmax-reindex-2026` i `gieldowa1q2w3e` są **martwe i spalone**
(pierwsza leżała jawnie w kodzie, druga wyciekła do zapisu rozmowy).
Nie przywracać ich i nie używać jako przykładów — także w dokumentacji.

Wartość podaje się wyłącznie w monicie `wrangler secret put`, nigdy jako argument
w linii komendy: argumenty trafiają do historii powłoki na dysku.

Modele — konfigurowane w obiekcie `PROVIDER` w `worker.js`, nie w luźnych stałych:
- Generowanie: `@cf/meta/llama-3.3-70b-instruct-fp8-fast` (od 16.08.2026 — patrz „Dlaczego 70B")
- Embeddingi: `@cf/baai/bge-m3` (1024 wymiary — musi zgadzać się z indeksem)

Poprzednio `@cf/meta/llama-3.1-8b-instruct-fast`. **Nie wracać do 8B** — powód niżej.

**Uwaga:** katalog modeli Cloudflare zmienia się bez uprzedzenia. Jeśli Worker
zwraca błąd połączenia z modelem, najpierw sprawdź
`https://developers.cloudflare.com/workers-ai/models/` czy model nie został wycofany.

## Tożsamość i uprawnienia

Dwa rozłączne mechanizmy, celowo — do 17.08.2026 był jeden i to był problem.

| Endpoint | Kto | Czym się uwierzytelnia |
|---|---|---|
| `POST /` | każdy | — |
| `POST /internal` | pracownik | tożsamość z Cloudflare Zero Trust Access (Google / Microsoft) |
| `/reindex`, `/purge`, `/stats`, `/debug` | administrator | `REINDEX_SECRET` |

**Dlaczego rozdzielone.** Wcześniej `/internal` chodził na tym samym sekrecie co
`/reindex` i `/purge`, więc pracownik dostający dostęp do bota dostawał też prawo
skasowania indeksu. Sekret na `/internal` **przestał działać** i nie ma tam ścieżki
obejścia — `?key=` zwraca 401 z komunikatem, że klucz już nie otwiera tego trybu.

**Weryfikacja tokenu.** `verifyAccessJwt()` sprawdza cztery rzeczy i nie ufa samej
obecności nagłówka `Cf-Access-Jwt-Assertion` — nagłówek może dopisać każdy, kto
trafi do Workera z pominięciem Access, choćby przez adres `workers.dev`:

1. **podpis** RS256 przeciwko kluczom publicznym zespołu
   (`https://<zespół>/cdn-cgi/access/certs`, cache 1 h, jedno wymuszone odświeżenie
   przy nieznanym `kid`),
2. **wystawca** (`iss`) równy domenie zespołu,
3. **odbiorca** (`aud`) zawierający `ACCESS_AUD` tej aplikacji,
4. **ważność** (`exp`, `nbf`) z tolerancją 60 s na rozjazd zegarów.

Podpis jest sprawdzany **przed** zaufaniem czemukolwiek z ładunku. Token z `alg: none`
odpada na sprawdzeniu algorytmu.

**Konfiguracja.** `ACCESS_TEAM_DOMAIN` i `ACCESS_AUD` w `[vars]` w `wrangler.toml`.
To **nie są sekrety** — bezpieczeństwo daje weryfikacja podpisu, nie tajność tych
wartości. Muszą być w pliku, a nie w dashboardzie, bo `wrangler deploy` skasowałby
zmienną, której w pliku nie ma. Krok po kroku: **`ZERO-TRUST.md`**.

**Ścieżka awaryjna.** Puste zmienne = tryb wewnętrzny wyłączony: `/internal` zwraca
**503 z listą brakujących zmiennych i odesłaniem do instrukcji**, nie milczące 403.
Odmowa dostępu i brak konfiguracji to dwie różne sytuacje i mają różne kody.

**Ograniczenie, które blokuje dokończenie etapu.** Access **nie obejmuje adresów
`*.workers.dev`** — aplikacje self-hosted buduje się z domen w koncie Cloudflare.
Worker chodzi dziś wyłącznie pod `knowbase-budmax.rezi7608.workers.dev`, więc
**etap 2 wymaga własnej domeny**. Do tego czasu `/internal` stoi na 503, a publiczny
widget działa niezależnie. Custom domain trzeba dopisać także do `wrangler.toml`
(`[[routes]]` z `custom_domain = true`), inaczej deploy ją zdejmie.

**`identity` z tokenu** — `email` i `domena` są odczytywane i przekazywane do
`handleAsk()`, które odsyła je w polu `zalogowany`. **Nic po nich jeszcze nie
filtruje.** To przygotowanie pod rozpoznawanie klienta przy wielu firmach.

**Test:** `node test-access.mjs` — 14 przypadków, w tym ważny token, obcy podpis,
nieznany `kid`, wygasły, obce `iss`, obce `aud`, `nbf` w przyszłości, `alg: none`
i obie ścieżki awaryjne. Podstawia własną parę kluczy w miejsce kluczy zespołu,
więc sprawdza także przypadek pozytywny bez klikania w panelu. Testuje funkcję
importowaną z `worker.js`, nie jej kopię.

## Separacja przestrzeni wiedzy — na poziomie danych, nie promptu

Indeks jest jeden, ale podzielony na **rozłączne przestrzenie nazw** (namespaces
w Vectorize): `public` (53 fragmenty z `CHUNKS`) i `internal` (`INTERNAL_CHUNKS`).

| Endpoint | Przeszukuje | Skąd bierze zakres |
|---|---|---|
| `POST /` | `public` | stała `SPACES_FOR_PUBLIC` |
| `POST /internal` | `public` + `internal` | stała `SPACES_FOR_INTERNAL` |

Pracownik widzi obie przestrzenie celowo — musi wiedzieć także to, co firma
obiecuje klientom.

**Dlaczego nie promptem.** Instrukcja „nie ujawniaj treści wewnętrznych" jest
sugestią dla modelu — działa, dopóki model współpracuje. Prompt injection,
nietypowe sformułowanie pytania albo nowa wersja modelu ją omijają. Filtr po
stronie bazy nie ma tej klasy podatności: fragmentu, którego baza nie zwróci,
model nie ma jak zacytować, bo nigdy go nie zobaczył.

**Dlaczego przestrzeń publiczna jest wpisana na sztywno.** Publiczny endpoint
nie przyjmuje nazwy przestrzeni **z żadnego źródła** — ani z ciała żądania, ani
z query stringa, ani z nagłówka. Gdyby przyjmował, cała separacja wisiałaby na
poprawności sprawdzenia autoryzacji, czyli na kodzie, w którym da się zrobić błąd.
Przy wpisaniu na sztywno **błąd w autoryzacji nadal nie otwiera** dostępu do
wiedzy wewnętrznej: widget nie ma czym o nią poprosić. `vectorSearch()` nie ma
wartości domyślnej dla przestrzeni i rzuca wyjątkiem przy nieznanej nazwie —
cicha zamiana na `public` byłaby dokładnie tym błędem, który kiedyś pokazałby
treść nie tej stronie.

**Pole `role` w metadanych** — na razie zawsze `"all"` i nic po nim nie filtruje.
Jest teraz, bo u klientów premium (kancelarie, medycyna) role będą konieczne,
a dopisanie pola później oznacza **ponowne indeksowanie u każdego klienta**.

### Wynik testu szczelności (17.08.2026)

Pytanie o marżę, na które odpowiedź istnieje wyłącznie w `INTERNAL_CHUNKS`:

| Kanał | Wynik |
|---|---|
| `POST /` (publiczny) | fallback, `gap: true`, `source: null` |
| `/debug?space=public` | najlepsze dopasowanie **0.406**, zero fragmentów z `internal` |
| `/debug?space=obie` | lider **0.743** „Widełki marży i granica negocjacji" `[internal]` |
| `POST /internal` bez klucza | HTTP 403 |
| `POST /internal` z kluczem | poprawna odpowiedź (22% / 14%) |

Publiczny retrieval pokazał sygnaturę „nic nie pasuje" (0.39–0.406, ściśnięta
grupa bez lidera) — czyli zachował się tak, jakby wiedzy wewnętrznej po prostu
nie było. Bo dla niego jej nie ma.

**Uwaga do doboru pytania testowego.** Drugie pytanie kontrolne (o szelki przy
pracy na wysokości) publiczny bot odpowiedział — i **słusznie**: fragment `c34`
„BHP i szkolenia pracowników" jest publiczny i zawiera tę informację. Pytanie
testowe musi dotyczyć treści obecnej **wyłącznie** w `INTERNAL_CHUNKS`, inaczej
nie testuje separacji, tylko dokumentację. Model odpowiedział zresztą tylko na
publicznie pokrytą część i wprost odmówił reszty.

## Granica dostawcy — model i baza wektorowa są wymienne

W `worker.js` jest sekcja **„GRANICA DOSTAWCY"**: obiekt `PROVIDER` (identyfikatory
modeli, wymiarowość, parametry generowania) plus pięć funkcji, które jako jedyne
dotykają `env.AI` i `env.VECTORIZE`:

| Funkcja | Kontrakt |
|---|---|
| `embed(env, texts)` | tablica tekstów → tablica wektorów, w kolejności wejścia |
| `generate(env, systemPrompt, messages, opts)` | → gotowy tekst odpowiedzi (system prompt składa funkcja) |
| `vectorSearch(env, vector, opts)` | → tablica dopasowań z `score`, `values` i `metadata` |
| `vectorUpsert(env, vectors, namespace)` | zapis do indeksu (`/reindex`) |
| `vectorDelete(env, ids)` | usunięcie z indeksu (`/purge`) |

`vectorSearch` wymaga `opts.namespaces` — nie ma wartości domyślnej. Vectorize
przeszukuje jedną przestrzeń na zapytanie, więc przy kilku robimy tyle zapytań
i scalamy wyniki po podobieństwie.

**`upsert`, nie `insert` — poprawka realnego błędu.** `insert` po cichu **pomija**
wektory o istniejącym ID, więc każda zmiana treści fragmentu nigdy nie docierała
do indeksu; działało tylko dodawanie nowych. Wyszło to przy przejściu na przestrzenie:
po pierwszym `upsert` w wynikach `/debug` pojawił się fragment „Serwis pogwarancyjny"
(0.570 przy pytaniu o elewacje), którego wcześniej nie było, a podobieństwo dla
„Ogrody i tereny zielone" skoczyło z 0.473 na 0.523. To były odsyłacze dopisane
w poprzednich sesjach, które **leżały w kodzie, ale nie w indeksie**.

Wniosek na przyszłość: pomiary progów robione przed 17.08.2026 mogły dotyczyć
częściowo nieaktualnego indeksu. Nie ma powodu ich przeliczać, ale nie traktować
ich jako dokładnych. `/reindex` jest teraz idempotentny i faktycznie odzwierciedla
`CHUNKS`.

**Dlaczego to istnieje.** Cloudflare wystarcza na dziś i na dziesiątki klientów,
ale ma dwie luki: brak gwarancji rezydencji danych w UE poza planem enterprise
oraz katalog modeli zmieniający się bez uprzedzenia — raz już nas to trafiło,
model został wycofany między sesjami. Segment premium (kancelarie, medycyna,
finanse) będzie wymagał hostingu w UE. Granica ma pozwolić obsłużyć takiego
klienta **tą samą bazą kodu, samą konfiguracją** — podmiana dostawcy to zmiana
`PROVIDER` i wnętrz tych funkcji, bez dotykania logiki RAG i weryfikacji.

**Czego nie wolno przez nią przepuszczać:**
- `env.AI` i `env.VECTORIZE` nie pojawiają się nigdzie poza tą sekcją. Kontrola:
  `grep -n "env\.AI\|env\.VECTORIZE\|@cf/" worker.js` — wszystkie trafienia muszą
  mieścić się w obrębie sekcji.
- Literał `@cf/...` żyje wyłącznie w `PROVIDER`.
- Kształt odpowiedzi dostawcy (`res.data`, `res.response`, `results.matches`)
  nie wychodzi na zewnątrz — funkcje zwracają zwykłe tablice i stringi.

`env` jest pierwszym argumentem każdej z nich, bo w Workerach bindingi żyją
per-request i nie ma do nich dostępu z zasięgu modułu. To jedyne odstępstwo od
kontraktu `embed(texts)` / `generate(...)` / `vectorSearch(...)` — wymuszone
przez platformę, nie przez wygodę.

`vectorUpsert` i `vectorDelete` nie były w pierwotnym zamyśle (miały być trzy
funkcje), ale bez nich `env.VECTORIZE` wyciekłoby do `/reindex` i `/purge`,
a granica z jednym wyjątkiem przestaje być granicą.

Refaktoryzacja z 17.08.2026 była **czysto strukturalna** — progi, prompt, `CHUNKS`
i logika weryfikacji bez zmian, zachowanie identyczne (potwierdzone porównaniem
wyników `/debug` przed i po).

## wrangler.toml jest źródłem prawdy

Deploy z CLI traktuje ten plik jako pełny opis Workera — **binding, którego tam nie ma,
zostaje usunięty z działającego Workera**. Dodając binding w dashboardzie, dopisz go
też tutaj, inaczej najbliższy `wrangler deploy` go zdejmie, a Worker wywali się
dopiero przy pierwszym zapytaniu.

`compatibility_date = "2026-08-04"` odwzorowuje stan sprzed przejścia na CLI.
**Nie podbijać przy okazji** — to zmiana zachowania runtime'u, nie porządki.
Tylko świadoma decyzja z powodem.

Sekretów w tym pliku nie ma i być nie może — przeżywają deploy niezależnie od niego.

## Jak się wdraża

Projekt jest pod kontrolą wersji i wdrażany z CLI. **Wcześniejszy sposób pracy —
wklejanie kodu do edytora w dashboardzie Cloudflare — jest nieaktualny.** Kod na
dysku jest źródłem prawdy; zmiana zrobiona w dashboardzie zostanie po cichu
nadpisana przy najbliższym deployu.

```
node --check worker.js          # przed każdym commitem
wrangler deploy --dry-run       # sprawdza bindingi bez wysyłki
wrangler deploy                 # wdrożenie
git push origin main            # remote na SSH (git@github.com:p0rk1/widgetAI.git)
```

Cofnięcie: `wrangler rollback` wraca do poprzedniej wersji, a
`wrangler versions deploy <id> --name knowbase-budmax` do dowolnej wcześniejszej.
Cloudflare trzyma poprzednie wersje, więc nieudany deploy jest odwracalny —
przed ryzykowną zmianą warto zanotować `Current Version ID` z wyjścia deployu.

Deploy nie rusza `index.html` ani `panel.html` — te idą na GitHub Pages przez
`git push`. Zmiana w widgecie wymaga pusha, nie deployu, i odwrotnie.

## Endpointy

Uprawnienia są **rozdzielone na dwa niezależne mechanizmy** — patrz „Tożsamość
i uprawnienia". Endpointy administracyjne chroni parametr `?key=` równy sekretowi
`REINDEX_SECRET` (sprawdza `isAdmin()`); `/internal` chroni tożsamość z Access.

- `POST /` — zapytanie z widgetu: `{question, history}`. Przeszukuje **wyłącznie
  przestrzeń `public`**, wpisaną na sztywno w routingu
- `POST /internal` — bot dla pracowników, przeszukuje `public` + `internal`.
  **Wyłącznie na tożsamości z Cloudflare Access** — `REINDEX_SECRET` tu nie działa
- `GET /reindex?key=…&space=public|internal` — **uruchom po każdej zmianie CHUNKS
  lub INTERNAL_CHUNKS**. Bez `space` indeksuje `public` (zgodnie z dotychczasowym
  zachowaniem). Każdą przestrzeń indeksuje się osobno
- `GET /stats?key=…` — dane dla panelu. Pytania z `/internal` są **odfiltrowane** —
  panel należy do właściciela firmy i dotyczy widgetu publicznego
- `GET /debug?key=…&q=pytanie&space=public|internal|obie` — diagnostyka: co znalazło,
  z jakim wynikiem, **z której przestrzeni**, które zdania przechodzą weryfikację.
  Bez `space` sprawdza `public`
- `GET /purge?key=…&ids=c01,c02` — usuwa wpisy z indeksu (ID są globalne, niezależne od przestrzeni)

## Jak działa przepływ zapytania

1. Pytanie + 2 ostatnie wypowiedzi użytkownika → embedding (`bge-m3`)
2. Vectorize zwraca `TOP_K` kandydatów z wektorami
3. Filtr jakości: odrzuca poniżej `MIN_SIMILARITY`, ale zawsze zostawia `MIN_CHUNKS`
4. Model generuje odpowiedź z fragmentów + historii rozmowy
5. **Weryfikacja zdanie po zdaniu** — każde zdanie osobno sprawdzane, zdania bez
   pokrycia są **wycinane**, nie odrzucają całej odpowiedzi
6. Zwrot: `{answer, source, gap, trimmed}`

## Warstwy zabezpieczeń — NIE USUWAĆ

Kolejno w `verifyClaims()` i funkcjach pomocniczych:

- **`numbersAreGrounded()`** — każda liczba w zdaniu musi dosłownie występować
  w pobranych fragmentach. To najważniejsze zabezpieczenie: łapie zmyślone ceny
  ("1500–3000 zł/m²") i terminy ("3–4 miesiące"), których weryfikacja semantyczna
  nie widziała, bo zdanie brzmiało poprawnie.
- **`isUnsupportablePromise()`** — obietnice, których dokumentacja nie może potwierdzić
  (wolne terminy, rabaty, "postaramy się zdążyć", niższy VAT). Ma wbudowany wyjątek
  dla zaprzeczeń i odesłań do biura — inaczej wycinało "nie oferujemy rabatów".
- **`leaksInstructions()`** — model czasem przepisuje instrukcje zamiast je wykonać
  ("Proszę mi powiedzieć, że…"). Wycinane.
- **`isDuplicate()`** — deduplikacja z przycinaniem polskich końcówek fleksyjnych
  ("wstępny kosztorys" ≈ "wstępna wycena").
- **`isConnectiveSentence()`** — zdania grzecznościowe przechodzą bez pokrycia,
  bo niczego nie obiecują.
- **`splitSentences()`** — chroni skróty (`m.in.`, `np.`) przed rozbiciem zdania
  i dzieli listy punktowane po nowej linii.

## Progi — kalibrowane empirycznie, nie zgadywane

```
TOP_K = 8              # 6 było za mało dla krótkich, ogólnych pytań
TOP_K_LONG = 10        # dla pytań ≥400 znaków (wielowątkowych)
MIN_SIMILARITY = 0.35
CITATION_THRESHOLD = 0.48   # 0.42 przepuszczało za dużo, 0.5 odrzucało poprawne parafrazy
```

Zmieniając progi, użyj `/debug` — pokazuje dokładne wyniki podobieństwa zamiast zgadywania.

## Dlaczego 70B

Test przeprowadzony 16.08.2026 na tym samym zestawie co wcześniej dla 8B:
10 pytań kontrolnych + dwie długie, wielowątkowe wiadomości klientów. Zmieniona
była **wyłącznie stała `MODEL_ID`** — progi, prompt i `TOP_K` bez zmian, żeby wynik
dało się przypisać modelowi, a nie kalibracji.

Zniknęły **wszystkie** halucynacje, które 8B generowało powtarzalnie:
- zmyślona cena za metr
- obietnica wolnych terminów
- potwierdzanie założeń klienta o rabatach i stawkach VAT
- wymyślony czas realizacji
- informacja o płatności z góry, sprzeczna z dokumentacją

Do tego czysta polszczyzna bez literówek i brak powtórzeń w obrębie jednej odpowiedzi.

**Wskaźnik mierzalny — liczba zdań wycinanych przez weryfikację:** 8B wycinało
1–3 zdania w praktycznie każdej długiej odpowiedzi, 70B wyciął 0 przy pierwszej
i 1 przy drugiej. Model generuje mniej treści bez pokrycia, więc weryfikacja ma
mniej pracy.

**Nieoczekiwany wynik:** przewidywaliśmy, że uległość wobec klienta (potwierdzanie
jego założeń) zostanie, bo to cecha trenowania, a nie rozmiaru. 70B pytania o VAT
i rabaty po prostu **przemilczało**, zamiast grzecznie potwierdzić.

**Wniosek:** warstwy weryfikacji zostają — działają niezależnie od modelu i to one
dają gwarancję, nie prawdopodobieństwo. Ale 70B rozwiązało problemy, których nie
dało się załatać kodem po czterech rundach prób. **Nie wracać do 8B.**

## Decyzje, do których nie wracać

- **Prawdziwy streaming SSE — wycofany.** Cloudflare buforował odpowiedź mimo
  `Content-Encoding: identity`, a weryfikacja po stronie serwera i tak wymaga całego
  tekstu. Zamiast tego animacja znak po znaku w przeglądarce (`typewriterReveal`).
- **Fine-tuning na dokumentach klienta — nie.** Zwiększa halucynacje, wymaga powtórzenia
  przy każdej zmianie cennika, miesza wiedzę klientów. RAG jest właściwą architekturą.
- **Ogród ≠ ogrodzenie** — rozdzielone strukturalnie: osobne fragmenty (`c42`, `c43`)
  z jawnym odsyłaczem do siebie nawzajem w treści, plus instrukcja w prompcie.
  Mylił je wielokrotnie model 8B. Rozdzielenie **zostaje mimo przejścia na 70B** —
  to poprawna struktura danych, nie proteza pod słabszy model.
- **Batching wszędzie** — Cloudflare ma limit 50 podzapytań na jedno wywołanie Workera.
  Reindeks idzie paczkami po 10, weryfikacja zdań jednym wywołaniem embeddingu.
- **Zwrot per Pan/Pani ustępuje jawnej prośbie klienta — i tak ma zostać.**
  W `STYL ODPOWIEDZI` jest reguła o uprzejmym dystansie i ona działa: przy zwykłym
  przedstawieniu się model odpowiada „Dzień dobry, Panie Kowalski", przy luźnym
  pytaniu bez imienia — bezosobowo. Ale gdy klient wprost napisze „mów mi po imieniu",
  model go posłucha („Cześć Marek"). **To jest zachowanie poprawne, nie usterka.**
  Preferencja co do formy zwracania się należy do klienta i nie naraża firmy na nic —
  inaczej niż zmyślona cena czy obiecany termin. Dlatego reguła tonu **świadomie
  została w `STYL ODPOWIEDZI`, a nie w `BEZWZGLĘDNE ZAKAZY`**, gdzie sformułowania
  trzymają się mocniej i nadpisałyby wolę klienta. Nie „naprawiać" tego przez
  przeniesienie wyżej ani dopisanie „także gdy klient prosi inaczej".

## Dokumentacja BudMax

53 fragmenty w tablicy `CHUNKS`, oparte na realnych przepisach:
art. 568 §1 KC (rękojmia 5 lat / 2 lata), WT2021 (izolacyjność), KSeF (obowiązkowy
od kwietnia 2026), program Czyste Powietrze (kwoty dofinansowania).

**Rękojmia i gwarancja to dwie różne instytucje** — rękojmia jest ustawowa i obowiązuje
zawsze, gwarancja jest dobrowolna. Mylił je model 8B, stąd osobny fragment `c46`
tłumaczący różnicę. Fragment zostaje — 70B trafia w to rozróżnienie samo z siebie
(„niezależnie od ustawowej rękojmi, udzielamy dodatkowej gwarancji umownej"),
ale to zasługa dobrej treści, nie powód, żeby ją usuwać.

Fragmenty zaczynają się od sformułowań, których używają pytający ("Gdzie działamy
i gdzie realizujemy budowy…"), nie tylko od języka oficjalnego dokumentu. To poprawia
trafność wyszukiwania i jest praktyką do powtórzenia u kolejnych klientów.

### Usługa brzmiąca wiarygodnie, której dokumentacja nie zawiera

Powtarzalny wzorzec, nie jednorazowy przypadek. Klient pyta o coś, co firma budowlana
oczywiście robi, ale czego w `CHUNKS` nie ma — model sięga wtedy po najbliższy
brzmieniowo fragment i odpowiada twierdząco na podstawie czegoś innego.

Znane wystąpienia:
- **Tarasy** — brak fragmentu, złapane wcześniej, zabezpieczone regułą w prompcie
  („nie zakładaj, że jest oferowany"). Fragmentu nadal nie ma.
- **Elewacje i docieplenia** — 17.08.2026, luka załatana fragmentem `c53`.

## Procedura łatania luk w dokumentacji

Sposób postępowania do powtórzenia, wypracowany na przypadku elewacji.

1. **Objaw** — sprzeczne odpowiedzi na to samo pytanie zadane różnie sformułowane,
   albo pytanie oznaczone w panelu jako luka.
2. **Diagnoza przez `/debug`** — ściśnięta grupa wyników bez wyraźnego lidera
   (elewacje przed poprawką: 0.43–0.48) oznacza **brak fragmentu**. Wyraźny lider
   (0.6–0.8) oznacza, że fragment jest, a problem leży gdzie indziej — w progach,
   prompcie albo treści fragmentu. Nie ruszaj progów przed tym rozstrzygnięciem.
3. **Poprawka** — nowy fragment zaczynający się od sformułowania pytającego,
   z jawnym rozgraniczeniem wobec sąsiednich fragmentów i odsyłaczem **w obie strony**
   (wzorzec ogród/ogrodzenie, patrz „Decyzje, do których nie wracać").
4. **Reindeks** — `/reindex?space=…`, bez tego indeks nie widzi nowego fragmentu.
   Odczekaj chwilę: zapis do Vectorize jest asynchroniczny.
5. **Weryfikacja przez `/debug`** — nowy fragment powinien odskoczyć od reszty
   **o co najmniej 0.1**. Elewacje po poprawce: 0.577 vs 0.482 (pytanie jednowyrazowe)
   i 0.739 vs 0.533 (pełne pytanie), odpowiedzi w obu wariantach identyczne merytorycznie.

**Przy usłudze nieobecnej w dokumentacji weryfikacja semantyczna nie jest ostatnią
linią obrony.** Przed poprawką model odpowiedział „tak, wykonujemy elewacje", cytując
fragment o wykończeniu wnętrz — z wynikiem 0.676, **powyżej `CITATION_THRESHOLD`**,
bo zdanie brzmi podobnie, mimo że dotyczy czego innego. To argument za kompletnością
dokumentacji, **nie za podnoszeniem progów**: próg, który odciąłby 0.676, odciąłby
też poprawne parafrazy.

## Znane ograniczenia

- ~~Model 8B generuje literówki po polsku ("z przyjemieniem")~~ — **nieaktualne
  od 16.08.2026**, zniknęło wraz z przejściem na 70B
- Wyniki wahają się między uruchomieniami przy tym samym pytaniu
- Wykrywanie obietnic wzorcami tekstowymi jest z natury zawodne — model wymyśla nowe
  sformułowania. Dokładanie kolejnych wzorców ma malejący zwrot.
- Panel chroni ten sam klucz co endpointy administracyjne — do produkcji potrzeba
  osobnego hasła i prawdziwego logowania

## Następne kroki

Kolejność jest celowa — uzasadnienie jest częścią decyzji, nie ozdobnikiem.

- ~~**Test 70B**~~ — ✅ **wykonane i rozstrzygnięte 16.08.2026.** Model zmieniony
  na stałe, szczegóły w sekcji „Dlaczego 70B". Nie otwierać ponownie.

1. **Bot dla pracowników** — drugi tryb: procedury BHP, kadry, instrukcje wykonania
   zadań. Ton instruktażowy, nie sprzedażowy. To druga połowa produktu, nie dodatek —
   i **stawka jest wyższa niż przy FAQ**: zmyślona odpowiedź o procedurze BHP szkodzi
   inaczej niż zmyślony termin realizacji.
   - ~~**Etap 1: separacja przestrzeni wiedzy**~~ — ✅ **wykonane 17.08.2026.**
     Namespaces `public`/`internal`, rozdzielone endpointy, `INTERNAL_CHUNKS`,
     pole `role`. Szczelność potwierdzona testem — patrz „Separacja przestrzeni wiedzy".
   - ~~**Etap 2: prawdziwe logowanie**~~ — ✅ **kod gotowy i wdrożony 17.08.2026.**
     Weryfikacja JWT z Zero Trust Access, sekret na `/internal` unieważniony.
     **Pozostaje konfiguracja w panelu** (`ZERO-TRUST.md`) — wymaga własnej domeny,
     bo Access nie obejmuje `workers.dev`. Do tego czasu `/internal` zwraca 503.
   - **Etap 3: ton instruktażowy** — `buildSystemPrompt()` jest wspólny dla obu
     endpointów i mówi o „stronie firmy". Świadomie nie ruszony w etapie 1,
     żeby zmiana pozostała czysto strukturalna.
   - **Etap 4: treść wewnętrzna** — `INTERNAL_CHUNKS` ma teraz 3 fragmenty
     testowe (marża, BHP, kadry), nie prawdziwą dokumentację.
2. **Druga branża** — kancelaria albo gabinet. Sprawdzenie, ile zabezpieczeń jest
   uniwersalnych, a ile to protezy pod budowlankę (wzorce mówią o rabatach
   w hurtowniach — u kancelarii groźne będą terminy przedawnienia i szanse wygranej).
   Ważne poznawczo, ale **nie blokuje sprzedaży** — dlatego po bocie dla pracowników.
3. **Skrypt osadzający** — Shadow DOM, jedna linijka `<script>` do wklejenia na
   dowolnej stronie klienta, izolacja stylów w obie strony.
4. **Multi-tenant** — dopiero przy 2-3 płacących klientach: D1 z tabelą klientów,
   namespaces w Vectorize per klient.

## Zasady pracy nad tym projektem

- Po każdej zmianie `CHUNKS` → `/reindex?space=public`; po zmianie `INTERNAL_CHUNKS`
  → `/reindex?space=internal`. Przestrzenie indeksuje się osobno
- **Zapis do Vectorize jest asynchroniczny.** Zapytanie zaraz po `/reindex` potrafi
  zwrócić pustkę albo częściowy indeks — to nie jest błąd separacji ani progów.
  Odczekaj i powtórz, zanim zaczniesz cokolwiek diagnozować. Kosztowało to jeden
  fałszywy alarm „regresja publicznego endpointu" 17.08.2026
- Przy zmianie progów → najpierw `/debug`, potem decyzja
- Przed commitem → `node --check worker.js`; przy zmianach w weryfikacji tokenu
  także `node test-access.mjs`
- `ALLOWED_ORIGIN` to sama domena bez ścieżki (`https://p0rk1.github.io`),
  bo przeglądarka wysyła w nagłówku Origin tylko protokół i host
- Nie dodawać warstw zabezpieczeń bez zmierzenia problemu na `/debug` —
  projekt ma za sobą kilka rund łatania objawów zamiast przyczyn

## Przepływ kontekstu

Projekt prowadzony jest w dwóch miejscach i **to rozdzielenie jest zamierzone**:

- **Decyzje architektoniczne, kierunek produktu i rozstrzyganie kompromisów** zapadają
  w rozmowie z Claude w przeglądarce, gdzie żyje pełna historia projektu — dlaczego
  coś odrzucono, co już próbowano, jakie były wyniki testów.
- **Wykonanie, zmiany w kodzie, deploy i operacje na repo** dzieją się tutaj,
  w Claude Code, który widzi rzeczywisty stan plików i infrastruktury.

**Ten plik jest jedynym pomostem między nimi.** Żadna z tych stron nie widzi historii
tej drugiej — poza tym, co tu zapisane.

Dlatego po każdej sesji, w której coś rozstrzygnięto, zapisz tu **wniosek i jego
uzasadnienie w jednym–dwóch zdaniach.** Nie proces dochodzenia, ale wystarczająco,
żeby za miesiąc nikt nie kwestionował decyzji ani nie zaczynał od nowa czegoś, co już
odrzucono. Rzeczy porzucone oznaczaj jawnie jako ślepe uliczki **z powodem**, zamiast
po cichu usuwać.

## Utrzymanie tego pliku

**Ten plik jest jedyną pamięcią projektu między sesjami.** Poza nim zostaje kod,
który mówi *co* robi, ale nie *dlaczego tak* ani *czego już próbowano*.

Po każdej sesji, w której zapadła decyzja architektoniczna, zmienił się stan
infrastruktury albo coś zostało odrzucone jako ślepa uliczka — **zaktualizuj go
i wypchnij na GitHub, zanim uznasz zadanie za skończone.** Aktualizacja jest
częścią zadania, nie sprzątaniem po nim.

Zapisuj **wnioski i zakazy, nie proces dochodzenia do nich.** „SSE wycofane, bo
Cloudflare buforuje" jest warte miejsca; relacja z debugowania nie jest. Dobry wpis
oszczędza następnej sesji powtórzenia ślepej uliczki — reszta to szum, który
rozcieńcza to, co ważne.

Martwe wartości, wycofane podejścia i obalone założenia zostawiaj **oznaczone jako
martwe**, nie usuwaj po cichu. Zniknięty zapis wraca jako ten sam błąd za trzy sesje.
