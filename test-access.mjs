// Test weryfikacji tokenu Cloudflare Access.
//
// Uruchomienie:  node test-access.mjs
//
// Po co: ścieżki „brak tokenu" i „nieważny token" da się sprawdzić na żywym
// Workerze, ale „ważny token" nie — podpisuje go Cloudflare kluczem zespołu,
// więc bez skonfigurowanej aplikacji Access nie ma czym go wytworzyć.
// Ten test podstawia własną parę kluczy w miejsce kluczy zespołu i dzięki temu
// sprawdza także przypadek pozytywny oraz to, czy każde pojedyncze naruszenie
// (podpis, wystawca, odbiorca, ważność) faktycznie odrzuca token.
//
// Testowana jest ta sama funkcja, która działa w produkcji — importowana
// z worker.js, nie skopiowana.

import { verifyAccessJwt, resetAccessCertsCache } from "./worker.js";

const TEAM = "budmax-test.cloudflareaccess.com";
const AUD = "aud-testowy-0123456789abcdef";
const ENV = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD };

const b64url = (bytes) =>
  Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const para = await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  true,
  ["sign", "verify"]
);
const paraObca = await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  true,
  ["sign", "verify"]
);

const jwkPubliczny = await crypto.subtle.exportKey("jwk", para.publicKey);
const KID = "klucz-testowy-1";

// Podstawiamy endpoint kluczy zespołu. Wszystko inne w weryfikacji zostaje bez zmian.
let pobranKluczy = 0;
globalThis.fetch = async (url) => {
  if (String(url) === `https://${TEAM}/cdn-cgi/access/certs`) {
    pobranKluczy++;
    return new Response(
      JSON.stringify({ keys: [{ kid: KID, kty: "RSA", alg: "RS256", use: "sig", n: jwkPubliczny.n, e: jwkPubliczny.e }] }),
      { headers: { "Content-Type": "application/json" } }
    );
  }
  return new Response("not found", { status: 404 });
};

const teraz = () => Math.floor(Date.now() / 1000);

async function zrobToken({ klucz = para.privateKey, kid = KID, iss = `https://${TEAM}`, aud = AUD, exp = teraz() + 3600, nbf, email = "marek@budmax.pl", alg = "RS256" } = {}) {
  const naglowek = b64url(new TextEncoder().encode(JSON.stringify({ alg, kid, typ: "JWT" })));
  const ladunek = b64url(new TextEncoder().encode(JSON.stringify({
    iss, aud, exp, nbf, email, sub: "uzytkownik-123", iat: teraz(),
  })));
  const dane = new TextEncoder().encode(`${naglowek}.${ladunek}`);
  const podpis = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", klucz, dane);
  return `${naglowek}.${ladunek}.${b64url(new Uint8Array(podpis))}`;
}

function zadanie(token, { url = "https://knowbase-budmax.example/internal", naglowki = {} } = {}) {
  const h = new Headers(naglowki);
  if (token) h.set("Cf-Access-Jwt-Assertion", token);
  return new Request(url, { method: "POST", headers: h });
}

let zdane = 0, oblane = 0;
async function sprawdz(nazwa, req, env, oczekiwane) {
  resetAccessCertsCache();
  const wynik = await verifyAccessJwt(req, env);
  const ok =
    wynik.ok === oczekiwane.ok &&
    (oczekiwane.status === undefined || wynik.status === oczekiwane.status) &&
    (oczekiwane.email === undefined || wynik.identity?.email === oczekiwane.email) &&
    (oczekiwane.domena === undefined || wynik.identity?.domena === oczekiwane.domena);
  if (ok) {
    zdane++;
    const opis = wynik.ok
      ? `PRZYJETY  email=${wynik.identity.email} domena=${wynik.identity.domena}`
      : `ODRZUCONY ${wynik.status}  ${wynik.error}`;
    console.log(`  OK   ${nazwa}\n         ${opis}`);
  } else {
    oblane++;
    console.log(`  BLAD ${nazwa}`);
    console.log(`         oczekiwano: ${JSON.stringify(oczekiwane)}`);
    console.log(`         otrzymano:  ${JSON.stringify({ ok: wynik.ok, status: wynik.status, error: wynik.error, identity: wynik.identity })}`);
  }
}

console.log("\n=== 1. WAZNY TOKEN ===");
await sprawdz("poprawnie podpisany, wlasciwy iss/aud, niewygasly",
  zadanie(await zrobToken()), ENV, { ok: true, email: "marek@budmax.pl", domena: "budmax.pl" });

