"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast-notification";

interface Comment {
  _id: string;
  authorName: string;
  content: string;
  createdAt: string;
  status: string;
}

export function CommentsSection({ postId }: { postId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    authorName: "",
    authorEmail: "",
    content: "",
  });

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/blog-comments?postId=${postId}&limit=50`);
      const data = await res.json();
      if (data.success) {
        setComments(data.data.data || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchComments();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchComments]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.authorName.trim() || !form.authorEmail.trim() || !form.content.trim()) {
      toast.error("Fill in all fields");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/blog-comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, postId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(
          data.data?.status === "approved"
            ? "Comment posted"
            : "Comment submitted for review",
        );
        setForm({ authorName: "", authorEmail: "", content: "" });
        fetchComments();
      } else {
        toast.error(data.error || "Failed to post comment");
      }
    } catch {
      toast.error("Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Comments</h2>
        <p className="text-sm text-muted-foreground">
          {comments.length} {comments.length === 1 ? "comment" : "comments"}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : comments.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Be the first to comment.
        </p>
      ) : (
        <ul className="space-y-4">
          {comments.map((c) => (
            <li key={c._id} className="rounded-xl border bg-card p-5">
              <div className="mb-2 flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-muted text-sm font-semibold">
                  {c.authorName.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold">{c.authorName}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <p className="whitespace-pre-line text-sm text-foreground/90">
                {c.content}
              </p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border bg-card p-6">
        <h3 className="text-lg font-semibold">Leave a comment</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="authorName">Name</Label>
            <Input
              id="authorName"
              className="mt-1"
              value={form.authorName}
              onChange={(e) => setForm((p) => ({ ...p, authorName: e.target.value }))}
              required
            />
          </div>
          <div>
            <Label htmlFor="authorEmail">Email</Label>
            <Input
              id="authorEmail"
              type="email"
              className="mt-1"
              value={form.authorEmail}
              onChange={(e) => setForm((p) => ({ ...p, authorEmail: e.target.value }))}
              required
            />
          </div>
        </div>
        <div>
          <Label htmlFor="content">Comment</Label>
          <Textarea
            id="content"
            className="mt-1"
            rows={4}
            value={form.content}
            onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
            required
          />
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Post comment
        </Button>
      </form>
    </div>
  );
}
