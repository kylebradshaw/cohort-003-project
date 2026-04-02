# Plan: Instructor Analytics Dashboard

> Source PRD: `.claude/prd/instructor-analytics-dashboard.md`

## Architectural decisions

- **Routes**: `/instructor/courses/analytics` (cross-course) and `/instructor/$courseId/analytics` (per-course); both accessible to the owning instructor or any admin
- **Schema**: No new tables or migrations required — all analytics data lives in existing `purchases`, `enrollments`, `lessonProgress`, `videoWatchEvents`, `quizAttempts`, and `quizAnswers` tables
- **Key models**: All monetary values stored and computed in cents; formatted to dollars only at render time. ISO 3166-1 alpha-2 country codes in `purchases.country`; displayed as human-readable names in UI
- **Time range filtering**: `range` search param (`7d`, `30d`, `90d`, `all`); loaders translate to a `since` date before passing to service functions; default is `30d`
- **Analytics service**: All query logic lives in `analyticsService.ts` with a companion `analyticsService.test.ts`; no query logic in route loaders
- **Charting**: Recharts (via shadcn chart primitives) — not yet installed; added in Phase 2
- **Authorization**: Instructor routes check session + user role via existing session/auth utilities; admins can view any instructor's data; unauthorized access throws 403

---

## Phase 1: Analytics Service Foundation

**User stories**: 1, 2, 3, 4, 5, 6

### What to build

Create `analyticsService.ts` and its companion test file. No UI is built in this phase — the goal is a fully tested, read-only query layer that every subsequent phase will depend on.

The service exposes functions for:
- Revenue grouped by day/week/month over a time range, filterable by instructorId and/or courseId
- Revenue broken down by country, filterable by instructorId and/or courseId
- Enrollment counts over time, filterable by instructorId and/or courseId
- Per-course summary (total revenue, total enrollments, completion rate) for a given instructor

Time range is passed as a `since: Date | null` argument; `null` means all time. Grouping granularity (day/week/month) is determined by the range inside the service.

Tests seed an in-memory SQLite database with known purchases, enrollments, and lesson progress records and assert exact return values. Edge cases — zero enrollments, no purchases, all students completing, sparse data at range boundaries — must all be covered.

### Acceptance criteria

- [ ] `analyticsService.ts` is created with all four function groups above
- [ ] Every exported function has tests in `analyticsService.test.ts`
- [ ] Edge cases covered: empty dataset, single record, time range boundary conditions, `null` (all-time) range
- [ ] All functions accept an options object (no multiple positional params of the same type)
- [ ] `npm test` passes with 100% coverage on `analyticsService.ts`

---

## Phase 2: Cross-Course Analytics Dashboard

**User stories**: 1, 2, 3, 4, 5, 6, 7, 17, 18, 19, 21

### What to build

Add Recharts (via the shadcn chart integration). Build the `/instructor/courses/analytics` route end-to-end.

The loader reads the `range` search param, calls `analyticsService` for revenue series, enrollment series, per-course summaries, and revenue by country, and returns all four datasets. Instructors see only their own courses; admins see all instructors and get an additional instructor filter dropdown populated from all instructor accounts.

The page renders:
- `TimeRangeSelector` — shared control that updates the `range` search param
- `RevenueChart` — time-series chart of revenue over the selected range
- `EnrollmentChart` — time-series chart of enrollments over the selected range
- Per-course summary table — revenue total, enrollment total, completion rate, with a link to that course's analytics page
- `CountryRevenueTable` — sortable table of country, revenue, purchase count

A link to this page is added to the instructor dashboard so instructors can find it without knowing the URL.

### Acceptance criteria

