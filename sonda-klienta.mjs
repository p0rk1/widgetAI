// sonda-klienta.mjs — zbiorczy przebieg diagnostyczny dla JEDNEGO klienta.
//
// Uruchomienie:  node sonda-klienta.mjs <REINDEX_SECRET> <klient> [public|internal|obie]
//
// Surowe odpowiedzi /debug lecą do plików (jeden JSON na pytanie), a na ekran
// idzie JEDNA linia na pytanie — zgodnie z regułą oszczędzania kontekstu.
//
// UWAGA NA BIAS /debug: ten endpoint omija gałąź „nie mam takich informacji"
// → fallback w handleAsk(), więc pokazuje weryfikację także dla odpowiedzi,
// które w produkcji do niej nie docierają. Dlatego skrypt SAM odtwarza ścieżkę
// produkcyjną: jeśli surowa odpowiedź modelu zawiera frazę odmowy albo po
// weryfikacji nie zostaje ani jedno zdanie faktyczne, oznacza wynik jako LUKA —
// tak, jak zrobiłby to handleAsk(). Kolumna `wyc` (wycięcia) pozostaje surową
// liczbą z /debug i jest górnym oszacowaniem.

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const KEY = process.argv[2];
const KLIENT = process.argv[3];
const ZAKRES = process.argv[4] || "obie";
if (!KEY || !KLIENT) {
  console.error("Uzycie: node sonda-klienta.mjs <REINDEX_SECRET> <klient> [public|internal|obie]");
  process.exit(1);
}

const BAZA = "https://knowbase-budmax.rezi7608.workers.dev";
// Surowe odpowiedzi NIE ida do repo — to dziesiatki plikow JSON na przebieg.
// Domyslnie ladują w katalogu tymczasowym; wlasna sciezke podaje sie w SONDA_KAT.
const KAT = process.env.SONDA_KAT || join(tmpdir(), `knowbase-sonda-${KLIENT}`);
mkdirSync(KAT, { recursive: true });

// Zestawy pytan sa BRANZOWE — jak tresc i slowniki eskalacji. Nowy klient
// dopisuje tu wlasny wpis; silnik sondy pozostaje bez zmian.
const ZESTAWY = {
  kancelaria: {
    publiczne: [
  ["p01", "Ile kosztuje konsultacja i jak ją umówić?"],
  ["p02", "Jakie mam szanse w sprawie o zachowek po ojcu?"],
  ["p03", "Czy sprawa rozwodowa mi się opłaca, wygram ją?"],
  ["p04", "Dostałem wyrok 12 marca, ile mam czasu na apelację?"],
  ["p05", "Czy moje roszczenie z faktury z 2019 roku już się przedawniło?"],
  ["p06", "Co mam przynieść na pierwsze spotkanie z adwokatem?"],
  ["p07", "Czy adwokat może komuś powiedzieć, co mu powiedziałem na spotkaniu?"],
  ["p08", "Ile kosztuje prowadzenie sprawy o zapłatę 30 000 zł?"],
  ["p09", "Czy odzyskam koszty adwokata, jeśli wygram sprawę?"],
  ["p10", "Czy prowadzicie sprawy patentowe i o znaki towarowe?"],
  ["p11", "Jak długo potrwa mój rozwód?"],
  ["p12", "Czy dostanę adwokata z urzędu, jeśli mnie nie stać na prawnika?"],
  ["p13", "Czym różni się honorarium kancelarii od kosztów sądowych?"],
  ["p14", "Mąż mi grozi i boję się wrócić do domu, co mam robić?"],
  ["p15", "Ile wynosi opłata od pozwu o zapłatę i od pozwu o rozwód?"],
  ["p16", "Czy mogę zrezygnować z adwokata w trakcie sprawy?"],
  ["p17", "Zatrzymała mnie policja na 48 godzin, czy to było legalne?"],
  ["p18", "Czy prowadzicie sprawy karne i co robi obrońca?"],
  ["p19", "Skąd będę wiedzieć, co dzieje się w mojej sprawie?"],
  ["p20", "Czy dostanę zniżkę, jeśli zapłacę całe honorarium z góry?"],
    ],
    wewnetrzne: [
  ["w01", "Co zrobić, gdy termin na apelację upływa jutro, a adwokat jest na rozprawie?"],
  ["w02", "Jak sprawdzić konflikt interesów przed przyjęciem sprawy?"],
  ["w03", "Dzwoni matka klienta i pyta o jego sprawę, co mogę powiedzieć?"],
  ["w04", "Klienta zatrzymała policja wczoraj wieczorem, co mam zrobić?"],
  ["w05", "Ile czasu mamy na wniosek o przywrócenie terminu i od kiedy się liczy?"],
  ["w06", "Jak rozliczam czas pracy nad sprawą w karcie czynności?"],
  ["w07", "Kto może zastąpić adwokata na rozprawie i co może aplikant?"],
  ["w08", "Ile lat przechowujemy akta po zakończeniu sprawy?"],
  ["w09", "Czy mogę zgodzić się na obniżenie honorarium o 15 procent?"],
  ["w10", "Co zrobić, gdy klientka zgłasza przemoc domową?"],
  ["w11", "Jak wpisujemy termin procesowy do kalendarza sprawy?"],
  ["w12", "Zgubiłem służbowego laptopa z aktami sprawy, co teraz?"],
  ["w13", "Co zrobić z kopertą po piśmie z sądu?"],
  ["w14", "Jakie są terminy na apelację, zażalenie i sprzeciw od nakazu zapłaty?"],
  ["w15", "Klient prosi o wydanie oryginałów dokumentów, co robię?"],
  ["w16", "Co zrobić, gdy przekroczyliśmy termin w sprawie klienta?"],
  ["w17", "Czy aplikant może sporządzić i podpisać skargę kasacyjną?"],
  ["w18", "Jaki jest termin na zażalenie i od czego jest liczony?"],
  ["w19", "Klient pyta, jakie ma szanse w sprawie — co mam mu odpowiedzieć?"],
  ["w20", "Do jakiej kwoty mogę ponieść wydatek w sprawie bez zgody adwokata?"],
    ],
  },
};

