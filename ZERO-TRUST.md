# Konfiguracja Cloudflare Zero Trust Access dla trybu wewnętrznego

## Stan: ✅ tryb pracowniczy (18.08.2026) · ✅ panel właściciela (21.08.2026)

> **Hosty przemianowane 21.08.2026:** `budmax-wewnetrzny` → `budmax-pracownik`,
> `budmax-panel` → `budmax-wlasciciel`. Stare adresy **nie istnieją** (NXDOMAIN) —
> zniknęły razem z wpisami w `wrangler.toml`.

Aplikacja Access istnieje, `ACCESS_TEAM_DOMAIN` i `ACCESS_AUD` są w `wrangler.toml`,
Worker wdrożony (wersja `e2544cf1-61ee-468b-ab08-c70447056701`). **`/internal` nie
zwraca już 503** — patrz „Krok 8" z wynikami z 18.08.2026.

Zrobione: kroki **1, 4, 5, 6, 7, 8**, oraz **9–11** dla drugiego klienta i logo.
Jedyną działającą metodą logowania jest **One-time PIN** — kod wysyłany na adres
e-mail. Wystarcza do testów i do pojedynczego użytkownika, nie wystarcza dla
zespołu klienta.

**Kroki 2 i 3 zastąpił krok 12 (27.08.2026).** Podpięcie Google Workspace i Entra ID
**odłożono świadomie do pierwszego klienta z własnym katalogiem** — obu dostawców
rejestruje się przeciwko konkretnemu tenantowi, a BudMax i kancelaria są fikcyjne
i żadnego nie mają. Runbook jest gotowy i czeka na wejścia od klienta.

Reszta pliku jest instrukcją do powtórzenia przy kolejnym kliencie — kroki
odhaczone opisują, co i gdzie faktycznie kliknięto.

**Dwie rzeczy, które warto przeczytać, zanim się tu coś ruszy:**
- **Domena zespołu to `knowbase.cloudflareaccess.com`**, mimo że ekran logowania
  pokazuje `late-darkness-273f.cloudflareaccess.com` — to drugie jest napisem,
  nie adresem. Rozstrzygnięte i udowodnione w kroku 1.
- **Pełna ścieżka jest potwierdzona pomiarem z 18.08.2026** — prawdziwy token
  z logowania przeszedł przez wdrożonego Workera i wrócił z odpowiedzią z wiedzy
  wewnętrznej. Pomiar i co dokładnie dowodzi: krok 8.

Gdyby `ACCESS_TEAM_DOMAIN` albo `ACCESS_AUD` kiedykolwiek wróciły do pustej
wartości, `/internal` znów zwróci **503 z wyjaśnieniem, czego brakuje** —
to celowe, nie awaria.

---

## Stan wyjściowy — co już jest gotowe

Domena `know-base.app` jest w koncie Cloudflare, a Worker ma dwa własne adresy
(wdrożone 17.08.2026, wersja `51f7b541`):

| Adres | Do czego | Stan |
|---|---|---|
| `budmax.know-base.app` | publiczny endpoint widgetu | działa, odpowiada |
| `budmax-pracownik.know-base.app` | bot dla pracowników | działa, za Access — niezalogowany dostaje 302 na ekran logowania |
| `knowbase-budmax.rezi7608.workers.dev` | stary adres, nadal używany przez widget i panel | działa, zostaje |

**Rozdzielenie na dwa hosty jest sednem tej konfiguracji.** Aplikacja Access
obejmie **cały host pracowniczy**, a nie ścieżkę w środku hosta publicznego.
Dzięki temu nie da się jej ustawić tak, żeby przypadkiem zażądała logowania od
klientów albo zostawiła `/internal` bez ochrony — na tym hoście nie ma nic
publicznego, co dałoby się zepsuć.

> Nazwy pól w panelach Cloudflare, Google i Microsoft bywają zmieniane między
> wydaniami. Wartości, które faktycznie mają znaczenie (adres przekierowania,
> uprawnienia, AUD), są niżej wypisane wprost — jeśli etykieta się nie zgadza,
> szukaj pola o tym znaczeniu, nie o tej nazwie.

---

## Krok 1. Włącz Zero Trust i ustal nazwę zespołu — ✅ zrobione

1. Panel Cloudflare → **Zero Trust** (lewa kolumna).
2. Przy pierwszym wejściu kreator poprosi o **nazwę zespołu** (*team name*).
   Wpisz **`knowbase`**. Nazwa jest trwała i trudna do zmiany.

   > Zespół należy do Ciebie jako dostawcy, **nie do klienta**. Jeden zespół
   > obsłuży wszystkich klientów — każdy dostanie własną aplikację Access
   > wewnątrz niego. Nazwanie zespołu `budmax` byłoby błędem, który zobaczyłby
   > każdy kolejny klient na ekranie logowania.

3. Wybierz plan **Free** (do 50 użytkowników — liczonych łącznie dla wszystkich
   klientów, warto to śledzić przy trzecim i kolejnych).
4. Zanotuj powstały adres zespołu: `knowbase.cloudflareaccess.com`.

➡️ To jest wartość **`ACCESS_TEAM_DOMAIN`** — u nas `knowbase.cloudflareaccess.com`,
wpisana w `wrangler.toml`.

### Ekran logowania pokazuje inną nazwę niż domena zespołu — sprawdzone 18.08.2026

Na karcie logowania widnieje **`late-darkness-273f.cloudflareaccess.com`**, mimo że
adres w pasku przeglądarki i cała konfiguracja mówią `knowbase`. To wygląda na
rozjazd, ale **kanoniczna jest `knowbase`** i nie ma tu nic do poprawiania
w Workerze. Dowody, w kolejności rozstrzygalności:

| Sprawdzenie | `knowbase` | `late-darkness-273f` |
|---|---|---|
| `/.well-known/openid-configuration` → `issuer` | `200`, **`https://knowbase.cloudflareaccess.com`** | `404` |
| `/cdn-cgi/access/certs` (JWKS) | `200`, klucze publiczne | `404` |
| `/cdn-cgi/access/login/<nasza-aplikacja>?kid=…` | `302` → ekran logowania | `404` |
| dokąd przekierowuje sam Access z chronionego hosta | tutaj | — |

Nazwa nieistniejącego zespołu (`zzz-nie-ma-takiego-9x`) daje **te same `404`** —
czyli `late-darkness-273f` nie jest działającym aliasem, tylko napisem. Siedzi
w HTML strony logowania jako `OrgAvatarLink-title`, czyli **pole wyświetlane**
(Zero Trust → *Custom pages* → nazwa organizacji), nie domena uwierzytelniania.

**Dlaczego to w ogóle ma znaczenie:** Worker porównuje `iss` tokenu z
`https://${ACCESS_TEAM_DOMAIN}` **dosłownie**. Wpisanie tam nazwy wyświetlanej
zamiast kanonicznej zerwałoby logowanie na dwa sposoby naraz — JWKS by się nie
pobrał (`502 Nie udało się pobrać kluczy`), a gdyby się pobrał, każdy token
odpadłby na `iss`.

Rozstrzygające polecenie — **pytaj o `issuer`, nie o to, co widać na ekranie**:

```bash
curl -s https://knowbase.cloudflareaccess.com/.well-known/openid-configuration \
  | grep -o '"issuer":"[^"]*"'
# "issuer":"https://knowbase.cloudflareaccess.com"
```

### Czy da się zmienić nazwę zespołu na czytelną

Można, ale **w tym wypadku nie ma czego zmieniać** — funkcjonalnie zespół nazywa
się już `knowbase` i to ten adres widzi pracownik w pasku przeglądarki. Brzydki
jest wyłącznie **napis na karcie logowania**, a to osobne pole: Zero Trust →
*Custom pages* → *Team name and domain* → *Your Organization's name* (sekcja
strony logowania Access). Zmiana tego pola nie rusza domeny, tokenów ani aplikacji.

Gdyby jednak przyszło zmieniać **prawdziwą nazwę zespołu**, pociąga to za sobą:

