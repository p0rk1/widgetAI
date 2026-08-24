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

## Stan na 22.08.2026 — zacznij stąd

**Co działa w produkcji:**
- Publiczny bot FAQ — 53 fragmenty, weryfikacja zdanie po zdaniu, model 70B
- Bot dla pracowników — **44 fragmenty** w sześciu obszarach, osobny prompt, za Access
- **Eskalacja** — trzeci stan odpowiedzi przy wypadku, zagrożeniu życia, sporze
  prawnym, kontroli i decyzji finansowej powyżej progu: kroki z dokumentacji
  **plus** skierowanie do przełożonego, oznaczone osobnym polem w JSON
- Trzy adresy odpowiadają: `budmax.know-base.app`, `budmax-pracownik.know-base.app`,
  stary `knowbase-budmax.rezi7608.workers.dev`
- Separacja przestrzeni `public` / `internal` w Vectorize, szczelność przetestowana
- Tryb wewnętrzny na tożsamości z Cloudflare Access, pełna ścieżka potwierdzona
  pomiarem na żywo prawdziwym tokenem (18.08.2026)
- **Wymiar klienta** — `KLIENCI` w `klienci.js`, klient wynika z hosta tak samo
  jak rola. Przestrzeń w Vectorize, treść, prompty, eskalacja, wzorce obietnic
  i nazwy w interfejsach są zależne od klienta. Nieznany host dostaje 404
- **Drugi klient: kancelaria** — 26 fragmentów publicznych, 25 wewnętrznych,
  9 kategorii eskalacji, obie przestrzenie zaindeksowane. **Trzy trasy w `wrangler.toml` są od 24.08.2026**, ale
  **obie aplikacje Access istnieją, AUD-y wpisane (24.08.2026)** — wszystkie
  trzy hosty odpowiadają jak u BudMaksu: publiczny 405 na GET, pracowniczy
  i właścicielski 302 na ekran logowania

**Ostatnie sesje, w skrócie:**

| Data | Co | Gdzie szczegóły |
|---|---|---|
| 17.08 | Granica dostawcy, separacja przestrzeni, Access, własna domena | `DECYZJE.md` |
| 18.08 | Aplikacja Access skonfigurowana, tryb wewnętrzny domknięty pomiarem | `DECYZJE.md` → Cloudflare Access |
| 19.08 | Rozdzielony prompt, **41 fragmentów treści wewnętrznej**, rozdzielone pliki | `DECYZJE.md` → Prompty, Treść wewnętrzna |
| 20.08 | Etapy 5 i 6 (aplikacja, panel wewnętrzny), naprawa `isDuplicate()` | `DECYZJE.md` → Deduplikacja, Interfejsy pracownicze |
| 20.08 | **Trzy zmiany cofnięte**, nowa diagnoza problemu 4, przypięcie `/app` i `/panel` | `DECYZJE.md` → Problem 4 |
| 20.08 | **Uziemienie liczb po trybie (R3)** — defekt zamknięty wewnętrznie, publicznie zostaje | `DECYZJE.md` → Uziemienie liczb (R3) |
| 21.08 | Panel właściciela na Access (trzeci host), problem 4 i defekt publiczny zamknięte | `DECYZJE.md` → Panel właściciela na Access |
| 21.08 | **Zmiana nazw hostów**, koniec dopasowania po podciągu | `DECYZJE.md` → Zmiana nazw hostów |
| 21.08 | Test na realnych pytaniach: homonimy w eskalacji, rzeczowniki urazowe, 3 nowe fragmenty | `DECYZJE.md` → Test na realnych pytaniach |
| 22.08 | **Etap 1 drugiej branży: wybór klienta przez host**, słowniki branżowe wyjęte z silnika | `DECYZJE.md` → Wybór klienta: host, nie parametr |
| 22.08 | **Etap 2: treść kancelarii** (24+25 fragmentów, własny słownik eskalacji), pomiar na 40 pytaniach | `DECYZJE.md` → Kancelaria — pomiar na 40 pytaniach |
| 22.08 | **Naprawy 1–4 z mapy**: ramka bezpieczeństwa, liczebniki słowne, odmowa z uzasadnieniem, treść `k18`–`k20` | `DECYZJE.md` → Naprawy po mapie kancelarii |
| 23.08 | **Ton: granica, nie naprawa** — rewriter form odrzucony; `k25` (przemoc domowa) napisany bezosobowo, sonda w repo | `DECYZJE.md` → Poprawianie form adresatywnych, Fragment `k25` |
| 24.08 | **Motyw jako pole klienta** + treść interfejsu wyprowadzona z plików, trasy i AUD-y kancelarii | `DECYZJE.md` → Motyw jako pole klienta |

**Gdzie jesteśmy:** treści nie brakuje nigdzie, a z pięciu problemów z pomiaru
**trzy są naprawione** (próg zależny od długości zdania z cytatem dosłownym,
warstwy weryfikacji znające tryb, prompt niewymuszający listy kroków przy
fragmencie opisowym), **czwarty — `isDuplicate()` — naprawiony 20.08.2026**.
Problem ściśniętych grup zostawiony świadomie.

**Piąty — `numbersAreGrounded()` — zamknięty wewnętrznie 20.08.2026** wariantem
R3 (liczba z pytania uziemia zdanie tylko w trybie wewnętrznym). Wycięcia 13/40 →
**3/37**, odpowiedzi zredukowanych do samej linii `Podstawa:` 7/16 → **1/16**.
**Publicznie defekt zostaje otwarty świadomie** — tam liczba z pytania nigdy nie
będzie uziemiać. R3 stoi na zachowaniu modelu, nie na gwarancji strukturalnej:
**przy zmianie modelu albo promptu wewnętrznego trzeba go przemierzyć.**

**Nic nie zostaje otwarte z mapy pięciu problemów.** Oba ostatnie punkty
zamknięte 21.08.2026:
- ~~`numbersAreGrounded()` w trybie **publicznym**~~ — **zostaje bez zmian**,
  kandydat R1 sprawdzony i odrzucony
- ~~Problem 4~~ — **zamknięty jako granica poznania**. Występuje na ścieżce
  produkcyjnej (nie jest artefaktem `/debug`), jest **jednym** zjawiskiem, nie
  dwoma (retrieval niewrażliwy: fragment docelowy na pozycji 0 w 36/36), a
  wyzwalaczem jest kolokacja „za 500 tysięcy złotych" — zawodzi wyłącznie kwota
  500 i tylko przy rozwiniętej walucie. Osiem hipotez wykluczonych pomiarem,
  mechanizmu nie da się ustalić z zewnątrz modelu. Błąd jest **bezpieczny
  kierunkowo**: model pomija ustępstwo, nigdy go nie wymyśla

Wszystko w „Znane ograniczenia" i `DECYZJE.md`.

**Trzy zmiany cofnięte 20.08.2026** (uziemianie liczb pytaniem **bez podziału na
tryby**, reguła syntezy jako lista przykładów, zmiana w `PROMPT_RDZEN`) — powody
w „Ślepe uliczki". Pierwsza z nich wróciła tego samego dnia w postaci zawężonej
do trybu wewnętrznego i **w tej postaci jest wdrożona**.

**Panel właściciela jest domknięty od 21.08.2026** — aplikacja Access istnieje,
`ACCESS_AUD_PANEL` wpisany, host odpowiada 302 na ekran logowania. Zostaje jedno
sprawdzenie po stronie właściciela: **czy polityka tej aplikacji dopuszcza jeden
adres e-mail, a nie całą domenę firmy** — `Emails ending in @budmax.pl` wpuściłoby
każdego pracownika i odtworzyło problem, który ta zmiana usunęła.

**Zostało po stronie właściciela, nie kodu:** kroki 2 i 3 z `ZERO-TRUST.md`
(Google i Microsoft jako metody logowania). Dziś działa wyłącznie One-time PIN —
wystarcza do testów i jednego użytkownika, nie wystarcza dla zespołu klienta.

**Trzy rzeczy, które łatwo popsuć nieświadomie:**
1. Wyłączenie `workers_dev` zerwie widget i panel — mają stary adres wpisany
   na sztywno w `WORKER_URL`
2. Binding albo trasa, których nie ma w `wrangler.toml`, znikają przy deployu
3. `/reindex` po każdej zmianie treści — i odczekać, zapis do Vectorize jest
   asynchroniczny
4. **Host dopisany w `wrangler.toml`, ale nie w `KLIENCI`** (albo odwrotnie) —
   trasa istnieje, a Worker odpowiada na niej 404, bo host nie ma klienta.
   Oba miejsca zmienia się razem
5. **`DEMO = "1"` zostawione przy wdrożeniu u klienta** — doda mu na dole ekranu
   pasek z linkiem do cudzego dema. Przy wdrożeniu zmienną się USUWA, nie zeruje
6. **Cloudflare buforuje odpowiedzi na brzegu.** Sonda zaraz po wdrożeniu potrafi
   pokazać stan sprzed niego — kosztowało dwa fałszywe alarmy (20 i 21.08.2026).
   Każdą sondę rób z `?cb=$RANDOM`

## Pliki

