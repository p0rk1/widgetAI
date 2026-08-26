// test-widget.mjs — skrypt osadzający: izolacja, konfiguracja, CORS.
//
// Warstwa jest deterministyczna (składanie tekstu i porównywanie originów),
// więc testuje się ją lokalnie, bez wywoływania modelu i bez sieci.
//
// CZEGO TEN TEST NIE OBEJMUJE: zachowania w przeglądarce. Nie sprawdza, czy
// Shadow DOM faktycznie odciął style cudzej strony — to wymaga silnika
// renderującego. Sprawdza REGUŁY, których złamanie by to zepsuło: obecność
// `all:initial`, brak wartości barwnych w pliku szablonu i to, że motyw
// przychodzi z konfiguracji, a nie z kopii palety.

import { readFileSync } from "node:fs";
import {
  renderWidget, konfiguracjaWidgetu, witrynyKlienta, corsHeaders,
  zmienneMotywu, ALLOWED_ORIGINS,
} from "./worker.js";
import { KLIENCI } from "./klienci.js";

let zdane = 0, oblane = 0;
const ok = (w, opis) => {
  if (w) { zdane++; console.log(`OK   ${opis}`); }
  else { oblane++; console.log(`BŁĄD ${opis}`); }
};
const sekcja = (t) => console.log(`\n--- ${t} ---`);

const ZRODLO = readFileSync(new URL("./widget-embed.js", import.meta.url), "utf8");
const KLIENCI_LISTA = Object.values(KLIENCI);

// ============================================================
sekcja("1. Skrypt renderuje się i parsuje dla każdego klienta");

for (const k of KLIENCI_LISTA) {
  const js = renderWidget(k);
  ok(!/\{\{\w+\}\}/.test(js), `${k.id}: brak surowych {{placeholderów}}`);
  let parsuje = true;
  try { new Function(js); } catch { parsuje = false; }
  ok(parsuje, `${k.id}: skrypt jest poprawnym JavaScriptem`);
  ok(js.includes(`"klient":"${k.id}"`) || js.includes(`"klient": "${k.id}"`),
    `${k.id}: konfiguracja niesie id klienta`);
}

// ============================================================
sekcja("2. Izolacja stylów — reguły, bez których Shadow DOM nie wystarcza");

// Shadow DOM NIE zatrzymuje dziedziczenia: font-family, color, line-height
// i letter-spacing ze strony klienta przechodzą przez granicę cienia.
// `all:initial` na :host jest jedyną rzeczą, która je odcina.
ok(/:host\{all:initial/.test(ZRODLO), "`:host{all:initial` jest w arkuszu");
ok(ZRODLO.includes("attachShadow({ mode:"), "widget montuje się w drzewie cienia");
ok(/box-sizing:border-box/.test(ZRODLO),
  "widget ustawia własny box-sizing (reguła `*` strony nie przenika)");

// Bez tego progu widget zamontowałby się bez izolacji i wyglądałby losowo
// na cudzej stronie, a my nie mielibyśmy o tym pojęcia.
ok(ZRODLO.includes("Shadow DOM v1"), "jest próg możliwości przeglądarki z komunikatem");

// position:fixed wewnątrz przodka z transform przestaje być względne do okna.
ok(/document\.body \|\| document\.documentElement/.test(ZRODLO),
  "dymek wisi na <body>, nie w miejscu tagu skryptu");

// ============================================================
sekcja("3. Zero wartości barwnych i zero backticków w szablonie");

// Ta sama reguła, co w plikach interfejsu od 24.08.2026: ręcznie pisana lista
// podmian przepuściła wtedy trzy kolory, więc sprawdza się wzorcem.
const TRESC_SZABLONU = ZRODLO.slice(ZRODLO.indexOf("String.raw"));
const KOLORY = TRESC_SZABLONU.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/g) || [];
ok(KOLORY.length === 0, `brak wartości barwnych w szablonie (znaleziono: ${KOLORY.join(", ") || "0"})`);

