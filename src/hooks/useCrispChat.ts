import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const CRISP_WEBSITE_ID = "c08f585f-abc2-405f-9bd6-b75db6d662be";

declare global {
  interface Window {
    $crisp: unknown[];
    CRISP_WEBSITE_ID: string;
  }
}

export function useCrispChat() {
  const location = useLocation();
  const isCommandCenter = location.pathname.startsWith("/command_center");

  useEffect(() => {
    if (!CRISP_WEBSITE_ID) return;

    // Initialize Crisp once
    if (!window.$crisp) {
      window.$crisp = [];
      window.CRISP_WEBSITE_ID = CRISP_WEBSITE_ID;

      const script = document.createElement("script");
      script.src = "https://client.crisp.chat/l.js";
      script.async = true;
      document.head.appendChild(script);
    }

    // Hide in Command Center, show elsewhere
    if (isCommandCenter) {
      window.$crisp?.push(["do", "chat:hide"]);
    } else {
      window.$crisp?.push(["do", "chat:show"]);
    }
  }, [isCommandCenter]);
}
