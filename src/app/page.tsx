'use client';

import { useChat } from '@ai-sdk/react';
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from 'ai';
import { FormEvent, useMemo, useState } from 'react';

export default function ChatPage() {
  const [input, setInput] = useState('');

  const { messages, isLoading, sendMessage } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  });

  const isSubmitDisabled = useMemo(
    () => isLoading || input.trim().length === 0,
    [isLoading, input],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = input.trim();

    if (!trimmed) {
      return;
    }

    sendMessage({ text: trimmed });
    setInput('');
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Weather Assistant</h1>
        <p className="text-sm text-gray-600">
          Ask about the weather in any city. The assistant can call a
          server-side weather tool and stream back the results in real-time.
        </p>
      </header>

      <section className="flex-1 space-y-4 overflow-y-auto rounded-lg border border-gray-200 p-4 shadow-sm">
        {messages.map(message => (
          <article key={message.id} className="space-y-2">
            <div className="font-medium capitalize text-gray-700">
              {message.role}
            </div>

            <div className="space-y-2 text-sm text-gray-800">
              {message.parts.map((part, index) => {
                switch (part.type) {
                  case 'step-start':
                    return index > 0 ? (
                      <hr
                        key={`${message.id}-step-${index}`}
                        className="border-gray-200"
                      />
                    ) : null;
                  case 'text':
                    return (
                      <p key={`${message.id}-text-${index}`}>{part.text}</p>
                    );
                  case 'tool-getWeatherInformation': {
                    const callId = part.toolCallId;

                    switch (part.state) {
                      case 'input-streaming':
                        return (
                          <div
                            key={callId}
                            className="rounded bg-blue-50 p-3 text-blue-800"
                          >
                            Collecting weather request details...
                          </div>
                        );
                      case 'input-available':
                        return (
                          <div
                            key={callId}
                            className="rounded bg-blue-50 p-3 text-blue-800"
                          >
                            Getting weather information for{' '}
                            <span className="font-semibold">
                              {part.input.city}
                            </span>
                            ...
                          </div>
                        );
                      case 'output-available':
                        return (
                          <div
                            key={callId}
                            className="rounded bg-green-50 p-3 text-green-800"
                          >
                            <div className="font-semibold">
                              Weather for {part.input.city}
                            </div>
                            <div>Conditions: {part.output.description}</div>
                            <div>
                              Temperature: {part.output.temperature}
                              {part.output.unit}
                            </div>
                          </div>
                        );
                      case 'output-error':
                        return (
                          <div
                            key={callId}
                            className="rounded bg-red-50 p-3 text-red-800"
                          >
                            Unable to get weather for {part.input.city}:{' '}
                            {part.errorText}
                          </div>
                        );
                      default:
                        return null;
                    }
                  }
                  case 'dynamic-tool':
                    return (
                      <pre
                        key={`${message.id}-dynamic-${index}`}
                        className="overflow-x-auto rounded bg-gray-100 p-3 text-xs text-gray-700"
                      >
                        {JSON.stringify(
                          {
                            tool: part.toolName,
                            state: part.state,
                            input: part.input,
                            output: part.output,
                            errorText: part.errorText,
                          },
                          null,
                          2,
                        )}
                      </pre>
                    );
                  default:
                    return null;
                }
              })}
            </div>
          </article>
        ))}

        {messages.length === 0 && (
          <p className="text-sm text-gray-500">
            Start the conversation by asking for the weather in your city.
          </p>
        )}
      </section>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          className="flex-1 rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="e.g. What is the weather like in Berlin?"
          value={input}
          onChange={event => setInput(event.target.value)}
        />
        <button
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          disabled={isSubmitDisabled}
          type="submit"
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </form>
    </main>
  );
}