- [ ] Recharts installed and a basic shadcn chart primitive renders without errors
- [ ] `/instructor/courses/analytics` route exists and is protected (non-instructors get 403)
- [ ] Loader returns `revenueSeries`, `enrollmentSeries`, `courseSummaries`, `revenueByCountry`, `selectedRange`
- [ ] `TimeRangeSelector` updates the page data when a range is chosen; defaults to `30d`
- [ ] `RevenueChart` and `EnrollmentChart` render the time-series data
- [ ] Per-course summary table links each row to `/instructor/$courseId/analytics`
- [ ] `CountryRevenueTable` displays human-readable country names (not raw ISO codes)
- [ ] Admins can see all instructors' data and filter by instructor
- [ ] Navigation link from the instructor dashboard index to this page

---

## Phase 3: Per-Course Analytics — Service Layer & Route

**User stories**: 8, 9, 10, 11, 15, 16, 17, 20, 22

### What to build

Extend `analyticsService.ts` with all per-course query functions (and full tests for each):
- **Course completion rate**: distinct students who have a `completed` `lessonProgress` record for every lesson in the course, divided by total enrolled students
- **Lesson drop-off**: for each lesson in position order, the count of distinct students with a `completed` progress record divided by total enrolled students
- **Video abandonment**: for each lesson, the median stop position in seconds and a bucket distribution of stop positions, sourced from `videoWatchEvents` where `eventType` is `pause` or `ended`

Build the `/instructor/$courseId/analytics` route. The loader calls `analyticsService` for all of the above plus revenue series, enrollment series, and revenue by country (scoped to the course). The page shares the `TimeRangeSelector` from Phase 2 and renders:
- Overall completion rate as a stat
- `LessonDropoffChart` — horizontal bar or funnel chart in lesson-position order, showing per-lesson completion percentage, with the highest-abandonment lesson called out
- `VideoAbandonmentChart` — histogram of stop-position buckets per lesson; lessons with no watch events are omitted
- Revenue trend, enrollment trend, and country revenue (reusing Phase 2 components)

Admins can view this page for any course; instructors can only view their own courses.

### Acceptance criteria

- [ ] Completion rate, lesson drop-off, and video abandonment functions added to `analyticsService.ts` with tests, including edge cases (zero enrollments, all students complete, no watch events, sparse event data)
- [ ] `/instructor/$courseId/analytics` route exists and is protected; admins bypass ownership check
- [ ] Loader returns completion rate, `lessonDropoff` array in position order, `videoAbandonment` array, plus revenue/enrollment/country data scoped to the course
- [ ] `LessonDropoffChart` renders lessons in correct order; highest-abandonment lesson is highlighted
- [ ] `VideoAbandonmentChart` renders per-lesson histograms; lessons with no data are omitted
- [ ] `TimeRangeSelector` applies to revenue and enrollment series on this page
- [ ] `npm test` passes with 100% coverage on new `analyticsService` functions

---

## Phase 4: Quiz Analytics

**User stories**: 12, 13, 14

### What to build

Extend `analyticsService.ts` with quiz analytics queries (and tests):
- Per-quiz pass rate: `passed` attempt count / total attempt count, filterable by courseId
- Per-quiz attempt count
- Per-question correct rate: `quizAnswers` where the selected option `isCorrect = true` / total answers for that question

Add `QuizPassRateTable` to the per-course analytics page — a table of quizzes showing pass rate and attempt count, with each row expandable to show per-question correct rates.

Tests must cover: no attempts, 100% pass rate, 0% pass rate, mixed question performance, and quizzes with no questions.

### Acceptance criteria

- [ ] Quiz analytics functions added to `analyticsService.ts` with tests covering all edge cases
- [ ] `quizStats` array included in the `/instructor/$courseId/analytics` loader response
- [ ] `QuizPassRateTable` renders each quiz with pass rate and attempt count
- [ ] Each quiz row is expandable to reveal per-question correct rates
- [ ] Quizzes with zero attempts display clearly (not as 0% pass rate)
- [ ] `npm test` passes with 100% coverage on new `analyticsService` functions

<!--

SANS /prd-to-plan APPROACH

# Instructor Analytics Dashboard — Implementation Plan

