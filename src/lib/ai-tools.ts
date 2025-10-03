// src/lib/ai-tools.ts

// central place to define app tools and their inferred UI types
import { z } from 'zod';
import { InferUITools, ToolSet } from 'ai';

// simple weather tool used for examples and tests
const weatherTool = {
  description: 'Get the current weather',
  inputSchema: z.object({
    // the city/state input expected from the UI or model
    location: z.string().describe('The city and state'),
  }),
  execute: async ({ location }: { location: string }) => {
    // stubbed result; replace with a real data source if you wire it up
    return `The weather in ${location} is sunny.`;
  },
};



// example tool set showing how multiple tools infer into a single mapping
export const tools = {
  weather: weatherTool,
  calculator: {
    description: 'Perform basic arithmetic',
    inputSchema: z.object({
      operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
      a: z.number(),
      b: z.number(),
    }),
    execute: async ({
      operation,
      a,
      b,
    }: {
      operation: 'add' | 'subtract' | 'multiply' | 'divide';
      a: number;
      b: number;
    }) => {
      // tiny switch for the four classic ops; no bells and whistles here
      switch (operation) {
        case 'add':
          return a + b;
        case 'subtract':
          return a - b;
        case 'multiply':
          return a * b;
        case 'divide':
          return a / b;
      }
    },
  },
} satisfies ToolSet;


// export a single inferred type so the UI/server can agree on tool I/O
export type AppUITools = InferUITools<typeof tools>;
