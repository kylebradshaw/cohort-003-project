import { useState, useRef, useEffect } from "react";
import { useFetcher, useNavigate } from "react-router";
import { Bell } from "lucide-react";
import { cn } from "~/lib/utils";

interface Notification {
  id: number;
  title: string;
  message: string;
  linkUrl: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationBellProps {
  notifications: Notification[];
  unreadCount: number;
}

function timeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationBell({
  notifications,
  unreadCount,
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fetcher = useFetcher();
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  function handleNotificationClick(notification: Notification) {
    if (!notification.isRead) {
      fetcher.submit(
        { notificationId: notification.id },
        {
          method: "POST",
          action: "/api/notifications/mark-read",
          encType: "application/json",
        }
      );
    }
    setIsOpen(false);
    navigate(notification.linkUrl);
  }

  function handleMarkAllAsRead() {
    fetcher.submit(null, {
      method: "POST",
      action: "/api/notifications/mark-all-read",
    });
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-md p-1 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        title="Notifications"
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-full top-0 z-50 ml-2 w-80 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">Notifications</h3>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No notifications
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    "flex w-full flex-col gap-1 border-b border-border px-4 py-3 text-left transition-colors hover:bg-accent",
                    !notification.isRead && "bg-accent/50"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        !notification.isRead
                          ? "text-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      {notification.title}
                    </span>
                    {!notification.isRead && (
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                    )}
                  </div>
                  <span className="text-sm text-foreground">
                    {notification.message}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {timeAgo(notification.createdAt)}
                  </span>
                </button>
              ))
            )}
          </div>

          {notifications.length > 0 && unreadCount > 0 && (
            <div className="border-t border-border px-4 py-2">
              <button
                onClick={handleMarkAllAsRead}
                className="w-full rounded-md py-1.5 text-center text-sm font-medium text-primary hover:bg-accent"
              >
                Mark all as read
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
