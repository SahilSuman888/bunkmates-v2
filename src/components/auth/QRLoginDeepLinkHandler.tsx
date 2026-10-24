import { useEffect, useRef } from "react";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { parseQRLoginPayload } from "../../lib/qrLoginService";

export function QRLoginDeepLinkHandler() {
  const handledInitialRef = useRef(false);

  useEffect(() => {
    const handleUrlEvent = (event: { url: string }) => {
      const url = event.url;
      if (
        url &&
        (url.includes("qr-login") ||
          url.includes("pair") ||
          url.includes("sessionId=") ||
          url.includes("app.bunkmates.xyz") ||
          url.includes("localhost:3000"))
      ) {
        try {
          const parsed = parseQRLoginPayload(url);
          router.push({
            pathname: "/qr-login",
            params: { session: parsed.sessionId },
          } as any);
        } catch {
          router.push({
            pathname: "/qr-login",
            params: { session: url },
          } as any);
        }
      }
    };

    const sub = Linking.addEventListener("url", handleUrlEvent);

    // Check cold-start initial URL once
    if (!handledInitialRef.current) {
      handledInitialRef.current = true;
      Linking.getInitialURL()
        .then((initialUrl) => {
          if (
            initialUrl &&
            (initialUrl.includes("qr-login") ||
              initialUrl.includes("pair") ||
              initialUrl.includes("sessionId=") ||
              initialUrl.includes("app.bunkmates.xyz") ||
              initialUrl.includes("localhost:3000"))
          ) {
            try {
              const parsed = parseQRLoginPayload(initialUrl);
              router.push({
                pathname: "/qr-login",
                params: { session: parsed.sessionId },
              } as any);
            } catch {
              router.push({
                pathname: "/qr-login",
                params: { session: initialUrl },
              } as any);
            }
          }
        })
        .catch((e) => {
          console.warn("[QRLoginDeepLinkHandler] Error getting initial URL:", e);
        });
    }

    return () => {
      sub.remove();
    };
  }, []);

  return null;
}
