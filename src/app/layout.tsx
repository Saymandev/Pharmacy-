import type { Metadata } from "next";
import { connection } from "next/server";
import { AuthProvider } from "@/components/providers/auth-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { LanguageProvider } from "@/lib/i18n/language-provider";
import "./globals.css";
import "./workspace-overrides.css";
import "./modern-pharmacy.css";
import "./appearance.css";
import "./receipts.css";
import "./controls.css";
import "./pos-dialogs.css";
import "./financial-workspaces.css";
import "./administration.css";
import "./hr-setup.css";
import "./operations-dialogs.css";
import "./sales-suppliers.css";
import "./finance-ledger.css";
import "./supplier-returns.css";
import "./pos-cart.css";
import "./pos-productivity.css";
import "./review-permissions.css";
import "./receipt-settlement.css";
import "./due-branding.css";
import "./report-experience.css";
import "./notifications.css";
import "./skeleton.css";

export const metadata: Metadata = {
  title: "Pharmacy POS | Pharmacy operations",
  description: "A clear, secure workspace for pharmacy operations.",
  icons: { icon: "/pharmacy-mark.svg" },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  await connection();
  const saasMode = process.env.SAAS_RUNTIME_ENABLED === "true";
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <head><script dangerouslySetInnerHTML={{__html:`try{var p=localStorage.getItem('pharmacy.theme');var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';document.documentElement.style.colorScheme=d?'dark':'light';document.documentElement.lang=localStorage.getItem('pharmacy.language')==='bn'?'bn':'en';}catch(e){}`}}/></head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider><LanguageProvider><AuthProvider saasMode={saasMode}>{children}</AuthProvider></LanguageProvider></ThemeProvider>
      </body>
    </html>
  );
}