| Plik | Co to | Gdzie żyje |
|---|---|---|
| `worker.js` | Backend — RAG, weryfikacja, prompty, tożsamość, routing, **silnik niezależny od branży** | Cloudflare Worker `knowbase-budmax` |
| `klienci.js` | `KLIENCI` — tablica klientów i indeks `host → {klient, rola}`. **Wszystko, co zależy od firmy** | importowane przez `worker.js` |
| `eskalacja-budowlana.js` | `ESKALACJA_BUDOWLANA` — słownik branżowy eskalacji (kategorie, dopełnienia, progi, teksty) | importowane przez `klienci.js` |
| `content-kancelaria-public.js` | `CHUNKS_KANCELARIA` — 26 fragmentów publicznych kancelarii | importowane przez `klienci.js` |
| `content-kancelaria-internal.js` | `INTERNAL_CHUNKS_KANCELARIA` — 25 fragmentów wewnętrznych kancelarii | importowane przez `klienci.js` |
| `eskalacja-prawna.js` | `ESKALACJA_PRAWNA` — słownik eskalacji kancelarii, 8 kategorii | importowane przez `klienci.js` |
| `content-public.js` | `CHUNKS` — 53 fragmenty publiczne | importowane przez `worker.js` |
| `content-internal.js` | `INTERNAL_CHUNKS` — 44 fragmenty wewnętrzne | importowane przez `worker.js` |
| `app-internal.js` | `APP_INTERNAL_HTML` — aplikacja asystenta budowy PWA | importowane przez `worker.js` dla `GET /app` |
| `panel-internal.js` | `PANEL_INTERNAL_HTML` — szablon panelu wewnętrznego | importowane przez `worker.js` dla `GET /panel` |
| `index.html` | Strona firmy z osadzonym widgetem | GitHub Pages |
| `panel.js` | `PANEL_HTML` — panel właściciela, serwowany na hoście właściciela pod `GET /` | importowane przez `worker.js` |
| `panel.html` | **Już nie panel** — wskazówka z nowym adresem, bo ze statycznej strony nie da się uwierzytelnić przez Access | GitHub Pages |
| `panel-internal.html` | Panel analityczny procedur i szkoleń (bot wewnętrzny) | repo / serwowane przez Worker |
| `app-internal.html` | Aplikacja webowa asystenta budowy (mobile-first, dyktowanie) | repo / serwowane przez Worker |
| `wrangler.toml` | Konfiguracja deployu — bindingi, zmienne Access, data kompatybilności | repo |
| `DECYZJE.md` | Uzasadnienia, wyniki pomiarów, ślepe uliczki | repo, czytane na żądanie |
| `ZERO-TRUST.md` | Instrukcja konfiguracji logowania do trybu wewnętrznego | repo |
| `test-access.mjs` | Test weryfikacji tokenu Access (`node test-access.mjs`) | repo |
| `test-eskalacja.mjs` | Test warstwy eskalacji (`node test-eskalacja.mjs`) | repo |
| `test-weryfikacja.mjs` | Test deduplikacji, progów i cytatu dosłownego | repo |
| `test-stats-internal.mjs`| Test statystyk wewnętrznych i zliczania eskalacji | repo |
| `test-klienci.mjs` | Test wymiaru klienta: host, przestrzenie, obowiązkowość klienta, szablony | repo |
| `test-eskalacja-prawna.mjs` | Test słownika eskalacji kancelarii (`node test-eskalacja-prawna.mjs`) | repo |
| `test-obietnice-prawne.mjs` | Wrogi test warstwy obietnic kancelarii | repo |
| `test-motyw.mjs` | Test motywu i treści interfejsu: brak surowych `{{pól}}`, brak słownictwa cudzej branży, różność motywów | repo |
| `sonda-klienta.mjs` | Zbiorczy przebieg diagnostyczny klienta (`node sonda-klienta.mjs <sekret> <klient> [zakres]`) — odtwarza ścieżkę produkcyjną, osobno liczy eskalacje i ramki bezpieczeństwa | repo, wyniki do katalogu tymczasowego |
| `sonda-powtorka.mjs` | To samo pytanie N razy — odróżnia wahanie modelu od skutku zmiany (`node sonda-powtorka.mjs <sekret> <klient> <space> <N> "pytanie"`) | repo |

**Treść jest w osobnych plikach od 19.08.2026** — stanowiła ponad połowę wagi
`worker.js`, a zadanie dotyczące logiki nigdy jej nie potrzebuje. Bundler
(esbuild w wranglerze) skleja wszystko z powrotem przy deployu: `main` w
`wrangler.toml` bez zmian, rozmiar uploadu i czas startu bez zmian.

Adresy:
- Publiczny: `https://budmax.know-base.app` — endpoint widgetu
- Wewnętrzny: `https://budmax-pracownik.know-base.app` — bot dla pracowników, za Access
- **Panelowy: `https://budmax-wlasciciel.know-base.app`** — panel właściciela, za **własną**
  aplikacją Access (polityka na jeden e-mail, nie na cały zespół)
- Stary: `https://knowbase-budmax.rezi7608.workers.dev` — **nadal działa i ma działać**
- Strona: `https://p0rk1.github.io/widgetAI/` · Panel: `.../panel.html`

**Trzy hosty na klienta** od 21.08.2026, jednopoziomowe, bez wildcardu — powody
w `DECYZJE.md` → „Adresy i domeny" oraz „Panel właściciela na Access". Nowy klient
to **wpis w `KLIENCI`**, **trzy** wpisy w `[[routes]]` i **dwie** aplikacje Access
(host publiczny jej nie ma). `ALLOWED_ORIGINS` składa się już samo z tablicy
klientów — nie ma tam czego dopisywać.

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
| `POST /internal` | pracownik | Access, **host pracowniczy** |
| `GET /`, `/app` (host pracowniczy) | pracownik | Access |
| `GET /`, `/panel`, `/stats`, `/stats-internal` (host właściciela) | **właściciel firmy** | Access, **host właściciela** |
| `/reindex`, `/purge`, `/debug` | administrator | `REINDEX_SECRET` |

**`/stats` wyszedł spod `REINDEX_SECRET` 21.08.2026.** Właściciel firmy dostawał
wcześniej klucz otwierający też `/purge` i `/reindex`, czyli mógł skasować własną
bazę wiedzy. Endpointy administracyjne zostają na sekrecie świadomie — to
narzędzia wdrożeniowe, do których klient nie ma mieć dostępu nawet zalogowany.

- **`REINDEX_SECRET` na `/internal` nie działa** i nie ma tam ścieżki obejścia.
- `verifyAccessJwt()` sprawdza **podpis, `iss`, `aud` i ważność** — sama obecność
  nagłówka `Cf-Access-Jwt-Assertion` nic nie znaczy, bo dopisze go każdy, kto
  ominie Access.
- `ACCESS_TEAM_DOMAIN = "knowbase.cloudflareaccess.com"` i `ACCESS_AUD` w `[vars]`
  w `wrangler.toml`. To **nie są sekrety**. **Nie „poprawiać" domeny zespołu na to,
  co pokazuje ekran logowania** — powód w `DECYZJE.md` → „Cloudflare Access".
- Puste zmienne = tryb wewnętrzny wyłączony: `/internal` zwraca **503 z listą
  braków**, nie milczące 403.
- Na hoście pracowniczym żądanie bez sesji **nie dochodzi do Workera** — Access
  odsyła 302 na ekran logowania. Kody Workera (401) widać tylko na `workers.dev`.
- `/internal` na `workers.dev` **nigdy nie zadziała** — to poprawne fail-closed,
  nie usterka.
- `email` i `domena` z tokenu są odczytywane i zwracane w polu `zalogowany`.
  **Nic po nich jeszcze nie filtruje** — to fundament pod multi-tenant.
- **Nazwy hostów są w `KLIENCI` w `klienci.js` — jedynym miejscu w kodzie**
  (do 22.08.2026 w `HOSTY` w `worker.js`). Dopasowanie jest **dokładne**
  (`HOSTY_INDEX.get(hostname)`), nie podciągiem.
  Do 21.08.2026 było przez `includes()` i zmiana nazw hostów w Access **po cichu
  odebrałaby rolę obu hostom**. Host spoza `HOSTY` nie dostaje żadnej roli.
- **Rola wynika z HOSTA, nie z kodu.** Pracownik i właściciel wchodzą pod różne
  adresy, objęte różnymi aplikacjami Access z różnymi politykami. Worker nie zna
  pojęcia roli, nie ma listy uprawnionych i nie sprawdza pola w tokenie. Pole
  `role` w metadanych fragmentów **nadal nic nie filtruje**. Dlaczego nie rola
  w polityce na ścieżce: `DECYZJE.md` → „Panel właściciela na Access".
- **AUD zależy od hosta.** `accessConfig(env, url)` bierze nazwę zmiennej
  z `klient.audVars[rola]` — dla BudMaksu `ACCESS_AUD` albo `ACCESS_AUD_PANEL`. Sprawdzanie „którykolwiek ze znanych AUD-ów" byłoby dziurą:
  token pracownika otwierałby panel właściciela. Pilnuje tego sekcja 5
  w `test-access.mjs`.
