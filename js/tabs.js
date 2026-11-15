/* ---- Context Menu ---- */
const ctx = $('#ctx');
let ctxId = null;

tabs.addEventListener('contextmenu', e => {
  const t = e.target.closest('.tab');
  if(!t) return;
  e.preventDefault();
  ctxId = t.dataset.id;
  ctx.style.left = Math.min(e.clientX, window.innerWidth - 180) + 'px';
  ctx.style.top = Math.min(e.clientY, window.innerHeight - 150) + 'px';
  ctx.classList.add('open');
});

document.addEventListener('click', e => {
  if (!ctx.contains(e.target)) ctx.classList.remove('open');
});

ctx.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  const action = b.dataset.c;
  if (action === 'close') {
    del(ctxId);
  } else if (action === 'close-others') {
    chats = chats.filter(c => c.id === ctxId);
    if(!chats.length) chats=[mk()];
    curId = chats[0].id;
    render(); save();
  } else if (action === 'close-all') {
    chats = [mk()];
    curId = chats[0].id;
    render(); save();
  } else if (action === 'rename') {
    const tab = document.querySelector(`.tab[data-id="${ctxId}"]`);
    if (tab) rename(tab);
  }
  ctx.classList.remove('open');
});
/* ---- Saved chats ---- */
/* ---- URL sync: /chat/<id> so refresh lands on the same chat ---- */
function chatUrl(id){
  let p=location.pathname.replace(/\/index\.html$/,'');
  p=p.replace(/\/chat\/[^/]+\/?$/,'');           // strip a previous /chat/<id>
  if(!p.endsWith('/'))p+='/';
  return p+'chat/'+id+location.hash;
}
function syncUrl(){
  try{history.replaceState(null,'',chatUrl(curId))}catch{}
}
function tabsRender(){
  $('#tabs').innerHTML=chats.map(c=>`<div class="tab${c.id===curId?' on':''}${c._responding?' responding':''}${c._unread?' unread':''}" role="tab" tabindex="0" aria-selected="${c.id===curId}" data-id="${c.id}" title="${esc(c.title)}"><i class="gd"></i><span class="tt">${esc(c.title)}</span><button class="x" data-x aria-label="Delete chat" title="Hold to delete" tabindex="-1">×</button></div>`).join('');
  // Horizontally scroll #tabs to reveal the active tab WITHOUT touching
  // ancestor scroll (scrollIntoView would scroll the page and push the
  // topbar off-screen when opening an existing chat).
  const on=$('.tab.on');
  if(on){
    const tabs=$('#tabs');
    const l=on.offsetLeft,r=l+on.offsetWidth;
    if(l<tabs.scrollLeft)tabs.scrollLeft=l;
    else if(r>tabs.scrollLeft+tabs.clientWidth)tabs.scrollLeft=r-tabs.clientWidth;
  }
}
function switchTo(id){
  if(id===curId)return;
  // Don't abort — any in-progress response continues in the background.
  const p=cur();if(!p.msgs.length&&!p._responding&&chats.length>1)chats.splice(chats.indexOf(p),1);
  curId=id;render();save();input.focus();
}
function newChat(){
  if(!cur().msgs.length){input.focus();return}
  // Don't abort — any in-progress response continues in the background.
  const n=mk();chats.push(n);curId=n.id;render();save();input.focus();
}
function del(id){
  const i=chats.findIndex(c=>c.id===id);if(i<0)return;
  const c=chats[i],wasCur=id===curId;
  // Abort this chat's background response if it's running.
  if(c._abort){c._abort.abort();c._responding=false;c._abort=null;c._stream=null}
  chats.splice(i,1);
  const fresh=chats.length?null:mk();if(fresh)chats.push(fresh);
  if(wasCur){curId=chats[Math.min(i,chats.length-1)].id;render()}
  else tabsRender();
  save();
  toast('Deleted “'+c.title+'”',()=>{
    if(fresh)chats.splice(chats.indexOf(fresh),1);
    chats.splice(Math.min(i,chats.length),0,c);curId=c.id;render();save();
  });
}
function rename(tab){
  const c=chats.find(x=>x.id===tab.dataset.id),tt=tab.querySelector('.tt');let fin=false;
  tt.setAttribute('contenteditable','true');tt.focus();
  const r=document.createRange();r.selectNodeContents(tt);const sel=getSelection();sel.removeAllRanges();sel.addRange(r);
  const done=ok=>{
    if(fin)return;fin=true;
    const v=tt.textContent.trim();
    if(ok&&v){c.title=v.slice(0,60);c.auto=false;save()}
    tabsRender();input.focus();
  };
  tt.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();done(true)}else if(e.key==='Escape'){e.preventDefault();done(false)}};
  tt.onblur=()=>done(true);
}
let toastT;
function toast(msg,undo){
  const t=$('#toast');
  t.innerHTML='<span>'+esc(msg)+'</span>'+(undo?'<button>Undo</button>':'');
  t.hidden=false;
  if(undo)t.querySelector('button').onclick=()=>{undo();t.hidden=true};
  clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,6000);
}

let holdTimer=null,holdBtn=null;
const HOLD_MS=500;
function startHold(btn){
  if(holdTimer)return;
  holdBtn=btn;
  btn.classList.add('holding');
  holdTimer=setTimeout(()=>{
    const id=btn.closest('.tab')?.dataset.id;
    endHold();
    if(id)del(id);
  },HOLD_MS);
}
function endHold(){
  if(holdTimer){clearTimeout(holdTimer);holdTimer=null}
  if(holdBtn){holdBtn.classList.remove('holding');holdBtn=null}
}
tabs.addEventListener('pointerdown',e=>{
  const x=e.target.closest('[data-x]');
  if(!x)return;
  e.preventDefault();
  startHold(x);
});
tabs.addEventListener('pointerup',endHold);
tabs.addEventListener('pointerleave',endHold);
tabs.addEventListener('pointercancel',endHold);
window.addEventListener('blur',endHold);

tabs.addEventListener('click',e=>{
  const t=e.target.closest('.tab');if(!t)return;
  if(e.target.closest('[data-x]'))return;
  switchTo(t.dataset.id);
});
tabs.addEventListener('auxclick',e=>{const t=e.target.closest('.tab');if(t&&e.button===1){e.preventDefault();del(t.dataset.id)}});
tabs.addEventListener('dblclick',e=>{const t=e.target.closest('.tab');if(t&&!e.target.closest('[data-x]'))rename(t)});
tabs.addEventListener('keydown',e=>{
  const t=e.target.closest('.tab');if(!t||e.target.isContentEditable)return;
  if(e.key==='Enter'||e.key===' '){e.preventDefault();switchTo(t.dataset.id)}else if(e.key==='F2')rename(t);
});
tabs.addEventListener('wheel',e=>{if(Math.abs(e.deltaY)>Math.abs(e.deltaX)){tabs.scrollLeft+=e.deltaY;e.preventDefault()}},{passive:false});
$('#plus').onclick=newChat;
