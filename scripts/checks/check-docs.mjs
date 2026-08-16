import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const EXIT = { pass: 0, violation: 1, error: 2 };

const REQUIRED_FILES = [
  'docs/tasks/VPZH-010.yaml',
  'docs/architecture/overview.md',
  'docs/architecture/m1-shell.md',
  'docs/security/m1-health-endpoint.md',
  'contracts/api/health.openapi.yaml',
];

function main() {
  const taskId = process.env.TASK_ID;
  if (taskId === undefined || !/^VPZH-[0-9]{3,}$/u.test(taskId)) {
    throw new Error('TASK_ID must identify the task whose documentation is being checked');
  }
  const taskManifest = `docs/tasks/${taskId}.yaml`;
  if (!existsSync(resolve(process.cwd(), taskManifest))) {
    console.error(`DOCUMENTATION VIOLATION: missing ${taskManifest}`);
    return EXIT.violation;
  }
  const missing = REQUIRED_FILES.filter((file) => !existsSync(resolve(process.cwd(), file)));
  for (const app of ['mobile', 'api', 'admin']) {
    const appDirectory = resolve(process.cwd(), 'apps', app);
    const readme = resolve(appDirectory, 'README.md');
    if (existsSync(appDirectory) && !existsSync(readme)) {
      missing.push(`apps/${app}/README.md`);
    }
  }
  const overviewPath = resolve(process.cwd(), 'docs/architecture/overview.md');
  if (existsSync(overviewPath) && readFileSync(overviewPath, 'utf8').includes('CI пока нет')) {
    missing.push('docs/architecture/overview.md: stale CI statement');
  }

  if (missing.length > 0) {
    for (const file of missing) {
      console.error(`DOCUMENTATION VIOLATION: ${file}`);
    }
    return EXIT.violation;
  }

  console.log(`PASS docs check: ${taskId} and ${REQUIRED_FILES.length} M1 documentation inputs.`);
  return EXIT.pass;
}

try {
  process.exit(main());
} catch (error) {
  console.error(`CHECKER ERROR docs: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(EXIT.error);
}
