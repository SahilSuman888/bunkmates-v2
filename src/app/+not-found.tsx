import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, usePathname, useGlobalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { parseAuthParams, extractResetCode } from '../lib/authUrlHelper';
import { parseQRLoginPayload } from '../lib/qrLoginService';

export default function NotFoundScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useGlobalSearchParams<Record<string, string>>();

  useEffect(() => {
    let resolved = false;

    const resolveDeepLink = async () => {
      // 1. Try checking for QR Login or device pairing deep links
      const qrSession =
        searchParams?.session ||
        searchParams?.sessionId ||
        searchParams?.pairingId ||
        searchParams?.id;

      if (
        (pathname &&
          (pathname.includes("qr-login") ||
            pathname.includes("pair") ||
            pathname.includes("app.bunkmates.xyz") ||
            pathname.includes("localhost:3000"))) ||
        qrSession
      ) {
        resolved = true;
        let resolvedSession = qrSession;
        if (qrSession) {
          try {
            resolvedSession = parseQRLoginPayload(qrSession).sessionId;
          } catch {}
        }
        router.replace({
          pathname: "/qr-login",
          params: resolvedSession ? { session: resolvedSession } : {},
        } as any);
        return;
      }

      // 2. Try parsing global search parameters
      const parsed = parseAuthParams(searchParams);
      if (parsed.isReset && parsed.oobCode) {
        resolved = true;
        router.replace({
          pathname: '/login',
          params: { mode: 'reset-password', oobCode: parsed.oobCode },
        });
        return;
      }

      // 3. Try parsing current pathname
      const codeFromPath = extractResetCode(pathname);
      if (codeFromPath) {
        resolved = true;
        router.replace({
          pathname: '/login',
          params: { mode: 'reset-password', oobCode: codeFromPath },
        });
        return;
      }

      // 4. Try reading initial/incoming deep link URL
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          if (
            initialUrl.includes("qr-login") ||
            initialUrl.includes("pair") ||
            initialUrl.includes("sessionId=") ||
            initialUrl.includes("app.bunkmates.xyz") ||
            initialUrl.includes("localhost:3000")
          ) {
            resolved = true;
            let resolvedId = initialUrl;
            try {
              resolvedId = parseQRLoginPayload(initialUrl).sessionId;
            } catch {}
            router.replace({
              pathname: "/qr-login",
              params: { session: resolvedId },
            } as any);
            return;
          }
          const parsedUrl = parseAuthParams(initialUrl);
          if (parsedUrl.isReset && parsedUrl.oobCode) {
            resolved = true;
            router.replace({
              pathname: '/login',
              params: { mode: 'reset-password', oobCode: parsedUrl.oobCode },
            });
            return;
          }
        }
      } catch (e) {
        console.warn('NotFoundScreen: Error checking initial URL:', e);
      }

      // 4. Default fallback: redirect to login
      if (!resolved) {
        router.replace('/login');
      }
    };

    resolveDeepLink();
  }, [pathname, searchParams, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#ffffff" />
      <Text style={styles.text}>Opening BunkMates...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  text: {
    marginTop: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 15,
    fontWeight: '600',
  },
});
