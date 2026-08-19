# Shared contracts

This package owns runtime validation for contracts shared across executable surfaces. M1
contains the API health response and the safe public error response.

It has no infrastructure adapters and no database dependency. Consumers validate untrusted
health payloads with the exported Zod schema before using the value.
