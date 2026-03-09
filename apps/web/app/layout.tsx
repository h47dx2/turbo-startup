import type { ReactNode } from "react";
import { Bricolage_Grotesque, DM_Sans, Roboto } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage"
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans"
});

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-roboto"
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${bricolage.variable} ${dmSans.variable} ${roboto.variable} antialiased`}>{children}</body>
    </html>
  );
}
