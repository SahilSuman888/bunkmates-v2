import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function ResetPasswordRoute() {
  const params = useLocalSearchParams();
  return (
    <Redirect
      href={{
        pathname: '/login',
        params: { mode: 'reset-password', ...params },
      }}
    />
  );
}