const FRAZA_ODMOWY = /nie mam takich informacji/i;

async function jedno(id, pytanie, space) {
  const url = `${BAZA}/debug?key=${encodeURIComponent(KEY)}&klient=${encodeURIComponent(KLIENT)}&space=${space}` +
              `&q=${encodeURIComponent(pytanie)}&cb=${Math.random().toString(36).slice(2)}`;
  const r = await fetch(url);
  const txt = await r.text();
  if (!r.ok) return { id, blad: `HTTP ${r.status}: ${txt.slice(0, 120)}` };
  let d;
  try { d = JSON.parse(txt); } catch { return { id, blad: `nie-JSON: ${txt.slice(0, 120)}` }; }
  writeFileSync(`${KAT}/${space}-${id}.json`, JSON.stringify(d, null, 1), "utf8");

  const zdania = d.weryfikacja_zdan || [];
  const zachowane = zdania.filter((z) => z.akcja.startsWith("zachowane"));
  const faktyczne = zachowane.filter((z) => !z.grzecznosciowe);
  const wyciete = zdania.length - zachowane.length;
  // Odtworzenie ścieżki produkcyjnej — patrz nagłówek.
  const luka = FRAZA_ODMOWY.test(d.odpowiedz || "") || faktyczne.length === 0;
  const lider = d.znalezione_fragmenty?.[0];
  const drugi = d.znalezione_fragmenty?.[1];
  const odskok = lider && drugi ? (Number(lider.wynik) - Number(drugi.wynik)).toFixed(3) : "-";
  return {
    id, pytanie, space,
    luka,
    zdan: zdania.length,
    wyciete,
    powody: [...new Set(zdania.filter((z) => !z.akcja.startsWith("zachowane")).map((z) => z.akcja))].join("|"),
    lider: lider ? `${lider.wynik} ${lider.tytul.slice(0, 34)}` : "-",
    odskok,
    // Eskalacja i ramka to DWA rozne mechanizmy: `eskalacja` jest z definicji
    // pusta w trybie publicznym, wiec trzymana w jednej kolumnie z ramka
    // pokazywalaby zawsze zero ramek w sondzie publicznej.
    eskalacja: d.eskalacja ? `${d.eskalacja.kategoria}${d.eskalacja.pilne ? "!" : ""}` : "-",
    ramka: d.bezpieczenstwo ? `${d.bezpieczenstwo.kategoria}${d.bezpieczenstwo.pilne ? "!" : ""}` : "-",
    odpowiedz: d.odpowiedz || "",
  };
}

async function przebieg(nazwa, zestaw, space) {
  console.log(`\n=== ${nazwa} (${zestaw.length} pytań, przestrzeń ${space}) ===`);
  console.log("id  luka zdan wyc odskok eskalacja        ramka            lider");
  const wyniki = [];
  for (const [id, pytanie] of zestaw) {
    try {
      const w = await jedno(id, pytanie, space);
      wyniki.push(w);
      if (w.blad) { console.log(`${id}  BŁĄD ${w.blad}`); continue; }
      console.log(
        `${w.id}  ${w.luka ? "LUKA" : "  - "} ${String(w.zdan).padStart(4)} ${String(w.wyciete).padStart(3)} ` +
        `${String(w.odskok).padStart(6)} ${w.eskalacja.padEnd(16)} ${w.ramka.padEnd(16)} ${w.lider}` +
        (w.powody ? `\n      powody: ${w.powody}` : "")
      );
    } catch (e) {
      console.log(`${id}  BŁĄD ${e.message}`);
    }
  }
  writeFileSync(`${KAT}/podsumowanie-${space}.json`, JSON.stringify(wyniki, null, 1), "utf8");
  const luki = wyniki.filter((w) => w.luka).length;
  const wyc = wyniki.reduce((n, w) => n + (w.wyciete || 0), 0);
  const zd = wyniki.reduce((n, w) => n + (w.zdan || 0), 0);
  const esk = wyniki.filter((w) => w.eskalacja !== "-").length;
  const ram = wyniki.filter((w) => w.ramka !== "-").length;
  console.log(`\nPODSUMOWANIE ${space}: luk ${luki}/${wyniki.length}, wycięć ${wyc}/${zd} zdań, ` +
    `eskalacji ${esk}/${wyniki.length}, ramek ${ram}/${wyniki.length}`);
}

const zestaw = ZESTAWY[KLIENT];
if (!zestaw) {
  console.error(`Brak zestawu pytan dla klienta "${KLIENT}". Znani: ${Object.keys(ZESTAWY).join(", ")}`);
  process.exit(1);
}
if (ZAKRES === "public" || ZAKRES === "obie") await przebieg("PUBLICZNE", zestaw.publiczne, "public");
if (ZAKRES === "internal" || ZAKRES === "obie") await przebieg("WEWNĘTRZNE", zestaw.wewnetrzne, "internal");
console.log(`\nSurowe odpowiedzi: ${KAT}`);
