# Shared contracts

This package owns runtime validation for contracts shared across executable surfaces. It
contains the API health/error contract, Category/Product catalog request/response contracts,
persisted customer profile request/response contract and VPZH-021 test-only legal acceptance
request/response contract.

It has no infrastructure adapters and no database dependency. Consumers validate untrusted
HTTP payloads with the exported Zod schemas before using the values. Backend/PostgreSQL is the
authority for catalog fields; the contract does not provide a fixture or mock catalog. Image-aware
Product responses add exactly one absolute Backend `imageUrl` while v1 Product schemas remain
unchanged; the contract exposes no storage endpoint, bucket or credentials. The Product contract uses
positive integer `basePriceMinor` RUB kopecks, an explicit `adminEnabled` boolean, a nullable
500-character `description`, optional integer `weightGrams`, and separate `isNew`/`isHit`
booleans. Product details and catalog visibility use separate strict request contracts; the
contract does not define orderability or iiko availability. The profile contract
contains only the current customer phone, optional name and optional birthday. Legal acceptance
is a separate capability with exactly two test-only documents and runtime-validated state;
it does not define production legal text/version, marketing consent or order data.
