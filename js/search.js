/* ---- Search palette ---- */
const pal=$('#pal'),pq=$('#pq'),pl=$('#pl');let psel=0,plist=[];
const ago=t=>{const s=(Date.now()-t)/1000;return s<60?'just now':s<3600?Math.floor(s/60)+'m ago':s<86400?Math.floor(s/3600)+'h ago':Math.floor(s/86400)+'d ago'};
function palRender(){
  const q=pq.value.trim().toLowerCase();
  plist=chats.filter(c=>!q||c.title.toLowerCase().includes(q)||c.msgs.some(m=>m.content.toLowerCase().includes(q))).sort((a,b)=>b.t-a.t);
  psel=Math.min(psel,Math.max(plist.length-1,0));
  pl.innerHTML=plist.length?plist.map((c,i)=>{
    const hit=q&&c.msgs.find(m=>m.content.toLowerCase().includes(q)),last=hit||c.msgs[c.msgs.length-1];
    return `<button class="pi${i===psel?' sel':''}" data-id="${c.id}"><span class="pt">${esc(c.title)}</span><span class="pd">${c.id===curId?'open now':ago(c.t)}</span><span class="pm">${esc(last?last.content.replace(/\s+/g,' ').slice(0,90):'Empty chat')}</span></button>`;
  }).join(''):'<p class="none">No chats match.</p>';
  const s=pl.querySelector('.sel');if(s)s.scrollIntoView({block:'nearest'});
}
function openPal(){pq.value='';psel=0;palRender();pal.showModal();pq.focus()}
$('#all').onclick=openPal;
pq.oninput=()=>{psel=0;palRender()};
pq.onkeydown=e=>{
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();psel=(psel+(e.key==='ArrowDown'?1:-1)+plist.length)%(plist.length||1);palRender()}
  else if(e.key==='Enter'&&plist[psel]){e.preventDefault();pal.close();switchTo(plist[psel].id)}
};
pl.onclick=e=>{const b=e.target.closest('[data-id]');if(b){pal.close();switchTo(b.dataset.id)}};
pal.onclick=e=>{if(e.target===pal)pal.close()};
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();pal.open?pal.close():openPal()}});
