import { useEffect, useState } from 'react';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const useNotifications = () => {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    // Skip automatic push registration when running inside Expo Go (SDK 53+)
    // as remote notifications were removed from Expo Go. See docs.
    if (Constants.appOwnership === 'expo') {
      console.warn('Running in Expo Go — skipping push registration. Use a development build for push notifications.');
      return;
    }

    let subscription: any;
    let responseSubscription: any;

    const run = async () => {
      try {
        const Notifications = await import('expo-notifications');

        const registerForPushNotificationsAsync = async () => {
          let token: string | null = null;
          if (Constants.isDevice) {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;
            if (existingStatus !== 'granted') {
              const { status } = await Notifications.requestPermissionsAsync();
              finalStatus = status;
            }
            if (finalStatus !== 'granted') {
              console.log('Failed to get push token for push notification!');
              return null;
            }
            token = (await Notifications.getExpoPushTokenAsync()).data;
            setPermissionGranted(true);
          } else {
            console.log('Must use physical device for Push Notifications');
          }

          if (Platform.OS === 'android') {
            Notifications.setNotificationChannelAsync('default', {
              name: 'default',
              importance: Notifications.AndroidImportance.MAX,
              vibrationPattern: [0, 250, 250, 250],
              lightColor: '#FF231F7C',
            });
          }

          return token;
        };

        try {
          const token = await registerForPushNotificationsAsync();
          if (token) setExpoPushToken(token);
        } catch (e) {
          console.warn('Push registration failed or is not supported in this environment:', e?.message || e);
        }

        subscription = Notifications.addNotificationReceivedListener((notif: any) => {
          setNotification(notif);
        });
        responseSubscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
          console.log('Notification response', response);
        });
      } catch (err) {
        console.warn('Failed to load expo-notifications dynamically:', err);
      }
    };

    run();

    return () => {
      try {
        subscription?.remove?.();
        responseSubscription?.remove?.();
      } catch (e) {
        // ignore cleanup errors
      }
    };
  }, []);

  // when token available, optionally persist to user document
  useEffect(() => {
    if (!expoPushToken) return;
    // attempt to save to firestore if user logged in
    import('../lib/firebase').then(({ db, auth }) => {
      const user = auth.currentUser;
      if (user) {
        const { doc, setDoc, serverTimestamp } = require('firebase/firestore');
        const userRef = doc(db, 'users', user.uid);
        setDoc(userRef, { expoPushToken, updatedAt: serverTimestamp() }, { merge: true });
      }
    });
  }, [expoPushToken]);
  // registerForPushNotificationsAsync moved inside the effect to avoid
  // importing expo-notifications at module load time (prevents Expo Go warnings)

  return { expoPushToken, notification, permissionGranted };
};
