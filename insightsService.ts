// AI insights clients.
// Gemini runs on the server (functions/api/insights.js) so its API key never reaches the browser.
// OpenAI uses the key each user saves in Settings, stored only in their own browser.

export const getDashboardInsights = async (dataSummary: string, dashboardName: string): Promise<string> => {
  const response = await fetch('/api/insights', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataSummary, dashboardName }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Gemini insights failed (status ${response.status}).`);
  }
  return data.text || '';
};

export const getOpenAiInsights = async (apiKey: string, dataSummary: string, dashboardName: string): Promise<string> => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a world-class SEO and Data Analyst. Analyze the following summary of the "${dashboardName}" page. Provide 3-4 key points with actionable insights based strictly on the context of this specific view. Focus on ROI, growth, and efficiency. British English only.`,
        },
        { role: 'user', content: `Data for ${dashboardName}:\n${dataSummary}` },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Error from OpenAI API');
  }

  const data = await response.json();
  return data.choices[0].message.content;
};
