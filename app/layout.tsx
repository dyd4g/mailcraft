import './campaigns.css';
import './auth.css';
import type { Metadata } from "next";
import "./globals.css";
import "./gallery.css";

export const metadata: Metadata = {
  title: "Mailcraft — Email Design Studio",
  description: "A reusable email design system for every client.",
  icons: {
    icon: "/favicon-mailcraft.svg",
    shortcut: "/favicon-mailcraft.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

