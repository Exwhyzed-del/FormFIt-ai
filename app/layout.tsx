import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FormFit AI — Train with better form",
  description: "Workout plans, exercise video guides, animated movement previews and live AI form coaching.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