Source PRD: `prd/instructor-analytics-dashboard.md`
Created: 2026-04-02

---

## Overview

Build a two-level analytics experience for instructors:
- `/instructor/courses/analytics` — cross-course overview (revenue, enrollment, per-course table)
- `/instructor/$courseId/analytics` — single-course deep-dive (lesson drop-off, video abandonment, quiz stats, revenue by country)

Work is broken into five phases: service layer + tests, shared UI components, cross-course route, per-course route, and admin access + polish.

---

## Phase 1: Analytics Service + Tests

**Goal:** All analytics query logic lives in one testable service before any UI is built.

### Tasks

- [ ] Create `app/services/analyticsService.ts`
- [ ] Create `app/services/analyticsService.test.ts` with 100% coverage

### Service functions to implement

All functions that accept multiple string/number params of the same type must use an object parameter per CLAUDE.md convention.

```ts
// Revenue
getRevenueSeries(opts: { instructorId?: number; courseId?: number; since?: Date }): { date: string; amountCents: number }[]
getRevenueByCountry(opts: { instructorId?: number; courseId?: number; since?: Date }): { country: string; amountCents: number; purchases: number }[]

// Enrollment
getEnrollmentSeries(opts: { instructorId?: number; courseId?: number; since?: Date }): { date: string; count: number }[]

// Cross-course summary
getCourseSummaries(opts: { instructorId: number; since?: Date }): { courseId: number; title: string; totalRevenueCents: number; totalEnrollments: number; completionRate: number }[]

// Course-level
getCourseCompletionRate(opts: { courseId: number }): number
getLessonDropoff(opts: { courseId: number }): { lessonId: number; title: string; position: number; completedCount: number; enrolledCount: number }[]
getVideoAbandonment(opts: { courseId: number }): { lessonId: number; title: string; medianStopSeconds: number; buckets: { secondsBucket: number; count: number }[] }[]
getQuizStats(opts: { courseId: number }): { quizId: number; title: string; passRate: number; attemptCount: number; questions: { questionId: number; text: string; correctRate: number }[] }[]
```

### Test coverage requirements

Seed a SQLite test database (pattern: `createTestDb()` + `seedBaseData()` in `app/test/`). Cover:

- Typical case: multiple purchases, enrollments, completions
- Zero enrollments (empty arrays, not crashes)
- No purchases (revenue = 0)
- All students completing a course (completionRate = 1.0)
- No quiz attempts
- `since` date filter correctly excludes older records
- Country grouping (multiple purchases from same country)
- Lesson drop-off ordering by lesson position
- Video abandonment bucket calculation
- Quiz pass rate per question

### Key schema relationships

| Needed metric | Source table(s) |
|---|---|
| Revenue | `purchases.pricePaid`, `purchases.country`, `purchases.createdAt` |
| Enrollments | `enrollments.enrolledAt`, `enrollments.completedAt` |
| Lesson drop-off | `lesson_progress` (status=Completed) ÷ total enrollments, ordered by `lessons.position` |
| Video abandonment | `video_watch_events.positionSeconds` where eventType in (pause, ended) |
| Quiz pass rate | `quiz_attempts.passed` ÷ total attempts per quiz |
| Quiz question rate | `quiz_answers` where selectedOption `isCorrect=true` ÷ total answers per question |

### Time-range helper

```ts
function sinceDate(range: "7d" | "30d" | "90d" | "all"): Date | undefined
```

Returns a `Date` for `7d`/`30d`/`90d`, returns `undefined` for `"all"` (no filter applied).

---

## Phase 2: Shared UI Components

**Goal:** Build all reusable chart and control components before wiring them to routes.

### Tasks

- [ ] Install recharts: `pnpm add recharts`
- [ ] Add shadcn chart primitives if not present (wraps Recharts with theme tokens)
- [ ] Create `app/components/TimeRangeSelector.tsx`
- [ ] Create `app/components/RevenueChart.tsx`
- [ ] Create `app/components/EnrollmentChart.tsx`
- [ ] Create `app/components/CountryRevenueTable.tsx`
- [ ] Create `app/components/LessonDropoffChart.tsx`
- [ ] Create `app/components/VideoAbandonmentChart.tsx`
- [ ] Create `app/components/QuizPassRateTable.tsx`

