// route.ts
// this gives us access to OpenAI models by name
import { openai } from '@ai-sdk/openai';
// these helpers convert messages into the format the model wants,
// ask the model for a streaming response, and define the shape of UI messages
import { convertToModelMessages, streamText, UIMessage } from 'ai';

// tell the platform we allow streaming responses to run up to 30 seconds long
export const maxDuration = 30;

/**
 * simple in-memory chat store so the trigger-based example can work end-to-end
 * in real apps, swap this with your DB/cache (redis, postgres, etc.)
 */
const chatStore = new Map<string, UIMessage[]>();

async function readChat(id: string): Promise<{ messages: UIMessage[] }> {
  return { messages: chatStore.get(id) ?? [] };
}

async function writeChat(id: string, messages: UIMessage[]): Promise<void> {
  chatStore.set(id, messages);
}

// this function runs when the browser sends a POST request to /api/chat
export async function POST(req: Request) {
  // grab the raw body once so we can support multiple payload shapes
  const body = await req.json();

  // support BOTH shapes:
  // 1) default: { messages, customKey?, user_id? }
  // 2) transport-custom: { id, message? (latest), trigger?, messageId? }
  const {
    messages,
    customKey,
    user_id,
    id,
    message,
    trigger,
    messageId,
  }: {
    messages?: UIMessage[];
    customKey?: string;
    user_id?: string;
    id?: string;
    message?: UIMessage;
    trigger?: 'submit-user-message' | 'regenerate-assistant-message' | 'delete-message'; // NEW
    messageId?: string;
  } = body;

  // optional: you can use customKey (or other body fields) for routing, logging, or controls
  if (customKey) {
    // keep logs server-side; do not expose internal details to users
    console.log('received customKey:', customKey);
  }
  if (user_id) {
    // keep logs server-side; do not expose internal details to users
    console.log('received user_id:', user_id);
  }

  // if this is a deletion request, handle it early and return a simple ok
  if (trigger === 'delete-message') {
    if (!id || !messageId) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Missing id or messageId for delete-message.' }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      );
    }

    const chat = await readChat(id);
    const next = chat.messages.filter(m => m.id !== messageId);

    await writeChat(id, next);

    // return a small JSON response; the client already updated the UI optimistically
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  // decide which message list to send to the model
  let effectiveMessages: UIMessage[] = [];

  if (trigger || (id && !messages)) {
    // transport-based routing path (trigger-aware or { id, message } shape)
    if (!id) {
      throw new Error('Missing "id" for trigger-based routing.');
    }

    const chat = await readChat(id);
    let serverMessages = chat.messages;

    if (trigger === 'submit-user-message') {
      // append the newest user message coming from the client
      if (!message) {
        throw new Error('Missing "message" for submit-user-message trigger.');
      }
      serverMessages = [...serverMessages, message];
    } else if (trigger === 'regenerate-assistant-message') {
      // roll back to just before the target messageId (usually the assistant message)
      if (!messageId) {
        throw new Error('Missing "messageId" for regenerate-assistant-message trigger.');
      }
      const idx = serverMessages.findIndex(m => m.id === messageId);
      if (idx !== -1) {
        serverMessages = serverMessages.slice(0, idx); // Chop off everything from idx onward.
      }
    } else {
      // if no recognized trigger but we do have { id, message }, treat it like submit
      if (message) {
        serverMessages = [...serverMessages, message];
      }
    }

    // persist updated history for the next turn
    await writeChat(id, serverMessages);

    effectiveMessages = serverMessages;
  } else {
    // default path: client sent the full message array
    if (!messages) {
      throw new Error('Missing "messages" array in request body.');
    }
    effectiveMessages = messages;
  }

  // ask the AI for a streaming text response
  const result = streamText({
    model: openai('gpt-4.1'),                // choose which AI model to use
    system: 'You are a helpful assistant.',  // give the AI a short instruction
    messages: convertToModelMessages(effectiveMessages), // convert UI messages to model format
  });

  // attach lightweight metadata at the start and finish so the client can render
  // things like timestamps and token usage without extra round-trips
  return result.toUIMessageStreamResponse({
    messageMetadata: ({ part }) => {
      if (part.type === 'start') {
        return {
          createdAt: Date.now(), // client can show a local time label
          model: 'gpt-4.1',      // handy for debugging or analytics
        };
      }
      if (part.type === 'finish') {
        return {
          totalTokens: part.totalUsage.totalTokens, // let the UI display token count
        };
      }
    },
  });
}
