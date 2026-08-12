import { execFileSync } from 'node:child_process';

export function gitOutput(root, args) {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 32,
    });
  } catch (error) {
    throw new Error(
      `Git command failed (${args.join(' ')}): ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

function parseNameStatus(output) {
  const tokens = output.split('\0').filter(Boolean);
  const changes = [];
  for (let index = 0; index < tokens.length;) {
    const [status, ...statusPaths] = tokens[index].split('\t');
    index += 1;
    const paths = statusPaths.length > 0 ? statusPaths : [tokens[index++]];
    const normalizedStatus = status[0];
    if (normalizedStatus === 'R' || normalizedStatus === 'C') {
      changes.push({ paths: [paths[0], tokens[index++]], status: normalizedStatus });
    } else {
      changes.push({ paths: [paths[0]], status: normalizedStatus });
    }
  }
  return changes;
}

function parseNumstat(output) {
  const records = [];
  for (const record of output.split('\0').filter(Boolean)) {
    const [additions, deletions, ...pathParts] = record.split('\t');
    const path = pathParts.join('\t');
    records.push({
      additions: additions === '-' ? null : Number(additions),
      binary: additions === '-' || deletions === '-',
      deletions: deletions === '-' ? null : Number(deletions),
      path,
    });
  }
  return records;
}

export function readCommittedDiff({ base, head = 'HEAD', root }) {
  if (base === undefined || base.length === 0) {
    throw new Error('DIFF_BASE is required');
  }
  const resolvedBase = gitOutput(root, [
    'rev-parse',
    '--verify',
    '--end-of-options',
    `${base}^{commit}`,
  ]).trim();
  const resolvedHead = gitOutput(root, [
    'rev-parse',
    '--verify',
    '--end-of-options',
    `${head}^{commit}`,
  ]).trim();
  const mergeBase = gitOutput(root, ['merge-base', resolvedBase, resolvedHead]).trim();
  if (mergeBase.length === 0) {
    throw new Error(`Cannot compute merge base for ${base} and ${head}`);
  }

  const range = [mergeBase, resolvedHead];
  const changes = parseNameStatus(
    gitOutput(root, [
      'diff',
      '--name-status',
      '-z',
      '--find-renames',
      '--find-copies-harder',
      ...range,
    ]),
  );
  const numstat = parseNumstat(
    gitOutput(root, ['diff', '--numstat', '-z', '--no-renames', ...range]),
  );
  return { base: resolvedBase, changes, head: resolvedHead, mergeBase, numstat };
}
