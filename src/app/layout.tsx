import type { Metadata } from "next";
import { Geist_Mono, Montserrat, Noto_Sans_Lao } from "next/font/google";
import "./globals.css";

// TMS brand face for Latin text; Noto Sans Lao carries the Lao script.
const brandSans = Montserrat({
  variable: "--font-brand-sans",
  subsets: ["latin"],
  display: "swap",
});

const notoLao = Noto_Sans_Lao({
  variable: "--font-noto-lao",
  subsets: ["lao", "latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ODIEN GROUP · ລະບົບຈັດການສິນຄ້າ",
  description: "ລະບົບຈັດການສິນຄ້າ ODIEN GROUP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="lo"
      className={`${brandSans.variable} ${notoLao.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
