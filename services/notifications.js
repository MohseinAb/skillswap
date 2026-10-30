import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { createNavigationContainerRef, StackActions } from '@react-navigation/native';
import {
  collection, doc, getDoc, getDocs, updateDoc, query, where, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { sendPushToUser, resolveNotificationTarget } from './pushCore';

/* ───────────── how notifications look while the app is open ───────────── */

let activeChatId = null;
// ChatScreen tells us which chat is on screen, so we do not buzz about messages you are reading.
export const setActiveChat = (chatId) => {
  activeChatId = chatId || null;
};

let configured = false;
// Call once, when the app starts (top of App.js).
export function configureNotifications() {
  if (configured || Platform.OS === 'web') return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = (notification.request.content && notification.request.content.data) || {};
      const params = data.params || {};
      const viewing = !!activeChatId && params.chatId === activeChatId;
      return {
        shouldShowBanner: !viewing,
        shouldShowList: !viewing,
        shouldPlaySound: !viewing,
        shouldSetBadge: false,
      };
    },
  });
}

/* ───────────── permission + token ───────────── */

async function setupChannels() {
  if (Platform.OS !== 'android') return;
  const high = Notifications.AndroidImportance.HIGH;
  await Notifications.setNotificationChannelAsync('messages', {
    name: 'Messages',
    importance: high,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#52E5A8',
  });
  await Notifications.setNotificationChannelAsync('updates', {
    name: 'Bookings and payments',
    importance: high,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#52E5A8',
  });
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Other',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

let currentToken = null;

// Asks for permission (Android 13+ shows a prompt), gets this phone's Expo push token and saves it on
// the signed-in user. Returns { status } where status is 'granted' or the reason it did not work.
export async function registerForPush() {
  const user = auth.currentUser;
  if (!user) return { status: 'no-user' };
  if (Platform.OS === 'web') return { status: 'unsupported' };

  try {
    // The channel must exist before Android 13 will show the permission prompt.
    await setupChannels();

    let permission = await Notifications.getPermissionsAsync();
    if (permission.status !== 'granted') permission = await Notifications.requestPermissionsAsync();
    if (permission.status !== 'granted') return { status: 'denied' };

    const projectId =
      (Constants.expoConfig && Constants.expoConfig.extra && Constants.expoConfig.extra.eas && Constants.expoConfig.extra.eas.projectId) ||
      (Constants.easConfig && Constants.easConfig.projectId);
    if (!projectId) return { status: 'no-project-id' };

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    currentToken = token;
    await updateDoc(doc(db, 'users', user.uid), { pushTokens: arrayUnion(token) });

    // A phone can only belong to one account at a time: if someone else signed in here before
    // and never signed out, stop their notifications from landing on this phone.
    const sameToken = await getDocs(query(collection(db, 'users'), where('pushTokens', 'array-contains', token)));
    await Promise.all(
      sameToken.docs.filter((d) => d.id !== user.uid).map((d) => updateDoc(d.ref, { pushTokens: arrayRemove(token) }))
    );
    return { status: 'granted', token };
  } catch (error) {
    return { status: 'error', error: error.message };
  }
}

// Call before signing out, so this phone stops receiving that account's notifications.
export async function unregisterPush() {
  const user = auth.currentUser;
  if (!user || !currentToken) return;
  try {
    await updateDoc(doc(db, 'users', user.uid), { pushTokens: arrayRemove(currentToken) });
  } catch (error) {
    console.warn('[push] could not unregister:', error.message);
  }
  currentToken = null;
}

export async function getPushStatus() {
  if (Platform.OS === 'web') return { supported: false, granted: false, canAskAgain: false, registered: false };
  const permission = await Notifications.getPermissionsAsync();
  return {
    supported: true,
    granted: permission.status === 'granted',
    canAskAgain: permission.canAskAgain !== false,
    registered: !!currentToken,
  };
}

/* ───────────── sending ───────────── */

const savedTokens = async (uid) => {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data().pushTokens || [] : [];
};
const dropToken = (uid, token) => updateDoc(doc(db, 'users', uid), { pushTokens: arrayRemove(token) });

// Best effort: a notification must never break the action that caused it, so this never throws.
// Do not await it in a tap handler; it can take a moment.
export async function notifyUser(uid, message) {
  try {
    if (!uid || (auth.currentUser && uid === auth.currentUser.uid)) return null; // never notify yourself
    return await sendPushToUser({
      uid,
      message: { ...message, data: { ...message.data, toUid: uid } },
      getTokens: savedTokens,
      removeToken: dropToken,
    });
  } catch (error) {
    console.warn('[push] could not send:', error.message);
    return null;
  }
}

// `build` is a message, or a function from uid to message when each person needs a different one.
export function notifyUsers(uids, build) {
  const unique = [...new Set(uids)].filter(Boolean);
  return Promise.all(unique.map((uid) => notifyUser(uid, typeof build === 'function' ? build(uid) : build)));
}

export async function notifyAdmins(build) {
  try {
    const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'admin')));
    return await notifyUsers(snap.docs.map((d) => d.id), build);
  } catch (error) {
    console.warn('[push] could not reach admins:', error.message);
    return [];
  }
}

