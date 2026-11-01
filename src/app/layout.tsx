import type { Metadata } from "next";
import { AuthProvider } from "@/components/providers/auth-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { LanguageProvider } from "@/lib/i18n/language-provider";
import "./globals.css";
import "./workspace-overrides.css";
import "./modern-pharmacy.css";
import "./appearance.css";
import "./receipts.css";

export const metadata: Metadata = {
  title: "Pharmacy POS | Pharmacy operations",
  description: "A clear, secure workspace for pharmacy operations.",
  icons: { icon: "/pharmacy-mark.svg" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <head><script dangerouslySetInnerHTML={{__html:`try{var p=localStorage.getItem('pharmacy.theme');var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';document.documentElement.style.colorScheme=d?'dark':'light';document.documentElement.lang=localStorage.getItem('pharmacy.language')==='bn'?'bn':'en';}catch(e){}`}}/></head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider><LanguageProvider><AuthProvider>{children}</AuthProvider></LanguageProvider></ThemeProvider>
      </body>
    </html>
  );
}
