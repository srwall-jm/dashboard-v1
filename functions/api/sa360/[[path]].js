export async function onRequest(context) {
  const url = new URL(context.request.url);

  // 1. Limpiar la ruta: quitamos '/api/sa360' para dejar solo lo que le interesa a Google
  // Ej: de '/api/sa360/v0/customers/...' pasamos a '/v0/customers/...'
  const apiPath = url.pathname.replace('/api/sa360', '');

  // 2. Construir la dirección real de Google
  const targetUrl = `https://searchads360.googleapis.com${apiPath}${url.search}`;

  // 3. Crear una petición clonada (mantenemos tus tokens de seguridad y el cuerpo de la consulta)
  const newRequest = new Request(targetUrl, {
    method: context.request.method,
    headers: context.request.headers,
    body: context.request.body,
  });

  // 4. Enviar la petición a Google y devolver la respuesta a tu web
  const response = await fetch(newRequest);
  return response;
}