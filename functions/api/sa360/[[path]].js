export async function onRequest(context) {
  const url = new URL(context.request.url);
  // Limpiar la ruta para Google
  const apiPath = url.pathname.replace('/api/sa360', '');
  const targetUrl = `https://searchads360.googleapis.com${apiPath}${url.search}`;

  // Crear petición segura servidor-a-servidor
  const newRequest = new Request(targetUrl, {
    method: context.request.method,
    headers: context.request.headers,
    body: context.request.body,
  });

  const response = await fetch(newRequest);
  return response;
}