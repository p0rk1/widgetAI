# KnowBase — kontekst projektu

## Czym to jest

Bot FAQ oparty na RAG, odpowiadający wyłącznie na podstawie dokumentacji firmy —
nigdy nie zmyślając. Jeden z trzech produktów lokalnego SaaS-u dla polskich MŚP
(do ~50 osób). Pozostałe dwa robią wspólnicy: BizChat (Bartek — czat z rezerwacjami),
MailPilot (Michał — wtyczka do Gmaila/Outlooka, opublikowana w sklepie Microsoftu).

Aktualny stan: działające demo na fikcyjnej firmie budowlanej **BudMax Sp. z o.o.**

**Ten plik trzyma stan, reguły i następne kroki. Uzasadnienia, wyniki pomiarów
i ślepe uliczki mieszkają w [`DECYZJE.md`](DECYZJE.md)** — czytanym wybiórczo,
na żądanie, po nagłówkach. Rozdzielone 19.08.2026, bo ten plik wczytuje się przy
każdej sesji, a historia decyzji jest potrzebna kilka razy w miesiącu.

## Stan na 19.08.2026 — zacznij stąd

**Co działa w produkcji:**
- Publiczny bot FAQ — 53 fragmenty, weryfikacja zdanie po zdaniu, model 70B
- Bot dla pracowników — 41 fragmentów w sześciu obszarach, osobny prompt, za Access
- Trzy adresy odpowiadają: `budmax.know-base.app`, `budmax-wewnetrzny.know-base.app`,
  stary `knowbase-budmax.rezi7608.workers.dev`
- Separacja przestrzeni `public` / `internal` w Vectorize, szczelność przetestowana
- Tryb wewnętrzny na tożsamości z Cloudflare Access, pełna ścieżka potwierdzona
  pomiarem na żywo prawdziwym tokenem (18.08.2026)

**Ostatnie trzy sesje, w skrócie:**

| Data | Co | Gdzie szczegóły |
|---|---|---|
| 17.08 | Granica dostawcy, separacja przestrzeni, Access, własna domena | `DECYZJE.md` |
| 18.08 | Aplikacja Access skonfigurowana, tryb wewnętrzny domknięty pomiarem | `DECYZJE.md` → Cloudflare Access |
| 19.08 | Rozdzielony prompt, **41 fragmentów treści wewnętrznej**, rozdzielone pliki | `DECYZJE.md` → Prompty, Treść wewnętrzna |

**Gdzie jesteśmy:** treści nie brakuje już nigdzie — pomiar na 20 pytaniach nie
znalazł ani jednej luki dokumentacyjnej. Otwarte jest **pięć problemów z pomiaru**,
żaden nie dotyczy treści (próg weryfikacji kontra krótkie zdania wyliczeń,
`isUnsupportablePromise()` nieznający trybu, ściśnięte grupy na stykach obszarów,
niepełna odpowiedź na pytanie wieloczęściowe, ton rozkazujący narzucony fragmentowi
opisowemu). Liczby i przypadki: `DECYZJE.md` → „Treść wewnętrzna".

**Zostało po stronie właściciela, nie kodu:** kroki 2 i 3 z `ZERO-TRUST.md`
(Google i Microsoft jako metody logowania). Dziś działa wyłącznie One-time PIN —
wystarcza do testów i jednego użytkownika, nie wystarcza dla zespołu klienta.

**Trzy rzeczy, które łatwo popsuć nieświadomie:**
1. Wyłączenie `workers_dev` zerwie widget i panel — mają stary adres wpisany
   na sztywno w `WORKER_URL`
2. Binding albo trasa, których nie ma w `wrangler.toml`, znikają przy deployu
3. `/reindex` po każdej zmianie treści — i odczekać, zapis do Vectorize jest
   asynchroniczny

## Pliki

