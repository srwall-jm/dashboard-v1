
export async function onRequest(context) {
  const url = new URL(context.request.url);

  // If the URL contains our API prefix
  if (url.pathname.includes('/api/googleads/')) {
    // 1. Extract the Google part (after /api/googleads)
    const parts = url.pathname.split('/api/googleads');
    const apiPath = parts[1]; 
    
    const targetUrl = `https://googleads.googleapis.com${apiPath}${url.search}`;

    // 2. Filter conflicting headers
    const newHeaders = new Headers();
    for (const [key, value] of context.request.headers) {
        // Exclude headers that can cause conflicts in the proxy
        if (!['host', 'content-length', 'connection', 'accept-encoding'].includes(key.toLowerCase())) {
            newHeaders.set(key, value);
        }
    }

    // 3. Create clean request for Google
    const newRequest = new Request(targetUrl, {
      method: context.request.method,
      headers: newHeaders,
      body: context.request.body,
    });

    // 4. Return the Google response
    return await fetch(newRequest);
  }

  // If it is not the API, let the web load normally
  return await context.next();
}
