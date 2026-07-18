import Link from "next/link";
import { EmailAuthForm } from "@/components/auth/email-auth-form";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md border-border/60 bg-card/80 backdrop-blur">
        <CardHeader className="space-y-2 text-center">
          <p className="text-sm font-medium tracking-wide text-muted-foreground">
            StudySync
          </p>
          <CardTitle className="text-2xl">Start studying smarter</CardTitle>
          <CardDescription>
            Upload a lecture and get notes, flashcards, and quizzes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <OAuthButtons />
          <div className="relative">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
              or email
            </span>
          </div>
          <EmailAuthForm mode="signup" />
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
