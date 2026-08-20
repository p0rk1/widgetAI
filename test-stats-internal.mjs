// test-stats-internal.mjs — testy jednostkowe endpointu /stats-internal
// Sprawdza filtrowanie przestrzeni, zliczanie luk, eskalacji i źródeł.

import assert from "node:assert/strict";

console.log("=== TEST STATYSTYK WEWNĘTRZNYCH ===");

const MOCK_ENTRIES = [
  // Pytania publiczne (nie powinny trafić do stats-internal)
  { q: "Ile kosztuje budowa domu?", gap: false, source: "Cennik robocizny", space: "public", ts: Date.now() - 1000 },
  { q: "Czy budujecie w Warszawie?", gap: true, source: null, space: "public", ts: Date.now() - 2000 },
  // Pytania wewnętrzne
  { q: "Pracownik spadł z drabiny i krwawi", gap: false, source: "Procedura powypadkowa", space: "internal", eskalacja: "wypadek", ts: Date.now() - 3000 },
  { q: "Kto zatwierdza 5% rabatu?", gap: false, source: "Progi decyzyjne i zatwierdzanie rabatów", space: "internal", eskalacja: "finanse_prog", ts: Date.now() - 4000 },
  { q: "Jak rozliczyć delegację zagraniczną?", gap: true, source: null, space: "internal", ts: Date.now() - 5000 },
  { q: "Jakie szelki do pracy powyżej 2m?", gap: false, source: "Procedura BHP — praca na wysokości", space: "internal", ts: Date.now() - 6000 },
];

function processInternalStats(entries) {
  const internal = entries.filter((e) => (e.space || "public") === "internal");
  const total = internal.length;
  const gaps = internal.filter((e) => e.gap);
  const answered = internal.filter((e) => !e.gap);

  const sourceCount = {};
  for (const e of answered) {
    if (!e.source) continue;
    for (const s of e.source.split(",").map((x) => x.trim())) {
      if (s) sourceCount[s] = (sourceCount[s] || 0) + 1;
    }
  }
  const topSources = Object.entries(sourceCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tytul, liczba]) => ({ tytul, liczba }));

  const byKategoria = {};
  let totalEskalacji = 0;
  for (const e of internal) {
    if (!e.eskalacja) continue;
    totalEskalacji++;
    byKategoria[e.eskalacja] = (byKategoria[e.eskalacja] || 0) + 1;
  }

  return {
    total,
    answered: answered.length,
    gaps: gaps.length,
    gapRate: total ? Math.round((gaps.length / total) * 100) : 0,
    gapQuestions: gaps.map((e) => ({ q: e.q, ts: e.ts })),
    topSources,
    eskalacje: {
      total: totalEskalacji,
      byKategoria,
    },
  };
}

const res = processInternalStats(MOCK_ENTRIES);

assert.equal(res.total, 4, "Powinno być 4 pytania wewnętrzne");
assert.equal(res.answered, 3, "Powinno być 3 odpowiedzi");
assert.equal(res.gaps, 1, "Powinna być 1 luka");
assert.equal(res.gapRate, 25, "Wskaźnik luk powinien wynosić 25%");
assert.equal(res.eskalacje.total, 2, "Powinny być 2 eskalacje");
assert.equal(res.eskalacje.byKategoria.wypadek, 1, "1 wypadek");
assert.equal(res.eskalacje.byKategoria.finanse_prog, 1, "1 próg finansowy");
assert.equal(res.topSources.length, 3, "3 źródła");

console.log("OK   Filtrowanie przestrzeni i zliczanie eskalacji działa poprawnie");
console.log("---");
console.log("Wszystkie testy stats-internal zdane!");
