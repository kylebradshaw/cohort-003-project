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
  isLessonBookmarked,
  toggleBookmark,
  getBookmarkedLessonIds,
} from "./bookmarkService";

function createModuleWithLessons(
  courseId: number,
  moduleTitle: string,
  position: number,
  lessonCount: number
) {
  const mod = testDb
    .insert(schema.modules)
    .values({ courseId, title: moduleTitle, position })
    .returning()
    .get();

  const createdLessons = [];
  for (let i = 0; i < lessonCount; i++) {
    const lesson = testDb
      .insert(schema.lessons)
      .values({ moduleId: mod.id, title: `Lesson ${i + 1}`, position: i + 1 })
      .returning()
      .get();
    createdLessons.push(lesson);
  }

  return { module: mod, lessons: createdLessons };
}

describe("bookmarkService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("isLessonBookmarked", () => {
    it("returns false when no bookmark exists", () => {
      const { lessons } = createModuleWithLessons(base.course.id, "Module 1", 1, 1);

      expect(isLessonBookmarked({ userId: base.user.id, lessonId: lessons[0].id })).toBe(false);
    });

    it("returns true after a bookmark is created", () => {
      const { lessons } = createModuleWithLessons(base.course.id, "Module 1", 1, 1);

      testDb
        .insert(schema.lessonBookmarks)
        .values({ userId: base.user.id, lessonId: lessons[0].id })
        .run();

      expect(isLessonBookmarked({ userId: base.user.id, lessonId: lessons[0].id })).toBe(true);
    });

    it("returns false for a different user's bookmark", () => {
      const { lessons } = createModuleWithLessons(base.course.id, "Module 1", 1, 1);

      const otherUser = testDb
        .insert(schema.users)
        .values({ email: "other@example.com", name: "Other User", role: schema.UserRole.Student })
        .returning()
        .get();

      testDb
        .insert(schema.lessonBookmarks)
        .values({ userId: otherUser.id, lessonId: lessons[0].id })
        .run();

      expect(isLessonBookmarked({ userId: base.user.id, lessonId: lessons[0].id })).toBe(false);
    });
  });

  describe("toggleBookmark", () => {
    it("creates a bookmark and returns bookmarked: true when none exists", () => {
      const { lessons } = createModuleWithLessons(base.course.id, "Module 1", 1, 1);

      const result = toggleBookmark({ userId: base.user.id, lessonId: lessons[0].id });

      expect(result).toEqual({ bookmarked: true });
      expect(isLessonBookmarked({ userId: base.user.id, lessonId: lessons[0].id })).toBe(true);
    });

    it("removes an existing bookmark and returns bookmarked: false", () => {
      const { lessons } = createModuleWithLessons(base.course.id, "Module 1", 1, 1);

      toggleBookmark({ userId: base.user.id, lessonId: lessons[0].id });
      const result = toggleBookmark({ userId: base.user.id, lessonId: lessons[0].id });

      expect(result).toEqual({ bookmarked: false });
      expect(isLessonBookmarked({ userId: base.user.id, lessonId: lessons[0].id })).toBe(false);
    });

    it("toggling twice returns to bookmarked: true", () => {
      const { lessons } = createModuleWithLessons(base.course.id, "Module 1", 1, 1);

      toggleBookmark({ userId: base.user.id, lessonId: lessons[0].id });
      toggleBookmark({ userId: base.user.id, lessonId: lessons[0].id });
      const result = toggleBookmark({ userId: base.user.id, lessonId: lessons[0].id });

      expect(result).toEqual({ bookmarked: true });
    });
  });

  describe("getBookmarkedLessonIds", () => {
    it("returns empty array when no bookmarks exist", () => {
      createModuleWithLessons(base.course.id, "Module 1", 1, 3);

      const ids = getBookmarkedLessonIds({ userId: base.user.id, courseId: base.course.id });
      expect(ids).toEqual([]);
    });

    it("returns ids of bookmarked lessons for the given course", () => {
      const { lessons } = createModuleWithLessons(base.course.id, "Module 1", 1, 3);

      toggleBookmark({ userId: base.user.id, lessonId: lessons[0].id });
      toggleBookmark({ userId: base.user.id, lessonId: lessons[2].id });

      const ids = getBookmarkedLessonIds({ userId: base.user.id, courseId: base.course.id });
      expect(ids).toHaveLength(2);
      expect(ids).toContain(lessons[0].id);
      expect(ids).toContain(lessons[2].id);
    });

    it("does not return bookmarks from a different course", () => {
      const { lessons: course1Lessons } = createModuleWithLessons(
        base.course.id,
        "Module 1",
        1,
        2
      );

      const otherCourse = testDb
        .insert(schema.courses)
        .values({
          title: "Other Course",
          slug: "other-course",
          description: "Another course",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      const { lessons: course2Lessons } = createModuleWithLessons(
        otherCourse.id,
        "Module 1",
        1,
        2
      );

      toggleBookmark({ userId: base.user.id, lessonId: course1Lessons[0].id });
      toggleBookmark({ userId: base.user.id, lessonId: course2Lessons[0].id });

      const ids = getBookmarkedLessonIds({ userId: base.user.id, courseId: base.course.id });
      expect(ids).toHaveLength(1);
      expect(ids).toContain(course1Lessons[0].id);
    });

    it("does not return bookmarks from a different user", () => {
      const { lessons } = createModuleWithLessons(base.course.id, "Module 1", 1, 2);

      const otherUser = testDb
        .insert(schema.users)
        .values({ email: "other@example.com", name: "Other User", role: schema.UserRole.Student })
        .returning()
        .get();

      toggleBookmark({ userId: otherUser.id, lessonId: lessons[0].id });

      const ids = getBookmarkedLessonIds({ userId: base.user.id, courseId: base.course.id });
      expect(ids).toEqual([]);
    });
  });
});