// Odwrócony apostrof zamyka literał, a `node --check` tego nie widzi — plik
// jest sprawdzany jako skrypt, nie jako moduł ES. Czwarty taki przypadek
// w projekcie; ten wyszedł dopiero przy `import`.
const wnetrze = TRESC_SZABLONU.slice(TRESC_SZABLONU.indexOf("`") + 1, TRESC_SZABLONU.lastIndexOf("`"));
ok(!wnetrze.includes("`"), "brak odwróconych apostrofów w treści szablonu, także w komentarzach");

// ============================================================
sekcja("4. Motyw przychodzi z konfiguracji, nie z kopii palety");

for (const k of KLIENCI_LISTA) {
  const cfg = konfiguracjaWidgetu(k);
  ok(cfg.zmienne === zmienneMotywu(k), `${k.id}: widget dostaje TE SAME tokeny, co interfejsy`);
  ok(cfg.zmienne.includes(k.motyw.kolory.hi), `${k.id}: kolor akcentu jest w konfiguracji`);
  ok(!TRESC_SZABLONU.includes(k.motyw.kolory.hi), `${k.id}: koloru akcentu NIE ma w szablonie`);
}

// Motywy muszą się różnić — inaczej test wyżej niczego nie dowodzi.
ok(zmienneMotywu(KLIENCI.budmax) !== zmienneMotywu(KLIENCI.kancelaria),
  "motywy obu klientów są różne");

// ============================================================
sekcja("5. Teksty są branżowe i nie wyciekają między klientami");

const OBCE = {
  budmax: ["kancelar", "adwokat", "sprawy", "zaremba"],
  kancelaria: ["budow", "rusztowan", "budmax", "zbrojen"],
};
for (const k of KLIENCI_LISTA) {
  const cfg = JSON.stringify(konfiguracjaWidgetu(k)).toLowerCase();
  for (const slowo of OBCE[k.id] || []) {
    ok(!cfg.includes(slowo), `${k.id}: brak słowa „${slowo}" z cudzej branży`);
  }
}

// Powitanie kancelarii musi mówić, czego bot NIE robi — to najgroźniejszy
// błąd tej branży i pierwsze zdanie, jakie widzi gość strony.
ok(/nie udzielam porad|nie oceniam szans/i.test(KLIENCI.kancelaria.ui.widget.powitanie),
  "kancelaria: powitanie zastrzega, że to nie jest porada prawna");

// ============================================================
sekcja("6. Endpoint bierze się z hosta publicznego klienta");

for (const k of KLIENCI_LISTA) {
  const cfg = konfiguracjaWidgetu(k);
  ok(cfg.endpoint === `https://${k.hosty.publiczny}/`, `${k.id}: endpoint to host publiczny`);
  ok(!cfg.endpoint.includes("workers.dev"), `${k.id}: endpoint nie prowadzi na workers.dev`);
}

// ============================================================
sekcja("7. data-client jest ASERCJĄ, nie selektorem klienta");

