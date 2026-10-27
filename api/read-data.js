const serverFetch = require('../lib/server-fetch');
const URL_BASE = 'https://lwanymjmbcstvggmhevx.supabase.co';
const PUBLIC_KEY = 'sb_publishable_EY50r1gV7v1zyD9vBgrteA_JVcOg4_J';
// Read-only fallback for clients whose GET requests through /sb stall.
// The database still receives the customer's token and enforces the same RLS.
module.exports = async function readData(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  if(req.headers.origin!=='https://'+req.headers.host)return res.status(403).json({error:'Origin not allowed'});
  const route=req.body?.path;
  if(typeof route!=='string'||route.length>4096||!/^\/rest\/v1\/(invitations|rsvp_responses)(?:\?[^#]*)?$/.test(route))
    return res.status(400).json({error:'Invalid read path'});
  const authorization=req.headers.authorization;
  if(typeof authorization!=='string'||!/^Bearer [^\r\n]{1,8192}$/.test(authorization))return res.status(401).json({error:'Войдите в аккаунт'});
  try {
    const response=await serverFetch(URL_BASE+route,{method:'GET',redirect:'error',headers:{apikey:PUBLIC_KEY,Authorization:authorization}});
    const contentType=response.headers.get('content-type')||'';
    if(!contentType.includes('application/json'))throw Error('Unexpected read response');
    const bytes=Buffer.from(await response.arrayBuffer());
    if(bytes.length>2097152)throw Error('Read response too large');
    res.setHeader('Content-Type','application/json; charset=utf-8');
    for(const header of ['content-range','range-unit']){const value=response.headers.get(header);if(value)res.setHeader(header,value)}
    return res.status(response.status).send(bytes);
  } catch {
    console.error('Invella read fallback unavailable');
    return res.status(503).json({error:'Не удалось получить данные. Попробуйте ещё раз.'});
  }
};
