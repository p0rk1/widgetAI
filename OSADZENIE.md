# Osadzenie widgetu na stronie klienta

Dotyczy **wyłącznie widgetu publicznego** — tego, który odpowiada klientom
firmy na jej własnej stronie WWW. Bot pracowniczy i panele właściciela stoją na
osobnych hostach za Cloudflare Access i nie mają z tym dokumentem nic wspólnego
(`ZERO-TRUST.md`).

---

## Część I — linijka dla klienta

To jest wszystko, co dostaje klient. Jedna linijka, wklejona **raz**, gdziekolwiek
w kodzie strony — najlepiej tuż przed `</body>`.

### Wariant A — pływający dymek (domyślny, zero konfiguracji)

```html
<script src="https://budmax.know-base.app/widget.js" data-client="budmax" async></script>
```

Widget pokazuje się jako przycisk w prawym dolnym rogu, na każdej podstronie,
na której ta linijka się znajdzie. Nic więcej nie trzeba robić.

Lewy róg zamiast prawego: `data-kb-position="left"`.

### Wariant B — osadzony w treści strony

Dwa kroki. Najpierw pusty element w miejscu, w którym widget ma stanąć:

```html
<div data-knowbase></div>
```

Potem ta sama linijka co wyżej, plus `data-kb-mode="inline"`:

```html
<script src="https://budmax.know-base.app/widget.js" data-client="budmax"
        data-kb-mode="inline" async></script>
```

Widget wypełni szerokość elementu, w którym stanął. Jeśli miejsce docelowe ma już
własny identyfikator, można wskazać je selektorem zamiast atrybutu:
`data-kb-target="#pomoc"`.

### Atrybuty — komplet

| Atrybut | Wartości | Domyślnie | Do czego |
|---|---|---|---|
| `data-client` | id klienta | — | **asercja**, nie wybór; patrz niżej |
| `data-kb-mode` | `bubble` / `inline` | `bubble` | wariant osadzenia |
| `data-kb-position` | `right` / `left` | `right` | róg, w którym siedzi dymek |
| `data-kb-target` | selektor CSS | `[data-knowbase]` | gdzie osadzić w wariancie `inline` |
| `data-kb-fonts` | `on` / `off` | `on` | czy dociągać krój z Google Fonts |

**`data-client` nie wybiera klienta.** Klienta wybiera **adres w `src`** — to on
prowadzi do konkretnej firmy i jej dokumentacji. Atrybut jest sprawdzeniem: jeśli
nie zgadza się z adresem, widget nie uruchamia się i mówi o tym w konsoli
przeglądarki. Łapie najczęstszą pomyłkę przy wdrożeniu — snippet skopiowany od
innego klienta, w którym poprawiono nazwę, a zapomniano o adresie. Wolno go
pominąć; wtedy nie ma czego sprawdzać.

### Zaczepienie widgetu z własnego przycisku (opcjonalne)

Widget wystawia trzy funkcje. Nic poza nimi nie jest publiczne — reszta siedzi
w drzewie cienia i celowo jest nieosiągalna.

```html
<button onclick="KnowBase.ask('Ile trwa budowa domu?')">Zapytaj asystenta</button>
<button onclick="KnowBase.open()">Otwórz czat</button>
```

---

## Część II — co klient musi zrobić po swojej stronie

Trzy rzeczy, z których **realna jest tylko pierwsza**. Pozostałe dwie dotyczą
części firm.

### 1. Wkleić linijkę i podać nam adres strony (zawsze)

Adres podaje się jako **origin**: `https://firma.pl`. Bez ścieżki, bez ukośnika
na końcu. Jeśli strona odpowiada i pod `firma.pl`, i pod `www.firma.pl`, to są
**dwa różne originy** i trzeba podać oba.

Bez tego kroku widget się pokaże, ale nie dostanie odpowiedzi: przeglądarka
zablokuje ją, bo domena nie jest u nas zarejestrowana. Objawia się to jako
komunikat o braku połączenia z asystentem.

**Nakład: 5 minut.** W WordPressie, Wixie czy Squarespace jest to pole
„własny kod w stopce" — nie wymaga programisty.

### 2. Dopisać nas do polityki bezpieczeństwa treści (tylko jeśli ją ma)

Większość stron małych firm nie ma nagłówka `Content-Security-Policy`. Jeśli ma
(pyta o to zwykle informatyk klienta), potrzebne są cztery wpisy:

