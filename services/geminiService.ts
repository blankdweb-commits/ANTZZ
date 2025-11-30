import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini
// Note: In a production app, these calls might go through a backend to protect the key,
// or use the appropriate client-side restriction settings.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const analyzeTruth = async (text: string): Promise<string[]> => {
  if (!process.env.API_KEY) {
    return ['#UNVERIFIED', '#ANONYMOUS'];
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Analyze this short text posted on an anonymous forum called "Townhall". 
      The tone is cyberpunk, somber, and raw.
      Return a list of 2-3 short, uppercase hashtags that categorize the philosophical or emotional theme.
      Example input: "I feel like a robot in a human skin." -> ["#DISSOCIATION", "#EXISTENTIAL"]
      
      Input: "${text}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          }
        },
        systemInstruction: "You are a database indexer for a cyberpunk anonymous forum. Be concise. output JSON array only."
      }
    });

    const tags = JSON.parse(response.text || '[]');
    return tags.map((t: string) => t.startsWith('#') ? t : `#${t}`);
  } catch (error) {
    console.error("Analysis failed:", error);
    return ['#ENCRYPTED'];
  }
};

export const generateSystemResponse = async (): Promise<string> => {
    if (!process.env.API_KEY) return "System diagnostics running...";

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: "Generate a cryptic, atmospheric single-sentence system status message for a cyberpunk hacker forum. Mention things like nodes, entropy, silence, or signal noise.",
        });
        return response.text?.trim() || "Signal weak.";
    } catch (e) {
        return "Connection unstable.";
    }
}
