export async function onRequest(context) {
  const url = new URL(context.request.url);
  // Quitamos el prefijo /api/sa360 para obtener la ruta limpia de Google
  const apiPath = url.pathname.replace('/api/sa360', '');
  
  // Construimos la URL real hacia Google
  const targetUrl = `https://searchads360.googleapis.com${apiPath}${url.search}`;

  // Replicamos la petición original (con tus tokens y body)
  const newRequest = new Request(targetUrl, {
    method: context.request.method,
    headers: context.request.headers,
    body: context.request.body,
  });

  // Cloudflare pide los datos a Google (esto SÍ funciona)
  const response = await fetch(newRequest);

  // Devolvemos la respuesta a tu web
  return response;
}