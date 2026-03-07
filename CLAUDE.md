# Curtn — Claude Code Project Guide

> The canonical guide for working on Curtn with Claude Code. This file lives at the monorepo root and is symlinked into the Obsidian vault.

---

## 1. Safety & Responsibility

Every feature that touches the outside world must be built with these constraints:

### External Requests (feeds, APIs, scraping)
- **Rate limit all outbound requests.** Minimum 1-hour cooldown between polls per source. Never hammer a third-party server.
- **Identify yourself.** Always send a `User-Agent` header: `Curtn/1.0 (https://curtn.com; data-feed-reader)`
- **Cap response sizes.** Max 5MB per feed response. Max 200 items processed per poll.
- **Timeout everything.** 15-second fetch timeout on all outbound HTTP requests.
- **No scraping.** Curtn uses partnership-based data: manual entry, CSV import, RSS/iCal feeds. Never build scrapers that crawl sites without permission.

### Data Safety
- **Cascade carefully.** Deleting a show cascades through runs → performances → credits → reviews. Always confirm with the user before destructive operations.
- **Null-safe resolvers.** Every GraphQL resolver that touches a database reference must handle null/missing data. Never assume a `findById` will return a result.
- **Dedup at write time.** Check for existing records before creating. Performance-level dedup: same run + same calendar day.
- **Admin-gate destructive mutations.** All delete/merge/update mutations check `isAdmin` via `UserModel.findById`.

### Auth & Secrets
- Never commit `.env` files, credentials, or tokens.
- JWT access tokens: 15min. Refresh tokens: 7 days.
- Env vars needed on Vercel: `MONGODB_URL`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `TMDB_API_KEY`, `DB_NAME`

---

## 2. Documentation Protocol

### When to document
- **Every new feature** gets a doc in `Curtn_Obsidian/MVP Features/Feature N - Name.md`
- **Every architectural pattern** gets its own doc (e.g., Matryoshka Display Pattern, Data Overlap & Deduplication)
- **Update the Index** at `Curtn_Obsidian/MVP Features/Index.md` when feature status changes

### What to document
- What the feature does (user-facing behavior)
- Key technical decisions and tradeoffs
- Data model changes
- Which files were added/modified
- Status: `Planned`, `In Progress`, `Done`

### Where docs live
```
Curtn_Obsidian/
├── MVP Features/           # Per-feature docs + Index
│   ├── Index.md            # Master tracker with status table
│   ├── Feature N - Name.md # Individual feature docs
│   └── *.md                # Pattern docs, design principles
├── Old Ideas/              # Archived/superseded docs
├── Local Dev Setup.md      # How to run locally
└── Troubleshooting & Dev Workflow.md
```

### Obsidian path
```
/Users/peterfreeby/Documents/Founding Projects/Curtn/Curtn_Obsidian/
```

---

## 3. Codebase Quick Reference

### Monorepo layout
```
Curtn_Local/
├── packages/server/    # GraphQL API (Koa, graphql-helix, Mongoose, JWT)
├── packages/app/       # Next.js 15 frontend (App Router, Tailwind v4, urql)
├── packages/web/       # DEPRECATED — ignore
├── .env                # Shared env vars (not committed)
├── vercel.json         # Deployment config
└── CLAUDE.md           # This file
```

### Key paths
| What | Where |
|------|-------|
| GraphQL entities | `packages/server/src/entities/<name>/` |
| Entity pattern | `model.ts`, `types.ts`, `queries/queries.ts`, `mutations/<name>.ts` |
| Barrel exports | `mutations/<name>.ts` re-exports all mutations for that entity |
| Schema registration | `packages/server/src/schemas/query.ts` and `mutation.ts` |
| Frontend routes | `packages/app/src/app/(app)/` (with nav) and `(bare)/` (without) |
| GraphQL operations | `packages/app/src/lib/graphql/<domain>.ts` |
| Components | `packages/app/src/components/<domain>/` |
| Admin pages | `packages/app/src/app/(app)/admin/` |
| Auth | `packages/app/src/lib/auth/` |

### Adding a new entity (server)
1. Create `packages/server/src/entities/<name>/`
2. `<name>Model.ts` — Mongoose schema + `mongoose.models.x || mongoose.model(...)` pattern
3. `<name>Types.ts` — GraphQL type + `connectionDefinitions` + `entityRegister`
4. `queries/queries.ts` — query resolvers
5. `mutations/<name>.ts` — barrel file importing individual mutation files
6. Register in `schemas/query.ts` and `schemas/mutation.ts`

### Adding a new mutation (server)
1. Create `mutations/<mutationName>.ts` using `mutationWithClientMutationId`
2. Note: this generates **lowercase** input type names (e.g., `showUpdateInput`)
3. Add admin check if destructive: `const adminUser = await UserModel.findById(ctx.user.id); if (!adminUser?.isAdmin) return { error: 'Admin access required' }`
4. Export from the entity's barrel file
5. Add GraphQL operation in `packages/app/src/lib/graphql/admin.ts`

