// route.ts
// this gives us access to OpenAI models by name
import { openai } from '@ai-sdk/openai';
// these helpers convert messages into the format the model wants,
// ask the model for a streaming response, and define the shape of UI messages
import { convertToModelMessages, streamText, UIMessage } from 'ai';

// tell the platform we allow streaming responses to run up to 30 seconds long
export const maxDuration = 30;

// this function runs when the browser sends a POST request to /api/chat
export async function POST(req: Request) {
  // NEW
  // pull optional custom fields sent at request level (e.g. customKey) alongside messages
  const { messages, customKey, user_id }: { messages: UIMessage[]; customKey?: string; user_id?: string } = await req.json();

  // optional: you can use customKey (or other body fields) for routing, logging, or controls
  if (customKey) {
    // keep logs server-side; do not expose internal details to users
    console.log('received customKey:', customKey);
  }
  if (user_id) {
    // keep logs server-side; do not expose internal details to users
    console.log('received customKey:', user_id);
  }


  // ask the AI for a streaming text response
  const result = streamText({
    model: openai('gpt-4.1'),      // choose which AI model to use
    system: 'You are a helpful assistant.', // give the AI a short instruction
    messages: convertToModelMessages(messages), // convert UI messages to model format
  });

  // turn the stream into a response the browser understands for live updates
  return result.toUIMessageStreamResponse();
}