```
script-src  https://budmax.know-base.app
connect-src https://budmax.know-base.app
style-src   'unsafe-inline' https://fonts.googleapis.com
font-src    https://fonts.gstatic.com
```

Dwa ostatnie odpadają, jeśli klient ustawi `data-kb-fonts="off"` — widget zejdzie
wtedy na kroje systemowe i nie sięgnie po nic z zewnątrz.

`style-src 'unsafe-inline'` jest potrzebny, bo arkusz widgetu jest wstrzykiwany
do drzewa cienia. Nie dotyczy stylów strony klienta — cień jest szczelny w obie
strony.

### 3. Zgoda na cookies — nie dotyczy

Widget **nie ustawia żadnych ciasteczek** i nie zapisuje niczego w przeglądarce.
Historia rozmowy żyje w pamięci karty i znika po jej zamknięciu. Nie ma go
z czego zwalniać w bannerze zgód.

Odrębną kwestią jest to, że pytania trafiają do naszego logu — to należy do
umowy powierzenia danych, nie do konfiguracji strony.

---

## Część III — co robimy my przy każdym wdrożeniu

Jeden krok w kodzie. Powtarzalny, bo powtarza się przy każdym kliencie.

### 1. Dopisz witryny klienta do `klienci.js`

```js
witryny: [
  "https://firma.pl",
  "https://www.firma.pl",
],
```

**To jest cała zmiana.** `ALLOWED_ORIGINS` składa się z tej tablicy samo —
nie ma tam czego dopisywać ręcznie.

Reguły, których nie wolno rozluźnić:
- **Origin, nie adres strony.** `https://firma.pl/kontakt` i `https://firma.pl/`
  nigdy nie zrównają się z nagłówkiem `Origin`, a błąd wyjdzie dopiero jako
  milcząco zablokowane żądanie na stronie klienta. Pilnuje tego asercja przy
  starcie modułu — literówka wywala `wrangler deploy --dry-run`.
- **`www` to osobny origin.** Jeśli strona odpowiada pod oboma, oba muszą tu być.
- **Nie wpisuj tu domeny, której klient nie kontroluje.** Wpis w tym polu to
  zgoda na wywoływanie jego widgetu z tego adresu.

### 2. Wdróż i sprawdź

```
node test-widget.mjs
wrangler deploy --dry-run
wrangler deploy
curl -si "https://budmax.know-base.app/widget.js?cb=$RANDOM" | head -1     # 200
curl -si "https://budmax-pracownik.know-base.app/widget.js?cb=$RANDOM" | head -1  # 404
```

Drugi `curl` jest istotny: skrypt osadzający stoi **wyłącznie na hoście
publicznym**. Gdyby odpowiadał na hoście pracowniczym, powstałby snippet
prowadzący pod adres za Access — czyli taki, którego gość strony klienta i tak
by nie pobrał.

`?cb=$RANDOM` jest obowiązkowe — Cloudflare buforuje na brzegu, a sam skrypt ma
dodatkowo `Cache-Control: max-age=300`.

### 3. Sprawdź na żywo na stronie klienta

- widget się pokazuje i odpowiada,
- konsola przeglądarki jest czysta (brak błędu CORS, brak błędu `data-client`),
- strona klienta wygląda tak samo jak przed wklejeniem linijki.

### Bufor — pięć minut

Zmiana motywu, tekstów albo pytań startowych rozchodzi się do gości strony
klienta **do pięciu minut**. Jeśli sprawdzasz zmianę zaraz po wdrożeniu i widzisz
starą wersję, to jest bufor, nie błąd.

---

## Czego widget NIE robi — świadome granice

- **Nie działa bez Shadow DOM v1** (przeglądarki starsze niż ~2016). Wtedy
  wypisuje ostrzeżenie w konsoli i nie montuje się w ogóle. Wariant „zamontuj bez
  izolacji" byłby gorszy od nieuruchomienia się: widget wyglądałby losowo na
  cudzej stronie, a my nie mielibyśmy o tym pojęcia.
- **Nie przenosi stylów strony klienta do środka i odwrotnie.** Jedynym zasobem,
  który trafia poza drzewo cienia, jest arkusz Google Fonts w `<head>` — bo
  `@font-face` zadeklarowany wewnątrz cienia nie jest przez przeglądarkę
  rejestrowany. Wyłącza to `data-kb-fonts="off"`.
- **Nie zapamiętuje rozmowy** między wejściami na stronę.
- **Nie ma trybu pracowniczego.** Ten stoi za Access, na osobnym adresie, i nie
  da się go osadzić na stronie WWW — celowo.
