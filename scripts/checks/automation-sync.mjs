import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';

const EXIT = { pass: 0, violation: 1, error: 2 };
const START_MARKER = '<!-- automation-sync:implemented-commands:start -->';
const END_MARKER = '<!-- automation-sync:implemented-commands:end -->';

function optionValue(argv, name, fallback) {
  const index = argv.indexOf(name);
  if (index === -1) {
    return fallback;
  }
  const value = argv[index + 1];
  if (value === undefined) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(
      `Cannot parse JSON ${path}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

function implementedCommandsFromDocument(markdown) {
  const start = markdown.indexOf(START_MARKER);
  const end = markdown.indexOf(END_MARKER);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AUTOMATION.md does not contain the implemented-commands marker block');
  }
  const block = markdown.slice(start + START_MARKER.length, end);
  return [...block.matchAll(/^\s*-\s+`pnpm ([a-z0-9:-]+)`\s*$/gmu)].map((match) => match[1]);
}

function validateRegistry(registry) {
  if (
    !Array.isArray(registry.implementedCommands) ||
    !Array.isArray(registry.requiredFoundationCommands)
  ) {
    throw new Error(
      'Registry must contain implementedCommands and requiredFoundationCommands arrays',
    );
  }
  for (const item of registry.implementedCommands) {
    if (
      typeof item.command !== 'string' ||
      typeof item.implementation !== 'string' ||
      !Array.isArray(item.policyRules)
    ) {
      throw new Error('Each implemented command needs command, implementation, and policyRules');
    }
  }
}

function main() {
  const argv = process.argv.slice(2);
  const root = resolve(process.cwd(), optionValue(argv, '--root', '.'));
  const registryPath = resolve(
    root,
    optionValue(argv, '--registry', 'policy/automation-registry.json'),
  );
  if (!existsSync(registryPath)) {
    throw new Error(`Registry does not exist: ${registryPath}`);
  }
  const registry = readJson(registryPath);
  validateRegistry(registry);

  const packagePath = resolve(root, 'package.json');
  const automationPath = resolve(root, registry.automationDocument);
  const policyPath = resolve(root, registry.policyDocument);
  const workflowPath = resolve(root, registry.ciWorkflow);
  for (const requiredPath of [packagePath, automationPath, policyPath, workflowPath]) {
    if (!existsSync(requiredPath)) {
      throw new Error(`Required synchronization input does not exist: ${requiredPath}`);
    }
  }

  const packageJson = readJson(packagePath);
  const policy = parse(readFileSync(policyPath, 'utf8'));
  if (policy === null || typeof policy !== 'object' || policy.rules === undefined) {
    throw new Error('policy/rules-map.yaml does not contain rules');
  }
  const documentedCommands = implementedCommandsFromDocument(readFileSync(automationPath, 'utf8'));
  const registryCommands = registry.implementedCommands.map((item) => item.command);
  const violations = [];

  for (const command of registry.requiredFoundationCommands) {
    if (packageJson.scripts?.[command] === undefined) {
      violations.push(`package.json is missing required foundation command: ${command}`);
    }
  }
  for (const command of registryCommands) {
    if (packageJson.scripts?.[command] === undefined) {
      violations.push(`package.json is missing implemented command: ${command}`);
    }
  }
  if (new Set(documentedCommands).size !== documentedCommands.length) {
    violations.push('AUTOMATION.md implemented command block contains duplicates');
  }
  if (documentedCommands.join('|') !== registryCommands.join('|')) {
    violations.push(
      'AUTOMATION.md implemented commands do not exactly match the machine-readable registry',
    );
  }
  for (const item of registry.implementedCommands) {
    if (packageJson.scripts?.[item.command] !== item.implementation) {
      violations.push(
        `${item.command} implementation does not exactly match the machine-readable registry`,
      );
    }
    for (const ruleId of item.policyRules) {
      const rule = policy.rules[ruleId];
      if (!Array.isArray(rule?.checks) || !rule.checks.includes(item.command)) {
        violations.push(`${item.command} is not mapped by policy rule ${ruleId}`);
      }
    }
  }
  if (!readFileSync(workflowPath, 'utf8').includes(registry.ciCommand)) {
    violations.push(`CI workflow does not run ${registry.ciCommand}`);
  }
  if (
    registry.ciPullRequestCommand &&
    !readFileSync(workflowPath, 'utf8').includes(registry.ciPullRequestCommand)
  ) {
    violations.push(`CI pull_request workflow does not run ${registry.ciPullRequestCommand}`);
  }

  if (violations.length === 0) {
    console.log('PASS automation synchronization.');
    return EXIT.pass;
  }
  for (const violation of violations) {
    console.error(`AUTOMATION SYNC VIOLATION: ${violation}`);
  }
  return EXIT.violation;
}

try {
  process.exit(main());
} catch (error) {
  console.error(
    `CHECKER ERROR automation sync: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(EXIT.error);
}
