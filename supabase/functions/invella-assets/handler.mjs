// Public application files only. No database, Auth session, Storage or service key access.
const PUBLIC_KEY = 'sb_publishable_EY50r1gV7v1zyD9vBgrteA_JVcOg4_J';
const ASSETS = new Set(['styles','sdk','network','app','premium','fragment','admin']);
const PARAMS = new Set(['key','asset','offset','encoding','build','chunkSize']);
const UPSTREAM = 'https://invella.ru/api/startup-assets';
function allowedOrigin(origin) {
  return origin === 'https://invella.ru' || /^https:\/\/invella-[a-z0-9]+-kattestgai-9274\.vercel\.app$/.test(origin);
}
export function createAssetHandler(fetcher = fetch, timeout = 8000) {
  const cache = new Map();
  return async function handle(request) {
    const origin=request.headers.get('origin')||'';
    const headers={'Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff','Cache-Control':'no-store','Vary':'Origin'};
    if(origin&&!allowedOrigin(origin))return new Response('{"error":"Origin not allowed"}',{status:403,headers});
    if(origin)headers['Access-Control-Allow-Origin']=origin;
    headers['Access-Control-Allow-Methods']='GET, OPTIONS';
    headers['Access-Control-Allow-Headers']='apikey';headers['Access-Control-Max-Age']='86400';
    const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers});
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(request.method!=='GET'){headers.Allow='GET, OPTIONS';return reply(405,{error:'Method not allowed'});}
    const query=new URL(request.url).searchParams;
    // The publishable key identifies this public project; it grants no user or admin access here.
    if((query.get('key')||request.headers.get('apikey'))!==PUBLIC_KEY)return reply(401,{error:'Publishable key required'});
    for(const key of query.keys())if(!PARAMS.has(key)||query.getAll(key).length!==1)return reply(400,{error:'Invalid parameters'});
    const asset=query.get('asset'),encoding=query.get('encoding'),build=query.get('build'),rawOffset=query.get('offset')||'',size=Number(query.get('chunkSize')||4096),offset=Number(rawOffset);
    if(!ASSETS.has(asset)||!['gzip','identity'].includes(encoding)||!/^[a-f0-9]{16}$/.test(build||'')||!/^\d+$/.test(rawOffset)||![384,4096].includes(size)||!Number.isSafeInteger(offset)||offset<0||offset>=1048576||offset%size!==0)return reply(400,{error:'Invalid asset parameters'});
    const cacheKey=[build,asset,encoding,size,offset].join(':');
    if(cache.has(cacheKey)){headers['Cache-Control']='public, max-age=86400, immutable';return new Response(cache.get(cacheKey),{headers});}
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout),started=Date.now();
    try {
      // Construct a new request. Never forward the caller's cookies, JWT or headers.
      const response=await fetcher(UPSTREAM,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({asset,offset,encoding,protocol:2,chunkSize:size,build}),signal:controller.signal,redirect:'error'});
      if(!response.ok)return reply(response.status===409?409:502,{error:response.status===409?'Page version changed':'Asset upstream unavailable'});
      if(Number(response.headers.get('content-length')||0)>8192)throw Error('oversize');
      const text=await response.text();if(new TextEncoder().encode(text).length>8192)throw Error('oversize');
      const part=JSON.parse(text);
      if(part.asset!==asset||part.offset!==offset||part.build!==build||part.encoding!==encoding||!Number.isInteger(part.total)||part.total<1||part.total>1048576||offset>=part.total||part.bytes!==Math.min(size,part.total-offset)||!/^[a-f0-9]{64}$/.test(part.sha256||'')||typeof part.data!=='string'||part.data.length>Math.ceil(size/3)*4||!/^[a-zA-Z0-9+/]*={0,2}$/.test(part.data)||atob(part.data).length!==part.bytes)throw Error('invalid upstream');
      // Only known public fields leave this function, even if the upstream adds metadata.
      const clean=JSON.stringify({asset,offset,bytes:part.bytes,total:part.total,sha256:part.sha256,encoding,build,data:part.data});
      if(cache.size>=128)cache.delete(cache.keys().next().value);cache.set(cacheKey,clean);
      headers['Cache-Control']='public, max-age=86400, immutable';
      if(offset===0)console.info('Invella public asset',{asset,build,route:'mirror',status:200,ms:Date.now()-started});
      return new Response(clean,{headers});
    } catch(error) {
      console.warn('Invella public asset',{asset,build,route:'mirror',status:502,reason:controller.signal.aborted?'timeout':'upstream'});
      return reply(502,{error:'Asset delivery unavailable'});
    } finally {clearTimeout(timer);}
  };
}
