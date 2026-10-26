# SWAPD — mobile app (iOS + Android)

The SWAPD swapping marketplace as a native app. One codebase builds both the iPhone and Android apps.
It talks to the same API and database as the website ([barter](https://github.com/Udaygowda-123/barter)), so accounts,
listings, offers, chats and deals are shared — sign in with your website account.

## Stack (if you know Next.js, you mostly know this)

| Here | Equivalent on the web app |
|---|---|
| **Expo + React Native**, TypeScript | React + Next.js |
| **Expo Router** — files in `src/app/` are screens | Next.js `app/` folder routing |
| `<View>`, `<Text>`, `<Pressable>`, `StyleSheet` | `<div>`, `<p>`, `<button>`, Tailwind |
| **TanStack Query** | TanStack Query (same) |
| `expo-secure-store` (Keychain / Keystore) | httpOnly refresh cookie |

## Run it on your phone (no Xcode / Android Studio needed)

1. Install **Expo Go** from the App Store / Play Store.
2. In this folder:
   ```bash
   npm install
   npx expo start
   ```
3. Scan the QR code (iPhone: Camera app · Android: inside Expo Go). Phone and laptop must be on the same Wi-Fi.

By default the app uses the **live** API (`https://barter-web-wheat.vercel.app`). To use your local web app and its
dev database instead, copy `.env.example` to `.env.local` and set `EXPO_PUBLIC_API_URL` to your laptop's Wi-Fi IP.

## Project layout

```
src/app/            screens (Expo Router)
  (tabs)/           Discover · Offers · + (list item) · Messages · Me
  welcome, login, register, forgot
  listing/[id]      item detail        listing/new   create listing (photos)
  swap/[id]         offer composer (also counters: ?counter=<offerId>)
  offer/[id]        offer detail       deal/[id]     deal steps & review
  chat/[id]         conversation       user/[id]     public profile
  saved, notifications, deals
src/components/     UI kit (ui.tsx), listing card, proposal strip, flip deck…
src/lib/            api client + auth, types shared with the API, formatters
src/theme/tokens.ts brand colours & fonts (same as the website's design system)
```

## Checks

```bash
npm run typecheck
npm run lint
npx expo-doctor
```

## Shipping to the stores

Builds run in the cloud with **EAS** (free tier available) — no Mac needed for Android, and no local Xcode for iOS:

```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform android   # .aab for Google Play (or --profile preview for an installable .apk)
npx eas-cli@latest build --platform ios       # needs an Apple Developer account ($99/yr)
```

Bundle IDs are `com.swapd.app` (both platforms, set in `app.json`) — change them before the first store build if you
own a different domain.
