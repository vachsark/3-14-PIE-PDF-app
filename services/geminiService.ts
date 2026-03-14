import { GoogleGenAI } from "@google/genai";

let genAI: GoogleGenAI | null = null;

export const initializeGemini = (apiKey: string) => {
  if (!apiKey) return;
  genAI = new GoogleGenAI({ apiKey });
};

export const askGeminiAboutText = async (text: string, question: string): Promise<string> => {
  if (!genAI) {
    // If no key provided via env, we might prompt user or fail gracefully.
    // For this demo, we assume process.env.API_KEY is available or user provided one.
    if (process.env.API_KEY) {
        genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });
    } else {
        throw new Error("Gemini API not initialized. Please provide an API Key.");
    }
  }

  try {
    const model = 'gemini-2.5-flash';
    const response = await genAI.models.generateContent({
      model: model,
      contents: `Context from PDF Page:\n${text}\n\nUser Question: ${question}`,
      config: {
        systemInstruction: "You are a helpful assistant analyzing PDF content. Keep answers concise and relevant."
      }
    });

    return response.text || "No response generated.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Error communicating with AI service.";
  }
};

export const summarizeText = async (text: string): Promise<string> => {
    return askGeminiAboutText(text, "Please provide a concise summary of this page.");
}
