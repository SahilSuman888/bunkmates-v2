import React from 'react';
import { Redirect } from 'expo-router';

export default function SignupRoute() {
  return <Redirect href={{ pathname: '/login', params: { mode: 'signup' } }} />;
}