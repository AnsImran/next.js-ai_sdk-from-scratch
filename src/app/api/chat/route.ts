// this gives us access to OpenAI models by name
import { openai } from '@ai-sdk/openai';
// these helpers convert messages into the format the model wants,
// ask the model for a streaming response, and define the shape of UI messages
import { convertToModelMessages, streamText, UIMessage } from 'ai';

// tell the platform we allow streaming responses to run up to 30 seconds long
export const maxDuration = 30;

// this function runs when the browser sends a POST request to /api/chat
export async function POST(req: Request) {

  // turn the incoming request body into a js object
  const body = await req.json();


  // print the whole body, nice and expanded
  console.log("Full request body: ", JSON.stringify(body, null, 2));

  // if you just want the messages specifically
  const { messages }: { messages: UIMessage[] } = body;
  // console.log("Messages only:", messages);

  // // read the JSON body from the request and pull out the messages array
  // const { messages }: { messages: UIMessage[] } = await req.json();

  // ask the AI for a streaming text response
  const result = streamText({
    model: openai('gpt-4o-mini'),      // choose which AI model to use
    system: 'You are a helpful assistant.', // give the AI a short instruction
    messages: convertToModelMessages(messages), // convert UI messages to model format
  });



  // 🔊 print **all** stream events as they arrive (not just text)
  let i = 0;
  for await (const event of result.fullStream) {
    i += 1;
    console.log(`AI event #${i}:\n`, JSON.stringify(event, null, 2));
  }


  // turn the stream into a response the browser understands for live updates
  return result.toUIMessageStreamResponse();
}