### Adding a frontend page
1. Create `packages/app/src/app/(app)/<route>/page.tsx`
2. Mark `"use client"` at top
3. Use `useQuery`/`useMutation` from urql
4. Import operations from `@/lib/graphql/<domain>`

### Common gotchas
- `parseInt("", 10)` returns `NaN` — always guard with `|| 0` or check for empty string
- `new Date("")` returns Invalid Date — check for empty before constructing
- GraphQL global IDs are base64: `atob(globalId).split(":")[1]` gets the MongoDB ObjectId
- Mongoose HMR: always use `mongoose.models.x || mongoose.model(...)` pattern
- Tailwind v4 uses `@tailwindcss/postcss` plugin, not v3-style `tailwind.config.js`
- `next build` clobbers the `.next` dev cache — restart dev server after building

---

## 4. Design System

### Colors
| Token | Hex | Use |
|-------|-----|-----|
| `curtn-deep` | #161316 | Page background |
| `curtn-surface` | #1E1B1E | Cards, elevated surfaces |
| `curtn-dark` | #393E41 | Borders, subtle backgrounds |
| `curtn-coral` | #FE5F55 | Primary accent, CTAs |
| `curtn-red` | #FE4134 | Hover/active states |
| `curtn-cream` | #F5F1E3 | Primary text |
| `curtn-muted` | #B5BBBF | Secondary text |

### Design principles
- **One coral CTA per screen** (Von Restorff)
- **Sub-400ms interactions**, skeleton screens, optimistic UI (Doherty Threshold)
- **Model after Letterboxd** where applicable (Jakob's Law)
- **Design for NYC live performance**, not generic events (Specificity)
- **Inner radius = outer radius - padding** (Nested Rounded Corners)
- See `Curtn_Obsidian/MVP Features/Design Principles.md` for the full list

### Icons
Phosphor icon font, 6 weights. `<Icon name="calendar" weight="regular" size={14} />` component at `src/components/icons/Icons.tsx`.

### Font
Neue Regrade Variable TTF via `next/font/local`.

---

## 5. Architectural Patterns

### Data hierarchy: Show → Run → Performance
- **Show**: the creative work (King Lear)
- **Run**: a specific production (Inwood Shakespeare Festival's King Lear)
- **Performance**: a single showing (June 15 at 7:30 PM)

### Matryoshka Display Pattern
The UI collapses layers when there's only one child:
- 1 run, 1 performance → combined page (Scenario A)
- 1 run, N performances → combined show+run + performance list (Scenario B)
- N runs → show info + run list (Scenario C)

See `Curtn_Obsidian/MVP Features/Matryoshka Display Pattern.md`

### Venue + Stage Pattern
Every venue has stages. Single-stage venues hide the default stage. Multi-stage venues show named stages. `isDefault` flag on Stage model.

### CSV Import Chain
`Show → Venue → Company → Run → Performance` with find-or-create at each step.

### Feed Import Pipeline
`DataSource → parseFeed() → PendingImport (staging) → approve/reject → promote to records`

---

## 6. Scripts & Commands

### Dev servers
```bash
# Start Next.js (frontend + API)
cd packages/app && npm run dev

# Start standalone GraphQL server (if needed)
cd packages/server && yarn dev
```

### Build & deploy
```bash
# Production build (runs on Vercel automatically)
cd packages/server && npm run build && cd ../app && npm run build
```

### Test GraphQL
```bash
# Health check
curl -s -X POST http://localhost:3000/api/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __schema { queryType { name } } }"}'

# Query with variables
curl -s -X POST http://localhost:3000/api/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ showList(first: 5) { edges { node { id title } } } }"}'
```

### Set admin flag
```bash
cd packages/server && node -e "
require('./src/env');
const mongoose = require('mongoose');
const { UserModel } = require('./src/entities/user/userModel');
mongoose.connect(process.env.MONGODB_URL).then(async () => {
  await UserModel.updateOne({ username: 'YOUR_USERNAME' }, { isAdmin: true });
  console.log('Done');
  process.exit(0);
});
"
```

### Kill stuck dev server
```bash
kill $(lsof -ti :3000) 2>/dev/null
```

### Decode a GraphQL global ID
```bash
echo "U2hvdzo2OWFiNWIxOWY3OTRjNzI3NzQyZGNkZWI=" | base64 -d
# → Show:69ab5b19f794c727742dcdeb
```

---

## 7. Current Status

See `Curtn_Obsidian/MVP Features/Index.md` for the full tracker.

**Completed:** Features 0-8, Feature 9 Phase A + B
**Current:** Feature 9 Phase C (Admin Audit Dashboard) — planned, not started

### Recent additions (Feature 9 Phase B)
- RSS/iCal feed subscriptions with PendingImport staging
- Feed parser with cleanup rules engine
- Data Sources management UI + Incoming Events review queue
- Admin data editor with inline edit, delete, merge
- Performance-level dedup in import pipelines
- Matryoshka display pattern on show/run detail pages
- Rate limiting + polite fetching on feed poller
