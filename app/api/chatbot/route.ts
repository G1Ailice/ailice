import { NextResponse } from 'next/server';
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
  // Destructure messages and newMessage from the request body.
  const { messages, newMessage } = await req.json();

  const normalizedMessage = stripHtml(newMessage.trim().toLowerCase()).result;

  // Determine if the incoming message is general.
  const isGeneral = await checkIfGeneral(normalizedMessage);

  // Prepare variables for system prompt and conversation.
  let systemPrompt: string;
  let conversation = [];

  if (!isGeneral) {
    // Specialized inquiry branch.
    let useVector = false;
    let vectorContent = "";

    try {
      // Load and cache the reference content and its embedding if not already cached.
      if (!cachedVectorContent || !cachedFileEmbedding) {
        // Fetch data from the Supabase collection (table) "chat_data" and select title and content.
        const { data, error } = await supabase
          .from('chat_data')
          .select('title, content');

        if (error) {
          console.error("Error fetching chat_data from Supabase:", error);
          throw error;
        }

        // Format the data so that each entry appears as:
        // (title)
        // (content)
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

      // Compute the embedding for the user's (normalized) question.
      const userEmbeddingResponse = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: normalizedMessage,
      });
      const userEmbedding = userEmbeddingResponse.data[0].embedding;

      // Compute cosine similarity between the reference and user embeddings.
      const similarity = cosineSimilarity(cachedFileEmbedding, userEmbedding);
      const threshold = 0.60; // Adjust this threshold as needed.

      if (similarity >= threshold) {
        // A matching reference is found.
        useVector = true;
      }
    } catch (err) {
      console.error("Error computing embeddings:", err);
      // Optionally, you might want to return an error here.
    }

    // If no matching reference is found, return early.
    if (!useVector) {
      return NextResponse.json({ response: "This request does not exist" });
    }

    // Use the specialized branch with the reference text.
    systemPrompt = `You are a teacher-like assistant named AIlice. Below is the reference text: 
Reference: ${vectorContent} 
When answering the user's question, do not add, modify, paraphrase, or alter the reference text in any way.Can only help with English subject studies.`;
    conversation = [
      { role: "system", content: systemPrompt },
      { role: "user", content: newMessage },
    ];
  } else {
    // General inquiry branch.
    systemPrompt =
      "You are a teacher-like assistant named AIlice. Provide helpful, friendly, and detailed responses. Can only help with English subject studies.";
    conversation = [
      { role: "system", content: systemPrompt },
      ...messages,
      { role: "user", content: newMessage },
    ];
  }

  // Call the OpenAI chat completion API.
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
