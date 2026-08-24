// app-internal.js — szablon HTML interfejsu bota pracowniczego (BudMax Mobile-first / PWA).
// Wydzielone do osobnego modułu, serwowane przez worker.js na GET / na hoście wewnętrznym.

export const APP_INTERNAL_HTML = `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="theme-color" content="{{themeColor}}">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<title>{{tytulApp}}</title>
{{fontyLink}}
<style>
{{motywCss}}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
body{
  margin:0;background:var(--void);color:var(--chalk);
  font-family:var(--font-tekst);-webkit-font-smoothing:antialiased;
  display:flex;flex-direction:column;min-height:100vh;min-height:100dvh;
}
body::before{
  content:"";position:fixed;inset:0;z-index:0;pointer-events:none;opacity:var(--siatka-krycie);
  background-image:linear-gradient(var(--line-soft) 1px,transparent 1px),linear-gradient(90deg,var(--line-soft) 1px,transparent 1px);
  background-size:var(--siatka-rozmiar) var(--siatka-rozmiar);
}
.mono{font-family:var(--font-mono)}

/* topbar */
.top{
  border-bottom:1px solid var(--line);position:sticky;top:0;
  background:color-mix(in srgb, var(--void) 92%, transparent);backdrop-filter:blur(var(--rozmycie));z-index:50;
}
.top-in{
  max-width:760px;margin:0 auto;padding:0 16px;height:58px;
  display:flex;align-items:center;gap:12px;
}
.mark{width:10px;height:10px;background:var(--hi);flex-shrink:0;position:relative}
.mark::after{content:"";position:absolute;inset:-4px;border:1px solid var(--hi);opacity:calc(var(--ramka-akcentu) * .35)}
.brand{font-family:var(--font-naglowek);font-weight:800;font-size:15px;letter-spacing:var(--trop)}
.tag-int{
  font-family:var(--font-mono);font-size:9px;padding:2px 7px;
  border:1px solid var(--blue);color:var(--blue);background:color-mix(in srgb, var(--blue) 8%, transparent);
  text-transform:uppercase;letter-spacing:.06em;
}
.nav-links{margin-left:auto;display:flex;gap:8px}
.btn-nav{
  background:transparent;border:1px solid var(--line);color:var(--mute);
  padding:6px 11px;font-family:var(--font-mono);font-size:10px;letter-spacing:.06em;
  text-decoration:none;display:inline-flex;align-items:center;gap:5px;
  transition:all .2s var(--sp);
}
.btn-nav:hover{border-color:var(--hi);color:var(--hi)}

/* main layout */
.main{
  flex:1;max-width:760px;width:100%;margin:0 auto;padding:16px;
  position:relative;z-index:1;display:flex;flex-direction:column;gap:16px;
}

/* quick chips */
.chips-wrap{overflow-x:auto;padding-bottom:4px;scrollbar-width:none}
.chips-wrap::-webkit-scrollbar{display:none}
.chips{display:flex;gap:8px;width:max-content}
.chip{border-radius:var(--promien);
  background:var(--panel);border:1px solid var(--line);color:var(--chalk);
  padding:8px 12px;font-size:12px;font-family:var(--font-tekst);font-weight:500;
  cursor:pointer;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;
  transition:all .2s var(--sp);
}
.chip-nr{font-family:var(--font-mono);font-size:9px;color:var(--dim);margin-right:7px;letter-spacing:.06em}
.chip:hover .chip-nr,.chip.danger-chip .chip-nr{color:inherit;opacity:.7}
.chip:active{transform:scale(.97)}
.chip:hover{border-color:var(--hi);background:color-mix(in srgb, var(--hi) 6%, transparent)}
.chip.danger-chip{border-color:color-mix(in srgb, var(--danger) 35%, transparent);color:var(--danger)}
.chip.danger-chip:hover{border-color:var(--danger);background:color-mix(in srgb, var(--danger) 10%, transparent)}

/* chat feed */
.feed{flex:1;display:flex;flex-direction:column;gap:14px}

.msg{display:flex;flex-direction:column;gap:4px;max-width:92%;animation:rise .3s var(--sp)}
@keyframes rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}

.msg.user{align-self:flex-end}
.msg.user .bubble{
  background:linear-gradient(135deg,color-mix(in srgb, var(--hi) 20%, transparent),color-mix(in srgb, var(--hi) 8%, transparent));
  border:1px solid color-mix(in srgb, var(--hi) 40%, transparent);color:var(--chalk);
  padding:12px 16px;font-size:14px;line-height:1.5;
}

.msg.bot{align-self:flex-start;max-width:100%}
.msg.bot .bubble{
  background:var(--panel);border:1px solid var(--line);
  padding:16px;font-size:14.5px;line-height:1.6;color:var(--chalk);position:relative;
}

/* escalation banners */
.alert-box{
  margin-bottom:12px;padding:10px 12px;display:flex;gap:10px;align-items:flex-start;
  font-family:var(--font-mono);font-size:11.5px;letter-spacing:.02em;
}
.alert-box.pilne{
  background:color-mix(in srgb, var(--danger) 14%, transparent);border:1px solid var(--danger);color:#FFBDBD;
}
.alert-box.standard{
  background:color-mix(in srgb, var(--warn) 12%, transparent);border:1px solid var(--warn);color:#FFE0B2;
}
.alert-box .icon{font-weight:bold;font-size:13px}

/* steps formatting */
.msg.bot .step-row{
  display:flex;gap:8px;margin-top:6px;align-items:baseline;
}
.msg.bot .step-num{
  font-family:var(--font-mono);font-size:11px;color:var(--hi);font-weight:bold;
  width:16px;flex-shrink:0;
}
.msg.bot .podstawa{
  margin-top:12px;padding-top:8px;border-top:1px dashed var(--line);
  font-family:var(--font-mono);font-size:10px;color:var(--blue);letter-spacing:.04em;
}

/* meta time */
.msg-meta{
  font-family:var(--font-mono);font-size:9.5px;color:var(--dim);
  padding:0 4px;letter-spacing:.04em;
}
.msg.user .msg-meta{text-align:right}

/* kursor animacji wypisywania — ten sam język co na stronie publicznej */
.pisze::after{
  content:"";display:inline-block;width:6px;height:14px;background:var(--hi);
  margin-left:3px;vertical-align:-2px;animation:mruga .85s step-end infinite;
}
@keyframes mruga{50%{opacity:0}}
@media(prefers-reduced-motion:reduce){.pisze::after{animation:none}}

/* input bar */
.bottom-dock{
  position:sticky;bottom:var(--pasek-demo);background:color-mix(in srgb, var(--void) 95%, transparent);
  backdrop-filter:blur(var(--rozmycie));border-top:1px solid var(--line);
  padding:12px 16px env(safe-area-inset-bottom, 12px);z-index:50;
}
.input-wrap{
  max-width:760px;margin:0 auto;display:flex;gap:8px;align-items:flex-end;
  background:var(--panel);border:1px solid var(--line);padding:6px 8px 6px 12px;
  transition:border-color .2s;
}
.input-wrap:focus-within{border-color:var(--hi)}

textarea{
  flex:1;background:transparent;border:none;color:var(--chalk);
  font-family:var(--font-tekst);font-size:14.5px;
  line-height:1.45;resize:none;max-height:120px;padding:6px 0;outline:none;
}
textarea::placeholder{color:var(--dim)}

.btn-icon{
  width:38px;height:38px;display:grid;place-items:center;
  background:transparent;border:1px solid transparent;color:var(--mute);
  cursor:pointer;flex-shrink:0;transition:all .2s var(--sp);
}
.btn-icon:hover{color:var(--chalk);border-color:var(--line)}
.btn-icon.active-rec{
  color:var(--danger);border-color:var(--danger);background:color-mix(in srgb, var(--danger) 15%, transparent);
  animation:pulse 1.2s infinite;
}
@keyframes pulse{0%{opacity:1}50%{opacity:.5}100%{opacity:1}}

.btn-send{
  width:38px;height:38px;display:grid;place-items:center;
  background:var(--hi);color:#0A0D11;border:none;cursor:pointer;
  flex-shrink:0;transition:all .2s var(--sp);
}
.btn-send:hover{background:color-mix(in srgb, var(--hi) 84%, var(--chalk));transform:translateY(-1px)}
.btn-send:disabled{opacity:.4;cursor:not-allowed;transform:none}

/* loading dots */
.dots{display:inline-flex;gap:4px;padding:4px 0}
.dot{width:5px;height:5px;background:var(--hi);border-radius:50%;animation:dot 1.2s infinite ease-in-out}
.dot:nth-child(2){animation-delay:.2s}
.dot:nth-child(3){animation-delay:.4s}
@keyframes dot{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}

/* note */
.hero-note{
  background:color-mix(in srgb, var(--chalk) 2%, transparent);border:1px dashed var(--line);
  padding:16px;font-size:13px;color:var(--mute);line-height:1.6;
}
.hero-note b{color:var(--chalk);font-family:var(--font-naglowek)}
</style>
</head>
<body>

<div class="top">
  <div class="top-in">
    <span class="mark"></span>
    <span class="brand">{{marka}}</span>
    <span class="znacznik tag-int">baza procedur</span>
    <div class="nav-links">
      <a href="/panel" class="btn-nav" title="Panel kierownictwa">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
        PANEL
      </a>
    </div>
  </div>
</div>

<div class="main">
  <div class="hero-note">
    <b>{{opisTytul}}</b><br>
    {{opisTekst}}
  </div>

  <div class="chips-wrap">
    <div class="chips">
      {{kafle}}
    </div>
  </div>

  <div class="feed" id="feed"></div>
</div>

<div class="bottom-dock">
  <div class="input-wrap">
    <textarea id="inp" rows="1" placeholder="Zadaj pytanie lub podyktuj..."></textarea>
    <button class="btn-icon" id="mic" title="Dyktowanie głosowe">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
    </button>
    <button class="btn-send" id="send" title="Wyślij">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
    </button>
  </div>
</div>

<script>
const $=id=>document.getElementById(id);
const history = [];
let busy = false;

// Auto-expand textarea
$('inp').addEventListener('input', function(){
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

// Chips click
document.querySelectorAll('.chip').forEach(c => {
  c.onclick = () => {
    if(busy) return;
    $('inp').value = c.dataset.q;
    submit();
  };
});

$('send').onclick = submit;
$('inp').addEventListener('keydown', e => {
  if(e.key === 'Enter' && !e.shiftKey){
    e.preventDefault();
    submit();
  }
});

// Speech Recognition (Dyktowanie)
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
if(SpeechRec){
  recognition = new SpeechRec();
  recognition.lang = 'pl-PL';
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    $('mic').classList.add('active-rec');
  };
  recognition.onend = () => {
    $('mic').classList.remove('active-rec');
  };
  recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    $('inp').value = ($('inp').value ? $('inp').value + ' ' : '') + transcript;
    $('inp').dispatchEvent(new Event('input'));
  };
  recognition.onerror = () => {
    $('mic').classList.remove('active-rec');
  };

  $('mic').onclick = () => {
    if($('mic').classList.contains('active-rec')){
      recognition.stop();
    } else {
      try { recognition.start(); } catch(e){}
    }
  };
} else {
  $('mic').style.display = 'none';
}

function timeNow(){
  const d = new Date();
  return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}

function appendUserMsg(text){
  const div = document.createElement('div');
  div.className = 'msg user';
  div.innerHTML = \`<div class="bubble">\${esc(text)}</div><div class="msg-meta">\${timeNow()}</div>\`;
  $('feed').appendChild(div);
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}

function ramkaEskalacji(eskalacja){
  if(!eskalacja) return '';
  const pilne = eskalacja.pilne;
  return \`<div class="alert-box \${pilne?'pilne':'standard'}">
      <span class="icon">\${pilne?'⚠️ PILNE:':'ℹ️ PROCEDURA:'}</span>
      <span>\${pilne ? '{{przelozonyPilne}}' : '{{przelozonyStandard}}'}</span>
    </div>\`;
}

// Wypisywanie znak po znaku. DWA WYJĄTKI, oba świadome:
//
// 1. prefers-reduced-motion — tekst pojawia się od razu. Animacja jest
//    ozdobą, a dla części osób ruch na ekranie to nie ozdoba, tylko problem.
//
// 2. RAMKA ESKALACYJNA NIE CZEKA NA ANIMACJĘ. Przy eskalacji pilnej
//    zlozZEskalacja() stawia tekst ramki na POCZATKU odpowiedzi, wiec
//    pierwszy blok wypisuje się natychmiast, razem z pudełkiem alertu.
//    Sekunda zwłoki w komunikacie „dzwoń pod 112" to zła cena za efekt.
//    Przy eskalacji niepilnej ramka jest na końcu i animuje się normalnie.
const bezRuchu = matchMedia('(prefers-reduced-motion: reduce)').matches;

function wypisz(el, txt){
  return new Promise(res=>{
    el.classList.add('pisze');
    let i = 0;
    const krok = () => {
      i += Math.random() < .3 ? 2 : 1;
      el.textContent = txt.slice(0, i);
      window.scrollTo({ top: document.body.scrollHeight });
      if(i < txt.length) setTimeout(krok, 9);
      else { el.classList.remove('pisze'); res(); }
    };
    krok();
  });
}

async function wypiszOdpowiedz(bubble, ans, eskalacja){
  bubble.innerHTML = ramkaEskalacji(eskalacja);
  const linie = (ans || '').split('\\n').filter(Boolean);
  const natychmiast = (eskalacja && eskalacja.pilne) ? 1 : 0;
  for(let i = 0; i < linie.length; i++){
    const d = document.createElement('div');
    if(linie[i].startsWith('Podstawa:')) d.className = 'podstawa';
    bubble.appendChild(d);
    if(i < natychmiast || bezRuchu){ d.textContent = linie[i]; continue; }
    await wypisz(d, linie[i]);
  }
}

async function submit(){
  const q = $('inp').value.trim();
  if(!q || busy) return;

  busy = true;
  $('send').disabled = true;
  appendUserMsg(q);
  $('inp').value = '';
  $('inp').style.height = 'auto';

  // Placeholder bot msg with dots
  const botDiv = document.createElement('div');
  botDiv.className = 'msg bot';
  botDiv.innerHTML = \`<div class="bubble"><div class="dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div></div><div class="msg-meta">sprawdzam procedury...</div>\`;
  $('feed').appendChild(botDiv);
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });

  try{
    const r = await fetch('/internal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q, history: history.slice(-6) }),
    });

    if(r.status === 401 || r.status === 403){
      botDiv.querySelector('.bubble').innerHTML = \`<div class="alert-box pilne"><span class="icon">🔒</span><span>Wymagana autoryzacja Cloudflare Zero Trust. Zaloguj się przez konto firmowe.</span></div>\`;
      botDiv.querySelector('.msg-meta').textContent = timeNow();
      return;
    }

    const d = await r.json();
    botDiv.querySelector('.msg-meta').textContent = timeNow();
    await wypiszOdpowiedz(botDiv.querySelector('.bubble'), d.answer || "Brak odpowiedzi.", d.eskalacja);

    history.push({ role: 'user', content: q });
    history.push({ role: 'assistant', content: d.answer });
  } catch(e){
    botDiv.querySelector('.bubble').innerHTML = \`Błąd połączenia: \${esc(e.message)}\`;
    botDiv.querySelector('.msg-meta').textContent = timeNow();
  } finally {
    busy = false;
    $('send').disabled = false;
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }
}

function esc(s){
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
</script>
{{przelacznikDemo}}
</body>
</html>
`;
