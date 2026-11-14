/* ---- Startup ---- */
(async () => {
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
