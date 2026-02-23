import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: Request) {
    try {
        const { violation } = await req.json();
        const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

        if (!apiKey) {
            return NextResponse.json(
                { error: 'Gemini API Key not configured. Please add GOOGLE_GENERATIVE_AI_API_KEY to your .env.local file.' },
                { status: 500 }
            );
        }

        if (!violation) {
            return NextResponse.json({ error: 'Violation data required' }, { status: 400 });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        // Construct a focused prompt for accessibility remediation
        const prompt = `
      You are an expert Web Accessibility (WCAG & Section 508) Specialist.
      Analyze the following accessibility violation and provide a concise code fix.
      
      VIOLATION:
      - Rule ID: ${violation.id}
      - Impact: ${violation.impact}
      - Description: ${violation.description}
      - HTML Element: ${violation.nodes[0]?.html || 'N/A'}
      - Failure Summary: ${violation.nodes[0]?.failureSummary || 'N/A'}

      TASK:
      1. Explain briefly why this is an issue.
      2. Provide the CORRECTED HTML/JSX code snippet.
      3. Explain what attributes or changes fixed it.
      
      Keep the response compact and formatted in Markdown.
    `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const suggestion = response.text();

        return NextResponse.json({ suggestion });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        console.error('AI Fix Error:', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
