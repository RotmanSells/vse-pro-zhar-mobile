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
`Продолжить`. The app first creates an in-memory identity with:

```text
{ kind: "development_identity", phone: "..." }
```

VPZH-018 passes that existing identity through a mobile Application port to the
Infrastructure customer-profile client. The client uses the configured API base URL and
sends only:

```text
GET /me/profile
X-VPZH-Development-Identity: <trimmed phone>
Accept: application/json
```

The backend may create or find the development/test customer in the existing VPZH-017
PostgreSQL model. Mobile accepts the response only after the shared
`CustomerProfileResponseSchema` validates it and keeps the complete profile, including
customer UUID, in Application state. The UI explicitly shows a test-only backend-connected
state with phone and any existing name/birthday. Network, timeout, invalid response and
safe HTTP failures remain errors with retry; there is no local successful-login fallback.

The identity state and returned profile are not production authentication. This flow does
not create OTPs, OTP verification, SMS requests, JWTs, access/refresh tokens, production
sessions, SecureStore credentials, production middleware authorization or order
authorization. Phone/header/profile data is not logged.

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

VPZH-018 connects the in-memory mobile identity from VPZH-016 to that existing VPZH-017
profile boundary. VPZH-020 lets that same guarded test identity edit nullable name and
optional birthday through the existing `PATCH /me/profile`. Mobile displays only the
validated profile returned by the backend; save failures retain the previous confirmed
profile and remain explicit. VPZH-021 uses the same guard for `GET/POST
/me/legal-acceptances`: it exposes only test-only Privacy Policy/User Agreement metadata,
requires an explicit action per document and reloads persisted PostgreSQL state. This does not
make name globally required, create profile completion/onboarding state, add production legal
text/version, marketing consent or a repeat-consent policy.
