# Konfiguracja Cloudflare Zero Trust Access dla trybu wewnętrznego

## Stan: ✅ tryb wewnętrzny gotowy (18.08.2026) · ⬜ panel właściciela czeka na konfigurację (21.08.2026)

> **Do wyklikania:** krok 9 — druga aplikacja Access dla `budmax-panel.know-base.app`.
> Kod jest wdrożony; do tego czasu host panelowy zwraca 503 z nazwą brakującej zmiennej.

Aplikacja Access istnieje, `ACCESS_TEAM_DOMAIN` i `ACCESS_AUD` są w `wrangler.toml`,
Worker wdrożony (wersja `e2544cf1-61ee-468b-ab08-c70447056701`). **`/internal` nie
zwraca już 503** — patrz „Krok 8" z wynikami z 18.08.2026.

Zrobione: kroki **1, 4, 5, 6, 7, 8**. Zostało: kroki **2 i 3** (Google i Microsoft
jako metody logowania) — dziś jedyną działającą metodą jest **One-time PIN**,
czyli kod wysyłany na adres e-mail. To wystarcza do testów i do pojedynczego
użytkownika, ale nie jest docelowe dla zespołu klienta.

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
| `budmax-wewnetrzny.know-base.app` | bot dla pracowników | działa, za Access — niezalogowany dostaje 302 na ekran logowania |
| `knowbase-budmax.rezi7608.workers.dev` | stary adres, nadal używany przez widget i panel | działa, zostaje |

**Rozdzielenie na dwa hosty jest sednem tej konfiguracji.** Aplikacja Access
obejmie **cały host wewnętrzny**, a nie ścieżkę w środku hosta publicznego.
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

## Krok 2. Podepnij Google Workspace — ⬜ do zrobienia

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

## Krok 3. Podepnij Microsoft Entra ID — ⬜ do zrobienia

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

curl -s -o /dev/null -w "%{http_code}\n" -X POST https://budmax-wewnetrzny.know-base.app/internal \
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
   | Subdomain | `budmax-wewnetrzny` |
   | Domain | `know-base.app` (wybór z listy domen w koncie) |
   | Path | **zostaw puste** |

   **Ścieżki celowo nie ustawiamy** — aplikacja ma objąć cały host. Na
   `budmax-wewnetrzny.know-base.app` nie ma niczego publicznego, więc nie ma
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
   curl -s -o /dev/null -D - https://budmax-wewnetrzny.know-base.app/internal \
     | grep -i "^location:"
   # …/cdn-cgi/access/login/budmax-wewnetrzny.know-base.app?kid=<AUD>&meta=…
   ```

   Ten sam adres niesie parametr `meta` — podpisany JWT, którego pole `aud`
   powtarza tę wartość, a `kid` w nagłówku wskazuje klucz z
   `/cdn-cgi/access/certs` zespołu. Zgodność obu potwierdza za jednym razem
   **i AUD, i nazwę zespołu**, więc nie trzeba ufać przepisaniu z ekranu.

   **Weryfikacja AUD zrobiona 18.08.2026 (kryptograficznie, nie na oko):** podpis
   RS256 meta-JWT sprawdzony kluczem o jego `kid` pobranym z JWKS zespołu
   `knowbase` — **poprawny**. Czyli token niosący `aud = 31995d69…` dla hosta
   `budmax-wewnetrzny.know-base.app` jest podpisany kluczem tego zespołu, a nie
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
`budmax-wewnetrzny.know-base.app` żądanie bez ważnej sesji **nie dociera do
Workera** — zatrzymuje je Access na brzegu i odsyła `302` na ekran logowania.
Kody Workera (`401` z opisem powodu) widać dopiero po przejściu przez Access
albo na starym adresie `workers.dev`, którego Access nie obejmuje.

Dlatego weryfikacja tokenu w Workerze testuje się na `workers.dev`, a działanie
samego Access — na hoście wewnętrznym.

**Z przeglądarki** — wejdź na `https://budmax-wewnetrzny.know-base.app/internal`.
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
curl -s -o /dev/null -D - -X POST https://budmax-wewnetrzny.know-base.app/internal \
  -H "Content-Type: application/json" -d '{"question":"Jaka jest marza?"}' | grep -i "^location:"
# HTTP/1.1 302 Found
# Location: https://knowbase.cloudflareaccess.com/cdn-cgi/access/login/budmax-wewnetrzny.know-base.app?kid=…

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
układ adresów: na hoście wewnętrznym Access zatrzymuje bezsesyjne żądanie na brzegu
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

1. Zaloguj się na `https://budmax-wewnetrzny.know-base.app/internal`
   (dziś: One-time PIN na adres z reguły z kroku 6).
