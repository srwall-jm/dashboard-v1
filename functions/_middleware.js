export async function onRequest(context) {
  const url = new URL(context.request.url);

  // Si la URL contiene nuestro prefijo de API
  if (url.pathname.includes('/api/sa360/')) {
    // 1. Extraemos la parte de Google (después de /api/sa360)
    const parts = url.pathname.split('/api/sa360');
    const apiPath = parts[1]; 
    
    const targetUrl = `https://searchads360.googleapis.com${apiPath}${url.search}`;

    // 2. Creamos la petición limpia para Google
    const newRequest = new Request(targetUrl, {
      method: context.request.method,
      headers: context.request.headers,
      body: context.request.body,
    });

    // 3. Devolvemos la respuesta de Google
    return await fetch(newRequest);
  }

  // Si no es la API, que la web cargue normal
  return await context.next();
}