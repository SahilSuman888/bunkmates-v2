import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { parseAuthParams } from '../../../lib/authUrlHelper';

/**
 * Handles incoming Firebase Auth action links like:
 * https://bunk-mates-beccc.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=...
 * or custom scheme:
 * bunkmates://__/auth/action?mode=resetPassword&oobCode=...
 */
export default function FirebaseAuthActionRoute() {
  const rawParams = useLocalSearchParams<Record<string, string>>();
  const parsed = parseAuthParams(rawParams);

  return (
    <Redirect
      href={{
        pathname: '/login',
        params: parsed.isReset
          ? { mode: 'reset-password', oobCode: parsed.oobCode || '' }
          : { mode: 'login' },
      }}
    />
  );
}
