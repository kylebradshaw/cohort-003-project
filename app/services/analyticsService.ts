import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "~/db";
import {
  courses,
  enrollments,
  lessonProgress,
  lessons,
  modules,
  purchases,
  videoWatchEvents,
  quizzes,
  quizQuestions,
  quizOptions,
  quizAttempts,
  quizAnswers,
  LessonProgressStatus,
} from "~/db/schema";

export type TimeRange = "7d" | "30d" | "90d" | "all";

export function sinceDate(range: TimeRange): Date | undefined {
  if (range === "all") return undefined;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function inferGranularity(since: Date | undefined): "day" | "week" | "month" {
  if (!since) return "month";
  const daysAgo = (Date.now() - since.getTime()) / (1000 * 60 * 60 * 24);
  if (daysAgo <= 30) return "day";
  if (daysAgo <= 90) return "week";
  return "month";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dateGroupExpr(col: any, since: Date | undefined) {
  const g = inferGranularity(since);
  if (g === "day") return sql<string>`strftime('%Y-%m-%d', ${col})`;
  if (g === "week") return sql<string>`strftime('%Y-W%W', ${col})`;
  return sql<string>`strftime('%Y-%m', ${col})`;
}

export function getRevenueSeries(opts: {
  instructorId?: number;
  courseId?: number;
  since?: Date;
}): { date: string; amountCents: number }[] {
  const dateExpr = dateGroupExpr(purchases.createdAt, opts.since);
  const amountExpr = sql<number>`cast(coalesce(sum(${purchases.pricePaid}), 0) as integer)`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [];
  if (opts.since) conditions.push(gte(purchases.createdAt, opts.since.toISOString()));
  if (opts.courseId !== undefined) conditions.push(eq(purchases.courseId, opts.courseId));

  if (opts.instructorId !== undefined) {
    conditions.push(eq(courses.instructorId, opts.instructorId));
    return db
      .select({ date: dateExpr, amountCents: amountExpr })
      .from(purchases)
      .innerJoin(courses, eq(purchases.courseId, courses.id))
      .where(and(...conditions))
      .groupBy(dateExpr)
      .orderBy(dateExpr)
      .all();
  }

  return db
    .select({ date: dateExpr, amountCents: amountExpr })
    .from(purchases)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(dateExpr)
    .orderBy(dateExpr)
    .all();
}

export function getRevenueByCountry(opts: {
  instructorId?: number;
  courseId?: number;
  since?: Date;
}): { country: string; amountCents: number; purchases: number }[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [];
  if (opts.since) conditions.push(gte(purchases.createdAt, opts.since.toISOString()));
  if (opts.courseId !== undefined) conditions.push(eq(purchases.courseId, opts.courseId));

  const selectCols = {
    country: sql<string>`coalesce(${purchases.country}, 'Unknown')`,
    amountCents: sql<number>`cast(sum(${purchases.pricePaid}) as integer)`,
    purchases: sql<number>`cast(count(*) as integer)`,
  };

  if (opts.instructorId !== undefined) {
    conditions.push(eq(courses.instructorId, opts.instructorId));
    return db
      .select(selectCols)
      .from(purchases)
      .innerJoin(courses, eq(purchases.courseId, courses.id))
      .where(and(...conditions))
      .groupBy(purchases.country)
      .orderBy(sql`sum(${purchases.pricePaid}) desc`)
      .all();
  }

  return db
    .select(selectCols)
    .from(purchases)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(purchases.country)
    .orderBy(sql`sum(${purchases.pricePaid}) desc`)
    .all();
}

export function getEnrollmentSeries(opts: {
  instructorId?: number;
  courseId?: number;
  since?: Date;
}): { date: string; count: number }[] {
  const dateExpr = dateGroupExpr(enrollments.enrolledAt, opts.since);
  const countExpr = sql<number>`cast(count(*) as integer)`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [];
  if (opts.since) conditions.push(gte(enrollments.enrolledAt, opts.since.toISOString()));
  if (opts.courseId !== undefined) conditions.push(eq(enrollments.courseId, opts.courseId));

  if (opts.instructorId !== undefined) {
    conditions.push(eq(courses.instructorId, opts.instructorId));
    return db
      .select({ date: dateExpr, count: countExpr })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(and(...conditions))
      .groupBy(dateExpr)
      .orderBy(dateExpr)
      .all();
  }

  return db
    .select({ date: dateExpr, count: countExpr })
    .from(enrollments)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(dateExpr)
    .orderBy(dateExpr)
    .all();
}

export function getCourseSummaries(opts: {
  instructorId: number;
  since?: Date;
}): {
  courseId: number;
  title: string;
  totalRevenueCents: number;
  totalEnrollments: number;
  completionRate: number;
}[] {
  const instructorCourses = db
    .select({ id: courses.id, title: courses.title })
    .from(courses)
    .where(eq(courses.instructorId, opts.instructorId))
    .all();

  return instructorCourses.map((course) => {
    // Revenue total (time-filtered)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const revConditions: any[] = [eq(purchases.courseId, course.id)];
    if (opts.since) revConditions.push(gte(purchases.createdAt, opts.since.toISOString()));
    const revenueRow = db
      .select({ total: sql<number>`cast(coalesce(sum(${purchases.pricePaid}), 0) as integer)` })
      .from(purchases)
      .where(and(...revConditions))
      .get();

    // Enrollment total (time-filtered)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enrollConditions: any[] = [eq(enrollments.courseId, course.id)];
    if (opts.since) enrollConditions.push(gte(enrollments.enrolledAt, opts.since.toISOString()));
    const enrollRow = db
      .select({ total: sql<number>`cast(count(*) as integer)` })
      .from(enrollments)
      .where(and(...enrollConditions))
      .get();

    // Completion rate (total metric, not time-filtered)
    const totalEnrolledRow = db
      .select({ total: sql<number>`cast(count(*) as integer)` })
      .from(enrollments)
      .where(eq(enrollments.courseId, course.id))
      .get();

    const totalEnrolled = totalEnrolledRow?.total ?? 0;
    let completionRate = 0;

    if (totalEnrolled > 0) {
      const totalLessonsRow = db.get(
        sql`
          SELECT COUNT(*) as count
          FROM lessons l
          JOIN modules m ON l.module_id = m.id
          WHERE m.course_id = ${course.id}
        `
      ) as { count: number } | undefined;

      const totalLessons = totalLessonsRow?.count ?? 0;

      if (totalLessons > 0) {
        const completedRow = db.get(
          sql`
            SELECT COUNT(*) as count FROM (
              SELECT e.user_id
              FROM enrollments e
              WHERE e.course_id = ${course.id}
              AND (
                SELECT COUNT(DISTINCT lp.lesson_id)
                FROM lesson_progress lp
                JOIN lessons l ON lp.lesson_id = l.id
                JOIN modules m ON l.module_id = m.id
                WHERE lp.user_id = e.user_id
                  AND m.course_id = ${course.id}
                  AND lp.status = ${LessonProgressStatus.Completed}
              ) = ${totalLessons}
            )
          `
        ) as { count: number } | undefined;

        completionRate = (completedRow?.count ?? 0) / totalEnrolled;
      }
    }

    return {
      courseId: course.id,
      title: course.title,
      totalRevenueCents: revenueRow?.total ?? 0,
      totalEnrollments: enrollRow?.total ?? 0,
      completionRate,
    };
  });
}

export function getCourseCompletionRate(opts: { courseId: number }): number {
  const totalEnrolledRow = db
    .select({ total: sql<number>`cast(count(*) as integer)` })
    .from(enrollments)
    .where(eq(enrollments.courseId, opts.courseId))
    .get();

  const totalEnrolled = totalEnrolledRow?.total ?? 0;
  if (totalEnrolled === 0) return 0;

  const totalLessonsRow = db.get(
    sql`SELECT COUNT(*) as count FROM lessons l JOIN modules m ON l.module_id = m.id WHERE m.course_id = ${opts.courseId}`
  ) as { count: number } | undefined;

  const totalLessons = totalLessonsRow?.count ?? 0;
  if (totalLessons === 0) return 0;

  const completedRow = db.get(
    sql`
      SELECT COUNT(*) as count FROM (
        SELECT e.user_id
        FROM enrollments e
        WHERE e.course_id = ${opts.courseId}
        AND (
          SELECT COUNT(DISTINCT lp.lesson_id)
          FROM lesson_progress lp
          JOIN lessons l ON lp.lesson_id = l.id
          JOIN modules m ON l.module_id = m.id
          WHERE lp.user_id = e.user_id
            AND m.course_id = ${opts.courseId}
            AND lp.status = ${LessonProgressStatus.Completed}
        ) = ${totalLessons}
      )
    `
  ) as { count: number } | undefined;

  return (completedRow?.count ?? 0) / totalEnrolled;
}

export function getLessonDropoff(opts: { courseId: number }): {
  lessonId: number;
  title: string;
  position: number;
  completedCount: number;
  enrolledCount: number;
}[] {
  const totalEnrolledRow = db
    .select({ total: sql<number>`cast(count(*) as integer)` })
    .from(enrollments)
    .where(eq(enrollments.courseId, opts.courseId))
    .get();

  const enrolledCount = totalEnrolledRow?.total ?? 0;

  const courseLessons = db
    .select({
      lessonId: lessons.id,
      title: lessons.title,
      position: lessons.position,
    })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(modules.courseId, opts.courseId))
    .orderBy(modules.position, lessons.position)
    .all();

  return courseLessons.map((lesson) => {
    const completedRow = db
      .select({ count: sql<number>`cast(count(distinct ${lessonProgress.userId}) as integer)` })
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.lessonId, lesson.lessonId),
          eq(lessonProgress.status, LessonProgressStatus.Completed)
        )
      )
      .get();

    return {
      lessonId: lesson.lessonId,
      title: lesson.title,
      position: lesson.position,
      completedCount: completedRow?.count ?? 0,
      enrolledCount,
    };
  });
}

