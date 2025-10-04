// src/util/chat-store.ts
// NEW
// a tiny file-backed chat store; swap with a DB in real apps
import { generateId } from 'ai';
import { existsSync, mkdirSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import type { UIMessage } from 'ai';

// create a new chat id and an empty file to hold its messages
export async function createChat(): Promise<string> {
  const id = generateId(); // generate a unique chat ID
  await writeFile(getChatFile(id), '[]'); // create an empty chat file
  return id;
}

// load all messages for a given chat id (returns UIMessage[])
export async function loadChat(id: string): Promise<UIMessage[]> {
  try {
    const raw = await readFile(getChatFile(id), 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// save the whole chat message list in one shot
export async function saveChat({
  chatId,
  messages,
}: {
  chatId: string;
  messages: UIMessage[];
}): Promise<void> {
  const content = JSON.stringify(messages, null, 2);
  await writeFile(getChatFile(chatId), content);
}

// helper: resolve a stable path for the chat json file
function getChatFile(id: string): string {
  const chatDir = path.join(process.cwd(), '.chats');
  if (!existsSync(chatDir)) mkdirSync(chatDir, { recursive: true });
  return path.join(chatDir, `${id}.json`);
}
