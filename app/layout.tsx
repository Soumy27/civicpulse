import type { Metadata } from "next";
import "./globals.css";
import { NavBar } from "@/components/shared/NavBar";
import { AuthProvider } from "@/lib/auth-context";
import { XpToastHost } from "@/components/shared/XpToast";

export const metadata: Metadata = {
  title: "CivicPulse — Report once. The AI handles the rest.",
  description:
    "Autonomous AI civic-issue resolution: predictive hotspot alerts, a self-correcting Resolution Agent, and a live city Civic Score.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <AuthProvider>
          <NavBar />
          <main className="min-h-[calc(100vh-3.5rem)]">{children}</main>
          <XpToastHost />
        </AuthProvider>
      </body>
    </html>
  );
}
