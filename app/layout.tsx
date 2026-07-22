import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthShell } from "@/components/auth/auth-shell";
import { getCurrentProfile } from "@/lib/auth/server";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Engineer",
  description: "Sistema de calidad industrial.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const profile = await getCurrentProfile();

  return (
    <html lang="es">
      <body className={`${geist.variable} ${geistMono.variable}`}>
        <AuthShell profile={profile}>{children}</AuthShell>
      </body>
    </html>
  );
}
