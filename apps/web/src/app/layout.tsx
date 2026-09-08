import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Video Builder",
  description: "Turn a topic into a postable video in minutes.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
