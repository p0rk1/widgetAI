# Konfiguracja Cloudflare Zero Trust Access dla trybu wewnętrznego

Instrukcja do wyklikania w panelu. Kod Workera jest już gotowy i wdrożony —
brakuje mu tylko dwóch wartości (`ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`), które
powstają dopiero przy tworzeniu aplikacji w Zero Trust.

Dopóki ich nie ma, `/internal` zwraca **503 z wyjaśnieniem, czego brakuje** —
to celowe, nie awaria.

---

## Stan wyjściowy — co już jest gotowe

Domena `know-base.app` jest w koncie Cloudflare, a Worker ma dwa własne adresy
(wdrożone 17.08.2026, wersja `51f7b541`):

| Adres | Do czego | Stan |
|---|---|---|
| `budmax.know-base.app` | publiczny endpoint widgetu | działa, odpowiada |
| `budmax-wewnetrzny.know-base.app` | bot dla pracowników | działa, zwraca 503 do czasu konfiguracji Access |
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

## Krok 1. Włącz Zero Trust i ustal nazwę zespołu

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

➡️ To jest przyszła wartość **`ACCESS_TEAM_DOMAIN`**.

---

## Krok 2. Podepnij Google Workspace

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

## Krok 3. Podepnij Microsoft Entra ID

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
  -H "Content-Type: application/json" -d '{"question":"test"}'          # 503 teraz, 401 po konfiguracji
```

Widget i panel nadal wołają stary adres `workers.dev` i tak zostaje —
przeniesienie ich na `budmax.know-base.app` to osobna, świadoma zmiana.

---

## Krok 5. Utwórz aplikację Access

1. Zero Trust → **Access → Applications → Add an application → Self-hosted**.
2. **Application name**: `BudMax — tryb wewnętrzny`.
   (Nazwa per klient, bo aplikacji będzie tyle, ilu klientów.)
3. **Session Duration**: `24 hours` (pracownik loguje się raz dziennie).
4. **Application domain**:

   | Pole | Wartość |
   |---|---|
   | Subdomain | `budmax-wewnetrzny` |
   | Domain | `know-base.app` |
   | Path | **zostaw puste** |

   **Ścieżki celowo nie ustawiamy** — aplikacja ma objąć cały host. Na
   `budmax-wewnetrzny.know-base.app` nie ma niczego publicznego, więc nie ma
   czego zablokować, a `/internal` nie ma jak zostać poza ochroną.

   > To jest zmiana względem pierwotnego planu, w którym oba tryby dzieliły
   > jeden host, a Access ograniczał się do ścieżki `/internal`. Rozdzielenie
   > hostów usuwa cały ten rodzaj błędu — dlatego pole `Path` ma zostać puste.

5. **Identity providers**: zaznacz Google i Microsoft. Odznacz
   *Accept all available identity providers*, jeśli mają działać tylko te dwa.

---

## Krok 6. Ustaw regułę dostępu

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

## Krok 7. Przepisz AUD do konfiguracji Workera

1. Zero Trust → **Access → Applications** → otwórz utworzoną aplikację →
   zakładka **Overview**.
2. Skopiuj **Application Audience (AUD) Tag** — długi ciąg szesnastkowy.
3. Uzupełnij `wrangler.toml`:

   ```toml
   [vars]
   ACCESS_TEAM_DOMAIN = "knowbase.cloudflareaccess.com"
   ACCESS_AUD = "tu-wklej-aud-tag"
   ```

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

## Krok 8. Sprawdź, że działa

**Z przeglądarki** — wejdź na `https://budmax-wewnetrzny.know-base.app/internal`.
Powinno przekierować na ekran logowania Cloudflare z wyborem Google / Microsoft.
Po zalogowaniu zobaczysz odpowiedź Workera (dla GET będzie to `405 Method not
allowed` — to dobrze, znaczy że Access przepuścił i zadziałał Worker).

Sprawdź też **hosta publicznego**: `https://budmax.know-base.app/` **nie może**
poprosić o logowanie. Jeśli prosi, aplikacja Access została zbudowana na złej
subdomenie.

**Z terminala** — trzy przypadki, które muszą wypaść dokładnie tak:

```bash
# 1. bez tokenu → 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://budmax-wewnetrzny.know-base.app/internal \
  -H "Content-Type: application/json" -d '{"question":"Jaka jest marza?"}'

# 2. z podrobionym tokenem → 401
curl -s -X POST https://budmax-wewnetrzny.know-base.app/internal \
  -H "Content-Type: application/json" \
  -H "Cf-Access-Jwt-Assertion: aaa.bbb.ccc" \
  -d '{"question":"Jaka jest marza?"}'

# 3. dawny sekret administracyjny → 401 (ma już NIE działać)
curl -s -X POST "https://budmax-wewnetrzny.know-base.app/internal?key=TWOJ_SEKRET" \
  -H "Content-Type: application/json" -d '{"question":"Jaka jest marza?"}'
```

**Z ważnym tokenem** — zaloguj się w przeglądarce, skopiuj z DevTools
ciasteczko `CF_Authorization` i:

```bash
curl -s -X POST https://budmax-wewnetrzny.know-base.app/internal \
  -H "Content-Type: application/json" \
  -H "Cookie: CF_Authorization=WKLEJ_TU" \
  -d '{"question":"Jaka jest standardowa marza na robocizne?"}'
```

Odpowiedź powinna zawierać treść z `INTERNAL_CHUNKS` oraz pole
`zalogowany` z Twoim adresem e-mail i domeną.

---

## Co robić, gdy nie działa

| Objaw | Przyczyna | Co zrobić |
|---|---|---|
| `503` i lista brakujących zmiennych | `ACCESS_TEAM_DOMAIN` / `ACCESS_AUD` puste | Krok 7 |
| `401 Brak tokenu` mimo zalogowania | Access nie obejmuje tego hosta | Sprawdź *Application domain* — subdomena ma być `budmax-wewnetrzny`, `Path` puste (krok 5) |
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
