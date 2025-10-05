// src/app/page.tsx
// 'use client' tells Next.js this file runs in the browser, not only on the server
'use client';

// we import a ready-made chat helper that handles common chat chores for us
import { useChat } from '@ai-sdk/react';
// this sets up how we talk to our server (which URL to send messages to, etc.)
import { DefaultChatTransport } from 'ai';
// a small tool from React so the page can remember your current input
import { useState } from 'react';
// import Spinner from the barrel file
import { Spinner } from '../components';

// this defines the page component; Next.js will show this on / (the home page)
export default function Page() {
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
  } = useChat({
    // tell the chat helper how to reach our server API
    transport: new DefaultChatTransport({
      api: 'http://localhost:8080/stream?agent_id=ask_ai_agent', // this is the server route we’ll hit when we send messages OR '/api/chat'
      prepareSendMessagesRequest: ({ id, messages, trigger }) => {
        const lastMessage = messages[messages.length - 1];
        const messageId = lastMessage?.id;
        const textPart = lastMessage?.parts.find(
          (p): p is { type: 'text'; text: string } => p.type === 'text'
        ) ?? null;
        const lastText = textPart?.text ?? '';

        return {
          // 👇 match the microservice expectations
          headers: {
            accept: 'text/event-stream',
            'Content-Type': 'application/json',
          },

          // hook-level defaults (can be overridden per send below)
          body: {
            model: 'gpt-4.1-nano-2025-04-14',
            thread_id: 'swagger-1',
            user_id: 'swagger',
            message: lastText,
            last_message: lastMessage,
            agent_config: {},
            form_str:
              'Name: Return Journey Planning Form \nQ1: What is your current legal status in Germany? \n1. Temporary Protection under EU Directive ...',
            user_language: 'english',
            stream_tokens: true,
          },
          credentials: 'same-origin',
        }
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

  // input is whatever you’re typing into the text box; setInput updates it
  const [input, setInput] = useState('');

  // small helper to remove a message by id
  // we use the "functional" form of setMessages so we always work with the latest state
  const handleDelete = (id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id));
  };

  // this is what shows up on the screen
  return (
    <>
      {/* show every message we have so far */}
      {messages.map(message => (
        // each item needs a stable key so React can track it
        <div key={message.id}>
          {/* show who spoke: if role is 'user', label it “User:”, else label it “AI:” */}
          {message.role === 'user' ? 'User: ' : 'AI: '}
          {/* each message can have multiple parts (usually text) */}
          {message.parts.map((part, index) =>
            // if a part is text, we display the text; if it’s not text, we ignore it here
            part.type === 'text' ? <span key={index}>{part.text}</span> : null,
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
          <button type="button" onClick={() => regenerate()}>
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
            // NEW
            // request-level options: per-send headers/body/metadata override hook defaults
            // use this to pass auth, knobs like temperature, or custom fields to your API
            sendMessage(
              { text: input },
              // {
              //   // headers are merged on top of any hook-level headers
              //   headers: {
              //     Authorization: 'Bearer token123',        // example bearer token
              //     'X-Custom-Header': 'custom-value',       // any extra header your API expects
              //   },
              //   // body fields travel alongside the messages for server-side handling
                // body: {
                //   message: 'hi',
              //     temperature: 0.7,                         // an example model control your API can read
              //     max_tokens: 100,                          // another example control
              //     user_id: '123',                           // an app-level identifier
              //     customKey: 'customValue',                 // example custom field (see route.ts)
                // },
              //   // metadata is not sent to the server by the default transport;
              //   // it’s available to your app for local bookkeeping/analytics
              //   metadata: {
              //     userId: 'user123',
              //     sessionId: 'session456',
              //   },
              // },
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
