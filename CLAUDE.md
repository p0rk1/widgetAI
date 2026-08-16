# KnowBase — kontekst projektu

## Czym to jest

Bot FAQ oparty na RAG, odpowiadający wyłącznie na podstawie dokumentacji firmy —
nigdy nie zmyślając. Jeden z trzech produktów lokalnego SaaS-u dla polskich MŚP
(do ~50 osób). Pozostałe dwa robią wspólnicy: BizChat (Bartek — czat z rezerwacjami),
MailPilot (Michał — wtyczka do Gmaila/Outlooka, opublikowana w sklepie Microsoftu).

Aktualny stan: działające demo na fikcyjnej firmie budowlanej **BudMax Sp. z o.o.**

## Pliki

| Plik | Co to | Gdzie żyje |
|---|---|---|
| `worker.js` | Backend — RAG, weryfikacja, endpointy | Cloudflare Worker `knowbase-budmax` |
| `index.html` | Strona firmy z osadzonym widgetem | GitHub Pages |
| `panel.html` | Panel analityczny dla właściciela firmy | GitHub Pages |

Adresy:
- Worker: `https://knowbase-budmax.rezi7608.workers.dev`
- Strona: `https://p0rk1.github.io/widgetAI/`
- Panel: `https://p0rk1.github.io/widgetAI/panel.html`

## Infrastruktura (Cloudflare, plan darmowy)

Bindingi Workera — **wszystkie cztery są wymagane**:
- `AI` → Workers AI
- `RATE_LIMIT_KV` → KV Namespace (rate limit + log pytań)
- `VECTORIZE` → indeks `budmax-knowledge` (1024 wymiary, cosine)
- `REINDEX_SECRET` → Secret (klucz endpointów administracyjnych)

`REINDEX_SECRET` ustawia się poza kodem: `wrangler secret put REINDEX_SECRET`
albo Worker → Settings → Variables → Add secret. **Nigdy w repo — jest publiczne.**
Bez ustawionego sekretu endpointy administracyjne zwracają 403 (fail-closed).

Modele:
- Generowanie: `@cf/meta/llama-3.1-8b-instruct-fast`
- Embeddingi: `@cf/baai/bge-m3` (1024 wymiary — musi zgadzać się z indeksem)

**Uwaga:** katalog modeli Cloudflare zmienia się bez uprzedzenia. Jeśli Worker
zwraca błąd połączenia z modelem, najpierw sprawdź
`https://developers.cloudflare.com/workers-ai/models/` czy model nie został wycofany.

## Endpointy

Wszystkie administracyjne chronione parametrem `?key=` równym sekretowi
`REINDEX_SECRET` — sprawdza to `isAdmin()`, jedno miejsce dla wszystkich czterech.

- `POST /` — zapytanie z widgetu: `{question, history}`
- `GET /reindex?key=…` — **uruchom po każdej zmianie CHUNKS**, inaczej indeks jest nieaktualny
- `GET /stats?key=…` — dane dla panelu
- `GET /debug?key=…&q=pytanie` — diagnostyka: co znalazło, z jakim wynikiem, które zdania przechodzą weryfikację
- `GET /purge?key=…&ids=c01,c02` — usuwa wpisy z indeksu

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

## Decyzje, do których nie wracać

- **Prawdziwy streaming SSE — wycofany.** Cloudflare buforował odpowiedź mimo
  `Content-Encoding: identity`, a weryfikacja po stronie serwera i tak wymaga całego
  tekstu. Zamiast tego animacja znak po znaku w przeglądarce (`typewriterReveal`).
- **Fine-tuning na dokumentach klienta — nie.** Zwiększa halucynacje, wymaga powtórzenia
  przy każdej zmianie cennika, miesza wiedzę klientów. RAG jest właściwą architekturą.
- **Ogród ≠ ogrodzenie** — rozdzielone strukturalnie: osobne fragmenty (`c42`, `c43`)
  z jawnym odsyłaczem do siebie nawzajem w treści, plus instrukcja w prompcie.
  Model 8B mylił je wielokrotnie.
- **Batching wszędzie** — Cloudflare ma limit 50 podzapytań na jedno wywołanie Workera.
  Reindeks idzie paczkami po 10, weryfikacja zdań jednym wywołaniem embeddingu.

## Dokumentacja BudMax

52 fragmenty w tablicy `CHUNKS`, oparte na realnych przepisach:
art. 568 §1 KC (rękojmia 5 lat / 2 lata), WT2021 (izolacyjność), KSeF (obowiązkowy
od kwietnia 2026), program Czyste Powietrze (kwoty dofinansowania).

**Rękojmia i gwarancja to dwie różne instytucje** — rękojmia jest ustawowa i obowiązuje
zawsze, gwarancja jest dobrowolna. Model 8B je mylił, stąd osobny fragment `c46`
tłumaczący różnicę.

Fragmenty zaczynają się od sformułowań, których używają pytający ("Gdzie działamy
i gdzie realizujemy budowy…"), nie tylko od języka oficjalnego dokumentu. To poprawia
trafność wyszukiwania i jest praktyką do powtórzenia u kolejnych klientów.

## Znane ograniczenia

- Model 8B generuje literówki po polsku ("z przyjemieniem") — do naprawy tylko przez
  większy model
- Wyniki wahają się między uruchomieniami przy tym samym pytaniu
- Wykrywanie obietnic wzorcami tekstowymi jest z natury zawodne — model wymyśla nowe
  sformułowania. Dokładanie kolejnych wzorców ma malejący zwrot.
- Panel chroni ten sam klucz co endpointy administracyjne — do produkcji potrzeba
  osobnego hasła i prawdziwego logowania

## Następne kroki

1. **Test 70B** (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`) — wymaga planu Workers Paid
   (5 USD/mies.). Zmiana to jedna stała `MODEL_ID`. Cel: sprawdzić ile problemów
   znika samo przy mocniejszym modelu, zamiast dokładać warstwy w ciemno.
2. **Druga branża** — kancelaria albo gabinet. Sprawdzenie, ile zabezpieczeń jest
   uniwersalnych, a ile to protezy pod budowlankę (wzorce mówią o rabatach
   w hurtowniach — u kancelarii groźne będą terminy przedawnienia i szanse wygranej).
3. **Bot dla pracowników** — drugi tryb: procedury BHP, kadry, instrukcje wykonania
   zadań. Ton instruktażowy, nie sprzedażowy. Wymaga prawdziwego logowania
   i twardej separacji od przestrzeni publicznej.
4. **Skrypt osadzający** — Shadow DOM, jedna linijka `<script>` do wklejenia na
   dowolnej stronie klienta, izolacja stylów w obie strony.
5. **Multi-tenant** — dopiero przy 2-3 płacących klientach: D1 z tabelą klientów,
   namespaces w Vectorize per klient.

## Zasady pracy nad tym projektem

- Po każdej zmianie `CHUNKS` → uruchom `/reindex`
- Przy zmianie progów → najpierw `/debug`, potem decyzja
- Przed commitem → `node --check worker.js`
- `ALLOWED_ORIGIN` to sama domena bez ścieżki (`https://p0rk1.github.io`),
  bo przeglądarka wysyła w nagłówku Origin tylko protokół i host
- Nie dodawać warstw zabezpieczeń bez zmierzenia problemu na `/debug` —
  projekt ma za sobą kilka rund łatania objawów zamiast przyczyn
