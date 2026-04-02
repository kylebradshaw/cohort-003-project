## Problem Statement

Instructors on Cadence have no visibility into how their courses are actually performing. They can see a raw enrollment count and a student roster, but they cannot answer basic business questions: Is revenue growing? Which courses convert best? Are students actually finishing what they start? Which lessons cause students to quit? Which quiz questions are too hard or too easy? Without this data, instructors are flying blind and cannot improve their content or their business.

## Solution

Build a two-level analytics experience for instructors:

1. **Cross-course analytics** at `/instructor/courses/analytics` — an at-a-glance view of total revenue trends, enrollment growth, and per-course performance comparisons across all of an instructor's courses.
2. **Per-course analytics** at `/instructor/$courseId/analytics` — a deep-dive into a single course covering enrollment funnel, lesson-by-lesson drop-off, video abandonment, quiz pass rates (by quiz and by question), and revenue broken down by time period and country.

Admins can view the same pages for any instructor, seeing analytics across all instructors on the platform.

## User Stories

1. As an instructor, I want to see total revenue across all my courses over time, so that I can understand whether my business is growing or declining.
2. As an instructor, I want to see revenue broken down by time range (last 7 days, 30 days, 90 days, all time), so that I can identify seasonal trends or the impact of promotions.
3. As an instructor, I want to see revenue broken down by country, so that I can understand which regions are buying my courses and whether PPP pricing is working.
4. As an instructor, I want to see total enrollment numbers across all my courses, so that I can gauge overall reach.
5. As an instructor, I want to see enrollment numbers over time, so that I can see whether my marketing efforts are paying off.
6. As an instructor, I want to see a per-course breakdown of revenue and enrollments on the cross-course analytics page, so that I can compare which courses are performing best.
7. As an instructor, I want to navigate from the cross-course analytics page to a specific course's analytics page, so that I can drill down into underperforming courses.
8. As an instructor, I want to see the overall completion rate for a specific course, so that I can understand whether students are finishing what they start.
9. As an instructor, I want to see a lesson-by-lesson drop-off chart for a course, so that I can identify exactly which lesson causes the most students to stop progressing.
10. As an instructor, I want to see which lesson has the highest abandonment rate, so that I can prioritise improving that content first.
11. As an instructor, I want to see video abandonment data per lesson (where in the video students stop watching), so that I can identify which parts of my videos lose students' attention.
12. As an instructor, I want to see the overall quiz pass rate for each quiz in a course, so that I can identify quizzes that are too difficult or too easy.
13. As an instructor, I want to see the pass rate per question within a quiz, so that I can identify specific concepts students are struggling with.
14. As an instructor, I want to see the number of attempts per quiz, so that I can understand how many students are retrying failed quizzes.
15. As an instructor, I want to see revenue trends for a specific course over time, so that I can understand that course's sales trajectory.
16. As an instructor, I want to see a course's revenue broken down by country, so that I can see how international students are purchasing it.
17. As an instructor, I want to filter all analytics views by time range (last 7 days, 30 days, 90 days, all time), so that I can compare different periods.
18. As an instructor, I want the analytics pages to be linked from my instructor dashboard, so that I can find them without memorising the URL.
19. As an admin, I want to view the cross-course analytics page for any instructor, so that I can monitor platform-wide performance.
20. As an admin, I want to view the per-course analytics page for any course on the platform, so that I can investigate specific courses.
21. As an admin, I want to see aggregate revenue and enrollment metrics across all instructors, so that I can understand overall platform health.
22. As a student, I want my lesson progress and quiz attempts to continue being tracked accurately, so that instructor analytics remain reliable.

## Implementation Decisions

### Modules to build or modify

**New: `analyticsService.ts`**
All analytics query logic lives here. This service will expose functions for:
- Revenue over time (grouped by day/week/month depending on range), filterable by instructorId and/or courseId
- Revenue by country, filterable by instructorId and/or courseId
- Enrollment counts over time, filterable by instructorId and/or courseId
- Per-course summary (revenue total, enrollment total, completion rate) for a given instructor
- Course completion rate (students who have completed every lesson / total enrolled students)
- Lesson drop-off data: for each lesson in a course, the count of students who completed it vs. who were enrolled
- Video abandonment data: median and distribution of watch-stop positions per lesson, sourced from `videoWatchEvents`
- Quiz pass rate per quiz (pass count / total attempts), filterable by courseId
- Quiz pass rate per question (correct answer count / total answers for that question)
- Quiz attempt count per quiz

**New: `/instructor/courses/analytics` route**
- Accessible to instructors (sees own courses) and admins (sees all instructors, with an optional instructor filter)
- Loads data via `analyticsService`: cross-course revenue trend, enrollment trend, per-course summary table
- Time range selector (7d / 30d / 90d / all time) that re-filters the loader data via a search param

