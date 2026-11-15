/* ---- Build: content-hash assets into dist/ ----
 * Usage: node build.js
 * - Each js/css file gets a unique fingerprint from its own content,
 *   written from scratch (FNV-1a, no libraries):
 *     css/base.css  ->  dist/css/base.3f9a2c1b.css
 * - index.html references are rewritten to the hashed names.
 * - index.html + .htaccess are copied as-is (they must never be cached,
 *   so they don't need a hash).
 * Upload the CONTENTS of dist/ to your host.
 */
const fs=require('fs'),path=require('path');

// FNV-1a 32-bit over raw file bytes -> 8 hex chars. Simple, from scratch.
function contentHash(buf){
  let h=0x811c9dc5;                       // FNV offset basis
  for(let i=0;i<buf.length;i++){
    h^=buf[i];
    h=Math.imul(h,0x01000193)>>>0;        // FNV prime, keep unsigned 32-bit
  }
  return h.toString(16).padStart(8,'0');
}

const SRC=path.join(__dirname),DIST=path.join(__dirname,'dist');
fs.rmSync(DIST,{recursive:true,force:true});

// Copy a plain file into dist/, preserving its relative folder.
function copyPlain(rel){
  const src=path.join(SRC,rel),dst=path.join(DIST,rel);
  fs.mkdirSync(path.dirname(dst),{recursive:true});
  fs.copyFileSync(src,dst);
  return rel;
}

// Hash-copy an asset -> dist/<dir>/<name>.<hash8>.<ext>; returns hashed name.
function hashedAsset(rel){
  const src=path.join(SRC,rel);
  const buf=fs.readFileSync(src);
  const dir=path.dirname(rel),ext=path.extname(rel),base=path.basename(rel,ext);
  const out=`${dir}/${base}.${contentHash(buf)}${ext}`.replace(/\\/g,'/');
  const dst=path.join(DIST,out);
  fs.mkdirSync(path.dirname(dst),{recursive:true});
  fs.writeFileSync(dst,buf);
  return out;
}

// Grab index.html, find every local css/js reference, rewrite to hashed.
let html=fs.readFileSync(path.join(SRC,'index.html'),'utf8');
const hashed=[];  // asset names as they land in dist/, for the SW precache list
html=html.replace(/(?:href|src)="((?:css|js)\/[A-Za-z0-9_\-]+?\.(?:css|js))(?:\?[^"]*)?"/g,(m,rel)=>{
  const hashedName=hashedAsset(rel);
  hashed.push(hashedName);
  const attr=m.startsWith('href')?'href':'src';
  return `${attr}="${hashedName}"`;
});
fs.mkdirSync(DIST,{recursive:true});
// Pyodide worker: hashed + reference rewritten (not a <script src>, so the
// main regex above can't see it).
const workerAsset=hashedAsset('js/py-worker.js');
hashed.push(workerAsset);
html=html.replace(/data-py-worker="js\/py-worker\.js"/,()=>`data-py-worker="${workerAsset}"`);
fs.writeFileSync(path.join(DIST,'index.html'),html);

// Generate dist/sw.js from js/sw.js, injecting the hashed asset list at the
// /*__ASSETS__*/ marker. sw.js itself is never hashed/cached hard — the
// browser must re-fetch it to discover new precache lists.
const swSrc=fs.readFileSync(path.join(SRC,'js','sw.js'),'utf8');
const swOut=swSrc.replace(
  /\/\*__ASSETS__\*\/\[.*?\/\*__ASSETS__\*\//,
  '/*__ASSETS__*/'+JSON.stringify(['./',...hashed])+'/*__ASSETS__*/'
);
fs.writeFileSync(path.join(DIST,'sw.js'),swOut);

// Non-hashed files that belong on the host.
copyPlain('.htaccess');
copyPlain('README.md');
copyPlain('ai.key.example');

const listed=fs.readdirSync(path.join(DIST,'js')).concat(fs.readdirSync(path.join(DIST,'css')).map(f=>'css/'+f));
console.log('Build complete → dist/');
console.log('  index.html rewritten, '+listed.length+' hashed assets, sw.js precache list injected.');
console.log('Upload the CONTENTS of dist/ to your host (htdocs).');
