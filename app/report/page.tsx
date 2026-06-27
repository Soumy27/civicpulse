"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhotoUpload } from "@/components/report/PhotoUpload";
import { LocationPicker, type PickedLocation } from "@/components/report/LocationPicker";
import { AiPreviewCard } from "@/components/report/AiPreviewCard";
import { INDORE_CENTER, inferWardId } from "@/lib/maps";
import { useAuth } from "@/lib/auth-context";
import { showXpToast } from "@/components/shared/XpToast";
import type { ClassifyResult } from "@/lib/types";

const STEPS = ["Photo", "Location", "Confirm"] as const;

export default function ReportPage() {
  const router = useRouter();
  const { user, signInGuest } = useAuth();
  const [step, setStep] = useState(0);
  const [photo, setPhoto] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [classification, setClassification] = useState<ClassifyResult | null>(null);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [location, setLocation] = useState<PickedLocation>({
    lat: INDORE_CENTER.lat,
    lng: INDORE_CENTER.lng,
    address: "",
  });

  async function handlePhoto(dataUrl: string) {
    setPhoto(dataUrl);
    setAnalyzing(true);
    try {
      const res = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: dataUrl,
          lat: location.lat,
          lng: location.lng,
          wardId: inferWardId(location.lat, location.lng),
        }),
      });
      const data = (await res.json()) as ClassifyResult;
      setClassification(data);
      setDescription(data.description ?? "");
    } catch (err) {
      console.error("classify failed:", err);
      // Graceful fallback so the wizard never dead-ends.
      setClassification({
        category: "other",
        severity: "medium",
        description: "",
        department: "Municipal Commissioner's Office",
        confidence: 50,
        extractedEntities: [],
        predictedResolutionMinDays: 3,
        predictedResolutionMaxDays: 7,
        nearbyIssues: [],
        needsReview: true,
        reason: "AI analysis unavailable",
      });
    } finally {
      setAnalyzing(false);
    }
  }

  async function submit() {
    if (!classification) return;
    setSubmitting(true);
    try {
      let reporterId = user?.uid;
      if (!reporterId) {
        await signInGuest();
        reporterId = undefined; // server falls back to anonymous if still unset
      }
      const res = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: photo,
          lat: location.lat,
          lng: location.lng,
          address: location.address,
          wardId: inferWardId(location.lat, location.lng),
          category: classification.category,
          severity: classification.severity,
          aiDescription: description,
          aiConfidence: classification.confidence,
          department: classification.department,
          extractedEntities: classification.extractedEntities,
          predictedResolutionMinDays: classification.predictedResolutionMinDays,
          predictedResolutionMaxDays: classification.predictedResolutionMaxDays,
          reporterId,
        }),
      });
      const data = (await res.json()) as { issueId?: string };
      if (data.issueId) {
        showXpToast(10, "Report submitted");
        router.push(`/issue/${data.issueId}`);
      }
    } catch (err) {
      console.error("submit failed:", err);
      setSubmitting(false);
    }
  }

  const canNext = step === 0 ? Boolean(classification) : step === 1 ? Boolean(location.lat) : true;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Stepper */}
      <div className="mb-6 flex items-center justify-between">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center">
            <div className="flex items-center gap-2">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                  i < step
                    ? "bg-green-600 text-white"
                    : i === step
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground"
                }`}
              >
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className={`text-sm font-medium ${i === step ? "" : "text-muted-foreground"}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && <div className="mx-2 h-px flex-1 bg-border" />}
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Snap a photo of the issue</h2>
          <PhotoUpload analyzing={analyzing} onPhoto={handlePhoto} />
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Where is it?</h2>
          <LocationPicker value={location} onChange={setLocation} />
        </div>
      )}

      {step === 2 && classification && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Confirm &amp; submit</h2>
          <AiPreviewCard
            result={classification}
            description={description}
            onDescriptionChange={setDescription}
          />
        </div>
      )}

      {/* Nav */}
      <div className="mt-6 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || submitting}
        >
          Back
        </Button>
        {step < 2 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={submit} disabled={submitting} size="lg">
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
              </>
            ) : (
              "Submit Report"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
