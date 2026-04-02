import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

// Import after mock so the module picks up our test db
import {
  sinceDate,
  getRevenueSeries,
  getRevenueByCountry,
  getEnrollmentSeries,
  getCourseSummaries,
  getCourseCompletionRate,
  getLessonDropoff,
  getVideoAbandonment,
  getQuizStats,
} from "./analyticsService";

// ─── Seed helpers ────────────────────────────────────────────────────────────

function seedCourse(opts: {
  instructorId: number;
  categoryId: number;
  title?: string;
  slug?: string;
}) {
  return testDb
    .insert(schema.courses)
    .values({
      title: opts.title ?? "Course",
      slug: opts.slug ?? `course-${Date.now()}-${Math.random()}`,
      description: "desc",
      instructorId: opts.instructorId,
      categoryId: opts.categoryId,
      status: schema.CourseStatus.Published,
    })
    .returning()
    .get();
}

function seedModule(courseId: number, position = 1) {
  return testDb
    .insert(schema.modules)
    .values({ courseId, title: `Module ${position}`, position })
    .returning()
    .get();
}

function seedLesson(moduleId: number, position = 1) {
  return testDb
    .insert(schema.lessons)
    .values({ moduleId, title: `Lesson ${position}`, position })
    .returning()
    .get();
}

function seedPurchase(opts: {
  userId: number;
  courseId: number;
  pricePaid: number;
  country?: string;
  createdAt?: string;
}) {
  return testDb
    .insert(schema.purchases)
    .values({
      userId: opts.userId,
      courseId: opts.courseId,
      pricePaid: opts.pricePaid,
      country: opts.country ?? "US",
      createdAt: opts.createdAt ?? new Date().toISOString(),
    })
    .returning()
    .get();
}

function seedEnrollment(opts: {
  userId: number;
  courseId: number;
  enrolledAt?: string;
}) {
  return testDb
    .insert(schema.enrollments)
    .values({
      userId: opts.userId,
      courseId: opts.courseId,
      enrolledAt: opts.enrolledAt ?? new Date().toISOString(),
    })
    .returning()
    .get();
}

function seedLessonProgress(opts: {
  userId: number;
  lessonId: number;
  status: schema.LessonProgressStatus;
}) {
  return testDb
    .insert(schema.lessonProgress)
    .values({ userId: opts.userId, lessonId: opts.lessonId, status: opts.status })
    .returning()
    .get();
}