**New: `/instructor/$courseId/analytics` route**
- Accessible to the course's instructor or any admin
- Loads data via `analyticsService`: course revenue trend, revenue by country, enrollment trend, lesson drop-off, video abandonment per lesson, quiz pass rates (by quiz and by question), quiz attempt counts
- Same time range selector as above

**New: Analytics UI components**
- `RevenueChart` — time-series line/bar chart for revenue over time (shadcn chart primitives / Recharts)
- `EnrollmentChart` — time-series chart for enrollment counts
- `LessonDropoffChart` — horizontal bar or funnel chart showing per-lesson completion counts in lesson order
- `VideoAbandonmentChart` — histogram of watch-stop positions for a lesson
- `QuizPassRateTable` — table of quizzes with pass rate, attempt count, and expandable per-question breakdown
- `CountryRevenueTable` — sortable table of country, revenue, and purchase count
- `TimeRangeSelector` — shared control component for filtering by time range

### Technical clarifications

- All analytics queries will be read-only Drizzle ORM queries; no new tables or schema changes are required.
- Time range filtering will be passed as a `range` search param (`7d`, `30d`, `90d`, `all`). The loader will translate this to a `since` date and pass it into service functions.
- Revenue figures will be stored and computed in cents (integer), converted to dollars only at render time.
- Video abandonment uses `videoWatchEvents.positionSeconds` and `videoWatchEvents.eventType`. Only `pause` and `ended` events (or the last recorded position per session) will be used to determine abandonment position.
- Lesson drop-off is calculated as: for each lesson in lesson-position order, count of distinct users who have a `lessonProgress` record with `status = completed` for that lesson, divided by total enrolled students.
- Quiz pass rate per question: count of `quizAnswers` where the selected option `isCorrect = true`, divided by total `quizAnswers` for that question.
- Admin access to cross-course analytics will show an instructor filter dropdown populated from all instructors on the platform.

### API contracts (loaders)

`/instructor/courses/analytics` loader returns:
- `revenueSeries`: `{ date: string, amountCents: number }[]`
- `enrollmentSeries`: `{ date: string, count: number }[]`
- `courseSummaries`: `{ courseId, title, totalRevenueCents, totalEnrollments, completionRate }[]`
- `revenueByCountry`: `{ country: string, amountCents: number, purchases: number }[]`
- `selectedRange`: `"7d" | "30d" | "90d" | "all"`

`/instructor/$courseId/analytics` loader returns:
- `revenueSeries`, `enrollmentSeries`, `revenueByCountry` (same shape as above, scoped to course)
- `lessonDropoff`: `{ lessonId, title, position, completedCount, enrolledCount }[]`
- `videoAbandonment`: `{ lessonId, title, medianStopSeconds, buckets: { secondsBucket: number, count: number }[] }[]`
- `quizStats`: `{ quizId, title, passRate, attemptCount, questions: { questionId, text, correctRate }[] }[]`
- `selectedRange`: same as above

## Testing Decisions

**What makes a good test for analytics:**
Tests should verify the external behaviour of each `analyticsService` function — meaning the data shape and values returned for a given database state — not the internal SQL or Drizzle query construction. Tests should seed the database with known data and assert that the returned values are correct. Edge cases (zero enrollments, no purchases, all students completing, no quiz attempts) must be covered.

**Modules with 100% test coverage:**
- `analyticsService.ts` — every exported function, including edge cases for empty data sets and boundary conditions on time range filtering
- `analyticsService.test.ts` — accompanying test file following the same pattern as existing `*.test.ts` service tests in the codebase

**Prior art:**
Existing service tests in the codebase (e.g. `bookmarkService.test.ts`, `quizScoringService.test.ts`) provide the pattern: seed a SQLite test database, call service functions, assert return values.

## Out of Scope

- Payment processor integration (Stripe/Paddle) — purchases are recorded manually today and that is not changing
- Refund tracking — there is no refunds table and this feature does not add one
- Student-facing analytics or personal progress dashboards
- Email reports or scheduled analytics digests
- Exported CSV/PDF reports
- Real-time/live analytics (WebSocket or polling)
- Cohort analysis or retention curves beyond basic drop-off
- Revenue sharing or instructor payout calculations
- A/B testing or experiment tracking
- Mobile-specific UI optimisations beyond responsive layout

## Further Notes

- The `videoWatchEvents` table records position in seconds and an event type. The quality of video abandonment data depends on how frequently these events are logged; if events are sparse, abandonment positions will be approximate. This is acceptable for v1.
- All monetary values in the database are in cents (integers). The UI layer is responsible for formatting them as currency strings.
- The time range selector should default to "30 days" as the most useful default for most instructors.
- PPP country codes in the `purchases` table use ISO 3166-1 alpha-2 codes; the country revenue table should display human-readable country names.
