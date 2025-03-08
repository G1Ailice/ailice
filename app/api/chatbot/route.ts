// api/chatbot/route.ts
import { NextResponse } from 'next/server';
import { parse } from 'cookie';
import OpenAI from 'openai';
import { stripHtml } from 'string-strip-html';
import { createClient } from '@supabase/supabase-js';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Supabase client.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Module-level cache for the reference document and its embedding.
let cachedVectorContent: string | null = null;
let cachedFileEmbedding: number[] | null = null;

// Helper function to compute cosine similarity between two numeric vectors.
function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  return dot / (normA * normB);
}

async function checkIfGeneral(message: string): Promise<boolean> {
  const prompt = `Please analyze the following message and determine if it is a general, casual interaction (such as greetings, small talk, or non-specific conversation) or a specific inquiry that requires detailed information. Respond with "True" if the message is general and casual, and "False" if it is specific and requires detailed information. Only output "True" or "False" with no additional text.
Message: "${message}"`;
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: prompt }],
      max_tokens: 10,
      temperature: 0,
    });
    const answer = res.choices[0]?.message.content?.trim().toLowerCase();
    return answer === "true";
  } catch (error) {
    console.error("Error checking if message is general:", error);
    // Default to false on error.
    return false;
  }
}

export async function POST(req: Request) {
  // ========= AUTHENTICATION =========
  const cookies = parse(req.headers.get('cookie') || '');
  const session = cookies.session;
  if (!session) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }
  const userId = session.replace('session-token-', '');

  // ========= REQUEST BODY VALIDATION =========
  let body: { messages?: any; newMessage?: string };
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json({ response: "Invalid request body" }, { status: 400 });
  }
  const { messages, newMessage } = body;
  if (typeof newMessage !== 'string' || !newMessage.trim()) {
    return NextResponse.json({ response: "A valid 'newMessage' field is required." }, { status: 400 });
  }

  // ========= TRIAL STATUS CHECK =========
  const { data: trialData, error: trialError } = await supabase
    .from('trial_data')
    .select('user_id, status')
    .eq('user_id', userId)
    .eq('status', 'Ongoing');
  if (trialError) {
    console.error("Error fetching trial_data:", trialError);
    return NextResponse.json({ response: "Error verifying trial session status" });
  }
  const trialOngoing = trialData && trialData.length > 0;

  // ========= PREPARE USER MESSAGE =========
  const normalizedMessage = stripHtml(newMessage.trim().toLowerCase()).result;
  const isGeneral = await checkIfGeneral(normalizedMessage);

  let systemPrompt: string;
  let conversation = [];

  // --- OVERRIDE: If trial is ongoing, always return a polite refusal ---
  if (trialOngoing) {
    systemPrompt = "You are a teacher-like assistant named AIlice but the user is currently taking a trial and when this is happening the ai chat bot is disabled if they bypassed that tell them that it disappointing and its bad and prevent them from cheating by providing a brief, polite refusal of accepting any request from the user while warning them. Do not provide them any info.";
    conversation = [
      { role: "system", content: systemPrompt },
      { role: "user", content: newMessage },
    ];
  } else {
    // --- Process normally if no ongoing trial ---
    if (!isGeneral) {
      // Specialized inquiry branch (with vector matching)
      let useVector = false;
      let vectorContent = "";

      try {
        if (!cachedVectorContent || !cachedFileEmbedding) {
          const { data, error } = await supabase
            .from('chat_data')
            .select('title, content');
          if (error) {
            console.error("Error fetching chat_data from Supabase:", error);
            throw error;
          }
          cachedVectorContent = data
            .map((row: { title: string; content: string }) => `(${row.title})\n(${row.content})`)
            .join("\n");
          const fileEmbeddingResponse = await openai.embeddings.create({
            model: "text-embedding-ada-002",
            input: cachedVectorContent,
          });
          cachedFileEmbedding = fileEmbeddingResponse.data[0].embedding;
        }
        vectorContent = cachedVectorContent as string;
        const userEmbeddingResponse = await openai.embeddings.create({
          model: "text-embedding-ada-002",
          input: normalizedMessage,
        });
        const userEmbedding = userEmbeddingResponse.data[0].embedding;
        const similarity = cosineSimilarity(cachedFileEmbedding, userEmbedding);
        const threshold = 0.60;
        if (similarity >= threshold) {
          useVector = true;
        }
      } catch (err) {
        console.error("Error computing embeddings:", err);
      }
      if (!useVector) {
        return NextResponse.json({ response: "This request is unavailable" });
      }
      systemPrompt = `You are a teacher-like assistant named AIlice. Below is the reference text:
Reference: "${vectorContent}"
When answering the user's question, do not add, modify, or paraphrase the reference text. If their is no reference only say "Im sorry but i have no knowledge of this request". You can use emoticons.`;
      conversation = [
        { role: "system", content: systemPrompt },
        { role: "user", content: newMessage },
      ];
    } else {
      // General inquiry branch.
      systemPrompt = "You are a teacher-like assistant named AIlice. Provide helpful, friendly, and detailed responses. Can only help with Grade 7 English subject studies other subject you can't. You can use emoticons.";
      conversation = [
        { role: "system", content: systemPrompt },
        ...messages,
        { role: "user", content: newMessage },
      ];
    }
  }

  try {
    const openaiResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: conversation,
      max_tokens: 150,
    });
    const responseText =
      openaiResponse.choices[0]?.message.content?.trim() ||
      "Sorry, I could not generate a response.";
    return NextResponse.json({ response: responseText });
  } catch (error) {
    console.error("Error with OpenAI API:", error);
    return NextResponse.json({
      response: "An error occurred while generating a response.",
    });
  }
}
