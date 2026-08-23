import { createDevelopmentIdentity } from '../src/application/development-identity.ts';

describe('development identity state', () => {
  it('creates only a local development identity from a phone input', () => {
    expect(createDevelopmentIdentity('  +7 900 000-00-00  ')).toEqual({
      kind: 'development_identity',
      phone: '+7 900 000-00-00',
    });
  });

  it('does not create identity state for an empty phone input', () => {
    expect(createDevelopmentIdentity('   ')).toBeUndefined();
  });
});
