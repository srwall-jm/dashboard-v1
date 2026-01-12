
import { GoogleGenAI } from "@google/genai";

export const getDashboardInsights = async (dataSummary: string, dashboardName: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a world-class SEO and Data Analyst. Analyze the following summary of ${dashboardName} and provide 3-4 bullet points of actionable insights and observations.
      
      Data Summary:
      ${dataSummary}
      
      Focus on growth opportunities, efficiency between channels, and anomalies. Keep it concise and professional.`,
    });
    
    return response.text;
  } catch (error) {
    console.error("Error fetching insights:", error);
    return "Unable to generate insights at this moment.";
  }
};
