# Mobile shell

M1 is an Expo Router shell with one operational health screen. Start it with:

```text
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000 pnpm --filter @vse-pro-zhar/mobile start
```

Use an API address reachable from the Android emulator. Do not use the emulator's
`localhost` for the host API unless the test environment explicitly maps it.
