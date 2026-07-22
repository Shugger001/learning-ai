import type { Metadata } from "next";
import { Bricolage_Grotesque, Manrope } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { RegisterServiceWorker } from "@/components/pwa/register-sw";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

export const metadata: Metadata = {
  title: "StudySync - Turn lectures into active recall",
  description:
    "Upload videos, PDFs, and audio. Get flashcards, quizzes, mind maps, and notes powered by AI.",
  applicationName: "StudySync",
  manifest: "/manifest.webmanifest",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1f6f54" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1f1a" },
  ],
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "StudySync",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${manrope.variable} ${bricolage.variable} font-sans antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <QueryProvider>
            {children}
            <RegisterServiceWorker />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
