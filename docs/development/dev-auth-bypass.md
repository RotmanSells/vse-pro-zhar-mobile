# Development/test identity bypass

## Owner decision

Real SMS OTP authentication is intentionally deferred to final production-readiness
before deployment/release. This sequencing decision does not change the production
requirement: the first production release must use Phone + SMS OTP. Password, email,
Apple and Google login remain out of scope.

VPZH-016 is not a production authentication implementation. It provides only the
smallest local path needed to build and test later mobile screens without an SMS
provider.

## Guard

The path is disabled by default and requires both conditions:

1. `EXPO_PUBLIC_DEV_AUTH_BYPASS=true` is explicitly passed through Expo configuration.
2. The runtime is development or test. A production/release runtime fails closed and
   ignores the flag, including when the flag was accidentally included in the build.

The public Expo variable is a boolean configuration flag, not a secret. No secret may
be placed in `EXPO_PUBLIC_*`.

## Flow and state

When enabled, the mobile UI shows `Тестовый вход` and explicitly says `development
identity — не настоящая SMS-аутентификация.` The user enters a phone number and taps
`Продолжить`. The app then creates only an in-memory state with:

```text
{ kind: "development_identity", phone: "..." }
```

This state is local to the mobile runtime. It is not a customer account or production
authentication and does not create OTPs, OTP verification, SMS requests, JWTs,
access/refresh tokens, production sessions, SecureStore credentials, customer records,
backend authentication, middleware authorization or order authorization.

When the bypass is disabled, the phone/Continue path is not rendered or available.

## Production replacement requirement

Before production deployment, this development/test identity path MUST be disabled,
removed or technically unreachable from the production runtime. The real Phone + SMS OTP
path MUST then pass security, integration and E2E verification, including the production
fail-closed check for any bypass configuration.

VPZH-017 adds the separate backend development/test identity boundary needed by the first
persisted customer/profile slice. It uses `X-VPZH-Development-Identity` only when
`VPZH_ENABLE_DEVELOPMENT_IDENTITY=true` and the API runtime is development/test. The
backend resolves the trimmed phone to a customer context, then reads/writes only the
customer profile fields through PostgreSQL. It does not issue JWTs, access/refresh tokens,
cookies, production sessions or order authorization. Missing, malformed or production
identity input fails closed with the safe API error contract.

The mobile identity state from VPZH-016 remains local; VPZH-017 does not add a mobile
profile screen. Legal acceptance is a later M2 slice.
