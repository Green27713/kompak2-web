import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PixSnug™ — Compress Images & Videos Free",
  description: "Compress JPEG, PNG, WebP, HEIC images and MP4 videos instantly. Free, private, no signup required. Files never leave your browser.",
  keywords: "image compression, compress images, reduce image size, WebP converter, free image compressor, PNG compressor, JPEG compressor",
  openGraph: {
    title: "PixSnug™ — Compress Images & Videos Free",
    description: "Compress images and videos instantly. Free, private, no signup. Files never leave your browser.",
    url: "https://pixsnug.com",
    siteName: "PixSnug",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PixSnug™ — Compress Images & Videos Free",
    description: "Compress images and videos instantly. Free, private, no signup. Files never leave your browser.",
  },
  metadataBase: new URL("https://pixsnug.com"),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={geist.className}>{children}</body>
    </html>
  );
}
