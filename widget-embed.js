// widget-embed.js — SKRYPT OSADZAJĄCY widget publiczny na stronie klienta.
//
// PO CO TO ISTNIEJE
// Do 27.08.2026 widget istniał wyłącznie jako kod wklejony w `index.html` na
// GitHub Pages. Znaczyło to, że demo dało się pokazać tylko na naszej domenie,
// a przy wdrożeniu nie było czego dać klientowi — musiałby hostować całą
// stronę. Ten plik zamienia to na jedną linijkę `<script>`.
//
// CO TO JEST, A CZYM NIE JEST
// To jest SZABLON skryptu, serwowany przez Workera pod `GET /widget.js` na
// HOŚCIE PUBLICZNYM klienta. Nie jest modułem uruchamianym w Workerze i nie
// wykonuje się po naszej stronie — leci w całości do przeglądarki gościa
// strony klienta. Jedyne podstawienie to `{{konfig}}`: blob JSON z motywem,
// tekstami i adresem endpointu, składany przez `konfiguracjaWidgetu()`
// w `worker.js` z pól klienta.
//
// KLIENT WYNIKA Z HOSTA, TAK SAMO JAK WSZĘDZIE
// Skrypt nie wybiera klienta. Klienta wybiera adres, spod którego skrypt
// został pobrany — czyli `src` w tagu. `data-client` w snippecie jest
// ASERCJĄ, nie selektorem: jeśli nie zgadza się z konfiguracją wstrzykniętą
// przez Workera, widget odmawia startu i mówi o tym w konsoli. Gdyby był
// selektorem, byłby dokładnie tym, co ta architektura odrzuciła 22.08.2026 —
// nazwą klienta przychodzącą z żądania.
//
// STYLE: SHADOW DOM I DLACZEGO SAM NIE WYSTARCZA
// Shadow DOM zatrzymuje selektory strony klienta, ale **nie zatrzymuje
// dziedziczenia**: `font-family`, `color`, `line-height`, `letter-spacing`,
// `text-transform` i `visibility` ustawione na `body` przechodzą przez granicę
// cienia jak przez powietrze. To jest ten przypadek ze starą stroną, która ma
// `body{font:12px Arial;line-height:1.1}`. Dlatego `:host` dostaje
// `all:initial` — i to jest ta reguła, której nie wolno stąd usunąć.

