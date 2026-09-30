import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Handles incoming Firebase Auth action links like:
 * https://bunk-mates-beccc.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=...
 * or custom scheme:
 * bunkmates://__/auth/action?mode=resetPassword&oobCode=...
 */
export default function FirebaseAuthActionRoute() {
  const params = useLocalSearchParams<{
    mode?: string;
    oobCode?: string;
    apiKey?: string;
    continueUrl?: string;
  }>();

  const oobCode = params.oobCode;
  const isReset = params.mode === 'resetPassword' || Boolean(oobCode);

  return (
    <Redirect
      href={{
        pathname: '/login',
        params: isReset
          ? { mode: 'reset-password', oobCode: oobCode || '' }
          : { mode: 'login' },
      }}
    />
  );
}
