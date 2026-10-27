(function () {
  'use strict';
  function report() {
    var checks = [
      !!document.getElementById('invellaLoadedStyles'),
      !!(window.supabase && window.supabase.createClient),
      window.invellaReady === true,
      window.invellaPremiumReady === true
    ].map(function (ready) { return { status: ready ? 'ok' : 'network', code: ready ? 200 : 0, bytes: 0, ms: 0, transport: 'inline' }; });
    var send = window.invellaFetch || window.fetch.bind(window);
    send('/api/connection-report', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      referrerPolicy: 'no-referrer', body: JSON.stringify({ phase: 'startup', checks: checks }) }).catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', report, { once: true });
  else report();
})();
