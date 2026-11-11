// POST /api/insights
// Generates the "Strategic Report" text with Gemini. The key stays on the server:
// set GEMINI_API_KEY as an encrypted variable in the Cloudflare Pages project.
// Optional: GEMINI_MODEL to change the model without touching code.

const DEFAULT_MODEL = 'gemini-3-pro-preview';
const MAX_SUMMARY_CHARS = 8000;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export async function onRequestPost({ request, env }) {
  // Only accept calls made by the dashboard itself.
  const origin = request.headers.get('Origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return json({ error: 'Forbidden' }, 403);
  }

  if (!env.GEMINI_API_KEY) {
    return json({ error: 'Gemini is not configured. Add GEMINI_API_KEY to the Cloudflare Pages project, or switch to OpenAI in Settings.' }, 503);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  const dataSummary = String(payload?.dataSummary || '').slice(0, MAX_SUMMARY_CHARS);
  const dashboardName = String(payload?.dashboardName || 'Dashboard').slice(0, 120);
  if (!dataSummary.trim()) {
    return json({ error: 'Nothing to analyse yet.' }, 400);
  }

  const prompt = `You are a world-class SEO, Paid Search, and Data Strategist.
You are analysing the "${dashboardName}" page of an advanced dashboard.
Provide 3-4 specific, high-impact bullet points of actionable insights BASED ONLY on the visible metrics provided in the summary.

Summary of current page view:
${dataSummary}

Focus on ROI, channel weight, market opportunity, or URL performance depending on the page context.
Keep it professional, data-driven, and respond in British English.`;

  const model = env.GEMINI_MODEL || DEFAULT_MODEL;
  const upstream = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
    }
  );

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return json({ error: data?.error?.message || `Gemini request failed (status ${upstream.status}).` }, 502);
  }

  const text = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
  if (!text) {
    return json({ error: 'Gemini returned an empty answer.' }, 502);
  }
  return json({ text, model });
}
