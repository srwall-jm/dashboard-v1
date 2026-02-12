export async function onRequest(context) {
  const url = new URL(context.request.url);

  // 1. Filtro: Solo actuamos si la petición es para la API de SA360
  if (url.pathname.startsWith('/api/sa360')) {
    
    // 2. Extraemos la ruta interna (ej: de /api/sa360/v0/customers extraemos /v0/customers)
    const apiPath = url.pathname.replace('/api/sa360', '');
    
    // 3. Construimos la URL final hacia los servidores de Google
    const targetUrl = `https://searchads360.googleapis.com${apiPath}${url.search}`;

    // 4. Clonamos la petición original para no perder los Tokens de Google ni el Body
    const newRequest = new Request(targetUrl, {
      method: context.request.method,
      headers: context.request.headers,
      body: context.request.body,
    });

    try {
      // 5. El servidor de Cloudflare hace la llamada por nosotros (esto evita el error de CORS)
      return await fetch(newRequest);
    } catch (err) {
      return new Response(JSON.stringify({ error: "Error en el Proxy", details: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  // 6. Si no es una ruta de API, dejamos que Cloudflare cargue la web normal
  return await context.next();
}