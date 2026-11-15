/* ---- MCP (Model Context Protocol) ---- */
function mcpBase() {
  if (!CONFIG.url) throw new Error('MCP requires a server URL (key-only/Gemini mode has no backend to proxy it).');
  return CONFIG.url.replace(/\/$/, '');
}

async function mcpConfigure(url, auth){
  const res = await fetch(mcpBase() + '/mcp', {
    method:'PUT', headers:buildHeaders(),
    body:JSON.stringify({url, auth:auth||''})
  });
  if(!res.ok){
    const t=await res.text().catch(()=>'');
    console.error('[MCP] PUT /mcp →',res.status,{url,auth:auth?'(set)':'(none)',body:t.slice(0,300)});
    throw new Error('Configure failed: '+res.status+(t?' '+t.slice(0,120):''));
  }
  console.log('[MCP] PUT /mcp ok · url=',url);
  return res.json();
}
async function mcpFetchTools(){
  const res = await fetch(mcpBase() + '/mcp/tools', {method:'GET', headers:buildHeaders()});
  if(!res.ok){
    const t=await res.text().catch(()=>'');
    console.error('[MCP] GET /mcp/tools →',res.status,{body:t.slice(0,300)});
    throw new Error('Tool list failed: '+res.status+(t?' '+t.slice(0,120):''));
  }
  const j=await res.json();
  console.log('[MCP] GET /mcp/tools ok ·',(j.tools||[]).length,'tool(s)');
  return j;
}
async function mcpCallTool(tool, args){
  const res = await fetch(mcpBase() + '/mcp/call', {
    method:'POST', headers:buildHeaders(),
    body:JSON.stringify({tool, arguments:args})
  });
  if(!res.ok){
    const t=await res.text().catch(()=>'');
    console.error('[MCP] POST /mcp/call →',res.status,{tool,args,body:t.slice(0,300)});
    throw new Error('Tool call failed: '+res.status+(t?' '+t.slice(0,120):''));
  }
  const j=await res.json();
  console.log('[MCP] POST /mcp/call ok · tool=',tool,'· isError=',j.result?.isError);
  return j;
}

function mcpBuildSystemPrompt(){
  if(!MCP.tools||!MCP.tools.length)return '';
  const lines=MCP.tools.map(t=>`- ${t.name}: ${(t.description||'(no description)').replace(/\n/g,' ')}`).join('\n');
  return `\n\nMCP TOOLS AVAILABLE (server: ${MCP.url})\nThe user has connected an MCP server. The following tools are available. You cannot call them directly, but if a request would benefit from a tool, tell the user which tool to call and what arguments to pass. They can invoke it via the /mcp command.\n\n${lines}`;
}

function renderMcpTools(){
  const box=$('#mcp-tools');
  if(!MCP.tools||!MCP.tools.length){box.innerHTML='<p class="none">No tools exposed by this server.</p>';return;}
  box.innerHTML=MCP.tools.map((t,i)=>`
    <div class="mcp-tool" data-i="${i}">
      <div class="mcp-tool-h" data-a="mcp-toggle">
        <span class="mcp-tool-name">${esc(t.name)}</span>
        <span class="mcp-tool-desc">${esc((t.description||'').replace(/\n/g,' '))}</span>
        <button class="ghost" style="font-size:12px;padding:3px 10px">Call</button>
      </div>
      <div class="mcp-tool-body" hidden></div>
    </div>`).join('');
}

function mcpToolForm(tool){
  const schema=tool.inputSchema||{};
  const props=schema.properties||{};
  const required=schema.required||[];
  if(!Object.keys(props).length){
    return `<div class="mcp-form"><p style="font-size:13px;color:var(--muted);margin:0 0 8px">This tool takes no arguments.</p><button class="primary" data-a="mcp-run">Run</button><div class="mcp-result"></div></div>`;
  }
  const fields=Object.entries(props).map(([name,prop])=>{
    const req=required.includes(name)?' <span style="color:var(--bad)">*</span>':'';
    const ph=prop.description?` placeholder="${esc(prop.description.slice(0,80))}"`:'';
    const ty=prop.type||'string';
    return `<div class="mcp-field"><label>${esc(name)}${req} <small>${esc(ty)}</small></label><input type="text" data-prop="${esc(name)}" data-type="${esc(ty)}"${ph}></div>`;
  }).join('');
  return `<div class="mcp-form">${fields}<button class="primary" data-a="mcp-run">Run</button><div class="mcp-result"></div></div>`;
}

function mcpCoerce(val, type){
  if(type==='integer'||type==='number'){const n=Number(val);return isNaN(n)?val:n;}
  if(type==='boolean')return val==='true'||val==='1';
  if(type==='object'||type==='array'){try{return JSON.parse(val)}catch{return val}}
  return val;
}

function openMcpDialog(){
  const d=$('#mcp-dlg');
  $('#mcp-url').value=MCP.url||'';
  $('#mcp-auth').value=MCP.auth||'';
  mcpRefreshStatus();
  renderMcpTools();
  d.showModal();
}

function mcpRefreshStatus(){
  const st=$('#mcp-status'),disc=$('#mcp-disconnect'),conn=$('#mcp-connect');
  if(MCP.url){
    st.textContent=`Connected to ${MCP.url} · ${MCP.tools.length} tool${MCP.tools.length===1?'':'s'}`;
    disc.style.display='inline-block';
    conn.textContent='Reconnect';
  }else{
    st.textContent='Not connected.';
    disc.style.display='none';
    conn.textContent='Connect';
  }
  mcpUpdateChip();
}

function mcpUpdateChip(){
  const wrap=$('.composer .input-area');
  let chip=wrap&&wrap.querySelector('.mcp-chip');
  if(MCP.url){
    if(!chip){
      chip=document.createElement('div');
      chip.className='mcp-chip';
      chip.innerHTML='<i></i><span>MCP</span>';
      chip.title='MCP connected. Click to manage.';
      chip.onclick=()=>openMcpDialog();
      if(wrap)wrap.insertBefore(chip,wrap.firstChild);
    }
    chip.querySelector('span').textContent=MCP.url.replace(/^https?:\/\//,'').split('/')[0];
  }else if(chip){chip.remove()}
}

async function mcpDoConnect(){
  const url=$('#mcp-url').value.trim();
  const auth=$('#mcp-auth').value.trim();
  if(!url){toast('Enter an MCP server URL first.');return;}
  const st=$('#mcp-status');
  st.textContent='Connecting…';
  try{
    await mcpConfigure(url, auth);
    st.textContent='Fetching tools…';
    const r=await mcpFetchTools();
    MCP.url=url;MCP.auth=auth;MCP.tools=r.tools||[];
    save();mcpRefreshStatus();renderMcpTools();
    toast(`Connected to ${url.replace(/^https?:\/\//,'').split('/')[0]} · ${MCP.tools.length} tool${MCP.tools.length===1?'':'s'}`);
  }catch(e){
    console.error('[MCP] connect failed for',url,e);
    st.textContent='';MCP.url='';MCP.tools=[];
    toast('MCP error: '+e.message);
    mcpRefreshStatus();
  }
}

function mcpDoDisconnect(){
  MCP.url='';MCP.auth='';MCP.tools=[];
  mcpConfigure('','').catch(e=>console.warn('[MCP] disconnect PUT failed (non-fatal):',e.message));
  save();mcpRefreshStatus();renderMcpTools();
  toast('MCP disconnected.');
}
