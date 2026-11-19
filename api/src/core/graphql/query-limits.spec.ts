import { buildSchema, parse, validate } from 'graphql';

import { queryLimits } from '@core/graphql/query-limits';

const schema = buildSchema(`
  type Node { id: Int, child: Node }
  type Query { node: Node }
`);
const check = (query: string) =>
  validate(schema, parse(query), [queryLimits(4, 20)]);

describe('queryLimits', () => {
  it('lets ordinary queries through', () => {
    expect(check('{ node { id child { id } } }')).toEqual([]);
  });

  it('refuses queries nested too deep', () => {
    expect(
      check('{ node { child { child { child { child { id } } } } } }'),
    ).toHaveLength(1);
  });

  it('refuses queries asking for too many fields through aliases', () => {
    const aliases = Array.from(
      { length: 30 },
      (_, i) => `a${i}: node { id }`,
    ).join(' ');
    expect(check(`{ ${aliases} }`)).toHaveLength(1);
  });

  it('costs a chain of fragments quickly and still refuses it', () => {
    const chain = Array.from(
      { length: 40 },
      (_, i) => `fragment F${i} on Query { ...F${i + 1} ...F${i + 1} }`,
    ).join(' ');
    const query = `{ ...F0 } ${chain} fragment F40 on Query { __typename }`;
    const started = Date.now();
    expect(check(query)).toHaveLength(1);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('counts fields reached through a fragment', () => {
    expect(
      check('{ node { ...N } } fragment N on Node { id child { id } }'),
    ).toEqual([]);
    expect(
      check(
        '{ node { ...N } } fragment N on Node { child { child { child { child { id } } } } }',
      ),
    ).toHaveLength(1);
  });
});
