"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Camera, Loader2, Sparkles, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";

interface PhotoUploadProps {
  analyzing: boolean;
  onPhoto: (dataUrl: string) => void;
}

export function PhotoUpload({ analyzing, onPhoto }: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function handleFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!/image\/(jpe?g|png|webp)/.test(file.type)) {
      setError("Please choose a JPG, PNG, or WEBP image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be under 10MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      onPhoto(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-3">
      <Card
        onClick={() => !analyzing && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className={`relative flex min-h-[280px] cursor-pointer flex-col items-center justify-center overflow-hidden border-2 border-dashed transition-colors ${
          dragging ? "border-primary bg-primary/5" : "border-input"
        }`}
      >
        {preview ? (
          <>
            <Image
              src={preview}
              alt="Issue preview"
              fill
              className="object-cover"
              unoptimized
            />
            {analyzing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 text-white">
                <div className="animate-pulse-soft flex flex-col items-center gap-2">
                  <Sparkles className="h-8 w-8" />
                  <span className="text-base font-semibold">Analyzing with Gemini AI…</span>
                  <span className="flex items-center gap-1 text-sm opacity-80">
                    <Loader2 className="h-4 w-4 animate-spin" /> classifying category & severity
                  </span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Camera className="h-8 w-8" />
            </span>
            <div>
              <p className="font-semibold">Tap to take or upload a photo</p>
              <p className="text-sm text-muted-foreground">JPG, PNG or WEBP · up to 10MB</p>
            </div>
            <span className="flex items-center gap-1 rounded-lg bg-secondary px-3 py-1.5 text-sm font-medium">
              <Upload className="h-4 w-4" /> Choose file
            </span>
          </div>
        )}
      </Card>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
