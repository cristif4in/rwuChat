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

/* ---- Models menu (provider-aware model picker + thinking toggle) ---- */
const MODEL_LISTS = {
  gemini: [
    { m: 'gemini-3.8-flash', think: true },
    { m: 'gemini-3.8-pro', think: true },
    { m: 'gemini-2.5-flash', think: true },
    { m: 'gemini-2.5-pro', think: true }
  ],
  openai: [
    { m: 'gpt-4o-mini' },
    { m: 'gpt-4o' },
    { m: 'gpt-4.1' },
    { m: 'o4-mini', think: true }
  ],
  anthropic: [
    { m: 'claude-sonnet-4-20250514', think: true },
    { m: 'claude-3-7-sonnet-20250219', think: true },
    { m: 'claude-3-5-haiku-20241022' }
  ],
  openrouter: [
    { m: 'inclusionai/ling-3.2-flash:free' },
    { m: 'deepseek/deepseek-r1:free', think: true },
    { m: 'meta-llama/llama-3.3-70b-instruct:free' },
    { m: 'google/gemini-2.0-flash-exp:free', think: true }
  ]
};

function renderModelsMenu(){
  const box = $('#sub-menu-models');
  const det = (typeof detectProvider === 'function') ? detectProvider(CONFIG.key) : null;
  const groups = det ? [det] : Object.keys(MODEL_LISTS);
  const custom = CONFIG.customModels || [];
  const thinkP = det; // custom entries use the detected provider for thinking
  box.innerHTML = groups.map(p => `<div class="mm-group"><div class="mm-gname">${esc(p)}</div>`
    + MODEL_LISTS[p].map(x => {
      const on = (CONFIG.model || '') === x.m;
      return `<div class="mm-model${on ? ' on' : ''}" data-m="${esc(x.m)}"><span class="mm-name">${esc(x.m)}</span>`
        + (x.think ? `<button class="mm-think${thinkEnabled(p) ? ' on' : ''}" data-think="${p}" title="Toggle thinking mode">Thinking ${thinkEnabled(p) ? 'On' : 'Off'}</button>` : '')
        + `</div>`;
    }).join('') + `</div>`).join('')
    + `<div class="mm-group"><div class="mm-gname">Custom</div>`
    + custom.map(id => {
      const on = (CONFIG.model || '') === id;
      return `<div class="mm-model${on ? ' on' : ''}" data-m="${esc(id)}"><span class="mm-name">${esc(id)}</span>`
        + (thinkP ? `<button class="mm-think${thinkEnabled(thinkP) ? ' on' : ''}" data-think="${thinkP}" title="Toggle thinking mode">Thinking ${thinkEnabled(thinkP) ? 'On' : 'Off'}</button>` : '')
        + `<button class="mm-del" data-del="${esc(id)}" title="Remove">&times;</button></div>`;
    }).join('')
    + `<div class="mm-add"><input id="mm-new" placeholder="provider/model-id:variant" spellcheck="false"><button data-add>Add</button></div></div>`;
}
function mmAddCustom(id){
  id = (id || '').trim();
  if (!id) return;
  CONFIG.customModels = CONFIG.customModels || [];
  if (!CONFIG.customModels.includes(id)) CONFIG.customModels.push(id);
  CONFIG.model = id;
  saveConfigModel();
  renderModelsMenu();
  toast('Model set to ' + id + '.');
}
$('#sub-menu-models').addEventListener('click', e => {
  // Keep the + menu open: never let these clicks reach the document-level
  // click-outside closer (rendering also detaches the clicked element,
  // which would otherwise make contains() fail and close the menu).
  e.stopPropagation();
  const del = e.target.closest('[data-del]');
  if (del) {
    CONFIG.customModels = (CONFIG.customModels || []).filter(x => x !== del.dataset.del);
    if (CONFIG.model === del.dataset.del) CONFIG.model = '';
    saveConfigModel();
    renderModelsMenu();
    return;
  }
  if (e.target.closest('[data-add]')) { mmAddCustom($('#mm-new').value); return; }
  const tb = e.target.closest('[data-think]');
  if (tb) {
    const p = tb.dataset.think;
    CONFIG.think = CONFIG.think || {};
    CONFIG.think[p] = !thinkEnabled(p);
    saveConfigModel();
    renderModelsMenu();
    toast('Thinking ' + (thinkEnabled(p) ? 'enabled' : 'disabled') + ' for ' + p + '.');
    return;
  }
  const row = e.target.closest('.mm-model');
  if (!row) return;
  CONFIG.model = row.dataset.m;
  saveConfigModel();
  renderModelsMenu();
  toast('Model set to ' + CONFIG.model + '.');
});
$('#sub-menu-models').addEventListener('keydown', e => {
  if (e.target.id === 'mm-new' && e.key === 'Enter') {
    e.preventDefault();
    e.stopPropagation();
    mmAddCustom(e.target.value);
  }
});
plusBtn.onclick = (e) => {
  e.stopPropagation();
  if (!plusMenu.classList.contains('open')) renderModelsMenu();
  plusMenu.classList.toggle('open');
};
