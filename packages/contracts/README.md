# Shared contracts

This package owns runtime validation for contracts shared across executable
surfaces. M1 contains only the API health response contract.

The package has no infrastructure adapters and no database dependency. Consumers
must validate untrusted health payloads with the exported schemas before using them.