// Gdyby był selektorem, byłby dokładnie tym, co ta architektura odrzuciła
// 22.08.2026: nazwą klienta przychodzącą z żądania.
ok(ZRODLO.includes('attr("data-client", null)'), "skrypt czyta data-client");
ok(/deklarowany !== CFG\.klient/.test(ZRODLO), "porównuje go z konfiguracją z Workera");
ok(/console\.error[\s\S]{0,400}nie zgadza/.test(ZRODLO), "przy niezgodności krzyczy i nie startuje");
// Nigdzie nie wybiera po nim treści ani endpointu:
ok(!/CFG\[\s*deklarowany/.test(ZRODLO) && !/klient\s*=\s*deklarowany/.test(ZRODLO),
  "data-client nie wybiera niczego");

// ============================================================
sekcja("8. Warianty osadzenia");

ok(/data-kb-mode/.test(ZRODLO), "wariant wybiera atrybut data-kb-mode");
ok(/"inline" : "bubble"|=== "inline"/.test(ZRODLO), "są dokładnie dwa warianty: bubble i inline");
ok(/\[data-knowbase\]/.test(ZRODLO), "wariant osadzony ma domyślny cel [data-knowbase]");
ok(/data-kb-target/.test(ZRODLO), "cel da się nadpisać selektorem");
ok(/Nie znaleziono elementu/.test(ZRODLO), "brak celu jest błędem w konsoli, nie ciszą");

// ============================================================
sekcja("9. CORS — witryny są ORIGINAMI i nie mieszają się między klientami");

const naglowek = (origin, klient) =>
  corsHeaders({ headers: { get: (n) => (n === "Origin" ? origin : null) } }, klient)["Access-Control-Allow-Origin"];

for (const k of KLIENCI_LISTA) {
  for (const w of k.witryny || []) {
    ok(/^https:\/\/[^/?#]+$/.test(w), `${k.id}: „${w}" jest originem (bez ścieżki i ukośnika)`);
    ok(naglowek(w, k) === w, `${k.id}: własna witryna „${w}" dostaje swój origin`);
  }
  ok(naglowek(`https://${k.hosty.publiczny}`, k) === `https://${k.hosty.publiczny}`,
    `${k.id}: własny host publiczny przechodzi`);
}

// Sedno zawężenia: strona jednego klienta nie odpytuje widgetu drugiego.
const obcaWitryna = "https://p0rk1.github.io";  // witryna BudMaksu
ok(witrynyKlienta(KLIENCI.budmax).includes(obcaWitryna), "kontrola: to naprawdę witryna BudMaksu");
ok(naglowek(obcaWitryna, KLIENCI.kancelaria) !== obcaWitryna,
  "witryna BudMaksu NIE dostaje zgody na hoście kancelarii");
ok(naglowek(`https://${KLIENCI.budmax.hosty.publiczny}`, KLIENCI.kancelaria) !== `https://${KLIENCI.budmax.hosty.publiczny}`,
  "host publiczny BudMaksu NIE dostaje zgody na hoście kancelarii");

// Nieznany origin ma dostać NIE swój adres — odmowa wychodzi w przeglądarce,
// nigdy nie zamienia się w ciche zezwolenie.
ok(naglowek("https://zlodziej.example", KLIENCI.budmax) !== "https://zlodziej.example",
  "nieznany origin nie dostaje zgody");
ok(naglowek("", KLIENCI.budmax) !== "", "brak nagłówka Origin nie daje pustej zgody");

// Vary: Origin — bez tego pośrednik podałby jednemu klientowi odpowiedź
// zbuforowaną dla drugiego.
ok(corsHeaders({ headers: { get: () => null } }, KLIENCI.budmax)["Vary"] === "Origin",
  "odpowiedź jest oznaczona Vary: Origin");

// Lista globalna (endpointy bez klienta) musi zawierać wszystkie witryny.
for (const k of KLIENCI_LISTA) {
  for (const w of k.witryny || []) {
    ok(ALLOWED_ORIGINS.includes(w), `ALLOWED_ORIGINS zna witrynę „${w}"`);
  }
}

// ============================================================
sekcja("10. Fonty — jedyny zasób poza cieniem, i da się go wyłączyć");

// @font-face zadeklarowany wewnątrz drzewa cienia nie jest rejestrowany,
// więc arkusz musi wisieć w <head>. To jedyny wyjątek od izolacji.
ok(/data-kb-fonts/.test(ZRODLO), "atrybut data-kb-fonts istnieje");
ok(/document\.head\.appendChild\(link\)/.test(ZRODLO), "arkusz fontów ląduje w <head> strony");
ok(/data-knowbase-fonts/.test(ZRODLO), "arkusz jest oznaczony i nie dokłada się dwa razy");
for (const k of KLIENCI_LISTA) {
  ok(konfiguracjaWidgetu(k).fontyUrl === k.motyw.fontyUrl, `${k.id}: adres fontów z motywu klienta`);
}

// ============================================================
sekcja("11. Jeden widget na stronę");

ok(/__knowbase_/.test(ZRODLO) && /if \(window\[FLAGA\]\) return/.test(ZRODLO),
  "drugi tag skryptu tego samego klienta nie dokłada drugiego widgetu");

// ============================================================
console.log(`\n---\nzdane: ${zdane}, oblane: ${oblane}`);
process.exit(oblane === 0 ? 0 : 1);
