import { data } from "react-router";
import * as v from "valibot";
import type { Route } from "./+types/api.notifications-mark-read";
import { getCurrentUserId } from "~/lib/session";
import { parseJsonBody } from "~/lib/validation";
import { markAsRead, getNotificationById } from "~/services/notificationService";

const markReadSchema = v.object({
  notificationId: v.pipe(v.number(), v.integer(), v.minValue(1)),
});

export async function action({ request }: Route.ActionArgs) {
  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("Unauthorized", { status: 401 });
  }

  const parsed = await parseJsonBody(request, markReadSchema);
  if (!parsed.success) {
    throw data("Invalid parameters", { status: 400 });
  }

  const notification = getNotificationById(parsed.data.notificationId);
  if (!notification) {
    throw data("Notification not found", { status: 404 });
  }

  if (notification.recipientUserId !== currentUserId) {
    throw data("Forbidden", { status: 403 });
  }

  markAsRead(parsed.data.notificationId);
  return { success: true };
}
