(function () {
  'use strict';
  // Keep the deadline until the body is read: receiving headers is not success.
  var nativeFetch = window.fetch.bind(window);
  window.invellaFetch = async function (input, options) {
    options = options || {};
    var controller = new AbortController(), upstream = options.signal;
    var cancel = function () { controller.abort(); };
    if (upstream) {
      if (upstream.aborted) cancel();
      else upstream.addEventListener('abort', cancel, { once: true });
    }
    var url = String(input && input.url || input);
    var timeout = /\/storage\/v1\//.test(url) ? 90000 : 20000;
    var timer = setTimeout(cancel, timeout);
    try {
      var response = await nativeFetch(input, Object.assign({}, options, { signal: controller.signal }));
      var bytes = await response.arrayBuffer();
      return new Response([204, 205, 304].indexOf(response.status) >= 0 ? null : bytes, {
        status: response.status, statusText: response.statusText, headers: response.headers
      });
    } finally {
      clearTimeout(timer);
      if (upstream) upstream.removeEventListener('abort', cancel);
    }
  };
})();
