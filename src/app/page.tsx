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
  const { messages, sendMessage, status, stop, error, reload } = useChat({
    // tell the chat helper how to reach our server API
    transport: new DefaultChatTransport({
      api: '/api/chat', // this is the server route we’ll hit when we send messages
    }),
  });

  // input is whatever you’re typing into the text box; setInput updates it
  const [input, setInput] = useState('');

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
            // send the text to the server; the helper does the heavy lifting
            sendMessage({ text: input });
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

