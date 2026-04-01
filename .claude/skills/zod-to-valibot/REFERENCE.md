# Zod → Valibot API Reference

## Primitives

| Zod | Valibot |
|-----|---------|
| `z.string()` | `v.string()` |
| `z.number()` | `v.number()` |
| `z.boolean()` | `v.boolean()` |
| `z.bigint()` | `v.bigint()` |
| `z.symbol()` | `v.symbol()` |
| `z.date()` | `v.date()` |
| `z.null()` | `v.null()` |
| `z.undefined()` | `v.undefined()` |
| `z.nan()` | `v.nan()` |
| `z.any()` | `v.any()` |
| `z.unknown()` | `v.unknown()` |
| `z.never()` | `v.never()` |
| `z.void()` | `v.void()` |
| `z.literal(val)` | `v.literal(val)` |

## String validators (all go inside `pipe()`)

| Zod | Valibot |
|-----|---------|
| `z.string().min(n)` | `v.pipe(v.string(), v.minLength(n))` |
| `z.string().max(n)` | `v.pipe(v.string(), v.maxLength(n))` |
| `z.string().length(n)` | `v.pipe(v.string(), v.length(n))` |
| `z.string().email()` | `v.pipe(v.string(), v.email())` |
| `z.string().url()` | `v.pipe(v.string(), v.url())` |
| `z.string().uuid()` | `v.pipe(v.string(), v.uuid())` |
| `z.string().regex(r)` | `v.pipe(v.string(), v.regex(r))` |
| `z.string().trim()` | `v.pipe(v.string(), v.trim())` |
| `z.string().toLowerCase()` | `v.pipe(v.string(), v.toLowerCase())` |
| `z.string().toUpperCase()` | `v.pipe(v.string(), v.toUpperCase())` |
| `z.string().startsWith(s)` | `v.pipe(v.string(), v.startsWith(s))` |
| `z.string().endsWith(s)` | `v.pipe(v.string(), v.endsWith(s))` |
| `z.string().includes(s)` | `v.pipe(v.string(), v.includes(s))` |
| `z.string().nonempty()` | `v.pipe(v.string(), v.nonEmpty())` |
| `z.string().ip()` | `v.pipe(v.string(), v.ip())` |
| `z.string().datetime()` | `v.pipe(v.string(), v.isoDateTime())` |

## Number validators

| Zod | Valibot |
|-----|---------|
| `z.number().int()` | `v.pipe(v.number(), v.integer())` |
| `z.number().min(n)` / `.gte(n)` | `v.pipe(v.number(), v.minValue(n))` |
| `z.number().max(n)` / `.lte(n)` | `v.pipe(v.number(), v.maxValue(n))` |
| `z.number().gt(n)` | `v.pipe(v.number(), v.gtValue(n))` |
| `z.number().lt(n)` | `v.pipe(v.number(), v.ltValue(n))` |
| `z.number().positive()` | `v.pipe(v.number(), v.gtValue(0))` |
| `z.number().negative()` | `v.pipe(v.number(), v.ltValue(0))` |
| `z.number().nonnegative()` | `v.pipe(v.number(), v.minValue(0))` |
| `z.number().multipleOf(n)` | `v.pipe(v.number(), v.multipleOf(n))` |
| `z.number().finite()` | `v.pipe(v.number(), v.finite())` |

## Enums (names are SWAPPED — this is the #1 trap)

| Zod | Valibot |
|-----|---------|
| `z.enum(['a', 'b'])` | `v.picklist(['a', 'b'])` |
| `z.nativeEnum(MyEnum)` | `v.enum(MyEnum)` |

## Objects

| Zod | Valibot |
|-----|---------|
| `z.object({...})` | `v.object({...})` — strips unknown keys |
| `z.object({}).strict()` | `v.strictObject({...})` |
| `z.object({}).passthrough()` | `v.looseObject({...})` |
| `z.object({}).catchall(s)` | `v.objectWithRest({...}, s)` |
| `z.object({}).pick({k:true})` | `v.pick(schema, ['k'])` |
| `z.object({}).omit({k:true})` | `v.omit(schema, ['k'])` |
| `z.object({}).partial()` | `v.partial(schema)` |
| `z.object({}).required()` | `v.required(schema)` |
| `z.object({}).merge(other)` | `v.object({...a.entries, ...b.entries})` |
| `z.object({}).extend({...})` | `v.object({...schema.entries, ...newFields})` |
| `z.record(k, v)` | `v.record(k, v)` |

