import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const key = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(key);
const modelName = 'gemini-flash-latest';
const model = genAI.getGenerativeModel({ 
  model: modelName,
  generationConfig: {
    maxOutputTokens: 2048,
  }
});

export async function askGlobalQuestion(message: string, context: string) {
  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is missing in global chat service!");
  }

  const prompt = `You are Aurora, a helpful, professional global AI Legal Assistant. You have access to a library of legal and financial documents that the user has analyzed. 
Here is a consolidated summary of the documents currently in the user's library:
---
${context.substring(0, 50000)}
---

The user has asked the following question regarding their entire library of documents:
"${message}"

Please answer the user's question concisely, comparing documents if necessary, based primarily on the provided library context. If the answer is not in the context, politely say so. Format the response cleanly.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (err: any) {
    console.error("Gemini API Error in askGlobalQuestion:", err);
    throw err;
  }
}
