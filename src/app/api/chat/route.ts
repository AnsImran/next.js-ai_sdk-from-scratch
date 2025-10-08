import { openai } from '@ai-sdk/openai';
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  UIMessage,
} from 'ai';
import { z } from 'zod';

export const maxDuration = 30;

function errorHandler(error: unknown) {
  if (error == null) {
    return 'Unknown error occurred.';
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return JSON.stringify(error);
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: openai('gpt-4o'),
    messages: convertToModelMessages(messages),
    tools: {
      getWeatherInformation: {
        description: 'Show the weather in a given city to the user.',
        inputSchema: z.object({
          city: z
            .string()
            .describe('The city for which to retrieve current weather.'),
        }),
        async execute({ city }: { city: string }) {
          const weatherOptions = ['sunny', 'cloudy', 'rainy', 'snowy', 'windy'];
          const temperature = Math.floor(Math.random() * 35) + 1;

          const description = weatherOptions[
            Math.floor(Math.random() * weatherOptions.length)
          ];

          return {
            city,
            description,
            temperature,
            unit: '°C',
          };
        },
      },
    },
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse({
    onError: errorHandler,
  });
}