| Skutek | Co trzeba zrobić |
|---|---|
| zmienia się `iss` tokenów i adres JWKS | `ACCESS_TEAM_DOMAIN` w `wrangler.toml` + `wrangler deploy` — inaczej **wszystkie** tokeny odpadają na `iss` |
| zmienia się adres przekierowania OAuth | poprawić `…/cdn-cgi/access/callback` u **każdego** dostawcy tożsamości (Google, Microsoft) |
| sesje wystawione na starą nazwę | zakładać, że wszyscy logują się ponownie |
| stara nazwa | wraca do puli i **może ją zająć ktoś obcy** |
| AUD aplikacji | powinien zostać (jest per aplikacja, nie per zespół) — ale **sprawdzić** sposobem z kroku 7, nie zakładać |
| Cloudflare dashboard SSO | jeśli włączone, trzeba je najpierw wyłączyć |

**Kolejność ma znaczenie:** ewentualną zmianę nazwy robi się **przed** krokami 2–3,
bo inaczej adresy przekierowania u Google i Microsoftu trzeba przeklikać drugi raz.

---

## Krok 2. Podepnij Google Workspace — ⬜ ZASTĄPIONE przez krok 12

> **Nie klikaj z tego kroku — od 27.08.2026 obowiązuje krok 12.** Tam jest
> to samo plus podział pracy między Ciebie a administratora klienta, moment
> wyłączenia *Accept all available identity providers* i rachunek dla sprzedaży.
> Tu zostaje sam zarys, bo do niego odsyłają starsze zapisy.

> **Stan na 18.08.2026:** nie zrobione. Aplikacja przepuszcza wszystkie dostępne
> metody logowania, a jedyną skonfigurowaną jest wbudowany **One-time PIN** —
> Cloudflare wysyła kod na adres e-mail i to wystarcza, żeby reguła z kroku 6
> zadziałała. Google i Microsoft dokłada się bez zmian w Workerze: weryfikowany
> jest podpis i `aud` tokenu, nie to, który dostawca go wystawił.

Najpierw po stronie Google:

