import { useCrispChat } from "@/hooks/useCrispChat";

export function CrispChatProvider({ children }: { children: React.ReactNode }) {
  useCrispChat();
  return <>{children}</>;
}
