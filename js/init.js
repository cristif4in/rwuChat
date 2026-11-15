/* ---- Startup ---- */

// Show "local" when run from disk/localhost, "cloud" when hosted on a site.
function updateModeLabel(){
  const h=location.hostname,local=
    location.protocol==='file:'||
    h==='localhost'||h==='127.0.0.1'||h==='0.0.0.0'||h==='[::1]'||h==='';
  const el=document.getElementById('mode-label');
  if(el)el.textContent=local?'local':'cloud';
}

// Strip junk query params (e.g. "?i=1" added by hosts/preview embeds).
function cleanUrl(){
  if(location.search){
    try{history.replaceState(null,'',location.pathname+location.hash)}catch{}
  }
}

(async () => {
  cleanUrl();
  updateModeLabel();
  // chat.js defines loadConfig/loadSettingsConfig. If it 404'd or got blocked
  // by the host, say so clearly instead of a cryptic ReferenceError.
  if (typeof loadConfig !== 'function') {
    const el = document.getElementById('mode-label');
    if (el) el.textContent = 'script error';
    console.error('[Startup] js/chat.js failed to load — re-upload the js/ folder to the host (a 404/403 on chat.js breaks everything that follows).');
    toast('Startup failed: js/chat.js did not load. Re-upload the site files to your host.');
    return;
  }
  await loadConfig();
  await loadState();
  // Deep link: /chat/<id> selects that chat if it exists.
  const urlChat=location.pathname.match(/\/chat\/([A-Za-z0-9_-]+)\/?$/);
  if(urlChat){
    const c=chats.find(x=>x.id===urlChat[1]);
    if(c)curId=c.id;
  }
  apply();
  render();
  setBusy(false);
  updateCharCount();
  mcpUpdateChip();
  autoLoadPyodide();
  input.focus();
  // Service worker: precached hashed assets + offline fallback. Not on
  // file:// (SWs require http(s) anyway).
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(e =>
      console.warn('[SW] registration failed (non-fatal):', e.message));
  }
  // If MCP URL was in the key file, auto-connect
  if (CONFIG.mcp && !MCP.url) {
    MCP.url = CONFIG.mcp;
    try { localStorage.setItem('chat.mcp', JSON.stringify({url: MCP.url, auth: MCP.auth, tools: MCP.tools})) } catch {}
    mcpConfigure(CONFIG.mcp, '').then(() => mcpFetchTools().then(r => {
      MCP.tools = r.tools || [];
      mcpRefreshStatus();
      renderMcpTools();
      mcpUpdateChip();
    })).catch(e => console.error('[MCP] auto-connect failed:', e.message));
  }
})();