2. DevTools → *Application* → *Cookies* → skopiuj **`CF_Authorization`**.
3. ```bash
   curl -s -X POST https://budmax-wewnetrzny.know-base.app/internal \
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
   curl -s -X POST https://budmax-wewnetrzny.know-base.app/internal \
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

## Krok 9. Aplikacja Access dla panelu właściciela — ⬜ DO ZROBIENIA (21.08.2026)

Panel właściciela przeszedł z `REINDEX_SECRET` na tożsamość z Access. **Kod jest
wdrożony, konfiguracji brakuje** — do czasu wykonania tego kroku host panelowy
odpowiada `503` z nazwą brakującej zmiennej. To jest stan zamierzony, nie usterka.

**Dlaczego osobny host, a nie ścieżka na hoście wewnętrznym.** Panel należy do
właściciela firmy, aplikacja pracownicza do zespołu. To dwie różne polityki
dostępu, a polityki przypina się do aplikacji Access, czyli do hostu. Osobny host
sprawia, że **rola wynika z adresu** — Worker nie musi znać żadnych ról, list
e-maili ani grup. Wariant „jeden host, rola w polityce na ścieżce `/panel`"
odrzucony z tego samego powodu, co przy trybie wewnętrznym: ochrona stałaby
na poprawnie wpisanym polu `Path`.

### 9.1. Host panelowy — ✅ zrobione przez `wrangler deploy`

`budmax-panel.know-base.app` powstał automatycznie razem z wdrożeniem, bo
`wrangler.toml` ma dla niego wpis `[[routes]]` z `custom_domain = true`.
Sprawdź w **Workers & Pages → knowbase-budmax → Settings → Domains & Routes**,
że host jest na liście. Nic tu nie klikasz.

### 9.2. Utwórz drugą aplikację Access

**Zero Trust → Access → Applications → Add an application → Self-hosted.**

| Pole | Wartość |
|---|---|
| Application name | `BudMax — panel właściciela` |
| Session Duration | `24 hours` (jak przy trybie wewnętrznym) |
| Subdomain | `budmax-panel` |
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
curl -s "https://budmax-panel.know-base.app/?cb=$RANDOM"
# Panel właściciela nie jest jeszcze skonfigurowany.
# Brakujące zmienne: ACCESS_AUD_PANEL

# 2. po uzupełnieniu i wdrożeniu — 302 na ekran logowania
curl -s -o /dev/null -w "%{http_code}\n" -I "https://budmax-panel.know-base.app/?cb=$RANDOM"
# 302

# 3. dawny klucz administracyjny NIE otwiera panelu (ma być 404)
curl -s "https://knowbase-budmax.rezi7608.workers.dev/stats?key=SEKRET&cb=$RANDOM"
# {"error":"Panel właściciela działa wyłącznie na hoście panelowym."}

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
| `https://budmax-panel.know-base.app/` | analityka widgetu publicznego (pytania klientów, luki) |
| `https://budmax-panel.know-base.app/panel` | analityka bota wewnętrznego (luki szkoleniowe, eskalacje) |

Stary adres `https://p0rk1.github.io/widgetAI/panel.html` **nie jest już panelem** —
pokazuje wskazówkę z nowym adresem. Nie da się go zostawić działającym, bo ze
statycznej strony nie sposób uwierzytelnić się przez Access.

## Co robić, gdy nie działa

| Objaw | Przyczyna | Co zrobić |
|---|---|---|
| `503` i lista brakujących zmiennych | `ACCESS_TEAM_DOMAIN` / `ACCESS_AUD` puste | Krok 7 |
| `302` zamiast `401` na hoście wewnętrznym | **tak ma być** — Access odsyła na logowanie zanim żądanie dojdzie do Workera | nic; kody Workera testuj na `workers.dev` (krok 8) |
| `401 Brak tokenu` mimo zalogowania | Access nie obejmuje tego hosta | Sprawdź *Application domain* — subdomena ma być `budmax-wewnetrzny`, `Path` puste (krok 5) |
| `401 Brak tokenu` na `workers.dev` | **tak ma być** — Access nie działa na `*.workers.dev` i nigdy nie postawi tam tokenu | tryb wewnętrzny ma jeden adres: `budmax-wewnetrzny.know-base.app` |
| `401 Token podpisano kluczem nieznanym dla tego zespołu` | JWKS pobrane, ale token nie pochodzi z tego zespołu | jeśli to token z prawdziwego logowania — sprawdź `ACCESS_TEAM_DOMAIN` przez `issuer` z `/.well-known/openid-configuration` (krok 1) |
| ekran logowania pokazuje inną nazwę niż `ACCESS_TEAM_DOMAIN` | to pole **wyświetlane** (*Custom pages*), nie domena uwierzytelniania | nic w kodzie; rozstrzyga `issuer`, nie napis — krok 1 |
| Publiczny host prosi o logowanie | Aplikacja Access zbudowana na `budmax` zamiast `budmax-wewnetrzny` | Popraw *Application domain* (krok 5) |
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
| `budmax-wewnetrzny.know-base.app` → `POST /internal` | pracownik z reguły Access | tożsamość Google / Microsoft |
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
