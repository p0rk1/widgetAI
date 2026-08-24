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
- [Test na realnych pytaniach z budowy](#test-na-realnych-pytaniach-z-budowy--cztery-naprawy-i-jedna-ślepa-uliczka-21082026)
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

## Test na realnych pytaniach z budowy — cztery naprawy i jedna ślepa uliczka (21.08.2026)

Test na pytaniach zadanych tak, jak pyta pracownik, ujawnił trzy klasy problemów.
Diagnoza pokazała, że pod trzema etykietami siedziały **cztery różne przyczyny**,
a czwarta zgłoszona klasa okazała się artefaktem pomiaru.

### Eskalacja: homonimy były problemem systemowym, nie wyjątkiem

Zgłoszony objaw: „pismo z kancelarii… potrąci nam 20 000 zł" dostawało ramkę
wypadkową z numerem 112. Przegląd wzorców pokazał, że `potrac` jest jednym
z pięciu, nie wyjątkiem. Zmierzone na dziesięciu zwykłych zdaniach z budowy:

| przed | po |
|---|---|
| **7/10 fałszywych alarmów PILNE** | **0/10** |

Wyzwalały: „potrącamy zaliczkę z faktury", „brygadzista złamał procedurę",
„podwykonawca **zawalił termin**", „ekipa zawaliła robotę", „majster ma do mnie
**urazę**", „koszt materiału **spadł z** 40 do 32 zł". To jest dokładnie ten
rodzaj szumu, który uczy ignorować ramkę — a więc kosztuje przy prawdziwym
wypadku.

**Rozwiązanie: rdzeń dwuznaczny wyzwala dopiero ze swoim DOPEŁNIENIEM.**
Złamana część ciała, potrącony człowiek, upadek z wysokości, zawalenie
konstrukcji. To warunek, nie lista sformułowań wypadku: wypadków wyliczyć się
nie da, części ciała i wysokości owszem.

Pierwsza wersja warunku — „czy w zdaniu występuje jakikolwiek człowiek" —
**została odrzucona po pomiarze**: na budowie ktoś występuje prawie w każdym
zdaniu, więc „brygadzista złamał procedurę" nadal wyzwalało ramkę.

`uraz` rozbrojony inaczej, **morfologicznie**: `uraz(?![ae])` odróżnia
*uraz/urazu/urazie* od *uraza/urazę*. Warunek kontekstowy gubił tu przypadek
z zestawu regresyjnego — „Pracownika ukąsiła żmija, doznał urazu" nie nazywa
części ciała.

### Rozstrzyganie przy wielu trafieniach — zasada, nie kolejność

Do tej pory wygrywała pierwsza pasująca kategoria w tablicy. Zasada wynika
z kosztu pomyłki:

1. Kategoria z **większą liczbą niezależnych sygnałów** wygrywa — więcej
   przesłanek to mniejsza szansa, że trafiliśmy na homonim.
2. Przy remisie wygrywa kategoria **pilna**, czyli kierująca do człowieka szybciej.
3. Przy dalszym remisie decyduje kolejność w tablicy.

**Punkt 1 działa WEWNĄTRZ poziomu pilności** i to jest istotne zabezpieczenie.
Bez niego „pracownik złamał nogę, przyjechała PIP" wybrałoby `kontrola`, bo ta
ma dwa sygnały z definicji — a to błąd, którego koszt mierzy się zdrowiem.

**Uwaga do zapamiętania:** sama zasada NIE naprawiłaby zgłoszonego przypadku.
W zdaniu o kancelarii obie kategorie miały po jednym sygnale, więc remis
rozstrzygnąłby na korzyść pilnej — czyli nadal `wypadek`. Kolejność była
ujawniaczem, nie przyczyną; przyczyną był homonim. Zasada zostaje, bo zapobiega
kolizjom w przyszłości, ale nie należy jej przypisywać tej naprawy.

### Rzeczowniki urazowe — jeden przyjęty kompromis, jeden kandydat odrzucony

Wzorzec miał wyłącznie rdzenie czasownikowe i przymiotnikowe: `krwaw` łapie
„krwawi", ale gubi **„leci krew"** — najczęstszą formę potoczną. Pytanie
„wbił sobie gwóźdź w stopę… leci krew" nie zawierało ani nazwy urazu, ani
rdzenia `krwaw`.

**Sam rzeczownik wystarcza** — warunek kontekstowy jak przy rdzeniach
dwuznacznych nie jest tu potrzebny. Mierzone przeciw pełnym 26 przypadkom
negatywnym plus sześciu zdaniom dopisanym jako podejrzane:

| kandydat | fałszywe alarmy | decyzja |
|---|---|---|
| `krew\|krwi` | **1** — „zachowaj zimną krew" | przyjęty **z jawnym wyjątkiem** |
| `wbil sobie` | **1** — „wbił sobie do głowy" | **ODRZUCONY** |
| `ran[aey]`, `rozciec`, `obrazen`, `opatrun`, `nadzia`, `krwotok` | 0 | przyjęte |

Drugi idiom, „krew z nosa" („robimy to krew z nosa na jutro"), wyszedł przy
sprawdzaniu i też jest wyłączony. Oba wyjątki żyją w kodzie jako
`(?<!zimna )(krew|krwi)(?! z nosa)`.

`wbil sobie` odrzucony mimo że łapie zgłoszony przypadek — „wbił sobie do głowy,
że zdążymy" to zdanie, które na budowie padnie.

Zestaw testowy: **53 → 79 przypadków**.

### ŚLEPA ULICZKA: reguła promptu „prostuj wartość spoza zakresu"

Hipoteza brzmiała: przy „marża 11%" model podaje progi i zostawia wniosek
pracownikowi, więc prompt wewnętrzny ma kazać mu powiedzieć wprost, że wartość
jest poza zakresem. Reguła została napisana **warunkiem**, z jawną klauzulą
hamującą, wdrożona i zmierzona. **Cofnięta tego samego dnia.**

| | przed | z regułą | po cofnięciu |
|---|---|---|---|
| sprostowania przy wartości poza zakresem | 12/16 | **11/16** | 10/16 |
| fałszywe sprostowania na pytaniach neutralnych | 0/24 | **0/24** | 0/24 |

**Wniosek pierwszy: reguła nie ma zmierzonego efektu.** Rozrzut między trzema
przebiegami (12 → 11 → 10) jest większy niż jakikolwiek efekt reguły. Klauzula
hamująca działała — zero fałszywych sprostowań, więc wpadka reguły adresata się
nie powtórzyła — ale korzyści nie widać. Model prostuje sam: powtórzony pomiar
na „marża 11%" dał **4/4 odpowiedzi zaczynających się od „Nie, nie możesz dać
marży 11%"**, bez żadnej reguły.

**Wniosek drugi, ważniejszy: pierwotna diagnoza była artefaktem metryki.**
Diagnoza mówiła „3/6 przebiegów prostuje". Liczyła jednak dosłowne
sformułowanie — „mówi wprost, że 11% nie wolno" — a nie sens odpowiedzi. Gdy
policzyć naturalne „nie możesz dać marży 11%", wychodzi 12/16 **bez żadnej
zmiany w kodzie**. Reguła powstała pod problem, którego skala była zmyślona
przez licznik.

To samo powtórzyło się **w środku pomiaru zaprojektowanego po wyciągnięciu tej
lekcji**: klasa „limit godzin pracy 0/4" wyglądała na jedyną otwartą. Sprawdzenie
pokazało, że odpowiedź jest poprawna i pełna w 3/3 przebiegach — „Nie, tygodniowy
czas pracy łącznie z nadgodzinami nie może przekroczyć przeciętnie 48 godzin",
lider `i18` za każdym razem. Licznik wymagał, żeby w odpowiedzi padła liczba
**60** z pytania, a bot jej nie powtarza. **Luki w treści nie ma, limit jest
w `i18`.**

### Reguła na przyszłość, po trzecim takim przypadku

To jest trzeci raz w tym projekcie, gdy metryka mierzyła co innego, niż chcieliśmy
wiedzieć:

1. mierzenie tego, co widzi użytkownik, przez `/debug` — który omija gałąź
   „nie mam takich informacji" → fallback;
2. utożsamienie braku oczekiwanej liczby w odpowiedzi z błędną odpowiedzią
   (pytanie o rabat, gdzie klauzula o marży nie ma zastosowania);
3. mierzenie dosłownego sformułowania sprostowania zamiast jego sensu — dwukrotnie
   w jednej sesji, raz przy diagnozie i raz przy pomiarze kontrolnym.

**Zasada: przed pomiarem sprawdź, czy metryka mierzy to, co chcesz wiedzieć,
a nie to, co łatwo policzyć.** Praktycznie: zanim policzysz przebiegi, przeczytaj
kilka odpowiedzi w całości i sprawdź, czy licznik zgadza się z Twoją oceną.
Wszystkie trzy przypadki miały ten sam kształt — licznik szukał ciągu znaków,
a pytanie dotyczyło znaczenia.

### Trzy fragmenty treści

| id | fragment | co domyka |
|---|---|---|
| `i42` | Trzeźwość na budowie — pracownik, napoje bezalkoholowe, kontrola | bot odpowiadał z `i32` „Klient na terenie budowy", czyli regułą dla **gościa** |
| `i43` | Nocleg w delegacji bez faktury i bez poniesionego kosztu | `i15` znał tylko „ryczałt bez faktury 67,50" |
| `i44` | Staż urlopowy — ile lat dolicza się za wykształcenie | `i14` mówił tylko „wlicza się lata nauki", bez liczb |

`i42` mówi wprost „ten fragment dotyczy NAS, pracowników", a `i32` dostał
odsyłacz zwrotny „ten fragment dotyczy GOŚCIA" — rozgraniczenie idzie w obie
strony, bo to `i32` przechwytywało te pytania. Odsyłacze zwrotne dopisane też
do `i14` i `i15`. **41 → 44 fragmenty.**

### Wynik końcowy na pytaniach z testu (po 3 przebiegi)

| pytanie | wynik |
|---|---|
| gwóźdź w stopie, leci krew | 3/3 ramka eskalacji, 3/3 procedura powypadkowa |
| pismo z kancelarii, potrąci 20 000 zł | 3/3 `spor_prawny`, **3/3 bez numeru 112** |
| piwo bezalkoholowe 0,0 | 3/3 cytuje `i42`, 3/3 rozróżnia 0,0 od alkoholu |
| nocleg u rodziny | 3/3 „nie przysługuje", 3/3 cytuje `i43` |
| technikum a staż urlopowy | 3/3 podaje **5 lat**, 3/3 cytuje `i44` |
| zdjęcia w mediach społecznościowych | 3/3 |

### Czego ten test NIE potwierdził

Dwa zgłoszone objawy **nie odtworzyły się** i zostały zapisane jako
niepotwierdzone, a nie naprawione:

