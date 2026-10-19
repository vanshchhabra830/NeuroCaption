import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "NeuroCaption",
  description:
    "Convert Hindi audio to accurate SRT subtitles using Whisper Large v2 — fully offline and local.",
  keywords: ["Hindi captions", "SRT generator", "Whisper", "subtitle generator", "Hindi transcription"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hi" className={inter.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600&family=Bebas+Neue&family=Poppins:wght@400;600;700;900&family=Montserrat:wght@400;600;700;900&family=Oswald:wght@400;600;700&family=Bangers&family=Pacifico&family=Playfair+Display:wght@400;700;900&family=Space+Grotesk:wght@400;600;700&family=Press+Start+2P&family=Raleway:wght@400;700;900&family=Anton&family=DM+Sans:wght@400;700;900&family=Cormorant+Garamond:ital,wght@0,400;0,700;1,400&family=Righteous&family=Permanent+Marker&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