export function getVideoAbandonment(opts: { courseId: number }): {
  lessonId: number;
  title: string;
  medianStopSeconds: number;
  buckets: { secondsBucket: number; count: number }[];
}[] {
  const courseLessons = db
    .select({ lessonId: lessons.id, title: lessons.title })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(modules.courseId, opts.courseId))
    .orderBy(modules.position, lessons.position)
    .all();

  const results: {
    lessonId: number;
    title: string;
    medianStopSeconds: number;
    buckets: { secondsBucket: number; count: number }[];
  }[] = [];

  for (const lesson of courseLessons) {
    const events = db
      .select({ positionSeconds: videoWatchEvents.positionSeconds })
      .from(videoWatchEvents)
      .where(
        and(
          eq(videoWatchEvents.lessonId, lesson.lessonId),
          sql`${videoWatchEvents.eventType} IN ('pause', 'ended')`
        )
      )
      .all();

    if (events.length === 0) continue;

    const positions = events.map((e) => e.positionSeconds).sort((a, b) => a - b);
    const mid = Math.floor(positions.length / 2);
    const medianStopSeconds =
      positions.length % 2 === 0
        ? (positions[mid - 1] + positions[mid]) / 2
        : positions[mid];

    // 30-second buckets
    const bucketMap = new Map<number, number>();
    for (const pos of positions) {
      const bucket = Math.floor(pos / 30) * 30;
      bucketMap.set(bucket, (bucketMap.get(bucket) ?? 0) + 1);
    }
    const buckets = Array.from(bucketMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([secondsBucket, count]) => ({ secondsBucket, count }));

    results.push({ lessonId: lesson.lessonId, title: lesson.title, medianStopSeconds, buckets });
  }

  return results;
}

