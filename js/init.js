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
  await loadConfig();
  apply();
  render();
  setBusy(false);
  updateCharCount();
  mcpUpdateChip();
  autoLoadPyodide();
  input.focus();
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
