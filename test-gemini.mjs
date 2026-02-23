import { GoogleGenerativeAI } from '@google/generative-ai';

async function test() {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
  const models = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
  
  for (const m of models) {
    try {
      const model = genAI.getGenerativeModel({ model: m });
      const result = await model.generateContent("ping");
      console.log(\`SUCCESS: \${m}\`);
      return;
    } catch (e) {
      console.log(\`FAILED: \${m} - \${e.message}\`);
    }
  }
}
test();
