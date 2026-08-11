import { checkerExitCode, isCheckerExitCode } from '../../scripts/lib/checker-exit-codes';

describe('checker exit-code contract', () => {
  it('recognizes only the documented checker outcomes', () => {
    expect(isCheckerExitCode(checkerExitCode.pass)).toBe(true);
    expect(isCheckerExitCode(checkerExitCode.violation)).toBe(true);
    expect(isCheckerExitCode(checkerExitCode.error)).toBe(true);
    expect(isCheckerExitCode(3)).toBe(false);
  });
});
