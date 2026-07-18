import Link from "next/link";
import { ArrowRight, Brain, Layers, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <header className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <span className="text-lg font-semibold tracking-tight">StudySync</span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/signup">Get started</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col px-4 pb-24 pt-16 sm:px-6 sm:pt-24">
        <div className="max-w-2xl space-y-6">
          <p className="text-sm font-medium text-muted-foreground">
            Active recall, automated
          </p>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
            StudySync
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Drop a lecture video or PDF. Get notes, flashcards, quizzes, and a
            mind map — ready for spaced practice in minutes.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/signup">
                Get started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/login">I already have an account</Link>
            </Button>
          </div>
        </div>

        <ul className="mt-20 grid gap-8 sm:grid-cols-3">
          {[
            {
              icon: Sparkles,
              title: "Ingest anything",
              body: "Video, PDF, audio, or pasted text — transcribed and structured automatically.",
            },
            {
              icon: Layers,
              title: "Study surfaces",
              body: "Notes, flip-deck flashcards, MCQ quizzes, and hierarchical mind maps.",
            },
            {
              icon: Brain,
              title: "Built for recall",
              body: "Mark Easy/Hard on cards and edit AI output so your deck stays accurate.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <li key={title} className="space-y-2">
              <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
              <h2 className="font-medium">{title}</h2>
              <p className="text-sm text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
