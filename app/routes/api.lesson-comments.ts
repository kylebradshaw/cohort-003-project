import { data } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/api.lesson-comments";
import { getCurrentUserId } from "~/lib/session";
import { parseJsonBody } from "~/lib/validation";
import { isUserEnrolled } from "~/services/enrollmentService";
import { getLessonById } from "~/services/lessonService";
import { getModuleById } from "~/services/moduleService";
import { getUserById } from "~/services/userService";
import { UserRole } from "~/db/schema";
import {
  createComment,
  getCommentById,
  updateComment,
  deleteComment,
} from "~/services/commentService";
import { getCourseById } from "~/services/courseService";

const createSchema = z.object({
  intent: z.literal("create"),
  lessonId: z.number().int().positive(),
  content: z.string().min(1).max(2000),
});

const updateSchema = z.object({
  intent: z.literal("update"),
  commentId: z.number().int().positive(),
  content: z.string().min(1).max(2000),
});

const deleteSchema = z.object({
  intent: z.literal("delete"),
  commentId: z.number().int().positive(),
});

const actionSchema = z.discriminatedUnion("intent", [
  createSchema,
  updateSchema,
  deleteSchema,
]);

export async function action({ request }: Route.ActionArgs) {
  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("Unauthorized", { status: 401 });
  }

  const parsed = await parseJsonBody(request, actionSchema);
  if (!parsed.success) {
    throw data("Invalid parameters", { status: 400 });
  }

  const body = parsed.data;

  if (body.intent === "create") {
    const lesson = getLessonById(body.lessonId);
    if (!lesson) {
      throw data("Lesson not found", { status: 404 });
    }

    const mod = getModuleById(lesson.moduleId);
    if (!mod) {
      throw data("Module not found", { status: 404 });
    }

    if (!isUserEnrolled(currentUserId, mod.courseId)) {
      throw data("You must be enrolled to comment", { status: 403 });
    }

    const comment = createComment(currentUserId, body.lessonId, body.content);
    return { success: true, comment };
  }

  if (body.intent === "update") {
    const comment = getCommentById(body.commentId);
    if (!comment) {
      throw data("Comment not found", { status: 404 });
    }

    if (comment.userId !== currentUserId) {
      throw data("You can only edit your own comments", { status: 403 });
    }

    const updated = updateComment(body.commentId, body.content);
    return { success: true, comment: updated };
  }

  if (body.intent === "delete") {
    const comment = getCommentById(body.commentId);
    if (!comment) {
      throw data("Comment not found", { status: 404 });
    }

    // Allow: comment author, course instructor, or admin
    if (comment.userId !== currentUserId) {
      const user = getUserById(currentUserId);
      const isAdmin = user?.role === UserRole.Admin;

      if (!isAdmin) {
        // Check if current user is the course instructor
        const lesson = getLessonById(comment.lessonId);
        const mod = lesson ? getModuleById(lesson.moduleId) : null;
        const course = mod ? getCourseById(mod.courseId) : null;
        const isInstructor = course?.instructorId === currentUserId;

        if (!isInstructor) {
          throw data("Not authorized to delete this comment", { status: 403 });
        }
      }
    }

    deleteComment(body.commentId);
    return { success: true };
  }
}
