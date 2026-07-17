import React from 'react';
import { useNotifications } from '../hooks/useNotifications';

export default function NotificationsHandler() {
  const { expoPushToken, notification } = useNotifications();

  // could send token somewhere or display local notifications
  return null;
}
