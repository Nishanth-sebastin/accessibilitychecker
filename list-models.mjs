import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

async function list() {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
  try {
    // There isn't a direct listModels in the standard browser-like SDK easily, 
    // but we can try a simple request to confirm if the model name works or if it's a connection issue.
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent("test");
    console.log("Success with gemini-1.5-flash");
  } catch (e) {
    console.error("Error with gemini-1.5-flash:", e.message);
    
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        await model.generateContent("test");
        console.log("Success with gemini-pro");
    } catch (e2) {
        console.error("Error with gemini-pro:", e2.message);
    }
  }
}
list();
