"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 3.4 14.7 2.4 12 2.4 6.9 2.4 2.8 6.5 2.8 11.6S6.9 20.8 12 20.8c6.9 0 8.3-5.1 8.3-7.6 0-.5 0-.9-.1-1.3H12z"
      />
      <path
        fill="#34A853"
        d="M3.9 7.4l3.2 2.3C8 7.6 9.9 6.4 12 6.4c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 3.4 14.7 2.4 12 2.4 8.3 2.4 5.1 4.5 3.9 7.4z"
      />
      <path
        fill="#FBBC05"
        d="M12 20.8c2.6 0 4.8-.9 6.4-2.4l-3.1-2.4c-.9.6-2 1-3.3 1-2.6 0-4.8-1.7-5.6-4.1l-3.2 2.5c1.3 2.9 4.3 4.9 8.8 4.9z"
      />
      <path
        fill="#4285F4"
        d="M20.3 11.9c0-.5 0-.9-.1-1.3H12v3.9h5.5c-.3 1.3-1.1 2.4-2.3 3.1v.1l3.1 2.4c1.8-1.7 2.9-4.1 2.9-7.1-.1-.4-.1-.7-.1-1.1z"
      />
    </svg>
  );
}

export function OAuthButtons() {
  const [loading, setLoading] = useState<"google" | "github" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(provider: "google" | "github") {
    setLoading(provider);
    setError(null);

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback`;

    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });

    if (authError) {
      setError(authError.message);
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={loading !== null}
        onClick={() => signIn("google")}
        aria-label="Continue with Google"
      >
        <GoogleIcon className="h-4 w-4" />
        {loading === "google" ? "Redirecting…" : "Continue with Google"}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={loading !== null}
        onClick={() => signIn("github")}
        aria-label="Continue with GitHub"
      >
        <GitHubIcon className="h-4 w-4" />
        {loading === "github" ? "Redirecting…" : "Continue with GitHub"}
      </Button>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
