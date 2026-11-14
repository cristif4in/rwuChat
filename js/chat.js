/* ---- AI Connection (loaded from ai.key file or settings) ---- */
// CONFIG is populated at startup by init.js → loadConfig().
// It tries: 1) fetch('ai.key') or fetch('ai.env') next to index.html,
//           2) encrypted localStorage (set via Settings → "Connect your own AI").
let CONFIG = { url: '', key: '', mcp: '', mode: 'local' };

function buildHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (CONFIG.key) h['Authorization'] = 'Bearer ' + CONFIG.key;
  if (CONFIG.url && CONFIG.url.includes('ngrok')) h['ngrok-skip-browser-warning'] = 'true';
  return h;
}

function streamEndpoint() {
  return CONFIG.url.replace(/\/$/, '') + '/chat/stream';
}

// Simple obfuscation for localStorage (not real crypto, but prevents
// casual snooping via devtools → Application → localStorage).
function encryptConfig(cfg) {
  try { return btoa(encodeURIComponent(JSON.stringify(cfg))) } catch { return '' }
}
function decryptConfig(str) {
  try { return JSON.parse(decodeURIComponent(atob(str))) } catch { return null }
}

function saveSettingsConfig(cfg) {
  try { localStorage.setItem('chat.ai', encryptConfig(cfg)) } catch {}
}
function loadSettingsConfig() {
  try {
    const s = localStorage.getItem('chat.ai');
    return s ? decryptConfig(s) : null;
  } catch { return null }
}

