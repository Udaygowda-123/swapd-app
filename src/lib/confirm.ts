import { Alert, Platform } from 'react-native';

/** Native alert with Cancel/Confirm on iOS & Android; window.confirm on web (Alert buttons are a no-op there). */
export function confirm(title: string, message: string, confirmText: string, opts: { destructive?: boolean; cancelText?: string } = {}): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) => Alert.alert(title, message, [
    { text: opts.cancelText ?? 'Cancel', style: 'cancel', onPress: () => resolve(false) },
    { text: confirmText, style: opts.destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
  ], { cancelable: true, onDismiss: () => resolve(false) }));
}

/** Simple message (errors, info) on every platform. */
export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') window.alert(message ? `${title}\n\n${message}` : title);
  else Alert.alert(title, message);
}