| Plik | Co to | Gdzie żyje |
|---|---|---|
| `worker.js` | Backend — RAG, weryfikacja, prompty, tożsamość, routing | Cloudflare Worker `knowbase-budmax` |
| `content-public.js` | `CHUNKS` — 53 fragmenty publiczne | importowane przez `worker.js` |
| `content-internal.js` | `INTERNAL_CHUNKS` — 41 fragmentów wewnętrznych | importowane przez `worker.js` |
| `index.html` | Strona firmy z osadzonym widgetem | GitHub Pages |
| `panel.html` | Panel analityczny dla właściciela firmy | GitHub Pages |
| `wrangler.toml` | Konfiguracja deployu — bindingi, zmienne Access, data kompatybilności | repo |
| `DECYZJE.md` | Uzasadnienia, wyniki pomiarów, ślepe uliczki | repo, czytane na żądanie |
| `ZERO-TRUST.md` | Instrukcja konfiguracji logowania do trybu wewnętrznego | repo |
| `test-access.mjs` | Test weryfikacji tokenu Access (`node test-access.mjs`) | repo |

**Treść jest w osobnych plikach od 19.08.2026** — stanowiła ponad połowę wagi
`worker.js`, a zadanie dotyczące logiki nigdy jej nie potrzebuje. Bundler
(esbuild w wranglerze) skleja wszystko z powrotem przy deployu: `main` w
`wrangler.toml` bez zmian, rozmiar uploadu i czas startu bez zmian.

Adresy:
- Publiczny: `https://budmax.know-base.app` — endpoint widgetu
- Wewnętrzny: `https://budmax-wewnetrzny.know-base.app` — bot dla pracowników, za Access
- Stary: `https://knowbase-budmax.rezi7608.workers.dev` — **nadal działa i ma działać**
- Strona: `https://p0rk1.github.io/widgetAI/` · Panel: `.../panel.html`

