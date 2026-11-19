import { GraphQLError, GraphQLScalarType } from 'graphql';

/**
 * Free-form JSON, for documents the API validates field by field in the
 * service (room layouts, seating charts) rather than through the schema.
 * It only comes in as a variable: the request body's depth check runs on
 * variables, and a value written into the query text would skip it.
 */
export const JsonScalar = new GraphQLScalarType({
  name: 'JSON',
  description: 'A JSON value',
  serialize: (value) => value,
  parseValue: (value) => value,
  parseLiteral: () => {
    throw new GraphQLError('Send JSON values as variables.', {
      extensions: { code: 'BAD_REQUEST' },
    });
  },
});
