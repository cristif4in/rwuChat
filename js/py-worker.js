/* ---- Pyodide Web Worker ----
 * Runs entirely off the main thread: installing (~10 MB), initializing,
 * and executing Python can all take seconds and would otherwise freeze
 * the UI. stdout/stderr are relayed to the main thread as messages.
 */
const PYODIDE_VERSION = '0.26.2';
const CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

let pyodide = null;
let ready = false;
// Serialize runs — Pyodide executes one script at a time.
let chain = Promise.resolve();
const queued = []; // codes received before Pyodide finished loading

async function run(code) {
  try {
    await pyodide.runPythonAsync(code);
    self.postMessage({ type: 'result' });
  } catch (e) {
    self.postMessage({ type: 'error', message: (e.message || String(e)) + '\n' });
  }
}

self.onmessage = e => {
  const d = e.data;
  if (d.type !== 'run') return;
  chain = chain.then(() => ready ? run(d.code) : new Promise(res => {
    queued.push(() => run(d.code).then(res));
  }));
};

(async () => {
  try {
    importScripts(CDN + 'pyodide.js');
    pyodide = await loadPyodide({ indexURL: CDN });
    pyodide.setStdout({ batched: s => self.postMessage({ type: 'stdout', text: s + '\n' }) });
    pyodide.setStderr({ batched: s => self.postMessage({ type: 'stderr', text: s + '\n' }) });
    ready = true;
    self.postMessage({ type: 'ready' });
    const q = queued.splice(0);
    for (const fn of q) fn();
  } catch (e) {
    self.postMessage({ type: 'error', message: 'Pyodide load failed: ' + (e.message || e) + '\n' });
  }
})();
