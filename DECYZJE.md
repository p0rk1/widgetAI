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
- [Granica dostawcy](#granica-dostawcy--model-i-baza-wektorowa-są-wymienne)
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
| `budmax-wewnetrzny.know-base.app` | bot dla pracowników, cały host za Access |
| `knowbase-budmax.rezi7608.workers.dev` | stary adres — **zostaje włączony** |

**Dlaczego dwa hosty, a nie jeden ze ścieżką.** Aplikacja Access obejmuje cały
host wewnętrzny, więc nie ma tam ścieżki publicznej, którą dałoby się
przypadkiem odsłonić albo zablokować. Wariant „jeden host + Access na ścieżce
`/internal`" został **odrzucony**: ochrona stałaby wtedy na poprawnie wpisanym
polu `Path`, a pomyłka w nim albo odsłania tryb wewnętrzny, albo każe klientom
się logować. Rozdzielenie hostów usuwa cały ten rodzaj błędu.

**Dlaczego myślnik, a nie kropka** (`budmax-wewnetrzny`, nie `internal.budmax`).
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
i host `budmax-wewnetrzny.know-base.app` (patrz „Adresy i domeny"). Custom domain
musi być także w `wrangler.toml` (`[[routes]]` z `custom_domain = true`), inaczej
deploy ją zdejmie. Aplikacja Access na tym hoście istnieje od 18.08.2026 —
`ZERO-TRUST.md`.

Konsekwencja dla starego adresu: `/internal` na `workers.dev` **nigdy nie zadziała**,
bo Access nie postawi tam tokenu. To poprawne zachowanie fail-closed, nie usterka —
tryb wewnętrzny ma jeden adres i jest nim host wewnętrzny.

**Dwa hosty zwracają na `/internal` różne kody i tak ma być.** Na
`budmax-wewnetrzny.know-base.app` żądanie bez sesji **nie dociera do Workera** —
Access zatrzymuje je na brzegu i odsyła **302** na ekran logowania. Kody Workera
(401 z powodem) widać tylko na `workers.dev` albo po przejściu przez Access.
Dlatego weryfikację tokenu testuje się na `workers.dev`, a samo Access — na hoście
wewnętrznym. Oczekiwanie „401 bez tokenu na hoście wewnętrznym" było błędne.

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
