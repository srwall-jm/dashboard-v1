export async function onRequest(context) {
  const url = new URL(context.request.url);
  
  return new Response(JSON.stringify({
    status: "OK",
    ruta: "functions/api/sa360/[[path]].js",
    mensaje: "La ruta dinámica funciona correctamente",
    path_recibido: url.pathname
  }), {
    headers: { "Content-Type": "application/json" }
  });
}