- **Fail-closed dotyczy też HTML-a.** `odpowiedzBrakKonfiguracji()` nie wyda
  `/app`, `/panel` ani `GET /`, dopóki zmienne Access dla tego hostu są puste.
  Zmierzone 21.08.2026: zanim aplikacja Access powstała, host właściciela serwował
  panel każdemu — host i trasa istnieją wcześniej niż ochrona.

**Test:** `node test-access.mjs` — 27 przypadków, podstawia własne klucze,
więc sprawdza także przypadek pozytywny. Uruchamiać po każdej zmianie
w weryfikacji tokenu.

## Klient — drugi wymiar, od 22.08.2026

`KLIENCI` w `klienci.js` to jedyne miejsce, w którym mieszka cokolwiek zależnego
od firmy: hosty, nazwy zmiennych z AUD-ami, przestrzenie, treść, słownik
eskalacji, wzorce obietnic publicznych, fragmenty promptów i nazwy w interfejsach.
Docelowo ta tablica staje się tabelą w D1, a `rozpoznajKlienta()` zapytaniem do
niej — reszta systemu tej zmiany nie zobaczy.

**Reguły, których nie wolno rozluźnić:**
- **Klient wynika z HOSTA**, tak samo jak rola. Nie przychodzi z ciała żądania,
  z query ani z nagłówka. Jedyny wyjątek to `?klient=` na `/reindex` i `/debug` —
  narzędzia administracyjne za `REINDEX_SECRET`, wybierające **wpis z zamkniętej
  tablicy**, nigdy nazwę przestrzeni.
- **Host spoza `KLIENCI` nie dostaje klienta, roli ani odpowiedzi** — `POST /`
  zwraca tam 404. Do 22.08.2026 dostawał dokumentację BudMaksu.
- Stare adresy (`knowbase-budmax.rezi7608.workers.dev`) są wpisane **jawnie**
  w polu `stare`. Nic nie wpada tam przez podciąg.
- **Brak klienta jest błędem, nie ciszą.** `wymagajKlienta()`,
  `przestrzenFizyczna()`, `wykryjEskalacje()`, `buildSystemPrompt()`
  i `isUnsupportablePromise()` w trybie publicznym **rzucają wyjątkiem**.
  Cicha praca bez pakietu branżowego wyłączyłaby eskalację w całości bez śladu.
- **Zdanie odmowne każdego klienta musi zawierać frazę „nie mam takich
  informacji"** — `handleAsk()` rozpoznaje po niej brak odpowiedzi. Sprawdza to
  asercja przy starcie modułu, więc błąd wychodzi przy `--dry-run`.
- Log pytań jest **podpisany klientem**, a oba panele filtrują po nim. KV jest
  jedno na Workera. Wpisy sprzed 22.08.2026 przypadają klientowi z flagą
  `przejmujeStareWpisy` — dokładnie jednemu.
- **Przełącznik demo istnieje tylko przy `DEMO = "1"` w `[vars]`.** U klienta tej
  zmiennej nie ma i wtedy paska nie ma **fizycznie w HTML-u**. To lista linków,
  nie kontrolka: klient nadal wynika z hosta.

