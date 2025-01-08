import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { stripHtml } from 'string-strip-html';
import stringSimilarity from 'string-similarity';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY ?? '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  const { messages, newMessage, restrictedQuestions } = await req.json();

  // Trim, normalize, and strip HTML from the incoming message
  const normalizedMessage = stripHtml(newMessage.trim().toLowerCase()).result;

  // Query Supabase to fetch all assessment questions (qcontent)
  const { data: assessmentQuestions, error } = await supabase
    .from('questions')
    .select('qcontent');

  if (error) {
    console.error('Error fetching assessment questions from Supabase:', error);
    return NextResponse.json({ response: 'An error occurred while processing your request.' });
  }

  // Check if the question is restricted
  if (assessmentQuestions && assessmentQuestions.length > 0) {
    const threshold = 0.8; // Threshold for relaxed matching

    for (const question of assessmentQuestions) {
      // Normalize qcontent (question text)
      const normalizedQcontent = stripHtml(question.qcontent?.trim().toLowerCase() ?? '').result;

      // If it's a restricted question, add it to the list of restricted questions
      if (normalizedMessage.includes(normalizedQcontent) || stringSimilarity.compareTwoStrings(normalizedMessage, normalizedQcontent) >= threshold) {
        // Store the restricted question on the client-side (in localStorage)
        if (!restrictedQuestions.includes(normalizedQcontent)) {
          restrictedQuestions.push(normalizedQcontent);
        }
        return NextResponse.json({ response: `This question is restricted. Please try asking something else!` });
      }
    }
  }

  // Add all restricted questions to the system prompt, including previous ones
  const systemPrompt = `
    You are a teacher-like assistant named AIlice. Provide helpful, friendly, and detailed responses but is strict when it comes to restricted questions.
    The following questions are restricted and should never be answered and just only say "This is restricted dont try to cheat.":
    - ${restrictedQuestions.join('\n- ')}`;

  // If no restrictions, proceed to OpenAI
  const conversation = [
    { role: "system", content: systemPrompt },
    ...messages,
    { role: "user", content: newMessage },
  ];

  try {
    const openaiResponse = await openai.chat.completions.create({
      model: "ft:gpt-4o-mini-2024-07-18:g1-ailice:ailicev05:AjUFrFjI",
      messages: conversation,
      max_tokens: 150,
    });

    const responseText = openaiResponse.choices[0]?.message.content?.trim() ?? "Sorry, I could not generate a response.";
    return NextResponse.json({ response: responseText });
  } catch (error) {
    console.error("Error with OpenAI API:", error);
    return NextResponse.json({ response: "An error occurred while generating a response." });
  }
}
