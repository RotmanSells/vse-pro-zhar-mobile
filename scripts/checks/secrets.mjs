import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename, resolve } from 'node:path';

const EXIT = { pass: 0, violation: 1, error: 2 };

function optionValue(argv, name, fallback) {
  const index = argv.indexOf(name);
  if (index === -1) return fallback;
  if (argv[index + 1] === undefined) throw new Error(`${name} requires a value`);
  return argv[index + 1];
}

function git(root, args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (error) {
    throw new Error(
      `Git command failed (${args.join(' ')}): ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

const PLACEHOLDER = /^(?:example|fake|dummy|test|changeme|<[^>]+>|\$\{[^}]+\})$/iu;
const RULES = [
  { id: 'private-key', regex: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/u },
  { id: 'github-token', regex: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/u },
  { id: 'aws-access-key', regex: /\bAKIA[0-9A-Z]{16}\b/u },
  { id: 'provider-secret', regex: /\b(?:sk_live_|rk_live_|xox[baprs]-|AIza)[A-Za-z0-9_-]{16,}\b/u },
];
const ASSIGNMENT =
  /\b(password|passwd|secret|token|api[_-]?key|apikey|client_secret|private_key)\b\s*[:=]\s*["']?([^\s"'`,;]{16,})/giu;

function isPlaceholder(value) {
  return PLACEHOLDER.test(value.replace(/["']$/u, ''));
}

function scanText(text, path) {
  const findings = [];
  const lines = text.split(/\r?\n/u);
  lines.forEach((line, index) => {
    for (const rule of RULES)
      if (rule.regex.test(line)) findings.push({ line: index + 1, path, rule: rule.id });
    ASSIGNMENT.lastIndex = 0;
    for (const match of line.matchAll(ASSIGNMENT)) {
      const value = match[2] ?? '';
      if (!isPlaceholder(value))
        findings.push({ line: index + 1, path, rule: 'secret-assignment' });
    }
  });
  return findings;
}

function trackedFiles(root) {
  return git(root, ['ls-tree', '-r', '--name-only', '-z', 'HEAD']).split('\0').filter(Boolean);
}

function scanRepository(root) {
  const findings = [];
  for (const path of trackedFiles(root)) {
    const fileName = basename(path);
    if (
      /^\.env(?:\.|$)/u.test(fileName) &&
      !/^\.env\.(?:example|sample|template)$/u.test(fileName)
    ) {
      findings.push({ line: 1, path, rule: 'tracked-env-file' });
    }
    const content = execFileSync('git', ['show', `HEAD:${path}`], {
      cwd: root,
      encoding: null,
      maxBuffer: 64 * 1024 * 1024,
    });
    if (content.includes(0)) continue;
    findings.push(...scanText(content.toString('utf8'), path));
  }
  return findings;
}

function scanAddedDiff(root, base) {
  const output = git(root, [
    'diff',
    '--unified=0',
    '--no-renames',
    '--diff-filter=ACMRT',
    `${base}...HEAD`,
  ]);
  const findings = [];
  let path = 'unknown';
  let line = 0;
  for (const raw of output.split('\n')) {
    if (raw.startsWith('+++ b/')) {
      path = raw.slice(6);
      continue;
    }
    const header = /^@@ -\d+(?:,\d+)? \+(\d+)/u.exec(raw);
    if (header) {
      line = Number(header[1]);
      continue;
    }
    if (raw.startsWith('+') && !raw.startsWith('+++')) {
      findings.push(...scanText(raw.slice(1), path).map((finding) => ({ ...finding, line })));
      line += 1;
    }
  }
  return findings;
}

function main() {
  const argv = process.argv.slice(2);
  const root = resolve(process.cwd(), optionValue(argv, '--root', '.'));
  const base = process.env.DIFF_BASE;
  if (base === undefined || base.length === 0) throw new Error('DIFF_BASE is required');
  if (!existsSync(resolve(root, '.git'))) throw new Error(`Git repository does not exist: ${root}`);
  git(root, ['rev-parse', '--verify', '--end-of-options', `${base}^{commit}`]);
  const findings = [...scanRepository(root), ...scanAddedDiff(root, base)];
  const unique = new Map(
    findings.map((finding) => [`${finding.path}:${finding.line}:${finding.rule}`, finding]),
  );
  if (unique.size > 0) {
    for (const finding of unique.values())
      console.error(`SECRET_VIOLATION: ${finding.path}:${finding.line} pattern=${finding.rule}`);
    return EXIT.violation;
  }
  console.log(`PASS secret scan: tracked files and diff from ${base} scanned.`);
  return EXIT.pass;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exit(main());
  } catch (error) {
    console.error(
      `CHECKER ERROR secret scan: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(EXIT.error);
  }
}
