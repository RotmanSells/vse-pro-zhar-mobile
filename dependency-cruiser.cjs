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
      name: 'domain-must-not-depend-on-framework-or-database-packages',
      severity: 'error',
      from: { path: '(^|/)(domain)(/|$)' },
      to: {
        dependencyTypes: ['npm'],
        path: '^(react|react-native|next|pg|typeorm|prisma|@prisma/client)(/|$)',
      },
    },
    {
      name: 'presentation-must-not-depend-on-database-packages',
      severity: 'error',
      from: { path: '(^|/)(presentation)(/|$)' },
      to: { dependencyTypes: ['npm'], path: '^(pg|typeorm|prisma|@prisma/client)(/|$)' },
    },
    {
      name: 'domain-and-application-must-not-depend-on-provider-sdks',
      severity: 'error',
      from: { path: '(^|/)(domain|application)(/|$)' },
      to: {
        dependencyTypes: ['npm'],
        path: '^(@yookassa|yookassa|twilio|firebase-admin|@sendgrid|stripe)(/|$)',
      },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: '(^|/)(node_modules|dist|coverage)(/|$)',
    tsPreCompilationDeps: false,
  },
};
