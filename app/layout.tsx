import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Galacreate | Digital Signage by HV Digital Signs",
  description: "Curate 4K content for every screen. Pair displays, sync your gallery, and beam moments live.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="min-h-screen bg-[#F8F7F5] text-[#1f1e1c] antialiased font-[family-name:var(--font-inter)]">
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            className:
              "bg-white text-[#1f1e1c] border border-[#ece7dd] shadow-[0_12px_32px_rgba(0,0,0,0.08)] rounded-xl",
          }}
        />
      </body>
    </html>
  );
}

