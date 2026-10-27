// JSON APIs in this project have small bodies. Read the body under the same deadline.
module.exports = async function serverFetch(input, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  const cancel = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) cancel();
    else options.signal.addEventListener('abort', cancel, { once: true });
  }
  try {
    const response = await fetch(input, { ...options, signal: controller.signal });
    // Preserve simple fetch doubles used by the regression tests.
    if (typeof response.arrayBuffer !== 'function') return response;
    const bytes = await response.arrayBuffer();
    return new Response([204, 205, 304].includes(response.status) ? null : bytes, {
      status: response.status, statusText: response.statusText, headers: response.headers
    });
  } finally {
    clearTimeout(timer);
    if (options.signal) options.signal.removeEventListener('abort', cancel);
  }
};
