# Migration Examples

## Simple form schema

```ts
// BEFORE (Zod)
import { z } from 'zod'

const LoginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Too short'),
  rememberMe: z.boolean().optional(),
})

type Login = z.infer<typeof LoginSchema>

const result = LoginSchema.safeParse(formData)
if (result.success) {
  doLogin(result.data)
} else {
  const errors = result.error.flatten()
}

// AFTER (Valibot)
import * as v from 'valibot'

const LoginSchema = v.object({
  email: v.pipe(v.string(), v.email('Invalid email')),
  password: v.pipe(v.string(), v.minLength(8, 'Too short')),
  rememberMe: v.optional(v.boolean()),
})

type Login = v.InferOutput<typeof LoginSchema>

const result = v.safeParse(LoginSchema, formData)
if (result.success) {
  doLogin(result.output)
} else {
  const errors = v.flatten(result.issues)
}
```

## Enum migration (beware swapped names)

```ts
// BEFORE (Zod)
const RoleSchema = z.enum(['admin', 'user', 'guest'])
enum Direction { Left = 'LEFT', Right = 'RIGHT' }
const DirectionSchema = z.nativeEnum(Direction)

// AFTER (Valibot)
const RoleSchema = v.picklist(['admin', 'user', 'guest'])      // z.enum → v.picklist
const DirectionSchema = v.enum(Direction)                       // z.nativeEnum → v.enum
```

## Object variants

```ts
// BEFORE (Zod)
const StrictUser = z.object({ name: z.string() }).strict()
const LooseUser = z.object({ name: z.string() }).passthrough()
const CatchallUser = z.object({ name: z.string() }).catchall(z.unknown())

// AFTER (Valibot)
const StrictUser = v.strictObject({ name: v.string() })
const LooseUser = v.looseObject({ name: v.string() })
const CatchallUser = v.objectWithRest({ name: v.string() }, v.unknown())
```

## Object merge / extend

```ts
// BEFORE (Zod)
const Base = z.object({ id: z.string(), createdAt: z.date() })
const WithName = Base.extend({ name: z.string() })
const Merged = Base.merge(z.object({ extra: z.number() }))

// AFTER (Valibot)
const Base = v.object({ id: v.string(), createdAt: v.date() })
const WithName = v.object({ ...Base.entries, name: v.string() })
const Merged = v.object({ ...Base.entries, extra: v.number() })
```

## Discriminated union

```ts
// BEFORE (Zod)
const Shape = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('circle'), radius: z.number() }),
  z.object({ kind: z.literal('rect'), width: z.number(), height: z.number() }),
])

// AFTER (Valibot)
const Shape = v.variant('kind', [
  v.object({ kind: v.literal('circle'), radius: v.number() }),
  v.object({ kind: v.literal('rect'), width: v.number(), height: v.number() }),
])
```

## Transforms

```ts
// BEFORE (Zod)
const IdSchema = z.string().uuid().transform(s => s.toLowerCase())
const AgeSchema = z.coerce.number().int().positive()

// AFTER (Valibot)
const IdSchema = v.pipe(v.string(), v.uuid(), v.transform(s => s.toLowerCase()))
const AgeSchema = v.pipe(v.unknown(), v.transform(Number), v.integer(), v.gtValue(0))
// Safer: validate input is numeric string first
const SafeAgeSchema = v.pipe(v.string(), v.decimal(), v.transform(Number), v.integer(), v.gtValue(0))
```

## Refinements / custom validation

```ts
// BEFORE (Zod)
const PhoneSchema = z.string().refine(
  val => /^\+?[\d\s-]{10,}$/.test(val),
  'Invalid phone number'
)

// AFTER (Valibot)
const PhoneSchema = v.pipe(
  v.string(),
  v.check(val => /^\+?[\d\s-]{10,}$/.test(val), 'Invalid phone number')
)
```

## Cross-field validation

```ts
// BEFORE (Zod)
const RegisterSchema = z.object({
  password: z.string().min(8),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

// AFTER (Valibot)
const RegisterSchema = v.pipe(
  v.object({
    password: v.pipe(v.string(), v.minLength(8)),
    confirmPassword: v.string(),
  }),
  v.forward(
    v.partialCheck(
      [['password'], ['confirmPassword']],
      d => d.password === d.confirmPassword,
      'Passwords do not match'
    ),
    ['confirmPassword']
  )
)
```

## Default values

```ts
// BEFORE (Zod)
const ConfigSchema = z.object({
  timeout: z.number().default(5000),
  retries: z.number().default(3),
  tag: z.string().catch('fallback'),   // uses fallback on parse error
})

// AFTER (Valibot)
const ConfigSchema = v.object({
  timeout: v.optional(v.number(), 5000),
  retries: v.optional(v.number(), 3),
  tag: v.fallback(v.string(), 'fallback'),   // v.fallback = z.catch
})
```

## Recursive schemas

```ts
// BEFORE (Zod)
type Category = { name: string; children: Category[] }
const CategorySchema: z.ZodType<Category> = z.lazy(() =>
  z.object({ name: z.string(), children: z.array(CategorySchema) })
)

// AFTER (Valibot)
type Category = { name: string; children: Category[] }
const CategorySchema: v.GenericSchema<Category> = v.object({
  name: v.string(),
  children: v.array(v.lazy(() => CategorySchema)),
})
```

## Error flattening for forms

```ts
// BEFORE (Zod)
const result = Schema.safeParse(data)
if (!result.success) {
  const { fieldErrors, formErrors } = result.error.flatten()
  // fieldErrors.email = ['Invalid email']
}

// AFTER (Valibot)
const result = v.safeParse(Schema, data)
if (!result.success) {
  const flat = v.flatten(result.issues)
  // flat.nested['email'] = ['Invalid email']
  // flat.root = ['top-level errors']
}
```

## API route handler (common pattern)

```ts
// BEFORE (Zod)
const BodySchema = z.object({
  title: z.string().min(1).max(200),
  tags: z.array(z.string()).optional(),
})

app.post('/posts', async (req, res) => {
  const parsed = BodySchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.flatten().fieldErrors })
  }
  await createPost(parsed.data)
})

// AFTER (Valibot)
const BodySchema = v.object({
  title: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  tags: v.optional(v.array(v.string())),
})

app.post('/posts', async (req, res) => {
  const parsed = v.safeParse(BodySchema, req.body)
  if (!parsed.success) {
    return res.status(400).json({ errors: v.flatten(parsed.issues).nested })
  }
  await createPost(parsed.output)
})
```

## Branded types

```ts
// BEFORE (Zod)
const UserId = z.string().uuid().brand<'UserId'>()
type UserId = z.infer<typeof UserId>

// AFTER (Valibot)
const UserId = v.pipe(v.string(), v.uuid(), v.brand('UserId'))
type UserId = v.InferOutput<typeof UserId>
```
