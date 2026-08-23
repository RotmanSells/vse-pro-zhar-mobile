# Shared contracts

This package owns runtime validation for contracts shared across executable surfaces. It
contains the API health/error contract and the persisted customer profile request/response
contract introduced by VPZH-017.

It has no infrastructure adapters and no database dependency. Consumers validate untrusted
HTTP payloads with the exported Zod schemas before using the values. The profile contract
contains only the current customer phone, optional name and optional birthday; legal
acceptance and order data are deliberately separate capabilities.
