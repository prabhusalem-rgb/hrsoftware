import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ErrorBoundary } from "@/components/error/ErrorBoundary";
import { CompanyProvider } from "@/components/providers/CompanyProvider";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bright Flowers HR & Payroll",
  description:
    "Professional HR & Payroll management system designed by Kumaresan. Compliant with Oman Labour Law and Bank Muscat WPS standards.",
  keywords: ["Bright Flowers", "HR", "Payroll", "Oman", "WPS", "Bank Muscat", "Labour Law", "SaaS"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-background text-foreground text-sm lg:text-base antialiased">
        <QueryProvider>
          <ErrorBoundary>
            <CompanyProvider>
              {children}
            </CompanyProvider>
          </ErrorBoundary>
          <Toaster position="top-right" richColors closeButton />
        </QueryProvider>
      </body>
    </html>
  );
}
