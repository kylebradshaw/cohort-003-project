import { useState, useEffect, useRef } from "react";
import { useFetcher } from "react-router";
import { UserAvatar } from "~/components/user-avatar";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { MessageSquare, Pencil, Trash2 } from "lucide-react";

type Comment = {
  id: number;
  content: string;
  createdAt: string;
  updatedAt: string;
  userId: number;
  userName: string;
  userAvatarUrl: string | null;
};

function formatRelativeTime(dateStr: string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function CommentSection({
  lessonId,
  comments,
  currentUserId,
  isInstructor,
  isAdmin,
}: {
  lessonId: number;
  comments: Comment[];
  currentUserId: number | null;
  isInstructor: boolean;
  isAdmin: boolean;
}) {
  return (
    <div className="mb-8">
      <div className="mb-4 flex items-center gap-2">
        <MessageSquare className="size-5 text-primary" />
        <h2 className="text-xl font-semibold">
          Comments{" "}
          {comments.length > 0 && (
            <span className="text-base font-normal text-muted-foreground">
              ({comments.length})
            </span>
          )}
        </h2>
      </div>

      {currentUserId ? (
        <CommentForm lessonId={lessonId} />
      ) : (
        <p className="mb-4 text-sm text-muted-foreground">
          Log in to leave a comment.
        </p>
      )}

      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No comments yet. Be the first to comment!
        </p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={currentUserId}
              canModerate={isInstructor || isAdmin}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CommentForm({
  lessonId,
  editingComment,
  onCancelEdit,
}: {
  lessonId?: number;
  editingComment?: Comment;
  onCancelEdit?: () => void;
}) {
  const fetcher = useFetcher({ key: editingComment ? `edit-comment-${editingComment.id}` : `new-comment-${lessonId}` });
  const [content, setContent] = useState(editingComment?.content ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isSubmitting = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      if (!editingComment) {
        setContent("");
      } else {
        onCancelEdit?.();
      }
    }
  }, [fetcher.state, fetcher.data, editingComment, onCancelEdit]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    if (editingComment) {
      fetcher.submit(
        { intent: "update", commentId: editingComment.id, content: content.trim() },
        { method: "post", action: "/api/lesson-comments", encType: "application/json" }
      );
    } else {
      fetcher.submit(
        { intent: "create", lessonId: lessonId!, content: content.trim() },
        { method: "post", action: "/api/lesson-comments", encType: "application/json" }
      );
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6">
      <Textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write a comment..."
        maxLength={2000}
        className="mb-2"
      />
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={!content.trim() || isSubmitting}>
          {isSubmitting
            ? editingComment
              ? "Saving..."
              : "Posting..."
            : editingComment
              ? "Save"
              : "Post Comment"}
        </Button>
        {editingComment && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancelEdit}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

function CommentItem({
  comment,
  currentUserId,
  canModerate,
}: {
  comment: Comment;
  currentUserId: number | null;
  canModerate: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const deleteFetcher = useFetcher({ key: `delete-comment-${comment.id}` });

  const isOwn = currentUserId === comment.userId;
  const isDeleting = deleteFetcher.state !== "idle";

  if (isDeleting) return null;

  function handleDelete() {
    if (!window.confirm("Delete this comment?")) return;
    deleteFetcher.submit(
      { intent: "delete", commentId: comment.id },
      { method: "post", action: "/api/lesson-comments", encType: "application/json" }
    );
  }

  if (editing) {
    return (
      <div className="rounded-lg border p-4">
        <CommentForm
          editingComment={comment}
          onCancelEdit={() => setEditing(false)}
        />
      </div>
    );
  }

  const wasEdited = comment.updatedAt !== comment.createdAt;

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <UserAvatar
            name={comment.userName}
            avatarUrl={comment.userAvatarUrl}
            className="size-6"
          />
          <span className="text-sm font-medium">{comment.userName}</span>
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(comment.createdAt)}
            {wasEdited && " (edited)"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {isOwn && (
            <Button
              variant="ghost"
              size="sm"
              className="size-7 p-0"
              onClick={() => setEditing(true)}
            >
              <Pencil className="size-3.5" />
            </Button>
          )}
          {(isOwn || canModerate) && (
            <Button
              variant="ghost"
              size="sm"
              className="size-7 p-0 text-destructive hover:text-destructive"
              onClick={handleDelete}
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
      <p className="whitespace-pre-wrap text-sm">{comment.content}</p>
    </div>
  );
}
