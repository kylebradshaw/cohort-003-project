import { eq, and, avg, count, inArray } from "drizzle-orm";
import { db } from "~/db";
import { courseRatings } from "~/db/schema";

export function getRatingForUser(userId: number, courseId: number) {
  return db
    .select()
    .from(courseRatings)
    .where(
      and(
        eq(courseRatings.userId, userId),
        eq(courseRatings.courseId, courseId)
      )
    )
    .get();
}

export function getCourseRatingStats(courseId: number) {
  const result = db
    .select({
      averageRating: avg(courseRatings.rating),
      totalRatings: count(courseRatings.id),
    })
    .from(courseRatings)
    .where(eq(courseRatings.courseId, courseId))
    .get();

  return {
    averageRating: result?.averageRating ? Number(result.averageRating) : null,
    totalRatings: result?.totalRatings ?? 0,
  };
}

export function getRatingStatsForCourses(
  courseIds: number[]
): Map<number, { averageRating: number | null; totalRatings: number }> {
  if (courseIds.length === 0) return new Map();

  const rows = db
    .select({
      courseId: courseRatings.courseId,
      averageRating: avg(courseRatings.rating),
      totalRatings: count(courseRatings.id),
    })
    .from(courseRatings)
    .where(inArray(courseRatings.courseId, courseIds))
    .groupBy(courseRatings.courseId)
    .all();

  const map = new Map<
    number,
    { averageRating: number | null; totalRatings: number }
  >();
  for (const row of rows) {
    map.set(row.courseId, {
      averageRating: row.averageRating ? Number(row.averageRating) : null,
      totalRatings: row.totalRatings,
    });
  }
  return map;
}

export function upsertRating(userId: number, courseId: number, rating: number) {
  const existing = getRatingForUser(userId, courseId);

  if (existing) {
    return db
      .update(courseRatings)
      .set({ rating, updatedAt: new Date().toISOString() })
      .where(eq(courseRatings.id, existing.id))
      .returning()
      .get();
  }

  return db
    .insert(courseRatings)
    .values({ userId, courseId, rating })
    .returning()
    .get();
}
