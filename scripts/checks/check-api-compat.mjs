import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';

const EXIT = { pass: 0, violation: 1, error: 2 };
const CONTRACT_PATH = 'contracts/api/health.openapi.yaml';
const HTTP_METHODS = new Set(['delete', 'get', 'head', 'options', 'patch', 'post', 'put', 'trace']);

function schemaFor(reference, contract) {
  if (reference?.$ref === undefined) return reference;
  const prefix = '#/components/schemas/';
  if (typeof reference.$ref !== 'string' || !reference.$ref.startsWith(prefix)) {
    throw new Error(`unsupported schema reference: ${String(reference.$ref)}`);
  }
  const schema = contract.components?.schemas?.[reference.$ref.slice(prefix.length)];
  if (schema === undefined) throw new Error(`missing schema reference: ${reference.$ref}`);
  return schema;
}

function schemaViolations(baseline, current, location) {
  const violations = [];
  if (baseline?.type !== undefined && baseline.type !== current?.type) {
    violations.push(`${location} changes type from ${baseline.type} to ${String(current?.type)}`);
  }
  if (baseline?.const !== undefined && baseline.const !== current?.const) {
    violations.push(
      `${location} changes const from ${baseline.const} to ${String(current?.const)}`,
    );
  }
  const baselineRequired = new Set(baseline?.required ?? []);
  const currentRequired = new Set(current?.required ?? []);
  for (const field of baselineRequired) {
    if (!currentRequired.has(field)) violations.push(`${location}.${field} is no longer required`);
  }
  for (const [field, baselineProperty] of Object.entries(baseline?.properties ?? {})) {
    const currentProperty = current?.properties?.[field];
    if (currentProperty === undefined) {
      violations.push(`${location}.${field} was removed`);
    } else {
      violations.push(
        ...schemaViolations(baselineProperty, currentProperty, `${location}.${field}`),
      );
    }
  }
  return violations;
}

function operationEntries(contract) {
  const entries = [];
  for (const [path, pathItem] of Object.entries(contract?.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem ?? {})) {
      if (HTTP_METHODS.has(method)) entries.push({ method, operation, path });
    }
  }
  return entries;
}

function gitBaseline() {
  const base = process.env.DIFF_BASE;
  if (base === undefined || base.length === 0) return undefined;
  const reference = spawnSync('git', ['rev-parse', '--verify', `${base}^{commit}`], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  if (reference.error !== undefined) throw reference.error;
  if (reference.status !== 0) {
    throw new Error(`cannot resolve API baseline ${base}: ${reference.stderr.trim()}`);
  }
  const result = spawnSync('git', ['show', `${base}:${CONTRACT_PATH}`], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  if (result.error !== undefined) throw result.error;
  if (result.status === 0) return parse(result.stdout);
  if (result.status === 128) return undefined;
  throw new Error(`cannot read API baseline from ${base}: ${result.stderr.trim()}`);
}

function compatibilityViolations(baseline, current) {
  const violations = [];
  for (const { path, method, operation } of operationEntries(baseline)) {
    const currentOperation = current?.paths?.[path]?.[method];
    const operationName = `${method.toUpperCase()} ${path}`;
    if (currentOperation === undefined) {
      violations.push(`${operationName} was removed`);
      continue;
    }
    for (const [status, baselineResponse] of Object.entries(operation.responses ?? {})) {
      const currentResponse = currentOperation.responses?.[status];
      if (currentResponse === undefined) {
        violations.push(`${operationName} response ${status} was removed`);
        continue;
      }
      const baselineSchema = schemaFor(
        baselineResponse?.content?.['application/json']?.schema,
        baseline,
      );
      const currentSchema = schemaFor(
        currentResponse?.content?.['application/json']?.schema,
        current,
      );
      if (baselineSchema !== undefined || currentSchema !== undefined) {
        violations.push(
          ...schemaViolations(baselineSchema, currentSchema, `${operationName} response ${status}`),
        );
      }
    }
  }
  return violations;
}

function main() {
  const contractPath = resolve(process.cwd(), CONTRACT_PATH);
  if (!existsSync(contractPath)) {
    console.error(`API COMPATIBILITY VIOLATION: missing ${CONTRACT_PATH}`);
    return EXIT.violation;
  }

  const contract = parse(readFileSync(contractPath, 'utf8'));
  const health = contract?.paths?.['/health']?.get;
  const violations = [];
  if (contract?.openapi !== '3.1.0') violations.push('contract must use OpenAPI 3.1.0');
  if (health === undefined) violations.push('GET /health must be defined');
  if (health?.security?.length !== 0) {
    violations.push('GET /health must be explicitly unauthenticated');
  }
  for (const responseCode of ['200', '429', '503']) {
    if (health?.responses?.[responseCode] === undefined) {
      violations.push(`GET /health must define response ${responseCode}`);
    }
  }
  if (contract?.components?.schemas?.HealthResponse === undefined) {
    violations.push('HealthResponse schema is required');
  }
  if (contract?.components?.schemas?.HealthErrorResponse === undefined) {
    violations.push('HealthErrorResponse schema is required');
  }
  if (contract?.components?.schemas?.RateLimitErrorResponse === undefined) {
    violations.push('RateLimitErrorResponse schema is required');
  }
  for (const header of ['RateLimitLimit', 'RateLimitRemaining', 'RetryAfter']) {
    if (contract?.components?.headers?.[header] === undefined) {
      violations.push(`${header} header schema is required`);
    }
  }
  const rateLimitResponse = health?.responses?.['429'];
  for (const header of ['RateLimit-Limit', 'RateLimit-Remaining', 'Retry-After']) {
    if (rateLimitResponse?.headers?.[header] === undefined) {
      violations.push(`GET /health response 429 must define ${header}`);
    }
  }

  const baseline = gitBaseline();
  if (baseline !== undefined) violations.push(...compatibilityViolations(baseline, contract));

  if (violations.length > 0) {
    for (const violation of violations) {
      console.error(`API COMPATIBILITY VIOLATION: ${violation}`);
    }
    return EXIT.violation;
  }

  console.log(
    baseline === undefined
      ? `PASS API compatibility: ${CONTRACT_PATH} is the initial M1 baseline.`
      : `PASS API compatibility: ${CONTRACT_PATH} is compatible with DIFF_BASE.`,
  );
  return EXIT.pass;
}

try {
  process.exit(main());
} catch (error) {
  console.error(
    `CHECKER ERROR API compatibility: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(EXIT.error);
}