export const WIDGET_EMBED_JS = String.raw`/* KnowBase — widget osadzany. Nie edytuj tego pliku: jest generowany. */
(function () {
  "use strict";

  var CFG = {{konfig}};

  // --- 0. Wejście: jeden widget na klienta i na stronę -------------------
  var FLAGA = "__knowbase_" + CFG.klient;
  if (window[FLAGA]) return;

  // --- 1. Znajdź własny tag <script> ------------------------------------
  // "document.currentScript" jest dostępny wszędzie tam, gdzie jest Shadow DOM
  // v1, więc gałąź zapasowa jest kurtuazją, nie koniecznością.
  var tag = document.currentScript;
  if (!tag) {
    var wszystkie = document.getElementsByTagName("script");
    for (var i = wszystkie.length - 1; i >= 0; i--) {
      if ((wszystkie[i].src || "").indexOf("/widget.js") > -1) { tag = wszystkie[i]; break; }
    }
  }
  if (!tag) return;

  var attr = function (nazwa, domyslnie) {
    var v = tag.getAttribute(nazwa);
    return v === null || v === "" ? domyslnie : v;
  };

  // --- 2. Asercja klienta ------------------------------------------------
  // Łapie najczęstszą pomyłkę przy wdrożeniu: skopiowany snippet innego
  // klienta, w którym poprawiono "data-client", a zapomniano o "src".
  var deklarowany = attr("data-client", null);
  if (deklarowany && deklarowany !== CFG.klient) {
    console.error(
      "[KnowBase] data-client=\"" + deklarowany + "\" nie zgadza się z adresem skryptu, " +
      "który należy do klienta \"" + CFG.klient + "\". Widget nie został uruchomiony. " +
      "Popraw src w tagu <script> albo usuń atrybut data-client."
    );
    return;
  }

  // --- 3. Próg możliwości przeglądarki -----------------------------------
  // Bez Shadow DOM v1 nie da się dotrzymać obietnicy izolacji stylów. Wariant
  // „zamontuj bez cienia" byłby gorszy od nieuruchomienia się: widget wyglądałby
  // losowo na cudzej stronie, a my nie mielibyśmy o tym pojęcia.
  var mozliwe = !!(document.head.attachShadow || Element.prototype.attachShadow) &&
                typeof window.fetch === "function" &&
                typeof window.Promise === "function";
  if (!mozliwe) {
    console.warn("[KnowBase] Przeglądarka nie obsługuje Shadow DOM v1 — widget pominięty.");
    return;
  }

  window[FLAGA] = true;

  var tryb = attr("data-kb-mode", "bubble") === "inline" ? "inline" : "bubble";
  var strona = attr("data-kb-position", "right") === "left" ? "left" : "right";
  var fontyWlaczone = attr("data-kb-fonts", "on") !== "off";
  var selektorCelu = attr("data-kb-target", "[data-knowbase]");

  // --- 4. Fonty — jedyna rzecz, która trafia poza cień -------------------
  // "@font-face" zadeklarowany WEWNĄTRZ drzewa cienia nie jest rejestrowany
  // przez przeglądarkę, więc arkusz Google Fonts musi wisieć w <head> strony
  // klienta. To jedyny wyjątek od izolacji i jest świadomy: reguła "@font-face"
  // niczego nie stylizuje sama z siebie — dopiero użycie nazwy kroju.
  // Klient, który tego nie chce (własne CSP, brak zgody na zewnętrzne zasoby),
  // wyłącza to atrybutem data-kb-fonts="off" i widget schodzi na fonty systemowe.
  if (fontyWlaczone && CFG.fontyUrl && !document.querySelector('link[data-knowbase-fonts]')) {
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = CFG.fontyUrl;
    link.setAttribute("data-knowbase-fonts", "1");
    document.head.appendChild(link);
  }

  // --- 5. Element gospodarza --------------------------------------------
  var gospodarz = document.createElement("div");
  gospodarz.setAttribute("data-knowbase-host", CFG.klient);

  if (tryb === "inline") {
    var cel = document.querySelector(selektorCelu);
    if (!cel) {
      console.error("[KnowBase] Nie znaleziono elementu \"" + selektorCelu + "\" do osadzenia widgetu.");
      window[FLAGA] = false;
      return;
    }
    cel.appendChild(gospodarz);
  } else {
    // Dymek wisi na <body>, a nie tam, gdzie stoi tag skryptu. Powód jest
    // konkretny: "position:fixed" wewnątrz przodka z "transform", "filter"
    // albo "perspective" przestaje być względne do okna. Stare strony robią
    // to nagminnie w karuzelach i animacjach wejścia.
    (document.body || document.documentElement).appendChild(gospodarz);
  }

  var cien = gospodarz.attachShadow({ mode: "open" });

  // --- 6. Style ----------------------------------------------------------
  var style = document.createElement("style");
  style.textContent = arkusz();
  cien.appendChild(style);

  var korzen = document.createElement("div");
  korzen.className = "kb kb--" + tryb + " kb--" + strona;
  korzen.innerHTML = szkielet();
  cien.appendChild(korzen);

  // --- 7. Uchwyty --------------------------------------------------------
  var q = function (s) { return cien.querySelector(s); };
  var launcher = q(".kb-launcher");
  var panel    = q(".kb-panel");
  var zamknij  = q(".kb-close");
  var log      = q(".kb-log");
  var chipsy   = q(".kb-chips");
  var pole     = q(".kb-input");
  var wyslij   = q(".kb-send");

  var otwarty = tryb === "inline";
  var zajety = false;
  var historia = [];
  var bezRuchu = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

  // --- 8. Pytania na start ----------------------------------------------
  (CFG.pytania || []).forEach(function (tekst) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "kb-chip";
    b.textContent = tekst;
    b.addEventListener("click", function () { zapytaj(tekst); });
    chipsy.appendChild(b);
  });

  if (CFG.powitanie) dodajBota(CFG.powitanie, true);

  // --- 9. Otwieranie i zamykanie ----------------------------------------
  function ustawOtwarty(v) {
    if (tryb === "inline") return;
    otwarty = v;
    korzen.classList.toggle("kb--open", v);
    launcher.setAttribute("aria-expanded", v ? "true" : "false");
    panel.setAttribute("aria-hidden", v ? "false" : "true");
    if (v) setTimeout(function () { pole.focus(); }, 60);
    else launcher.focus();
  }

  if (launcher) {
    launcher.addEventListener("click", function () { ustawOtwarty(!otwarty); });
  }
  if (zamknij) {
    zamknij.addEventListener("click", function () { ustawOtwarty(false); });
  }

  korzen.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && tryb === "bubble" && otwarty) {
      e.stopPropagation();
      ustawOtwarty(false);
    }
  });

  // --- 10. Pole wpisywania ----------------------------------------------
  pole.setAttribute("placeholder", CFG.placeholder || "");
  pole.addEventListener("input", function () {
    pole.style.height = "auto";
    pole.style.height = Math.min(pole.scrollHeight, 120) + "px";
    wyslij.disabled = !pole.value.trim() || zajety;
  });
  pole.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); zapytaj(pole.value); }
  });
  wyslij.addEventListener("click", function () { zapytaj(pole.value); });

  // --- 11. Rysowanie wiadomości -----------------------------------------
  function naDol() { log.scrollTop = log.scrollHeight; }

  function dodajUzytkownika(tekst) {
    var w = document.createElement("div");
    w.className = "kb-row kb-row--me";
    var b = document.createElement("div");
    b.className = "kb-bub kb-bub--me";
    b.textContent = tekst;
    w.appendChild(b); log.appendChild(w); naDol();
  }

  function dodajBota(tekst, odRazu) {
    var w = document.createElement("div");
    w.className = "kb-row";
    var b = document.createElement("div");
    b.className = "kb-bub kb-bub--ai";
    w.appendChild(b); log.appendChild(w); naDol();
    if (odRazu || bezRuchu) { b.textContent = tekst; naDol(); return Promise.resolve(b); }
    return pisz(b, tekst).then(function () { return b; });
  }

  function dodajKropki() {
    var w = document.createElement("div");
    w.className = "kb-row";
    w.innerHTML = '<div class="kb-bub kb-bub--ai kb-dots"><i></i><i></i><i></i></div>';
    log.appendChild(w); naDol();
    return w;
  }

  function dodajTagi(lista) {
    if (!lista.length) return;
    var w = document.createElement("div");
    w.className = "kb-tags";
    lista.forEach(function (para) {
      var t = document.createElement("span");
      t.className = "kb-tag kb-tag--" + para[0];
      t.textContent = para[1];
      w.appendChild(t);
    });
    log.appendChild(w); naDol();
  }

  function pisz(el, tekst) {
    return new Promise(function (koniec) {
      var i = 0;
      (function krok() {
        i += Math.random() < 0.3 ? 2 : 1;
        el.textContent = tekst.slice(0, i);
        naDol();
        if (i < tekst.length) setTimeout(krok, 9); else koniec();
      })();
    });
  }

  // --- 12. Zapytanie -----------------------------------------------------
  function zapytaj(tekst) {
    tekst = (tekst || "").trim();
    if (!tekst || zajety) return;
    zajety = true;
    wyslij.disabled = true;
    pole.value = "";
    pole.style.height = "auto";
    chipsy.classList.add("kb-chips--ukryte");
    dodajUzytkownika(tekst);
    var kropki = dodajKropki();

    fetch(CFG.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: tekst, history: historia.slice(-CFG.maxHistorii) })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        kropki.parentNode.removeChild(kropki);
        return dodajBota(d.answer || CFG.bladOgolny).then(function (b) {
          if (d.gap) b.classList.add("kb-bub--luka");
          var tagi = [];
          if (d.source) tagi.push(["src", CFG.etykietaZrodla + " " + d.source]);
          if (d.gap) tagi.push(["gap", CFG.etykietaLuki]);
          if (d.trimmed > 0) tagi.push(["cut", CFG.etykietaPominiec + " " + d.trimmed]);
          dodajTagi(tagi);
          if (!d.error) {
            historia.push({ role: "user", content: tekst });
            historia.push({ role: "assistant", content: d.answer });
          }
        });
      })
      .catch(function () {
        if (kropki.parentNode) kropki.parentNode.removeChild(kropki);
        return dodajBota(CFG.bladSieci).then(function (b) { b.classList.add("kb-bub--luka"); });
      })
      .then(function () {
        zajety = false;
        wyslij.disabled = !pole.value.trim();
        if (otwarty) pole.focus();
      });
  }

  // --- 12a. Publiczne API dla strony klienta ----------------------------
  // Minimalne i celowo trzyczłonowe. Istnieje po to, żeby przycisk gdziekolwiek
  // na stronie ("Zapytaj asystenta") mogl otworzyc widget z gotowym pytaniem —
  // bez tego strona nie ma jak siegnac do wnetrza drzewa cienia i musialaby
  // trzymac wlasna kopie czatu, czyli dokladnie to, co ten plik usuwa.
  //
  // Pod kluczem klienta ORAZ bezposrednio: strona z jednym widgetem (czyli
  // kazda strona klienta) korzysta z krotszej formy.
  var api = {
    ask: function (pytanie) { ustawOtwarty(true); zapytaj(pytanie); },
    open: function () { ustawOtwarty(true); },
    close: function () { ustawOtwarty(false); },
  };
  window.KnowBase = window.KnowBase || {};
  window.KnowBase[CFG.klient] = api;
  window.KnowBase.ask = api.ask;
  window.KnowBase.open = api.open;
  window.KnowBase.close = api.close;

  // --- 13. Szkielet HTML -------------------------------------------------
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function szkielet() {
    var przyciskOtwarcia = tryb === "bubble"
      ? '<button type="button" class="kb-launcher" aria-expanded="false" aria-label="' + esc(CFG.etykietaDymka) + '">' +
          '<span class="kb-orb"></span>' +
          '<span class="kb-launcher-txt">' + esc(CFG.etykietaDymka) + '</span>' +
        '</button>'
      : "";

    var przyciskZamkniecia = tryb === "bubble"
      ? '<button type="button" class="kb-close" aria-label="Zamknij">✕</button>'
      : "";

    return przyciskOtwarcia +
      '<section class="kb-panel" role="dialog" aria-label="' + esc(CFG.tytul) + '"' +
        (tryb === "bubble" ? ' aria-hidden="true"' : '') + '>' +
        '<header class="kb-head">' +
          '<span class="kb-orb kb-orb--sm"></span>' +
          '<span class="kb-head-txt"><b>' + esc(CFG.tytul) + '</b><span>' + esc(CFG.podtytul) + '</span></span>' +
          przyciskZamkniecia +
        '</header>' +
        '<div class="kb-log" role="log" aria-live="polite"></div>' +
        '<div class="kb-chips"></div>' +
        '<div class="kb-compose">' +
          '<textarea class="kb-input" rows="1"></textarea>' +
          '<button type="button" class="kb-send" disabled aria-label="Wyślij">' +
            '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>' +
          '</button>' +
        '</div>' +
        '<footer class="kb-foot">' + esc(CFG.stopka) + '</footer>' +
      '</section>';
  }

  // --- 14. Arkusz --------------------------------------------------------
  // Wszystkie wartości barwne przychodzą z CFG.zmienne, składanego z motywu
  // klienta w Workerze. W tym pliku nie ma ani jednego koloru — ta sama reguła,
  // która od 24.08.2026 obowiązuje pliki interfejsów.
  function arkusz() {
    return [
      /* :host — granica. "all:initial" odcina DZIEDZICZENIE ze strony klienta,
         czego sam Shadow DOM nie robi. Nie usuwać. Właściwości ustawiane po
         nim wygrywają, bo są dalej w tym samym bloku. */
      ":host{all:initial;" + CFG.zmienne + "}",
      ':host([hidden]){display:none}',
      ".kb,.kb *{box-sizing:border-box;margin:0;padding:0;font-family:var(--font-tekst)}",
      ".kb{color:var(--chalk);font-size:14px;line-height:1.55;-webkit-font-smoothing:antialiased}",
      ".kb button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}",
      ".kb svg{display:block}",

      /* --- dymek --- */
      ".kb--bubble{position:fixed;bottom:20px;z-index:2147483000}",
      ".kb--bubble.kb--right{right:20px}",
      ".kb--bubble.kb--left{left:20px}",
      ".kb-launcher{display:flex;align-items:center;gap:10px;padding:12px 18px 12px 14px;" +
        "background:var(--deck);border:1px solid var(--line);border-radius:calc(var(--promien) + 999px);" +
        "box-shadow:var(--cien);transition:transform .18s var(--sp)}",
      ".kb-launcher:hover{transform:translateY(-2px)}",
      ".kb-launcher-txt{font-family:var(--font-naglowek);font-weight:600;font-size:13px;letter-spacing:var(--trop)}",
      ".kb--bubble.kb--open .kb-launcher{display:none}",

      /* --- panel --- */
      ".kb-panel{display:flex;flex-direction:column;overflow:hidden;" +
        "background:var(--void);border:1px solid var(--line);border-radius:calc(var(--promien) + 10px);box-shadow:var(--cien)}",
      ".kb--bubble .kb-panel{display:none;width:380px;height:min(560px,calc(100vh - 48px))}",
      ".kb--bubble.kb--open .kb-panel{display:flex}",
      ".kb--inline .kb-panel{width:100%;height:520px}",

      ".kb-head{display:flex;align-items:center;gap:10px;padding:14px 14px;border-bottom:1px solid var(--line-soft);background:var(--deck)}",
      ".kb-head-txt{display:flex;flex-direction:column;flex:1;min-width:0}",
      ".kb-head-txt b{font-family:var(--font-naglowek);font-size:13px;font-weight:700;letter-spacing:var(--trop)}",
      ".kb-head-txt span{font-size:11px;color:var(--mute)}",
      ".kb-close{width:28px;height:28px;color:var(--mute);font-size:14px;line-height:1}",
      ".kb-close:hover{color:var(--chalk)}",

      ".kb-orb{width:12px;height:12px;flex:none;border-radius:999px;background:var(--hi)}",
      ".kb-orb--sm{width:9px;height:9px}",

      ".kb-log{flex:1;overflow-y:auto;padding:16px 14px;display:flex;flex-direction:column;gap:12px}",
      ".kb-row{display:flex}",
      ".kb-row--me{justify-content:flex-end}",
      ".kb-bub{max-width:86%;padding:10px 13px;border-radius:calc(var(--promien) + 10px);white-space:pre-wrap;word-wrap:break-word;overflow-wrap:anywhere}",
      ".kb-bub--me{background:color-mix(in srgb,var(--hi) 16%,transparent);border:1px solid color-mix(in srgb,var(--hi) 34%,transparent)}",
      ".kb-bub--ai{background:var(--panel);border:1px solid var(--line-soft)}",
      ".kb-bub--luka{border-color:color-mix(in srgb,var(--warn) 45%,transparent)}",

      ".kb-dots{display:flex;gap:5px;align-items:center;padding:14px 13px}",
      ".kb-dots i{width:5px;height:5px;border-radius:999px;background:var(--dim);animation:kb-b 1.1s infinite ease-in-out}",
      ".kb-dots i:nth-child(2){animation-delay:.15s}.kb-dots i:nth-child(3){animation-delay:.3s}",
      "@keyframes kb-b{0%,80%,100%{opacity:.25}40%{opacity:1}}",

      ".kb-tags{display:flex;flex-wrap:wrap;gap:6px}",
      ".kb-tag{font-family:var(--font-mono);font-size:10px;letter-spacing:.03em;padding:3px 7px;" +
        "border-radius:var(--promien);border:1px solid var(--line);color:var(--dim)}",
      ".kb-tag--src{color:var(--podstawa-tekst);border-color:color-mix(in srgb,var(--blue) 40%,transparent)}",
      ".kb-tag--gap{color:var(--tag-zwykly-tekst);border-color:color-mix(in srgb,var(--warn) 40%,transparent)}",

      ".kb-chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 10px}",
      ".kb-chips--ukryte{display:none}",
      ".kb-chip{padding:6px 11px;font-size:12px;color:var(--mute);background:var(--deck);" +
        "border:1px solid var(--line);border-radius:calc(var(--promien) + 999px)}",
      ".kb-chip:hover{color:var(--chalk);border-color:var(--hi)}",

      ".kb-compose{display:flex;gap:8px;padding:10px 12px;border-top:1px solid var(--line-soft);background:var(--deck)}",
      ".kb-input{flex:1;resize:none;max-height:120px;padding:9px 11px;color:var(--chalk);" +
        "background:var(--void);border:1px solid var(--line);border-radius:var(--promien);outline:none;font-size:14px;line-height:1.45}",
      ".kb-input:focus{border-color:var(--hi)}",
      ".kb-input::placeholder{color:var(--dim)}",
      ".kb-send{width:38px;flex:none;display:flex;align-items:center;justify-content:center;" +
        "color:var(--na-akcencie);background:var(--hi);border-radius:var(--promien)}",
      ".kb-send:disabled{opacity:.4;cursor:default}",

      ".kb-foot{padding:8px 14px;font-family:var(--font-mono);font-size:10px;letter-spacing:.04em;" +
        "color:var(--dim);background:var(--deck);border-top:1px solid var(--line-soft);text-align:center}",

      /* Telefon: dymek rozwija się na cały ekran. Bez tego panel 380 px
         wystaje poza wąski ekran i chowa pole wpisywania. */
      "@media (max-width:480px){" +
        ".kb--bubble{left:10px;right:10px;bottom:10px}" +
        ".kb--bubble .kb-panel{width:auto;height:min(78vh,560px)}" +
        ".kb--bubble .kb-launcher{margin-left:auto}" +
      "}",

      "@media (prefers-reduced-motion:reduce){.kb *{animation:none!important;transition:none!important}}"
    ].join("\n");
  }
})();
`;