console.log("\n=== 2. BRAK TOKENU ===");
await sprawdz("zadne naglowki",
  zadanie(null), ENV, { ok: false, status: 401 });
await sprawdz("sam parametr ?key= (dawny sekret administracyjny)",
  zadanie(null, { url: "https://knowbase-budmax.example/internal?key=cokolwiek" }), ENV, { ok: false, status: 401 });

console.log("\n=== 3. NIEWAZNY TOKEN ===");
await sprawdz("podpisany obcym kluczem",
  zadanie(await zrobToken({ klucz: paraObca.privateKey })), ENV, { ok: false, status: 401 });
await sprawdz("nieznany kid",
  zadanie(await zrobToken({ kid: "klucz-ktorego-nie-ma" })), ENV, { ok: false, status: 401 });
await sprawdz("wygasly (exp godzine temu)",
  zadanie(await zrobToken({ exp: teraz() - 3600 })), ENV, { ok: false, status: 401 });
await sprawdz("wystawiony przez inny zespol",
  zadanie(await zrobToken({ iss: "https://ktos-inny.cloudflareaccess.com" })), ENV, { ok: false, status: 401 });
await sprawdz("wystawiony dla innej aplikacji (zle AUD)",
  zadanie(await zrobToken({ aud: "aud-innej-aplikacji" })), ENV, { ok: false, status: 401 });
await sprawdz("jeszcze niewazny (nbf w przyszlosci)",
  zadanie(await zrobToken({ nbf: teraz() + 3600 })), ENV, { ok: false, status: 401 });
await sprawdz("algorytm none (proba obejscia podpisu)",
  zadanie(await zrobToken({ alg: "none" })), ENV, { ok: false, status: 401 });
await sprawdz("smiec zamiast tokenu",
  zadanie("to-nie-jest-jwt"), ENV, { ok: false, status: 401 });
await sprawdz("dwie czesci zamiast trzech",
  zadanie("aaa.bbb"), ENV, { ok: false, status: 401 });

console.log("\n=== 4. SCIEZKA AWARYJNA: ACCESS NIESKONFIGUROWANY ===");
await sprawdz("brak obu zmiennych",
  zadanie(await zrobToken()), {}, { ok: false, status: 503 });
await sprawdz("brak samego ACCESS_AUD",
  zadanie(await zrobToken()), { ACCESS_TEAM_DOMAIN: TEAM }, { ok: false, status: 503 });

console.log("\n=== 5. ROZDZIELENIE AUD PO HOSCIE (panel wlasciciela) ===");
// Dwie aplikacje Access = dwa AUD. Oczekiwany AUD wybiera HOST, nie lista —
// inaczej token pracownika z hostu wewnetrznego otwieralby panel wlasciciela.
const AUD_PANEL = "aud-panelowy-9876543210fedcba";
const ENV_OBA = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, ACCESS_AUD_PANEL: AUD_PANEL };
const ENV_BEZ_PANELU = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD };
const naPanelu = (token) => zadanie(token, { url: "https://budmax-wlasciciel.know-base.app/stats" });
const naWewnetrznym = (token) => zadanie(token, { url: "https://budmax-pracownik.know-base.app/internal" });

await sprawdz("token PANELOWY otwiera host panelowy",
  naPanelu(await zrobToken({ aud: AUD_PANEL })), ENV_OBA, { ok: true });
await sprawdz("token PRACOWNIKA nie otwiera panelu wlasciciela",
  naPanelu(await zrobToken({ aud: AUD })), ENV_OBA, { ok: false, status: 401 });
await sprawdz("token PANELOWY nie otwiera hostu wewnetrznego",
  naWewnetrznym(await zrobToken({ aud: AUD_PANEL })), ENV_OBA, { ok: false, status: 401 });
await sprawdz("token pracownika nadal otwiera host wewnetrzny",
  naWewnetrznym(await zrobToken({ aud: AUD })), ENV_OBA, { ok: true });
await sprawdz("brak ACCESS_AUD_PANEL = 503 na hoscie panelowym, nie ciche 403",
  naPanelu(await zrobToken({ aud: AUD_PANEL })), ENV_BEZ_PANELU, { ok: false, status: 503 });
await sprawdz("brak ACCESS_AUD_PANEL nie psuje hostu wewnetrznego",
  naWewnetrznym(await zrobToken({ aud: AUD })), ENV_BEZ_PANELU, { ok: true });

console.log(`\n---\nzdane: ${zdane}, oblane: ${oblane}\n`);
process.exit(oblane ? 1 : 0);
