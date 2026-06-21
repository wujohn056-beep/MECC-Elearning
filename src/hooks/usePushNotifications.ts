import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { FCM } from '@capacitor-community/fcm';
import { db } from '../services/firebase';
import { doc, setDoc, arrayUnion } from 'firebase/firestore';

export const usePushNotifications = () => {
  const registerPush = async (uid: string) => {
    if (!Capacitor.isNativePlatform()) {
      console.log("[Push] Skipping registration on non-native platform.");
      return;
    }

    try {
      // 1. Request permission
      let permStatus = await PushNotifications.checkPermissions();
      
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.warn("[Push] User denied notification permission.");
        return;
      }

      // 2. Register with APNs/FCM
      await PushNotifications.register();

      // 3. Listen for token registration
      PushNotifications.addListener('registration', async (token) => {
        console.log('[Push] APNs token registered:', token.value);
        
        try {
          // 4. Retrieve FCM Token via the community plugin
          const fcmTokenResult = await FCM.getToken();
          const fcmToken = fcmTokenResult.token;
          console.log('[Push] FCM token retrieved:', fcmToken);

          // 5. Save FCM Token to Firestore safely
          const userDocRef = doc(db, 'users', uid);
          await setDoc(userDocRef, {
            fcmTokens: arrayUnion(fcmToken)
          }, { merge: true });
          console.log('[Push] FCM token successfully saved to Firestore.');
        } catch (fcmErr) {
          console.error('[Push] Failed to get/save FCM token:', fcmErr);
        }
      });

      PushNotifications.addListener('registrationError', (err) => {
        console.error('[Push] Registration error:', err.error);
      });

      // 6. Handle notification received in foreground
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('[Push] Notification received in foreground:', notification);
      });

      // 7. Handle notification action clicked
      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('[Push] Notification action performed:', notification);
      });

    } catch (error) {
      console.error("[Push] Error during push notification registration:", error);
    }
  };

  return { registerPush };
};
