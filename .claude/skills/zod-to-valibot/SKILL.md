---
name: zod-to-valibot
description: Migrates TypeScript/JavaScript code from Zod to Valibot validation library. Use when asked to migrate, convert, or port Zod schemas to Valibot, when replacing Zod with Valibot, or when user mentions "zod-to-valibot", "replace zod", or "valibot migration". Works across any repository.
---

# Zod to Valibot Migration

## Mental model shift (read this first)

Zod uses **method chaining** on schema objects. Valibot uses **function composition** via `pipe()`.

```ts
// Zod
z.string().email().min(5)

// Valibot
v.pipe(v.string(), v.email(), v.minLength(5))
```

Every Zod method becomes either a standalone schema function or a `pipe()` action. The schema is always the first argument to utility methods (`v.parse(schema, data)` not `schema.parse(data)`).

## Migration workflow

1. **Install Valibot** — `npm install valibot` (remove `zod` when done)
2. **Find all Zod usage** — `grep -r "from 'zod'" src/` and `grep -r "from \"zod\"" src/`
3. **Migrate file by file** — change import, then convert schemas (see [REFERENCE.md](REFERENCE.md))
4. **Update parse call sites** — `schema.parse(data)` → `v.parse(schema, data)`
5. **Update type inference** — `z.infer<typeof S>` → `v.InferOutput<typeof S>`
6. **Run tests** after each file

## Key gotchas

| Zod | Valibot | Trap |
|-----|---------|------|
| `z.enum(['a','b'])` | `v.picklist(['a','b'])` | Names swapped! |
| `z.nativeEnum(Enum)` | `v.enum(Enum)` | Names swapped! |
| `z.object({}).strict()` | `v.strictObject({})` | Method → function |
| `z.object({}).passthrough()` | `v.looseObject({})` | Method → function |
| `z.object({}).merge(other)` | `v.object({...a.entries,...b.entries})` | Spread entries |
| `z.string().default('x')` | `v.optional(v.string(), 'x')` | No `.default()` method |
| `z.coerce.number()` | `v.pipe(v.unknown(), v.transform(Number))` | Explicit coercion |
| `z.discriminatedUnion(k,[])` | `v.variant(k, [])` | Different name |
| `ZodError.flatten()` | `v.flatten(result.issues)` | Standalone function |

## Import change

```ts
// Before
import { z } from 'zod'

// After
import * as v from 'valibot'
```

## Quick reference

See [REFERENCE.md](REFERENCE.md) for the full API mapping table.
See [EXAMPLES.md](EXAMPLES.md) for complete before/after migration examples.
