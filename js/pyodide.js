/* ---- Pyodide (Python in browser) ---- */
const PYODIDE_VERSION="0.26.2";
const PYODIDE_CDN=`https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

function updatePyStatus(){
  const st=$("#py-status"),btn=$("#py-install"),un=$("#py-uninstall");if(!st)return;
  if(PY.instance){
    st.textContent="Installed — Pyodide v"+PYODIDE_VERSION;
    st.className="py-status ok";
    btn.style.display="none";
    if(un)un.style.display="inline-block";
    document.body.classList.add("py-ready");
  }else if(PY.loading){
    st.textContent="Installing… (downloading ~10 MB, please wait)";
    st.className="py-status loading";
    btn.style.display="none";
    if(un)un.style.display="inline-block";
    document.body.classList.remove("py-ready");
  }else if(PY.installed){
    st.textContent="Loading Pyodide…";
    st.className="py-status loading";
    btn.style.display="none";
    if(un)un.style.display="none";
  }else{
    st.textContent="Not found — install?";
    st.className="py-status err";
    btn.style.display="inline-block";
    if(un)un.style.display="none";
    document.body.classList.remove("py-ready");
  }
}

function uninstallPyodide(){
  PY.installed=false;PY.loading=false;PY.instance=null;
  try{localStorage.removeItem("chat.py")}catch{}
  document.body.classList.remove("py-ready");
  updatePyStatus();
  toast("Pyodide uninstalled — reload the page to free its memory.");
}

async function loadPyodideInstance(){
  if(PY.instance||PY.loading)return;
  PY.loading=true;updatePyStatus();
  try{
    if(!window.loadPyodide){
      await new Promise((resolve,reject)=>{
        const s=document.createElement("script");
        s.src=PYODIDE_CDN+"pyodide.js";
        s.onload=resolve;
        s.onerror=()=>reject(new Error("Failed to download Pyodide script"));
        document.head.appendChild(s);
      });
    }
    PY.instance=await window.loadPyodide({indexURL:PYODIDE_CDN});
    PY.loading=false;
    updatePyStatus();
    toast("Pyodide installed — Python Run buttons are now available.");
  }catch(e){
    PY.loading=false;PY.installed=false;
    try{localStorage.removeItem("chat.py")}catch{}
    updatePyStatus();
    toast("Pyodide install failed: "+e.message);
  }
}

async function autoLoadPyodide(){
  if(PY.installed&&!PY.instance&&!PY.loading){
    loadPyodideInstance();  // fire and forget — loads in background
  }else{
    updatePyStatus();
  }
}

function appendPyOutput(text,type){
  const body=$("#console-body");if(!body)return;
  const line=document.createElement("div");
  line.className="c-line "+(type==="error"?"error":type==="warn"?"warn":type==="info"?"info":"log");
  line.textContent=text;
  body.appendChild(line);
  body.scrollTop=body.scrollHeight;
}

async function runPython(code){
  const r=$("#runner");
  r.classList.add("has-console");
  const body=$("#console-body");body.innerHTML="";
  appendPyOutput(">>> Running Python (Pyodide v"+PYODIDE_VERSION+")…\n","info");
  if(!PY.instance){
    appendPyOutput("Python environment not loaded. Install it from Settings → Py Environment.\n","error");
    return;
  }
  PY.instance.setStdout({batched:s=>appendPyOutput(s,"log")});
  PY.instance.setStderr({batched:s=>appendPyOutput(s,"error")});
  try{
    await PY.instance.runPythonAsync(code);
    appendPyOutput("\n>>> Process finished.\n","info");
  }catch(e){
    appendPyOutput((e.message||String(e))+"\n","error");
    appendPyOutput(">>> Process exited with error.\n","error");
  }
}