Co jest branżowe, a co produktowe (pełna tabela: `DECYZJE.md` → „Wybór klienta"):
protezą okazały się **wzorce**, nie reguły. Uziemienie liczb, progi, deduplikacja
i cytat dosłowny zostały w silniku bez wymiaru klienta — ale to hipoteza z braku
dowodu przeciwnego, nie wynik pomiaru na drugiej branży.

## Motyw i treść interfejsu — pola klienta, od 24.08.2026

Wygląd i teksty interfejsów są **polami w `KLIENCI`**, tak samo jak
`zwrotDoKlienta` i słownik eskalacji. Trzecia branża to dopisanie palety
i kroju, **nie edycja plików interfejsu**.

| Pole | Co trzyma |
|---|---|
| `motyw.kolory` | 13 tokenów barwnych + `cien`; nazwy te same, co wcześniej w `:root` |
| `motyw.font*` | adres Google Fonts i trzy kroje: nagłówkowy, tekstowy, monospace |
| `motyw.siatka` | kalka techniczna: widoczność, rozmiar oczka, krycie |
| `motyw.promien`, `.tropNaglowka`, `.akcentRamki` | kanciaście kontra łagodnie, rozstrzelenie nagłówków, ramka znacznika |
| `ui.kafle` | kafle szybkiego startu: etykieta + pytanie + `pilny` |
| `ui.nazwyEskalacji` | nazwy kategorii w panelu; **pilność bierze się ze słownika**, nie stąd |
| `ui.opisTytul/opisTekst/podtytulPanelWew/zrodloPytan/przelozony*` | teksty, które były wpisane w plikach |
| `ui.etykietaPrzelacznika` | **branża, nie nazwa firmy** — „przełącz na kancelarię" |

**Reguły, których nie wolno rozluźnić:**
- **Żadnego koloru, kroju ani tekstu branżowego nie wpisuje się do
  `app-internal.js`, `panel-internal.js` ani `panel.js`.** Do 24.08.2026 każdy
  z tych plików miał **własną kopię** tego samego bloku `:root` — trzy duplikaty,
  które rozjechałyby się przy pierwszej zmianie. Dziś jest tam `{{motywCss}}`.
- **Kolor z alfa składa się przez `color-mix`**, nigdy przez `rgba()` z wpisaną
  trójką RGB. Taką trójką było zapisanych **38 kolorów** i żaden nie reagowałby
  na zmianę motywu.
- **`ui.nazwyEskalacji` musi pokrywać słownik branżowy co do klucza** — pilnuje
  tego asercja przy starcie modułu, więc błąd wychodzi przy `--dry-run`.
  Bez niej nowa kategoria daje w panelu kartę z surowym `id`, a literówka —
  kartę, która nigdy się nie zapala. Oba błędy są ciche.
- **Pilność kategorii nie jest przepisywana ręcznie** — `eskalacjeJson()` bierze
  ją ze słownika. Inaczej panel mógłby pokazać jako spokojne coś, co słownik
  uznał za pilne.
- **Kafle nie mają emoji** — numer w monospace jest tym samym językiem, którego
  używają nagłówki bloków, i działa w każdej branży bez rysowania ikon.
- **Element przyklejony do dołu musi liczyć się z paskiem demo.** Pasek ma
  stałą pozycję, więc nie zajmuje miejsca w układzie. Jego wysokość ogłasza
  `--pasek-demo` (0, gdy paska nie ma), `body` rezerwuje na nią miejsce
  w `motywCss()`, a dok wpisywania stoi na `bottom:var(--pasek-demo)`.
  Bez tego pasek kładł się na polu pytania — zmierzone 24.08.2026
- **W treści szablonu nie ma odwróconych apostrofów, także w komentarzach.**
  Zamykają literał, a `node --check` tego nie widzi. **Trzy przypadki**
  w projekcie; od 24.08.2026 pilnuje tego sekcja 9 w `test-motyw.mjs`
- **Etykieta w obramowaniu musi mieć klasę `znacznik`.** Pionowy padding
  i obramowanie elementu **inline** nie powiększają wiersza, więc pudełko
  maluje się poza nim i nachodzi na tekst poniżej. Zmierzone 24.08.2026 na
  „WEWNĘTRZNY". To wspólny kształt w trzech plikach, więc reguła stoi
  w **`motywCss()`** — jedynym arkuszu, który te pliki dzielą — a nie przy
  pojedynczej klasie
- **Kontrast liczy się wobec RZECZYWISTEGO tła, nie tła strony.** Tło ramki
  eskalacyjnej to `color-mix(akcent X%, transparent)` położony na powierzchni
  pod spodem — inny kolor niż tło strony. Liczenie wobec strony przepuściło
  24.08.2026 tekst o kontraście **1.14**. Progi: ramka **pilna ≥ 7 i mocniejsza
  od każdej innej powierzchni barwnej** (to komunikat ratunkowy), reszta ≥ 4.5,
  obwódki ≥ 3. Pilnuje tego sekcja 10 w `test-motyw.mjs`
- **W plikach interfejsu nie ma ŻADNEJ wartości barwnej.** Nie „mało", tylko
  zero: każdy kolor przychodzi z `motywCss()`. Ręcznie pisana lista podmian
  przepuściła 24.08.2026 trzy kolory, więc zastąpiła ją sekcja 11
  w `test-motyw.mjs`. Jedyny wyjątek to `#000` w `mask-image` — punkt maski,
  nie kolor
- **`--dim` ma mieć kontrast ≥ 4:1** wobec `--void`. Sprawdzone 24.08.2026:
  było 3.55 (ciemny) i 2.92 (jasny) przy 9,5-pikselowych etykietach.

**Test:** `node test-motyw.mjs` — 135 przypadków. Uruchamiać po każdej zmianie
w motywie, w `ui` i w plikach interfejsu.

## Separacja przestrzeni wiedzy

Jeden indeks, **rozłączne przestrzenie nazw** w Vectorize. Od 22.08.2026 nazwa
przestrzeni ma **dwa wymiary**: `rodzaj` z routingu × `klient` z hosta. Fizyczną
nazwę składa `przestrzenFizyczna()` wewnątrz granicy dostawcy i tylko tam.
BudMax został przy nazwach `public` / `internal` — jawnie wpisanych w jego wierszu
tablicy, dzięki czemu zmiana nie wymagała reindeksu ani migracji wektorów.

| Endpoint | Przeszukuje | Skąd bierze zakres |
|---|---|---|
| `POST /` | `public` klienta z hosta | stała `SPACES_FOR_PUBLIC` |
| `POST /internal` | `public` + `internal` klienta z hosta | stała `SPACES_FOR_INTERNAL` |

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
  teraz, bo dopisanie go później oznacza reindeks u każdego klienta. Od 22.08.2026
  dochodzi obok niego pole `klient` — z tego samego powodu i też jeszcze bez
  żadnego filtrowania (rozłączność stoi na przestrzeniach, nie na metadanych).

## Eskalacja — trzeci stan odpowiedzi (tylko tryb wewnętrzny)

Obok odpowiedzi normalnej i „brak w dokumentacji" jest **trzeci stan**: kroki
z dokumentacji **plus** twarde skierowanie do przełożonego. Nie zamiast siebie —
razem. Przy wypadku bot nie może być jedynym źródłem decyzji, ale nie może też
milczeć, bo ktoś musi wiedzieć, co zrobić w pierwszej minucie.

| Kategoria | Wyzwalacz | Pozycja ramki |
|---|---|---|
| `wypadek` | słownictwo zdarzeniowe (spadł, złamał, krwawi, poszkodowany) | **przed** treścią |
| `zagrozenie_zycia` | gaz, pożar, prąd, zawalenie, brak oddechu | **przed** treścią |
| `spor_prawny` | groźba sądu, roszczenie, odszkodowanie, adwokat | po treści |
| `kontrola` | organ (PIP, PINB, sanepid) **oraz** jego obecność/żądanie | po treści |
| `finanse_prog` | pieniądze **oraz** decyzja **oraz** przekroczony próg (3% / 300 zł) | po treści |

Kancelaria ma własny zestaw ośmiu kategorii w `eskalacja-prawna.js` — odpowiednikiem
wypadku jest tam **termin procesowy, który upływa albo upłynął**, a od 22.08.2026
dochodzi **`naruszenie_danych`** (72 godziny na zgłoszenie, plus tajemnica
adwokacka przy utracie akt). Obie są pilne, obie z tego samego powodu: biegnie
zegar, którego nie da się zatrzymać dobrą pracą.

**Wzorce są branżowe i mieszkają w `eskalacja-budowlana.js`** (od 22.08.2026),
a przychodzą przez `klient.eskalacja`. W `worker.js` został sam mechanizm.
Poniższe reguły dotyczą mechanizmu i obowiązują każdą branżę; kalibracja wzorców
jest osobna dla każdej.

**RAMKA BEZPIECZEŃSTWA W TRYBIE PUBLICZNYM — od 22.08.2026.** Kategoria może
mieć pole `publiczna` z tekstem dla KLIENTA; wtedy `wykryjOstrzezenie()` doklei
go poza weryfikacją, tak jak eskalacja robi to dla pracownika. Powstało dlatego,
że warstwa liczb wycięła numer 112 z odpowiedzi dla osoby zgłaszającej
zagrożenie. **Domyślnie nie ma go żadna kategoria** — dodanie ramki jest decyzją,
nie skutkiem ubocznym. Dziś ma je wyłącznie `zagrozenie_osoby` u kancelarii;
BudMax nie ma żadnej i jego bot publiczny jest niezmieniony. Biała lista numerów
w `numbersAreGrounded()` została **odrzucona** — patrz „Ślepe uliczki".

**Reguły, których nie wolno rozluźnić:**
- **Rdzeń dwuznaczny wyzwala dopiero ze swoim DOPEŁNIENIEM** (od 21.08.2026).
  `potrac`, `zlama`, `spadl z`, `zawali` znaczą na budowie także „potrącimy
  z faktury", „złamał procedurę", „koszt spadł z 40 zł", „zawalił termin".
  Zmierzone: **7 na 10 zwykłych zdań z budowy dostawało ramkę PILNE**, dziś 0.
  Warunkiem jest część ciała / człowiek / wysokość / konstrukcja — nie lista
  sformułowań wypadku. Wariant „jakikolwiek człowiek w zdaniu" **odrzucony
  pomiarem**: na budowie ktoś występuje prawie zawsze.
- `uraz(?![ae])` rozbrojony **morfologicznie**, nie kontekstem — *uraz/urazu*
  kontra *uraza/urazę*. Warunek kontekstowy gubił „doznał urazu" bez części ciała.
- **Rzeczowniki urazowe wyzwalają same** (`krew`, `rana`, `obrażenia`,
  `rozcięcie`, `opatrunek`). Dwa idiomy wyłączone jawnie:
  `(?<!zimna )(krew|krwi)(?! z nosa)`. Kandydat `wbil sobie` **odrzucony** —
  łapie „wbił sobie do głowy".
- **Przy wielu trafieniach rozstrzyga zasada, nie kolejność w tablicy:**
  (1) więcej niezależnych sygnałów, (2) przy remisie kategoria **pilna**,
  (3) potem kolejność. Punkt 1 działa **wewnątrz** poziomu pilności — inaczej
  „wypadek + PIP" wybrałby `kontrola`, bo ta ma dwa sygnały z definicji.
- Wyzwalanie jest **deterministyczne, wzorcami w kodzie** — nie oceną modelu.
  Z tego samego powodu co `numbersAreGrounded()`: przy BHP błąd nie kosztuje
  złej recenzji, tylko zdrowia.
- Rozróżnienie idzie po **zdarzeniu, nie po temacie**. „Rusztowanie", „wysokość",
  „szkolenie" i „środki ochrony" **celowo nie wyzwalają** — to tematy, przy
  których nikt nie leży na ziemi.
- **Próg jest różny dla różnych kategorii, bo koszt pomyłki jest różny.** Przy
  wypadku i zagrożeniu życia wyzwalamy szeroko i weto ramy informacyjnej
  **nie działa**. Przy sporze, kontroli i finansach wymagamy dwóch niezależnych
  sygnałów, bo tam fałszywy alarm to szum, który nauczy ignorować ramkę.
- **Pytanie jest normalizowane — małe litery i zdjęte ogonki.** Pracownik pisze
  z telefonu „grozi sadem", „zlamal noge". Wzorce są zapisane bez ogonków i tak
  mają zostać. **`\b` w JavaScripcie zna wyłącznie ASCII** — `\bmarż\b` nie
  dopasuje się do „marżę". Nie wracać do `\b`.
- **Tekst ramki nie przechodzi przez `verifyClaims()`** — jest doklejany po niej,
  ze stałej w kodzie. To reguła operacyjna firmy, nie twierdzenie o dokumentacji,
  więc nie ma czego weryfikować względem fragmentów. Dzięki temu weryfikacja dla
  reszty odpowiedzi **nie jest w niczym osłabiona**, a `isDuplicate()` nigdy nie
  widzi ramki i nie ma jej jak skasować.
- Ramka trafia **i do pola `answer`, i do osobnego pola `eskalacja`**
  (`{kategoria, pilne}`). Osobne pole jest dla interfejsu; tekst w `answer`
  dla klientów, które tego pola nie znają — widget i panel go nie znają.
- Eskalacja działa też, gdy **dokumentacja nie ma odpowiedzi**. Wtedy jest
  potrzebna bardziej, nie mniej.

**Test:** `node test-eskalacja.mjs` — **79 przypadków** na słowniku budowlanym, w tym 26 negatywnych
(pytania tematycznie bliskie, które wyzwolić nie mogą), zestaw bez ogonków
i sprawdzenie pozycji ramki. Warstwa jest deterministyczna, więc testuje się ją
lokalnie, bez wywoływania modelu.

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
- **Odmowa zapada w fallback tylko wtedy, gdy nie ma obok niej treści** —
  `tylkoOdmowa()`, od 22.08.2026. Odmowa dopisana obok treści jest usuwana
  (`usunZdaniaOdmowne()`), a treść przechodzi pełną weryfikację. Rdzeń promptu
  mówi przy tym wprost, że wyjaśnienie „dlaczego nie podajemy" JEST odpowiedzią.
  Prawdziwe „nie wiem" — samo zdanie odmowne, także z grzecznością — nadal
  zapada i nadal liczy się jako luka. **Skutek uboczny zmierzony na BudMaksie:**
  4 luki na 8 → 3 na 8; pytanie o wolny termin przestało być luką, bo model
  podaje teraz powód zamiast frazy odmownej. Wariant odwrotu, gdyby wskaźnik
  luk spadł szerzej: zawęzić regułę promptu do trybu wewnętrznego
- **Publicznego promptu nie rusza się przy okazji zmian w wewnętrznym** — jest
  kalibrowany od wielu sesji. Przy zmianie rozdzielającej cokolwiek na klientów
  kryterium jest **wynik bajt w bajt identyczny** — sprawdzalne migawką promptu
  sprzed zmiany (tak domknięto etap 1 drugiej branży).
- **Z promptu wychodzi do klienta tylko to, co MÓWI O BRANŻY**: nazwa firmy,
  rozróżnienia mylonych usług, zakazy branżowe, przykłady stanowisk, zdanie
  odmowne i **forma zwracania się do klienta** (`zwrotDoKlienta`, od 22.08.2026).
  Struktura, kolejność akapitów i `PROMPT_RDZEN` są wspólne.
- **Reguła tonu przeniesiona do pól klienta 22.08.2026**, bo była kalibrowana na
  budowlance i pękała u kancelarii (model pisał „Twojej sprawy"). Tekst BudMaksu
  przepisano bez zmiany jednego znaku — sprawdzone migawką: prompt publiczny
  wychodzi bajt w bajt taki sam. Wersja kancelarii jest mocniejsza: wymienia
  formy, które model faktycznie produkował, i podaje zamienniki.
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
| `vectorUpsert(env, vectors, klient, rodzaj)` | zapis do indeksu (`/reindex`) |
| `vectorDelete(env, ids)` | usunięcie z indeksu (`/purge`) |

**Czego nie wolno przez nią przepuszczać:**
- `env.AI` i `env.VECTORIZE` nie pojawiają się nigdzie poza tą sekcją. Kontrola:
  `grep -n "env\.AI\|env\.VECTORIZE\|@cf/" worker.js` — wszystkie trafienia muszą
  mieścić się w jej obrębie.
- Literał `@cf/...` żyje wyłącznie w `PROVIDER`.
- Kształt odpowiedzi dostawcy (`res.data`, `res.response`, `results.matches`)
  nie wychodzi na zewnątrz.
- `vectorSearch` wymaga `opts.klient` i `opts.rodzaje` — bez wartości domyślnych.
- Fizyczną nazwę przestrzeni składa `przestrzenFizyczna(klient, rodzaj)` i nikt poza nią.

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
- `GET /` lub `GET /app` — aplikacja webowa asystenta budowy (Etap 5)
  zoptymalizowana na telefon, z dyktowaniem głosowym i kaflami szybkiego startu.
  **Wyłącznie na hoście pracowniczym** (`hostPracownika()`) — gdzie indziej ścieżka
  nie istnieje
- `GET /panel` — panel analityczny procedur i szkoleń (Etap 6). **Przeniesiony
  21.08.2026 na host właściciela** — treść jest dla właściciela, więc stoi za polityką
  właściciela, nie zespołu
- `GET /` na hoście właściciela — panel właściciela (analityka widgetu publicznego),
  serwowany z `panel.js`
- `GET /stats-internal` — dane statystyczne bota wewnętrznego (luki szkoleniowe, procedury,
  zdarzenia/eskalacje). **Host właściciela + token Access.** Do 21.08.2026 stało na samym
  „token jest ważny" na hoście pracowniczym, więc **każdy pracownik** mógł czytać
  analitykę właściciela
- `GET /reindex?key=…&space=public|internal&klient=…` — **uruchom po każdej zmianie
  CHUNKS lub INTERNAL_CHUNKS**. Bez `klient` indeksuje klienta z hosta. Bez `space` indeksuje `public` (zgodnie z dotychczasowym
  zachowaniem). Każdą przestrzeń indeksuje się osobno
- `GET /stats` — dane dla panelu właściciela. **Wyłącznie host właściciela + tożsamość
  z Access**; `REINDEX_SECRET` tu **nie działa** od 21.08.2026. Poza hostem panelowym
  zwraca 404. Pytania z `/internal` są **odfiltrowane**
- `GET /debug?key=…&q=pytanie&space=public|internal|obie&klient=…` — diagnostyka: co znalazło,
  z jakim wynikiem, **z której przestrzeni**, które zdania przechodzą weryfikację
  i **w polu `tryb_promptu`, który wariant promptu poszedł do modelu**
  (`internal`/`obie` → wewnętrzny). Bez `space` sprawdza `public`.
  **Od 19.08.2026 uruchamia wszystkie warstwy weryfikacji, nie samą semantyczną** —
  przy każdym zdaniu podaje `prog`, `doslownie`, `liczby_ok`, `obietnica`,
  `instrukcje`, `duplikat` i przyczynę w polu `akcja`. Wcześniej pokazywał sam
  cosinus, więc jego liczba wycięć była **dolnym oszacowaniem**, a zdania usuwane
  po cichu przez deduplikację nie były w nim widoczne w ogóle. Pokazuje też
  `eskalacja` i `odpowiedz_z_eskalacja` — treść tak, jak zobaczy ją pracownik
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

- **`numbersAreGrounded()`** — każda liczba w zdaniu musi występować w pobranych
  fragmentach. **Od 22.08.2026 zbiór uziemiający buduje `liczbyZeZrodla()`**:
  cyfry, liczebniki zapisane słownie („dwóch tygodni" → 2 i 14) oraz tygodnie
  przeliczone na dni. Rozszerzenie działa **wyłącznie po stronie źródła** —
  liczebnik w odpowiedzi nie jest zamieniany na cyfrę, bo to zaostrzyłoby
  warstwę. Miesiące **nie są** przeliczane na dni. Powód: dokumenty formalne
  zapisują terminy słownie, więc kolizja czeka u większości klientów. To najważniejsze zabezpieczenie: łapie zmyślone ceny
  ("1500–3000 zł/m²") i terminy ("3–4 miesiące"), których weryfikacja semantyczna
  nie widziała, bo zdanie brzmiało poprawnie.
  **Uziemienie z pytania zależy od trybu — od 20.08.2026 (wariant R3):**
  `numbersAreGrounded(sentence, filtered, tryb = PROMPT_PUBLICZNY, userQuestion = "")`.
  **Publicznie** zbiór liczb z pytania jest pusty i taki ma zostać: klient jest
  stroną negocjacji, więc na „Czy remont kosztuje 1200 zł/m²?" potwierdzenie
  nie może przejść. `isUnsupportablePromise()` tego **nie łapie** — zmierzone,
  ta warstwa jest tam jedyna. **Wewnętrznie** liczba z pytania uziemia zdanie,
  bo pracownik podaje parametr, a nie negocjuje sam ze sobą.
  **W obu trybach** liczba spoza fragmentów i spoza pytania wypada jak dotąd —
  arytmetyka modelu („czyli do 7500 złotych") ginie tak samo.
  **Domyślny tryb jest publiczny**: wywołanie, które o trybie zapomni, dostaje
  wariant surowy. Pilnują tego przypadki wrogie w `test-weryfikacja.mjs`
  (cena i termin klienta, brak trybu, nieznana nazwa trybu) plus strażnik
  sygnatury. Uzasadnienie, odrzucone warianty i pomiary: `DECYZJE.md` →
  „Uziemienie liczb: rozstrzygnięcie po trybie (R3)".
- **`obietniceBezwyjatku` klienta — wzorce odporne na wyjątek dla zaprzeczeń**
  (od 22.08.2026). Wyjątek dla zaprzeczeń jest testem PODCIĄGU, więc jedno „nie"
  albo „bez" gdziekolwiek w zdaniu wyłącza całą warstwę: zmierzone zestawem
  wrogim — „Tę sprawę wygramy **bez** większych problemów" i „Proszę się **nie**
  martwić, to zwykła formalność" przechodziły. Wzorce z tej listy sprawdzane są
  PRZED wyjątkiem i każdy niesie własne `(?<!nie )`, więc „nie wygramy" i „nie
  gwarantujemy" nadal przechodzą. **Ta sama dziura istnieje u BudMaksu** —
  „Bez problemu zdążymy przed zimą" nie jest łapane — i została **świadomie
  nieruszona**, bo jego warstwa jest skalibrowana, a naprawa wymaga własnych
  wzorców z lookbehindem
- **`isUnsupportablePromise(s, tryb)`** — **zna tryb od 19.08.2026.** W obu trybach
  wycina deklaracje wolnych terminów i obietnice zdążenia. Wzorce rabatowe i cenowe
  działają **tylko publicznie**: pracownikowi „przysługuje ci rabat do 3 procent"
  trzeba podać, bo to treść `i39`. Wyjątek dla zaprzeczeń i odesłań do biura zostaje.
- **`leaksInstructions(s, tryb)`** — **zna tryb od 19.08.2026.** „Proszę mi powiedzieć,
  że…" i „jako asystent AI" wycinane w obu trybach. Odwołania do dokumentacji
  („zgodnie z dokumentacją") wycinane **tylko publicznie** — klient nie wie o jej
  istnieniu, pracownik wie i sam dostaje linię `Podstawa:`.
- **`isDuplicate()`** — deduplikacja z przycinaniem polskich końcówek fleksyjnych
  ("wstępny kosztorys" ≈ "wstępna wycena"). **Dwa warunki naraz, nie jeden:**
  pokrycie ≥ `DUPLIKAT_POKRYCIE` (0.6) mówi, ile zdanie powtarza, a próg
  `DUPLIKAT_NOWE_SLOWA` (4) — ile wnosi nowego. Zdanie wnoszące 4 lub więcej
  nowych słów treściowych jest **rozwinięciem, nie powtórzeniem**, i zostaje.
  Bez tego drugiego warunku zdanie dłuższe miało pokrycie 1.0 wobec krótszego
  i znikało, choć dokładało dwa razy tyle treści. **Linia `Podstawa:` jest
  wyłączona** z deduplikacji osobno — tytuł fragmentu z definicji dzieli słowa
  ze zdaniem opartym na jego treści.
- **Ślad w metrykach.** `isDuplicate()` i `leaksInstructions()` usuwają zdania
  bez zwiększania licznika `trimmed` (to defekt formy, nie brak pokrycia). Są
  jednak liczone i zapisywane w logu jako `cicho: {duplikat, instrukcje}`,
  a `/stats` sumuje je w polu `diagnostyka`. **Nie usuwać tego licznika** —
  bez niego deduplikacja kasowała treść niewidocznie przez wiele sesji.
- **`wystepujeDoslownie()`** — druga, niezależna droga pokrycia: zdanie występujące
  **dosłownie** w pobranym fragmencie przechodzi bez względu na cosinus. Ma guard
  na zgubione zaprzeczenie — „zakrywaj zbrojenia" jest podciągiem „nie zakrywaj
  zbrojenia", więc trafienie poprzedzone partykułą przeczącą się nie liczy.
- **`progCytowania()`** — próg zależny od długości zdania, patrz „Progi".
- **`isConnectiveSentence()`** — zdania grzecznościowe przechodzą bez pokrycia,
  bo niczego nie obiecują.
- **`splitSentences()`** — chroni skróty (`m.in.`, `np.`) przed rozbiciem zdania
  i dzieli listy punktowane po nowej linii.

## Progi — kalibrowane empirycznie, nie zgadywane

```
TOP_K = 8              # 6 było za mało dla krótkich, ogólnych pytań
TOP_K_LONG = 10        # dla pytań ≥400 znaków (wielowątkowych)
MIN_SIMILARITY = 0.35
CITATION_THRESHOLD = 0.48           # 0.42 przepuszczało za dużo, 0.5 odrzucało poprawne parafrazy
CITATION_THRESHOLD_KROTKIE = 0.45   # zdania do 3 słów — patrz niżej
KROTKIE_ZDANIE_SLOW = 3
```

**Próg zależy od długości zdania od 19.08.2026.** Cosinus krótkiego zdania wobec
długiego fragmentu jest niski **niezależnie od tego, czy zdanie jest w nim zawarte**,
a prompt wewnętrzny produkuje krótkie zdania seryjnie, bo każe wypisywać kroki
w osobnych liniach. Podstawa liczbowa: na 89 zmierzonych zdaniach najniższe
**przechodzące** zdanie 1–3-słowowe miało 0.520, a wycinane 0.458 i 0.466 — oba
z pokryciem. Próg 0.45 domyka lukę i z definicji nie może wyrzucić niczego, co
przechodziło wcześniej. Pełny rozkład: `DECYZJE.md` → „Progi zależne od długości".

Zmieniając progi, użyj `/debug` — pokazuje dokładne wyniki podobieństwa zamiast
zgadywania, a od 19.08.2026 **uruchamia wszystkie warstwy weryfikacji**, nie samą
semantyczną, i podaje przy każdym zdaniu przyczynę usunięcia.

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
- **Pytanie użytkownika jako źródło uziemienia liczb W TRYBIE PUBLICZNYM** —
  oddawałoby klientowi decyzję, które liczby są prawdziwe. **Uwaga: wewnętrznie
  jest to od 20.08.2026 wdrożone zachowanie (R3), nie ślepa uliczka** — zakaz
  dotyczy wyłącznie trybu publicznego
- **Rozdzielanie „liczby jako kontekst" od „liczby przypisanej firmie" po budowie
  zdania** — niewykonalne, różnica leży w znaczeniu; ten sam przyimek obsługuje
  oba przypadki. Odrzucony kandydat R1 (wymóg drugiej liczby uziemionej w zdaniu)
  gubił zdania odmowne i przepuszczał zdanie mieszane — 9/14
- **R1 jako naprawa trybu publicznego** — sprawdzony szerzej 21.08.2026
  i odrzucony: defekt publiczny jest mały (1 odpowiedź zredukowana na 56),
  a R1 rozluźnia jedyną warstwę stojącą na powierzchni klienckiej
- **Utożsamianie „brak oczekiwanej liczby w odpowiedzi" z „błędna odpowiedź"** —
  przy pomiarze pominięć sprawdź najpierw, czy pominięta treść w ogóle należy
  do odpowiedzi na zadane pytanie. Kosztowało jeden fałszywy wniosek 21.08.2026
- **Reguła promptu „prostuj wartość spoza zakresu"** — sprawdzona i cofnięta
  21.08.2026. Bez efektu (12/16 → 11/16 → 10/16, rozrzut większy niż efekt),
  a model prostuje sam. Diagnoza, która ją zamówiła, była **artefaktem metryki**
- **Mierzenie dosłownego sformułowania zamiast sensu odpowiedzi** — trzeci
  przypadek tej samej pomyłki w projekcie. **Przed pomiarem sprawdź, czy metryka
  mierzy to, co chcesz wiedzieć, a nie to, co łatwo policzyć**: przeczytaj kilka
  odpowiedzi w całości i sprawdź, czy licznik zgadza się z Twoją oceną
- **Biała lista numerów alarmowych w `numbersAreGrounded()`** — odrzucona
  22.08.2026. Uziemiałaby numer w KAŻDYM zdaniu, więc „cena wynosi 997 zł"
  przechodziłoby jako liczba pokryta. Numer alarmowy podaje **ramka
  bezpieczeństwa**, doklejana poza weryfikacją
- **Rdzeń `sprawa` jako dopełnienie `termin` w eskalacji kancelarii** — odrzucony
  **pomiarem** 22.08.2026: 5 fałszywych alarmów na 6 zdań („termin spotkania
  w sprawie rozwodowej przesuwamy na jutro" dostaje ramkę procesową). „Sprawa"
  jest w kancelarii tym, czym „człowiek" na budowie. Uwaga: wariant przechodził
  cały test 68/68 — zestaw negatywny nie zawierał takich zdań, dziś zawiera
- **Parametr w żądaniu jako źródło wyboru KLIENTA** — odrzucony 22.08.2026 z tego
  samego powodu, dla którego nazwa przestrzeni nie przychodzi z żądania: cała
  rozłączność klientów wisiałaby wtedy na poprawności sprawdzenia uprawnień.
  Wyjątek dla `/reindex` i `/debug` jest świadomy — sekret, zamknięta tablica
- **Furtka `?klient=` na `workers.dev` pod flagą demo** — sprawdzona i odrzucona
  22.08.2026: na `workers.dev` tryb wewnętrzny nigdy nie zadziała (poprawne
  fail-closed), więc demo obejmowałoby wyłącznie tryb publiczny — czyli nie to,
  co ten etap miał zmierzyć
- **Przemianowanie przestrzeni BudMaksu na `budmax-public`** — odrzucone:
  kosztowałoby reindeks i migrację na działającej produkcji, a zysk jest wyłącznie
  estetyczny. Nazwy są wpisane jawnie w tablicy klienta i mogą być niesymetryczne
- **Deterministyczne poprawianie form adresatywnych po generacji** — odrzucone
  23.08.2026. Rewriter **mutuje tekst po weryfikacji**, więc zdanie wysłane do
  klienta przestaje być tym, które zweryfikowano, a `wystepujeDoslownie()` traci
  sens przy pierwszej podmianie. Analogia do ramki eskalacyjnej **nie działa** —
  ramka jest DOKLEJANA, nie edytowana, i to jest różnica decydująca o tym, czy
  warstwa może ominąć weryfikację. Do tego przypadek, który zamówił naprawę
  (p14, zły przypadek WEWNĄTRZ form Pan/Pani), leży w klasie nierozwiązywalnej
  bez parsera. **Detektor bez podmiany odrzucony razem z nim** — warstwa bez
  zmierzonej potrzeby
- **Rozpoznawanie roli hosta po podciągu nazwy** (`includes("wewnetrzny")`) —
  zmiana nazw hostów 21.08.2026 odebrałaby rolę obu hostom po cichu. Nazwy żyją
  w `HOSTY`, dopasowanie jest dokładne
- **Przepinanie hostów w samym Access, bez `wrangler.toml`** — stary adres
  zostaje podpięty do Workera, tyle że **bez ochrony**. Zmierzone: stary host
  oddawał aplikację pracowniczą z kodem 200. Zmieniać oba naraz, a jeśli
  osobno — to najpierw kod i trasy
- **Mierzenie tego, co widzi użytkownik, przez `/debug`** — `/debug` omija gałąź
  „nie mam takich informacji" → fallback w `handleAsk()`, więc pokazuje
  weryfikację odpowiedzi, które w produkcji do niej nie docierają. Do pytania
  „co dostaje klient" używać `POST /`
- **Reguła promptu „pod problem 4" jako lista przykładów** — cofnięta 20.08.2026,
  łamała zasadę „warunek, nie lista fraz" i nie działała (12% w 1 z 4 przebiegów)
- **Zmiana `PROMPT_RDZEN` w celu naprawy trybu wewnętrznego** — rdzeń jest wspólny,
  więc przepisuje też prompt publiczny kalibrowany od wielu sesji

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

**Długość fragmentu NIE jest kryterium — zmierzone 23.08.2026 i obalone.**
Hipoteza „fragment znacznie dłuższy od mediany przyciąga pytania ościenne"
nie potwierdziła się na 25 fragmentach i 20 pytaniach: korelacja rangowa
długości z liczbą wejść do `TOP_K` wynosi **−0.07**, a ze średnim wynikiem na
pytaniach nie swoich **−0.09**. Najszerzej wchodzą fragmenty **krótkie**
(„Jak umówić konsultację", 572 znaki, 14 wejść na 20 pytań). Tym, co poszerza
zasięg, jest **ogólność i graniczność tematu, nie objętość** — więc górnej
granicy długości się nie wprowadza i nie dzieli fragmentów „na zapas".

**Kryterium odskoku ≥ 0.1 stosuje się do LUK TEMATYCZNYCH — nie do fragmentów
o granicy kompetencji** (uzupełnienie z 22.08.2026). Fragment opisujący to,
czego firma świadomie NIE robi albo NIE ocenia („nie oceniamy szans sprawy",
„nie podajemy przewidywanego czasu trwania"), z definicji konkuruje z całą
dokumentacją: pytanie „jakie mam szanse w sprawie o zachowek" jest jednocześnie
pytaniem o zachowek, o koszty i o konsultację. Taki fragment może być poprawnie
użyty przy odskoku 0.001. **Kryterium brzmi wtedy: czy fragment wszedł do
zestawu i czy model po niego sięgnął** — a nie, czy odskoczył od reszty.
Zmierzone na kancelarii: `k18` liderem przy jednym pytaniu i na pozycji 7 z 8
przy drugim, odpowiedzi poprawne w obu.

**Przy usłudze nieobecnej w dokumentacji weryfikacja semantyczna nie jest ostatnią
linią obrony.** Przed poprawką model odpowiedział „tak, wykonujemy elewacje", cytując
fragment o wykończeniu wnętrz — z wynikiem 0.676, **powyżej `CITATION_THRESHOLD`**,
bo zdanie brzmi podobnie, mimo że dotyczy czego innego. To argument za kompletnością
dokumentacji, **nie za podnoszeniem progów**: próg, który odciąłby 0.676, odciąłby
też poprawne parafrazy.

## Znane ograniczenia

- **Dyktowanie głosowe jest tak dobre, jak przeglądarka — i nie da się tego
  poprawić z naszej strony.** Web Speech API rozpoznaje mowę po stronie
  przeglądarki i **nie ma żadnego parametru na hałas, mikrofon ani model**.
  `lang = "pl-PL"` to jedyne pokrętło jakościowe, jakie mamy, i jest ustawione
  **poprawnie od początku** — sprawdzone 24.08.2026. Przekłamania w hałasie nie
  są defektem tego kodu. Co zrobiliśmy: **wyniki częściowe na żywo**, żeby błąd
  był widoczny PRZED wysłaniem, oraz linia stanu z czytelnym powodem odmowy.
  **Decyzja o utrzymaniu tej funkcji jest produktowa, nie techniczna** — patrz
  `DECYZJE.md` → „Dyktowanie głosowe"

- ~~Model 8B generuje literówki po polsku ("z przyjemieniem")~~ — **nieaktualne
  od 16.08.2026**, zniknęło wraz z przejściem na 70B
- Wyniki wahają się między uruchomieniami przy tym samym pytaniu
- Wykrywanie obietnic wzorcami tekstowymi jest z natury zawodne — model wymyśla nowe
  sformułowania. Dokładanie kolejnych wzorców ma malejący zwrot.
- ~~Panel chroni ten sam klucz co endpointy administracyjne~~ — **naprawione
  21.08.2026.** `/stats` i `/stats-internal` stoją na tożsamości z Access, na
  osobnym hoście właściciela z polityką na jeden e-mail. `REINDEX_SECRET` nie
  otwiera już żadnego panelu
- ~~`INTERNAL_CHUNKS` to 3 fragmenty testowe, nie dokumentacja~~ — **nieaktualne
  od 19.08.2026**: 41 fragmentów w sześciu obszarach. Otwarte pozostają problemy
  z pomiaru, nie brak treści — patrz `DECYZJE.md` → „Treść wewnętrzna"
- ~~**Weryfikacja wycina krótkie zdania wyliczeń**~~ i ~~**`isUnsupportablePromise()`
  nie zna trybu**~~ — **naprawione 19.08.2026** (próg zależny od długości, cytat
  dosłowny, warstwy znające tryb). Pomiar kontrolny: 8 zdań traconych na 89 przed,
  **0 na 71 po**
- ~~**`isDuplicate()` kasuje odrębne zdanie, gdy dzieli słownictwo z poprzednim**~~ —
  **naprawione 20.08.2026** warunkiem „4 nowe słowa treściowe = rozwinięcie".
  Pomiar: tryb wewnętrzny 1 zdanie tracone na 73 przed, **0 na 72 po**; tryb
  publiczny **0 na 66 przed i po** — defekt nigdy nie dotykał obecnych klientów,
  bo odpowiedzi dla nich są prozą o zmiennym słownictwie, a nie listą kroków
  powtarzających te same rzeczowniki
- ~~**`numbersAreGrounded()` nie odróżnia liczby zmyślonej od zacytowanej z pytania**~~ —
  **naprawione w trybie wewnętrznym 20.08.2026** wariantem R3. Pomiar: wycięcia
  13/40 → **3/37**, odpowiedzi zredukowanych do samej linii `Podstawa:` 7/16 →
  **1/16**; w zbiorze, gdzie pracownik podsuwa wartość ponad próg, 6/30 → **0/30**,
  bo stara reguła wycinała **zdanie odmowne** cytujące liczbę pytającego.
  **W trybie publicznym — rozstrzygnięte 21.08.2026: zostaje bez zmian.**
  Zmierzone na 28 realnych pytaniach klienta z liczbą: 8 wycięć na 102 zdania,
  **1 odpowiedź zredukowana na 56**, zero liczb wyliczonych. Sprawdzone przez
  `POST /`, nie `/debug` — a to jest różnica, bo `/debug` omija gałąź
  „nie mam takich informacji" → fallback i **zawyża ten defekt**. Realnie
  klient traci treść w jednej sygnaturze: pytanie łączy błędną liczbę firmy
  z drugą kwestią, na którą dokumentacja odpowiada, i sprostowanie wypada.
  Kandydat R1 **sprawdzony i odrzucony** — nie przeciekł w 36 przebiegach, ale
  rozluźnia jedyną warstwę na powierzchni klienckiej dla jednego kształtu
  pytania. Nie wracać bez nowych danych. **Warunek utrzymania R3:** stoi na zachowaniu modelu (6/6 odmów), nie
  na gwarancji strukturalnej — przy zmianie modelu albo promptu wewnętrznego
  trzeba go przemierzyć. `DECYZJE.md` → „Uziemienie liczb: rozstrzygnięcie po trybie (R3)"
- **`numbersAreGrounded()` NIE jest uniwersalny — zmierzone na kancelarii
  22.08.2026.** Dwa nowe kształty defektu, oba nieobecne w budowlance:
  (1) dokumentacja prawnicza zapisuje terminy **słownie** („dwóch tygodni"),
  model odpowiada **cyfrą** („14 dni") i poprawne zdanie wypada;
  (2) **stała bezpieczeństwa** — „112" wycięte z odpowiedzi o przemocy domowej,
  bo numeru nie ma w treści publicznej. 3 zdania na 119, ale oba trafienia leżą
  w najdroższych miejscach tej branży. `DECYZJE.md` → „Kancelaria — pomiar"
- **Rozpoznawanie braku odpowiedzi po frazie myli „nie wiem" z „świadomie nie
  mówimy"** — zmierzone 22.08.2026. Fragment, którego treścią jest odmowa
  informacji (u kancelarii: „nie podajemy przewidywanego czasu trwania sprawy"),
  zostaje pobrany, model przepisuje go na zdanie odmowne, a `handleAsk()`
  zamienia CAŁĄ odpowiedź na fallback. Klient traci powód, choć powód był
  w materiale. W budowlance ten kształt prawie nie występuje
- ~~**Fragmenty o granicy informacji i porady są nieosiągalne dla retrievalu**~~ —
  **naprawione treścią 22.08.2026.** `k18`–`k20` otwierają się słownictwem pytań
  („Jakie mam szanse w mojej sprawie? Czy wygram sprawę o zachowek…"), nie nazwą
  procedury kancelarii. Pomiar po reindeksie: **luki 6/20 → 1/20, nadal zero
  porad prawnych.** Uwaga o procedurze: **kryterium „odskok lidera ≥ 0.1" jest
  słabym wskaźnikiem dla fragmentu o GRANICY KOMPETENCJI** — taki fragment
  z definicji konkuruje z całą resztą dokumentacji. Liczy się, czy wszedł do
  zestawu, nie czy odskoczył
- **Żadna warstwa nie pilnuje FORMY podania liczby, tylko jej pochodzenia** —
  zmierzone 22.08.2026: „przedawniają się w okresie od 3 do 6 lat" przeszło,
  bo obie liczby są w dokumentacji, choć prompt zakazuje mówienia „od X do Y"
- **Reguła tonu „per Pan/Pani" dryfuje u drugiego klienta** — **granica przyjęta
  23.08.2026, nie defekt do naprawienia.** Po przeniesieniu `zwrotDoKlienta` do
  pól klienta dryf spadł z 4/20 do **2/20** odpowiedzi i tam został. Naprawa
  deterministyczna po generacji **odrzucona** — patrz „Ślepe uliczki" i
  `DECYZJE.md` → „Poprawianie form adresatywnych". Osobny kształt: model potrafi
  pomylić **przypadek i rodzaj wewnątrz** form grzecznościowych („Panie grozi…
  udzielić Panu"), czego żadna podmiana wzorcem nie dosięga. Przeciwdziała się
  temu **treścią pisaną bezosobowo** tam, gdzie pomyłka boli najbardziej (`k25`)
- **Wycięcie ZAKAZU odwraca sens odpowiedzi** — warstwa progowa nie odróżnia
  trybu zdania. Zmierzone: „Aplikant nie może sporządzać skargi kasacyjnej"
  wycięte przy 0.469 wobec progu 0.48. W budowlance wycinane zdania były opisowe
- **Ściśnięte grupy na stykach obszarów** (problem 3 z mapy) — **zostawione
  świadomie** 19.08.2026. Odpowiedzi są trafne mimo małego odskoku lidera, a
  rozsuwanie fragmentów oznaczałoby przepisywanie treści pod wyszukiwarkę
- ~~**Problem 4**~~ — **zamknięty 21.08.2026 jako granica poznania.**
  To **nie jest** problem łączenia dwóch fragmentów: klauzula o 12% leży w tym
  samym fragmencie (`i01`, zdanie 2 z 5) co 22% i 14%, a model pomijał zdanie
  z fragmentu, który sam cytował. Zmierzone i wykluczone: pozycja zdania,
  długość fragmentu, retrieval, arytmetyka progu. Zostaje zależność od **formy
  powierzchniowej pytania**: „500 tysięcy złotych" → 12% w 2/6 przebiegów,
  „500 tysięcy" → 6/6, „600 tysięcy złotych" → 4/4. Pytanie z pierwotnego zapisu
  **przestało być odtwarzalne** (6/6). **Mechanizmu nie znamy — do czasu jego
  ustalenia żadnej reguły w prompcie „pod problem 4".** Szczegóły i tabele:
  `DECYZJE.md` → „Problem 4 — nowa diagnoza"
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
   - ~~**Etap 4: domknięcie problemów z pomiaru**~~ — ✅ **w części wykonane
     19.08.2026.** Naprawione **1** (próg zależny od długości + cytat dosłowny),
     **2** (warstwy znające tryb) i **5** (prompt: kroki tylko przy procedurze,
     zachowanie adresata). Problem **3** (ściśnięte grupy) zostawiony świadomie.
     Problem **4** zmierzony ponownie po naprawach i **nadal występuje** — patrz
     „Znane ograniczenia". Przy okazji znaleziono i opisano dwa nowe:
     `isDuplicate()` kasujący odrębne kroki i `numbersAreGrounded()` wycinający
     liczbę zacytowaną z pytania. Szczegóły: `DECYZJE.md` → „Progi zależne
     od długości".
   - ~~**Etap 4b: kategoria eskalacji**~~ — ✅ **wykonane 19.08.2026.** Trzeci stan
     odpowiedzi obok normalnej i „brak w dokumentacji": kroki z dokumentacji plus
     twarde skierowanie do przełożonego. Pięć kategorii, wyzwalanie deterministyczne
     wzorcami, osobne pole `eskalacja` w JSON. Patrz sekcja „Eskalacja" wyżej,
     uzasadnienia w `DECYZJE.md` → „Eskalacja".
   - ~~**Etap 5: synteza odpowiedzi wieloczęściowej**~~ — **przemianowane
     20.08.2026, bo diagnoza była błędna.** Pomiar wykluczył pozycję zdania,
     długość fragmentu, retrieval i arytmetykę progu; klauzula, której brakowało,
     leży w **tym samym fragmencie** co reszta odpowiedzi. Nie ma tu żadnej
     syntezy dwóch fragmentów do naprawienia.
   - ~~**Etap 5: kruchość na formie pytania**~~ — ✅ **zamknięte 21.08.2026 jako
     granica poznania.** Zmierzone na ścieżce produkcyjnej, osiem hipotez
     wykluczonych, wyzwalacz zawężony do kolokacji „za 500 tysięcy złotych"
     (drabina kwot: 410, 450, 550, 600, 800 → komplet; wyłącznie 500 zawodzi).
     Mechanizmu nie da się ustalić bez wglądu w model. **Zakaz reguły promptu
     „pod problem 4" zostaje w mocy także po zamknięciu.** Naturalny moment
     ponownego sprawdzenia to **zmiana modelu bazowego** — zjawisko jest
     własnością modelu, nie naszego kodu. `DECYZJE.md` → „Problem 4".
2. ~~**Druga branża**~~ — ✅ **ZAMKNIĘTA 22.08.2026.** Werdykt: protezą były
   wzorce i teksty, nie reguły — ani jedna zasada nie okazała się budowlana.
   Druga branża wymusiła **cztery zmiany w silniku** i wszystkie są ulepszeniami
   uniwersalnymi. **Struktura kosztu kolejnego klienta: 80% treść i słowniki
   branżowe, 15% testy i kalibracja, 5% infrastruktura; praca w silniku dąży
   do zera.** Pełne rozliczenie: `DECYZJE.md` → „Podsumowanie drugiej branży".
   - ~~**Etap 1: mechanizm wyboru klienta**~~ — ✅ **wykonane 22.08.2026.**
     Klient wynika z hosta, przestrzeń ma dwa wymiary, słowniki branżowe wyjęte
     z silnika, log i panele podpisane klientem, przełącznik demo pod `DEMO`.
     Prompt publiczny wyszedł bajt w bajt identyczny. `DECYZJE.md` → „Wybór klienta".
   - ~~**Etap 2: treść kancelarii**~~ — ✅ **napisana i zmierzona 22.08.2026.**
     24 fragmenty publiczne, 25 wewnętrznych, 8 kategorii eskalacji, obie
     przestrzenie zaindeksowane. Pomiar na 40 pytaniach: publiczne 6 luk/20
     (wszystkie bezpieczne — **zero porad prawnych**), wewnętrzne 0 luk/20.
     Mapa problemów i werdykt o uniwersalności warstw: `DECYZJE.md` →
     „Kancelaria — pomiar na 40 pytaniach".
   - ~~**Etap 3: decyzje po mapie**~~ — ✅ **cztery punkty naprawione i wdrożone
     22.08.2026** (`DECYZJE.md` → „Naprawy po mapie kancelarii"): ramka
     bezpieczeństwa w trybie publicznym, liczebniki słowne po stronie źródła,
     odmowa z uzasadnieniem, treść `k18`–`k20` przepisana pod słownictwo pytań.
     Pomiary: ramka 1/20 bez fałszywych alarmów, liczebniki 0 zmian na 119
     zdaniach sondy przy reprodukcji w teście celowanym, BudMax 4→3 luki na 8.
   - **Zostało otwarte po naprawach:**
     - ~~**Pomiar punktu 4**~~ — ✅ **wykonany 22.08.2026: treść wystarczyła.**
       Luki 6/20 → 1/20, wycięcia 4 → 2, porady prawne 0 → 0, ramka
       bezpieczeństwa 1/20. Przy okazji potwierdzony na żywo punkt 2: `k21`
       wszedł do zestawu i „14 dni" przeszło mimo zapisu „dwóch tygodni"
       w dokumentacji
     - ~~**p17 („zatrzymanie przez policję")**~~ — ✅ **ZAMKNIĘTE 24.08.2026.**
       Przyczyną nie było wahanie modelu ani `k25`, tylko **brak fragmentu**:
       p17 był ściśniętą grupą bez lidera już przed `k25` (odskok 0.024).
       Naprawa `k26`: luki **6/6 → 0/6**, lider 0.671, odskok 0.195, zero
       wycięć. `DECYZJE.md` → „p17 — rozstrzygnięcie"
     - **Wrogie sprawdzenie `obietnicePubliczne` kancelarii** — 0 wyzwoleń na
       46 zdaniach nie jest dowodem, że działają
     - **Eskalacja: w16 i naruszenie ochrony danych** — obie znane drogi naprawy
       w16 są gorsze niż defekt, patrz „Ślepe uliczki"
   - **Etap 4 (po stronie właściciela): trasy i Access dla kancelarii** — trzy
     wpisy w `[[routes]]` i dwie aplikacje Access. Dopiero wtedy demo da się
     pokazać na żywo i zmierzyć przez `POST /`, a nie przez `/debug`.
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
  `node test-access.mjs`, przy zmianach w eskalacji `node test-eskalacja.mjs`,
  przy zmianach w warstwach weryfikacji `node test-weryfikacja.mjs`,
  przy zmianach w tablicy klientów, hostach lub szablonach `node test-klienci.mjs`,
  a przy zmianach w słowniku kancelarii `node test-eskalacja-prawna.mjs`
- **`node --check` nie łapie wszystkiego — zmierzone 22.08.2026.** Dosłowny znak
  nowej linii wstawiony do szablonu promptu (niedomknięty literał) **przeszedł
  przez `node --check` bez zastrzeżeń**, a wywalił się dopiero przy `import`.
  Plik jest sprawdzany jako skrypt, nie jako moduł ES. Prawdziwą kontrolą są
  testy i `wrangler deploy --dry-run`
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
