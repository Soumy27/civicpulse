"use client";

import { useEffect, useState } from "react";
import { Clock, Copy, Loader2, MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DraftResponse {
  eligible: boolean;
  draftText: string;
  hoursUntilEligible?: number;
}

export function EscalationCard({ issueId }: { issueId: string }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DraftResponse | null>(null);
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/issues/${issueId}/escalation-draft`);
        const json = (await res.json()) as DraftResponse;
        if (!cancelled) {
          setData(json);
          setText(json.draftText);
        }
      } catch (err) {
        console.error("escalation draft failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [issueId]);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const whatsapp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Send className="h-4 w-4 text-primary" /> Escalate to ward officer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="shimmer h-24 w-full rounded-lg" />
        ) : data?.eligible ? (
          <>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={copy} className="flex-1">
                <Copy className="h-4 w-4" /> {copied ? "Copied!" : "Copy text"}
              </Button>
              <Button onClick={whatsapp} className="flex-1">
                <MessageCircle className="h-4 w-4" /> Open WhatsApp
              </Button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            {data?.hoursUntilEligible
              ? `Eligible for escalation in ~${data.hoursUntilEligible}h (issues can be escalated after 48h).`
              : "Not yet eligible for citizen escalation."}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
