// src/app/chat/[id]/page.tsx
import { loadChat } from '../../../util/chat-store';
import Chat from '../../../ui/Chat';


export default async function Page(
  props: { params: Promise<{ id: string }> } // 👈 params is a Promise
) {
  const { id } = await props.params;         // 👈 await before using
  const messages = await loadChat(id);       // file-backed history
  return <Chat id={id} initialMessages={messages} />;
}