import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Resume Tailor — ATS Optimizer",
  description:
    "Tailor your resume to any job description with a dual-engine Gemini ATS audit.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
