// src/ui/Chat.tsx
// 'use client' tells Next.js this file runs in the browser, not only on the server
'use client';

// we import a ready-made chat helper that handles common chat chores for us
import { useChat } from '@ai-sdk/react';
// this sets up how we talk to our server (which URL to send messages to, etc.)
import { DefaultChatTransport, UIMessage, UIDataTypes } from 'ai';
// a small tool from React so the page can remember your current input
// NEW: include useEffect for version-agnostic initial hydration
import { useEffect, useMemo, useState } from 'react';
// import Spinner from the barrel file
import { Spinner } from '../components'
// import the shared tools type so UI messages know the tools’ input/output shapes
import type { AppUITools } from '../lib/ai-tools';
// ✅ get dynamic route params in a client component
import { useParams } from 'next/navigation'; 

// NEW: give the client-side message type a metadata shape that matches what the server attaches
// so that reading message.metadata.* fields is type-safe
type ClientMetadata = {
  createdAt?: number;                         // server timestamp when stream started
  model?: string;                             // model id for debugging/analytics
  totalTokens?: number;                       // simple token count for quick display
  totalUsage?: { totalTokens?: number };      // minimal surface from LanguageModelUsage
};

// build a UIMessage type that carries our tool typings end-to-end on the client
// NEW: use ClientMetadata instead of `never` so we can safely read message.metadata.* below
type MyUIMessage = UIMessage<ClientMetadata, UIDataTypes, AppUITools>;

