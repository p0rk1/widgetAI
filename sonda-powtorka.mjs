// sonda-powtorka.mjs — to samo pytanie N razy, żeby odróżnić WAHANIE MODELU
// od skutku zmiany w treści albo w kodzie.
//
// Uruchomienie:
//   node sonda-powtorka.mjs <REINDEX_SECRET> <klient> <public|internal> <N> "pytanie"
//
// Retrieval jest deterministyczny — zestaw fragmentów będzie ten sam w każdym
// przebiegu. Zmienia się wyłącznie generacja, więc rozrzut w kolumnie `luka`
// i `zdan` JEST miarą wahania modelu przy stałym kontekście.
//
// Reguła czytania wyniku: 0/N albo N/N to zachowanie stabilne i wtedy zmiana
// treści coś zrobiła. Cokolwiek pomiędzy oznacza, że pojedynczy przebieg
// niczego nie dowodził — ani przed zmianą, ani po niej.

const [KEY, KLIENT, SPACE, N, PYTANIE] = process.argv.slice(2);
if (!KEY || !KLIENT || !SPACE || !N || !PYTANIE) {
  console.error('Uzycie: node sonda-powtorka.mjs <SEKRET> <klient> <public|internal> <N> "pytanie"');
  process.exit(1);
}

const BAZA = "https://knowbase-budmax.rezi7608.workers.dev";
const FRAZA_ODMOWY = /nie mam takich informacji/i;
const NA_TY = /\b(Tw\w+|Ci|Cię|Ciebie|Tobie|Tobą)\b/;

console.log(`\nPytanie: ${PYTANIE}\nKlient: ${KLIENT} | przestrzeń: ${SPACE} | przebiegów: ${N}\n`);
console.log("nr  luka zdan wyc  ton  pierwsze zdanie odpowiedzi");

const luki = [];
for (let i = 1; i <= Number(N); i++) {
  const url = `${BAZA}/debug?key=${encodeURIComponent(KEY)}&klient=${encodeURIComponent(KLIENT)}` +
              `&space=${SPACE}&q=${encodeURIComponent(PYTANIE)}&cb=${Math.random().toString(36).slice(2)}`;
  const r = await fetch(url);
  const txt = await r.text();
  if (!r.ok) { console.log(`${String(i).padStart(2)}  HTTP ${r.status}: ${txt.slice(0, 90)}`); continue; }
  const d = JSON.parse(txt);
  const zdania = d.weryfikacja_zdan || [];
  const zachowane = zdania.filter((z) => z.akcja.startsWith("zachowane"));
  const faktyczne = zachowane.filter((z) => !z.grzecznosciowe);
  // Ta sama reguła co w sonda-klienta.mjs — odtworzenie ścieżki produkcyjnej.
  const luka = FRAZA_ODMOWY.test(d.odpowiedz || "") || faktyczne.length === 0;
  luki.push(luka);
  if (i === 1) {
    console.log("    fragmenty: " + (d.znalezione_fragmenty || [])
      .map((f) => `${f.wynik} ${f.tytul.slice(0, 30)}`).join(" | "));
  }
  console.log(
    `${String(i).padStart(2)}  ${luka ? "LUKA" : "  - "} ${String(zdania.length).padStart(4)} ` +
    `${String(zdania.length - zachowane.length).padStart(3)} ${NA_TY.test(d.odpowiedz || "") ? " ty " : "  - "} ` +
    `${(d.odpowiedz || "").split(/(?<=\.)\s/)[0].slice(0, 70)}`
  );
}

const n = luki.filter(Boolean).length;
console.log(`\nWYNIK: luka w ${n}/${luki.length} przebiegach — ` +
  (n === 0 || n === luki.length ? "zachowanie STABILNE" : "WAHANIE MODELU, pojedynczy przebieg nie dowodzi niczego"));
