module.exports = {
  forbidden: [
    {
      name: 'no-circular-dependencies',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'application-must-not-depend-on-infrastructure',
      severity: 'error',
      from: { path: '(^|/)(application)(/|$)' },
      to: { path: '(^|/)(infrastructure)(/|$)' },
    },
    {
      name: 'presentation-must-not-depend-on-infrastructure',
      severity: 'error',
      from: { path: '(^|/)(presentation)(/|$)' },
      to: { path: '(^|/)(infrastructure)(/|$)' },
    },
    {
      name: 'domain-must-not-depend-on-outer-layers',
      severity: 'error',
      from: { path: '(^|/)(domain)(/|$)' },
      to: { path: '(^|/)(application|infrastructure|presentation)(/|$)' },
    },
    {
      name: 'presentation-must-not-depend-on-database-packages',
      severity: 'error',
      from: { path: '(^|/)(presentation)(/|$)' },
      to: { dependencyTypes: ['npm'], path: '^(pg|typeorm|prisma|@prisma/client)(/|$)' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: '(^|/)(dist|coverage)(/|$)',
    tsPreCompilationDeps: false,
  },
};
