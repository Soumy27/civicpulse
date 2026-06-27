"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

interface XpToastData {
  amount: number;
  label: string;
}

/** Imperative toast: call showXpToast(amount, label) from anywhere. */
let externalShow: ((d: XpToastData) => void) | null = null;

export function showXpToast(amount: number, label = "XP earned") {
  externalShow?.({ amount, label });
}

export function XpToastHost() {
  const [toast, setToast] = useState<XpToastData | null>(null);

  useEffect(() => {
    externalShow = (d) => {
      setToast(d);
      window.setTimeout(() => setToast(null), 3000);
    };
    return () => {
      externalShow = null;
    };
  }, []);

  if (!toast) return null;
  return (
    <div className="animate-slide-in-right fixed bottom-5 right-5 z-[100] flex items-center gap-3 rounded-xl border border-green-200 bg-white px-4 py-3 shadow-lg">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 text-green-700">
        <Sparkles className="h-5 w-5" />
      </span>
      <div>
        <div className="text-lg font-bold text-green-700">+{toast.amount} XP</div>
        <div className="text-xs text-muted-foreground">{toast.label}</div>
      </div>
    </div>
  );
}
