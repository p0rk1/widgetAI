// panel-internal.js — szablon HTML panelu analitycznego bota wewnętrznego (BudMax).
// Wydzielone do osobnego modułu, aby worker.js mógł serwować go na endpoint /panel.

export const PANEL_INTERNAL_HTML = `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{tytulPanelWew}}</title>
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

/* header */
.top{border-bottom:1px solid var(--line);position:sticky;top:0;background:color-mix(in srgb, var(--void) 86%, transparent);backdrop-filter:blur(16px) saturate(150%);z-index:50}
.top-in{display:flex;align-items:center;gap:13px;height:68px}
.mark{width:10px;height:10px;background:var(--hi);flex-shrink:0;position:relative}
.mark::after{content:"";position:absolute;inset:-5px;border:1px solid var(--hi);opacity:calc(var(--ramka-akcentu) * .35)}
.top b{font-family:var(--font-naglowek);font-weight:800;font-size:15px;letter-spacing:.02em}
.top .sub{font-family:var(--font-mono);font-size:10px;color:var(--dim);letter-spacing:.12em;text-transform:uppercase}
.badge-internal{font-family:var(--font-mono);font-size:9.5px;padding:3px 8px;border:1px solid var(--blue);color:var(--blue);background:color-mix(in srgb, var(--blue) 6%, transparent);letter-spacing:.08em;margin-left:6px;text-transform:uppercase}
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
.cell.danger::before{background:var(--danger)}
.cell b{font-family:var(--font-naglowek);font-weight:700;font-size:32px;letter-spacing:-.03em;display:block;line-height:1}
.cell.alert b{color:var(--warn)}
.cell.good b{color:var(--ok)}
.cell.danger b{color:var(--danger)}
.cell span{font-family:var(--font-mono);font-size:9.5px;color:var(--dim);letter-spacing:.13em;text-transform:uppercase;margin-top:8px;display:block}

/* blocks */
.blk{border:1px solid var(--line-soft);background:linear-gradient(180deg,color-mix(in srgb, var(--panel) 60%, transparent),transparent);margin-bottom:16px}
.blk-h{padding:17px 20px;border-bottom:1px solid var(--line-soft);display:flex;align-items:baseline;gap:13px;flex-wrap:wrap}
.blk-h .idx{font-family:var(--font-mono);font-size:10px;color:var(--hi);letter-spacing:.14em}
.blk-h h2{font-family:var(--font-naglowek);font-weight:600;font-size:16px;letter-spacing:-.01em;margin:0}
.blk-h p{color:var(--dim);font-size:12px;margin:0;margin-left:auto;max-width:48ch;line-height:1.55}
@media(max-width:760px){.blk-h p{margin-left:0;flex-basis:100%}}
.blk-b{padding:6px 20px 16px}

/* question rows */
.q{display:flex;gap:11px;padding:11px 0;border-bottom:1px solid color-mix(in srgb, var(--line-soft) 70%, transparent);font-size:13.5px;animation:rise .4s var(--sp) both}
.q:last-child{border-bottom:none}
@keyframes rise{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
.q .fl{width:16px;height:16px;flex-shrink:0;margin-top:2px;display:grid;place-items:center;font-size:9px;font-family:var(--font-mono)}
.q .fl.no{border:1px solid color-mix(in srgb, var(--warn) 35%, transparent);color:var(--warn)}
.q .fl.ok{border:1px solid color-mix(in srgb, var(--ok) 30%, transparent);color:var(--ok)}
.q .fl.esc{border:1px solid color-mix(in srgb, var(--danger) 50%, transparent);color:var(--danger);font-weight:bold}
.q .txt{flex:1;line-height:1.5;color:var(--chalk)}
.q .meta{font-family:var(--font-mono);font-size:9.5px;color:var(--dim);margin-top:4px;letter-spacing:.05em;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.tag-esc{display:inline-block;padding:1px 6px;font-size:8.5px;text-transform:uppercase;border-radius:2px;letter-spacing:.06em}
.tag-esc.pilne{background:color-mix(in srgb, var(--danger) 15%, transparent);border:1px solid var(--danger);color:var(--danger)}
.tag-esc.standard{background:color-mix(in srgb, var(--warn) 12%, transparent);border:1px solid var(--warn);color:var(--warn)}

/* grid cards for escalations */
.grid-esc{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;padding:12px 0 6px}
.card-esc{border-radius:var(--promien);background:color-mix(in srgb, var(--chalk) 1.5%, transparent);border:1px solid var(--line-soft);padding:14px}
.card-esc.active{border-color:var(--line);background:color-mix(in srgb, var(--chalk) 2.5%, transparent)}
.card-esc b{font-family:var(--font-naglowek);font-size:20px;display:block;margin-bottom:4px}
.card-esc.danger b{color:var(--danger)}
.card-esc.warn b{color:var(--warn)}
.card-esc span{font-family:var(--font-mono);font-size:9px;color:var(--dim);text-transform:uppercase;letter-spacing:.08em;display:block}

/* bars */
.bar{display:flex;align-items:center;gap:12px;padding:7px 0;font-size:12.5px}
.bar .nm{width:44%;color:var(--mute);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar .tr{flex:1;height:5px;background:color-mix(in srgb, var(--chalk) 4%, transparent);overflow:hidden}
.bar .fi{height:100%;background:linear-gradient(90deg,var(--hi),color-mix(in srgb, var(--hi) 40%, transparent));width:0;transition:width .9s var(--sp)}
.bar .n{width:28px;text-align:right;font-family:var(--font-mono);font-size:10.5px;color:var(--dim)}

/* timeline */
.tl{display:flex;align-items:flex-end;gap:5px;height:96px;padding-top:12px}
.tl .col{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px}
.tl .tb{width:100%;background:linear-gradient(180deg,var(--blue),color-mix(in srgb, var(--blue) 20%, transparent));height:0;transition:height .8s var(--sp);min-height:2px}
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
        <span class="badge-internal">wewnętrzny</span>
        <div class="sub">{{podtytulPanelWew}}</div>
      </div>
      <button class="reload" id="rl">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="vertical-align:-1px;margin-right:5px"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>ODŚWIEŻ
      </button>
    </div>
  </div>

  <div class="wrap" id="out"><div class="loading">WCZYTYWANIE DANYCH ACCESS…</div></div>

  <div class="wrap"><div class="note">
    Rejestrowana jest wyłącznie treść pytań, wynik wyszukiwania i kategoria ewentualnej eskalacji.<br>
    Nie zapisujemy kto zadał pytanie — żaden wpis nie jest powiązany z nazwiskiem ani adresem e-mail.<br>
    Wpisy wygasają automatycznie po 90 dniach.
  </div></div>
</div>

<script>
const $=id=>document.getElementById(id);
const esc=s=>{const d=document.createElement('div');d.textContent=s;return d.innerHTML};

$('rl').onclick=()=>{
  $('rl').classList.add('spin');
  load().finally(()=>setTimeout(()=>$('rl').classList.remove('spin'),400));
};

function ago(ts){
  const m=Math.floor((Date.now()-ts)/6e4);
  if(m<1)return'TERAZ';if(m<60)return m+' MIN TEMU';
  const h=Math.floor(m/60);if(h<24)return h+' H TEMU';
  return Math.floor(h/24)+' D TEMU';
}

const KATEGORIE = {{eskalacjeJson}};

async function load(){
  try{
    const r = await fetch('/stats-internal', { credentials: 'same-origin' });
    if(r.status === 401 || r.status === 403){
      $('out').innerHTML=\`<div class="empty">Brak autoryzacji Cloudflare Access.<br><span class="mono">Zaloguj się na konto firmowe ({{domenaLogowania}}), aby wyświetlić panel.</span></div>\`;
      return;
    }
    if(r.status === 503){
      $('out').innerHTML=\`<div class="empty">Brak konfiguracji Cloudflare Zero Trust w środowisku.<br><span class="mono">Sprawdź ACCESS_TEAM_DOMAIN i ACCESS_AUD.</span></div>\`;
      return;
    }
    const d = await r.json();
    if(d.error){
      $('out').innerHTML=\`<div class="empty">Błąd: \${esc(d.error)}</div>\`;
      return;
    }
    draw(d);
  }catch(e){
    $('out').innerHTML=\`<div class="empty">Brak połączenia z workerem.<br><span class="mono">\${esc(e.message)}</span></div>\`;
  }
}

function draw(d){
  const maxT = Math.max(1, ...(d.timeline || []).map(t=>t[1]));
  const maxS = Math.max(1, ...(d.topSources || []).map(s=>s.liczba));
  const totalEsc = d.eskalacje?.total || 0;
  const escKategorie = d.eskalacje?.byKategoria || {};

  $('out').innerHTML=\`
  <div class="rail">
    <div class="cell"><b>\${d.total}</b><span>pytań pracowników</span></div>
    <div class="cell good"><b>\${d.answered}</b><span>z procedurą w bazie</span></div>
    <div class="cell alert"><b>\${d.gaps}</b><span>luki szkoleniowe</span></div>
    <div class="cell \${totalEsc>0?'danger':''}"><b>\${totalEsc}</b><span>eskalacji / incydentów</span></div>
  </div>

  <div class="blk">
    <div class="blk-h"><span class="idx">/ 01</span><h2>Luki w procedurach i szkoleniach</h2>
      <p>Pytania {{zrodloPytan}}, na które asystent nie znalazł procedury. To bezpośrednia lista tematów do uzupełnienia w wytycznych lub omówienia na naradzie.</p></div>
    <div class="blk-b">\${(d.gapQuestions && d.gapQuestions.length)?d.gapQuestions.map((g,i)=>\`
      <div class="q" style="animation-delay:\${i*35}ms"><span class="fl no">△</span>
      <span class="txt">\${esc(g.q)}<span class="meta">\${ago(g.ts)}</span></span></div>\`).join('')
      :'<div class="empty">Brak pytań bez odpowiedzi.<br>Baza procedur pokrywa wszystkie bieżące zapytania załogi.</div>'}</div>
  </div>

  <div class="blk">
    <div class="blk-h"><span class="idx">/ 02</span><h2>Zdarzenia i eskalacje operacyjne</h2>
      <p>Sytuacje, w których asystent skierował pracownika do przełożonego zamiast odpowiadać samodzielnie.</p></div>
    <div class="blk-b">
      <div class="grid-esc">
        \${Object.entries(KATEGORIE).map(([id,k])=>\`
        <div class="card-esc \${escKategorie[id]?(k.pilne?'active danger':'active warn'):''}">
          <b>\${escKategorie[id] || 0}</b>
          <span>\${k.nazwa}</span>
        </div>\`).join('')}
      </div>
    </div>
  </div>

  <div class="blk">
    <div class="blk-h"><span class="idx">/ 03</span><h2>Najczęściej sprawdzane procedury</h2>
      <p>Wytyczne, do których pracownicy zaglądają najczęściej podczas pracy.</p></div>
    <div class="blk-b">\${(d.topSources && d.topSources.length)?d.topSources.map(s=>\`
      <div class="bar"><span class="nm" title="\${esc(s.tytul)}">\${esc(s.tytul)}</span>
      <span class="tr"><span class="fi" data-w="\${(s.liczba/maxS)*100}"></span></span>
      <span class="n">\${s.liczba}</span></div>\`).join(''):'<div class="empty">Brak danych.</div>'}</div>
  </div>

  <div class="blk">
    <div class="blk-h"><span class="idx">/ 04</span><h2>Aktywność załogi</h2>
      <p>Liczba zapytań wewnętrznych w ostatnich 14 dniach.</p></div>
    <div class="blk-b">\${(d.timeline && d.timeline.length)?\`<div class="tl">\${d.timeline.map(t=>\`
      <div class="col"><span class="tb" data-h="\${(t[1]/maxT)*72}" title="\${t[1]} zapytań"></span>
      <span class="tl-l">\${t[0].slice(5)}</span></div>\`).join('')}</div>\`:'<div class="empty">Brak danych o aktywności.</div>'}</div>
  </div>

  <div class="blk">
    <div class="blk-h"><span class="idx">/ 05</span><h2>Ostatnie pytania {{zrodloPytan}}</h2>
      <p>Rejestr zapytań z oznaczeniem znalezionej procedury i statusu eskalacji.</p></div>
    <div class="blk-b">\${(d.recentQuestions && d.recentQuestions.length)?d.recentQuestions.map((r,i)=>\`
      <div class="q" style="animation-delay:\${i*25}ms">
        <span class="fl \${r.eskalacja?'esc':(r.gap?'no':'ok')}">\${r.eskalacja?'!':(r.gap?'△':'✓')}</span>
        <span class="txt">\${esc(r.q)}
          <span class="meta">
            \${ago(r.ts)}
            \${r.source ? \` · Źródło: \${esc(r.source)}\` : ''}
            \${r.eskalacja ? \`<span class="tag-esc \${KATEGORIE[r.eskalacja]?.pilne?'pilne':'standard'}">\${KATEGORIE[r.eskalacja]?.nazwa || esc(r.eskalacja)}</span>\` : ''}
          </span>
        </span>
      </div>\`).join('')
      :'<div class="empty">Brak zarejestrowanych pytań.</div>'}</div>
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
