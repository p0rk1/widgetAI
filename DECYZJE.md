# KnowBase — decyzje i uzasadnienia

Historia rozstrzygnięć projektu: **dlaczego** coś wygląda tak, jak wygląda,
czego już próbowano i co zostało odrzucone. Wydzielone z `CLAUDE.md` 19.08.2026,
bo tamten plik wczytuje się do kontekstu przy **każdej** sesji, a te treści są
potrzebne kilka razy w miesiącu — przy podważaniu decyzji, nie przy pracy.

**Ten plik czyta się na żądanie**, wybiórczo, po nagłówkach. `CLAUDE.md` odsyła
tu wszędzie tam, gdzie zostawia samą regułę bez uzasadnienia.

Zasada zapisu bez zmian: **wnioski i zakazy, nie proces dochodzenia do nich**.
Rzeczy porzucone zostają oznaczone jako ślepe uliczki **z powodem** — zniknięty
zapis wraca jako ten sam błąd za trzy sesje.

## Spis treści

- [Decyzje, do których nie wracać](#decyzje-do-których-nie-wracać)
- [Dlaczego 70B](#dlaczego-70b)
- [Adresy i domeny — dlaczego tak](#adresy-i-domeny)
- [Tożsamość i uprawnienia — dlaczego rozdzielone](#tożsamość-i-uprawnienia)
- [Cloudflare Access — co rozstrzygnięto 18.08.2026](#cloudflare-access--co-rozstrzygnięto-18082026)
- [Separacja przestrzeni wiedzy](#separacja-przestrzeni-wiedzy--na-poziomie-danych-nie-promptu)
- [Prompty — dwa tryby](#prompty--dwa-tryby-jeden-rdzeń-rzetelności)
- [Treść wewnętrzna i mapa problemów](#treść-wewnętrzna--41-fragmentów-i-mapa-problemów)
- [Progi zależne od długości, cytat dosłowny, warstwy znające tryb](#progi-zależne-od-długości-cytat-dosłowny-i-warstwy-znające-tryb)
- [Eskalacja — dlaczego wzorce, a nie ocena modelu](#eskalacja--dlaczego-wzorce-a-nie-ocena-modelu)
- [Deduplikacja: rozwinięcie to nie powtórzenie](#deduplikacja-rozwinięcie-to-nie-powtórzenie)
- [Granica dostawcy](#granica-dostawcy--model-i-baza-wektorowa-są-wymienne)
- [Interfejsy pracownicze](#interfejsy-pracownicze--aplikacja-etap-5-i-panel-etap-6)
- [Uziemienie liczb: rozstrzygnięcie po trybie (R3)](#uziemienie-liczb-rozstrzygnięcie-po-trybie-r3--20082026)
- [Problem 4 — diagnoza i zamknięcie](#problem-4--nowa-diagnoza-20082026-i-zamknięcie-21082026)
- [Panel wlasciciela na Access](#panel-właściciela-na-access--trzeci-host-rola-z-adresu-21082026)
- [Zmiana nazw hostow i koniec dopasowania po podciagu](#zmiana-nazw-hostów-i-koniec-dopasowania-po-podciągu-21082026)
- [Dokumentacja BudMax](#dokumentacja-budmax)

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

## Adresy i domeny

`know-base.app` jest w koncie Cloudflare. **Dwa hosty na klienta**, nie jeden:

| Host | Rola |
|---|---|
| `budmax.know-base.app` | publiczny endpoint widgetu |
| `budmax-pracownik.know-base.app` | bot dla pracowników, cały host za Access |
| `knowbase-budmax.rezi7608.workers.dev` | stary adres — **zostaje włączony** |

**Dlaczego dwa hosty, a nie jeden ze ścieżką.** Aplikacja Access obejmuje cały
host pracowniczy, więc nie ma tam ścieżki publicznej, którą dałoby się
przypadkiem odsłonić albo zablokować. Wariant „jeden host + Access na ścieżce
`/internal`" został **odrzucony**: ochrona stałaby wtedy na poprawnie wpisanym
polu `Path`, a pomyłka w nim albo odsłania tryb wewnętrzny, albo każe klientom
się logować. Rozdzielenie hostów usuwa cały ten rodzaj błędu.

**Dlaczego myślnik, a nie kropka** (`budmax-pracownik`, nie `internal.budmax`).
Darmowy certyfikat `*.know-base.app` pokrywa tylko jeden poziom subdomeny.
Trzeci poziom wymagałby płatnego certyfikatu.

**Dlaczego bez gwiazdki.** Trasa `*.know-base.app` obsłużyłaby wszystkich
klientów bez dopisywania czegokolwiek, ale Worker jest jednodzierżawny —
dowolna nieistniejąca subdomena odpowiadałaby dziś dokumentacją BudMaksu.
Wildcard ma sens dopiero po multi-tenant, gdy Worker rozpoznaje klienta po
hoście i odmawia nieznanym.

**Stary adres `workers.dev` zostaje.** `index.html` i `panel.html` mają go
wpisanego na sztywno w stałej `WORKER_URL`, więc wyłączenie zerwałoby widget
i panel natychmiast. Przeniesienie ich na `budmax.know-base.app` to osobna,
świadoma zmiana — wymaga edycji obu plików i `git push` (GitHub Pages),
nie `wrangler deploy`.

**`ALLOWED_ORIGINS` to lista, nie pojedyncza wartość.** `corsHeaders(request)`
odbija Origin, jeśli jest na liście, a w przeciwnym razie zwraca pierwszy wpis —
nieznany origin i tak zostanie zablokowany przez przeglądarkę. Nagłówek `Vary:
Origin` jest konieczny, żeby pośrednik nie podał jednemu klientowi odpowiedzi
zbuforowanej dla drugiego. Wpisy to sama domena bez ścieżki.

**Dług do spłacenia przy drugim kliencie:** każdy klient dostanie własną
aplikację Access (bo polityka dostępu jest inna dla każdej firmy), czyli własny
AUD — a `ACCESS_AUD` jest dziś pojedynczą wartością. Trzeba to będzie zamienić
na mapę `host → AUD`. Znany dług, nie przeoczenie.

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

**Konfiguracja.** `ACCESS_TEAM_DOMAIN = "knowbase.cloudflareaccess.com"` i `ACCESS_AUD`
(aplikacja „BudMax — tryb wewnętrzny") w `[vars]` w `wrangler.toml` — wypełnione 18.08.2026.
To **nie są sekrety** — bezpieczeństwo daje weryfikacja podpisu, nie tajność tych
wartości. Muszą być w pliku, a nie w dashboardzie, bo `wrangler deploy` skasowałby
zmienną, której w pliku nie ma. Krok po kroku: **`ZERO-TRUST.md`**.

**Ścieżka awaryjna.** Puste zmienne = tryb wewnętrzny wyłączony: `/internal` zwraca
**503 z listą brakujących zmiennych i odesłaniem do instrukcji**, nie milczące 403.
Odmowa dostępu i brak konfiguracji to dwie różne sytuacje i mają różne kody.

**Access nie obejmuje adresów `*.workers.dev`** — aplikacje self-hosted buduje się
z domen w koncie Cloudflare. Dlatego 17.08.2026 doszła domena `know-base.app`
i host `budmax-pracownik.know-base.app` (patrz „Adresy i domeny"). Custom domain
musi być także w `wrangler.toml` (`[[routes]]` z `custom_domain = true`), inaczej
deploy ją zdejmie. Aplikacja Access na tym hoście istnieje od 18.08.2026 —
`ZERO-TRUST.md`.

Konsekwencja dla starego adresu: `/internal` na `workers.dev` **nigdy nie zadziała**,
bo Access nie postawi tam tokenu. To poprawne zachowanie fail-closed, nie usterka —
tryb wewnętrzny ma jeden adres i jest nim host pracowniczy.

**Dwa hosty zwracają na `/internal` różne kody i tak ma być.** Na
`budmax-pracownik.know-base.app` żądanie bez sesji **nie dociera do Workera** —
Access zatrzymuje je na brzegu i odsyła **302** na ekran logowania. Kody Workera
(401 z powodem) widać tylko na `workers.dev` albo po przejściu przez Access.
Dlatego weryfikację tokenu testuje się na `workers.dev`, a samo Access — na hoście
wewnętrznym. Oczekiwanie „401 bez tokenu na hoście pracowniczym" było błędne.

**`identity` z tokenu** — `email` i `domena` są odczytywane i przekazywane do
`handleAsk()`, które odsyła je w polu `zalogowany`. Działanie potwierdzone
pomiarem 18.08.2026. **Nic po nich jeszcze nie filtruje.**

`domena` (część adresu po `@`) to **zaplanowany mechanizm rozpoznawania klienta**
w architekturze wielu firm: przy `@budmax.pl` i `@kancelaria.pl` z jednego zespołu
Access to ona powie Workerowi, czyją wiedzę wolno przeszukać. Dlatego jest
odczytywana już teraz, zanim cokolwiek po niej filtruje — razem z polem `role`
w metadanych i hostem per klient tworzy fundament, którego dopisanie później
kosztowałoby migrację u każdego klienta.

**Ograniczenie, które to niesie:** w pomiarze `domena` wyszła `gmail.com`, bo
logował się właściciel projektu. Adres prywatny nie niesie informacji o firmie —
jako sygnał tożsamości klienta pole zadziała dopiero przy domenach firmowych.
Rozpoznawanie klienta **nie może więc stać na samej domenie**; host żądania
zostaje drugim, niezależnym źródłem.

**Test:** `node test-access.mjs` — 14 przypadków, w tym ważny token, obcy podpis,
nieznany `kid`, wygasły, obce `iss`, obce `aud`, `nbf` w przyszłości, `alg: none`
i obie ścieżki awaryjne. Podstawia własną parę kluczy w miejsce kluczy zespołu,
więc sprawdza także przypadek pozytywny bez klikania w panelu. Testuje funkcję
importowaną z `worker.js`, nie jej kopię.

## Cloudflare Access — co rozstrzygnięto 18.08.2026

**Domena zespołu to `knowbase.cloudflareaccess.com` — mimo że ekran logowania
pokazuje `late-darkness-273f.cloudflareaccess.com`.** Sprawdzone 18.08.2026, bo
wyglądało to na rozjazd konfiguracji. Rozstrzyga `issuer` z
`https://knowbase.cloudflareaccess.com/.well-known/openid-configuration`
(= `https://knowbase.cloudflareaccess.com`), tam też leży JWKS i tam przekierowuje
sam Access. `late-darkness-273f` zwraca **404 na wszystkim** — dokładnie tyle, co
nazwa nieistniejącego zespołu — a w HTML strony logowania siedzi jako
`OrgAvatarLink-title`, czyli **pole wyświetlane** (*Custom pages*), nie domena
uwierzytelniania. **Nie „poprawiać" `ACCESS_TEAM_DOMAIN` na to, co widać na ekranie** —
Worker porównuje `iss` dosłownie, więc zerwałoby to logowanie na dwa sposoby naraz.

Napis na karcie logowania da się zmienić osobno (Zero Trust → *Custom pages* →
nazwa organizacji) **bez** dotykania domeny, tokenów i aplikacji. Prawdziwa zmiana
nazwy zespołu byłaby czymś innym: nowy `iss` (czyli `ACCESS_TEAM_DOMAIN` + deploy),
nowe adresy `callback` u Google i Microsoftu, ponowne logowanie wszystkich,
a stara nazwa wraca do puli i może ją zająć ktoś obcy. Gdyby kiedyś do tego doszło —
**przed** krokami 2–3 z `ZERO-TRUST.md`, nie po.

**AUD odczytuje się bez dashboardu i bez API.** Access dopisuje go jako parametr
`kid` do adresu logowania, na który przekierowuje niezalogowanego (`curl -D -` na
`/internal` hosta wewnętrznego, nagłówek `Location`), a towarzyszący `meta` JWT
powtarza tę wartość w polu `aud`. API `GET /accounts/{id}/access/apps` **odpada** —
token OAuth z `wrangler login` nie ma zakresów Zero Trust i zwraca pustą listę
(a `/access/organizations` błąd uwierzytelnienia), nie błąd uprawnień, więc łatwo
wziąć to za „aplikacji nie ma". AUD zweryfikowany 18.08.2026 kryptograficznie:
podpis meta-JWT sprawdzony kluczem z JWKS zespołu — poprawny, więc `31995d69…`
jest wartością tego zespołu, a nie przepisaną z przypadkowego ekranu.

**Pełna ścieżka potwierdzona pomiarem 18.08.2026 — luka w testach zamknięta.**
`POST /internal` z prawdziwym ciasteczkiem `CF_Authorization` (logowanie
One-time PIN) zwrócił:

```json
{"answer":"Standardowa marża na robociznę wynosi 22 procent.",
 "source":"Widełki marży i granica negocjacji","gap":false,"trimmed":0,
 "zalogowany":{"email":"…","domena":"gmail.com"}}
```

Jednym pomiarem potwierdzone naraz: Access wystawia token na tym hoście, Worker
weryfikuje go przeciw **prawdziwym** JWKS (brak 401 i 502), `/internal` sięga do
`INTERNAL_CHUNKS` (`source` = `i01`, treści nie ma w przestrzeni publicznej),
tożsamość jest odczytana (`zalogowany`), a weryfikacja zdanie po zdaniu niczego
nie wycięła (`trimmed: 0`). Wcześniej sprawdzone były **same odmowy** —
`test-access.mjs` (14/14) chodzi po **podstawionych** kluczach, więc nie zastępuje
tego testu. Procedura do powtórzenia po każdej zmianie w weryfikacji tokenu:
`ZERO-TRUST.md`, krok 8, sposób A.

**Obserwacja do etapu 3, nie usterka:** pytanie miało dwie części (marża standardowa
i granica negocjacji), a odpowiedź podała samo 22% — 14% zostało przemilczane przy
`trimmed: 0`, czyli model tego nie napisał, a nie że weryfikacja wycięła. `i01`
kończy się zdaniem „tych wartości nie komunikujemy", a `buildSystemPrompt()` jest
wspólny dla obu trybów i mówi o „stronie firmy". To pierwszy twardy dowód, że
**etap 3 (ton instruktażowy) jest potrzebny**, a nie kosmetyką.

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

**Rozdzielenie promptów niczego tu nie zmienia.** Wariant wewnętrzny każe modelowi
podawać wartości oznaczone jako niekomunikowane klientom — i to jest bezpieczne
dokładnie dlatego, że separacja stoi na danych: do publicznego endpointu fragmenty
z `internal` **nigdy nie trafiają do kontekstu**, więc nie ma czego ujawnić, nawet
gdyby prompt kazał. Gdyby kiedyś ktoś próbował zrobić odwrotnie — jeden prompt
i filtrowanie treści instrukcją — patrz akapit wyżej: to jest ta ślepa uliczka.

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

## Prompty — dwa tryby, jeden rdzeń rzetelności

Od 19.08.2026 `buildSystemPrompt(contextChunks, tryb)` jest **rozdzielaczem**,
a nie promptem. Wybiera między `buildPublicSystemPrompt()` a
`buildInternalSystemPrompt()`.

| Tryb | Kto pyta | Skąd bierze się tryb |
|---|---|---|
| `publiczny` | klient na stronie firmy | `trybPromptu(askedFrom)` w `handleAsk()` |
| `wewnetrzny` | zweryfikowany pracownik | to samo — `askedFrom` to `SPACE_INTERNAL` |

`trybPromptu()` **nie ma wartości domyślnej i rzuca wyjątkiem** przy nieznanej
przestrzeni — z tego samego powodu co `vectorSearch()`. Tryb przychodzi wyłącznie
z routingu, nigdy z ciała żądania. `/debug` wybiera wewnętrzny, gdy w zakresie
przeszukania jest przestrzeń `internal` (`space=internal` albo `space=obie`),
i **pokazuje wybór w polu `tryb_promptu`** — bez tego kalibracja byłaby zgadywaniem,
który prompt poszedł do modelu.

**Co jest wspólne: `PROMPT_RDZEN`** — trzy reguły chroniące przed halucynacją
(zakaz twierdzeń bez pokrycia we fragmentach, zakaz liczb spoza fragmentów,
dosłowne zdanie o braku informacji). Dopisując regułę rzetelności, dopisz ją
**tam**, a nie do jednego z wariantów — inaczej tryby się rozjadą i za trzy sesje
nikt nie będzie wiedział, który jest wzorcem.

**Zdanie o braku informacji musi zostać dosłowne w obu trybach.** `handleAsk()`
rozpoznaje brak odpowiedzi wyrażeniem `/nie mam takich informacji/i` na surowym
tekście modelu. Inne sformułowanie w trybie wewnętrznym po cichu rozjechałoby
tę ścieżkę — odpowiedź „nie wiem" przeszłaby dalej jako zwykła treść.

**Prompt publiczny nie zmienił się przy rozdzieleniu — sprawdzone bajt w bajt.**
Składa się z tych samych łańcuchów co wcześniej; trzy wspólne reguły są w nim
wstawiane przez `${...}`, więc wynik jest identyczny (3476 znaków przed i po,
porównanie przez `git show <commit>:worker.js`). To nie jest kosmetyka: publiczny
prompt jest kalibrowany od wielu sesji i **zmiana tonu nie ma prawa go dotknąć
przy okazji**.

### Co zmienia wariant wewnętrzny

Cztery rzeczy, każda z powodu:

1. **Jawność treści wewnętrznych.** Wprost: wartości oznaczone w dokumentacji
   jako niekomunikowane klientom podaje się pracownikowi z liczbami, a zdanie
   „tych wartości nie komunikujemy klientom" dotyczy rozmowy z klientem i **nie
   jest poleceniem zatajenia ich przed pracownikiem**. To reakcja na konkretną
   wpadkę z 18.08.2026 — model przemilczał 14% przy `trimmed: 0`.
2. **Ton instruktażowy** — tryb rozkazujący, kroki w kolejności wykonania,
   każdy w osobnej linii, od czasownika.
3. **Odpowiedź na wszystkie części pytania** — przy wartości standardowej i jej
   granicy podaje się obie. Niepełna odpowiedź jest tu groźniejsza niż w trybie
   publicznym: pracownik nie wie, czego nie dostał.
4. **Obowiązkowe źródło** — ostatnia linia `Podstawa: <tytuł fragmentu>`.

Zakazy zostały te same co publiczne plus dwa własne: nie uzupełniać procedury
BHP ani kadrowej „zdrowym rozsądkiem" i nie mylić wymagań obowiązkowych
z zalecanymi (`wymaga` ≠ `warto`). **Ten tryb zdejmuje zakaz ujawniania,
nie zakaz zmyślania.**

**Format cytowania jest dobrany pod istniejące warstwy, nie dowolny.**
`leaksInstructions()` wycina zwroty „zgodnie z dokumentacją", „według
fragmentów", „na podstawie fragmentów" — gdyby prompt kazał cytować tak,
weryfikacja kasowałaby każde cytowanie. Linia `Podstawa: …` przechodzi:
zmierzone podobieństwo 0.648–0.751, czyli powyżej `CITATION_THRESHOLD`, bo tytuł
fragmentu jest semantycznie blisko jego treści.

### Wynik kalibracji na trzech fragmentach testowych (19.08.2026)

Prompt kalibrowano na `INTERNAL_CHUNKS` **przed** pisaniem treści — to jest ta
warstwa, w której poprawki nakładają się na siebie, bo fragmenty są niezależne,
a prompt ma jeden wspólny stan.

| Pytanie | Wynik |
|---|---|
| marża + granica negocjacji (`i01`) | **22% i 14%** — komplet, wpadka z 18.08 naprawiona |
| BHP: co przed pracą na wysokości + kiedy nie wolno na rusztowaniu (`i02`) | 4 kroki w trybie rozkazującym + próg 10 m/s; wszystkie zdania mają pokrycie w `i02` |
| kadry: nadgodziny + urlop **w lipcu** (`i03`) | piątek do 14 **oraz** 14 dni (model sam zastosował regułę sezonową maj–wrzesień) |
| kontrola: marża na `space=public` | fallback, `tryb_promptu: publiczny` — publiczny nadal tej treści nie widzi |
| kontrola: elewacje na `space=public` | ton klientowski bez zmian, żadnej linii `Podstawa:` |

**Zero zdań wyciętych** przez weryfikację we wszystkich trzech pytaniach
wewnętrznych — ton rozkazujący nie fałszuje pokrycia, bo czasownik w trybie
rozkazującym jest semantycznie blisko opisu tej samej czynności.

**Czego to nie dowodzi:** trzy fragmenty testowe to nie dokumentacja. Prompt jest
skalibrowany na treści, którą sami napisaliśmy pod test — dopiero prawdziwa treść
(etap 4) pokaże, czy reguła „kroki w kolejności" nie łamie się na fragmentach
opisowych, które żadnej procedury nie zawierają.

## Treść wewnętrzna — 41 fragmentów i mapa problemów

Napisana 19.08.2026 w jednym podejściu, wszystkie obszary naraz — świadomie,
zamiast łatania po jednym. Powód: prompt był już skalibrowany, więc jedyną
zmienną zostawała treść, a problemy dało się zobaczyć zbiorczo, nim którykolwiek
zostanie „naprawiony" kosztem innego.

| Obszar | Fragmenty |
|---|---|
| BHP i wypadki | 11 (`i02`, `i04`–`i13`) |
| Kadry | 8 (`i03`, `i14`–`i20`) |
| Procedury na budowie | 7 (`i21`–`i27`) |
| Kontakt z klientem | 6 (`i28`–`i33`) |
| Sprzęt i materiały | 5 (`i34`–`i38`) |
| Finanse i negocjacje | 4 (`i01`, `i39`–`i41`) |

`i01`, `i02` i `i03` **zostały przy swoich identyfikatorach** — reindeks jest
idempotentny po ID, więc przenumerowanie zostawiłoby w indeksie sieroty po starych.
Dopisano im wyłącznie odsyłacze, treść merytoryczna bez zmian, więc kalibracja
promptu z 19.08 nadal obowiązuje.

Zasady pisania są te same co przy `CHUNKS` (otwarcie sformułowaniem pytającym,
odsyłacze w obie strony na stykach, liczby oparte o Kodeks pracy, przepisy BHP
i prawo budowlane) i są wypisane w komentarzu nad `INTERNAL_CHUNKS`. 42 odsyłacze,
wszystkie rozwiązują się do istniejących tytułów — sprawdzane skryptem, bo literówka
w tytule zamienia rozgraniczenie w martwy tekst.

### Wynik pomiaru zbiorczego (20 pytań, `/debug?space=obie`, wersja `7bbe9bf3`)

**Co wyszło dobrze:** 20/20 pytań ma lidera z przestrzeni `internal`, 20/20 kończy
się linią `Podstawa:`, żadnej luki dokumentacyjnej, żadnej liczby spoza fragmentów.
Odpowiedzi wieloczęściowe zwykle kompletne (nadgodziny 100% + limit 150 h, urlop
26 dni + 30 września, choroba + badanie kontrolne przez granicę kadry↔BHP).

**Pięć problemów — żaden nie dotyczy treści:**

1. **Próg 0.48 wycina krótkie zdania wyliczeń.** Wszystkie 4 wycięcia na 88 zdań
   są tej klasy: „okulary ochronne" (0.359 — i to była właśnie odpowiedź na pytanie),
   „Zatwierdza to zarząd." (0.466), „Ponownego wykonania wadliwie wykonanych robót."
   (0.461), „Nie uznawaj roszczenia i nie obiecuj naprawy ani odszkodowania." (0.467 —
   zdanie **dosłowne** z `i33`). Przyczyna nie leży w pokryciu, tylko w długości:
   krótkie zdanie ma niskie cosinus wobec długiego fragmentu. Ton instruktażowy
   („każdy krok w osobnej linii") produkuje takie zdania seryjnie, więc prompt
   wewnętrzny i weryfikacja pracują tu przeciwko sobie.
2. **`isUnsupportablePromise()` nie zna trybu.** Wzorzec
   `(oferujemy|udzielamy|mamy|przysługuj|…)…(rabat|zniżk|upust)` wycina „Przysługuje
   ci rabat do 3 procent" — dokładnie to, po co istnieje `i39`. Warstwa powstała dla
   bota publicznego. **`/debug` tego nie pokaże**: uruchamia samą warstwę semantyczną,
   bez `numbersAreGrounded()`, `isUnsupportablePromise()`, `leaksInstructions()`
   i `isDuplicate()`. Liczba wycięć z `/debug` jest więc **dolnym oszacowaniem**.
3. **Ściśnięte grupy na stykach obszarów.** Rękawice: `i08` i `i05` po 0.527,
   odskok **0.000**. Marża przy 500 tys.: `i01` 0.655 i `i39` 0.650, odskok 0.005.
   Upadek z rusztowania: liderem `i02` (0.592), a właściwy `i04` dopiero trzeci
   (0.572), z `i35` „Uszkodzenie sprzętu" pomiędzy nimi. Uwaga interpretacyjna:
   **to nie jest sygnatura z „Procedury łatania luk"** — tam ściśnięta grupa znaczy
   brak fragmentu, tu znaczy nadmiar fragmentów bliskich sobie. Odpowiedzi mimo to
   trafne, bo model wybiera z kontekstu poprawny fragment.
4. **Pytanie wieloczęściowe dostało pół odpowiedzi — mimo obu fragmentów w kontekście.**
   „Jaką marżę mogę zejść przy 500 tys. i kto zatwierdza": padło samo 12% po
   akceptacji zarządu, bez 22% i 14% i bez progów z `i39`, choć oba fragmenty były
   w kontekście z niemal równym wynikiem. To **nawrót wpadki z 18.08.2026** w innej
   postaci: wtedy prompt zatajał, teraz nie łączy dwóch fragmentów w jedną odpowiedź.
5. **Ton rozkazujący narzucony fragmentowi opisowemu.** `i25` (uprawnienia inspektora
   nadzoru) nie zawiera procedury, a model i tak wypisał listę wypunktowaną
   („może od ciebie żądać: Poprawek…"), z której jedna pozycja wypadła na progu.
   Przesunął też adresata: fragment mówi, że polecenia inspektora dostaje kierownik
   budowy, odpowiedź mówiła „od ciebie". To potwierdzenie przewidywania z 19.08 —
   reguła „kroki w kolejności wykonania" **łamie się na fragmentach opisowych**.

**Dwa drobiazgi warte odnotowania, nie problemy:** przy pytaniu o szkolenia BHP
model podał w `Podstawa:` także publiczny fragment `c34` (pracownik nie znajdzie go
w dokumentacji wewnętrznej), a w odpowiedzi o gotówce napisał „Zgodnie z procedurą" —
zwrot o włos od wzorców `leaksInstructions()`, których jeszcze nie rusza.

**Czego pomiar nie sprawdził:** pełnej ścieżki `POST /internal` z prawdziwym
tokenem. `/debug` omija Access i trzy z czterech warstw weryfikacji — po naprawach
trzeba powtórzyć pomiar sposobem A z `ZERO-TRUST.md`, krok 8.

## Progi zależne od długości, cytat dosłowny i warstwy znające tryb

Naprawa problemów 1, 2 i 5 z mapy, 19.08.2026. Problem 3 zostawiony świadomie,
problem 4 zmierzony ponownie i **nadal otwarty**.

### Skąd wzięły się progi 0.45 / 3 słowa

Rozkład na 89 zdaniach z przebiegu 20 pytań wewnętrznych, w kubełkach po długości:

| Słów | n | min | mediana | max | poniżej 0.48 |
|---|---|---|---|---|---|
| 1–3 | 3 | 0.458 | 0.520 | 0.581 | 1 |
| 4–6 | 9 | 0.438 | 0.575 | 0.663 | 1 |
| 7–10 | 35 | 0.467 | 0.651 | 0.761 | 1 |
| 11–15 | 26 | 0.537 | 0.690 | 0.747 | 0 |
| 16+ | 16 | 0.622 | 0.740 | 0.829 | 0 |

Rozstrzygające jest zestawienie dwóch liczb: najniższe **przechodzące** zdanie
1–3-słowowe miało **0.520**, a wycinane były **0.458** i **0.466**. Między nimi
jest pusty pas, w którym nie leży nic, co dziś przechodzi — próg **0.45** dla
zdań do 3 słów mieści się w tym pasie. Obniżenie progu **z definicji** nie może
wyrzucić niczego, co przechodziło wcześniej; ryzykiem jest wyłącznie wpuszczenie
czegoś nowego, dlatego zejście zatrzymano na 0.45, a nie na 0.36, którego
wymagałoby „okulary ochronne".

**Nie robić z tego progu ogólnego zjazdu.** Kubełki 4–6 i 7–10 mają wycięcia
o niskim cosinusie, ale **wszystkie są dosłownymi cytatami** i łapie je druga
droga pokrycia. Obniżanie progu dla zdań dłuższych nie ma podstawy w danych.

### Cytat dosłowny jako druga droga pokrycia

Zdanie występujące **dosłownie** w pobranym fragmencie przechodzi bez względu
na cosinus: tekstu, który fizycznie stoi w dokumentacji, nie da się uznać za
niepokryty. To właściwa odpowiedź na „Nie uznawaj roszczenia i nie obiecuj
naprawy ani odszkodowania" (0.467, zdanie żywcem z `i33`) — nie obniżanie progu
dla wszystkich dziewięciosłowowców.

**Pułapka, którą trzeba było obejść: zgubione zaprzeczenie.** „zakrywaj zbrojenia"
jest dosłownym podciągiem „nie zakrywaj zbrojenia", więc sam `includes` przepuściłby
zdanie o **odwróconym** znaczeniu. Dlatego trafienie poprzedzone partykułą przeczącą
(`nie`, `bez`, `nigdy`, `ani`, `żadn`) się nie liczy — musi istnieć wystąpienie bez
niej. Minimalna długość dopasowania to 12 znaków po normalizacji, żeby pojedyncze
słowo nie potwierdzało samo siebie.

Cytat dosłowny zastępuje **wyłącznie** sprawdzenie semantyczne. Liczby i obietnice
są sprawdzane tak samo, bo dosłowność jednego zdania nie usprawiedliwia zmyślonej
liczby dostawionej obok.

### Dlaczego warstwy dostały tryb

`isUnsupportablePromise()` i `leaksInstructions()` powstały dla bota publicznego
i **wycinały w trybie wewnętrznym dokładnie to, po co ten tryb istnieje**:

- „Przysługuje ci rabat do 3 procent" pasuje do wzorca rabatowego — a to jest treść
  `i39`, informacja o progu decyzyjnym, nie obietnica złożona klientowi.
- Zakaz mówienia „zgodnie z dokumentacją" istnieje dlatego, że **klient nie wie**
  o istnieniu dokumentacji. Pracownik wie — sam prompt każe mu podać `Podstawa:`.

Co zostało wspólne: **wolne terminy i obietnice zdążenia**. Dokumentacja nie zna
grafiku ekip, więc zmyślony termin szkodzi wewnątrz tak samo jak na zewnątrz.

### Dwa defekty znalezione przy okazji — nienaprawione

Znalazły się dopiero wtedy, gdy `/debug` zaczął uruchamiać wszystkie warstwy,
a nie samą semantyczną. **Wcześniej były niewidoczne w każdym pomiarze, jaki
robiliśmy** — stąd zapis z 19.08 „20/20 odpowiedzi z linią `Podstawa:`" dotyczył
w rzeczywistości surowego tekstu modelu, a nie tego, co wychodziło z weryfikacji.

1. **`isDuplicate()` kasuje odrębne kroki procedury.** Przy odpowiedzi na `i23`
   („co przed zakryciem zbrojenia") dwa różne kroki — „nie zakrywaj zbrojenia przed
   odbiorem" i „przed zakryciem wykonaj dokumentację zdjęciową" — przekroczyły próg
   60% wspólnych słów i drugi zniknął. Razem z nimi zniknęła linia `Podstawa:`,
   bo tytuł fragmentu z definicji dzieli słowa ze zdaniem opartym na jego treści.
   Wszystko **po cichu**: deduplikacja nie zwiększa licznika `trimmed`.
   Naprawiono **wyłącznie wyjątek dla linii `Podstawa:`**. Progu 0.6 nie ruszano —
   dotyczy też trybu publicznego, więc wymaga własnego pomiaru, a nie poprawki
   przy okazji.
2. **`numbersAreGrounded()` nie odróżnia liczby zmyślonej od zacytowanej z pytania.**
   „przy pojemności 1600 cm3" wycina całe zdanie, bo `1600` przyszło z pytania,
   a dokumentacja zna tylko próg 900. Zachowanie jest bezpieczne, ale kosztuje
   poprawną odpowiedź, i dotyczy obu trybów.

### Prompt: trzy podejścia do adresata, i czego uczy drugie

Reguła „zachowaj adresata z fragmentu" **nie zadziałała za pierwszym razem** —
na „czego może ode mnie żądać inspektor" model dalej pisał „może od ciebie żądać",
bo powtarzał założenie z pytania. Druga wersja kazała sprostować takie założenie
i zadziałała, ale **zaczęła strzelać tam, gdzie nie trzeba**: pytanie „kto może
wpisywać do dziennika budowy" dostało doklejone sprostowanie o poleceniach
inspektora, o które nikt nie pytał. Winna była lista wyzwalaczy, którą podałem
w regule („ode mnie", „czy mogę", „co mam zrobić") — zbyt szeroka. Trzecia wersja
opisuje **warunek**, a nie słowa kluczowe: sprostowanie należy się tylko wtedy,
gdy pytanie przypisuje rozmówcy obowiązek, który we fragmencie należy do kogoś
innego.

Wniosek na przyszłość: **regułę promptu opisuj warunkiem, nie listą fraz.** Lista
fraz jest łatwiejsza do napisania i model dopasowuje ją zbyt chętnie — koszt
widać dopiero na pytaniu, które tych fraz nie miało zawierać.

### Wynik pomiaru kontrolnego

Te same 20 pytań, przed i po. Dla przebiegu „przed" straty policzone offline
**prawdziwymi funkcjami** z `worker.js`, bo ówczesny `/debug` ich nie pokazywał.

| | przed | po |
|---|---|---|
| zdań w odpowiedziach | 89 | 71 |
| wycięte (brak pokrycia / liczba / obietnica) | 4 | **0** |
| usunięte po cichu (duplikat / instrukcje) | 4 | **0** |
| razem utraconych | **8 z 89** | **0 z 71** |
| lider z przestrzeni `internal` | 20/20 | 20/20 |

Odpowiedzi są **krótsze** (89 → 71 zdań), bo prompt przestał wymuszać listę tam,
gdzie fragment żadnej procedury nie zawiera. To jest zamierzone, nie utrata treści:
`i25` odpowiada teraz zdaniami i z poprawnym adresatem („Inspektor nie wydaje
poleceń bezpośrednio Tobie, ale kierownikowi budowy"), zamiast wypunktowanej listy
z jedną pozycją uciętą na progu.

Uwaga do czytania tej tabeli: w przebiegu „po" **żadne zdanie nie potrzebowało
ratunku** ani progiem 0.45, ani cytatem dosłownym. Obie drogi są dziś siatką
bezpieczeństwa, a nie mechanizmem, na którym stoi wynik — bo prompt przestał
produkować zdania, które ich wymagały. Nie znaczy to, że są zbędne: kolejna
zmiana tonu albo fragment o innej budowie zdań wrócą do tego pasa.

## Eskalacja — dlaczego wzorce, a nie ocena modelu

Trzeci stan odpowiedzi, 19.08.2026. Reguły operacyjne są w `CLAUDE.md` → „Eskalacja";
tutaj powody i dwie pułapki, które kosztowały najwięcej.

### Dlaczego deterministycznie

Kuszące było oddanie tej oceny modelowi — „rozpoznaj, czy sytuacja jest pilna".
Odrzucone: model, który raz na dwadzieścia odpowiedzi uzna wypadek za pytanie
o procedurę, jest bezużyteczny jako **zabezpieczenie**. Ta warstwa stoi na tej
samej zasadzie co `numbersAreGrounded()`: ma dawać gwarancję, nie
prawdopodobieństwo. Przy BHP błąd nie kosztuje złej recenzji, tylko zdrowia.

### Dlaczego wyzwalacz idzie po zdarzeniu, a nie po temacie

Wprost z wniosku o regule adresata: lista fraz odpala się zbyt chętnie. Gdyby
kategoria „wypadek" reagowała na słownictwo **tematyczne** — rusztowanie, wysokość,
BHP, szkolenie — ramka pojawiłaby się przy „co ile odnawiamy szkolenie BHP", czyli
w połowie normalnych pytań. Pracownik nauczyłby się ją przewijać i nie zobaczyłby
jej wtedy, gdy będzie potrzebna. Dlatego wyzwala **słownictwo zdarzeniowe**:
spadł, złamał, krwawi, przygniotło, poszkodowany.

Miara skuteczności tego rozróżnienia: na standardowym zestawie 20 pytań eskalacja
odpaliła **4 razy i wszystkie 4 były trafne**, przy zerowych fałszywych
wyzwoleniach na 16 pozostałych. Warto zauważyć, że pytanie o **inspektora nadzoru
inwestorskiego** nie eskaluje, a o **inspektora pracy** tak — to nie przypadek:
inspektor nadzoru reprezentuje inwestora i jest normalnym elementem budowy,
a nie organem kontroli.

### Dlaczego próg jest różny dla różnych kategorii

Koszt pomyłki jest asymetryczny i **inny w każdą stronę zależnie od kategorii**:

- Przy wypadku i zagrożeniu życia fałszywy alarm kosztuje jedno zdanie za dużo,
  a przeoczenie — zdrowie. Wyzwalamy szeroko, a **weto ramy informacyjnej
  celowo nie działa**: „kto zgłasza wypadek śmiertelny do PIP" dostaje ramkę,
  choć jest pytaniem o regułę.
- Przy sporze, kontroli i finansach fałszywy alarm to szum. Wymagamy **dwóch
  niezależnych sygnałów** (organ *oraz* jego obecność; pieniądze *oraz* decyzja
  *oraz* przekroczony próg) i wetujemy pytania o samą regułę.

To jest odpowiedź na „nie opieraj się wyłącznie na słowach kluczowych": różnicuje
nie długość listy, tylko **reguła decyzyjna**, dobrana do kosztu pomyłki.

### Dlaczego ramka omija weryfikację

Skierowanie do przełożonego **nie pochodzi z żadnego fragmentu**, więc
`verifyClaims()` wyciąłby je jako twierdzenie bez pokrycia, a `isDuplicate()`
mógłby skasować przy powtórzeniu. Rozważane były trzy wyjścia:

1. dopisać ramkę jako fragment do `INTERNAL_CHUNKS` — **odrzucone**, bo wtedy
   trafiałaby do kontekstu modelu i konkurowała w retrievalu z prawdziwą treścią;
2. zrobić wyjątek w `verifyClaims()` na ten konkretny tekst — **odrzucone**,
   bo to osłabia weryfikację o furtkę, którą kiedyś przejdzie coś innego;
3. **doklejać ramkę po weryfikacji, ze stałej w kodzie** — wybrane.

Trzecie jest jedynym, w którym weryfikacja dla reszty odpowiedzi **nie zmienia
się ani o jotę**: `verifyClaims()` nadal widzi wyłącznie tekst modelu i traktuje
go tak samo surowo. Ramka to reguła operacyjna firmy, nie twierdzenie
o dokumentacji — nie ma czego weryfikować względem fragmentów.

Skutek uboczny, świadomie zaakceptowany: przy wypadku skierowanie do kierownika
budowy pada **dwa razy** — raz w ramce, raz w krokach z `i04`, które też każą go
powiadomić. W sytuacji awaryjnej powtórzenie najważniejszej instrukcji nie jest
defektem.

### Dwie pułapki, które kosztowały 11 i 1 przypadek testowy

1. **`\b` w JavaScripcie zna wyłącznie ASCII.** `\bmarż\b` nie dopasuje się do
   „marżę", bo `ż` i `ę` nie są dla niego znakami słowa — granica wypada
   w środku wyrazu albo nie wypada wcale. Pierwsza wersja warstwy milczała
   na **11 z 41** przypadków. Zastąpione przez `(?<![a-z0-9])` bez ogona:
   dopasowanie ma zaczynać się na granicy wyrazu, ale wolno mu przejść
   w dowolną końcówkę fleksyjną. **Nie wracać do `\b`.**
2. **Pracownik pisze bez ogonków.** Wzorzec wymagający „sądem" nie zadziałał na
   „grozi sadem" — a tak właśnie wygląda pytanie pisane z telefonu na budowie.
   Wykryte dopiero na żywym `/debug`, bo w teście jednostkowym sam pisałem
   poprawną polszczyzną. Pytanie jest teraz normalizowane (`bezOgonkow()`),
   a wzorce zapisane bez ogonków. Zestaw bez ogonków został w teście na stałe.

Wniosek ogólniejszy: **test pisany przez tę samą osobę, która pisała wzorce,
odtwarza jej własne założenia.** Przypadek z ogonkami znalazł się wyłącznie
dlatego, że sprawdzenie na żywo poszło z linii poleceń, gdzie wygodniej było
napisać bez polskich znaków.

### Znalezione przy okazji: sprostowanie adresata kasuje treść

Reguła adresata z poprzedniej sesji weszła w konflikt z `isDuplicate()`.
Na pytanie o inspektora nadzoru odpowiedź zaczyna się teraz od zdania
sprostowującego, a właściwa treść — dłuższa i niosąca konkrety — dzieli z nim
słownictwo i **znika jako duplikat** przy podobieństwie 0.775. To ta sama
usterka co przy krokach `i23`, ale trafia w główną ścieżkę i pojawiła się
**w wyniku naszej własnej poprawki**.

Proponowana poprawka (niewykonana, bo dotyka też trybu publicznego): nie uznawać
za duplikat zdania **istotnie dłuższego** od tego, z którym się pokrywa —
dłuższe zdanie jest rozwinięciem, nie powtórzeniem.

## Deduplikacja: rozwinięcie to nie powtórzenie

Naprawa 20.08.2026 usterki opisanej dzień wcześniej w „Eskalacja".

### Najpierw pomiar na trybie publicznym

Warstwa dotyczy obu trybów, a sprawdzana była tylko na wewnętrznym — więc zanim
cokolwiek zmieniliśmy, poszedł zestaw **20 pytań klienta** (w tym cztery długie,
wielowątkowe, bo te generują najdłuższe odpowiedzi i najwięcej okazji do
fałszywej deduplikacji) przez `/debug?space=public`.

| Tryb | Zdań | Zdania stracone na `isDuplicate()` |
|---|---|---|
| publiczny, przed | 66 | **0** |
| wewnętrzny, przed | 73 | 1 |

**Defekt nigdy nie dotykał obecnych klientów.** Powód jest strukturalny, nie
przypadkowy: odpowiedzi publiczne to proza o zmiennym słownictwie, a wewnętrzne
to listy kroków, w których te same rzeczowniki („zbrojenie", „kierownik budowy")
wracają w co drugim zdaniu. Do tego doszło zdanie sprostowujące adresata, które
sami dodaliśmy — i to ono kasowało treść merytoryczną.

To jest też odpowiedź na pytanie, dlaczego usterka przeżyła tyle sesji: **żaden
pomiar publiczny nie mógł jej pokazać, bo tam jej nie ma.**

### Na czym polega poprawka

Pokrycie liczone jest wobec **krótszego** zdania, więc zdanie zawierające
wszystkie słowa krótszego ma pokrycie 1.0 — nawet gdy dokłada dwa razy tyle
treści. Sam próg pokrycia nie odróżnia powtórzenia od rozwinięcia, bo mierzy
tylko to, co się powtarza, a nie to, co dochodzi.

Stąd **drugi warunek**: zdanie wnoszące co najmniej `DUPLIKAT_NOWE_SLOWA` (4)
nowych słów treściowych jest rozwinięciem i zostaje, choćby powtarzało wszystko
z poprzedniego. Progu pokrycia 0.6 **nie ruszano** — nie on był źle dobrany.

Świadomie przyjęty koszt: rozwlekła parafraza, która dorzuca cztery nowe słowa
nic nie wnosząc, przejdzie. Wybór jest między utratą treści a powtórzeniem,
a przy instrukcji BHP powtórzenie jest tańsze.

### Wynik

| Tryb | Przed | Po |
|---|---|---|
| publiczny | 0 / 66 | **0 / 69** |
| wewnętrzny | 1 / 73 | **0 / 72** |

Odpowiedź na `i25` zawiera teraz komplet: sprostowanie adresata **oraz** zdanie
o uprawnieniach inspektora, które wcześniej znikało.

Prawdziwe powtórzenia nadal wypadają — sprawdza to `test-weryfikacja.mjs`
na parafrazach, zmienionym szyku i powtórzeniu z jednym dodatkowym słowem.
Test powstał właśnie przy tej poprawce: warstwa usuwająca treść bez licznika
zasługuje na własny zestaw przypadków, bo jej regresji nie widać w pomiarze.

### Ślad w metrykach — żeby następny taki defekt nie był niewidoczny

Usterka przeżyła tyle sesji dlatego, że `isDuplicate()` i `leaksInstructions()`
usuwają zdanie **bez zwiększania licznika `trimmed`**. To była świadoma decyzja
(defekt formy, nie brak pokrycia — pytającego nie interesuje) i zostaje, ale
„po cichu dla pytającego" nie może znaczyć „bez śladu nigdzie".

Rozwiązanie w trzech krokach, **bez zmiany kształtu odpowiedzi dla widgetu**:

1. `verifyClaims()` zwraca `cicho: {duplikat, instrukcje}`;
2. `logQuestion()` zapisuje to pole do logu w KV — tylko gdy niezerowe, żeby nie
   puchł każdy wpis;
3. `/stats` sumuje je w bloku `diagnostyka`, liczonym po **wszystkich** wpisach,
   także wewnętrznych. To **same liczby, bez treści pytań**, więc nie narusza
   zasady, że panel właściciela firmy nie pokazuje pytań pracowników.

Odpowiedź `POST /` nie zmienia się o ani jedno pole. Panel nowego bloku nie zna
i nie musi — jest dla nas.

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

## Interfejsy pracownicze — aplikacja (Etap 5) i panel (Etap 6)

Dopisane 20.08.2026, po fakcie: oba etapy powstały w sesji, która nie znała
historii projektu, i `DECYZJE.md` o nich nie wiedział.

**Co doszło:** `GET /app` (`app-internal.js`) — aplikacja asystenta budowy,
mobile-first, z dyktowaniem i kaflami szybkiego startu. `GET /panel`
(`panel-internal.js`) — panel luk szkoleniowych i eskalacji. `GET /stats-internal`
— dane dla tego panelu, **autoryzowane tokenem Access**, nie `REINDEX_SECRET`.

**Rozstrzygnięcie warte zapamiętania:** `/stats-internal` jest pierwszym
endpointem analitycznym, który wyszedł spod klucza administratora. To kierunek
docelowy także dla `panel.html` — dziś właściciel firmy dostaje klucz otwierający
również `/purge` i `/reindex`. Nie zmieniamy tego przy okazji, ale wzorzec już
istnieje w kodzie.

**Naprawione 20.08.2026:** oba interfejsy odpowiadały `200` na **publicznej
domenie klienta** i na `workers.dev`, bo warunek trasy sprawdzał samą ścieżkę.
Danych to nie wystawiało — strony wołają `/internal` i `/stats-internal`, a te
bez tokenu zwracają 401 — ale interfejs pracowniczy nie ma czego szukać pod
adresem, na który wchodzi klient. Dziś `/app`, `/panel` i `GET /` przechodzą
przez `hostPracownika(url)`; poza hostem pracowniczym ścieżki nie istnieją.
Osobna funkcja, nie wklejony warunek — przy multi-tenant zmieni się jedno miejsce.

## Uziemienie liczb: rozstrzygnięcie po trybie (R3) — 20.08.2026

### Problem i badane warianty

Otwarty defekt „`numbersAreGrounded()` nie odróżnia liczby zmyślonej od
zacytowanej z pytania" został zbadany na korpusie prawdziwych odpowiedzi modelu
(22 pytania × 2 przebiegi, 19 zdań z liczbami z pytania).

Badano **cztery** reguły na 14 przypadkach z etykietami (7 zdań klasy A z korpusu
prawdziwych odpowiedzi, 1 zdanie z liczbą wyliczoną przez model, 6 zdań klasy B):

| reguła | wynik | co psuje |
|---|---|---|
| **bazowa**: surowa, bez pytania (stan przed zmianą) | 7/14 | gubi wszystkie 7 zdań klasy A (parametry pracownika) |
| **R1**: liczba z pytania dozwolona, gdy zdanie zawiera też liczbę **uziemioną** | 9/14 | gubi zdania odmowne („nie możesz zatwierdzić odstępstwa za 7000 zł" — brak drugiej liczby w zdaniu); **przepuszcza zdanie mieszane** „Tak, remont kosztuje 1200 zł za metr, a zaliczka wynosi 10 procent" |
| **R2**: liczba z pytania dozwolona zawsze | 8/14 | przepuszcza wszystkie przypadki wrogie (narzucanie cen przez klienta) |
| **R3**: dozwolona tylko w trybie wewnętrznym | **14/14** | przyjęta — patrz zastrzeżenie i warunek niżej |

**R1 jest tu najważniejszym odrzuconym kandydatem** i dlatego zostaje w zapisie:
był jedynym wariantem **strukturalnym**, czyli takim, który rozdzielałby klasy bez
oglądania się na tryb. Przegrał na dwóch rzeczach naraz — gubił zdania odmowne,
w których liczba pytającego jest jedyną liczbą w zdaniu, i przepuszczał zdanie
mieszane, gdzie podsunięta cena sąsiaduje z liczbą uziemioną. Nie proponować go
ponownie bez pomiaru na obu tych przypadkach. **Sprawdzony szerzej i ostatecznie
odrzucony 21.08.2026** — patrz „Tryb publiczny — rozstrzygnięte".

### Dlaczego rozdzielenie formą nie jest wykonalne

Rozdzielenie klasy A (parametry podawane w dobrej wierze) od klasy B (próba
przypisania firmie nieprawdziwych warunków) **nie jest wykonalne deterministycznie
po strukturze zdania**, ponieważ różnica leży w znaczeniu, a nie w formie:
- Ten sam przyimek obsługuje obie klasy: „nie możesz zatwierdzić odstępstwa **za** 7000 zł" (odmowa, zostawić) vs „remont kosztuje 1200 zł **za** metr" (przypisanie firmie, wyciąć).
- Pozycja liczby w zdaniu również nie rozdziela: „Twoje 55 godzin przekracza limit" (podmiot) vs „kosztuje 1200" (po czasowniku) vs „Przy zleceniu za 250 000 zł możesz udzielić rabatu" (początek zdania).
- Każde kryterium formalne redukuje się do zawodnej warstwy wzorców ze spadającym zwrotem.

### Wariant R3 — uzasadnienie i warunek utrzymania

Przyjęto wariant R3 (`numbersAreGrounded(sentence, filtered, tryb = PROMPT_PUBLICZNY, userQuestion = "")`):
- **Publicznie:** zbiór liczb z pytania jest pusty — ścieżka nie istnieje. Reguła surowa bezwzględnie blokuje narzucanie cen i terminów przez klienta.
- **Wewnętrznie:** liczba z pytania uziemia zdanie modelu.
- **W obu trybach:** liczby wyliczone przez model (arytmetyka) oraz zmyślone liczby spoza fragmentów i pytania wypadają tak samo jak dotąd.
- **Domyślny tryb:** publiczny (surowy).

**R3 jest wariantem świadomie gorszym, przyjętym jako mierzalny.** To nie jest
najlepsza reguła, tylko jedyna, którą da się utrzymać deterministycznie —
i trzeba czytać jej wynik z dwoma zastrzeżeniami:

1. **14/14 jest częściowo artefaktem etykietowania.** W zbiorze wszystkie przypadki
   klasy A wypadły w trybie wewnętrznym, a wszystkie klasy B w publicznym. R3
   **nie rozdziela A od B wewnątrz trybu** — ono to pytanie omija. Gdyby klasa B
   pojawiła się wewnętrznie, R3 by jej nie zatrzymało.
2. Publicznie defekt klasy A **zostaje nienaprawiony**. Kosztuje to niewiele
   (zmierzone: 2 zdania na 15, 0 odpowiedzi zredukowanych), bo treść publiczna
   prawie nie ma progów zależnych od liczby podanej przez klienta — ale nie jest
   to zero.

> [!IMPORTANT]
> **Warunek konieczny:** Skuteczność R3 zależy od zachowania modelu (odmowy 6/6 przy podsuwaniu wartości ponad próg), a nie od gwarancji strukturalnej. Przy zmianie modelu bazowego lub promptu wewnętrznego **ten wariant musi zostać bezwzględnie przemierzony na nowo**.

### Kluczowy wynik pomiaru: zbiór B_wewn

Najmocniejszym i nieprzewidzianym argumentem za R3 okazał się zbiór `B_wewn`:
gdy pracownik pytał o wartość przekraczającą próg (np. „Czy mogę dać rabat 15%?"),
model poprawnie odpowiadał odmową cytującą liczbę pytającego:
*„Nie, nie możesz dać rabatu 15 procent samodzielnie — próg to 3 procent."*
Stara reguła surowa wycinała całe zdanie odmowne jako „nieuziemione", więc
pracownik dostawał ciszę zamiast odpowiedzi. W R3 pracownik otrzymuje pełną,
prawidłową odpowiedź.

### Dlaczego publicznie ta warstwa jest jedyną, jaka tam stoi

Zapis przywrócony 21.08.2026 — został skasowany przy przepisywaniu sekcji, a jest
uzasadnieniem połowy tej decyzji. Zmierzone prawdziwą funkcją, tryb publiczny:

| zdanie modelu | pytanie | reguła surowa | z liczbą z pytania |
|---|---|---|---|
| „Tak, remont łazienki kosztuje 1200 zł/m²." | „Czy remont kosztuje 1200 zł/m²?" | **wycięte** | **przechodzi** |
| to samo zdanie | bez pytania | wycięte | wycięte |

Sprawdzone, czy łapie to inna warstwa: `isUnsupportablePromise()` w trybie
publicznym **przepuszcza** zdanie o cenie (jego wzorce celują w rabaty i terminy).
Zostaje sama weryfikacja semantyczna — ta, o której ten plik notuje niżej, że
przepuściła zdanie o nieoferowanej usłudze z wynikiem **0.676**. Dlatego wariant
publiczny nie rozluźnia się nawet o krok.

Uczciwe zastrzeżenie do klasy B: w pomiarze **model ani razu nie wziął przynęty** —
8/8 pytań publicznych z podsuniętą ceną skończyło się odesłaniem do biura albo
sprostowaniem z dokumentacji, więc zdania klasy B są w większości **syntetyczne**.
Reguła publiczna broni więc przed scenariuszem obserwowanym jako możliwy, nie jako
występujący. Kosztuje nic i zostaje, ale to jest zabezpieczenie na zmianę modelu
lub promptu, a nie odpowiedź na bieżące zachowanie.

### Pomiar przed i po — cztery zbiory, po 2 przebiegi

| zbiór | wycięte na regule liczb | odpowiedzi zredukowane do samej linii `Podstawa:` |
|---|---|---|
| **A_wewn** — pracownik podaje parametr | 13/40 → **3/37** | 7/16 → **1/16** |
| **A_publ** — klient podaje parametr | 2/15 → 2/15 | 0 → 0 |
| **B_publ** — klient podsuwa cenę | 0/13 → 0/12 | 2 → 2 |
| **B_wewn** — pracownik podsuwa wartość ponad próg | 6/30 → **0/31** | 2 → **0** |

Zero potwierdzeń liczby z pytania w zdaniu twierdzącym w obu zbiorach B, przed i po.

**Trzy wycięcia, które zostały w A_wewn, są poprawne** — wszystkie trzy to
arytmetyka modelu: „czyli do 7500 złotych", „połowa diety to 22,5 złotych". Tych
liczb nie ma ani we fragmentach, ani w pytaniu, więc wypadają i mają wypadać.
To jest własność, na której zależało: **R3 rozluźnia uziemienie o liczby pytającego,
a nie o liczby wymyślone**.

Tryb publiczny nietknięty, sprawdzony dwiema drogami: zbiory `A_publ` i `B_publ`
bez zmian co do zdania, oraz pełny zestaw 20 pytań publicznych — 0 realnych wycięć,
średni wynik lidera **0.6771**, identyczny co do czwartego miejsca z pomiarami
sprzed zmiany.

### Skala defektu przed naprawą — dla porównania

Pomiar z 20.08.2026 na 6 pytaniach, w których pytający podaje własną liczbę,
po 3 przebiegi (zapis przywrócony 21.08.2026):

| | wynik |
|---|---|
| zdań łącznie | 39 |
| wyciętych na regule liczb | **12** |
| odpowiedzi zredukowanych do samej linii `Podstawa:` | **6 z 18 przebiegów** |

Mechanizm: model **powtarza kwotę z pytania** w zdaniu odpowiedzi („Przy zleceniu
o wartości 500 000 złotych standardowa marża wynosi 22 procent…"), całe zdanie
wypada na regule liczb, a pytającemu zostaje sam nagłówek źródła. Pytania,
w których model kwoty nie powtarza („Mam 12 lat stażu…"), nie tracą nic.

Pomiary `test-weryfikacja.mjs` (26/26 zdanych) pilnują, by wariant publiczny
pozostał nienaruszony (w tym testy wrogie: cena klienta, termin klienta,
brak trybu, nieznany tryb, strażnik sygnatury).

### Tryb publiczny — rozstrzygnięte 21.08.2026: zostaje bez zmian

Kandydat **R1** został sprawdzony na szerokim korpusie i **odrzucony**. To jest
rozstrzygnięcie, nie sprawa otwarta: defekt liczb w trybie publicznym zostaje
nienaprawiony świadomie, a R1 nie wraca bez nowych danych.

#### Skala defektu — 28 realnych pytań klienta z liczbą

Pytania, w których klient sam podaje liczbę (metraż, budżet, termin, rok budowy,
moc instalacji), po 2 przebiegi, `/debug?space=public`, ze zbiorem liczb
uziemionych odtworzonym lokalnie z `content-public.js`:

| | wynik |
|---|---|
| zdań łącznie | 102 |
| wyciętych na regule liczb | **8** |
| odpowiedzi zredukowanych do samej linii `Podstawa:` | **1 z 56** |
| wycięć z liczbą **znikąd** (wyliczoną, niefixowalną) | **0** |

Dla porównania tryb wewnętrzny przed R3: 13 zdań na 40 i 7 stubów na 16. Skala
publiczna jest o rząd wielkości mniejsza — i to jeszcze przed korektą niżej.

#### Korekta metodologiczna: `/debug` zawyża ten defekt

**`/debug` nie pokazuje tego, co widzi klient.** `handleAsk()` sprawdza surowy
tekst modelu wyrażeniem `/nie mam takich informacji/i` i przy trafieniu zwraca
`FALLBACK_MESSAGE` **przed** `verifyClaims()`. `/debug` tej gałęzi nie ma, więc
pokazuje wyniki weryfikacji dla odpowiedzi, które w produkcji nigdy do niej nie
docierają. Pomiar powtórzony przez `POST /` na prawdziwym hoście:

| klasa pytania | co dostaje klient |
|---|---|
| klient podaje własny parametr (3 pytania × 3) | **0/9 odesłań**, odpowiedzi kompletne |
| klient podaje błędną liczbę firmy (5 pytań × 3) | **4 z 5 pytań → fallback 3/3** |

W klasie „własny parametr" defekt praktycznie nie dociera do klienta, bo model
zwykle **nie powtarza jego liczby** — sięga po własny zakres z fragmentu
(„Dla domu o powierzchni **120-160 m²** wykonanie fundamentów trwa 2-3 tygodnie"
na pytanie o 150 m²). Tam, gdzie powtórzy, resztę odpowiedzi niosą inne zdania.

#### Jedyny przypadek, który realnie boli

Zostaje **jedna powtarzalna sygnatura**: pytanie łączy błędną liczbę firmy
z drugą kwestią, na którą dokumentacja odpowiada. Wtedy nie ma fallbacku, bo
część odpowiedzi istnieje — a sprostowanie wypada na regule liczb:

> **Q:** „Czy zaliczka to 30 procent i jaki obowiązuje VAT?"
> **Wycięte:** „Zaliczka wynosi standardowo 10% wartości kontraktu, a nie 30%."
> **Klient widzi:** samą część o VAT. 3/3 przebiegi, `gap=false`, `trimmed=1`.

Fałszywe założenie klienta zostaje **niesprostowane, choć dokumentacja ma
odpowiedź**. Szkodą jest tu pominięcie, nie fałszywe twierdzenie — bot nie
potwierdza 30%, tylko milczy o nich. W zestawie 12 pytań wrogich ta sygnatura
wystąpiła **raz**; w 28 pytaniach realistycznych **ani razu**.

#### Dlaczego R1 mimo to odrzucony

R1 ratuje ten przypadek („…10% …, a nie 30%" ma uziemioną 10, więc przechodzi)
i **nie przeciekł ani razu** w 36 przebiegach zaprojektowanych, żeby go złamać:
12 pytań podsuwających cenę i jednocześnie pytających o coś, na co dokumentacja
ma liczbę. Z 13 zdań zawierających liczbę podsuniętą 6 było mieszanych, a
**wszystkie 6 okazało się sprostowaniami**, nie potwierdzeniami.

Powody odrzucenia mimo dobrego wyniku:

1. **Cena jest nieproporcjonalna do zysku.** R1 rozluźnia jedyną warstwę stojącą
   na powierzchni skierowanej do klienta, żeby naprawić jedną sygnaturę pytania,
   której nie widać w realistycznym zestawie.
2. **Dziura jest realna, tylko rzadka.** Zdanie „Tak, remont kosztuje 1200 zł za
   metr, a zaliczka wynosi 10 procent" przechodzi przez R1 — sprawdzone na
   przypadku syntetycznym. To, że model dziś tego nie pisze, jest własnością
   modelu, nie reguły. Ten sam warunek zależności co przy R3, ale postawiony
   tam, gdzie stawka jest najwyższa: zmyślona cena u klienta.
3. **Zysk jest asymetryczny wobec R3.** Wewnętrznie R3 naprawiał 44% odpowiedzi
   zredukowanych do nagłówka. Publicznie R1 naprawia ok. 1 kształt pytania,
   przy 1 stubie na 56 przebiegów.
4. Reguła projektu: nie dokładać warstw bez zmierzonego problemu. Problem został
   zmierzony i okazał się mały.

#### Kierunek na przyszłość — niezmierzony, nieprzyjęty

Gdyby ta sygnatura kiedyś zaczęła wracać w pytaniach klientów, **tańszy kierunek
nie dotyka warstwy liczb w ogóle**: nakazać modelowi, żeby prostując nie
powtarzał kwoty z pytania („Zaliczka wynosi 10% wartości kontraktu" zamiast
„…, a nie 30%"). Zdanie zawierałoby wtedy wyłącznie liczby uziemione i żadna
reguła nie miałaby go za co wyciąć, a zabezpieczenie zostałoby nietknięte.

**Nie zmierzone i nie wdrożone.** Rusza prompt publiczny, kalibrowany od wielu
sesji, więc wymaga własnego pomiaru przed i po — patrz zapis o `PROMPT_RDZEN`.

## Problem 4 — nowa diagnoza (20.08.2026) i zamknięcie (21.08.2026)

**Dotychczasowy zapis był błędny co do przyczyny** i trzeba go czytać jako
obalony. Problem 4 brzmiał: „model nie łączy dwóch fragmentów w jedną odpowiedź".

### Co obala starą diagnozę

Klauzula o 12% **leży w tym samym fragmencie** (`i01`, zdanie 2 z 5) co marża
standardowa 22% i granica 14%. Nie ma tu żadnych dwóch fragmentów do połączenia.
Model pomijał zdanie z fragmentu, **który sam cytował w linii `Podstawa:`**.

### Co zmierzono

Wyeliminowano po kolei trzy hipotezy, `/debug?space=obie`, po 4 przebiegi.
Uwaga metodologiczna: `/debug` pokazuje w polu `odpowiedz` **surowy tekst modelu
przed weryfikacją**, więc te liczby mierzą model, nie warstwy wycinające.

**Pozycja zdania we fragmencie — nie ona.** Pytania celujące wprost w późne
zdania: `i14` zd. 3/6 → 4/4, `i14` zd. 5/6 → 4/4, `i15` zd. 3/7 → 4/4,
`i18` zd. 5/6 → 4/4. Późna pozycja nie szkodzi.

**Długość fragmentu — nie ona.** Najdłuższy fragment (`i15`, 1005 znaków)
odpowiada 4/4. Najkrótszy z badanych (`i01`, 619) jest tym, który zawodzi.

**Sformułowanie pytania — tak, i to nieprzewidywalnie.** Ten sam fragment,
to samo zdanie docelowe, ten sam lider retrievalu (0.55–0.58):

| pytanie | 12% w odpowiedzi |
|---|---|
| „Jaka marża przy zleceniu za 500 tysięcy **złotych**?" | **2/6** |
| „Jaka marża przy zleceniu za 500 tysięcy?" | 6/6 |
| „Jaką marżę mogę zejść przy 500 tys. i kto zatwierdza?" | 6/6 |
| „…o wartości 500 tysięcy złotych?" | 4/4 |
| „…za 600 tysięcy złotych?" | 4/4 |
| „…za pół miliona złotych?" | 4/4 |

Model **poprawnie wylicza próg**: przy 300 tysiącach 12% nie pada ani razu
(0/4, i tak ma być), przy 500/900 tys., 1,5 mln i 800 tys. — 4/4.

### Co z tego wynika

1. **Pytanie z oryginalnego zapisu przestało być odtwarzalne.** „Jaką marżę mogę
   zejść przy 500 tys. i kto zatwierdza" daje dziś 6/6. Problem 4 w postaci,
   w jakiej go zapisano, **nie występuje**.
2. Zostaje wąska, powtarzalna kruchość na **konkretnych formach powierzchniowych
   kwoty**. Jedno zbędne słowo („złotych") zmienia 6/6 na 2/6, przy nietkniętym
   retrievalu i tej samej pozycji zdania.
3. **Mechanizmu nie znamy** i nie zgadujemy go. Wiadomo, czego przyczyną NIE jest:
   retrievalu, pozycji zdania, długości fragmentu, arytmetyki progu.
4. Wariant „za 500 000 złotych" (0/4) **nie należy do tej klasy w ogóle** — tam
   model odpowiada poprawnie, a zdanie wycina `numbersAreGrounded()`. To defekt
   liczb opisany wyżej, nie problem 4. Dwa objawy zlewały się w jeden, dopóki
   `/debug` nie pokazał obu warstw naraz.

**Zakaz do czasu ustalenia mechanizmu:** żadnej reguły w prompcie „pod problem 4".
Poprzednia taka próba (lista przykładów: „np. marżę standardową i progi decyzyjne
przy danej kwocie") łamała zapisany wniosek „regułę promptu opisuj warunkiem,
nie listą fraz", **i nie działała** — 12% padało w 1 z 4 przebiegów. Cofnięta
20.08.2026 razem ze zmianą w `PROMPT_RDZEN`.

### Zestaw 20 pytań publicznych — zapisany, żeby pomiar był odtwarzalny

Pomiar z 20.08.2026 („Deduplikacja") powoływał się na „zestaw 20 pytań klienta",
którego nigdzie nie zapisano — więc nie dało się go powtórzyć. Zestaw używany
od teraz, 16 pytań zwykłych i 4 długie wielowątkowe: koszt remontu łazienki,
elewacje, czas stanu surowego, skład kosztorysu, rękojmia a gwarancja,
formalności i pozwolenie, etapy realizacji, harmonogram płatności, materiały
własne, stawka VAT, Czyste Powietrze, reklamacja, ogród, kierownik budowy,
technologia szkieletowa, wizja lokalna — plus cztery pytania łączone
(harmonogram+opóźnienia+płatności; wykończenie+elewacja+gwarancja;
fotowoltaika+dotacje+odbiory; wycena+umowa+raportowanie postępu).

### Pomiar kontrolny po przywróceniu `PROMPT_RDZEN`

Ten sam zestaw, po 2 przebiegi, `/debug?space=public`, przed i po cofnięciu:

| | przed (prompt zmieniony) | po (prompt przywrócony) |
|---|---|---|
| zdań łącznie | 127 | 115 |
| wyciętych | 1 | 1 |
| średnie podobieństwo zdania | 0.7509 | 0.7534 |
| mediana | 0.760 | 0.788 |
| średni wynik lidera | 0.6771 | 0.6771 |
| zdań poniżej progu 0.48 | 3 | 3 |

**Weryfikacja i retrieval nietknięte** — identyczny lider potwierdza, że prompt
nie ruszał wyszukiwania. Cena przywrócenia jest widoczna gdzie indziej:
odpowiedzi są **krótsze o ok. 9%** (127 → 115 zdań), a na pytaniach o kilku
faktach bywają mniej kompletne. Zmierzone na pytaniu o formalności: rozróżnienie
zgłoszenie/pozwolenie pada w 4/6 przebiegów, informacja o osobnej płatności
w 3/6, **oba naraz w 1/6** — przed cofnięciem oba były w obu próbkach.

To jest **przyjęty koszt, nie regresja do naprawienia**: prompt publiczny jest
kalibrowany od wielu sesji i nie zmienia się przy okazji pracy nad trybem
wewnętrznym. Gdyby kiedyś świadomie podnosić kompletność publicznych odpowiedzi,
to osobną decyzją i z własnym pomiarem — nie efektem ubocznym.

### Zamknięte 21.08.2026 jako granica poznania

Problem 4 **przestaje być sprawą otwartą**. Nie dlatego, że go rozwiązano —
dlatego, że wyczerpano to, co da się ustalić z zewnątrz modelu, a to, co zostało,
jest zbyt wąskie i zbyt bezpieczne, żeby uzasadniać dokładanie reguły.

#### Czy występuje na ścieżce produkcyjnej — tak

Poprzednie pomiary szły przez `/debug`, więc mierzyły surowy tekst modelu.
Powtórzone z odtworzeniem ścieżki użytkownika (trzy gałęzie `handleAsk()`:
pusty zbiór po filtrze → fallback; „nie mam takich informacji" w surowym tekście
→ fallback; inaczej zdania z akcją `zachowane`):

| | wynik |
|---|---|
| generacja (surowy tekst) zawiera klauzulę | 0/6 przy formie zawodzącej, 6/6 przy pozostałych |
| produkcja (co widzi pracownik) zawiera klauzulę | **identycznie: 0/6 i 6/6** |
| fallbacków | 0/36 |
| zdań wyciętych przez weryfikację | 0/36 |

**Weryfikacja i fallback nie biorą w tym udziału.** Inaczej niż przy defekcie
liczb w trybie publicznym, tutaj `/debug` nie zawyżał: zjawisko jest w całości
po stronie generacji i dociera do użytkownika.

#### Czy to jedno zjawisko, czy dwa — jedno

Podejrzenie, że pod jedną etykietą siedzą pomijanie zdania z cytowanego fragmentu
i wrażliwość retrievalu na formę pytania, **zostało sprawdzone i odrzucone**.
Retrieval jest niewrażliwy: we wszystkich 36 przebiegach fragment docelowy
(`i01`) stoi na **pozycji 0**, z wynikiem 0.553–0.584, a dwa pierwsze miejsca
listy są identyczne dla każdej formy pytania. Zostaje jedno zjawisko:
**model pomija zdanie z fragmentu, który sam cytuje w linii `Podstawa:`**.

#### Co dokładnie wyzwala — drabina kwot

Fragment mówi: „przy zleceniach **powyżej 400 tysięcy** złotych dopuszczalne jest
zejście do 12 procent". Pytanie „Jaka marża przy zleceniu za X złotych?", po 5
przebiegów na kwotę:

| kwota | klauzula w odpowiedzi |
|---|---|
| 410 tysięcy | 5/5 |
| 450 tysięcy | 5/5 |
| **500 tysięcy** | **0/5** |
| 550 tysięcy | 5/5 |
| 600 tysięcy | 5/5 |
| 800 tysięcy | 5/5 |

Zawodzi **wyłącznie 500**, i tylko w części form zapisu:

| forma | wynik |
|---|---|
| „za 500 tysięcy złotych" | 0/6 |
| „za 500 000 złotych" | 0/6 |
| „za 500 tysięcy zł" | 3/5 |
| „za 500 tys. złotych" | 5/5 |
| „za 500 tysięcy" (bez waluty) | 6/6 |
| „o wartości 500 tysięcy złotych" | 6/6 |
| „wartym 500 tysięcy złotych" | 5/5 |
| „dla zlecenia 500 tysięcy złotych" | 5/5 |
| „przy 500 tys. i kto zatwierdza" | 6/6 |

Wyzwalaczem jest **kolokacja**: przyimek „za" + dokładnie ta kwota + waluta
rozwinięta. Zmiana któregokolwiek z trzech elementów usuwa objaw.

#### Lista wykluczonych hipotez

Każda sprawdzona pomiarem, nie rozumowaniem:

1. **Pozycja klauzuli we fragmencie** — nie. Pytania celujące wprost w zdania
   3/6, 5/6, 3/7, 5/6 innych fragmentów: 4/4 każde.
2. **Długość fragmentu** — nie. Najdłuższy badany (`i15`, 1005 znaków) 4/4;
   zawodzi najkrótszy (`i01`, 619).
3. **Retrieval — obecność i ranga fragmentu** — nie. Pozycja 0 w 36/36.
4. **Retrieval — skład kontekstu** (jakie fragmenty towarzyszą) — nie.
   Forma zawodząca „za 500 tysięcy złotych" i działająca „o wartości 500 tysięcy
   złotych" mają **identyczną pierwszą czwórkę** fragmentów.
5. **Arytmetyka progu** — nie. Przy 300 tysiącach klauzula nie pada ani razu
   (0/4, poprawnie), przy każdej kwocie powyżej progu poza 500 — komplet.
6. **Bliskość progu 400 tysięcy** — nie. 410 i 450 działają, 550 działa.
7. **Samo słowo „złotych"** — nie. „za 600 tysięcy złotych" 5/5.
8. **Warstwy weryfikacji** — nie. 0 wycięć i 0 fallbacków w 36 przebiegach;
   generacja równa produkcji.

**Czego nie da się ustalić z zewnątrz:** dlaczego akurat ta sekwencja tokenów
przesuwa model ku odpowiedzi bez klauzuli. To wymaga wglądu w model, którego
nie mamy. Tu kończy się to, co potrafimy zmierzyć.

#### Dlaczego zamykamy zamiast łatać

- **Objaw jest wąski.** Jedna kwota, jeden przyimek, jedna forma zapisu waluty.
- **Kierunek błędu jest bezpieczny.** Model odpowiada **poprawnie, ale niepełnie**:
  podaje 22 procent i granicę 14 procent, a pomija możliwość zejścia do 12.
  Pomija ustępstwo, nigdy go nie wymyśla. Odwrotny błąd nie wystąpił — przy
  300 tysiącach klauzula nie padła ani razu.
- **Nie ma czego zapisać w regule.** Każda reguła promptu celująca w to musiałaby
  wymieniać formę pytania, czyli być listą fraz — dokładnie tym, czego zakazuje
  wniosek z 19.08.2026, i tym, co raz już nie zadziałało.

**Zakaz zostaje w mocy i po zamknięciu tematu:** żadnej reguły promptu „pod
problem 4". Gdyby objaw kiedyś się rozszerzył — na inne kwoty, inne fragmenty
albo inne formy pytania — to jest **nowy pomiar i nowa sprawa**, a nie powrót
do tej. Naturalnym momentem sprawdzenia jest **zmiana modelu bazowego**, bo
zjawisko jest własnością modelu, nie naszego kodu.

#### Uwaga do metody, kosztowała jeden fałszywy wniosek

Metryka „czy w odpowiedzi pada 12 procent" **nie jest równoznaczna z poprawnością
odpowiedzi**. Przy pytaniu „czy przy zleceniu za 500 tysięcy złotych mogę dać
rabat?" wynik 0/5 wyglądał na kolejne niepowodzenie, a odpowiedź była w pełni
poprawna: pochodziła z fragmentu „Progi decyzyjne", gdzie klauzula o marży nie
ma zastosowania. Przy badaniu pominięć trzeba sprawdzać, czy pominięta treść
w ogóle należy do odpowiedzi na zadane pytanie.

## Panel właściciela na Access — trzeci host, rola z adresu (21.08.2026)

### Co było nie tak

Właściciel firmy dostawał `REINDEX_SECRET` — ten sam sekret, który otwiera
`/purge` i `/reindex`. Czyli osoba, która miała tylko oglądać statystyki, mogła
**skasować własną bazę wiedzy**: pomyłką, albo przez kogoś, kto podejrzy jej
ekran. To była jedyna pozostała wpadka trafiająca wprost do klienta — `/internal`
wyszedł spod sekretu 18.08.2026, panel został.

**Znalezione przy okazji, nie zgłoszone w zadaniu:** `/stats-internal` (Etap 6)
sprawdzał wyłącznie, czy token Access jest ważny. Panel stał na hoście
wewnętrznym, objętym polityką całego zespołu, więc **każdy pracownik mógł
otworzyć `/panel`** i zobaczyć luki szkoleniowe, eskalacje i listę zadanych pytań.
Ten sam defekt, tyle że już wdrożony. Naprawione w tej samej zmianie.

### Rozstrzygnięcie: osobny host właściciela

`budmax-wlasciciel.know-base.app`, trzeci host na klienta, z **własną aplikacją Access**
i polityką na jeden adres e-mail zamiast całego zespołu.

Rozważany był wariant tańszy — panel zostaje na hoście pracowniczym, a właściciela
od pracownika odróżnia polityka. **Odrzucony**, bo dałoby się to zrobić tylko na
dwa sposoby, oba złe:

1. **Aplikacja Access na ścieżce `/panel`** — to dokładnie wzorzec odrzucony
   wcześniej przy trybie wewnętrznym („Adresy i domeny"): ochrona stoi wtedy na
   poprawnie wpisanym polu `Path`, a pomyłka albo odsłania panel, albo blokuje
   pracowników.
2. **Lista e-maili właściciela w Workerze** — przy One-time PIN token **nie niesie
   grup z dostawcy tożsamości**, więc nie ma się na czym oprzeć poza adresem.
   To znaczy mini-system ról w kodzie i kolejny stan per klient.

Osobny host daje własność, o którą naprawdę chodziło: **rola wynika z adresu**.
Worker nie zna pojęcia roli, nie ma listy uprawnionych i nie sprawdza żadnego
pola w tokenie. Pracownik i właściciel wchodzą pod różne adresy, objęte różnymi
politykami. Pole `role` w metadanych fragmentów **nadal nic nie filtruje** i nie
musiało zostać ruszone.

### Co to znaczy przy multi-tenant

| | osobny host (przyjęte) | rola w polityce (odrzucone) |
|---|---|---|
| mapa do dopisania | `host → {klient, AUD, rola}` — host koduje wszystko | `host → AUD` **plus** `host → e-maile właściciela` |
| gdzie stoi granica właściciel/pracownik | w sieci, przed Workerem | w naszym kodzie |
| koszt na klienta | 3 wpisy trasy, 3 aplikacje Access | 2 wpisy, 2 aplikacje + lista e-maili |

Dług `ACCESS_AUD` **został częściowo spłacony przy okazji**, bo musiał: dwie
aplikacje Access to dwa AUD. `accessConfig(env, url)` wybiera oczekiwany AUD
**po hoście**. Rozwiązanie „akceptuj którykolwiek ze znanych AUD-ów" byłoby
dziurą — token pracownika z hostu pracowniczego otwierałby panel właściciela.
To jest dwuelementowa wersja mapy `host → AUD` z „Adresy i domeny"; przy
multi-tenant rozrasta się, a nie przepisuje.

### Podział uprawnień po zmianie

| Endpoint | Kto | Czym |
|---|---|---|
| `POST /` | każdy | — |
| `POST /internal` | pracownik | Access, host pracowniczy |
| `GET /`, `/app` (host pracowniczy) | pracownik | Access |
| `GET /`, `/panel`, `/stats`, `/stats-internal` (host właściciela) | **właściciel** | **Access, host właściciela** |
| `/reindex`, `/purge`, `/debug` | administrator | `REINDEX_SECRET` |

Endpointy administracyjne **świadomie zostają na sekrecie**. To narzędzia
wdrożeniowe, nie klienckie — klient nie ma mieć do nich dostępu w ogóle, także
zalogowany. Rozdzielenie „klient przez tożsamość, wdrożeniowiec przez sekret"
jest teraz kompletne.

### Panel musiał zejść z GitHub Pages

`panel.html` stał na GitHub Pages i wołał Workera z kluczem w URL-u. Po zmianie
**nie da się go tam zostawić**: uwierzytelnienie przez Access polega na
przekierowaniu na ekran logowania i ciasteczku sesji, a żądanie międzydomenowe
ze statycznej strony tego nie przejdzie.

Dlatego panel jest teraz modułem `panel.js`, serwowanym przez Workera na hoście
panelowym pod `GET /`, i woła `/stats` **same-origin, bez klucza**. Plik
`panel.html` w repo został zamieniony na **wskazówkę z nowym adresem** — zamiast
zostawić stronę, która nadal prosi o klucz i nigdy już nie zadziała. Ktoś
z zapisaną zakładką ma się dowiedzieć, dokąd iść, a nie wpisywać sekret w martwy
formularz.

### Fail-closed dotyczy też interfejsu, nie tylko danych

Zmierzone zaraz po wdrożeniu: host właściciela istniał, aplikacji Access jeszcze nie
było, więc `GET /` **serwowało panel każdemu**. Dane były bezpieczne (`/stats`
zwracało 503), ale skorupa chronionej powierzchni wisiała publicznie.

Poprawione: `odpowiedzBrakKonfiguracji()` sprawdza konfigurację Access **także
przed wydaniem HTML-a** — na obu hostach za Access. Brak zmiennych = 503 z nazwą
brakującej, nie panel i nie ciche 403.

**Reguła do zapamiętania:** przy przenoszeniu czegokolwiek za Access sam host
i trasa nie wystarczą. Dopóki aplikacja Access nie istnieje, host odpowiada bez
logowania — więc Worker musi umieć odmówić samodzielnie.

### Wynik pomiaru (21.08.2026, wersja `5ba00c7b`)

| sonda | wynik |
|---|---|
| `/stats` ze starym kluczem, `workers.dev` | **404** — „Panel właściciela działa wyłącznie na hoście właściciela" |
| `/stats` ze starym kluczem, host publiczny | **404** |
| `/stats` ze starym kluczem, host właściciela | **503** — brak `ACCESS_AUD_PANEL` |
| `/stats-internal` ze starym kluczem | **404** |
| `/purge?key=…` bez `ids` | **200** z podpowiedzią — klucz nadal autoryzuje, nic nie kasuje |
| `/reindex?key=…&space=nieistniejaca` | **400** — klucz autoryzuje, indeks nietknięty |
| `/debug?key=…` | **200** |
| te same trzy ze złym kluczem | **403** |
| `/app`, `/panel` na hoście pracowniczym | **302** na ekran logowania — Access działa |
| `GET /`, `/panel` na hoście właściciela | **503** z nazwą brakującej zmiennej |
| `POST /` publiczny | **200**, odpowiedź bez zmian |

`test-access.mjs` urósł z 14 do **20 przypadków** — doszła sekcja 5: token
panelowy nie otwiera hostu pracowniczego, token pracownika nie otwiera panelu,
brak `ACCESS_AUD_PANEL` daje 503 na hoście właściciela i **nie psuje** hostu
wewnętrznego.

**Uwaga na cache brzegowy — kosztował fałszywy alarm drugi raz.** Pierwsza sonda
pokazała `/stats` na `workers.dev` odpowiadające **200 z pełnymi danymi**, co
wyglądało na niewdrożoną zmianę. To była odpowiedź zbuforowana sprzed wdrożenia;
z `?cb=$RANDOM` jest 404. Każdą sondę po wdrożeniu robić z cache-busterem.

## Zmiana nazw hostów i koniec dopasowania po podciągu (21.08.2026)

Hosty przemianowane w aplikacjach Access, a potem w kodzie:

| było | jest | rola |
|---|---|---|
| `budmax-wewnetrzny.know-base.app` | **`budmax-pracownik.know-base.app`** | aplikacja asystenta budowy |
| `budmax-panel.know-base.app` | **`budmax-wlasciciel.know-base.app`** | oba panele analityczne |

### Dopasowanie po podciągu było miną i właśnie wybuchło

Role rozpoznawały `hostname.includes("wewnetrzny")` i `includes("-panel.")`.
**Żadna z nowych nazw nie pasuje do żadnego z tych wzorców.** Gdyby zmienić same
nazwy w Access, oba hosty po cichu straciłyby rolę: aplikacja pracownicza
przestałaby się serwować, `/stats` odpowiadałoby 404 na własnym hoście, a nic
w kodzie nie krzyknęłoby o błędzie. To nie jest hipotetyczne — tak wyglądał stan
między zmianą w Access a wdrożeniem kodu.

Dlatego nazwy hostów są dziś w **jednym miejscu** (`HOSTY` w `worker.js`),
a dopasowanie jest **dokładne**, nie podciągiem:

```js
const HOSTY = {
  publiczny:  "budmax.know-base.app",
  pracownik:  "budmax-pracownik.know-base.app",
  wlasciciel: "budmax-wlasciciel.know-base.app",
};
function hostPracownika(url)  { return url.hostname === HOSTY.pracownik; }
function hostWlasciciela(url) { return url.hostname === HOSTY.wlasciciel; }
```

Dokładne dopasowanie ma lepszą stronę awaryjną: **host, którego nie ma w `HOSTY`,
nie dostaje żadnej roli.** Nieznana albo porzucona nazwa nie odsłoni ani aplikacji
pracowniczej, ani panelu — w najgorszym razie odpowie 404.

### Dziura, która była otwarta przez chwilę — i czego uczy

Zmierzone **przed** wdrożeniem kodu, gdy aplikacje Access były już przepięte
na nowe nazwy:

```
budmax-wewnetrzny.know-base.app/app  ->  HTTP 200
```

Aplikacja pracownicza serwowała się **publicznie, bez logowania**. Mechanizm:
aplikacja Access zeszła ze starego hosta, ale trasa w `wrangler.toml` została,
a `includes("wewnetrzny")` nadal pasowało — więc Worker chętnie oddał HTML.
Dane pozostały bezpieczne (`POST /internal` bez tokenu to 401), ale skorupa
interfejsu była odsłonięta.

**Reguła: host w Access i host w `wrangler.toml` to dwie różne rzeczy i trzeba
je zmieniać razem.** Przepięcie samego Access zostawia stary adres podpięty do
Workera, tyle że bez ochrony. Kolejność bezpieczna to: najpierw kod i trasy,
potem Access — albo obie naraz, ale nigdy sam Access.

### Stare trasy znikają same — sprawdzone, nie założone

Pytanie brzmiało, czy po starych hostach zostaną wiszące trasy bez ochrony.
**Nie zostają.** Usunięcie wpisu `[[routes]]` z `custom_domain = true` i
`wrangler deploy` odpina custom domain **razem z rekordem DNS**:

```
budmax-wewnetrzny.know-base.app  ->  NXDOMAIN
budmax-panel.know-base.app       ->  NXDOMAIN
```

Przez kilkadziesiąt sekund po wdrożeniu stare adresy oddawały jeszcze `522`
(rekord DNS żył, Worker już go nie obsługiwał) — to okno propagacji, nie stan
docelowy. Nic nie zostało do posprzątania w dashboardzie.

To jest zarazem potwierdzenie reguły z `CLAUDE.md`: **`wrangler.toml` jest
źródłem prawdy** i trasa, której tam nie ma, znika z działającego Workera.
Tutaj zadziałało to na naszą korzyść, ale ta sama mechanika kasuje bindingi
dopisane w dashboardzie.

### AUD — sprawdzone, nie założone

Przewidywanie brzmiało: AUD obu aplikacji się nie zmienił, bo zmieniono w nich
tylko nazwę hosta. **Dla aplikacji pracowniczej to prawda**, dla panelowej
sprawdzenie było potrzebne z innego powodu — jej AUD nie był jeszcze wpisany.

AUD da się odczytać **bez logowania**: Access przekierowuje niezalogowanego na
ekran logowania, a w parametrze `kid` tego adresu siedzi AUD aplikacji.

```bash
curl -s -D - -o /dev/null "https://budmax-pracownik.know-base.app/?cb=$RANDOM" | grep -i '^location:'
# .../cdn-cgi/access/login/budmax-pracownik.know-base.app?kid=31995d69…f782c1c0
```

| aplikacja | AUD | stan |
|---|---|---|
| BudMax — tryb wewnętrzny (host pracownika) | `31995d69…f782c1c0` | **niezmieniony**, zgodny z `ACCESS_AUD` |
| BudMax — panel właściciela (host właściciela) | `49c77c8d…e4ddb133` | odczytany i wpisany do `ACCESS_AUD_PANEL` |

AUD **nie jest sekretem** — widać go w adresie ekranu logowania, więc odczytanie
go tą drogą niczego nie ujawnia. To ta sama wartość, którą dashboard pokazuje
w polu *Application Audience (AUD) Tag*.

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