### Component specs

**`TimeRangeSelector`**
- Renders a segmented control or tab strip: `7d | 30d | 90d | All time`
- Default selection: `30d`
- On change: updates `?range=` search param via React Router `<Form>` or `useNavigate`
- Accepts `selectedRange: "7d" | "30d" | "90d" | "all"` prop

**`RevenueChart`**
- Recharts `AreaChart` or `BarChart`, time-series
- Props: `data: { date: string; amountCents: number }[]`
- Renders dollar values (cents ÷ 100), formatted as currency

**`EnrollmentChart`**
- Same shape as `RevenueChart` but renders enrollment counts
- Props: `data: { date: string; count: number }[]`

**`CountryRevenueTable`**
- Sortable table (shadcn table primitives)
- Columns: Country name, Revenue, Purchases
- ISO 3166-1 alpha-2 → human-readable name mapping
- Props: `data: { country: string; amountCents: number; purchases: number }[]`

**`LessonDropoffChart`**
- Horizontal bar chart (Recharts `BarChart` with `layout="vertical"`)
- X-axis: completion % (completedCount ÷ enrolledCount × 100)
- Y-axis: lesson titles in position order
- Props: `data: { lessonId: number; title: string; position: number; completedCount: number; enrolledCount: number }[]`

**`VideoAbandonmentChart`**
- Histogram (Recharts `BarChart`)
- X-axis: time buckets in seconds, Y-axis: count of stop events
- Props: `lessonTitle: string; medianStopSeconds: number; buckets: { secondsBucket: number; count: number }[]`

**`QuizPassRateTable`**
- Table with expandable rows (shadcn `Collapsible`)
- Top level: quiz title, pass rate %, attempt count
- Expanded: per-question correctRate as a progress bar
- Props: `data: QuizStats[]` (shape from Phase 1)

---

## Phase 3: Cross-Course Analytics Route

**Goal:** `/instructor/courses/analytics` loads and renders cross-course data.

### Tasks

- [ ] Register route in `app/routes.ts`:
  ```ts
  route("instructor/courses/analytics", "routes/instructor.courses.analytics.tsx")
  ```
- [ ] Create `app/routes/instructor.courses.analytics.tsx`
- [ ] Implement loader
- [ ] Implement page component
- [ ] Add "Analytics" nav link on existing instructor dashboard

### Loader

```ts
export async function loader({ request }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);
  // auth: must be Instructor or Admin
  // parse ?range= param, default "30d"
  const since = sinceDate(range);
  const instructorId = user.role === "Admin" ? adminFilterId ?? undefined : user.id;

  return {
    revenueSeries: getRevenueSeries({ instructorId, since }),
    enrollmentSeries: getEnrollmentSeries({ instructorId, since }),
    courseSummaries: getCourseSummaries({ instructorId: instructorId!, since }),
    revenueByCountry: getRevenueByCountry({ instructorId, since }),
    selectedRange: range,
    // Admin only:
    allInstructors: user.role === "Admin" ? getAllInstructors() : null,
  };
}
```

### Page layout

```
[ Time Range Selector                    ]
[ Revenue Chart          | Enrollment Chart ]
[ Revenue by Country Table               ]
[ Course Summaries Table (link → /instructor/$id/analytics) ]
```

### Course summaries table columns

| Course | Revenue | Enrollments | Completion Rate | Link |
|---|---|---|---|---|
| title | $X,XXX | 123 | 64% | → per-course analytics |

---

## Phase 4: Per-Course Analytics Route

**Goal:** `/instructor/$courseId/analytics` loads and renders single-course deep-dive data.

### Tasks

