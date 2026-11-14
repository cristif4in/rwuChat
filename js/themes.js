const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const log=$('#log'),msgs=$('#msgs'),input=$('#input'),send=$('#send'),empty=$('#empty'),dlg=$('#dlg'),tabs=$('#tabs'),R=document.documentElement;
const ICON_SEND='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
const ICON_STOP='<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
const ICON_FILE='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg>';
const ICON_TERM='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 3 4-3 4M12 16h7"/></svg>';
const DOTS='<span class="dots"><i></i><i></i><i></i></span>';
const title=t=>t.replace(/\s+/g,' ').trim().slice(0,32)+(t.trim().length>32?'…':'');
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const mk=(m=[])=>({id:uid(),title:'New chat',auto:true,msgs:m,t:Date.now()});
let S={...DEF},chats=[],curId=null,busy=false,CT=T[0];
let MCP={url:'',auth:'',tools:[],connected:false};
let PY={installed:false,loading:false,instance:null};try{PY.installed=localStorage.getItem('chat.py')==='1'}catch{}try{const _m=JSON.parse(localStorage.getItem('chat.mcp')||'{}');if(_m.url)MCP.url=_m.url;if(_m.auth)MCP.auth=_m.auth;if(_m.tools)MCP.tools=_m.tools;}catch{}
try{
  Object.assign(S,JSON.parse(localStorage.getItem('chat.s2')||'{}'));
  chats=JSON.parse(localStorage.getItem('chat.c')||'[]');curId=localStorage.getItem('chat.cur');
  const old=JSON.parse(localStorage.getItem('chat.h')||'[]');
  if(!chats.length&&old.length){const c=mk(old);c.title=title(old[0].content);chats=[c]}
}catch{}
if(!chats.length)chats=[mk()];
if(!chats.some(c=>c.id===curId))curId=chats[0].id;
const cur=()=>chats.find(c=>c.id===curId);
const save=()=>{try{localStorage.setItem('chat.s2',JSON.stringify(S));localStorage.setItem('chat.c',JSON.stringify(chats));localStorage.setItem('chat.cur',curId);localStorage.setItem('chat.mcp',JSON.stringify({url:MCP.url,auth:MCP.auth,tools:MCP.tools}))}catch{}};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const tk=s=>Math.max(1,Math.round(s.length/4.6));
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const lum=h=>{const[r,g,b]=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));return(.299*r+.587*g+.114*b)/255};

const dark=matchMedia('(prefers-color-scheme: dark)');
function apply(){
  CT=T.find(x=>x[0]===S.theme)||T.find(x=>x[0]===(dark.matches?'Midnight':'Paper'));
  const ac=S.accent||CT[4],FN=FONTS[S.font]||FONTS.bold;
  [['bg',CT[1]],['surface',CT[2]],['ink',CT[3]],['accent',ac],['accent-ink',lum(ac)>.6?'#10131a':'#ffffff'],['font',FN[0]],['w',FN[1]],['grad',CT[5]||'none'],['fs',S.size+'px']]
    .forEach(([k,v])=>R.style.setProperty('--'+k,v));
  R.style.colorScheme=lum(CT[1])<.5?'dark':'light';
  document.body.classList.toggle('no-ln',!S.lines);
  // Top-bar layout: toggle exactly one tb-* class on <body>.
  ['compact','centered','logoless','dot'].forEach(l=>
    document.body.classList.toggle('tb-'+l, (S.headerLayout||'compact')===l));
}
dark.addEventListener('change',()=>S.theme==='Auto'&&apply());