// Parse ai.key / ai.env file content. Format:
//   URL: https://...
//   API_KEY: sk-...
//   MCP: https://...
// Keys can be in any order, spaces after : are OK.
function parseKeyFile(content) {
  const cfg = { url: '', key: '', mcp: '' };
  for (const line of content.split('\n')) {
    const m = line.match(/^(\w+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toUpperCase(), val = m[2].trim();
    if (key === 'URL' || key === 'ENDPOINT' || key === 'API_URL') cfg.url = val;
    else if (key === 'API_KEY' || key === 'KEY' || key === 'TOKEN') cfg.key = val;
    else if (key === 'MCP' || key === 'MCP_URL') cfg.mcp = val;
  }
  return cfg;
}

// Try to load config from ai.key (or ai.env) file next to index.html.
// Works on static hosts (HTTP). On file:// this may be blocked by CORS —
// in that case we fall back to settings-stored config.
async function loadKeyFile() {
  for (const name of ['ai.key', 'ai.env']) {
    try {
      const res = await fetch(name);
      if (res.ok) {
        const text = await res.text();
        return { ...parseKeyFile(text), _source: name };
      }
    } catch {}
  }
  return null;
}

// Full config loader: ai.key file → settings → empty
async function loadConfig() {
  // 1. Try ai.key file
  const fileCfg = await loadKeyFile();
  if (fileCfg && (fileCfg.url || fileCfg.key)) {
    CONFIG.url = fileCfg.url;
    CONFIG.key = fileCfg.key;
    CONFIG.mcp = fileCfg.mcp || '';
    CONFIG.mode = 'local';
    CONFIG._source = fileCfg._source;
    console.log('[AI] Config from ' + fileCfg._source);
    return;
  }
  // 2. Try settings (encrypted localStorage)
  const saved = loadSettingsConfig();
  if (saved && (saved.url || saved.key)) {
    CONFIG.url = saved.url || '';
    CONFIG.key = saved.key || '';
    CONFIG.mcp = saved.mcp || '';
    CONFIG.mode = saved.mode || 'local';
    CONFIG._source = 'settings';
    console.log('[AI] Config from settings');
    return;
  }
  // 3. No config — user will need to set it up
  CONFIG._source = 'none';
  console.warn('[AI] No config found. Put an ai.key file next to index.html or configure via Settings.');
}

function hasValidConfig() {
  return !!(CONFIG.url && CONFIG.key);
}

// Format error messages — verbose in local mode, simple in cloud mode
function formatAIError(err, context) {
  if (CONFIG.mode === 'local') {
    // Verbose: include status, body, context
    let msg = err.message || String(err);
    if (err.status) msg += ` (HTTP ${err.status})`;
    if (err.body) msg += ` — ${err.body.slice(0, 200)}`;
    if (context) msg += ` [${context}]`;
    return msg;
  } else {
    // Cloud: simplified
    if (err.message && err.message.includes('Failed to fetch')) {
      return "Couldn't reach the AI server. It may be down or unreachable.";
    }
    return err.message || 'An error occurred.';
  }
}

async function* streamFromAPI(messages, signal, opts = {}) {
  if (!hasValidConfig()) {
    const e = new Error('No AI configured. Put an ai.key file next to index.html, or go to Settings → "Connect your own AI".');
    e._noConfig = true;
    throw e;
  }
  const body = {
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    thinking: false,
    max_tokens: opts.max_tokens || 2048,
    stream: true
  };
  if (opts.system) body.system = opts.system;

  let res;
  try {
    res = await fetch(streamEndpoint(), {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(body),
      signal
    });
  } catch (e) {
    if (signal.aborted) return;
    // Network error — host unreachable / down
    const err = new Error(CONFIG.mode === 'local'
      ? `Connection failed: ${e.message}. Endpoint: ${streamEndpoint()}`
      : "Couldn't reach the AI server. It may be down.");
    err._hostUnreachable = true;
    throw err;
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    const err = new Error(formatAIError(
      { status: res.status, body: errText, message: 'API error ' + res.status },
      'POST ' + streamEndpoint()
    ));
    throw err;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') return;
      try {
        const json = JSON.parse(data);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {}
    }
  }
}

async function* getReply(messages, signal, opts = {}) {
  yield* streamFromAPI(messages, signal, opts);
}

/* ---- Helpers ---- */
async function copyText(t){
  try{await navigator.clipboard.writeText(t)}
  catch{const a=document.createElement('textarea');a.value=t;document.body.append(a);a.select();document.execCommand('copy');a.remove()}
}
function flash(b,t){const o=b.dataset.o||(b.dataset.o=b.textContent);b.textContent=t;setTimeout(()=>b.textContent=o,1500)}
function dl(name,data,type='text/plain'){
  const a=document.createElement('a'),u=URL.createObjectURL(new Blob([data],{type}));
  a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);
}
const nearBottom=()=>log.scrollHeight-log.scrollTop-log.clientHeight<120;
const toBottom=()=>{log.scrollTop=log.scrollHeight};
/* ---- Chat ---- */
function addMsg(role){
  const m=document.createElement('div');
  m.className='msg '+role;
  m.innerHTML='<div class="body"></div><div class="tools"></div>';
  msgs.appendChild(m);
  return m;
}
const stat=(tok,ms,live)=>`<span class="stat${live?' live':''}"><b>${(tok/(ms/1000)).toFixed(1)}</b> tok/s · ${tok} tokens · ${(ms/1000).toFixed(1)}s</span>`;
function tools(m,o){
  m.querySelector('.tools').innerHTML=(o.content?'<button data-a="cm">Copy</button>'+(o.role==='user'?'<button data-a="ed">Edit</button>':'') : '')
    +(o.role==='user'?'':'<button data-a="rg" class="rg">Regenerate</button>')+(o.tps?stat(o.tok,o.ms):'');
}
function fill(m,o){
  const b=m.firstChild;
  if(o.role==='user')b.textContent=o.content;
  else renderBlocks(b,md(o.content));
  tools(m,o);
}
const markLast=()=>$$('.rg').forEach((b,i,a)=>i<a.length-1&&b.remove());
function setBusy(b){
  busy=b;document.body.classList.toggle('busy',b);
  send.innerHTML=b?ICON_STOP:ICON_SEND;
  send.setAttribute('aria-label',b?'Stop':'Send');
  updateSendState();
}
function render(){
  const ch=cur();
  msgs.innerHTML='';
  ch.msgs.forEach(o=>{const m=addMsg(o.role==='user'?'user':'ai');m._msg=o;fill(m,o)});
  // Re-attach the in-progress AI message element if this chat is
  // mid-response (e.g. user switched away then came back).
  if(ch._stream&&ch._stream.m){msgs.appendChild(ch._stream.m)}
  ch._unread=false;  // user is viewing this chat now
  markLast();empty.hidden=!!ch.msgs.length;tabsRender();toBottom();syncBusy();
}

async function respond(){
  const ch=cur();
  const ctl=ch._abort=new AbortController();
  ch._responding=true;
  const m=addMsg('ai'),body=m.firstChild,tl=m.lastChild;
  ch._stream={m,body,tl,out:''};  // re-attached by render() if user switches
  body.innerHTML=DOTS;toBottom();
  syncBusy();updateTabDots();
  let out='',tok=0,t0=0,err=false;

  let sendMsgs = ch.msgs.slice();
  let opts = {};

  if (S.system && S.system.trim()) {
    opts.system = S.system.trim();
  }
  // Inject MCP tool awareness so the AI knows what's available.
  const mcpPrompt = mcpBuildSystemPrompt();
  if (mcpPrompt) {
    opts.system = (opts.system ? opts.system + '\n' : '') + mcpPrompt;
  }

  try{
    for await(const c of getReply(sendMsgs, ctl.signal, opts)){
      const now = performance.now(); if(!t0) t0 = now;
      const st = nearBottom(); out += c; tok += tk(c);
      ch._stream.out = out;
      // Always update the element (works even if detached); visible
      // again when render() re-attaches it on switch-back.
      renderBlocks(body, md(out));
      if(cur() === ch){
        if(now - t0 > 300) tl.innerHTML = stat(tok, now - t0, true);
        if(st) toBottom();
      }
    }
  } catch(e){
    if(!ctl.signal.aborted){
      // Host unreachable / no config — clear the failed exchange entirely
      if (e._hostUnreachable || e._noConfig) {
        m.remove();
        const lastIdx = ch.msgs.length - 1;
        if (lastIdx >= 0 && ch.msgs[lastIdx].role === 'user') ch.msgs.splice(lastIdx);
        ch._responding = false; ch._abort = null; ch._stream = null;
        if (cur() === ch) { render(); toast(formatAIError(e)); }
        save();
        return;
      }
      err = true;
      body.innerHTML = `<p class="err">${esc(formatAIError(e, 'respond'))}</p>`;
      console.error('[AI] respond failed:', e);
    }
  }

  if (out) {
    body._anim = new Set();
    renderBlocks(body, md(out));
    if (cur() === ch) toBottom();
  }

  const ms=t0?performance.now()-t0:0,o={role:'assistant',content:out};
  if(out){Object.assign(o,{tok,ms:Math.round(ms),tps:ms>0?tok/(ms/1000):0});ch.msgs.push(o);m._msg=o}
  else if(!err&&!ctl.signal.aborted)body.innerHTML='<p class="err">Stopped before any reply arrived.</p>';
  ch._responding=false;ch._abort=null;ch._stream=null;ch.t=Date.now();
  if(cur()===ch){
    syncBusy();tools(m,o);markLast();input.focus();
  }else{
    // Background completion — mark the tab so the user knows there's new content.
    ch._unread=true;
  }
  updateTabDots();save();
}

// Reflect the CURRENT chat's responding state in the global busy flag.
function syncBusy(){const ch=cur();setBusy(!!(ch&&ch._responding))}
// Toggle .responding / .unread on existing tab elements without a full rebuild.
function updateTabDots(){
  chats.forEach(ch=>{
    const tab=document.querySelector(`.tab[data-id="${ch.id}"]`);
    if(tab){tab.classList.toggle('responding',!!ch._responding);tab.classList.toggle('unread',!!ch._unread)}
  });
}

function updateSendState() {
  const hasText = input.value.trim().length > 0;
  const hasTags = $('#tags').children.length > 0;
  if(busy) {
    send.disabled = false;
  } else {
    send.disabled = !hasText && !hasTags;
  }
}

function submit(t){
  t=t.trim();if(!t||busy)return;
  // /mcp command — opens the MCP dialog.
  //   /mcp                 → just open the dialog
  //   /mcp <url>           → open dialog, pre-fill URL, auto-connect
  //   /mcp <url> <auth...> → open dialog, pre-fill URL + auth, auto-connect
  if(t.toLowerCase()==='/mcp'||t.toLowerCase().startsWith('/mcp ')){
    const rest=t.slice(4).trim();
    input.value='';resize();updateCharCount();
    openMcpDialog();
    if(rest){
      // First whitespace-separated token = URL; remainder = optional auth header.
      const sp=rest.search(/\s/);
      let url,auth;
      if(sp>=0){url=rest.slice(0,sp).trim();auth=rest.slice(sp+1).trim()}
      else{url=rest;auth=''}
      $('#mcp-url').value=url;
      $('#mcp-auth').value=auth;
      // Auto-connect only if it looks like a real URL.
      if(/^https?:\/\//i.test(url)) mcpDoConnect();
    }
    return;
  }
  if(t.length>42512) {
    toast('Message exceeds 42,512 character limit.');
    return;
  }
  
  const tags = [...$('#tags').querySelectorAll('.tag')].map(el => `[${el.dataset.name}] `).join('');
  const fullMsg = (tags + t).trim();

  const ch=cur(),o={role:'user',content:fullMsg};
  ch.msgs.push(o);ch.t=Date.now();
  if(ch.auto&&ch.msgs.length===1)ch.title=title(fullMsg);
  empty.hidden=true;
  const m=addMsg('user');m._msg=o;fill(m,o);
  input.value='';$('#tags').innerHTML='';resize();updateCharCount();tabsRender();respond();
}

function resize(){
  input.style.height='auto';
  input.style.height=Math.min(input.scrollHeight,200)+'px';
  updateSendState();
}
const grow=t=>{t.style.height='auto';t.style.height=t.scrollHeight+'px'};

function updateCharCount(){
  const len = input.value.length;
  const wrap = $('#charwrap');
  const cnt = $('#charcount');
  if(len > 0) {
    wrap.style.display = 'block';
    cnt.textContent = len.toLocaleString();
    wrap.classList.toggle('warn', len > 40000);
  } else {
    wrap.style.display = 'none';
  }
}

function edit(m){
  const o=m._msg;if(!o||busy||m.classList.contains('editing')||o.role!=='user')return;
  const b=m.firstChild;
  m.classList.add('editing');
  b.innerHTML=`<textarea class="ed" aria-label="Edit message"></textarea><div class="edbar"><span>Replies after this message will be regenerated</span><button class="ghost" data-a="ec">Cancel</button><button class="primary" data-a="es">Save &amp; resend</button></div>`;
  const ta=b.firstChild;ta.value=o.content;grow(ta);ta.focus();ta.setSelectionRange(ta.value.length,ta.value.length);
}
