export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createYoga } from "graphql-yoga";

declare const __webpack_require__: any;
declare const __non_webpack_require__: (id: string) => any;

const nodeRequire =
  typeof __non_webpack_require__ === "function"
    ? __non_webpack_require__
    : require;

// Register ts-node for loading .ts server files at runtime (dev only)
let tsRegistered = false;
function ensureTsNode() {
  if (tsRegistered) return;
  try {
    const path = nodeRequire("path");
    nodeRequire("ts-node").register({
      transpileOnly: true,
      project: path.resolve(process.cwd(), "../server/tsconfig.json"),
      compilerOptions: {
        module: "commonjs",
        moduleResolution: "node",
        target: "es2016",
        esModuleInterop: true,
        strict: true,
        skipLibCheck: true,
        baseUrl: path.resolve(process.cwd(), "../server/src"),
      },
    });
    tsRegistered = true;
  } catch {
    // ts-node not available (production) — use compiled JS
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _yoga: any = null;

function getYoga() {
  if (_yoga) return _yoga;

  const path = nodeRequire("path");
  const serverBase = path.resolve(process.cwd(), "../server");

  // In dev: use ts-node to load .ts files directly
  // In production (Vercel): load from pre-compiled dist/
  ensureTsNode();

  let schema, connectToDatabase, getUser;

  try {
    // Try .ts files first (dev with ts-node)
    ({ schema } = nodeRequire(path.join(serverBase, "src/schemas/schema.ts")));
    ({ connectToDatabase } = nodeRequire(path.join(serverBase, "src/db/mongoose.ts")));
    ({ getUser } = nodeRequire(path.join(serverBase, "src/auth/getUser.ts")));
  } catch {
    // Fall back to compiled JS (production)
    ({ schema } = nodeRequire(path.join(serverBase, "dist/src/schemas/schema.js")));
    ({ connectToDatabase } = nodeRequire(path.join(serverBase, "dist/src/db/mongoose.js")));
    ({ getUser } = nodeRequire(path.join(serverBase, "dist/src/auth/getUser.js")));
  }

  _yoga = createYoga({
    schema,
    graphqlEndpoint: "/api/graphql",
    fetchAPI: { Response },
    context: async ({ request }) => {
      await connectToDatabase();
      const authorization = request.headers.get("authorization") || undefined;
      const user = await getUser({ authorization });
      return { user, authorization };
    },
  });

  return _yoga;
}

async function handler(request: Request) {
  const yoga = getYoga();
  return yoga.fetch(request);
}

export { handler as GET, handler as POST };
