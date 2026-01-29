
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

export const getDashboardInsights = async (dataSummary: string, dashboardName: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    /* Use gemini-3-pro-preview for high-precision business reasoning */
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `You are a world-class SEO, Paid Search, and Data Strategist. 
      You are analysing the "${dashboardName}" page of an advanced dashboard. 
      Provide 3-4 specific, high-impact bullet points of actionable insights BASED ONLY on the visible metrics provided in the summary.
      
      Summary of current page view:
      ${dataSummary}
      
      Focus on ROI, channel weight, market opportunity, or URL performance depending on the page context. 
      Keep it professional, data-driven, and respond in British English.`,
    });
    
    return response.text;
  } catch (error) {
    console.error("Error fetching Gemini insights:", error);
    return "Unable to generate insights with Gemini at this time.";
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
            content: `You are a world-class SEO and Data Analyst. Analyze the following summary of the "${dashboardName}" page. Provide 3-4 key points with actionable insights based strictly on the context of this specific view. Focus on ROI, growth, and efficiency. British English only.`
          },
          { 
            role: 'user', 
            content: `Data for ${dashboardName}:\n${dataSummary}` 
          }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Error from OpenAI API');
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error: any) {
    console.error("Error fetching OpenAI insights:", error);
    throw error;
  }
};