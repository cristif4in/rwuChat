/* ---- Settings ---- */
function themes(q=''){
  $('#themes').innerHTML=[['Auto','#f5f6f8','#ffffff','#1c2230','#3b5bdb'],...T]
    .filter(t=>t[0].toLowerCase().includes(q.trim().toLowerCase()))
    .map(t=>`<button class="th${t[0]===S.theme?' on':''}" data-t="${esc(t[0])}"><i class="sw" style="background:${t[0]==='Auto'?'linear-gradient(90deg,#f5f6f8 50%,#12151c 50%)':(t[5]||t[1])};--s:${t[2]};--a:${t[4]}"></i>${esc(t[0])}</button>`).join('');
}
function sync(){
  $('#acc').value=S.accent||CT[4];$('#font').value=S.font;$('#fs').value=S.size;
  $('#fso').textContent=S.size+'px';$('#ln').checked=S.lines;$('#es').checked=S.enter;
  $('#sys').value=S.system||'';
}
$('#theme-toggle').onclick=()=>{
  const c = $('#theme-container');
  const isHidden = c.style.display === 'none' || c.style.display === '';
  c.style.display = isHidden ? 'flex' : 'none';
  $('#theme-toggle').textContent = isHidden ? 'Hide' : 'Show';
};
$('#tq').oninput=e=>themes(e.target.value);
$('#themes').onclick=e=>{
  const b=e.target.closest('[data-t]');if(!b)return;
  S.theme=b.dataset.t;S.accent='';apply();sync();themes($('#tq').value);save();
};
$('#acc').oninput=e=>{S.accent=e.target.value;apply();save()};
$('#accr').onclick=()=>{S.accent='';apply();sync();save()};
$('#font').onchange=e=>{S.font=e.target.value;apply();save()};
$('#fs').oninput=e=>{S.size=+e.target.value;apply();sync();save()};
$('#ln').onchange=e=>{S.lines=e.target.checked;apply();save()};
$('#es').onchange=e=>{S.enter=e.target.checked;save()};
$('#sys').oninput=e=>{S.system=e.target.value;save()};
$('#sysreset').onclick=()=>{S.system='';$('#sys').value='';save()};
$('#reset').onclick=()=>{S={...DEF};apply();sync();themes($('#tq').value);syncTbLayouts();save()};
$('#exp').onclick=()=>{const c=cur();dl((c.title.replace(/[\\/:*?"<>|]+/g,'_')||'chat')+'.md','# '+c.title+'\n\n'+(c.msgs.map(m=>(m.role==='user'?'**You**':'**Assistant**')+'\n\n'+m.content).join('\n\n---\n\n')||'(empty chat)'),'text/markdown')};
$('#gear').onclick=()=>{$('#tq').value='';sync();themes();syncTbLayouts();updatePyStatus();syncAIConfig();dlg.showModal()};
$("#py-install").onclick=()=>{
  PY.installed=true;
  try{localStorage.setItem("chat.py","1")}catch{}
  loadPyWorker();
};
$("#py-uninstall").onclick=()=>{
  uninstallPyodide();
};
/* Top-bar layout picker */
function syncTbLayouts(){$$('.tbl').forEach(b=>b.classList.toggle('on',b.dataset.tb===(S.headerLayout||'compact')))}
$('#tb-layouts').onclick=e=>{
  const b=e.target.closest('.tbl');if(!b)return;
  S.headerLayout=b.dataset.tb;apply();syncTbLayouts();save();
};
/* MCP dialog handlers */
$('#mcp-connect').onclick=()=>mcpDoConnect();
$('#mcp-disconnect').onclick=()=>mcpDoDisconnect();
$('#mcp-close').onclick=()=>$('#mcp-dlg').close();
$('#mcp-dlg').onclick=e=>{if(e.target===$('#mcp-dlg'))$('#mcp-dlg').close()};
$('#mcp-url').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#mcp-auth').focus()}});
$('#mcp-auth').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();mcpDoConnect()}});
$("#mcp-tools").addEventListener("click",async e=>{
  const h=e.target.closest('.mcp-tool-h');
  if(!h)return;
  const toolEl=h.closest('.mcp-tool');
  const i=+toolEl.dataset.i;
  const body=toolEl.querySelector('.mcp-tool-body');
  const isHidden=body.hasAttribute('hidden');
  if(e.target.closest('button')||isHidden){
    body.removeAttribute('hidden');
    if(!body.querySelector('.mcp-form')){body.innerHTML=mcpToolForm(MCP.tools[i])}
  }else{body.setAttribute('hidden','')}
});
$("#mcp-tools").addEventListener("click",async e=>{
  const runBtn=e.target.closest('[data-a="mcp-run"]');
  if(!runBtn)return;
  const toolEl=runBtn.closest('.mcp-tool');
  const i=+toolEl.dataset.i;
  const tool=MCP.tools[i];
  const form=runBtn.closest('.mcp-form');
  const resultEl=form.querySelector('.mcp-result');
  const args={};
  form.querySelectorAll('[data-prop]').forEach(inp=>{
    const k=inp.dataset.prop,v=inp.value;
    if(v.trim()||inp.dataset.type==='boolean')args[k]=mcpCoerce(v,inp.dataset.type);
  });
  runBtn.disabled=true;runBtn.textContent='Running…';
  resultEl.className='mcp-result';resultEl.textContent='Calling '+tool.name+'…';
  try{
    const r=await mcpCallTool(tool.name,args);
    const ok=!r.result?.isError;
    const txt=(r.result?.content||[]).map(c=>c.text||'').filter(Boolean).join('\n')||JSON.stringify(r.result,null,2);
    resultEl.className='mcp-result '+(ok?'ok':'err');
    resultEl.textContent=txt;
  }catch(err){
    console.error('[MCP] tool call error',{tool:tool.name,args,error:err.message});
    resultEl.className='mcp-result err';resultEl.textContent=err.message;
  }finally{
    runBtn.disabled=false;runBtn.textContent='Run';
  }
});
$('#close').onclick=()=>dlg.close();
dlg.onclick=e=>{if(e.target===dlg)dlg.close()};


/* ---- Connect your own AI ---- */
function syncAIConfig() {
  // chat.js may fail to load on some hosts — degrade gracefully instead of
  // throwing and killing every later handler.
  if (typeof loadSettingsConfig !== 'function') {
    const st=$('#ai-config-status');if(!st)return;
    st.textContent='AI config unavailable — js/chat.js failed to load from the host';
    st.style.color='var(--bad)';
    return;
  }
  const saved = loadSettingsConfig();
  if (saved) {
    const urlEl=$('#ai-url'),keyEl=$('#ai-key'),mcpEl=$('#ai-mcp'),modeEl=$('#ai-mode');
    if(urlEl)urlEl.value=saved.url||'';
    if(keyEl)keyEl.value=saved.key||'';
    if(mcpEl)mcpEl.value=saved.mcp||'';
    if(modeEl)modeEl.value=saved.mode||'local';
  }
  const st=$('#ai-config-status');if(!st)return;
  if(CONFIG._source==='ai.key'||CONFIG._source==='ai.env'){
    st.textContent='Using '+CONFIG._source+' file (overrides settings)';
    st.style.color='var(--ok)';
  }else if(CONFIG._source==='settings'){
    st.textContent='Using settings config (encrypted in localStorage)';
    st.style.color='var(--ok)';
  }else{
    st.textContent='No AI configured — add ai.key file or fill in above';
    st.style.color='var(--bad)';
  }
}

if($('#ai-save'))$('#ai-save').onclick=()=>{
  if(typeof saveSettingsConfig!=='function'){toast('AI config unavailable — js/chat.js failed to load.');return}
  const cfg={
    url:($('#ai-url').value||'').trim(),
    key:($('#ai-key').value||'').trim(),
    mcp:($('#ai-mcp').value||'').trim(),
    mode:($('#ai-mode').value||'local'),
    // Preserve model/think picks made in the + → Models menu.
    model:CONFIG.model||'',
    think:CONFIG.think||{},
    customModels:CONFIG.customModels||[]
  };
  saveSettingsConfig(cfg);
  CONFIG.url=cfg.url;CONFIG.key=cfg.key;CONFIG.mcp=cfg.mcp;CONFIG.mode=cfg.mode;
  CONFIG._source='settings';
  toast('AI config saved.');
  syncAIConfig();
};

if($('#ai-clear'))$('#ai-clear').onclick=()=>{
  try{localStorage.removeItem('chat.ai')}catch{}
  CONFIG.url='';CONFIG.key='';CONFIG._source='none';
  if($('#ai-url'))$('#ai-url').value='';
  if($('#ai-key'))$('#ai-key').value='';
  if($('#ai-mcp'))$('#ai-mcp').value='';
  syncAIConfig();
  toast('AI config cleared.');
};
