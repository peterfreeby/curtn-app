import { Client, Operation, OperationResult } from "urql";
import { pipe, map, Source } from "wonka";

function getOperationName(op: Operation): string | undefined {
  const def = op.query.definitions.find(
    (d: { kind: string }) => d.kind === "OperationDefinition"
  ) as { name?: { value: string } } | undefined;
  return def?.name?.value;
}

export function createStoryClient(mockData: Record<string, unknown> = {}) {
  return new Client({
    url: "/mock-graphql",
    exchanges: [
      () => (ops$: Source<Operation>) =>
        pipe(
          ops$,
          map((operation): OperationResult => {
            const opName = getOperationName(operation);
            const data = opName && mockData[opName] !== undefined ? mockData[opName] : null;
            return {
              operation,
              data,
              error: undefined,
              extensions: undefined,
              hasNext: false,
              stale: false,
            };
          })
        ),
    ],
  });
}
