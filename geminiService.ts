
import { GoogleGenAI } from "@google/genai";

export const getDashboardInsights = async (dataSummary: string, dashboardName: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    /* Use gemini-3-pro-preview for complex reasoning tasks like business data analysis */
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `You are a world-class SEO and Data Analyst. Analyze the following summary of ${dashboardName} and provide 3-4 bullet points of actionable insights and observations.
      
      Data Summary:
      ${dataSummary}
      
      Focus on growth opportunities, efficiency between channels, and anomalies. Keep it concise, professional, and respond in British English.`,
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
            content: `You are a world-class SEO and Data Analyst. Analyze the following summary of ${dashboardName} and provide 3-4 key points with actionable insights and observations. Focus on growth opportunities, channel efficiency, and anomalies. Keep the response concise, professional, and in British English.`
          },
          { 
            role: 'user', 
            content: `Data Summary:\n${dataSummary}` 
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
