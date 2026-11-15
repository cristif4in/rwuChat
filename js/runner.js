/* ---- Message interactions ---- */
msgs.addEventListener('click',async e=>{
  const chip=e.target.closest('.fchip');
  if(chip){
    const run=chip.closest('.run');
    run.querySelectorAll('.fchip').forEach(x=>x.classList.toggle('on',x===chip));
    const i=chip.dataset.i;
    run.querySelectorAll('.run-diff .pane').forEach(p=>{p.hidden=p.dataset.i!==i});
    return;
  }

  const b=e.target.closest('[data-a]');
  if(!b){
    const cbh=e.target.closest('.cbh');
    if(cbh&&!e.target.closest('.fname')&&!e.target.closest('button')){
      cbh.closest('.cb').classList.toggle('collapsed');return;
    }
    const rb=e.target.closest('.run-bar');
    if(rb){rb.closest('.run').classList.toggle('open');return}
    return;
  }

  const a=b.dataset.a,m=b.closest('.msg'),ch=cur(),run=b.closest('.run'),cb=b.closest('.cb');

  if(a==='cm'){await copyText(m._msg.content);flash(b,'Copied');return}
  if(a==='ed'){edit(m);return}
  if(a==='ec'){m.classList.remove('editing');fill(m,m._msg);return}
  if(a==='es'){
    const v=m.querySelector('.ed').value.trim(),o=m._msg;
    if(!v||o.role!=='user')return;
    o.content=v;m.classList.remove('editing');
    ch.msgs.length=ch.msgs.indexOf(o)+1;
    while(m.nextSibling)m.nextSibling.remove();
    if(ch.auto&&ch.msgs.length===1)ch.title=title(v);
    fill(m,o);markLast();tabsRender();save();respond();return;
  }
  if(a==='cont'){
    if(busy)return;
    if(!m._msg||!m._msg.unfinished)return;
    respond(true);
    return;
  }
  if(a==='rg'){
    if(busy)return;
    if(m._msg){const i=ch.msgs.indexOf(m._msg);if(i>=0)ch.msgs.length=i}
    m.remove();respond();return;
  }
  if(a==='vc'){run.classList.toggle('open');return}
  if(a==='cc'){
    if(run&&run.classList.contains('cmd')){await copyText(run.dataset.cmd||'');flash(b,'Copied');return}
    if(cb){const code=[...cb.querySelectorAll('.l')].map(l=>l.textContent).join('\n');await copyText(code);flash(b,'Copied')}
    return;
  }
  if(a==='dl'&&cb){
    const code=[...cb.querySelectorAll('.l')].map(l=>l.textContent).join('\n');
    const lang=cb.querySelector('.lang').textContent;
    let n=cb.querySelector('.fname').textContent.trim().replace(/[\\/:*?"<>|]+/g,'_')||'code';
    if(!/\.\w+$/.test(n))n+='.'+(EXT[lang]||lang);
    dl(n,code);
  }
  if(a==='run'&&cb){
    if(cb.classList.contains('streaming')) return;
    const code=[...cb.querySelectorAll('.l')].map(l=>l.textContent).join('\n');
    const titleMatch = code.match(/<title>([^<]*)<\/title>/i);
    const titleStr = titleMatch ? titleMatch[1].trim() : (cb.querySelector('.fname').textContent.trim() || 'HTML Preview');
    $('#runner-title').textContent = titleStr;
    
    $('#runner').dataset.code = code;
    $('#runner').dataset.name = cb.querySelector('.fname').textContent.trim();
    
    // Reset console
    $('#runner').classList.remove('has-console');
    $('#console-body').innerHTML = '';
    
    // Console proxy + strict CSP. The CSP is injected FIRST so it's the
    // baseline policy even if the code brings its own: everything inline
    // works, but NOTHING may load from the network — the preview can't
    // reach outside the .html itself.
    const CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' data:; script-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'; frame-src 'none'">`;

    const proxyScript = `<script>
      (function(){
        const _log = console.log, _warn = console.warn, _error = console.error, _info = console.info;
        function send(type, args) {
          try { parent.postMessage({ __console: true, type: type, args: Array.from(args).map(a => {
            if (typeof a === 'object') { try { return JSON.stringify(a); } catch(e) { return String(a); } }
            return String(a);
          })}, '*'); } catch(e) {}
        }
        console.log = function(){ send('log', arguments); _log.apply(console, arguments); };
        console.warn = function(){ send('warn', arguments); _warn.apply(console, arguments); };
        console.error = function(){ send('error', arguments); _error.apply(console, arguments); };
        console.info = function(){ send('info', arguments); _info.apply(console, arguments); };
      })();
    <\/script>`;

    const inject = CSP + proxyScript;
    // Put the CSP + console proxy into the document's <head> when the code
    // has one (keeps doctype intact, avoids quirks mode); otherwise wrap.
    let doc = code;
    if (/<head[^>]*>/i.test(doc)) doc = doc.replace(/<head[^>]*>/i, m => m + inject);
    else if (/<html[^>]*>/i.test(doc)) doc = doc.replace(/<html[^>]*>/i, m => m + '<head>' + inject + '</head>');
    else doc = '<!DOCTYPE html><html><head>' + inject + '</head><body>' + doc + '</body></html>';

    const iframe = $('#runner-iframe');
    iframe.srcdoc = doc;
    $('#runner').classList.remove('py-mode');
    $('#runner').dataset.mode='html';
    $('#runner').classList.add('open');
    return;
  }
  if(a==='pyrun'&&cb){
    if(cb.classList.contains('streaming'))return;
    const code=[...cb.querySelectorAll('.l')].map(l=>l.textContent).join('\n');
    const name=cb.querySelector('.fname').textContent.trim()||'Console';
    $('#runner-title').textContent=name;
    $('#runner').dataset.code=code;
    $('#runner').dataset.name=name;
    $('#runner').dataset.mode='py';
    $('#runner-iframe').srcdoc='';
    $('#runner').classList.add('py-mode','open');
    $('#runner').classList.remove('has-console');
    runPython(code);
    return;
  }
});
msgs.addEventListener('input',e=>{if(e.target.classList.contains('ed'))grow(e.target)});
msgs.addEventListener('keydown',e=>{
  const t=e.target;
  if(t.classList.contains('fname')&&e.key==='Enter'){e.preventDefault();t.blur()}
  if(t.classList.contains('ed')){
    if(e.key==='Escape')t.parentNode.querySelector('[data-a=ec]').click();
    else if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();t.parentNode.querySelector('[data-a=es]').click()}
  }
});
msgs.addEventListener('focusout',e=>{const f=e.target;if(f.classList&&f.classList.contains('fname')&&!f.textContent.trim())f.textContent=f.dataset.d});
msgs.addEventListener('paste',e=>{if(e.target.classList.contains('fname')){e.preventDefault();document.execCommand('insertText',false,e.clipboardData.getData('text/plain').replace(/\s+/g,' '))}});
/* ---- HTML Runner Interactions ---- */
$('#runner-restart').onclick = () => {
  const r=$('#runner');
  if(r.dataset.mode==='py'){
    $('#console-body').innerHTML='';
    runPython(r.dataset.code);
  }else{
    const iframe = $('#runner-iframe');
    iframe.srcdoc = iframe.srcdoc;
    $('#console-body').innerHTML = '';
  }
};
$('#runner-download').onclick = () => {
  const r=$('#runner');
  const code = r.dataset.code;
  const name = r.dataset.name || (r.dataset.mode==='py'?'script.py':'preview.html');
  const type = r.dataset.mode==='py' ? 'text/x-python' : 'text/html';
  dl(name, code, type);
};
const closeRunner = () => {
  const r=$('#runner');
  r.classList.remove('open','has-console','py-mode');
  delete r.dataset.mode;
};
$('#runner-close').onclick = closeRunner;
$('#runner').onclick = (e) => { if(e.target.id === 'runner') closeRunner(); };

$('#runner-console').onclick = () => {
  const r = $('#runner');
  r.classList.toggle('has-console');
  if (r.classList.contains('has-console')) {
    $('#runner-console').classList.add('active');
  } else {
    $('#runner-console').classList.remove('active');
  }
};

$('#console-clear').onclick = () => {
  $('#console-body').innerHTML = '';
};

/* ---- Console drag-resize (left edge of the console panel) ---- */
(() => {
  const handle = $('#runner-resize'), cons = $('.r-console'), panel = $('.r-panel');
  if(!handle)return;
  let startX = 0, startW = 0, dragging = false;
  handle.addEventListener('pointerdown', e => {
    dragging = true; startX = e.clientX; startW = cons.offsetWidth;
    handle.classList.add('drag');
    handle.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  handle.addEventListener('pointermove', e => {
    if(!dragging)return;
    const rect = panel.getBoundingClientRect();
    // Growing the console means moving its left edge LEFT.
    const w = Math.min(Math.max(startW + (startX - e.clientX), 180), rect.width - 220);
    cons.style.width = w + 'px';
  });
  const end = () => {
    if(!dragging)return;
    dragging = false; handle.classList.remove('drag');
    try{localStorage.setItem('chat.rw', $('.r-console').style.width)}catch{}
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
  // Restore saved width when the console opens.
  const origToggle = $('#runner-console').onclick;
  $('#runner-console').onclick = () => {
    origToggle();
    if($('#runner').classList.contains('has-console')){
      const saved = localStorage.getItem('chat.rw');
      if(saved)cons.style.width = saved;
    }
  };
})();

window.addEventListener('message', e => {
  if (e.data && e.data.__console) {
    const { type, args } = e.data;
    const c = $('#console-body');
    if (!c) return;
    
    // Auto-expand if console is closed but message arrives
    if (!$('#runner').classList.contains('has-console')) {
      $('#runner').classList.add('has-console');
      $('#runner-console').classList.add('active');
    }

    const line = document.createElement('div');
    line.className = 'c-line ' + type;
    
    let icon = '';
    if (type === 'error') icon = '<svg class="c-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
    else if (type === 'warn') icon = '<svg class="c-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
    else icon = '<svg class="c-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';

    line.innerHTML = icon + '<span>' + args.map(esc).join(' ') + '</span>';
    c.appendChild(line);
    c.scrollTop = c.scrollHeight;
  }
});
