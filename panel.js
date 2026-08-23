// panel.js — szablon HTML panelu wlasciciela (analityka publicznego widgetu).
//
// Serwowany przez Workera na hoscie PANELOWYM (GET /), calym za Cloudflare
// Access. Zrodlem jest TEN plik, nie panel.html: kopia na GitHub Pages zostala
// zamieniona na wskazowke, bo ze statycznej strony nie da sie uwierzytelnic
// przez Access — przekierowanie na ekran logowania nie przejdzie przez fetch
// miedzydomenowy.
//
// Panel nie ma pola na klucz i miec nie moze. Wczesniej wpisywalo sie tu
// REINDEX_SECRET, czyli ten sam sekret, ktory otwiera /purge i /reindex.
export const PANEL_HTML = `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{tytulPanel}}</title>
{{fontyLink}}
<style>
{{motywCss}}
*{box-sizing:border-box}
body{margin:0;background:var(--void);color:var(--chalk);font-family:var(--font-tekst);-webkit-font-smoothing:antialiased}
body::before{
  content:"";position:fixed;inset:0;z-index:0;pointer-events:none;opacity:var(--siatka-krycie);
  background-image:linear-gradient(var(--line-soft) 1px,transparent 1px),linear-gradient(90deg,var(--line-soft) 1px,transparent 1px);
  background-size:64px 64px;
  mask-image:radial-gradient(ellipse 100% 55% at 50% 0%,#000 25%,transparent 72%);
}
.mono{font-family:var(--font-mono)}
.wrap{max-width:1080px;margin:0 auto;padding:0 26px;position:relative;z-index:1}
@media(max-width:600px){.wrap{padding:0 16px}}

/* gate */
.gate{max-width:400px;margin:15vh auto;padding:0 26px;position:relative;z-index:1}
.gate-box{background:linear-gradient(180deg,var(--panel),var(--deck));border:1px solid var(--line);padding:30px}
.gate .scan{height:1px;background:linear-gradient(90deg,transparent,var(--hi),transparent);opacity:.5;margin:-30px -30px 26px;background-size:200% 100%;animation:scan 6s linear infinite}
@keyframes scan{0%{background-position:200% 0}100%{background-position:-200% 0}}
.gate h1{font-family:var(--font-naglowek);font-weight:700;font-size:21px;letter-spacing:-.03em;margin:0 0 7px}
.gate p{color:var(--dim);font-size:13px;line-height:1.6;margin:0 0 22px}
.gate input{width:100%;background:color-mix(in srgb, var(--chalk) 2.5%, transparent);border:1px solid var(--line);color:var(--chalk);padding:12px 14px;font-family:var(--font-mono);font-size:13px;transition:border-color .25s,background .25s}
.gate input:focus{outline:none;border-color:var(--hi);background:color-mix(in srgb, var(--hi) 4%, transparent)}
.gate button{width:100%;margin-top:11px;background:var(--hi);color:#0A0D11;border:none;padding:12px;font-family:var(--font-naglowek);font-weight:700;font-size:12px;letter-spacing:.07em;text-transform:uppercase;cursor:pointer;transition:transform .18s var(--sp),box-shadow .25s}
.gate button:hover{transform:translateY(-2px);box-shadow:0 8px 26px color-mix(in srgb, var(--hi) 30%, transparent)}
.gate .err{color:var(--warn);font-size:12px;margin-top:12px;display:none;font-family:var(--font-mono)}

/* header */
.top{border-bottom:1px solid var(--line);position:sticky;top:0;background:color-mix(in srgb, var(--void) 86%, transparent);backdrop-filter:blur(16px) saturate(150%);z-index:50}
.top-in{display:flex;align-items:center;gap:13px;height:68px}
.mark{width:10px;height:10px;background:var(--hi);flex-shrink:0;position:relative}
.mark::after{content:"";position:absolute;inset:-5px;border:1px solid var(--hi);opacity:calc(var(--ramka-akcentu) * .35)}
.top b{font-family:var(--font-naglowek);font-weight:800;font-size:15px;letter-spacing:.02em}
.top .sub{font-family:var(--font-mono);font-size:10px;color:var(--dim);letter-spacing:.12em;text-transform:uppercase}
.reload{margin-left:auto;background:transparent;border:1px solid var(--line);color:var(--mute);padding:8px 15px;font-family:var(--font-mono);font-size:10.5px;letter-spacing:.08em;cursor:pointer;transition:all .25s var(--sp)}
.reload:hover{border-color:var(--hi);color:var(--hi)}
.reload.spin svg{animation:rot .9s linear infinite}
@keyframes rot{to{transform:rotate(360deg)}}

/* stat rail */
.rail{display:flex;border-top:1px solid var(--line);border-bottom:1px solid var(--line);flex-wrap:wrap;margin:34px 0 30px}
.cell{flex:1;min-width:140px;padding:20px 20px 20px 0;border-right:1px solid var(--line);position:relative}
.cell:last-child{border-right:none}
.cell::before{content:"";position:absolute;top:-1px;left:0;width:13px;height:4px;background:var(--dim)}
.cell.alert::before{background:var(--warn)}
.cell.good::before{background:var(--ok)}
.cell b{font-family:var(--font-naglowek);font-weight:700;font-size:32px;letter-spacing:-.03em;display:block;line-height:1}
.cell.alert b{color:var(--warn)}
.cell.good b{color:var(--ok)}
.cell span{font-family:var(--font-mono);font-size:9.5px;color:var(--dim);letter-spacing:.13em;text-transform:uppercase;margin-top:8px;display:block}

/* blocks */
.blk{border:1px solid var(--line-soft);background:linear-gradient(180deg,color-mix(in srgb, var(--panel) 60%, transparent),transparent);margin-bottom:16px}
.blk-h{padding:17px 20px;border-bottom:1px solid var(--line-soft);display:flex;align-items:baseline;gap:13px;flex-wrap:wrap}
.blk-h .idx{font-family:var(--font-mono);font-size:10px;color:var(--hi);letter-spacing:.14em}
.blk-h h2{font-family:var(--font-naglowek);font-weight:600;font-size:16px;letter-spacing:-.01em;margin:0}
.blk-h p{color:var(--dim);font-size:12px;margin:0;margin-left:auto;max-width:44ch;line-height:1.55}
@media(max-width:760px){.blk-h p{margin-left:0;flex-basis:100%}}
.blk-b{padding:6px 20px 16px}

/* question rows */
.q{display:flex;gap:11px;padding:11px 0;border-bottom:1px solid color-mix(in srgb, var(--line-soft) 70%, transparent);font-size:13.5px;animation:rise .4s var(--sp) both}
.q:last-child{border-bottom:none}
@keyframes rise{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
.q .fl{width:16px;height:16px;flex-shrink:0;margin-top:2px;display:grid;place-items:center;font-size:9px;font-family:var(--font-mono)}
.q .fl.no{border:1px solid color-mix(in srgb, var(--warn) 35%, transparent);color:var(--warn)}
.q .fl.ok{border:1px solid color-mix(in srgb, var(--ok) 30%, transparent);color:var(--ok)}
.q .txt{flex:1;line-height:1.5;color:var(--chalk)}
.q .meta{font-family:var(--font-mono);font-size:9.5px;color:var(--dim);margin-top:4px;letter-spacing:.05em}

/* bars */
.bar{display:flex;align-items:center;gap:12px;padding:7px 0;font-size:12.5px}
.bar .nm{width:44%;color:var(--mute);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar .tr{flex:1;height:5px;background:color-mix(in srgb, var(--chalk) 4%, transparent);overflow:hidden}
.bar .fi{height:100%;background:linear-gradient(90deg,var(--hi),color-mix(in srgb, var(--hi) 40%, transparent));width:0;transition:width .9s var(--sp)}
.bar .n{width:28px;text-align:right;font-family:var(--font-mono);font-size:10.5px;color:var(--dim)}

/* timeline */
.tl{display:flex;align-items:flex-end;gap:5px;height:96px;padding-top:12px}
.tl .col{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px}
.tl .tb{width:100%;background:linear-gradient(180deg,var(--hi),color-mix(in srgb, var(--hi) 25%, transparent));height:0;transition:height .8s var(--sp);min-height:2px}
.tl .tl-l{font-family:var(--font-mono);font-size:8.5px;color:var(--dim);letter-spacing:.03em}

.empty{padding:26px 0;text-align:center;color:var(--dim);font-size:12.5px;line-height:1.7}
.loading{padding:60px 0;text-align:center;color:var(--dim);font-family:var(--font-mono);font-size:12px;letter-spacing:.1em}
.note{font-family:var(--font-mono);font-size:9.5px;color:var(--dim);text-align:center;padding:26px 0 44px;line-height:1.9;letter-spacing:.04em}
@media(prefers-reduced-motion:reduce){*{animation-duration:.01ms!important;transition-duration:.01ms!important}}
:focus-visible{outline:2px solid var(--hi);outline-offset:3px}
</style>
</head>
<body>


<div id="app">
  <div class="top">
    <div class="wrap top-in">
      <span class="mark"></span>
      <div>
        <b>{{marka}}</b>
        <div class="sub">panel asystenta</div>
      </div>
      <button class="reload" id="rl">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="vertical-align:-1px;margin-right:5px"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>ODŚWIEŻ
      </button>
    </div>
  </div>
  <div class="wrap" id="out"><div class="loading">WCZYTYWANIE…</div></div>
  <div class="wrap"><div class="note">
    Rejestrowana jest wyłącznie treść pytań i informacja, czy asystent znalazł odpowiedź.<br>
    Nie zapisujemy adresów IP ani danych pozwalających zidentyfikować pytającego. Wpisy wygasają po 90 dniach.
  </div></div>
</div>

<script>
// Panel zyje na hoscie panelowym, za Cloudflare Access. Tozsamosc sprawdza
// Access PRZED Workerem, a /stats dodatkowo weryfikuje podpis tokenu.
// Zadnego klucza w przegladarce nie ma i byc nie moze.
const $=id=>document.getElementById(id);
const esc=s=>{const d=document.createElement('div');d.textContent=s;return d.innerHTML};

$('rl').onclick=()=>{$('rl').classList.add('spin');load().finally(()=>setTimeout(()=>$('rl').classList.remove('spin'),400))};

function ago(ts){
  const m=Math.floor((Date.now()-ts)/6e4);
  if(m<1)return'TERAZ';if(m<60)return m+' MIN TEMU';
  const h=Math.floor(m/60);if(h<24)return h+' H TEMU';
  return Math.floor(h/24)+' D TEMU';
}

async function load(silent){
  try{
    const r=await fetch('/stats',{credentials:'same-origin'});
    if(r.status===401||r.status===403){
      $('out').innerHTML='<div class="empty">Sesja wygasła albo nie masz dostępu do tego panelu.<br><span class="mono">Odśwież stronę, żeby zalogować się ponownie.</span></div>';
      return false;
    }
    const d=await r.json();
    if(d.error){
      $('out').innerHTML=\`<div class="empty">\${esc(d.error)}<br><span class="mono">\${esc((d.szczegoly||[]).join(', '))}</span></div>\`;
      return false;
    }
    draw(d);return true;
  }catch(e){
    if(!silent)$('out').innerHTML=\`<div class="empty">Brak połączenia z workerem.<br><span class="mono">\${esc(e.message)}</span></div>\`;
    return false;
  }
}

function draw(d){
  const maxT=Math.max(1,...d.timeline.map(t=>t[1]));
  const maxS=Math.max(1,...d.topSources.map(s=>s.liczba));
  $('out').innerHTML=\`
  <div class="rail">
    <div class="cell"><b>\${d.total}</b><span>pytań łącznie</span></div>
    <div class="cell good"><b>\${d.answered}</b><span>z odpowiedzią</span></div>
    <div class="cell alert"><b>\${d.gaps}</b><span>bez odpowiedzi</span></div>
    <div class="cell \${d.gapRate>30?'alert':''}"><b>\${d.gapRate}%</b><span>luk w dokumentacji</span></div>
  </div>

  <div class="blk">
    <div class="blk-h"><span class="idx">/ 01</span><h2>Czego brakuje w dokumentacji</h2>
      <p>Każde pytanie z tej listy to odwiedzający, który nie dostał odpowiedzi. Uzupełnienie tych tematów bezpośrednio zmniejsza liczbę odesłań do biura.</p></div>
    <div class="blk-b">\${d.gapQuestions.length?d.gapQuestions.map((g,i)=>\`
      <div class="q" style="animation-delay:\${i*35}ms"><span class="fl no">△</span>
      <span class="txt">\${esc(g.q)}<span class="meta">\${ago(g.ts)}</span></span></div>\`).join('')
      :'<div class="empty">Brak pytań bez odpowiedzi.<br>Dokumentacja pokrywa wszystko, o co pytano.</div>'}</div>
  </div>

  <div class="blk">
    <div class="blk-h"><span class="idx">/ 02</span><h2>Najczęściej używane sekcje</h2>
      <p>Tematy, które najbardziej interesują odwiedzających — warto je rozbudować lub wyeksponować na stronie.</p></div>
    <div class="blk-b">\${d.topSources.length?d.topSources.map(s=>\`
      <div class="bar"><span class="nm" title="\${esc(s.tytul)}">\${esc(s.tytul)}</span>
      <span class="tr"><span class="fi" data-w="\${(s.liczba/maxS)*100}"></span></span>
      <span class="n">\${s.liczba}</span></div>\`).join(''):'<div class="empty">Brak danych.</div>'}</div>
  </div>

  <div class="blk">
    <div class="blk-h"><span class="idx">/ 03</span><h2>Aktywność</h2>
      <p>Liczba pytań w kolejnych dniach.</p></div>
    <div class="blk-b">\${d.timeline.length?\`<div class="tl">\${d.timeline.map(t=>\`
      <div class="col"><span class="tb" data-h="\${(t[1]/maxT)*72}" title="\${t[1]}"></span>
      <span class="tl-l">\${t[0].slice(5)}</span></div>\`).join('')}</div>\`:'<div class="empty">Brak danych.</div>'}</div>
  </div>

  <div class="blk">
    <div class="blk-h"><span class="idx">/ 04</span><h2>Ostatnie pytania</h2>
      <p>Pełny rejestr z informacją, czy asystent znalazł odpowiedź i z której sekcji skorzystał.</p></div>
    <div class="blk-b">\${d.recentQuestions.length?d.recentQuestions.map((r,i)=>\`
      <div class="q" style="animation-delay:\${i*25}ms"><span class="fl \${r.gap?'no':'ok'}">\${r.gap?'△':'✓'}</span>
      <span class="txt">\${esc(r.q)}<span class="meta">\${ago(r.ts)}\${r.source?' · '+esc(r.source):''}</span></span></div>\`).join('')
      :'<div class="empty">Brak pytań.</div>'}</div>
  </div>\`;

  requestAnimationFrame(()=>{
    document.querySelectorAll('.fi').forEach(e=>e.style.width=e.dataset.w+'%');
    document.querySelectorAll('.tb').forEach(e=>e.style.height=e.dataset.h+'px');
  });
}

load();
</script>
{{przelacznikDemo}}
</body>
</html>
`;
