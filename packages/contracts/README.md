# Shared contracts

This package owns runtime validation for contracts shared across executable surfaces. It
contains the API health/error contract, persisted customer profile request/response contract
and VPZH-021 test-only legal acceptance request/response contract.

It has no infrastructure adapters and no database dependency. Consumers validate untrusted
HTTP payloads with the exported Zod schemas before using the values. The profile contract
contains only the current customer phone, optional name and optional birthday. Legal acceptance
is a separate capability with exactly two test-only documents and runtime-validated state;
it does not define production legal text/version, marketing consent or order data.
