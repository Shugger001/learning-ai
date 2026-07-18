import Link from "next/link";
import Image from "next/image";
import { EmailAuthForm } from "@/components/auth/email-auth-form";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { Separator } from "@/components/ui/separator";

const SIDE_IMAGE =
  "https://images.unsplash.com/photo-1456513080880-7d93aaa2daf8?auto=format&fit=crop&w=1600&q=80";

export default function SignupPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden lg:block">
        <Image
          src={SIDE_IMAGE}
          alt="Open books prepared for studying"
          fill
          className="object-cover"
          sizes="50vw"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(222_47%_6%/0.85)] via-[hsl(222_40%_8%/0.35)] to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-10">
          <p className="font-display text-3xl font-semibold tracking-tight text-white">
            StudySync
          </p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/70">
            Upload a lecture. Leave with notes, flashcards, and quizzes.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-2 lg:space-y-3">
            <p className="font-display text-sm font-semibold tracking-tight text-primary lg:hidden">
              StudySync
            </p>
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              Start studying smarter
            </h1>
            <p className="text-muted-foreground">
              Create an account and turn your next lecture into practice.
            </p>
          </div>

          <div className="space-y-6">
            <OAuthButtons />
            <div className="relative">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
                or email
              </span>
            </div>
            <EmailAuthForm mode="signup" />
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