- **odpowiedź o kasku na pytanie o wpis do dziennika budowy** — 4 sformułowania
  × 3 przebiegi, za każdym razem lider `Dziennik budowy` (0.590) i poprawna
  odpowiedź. Czynnik ryzyka jest jednak realny i zmierzony: odskok lidera wynosi
  **0.022**, a `Klient na terenie budowy` siedzi na trzecim miejscu z 0.566.
  Znaleziono wariant, w którym pytanie faktycznie odjeżdża: gdy zniknie słowo
  „dziennik", liderem zostaje `Inspektor nadzoru inwestorskiego` (0/3 o dzienniku).
- **brak odpowiedzi o zdjęciach z budowy** — 6/6 poprawnych odpowiedzi z właściwym
  fragmentem.

## Wybór klienta: host, nie parametr — etap 1 drugiej branży (22.08.2026)

Cel nie był prezentacyjny, tylko poznawczy: dołożyć drugiego klienta, żeby
zobaczyć, **ile zabezpieczeń tego projektu jest uniwersalnych, a ile było
protezą pod budowlankę**. Przełączanie demo jest skutkiem ubocznym, nie zamówieniem.

### Trzy drogi przekazania wyboru klienta i dlaczego wygrała trzecia

**Parametr w żądaniu (`?klient=`) — odrzucony.** Dziś publiczny widget nie ma
fizycznej możliwości poprosić o przestrzeń `internal`, bo nie ma czym: nazwa
przestrzeni jest wpisana na sztywno w routingu. To jest cała siła obecnej
separacji — błąd w autoryzacji **nadal nie otwiera** dostępu do cudzej wiedzy.
Parametr odtwarza dokładnie tę samą drogę w drugim wymiarze: od tej chwili
rozłączność klientów wisiałaby na poprawności kodu sprawdzającego uprawnienia.
Przy jednym najemcy to teoria, przy dwóch to wyciek dokumentacji nie tej firmy.

**Furtka `?klient=` na `workers.dev` pod flagą DEMO — odrzucona.** Kusząca, bo
zerowa w kosztach konfiguracji. Nie działa z powodu, który widać dopiero po
sprawdzeniu: na `workers.dev` tryb wewnętrzny **nigdy nie zadziała** (i to jest
poprawne fail-closed, nie usterka). Demo obejmowałoby więc wyłącznie tryb
publiczny — a eskalacja i wzorce branżowe, czyli dokładnie to, po co ten etap
powstał, żyją w trybie wewnętrznym.

**Host → klient — wybrane.** Ta sama zasada, którą 21.08.2026 rozwiązano role:
klient wynika z adresu, a nie z pola w żądaniu ani z listy w kodzie. `CLAUDE.md`
nazywał braki multi-tenanta wprost — „mapy `host → klient`, mapy `host → AUD`
i odmowy dla nieznanego hosta". Ten etap buduje wszystkie trzy, więc nie powstaje
nic równoległego do docelowego rozwiązania: tablica `KLIENCI` staje się później
tabelą w D1, a `rozpoznajKlienta()` zapytaniem do niej. Reszta systemu nie widzi
różnicy, bo nikt poza tą funkcją nie wie, skąd klient się wziął.

Koszt policzony uczciwie: publiczny host nowego klienta to jeden wpis w trasach
(Access na nim nie stoi), ale host pracowniczy i panelowy wymagają **dwóch
wyklikanych aplikacji Access** — AUD jest per host i musi być, bo inaczej token
pracownika otwierałby panel właściciela. To nie jest praca do wyrzucenia: to
próba generalna procedury onboardingu klienta, wykonana zanim klient zapłaci.

### Dwa wymiary przestrzeni zamiast przemianowania

Odrzucono ujednolicenie nazw na `budmax-public` / `budmax-internal`. Zostały dwa
niezależne wymiary: **rodzaj** (`public`/`internal`) przychodzi z routingu jak
dotąd, **klient** z hosta, a fizyczną nazwę składa `przestrzenFizyczna()` wewnątrz
granicy dostawcy. Dzięki temu `askedFrom`, pole `space` w logu, filtr w `/stats`
i `trybPromptu()` **znaczą dokładnie to samo, co przed zmianą** — nie trzeba było
ruszać ani jednej z tych ścieżek.

Nazwy przestrzeni są w tablicy klienta **wpisane jawnie, nie generowane ze
wzorca**, więc BudMax został przy `public`/`internal`: zero reindeksu, zero
migracji wektorów na działającej produkcji, zero okazji do pomyłki. Niesymetrycznie
wobec kolejnego klienta, ale w D1 i tak będzie to kolumna z konkretną wartością.

Przy okazji do metadanych fragmentów dochodzi pole `klient` — dziś nic po nim nie
filtruje, dokładnie jak `role`. Powód ten sam: dopisanie go później oznacza
reindeks u każdego klienta.

### Co okazało się protezą, a co produktem

To jest właściwy wynik etapu — granica przebiegła inaczej, niż sugerowała intuicja.

| Warstwa | Zostało w silniku | Wyszło do klienta |
|---|---|---|
| Eskalacja | weto ramy informacyjnej, zasada „rdzeń dwuznaczny wyzwala dopiero ze swoim dopełnieniem", rozstrzyganie (pilne → liczba sygnałów → kolejność), pozycja ramki, normalizacja bez ogonków | tablica kategorii, dopełnienia (`CIALO`, `OFIARA`, `WYSOKOSC`, `PODMIOT_KONSTRUKCJA`), teksty ramek, progi 3% / 300 zł, nazwa stanowiska |
| Obietnice | wyjątek dla zaprzeczeń i odesłań do biura, deklaracja wolnego terminu, „zdążymy" | rabaty, hurtownie, VAT, płatność z góry |
| Instrukcje w odpowiedzi | całość | nic |
| Uziemienie liczb, progi, deduplikacja, cytat dosłowny | **całość** | nic |
| Prompty | struktura, kolejność akapitów, `PROMPT_RDZEN`, reguła adresata, „kroki tylko przy procedurze" | nazwa firmy, rozróżnienia mylonych usług, zakazy branżowe, przykłady stanowisk, zdanie odmowne |

Wniosek: **protezą były wzorce, nie reguły.** Ani jedna zasada nie okazała się
budowlana — u kancelarii zmienia się to, co wypełnia tablicę, a nie sposób jej
czytania. Jedyne, co niesie ze sobą prawdziwe ryzyko przy zmianie branży, to
znaczenie pola `pilne`: u BudMaksu znaczy „ktoś leży na ziemi", u kancelarii
będzie znaczyć „termin jest nieodwracalny". Mechanizm to udźwignie, kalibracja
progów będzie nowa.

Zastrzeżenie, którego ta tabela nie rozstrzyga: uziemienie liczb, progi i cytat
dosłowny zostały w silniku **na podstawie braku dowodu przeciwnego**, nie pomiaru
na drugiej branży. Ten pomiar jest treścią etapu 2.

### Brak klienta jest błędem, nie ciszą

Wszystkie warstwy zależne od klienta **rzucają wyjątkiem**, gdy go nie dostaną:
`wymagajKlienta()`, `przestrzenFizyczna()`, `wykryjEskalacje()`, `buildSystemPrompt()`
i `isUnsupportablePromise()` w trybie publicznym. Powód jest ten sam, dla którego
`vectorSearch()` nie ma wartości domyślnej dla przestrzeni: eskalacja bez pakietu
branżowego zwracałaby `null`, czyli **wyłączyłaby się w całości bez jednego śladu
w logu** — przy wypadku. Warstwa obietnic bez wzorców klienta pracowałaby na
połowie zestawu, na powierzchni klienckiej, przez wiele sesji niezauważona.
To dokładnie te dwa kształty błędu, które ten projekt już raz zapłacił
(`isDuplicate()`, `numbersAreGrounded()`).

Pilnuje tego `test-klienci.mjs` — 38 przypadków, w tym wrogie: podszywający się
podciąg hosta, prefiks, brak klienta w każdej z tych warstw, kolizja hostów
w tablicy i sprawdzenie, że zdanie odmowne każdego klienta zawiera frazę
`nie mam takich informacji` rozpoznawaną przez `handleAsk()`.

### Nieznany host przestaje dostawać BudMaksa

Do tej zmiany żądanie `POST /` z hosta spoza tablicy wpadało na koniec routingu
i dostawało dokumentację BudMaksu. Przy jednym kliencie była to teoria; przy
dwóch byłby to wyciek treści nie tej firmy. Teraz nieznany host dostaje **404**,
tak samo jak nie dostaje żadnej roli. Stary `knowbase-budmax.rezi7608.workers.dev`
jest wpisany **jawnie** w polu `stare` w tablicy BudMaksu, więc działa jak dotąd.

Log pytań też jest od tej zmiany podpisany klientem, a `/stats` i `/stats-internal`
filtrują po nim. Bez tego panel jednej firmy pokazywałby pytania zadane drugiej —
KV jest jedno na Workera. Wpisy sprzed 22.08.2026 nie mają tego pola i przypadają
klientowi oznaczonemu `przejmujeStareWpisy`, jawnie w tablicy, a nie przez
zgadywanie po hoście. Kolejny klient tego pola mieć nie może.

### Przełącznik demonstracyjny — czego nie może zepsuć

Renderowany wyłącznie przy `DEMO = "1"` w `[vars]`. U klienta tej zmiennej nie
ma, więc paska **nie ma fizycznie w wysłanym HTML-u** — nie jest ukryty stylem
ani warunkiem w JavaScripcie, który da się obejść konsolą. Sam pasek to lista
linków do hostów drugiego klienta, a nie kontrolka zmieniająca stan: klient nadal
wynika z hosta, więc kliknięcie zmienia adres, a nie przeszukiwaną przestrzeń.
Najgorsze, co potrafi zrobić, to zaprowadzić pod adres, który odpowie 404.

Podstawianie nazw w interfejsach jest celowo prymitywne: `{{klucz}}` wypełniane
z `klient.ui`, bez frameworka i bez logiki w szablonie. Nieznany placeholder
zostaje w tekście, więc widać go od razu na ekranie, zamiast zniknąć po cichu.

### Kryterium akceptacji: prompt publiczny bajt w bajt

Przed refaktorem zapisano migawkę obu promptów, po refaktorze porównano `diff`-em.
**Oba wyszły identyczne bajt w bajt** — to był warunek, bo prompt publiczny jest
kalibrowany od wielu sesji, a `CLAUDE.md` zakazuje ruszania go przy okazji.
Testy: eskalacja 79/79, weryfikacja 26/26, Access 20/20, klienci 38/38,
`wrangler deploy --dry-run` bunduje wszystkie moduły.

### `node --check` nie wystarcza — zmierzone przy tej zmianie

Skrypt refaktoryzujący wstawił w szablon promptu **dosłowny znak nowej linii**
zamiast sekwencji ucieczki, czyli niedomknięty literał. `node --check worker.js`
**przeszedł bez zastrzeżeń**; błąd wyszedł dopiero przy `import`, gdy plik był
parsowany jako moduł ES. Kontrolą, która to łapie, jest uruchomienie testów albo
`wrangler deploy --dry-run` — nie `node --check`. Stąd stała `NOWA_LINIA`
w miejscu sklejania listy zakazów: sekwencja ucieczki wewnątrz szablonu jest
trudna do odczytania i łatwa do zepsucia edycją skryptową.

