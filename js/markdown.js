// Inline: code, bold, and the AI-optional colored text !!color{text}.
// The color is validated to bare CSS names or #hex only — nothing else can
// sneak into the style attribute. Applied last so the inner text can
// itself contain <strong>/<code> from the earlier passes.
const inl=s=>s.replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
  .replace(/!!([a-z]+|#[0-9a-f]{3,8})\{([^{}]*)\}/gi,(m,c,t)=>`<span style="color:${c.toLowerCase()}">${t}</span>`);

function tbl(rows){
  const cells=r=>r.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(c=>c.trim());
  const head=cells(rows[0]),body=rows.slice(2).map(cells);
  return '<div class="tbl-wrap"><table class="md-tbl"><thead><tr>'+head.map(h=>'<th>'+inl(esc(h))+'</th>').join('')+'</tr></thead><tbody>'+
    body.map(r=>'<tr>'+r.map(c=>'<td>'+inl(esc(c))+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
}
const isSep=l=>/^[\s|:-]+$/.test(l)&&l.includes('-');

function text(src){
  const lines=src.split('\n'),out=[];let i=0;
  while(i<lines.length){
    const line=lines[i];
    if(!line.trim()){i++;continue}
    
    // Safer HTML Callout support
    if (/^\s*<div class="callout/.test(line)) {
      let htmlLines = [];
      let depth = 0;
      let closed = false;
      while(i<lines.length) {
        const l = lines[i];
        htmlLines.push(l);
        // Count nested <div> tags so the callout only ends at its OWN
        // closing </div> — not at the label div's closing tag.
        const opens = (l.match(/<div\b/gi) || []).length;
        const closes = (l.match(/<\/div>/gi) || []).length;
        depth += opens - closes;
        i++;
        if (depth <= 0) { closed = true; break; }
      }
      
      const htmlStr = htmlLines.join('\n');
      
      // Pull the color out of the opening <div class="callout blue">.
      const colorMatch = htmlStr.match(/<div class="callout\s*([a-z]*)"/i);
      const color = colorMatch ? colorMatch[1] : '';
      
      // Pull the label text out of <div class="label">…</div>.
      const labelMatch = htmlStr.match(/<div class="label">([^<]*)<\/div>/i);
      const label = labelMatch ? labelMatch[1].trim() : '';
      
      // Strip the outer callout div, its closing </div>, and the label
      // div — whatever remains is the inner content (often <p>…</p>).
      let content = htmlStr
        .replace(/^\s*<div class="callout[^>]*>/i, '')
        .replace(/<\/div>\s*$/, '')
        .replace(/<div class="label">[^<]*<\/div>/gi, '')
        .replace(/<\/?div[^>]*>/gi, '');
      
      // Convert <p>…</p> into paragraph breaks, then rebuild each as a
      // proper <p> with inline + escape applied to its text.
      content = content.replace(/<p\b[^>]*>/gi, '\n\n').replace(/<\/p>/gi, '');
      
      if (closed) {
        // Feed the inner content through the full markdown parser so
        // tables, lists, headings, etc. all render inside the callout.
        // The AI can choose to put a table inside a callout instead of
        // as a separate block below it.
        const formattedContent = text(content).join('');
        out.push(`<div class="callout ${color}">${label ? `<div class="label">${esc(label)}</div>` : ''}${formattedContent}</div>`);
      } else {
        // Streaming fallback: callout opened but not yet closed.
        const txt = content.replace(/<\/?p\b[^>]*>/gi, '').replace(/\n{3,}/g, '\n\n').trim();
        out.push(`<div class="callout ${color}">${label ? `<div class="label">${esc(label)}</div>` : ''}<p style="margin-top:9px">${esc(txt)}</p></div>`);
      }
      continue;
    }

    if(/^\s*\|/.test(line)&&i+1<lines.length&&isSep(lines[i+1])&&/^\s*\|/.test(lines[i+1])){
      const rows=[line,lines[i+1]];i+=2;
      while(i<lines.length&&/^\s*\|/.test(lines[i])){rows.push(lines[i]);i++}
      out.push(tbl(rows));continue;
    }
    if(/^\s*[-*]\s/.test(line)){
      const items=[];
      while(i<lines.length&&/^\s*[-*]\s/.test(lines[i])){items.push(lines[i].replace(/^\s*[-*]\s/,''));i++}
      out.push('<ul>'+items.map(x=>'<li>'+inl(esc(x))+'</li>').join('')+'</ul>');continue;
    }
    if(/^###\s+/.test(line)){out.push('<h3>'+inl(esc(line.replace(/^###\s+/,'')))+'</h3>');i++;continue}
    if(/^##\s+/.test(line)){out.push('<h2>'+inl(esc(line.replace(/^##\s+/,'')))+'</h2>');i++;continue}
    if(/^#\s+/.test(line)){out.push('<h1>'+inl(esc(line.replace(/^#\s+/,'')))+'</h1>');i++;continue}
    
    const para=[];
    while(i<lines.length&&lines[i].trim()&&!/^\s*[-*]\s/.test(lines[i])&&!/^\s*\|/.test(lines[i])&&!/^###?\s+/.test(lines[i])&&!/^\s*<div class="callout/.test(lines[i])){
      para.push(lines[i]);i++;
    }
    if(para.length){
      out.push('<p>'+inl(esc(para.join('\n'))).replace(/\n/g,'<br>')+'</p>');
    } else {
      // Fallback to prevent infinite loop if line matches an exclusion above but wasn't handled
      out.push('<p>'+inl(esc(line))+'</p>');
      i++;
    }
  }
  return out;
}

function block({info,lines},streaming){
  const t=info.match(/title="([^"]*)"/);
  const p=info.replace(/title="[^"]*"/,'').trim().split(/[\s:]+/).filter(Boolean);
  const lang=(p[0]||'text').toLowerCase(),name=t?t[1]:p[1]||'code.'+(EXT[lang]||lang);
  const isHtml = lang === 'html' || lang === 'htm' || name.endsWith('.html');
  const isPy = lang === 'python' || lang === 'py' || name.endsWith('.py');
  const runBtn = isHtml ? `<button data-a="run" class="run-btn" style="margin-left:8px;background:${streaming?'transparent':'rgba(255,255,255,0.15)'};color:${streaming?'var(--muted)':'#fff'};border:1px solid ${streaming?'transparent':'rgba(255,255,255,0.3)'};transition:all 0.2s">Run</button>` : '';
  const pyRunBtn = isPy ? `<button data-a="pyrun" class="run-btn py-run-btn" style="margin-left:8px;background:rgba(255,255,255,0.15);color:#fff;border:1px solid rgba(255,255,255,0.3);transition:all 0.2s">Run</button>` : '';
  return `<div class="cb${streaming?' streaming':''}" data-lang="${esc(lang)}"><div class="cbh"><span class="fname" contenteditable="true" spellcheck="false" title="Click to rename" data-d="${esc(name)}">${esc(name)}</span><span class="lang">${esc(lang)}</span><span class="cnt">${lines.length} line${lines.length===1?'':'s'}</span><span class="sp"></span><button data-a="cc">Copy</button><button data-a="dl">Download</button>${runBtn}${pyRunBtn}</div><div class="cb-body"><div class="cb-inner"><pre><code>${lines.map(l=>`<span class="l">${esc(l)}</span>`).join('')}</code></pre></div></div></div>`;
}

/* ---- Syntax highlighting (highlight.js, lazy-loaded from CDN) ---- */
const HLJS_CDN='https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0';
let hljsReady=null;
function ensureHljs(){
  if(hljsReady)return hljsReady;
  hljsReady=new Promise((resolve,reject)=>{
    const link=document.createElement('link');
    link.rel='stylesheet';link.href=HLJS_CDN+'/styles/github-dark.min.css';
    document.head.appendChild(link);
    const s=document.createElement('script');
    s.src=HLJS_CDN+'/highlight.min.js';
    s.onload=()=>resolve(window.hljs);
    s.onerror=()=>{hljsReady=null;reject(new Error('highlight.js failed to load'))};
    document.head.appendChild(s);
  });
  return hljsReady;
}
// Our lang tag -> hljs language; null when unsupported (leave plain).
function hljsLangOf(lang){
  if(!window.hljs||!lang)return null;
  const map={htm:'xml',html:'xml',js:'javascript',ts:'typescript',py:'python',sh:'bash',shell:'bash',yml:'yaml',md:'markdown'};
  const l=map[lang]||lang;
  return window.hljs.getLanguage(l)?l:null;
}
// Highlight a finished code block in place: one hljs call per line span,
// preserving the line-number layout. Skipped while streaming and
// deduped per language via data-hl.
function highlightCb(cb){
  if(cb.classList.contains('streaming'))return;
  const l=hljsLangOf(cb.dataset.lang);
  if(!l||cb.dataset.hl===l)return;
  cb.dataset.hl=l;
  cb.querySelectorAll('.l').forEach(el=>{
    try{el.innerHTML=window.hljs.highlight(el.textContent,{language:l,ignoreIllegals:true}).value}catch{}
  });
}
function highlightCbSoon(cb){ ensureHljs().then(()=>highlightCb(cb)).catch(()=>{}) }

function cmdBlock({lines},streaming){
  const cmd=(lines[0]||'').replace(/^\$\s*/,'');
  const out=lines.slice(1).join('\n').replace(/^\n+/,'').replace(/\n+$/,'');
  return `<div class="run cmd open${streaming?' streaming':''}" data-cmd="${esc(cmd)}">
  <div class="run-bar">
    <span class="run-ic">${ICON_TERM}</span>
    <span class="run-txt"><span class="run-title mono"><span class="pr">$</span> ${esc(cmd)}</span></span>
    <span class="sp"></span>
    <button class="run-btn" data-a="cc">Copy</button>
  </div>
  <div class="run-body"><div class="run-inner"><pre class="cmd-out">${esc(out)}</pre></div></div>
</div>`;
}

// Parse a fenced diff/patch block into structured per-file hunks.
// Shared by diffBlock (rendering) and buildResultBlocks (application).
function parseDiff({info,lines}){
  const files=[];let cur=null,oldN=1,newN=1;
  for(const raw of lines){
    if(/^\+\+\+ /.test(raw)){
      let p=raw.replace(/^\+\+\+ /,'').trim(),note='';
      const m=p.match(/^(.+?)\s+\(from (.+)\)$/);
      if(m){note='moved from '+m[2];p=m[1]}
      cur={name:p,note,rows:[],add:0,del:0};files.push(cur);oldN=1;newN=1;continue;
    }
    if(!cur)continue;
    if(/^@@/.test(raw)){
      const m=raw.match(/@@\s*-(\d+)(?:,\d+)?\s*\+(\d+)/);
      if(m){oldN=+m[1];newN=+m[2]}
      cur.rows.push({t:'@',n:'',s:raw});continue;
    }
    if(raw[0]==='+'){cur.rows.push({t:'+',n:newN++,s:raw.slice(1)});cur.add++}
    else if(raw[0]==='-'){cur.rows.push({t:'-',n:oldN++,s:raw.slice(1)});cur.del++}
    else{const s=raw[0]===' '?raw.slice(1):raw;cur.rows.push({t:' ',n:newN++,s});oldN++}
  }
  if(!files.length)files.push({name:'changes',note:'',rows:[],add:0,del:0,pseudo:true});
  const add=files.reduce((a,f)=>a+f.add,0),del=files.reduce((a,f)=>a+f.del,0);
  const tm=info.match(/title="([^"]*)"/);
  const label=tm?tm[1]:'Edited '+files.length+' file'+(files.length===1?'':'s');
  return {files,add,del,label};
}

function diffBlock(f,streaming){
  const {files,add,del,label}=parseDiff(f);
  const row=r=>r.t==='@'
    ? `<div class="dl hunk"><span class="n"></span><span class="s"></span><span class="tx">${esc(r.s)}</span></div>`
    : `<div class="dl ${r.t==='+'?'add':r.t==='-'?'del':'ctx'}"><span class="n">${r.n}</span><span class="s">${r.t===' '?'':esc(r.t)}</span><span class="tx">${esc(r.s)}</span></div>`;
  return `<div class="run${streaming?' streaming':''}" data-kind="code" data-n="${files.length}">
  <div class="run-bar">
    <span class="run-ic">${ICON_FILE}</span>
    <span class="run-txt">
      <span class="run-title">${esc(label)}</span>
      <span class="run-stats"><b class="add">+${add}</b> <b class="del">-${del}</b></span>
    </span>
    <span class="sp"></span>
    <button class="run-btn" data-a="vc">View changes</button>
  </div>
  <div class="run-body"><div class="run-inner">
    <div class="run-files">${files.map((f,i)=>`<button class="fchip${i?'':' on'}" data-i="${i}">${esc(f.name)}${f.note?` <em>(${esc(f.note)})</em>`:''}</button>`).join('')}</div>
    <div class="run-diff">${files.map((f,i)=>`<div class="pane" data-i="${i}"${i?' hidden':''}>${f.rows.map(row).join('')}</div>`).join('')}</div>
  </div></div>
</div>`;
}

// --- Diff-application pipeline (browser-side) ---
// Scan a markdown string for fenced code blocks and return
// [{name, lang, code}] for each. Skips diff/patch/cmd fences.
function extractCodeBlocks(content){
  const blocks=[];
  const lines=content.split('\n');
  let i=0;
  while(i<lines.length){
    const f=lines[i].match(/^```(.*)$/);
    if(f){
      const info=f[1].trim();
      const firstTok=(info.split(/[\s:]+/)[0]||'').toLowerCase();
      if(firstTok==='diff'||firstTok==='patch'||firstTok==='cmd'){i++;continue}
      const codeLines=[];i++;
      while(i<lines.length&&!/^```/.test(lines[i])){codeLines.push(lines[i]);i++}
      if(i<lines.length)i++;
      const t=info.match(/title="([^"]*)"/);
      const p=info.replace(/title="[^"]*"/,'').trim().split(/[\s:]+/).filter(Boolean);
      const lang=(p[0]||'text').toLowerCase();
      const name=t?t[1]:(p[1]||'code.'+(EXT[lang]||lang));
      blocks.push({name,lang,code:codeLines.join('\n')});
    }else{i++}
  }
  return blocks;
}

// Find the most recent code block named `name` in the chat history.
// Scans both assistant and user messages, newest first.
function findOriginalFile(name,msgs){
  for(let i=msgs.length-1;i>=0;i--){
    const m=msgs[i];
    if(m.role!=='assistant'&&m.role!=='user')continue;
    const blocks=extractCodeBlocks(m.content||'');
    for(let j=blocks.length-1;j>=0;j--){
      if(blocks[j].name===name)return blocks[j];
    }
  }
  return null;
}

// Apply a single file's diff rows to its original content.
// Hunks are applied bottom-up so earlier line numbers stay valid.
// Returns the new content string, or null if a hunk was malformed.
function applyDiffToContent(originalContent,fileRows){
  const origLines=originalContent.split('\n');
  const newLines=[...origLines];
  const hunks=[];let cur=null;
  for(const row of fileRows){
    if(row.t==='@'){
      if(cur)hunks.push(cur);
      const m=row.s.match(/@@\s*-(\d+)(?:,\d+)?\s*\+/);
      cur={oldStart:m?+m[1]:1,rows:[]};
    }else if(cur){cur.rows.push(row)}
  }
  if(cur)hunks.push(cur);
  if(!hunks.length)return originalContent;
  hunks.sort((a,b)=>b.oldStart-a.oldStart);
  for(const hunk of hunks){
    const start=Math.max(0,hunk.oldStart-1);
    let cursor=start;
    const section=[];
    for(const row of hunk.rows){
      if(row.t===' '){
        if(cursor<origLines.length)section.push(origLines[cursor]);
        cursor++;
      }else if(row.t==='-'){cursor++}
      else if(row.t==='+'){section.push(row.s)}
    }
    newLines.splice(start,cursor-start,...section);
  }
  return newLines.join('\n');
}

// Build the resulting code-block HTML for each file in a diff.
// Tries to find the original in chat history; if found, applies the
// diff and renders the updated file as a normal code block below the
// diff summary. If the file is brand-new (all + lines), renders it
// directly. Otherwise shows a small note that the original wasn't found.
function buildResultBlocks(files){
  const msgs=cur().msgs;
  const parts=[];
  for(const file of files){
    // A headerless diff (no +++ lines) renders as a plain diff summary —
    // there is no filename to look up, so no note and no result block.
    if(file.pseudo)continue;
    const orig=findOriginalFile(file.name,msgs);
    let newContent,lang;
    if(orig){
      newContent=applyDiffToContent(orig.code,file.rows);
      lang=orig.lang;
    }else{
      // Maybe a brand-new file: every non-hunk row is a + line.
      const added=file.rows.filter(r=>r.t==='+').map(r=>r.s);
      const hasNonAdd=file.rows.some(r=>r.t!=='@'&&r.t!=='+');
      if(added.length&&!hasNonAdd){
        newContent=added.join('\n');
        const ext=(file.name.match(/\.(\w+)$/)||[])[1]||'text';
        lang=ext;
      }else{
        parts.push(`<div class="callout amber"><div class="label">Note</div><p>Couldn't find “${esc(file.name)}” in earlier messages to apply the diff to.</p></div>`);
        continue;
      }
    }
    if(newContent===null){
      parts.push(`<div class="callout red"><div class="label">Error</div><p>Diff couldn't be applied to “${esc(file.name)}”.</p></div>`);
      continue;
    }
    const newLines=newContent.split('\n');
    const info=lang+' '+file.name;
    const codeHtml=block({info,lines:newLines},false);
    parts.push(`<div class="diff-result"><div class="diff-result-hint">Result after applying diff</div>${codeHtml}</div>`);
  }
  return parts;
}

// fence() returns an ARRAY of HTML strings now, so a single fenced
// block can emit multiple rendered blocks (e.g. a diff followed by
// one result code block per file).
function fence(f,streaming){
  const lang=(f.info.split(/[\s:]+/)[0]||'').toLowerCase();
  if(lang==='cmd')return [cmdBlock(f,streaming)];
  if(lang==='diff'||lang==='patch'){
    const parts=[diffBlock(f,streaming)];
    if(!streaming){
      const {files}=parseDiff(f);
      parts.push(...buildResultBlocks(files));
    }
    return parts;
  }
  return [block(f,streaming)];
}

function md(src){
  const out=[];let buf=[],code=null;
  const flush=()=>{
    if(buf.length){
      const blocks = text(buf.join('\n')); 
      if(blocks.length) out.push(...blocks);
      buf=[];
    }
  };
  for(const line of src.split('\n')){
    const f=line.match(/^```(.*)$/);
    if(f){
      if(code){out.push(...fence(code,false));code=null}
      else{flush();code={info:f[1].trim(),lines:[]}}
    }
    else if(code)code.lines.push(line);
    else buf.push(line);
  }
  if(code){
    out.push('<p>'+inl(esc(code.lines.join('\n'))).replace(/\n/g,'<br>')+'</p>');
  }
  flush();
  return out;
}

// Incremental variant of md() for streaming. Everything up to the LAST
// CLOSED fence can never change again (append-only source), so it is
// parsed once and cached; only the live tail after it is re-parsed per
// delta. Turns the per-token O(n²) full re-parse into O(tail).
// cache = {blocks:[], parsedLen:0} — owned by the caller, one per stream.
function mdStream(src,cache){
  const lines=src.split('\n');
  let inCode=false,boundary=0,off=0;
  for(const line of lines){
    if(/^```/.test(line)){
      if(inCode){inCode=false;boundary=off+line.length+1}
      else inCode=true;
    }
    off+=line.length+1;
  }
  // A still-open fence means the tail includes it — don't advance past it.
  if(!inCode&&boundary>cache.parsedLen){
    cache.blocks.push(...md(src.slice(cache.parsedLen,boundary)));
    cache.parsedLen=boundary;
  }
  return cache.blocks.concat(md(src.slice(cache.parsedLen)));
}

function renderBlocks(container,blocks){
  if(!container._anim)container._anim=new Set();
  const anim=container._anim;
  while(container.children.length>blocks.length)container.lastElementChild.remove();
  blocks.forEach((html,i)=>{
    const c=container.children[i];
    if(c&&c._h===html)return;
    const t=document.createElement('div');
    t.innerHTML=html;
    const node=t.firstElementChild;
    if(!node)return;
    node._h=html;
    if(c)container.replaceChild(node,c);else container.appendChild(node);
    const isBlock=node.classList.contains('cb')||node.classList.contains('run');
    if(node.classList.contains('cb'))highlightCbSoon(node);
    if(isBlock&&!node.classList.contains('streaming')&&!anim.has(i)){
      anim.add(i);
      enter(node);
    }
  });
}
function enter(el){
  el.classList.add('enter');
  requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.remove('enter')));
}
