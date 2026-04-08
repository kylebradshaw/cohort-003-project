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

import {
  createNotification,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  getNotificationById,
} from "./notificationService";

describe("notificationService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("createNotification", () => {
    it("creates a notification with all fields", () => {
      const notification = createNotification({
        recipientUserId: base.instructor.id,
        type: schema.NotificationType.Enrollment,
        title: "New Enrollment",
        message: "Test User enrolled in Test Course",
        linkUrl: `/instructor/${base.course.id}/students`,
      });

      expect(notification).toBeDefined();
      expect(notification.recipientUserId).toBe(base.instructor.id);
      expect(notification.type).toBe(schema.NotificationType.Enrollment);
      expect(notification.title).toBe("New Enrollment");
      expect(notification.message).toBe("Test User enrolled in Test Course");
      expect(notification.linkUrl).toBe(`/instructor/${base.course.id}/students`);
      expect(notification.isRead).toBe(false);
      expect(notification.createdAt).toBeDefined();
    });
  });

  describe("getNotifications", () => {
    it("returns notifications ordered newest first", () => {
      createNotification({
        recipientUserId: base.instructor.id,
        type: schema.NotificationType.Enrollment,
        title: "First",
        message: "First notification",
        linkUrl: "/instructor/1/students",
      });

      createNotification({
        recipientUserId: base.instructor.id,
        type: schema.NotificationType.Enrollment,
        title: "Second",
        message: "Second notification",
        linkUrl: "/instructor/1/students",
      });

      const results = getNotifications(base.instructor.id, 10, 0);
      expect(results).toHaveLength(2);
      expect(results[0].title).toBe("Second");
      expect(results[1].title).toBe("First");
    });

    it("respects limit parameter", () => {
      for (let i = 0; i < 5; i++) {
        createNotification({
          recipientUserId: base.instructor.id,
          type: schema.NotificationType.Enrollment,
          title: `Notification ${i}`,
          message: `Message ${i}`,
          linkUrl: "/instructor/1/students",
        });
      }

      const results = getNotifications(base.instructor.id, 3, 0);
      expect(results).toHaveLength(3);
    });

    it("respects offset parameter", () => {
      for (let i = 0; i < 5; i++) {
        createNotification({
          recipientUserId: base.instructor.id,
          type: schema.NotificationType.Enrollment,
          title: `Notification ${i}`,
          message: `Message ${i}`,
          linkUrl: "/instructor/1/students",
        });
      }

      const results = getNotifications(base.instructor.id, 10, 2);
      expect(results).toHaveLength(3);
    });

    it("returns empty array when user has no notifications", () => {
      const results = getNotifications(base.instructor.id, 10, 0);
      expect(results).toHaveLength(0);
    });

    it("only returns notifications for the specified user", () => {
      createNotification({
        recipientUserId: base.instructor.id,
        type: schema.NotificationType.Enrollment,
        title: "For Instructor",
        message: "Instructor notification",
        linkUrl: "/instructor/1/students",
      });

      createNotification({
        recipientUserId: base.user.id,
        type: schema.NotificationType.Enrollment,
        title: "For Student",
        message: "Student notification",
        linkUrl: "/instructor/1/students",
      });

      const instructorNotifications = getNotifications(base.instructor.id, 10, 0);
      expect(instructorNotifications).toHaveLength(1);
      expect(instructorNotifications[0].title).toBe("For Instructor");

      const studentNotifications = getNotifications(base.user.id, 10, 0);
      expect(studentNotifications).toHaveLength(1);
      expect(studentNotifications[0].title).toBe("For Student");
    });
  });

  describe("getUnreadCount", () => {
    it("returns the count of unread notifications", () => {
      createNotification({
        recipientUserId: base.instructor.id,
        type: schema.NotificationType.Enrollment,
        title: "Unread 1",
        message: "Message",
        linkUrl: "/instructor/1/students",
      });

      createNotification({
        recipientUserId: base.instructor.id,
        type: schema.NotificationType.Enrollment,
        title: "Unread 2",
        message: "Message",
        linkUrl: "/instructor/1/students",
      });

      expect(getUnreadCount(base.instructor.id)).toBe(2);
    });

    it("returns 0 when all notifications are read", () => {
      const n = createNotification({
        recipientUserId: base.instructor.id,
        type: schema.NotificationType.Enrollment,
        title: "Read",
        message: "Message",
        linkUrl: "/instructor/1/students",
      });

      markAsRead(n.id);
      expect(getUnreadCount(base.instructor.id)).toBe(0);
    });

    it("returns 0 when user has no notifications", () => {
      expect(getUnreadCount(base.instructor.id)).toBe(0);
    });
  });

  describe("markAsRead", () => {
    it("marks a notification as read", () => {
      const n = createNotification({
        recipientUserId: base.instructor.id,
        type: schema.NotificationType.Enrollment,
        title: "Test",
        message: "Message",
        linkUrl: "/instructor/1/students",
      });

      expect(n.isRead).toBe(false);

      const updated = markAsRead(n.id);
      expect(updated).toBeDefined();
      expect(updated!.isRead).toBe(true);
    });
  });

  describe("markAllAsRead", () => {
    it("marks all notifications as read for a user", () => {
      createNotification({
        recipientUserId: base.instructor.id,
        type: schema.NotificationType.Enrollment,
        title: "N1",
        message: "Message",
        linkUrl: "/instructor/1/students",
      });

      createNotification({
        recipientUserId: base.instructor.id,
        type: schema.NotificationType.Enrollment,
        title: "N2",
        message: "Message",
        linkUrl: "/instructor/1/students",
      });

      expect(getUnreadCount(base.instructor.id)).toBe(2);

      markAllAsRead(base.instructor.id);
      expect(getUnreadCount(base.instructor.id)).toBe(0);
    });

    it("does not affect other users' notifications", () => {
      createNotification({
        recipientUserId: base.instructor.id,
        type: schema.NotificationType.Enrollment,
        title: "Instructor N",
        message: "Message",
        linkUrl: "/instructor/1/students",
      });

      createNotification({
        recipientUserId: base.user.id,
        type: schema.NotificationType.Enrollment,
        title: "Student N",
        message: "Message",
        linkUrl: "/instructor/1/students",
      });

      markAllAsRead(base.instructor.id);

      expect(getUnreadCount(base.instructor.id)).toBe(0);
      expect(getUnreadCount(base.user.id)).toBe(1);
    });
  });

  describe("getNotificationById", () => {
    it("returns a notification by id", () => {
      const created = createNotification({
        recipientUserId: base.instructor.id,
        type: schema.NotificationType.Enrollment,
        title: "Test",
        message: "Message",
        linkUrl: "/instructor/1/students",
      });

      const found = getNotificationById(created.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
    });

    it("returns undefined for non-existent id", () => {
      expect(getNotificationById(9999)).toBeUndefined();
    });
  });
});
