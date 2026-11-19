import {
  ASTVisitor,
  FragmentDefinitionNode,
  GraphQLError,
  Kind,
  SelectionSetNode,
  ValidationContext,
} from 'graphql';

/**
 * Refuses queries nested too deep or asking for too many fields (aliases
 * included), so one request can't make the server do thousands of lookups.
 * Schema introspection is left alone; it's off in production anyway.
 */
type Cost = { fields: number; depth: number };

// Introspection is left alone (it's off in production anyway); __typename counts like any field.
const INTROSPECTION = new Set(['__schema', '__type']);

export function queryLimits(maxDepth: number, maxFields: number) {
  return (context: ValidationContext): ASTVisitor => {
    const fragments = new Map<string, FragmentDefinitionNode>();
    for (const definition of context.getDocument().definitions) {
      if (definition.kind === Kind.FRAGMENT_DEFINITION)
        fragments.set(definition.name.value, definition);
    }
    // Each fragment is costed once and reused at every spread, so a chain of
    // fragments that each spread the next twice costs linear time, not 2^n.
    const fragmentCosts = new Map<string, Cost>();
    const visiting = new Set<string>();
    // Counts stop growing past the limit; beyond it the exact number doesn't matter.
    const capped = (fields: number) => Math.min(fields, maxFields + 1);

    const costOf = (set: SelectionSetNode): Cost => {
      let fields = 0;
      let depth = 0;
      for (const selection of set.selections) {
        let inner: Cost = { fields: 0, depth: 0 };
        if (selection.kind === Kind.FIELD) {
          if (INTROSPECTION.has(selection.name.value)) continue;
          const child = selection.selectionSet
            ? costOf(selection.selectionSet)
            : { fields: 0, depth: 0 };
          inner = { fields: child.fields + 1, depth: child.depth + 1 };
        } else if (selection.kind === Kind.INLINE_FRAGMENT) {
          inner = costOf(selection.selectionSet);
        } else {
          inner = fragmentCost(selection.name.value);
        }
        fields = capped(fields + inner.fields);
        depth = Math.max(depth, inner.depth);
      }
      return { fields, depth };
    };

    const fragmentCost = (name: string): Cost => {
      const known = fragmentCosts.get(name);
      if (known) return known;
      const fragment = fragments.get(name);
      // Unknown or cyclic fragments are reported by graphql's own rules.
      if (!fragment || visiting.has(name)) return { fields: 0, depth: 0 };
      visiting.add(name);
      const cost = costOf(fragment.selectionSet);
      visiting.delete(name);
      fragmentCosts.set(name, cost);
      return cost;
    };

    return {
      OperationDefinition(operation) {
        const { fields, depth } = costOf(operation.selectionSet);
        if (depth > maxDepth || fields > maxFields) {
          context.reportError(
            new GraphQLError('This request asks for too much at once.'),
          );
        }
      },
    };
  };
}