// Everyone in a booking's dispute chat except the person who just wrote: client, freelancer and every admin.
// `build` receives the recipient's role ('client' | 'freelancer' | 'admin') and returns the message.
export function notifyDisputeParticipants(booking, build) {
  const roleOf = (uid) => (uid === booking.freelancerId ? 'freelancer' : 'client');
  return Promise.all([
    notifyUsers([booking.clientId, booking.freelancerId], (uid) => build(roleOf(uid))),
    notifyAdmins(() => build('admin')),
  ]);
}

/* ───────────── tapping a notification ───────────── */

export const navigationRef = createNavigationContainerRef();

const AUTH_ROUTES = new Set(['GetStarted', 'Login', 'AccountType', 'RegFreelancer', 'RegClient']);
let pendingTarget = null;
const handled = new Set();

const canNavigateNow = () =>
  navigationRef.isReady() &&
  !!auth.currentUser &&
  !AUTH_ROUTES.has((navigationRef.getCurrentRoute() || {}).name);

function goTo(target) {
  // The notification was for a different account that used this phone: ignore it.
  if (target.toUid && auth.currentUser && target.toUid !== auth.currentUser.uid) return;
  navigationRef.dispatch(StackActions.push(target.name, target.params));
}

export function openFromNotification(response) {
  const request = response && response.notification && response.notification.request;
  if (!request) return;
  if (request.identifier) {
    if (handled.has(request.identifier)) return; // the same tap can be reported twice
    handled.add(request.identifier);
  }
  const target = resolveNotificationTarget(request.content && request.content.data);
  if (!target) return;
  // Not signed in yet (the app was closed): remember it and open it right after login.
  if (canNavigateNow()) goTo(target);
  else pendingTarget = target;
}

export function flushPendingNavigation() {
  if (!pendingTarget || !canNavigateNow()) return;
  const target = pendingTarget;
  pendingTarget = null;
  goTo(target);
}

/* ───────────── hooks ───────────── */

// Put once in the root component (App).
export function useNotificationTapHandler() {
  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    const subscription = Notifications.addNotificationResponseReceivedListener(openFromNotification);
    const launchedBy = Notifications.getLastNotificationResponse();
    if (launchedBy) openFromNotification(launchedBy);
    return () => subscription.remove();
  }, []);
}

// Put in each screen that only exists after login (the two tab navigators and the admin dashboard).
export function usePushRegistration() {
  useEffect(() => {
    let alive = true;
    registerForPush()
      .then((result) => {
        if (alive && result.status !== 'granted') {
          console.log(`[push] not registered: ${result.status}${result.error ? ` (${result.error})` : ''}`);
        }
      })
      .catch((error) => console.warn('[push] registration failed:', error.message));
    const timer = setTimeout(flushPendingNavigation, 400);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);
}
