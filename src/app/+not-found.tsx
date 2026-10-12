import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, usePathname, useGlobalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { parseAuthParams, extractResetCode } from '../lib/authUrlHelper';

export default function NotFoundScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useGlobalSearchParams<Record<string, string>>();

  useEffect(() => {
    let resolved = false;

    const resolveDeepLink = async () => {
      // 1. Try parsing global search parameters
      const parsed = parseAuthParams(searchParams);
      if (parsed.isReset && parsed.oobCode) {
        resolved = true;
        router.replace({
          pathname: '/login',
          params: { mode: 'reset-password', oobCode: parsed.oobCode },
        });
        return;
      }

      // 2. Try parsing current pathname
      const codeFromPath = extractResetCode(pathname);
      if (codeFromPath) {
        resolved = true;
        router.replace({
          pathname: '/login',
          params: { mode: 'reset-password', oobCode: codeFromPath },
        });
        return;
      }

      // 3. Try reading initial/incoming deep link URL
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
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
