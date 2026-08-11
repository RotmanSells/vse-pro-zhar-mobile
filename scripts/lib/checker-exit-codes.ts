export const checkerExitCode = {
  pass: 0,
  violation: 1,
  error: 2,
} as const;

export type CheckerExitCode = (typeof checkerExitCode)[keyof typeof checkerExitCode];

export function isCheckerExitCode(value: number): value is CheckerExitCode {
  return Object.values(checkerExitCode).includes(value as CheckerExitCode);
}
