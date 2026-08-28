import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

function runImpactExpression(expression: string): string {
  const modulePath = resolve(process.cwd(), 'scripts/lib/verification-impact.mjs');
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import { isDocsOnlyChange } from ${JSON.stringify(modulePath)}; console.log(${expression});`,
    ],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}

describe('verification impact classification', () => {
  it('classifies documentation-only changes separately from code changes', () => {
    expect(runImpactExpression("isDocsOnlyChange(['docs/tasks/VPZH-036.yaml', 'README.md'])")).toBe(
      'true',
    );
    expect(runImpactExpression("isDocsOnlyChange(['apps/mobile/src/app/index.tsx'])")).toBe(
      'false',
    );
  });
});
