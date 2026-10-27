const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {gunzipSync}=require('node:zlib');
const {createHash}=require('node:crypto');
const endpoint=require('../api/startup-assets');
const root=path.join(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/invella-startup-manifest.json')));
const files={sdk:'supabase.min.js',styles:'assets/invella-bundle.css',app:'assets/invella-app.js',premium:'assets/invella-premium-fix.js',network:'assets/invella-network.js',fragment:'assets/invella-fragment.html',admin:'assets/invella-admin.js'};
function res(){return{code:0,setHeader(){},status(code){this.code=code;return this},json(data){this.data=data;return this}}}
async function call(body){const r=res();await endpoint({method:'POST',headers:{host:'invella.ru',origin:'https://invella.ru'},body},r);return r}
(async()=>{
 let currentRequests=0;
 for(const [asset,file]of Object.entries(files))for(const encoding of ['gzip','identity'])for(const size of [384,4096]){
  const chunks=[];let offset=0,first;
  do{const r=await call({asset,offset,encoding,protocol:2,...(size===4096?{chunkSize:size}:{}),build:manifest.build});assert.equal(r.code,200);const p=r.data;
   if(size===4096&&encoding==='gzip'&&asset!=='admin')currentRequests++;
   assert.ok(Buffer.byteLength(JSON.stringify(p))<(size===384?1024:6144),'Every response must fit in its bounded transfer budget');
   assert.equal(p.offset,offset);assert.equal(p.build,manifest.build);first=first||p;
   assert.equal(p.sha256,first.sha256);const chunk=Buffer.from(p.data,'base64');assert.equal(chunk.length,p.bytes);chunks.push(chunk);offset+=p.bytes;
  }while(offset<first.total);
  const bytes=Buffer.concat(chunks);assert.equal(createHash('sha256').update(bytes).digest('hex'),first.sha256);
  assert.deepEqual(encoding==='gzip'?gunzipSync(bytes):bytes,fs.readFileSync(path.join(root,file)));
 }
 for(const body of [{asset:'sdk',offset:0,encoding:'gzip',protocol:2,build:'0000000000000000'},{asset:'sdk',offset:1,encoding:'gzip',protocol:2,build:manifest.build},{asset:'sdk',offset:0,chunkSize:999999,encoding:'gzip',protocol:2,build:manifest.build},{asset:'../../api/create-payment',offset:0,encoding:'gzip',protocol:2,build:manifest.build}])assert.ok((await call(body)).code>=400);
 assert.ok(currentRequests<=24,'A modern browser must not need hundreds of API requests to initialize');
 console.log('PASS: every public module reconstructed, current boot '+currentRequests+' compressed requests, legacy sub-1-KiB replies, hash/version/path validation');
})().catch(e=>{console.error(e);process.exitCode=1});
