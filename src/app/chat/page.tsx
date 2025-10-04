// src/app/chat/page.tsx
// NEW
// when a user hits /chat without an id, we create a chat and redirect to /chat/[id]
import { redirect } from 'next/navigation';
import { createChat } from '../../util/chat-store';

export default async function Page() {
  // create a new chat and jump to its page so the UI can load/persist by id
  const id = await createChat();
  redirect(`/chat/${id}`);
}
