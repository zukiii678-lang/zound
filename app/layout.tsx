import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "ZOUND — Sound library for editors", description: "A curated library of copyright safe sounds for video editing." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
