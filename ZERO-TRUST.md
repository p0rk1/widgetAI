# Konfiguracja Cloudflare Zero Trust Access dla trybu wewnętrznego

Instrukcja do wyklikania w panelu. Kod Workera jest już gotowy i wdrożony —
brakuje mu tylko dwóch wartości (`ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`), które
powstają dopiero przy tworzeniu aplikacji w Zero Trust.

Dopóki ich nie ma, `/internal` zwraca **503 z wyjaśnieniem, czego brakuje** —
to celowe, nie awaria.

---

## Zanim zaczniesz — jeden warunek, który może zablokować całość

**Access nie obejmuje adresów `*.workers.dev`.** Aplikacje typu *Self-hosted*
buduje się z domen, które masz w swoim koncie Cloudflare, a `workers.dev` do
nich nie należy. Worker chodzi dziś wyłącznie pod
`knowbase-budmax.rezi7608.workers.dev`, więc **potrzebna jest własna domena
podpięta do Cloudflare** — inaczej etapu 2 nie da się dokończyć.

Jeśli domeny nie ma, są dwie drogi:
- kupić dowolną i przenieść jej DNS do Cloudflare (plan darmowy wystarcza),
- albo odłożyć etap 2 i zostawić `/internal` w stanie 503 — publiczny widget
  działa niezależnie i nic na tym nie traci.

Reszta instrukcji zakłada, że domena jest. Poniżej występuje jako
`twojadomena.pl`, a adres bota jako `bot.twojadomena.pl`.

> Nazwy pól w panelach Cloudflare, Google i Microsoft bywają zmieniane między
> wydaniami. Wartości, które faktycznie mają znaczenie (adres przekierowania,
> uprawnienia, AUD), są niżej wypisane wprost — jeśli etykieta się nie zgadza,
> szukaj pola o tym znaczeniu, nie o tej nazwie.

---

## Krok 1. Włącz Zero Trust i ustal nazwę zespołu

1. Panel Cloudflare → **Zero Trust** (lewa kolumna).
2. Przy pierwszym wejściu kreator poprosi o **nazwę zespołu** (*team name*).
   Wpisz np. `budmax`. Nazwa jest trwała i trudna do zmiany.
3. Wybierz plan **Free** (do 50 użytkowników — mieści się w profilu klienta).
4. Zanotuj powstały adres zespołu: `budmax.cloudflareaccess.com`.

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
   https://budmax.cloudflareaccess.com/cdn-cgi/access/callback
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
   https://budmax.cloudflareaccess.com/cdn-cgi/access/callback
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

## Krok 4. Nadaj Workerowi własny adres

Bez tego Access nie ma czego chronić.

1. Panel Cloudflare → **Workers & Pages → knowbase-budmax → Settings → Domains & Routes**.
2. **Add → Custom Domain** → `bot.twojadomena.pl` → zapisz.
   Cloudflare sam doda rekord DNS.
3. **Natychmiast dopisz to samo do `wrangler.toml`**, inaczej najbliższy
   `wrangler deploy` zdejmie domenę (ten plik jest źródłem prawdy):

   ```toml
   [[routes]]
   pattern = "bot.twojadomena.pl"
   custom_domain = true
   ```

4. Sprawdź, że adres odpowiada:

   ```
   curl -i https://bot.twojadomena.pl/internal -X POST -d '{"question":"test"}'
   ```

   Oczekiwane teraz: **401** (brak tokenu) albo **503** (jeśli zmienne wciąż puste).

Publiczny widget zostaje na `workers.dev` i nic się dla niego nie zmienia.

---

## Krok 5. Utwórz aplikację Access

1. Zero Trust → **Access → Applications → Add an application → Self-hosted**.
2. **Application name**: `KnowBase — tryb wewnętrzny`.
3. **Session Duration**: `24 hours` (pracownik loguje się raz dziennie).
4. **Application domain** — i to jest miejsce, w którym łatwo o kosztowny błąd:

   | Pole | Wartość |
   |---|---|
   | Subdomain | `bot` |
   | Domain | `twojadomena.pl` |
   | Path | `internal` |

   **Ścieżka musi być ustawiona.** Bez niej Access obejmie cały host, w tym `/`,
   i zażąda logowania od publicznego widgetu, gdybyś kiedyś przeniósł go na tę
   domenę.
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
   ACCESS_TEAM_DOMAIN = "budmax.cloudflareaccess.com"
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

**Z przeglądarki** — wejdź na `https://bot.twojadomena.pl/internal`. Powinno
przekierować na ekran logowania Cloudflare z wyborem Google / Microsoft.
Po zalogowaniu zobaczysz odpowiedź Workera (dla GET będzie to `405` — to dobrze,
znaczy że Access przepuścił i zadziałał Worker).

**Z terminala** — trzy przypadki, które muszą wypaść dokładnie tak:

```bash
# 1. bez tokenu → 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://bot.twojadomena.pl/internal \
  -H "Content-Type: application/json" -d '{"question":"Jaka jest marza?"}'

# 2. z podrobionym tokenem → 401
curl -s -X POST https://bot.twojadomena.pl/internal \
  -H "Content-Type: application/json" \
  -H "Cf-Access-Jwt-Assertion: aaa.bbb.ccc" \
  -d '{"question":"Jaka jest marza?"}'

# 3. dawny sekret administracyjny → 401 (ma już NIE działać)
curl -s -X POST "https://bot.twojadomena.pl/internal?key=TWOJ_SEKRET" \
  -H "Content-Type: application/json" -d '{"question":"Jaka jest marza?"}'
```

**Z ważnym tokenem** — zaloguj się w przeglądarce, skopiuj z DevTools
ciasteczko `CF_Authorization` i:

```bash
curl -s -X POST https://bot.twojadomena.pl/internal \
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
| `401 Brak tokenu` mimo zalogowania | Access nie obejmuje tej ścieżki | Sprawdź *Application domain* — subdomena, domena i path (krok 5) |
| `401 Token wystawiony dla innej aplikacji` | AUD z innej aplikacji Access | Przepisz AUD z właściwej aplikacji (krok 7) |
| `401 Token wystawiony przez inny zespół` | Literówka w `ACCESS_TEAM_DOMAIN` | Ma być pełny host `nazwa.cloudflareaccess.com`, bez `https://` |
| `502 Nie udało się pobrać kluczy` | Zła nazwa zespołu albo chwilowa awaria | Sprawdź `https://NAZWA.cloudflareaccess.com/cdn-cgi/access/certs` w przeglądarce |
| Domena przestała działać po deployu | Custom domain nie ma go w `wrangler.toml` | Krok 4, punkt 3 |
| Logowanie wraca błędem `redirect_uri_mismatch` | Zły adres przekierowania u dostawcy | Musi być `https://ZESPOL.cloudflareaccess.com/cdn-cgi/access/callback` |

---

## Co ta konfiguracja zmienia w uprawnieniach

| Endpoint | Kto ma dostęp | Czym się uwierzytelnia |
|---|---|---|
| `POST /` | każdy | — (publiczny widget) |
| `POST /internal` | pracownik z reguły Access | tożsamość Google / Microsoft |
| `/reindex`, `/purge`, `/stats`, `/debug` | administrator | `REINDEX_SECRET` |

Sedno etapu 2: **pracownik przestał dzielić sekret z administratorem.** Kto ma
dostęp do bota, nie ma już prawa skasować indeksu.
