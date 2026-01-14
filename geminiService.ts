
import { GoogleGenAI } from "@google/genai";

export const getDashboardInsights = async (dataSummary: string, dashboardName: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a world-class SEO and Data Analyst. Analyze the following summary of ${dashboardName} and provide 3-4 bullet points of actionable insights and observations.
      
      Data Summary:
      ${dataSummary}
      
      Focus on growth opportunities, efficiency between channels, and anomalies. Keep it concise and professional. Respond in Spanish.`,
    });
    
    return response.text;
  } catch (error) {
    console.error("Error fetching Gemini insights:", error);
    return "No se han podido generar insights con Gemini en este momento.";
  }
};

export const getOpenAiInsights = async (apiKey: string, dataSummary: string, dashboardName: string) => {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: `Eres un Analista de Datos y SEO de clase mundial. Analiza el siguiente resumen de ${dashboardName} y proporciona 3-4 puntos clave con insights accionables y observaciones. Enfócate en oportunidades de crecimiento, eficiencia entre canales y anomalías. Mantén la respuesta concisa, profesional y en español.`
          },
          { 
            role: 'user', 
            content: `Resumen de Datos:\n${dataSummary}` 
          }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Error en la API de OpenAI');
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error: any) {
    console.error("Error fetching OpenAI insights:", error);
    throw error;
  }
};