export function getQuizStats(opts: { courseId: number }): {
  quizId: number;
  title: string;
  passRate: number;
  attemptCount: number;
  questions: { questionId: number; text: string; correctRate: number }[];
}[] {
  const courseQuizzes = db
    .select({ quizId: quizzes.id, title: quizzes.title })
    .from(quizzes)
    .innerJoin(lessons, eq(quizzes.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(modules.courseId, opts.courseId))
    .all();

  return courseQuizzes.map((quiz) => {
    const attemptsRow = db
      .select({
        total: sql<number>`cast(count(*) as integer)`,
        passed: sql<number>`cast(sum(case when ${quizAttempts.passed} then 1 else 0 end) as integer)`,
      })
      .from(quizAttempts)
      .where(eq(quizAttempts.quizId, quiz.quizId))
      .get();

    const attemptCount = attemptsRow?.total ?? 0;
    const passRate = attemptCount > 0 ? (attemptsRow?.passed ?? 0) / attemptCount : 0;

    const questions = db
      .select({ questionId: quizQuestions.id, text: quizQuestions.questionText })
      .from(quizQuestions)
      .where(eq(quizQuestions.quizId, quiz.quizId))
      .orderBy(quizQuestions.position)
      .all();

    const questionStats = questions.map((q) => {
      const answerRow = db
        .select({
          total: sql<number>`cast(count(*) as integer)`,
          correct: sql<number>`cast(sum(case when ${quizOptions.isCorrect} then 1 else 0 end) as integer)`,
        })
        .from(quizAnswers)
        .innerJoin(quizOptions, eq(quizAnswers.selectedOptionId, quizOptions.id))
        .where(eq(quizAnswers.questionId, q.questionId))
        .get();

      const total = answerRow?.total ?? 0;
      const correct = answerRow?.correct ?? 0;
      return {
        questionId: q.questionId,
        text: q.text,
        correctRate: total > 0 ? correct / total : 0,
      };
    });

    return {
      quizId: quiz.quizId,
      title: quiz.title,
      passRate,
      attemptCount,
      questions: questionStats,
    };
  });
}
