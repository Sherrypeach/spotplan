import type { CodegenConfig } from '@graphql-codegen/cli';

/**
 * Typed GraphQL operations via the client preset: write documents with the
 * generated `graphql()` tag (src/graphql/generated) and hooks get full types.
 * `schema.graphql` is a committed snapshot of the API's schema — refresh it
 * from the api repo's .graphql files (or introspection) when the API changes,
 * then run `npm run codegen`. Generated output is committed so a fresh clone
 * builds without a codegen run.
 */
const config: CodegenConfig = {
  schema: 'schema.graphql',
  documents: ['src/**/*.{ts,tsx}'],
  ignoreNoDocuments: true,
  generates: {
    'src/graphql/generated/': {
      preset: 'client',
      config: {
        useTypeImports: true,
        // JSON is checked where it's read (the class document); dates arrive as ISO text.
        scalars: { JSON: 'unknown', Date: 'string' },
      },
    },
  },
};

export default config;
