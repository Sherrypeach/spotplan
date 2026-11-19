import { join } from 'path';

import { GraphQLDefinitionsFactory } from '@nestjs/graphql';

/**
 * Generates TypeScript classes from the schema-first .graphql files into
 * graphql.schema.ts. Run after creating or
 * editing any .graphql file: `npm run generate-typings`.
 * NEVER edit the generated file by hand — the .graphql files are the truth.
 */
const definitionsFactory = new GraphQLDefinitionsFactory();

definitionsFactory.generate({
  typePaths: [join(process.cwd(), 'src/**/*.graphql')],
  path: join(process.cwd(), 'src/infrastructure/graphql/graphql.schema.ts'),
  outputAs: 'class',
  customScalarTypeMapping: {
    Date: 'Date',
    JSON: 'unknown',
  },
});
