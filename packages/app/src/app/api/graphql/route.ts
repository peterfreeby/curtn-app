export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createYoga } from "graphql-yoga";
import { schema } from "../../../../../server/src/schemas/schema";
import { connectToDatabase } from "../../../../../server/src/db/mongoose";
import { getUser } from "../../../../../server/src/auth/getUser";
import { createLoaders } from "../../../../../server/src/graphql/createLoaders";

const yoga = createYoga({
  schema,
  graphqlEndpoint: "/api/graphql",
  fetchAPI: { Response },
  context: async ({ request }) => {
    await connectToDatabase();
    const authorization = request.headers.get("authorization") || undefined;
    const user = await getUser({ authorization });
    return { user, authorization, loaders: createLoaders() };
  },
});

async function handler(request: Request) {
  return yoga.fetch(request);
}

export { handler as GET, handler as POST };