// this defines the chat component used on /chat/[id]
// NEW: accept `id` from props (so it can be used outside route params) and `initialMessages` for hydration
export default function Chat({
  id,
  initialMessages = [],
}: { id?: string; initialMessages?: MyUIMessage[] }) {
  // input is whatever you’re typing into the text box; setInput updates it
  const [input, setInput] = useState('');

  // ✅ read `[id]` from the URL without making the component async
  // NEW: prefer the prop `id` when provided; fall back to params to be flexible
  const params = useParams<{ id: string }>();
  const chatId = id ?? params.id; // stable chat id for this chat

  // NEW: this is constant in this app; no need for union type
  const server_address = '/api/chat';

  // we ask the chat helper for:
  // - messages: the list of chat bubbles (both you and the AI)
  // - sendMessage: a function to send a new message
  // - status: whether we’re ready to send or still busy
  // - stop: a function to abort the current streaming response
  // - error: any error that happened during the last request
  // - reload: try the last request again
  // - setMessages: lets us directly edit the message list (e.g. delete a message)
  // - regenerate: asks the AI to redo the last assistant message
  const {
    messages,
    sendMessage,
    status,
    stop,
    error,
    reload,
    setMessages,
    regenerate,
  } = useChat<MyUIMessage>({
    id: chatId, // stable id so the server can load and persist history for this chat

    // NEW (Option A): do NOT pass `initialMessages` here (not all versions support it).
    // We will hydrate once below with useEffect.

    // tell the chat helper how to reach our server API using a trigger-aware payload
    transport: new DefaultChatTransport({
      api: server_address,
      prepareSendMessagesRequest: ({ id, messages, trigger }) => {
        // Find the LAST assistant message – this is the one we want to regenerate.
        const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
        const assistantId = lastAssistant?.id;
        // Keep lastMessage for submit/fallback use
        const lastMessage = messages[messages.length - 1];
        const messageId = lastMessage?.id;

        if (trigger === 'submit-message') {
          return {
            // FIX: remove hardcoded Authorization header; keep request body minimal
            body: {
              trigger: 'submit-message',
              id,
              message: lastMessage,                 // send only the newest message
              messageId,
              user_id: '123',                       // example app-level identifier (non-sensitive)
              customKey: 'customValue',             // example custom field (server logs it)
              route: 'submit-message'
            },
          };
        } else if (trigger === 'regenerate-message') {
          return {
            body: {
              trigger: 'regenerate-message',
              id,
              // IMPORTANT: point regenerate at the LAST ASSISTANT message
              messageId: assistantId,
              route: 'regenerate-message'
            },
          };
        }

        // fall back to a compact shape if no special trigger is set
        return {
          body: {
            id,
            message: lastMessage,
            user_id: '123',                         // example app-level identifier (non-sensitive)
            customKey: 'customValue',
            route: 'fallback',
          },
        };
      },
    }),

    // smooth out UI updates so we re-render at most ~every 50ms while streaming
    // this keeps the UI snappy without re-rendering on every tiny chunk
    experimental_throttle: 50,

    // (Event Callbacks): run code at key points in the chat lifecycle
    onFinish: ({ message, messages, isAbort, isDisconnect, isError }) => {
      // fires when the assistant has fully finished responding
      // good place to sync analytics, update other UI bits, etc.
      // we keep it minimal here and just log some useful details
      console.log('assistant finished', {
        messageId: message.id,
        totalMessages: messages.length,
        isAbort,
        isDisconnect,
        isError,
      });

      // also log usage metadata if the server attached it
      // helps track token consumption without extra round-trips
      console.log('total usage (if provided):', message.metadata?.totalUsage);
    },
    onError: (err) => {
      // called whenever the fetch/streaming fails
      // keep logs developer-facing; user-facing copy stays generic below
      console.error('useChat onError:', err);
    },
    onData: (data) => {
      // called for every data part as it streams in
      // can be used for custom parsing or side-effects per chunk
      console.log('useChat onData part:', JSON.stringify(data, null, 2));  // pretty-print with 2 spaces
      // note: you can cancel processing by throwing here
      // e.g. if a chunk fails validation: throw new Error('abort stream');
    },
  });

  // NEW (Option A): seed the chat history once after mount, version-agnostic.
  // We only hydrate if the server provided messages and local state is empty,
  // so we don't clobber any live session state (e.g., after back/forward).
  useEffect(() => {
    if (initialMessages.length && messages.length === 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages, messages.length, setMessages]);

  // NEW: helper flag to disable "Regenerate" when there’s no assistant yet
  const hasAssistant = messages.some(m => m.role === 'assistant');

  // small helper to remove a message by id
  // we use the "functional" form of setMessages so we always work with the latest state
  const handleDelete = async (idToDelete: string) => {
    // optimistically update the UI first so deletion feels instant
    setMessages(prev => prev.filter(m => m.id !== idToDelete));

    // also tell the server to remove this message from persisted history
    try {
      await fetch(server_address, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trigger: 'delete-message', // server understands this trigger
          id: chatId,                // must match the chat id used by the hook
          messageId: idToDelete,     // which message to delete
        }),
      });
    } catch (e) {
      console.error('failed to delete message on server:', e);
      // optional: rollback UI or show a toast if needed
    }
  };

  // NEW: Deduplicate by id to avoid React's "Encountered two children with the same key" warning
  // which can happen during regenerate/reconciliation.
  const dedupedMessages = useMemo(
    () => Array.from(new Map(messages.map(m => [m.id, m])).values()),
    [messages]
  );

  // this is what shows up on the screen
  return (
    <>
      {/* show every message we have so far */}
      {dedupedMessages.map(message => (
        // each item needs a stable key so React can track it
        <div key={message.id}>
          {/* show who spoke: if role is 'user', label it “User:”, else label it “AI:” */}
          {message.role === 'user' ? 'User: ' : 'AI: '}

          {/* optionally show when the message started, if the server attached metadata */}
          {message.metadata?.createdAt && (
            <span>
              {new Date(message.metadata.createdAt).toLocaleTimeString()} —{' '}
            </span>
          )}

          {/* each message can have multiple parts (usually text) */}
          {/* FIX: also show non-text parts (e.g., tool calls/results) in a minimal, debuggable way */}
          {message.parts.map((part, index) => {
            if (part.type === 'text') return <span key={index}>{part.text}</span>;
            // return (
            //   <pre key={index} style={{ whiteSpace: 'pre-wrap', margin: '0.25rem 0' }}>
            //     {JSON.stringify(part, null, 2)}
            //   </pre>
            // );
          })}

          {/* show token usage if the server sent it in metadata */}
          {message.metadata?.totalTokens && (
            <span> ({message.metadata.totalTokens} tokens)</span>
          )}

          {/* show full usage details if provided by the server
              useful when the server returns a LanguageModelUsage object */}
          {message.metadata?.totalUsage?.totalTokens && (
            <div> Total usage: {message.metadata.totalUsage.totalTokens} tokens</div>
          )}

          {/* a tiny delete button per message so users can prune history */}
          <button type="button" onClick={() => handleDelete(message.id)}>
            Delete
          </button>
        </div>
      ))}

      {/* while we’re sending or receiving, show a tiny status area */}
      {(status === 'submitted' || status === 'streaming') && (
        <div>
          {/* if we’re waiting for the stream to start, you could show a spinner */}
          {/* Spinner is now a real component defined above */}
          {status === 'submitted' && <Spinner />}
          {/* let the user cancel a long answer mid-stream */}
          <button type="button" onClick={() => stop()}>
            Stop
          </button>
        </div>
      )}

      {/* offer a “Regenerate” action once we’re idle, or after an error */}
      {(status === 'ready' || status === 'error') && (
        <div>
          {/* re-ask the model to produce the last assistant message again */}
          {/* NEW: disable when there's no assistant message to target */}
          <button type="button" onClick={() => regenerate()} disabled={!hasAssistant}>
            Regenerate
          </button>
        </div>
      )}

      {/* if something went wrong, keep the message generic and offer a retry */}
      {error && (
        <div role="alert">
          {/* keep error messages vague to avoid leaking server details */}
          An error occurred.
          {/* try the last request again */}
          <button type="button" onClick={() => reload()}>
            Retry
          </button>
        </div>
      )}

      {/* the form that handles typing and submitting your message */}
      <form
        // when you submit the form (press enter or click submit), run this code
        onSubmit={e => {
          e.preventDefault(); // stop the page from reloading
          if (input.trim()) {
            // request-level options: per-send headers/body/metadata override hook defaults
            // use this to pass auth, knobs like temperature, or custom fields to your API
            sendMessage(
              { text: input },
            );
            // clear the input box after sending
            setInput('');
          }
        }}
      >
        {/* the text box where you type */}
        <input
          value={input} // tie the input box to our state variable “input”
          onChange={e => setInput(e.target.value)} // update “input” as you type
          // disable typing while we’re busy or after an error until the user retries
          disabled={status !== 'ready' || error != null}
          placeholder="Say something..." // gray hint text
        />
        {/* the button to submit your message */}
        <button
          type="submit"
          // prevent new submits while we’re busy or if there’s an error shown
          disabled={status !== 'ready' || error != null}
        >
          Submit
        </button>
      </form>
    </>
  );
}
