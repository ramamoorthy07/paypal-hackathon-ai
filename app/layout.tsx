import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppMobileNav, AppSidebar, AppTopBar } from "@/components/app-shell";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PayPilot",
  description: "AI freelancer payment agent for PayPal sandbox invoicing.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const t = localStorage.getItem('paypilot_theme') || 'dark';
                if (t === 'dark') {
                  document.documentElement.classList.add('dark');
                  document.documentElement.setAttribute('data-theme', 'dark');
                } else {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.setAttribute('data-theme', 'light');
                }
              } catch {}
            `,
          }}
        />
      </head>
      <body className="h-full">
        <div className="flex h-full bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
          <AppSidebar />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <AppMobileNav />
            <div className="hidden shrink-0 md:block">
              <AppTopBar />
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
          </div>
        </div>
      </body>
    </html>
  );
}
