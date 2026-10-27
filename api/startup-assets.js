const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { gzipSync } = require('node:zlib');
const FILES = { styles: 'assets/invella-bundle.css', sdk: 'supabase.min.js', app: 'assets/invella-app.js', premium: 'assets/invella-premium-fix.js',network:'assets/invella-network.js',fragment:'assets/invella-fragment.html',admin:'assets/invella-admin.js' };
const CHUNK_BYTES = 6144;
const cache = new Map();
async function read(file){try{return await fs.readFile(path.join(process.cwd(),file))}catch(error){if(error.code!=='ENOENT')throw error;return fs.readFile(path.join(__dirname,'..',file))}}
module.exports = async function startupAssets(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  const ownOrigin = 'https://' + (req.headers.host || 'invella.ru');
  if (req.headers.origin && req.headers.origin !== ownOrigin) return res.status(403).json({ error: 'Origin not allowed' });
  let body = req.body;
  try { if (typeof body === 'string') body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  const modern=body&&body.protocol===2,size=modern?(body.chunkSize===undefined?384:body.chunkSize):CHUNK_BYTES;
  if(modern&&![384,4096].includes(size))return res.status(400).json({error:'Invalid chunk size'});
  if (!body || (body.protocol!==undefined&&body.protocol!==2) || !Object.prototype.hasOwnProperty.call(FILES, body.asset) || !Number.isInteger(body.offset) || body.offset < 0 || body.offset % size !== 0) return res.status(400).json({ error: 'Invalid asset or offset' });
  try {
    if(modern){
      if(!['gzip','identity'].includes(body.encoding)||!/^[a-f0-9]{16}$/.test(body.build||''))return res.status(400).json({error:'Invalid encoding or build'});
      const manifest=JSON.parse((await read('assets/invella-startup-manifest.json')).toString('utf8'));
      if(body.build!==manifest.build)return res.status(409).json({error:'Page version changed'});
      const key=manifest.build+':'+body.asset+':'+body.encoding;
      if(!cache.has(key)){
        const source=await read(FILES[body.asset]);
        if(source.length>1048576||createHash('sha256').update(source).digest('hex')!==manifest.hashes[body.asset])throw Error('Asset manifest mismatch');
        const bytes=body.encoding==='gzip'?gzipSync(source):source;
        cache.set(key,{bytes,hash:createHash('sha256').update(bytes).digest('hex')});
      }
      const entry=cache.get(key),chunk=entry.bytes.subarray(body.offset,body.offset+size);
      if(!chunk.length)return res.status(400).json({error:'Offset out of range'});
      return res.status(200).json({asset:body.asset,offset:body.offset,bytes:chunk.length,total:entry.bytes.length,sha256:entry.hash,encoding:body.encoding,build:manifest.build,data:chunk.toString('base64')});
    }
    let bytes;
    try { bytes = await fs.readFile(path.join(process.cwd(), FILES[body.asset])); }
    catch (error) { if (error.code !== 'ENOENT') throw error; bytes = await fs.readFile(path.join(__dirname, '..', FILES[body.asset])); }
    if (body.offset >= bytes.length || bytes.length > 1048576) return res.status(400).json({ error: 'Offset out of range' });
    const chunk = bytes.subarray(body.offset, body.offset + CHUNK_BYTES);
    return res.status(200).json({ asset: body.asset, offset: body.offset, bytes: chunk.length, total: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), data: chunk.toString('base64') });
  } catch (error) { console.error('Invella startup asset:', body.asset, error.code || 'read_failed'); return res.status(503).json({ error: 'Asset unavailable' }); }
};
