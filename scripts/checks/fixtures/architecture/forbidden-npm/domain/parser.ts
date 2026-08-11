import { parse } from '@babel/parser';

export function parseDomainInput(input: string): string {
  return parse(input).type;
}
