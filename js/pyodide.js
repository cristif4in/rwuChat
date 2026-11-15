/* ---- Pyodide (Python in a Web Worker) ----
 * All Pyodide work happens off the main thread (see js/py-worker.js):
 * installing, initializing, and running code never freeze the UI.
 */
const PYODIDE_VERSION = "0.26.2";

function updatePyStatus(){
  const st = $("#py-status"), btn = $("#py-install"), un = $("#py-uninstall");
  if(!st) return;
  if(PY.ready){
    st.textContent = "Installed — Pyodide v" + PYODIDE_VERSION;
    st.className = "py-status ok";
    btn.style.display = "none";
    if(un)un.style.display = "inline-block";
  }else if(PY.loading){
    st.textContent = "Loading Pyodide… (background, ~10 MB — the page stays responsive)";
    st.className = "py-status loading";
    btn.style.display = "none";
    if(un)un.style.display = "inline-block";
  }else if(PY.installed){
    st.textContent = "Starting Pyodide…";
    st.className = "py-status loading";
    btn.style.display = "none";
    if(un)un.style.display = "none";
  }else{
    st.textContent = "Not found — install?";
    st.className = "py-status err";
    btn.style.display = "inline-block";
    if(un)un.style.display = "none";
  }
}

function uninstallPyodide(){
  if(PY.worker){PY.worker.terminate();PY.worker=null}
  PY.installed = false; PY.loading = false; PY.ready = false;
  document.body.classList.remove("py-ready");
  try{localStorage.removeItem("chat.py")}catch{}
  updatePyStatus();
  toast("Pyodide uninstalled — reload the page to free its memory.");
}

// Spawn the worker; Pyodide loads entirely inside it (background thread).
function loadPyWorker(){
  if(PY.worker)return PY.worker;
  PY.loading = true; updatePyStatus();
  const w = new Worker(document.body.dataset.pyWorker || 'js/py-worker.js');
  PY.worker = w;
  w.onmessage = e => {
    const d = e.data || {};
    if(d.type === 'ready'){
      PY.loading = false; PY.ready = true;
      document.body.classList.add("py-ready");  // reveals .py-run-btn Run buttons
      updatePyStatus();
      toast("Pyodide ready — Python Run buttons are live.");
      const q = PY.queue || []; PY.queue = [];
      for(const code of q) w.postMessage({type:'run', code});
    }else if(d.type === 'stdout'){
      appendPyOutput(d.text, "log");
    }else if(d.type === 'stderr'){
      appendPyOutput(d.text, "error");
    }else if(d.type === 'result'){
      appendPyOutput("\n>>> Process finished.\n", "info");
    }else if(d.type === 'error'){
      appendPyOutput(d.message || String(d), "error");
      appendPyOutput(">>> Process exited with error.\n", "error");
    }
  };
  w.onerror = e => {
    PY.loading = false; PY.ready = false; PY.installed = false;
    document.body.classList.remove("py-ready");
    try{localStorage.removeItem("chat.py")}catch{}
    updatePyStatus();
    toast("Pyodide failed to load: " + (e.message || 'unknown error'));
  };
  return w;
}

async function autoLoadPyodide(){
  if(PY.installed && !PY.ready && !PY.loading){
    loadPyWorker();  // background thread — never blocks the page
  }else{
    updatePyStatus();
  }
}

function appendPyOutput(text, type){
  const body = $("#console-body"); if(!body)return;
  const line = document.createElement("div");
  line.className = "c-line " + (type === "error" ? "error" : type === "warn" ? "warn" : type === "info" ? "info" : "log");
  line.textContent = text;
  body.appendChild(line);
  body.scrollTop = body.scrollHeight;
}

function runPython(code){
  const r = $("#runner");
  r.classList.add("has-console");
  const body = $("#console-body"); body.innerHTML = "";
  appendPyOutput(">>> Running Python (Pyodide v" + PYODIDE_VERSION + ")…\n", "info");
  const w = loadPyWorker();
  if(!PY.ready){
    appendPyOutput("Pyodide is still loading in the background — this script will run the moment it is ready…\n", "info");
    (PY.queue = PY.queue || []).push(code);
    return;
  }
  w.postMessage({type:'run', code});
}
