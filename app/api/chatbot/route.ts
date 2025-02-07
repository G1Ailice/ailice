import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { stripHtml } from 'string-strip-html';
import { promises as fs } from 'fs';
import path from 'path';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

// Uses the AI assistant to determine if the message is a general interaction.
// Returns true if the message is general (e.g. greetings, small talk),
// or false if it is a specialized inquiry about English school lessons.
async function checkIfGeneral(message: string): Promise<boolean> {
  const prompt = `Please determine whether the following message is a general, casual interaction (for example, greetings, small talk, or non-specific conversation) or a specialized inquiry about English school lessons that requires detailed information. Respond only with "true" if it is a general interaction, and "false" if it is a specialized inquiry.

Message: "${message}"`;

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
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

  // Trim, normalize, and strip HTML from the incoming message.
  const normalizedMessage = stripHtml(newMessage.trim().toLowerCase()).result;

  // Determine if the incoming question is a general interaction.
  const isGeneral = await checkIfGeneral(normalizedMessage);

  // Variables to decide whether to use the reference vector content.
  let useVector = false;
  let vectorContent = "";

  // For specialized inquiries only, check for a matching reference.
  if (!isGeneral) {
    try {
      // Use the cached reference content and embedding if available.
      if (!cachedVectorContent || !cachedFileEmbedding) {
        const vectorFilePath = path.join(
          process.cwd(),
          'public',
          'vector',
          'content.txt'
        );
        cachedVectorContent = await fs.readFile(vectorFilePath, 'utf8');

        const fileEmbeddingResponse = await openai.embeddings.create({
          model: "text-embedding-ada-002",
          input: cachedVectorContent,
        });
        cachedFileEmbedding = fileEmbeddingResponse.data[0].embedding;
      }
      vectorContent = cachedVectorContent as string;

      // Compute the embedding for the user’s (normalized) question.
      const userEmbeddingResponse = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: normalizedMessage,
      });
      const userEmbedding = userEmbeddingResponse.data[0].embedding;

      // Compute cosine similarity between the file and user embeddings.
      const similarity = cosineSimilarity(cachedFileEmbedding, userEmbedding);
      const threshold = 0.75; // Adjust this threshold as needed.

      if (similarity >= threshold) {
        // If a matching reference is found, we instantly go to the vector branch.
        useVector = true;
      }
    } catch (err) {
      console.error("Error computing embeddings:", err);
      // Optionally, you can decide to default to one branch if an error occurs.
    }
  }

  // Prepare the system prompt and conversation.
  let systemPrompt: string;
  let conversation = [];

  if (!isGeneral && useVector) {
    // For a specialized inquiry that matches the reference,
    // include the reference document (unchanged) in the system prompt.
    systemPrompt = `You are a teacher-like assistant named AIlice.
Below is a reference document:

${vectorContent}

When answering the user's question, do not add, modify, paraphrase, or alter the reference text in any way.`;
    conversation = [
      { role: "system", content: systemPrompt },
      { role: "user", content: newMessage },
    ];
  } else {
    // For general interactions or specialized inquiries with no matching reference,
    // use the generic teacher-like system prompt.
    systemPrompt =
      "You are a teacher-like assistant named AIlice. Provide helpful, friendly, and detailed responses.";
    conversation = [
      { role: "system", content: systemPrompt },
      ...messages,
      { role: "user", content: newMessage },
    ];
  }

  // Immediately call the AI chat completion API.
  try {
    const openaiResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
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
