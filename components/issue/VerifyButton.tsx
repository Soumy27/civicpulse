"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { showXpToast } from "@/components/shared/XpToast";

export function VerifyButton({
  issueId,
  reporterId,
  alreadyVerified,
}: {
  issueId: string;
  reporterId: string;
  alreadyVerified: boolean;
}) {
  const { user, signInGuest } = useAuth();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(alreadyVerified);
  const [error, setError] = useState<string | null>(null);
  const [confetti, setConfetti] = useState(false);

  const isOwn = user?.uid === reporterId;

  async function verify() {
    setError(null);
    setLoading(true);
    try {
      let uid = user?.uid;
      if (!uid) {
        await signInGuest();
        uid = undefined;
      }
      const res = await fetch(`/api/issues/${issueId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid }),
      });
      const data = (await res.json()) as { success: boolean; error?: string };
      if (data.success) {
        setDone(true);
        setConfetti(true);
        showXpToast(5, "Issue verified");
        setTimeout(() => setConfetti(false), 700);
      } else {
        setError(data.error ?? "Could not verify.");
      }
    } catch (err) {
      console.error(err);
      setError("Could not verify. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (isOwn) {
    return (
      <p className="rounded-lg bg-secondary p-3 text-center text-sm text-muted-foreground">
        This is your report — others can verify it.
      </p>
    );
  }

  return (
    <div className="relative">
      <Button
        size="lg"
        variant={done ? "success" : "default"}
        onClick={verify}
        disabled={loading || done}
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" /> Verifying…
          </>
        ) : done ? (
          <>
            <CheckCircle2 className="h-5 w-5" /> Verified — thank you!
          </>
        ) : (
          "Verify this issue (+5 XP)"
        )}
      </Button>

      {confetti && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {Array.from({ length: 5 }).map((_, i) => (
            <span
              key={i}
              className="confetti-dot absolute h-2 w-2 rounded-full"
              style={
                {
                  backgroundColor: ["#ef4444", "#3b82f6", "#f59e0b", "#22c55e", "#8b5cf6"][i],
                  "--dx": `${(i - 2) * 28}px`,
                  "--dy": `${-30 - (i % 2) * 20}px`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      )}

      {error && <p className="mt-2 text-center text-sm text-red-600">{error}</p>}
    </div>
  );
}
