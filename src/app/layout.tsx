import type { Metadata } from "next";
import { AuthProvider } from "@/components/providers/auth-provider";
import { LanguageProvider } from "@/lib/i18n/language-provider";
import "./globals.css";
import "./workspace-overrides.css";
import "./modern-pharmacy.css";

export const metadata: Metadata = {
  title: "Pharmacy POS | Pharmacy operations",
  description: "A clear, secure workspace for pharmacy operations.",
  icons: { icon: "/pharmacy-mark.svg" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <LanguageProvider><AuthProvider>{children}</AuthProvider></LanguageProvider>
      </body>
    </html>
  );
}
