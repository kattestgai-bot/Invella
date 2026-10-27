(function () {
  'use strict';
  var nativeFetch = window.fetch.bind(window), preferPost = window.invellaSmallDelivery===true, preferDirect=window.invellaDirectBackend===true;
  function rememberDirect(){preferDirect=true;try{localStorage.setItem('invella_direct_backend','1');}catch(error){}}
  try { preferPost = preferPost || localStorage.getItem('invella_post_reads') === '1';preferDirect=preferDirect||localStorage.getItem('invella_direct_backend')==='1';if(preferDirect)rememberDirect(); } catch (error) {}
  function directUrl(value){try{var parsed=new URL(value,window.location.origin);if(parsed.origin===window.location.origin&&parsed.pathname.indexOf('/sb/')===0)return 'https://lwanymjmbcstvggmhevx.supabase.co'+parsed.pathname.slice(3)+parsed.search;}catch(error){}return null;}
  window.invellaMediaUrl=function(value){return preferDirect?directUrl(String(value||''))||value:value;};
  async function buffered(input, options, ms) {
    var controller = new AbortController(), upstream = options.signal;
    var cancel = function () { controller.abort(); };
    if (upstream) {
      if (upstream.aborted) cancel();
      else upstream.addEventListener('abort', cancel, { once: true });
    }
    var timer = setTimeout(cancel, ms);
    try {
      var response = await nativeFetch(input, Object.assign({}, options, { signal: controller.signal }));
      // Keep the deadline until the body is read, even after HTTP 200 headers.
      var bytes = await response.arrayBuffer();
      return new Response([204, 205, 304].indexOf(response.status) >= 0 ? null : bytes, {
        status: response.status, statusText: response.statusText, headers: response.headers
      });
    } finally {
      clearTimeout(timer);
      if (upstream) upstream.removeEventListener('abort', cancel);
    }
  }
  window.invellaFetch = async function (input, options) {
    options = options || {};
    var url = String(input && input.url || input), route = null;
    var method = String(options.method || input && input.method || 'GET').toUpperCase();
    var direct=directUrl(url),directInput=direct&&(typeof Request!=='undefined'&&input instanceof Request?new Request(direct,input.clone()):direct);
    try {
      var parsed = new URL(url, window.location.origin);
      if (method === 'GET' && parsed.origin === window.location.origin && /^\/sb\/rest\/v1\/(invitations|rsvp_responses)$/.test(parsed.pathname))
        route = parsed.pathname.slice(3) + parsed.search;
    } catch (error) {}
    if(preferDirect&&direct){
      // Reuse the customer's JWT against the same Supabase project. Never retry a write.
      try{return await buffered(directInput,options,route?5000:/\/storage\/v1\//.test(url)?90000:20000);}
      catch(error){if(!route||options.signal&&options.signal.aborted)throw error;}
    }else if (!route || !preferPost) {
      try { return await buffered(input, options, route ? 5000 : /\/storage\/v1\//.test(url) ? 90000 : 20000); }
      catch (error) { if (!route || options.signal && options.signal.aborted) throw error; }
      try{var recovered=await buffered(directInput,options,5000);rememberDirect();return recovered;}
      catch(error){if(options.signal&&options.signal.aborted)throw error;}
    }
    var headers = new Headers(options.headers || input && input.headers || {});
    var response = await buffered('/api/read-data', {
      method: 'POST', credentials: 'same-origin', signal: options.signal,
      headers: { 'Content-Type': 'application/json', Authorization: headers.get('Authorization') || '' },
      body: JSON.stringify({ path: route })
    }, 20000);
    if (response.ok) { preferPost = true; try { localStorage.setItem('invella_post_reads', '1'); } catch (error) {} }
    return response;
  };
})();
