import { Suspense } from "react";
import { ChatPageClient } from "./ui/chat-page-client";

export default function AppPage() {
  return (
    <Suspense>
      <ChatPageClient />
    </Suspense>
  );
}