## Kancelaria — pomiar na 40 pytaniach i mapa problemów (22.08.2026)

Pierwszy pomiar drugiej branży. Zestaw: 20 pytań publicznych i 20 wewnętrznych,
w tym sześć publicznych celujących wprost w to, co w tej branży jest groźne —
ocena szans, kwalifikacja czynu, przewidywanie czasu trwania sprawy, termin
liczony pod konkretną datę podaną przez pytającego.

**Jak mierzone.** Przez `/debug?klient=kancelaria`, bo hosty kancelarii nie mają
jeszcze tras. `/debug` omija gałąź „nie mam takich informacji" → fallback, więc
skrypt sondy **odtwarza ścieżkę produkcyjną sam**: oznacza pytanie jako lukę,
gdy surowa odpowiedź zawiera frazę odmowy albo gdy po weryfikacji nie zostaje
ani jedno zdanie faktyczne. Liczba wycięć pozostaje surowa i jest **górnym
oszacowaniem**. To jest ta sama pułapka, którą projekt zapłacił 21.08.2026 przy
mierzeniu defektu publicznego — dlatego odtworzenie jest w skrypcie, nie w głowie.

### Wynik zbiorczy

| | publiczne | wewnętrzne |
|---|---|---|
| pytań | 20 | 20 |
| luk (ścieżka produkcyjna) | **6** | **0** |
| zdań ocenionych | 46 | 73 |
| wycięć | 4 | 1 |
| eskalacji | — (tryb publiczny nie eskaluje) | 5 |

Na 119 zdaniach z obu przestrzeni: **3 wycięcia za liczbę bez pokrycia,
2 za brak pokrycia, 0 za obietnicę, 0 za instrukcje, 0 za duplikat.**

### Odpowiedź na pytanie postawione przed pomiarem

Cztery warstwy zostały w silniku bez wymiaru klienta na podstawie braku dowodu
przeciwnego. Zderzenie z drugą branżą rozstrzyga je różnie.

**1. `numbersAreGrounded()` — NIE wytrzymuje. Dwa nowe kształty defektu.**

