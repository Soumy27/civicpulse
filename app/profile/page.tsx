"use client";

import Link from "next/link";
import Image from "next/image";
import { LogIn, LogOut, UserCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useIssues, useUserProfile } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CategoryBadge } from "@/components/shared/CategoryBadge";
import { BADGE_EMOJI, BADGE_LABELS } from "@/lib/xp";

export default function ProfilePage() {
  const { user, loading, signInGoogle, signInGuest, signOut } = useAuth();
  const { data: profile } = useUserProfile(user?.uid);
  const { data: allIssues } = useIssues();

  if (loading) {
    return <div className="mx-auto max-w-3xl px-4 py-10"><div className="shimmer h-40 rounded-xl" /></div>;
  }

  if (!user) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
        <UserCircle className="h-16 w-16 text-muted-foreground" />
        <h1 className="text-xl font-bold">Sign in to CivicPulse</h1>
        <p className="text-sm text-muted-foreground">
          Track your reports, earn XP, and climb the ward leaderboard.
        </p>
        <div className="flex w-full flex-col gap-2">
          <Button onClick={signInGoogle} size="lg">
            <LogIn className="h-4 w-4" /> Continue with Google
          </Button>
          <Button onClick={signInGuest} variant="outline" size="lg">
            Continue as guest
          </Button>
        </div>
      </div>
    );
  }

  const xp = profile?.xp ?? 0;
  const badge = profile?.badge ?? "newcomer";
  const reported = allIssues.filter((i) => i.reporterId === user.uid);
  const verified = allIssues.filter((i) => i.verifierIds.includes(user.uid));

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-5">
          {user.photoURL ? (
            <Image
              src={user.photoURL}
              alt="avatar"
              width={64}
              height={64}
              className="rounded-full"
              unoptimized
            />
          ) : (
            <UserCircle className="h-16 w-16 text-muted-foreground" />
          )}
          <div className="flex-1">
            <h1 className="text-xl font-bold">{user.displayName ?? "Guest Citizen"}</h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="default">{xp} XP</Badge>
              <Badge variant="amber">
                {BADGE_EMOJI[badge]} {BADGE_LABELS[badge]}
              </Badge>
            </div>
          </div>
          <Button variant="ghost" onClick={signOut}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your reports ({reported.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {reported.map((i) => (
              <Link
                key={i.id}
                href={`/issue/${i.id}`}
                className="flex items-center justify-between rounded-lg border p-2.5 hover:bg-accent"
              >
                <CategoryBadge category={i.category} />
                <StatusBadge status={i.status} />
              </Link>
            ))}
            {reported.length === 0 && (
              <p className="text-sm text-muted-foreground">No reports yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Verified by you ({verified.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {verified.map((i) => (
              <Link
                key={i.id}
                href={`/issue/${i.id}`}
                className="flex items-center justify-between rounded-lg border p-2.5 hover:bg-accent"
              >
                <CategoryBadge category={i.category} />
                <StatusBadge status={i.status} />
              </Link>
            ))}
            {verified.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing verified yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">XP history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          {reported.map((i) => (
            <div key={`r-${i.id}`} className="flex justify-between border-b py-1.5">
              <span className="text-muted-foreground">Reported {i.category.replace("_", " ")}</span>
              <span className="font-medium text-green-600">+10 XP</span>
            </div>
          ))}
          {verified.map((i) => (
            <div key={`v-${i.id}`} className="flex justify-between border-b py-1.5">
              <span className="text-muted-foreground">Verified {i.category.replace("_", " ")}</span>
              <span className="font-medium text-green-600">+5 XP</span>
            </div>
          ))}
          {reported.length === 0 && verified.length === 0 && (
            <p className="text-muted-foreground">Earn XP by reporting and verifying issues.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
