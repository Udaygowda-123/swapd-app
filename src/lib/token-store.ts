import * as SecureStore from 'expo-secure-store';

// Refresh token in the iOS Keychain / Android Keystore. (Web uses token-store.web.ts.)
const KEY = 'swapd.refreshToken';

export const tokenStore = {
  get: () => SecureStore.getItemAsync(KEY).catch(() => null),
  set: (v: string) => SecureStore.setItemAsync(KEY, v),
  clear: () => SecureStore.deleteItemAsync(KEY).catch(() => undefined),
};
