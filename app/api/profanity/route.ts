// api/profanity/route.ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!, // Use your secret API key here.
});

export async function POST(request: Request) {
  try {
    const { message } = await request.json();
    const prompt = `Please analyze the following message and determine if it contains profanity or controversial language. If the message contains profanity or is considered inappropriate, output "True". Otherwise, output "False". Message: "${message}"`;

    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: prompt }],
      max_tokens: 10,
      temperature: 0,
    });
    const answer = res.choices[0]?.message.content?.trim().toLowerCase();
    return NextResponse.json({ isProfane: answer === "true" });
  } catch (error) {
    console.error("Error checking message for profanity:", error);
    return NextResponse.json({ isProfane: false }, { status: 500 });
  }
}