1. [Google Cloud Console](https://console.cloud.google.com/) → wybierz lub utwórz projekt.
2. **APIs & Services → OAuth consent screen** → typ **Internal** (jeśli konto jest
   w Workspace) → uzupełnij nazwę aplikacji i e-mail kontaktowy.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   → typ **Web application**.
4. W **Authorized redirect URIs** wpisz dokładnie:

   ```
   https://knowbase.cloudflareaccess.com/cdn-cgi/access/callback
   ```

5. Zapisz i skopiuj **Client ID** oraz **Client secret**.

Teraz po stronie Cloudflare:

6. Zero Trust → **Settings → Authentication → Login methods → Add new**.
7. Wybierz **Google Workspace**.
8. Wklej Client ID, Client secret oraz domenę Workspace (`budmax.pl`).
9. Kliknij **Test** — powinno przejść przez logowanie Google i wrócić z sukcesem.

> Jeśli nie potrzebujesz synchronizacji grup Workspace, prostszym wariantem jest
> zwykłe **Google** zamiast **Google Workspace** — wymaga tylko Client ID
> i Client secret, bez uprawnień Admin SDK. Reguła po adresie e-mail (krok 6)
> działa tak samo w obu wariantach.

---

## Krok 3. Podepnij Microsoft Entra ID — ⬜ ZASTĄPIONE przez krok 12

> **Nie klikaj z tego kroku** — patrz krok 12, sekcja 12.3b.

Najpierw po stronie Microsoftu:

1. [Entra admin center](https://entra.microsoft.com/) → **Applications → App registrations → New registration**.
2. Nazwa: `Cloudflare Access`. Typ konta: zwykle **Single tenant**.
3. **Redirect URI** → platforma **Web** → dokładnie:

   ```
   https://knowbase.cloudflareaccess.com/cdn-cgi/access/callback
   ```

4. Po utworzeniu skopiuj z zakładki **Overview**:
   - **Application (client) ID**
   - **Directory (tenant) ID**
5. **Certificates & secrets → New client secret** → skopiuj **wartość** sekretu
   (nie identyfikator — wartość widać tylko raz).
6. **API permissions → Add a permission → Microsoft Graph**:
   - *Delegated*: `openid`, `profile`, `email`, `offline_access`
   - *Application* (tylko jeśli chcesz grupy): `Directory.Read.All`
   - następnie **Grant admin consent**.

Teraz po stronie Cloudflare:

7. Zero Trust → **Settings → Authentication → Login methods → Add new**
   → **Azure AD / Microsoft Entra ID**.
8. Wklej Client ID, Client secret i Directory (tenant) ID.
9. Kliknij **Test**.

---

## Krok 4. Adresy Workera — ✅ zrobione

Oba hosty są już wdrożone i odpowiadają, nic tu nie klikasz. Wpisy żyją
w `wrangler.toml` jako `[[routes]]` z `custom_domain = true` — **muszą tam
zostać**, bo deploy z CLI traktuje ten plik jako pełny opis Workera i zdjąłby
domenę, której w nim nie ma.

Kontrola, gdyby coś się rozjechało:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://budmax.know-base.app/ \
  -H "Content-Type: application/json" -d '{"question":"test"}'          # 200

curl -s -o /dev/null -w "%{http_code}\n" -X POST https://budmax-pracownik.know-base.app/internal \
  -H "Content-Type: application/json" -d '{"question":"test"}'          # 302 (Access przechwytuje przed Workerem)
```

Widget i panel nadal wołają stary adres `workers.dev` i tak zostaje —
przeniesienie ich na `budmax.know-base.app` to osobna, świadoma zmiana.

---

## Krok 5. Utwórz aplikację Access — ✅ zrobione

1. Zero Trust → **Access controls → Applications → Add an application → Self-hosted**.

   > Menu zmieniło nazwę: dawniej **Access → Applications**, dziś
   > **Access controls → Applications**. Jeśli szukasz w panelu i nie widzisz
   > pozycji „Access", to jest ta sama rzecz pod nową etykietą.

2. **Application name**: `BudMax — tryb wewnętrzny`.
   (Nazwa per klient, bo aplikacji będzie tyle, ilu klientów.)
3. **Session Duration**: `24 hours` (pracownik loguje się raz dziennie).
4. **Application domain** — formularz ma **trzy osobne pola**, nie jedno pole
   na cały adres:

   | Pole | Wartość |
   |---|---|
   | Subdomain | `budmax-pracownik` |
   | Domain | `know-base.app` (wybór z listy domen w koncie) |
   | Path | **zostaw puste** |

   **Ścieżki celowo nie ustawiamy** — aplikacja ma objąć cały host. Na
   `budmax-pracownik.know-base.app` nie ma niczego publicznego, więc nie ma
   czego zablokować, a `/internal` nie ma jak zostać poza ochroną.

   > To jest zmiana względem pierwotnego planu, w którym oba tryby dzieliły
   > jeden host, a Access ograniczał się do ścieżki `/internal`. Rozdzielenie
   > hostów usuwa cały ten rodzaj błędu — dlatego pole `Path` ma zostać puste.

5. **Identity providers**: docelowo zaznacz Google i Microsoft i odznacz
   *Accept all available identity providers*.

   **Dziś zostawione na „wszystkie dostępne", łącznie z One-time PIN** — bo poza
   PIN-em nie ma jeszcze czego zaznaczać (kroki 2–3). Po ich wykonaniu wróć tutaj
   i zawęź listę: dopóki PIN jest dozwolony, dostęp ma każdy, kto odbiera pocztę
   pod adresem z reguły, bez przechodzenia przez Workspace ani Entra.

---

## Krok 6. Ustaw regułę dostępu — ✅ zrobione

**Co faktycznie ustawiono 18.08.2026:** `Action: Allow`, `Include → Emails`
z pojedynczym adresem właściciela — czyli wariant ostrożniejszy opisany pod
tabelką. Reguła domenowa `@budmax.pl` czeka na prawdziwych pracowników.

W kreatorze aplikacji, sekcja **Policies**:

1. **Policy name**: `Pracownicy BudMax`
2. **Action**: `Allow`
3. **Configure rules → Include**:
   - **Selector**: `Emails ending in`
   - **Value**: `@budmax.pl`

Zapisz aplikację.

Wariant ostrożniejszy na start: `Selector: Emails`, a w wartości wpisz
pojedyncze adresy osób, które mają testować. Regułę domenową włączysz później —
łatwiej rozszerzać dostęp niż go odbierać.

---

## Krok 7. Przepisz AUD do konfiguracji Workera — ✅ zrobione

1. Zero Trust → **Access controls → Applications** → otwórz utworzoną aplikację →
   zakładka **Overview**.
2. Skopiuj **Application Audience (AUD) Tag** — długi ciąg szesnastkowy.
3. Uzupełnij `wrangler.toml` (stan wpisany 18.08.2026):

   ```toml
   [vars]
   ACCESS_TEAM_DOMAIN = "knowbase.cloudflareaccess.com"
   ACCESS_AUD = "31995d69e22347f8708921b157570232f11113d68beb57edb35b2773f782c1c0"
   ```

   **AUD da się odczytać bez klikania w dashboardzie.** Access dopisuje go jako
   parametr `kid` do adresu logowania, na który przekierowuje niezalogowanego:

   ```bash
   curl -s -o /dev/null -D - https://budmax-pracownik.know-base.app/internal \
     | grep -i "^location:"
   # …/cdn-cgi/access/login/budmax-pracownik.know-base.app?kid=<AUD>&meta=…
   ```

   Ten sam adres niesie parametr `meta` — podpisany JWT, którego pole `aud`
   powtarza tę wartość, a `kid` w nagłówku wskazuje klucz z
   `/cdn-cgi/access/certs` zespołu. Zgodność obu potwierdza za jednym razem
   **i AUD, i nazwę zespołu**, więc nie trzeba ufać przepisaniu z ekranu.

   **Weryfikacja AUD zrobiona 18.08.2026 (kryptograficznie, nie na oko):** podpis
   RS256 meta-JWT sprawdzony kluczem o jego `kid` pobranym z JWKS zespołu
   `knowbase` — **poprawny**. Czyli token niosący `aud = 31995d69…` dla hosta
   `budmax-pracownik.know-base.app` jest podpisany kluczem tego zespołu, a nie
   przepisany z przypadkowego ekranu. `kid` z adresu, `aud` z meta-JWT i
   `ACCESS_AUD` w `wrangler.toml` są identyczne.

   > **Czego nie da się użyć:** API `GET /accounts/{id}/access/apps` zwraca na
   > tokenie OAuth wranglera pustą listę, a `/access/organizations` — błąd
   > uwierzytelnienia, bo token z `wrangler login` nie ma zakresów Zero Trust.
   > Odczyt z API wymagałby osobnego API tokenu z uprawnieniami *Access: Apps
   > and Policies — Read*. Sposób z `kid` powyżej działa bez żadnego tokenu.

4. Wdróż:

   ```
   node --check worker.js
   wrangler deploy --dry-run
   wrangler deploy
   git add wrangler.toml && git commit -m "Wlacz Access dla trybu wewnetrznego" && git push origin main
   ```

AUD i nazwa zespołu **nie są sekretami** — bezpieczeństwo daje weryfikacja
podpisu, nie tajność tych wartości. Dlatego mieszkają w `wrangler.toml`,
a nie w `wrangler secret`: sekrety przeżywają deploy, ale zwykłe zmienne
ustawione w dashboardzie zniknęłyby przy najbliższym `wrangler deploy`.

---

## Krok 8. Sprawdź, że działa — ✅ sprawdzone 18.08.2026, obie strony

> Sprawdzone **odmowy i przejście**: token z prawdziwego logowania przeszedł przez
> wdrożonego Workera i wrócił z odpowiedzią z wiedzy wewnętrznej. Pomiar na końcu
> tego kroku.

**Dwa hosty odpowiadają na `/internal` inaczej i tak ma być.** Na
`budmax-pracownik.know-base.app` żądanie bez ważnej sesji **nie dociera do
Workera** — zatrzymuje je Access na brzegu i odsyła `302` na ekran logowania.
Kody Workera (`401` z opisem powodu) widać dopiero po przejściu przez Access
albo na starym adresie `workers.dev`, którego Access nie obejmuje.

Dlatego weryfikacja tokenu w Workerze testuje się na `workers.dev`, a działanie
samego Access — na hoście pracowniczym.

**Z przeglądarki** — wejdź na `https://budmax-pracownik.know-base.app/internal`.
Powinno przekierować na ekran logowania Cloudflare (dziś: One-time PIN, po
krokach 2–3 także Google / Microsoft). Po zalogowaniu zobaczysz odpowiedź Workera
(dla GET będzie to `405 Method not allowed` — to dobrze, znaczy że Access
przepuścił i zadziałał Worker).

Sprawdź też **hosta publicznego**: `https://budmax.know-base.app/` **nie może**
poprosić o logowanie. Jeśli prosi, aplikacja Access została zbudowana na złej
subdomenie.

**Z terminala** — wyniki z 18.08.2026, wersja Workera `e2544cf1`:

```bash
# 1. host za Access, bez sesji → 302 na ekran logowania (Access, nie Worker)
curl -s -o /dev/null -D - -X POST https://budmax-pracownik.know-base.app/internal \
  -H "Content-Type: application/json" -d '{"question":"Jaka jest marza?"}' | grep -i "^location:"
# HTTP/1.1 302 Found
# Location: https://knowbase.cloudflareaccess.com/cdn-cgi/access/login/budmax-pracownik.know-base.app?kid=…

# 2. workers.dev, bez tokenu → 401 (a NIE 503 — to jest dowód, że vars doszły)
curl -s -X POST https://knowbase-budmax.rezi7608.workers.dev/internal \
  -H "Content-Type: application/json" -d '{"question":"Jaka jest marza?"}'
# {"error":"Brak tokenu tożsamości Cloudflare Access.", …}

# 3. workers.dev, podrobiony token → 401
curl -s -X POST https://knowbase-budmax.rezi7608.workers.dev/internal \
  -H "Content-Type: application/json" \
  -H "Cf-Access-Jwt-Assertion: aaa.bbb.ccc" \
  -d '{"question":"Jaka jest marza?"}'
# {"error":"Nie udało się odczytać tokenu tożsamości."}

# 4. dawny sekret administracyjny → 401 (ma już NIE działać)
curl -s -X POST "https://knowbase-budmax.rezi7608.workers.dev/internal?key=TWOJ_SEKRET" \
  -H "Content-Type: application/json" -d '{"question":"Jaka jest marza?"}'
# {"error":"Brak tokenu tożsamości…","szczegoly":{…"Klucz administracyjny (?key=) NIE otwiera już trybu wewnętrznego."}}

# 5. publiczny host nie zmienił zachowania → 200
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://budmax.know-base.app/ \
  -H "Content-Type: application/json" -d '{"question":"Jakie sa terminy platnosci?"}'
```

### ✅ Pełna ścieżka potwierdzona pomiarem — 18.08.2026

Do tego dnia przetestowane były **same odmowy**, i nie z zaniedbania, tylko przez
układ adresów: na hoście pracowniczym Access zatrzymuje bezsesyjne żądanie na brzegu
(302), a na `workers.dev` Access nie działa wcale, więc nie ma skąd wziąć prawdziwego
tokenu. `node test-access.mjs` (14/14) sprawdza logikę weryfikacji na **podstawionych**
kluczach — to nie to samo co prawdziwy token → prawdziwe JWKS → wdrożony Worker.

Lukę zamknięto sposobem A. Wynik `POST /internal` z ciasteczkiem `CF_Authorization`
z logowania One-time PIN:

```json
{"answer":"Standardowa marża na robociznę wynosi 22 procent.",
 "source":"Widełki marży i granica negocjacji",
 "gap":false,"trimmed":0,
 "zalogowany":{"email":"…","domena":"gmail.com"}}
```

Co ten jeden pomiar potwierdza, punkt po punkcie:

| Ogniwo | Dowód w odpowiedzi |
|---|---|
| Access wystawia token na tym hoście | żądanie w ogóle dotarło do Workera |
| Worker weryfikuje podpis, `iss`, `aud`, ważność przeciw **prawdziwym** JWKS | brak 401 i brak 502 |
| `/internal` sięga do `INTERNAL_CHUNKS` | `source` = `i01`, treści nie ma w przestrzeni publicznej |
| tożsamość odczytana z ładunku | `zalogowany.email` i `zalogowany.domena` |
| weryfikacja zdanie po zdaniu nie psuje trybu wewnętrznego | `trimmed: 0`, `gap: false` |

**Obserwacja do etapu 3, nie usterka:** pytanie miało dwie części (marża standardowa
**i** granica negocjacji), a odpowiedź podała samo 22% — 14% i próg 12% powyżej
400 tys. zostały przemilczane, przy `trimmed: 0`, czyli **model ich nie napisał**,
weryfikacja niczego nie wycięła. Najbardziej prawdopodobna przyczyna: `i01` kończy
się zdaniem „tych wartości nie komunikujemy", a `buildSystemPrompt()` jest wspólny
dla obu trybów i mówi o „stronie firmy" — model zachowuje się więc ostrożnie jak
wobec klienta. To jest dokładnie problem, który ma rozwiązać **etap 3 (ton
instruktażowy)**, i pierwszy twardy dowód, że etap 3 jest potrzebny.

**Uwaga do `domena`:** w pomiarze wyszło `gmail.com`, bo logował się właściciel
projektu, nie pracownik klienta. Pole ma docelowo rozpoznawać firmę przy wielu
klientach — na adresie prywatnym nie niesie tej informacji. Do testów wystarcza,
jako sygnał tożsamości klienta zadziała dopiero przy domenach firmowych.

#### Sposób A — ciasteczko z przeglądarki (pokrywa ścieżkę człowieka)

**Tym sposobem wykonano pomiar powyżej.** Jako jedyny sprawdza **tożsamość osoby**
(`email`, `domena` w polu `zalogowany`):

1. Zaloguj się na `https://budmax-pracownik.know-base.app/internal`
   (dziś: One-time PIN na adres z reguły z kroku 6).
2. DevTools → *Application* → *Cookies* → skopiuj **`CF_Authorization`**.
3. ```bash
   curl -s -X POST https://budmax-pracownik.know-base.app/internal \
     -H "Content-Type: application/json" \
     -H "Cookie: CF_Authorization=WKLEJ_TU" \
     -d '{"question":"Jaka jest standardowa marza na robocizne?"}'
   ```

Odpowiedź musi zawierać treść z `INTERNAL_CHUNKS` **oraz** pole `zalogowany`
z Twoim adresem e-mail i domeną. To ciasteczko jest **poświadczeniem** — ważnym
tyle, ile *Session Duration* (24 h). Nie wkleja się go do repo ani do zapisu rozmowy.

#### Sposób B — token serwisowy (powtarzalny, bez przeglądarki)

Do testu dymnego po każdym deployu, bo daje się uruchomić ze skryptu:

1. Zero Trust → **Access controls → Service auth → Create service token**
   (nazwa np. `budmax-smoke-test`). Sekret widać **raz**.
2. W aplikacji `BudMax — tryb wewnętrzny` dodaj **drugą** politykę:
   `Action: Service Auth`, `Include → Service Token → budmax-smoke-test`.
   Polityka `Allow` dla ludzi zostaje bez zmian.
3. ```bash
   curl -s -X POST https://budmax-pracownik.know-base.app/internal \
     -H "CF-Access-Client-Id: $CF_ID" -H "CF-Access-Client-Secret: $CF_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"question":"Jaka jest standardowa marza na robocizne?"}'
   ```

Access sam wystawia wtedy JWT i podaje go Workerowi w `Cf-Access-Jwt-Assertion`,
więc **cała ścieżka jest prawdziwa**: podpis, `iss`, `aud`, ważność, pobranie JWKS.

Czego sposób B **nie** pokrywa: token serwisowy nie niesie `email` (ma `common_name`),
więc `zalogowany.email` będzie `null`. Ścieżkę tożsamości człowieka sprawdza tylko
sposób A. Poza tym `Service Auth` **omija logowanie** — to poświadczenie maszynowe,
trzyma się je w zmiennych środowiskowych, nie w repo, i kasuje, gdy przestaje być
potrzebne.

**Stan:** sposób A wykonany 18.08.2026 — luka zamknięta. Sposób B zostaje na
później: opłaci się, gdy `/internal` dostanie prawdziwą treść i test dymny po
deployu zacznie mieć co pilnować. Sposób A powtarza się ręcznie po każdej zmianie
w weryfikacji tokenu — `test-access.mjs` jej nie zastąpi, bo chodzi po
podstawionych kluczach.

---

## Krok 9. Aplikacja Access dla panelu właściciela — ✅ zrobione 21.08.2026

Panel właściciela przeszedł z `REINDEX_SECRET` na tożsamość z Access.
**Zrobione i potwierdzone pomiarem 21.08.2026** — host odpowiada 302 na ekran
logowania, `ACCESS_AUD_PANEL` jest wpisany.

> **Zostało jedno sprawdzenie:** czy polityka tej aplikacji dopuszcza **jeden
> adres e-mail**, a nie całą domenę firmy (punkt 9.3). Tego nie da się odczytać
> z zewnątrz — trzeba zerknąć w dashboard.

**Dlaczego osobny host, a nie ścieżka na hoście pracowniczym.** Panel należy do
właściciela firmy, aplikacja pracownicza do zespołu. To dwie różne polityki
dostępu, a polityki przypina się do aplikacji Access, czyli do hostu. Osobny host
sprawia, że **rola wynika z adresu** — Worker nie musi znać żadnych ról, list
e-maili ani grup. Wariant „jeden host, rola w polityce na ścieżce `/panel`"
odrzucony z tego samego powodu, co przy trybie wewnętrznym: ochrona stałaby
na poprawnie wpisanym polu `Path`.

### 9.1. Host właściciela — ✅ zrobione przez `wrangler deploy`

`budmax-wlasciciel.know-base.app` powstał automatycznie razem z wdrożeniem, bo
`wrangler.toml` ma dla niego wpis `[[routes]]` z `custom_domain = true`.
Sprawdź w **Workers & Pages → knowbase-budmax → Settings → Domains & Routes**,
że host jest na liście. Nic tu nie klikasz.

### 9.2. Utwórz drugą aplikację Access

**Zero Trust → Access → Applications → Add an application → Self-hosted.**

| Pole | Wartość |
|---|---|
| Application name | `BudMax — panel właściciela` |
| Session Duration | `24 hours` (jak przy trybie wewnętrznym) |
| Subdomain | `budmax-wlasciciel` |
| Domain | `know-base.app` |
| Path | **zostaw puste** — aplikacja ma obejmować cały host |

Puste `Path` jest tu istotne tak samo jak przy aplikacji wewnętrznej: cały host
za Access, żadnej ścieżki wystawionej przez pomyłkę.

### 9.3. Reguła dostępu — TU JEST RÓŻNICA WOBEC APLIKACJI WEWNĘTRZNEJ

W aplikacji wewnętrznej regułą jest cały zespół. **Tutaj ma być jedna osoba.**

| Pole | Wartość |
|---|---|
| Policy name | `Wlasciciel` |
| Action | `Allow` |
| Include → selector | **Emails** |
| Value | adres e-mail właściciela firmy, np. `wlasciciel@budmax.pl` |

**Nie używaj tu `Emails ending in @budmax.pl`.** Cała firma ma adresy w tej
domenie, więc taka reguła wpuściłaby do panelu każdego pracownika — czyli
odtworzyłaby dokładnie ten problem, który ta zmiana usuwa.

### 9.4. Przepisz AUD do `wrangler.toml`

**Access → Applications → BudMax — panel właściciela → Overview → Application Audience (AUD) Tag.**
Skopiuj wartość i wstaw do `[vars]`:

```toml
ACCESS_AUD_PANEL = "tu-wklej-aud-aplikacji-panelowej"
```

Potem `wrangler deploy`.

**To musi być AUD drugiej aplikacji, nie ten sam co `ACCESS_AUD`.** Worker
wybiera oczekiwany AUD po hoście, więc wpisanie tu wartości aplikacji wewnętrznej
sprawiłoby, że token pracownika otwiera panel właściciela. Pilnują tego cztery
przypadki w `test-access.mjs` (sekcja 5).

### 9.5. Sprawdź, że działa

```bash
# 1. przed uzupełnieniem ACCESS_AUD_PANEL — 503 z nazwą brakującej zmiennej
curl -s "https://budmax-wlasciciel.know-base.app/?cb=$RANDOM"
# Panel właściciela nie jest jeszcze skonfigurowany.
# Brakujące zmienne: ACCESS_AUD_PANEL

# 2. po uzupełnieniu i wdrożeniu — 302 na ekran logowania
curl -s -o /dev/null -w "%{http_code}\n" -I "https://budmax-wlasciciel.know-base.app/?cb=$RANDOM"
# 302

# 3. dawny klucz administracyjny NIE otwiera panelu (ma być 404)
curl -s "https://knowbase-budmax.rezi7608.workers.dev/stats?key=SEKRET&cb=$RANDOM"
# {"error":"Panel właściciela działa wyłącznie na hoście właściciela."}

# 4. narzędzia wdrożeniowe nadal na kluczu (ma być 200 z podpowiedzią)
curl -s "https://knowbase-budmax.rezi7608.workers.dev/purge?key=SEKRET"
# Podaj ID do usunięcia, np. /purge?key=...&ids=c33,c34
```

**Uwaga na cache brzegowy.** Cloudflare potrafi oddać zbuforowaną odpowiedź
sprzed wdrożenia — kosztowało to fałszywy alarm dwa razy, 20 i 21.08.2026.
Do każdej sondy dokładaj `?cb=$RANDOM`.

### 9.6. Zaloguj się i sprawdź oba panele

Po zalogowaniu jednym adresem e-mail dostępne są **oba** panele właściciela:

| Adres | Co pokazuje |
|---|---|
| `https://budmax-wlasciciel.know-base.app/` | analityka widgetu publicznego (pytania klientów, luki) |
| `https://budmax-wlasciciel.know-base.app/panel` | analityka bota wewnętrznego (luki szkoleniowe, eskalacje) |

Stary adres `https://p0rk1.github.io/widgetAI/panel.html` **nie jest już panelem** —
pokazuje wskazówkę z nowym adresem. Nie da się go zostawić działającym, bo ze
statycznej strony nie sposób uwierzytelnić się przez Access.

## Co robić, gdy nie działa

| Objaw | Przyczyna | Co zrobić |
|---|---|---|
| `503` i lista brakujących zmiennych | `ACCESS_TEAM_DOMAIN` / `ACCESS_AUD` puste | Krok 7 |
| `302` zamiast `401` na hoście pracowniczym | **tak ma być** — Access odsyła na logowanie zanim żądanie dojdzie do Workera | nic; kody Workera testuj na `workers.dev` (krok 8) |
| `401 Brak tokenu` mimo zalogowania | Access nie obejmuje tego hosta | Sprawdź *Application domain* — subdomena ma być `budmax-pracownik`, `Path` puste (krok 5) |
| `401 Brak tokenu` na `workers.dev` | **tak ma być** — Access nie działa na `*.workers.dev` i nigdy nie postawi tam tokenu | tryb wewnętrzny ma jeden adres: `budmax-pracownik.know-base.app` |
| `401 Token podpisano kluczem nieznanym dla tego zespołu` | JWKS pobrane, ale token nie pochodzi z tego zespołu | jeśli to token z prawdziwego logowania — sprawdź `ACCESS_TEAM_DOMAIN` przez `issuer` z `/.well-known/openid-configuration` (krok 1) |
| ekran logowania pokazuje inną nazwę niż `ACCESS_TEAM_DOMAIN` | to pole **wyświetlane** (*Custom pages*), nie domena uwierzytelniania | nic w kodzie; rozstrzyga `issuer`, nie napis — krok 1 |
| Publiczny host prosi o logowanie | Aplikacja Access zbudowana na `budmax` zamiast `budmax-pracownik` | Popraw *Application domain* (krok 5) |
| `401 Token wystawiony dla innej aplikacji` | AUD z innej aplikacji Access | Przepisz AUD z właściwej aplikacji (krok 7) |
| `401 Token wystawiony przez inny zespół` | Literówka w `ACCESS_TEAM_DOMAIN` | Ma być pełny host `nazwa.cloudflareaccess.com`, bez `https://` |
| `502 Nie udało się pobrać kluczy` | Zła nazwa zespołu albo chwilowa awaria | Sprawdź `https://knowbase.cloudflareaccess.com/cdn-cgi/access/certs` w przeglądarce |
| Domena przestała działać po deployu | Custom domain nie ma go w `wrangler.toml` | Krok 4, punkt 3 |
| Logowanie wraca błędem `redirect_uri_mismatch` | Zły adres przekierowania u dostawcy | Musi być `https://knowbase.cloudflareaccess.com/cdn-cgi/access/callback` |

---

## Co ta konfiguracja zmienia w uprawnieniach

| Adres i endpoint | Kto ma dostęp | Czym się uwierzytelnia |
|---|---|---|
| `budmax.know-base.app` → `POST /` | każdy | — (publiczny widget) |
| `budmax-pracownik.know-base.app` → `POST /internal` | pracownik z reguły Access | tożsamość Google / Microsoft |
| dowolny host → `/reindex`, `/purge`, `/stats`, `/debug` | administrator | `REINDEX_SECRET` |

Sedno etapu 2: **pracownik przestał dzielić sekret z administratorem.** Kto ma
dostęp do bota, nie ma już prawa skasować indeksu.

---

## Kolejny klient — co powtórzyć

Struktura jest per klient, więc przy `kancelaria.know-base.app`:

1. dwa wpisy `[[routes]]` w `wrangler.toml` (`kancelaria`, `kancelaria-wewnetrzny`),
2. oba hosty plus stronę klienta dopisane do `ALLOWED_ORIGINS` w `worker.js`,
3. **osobna** aplikacja Access na `kancelaria-wewnetrzny.know-base.app`,
   z własną regułą (`@kancelaria.pl`) — bo polityka dostępu jest inna dla
   każdej firmy,
4. `deploy`.

Punkt 3 oznacza **własny AUD dla każdego klienta**, a `ACCESS_AUD` jest dziś
pojedynczą wartością. Przy drugim kliencie trzeba to zamienić na mapę
`host → AUD`. To jest znany dług, nie przeoczenie — nie ma sensu budować mapy
dla jednego wpisu, ale nie da się jej ominąć przy drugim.

---

## Krok 10. Drugi klient — kancelaria ✅ zrobione 24.08.2026

Ten krok powtarza się **dla każdego nowego klienta**. Zmienia się w nim tylko
nazwa — reszta jest identyczna, bo rola wynika z hosta, a nie z polityki.

**Nakład: dwie aplikacje Access i dwa wklejenia AUD-a. Około 15 minut.**

### 10.0. Kolejność — to jest reguła, nie preferencja

Host w `wrangler.toml` i host w Access zmienia się **razem**, a jeśli osobno —
to **najpierw kod i trasy**. Odwrotna kolejność zostawia aplikację Access
wskazującą na host, którego Worker nie obsługuje.

Trasy są już w `wrangler.toml` (24.08.2026), a `ACCESS_AUD_KANCELARIA*` są puste.
To jest stan bezpieczny: hosty pracowniczy i właścicielski oddają **503 z nazwą
brakującej zmiennej**, nie interfejs bez ochrony.

### 10.1. Wdróż trasy i sprawdź fail-closed

```
wrangler deploy
curl -si "https://kancelaria.know-base.app/?cb=$RANDOM"             | head -1   # 200
curl -si "https://kancelaria-pracownik.know-base.app/?cb=$RANDOM"   | head -1   # 503
curl -si "https://kancelaria-wlasciciel.know-base.app/?cb=$RANDOM"  | head -1   # 503
```

Gdyby któryś z dwóch ostatnich oddał **200 z interfejsem** — przerwij. To znaczy,
że AUD nie jest pusty i host stoi bez ochrony.

`?cb=$RANDOM` jest obowiązkowe: Cloudflare buforuje na brzegu i sonda potrafi
pokazać stan sprzed wdrożenia. Kosztowało to już dwa fałszywe alarmy.

### 10.2. Aplikacja Access nr 1 — tryb pracowniczy

Zero Trust → Access → Applications → **Add an application** → **Self-hosted**.

| Pole | Wartość |
|---|---|
| Application name | `Kancelaria — tryb wewnętrzny` |
| Session Duration | `24 hours` |
| Subdomain / Domain | `kancelaria-pracownik` / `know-base.app` |
| Path | **pusty** — aplikacja obejmuje cały host |
| Identity providers | One-time PIN (dopóki kroki 2–3 nie są zrobione) |

Polityka: name `Zespół kancelarii`, Action **Allow**, Include →
**Emails ending in** → `@zaremba.przyklad.pl`.

> **Uwaga na demo:** ta domena jest fikcyjna. Na potrzeby prezentacji wpisz
> zamiast niej Include → **Emails** → swój adres, inaczej nie zalogujesz się
> do własnego dema.

Po zapisaniu: Overview → skopiuj **Application Audience (AUD) Tag**.

### 10.3. Aplikacja Access nr 2 — panel właściciela

| Pole | Wartość |
|---|---|
| Application name | `Kancelaria — panel właściciela` |
| Subdomain / Domain | `kancelaria-wlasciciel` / `know-base.app` |
| Path | **pusty** |

Polityka: Action **Allow**, Include → **Emails** → **jeden dokładny adres**.

> **Nie `Emails ending in`.** To ta sama pomyłka, którą rozdzielenie hostów
> usunęło 21.08.2026: polityka na całą domenę wpuściłaby każdego pracownika
> do analityki właściciela.

Skopiuj drugi AUD.

### 10.4. Wklej AUD-y i wdróż

W `wrangler.toml`, w `[vars]` — nazwy muszą być dokładnie takie, bo są wpisane
w `audVars` w `klienci.js`:

```toml
ACCESS_AUD_KANCELARIA = "…"        # aplikacja "Kancelaria — tryb wewnętrzny"
ACCESS_AUD_KANCELARIA_PANEL = "…"  # aplikacja "Kancelaria — panel właściciela"
```

Potem `wrangler deploy`.

### 10.5. Sprawdź, że działa

1. Host pracowniczy bez sesji → **302** na ekran logowania (odpowiada Access,
   nie Worker).
2. Po zalogowaniu → interfejs kancelarii: jasny, szeryfowy, bez siatki.
3. **Najważniejsze:** token z hosta pracowniczego **nie może** otworzyć panelu
   właściciela. Worker wybiera oczekiwany AUD po hoście, więc ma oddać 401.
   Pilnuje tego sekcja 5 w `test-access.mjs`, ale na żywo warto zobaczyć raz.

Dopiero po tym kroku przełącznik demo prowadzi pod adresy, które istnieją.

### 10.6. Wynik — zmierzone 24.08.2026

Obie aplikacje Access istnieją, AUD-y wpisane, wdrożone.

| Host | Kod | Znaczenie |
|---|---|---|
| `kancelaria.know-base.app` | 405 | poprawnie — host publiczny przyjmuje tylko `POST /` |
| `kancelaria-pracownik` | **302** | Access przechwytuje przed Workerem |
| `kancelaria-wlasciciel` | **302** | jw., osobna aplikacja |

Rozdzielność AUD-ów potwierdzona **sekcją 6 w `test-access.mjs`** (7 przypadków):
token pracownika kancelarii nie otwiera jej panelu właściciela, token panelowy
nie otwiera hostu pracowniczego, a **żaden token BudMaksu nie otwiera hostu
kancelarii** ani odwrotnie. Do 24.08.2026 rozdzielność między klientami nie była
sprawdzana wcale — istniał tylko jeden klient z hostami.

**Czego ten pomiar NIE obejmuje:** sprawdzenia na żywym tokenie z logowania.
Sekcja 6 podstawia własne klucze, więc dowodzi mechanizmu, nie konfiguracji
polityk w dashboardzie. Żywą ścieżkę sprawdza się tak, jak opisano w kroku 8
(sposób A — ciasteczko z przeglądarki).

**Zostaje jedna rzecz po stronie właściciela:** upewnić się, że polityka
aplikacji `Kancelaria — panel właściciela` dopuszcza **jeden adres e-mail**,
a nie całą domenę. To ten sam warunek, który wisi przy panelu BudMaksu.

## Krok 11. Logo na ekranie logowania — ✅ plik gotowy 25.08.2026

Zero Trust → **Settings** → **Custom Pages** (w nowszym interfejsie:
**Reusable components** → **Custom pages**) → **Access login page** → **Logo URL**.

Adres do wklejenia:

```
https://p0rk1.github.io/widgetAI/assets/logo-knowbase.svg
```

Plik żyje w repo jako `assets/logo-knowbase.svg` i jest **zasobem projektu**,
nie tylko obrazkiem dla Access — użyje go też strona produktu i materiały
sprzedażowe. Zmiana logo to edycja tego pliku i `git push`; adres zostaje ten sam.

**GitHub Pages serwuje go z `Content-Type: image/svg+xml`** — sprawdzone
pomiarem 25.08.2026, więc obawa o podanie SVG jako `text/plain` nie potwierdziła
się. Gdyby to się kiedyś zmieniło (albo gdyby Access odrzucił adres z innego
powodu), kolejność zapasowych dróg jest taka:

1. **Worker** — `GET /logo.svg` z ustawionym nagłówkiem, dostępne na każdym
   z hostów `know-base.app`. Kosztuje kilka linii w routingu i wiąże logo
   z produkcyjnym Workerem, więc nie jest pierwszym wyborem
2. **R2 z publicznym dostępem** — poprawny typ zawartości z metadanych obiektu,
   ale to nowy zasób infrastruktury dla jednego pliku
3. **PNG zamiast SVG** — ostateczność. Access przyjmuje rastr, ale logo traci
   ostrość na ekranach o dużej gęstości

**Ekran logowania jest jeden na całą organizację Zero Trust** — patrz
`CLAUDE.md` → „Następne kroki", punkt 4. Dlatego stoi tam logo **produktu
(KnowBase)**, a nie BudMaksu ani kancelarii.

### Dlaczego krycia nie są takie, jak w pierwszym szkicu

Znak to trzy zaokrąglone kwadraty (bok 62, `rx="14"`) w układzie trójkątnym,
a wrażenie szkła bierze się z **nakładania się przezroczystości**, nie z filtra
ani gradientu — dzięki temu działa w małym rozmiarze i na dowolnym tle.

Pierwotne krycia 0.30 (dolne) i 0.42 (górny) dawały na **białej karcie
logowania** kontrast **1.71:1** w największym, pojedynczym polu — to poziom
znaku wodnego, nie logo. Krycia podniesiono do **0.48 / 0.67**, czyli
**z zachowaną proporcją 1.4** między warstwami. Drabina kontrastów na bieli:

| Pole | Krycie wypadkowe | Kontrast wobec bieli |
|---|---|---|
| pojedynczy dolny | 0.480 | 2.49 |
| pojedynczy górny | 0.670 | 3.93 |
| dolny + dolny | 0.730 | 4.59 |
| górny + dolny | 0.828 | 6.01 |
| wszystkie trzy | 0.911 | 7.59 |

Wariant jeszcze mocniejszy (0.55 / 0.77) **odrzucono**: trzy najciemniejsze pola
zbiegają się tam do 5.51 / 7.29 / 8.58, a potrójne przecięcie jest praktycznie
nieodróżnialne od jednolitego `#26456B` — czyli znika dokładnie to, co ten znak
ma pokazywać.

---

## Krok 12. Dostawcy tożsamości u klienta — ⬜ odłożone świadomie, runbook gotowy

Zastępuje kroki **2 i 3**, które opisywały samo klikanie. Tu jest to samo plus
rozdzielenie ról, moment wyłączenia „wszystkich dostawców" i rachunek dla
sprzedaży.

### 12.0. Werdykt: tego kroku NIE DA SIĘ zrobić w próżni

Nie jest to kwestia priorytetu, tylko wejść. **Google Workspace i Entra ID
rejestruje się PRZECIWKO konkretnemu katalogowi:**

| Dostawca | Czego wymaga na wejściu | Skąd to się bierze |
|---|---|---|
| Google Workspace | domena Workspace + Client ID/secret z projektu w **tej** organizacji | konto Workspace klienta |
| Microsoft Entra ID | **Directory (tenant) ID** + Client ID/secret z rejestracji w **tym** tenancie | tenant klienta |

BudMax i kancelaria są fikcyjne i **nie mają katalogów**. Nie ma tenanta, w którym
dałoby się zrobić App registration, ani Workspace, którego domenę dałoby się
wpisać. Konfiguracja „na zapas" nie ma tu żadnej treści do wpisania.

**Decyzja: krok czeka na pierwszego klienta z katalogiem.** Co robi się teraz,
to ten runbook i rachunek z 12.8 — czyli rzecz potrzebna przy **sprzedaży**,
nie przy wdrożeniu.

> **Jedno jest testowalne w próżni i warto to zrobić — patrz 12.1.** Nie jest to
> Workspace ani Entra, tylko dowód, że ścieżka przez zewnętrznego dostawcę OIDC
> działa u nas end-to-end, zanim patrzy na to klient.

**Czego ten krok NIE zmienia: kodu.** `verifyAccessJwt()` sprawdza podpis, `iss`,
`aud` i ważność — **nie sprawdza, który dostawca wystawił tożsamość** i nie ma
gdzie tego sprawdzać. Podpięcie Workspace albo Entry jest zmianą wyłącznie
w dashboardzie. Żadnego `wrangler deploy`, żadnego reindeksu, AUD-y bez zmian.

### 12.1. Próba generalna na własnym koncie — opcjonalna, 15 minut, bez klienta

Zwykły **Google** (nie Workspace) to konsumencki OAuth: wymaga tylko Client ID
i sekretu z **Twojego** projektu w Google Cloud, bez żadnego katalogu firmy.
Nie nadaje się na produkcję u klienta — **uwierzytelni każde konto Google
na świecie**, a granicą zostaje sama reguła dostępu — ale dowodzi rzeczy, których
One-time PIN nie dowodzi:

- że adres przekierowania jest poprawny i Access domyka pętlę OAuth,
- że token z zewnętrznego dostawcy przechodzi przez `verifyAccessJwt()` tak samo
  jak z PIN-u,
- że przełącznik dostawców per aplikacja (12.4) faktycznie odcina PIN.

Zrób to na aplikacji **BudMax — tryb wewnętrzny** i zostaw PIN włączony obok.
Jeśli nie chcesz dokładać ruchomych części przed pilotażem — pomiń, nie blokuje.

### 12.2. Podział pracy: co robi klient, co Ty

**To jest sedno tego kroku dla sprzedaży.** Większość roboty leży po stronie
klienta i bez jego administratora nie da się jej wykonać ani obejść.

| # | Czynność | Kto | Gdzie |
|---|---|---|---|
| 1 | Rejestracja aplikacji / klienta OAuth w katalogu firmy | **admin klienta** | Google Cloud Console albo Entra admin center |
| 2 | Wpisanie adresu przekierowania (wartość z 12.3) | **admin klienta** | jw. |
| 3 | Nadanie uprawnień i **admin consent** (tylko Entra) | **admin klienta** | Entra |
| 4 | Przekazanie Ci Client ID, Client secret, tenant ID / domeny | **admin klienta** | kanałem bezpiecznym |
| 5 | Dodanie metody logowania w Zero Trust | **Ty** | Settings → Authentication |
| 6 | `Test` przy metodzie logowania | **Ty** | jw. |
| 7 | Zawężenie dostawców w dwóch aplikacjach klienta | **Ty** | Access → Applications |
| 8 | Zmiana reguły z pojedynczego adresu na domenę firmy | **Ty** | jw., Policies |
| 9 | Logowanie kontrolne kontem pracownika | **admin klienta** | przeglądarka |

**Client secret jest hasłem do tożsamości firmy.** Nie mailem, nie w załączniku,
nie w komunikatorze, który archiwizuje. Nie trafia do repo ani do `wrangler.toml`
— żyje wyłącznie w polu formularza Zero Trust.

### 12.3. Wartość, którą klient wpisuje u siebie — jedna, ta sama dla obu dostawców

```
https://knowbase.cloudflareaccess.com/cdn-cgi/access/callback
```

**To jest domena zespołu, nie napis z ekranu logowania.** Gdyby klient wpisał
`late-darkness-273f.cloudflareaccess.com`, logowanie wywali się na
`redirect_uri_mismatch`. Rozstrzygnięte i udowodnione w kroku 1 — nie „poprawiać".

Wartość jest **wspólna dla wszystkich klientów**, bo organizacja Zero Trust jest
jedna. To ta sama granica, co przy ekranie logowania w kroku 11.

### 12.3a. Wariant Google Workspace

**Po stronie klienta** (Google Cloud Console, konto w jego Workspace):

1. Wybierz lub utwórz projekt **w organizacji firmy** — nie na koncie prywatnym.
2. **APIs & Services → OAuth consent screen** → typ **Internal**. Typ „Internal"
   jest tym, co wiąże logowanie z katalogiem firmy; „External" tego nie robi.
3. **Credentials → Create credentials → OAuth client ID** → **Web application**.
4. **Authorized redirect URIs** → wartość z 12.3, znak w znak.
5. Przekaż: **Client ID**, **Client secret**, **domena Workspace** (np. `firma.pl`).

**Po Twojej stronie:** Zero Trust → **Settings → Authentication → Login methods
→ Add new** → **Google Workspace** → wklej trzy wartości → **Test**.

> **Nie proś o synchronizację grup, dopóki jej nie potrzebujesz.** Grupy Workspace
> wymagają konta usługowego z delegacją ogólnodomenową i uprawnień Admin SDK —
> to osobna rozmowa z administratorem i osobna zgoda. Reguła po **domenie
> e-mail** (12.5) daje to samo przy jednym kliencie na jednym zespole.

### 12.3b. Wariant Microsoft Entra ID

**Po stronie klienta** (Entra admin center, konto z prawem rejestracji aplikacji):

1. **Applications → App registrations → New registration**, nazwa `Cloudflare Access`.
2. Typ konta: **Single tenant**.
3. **Redirect URI** → platforma **Web** → wartość z 12.3.
4. Z **Overview** skopiuj **Application (client) ID** i **Directory (tenant) ID**.
5. **Certificates & secrets → New client secret** → skopiuj **wartość**, nie
   identyfikator. Widać ją jeden raz. **Zanotuj datę wygaśnięcia** — patrz 12.7.
6. **API permissions → Microsoft Graph → Delegated**: `openid`, `profile`,
   `email`, `offline_access`. Grupy (`Directory.Read.All`, *Application*) tylko
   jeśli świadomie ich chcesz.
7. **Grant admin consent** — bez tego pierwsze logowanie pracownika stanie na
   ekranie zgody, którego pracownik nie ma prawa zatwierdzić.
8. Przekaż: **Client ID**, **Client secret (wartość)**, **Directory (tenant) ID**.

**Po Twojej stronie:** Login methods → **Add new** → **Azure AD / Microsoft
Entra ID** → wklej trzy wartości → **Test**.

### 12.4. Wyłączenie „Accept all available identity providers" — moment i skutek

**Kiedy:** po tym, jak `Test` przy nowej metodzie przeszedł, i po tym, jak
**przynajmniej jedna** osoba z firmy zalogowała się nią na żywo (12.2, punkt 9).
Nie wcześniej. Odwrotna kolejność zamyka klienta przed drzwiami, których nikt
jeszcze nie otworzył.

**Gdzie:** Access → Applications → aplikacja klienta → sekcja **Identity
providers** → odznacz *Accept all available identity providers*, zaznacz **tylko**
dostawcę tego klienta.

**Zrób to w OBU aplikacjach klienta** — pracowniczej i właścicielskiej. Aplikacje
są dwie i konfiguruje się je osobno.

**Dopóki tego nie zrobisz, integracja jest ozdobna** — One-time PIN stoi obok
i każdy, kto odbiera pocztę pod adresem pasującym do reguły, wchodzi bez
przechodzenia przez katalog firmy. Wyłączenie konta w Workspace nie odbiera
wtedy dostępu do bota.

**Co się stanie z Twoim własnym dostępem:** przełącznik jest **per aplikacja**,
więc **nic** — o ile nie ruszysz aplikacji demo. Twoje konto jest prywatnym
kontem Google, nie ma go w katalogu klienta i po zawężeniu **nie wejdziesz do
aplikacji klienta**. Tak ma być: to konfiguracja jego firmy, a nie Twoja skrzynka
serwisowa. Gdy będziesz potrzebował tam wejść, poproś o konto w ich katalogu
albo o czasowe dopisanie do reguły.

> **Blokada dotyczy aplikacji, nie konta Cloudflare.** Do dashboardu Zero Trust
> logujesz się osobno, jako właściciel konta, i tej drogi ten przełącznik nie
> dotyka. Każde zawężenie da się cofnąć w tym samym miejscu — to nie jest
> operacja jednokierunkowa.

### 12.5. Reguła dostępu po podpięciu katalogu

Dopiero teraz `Emails ending in → @firma.pl` znaczy „pracownik firmy",
a nie „ktokolwiek z taką skrzynką". Do tego momentu **zostaje wariant
z pojedynczymi adresami** (krok 6).

Aplikacja **właścicielska zostaje na `Emails` z jednym adresem** — także po
podpięciu katalogu. Katalog nie zmienia tego, że analityka jest dla właściciela,
a nie dla zespołu.

### 12.6. Odpowiedź na pytanie o zasięg: zespołowe czy per klient — OBA

To jest rozróżnienie, na którym stoi cała ta sekcja.

| Warstwa | Zasięg | Kto ustawia |
|---|---|---|
| Lista metod logowania (Settings → Authentication) | **cała organizacja Zero Trust** | Ty, raz na klienta |
| Wybór dostawców w aplikacji | **per aplikacja** | Ty |
| Reguła dostępu (Policies) | **per aplikacja** | Ty |

**Więc przy dwóch klientach z różnymi katalogami masz oba katalogi zarejestrowane
w swojej organizacji — i to jest nieuniknione.** Ale **nie jest prawdą, że reguła
dostępu zostaje jedyną granicą**: aplikacja klienta A przyjmuje wyłącznie
dostawcę A, więc pracownik klienta B nie ma jak się na niej **uwierzytelnić**,
niezależnie od reguły. Granice są dwie i są niezależne:

1. **dostawca w aplikacji** — czy tożsamość w ogóle powstanie,
2. **reguła dostępu** — czy powstała tożsamość wejdzie.

Warstwa 1 działa dopiero po 12.4. Dopóki stoi „wszystkie dostępne", masz
faktycznie jedną granicę — i to jest ten sam argument, co w kroku 5.

**Czego to nie rozdziela:** ekranu logowania (jeden na organizację, krok 11)
ani tego, że katalogi obu klientów są widoczne dla administratora organizacji,
czyli dla Ciebie. Rozdzielenie tego wymaga **osobnego konta Cloudflare na
klienta**, nie kolejnej aplikacji — to samo ograniczenie, co przy barwach ekranu
logowania.

### 12.7. Co utrzymujesz po wdrożeniu

- **Client secret wygasa.** W Entra ma datę ważności ustawianą przy tworzeniu
  (domyślnie miesiące, nie lata); sekret Google bywa rotowany przez
  administratora. Wygaśnięcie objawia się jako **logowanie padające dla całej
  firmy naraz**, bez żadnej zmiany po naszej stronie. Zanotuj datę przy wdrożeniu
  i przypomnij klientowi miesiąc wcześniej.
- **Odejście pracownika** odbiera dostęp automatycznie dopiero po 12.4. Wcześniej
  nie odbiera go wcale, dopóki skrzynka odbiera pocztę.
- **Sesja trwa 24 godziny** (krok 5). Wyłączenie konta w katalogu nie unieważnia
  trwającej sesji — przy zwolnieniu dyscyplinarnym trzeba dodatkowo unieważnić
  sesje użytkownika po stronie Access.

### 12.8. Rachunek dla sprzedaży

Wymaganie wobec klienta brzmi: **administrator Google Workspace albo Microsoft
365, dostępny na jedną sesję przy wdrożeniu.**

| Pozycja | Nakład |
|---|---|
| Praca admina klienta (rejestracja, consent, przekazanie wartości) | **20–30 min jednorazowo** |
| Logowanie kontrolne pracownika | 2 min |
| Twoja praca w Zero Trust (wklejenie, test, dwie aplikacje) | **~15 min** |
| Koszt licencyjny | **zero** — Workspace albo Entra ID klient już ma, Zero Trust do 50 użytkowników jest w planie darmowym |
| Czas kalendarzowy | zwykle nie technika, tylko **dostępność administratora** |

Firma do 50 osób miewa Workspace albo Microsoft 365 bez własnego działu IT —
administratorem bywa właściciel albo zewnętrzny informatyk. **Przy sprzedaży
pytaj o to na pierwszej rozmowie**, bo jest to jedyna rzecz we wdrożeniu, której
nie możesz zrobić sam.

**Klient bez żadnego katalogu** (poczta na własnym hostingu, adresy prywatne)
zostaje na **One-time PIN** i trzeba mu powiedzieć wprost, co to znaczy: dostęp
ma każdy, kto ma dostęp do skrzynki, a odebranie dostępu wymaga zmiany reguły
w Access, nie wyłączenia konta.

### 12.9. Co z demami — nie ruszaj ich

**BudMax i kancelaria zostają na One-time PIN i na regułach z pojedynczym
adresem.** Cztery aplikacje demo (dwie na klienta) nie mają katalogu, do którego
dałoby się je podpiąć.

Ponieważ zawężanie dostawców jest **per aplikacja**, podpięcie Workspace
pierwszego prawdziwego klienta **nie dotyka dem w żaden sposób** — pojawia się
tylko nowa pozycja na wspólnej liście metod logowania, a aplikacje demo nadal
przyjmują „wszystkie dostępne", czyli PIN.

Jedyne, co realnie widać w demach po podpięciu obcego dostawcy, to **dodatkowy
przycisk na ekranie logowania** („Zaloguj przez Google/Microsoft") — bo ekran
jest wspólny dla organizacji. Kliknięcie go kontem spoza reguły kończy się
odmową dostępu, nie wejściem. Kosmetyka, nie dziura — ale wiedz o tym, zanim
zobaczysz to na prezentacji.

**Jedna rzecz do sprawdzenia przed pierwszym pilotażem, niezależna od tego kroku:**
czy polityka aplikacji `BudMax — panel właściciela` i `Kancelaria — panel
właściciela` dopuszcza **jeden adres**, a nie całą domenę. To wisi od 21.08.2026.