Cross-field validation on objects:
```ts
// Zod
z.object({ pw1: z.string(), pw2: z.string() })
  .refine(d => d.pw1 === d.pw2, { message: 'No match', path: ['pw2'] })

// Valibot
v.pipe(
  v.object({ pw1: v.string(), pw2: v.string() }),
  v.forward(
    v.partialCheck([['pw1'], ['pw2']], d => d.pw1 === d.pw2, 'No match'),
    ['pw2']
  )
)
```

## Arrays & tuples

| Zod | Valibot |
|-----|---------|
| `z.array(s)` | `v.array(s)` |
| `z.array(s).min(n)` | `v.pipe(v.array(s), v.minLength(n))` |
| `z.array(s).max(n)` | `v.pipe(v.array(s), v.maxLength(n))` |
| `z.array(s).nonempty()` | `v.pipe(v.array(s), v.nonEmpty())` |
| `z.tuple([...])` | `v.tuple([...])` |
| `z.tuple([...]).rest(s)` | `v.tupleWithRest([...], s)` |
| `z.set(s)` | `v.set(s)` |
| `z.map(k, v)` | `v.map(k, v)` |

## Optional / Nullable / Nullish

| Zod | Valibot |
|-----|---------|
| `z.string().optional()` | `v.optional(v.string())` |
| `z.string().nullable()` | `v.nullable(v.string())` |
| `z.string().nullish()` | `v.nullish(v.string())` |
| `z.string().default('x')` | `v.optional(v.string(), 'x')` |
| `z.string().default(() => x)` | `v.optional(v.string(), () => x)` |
| `z.string().catch('x')` | `v.fallback(v.string(), 'x')` |

## Unions & intersections

| Zod | Valibot |
|-----|---------|
| `z.union([a, b])` | `v.union([a, b])` |
| `a.or(b)` | `v.union([a, b])` |
| `z.discriminatedUnion(k, [...])` | `v.variant(k, [...])` |
| `z.intersection(a, b)` | `v.intersect([a, b])` |
| `a.and(b)` | `v.intersect([a, b])` |

For object intersections, prefer spreading entries over `v.intersect()`:
```ts
v.object({ ...SchemaA.entries, ...SchemaB.entries })
```

## Transforms, coercions & refinements

| Zod | Valibot |
|-----|---------|
| `z.string().transform(fn)` | `v.pipe(v.string(), v.transform(fn))` |
| `z.string().refine(fn, msg)` | `v.pipe(v.string(), v.check(fn, msg))` |
| `z.string().superRefine(fn)` | `v.pipe(v.string(), v.rawCheck(fn))` |
| `z.coerce.string()` | `v.pipe(v.unknown(), v.transform(String))` |
| `z.coerce.number()` | `v.pipe(v.unknown(), v.transform(Number))` |
| `z.coerce.boolean()` | `v.pipe(v.unknown(), v.transform(Boolean))` |
| `z.coerce.date()` | `v.pipe(v.unknown(), v.transform(d => new Date(d)))` |
| `z.custom<T>(fn)` | `v.custom<T>(fn)` |
| `z.instanceof(Class)` | `v.instance(Class)` |

## Special schemas

| Zod | Valibot |
|-----|---------|
| `z.lazy(() => s)` | `v.lazy(() => s)` |
| `s.brand<'Name'>()` | `v.pipe(s, v.brand('Name'))` |
| `z.preprocess(fn, s)` | `v.pipe(v.unknown(), v.transform(fn), s)` |

## Parsing

| Zod | Valibot |
|-----|---------|
| `schema.parse(data)` | `v.parse(schema, data)` |
| `schema.safeParse(data)` | `v.safeParse(schema, data)` |
| `result.data` | `result.output` |
| `result.error` | `result.issues` |
| `ZodError.flatten()` | `v.flatten(result.issues)` |
| `schema.parseAsync(data)` | `v.parseAsync(schema, data)` |
| `schema.safeParseAsync(data)` | `v.safeParseAsync(schema, data)` |

## Type inference

| Zod | Valibot |
|-----|---------|
| `z.infer<typeof S>` | `v.InferOutput<typeof S>` |
| `z.input<typeof S>` | `v.InferInput<typeof S>` |

## Error messages

Zod accepts `{ message, required_error, invalid_type_error }` — Valibot takes **a single string** per action:

```ts
// Zod
z.string({ required_error: 'Required', invalid_type_error: 'Must be string' })

// Valibot — one message per schema/action
v.string('Must be a string')
v.pipe(v.string(), v.minLength(1, 'Required'))
```
