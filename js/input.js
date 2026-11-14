$('#form').addEventListener('submit',e=>{e.preventDefault();if(busy){const ch=cur();if(ch&&ch._abort)ch._abort.abort()}else submit(input.value)});
input.addEventListener('input',()=>{resize();updateCharCount()});
input.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&busy){const ch=cur();if(ch&&ch._abort)ch._abort.abort()}
  if(e.key!=='Enter'||e.isComposing)return;
  if(S.enter?!e.shiftKey:(e.ctrlKey||e.metaKey)){e.preventDefault();if(!busy)submit(input.value)}
});

/* ---- Plus Menu (External Services) ---- */
const plusBtn = $('#plus-btn');
const plusMenu = $('#plus-menu');
const addGmail = $('#add-gmail');
const tagsContainer = $('#tags');

plusBtn.onclick = (e) => {
  e.stopPropagation();
  plusMenu.classList.toggle('open');
};

document.addEventListener('click', (e) => {
  if (!plusMenu.contains(e.target) && e.target !== plusBtn) {
    plusMenu.classList.remove('open');
  }
});

addGmail.onclick = () => {
  const tag = document.createElement('div');
  tag.className = 'tag';
  tag.dataset.name = 'Gmail';
  tag.innerHTML = `
    <svg viewBox="0 0 24 24" width="14" height="14" fill="#ea4335"><path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L12 9.077l8.073-5.584C21.691 2.279 24 3.434 24 5.457z"/></svg>
    Gmail
    <button type="button" aria-label="Remove">&times;</button>
  `;
  tag.querySelector('button').onclick = () => { tag.remove(); updateSendState(); };
  tagsContainer.appendChild(tag);
  plusMenu.classList.remove('open');
  updateSendState();
  input.focus();
};
