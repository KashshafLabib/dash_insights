import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TakaPay Pulse — social sentiment for brand managers",
  description:
    "Audited multilingual social-media insight for TakaPay: sentiment, topics, competitor pressure and trends — with the data cleaned before it reaches you.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
