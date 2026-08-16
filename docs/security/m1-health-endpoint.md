# M1 health endpoint security policy

The M1 health endpoint is intentionally unauthenticated because it is an
operational liveness capability. It is read-only and must not expose customer data,
tokens, secrets, stack traces, SQL, provider details, hostnames or internal network
addresses.

## Required policy

- Only `GET /health` is exposed by this capability; request bodies and query
  parameters are rejected or ignored without changing the result.
- The endpoint has a bounded edge rate limit. The M1 test environment uses a limit
  of 60 requests per minute per source IP; production may apply a stricter limit.
- Successful and unavailable responses use `Cache-Control: no-store`.
- The 503 response uses the stable `SERVICE_UNAVAILABLE` code and safe message from
  the OpenAPI contract. A rate-limited request receives 429 with `RATE_LIMITED`,
  `Retry-After`, `RateLimit-Limit` and `RateLimit-Remaining`. Internal failure
  reasons are logged only on the server.
- Logs must not include response bodies, authorization headers, environment values,
  secrets or PII. A correlation/request ID may be logged if it contains no user data.
- No authentication, session, permission or customer identity is introduced by M1.

## Required tests

The M1 security test set must verify unauthenticated read access, the bounded rate
limit, safe 503 output, `no-store` headers and the absence of secret or infrastructure
details in the response and logs.
