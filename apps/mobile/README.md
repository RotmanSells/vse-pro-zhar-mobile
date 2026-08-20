# Mobile shell

`@vse-pro-zhar/mobile` is the Expo Router application shell for iOS and Android.

- `src/app/_layout.tsx` is the Router root layout.
- `src/app/index.tsx` is the only shell route.
- The package contains no API client, network state, authentication, product UI, or business logic.

Run `pnpm --dir apps/mobile start` to start Expo, or `pnpm --dir apps/mobile build`
to export the Android bundle through Metro.