- [ ] Register route in `app/routes.ts`:
  ```ts
  route("instructor/:courseId/analytics", "routes/instructor.$courseId.analytics.tsx")
  ```
- [ ] Create `app/routes/instructor.$courseId.analytics.tsx`
- [ ] Implement loader
- [ ] Implement page component
- [ ] Add "Analytics" link on existing per-course instructor page (`instructor.$courseId.tsx`)

### Loader

```ts
export async function loader({ params, request }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);
  // auth: must be course's instructor OR Admin
  // parse ?range= param, default "30d"
  const courseId = parseInt(params.courseId, 10);
  const since = sinceDate(range);

  return {
    course: getCourseById(courseId),
    revenueSeries: getRevenueSeries({ courseId, since }),
    enrollmentSeries: getEnrollmentSeries({ courseId, since }),
    revenueByCountry: getRevenueByCountry({ courseId, since }),
    lessonDropoff: getLessonDropoff({ courseId }),
    videoAbandonment: getVideoAbandonment({ courseId }),
    quizStats: getQuizStats({ courseId }),
    selectedRange: range,
  };
}
```

### Page layout

```
[ Course title + breadcrumb → /instructor/courses/analytics ]
[ Time Range Selector                         ]
[ Revenue Chart          | Enrollment Chart   ]
[ Revenue by Country Table                    ]
[ Lesson Drop-off Chart                       ]
[ Video Abandonment — accordion per lesson    ]
[ Quiz Pass Rate Table — expandable per quiz  ]
```

---

## Phase 5: Admin Access + Navigation + Polish

**Goal:** Admin views, navigation wiring, and empty-state handling.

### Tasks

- [ ] Admin cross-course view: add instructor filter `<Select>` populated from `allInstructors`; changing selection updates `?instructorId=` search param
- [ ] Admin per-course view: no extra UI needed — loader already accepts any courseId
- [ ] Add "Analytics" link to instructor sidebar / dashboard index
- [ ] Add "Analytics" button on `instructor.$courseId.tsx` course header
- [ ] Empty states: zero-data variants for all charts and tables (e.g. "No purchases yet", "No enrollments in this period")
- [ ] Loading skeletons using shadcn `Skeleton` for all data sections
- [ ] Responsive layout: stack charts vertically on mobile
- [ ] Currency formatting: use `Intl.NumberFormat` with currency display

### Admin filter (cross-course page only)

```
[ Instructor: [ All Instructors ▼ ]  Time Range: [ 30d ▼ ] ]
```

When "All Instructors" selected: `instructorId` param absent → aggregate across all.

---

## Dependency Notes

- Recharts must be installed before Phase 2 components can be built
- Phase 3 and Phase 4 both depend on Phase 1 (service) and Phase 2 (components)
- Phase 5 depends on Phases 3 and 4 being complete
- No database migrations required — all queries are read-only against existing tables

## Files to Create

| File | Phase |
|---|---|
| `app/services/analyticsService.ts` | 1 |
| `app/services/analyticsService.test.ts` | 1 |
| `app/components/TimeRangeSelector.tsx` | 2 |
| `app/components/RevenueChart.tsx` | 2 |
| `app/components/EnrollmentChart.tsx` | 2 |
| `app/components/CountryRevenueTable.tsx` | 2 |
| `app/components/LessonDropoffChart.tsx` | 2 |
| `app/components/VideoAbandonmentChart.tsx` | 2 |
| `app/components/QuizPassRateTable.tsx` | 2 |
| `app/routes/instructor.courses.analytics.tsx` | 3 |
| `app/routes/instructor.$courseId.analytics.tsx` | 4 |

## Files to Modify

| File | Change | Phase |
|---|---|---|
| `app/routes.ts` | Register two new routes | 3 + 4 |
| `app/routes/instructor.index.tsx` (or dashboard) | Add Analytics nav link | 5 |
| `app/routes/instructor.$courseId.tsx` | Add Analytics button | 5 |

-->