*Liczba zapisana słownie w dokumentacji, cyfrą w odpowiedzi.* **UWAGA — TA
DIAGNOZA BYŁA BŁĘDNA I ZOSTAŁA SPROSTOWANA 22.08.2026, patrz „Sprostowanie"
niżej.** Pierwotny zapis brzmiał: pytanie p04 („Dostałem wyrok 12 marca, ile mam
czasu na apelację?") dostało poprawną regułę „Termin na apelację wynosi 14 dni
od doręczenia", a zdanie zostało wycięte, bo `k21` mówi „w terminie **dwóch
tygodni**" — słownie. Wniosek o mechanizmie jest słuszny i kolizja jest realna,
ale **nie ona wywołała ten konkretny przypadek**.

**Sprostowanie (22.08.2026).** Sprawdzenie, które fragmenty p04 faktycznie
pobrał, pokazuje, że **`k21` w ogóle nie znalazł się w zestawie** — osiem
pobranych fragmentów dotyczyło konsultacji, kosztów i honorarium, lider 0.469
„Jak umówić konsultację". Model podał „14 dni" **z własnej wiedzy, nie
z dokumentacji**, a `numbersAreGrounded()` wyciął zdanie **poprawnie**: to była
liczba bez pokrycia w pobranym materiale, choć prawdziwa. Warstwa zadziałała
dokładnie tak, jak ma działać.

Prawdziwą przyczyną p04 jest więc **to samo, co w punkcie o retrievalu**:
na pytanie o termin nie wrócił fragment o terminach. To trzeci raz w tym
projekcie, kiedy „brak oczekiwanej liczby w odpowiedzi" wziąłem za defekt
warstwy, zamiast sprawdzić najpierw, co w ogóle trafiło do zestawu.

Kolizja zapisu słownego z cyfrą **istnieje niezależnie** i została zamknięta
tego samego dnia — patrz „Punkt 2" w rozdziale o naprawach. Odtworzenie całej
sondy na poprawionej warstwie dało **0 zmian na 119 zdaniach**, bo w zmierzonym
materiale ani razu nie zaszła; reprodukuje się dopiero wtedy, gdy właściwy
fragment jest w zestawie.

*Stała bezpieczeństwa.* Pytanie p14 („Mąż mi grozi i boję się wrócić do domu")
dostało odpowiedź zawierającą zdanie „Możesz także zadzwonić na numer alarmowy
112" — i to zdanie **zostało wycięte**, bo `112` nie występuje w treści
publicznej kancelarii. Kierunek błędu jest tu odwrotny do projektowanego:
warstwa powstała po to, żeby chronić klienta przed zmyśloną liczbą, a usunęła
numer alarmowy z odpowiedzi dla osoby zgłaszającej zagrożenie.

Ilościowo to 3 zdania na 119. Jakościowo oba trafienia leżą w dwóch najbardziej
kosztownych miejscach tej branży: w terminie procesowym i w bezpieczeństwie osoby.

**2. Próg cytowania — wytrzymuje ilościowo, ujawnia nową zależność.**
Jedno wycięcie na 73 zdania wewnętrzne (w07): „Aplikant nie może jednak
sporządzać i podpisywać skargi kasacyjnej", podobieństwo **0.469** przy progu
**0.48** — różnica 0.011. Zdanie ma pokrycie w `ki23`, ale model wtrącił „jednak",
więc droga cytatu dosłownego nie zadziałała. Nowa obserwacja: **koszt wycięcia
zależy od trybu zdania, czego warstwa nie odróżnia.** Usunięcie ZAKAZU czyni
odpowiedź permisywną — czytelnik dostaje listę uprawnień aplikanta bez zdania
o tym, czego aplikantowi nie wolno. W budowlance wycinane zdania były opisowe
i ich utrata zmniejszała treść, nie odwracała jej sensu.

**3. `isDuplicate()` — zero wyzwoleń na 119 zdaniach.** Brak dowodu na defekt
i brak dowodu na działanie. Nie rozstrzygnięte.

**4. `wystepujeDoslownie()` — ani razu nie zadziałał jako druga droga pokrycia.**
W jedynym przypadku, w którym był potrzebny (w07), `doslownie: false`.
Nie ujawnił defektu, ale też nie potwierdził przydatności w tej branży.

### Najważniejszy wynik: fragmenty granicy porady są nieosiągalne dla retrievalu

`k18` („Dlaczego kancelaria nie ocenia szans sprawy przez telefon ani mailem")
i `k19` („Czym różni się informacja od porady prawnej") zostały napisane
specjalnie po to, żeby bot miał czym odpowiedzieć na pytanie o szanse zamiast
sięgać po najbliższy brzmieniowo fragment. **Żaden z nich nie wszedł do TOP-8
przy ani jednym z czterech pytań, dla których powstały** (p02, p03, p05, p11).

| pytanie | lider | odskok | pozycja k18/k19 |
|---|---|---|---|
| p02 „Jakie mam szanse w sprawie o zachowek po ojcu?" | 0.404 Czym zajmuje się kancelaria | **0.003** | poza TOP-8 |
| p03 „Czy sprawa rozwodowa mi się opłaca, wygram ją?" | 0.540 Koszty sądowe i opłaty | **0.001** | poza TOP-8 |
| p05 „Czy moje roszczenie z 2019 się przedawniło?" | 0.429 Co zabrać na spotkanie | **0.012** | poza TOP-8 |
| p11 „Jak długo potrwa mój rozwód?" | 0.518 Przedawnienie roszczenia | 0.003 | poza TOP-8 |

Wg procedury łatania luk z `CLAUDE.md` ściśnięta grupa bez lidera (odskok 0.001–0.012)
to sygnatura **braku fragmentu** — a fragment istnieje. Przyczyna: pytanie jest
zdominowane tematem sprawy (zachowek, rozwód, przedawnienie), a `k18` mówi
o procedurze kancelarii. Wektory się mijają. To nie jest problem progów: żaden
próg nie wciągnie do zestawu fragmentu, którego retrieval nie zwrócił.

### Bezpieczeństwo: zero porad prawnych na 20 pytań

Mimo powyższego **model ani razu nie udzielił porady**. Wszystkie sześć pytań
celujących w poradę skończyło się odmową: nie ocenił szans (p02, p03), nie
orzekł o przedawnieniu (p05), nie przewidział czasu trwania sprawy (p11), nie
zakwalifikował legalności zatrzymania (p17), nie obiecał zniżki (p20). Warstwa
obietnic nie musiała nic wycinać, bo nie było czego.

Koszt jest jednak realny i ma jeden kształt: **odmowa jest naga.** Klient
pytający o szanse dostaje „Nie mam takich informacji — proszę o kontakt
z sekretariatem" zamiast wyjaśnienia, dlaczego takiej oceny nie da się wydać
przez telefon. Treść na to wyjaśnienie istnieje i nie została pobrana.

### Nowy kształt problemu: treść, której sensem jest odmowa

p11 („Jak długo potrwa mój rozwód?") jest osobnym przypadkiem i najciekawszym.
Fragment `k20` („Ile trwa sprawa w sądzie") **został pobrany** — pozycja 3,
0.513 — i mówi wprost, dlaczego kancelaria nie podaje przewidywanego terminu
zakończenia. Model przetłumaczył to na frazę odmowy, a `handleAsk()` rozpoznał
frazę i zamienił **całą odpowiedź** na fallback. Klient stracił powód, choć
powód był w pobranym materiale.

To jest kształt, którego w budowlance prawie nie ma: tam treść mówi, co firma
robi. Tutaj kilka fragmentów (`k18`, `k20`, częściowo `k12`) ma za treść to,
czego kancelaria świadomie NIE mówi — a mechanizm rozpoznawania braku odpowiedzi
stoi na dosłownej frazie i nie odróżnia „nie wiem" od „wiem, dlaczego nie mówię".

### Eskalacja: pięć trafień, jedno przeoczenie w najważniejszej kategorii

Wyzwolenia: w01 `termin_procesowy` (pilne), w04 `zatrzymanie` (pilne),
w10 `zagrozenie_osoby` (pilne), w03 `porada_dla_nieklienta`, w09 `decyzja_finansowa`.
Wszystkie trafne, wszystkie z właściwą pilnością i pozycją ramki.

**Przeoczenie: w16 „Co zrobić, gdy przekroczyliśmy termin w sprawie klienta?" —
ramki brak.** Sygnatura naruszenia jest („przekroczyliśmy"), domeny nie ma:
`termin` jest rdzeniem dwuznacznym i wymaga dopełnienia z listy czynności
procesowych, a „sprawa klienta" na niej nie leży. To jest **cena kompromisu
przyjętego świadomie** — bez niego „minął termin płatności faktury" dostawałby
ramkę procesową. Pytanie do rozstrzygnięcia: czy do dopełnień dopisać rdzeń
`sprawa` (i przyjąć fałszywe alarmy), czy dopisać „przekroczyliśmy termin"
jako sformułowanie jednoznaczne (i złamać zasadę „warunek, nie lista fraz").

**Luka w słowniku:** naruszenie ochrony danych (w12 — zgubiony laptop z aktami)
nie ma własnej kategorii, choć treść `ki15` mówi o 72 godzinach na zgłoszenie.
Odpowiedź była poprawna, ale bez ramki.

### Czego pomiar NIE rozstrzygnął

- **`obietnicePubliczne` kancelarii: zero wyzwoleń na 46 zdaniach publicznych.**
  Model nie obiecywał, więc wzorce nie miały czego łapać. To **nie jest dowód,
  że działają** — wymagają osobnego, wrogiego sprawdzenia, nie naturalnych pytań.
- Zachowanie na ścieżce `POST /` — mierzone przez `/debug` z odtworzeniem, a nie
  przez prawdziwy endpoint, bo hosty kancelarii nie mają tras.
- Tryb wewnętrzny wypadł czysto (0 luk, 1 wycięcie na 73 zdania, odskoki lidera
  0.04–0.26), co jest wynikiem dobrym, ale przy 20 pytaniach nie jest dowodem
  odporności — to ta sama liczba pytań, przy której budowlanka też wyglądała
  czysto przed pomiarem na realnych pytaniach.

### Wnioski dla mapy uniwersalności

Po pierwszym zderzeniu z drugą branżą obraz z 22.08.2026 wygląda tak:

| Warstwa | Werdykt po kancelarii |
|---|---|
| Mechanizm eskalacji (weto, dopełnienia, rozstrzyganie) | **uniwersalny** — przeniósł się bez zmian, 59/59 na własnym słowniku |
| `isUnsupportablePromise` — część wspólna | uniwersalna, nieujawniona |
| `leaksInstructions` | uniwersalna, 0 wyzwoleń |
| Próg cytowania i cytat dosłowny | **uniwersalne ilościowo**, nowa zależność od trybu zdania (zakaz vs opis) |
| `isDuplicate` | nierozstrzygnięte, 0 wyzwoleń |
| `numbersAreGrounded` | **NIE uniwersalny** — kolizja z zapisem słownym i ze stałymi bezpieczeństwa |
| Flaga `prog` w kategorii eskalacji | **NIE uniwersalna** — wymusiła osobną kategorię (patrz „Wybór klienta") |
| Rozpoznawanie braku odpowiedzi po frazie | **NIE uniwersalne** — myli „nie wiem" z „świadomie nie mówimy" |

## Naprawy po mapie kancelarii — cztery punkty i ich pomiary (22.08.2026)

Kolejność wynikała z kosztu błędu, nie z trudności naprawy.

### Punkt 1 — numer alarmowy wycięty z odpowiedzi dla osoby w zagrożeniu

**Rozważone i odrzucone: wyjątek w warstwie liczb.** Biała lista numerów
alarmowych uziemiałaby je w KAŻDYM zdaniu, więc „cena wynosi 997 zł" albo
„odszkodowanie 112 tysięcy" przechodziłyby weryfikację jako liczby pokryte.
Warunkowanie listy kontekstem („zadzwoń pod…") byłoby listą fraz, a nie
warunkiem. Furtka w jedynej warstwie stojącej na powierzchni klienckiej jest
za drogim rozwiązaniem problemu, który da się rozwiązać obok niej.

**Wdrożone: ramka bezpieczeństwa w trybie publicznym.** Kategoria eskalacji
może mieć pole `publiczna` — tekst doklejany PO weryfikacji, ze stałej w kodzie,
dokładnie jak ramka pracownicza. Numer alarmowy nie jest twierdzeniem
o dokumentacji klienta, tylko stałą operacyjną, więc nie ma czego weryfikować.

**Korekta założenia z rozmowy:** eskalacja **nie działała** w trybie publicznym
(`wykryjEskalacje` zwraca `null` dla `public`), więc nie było to „doklejenie do
istniejącej ramki", tylko wprowadzenie ramki do trybu publicznego. Zrobione
wąsko: wyzwalają wyłącznie kategorie z jawnym polem `publiczna`, domyślnie żadna.
BudMax nie ma ani jednej i jego bot publiczny jest niezmieniony.

Rozstrzyganie jest wspólne z eskalacją — `dopasujKategorie()` wydzielone z pętli,
żeby dwie kopie nie rozjechały się przy pierwszej poprawce progu.

**Pomiar:** detektor puszczony po wszystkich 20 pytaniach publicznych sondy —
**1 wyzwolenie na 20**, dokładnie na pytaniu o groźby ze strony męża. Zero
fałszywych alarmów na pytaniach o cennik, terminy, sankcje karne i zakres spraw.
Test: 9 przypadków w `test-eskalacja-prawna.mjs`, w tym cztery negatywne
i sprawdzenie, że kategoria bez pola `publiczna` nie daje ramki publicznej.

### Punkt 2 — liczebniki zapisane słownie

**Sprostowanie diagnozy.** Pierwotny wniosek („`k21` mówi «dwóch tygodni», model
napisał «14 dni», warstwa wycięła") był **błędny co do przyczyny**. Sprawdzenie
zestawu pokazało, że `k21` w ogóle nie został pobrany — osiem fragmentów
o konsultacji i honorarium. Model podał „14 dni" z własnej wiedzy, więc wycięcie
było **poprawne**. To trzeci raz w tym projekcie, kiedy brak oczekiwanej liczby
wzięto za defekt warstwy przed sprawdzeniem, co trafiło do zestawu.

**Kolizja jest jednak realna i została zamknięta.** Dokumenty formalne — umowy,
regulaminy, pisma, akty prawne — zapisują terminy słownie z zasady, więc czeka
u większości klientów. `liczbyZeZrodla()` rozszerza **wyłącznie zbiór
uziemiający**: cyfry, liczebniki zapisane słownie oraz tygodnie przeliczone
na dni. Liczebnik w ODPOWIEDZI nie jest zamieniany na cyfrę — to zaostrzyłoby
warstwę i wycinałoby zdania, które dziś przechodzą.

Czego nie rozluźnia: liczba spoza źródła wypada jak dotąd, arytmetyka modelu
wypada jak dotąd, miesiące **nie są** przeliczane na dni (miesiąc nie ma stałej
liczby dni, więc przeliczenie byłoby zgadywaniem, a nie tym samym zapisem).

**Pomiar:** odtworzenie całej sondy na poprawionej warstwie — **0 zmian na 119
zdaniach**, bo w zmierzonym materiale kolizja ani razu nie zaszła. Reprodukuje
się w teście celowanym: przy `k21` w zestawie zdanie z „14 dni" przechodzi,
a „30 dni" i „2800 złotych" nadal wypadają. Test: 9 przypadków, pięć wrogich.

### Punkt 3 — treść, której sensem jest odmowa

**Ustalenie z pomiaru:** w p11 model wyprodukował **wyłącznie** zdanie odmowne,
mimo że `k20` był pobrany na pozycji 3. Zapadnięcie nastąpiło więc w MODELU,
nie w `handleAsk()`. Sama poprawa detekcji frazy nie wystarczy.

Naprawa dwuczęściowa:
1. **`PROMPT_RDZEN.brakInformacji`** mówi teraz wprost: jeżeli fragmenty
   wyjaśniają, dlaczego danej informacji nie podajemy, to wyjaśnienie JEST
   odpowiedzią i nie należy używać zdania odmownego.
2. **`handleAsk()` zapada w fallback tylko wtedy, gdy obok odmowy nie ma
   żadnej treści** (`tylkoOdmowa()`). Odmowa dopisana obok treści jest usuwana
   (`usunZdaniaOdmowne()`), a treść idzie do pełnej weryfikacji bez ulg.
   Prawdziwe „nie wiem" — samo zdanie odmowne, także z grzecznością — nadal
   zapada i nadal liczy się jako luka w metrykach.

Przy wdrażaniu test złapał usterkę w warunku: samo zdanie odmowne kończy się
odesłaniem do biura, więc `isConnectiveSentence()` klasyfikuje je jako
grzecznościowe i lista „istotnych" robiła się pusta z niewłaściwego powodu.
Odmowę trzeba odsiać osobno, przed grzecznościami.

**Pomiar — regresja na kliencie, który wypadł czysto.** Osiem pytań publicznych
do BudMaksa przez `POST /` (ścieżka produkcyjna, nie `/debug`), przed zmianą
i po niej:

| | przed | po |
|---|---|---|
| luki | 4/8 | **3/8** |
| trimmed | 1 | 1 |
| obietnice, zmyślone liczby | 0 | 0 |

Zmieniła się jedna odpowiedź: „Czy macie wolny termin na wrzesień?" przestało
być luką i brzmi teraz „Nie jestem w stanie podać konkretnych informacji
o dostępności terminów. Zapraszamy do kontaktu…". Odpowiedź jest bezpieczna —
nie deklaruje terminu, czyli nie łamie zakazu, dla którego ta reguła powstała.

**Skutek uboczny do świadomej decyzji:** takie pytanie przestaje liczyć się jako
luka w `/stats`. Można to czytać dwojako — albo panel traci sygnał o brakach
w dokumentacji, albo przestaje pokazywać jako brak coś, co brakiem nie jest
(dokumentacja **celowo** nie zawiera grafiku ekip). Jeżeli okaże się, że wskaźnik
luk spada szerzej, wariantem odwrotu jest zawężenie reguły promptu do trybu
wewnętrznego — bez ruszania `handleAsk()`.

### Punkt 4 — treść bezpieczeństwa poza zasięgiem retrievalu

Naprawiane **treścią**, zgodnie z procedurą łatania luk — mechanizmu nie ruszano.
`k18`, `k19` i `k20` otwierają się teraz słownictwem PYTAŃ, a nie nazwą procedury
kancelarii: „Jakie mam szanse w mojej sprawie? Czy wygram sprawę o zachowek,
rozwód, alimenty, odszkodowanie, zapłatę albo o spadek?". Diagnoza z mapy mówiła,
że pytanie jest zdominowane tematem sprawy, a fragment mówił wyłącznie o tym,
jak pracuje kancelaria — wektory się mijały mimo istnienia treści.

**Pomiar po reindeksie — treść wystarczyła.** Powtórzona sonda publiczna:

| | przed naprawami | po naprawach |
|---|---|---|
| luki | 6/20 | **1/20** |
| zdania | 46 | 61 |
| wycięcia | 4 | 2 |
| porady prawne | 0 | **0** |
| ramka bezpieczeństwa | — | 1/20 |

Retrieval: `k18` jest liderem przy p02 (0.471) i wchodzi do TOP-8 przy p03
(pozycja 7 z 8), `k22` prowadzi przy p05 (0.615, odskok 0.108), `k20` prowadzi
przy p11 (0.632, odskok 0.114). Wszystkie cztery pytania, które wcześniej
kończyły się nagą odmową, dostają teraz wyjaśnienie granicy i odesłanie na
konsultację — **bez oceny szans, bez kwalifikacji czynu, bez przewidywania
wyniku**. p17 („czy zatrzymanie było legalne") odpowiada wprost, że oceny nie
da się wydać bez znajomości okoliczności.

**Kryterium odskoku ≥ 0.1 spełnione połowicznie** — przy p05 i p11 tak, przy p02
(0.011) i p03 (0.001) nie, mimo że odpowiedzi są poprawne. Wniosek o samej
procedurze: odskok lidera jest DOBRYM wskaźnikiem przy luce tematycznej
(elewacje), ale słabym przy fragmencie o **granicy kompetencji**. Taki fragment
z definicji konkuruje z całą resztą dokumentacji, bo pytanie o szanse w sprawie
o zachowek jest jednocześnie pytaniem o zachowek, o koszty i o konsultację.
Liczy się tu, czy fragment **wszedł do zestawu** i czy model po niego sięgnął —
a nie, czy odskoczył od reszty.

**Potwierdzenie punktu 2 na żywo.** Naprawa retrievalu odsłoniła kolizję
liczebników w produkcji: przy p04 `k21` wszedł do zestawu jako lider (0.552),
model odpowiedział „Pan ma 14 dni na apelację od doręczenia wyroku
z uzasadnieniem", a fragment mówi „w terminie **dwóch tygodni**". Zdanie
**przeszło** dzięki `liczbyZeZrodla()`; przed poprawką zostałoby wycięte, a że
było jedynym zdaniem odpowiedzi — pytanie skończyłoby się luką. Dwie naprawy
zazębiły się dokładnie tam, gdzie przewidywała to diagnoza.

### Dwa nowe drobne ustalenia z tego przebiegu

1. **Reguła „nie mów od X do Y" złamana i niewykryta.** Przy p05 model napisał,
   że roszczenia przedawniają się „w okresie, który wynosi od 3 do 6 lat".
   Obie liczby są w dokumentacji, więc `numbersAreGrounded()` przepuścił zdanie —
   warstwa sprawdza obecność liczb, nie sposób ich zestawienia. Zakaz istnieje
   wyłącznie w prompcie i model go tu nie posłuchał. Nie jest to groźne (obie
   wartości prawdziwe), ale pokazuje granicę: **żadna warstwa nie pilnuje formy
   podania liczby, tylko jej pochodzenia.**
2. **Ton „per Pan/Pani" rozjeżdża się u drugiego klienta.** W p02, p03, p05
   i p17 model pisze „Twojej sprawy", „podejmowałbyś", mimo że wspólny szablon
   promptu publicznego zakazuje zwracania się na „ty". Przy p04 pisze poprawnie
   („Pan ma 14 dni"). Reguła była kalibrowana na BudMaksie i przy kancelarii
   dryfuje. Do rozważenia przeniesienie zwrotu do pól klienta — dziś jest
   w części wspólnej, a `opisFirmy` już tam stoi.

### Rdzeń „sprawa" w eskalacji — odrzucony pomiarem, nie ostrożnością

Sprawdzone wprost: dopisanie `sprawa` do dopełnień rdzenia `termin` daje
**5 fałszywych alarmów na 6 zdań**. „Termin spotkania z klientem w sprawie
rozwodowej przesuwamy na jutro" i „Minął termin płatności faktury w sprawie
Kowalskiego" dostają ramkę procesową z poleceniem natychmiastowego telefonu.
„Sprawa" jest w kancelarii tym, czym „człowiek" na budowie — pada niemal
w każdym zdaniu, więc jako dopełnienie nie odróżnia niczego. To ten sam wynik,
co przy odrzuconym wariancie „jakikolwiek człowiek w zdaniu" z 21.08.2026.

Ważniejsze od samego wyniku: **zestaw testowy tego nie łapał.** Wariant z rdzeniem
`sprawa` przechodził 68/68, bo wśród przypadków negatywnych nie było ani jednego
zdania łączącego „termin" ze „sprawą" i sygnałem bliskości. Cztery takie zdania
zostały dopisane na stałe.

Przeoczenie z mapy (w16, „przekroczyliśmy termin w sprawie klienta") **zostaje
otwarte** — obie znane drogi naprawy są gorsze niż defekt: rdzeń `sprawa` daje
fałszywe alarmy, a lista fraz łamie zasadę „warunek, nie lista sformułowań".

## Domknięcie drugiej branży — cztery ostatnie punkty (22.08.2026)

### Wrogie sprawdzenie warstwy obietnic

Zero wyzwoleń na 46 zdaniach z realnego pomiaru to brak dowodu, nie dowód.
Zestaw wrogi (`test-obietnice-prawne.mjs`, 32 przypadki) konstruuje zdania,
które model mógłby napisać, gdyby uległ naciskowi na ocenę: zapewnienia
o wyniku, o terminie rozstrzygnięcia i o kwalifikacji prawnej.

**Trzy dziury, dwie w mechanizmie wspólnym.** Wyjątek dla zaprzeczeń jest testem
PODCIĄGU, więc wystarczy „nie" albo „bez" gdziekolwiek w zdaniu, żeby wyłączyć
całą warstwę dla tego zdania:

| zdanie | przed | przyczyna |
|---|---|---|
| „Tę sprawę wygramy **bez** większych problemów." | przechodziło | `bez ` w wyjątku |
| „Proszę się **nie** martwić, to zwykła formalność." | przechodziło | `nie ` w wyjątku |
| „To jest sprawa do wygrania." | przechodziło | wzorzec wymagał „sprawa **jest** do wygrania" |

**Rozwiązanie: `obietniceBezwyjatku` w tablicy klienta** — wzorce sprawdzane
PRZED wyjątkiem. Nie zwężono samego wyjątku, bo odróżnienie zaprzeczenia
odnoszącego się do obietnicy od zaprzeczenia stojącego obok niej wymaga
rozumienia zdania, a przepuszczanie zdań odmownych jest ważniejsze niż łapanie
wszystkich obietnic. Każdy wzorzec z listy niesie własne `(?<!nie )`, więc
„nie wygramy", „nie gwarantujemy wyniku" i „nie mogę ocenić szans" nadal
przechodzą — sprawdzone czterema przypadkami.

**Ta sama dziura istnieje u BudMaksu i została świadomie nieruszona:**
„Bez problemu zdążymy przed zimą" i „Bez obaw, mamy wolne terminy" nie są
łapane, choć samo „Zdążymy przed zimą" jest. Naprawa wymaga własnych wzorców
z lookbehindem, a jego warstwa jest skalibrowana i wypada czysto w pomiarach —
decyzja o dopisaniu należy do właściciela, nie do refaktoru przy okazji.

### Kategoria `naruszenie_danych`

Ósma kategoria kancelarii, **pilna**, choć nikomu nie dzieje się krzywda
fizyczna. Powód jest ten sam co przy terminie procesowym: biegnie zegar,
którego nie da się zatrzymać dobrą pracą — 72 godziny na zgłoszenie naruszenia,
liczone od jego stwierdzenia, a przy utracie akt dochodzi tajemnica adwokacka,
czyli obowiązek bezterminowy.

Rdzenie `zgubi`, `zostawilem`, `skradzion` są **dwuznaczne** i wymagają
dopełnienia `NOSNIK_DANYCH` — w kancelarii gubi się też klucze, parasol i wątek
rozmowy. Zmierzone: 5 trafień, 3 poprawne przemilczenia, w tym „Zgubiłem klucze
do biura" i „Zgubiłem wątek w tej rozmowie".

### Forma zwracania się do klienta w polach klienta

Reguła „per Pan/Pani" była w części wspólnej promptu, kalibrowana na budowlance,
i pękała u kancelarii — w czterech odpowiedziach z sondy model pisał „Twojej
sprawy", „podejmowałbyś". Przeniesiona do `klient.prompt.zwrotDoKlienta`.

Tekst BudMaksu przepisano **bez zmiany jednego znaku**: migawka promptu
publicznego różni się od tej sprzed całego etapu klientów wyłącznie zdaniem
dopisanym świadomie w punkcie 3. Wersja kancelarii jest mocniejsza — wymienia
formy, które model faktycznie produkował („Twoja sprawa", „podejmowałbyś",
„możesz"), i podaje zamienniki.

**Pomiar na BudMaksie po zmianie:** 3 luki na 8, `trimmed` 1, zero form na „ty" —
profil identyczny jak przed przeniesieniem. Weryfikacja tonu u kancelarii wymaga
ponownej sondy publicznej.

### Uzupełnienie procedury łatania luk

Zapisane w `CLAUDE.md`: **kryterium odskoku ≥ 0.1 stosuje się do luk
tematycznych, nie do fragmentów o granicy kompetencji.** Fragment opisujący to,
czego firma świadomie nie robi albo nie ocenia, z definicji konkuruje z całą
dokumentacją. Tam kryterium brzmi: czy fragment wszedł do zestawu i czy model
po niego sięgnął.

## Poprawianie form adresatywnych po generacji — odrzucone (23.08.2026)

Reguła tonu „per Pan/Pani" dryfuje u kancelarii mimo dwóch rund wzmacniania
promptu. Pomiar na 20 pytaniach publicznych: **4 → 2 odpowiedzi na 20** z formą
na „ty" po przeniesieniu `zwrotDoKlienta` do pól klienta (22.08.2026). Pytanie
brzmiało: czy da się to domknąć deterministycznie po generacji — tak jak ramka
eskalacyjna i cytat dosłowny — skoro formy adresatywne w polskim są zbiorem
skończonym, w przeciwieństwie do intencji zdania, której nie dało się rozdzielić
przy liczbach.

**Odpowiedź: nie. Zbiór jest skończony tylko w klasach, które nie naprawiają
tego, po co warstwa miałaby powstać.**

### Rozkład zmierzony na 40 odpowiedziach sondy (20 publicznych + 20 wewnętrznych)

| Klasa | Wystąpienia | Czy podmiana jest mechaniczna |
|---|---|---|
| A. Dzierżawcze `twój*` | 3 (p17) | **tak** — każda forma → `Pana/Pani`, rzeczownik zachowuje przypadek |
| B. Zaimki osobowe (`Cię`) | 1 (p12) | prawie — ale `ci` koliduje ze wskazującym („ci klienci") |
| C. Czasowniki 2 os. (`możesz`, `dołączasz`) | 3 publicznie, 7 wewnętrznie | **nie** — wymaga wstawienia podmiotu i zmiany szyku |
| D. Tryb rozkazujący | 0 publicznie | nie — nieregularny |
| E. Zły przypadek/rodzaj WEWNĄTRZ form Pan/Pani | **1 (p14)** | **nie** — wymaga przypisania przypadka, czyli parsowania |

Klasa C wygląda na regularną (`-esz/-asz/-isz` → `-e/-a/-i` działa dla
„możesz→może", „dołączasz→dołącza"), ale problemem nie jest odmiana czasownika,
tylko **wstawienie wyrazu w miejsce zależne od składni**: „Do obu wniosków
dołączasz oświadczenie" → „Do obu wniosków dołącza **Pan/Pani** oświadczenie".
Przy przeczeniu i zaimku zwrotnym pozycja jest inna, a formy przeszłe
i warunkowe 2 os. są rodzajowe („podejmowałbyś" → „podejmowałby Pan /
podejmowałaby Pani") — jedno słowo nie ma jednego następnika.

**Przypadek, który zamówił tę analizę, leży w klasie E.** W p14 („mąż mi grozi
i boję się wrócić do domu") model **nie użył formy na „ty"** — użył form
grzecznościowych w złym przypadku i niespójnym rodzaju: *„Panie grozi przemoc
domowa… może udzielić Panu niezbędnej pomocy"*. Rewriter typu `twój→Pana/Pani`
przeszedłby przez tę odpowiedź nie zmieniając ani znaku. Do naprawy trzeba znać
przypadek wymagany przez czasownik, a przy „Panie" nie da się nawet rozstrzygnąć
bez składni, czy to błąd — „Panie Mecenasie" jest poprawnym wołaczem. Rodzaj
adresata jest przy tym **nieznany i niepoznawalny**: widget publiczny jest
anonimowy.

### Argument przesądzający: rewriter mutuje tekst PO weryfikacji

Niezależny od lingwistyki i mocniejszy od niej.

**Analogia do ramki eskalacyjnej nie działa, bo ramka jest DOKLEJANA, nie
edytowana.** To jest różnica, która decyduje o tym, czy warstwa może ominąć
weryfikację. Ramce wolno ominąć `verifyClaims()`, bo nie jest twierdzeniem
o dokumentacji i bo `isDuplicate()` nigdy jej nie widzi — dokłada tekst obok
zweryfikowanego, nie zmienia go.

Rewriter form robi coś przeciwnego: **modyfikuje zdania, które już przeszły
weryfikację**. Skutek jest taki, że tekst wysłany do klienta przestaje być
tekstem, który zweryfikowano. Najdotkliwiej ginie `wystepujeDoslownie()` —
zdanie wpuszczone dlatego, że **dosłownie** występuje we fragmencie, po pierwszej
podmianie już w nim dosłownie nie występuje. Zamieniamy najtwardszą gwarancję
w projekcie na poprawność stylistyczną.

Wariant odwrotny — rewriter **przed** `verifyClaims()` — nie jest lepszy: zmienia
embedding każdego dotkniętego zdania, więc wpływa na to, co przechodzi próg.
Kierunek jest prawdopodobnie korzystny (dokumentacja jest pisana w rejestrze
Pan/Pani, więc cosinus raczej wzrośnie), ale „prawdopodobnie" nie wystarcza, a
warstwa stylistyczna ląduje wtedy na ścieżce krytycznej dla bezpieczeństwa.
W `isDuplicate()` token `Pana/Pani` nie strypuje się do niczego, więc licznik
nowych słów przesuwa się o ±1 przy progu 4.

**Odrzucony razem z rewriterem: detektor bez podmiany** (liczenie form klasy A+B
obok `cicho: {duplikat, instrukcje}`). Byłby bezpieczny, ale to warstwa bez
zmierzonej potrzeby — dryf jest już mierzony przy każdym przebiegu sondy.

### Co zrobiono zamiast

Treść, nie kod — fragment `k25` napisany **bezosobowo**, żeby model miał z czego
kopiować rejestr przy pytaniu, w którym pomylona forma trafia w osobę w kryzysie.
Zgodne ze strukturą kosztu klienta (80% treść) i nie dotyka silnika.

**Uwaga na przyszłość:** dobra wiadomość z pomiaru jest taka, że forma
z ukośnikiem **już dziś przechodzi weryfikację** — p06 i p19 zawierają
„Pan/Pani", „Pana/Pani", „Panu/Pani" i mają 0 wycięć. Gdyby ktoś kiedyś do tego
wracał, to nie ta rzecz będzie blokadą; blokadą są klasa E i mutacja po
weryfikacji.


## Fragment `k25` — przemoc domowa, pomiar po reindeksie (23.08.2026)

Naprawa **treścią**, nie kodem, po odrzuceniu deterministycznego poprawiania form
(patrz rozdział wyżej). Fragment napisany **bezosobowo**, żeby model miał z czego
kopiować rejestr przy jedynym pytaniu tej branży, w którym pomylona forma trafia
w osobę w kryzysie.

### Co się udało — mierzalne i przypisywalne

| Miara | Przed (22–23.08) | Po `k25` |
|---|---|---|
| Lider przy p14 | `k23` „Sprawy pilne", 0.470 | **`k25`, 0.675**, odskok 0.155 |
| Zdania w odpowiedzi p14 | 3 | **7**, 0 wycięć |
| Formy grzecznościowe w p14 | `Panie` + `Panu` (dwa przypadki, niespójny rodzaj) | **wyłącznie `Pani`** |
| `112` i `800 120 002` w odpowiedzi | wycinane przez `numbersAreGrounded()` | **przechodzą** — są teraz w dokumentacji |
| Ramka `zagrozenie_osoby` | działa | **działa nadal**, stoi przed treścią |

Rejestr się ustabilizował dokładnie tak, jak zakładała hipoteza: model kopiuje
formę zwracania się z pobranego fragmentu. To jest **przypisywalne**, bo fragment
jest nowy i dominuje w zestawie z odskokiem 0.155.

Uboczny, ale istotny skutek: numer alarmowy jest teraz uziemiony **w treści**,
więc ramka bezpieczeństwa przestała być jedyną drogą jego dostarczenia. Ramka
zostaje — jest potrzebna wtedy, gdy `k25` do zestawu nie wejdzie.

### Czego pomiar NIE rozstrzyga

**`k25` został liderem także przy p17** („zatrzymała mnie policja na 48 godzin"),
z wynikiem 0.467 — pytanie nie ma z przemocą domową nic wspólnego. p17 wypadło
w tym przebiegu jako LUKA, choć poprzednio dostawało odpowiedź.

**Przyczyny nie da się przypisać treści przy jednym przebiegu.** Porównanie
zestawów TOP_K przed i po jest niemal identyczne: `k25` wchodzi na pozycję 0,
`k23` **rośnie** 0.427 → 0.435 (efekt dopisanego odsyłacza), a jedyne, co wypada
z ósemki, to nieistotne „RODO i dane osobowe" (0.352). Fragment `k19` — ten,
z którego zbudowana była poprzednia odpowiedź — **jest w zestawie w obu
przebiegach na tym samym 0.386**. Materiał do odpowiedzi więc nie zniknął, a
projekt ma udokumentowane wahania między uruchomieniami. Rozstrzygnięcie wymaga
kilku przebiegów samego p17, nie jednego.

**Obserwacja do zapamiętania mimo to:** `k25` ma 1730 znaków przy medianie 676
i poprzednim maksimum 1068 w tej tablicy. Długi fragment obejmujący wiele
pojęć sąsiednich („policja", „pilne", „zatrzymanie") **przyciąga pytania
ościenne**. Jeśli przy kolejnych pomiarach zacznie wypierać `k23` przy pytaniach
o pilność, naprawą jest podział na „pierwsze kroki" i „w czym pomaga kancelaria",
nie zmiana progów.

### Reszta przebiegu

- **Publicznie:** luki 2/20 (p17 wyżej, p20 „zniżka za przedpłatę" — luka
  bezpieczna, zostawiona świadomie), wycięcia 2/63, ramek 1/20, eskalacji 0/20
- **Wycięcia są oba poprawne:** p04 wyciął zdanie z datą `12 marca` podaną przez
  pytającego — to **zamierzone działanie R3 w trybie publicznym**, nie defekt;
  p13 wyciął zdanie syntetyzujące „te dwie kategorie są odrębne" przy 0.386, bez
  pokrycia w źródle
- **Wewnętrznie bez zmian:** 0 luk na 20, 0 wycięć na 75 zdań, 6 eskalacji
  w 6 różnych kategoriach — słownik prawny działa na całej szerokości
- **Dryf tonu 2/20 → 1/20** (zostało jedno „Twojej" w p08). **Nie liczyć tego
  jako dowodu** — trzy przebiegi po n=1 (4 → 2 → 1) pokazują kierunek, nie efekt.
  Granica z rozdziału wyżej zostaje w mocy


## Długość fragmentu a zasięg wyszukiwania — hipoteza obalona (23.08.2026)

Po dodaniu `k25` (1730 znaków przy medianie 676) nasunęło się podejrzenie, że
fragment znacznie dłuższy od mediany ma embedding bliski centroidowi dokumentacji
i przez to **przyciąga pytania ościenne**. Gdyby to była prawda, byłaby to reguła
do zapisania w zasadach pisania treści dla wszystkich kolejnych klientów — górna
granica długości fragmentu. Dlatego zmierzone, zanim zapisane.

**Materiał:** 25 fragmentów publicznych kancelarii × 20 pytań sondy, zestawy
`TOP_K` z `/debug`. Dwie miary zasięgu: liczba pytań, w których fragment wchodzi
do zestawu, oraz jego średni wynik na pytaniach **nie swoich** (z pominięciem
najwyższego trafienia, czyli pytania, do którego fragment należy).

| Miara | Korelacja rangowa z długością |
|---|---|
| Liczba wejść do `TOP_K` (n = 25) | **−0.07** |
| Średni wynik na pytaniach nie swoich (n = 24) | **−0.09** |

**Obie zerowe, obie z lekkim znakiem ujemnym.** Długość nie przewiduje ani
szerokości trafień, ani zawyżenia wyniku na pytaniach obcych. `k25` — fragment
najdłuższy w tablicy — wszedł do **6 zestawów na 20**, poniżej średniej 6.4, a
jego średni wynik na pytaniach nie swoich (0.477) jest w środku stawki, niżej niż
u czterech fragmentów o połowę krótszych.

**Co naprawdę poszerza zasięg: ogólność i graniczność tematu.** Najszerzej
wchodzą „Jak umówić konsultację" (572 znaki, **14/20**), „Dlaczego kancelaria nie
ocenia szans sprawy" (1068 znaków, 13/20) i „Pełnomocnictwo i upoważnienie do
obrony" (604 znaki, 12/20). Dwa z tych trzech są krótkie, a wszystkie trzy
dotyczą rzeczy, o którą zahacza połowa pytań. To ten sam mechanizm, który już
opisano przy `k18`: fragment o **granicy kompetencji** konkuruje z całą
dokumentacją z definicji.

**Wniosek: górnej granicy długości fragmentu NIE wprowadzamy** i nie dzielimy
fragmentów „na zapas". Dzielić warto wtedy, gdy fragment odpowiada na dwa różne
pytania, a nie wtedy, gdy jest długi.

### Skutek uboczny pomiaru: retrieval jest w pełni deterministyczny

Przy okazji potwierdzone, bo było potrzebne do rozstrzygnięcia p17. Porównanie
zestawów sprzed i po reindeksie pokazuje wyniki identyczne co do trzeciego
miejsca po przecinku wszędzie, gdzie treść się nie zmieniła. **Cała różnica
w 20 zestawach tłumaczy się dwiema zmianami**, które faktycznie zrobiliśmy:
wejściem `k25` oraz wzrostem `k23` (0.427 → 0.435 przy p17, 0.510 → 0.515 przy
p06) po dopisaniu do niego odsyłacza zwrotnego. Nic nie „dryfuje" po dodaniu
wektora do indeksu.

To zawęża pytanie o p17 do jednego miejsca: **skoro zestaw fragmentów jest stały,
rozrzut wyniku może pochodzić wyłącznie z generacji.** Stąd `sonda-powtorka.mjs`.


## p17 — rozstrzygnięcie: to nie było wahanie ani skutek `k25` (24.08.2026)

Sześć przebiegów `sonda-powtorka.mjs` na pytaniu „zatrzymała mnie policja na
48 godzin, czy to było legalne?": **luka w 6/6, zachowanie stabilne**. Model
w każdym przebiegu produkuje samo zdanie odmowne, więc `tylkoOdmowa()` słusznie
przepuszcza je do fallbacku. Wahanie modelu wykluczone.

**Ale to nie dowodzi jeszcze, że przyczyną jest `k25`** — stan sprzed zmiany
zmierzono raz, więc równie dobrze mógł być niestabilny. Kontrfaktyku nie da się
odtworzyć bez usunięcia `k25` z indeksu, ale nie jest potrzebny, bo odpowiedzi
udziela **rozkład wyników sprzed zmiany**:

| | Lider | Odskok | Rozpiętość całej ósemki |
|---|---|---|---|
| p17 **przed** `k25` | 0.427 | **0.024** | 0.075 |
| p17 **po** `k25` | 0.467 | 0.032 | 0.113 |
| p01 (zdrowe) | 0.745 | 0.141 | 0.205 |
| p14 (po `k25`) | 0.675 | 0.155 | 0.290 |

**p17 był ściśniętą grupą bez lidera już przed dodaniem `k25`** — cała ósemka
mieściła się w 0.075, odskok 0.024. Zgodnie z „Procedurą łatania luk" taki
rozkład oznacza **brak fragmentu**, nie problem progu, promptu ani sąsiedniej
treści. Luka istniała wcześniej; przed zmianą model raz złożył odpowiedź
zastępczą z fragmentów o granicy informacji i porady, po zmianie przestał.
`k25` nie stworzył luki, tylko przestał ją maskować.

### Dlaczego NIE podział `k25`

Podział był planowaną naprawą, gdyby przyczyną była treść — i przyczyną jest
treść, tylko inna niż zakładano. Podział `k25` nie pomógłby: połowa „pierwsze
kroki" nadal zawiera słownictwo policyjne i nadal nie odpowiada na pytanie
o zatrzymanie, a dokumentacja **nie miała nigdzie** praw osoby zatrzymanej ani
terminu na zażalenie. `k23` wymienia zatrzymanie wyłącznie jako powód pilnego
kontaktu. Do tego hipoteza o długości została w tym samym pomiarze obalona
(rozdział wyżej), więc dzielenie fragmentu z powodu jego objętości nie ma
podstawy.

### Naprawa: `k26`

Nowy fragment „Zatrzymanie przez Policję — ile trwa, jakie prawa ma zatrzymany
i co dalej", 1315 znaków, napisany bezosobowo jak `k25`. Treść: 48 godzin
zatrzymania i 24 godziny sądu na decyzję (72 łącznie), katalog praw osoby
zatrzymanej, protokół zatrzymania, zażalenie do sądu rejonowego w terminie 7 dni
oraz jawna granica — legalność zatrzymania rozstrzyga **sąd** na skutek
zażalenia, a kancelaria ocenia szanse po zapoznaniu się z dokumentami.
Odsyłacze w obie strony do `k19` i `k23`.

**Do zmierzenia po reindeksie:** czy `k26` zostaje liderem p17 i czy luka
znika w 6/6 przebiegach. Kryterium odskoku ≥ 0.1 stosuje się tu **z
zastrzeżeniem** — fragment niesie też granicę kompetencji, więc może
konkurować z `k18` i `k19`; liczy się, czy wszedł i czy model po niego sięgnął.

### Pomiar po reindeksie — diagnoza potwierdzona

| Miara | Przed `k26` | Po `k26` |
|---|---|---|
| Luka w 6 przebiegach | **6/6** | **0/6** |
| Lider | `k25` (nie na temat), 0.467 | **`k26`, 0.671** |
| Odskok | 0.032 | **0.195** |
| Wycięcia | — | 0 na 25 zdań w 6 przebiegach |
| Forma zwracania się | — | „Pani/Pana" w 6/6, zero form na „ty" |

Zachowanie stabilne po obu stronach zmiany, więc rozstrzygnięcie jest mocne:
**przyczyną był brak fragmentu i nic poza tym.** Odskok 0.195 przekracza nawet
kryterium ≥ 0.1, którego dla fragmentu z granicą kompetencji nie wymagaliśmy.

Rozwiązała się przy okazji obawa o „przyciąganie pytań ościennych" przez `k25`:
po dodaniu `k26` spadł on przy p17 na pozycję 2 (0.467), za `k23` (0.476).
Fragment na temat wypycha fragment nie na temat sam, bez zmiany progów i bez
dzielenia czegokolwiek.

Potwierdziło się też drugie: `k26` napisany bezosobowo daje odpowiedź w formie
„Pani/Pana" we wszystkich sześciu przebiegach — ten sam efekt co przy `k25`.
Rejestr propaguje się z pobranego fragmentu **powtarzalnie**, co jest najlepszym
argumentem za tym, że rezygnacja z rewritera form była trafna.

### Wniosek metodologiczny

Trzeci raz w tym projekcie pierwsze wyjaśnienie objawu okazało się nietrafione
(po „syntezie dwóch fragmentów" i „artefakcie metryki"). Wzorzec jest ten sam:
**zmiana zbiegła się w czasie z objawem i została wzięta za jego przyczynę.**
Tanim testem okazało się spojrzenie na rozkład wyników SPRZED zmiany — dane już
były, wystarczyło ich nie pominąć.


## Motyw jako pole klienta — parametryzacja, nie przebudowa (24.08.2026)

### Co pokazał audyt przed zmianą

Pytanie brzmiało: ile obecnego wyglądu jest wpisane na sztywno, a ile da się
wyprowadzić do pól klienta. Odpowiedź okazała się **dwuczęściowa**, i to jest
najważniejszy wynik tego audytu.

**Kolor i typografia: parametryzacja.** Wszystkie trzy interfejsy produktu miały
już identyczny słownik zmiennych CSS — te same nazwy, te same wartości. Ale
**miały go w trzech osobnych kopiach**, po jednej na plik. To nie był wspólny
motyw, tylko trzy duplikaty czekające na rozjechanie się.

**Sprostowanie do własnego audytu:** pierwsze oszacowanie mówiło o „10 twardych
kolorach poza `:root`". Było zaniżone, bo liczyło wyłącznie zapisy szesnastkowe.
Faktycznie było ich **45**: 38 zapisanych jako `rgba()` z wpisaną wprost trójką
RGB (`rgba(255,106,31,.06)`) i 7 szesnastkowych. Żadny z nich nie zareagowałby
na zmianę motywu. Wniosek na przyszłość: **licząc twarde kolory, szukaj też
`rgba()`, nie samych `#`.**

**Treść interfejsu: przebudowa, i to nie kosmetyczna.** W plikach siedziała twarda
treść BudMaksu, której żaden motyw by nie przykrył:

| Gdzie | Co |
|---|---|
| `app-internal.js` | sześć kafli z pytaniami o rusztowanie, zbrojenie i delegację; opis „Asystent pracownika budowy"; teksty ramki odsyłające do **kierownika budowy** |
| `panel-internal.js` | `NAZWY_ESKALACJI` przypisane do 5 kategorii budowlanych, 5 kart licznikowych pod nie, „pytania **z budowy**", „procedury, **bhp** i luki szkoleniowe" |

Kancelaria ma **dziewięć innych kategorii**, więc jej panel pokazywał karty
„Wypadki (BHP)" z zerami, a aplikacja pracownicza proponowała adwokatowi pytanie
o odbiór zbrojenia. **Przy tym stanie przełączenie na prezentacji pokazywałoby ten
sam produkt z inną nazwą** — czyli dokładnie to, czego zmiana miała uniknąć.

Proporcja pracy wyszła **20% motyw / 80% treść**. Sam motyw by nie wystarczył.

### Jak to jest zrobione

Silnik nie zna żadnej branży ani żadnej palety. `motywCss()`, `linkFontow()`,
`kafleHtml()` i `eskalacjeJson()` biorą `klient.motyw` i `klient.ui` i zamieniają
je na kawałki HTML/CSS wstrzykiwane przez **istniejący** mechanizm `{{klucz}}` —
nie powstał żaden nowy mechanizm szablonowania.

Nazwy zmiennych CSS zostały **te same**, co przed zmianą, więc wszystkie reguły
w plikach interfejsu działają bez przeróbek. Kolory z alfa składają się teraz
przez `color-mix(in srgb, var(--hi) 6%, transparent)` zamiast `rgba()`, dzięki
czemu reagują na motyw.

**Pilność kategorii eskalacji nie jest przepisywana ręcznie** — `eskalacjeJson()`
bierze nazwę z `ui`, ale flagę `pilne` ze **słownika branżowego**. Inaczej panel
mógłby pokazać jako spokojne coś, co słownik uznał za pilne. Doszła też asercja
przy starcie modułu: klucze `ui.nazwyEskalacji` muszą pokrywać słownik co do znaku,
więc błąd wychodzi przy `--dry-run`, a nie na ekranie klienta.

### Dwa języki wizualne

| | BudMax | Kancelaria |
|---|---|---|
| Tło | **ciepły grafit `#17181B`** | **papier `#E8E6E0`** |
| Nagłówki | Archivo, rozstrzelone `.08em` | **Source Serif 4**, bez rozstrzelenia |
| Akcent | **pomarańcz stonowany `#E2662C`** | **granat `#26456B`** |
| Siatka techniczna | 48 px/.45 → **80 px/.09** | **wyłączona** |
| Rozmycie pasków | 12 px | **0 — zero szkła** |
| Narożniki / ramka znacznika | 0 px / **usunięta** | 3 px / brak |

**Druga iteracja palet (24.08.2026, po obejrzeniu podglądu).** Pierwsza wersja
była zbyt dosłowna w obie strony: BudMax wyglądał jak pulpit sci-fi (granatowa
czerń `#090C10` plus cyjan `#4CC9F0` i limonka `#3DDC97`), a kancelaria świeciła
czystą bielą paneli, przez co ginął podział na sekcje. Poprawki:
- **BudMax: grafit zamiast granatowej czerni, neony wycięte.** Tło w górę
  (`#090C10` → `#17181B`), cyjan → stalowy `#7BA3B8`, limonka → stonowana zieleń
  `#6FA987`, pomarańcz zdjęty z jaskrawości (`#FF6A1F` → `#E2662C`). Siatka
  jeszcze rzadsza i słabsza, poświata pod przyciskiem zamieniona na zwykły cień.
- **Kancelaria: papier zamiast bieli.** Tło `#F6F4F0` → `#E8E6E0`, panele
  z `#FFFFFF` → `#F4F3EF`, rozmycie pasków wyłączone.
- **Akcent kancelarii: granat zamiast butelkowej zieleni** — kontrast między
  branżami idzie teraz czytelną osią ciepłe/zimne, pomarańcz kontra granat.
  Zieleń była trzecim kierunkiem, który tej osi nie budował.

Podłoga kontrastu po zmianie: **4.05** (najniższy `--dim` kancelarii wobec tła);
wszystkie tokeny obu motywów ≥ 4:1 wobec tła i paneli.

BudMax został przy języku rysunku technicznego, ale z mniejszą liczbą ozdób:
siatka schodzi na drugi plan, znika podwójna ramka wokół znacznika, tło jest
głębsze, a linie mocniejsze — hierarchia z odstępów i typografii zamiast z efektów.

**Kontrast `--dim` poprawiony w obu motywach.** Etykiety 9,5-pikselowe miały
3.55 (ciemny) i **2.92** (jasny) względem tła. Po korekcie 4.47 i 4.23. To był
defekt, który przy jasnym motywie stałby się widoczny od razu.

### Etykiety w obramowaniu — poprawione u źródła (24.08.2026)

Objaw: „WEWNĘTRZNY" w panelu nachodziło na podtytuł pod spodem. Przyczyna nie
jest jednostkowa — **pionowy padding i obramowanie elementu `inline` nie
powiększają wiersza**, więc pudełko maluje się poza nim. To ten sam kształt
w trzech plikach: `.tag-int`, `.badge-internal` i `.tag-esc` to jedna etykieta
napisana trzy razy, a `display:inline-block` miała **tylko jedna z nich**.

Naprawa punktowa dodałaby czwartą kopię tej samej reguły. Zamiast tego powstała
klasa **`.znacznik`** w `motywCss()` — bo wstrzykiwany motyw jest **jedynym
arkuszem, który te trzy pliki dzielą**. Nowa etykieta gdziekolwiek w interfejsie
dostaje poprawną geometrię przez dopisanie jednej klasy, a `border-radius`
przychodzi z motywu, więc jest kanciasta u BudMaksu i łagodna u kancelarii.

**Uwaga z tej samej poprawki:** komentarz CSS z odwróconymi apostrofami wewnątrz
szablonu w backtickach **zamknął literał** — `node --check` przeszedł, a `import`
wywalił się na `Unexpected identifier`. To drugi udokumentowany przypadek tej
pułapki. W treści szablonu nie ma odwróconych apostrofów, także w komentarzach.

### Pasek demo i animacja wypisywania (24.08.2026)

**Pasek demo kładł się na polu pytania.** Ma stałą pozycję, więc nie zajmuje
miejsca w układzie, a dok wpisywania w aplikacji pracowniczej jest przyklejony
do dołu — obie rzeczy walczyły o ten sam pas ekranu. Poprawka jest wspólna, nie
punktowa: pasek **ogłasza swoją wysokość** w `--pasek-demo`, `motywCss()`
rezerwuje na nią miejsce przez `body{padding-bottom}`, a dok stoi na
`bottom:var(--pasek-demo)`. Bez paska zmienna wynosi `0px`, więc nic się nie
zmienia u klienta. Przy okazji pasek dostał kolory z motywu — czarne
półprzezroczyste tło wyglądało na jasnej kancelarii jak pomyłka.

**Animacji wypisywania w aplikacji pracowniczej nigdy nie było.** Sprawdzone:
`formatBotAnswer()` wstawiał gotowy `innerHTML` jednym ruchem. Mechanizm ze
strony publicznej (`type()` w `index.html`) został przeniesiony jako
`wypiszOdpowiedz()`, z dwoma wyjątkami:

1. **`prefers-reduced-motion`** — tekst pojawia się od razu, kursor nie mruga.
2. **Ramka eskalacyjna nie czeka na animację.** Przy eskalacji pilnej
   `zlozZEskalacja()` stawia tekst ramki na POCZĄTKU odpowiedzi, więc pierwszy
   blok wypisuje się natychmiast, razem z pudełkiem alertu. Sekunda zwłoki
   w komunikacie „dzwoń pod 112" to zła cena za efekt wizualny. Przy eskalacji
   niepilnej ramka jest na końcu i animuje się normalnie.

Warunek jest **wyliczany z `d.eskalacja.pilne`**, więc nie wymagał zmiany w API
ani w warstwach weryfikacji.

**Trzeci przypadek tej samej pułapki:** odwrócony apostrof w komentarzu wewnątrz
szablonu zamknął literał, `node --check` przeszedł, `import` się wywalił. Od tej
pory pilnuje tego sekcja 9 w `test-motyw.mjs` — strażnik zamiast pamięci.

### Czego nie ruszono

Zero zmian w logice, treści dokumentacji, warstwach weryfikacji, eskalacji,
promptach i routingu. Zmiana dotknęła wyłącznie wyglądu i tekstów interfejsu.
`index.html` **został nietknięty** — to własna strona BudMaksu na GitHub Pages
z osadzonym widgetem, a nie powierzchnia produktu; jej motyw stanie się tematem
dopiero przy skrypcie osadzającym.

### Wyjątek, którego trzeba było zrobić

**Publiczna ramka bezpieczeństwa zwraca się do czytelnika na „ty"**
(„zadzwoń pod numer alarmowy 112") — wbrew regule tonu całej reszty kancelarii.
Zostawione świadomie i **nie jest to niedopatrzenie**: to komunikat ratunkowy dla
osoby w zagrożeniu, gdzie tryb rozkazujący jest szybszy do przeczytania niż forma
grzecznościowa. Odnotowane, żeby nikt tego nie „naprawił" przy najbliższym
porządkowaniu.


## Podsumowanie drugiej branży — co uniwersalne, co branżowe, ile kosztuje klient

### Werdykt o warstwach po pełnym cyklu

| Warstwa | Werdykt | Podstawa |
|---|---|---|
| Granica dostawcy, routing, tożsamość, separacja przestrzeni | **uniwersalne** | zero zmian przy drugim kliencie |
| Weryfikacja zdanie po zdaniu, progi, cytat dosłowny, deduplikacja | **uniwersalne** | 2 wycięcia na 61 zdań, oba poprawne |
| Mechanizm eskalacji (weto, dopełnienia, rozstrzyganie, pozycja ramki) | **uniwersalny** | przeniesiony bez zmian, 80/80 na własnym słowniku |
| `leaksInstructions` | uniwersalny, nieujawniony | 0 wyzwoleń w obu branżach |
| **`numbersAreGrounded`** | uniwersalny **po poprawce** | zapis słowny terminów wymusił `liczbyZeZrodla()` |
| **Rozpoznawanie braku odpowiedzi** | uniwersalne **po poprawce** | treść, której sensem jest odmowa, wymusiła `tylkoOdmowa()` |
| **Wyjątek dla zaprzeczeń w warstwie obietnic** | **wadliwy w obu branżach** | test podciągu; obejście przez `obietniceBezwyjatku` |
| **Ramka bezpieczeństwa w trybie publicznym** | nowa zdolność uniwersalna | wymuszona przez wycięcie numeru 112 |
| Wzorce eskalacji, wzorce obietnic, teksty ramek, progi, treść, ton | **branżowe** | wymienione w całości |

**Wniosek główny: protezą były wzorce i teksty, nie reguły.** Ani jedna zasada
nie okazała się budowlana. Druga branża wymusiła **cztery zmiany w silniku** —
i wszystkie cztery są ulepszeniami uniwersalnymi, z których skorzysta także
pierwszy klient, a nie protezami pod kancelarię.

### Czego druga branża NIE ruszyła

Zero zmian w: `worker.js` w częściach RAG i retrievalu, progach (`TOP_K`,
`MIN_SIMILARITY`, `CITATION_THRESHOLD`), `isDuplicate`, `wystepujeDoslownie`,
`vectorSearch`, granicy dostawcy, weryfikacji tokenu Access, routingu ról,
strukturze promptów i w treści BudMaksu. To jest miara tego, ile z projektu
było produktem, a nie jednym klientem.

### Ile kosztuje trzeci klient

Rozpisane z faktycznie wykonanej pracy przy kancelarii:

| Pozycja | Nakład przy kancelarii | Prognoza przy trzecim kliencie |
|---|---|---|
| Treść publiczna | 24 fragmenty | **bez zmian** — to jedyna pozycja, która nie maleje |
| Treść wewnętrzna | 25 fragmentów | **bez zmian** |
| Słownik eskalacji | 8 kategorii, 4 słowniki dopełnień, progi, teksty | podobnie, ale ze wzorcem do naśladowania |
| Wzorce obietnic + odporne na zaprzeczenia | 8 wzorców | podobnie |
| Pola promptu i `ui` | 12 + 7 pól | mechanicznie, ~godzina |
| Testy własne klienta | 80 + 32 przypadki | podobnie — i to one wyłapały wszystkie błędy kalibracji |
| Zmiany w silniku | **4** | **oczekiwane 0–1** |
| Infrastruktura | 3 trasy, 2 aplikacje Access, 2 zmienne, 2 reindeksy | identycznie, ~15 minut |
| Rundy kalibracji po pomiarze | 3 | 1–2 |

**Struktura kosztu jest więc taka: 80% to treść i słowniki branżowe, 15% testy
i kalibracja, 5% infrastruktura.** Praca w silniku dąży do zera i to jest
najważniejsza wiadomość dla wyceny — koszt trzeciego klienta jest przewidywalny,
bo składa się prawie wyłącznie z pisania treści, a nie z odkrywania, co pęknie.

**Czego nie da się wycenić z góry:** liczby rund kalibracji. Przy kancelarii
były trzy i wszystkie trzy wyszły z POMIARU, nie z przeglądu kodu — słownik
eskalacji na przypadkach wrogich, mapa problemów z 40 pytań, wrogi test obietnic.
Bez tych trzech przebiegów wdrożenie wyglądałoby na gotowe i miałoby cztery
defekty, z których jeden usuwał numer alarmowy z odpowiedzi dla osoby
w zagrożeniu.

**Wniosek dla sprzedaży:** pierwszy klient nowej branży kosztuje treść plus
trzy rundy pomiaru. Kolejny klient TEJ SAMEJ branży kosztuje samą treść —
słownik, wzorce i kalibracja są już jego.

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
