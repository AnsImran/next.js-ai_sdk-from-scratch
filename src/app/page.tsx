// src/app/page.tsx
// NEW
// optional: keep a friendly landing that forwards users into a fresh chat
// you can also delete this file if you point your home page elsewhere

import { redirect } from 'next/navigation';
import { createChat } from '../util/chat-store';


export default async function Home() {
  const id = await createChat();
  redirect(`/chat/${id}`);
}
