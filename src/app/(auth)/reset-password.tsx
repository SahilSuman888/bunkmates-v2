import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { parseAuthParams } from '../../lib/authUrlHelper';

/**
 * Handles navigation to /reset-password (e.g. from https://bunk-mates.vercel.app/reset-password?apiKey=...&oobCode=...)
 */
export default function ResetPasswordRoute() {
  const rawParams = useLocalSearchParams<Record<string, string>>();
  const parsed = parseAuthParams(rawParams);

  return (
    <Redirect
      href={{
        pathname: '/login',
        params: {
          mode: 'reset-password',
          ...(parsed.oobCode ? { oobCode: parsed.oobCode } : {}),
        },
      }}
    />
  );
}