Dwa hosty na klienta, jednopoziomowe, bez wildcardu — powody w `DECYZJE.md`
→ „Adresy i domeny". Nowy klient to dwa wpisy w `[[routes]]` plus jego domeny
w `ALLOWED_ORIGINS` (lista samych domen bez ścieżek, w `worker.js`).

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
- Generowanie: `@cf/meta/llama-3.3-70b-instruct-fp8-fast` (od 16.08.2026 — powód w `DECYZJE.md` → „Dlaczego 70B")
- Embeddingi: `@cf/baai/bge-m3` (1024 wymiary — musi zgadzać się z indeksem)

Poprzednio `@cf/meta/llama-3.1-8b-instruct-fast`. **Nie wracać do 8B** — powód w `DECYZJE.md` → „Dlaczego 70B".

**Uwaga:** katalog modeli Cloudflare zmienia się bez uprzedzenia. Jeśli Worker
zwraca błąd połączenia z modelem, najpierw sprawdź
`https://developers.cloudflare.com/workers-ai/models/` czy model nie został wycofany.

## Tożsamość i uprawnienia

Dwa rozłączne mechanizmy, celowo.

| Endpoint | Kto | Czym się uwierzytelnia |
|---|---|---|
| `POST /` | każdy | — |
| `POST /internal` | pracownik | tożsamość z Cloudflare Zero Trust Access |
| `/reindex`, `/purge`, `/stats`, `/debug` | administrator | `REINDEX_SECRET` |

- **`REINDEX_SECRET` na `/internal` nie działa** i nie ma tam ścieżki obejścia.
- `verifyAccessJwt()` sprawdza **podpis, `iss`, `aud` i ważność** — sama obecność
  nagłówka `Cf-Access-Jwt-Assertion` nic nie znaczy, bo dopisze go każdy, kto
  ominie Access.
- `ACCESS_TEAM_DOMAIN = "knowbase.cloudflareaccess.com"` i `ACCESS_AUD` w `[vars]`
  w `wrangler.toml`. To **nie są sekrety**. **Nie „poprawiać" domeny zespołu na to,
  co pokazuje ekran logowania** — powód w `DECYZJE.md` → „Cloudflare Access".
- Puste zmienne = tryb wewnętrzny wyłączony: `/internal` zwraca **503 z listą
  braków**, nie milczące 403.
- Na hoście wewnętrznym żądanie bez sesji **nie dochodzi do Workera** — Access
  odsyła 302 na ekran logowania. Kody Workera (401) widać tylko na `workers.dev`.
- `/internal` na `workers.dev` **nigdy nie zadziała** — to poprawne fail-closed,
  nie usterka.
- `email` i `domena` z tokenu są odczytywane i zwracane w polu `zalogowany`.
  **Nic po nich jeszcze nie filtruje** — to fundament pod multi-tenant.

**Test:** `node test-access.mjs` — 14 przypadków, podstawia własne klucze,
więc sprawdza także przypadek pozytywny. Uruchamiać po każdej zmianie
w weryfikacji tokenu.

## Separacja przestrzeni wiedzy

Jeden indeks, **rozłączne przestrzenie nazw** w Vectorize.

| Endpoint | Przeszukuje | Skąd bierze zakres |
|---|---|---|
| `POST /` | `public` | stała `SPACES_FOR_PUBLIC` |
| `POST /internal` | `public` + `internal` | stała `SPACES_FOR_INTERNAL` |

Pracownik widzi obie przestrzenie celowo — musi wiedzieć także to, co firma
obiecuje klientom.

**Twarde reguły, których nie wolno rozluźnić:**
- Nazwa przestrzeni **nie przychodzi z żądania** — ani z ciała, ani z query,
  ani z nagłówka. Jest wpisana na sztywno w routingu.
- `vectorSearch()` nie ma wartości domyślnej dla przestrzeni i **rzuca wyjątkiem**
  przy nieznanej nazwie. Cicha zamiana na `public` byłaby dokładnie tym błędem,
  który kiedyś pokazałby treść nie tej stronie.
- Separacja stoi **na danych, nie na prompcie**. Uzasadnienie i wynik testu
  szczelności: `DECYZJE.md` → „Separacja przestrzeni wiedzy".
- Pole `role` w metadanych jest zawsze `"all"` i nic po nim nie filtruje — jest
  teraz, bo dopisanie go później oznacza reindeks u każdego klienta.

## Prompty — dwa tryby, jeden rdzeń rzetelności

`buildSystemPrompt(contextChunks, tryb)` jest **rozdzielaczem** na
`buildPublicSystemPrompt()` i `buildInternalSystemPrompt()`.

| Tryb | Kto pyta | Skąd bierze się tryb |
|---|---|---|
| `publiczny` | klient na stronie firmy | `trybPromptu(askedFrom)` w `handleAsk()` |
| `wewnetrzny` | zweryfikowany pracownik | to samo — `askedFrom` to `SPACE_INTERNAL` |

**Reguły, które łatwo złamać przy edycji:**
- `trybPromptu()` **nie ma wartości domyślnej i rzuca wyjątkiem** — tryb przychodzi
  wyłącznie z routingu, nigdy z ciała żądania.
- Regułę rzetelności dopisuje się do **`PROMPT_RDZEN`**, nie do jednego z wariantów —
  inaczej tryby się rozjadą i za trzy sesje nikt nie będzie wiedział, który jest wzorcem.
- **Zdanie o braku informacji musi zostać dosłowne w obu trybach.** `handleAsk()`
  rozpoznaje brak odpowiedzi wyrażeniem `/nie mam takich informacji/i` na surowym
  tekście modelu. Inne sformułowanie po cichu rozjeżdża tę ścieżkę.
- **Publicznego promptu nie rusza się przy okazji zmian w wewnętrznym** — jest
  kalibrowany od wielu sesji.
- `/debug` pokazuje w polu `tryb_promptu`, który wariant poszedł do modelu.

Co zmienia wariant wewnętrzny i jak został skalibrowany: `DECYZJE.md` → „Prompty".

## Granica dostawcy — model i baza wektorowa są wymienne

W `worker.js` sekcja **„GRANICA DOSTAWCY"**: obiekt `PROVIDER` plus pięć funkcji,
które jako jedyne dotykają `env.AI` i `env.VECTORIZE`.

| Funkcja | Kontrakt |
|---|---|
| `embed(env, texts)` | tablica tekstów → tablica wektorów, w kolejności wejścia |
| `generate(env, systemPrompt, messages, opts)` | → gotowy tekst odpowiedzi |
| `vectorSearch(env, vector, opts)` | → tablica dopasowań z `score`, `values`, `metadata` |
| `vectorUpsert(env, vectors, namespace)` | zapis do indeksu (`/reindex`) |
| `vectorDelete(env, ids)` | usunięcie z indeksu (`/purge`) |

**Czego nie wolno przez nią przepuszczać:**
- `env.AI` i `env.VECTORIZE` nie pojawiają się nigdzie poza tą sekcją. Kontrola:
  `grep -n "env\.AI\|env\.VECTORIZE\|@cf/" worker.js` — wszystkie trafienia muszą
  mieścić się w jej obrębie.
- Literał `@cf/...` żyje wyłącznie w `PROVIDER`.
- Kształt odpowiedzi dostawcy (`res.data`, `res.response`, `results.matches`)
  nie wychodzi na zewnątrz.
- `vectorSearch` wymaga `opts.namespaces` — bez wartości domyślnej.

Po co to istnieje i dlaczego `upsert`, a nie `insert`: `DECYZJE.md` → „Granica dostawcy".

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

Projekt jest pod kontrolą wersji i wdrażany z CLI. Kod na dysku jest źródłem
prawdy; zmiana zrobiona w dashboardzie zostanie po cichu nadpisana.

```
node --check worker.js          # ...i to samo na content-public.js
node --check content-public.js  #    oraz content-internal.js
node --check content-internal.js
wrangler deploy --dry-run       # bunduje moduły i sprawdza bindingi bez wysyłki
wrangler deploy                 # wdrożenie
git push origin main            # remote na SSH (git@github.com:p0rk1/widgetAI.git)
```

**`node --check worker.js` sam w sobie już nie wystarcza** — sprawdza jeden plik
i nie złapie błędu w module treści ani literówki w ścieżce importu. Te łapie
dopiero `wrangler deploy --dry-run`, który bunduje całość. Przy zmianach
w weryfikacji tokenu dochodzi `node test-access.mjs`.

Cofnięcie: `wrangler rollback` wraca do poprzedniej wersji, a
`wrangler versions deploy <id> --name knowbase-budmax` do dowolnej wcześniejszej.
Przed ryzykowną zmianą warto zanotować `Current Version ID` z wyjścia deployu.

Deploy nie rusza `index.html` ani `panel.html` — te idą na GitHub Pages przez
`git push`. Zmiana w widgecie wymaga pusha, nie deployu, i odwrotnie.

## Endpointy

Uprawnienia są **rozdzielone na dwa niezależne mechanizmy** — patrz sekcja
„Tożsamość i uprawnienia" wyżej. Endpointy administracyjne chroni parametr
`?key=` równy sekretowi `REINDEX_SECRET` (sprawdza `isAdmin()`); `/internal` chroni tożsamość z Access.

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
  z jakim wynikiem, **z której przestrzeni**, które zdania przechodzą weryfikację
  i **w polu `tryb_promptu`, który wariant promptu poszedł do modelu**
  (`internal`/`obie` → wewnętrzny). Bez `space` sprawdza `public`
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

## Ślepe uliczki — nie otwierać ponownie

Same tytuły; powód każdej w `DECYZJE.md` → „Decyzje, do których nie wracać".
Lista jest tutaj, bo zniknięty zapis wraca jako ten sam błąd za trzy sesje.

- **Prawdziwy streaming SSE** — wycofany, Cloudflare buforuje
- **Fine-tuning na dokumentach klienta** — nie, RAG jest właściwą architekturą
- **Powrót do modelu 8B** — nie, wszystkie halucynacje 8B wróciłyby razem z nim
- **Łączenie ogrodu z ogrodzeniem** — rozdzielone strukturalnie, zostaje
- **Jeden host z Access na ścieżce `/internal`** — odrzucone na rzecz dwóch hostów
- **Wildcard `*.know-base.app` w trasach** — dopiero po multi-tenant
- **Sekret jako wejście do `/internal`** — unieważniony, nie przywracać
- **Filtrowanie treści wewnętrznej instrukcją w prompcie** — separacja stoi na danych
- **Podnoszenie progów zamiast uzupełniania dokumentacji** — odcina poprawne parafrazy
- **Przenoszenie reguły tonu do `BEZWZGLĘDNE ZAKAZY`** — nadpisałaby wolę klienta
- **Wartości `budmax-reindex-2026` i `gieldowa1q2w3e`** — martwe i spalone,
  nie używać nawet jako przykładów

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
   (wzorzec ogród/ogrodzenie, `DECYZJE.md` → „Decyzje, do których nie wracać").
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
  osobnego hasła i prawdziwego logowania. **Uwaga: `/internal` już z tego wyszedł
  (Access), panel nie.** Właściciel firmy nadal dostaje klucz, który otwiera też
  `/purge` i `/reindex` — ten sam problem, który rozwiązaliśmy dla pracowników,
  zostaje nierozwiązany dla klienta
- ~~`INTERNAL_CHUNKS` to 3 fragmenty testowe, nie dokumentacja~~ — **nieaktualne
  od 19.08.2026**: 41 fragmentów w sześciu obszarach. Otwarte pozostają problemy
  z pomiaru, nie brak treści — patrz `DECYZJE.md` → „Treść wewnętrzna"
- **Weryfikacja zdanie po zdaniu wycina krótkie zdania wyliczeń** — próg
  `CITATION_THRESHOLD = 0.48` odcina zdania w rodzaju „okulary ochronne" (0.359),
  bo krótki tekst ma niskie podobieństwo do długiego fragmentu **niezależnie od
  tego, czy jest w nim zawarty**. Dotyka trybu wewnętrznego mocniej, bo to jego
  prompt każe wypisywać kroki w osobnych liniach. Zmierzone 19.08.2026, nienaprawione
- **`isUnsupportablePromise()` nie zna trybu** — wzorzec od rabatów wycina zdania,
  które w trybie wewnętrznym są poprawne („Przysługuje ci rabat do 3 procent").
  Warstwa powstała dla bota publicznego i nie odróżnia obietnicy złożonej klientowi
  od informacji podanej pracownikowi. Nienaprawione
- ~~**Tryb wewnętrzny odpowiada ostrożnie jak klientowi**~~ — **nieaktualne
  od 19.08.2026**, rozwiązane osobnym promptem wewnętrznym (`DECYZJE.md` → „Prompty"). Pomiar kontrolny: to samo pytanie zwraca teraz 22% **i** 14%

## Następne kroki

Kolejność jest celowa — uzasadnienie jest częścią decyzji, nie ozdobnikiem.

- ~~**Test 70B**~~ — ✅ **wykonane i rozstrzygnięte 16.08.2026.** Model zmieniony
  na stałe, szczegóły w `DECYZJE.md` → „Dlaczego 70B". Nie otwierać ponownie.

1. **Bot dla pracowników** — drugi tryb: procedury BHP, kadry, instrukcje wykonania
   zadań. Ton instruktażowy, nie sprzedażowy. To druga połowa produktu, nie dodatek —
   i **stawka jest wyższa niż przy FAQ**: zmyślona odpowiedź o procedurze BHP szkodzi
   inaczej niż zmyślony termin realizacji.
   - ~~**Etap 1: separacja przestrzeni wiedzy**~~ — ✅ **wykonane 17.08.2026.**
     Namespaces `public`/`internal`, rozdzielone endpointy, `INTERNAL_CHUNKS`,
     pole `role`. Szczelność potwierdzona testem — patrz `DECYZJE.md` → „Separacja przestrzeni wiedzy".
   - ~~**Etap 2: prawdziwe logowanie**~~ — ✅ **zamknięte w całości 18.08.2026,
     łącznie z konfiguracją.** Kod z 17.08.2026 (`f2d8a78`), aplikacja Access
     i `[vars]` z 18.08.2026, sekret na `/internal` unieważniony. **Pełna ścieżka
     przetestowana na żywo** prawdziwym tokenem z logowania — nie tylko odmowy.
     Nie otwierać ponownie. Podpięcie Google i Microsoft obok One-time PIN
     (`ZERO-TRUST.md`, kroki 2–3) zostaje jako konfiguracja dostawców tożsamości —
     **nie blokuje etapu 3** i niczego nie zmienia w kodzie.
   - ~~**Etap 3, warstwa 1: osobny prompt wewnętrzny**~~ — ✅ **wykonane
     19.08.2026.** Rozdzielacz `buildSystemPrompt(chunks, tryb)`, wspólny
     `PROMPT_RDZEN`, publiczny nietknięty (sprawdzone bajt w bajt).
     Skalibrowany na trzech fragmentach testowych — patrz `DECYZJE.md` → „Prompty".
   - ~~**Etap 3, warstwa 2: treść wewnętrzna**~~ — ✅ **napisana 19.08.2026.**
     41 fragmentów w sześciu obszarach, wdrożone i przeindeksowane. Treści
     **nie brakuje już nigdzie** — pomiar na 20 pytaniach nie znalazł ani jednej
     luki dokumentacyjnej.
   - **Etap 4: domknięcie problemów z pomiaru** — pięć rzeczy, żadna nie dotyczy
     treści: próg weryfikacji kontra krótkie zdania wyliczeń, `isUnsupportablePromise()`
     nieznający trybu, ściśnięte grupy na stykach obszarów, niepełna odpowiedź na
     pytanie wieloczęściowe mimo obu fragmentów w kontekście, oraz ton rozkazujący
     narzucony fragmentowi opisowemu. Liczby i przypadki w `DECYZJE.md` → „Treść wewnętrzna". **Kolejność napraw nierozstrzygnięta.**
2. **Druga branża** — kancelaria albo gabinet. Sprawdzenie, ile zabezpieczeń jest
   uniwersalnych, a ile to protezy pod budowlankę (wzorce mówią o rabatach
   w hurtowniach — u kancelarii groźne będą terminy przedawnienia i szanse wygranej).
   Ważne poznawczo, ale **nie blokuje sprzedaży** — dlatego po bocie dla pracowników.
3. **Skrypt osadzający** — Shadow DOM, jedna linijka `<script>` do wklejenia na
   dowolnej stronie klienta, izolacja stylów w obie strony.
4. **Multi-tenant** — dopiero przy 2-3 płacących klientach: D1 z tabelą klientów,
   namespaces w Vectorize per klient.

   Część fundamentu jest już położona, świadomie i wcześniej, niż wynikałoby
   z kolejności — bo dopisanie tego później kosztowałoby migrację u każdego klienta:
   - pole `role` w metadanych fragmentów (dziś zawsze `"all"`, nic nie filtruje)
   - `email` i `domena` odczytywane ze zweryfikowanego tokenu Access
   - host per klient, który da się odczytać z żądania
   - `ALLOWED_ORIGINS` jako lista

   Czego brakuje: mapy `host → klient`, mapy `host → AUD` (dziś jedna wartość
   `ACCESS_AUD`), i odmowy dla nieznanego hosta. Do tego czasu **żadnego
   wildcardu w trasach** — Worker jest jednodzierżawny.

## Zasady pracy nad tym projektem

- Po każdej zmianie `CHUNKS` → `/reindex?space=public`; po zmianie `INTERNAL_CHUNKS`
  → `/reindex?space=internal`. Przestrzenie indeksuje się osobno
- **Zapis do Vectorize jest asynchroniczny.** Zapytanie zaraz po `/reindex` potrafi
  zwrócić pustkę albo częściowy indeks — to nie jest błąd separacji ani progów.
  Odczekaj i powtórz, zanim zaczniesz cokolwiek diagnozować. Kosztowało to jeden
  fałszywy alarm „regresja publicznego endpointu" 17.08.2026
- Przy zmianie progów → najpierw `/debug`, potem decyzja
- Przed commitem → `node --check` na **wszystkich** plikach źródłowych plus
  `wrangler deploy --dry-run`; przy zmianach w weryfikacji tokenu także
  `node test-access.mjs`
- `ALLOWED_ORIGINS` to lista samych domen bez ścieżek. Nowy klient = nowe wpisy
- Nie dodawać warstw zabezpieczeń bez zmierzenia problemu na `/debug` —
  projekt ma za sobą kilka rund łatania objawów zamiast przyczyn

### Oszczędzanie kontekstu — obowiązuje od 19.08.2026

Sesje robiły się kosztowne, bo każde zadanie wciągało cały `worker.js` i cały
`CLAUDE.md`, choć potrzebny był fragment. Stąd rozdzielenie plików i te dwie reguły:

- **Przy zadaniu o konkretnej funkcji wczytuj tylko jej fragment, nie cały plik.**
  Najpierw `grep -n "nazwa_funkcji" worker.js`, potem odczyt zakresu linii. `worker.js`
  ma ponad 1100 linii i prawie żadne zadanie nie potrzebuje ich wszystkich naraz.
  To samo dotyczy `DECYZJE.md` — czytaj po nagłówkach, nie w całości.
- **Duże przebiegi diagnostyczne zapisuj do pliku i czytaj wybiórczo.** Dwudziestu
  odpowiedzi `/debug` nie trzyma się w kontekście: skrypt zapisuje surowy JSON
  do scratchpada i wypisuje jedną linię podsumowania na pytanie, a szczegóły
  wyciąga się potem tylko dla przypadków, które wyglądają podejrzanie.
- Treść fragmentów edytuje się w `content-*.js`, nie w `worker.js` — to jedyny
  powód, dla którego 60 KB treści miałoby wejść do kontekstu.

## Przepływ kontekstu

Projekt prowadzony jest w dwóch miejscach i **to rozdzielenie jest zamierzone**:

- **Decyzje architektoniczne i kierunek produktu** zapadają w rozmowie z Claude
  w przeglądarce, gdzie żyje pełna historia projektu.
- **Wykonanie, zmiany w kodzie, deploy i operacje na repo** dzieją się tutaj,
  w Claude Code, który widzi rzeczywisty stan plików i infrastruktury.

**`CLAUDE.md` i `DECYZJE.md` są jedynym pomostem między nimi.** Żadna z tych
stron nie widzi historii tej drugiej — poza tym, co tam zapisane.

## Utrzymanie tych plików

**To jedyna pamięć projektu między sesjami.** Poza nią zostaje kod, który mówi
*co* robi, ale nie *dlaczego tak* ani *czego już próbowano*.

Podział jest prosty i trzeba go pilnować, inaczej `CLAUDE.md` znów spuchnie:

| Do `CLAUDE.md` | Do `DECYZJE.md` |
|---|---|
| stan, reguła, zakaz, procedura | dlaczego tak, co odrzucono, wynik pomiaru |
| to, co jest potrzebne w każdej sesji | to, co jest potrzebne przy podważaniu decyzji |
| krótko, listą | pełnym zdaniem, z liczbami |

Po każdej sesji, w której zapadła decyzja architektoniczna, zmienił się stan
infrastruktury albo coś zostało odrzucone jako ślepa uliczka — **zaktualizuj
właściwy plik i wypchnij na GitHub, zanim uznasz zadanie za skończone.**
Aktualizacja jest częścią zadania, nie sprzątaniem po nim.

Zapisuj **wnioski i zakazy, nie proces dochodzenia do nich.** Martwe wartości,
wycofane podejścia i obalone założenia zostawiaj **oznaczone jako martwe**,
nie usuwaj po cichu.