function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("analyticsService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  // ── sinceDate ──────────────────────────────────────────────────────────────

  describe("sinceDate", () => {
    it("returns undefined for 'all'", () => {
      expect(sinceDate("all")).toBeUndefined();
    });

    it("returns a date approximately 7 days ago for '7d'", () => {
      const d = sinceDate("7d")!;
      const daysAgo = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysAgo).toBeCloseTo(7, 0);
    });

    it("returns a date approximately 30 days ago for '30d'", () => {
      const d = sinceDate("30d")!;
      const daysAgo = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysAgo).toBeCloseTo(30, 0);
    });

    it("returns a date approximately 90 days ago for '90d'", () => {
      const d = sinceDate("90d")!;
      const daysAgo = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysAgo).toBeCloseTo(90, 0);
    });
  });

  // ── getRevenueSeries ───────────────────────────────────────────────────────

  describe("getRevenueSeries", () => {
    it("returns empty array when no purchases exist", () => {
      const result = getRevenueSeries({ courseId: base.course.id });
      expect(result).toEqual([]);
    });

    it("returns empty array when no purchases match the instructorId", () => {
      const result = getRevenueSeries({ instructorId: base.instructor.id });
      expect(result).toEqual([]);
    });

    it("aggregates same-day purchases into one entry", () => {
      seedPurchase({ userId: base.user.id, courseId: base.course.id, pricePaid: 1000 });
      seedPurchase({ userId: base.user.id, courseId: base.course.id, pricePaid: 2000 });

      const result = getRevenueSeries({ courseId: base.course.id, since: sinceDate("30d") });

      expect(result).toHaveLength(1);
      expect(result[0].date).toBe(todayStr());
      expect(result[0].amountCents).toBe(3000);
    });

    it("filters purchases before the since date", () => {
      seedPurchase({ userId: base.user.id, courseId: base.course.id, pricePaid: 1000, createdAt: daysAgoIso(60) });
      seedPurchase({ userId: base.user.id, courseId: base.course.id, pricePaid: 2000 });

      const result = getRevenueSeries({ courseId: base.course.id, since: sinceDate("30d") });

      expect(result).toHaveLength(1);
      expect(result[0].amountCents).toBe(2000);
    });

    it("includes all purchases when since is undefined (all time)", () => {
      seedPurchase({ userId: base.user.id, courseId: base.course.id, pricePaid: 1000, createdAt: daysAgoIso(60) });
      seedPurchase({ userId: base.user.id, courseId: base.course.id, pricePaid: 2000 });

      const result = getRevenueSeries({ courseId: base.course.id });
      const total = result.reduce((s, r) => s + r.amountCents, 0);
      expect(total).toBe(3000);
    });

    it("groups by month when since is undefined", () => {
      seedPurchase({ userId: base.user.id, courseId: base.course.id, pricePaid: 1000, createdAt: "2025-01-15T00:00:00.000Z" });
      seedPurchase({ userId: base.user.id, courseId: base.course.id, pricePaid: 2000, createdAt: "2025-02-15T00:00:00.000Z" });

      const result = getRevenueSeries({ courseId: base.course.id });
      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it("filters by instructorId across all their courses", () => {
      const course2 = seedCourse({ instructorId: base.instructor.id, categoryId: base.category.id, slug: "c2" });
      seedPurchase({ userId: base.user.id, courseId: base.course.id, pricePaid: 1000 });
      seedPurchase({ userId: base.user.id, courseId: course2.id, pricePaid: 3000 });

      const result = getRevenueSeries({ instructorId: base.instructor.id, since: sinceDate("30d") });
      const total = result.reduce((s, r) => s + r.amountCents, 0);
      expect(total).toBe(4000);
    });

    it("excludes purchases from other instructors when filtering by instructorId", () => {
      const instructor2 = testDb
        .insert(schema.users)
        .values({ name: "I2", email: "i2@example.com", role: schema.UserRole.Instructor })
        .returning()
        .get();
      const course2 = seedCourse({ instructorId: instructor2.id, categoryId: base.category.id, slug: "c2" });

      seedPurchase({ userId: base.user.id, courseId: base.course.id, pricePaid: 1000 });
      seedPurchase({ userId: base.user.id, courseId: course2.id, pricePaid: 5000 });

      const result = getRevenueSeries({ instructorId: base.instructor.id, since: sinceDate("30d") });
      const total = result.reduce((s, r) => s + r.amountCents, 0);
      expect(total).toBe(1000);
    });

    it("filters by courseId when provided", () => {
      const course2 = seedCourse({ instructorId: base.instructor.id, categoryId: base.category.id, slug: "c2" });
      seedPurchase({ userId: base.user.id, courseId: base.course.id, pricePaid: 1000 });
      seedPurchase({ userId: base.user.id, courseId: course2.id, pricePaid: 9000 });

      const result = getRevenueSeries({ courseId: base.course.id });
      const total = result.reduce((s, r) => s + r.amountCents, 0);
      expect(total).toBe(1000);
    });
  });

  // ── getRevenueByCountry ────────────────────────────────────────────────────

  describe("getRevenueByCountry", () => {
    it("returns empty array when no purchases exist", () => {
      expect(getRevenueByCountry({ courseId: base.course.id })).toEqual([]);
    });

    it("groups purchases by country with sum and count", () => {
      seedPurchase({ userId: base.user.id, courseId: base.course.id, pricePaid: 1000, country: "US" });
      seedPurchase({ userId: base.user.id, courseId: base.course.id, pricePaid: 500, country: "US" });
      seedPurchase({ userId: base.user.id, courseId: base.course.id, pricePaid: 800, country: "GB" });

      const result = getRevenueByCountry({ courseId: base.course.id });
      const us = result.find((r) => r.country === "US");
      const gb = result.find((r) => r.country === "GB");

      expect(us?.amountCents).toBe(1500);
      expect(us?.purchases).toBe(2);
      expect(gb?.amountCents).toBe(800);
      expect(gb?.purchases).toBe(1);
    });

    it("filters by since date", () => {
      seedPurchase({ userId: base.user.id, courseId: base.course.id, pricePaid: 1000, country: "US", createdAt: daysAgoIso(60) });
      seedPurchase({ userId: base.user.id, courseId: base.course.id, pricePaid: 2000, country: "US" });

      const result = getRevenueByCountry({ courseId: base.course.id, since: sinceDate("30d") });
      expect(result).toHaveLength(1);
      expect(result[0].amountCents).toBe(2000);
    });

    it("filters by instructorId", () => {
      const instructor2 = testDb
        .insert(schema.users)
        .values({ name: "I2", email: "i2@example.com", role: schema.UserRole.Instructor })
        .returning()
        .get();
      const course2 = seedCourse({ instructorId: instructor2.id, categoryId: base.category.id, slug: "c2" });

      seedPurchase({ userId: base.user.id, courseId: base.course.id, pricePaid: 1000, country: "US" });
      seedPurchase({ userId: base.user.id, courseId: course2.id, pricePaid: 2000, country: "US" });

      const result = getRevenueByCountry({ instructorId: base.instructor.id });
      expect(result).toHaveLength(1);
      expect(result[0].amountCents).toBe(1000);
    });

    it("handles null country as Unknown", () => {
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 500,
          country: null,
        })
        .run();

      const result = getRevenueByCountry({ courseId: base.course.id });
      const unknownRow = result.find((r) => r.country === "Unknown");
      expect(unknownRow?.amountCents).toBe(500);
    });

    it("returns results ordered by revenue descending", () => {
      seedPurchase({ userId: base.user.id, courseId: base.course.id, pricePaid: 300, country: "DE" });
      seedPurchase({ userId: base.user.id, courseId: base.course.id, pricePaid: 1000, country: "US" });
      seedPurchase({ userId: base.user.id, courseId: base.course.id, pricePaid: 600, country: "GB" });

      const result = getRevenueByCountry({ courseId: base.course.id });
      expect(result[0].amountCents).toBeGreaterThanOrEqual(result[1].amountCents);
      expect(result[1].amountCents).toBeGreaterThanOrEqual(result[2].amountCents);
    });
  });

  // ── getEnrollmentSeries ────────────────────────────────────────────────────

  describe("getEnrollmentSeries", () => {
    it("returns empty array when no enrollments exist", () => {
      expect(getEnrollmentSeries({ courseId: base.course.id })).toEqual([]);
    });

    it("counts enrollments grouped by day", () => {
      const student2 = testDb
        .insert(schema.users)
        .values({ name: "S2", email: "s2@example.com", role: schema.UserRole.Student })
        .returning()
        .get();

      seedEnrollment({ userId: base.user.id, courseId: base.course.id });
      seedEnrollment({ userId: student2.id, courseId: base.course.id });

      const result = getEnrollmentSeries({ courseId: base.course.id, since: sinceDate("30d") });
      expect(result).toHaveLength(1);
      expect(result[0].date).toBe(todayStr());
      expect(result[0].count).toBe(2);
    });

    it("filters enrollments before the since date", () => {
      const student2 = testDb
        .insert(schema.users)
        .values({ name: "S2", email: "s2@example.com", role: schema.UserRole.Student })
        .returning()
        .get();

      seedEnrollment({ userId: base.user.id, courseId: base.course.id, enrolledAt: daysAgoIso(60) });
      seedEnrollment({ userId: student2.id, courseId: base.course.id });

      const result = getEnrollmentSeries({ courseId: base.course.id, since: sinceDate("30d") });
      const total = result.reduce((s, r) => s + r.count, 0);
      expect(total).toBe(1);
    });

    it("includes all enrollments when since is undefined", () => {
      const student2 = testDb
        .insert(schema.users)
        .values({ name: "S2", email: "s2@example.com", role: schema.UserRole.Student })
        .returning()
        .get();

      seedEnrollment({ userId: base.user.id, courseId: base.course.id, enrolledAt: daysAgoIso(60) });
      seedEnrollment({ userId: student2.id, courseId: base.course.id });

      const result = getEnrollmentSeries({ courseId: base.course.id });
      const total = result.reduce((s, r) => s + r.count, 0);
      expect(total).toBe(2);
    });

    it("filters by instructorId across all their courses", () => {
      const course2 = seedCourse({ instructorId: base.instructor.id, categoryId: base.category.id, slug: "c2" });
      const student2 = testDb
        .insert(schema.users)
        .values({ name: "S2", email: "s2@example.com", role: schema.UserRole.Student })
        .returning()
        .get();

      seedEnrollment({ userId: base.user.id, courseId: base.course.id });
      seedEnrollment({ userId: student2.id, courseId: course2.id });

      const result = getEnrollmentSeries({ instructorId: base.instructor.id, since: sinceDate("30d") });
      const total = result.reduce((s, r) => s + r.count, 0);
      expect(total).toBe(2);
    });

    it("excludes enrollments from other instructors when filtering by instructorId", () => {
      const instructor2 = testDb
        .insert(schema.users)
        .values({ name: "I2", email: "i2@example.com", role: schema.UserRole.Instructor })
        .returning()
        .get();
      const course2 = seedCourse({ instructorId: instructor2.id, categoryId: base.category.id, slug: "c2" });
      const student2 = testDb
        .insert(schema.users)
        .values({ name: "S2", email: "s2@example.com", role: schema.UserRole.Student })
        .returning()
        .get();

      seedEnrollment({ userId: base.user.id, courseId: base.course.id });
      seedEnrollment({ userId: student2.id, courseId: course2.id });

      const result = getEnrollmentSeries({ instructorId: base.instructor.id, since: sinceDate("30d") });
      const total = result.reduce((s, r) => s + r.count, 0);
      expect(total).toBe(1);
    });
  });

  // ── getCourseSummaries ─────────────────────────────────────────────────────

  describe("getCourseSummaries", () => {
    it("returns empty array when instructor has no courses", () => {
      const newInstructor = testDb
        .insert(schema.users)
        .values({ name: "New", email: "new@example.com", role: schema.UserRole.Instructor })
        .returning()
        .get();

      expect(getCourseSummaries({ instructorId: newInstructor.id })).toEqual([]);
    });

    it("returns one summary per course for the instructor", () => {
      const course2 = seedCourse({ instructorId: base.instructor.id, categoryId: base.category.id, slug: "c2" });
      const result = getCourseSummaries({ instructorId: base.instructor.id });

      expect(result).toHaveLength(2);
      const ids = result.map((r) => r.courseId);
      expect(ids).toContain(base.course.id);
      expect(ids).toContain(course2.id);
    });

    it("includes the course title", () => {
      const result = getCourseSummaries({ instructorId: base.instructor.id });
      expect(result[0].title).toBe(base.course.title);
    });

    it("calculates totalRevenueCents as sum of purchases", () => {
      seedPurchase({ userId: base.user.id, courseId: base.course.id, pricePaid: 2500 });
      seedPurchase({ userId: base.user.id, courseId: base.course.id, pricePaid: 1500 });

      const result = getCourseSummaries({ instructorId: base.instructor.id });
      expect(result[0].totalRevenueCents).toBe(4000);
    });

    it("returns 0 totalRevenueCents when no purchases", () => {
      const result = getCourseSummaries({ instructorId: base.instructor.id });
      expect(result[0].totalRevenueCents).toBe(0);
    });

    it("calculates totalEnrollments correctly", () => {
      const student2 = testDb
        .insert(schema.users)
        .values({ name: "S2", email: "s2@example.com", role: schema.UserRole.Student })
        .returning()
        .get();

      seedEnrollment({ userId: base.user.id, courseId: base.course.id });
      seedEnrollment({ userId: student2.id, courseId: base.course.id });

      const result = getCourseSummaries({ instructorId: base.instructor.id });
      expect(result[0].totalEnrollments).toBe(2);
    });

    it("returns 0 totalEnrollments when no one is enrolled", () => {
      const result = getCourseSummaries({ instructorId: base.instructor.id });
      expect(result[0].totalEnrollments).toBe(0);
    });

    it("returns 0 completionRate when there are no enrollments", () => {
      const mod = seedModule(base.course.id);
      seedLesson(mod.id);

      const result = getCourseSummaries({ instructorId: base.instructor.id });
      expect(result[0].completionRate).toBe(0);
    });

    it("returns 0 completionRate when course has no lessons", () => {
      seedEnrollment({ userId: base.user.id, courseId: base.course.id });

      const result = getCourseSummaries({ instructorId: base.instructor.id });
      expect(result[0].completionRate).toBe(0);
    });

    it("returns completionRate of 1 when all enrolled students completed all lessons", () => {
      const mod = seedModule(base.course.id);
      const lesson = seedLesson(mod.id);

      seedEnrollment({ userId: base.user.id, courseId: base.course.id });
      seedLessonProgress({ userId: base.user.id, lessonId: lesson.id, status: schema.LessonProgressStatus.Completed });

      const result = getCourseSummaries({ instructorId: base.instructor.id });
      expect(result[0].completionRate).toBe(1);
    });

    it("calculates partial completionRate correctly", () => {
      const mod = seedModule(base.course.id);
      const lesson = seedLesson(mod.id);

      const student2 = testDb
        .insert(schema.users)
        .values({ name: "S2", email: "s2@example.com", role: schema.UserRole.Student })
        .returning()
        .get();

      seedEnrollment({ userId: base.user.id, courseId: base.course.id });
      seedEnrollment({ userId: student2.id, courseId: base.course.id });
      // Only base.user completes
      seedLessonProgress({ userId: base.user.id, lessonId: lesson.id, status: schema.LessonProgressStatus.Completed });

      const result = getCourseSummaries({ instructorId: base.instructor.id });
      expect(result[0].completionRate).toBe(0.5);
    });

    it("requires all lessons to be completed for full credit", () => {
      const mod = seedModule(base.course.id);
      const lesson1 = seedLesson(mod.id, 1);
      const lesson2 = seedLesson(mod.id, 2);

      seedEnrollment({ userId: base.user.id, courseId: base.course.id });
      // Only completes lesson1, not lesson2
      seedLessonProgress({ userId: base.user.id, lessonId: lesson1.id, status: schema.LessonProgressStatus.Completed });

      const result = getCourseSummaries({ instructorId: base.instructor.id });
      expect(result[0].completionRate).toBe(0);
    });

    it("counts completion across multiple lessons correctly", () => {
      const mod = seedModule(base.course.id);
      const lesson1 = seedLesson(mod.id, 1);
      const lesson2 = seedLesson(mod.id, 2);

      const student2 = testDb
        .insert(schema.users)
        .values({ name: "S2", email: "s2@example.com", role: schema.UserRole.Student })
        .returning()
        .get();

      seedEnrollment({ userId: base.user.id, courseId: base.course.id });
      seedEnrollment({ userId: student2.id, courseId: base.course.id });

      // base.user completes both lessons
      seedLessonProgress({ userId: base.user.id, lessonId: lesson1.id, status: schema.LessonProgressStatus.Completed });
      seedLessonProgress({ userId: base.user.id, lessonId: lesson2.id, status: schema.LessonProgressStatus.Completed });
      // student2 completes only one
      seedLessonProgress({ userId: student2.id, lessonId: lesson1.id, status: schema.LessonProgressStatus.Completed });

      const result = getCourseSummaries({ instructorId: base.instructor.id });
      expect(result[0].completionRate).toBe(0.5);
    });

    it("filters revenue by since date but not completionRate", () => {
      const mod = seedModule(base.course.id);
      const lesson = seedLesson(mod.id);

      seedPurchase({ userId: base.user.id, courseId: base.course.id, pricePaid: 1000, createdAt: daysAgoIso(60) });
      seedPurchase({ userId: base.user.id, courseId: base.course.id, pricePaid: 2000 });

      seedEnrollment({ userId: base.user.id, courseId: base.course.id, enrolledAt: daysAgoIso(60) });
      const student2 = testDb
        .insert(schema.users)
        .values({ name: "S2", email: "s2@example.com", role: schema.UserRole.Student })
        .returning()
        .get();
      seedEnrollment({ userId: student2.id, courseId: base.course.id });

      // Both complete the lesson
      seedLessonProgress({ userId: base.user.id, lessonId: lesson.id, status: schema.LessonProgressStatus.Completed });
      seedLessonProgress({ userId: student2.id, lessonId: lesson.id, status: schema.LessonProgressStatus.Completed });

      const result = getCourseSummaries({ instructorId: base.instructor.id, since: sinceDate("30d") });

      expect(result[0].totalRevenueCents).toBe(2000);
      expect(result[0].totalEnrollments).toBe(1);
      // completionRate is total (not time-filtered): 2/2 = 1
      expect(result[0].completionRate).toBe(1);
    });

    it("does not include courses from other instructors", () => {
      const instructor2 = testDb
        .insert(schema.users)
        .values({ name: "I2", email: "i2@example.com", role: schema.UserRole.Instructor })
        .returning()
        .get();
      seedCourse({ instructorId: instructor2.id, categoryId: base.category.id, slug: "c2" });

      const result = getCourseSummaries({ instructorId: base.instructor.id });
      expect(result).toHaveLength(1);
      expect(result[0].courseId).toBe(base.course.id);
    });
  });

  // ── getCourseCompletionRate ────────────────────────────────────────────────

  describe("getCourseCompletionRate", () => {
    it("returns 0 when no enrollments", () => {
      const mod = seedModule(base.course.id);
      seedLesson(mod.id);
      expect(getCourseCompletionRate({ courseId: base.course.id })).toBe(0);
    });

    it("returns 0 when course has no lessons", () => {
      seedEnrollment({ userId: base.user.id, courseId: base.course.id });
      expect(getCourseCompletionRate({ courseId: base.course.id })).toBe(0);
    });

    it("returns 1 when all enrolled students completed all lessons", () => {
      const mod = seedModule(base.course.id);
      const lesson = seedLesson(mod.id);
      seedEnrollment({ userId: base.user.id, courseId: base.course.id });
      seedLessonProgress({ userId: base.user.id, lessonId: lesson.id, status: schema.LessonProgressStatus.Completed });
      expect(getCourseCompletionRate({ courseId: base.course.id })).toBe(1);
    });

    it("returns 0.5 when half the students completed all lessons", () => {
      const mod = seedModule(base.course.id);
      const lesson = seedLesson(mod.id);
      const student2 = testDb
        .insert(schema.users)
        .values({ name: "S2", email: "s2@example.com", role: schema.UserRole.Student })
        .returning()
        .get();
      seedEnrollment({ userId: base.user.id, courseId: base.course.id });
      seedEnrollment({ userId: student2.id, courseId: base.course.id });
      seedLessonProgress({ userId: base.user.id, lessonId: lesson.id, status: schema.LessonProgressStatus.Completed });
      expect(getCourseCompletionRate({ courseId: base.course.id })).toBe(0.5);
    });

    it("requires all lessons completed for credit", () => {
      const mod = seedModule(base.course.id);
      const lesson1 = seedLesson(mod.id, 1);
      const lesson2 = seedLesson(mod.id, 2);
      seedEnrollment({ userId: base.user.id, courseId: base.course.id });
      seedLessonProgress({ userId: base.user.id, lessonId: lesson1.id, status: schema.LessonProgressStatus.Completed });
      // lesson2 not completed
      expect(getCourseCompletionRate({ courseId: base.course.id })).toBe(0);
    });
  });

  // ── getLessonDropoff ───────────────────────────────────────────────────────

  describe("getLessonDropoff", () => {
    it("returns empty array when course has no lessons", () => {
      expect(getLessonDropoff({ courseId: base.course.id })).toEqual([]);
    });

    it("returns lessons ordered by position", () => {
      const mod = seedModule(base.course.id, 1);
      const l1 = seedLesson(mod.id, 1);
      const l2 = seedLesson(mod.id, 2);
      const result = getLessonDropoff({ courseId: base.course.id });
      expect(result).toHaveLength(2);
      expect(result[0].lessonId).toBe(l1.id);
      expect(result[1].lessonId).toBe(l2.id);
    });

    it("includes enrolledCount and completedCount", () => {
      const mod = seedModule(base.course.id, 1);
      const lesson = seedLesson(mod.id, 1);
      const student2 = testDb
        .insert(schema.users)
        .values({ name: "S2", email: "s2@example.com", role: schema.UserRole.Student })
        .returning()
        .get();
      seedEnrollment({ userId: base.user.id, courseId: base.course.id });
      seedEnrollment({ userId: student2.id, courseId: base.course.id });
      seedLessonProgress({ userId: base.user.id, lessonId: lesson.id, status: schema.LessonProgressStatus.Completed });

      const result = getLessonDropoff({ courseId: base.course.id });
      expect(result[0].enrolledCount).toBe(2);
      expect(result[0].completedCount).toBe(1);
    });

    it("returns 0 completedCount when no one completed a lesson", () => {
      const mod = seedModule(base.course.id, 1);
      seedLesson(mod.id, 1);
      seedEnrollment({ userId: base.user.id, courseId: base.course.id });
      const result = getLessonDropoff({ courseId: base.course.id });
      expect(result[0].completedCount).toBe(0);
      expect(result[0].enrolledCount).toBe(1);
    });

    it("uses module position then lesson position for ordering", () => {
      const mod1 = seedModule(base.course.id, 1);
      const mod2 = seedModule(base.course.id, 2);
      const l_mod2 = seedLesson(mod2.id, 1);
      const l_mod1 = seedLesson(mod1.id, 1);
      const result = getLessonDropoff({ courseId: base.course.id });
      expect(result[0].lessonId).toBe(l_mod1.id);
      expect(result[1].lessonId).toBe(l_mod2.id);
    });
  });

  // ── getVideoAbandonment ────────────────────────────────────────────────────

  describe("getVideoAbandonment", () => {
    function seedWatchEvent(opts: {
      userId: number;
      lessonId: number;
      positionSeconds: number;
      eventType?: string;
    }) {
      return testDb
        .insert(schema.videoWatchEvents)
        .values({
          userId: opts.userId,
          lessonId: opts.lessonId,
          positionSeconds: opts.positionSeconds,
          eventType: opts.eventType ?? "pause",
        })
        .returning()
        .get();
    }

    it("returns empty array when no watch events exist", () => {
      const mod = seedModule(base.course.id);
      seedLesson(mod.id);
      expect(getVideoAbandonment({ courseId: base.course.id })).toEqual([]);
    });

    it("omits lessons with no watch events", () => {
      const mod = seedModule(base.course.id);
      const l1 = seedLesson(mod.id, 1);
      seedLesson(mod.id, 2); // no events
      seedWatchEvent({ userId: base.user.id, lessonId: l1.id, positionSeconds: 45 });

      const result = getVideoAbandonment({ courseId: base.course.id });
      expect(result).toHaveLength(1);
      expect(result[0].lessonId).toBe(l1.id);
    });

    it("computes median stop seconds for odd number of events", () => {
      const mod = seedModule(base.course.id);
      const lesson = seedLesson(mod.id);
      seedWatchEvent({ userId: base.user.id, lessonId: lesson.id, positionSeconds: 10 });
      seedWatchEvent({ userId: base.user.id, lessonId: lesson.id, positionSeconds: 30 });
      seedWatchEvent({ userId: base.user.id, lessonId: lesson.id, positionSeconds: 50 });

      const result = getVideoAbandonment({ courseId: base.course.id });
      expect(result[0].medianStopSeconds).toBe(30);
    });

    it("computes median stop seconds for even number of events", () => {
      const mod = seedModule(base.course.id);
      const lesson = seedLesson(mod.id);
      seedWatchEvent({ userId: base.user.id, lessonId: lesson.id, positionSeconds: 10 });
      seedWatchEvent({ userId: base.user.id, lessonId: lesson.id, positionSeconds: 30 });

      const result = getVideoAbandonment({ courseId: base.course.id });
      expect(result[0].medianStopSeconds).toBe(20);
    });

    it("groups positions into 30-second buckets", () => {
      const mod = seedModule(base.course.id);
      const lesson = seedLesson(mod.id);
      seedWatchEvent({ userId: base.user.id, lessonId: lesson.id, positionSeconds: 5 });
      seedWatchEvent({ userId: base.user.id, lessonId: lesson.id, positionSeconds: 20 });
      seedWatchEvent({ userId: base.user.id, lessonId: lesson.id, positionSeconds: 45 });

      const result = getVideoAbandonment({ courseId: base.course.id });
      const buckets = result[0].buckets;
      const bucket0 = buckets.find((b) => b.secondsBucket === 0);
      const bucket30 = buckets.find((b) => b.secondsBucket === 30);
      expect(bucket0?.count).toBe(2); // 5s and 20s → bucket 0
      expect(bucket30?.count).toBe(1); // 45s → bucket 30
    });

    it("only includes pause and ended events, not other types", () => {
      const mod = seedModule(base.course.id);
      const lesson = seedLesson(mod.id);
      seedWatchEvent({ userId: base.user.id, lessonId: lesson.id, positionSeconds: 10, eventType: "play" });
      // no pause or ended events
      expect(getVideoAbandonment({ courseId: base.course.id })).toEqual([]);
    });
  });

  // ── getQuizStats ───────────────────────────────────────────────────────────

  describe("getQuizStats", () => {
    function seedQuiz(lessonId: number, title = "Quiz") {
      return testDb
        .insert(schema.quizzes)
        .values({ lessonId, title, passingScore: 0.7 })
        .returning()
        .get();
    }

    function seedQuestion(quizId: number, position = 1) {
      return testDb
        .insert(schema.quizQuestions)
        .values({ quizId, questionText: `Q${position}`, questionType: schema.QuestionType.MultipleChoice, position })
        .returning()
        .get();
    }

    function seedOption(questionId: number, isCorrect: boolean) {
      return testDb
        .insert(schema.quizOptions)
        .values({ questionId, optionText: isCorrect ? "Correct" : "Wrong", isCorrect })
        .returning()
        .get();
    }

    function seedAttempt(opts: { userId: number; quizId: number; passed: boolean }) {
      return testDb
        .insert(schema.quizAttempts)
        .values({ userId: opts.userId, quizId: opts.quizId, score: opts.passed ? 1 : 0, passed: opts.passed })
        .returning()
        .get();
    }

    function seedAnswer(opts: { attemptId: number; questionId: number; selectedOptionId: number }) {
      return testDb
        .insert(schema.quizAnswers)
        .values({ attemptId: opts.attemptId, questionId: opts.questionId, selectedOptionId: opts.selectedOptionId })
        .returning()
        .get();
    }

    it("returns empty array when course has no quizzes", () => {
      expect(getQuizStats({ courseId: base.course.id })).toEqual([]);
    });

    it("returns quiz with 0 attempts and 0 passRate", () => {
      const mod = seedModule(base.course.id);
      const lesson = seedLesson(mod.id);
      seedQuiz(lesson.id);

      const result = getQuizStats({ courseId: base.course.id });
      expect(result).toHaveLength(1);
      expect(result[0].attemptCount).toBe(0);
      expect(result[0].passRate).toBe(0);
    });

    it("calculates passRate correctly", () => {
      const mod = seedModule(base.course.id);
      const lesson = seedLesson(mod.id);
      const quiz = seedQuiz(lesson.id);
      seedAttempt({ userId: base.user.id, quizId: quiz.id, passed: true });
      const student2 = testDb
        .insert(schema.users)
        .values({ name: "S2", email: "s2@example.com", role: schema.UserRole.Student })
        .returning()
        .get();
      seedAttempt({ userId: student2.id, quizId: quiz.id, passed: false });

      const result = getQuizStats({ courseId: base.course.id });
      expect(result[0].passRate).toBe(0.5);
      expect(result[0].attemptCount).toBe(2);
    });

    it("returns passRate of 1 when all attempts passed", () => {
      const mod = seedModule(base.course.id);
      const lesson = seedLesson(mod.id);
      const quiz = seedQuiz(lesson.id);
      seedAttempt({ userId: base.user.id, quizId: quiz.id, passed: true });

      const result = getQuizStats({ courseId: base.course.id });
      expect(result[0].passRate).toBe(1);
    });

    it("returns passRate of 0 when all attempts failed", () => {
      const mod = seedModule(base.course.id);
      const lesson = seedLesson(mod.id);
      const quiz = seedQuiz(lesson.id);
      seedAttempt({ userId: base.user.id, quizId: quiz.id, passed: false });

      const result = getQuizStats({ courseId: base.course.id });
      expect(result[0].passRate).toBe(0);
    });

    it("calculates per-question correctRate", () => {
      const mod = seedModule(base.course.id);
      const lesson = seedLesson(mod.id);
      const quiz = seedQuiz(lesson.id);
      const q = seedQuestion(quiz.id, 1);
      const correct = seedOption(q.id, true);
      const wrong = seedOption(q.id, false);

      const attempt1 = seedAttempt({ userId: base.user.id, quizId: quiz.id, passed: true });
      seedAnswer({ attemptId: attempt1.id, questionId: q.id, selectedOptionId: correct.id });
      const student2 = testDb
        .insert(schema.users)
        .values({ name: "S2", email: "s2@example.com", role: schema.UserRole.Student })
        .returning()
        .get();
      const attempt2 = seedAttempt({ userId: student2.id, quizId: quiz.id, passed: false });
      seedAnswer({ attemptId: attempt2.id, questionId: q.id, selectedOptionId: wrong.id });

      const result = getQuizStats({ courseId: base.course.id });
      expect(result[0].questions[0].correctRate).toBe(0.5);
    });

    it("returns correctRate of 0 when no answers recorded for a question", () => {
      const mod = seedModule(base.course.id);
      const lesson = seedLesson(mod.id);
      const quiz = seedQuiz(lesson.id);
      seedQuestion(quiz.id, 1);
      seedAttempt({ userId: base.user.id, quizId: quiz.id, passed: false });

      const result = getQuizStats({ courseId: base.course.id });
      expect(result[0].questions[0].correctRate).toBe(0);
    });

    it("returns questions ordered by position", () => {
      const mod = seedModule(base.course.id);
      const lesson = seedLesson(mod.id);
      const quiz = seedQuiz(lesson.id);
      const q2 = seedQuestion(quiz.id, 2);
      const q1 = seedQuestion(quiz.id, 1);

      const result = getQuizStats({ courseId: base.course.id });
      expect(result[0].questions[0].questionId).toBe(q1.id);
      expect(result[0].questions[1].questionId).toBe(q2.id);
    });

    it("only returns quizzes for the specified course", () => {
      const course2 = seedCourse({ instructorId: base.instructor.id, categoryId: base.category.id, slug: "c2" });
      const mod2 = seedModule(course2.id);
      const lesson2 = seedLesson(mod2.id);
      seedQuiz(lesson2.id);

      expect(getQuizStats({ courseId: base.course.id })).toEqual([]);
    });
  });
});
