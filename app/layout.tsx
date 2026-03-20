import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "HVStudio",
  description: "Digital Signage System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-black text-slate-100 antialiased font-light tracking-tight overflow-hidden">
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            className: "bg-neutral-950 text-slate-100 border border-neutral-800",
          }}
        />
      </body>
    </html>
  );
}

