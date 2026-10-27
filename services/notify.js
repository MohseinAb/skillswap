import { Alert, Platform } from 'react-native';

// React Native Web's Alert.alert() does nothing, so use the browser dialogs there.
export function notify(title, message) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

// Resolves true when the person confirms, false when they cancel or dismiss.
export function confirmAction(title, message, confirmLabel = 'Confirm', destructive = false) {
  return new Promise((resolve) => {
    if (Platform.OS === 'web') {
      resolve(typeof window !== 'undefined' ? window.confirm(`${title}\n\n${message}`) : false);
      return;
    }
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}
