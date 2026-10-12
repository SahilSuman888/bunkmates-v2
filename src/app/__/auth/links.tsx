import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { parseAuthParams } from '../../../lib/authUrlHelper';

/**
 * Handles incoming Firebase Dynamic / Email Action links like:
 * bunkmates://__/auth/links?link=https://bunk-mates.vercel.app/reset-password?apiKey%253D...%2526mode%253DresetPassword%2526oobCode%253D...
 * or
 * https://bunk-mates-beccc.firebaseapp.com/__/auth/links?link=...
 */
export default function FirebaseAuthLinksRoute() {
  const rawParams = useLocalSearchParams<Record<string, string>>();
  const parsed = parseAuthParams(rawParams);

  if (parsed.isReset && parsed.oobCode) {
    return (
      <Redirect
        href={{
          pathname: '/login',
          params: {
            mode: 'reset-password',
            oobCode: parsed.oobCode,
          },
        }}
      />
    );
  }

  // Fallback to login with reset-password or login mode
  return (
    <Redirect
      href={{
        pathname: '/login',
        params: {
          mode: parsed.isReset ? 'reset-password' : 'login',
          ...(parsed.oobCode ? { oobCode: parsed.oobCode } : {}),
        },
      }}
    />
  );
}
