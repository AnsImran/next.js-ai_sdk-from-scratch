// src/app/api/chat/route.ts
// this gives us access to OpenAI models by name
import { openai } from '@ai-sdk/openai';
// these helpers convert messages into the format the model wants,
// ask the model for a streaming response, and define the shape of UI messages
import {
  convertToModelMessages,
  streamText,
  UIMessage,
  validateUIMessages,
  TypeValidationError,
  createIdGenerator,
  UIDataTypes,
} from 'ai';
import type { LanguageModelUsage } from 'ai';
import { loadChat, saveChat } from '../../../util/chat-store';
import { dataPartsSchema, metadataSchema } from '../../../util/schemas';
import { tools } from '../../../lib/ai-tools';

// tell the platform we allow streaming responses to run up to 30 seconds long
export const maxDuration = 30;

// optional metadata type to expose usage and some handy fields
type MyMetadata = {
  totalUsage?: LanguageModelUsage; // full usage object (tokens, input/output breakdown)
  totalTokens?: number;            // simple token count for quick display
  createdAt?: number;              // server timestamp when stream started
  model?: string;                  // model id for debugging/analytics
};

// make server-side UI messages tools-aware so inputs/outputs are typed end-to-end
export type MyUIMessage = UIMessage<MyMetadata, UIDataTypes, typeof tools>;

// this function runs when the browser sends a POST request to /api/chat
export async function POST(req: Request) {
  // grab the raw body once so we can support multiple payload shapes
  const body = await req.json();

  // support BOTH shapes:
  // 1) default: { messages, customKey?, user_id? }  (not used by our client)
  // 2) transport-custom: { id, message? (latest), trigger?, messageId? }
  const {
    messages: fullMessages,
    customKey,
    user_id,
    id,
    message,
    trigger,
    messageId,
    route
  }: {
    messages?: MyUIMessage[];
    customKey?: string;
    user_id?: string;
    id?: string;
    message?: MyUIMessage;
    trigger?: 'submit-message' | 'regenerate-message' | 'delete-message';
    messageId?: string;
    route?: string;
  } = body;

  // keep logs server-side; do not expose internal details to users
  if (customKey) console.log('received customKey:', customKey);
  if (user_id) console.log('received user_id:', user_id);
  if (route) console.log('route: ', route);
  if (trigger) console.log('trigger: ', trigger);

  // handle deletions early and persist the change
  if (trigger === 'delete-message') {
    if (!id || !messageId) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Missing id or messageId for delete-message.' }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      );
    }

    const existing = await loadChat(id);
    const next = existing.filter(m => m.id !== messageId);
    await saveChat({ chatId: id, messages: next });

    // return a small JSON response; the client already updated the UI optimistically
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  // decide which message list to send to the model
  let combined: MyUIMessage[] = [];

  if (trigger || (id && !fullMessages)) {
    // transport-based routing path (trigger-aware or { id, message } shape)
    if (!id) {
      throw new Error('Missing "id" for trigger-based routing.');
    }

    // load persisted history
    let history: MyUIMessage[] = (await loadChat(id)) as MyUIMessage[];

    if (trigger === 'submit-message') {
      // append the newest user message coming from the client
      if (!message) {
        throw new Error('Missing "message" for submit-message trigger.');
      }
      history = [...history, message];
    } else if (trigger === 'regenerate-message') {
      // roll back to just before the target messageId (usually the assistant message)
      if (!messageId) {
        throw new Error('Missing "messageId" for regenerate-message trigger.');
      }
      const idx = history.findIndex(m => m.id === messageId);
      if (idx !== -1) {
        // If the provided id is a USER message, find the preceding ASSISTANT and trim there.
        history = history.slice(0, idx); // chop off everything from cutIndex onward
      }
    } else {
      // if no recognized trigger but we do have { id, message }, treat it like submit
      if (message) {
        history = [...history, message];
      }
    }

    combined = history;
  } else {
    // default path: client sent the full message array
    if (!fullMessages) {
      throw new Error('Missing "messages" array in request body.');
    }
    combined = fullMessages;
  }

  // validate messages from storage + the new message before calling the model
  let validated: MyUIMessage[] = [];
  try {
    validated = (await validateUIMessages({
      messages: combined,
      tools,
    })) as MyUIMessage[];
  } catch (error) {
    if (error instanceof TypeValidationError) {
      // if stored messages don't match current schemas, start fresh
      console.error('Database messages validation failed:', error);
      validated = [];
    } else {
      throw error;
    }
  }

  // ask the AI for a streaming text response
  const result = streamText({
    model: openai('gpt-4.1'),                // choose which AI model to use
    system: 'You are a helpful assistant.',  // give the AI a short instruction
    messages: convertToModelMessages(validated), // convert UI messages to model format
    tools,
  });

  // ensure the stream runs to completion even if the client disconnects,
  // so onFinish will still fire and persist the updated messages
  result.consumeStream(); // fire-and-forget

  // attach lightweight metadata at the start and finish so the client can render
  // things like timestamps and token usage without extra round-trips
  return result.toUIMessageStreamResponse({
    // forward a safe error message to the client; fall back to a generic string
    onError: (error) => {
      if (error == null) return 'unknown error';
      if (typeof error === 'string') return error;
      if (error instanceof Error) return error.message;
      return JSON.stringify(error);
    },

    // pass original messages back for UI libs that use them for reconciliation
    originalMessages: validated,

    // generate consistent server-side message ids for persistence
    // NEW
    generateMessageId: createIdGenerator({
      prefix: 'msg',
      size: 16,
    }),

    messageMetadata: ({ part }) => {
      if (part.type === 'start') {
        return {
          createdAt: Date.now(), // client can show a local time label
          model: 'gpt-4.1',      // handy for debugging or analytics
        };
      }
      if (part.type === 'finish') {
        // provide both a simple token count and the full usage object
        return {
          totalTokens: part.totalUsage.totalTokens, // let the UI display token count
          totalUsage: part.totalUsage,              // richer usage details for advanced UIs
        };
      }
    },

    // when the stream finishes, persist the full message list (including AI reply)
    // NEW
    onFinish: async ({ messages }) => {
      if (!id) return;
      await saveChat({ chatId: id, messages: messages as MyUIMessage[] });
    },
  });
}
