import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#F5F5F7] text-[#1f1e1c] no-scrollbar overflow-auto">
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-12 md:py-16">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-12 md:mb-16 border-b border-[#e7e4dd] pb-8">
          <div>
            <h1 className="text-4xl md:text-5xl tracking-tight [font-family:var(--font-playfair),Georgia,serif]">
              Galacreate
            </h1>
            <p className="mt-2 text-sm text-[#7a766d]">Powered by HV Digital Signs</p>
          </div>
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-full border border-[#C5A059] bg-[#C5A059] text-white px-6 py-3 text-sm font-medium shadow-[0_8px_20px_rgba(197,160,89,0.28)] hover:opacity-90 transition-opacity"
          >
            Open Control Center
          </Link>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <div className="rounded-[28px] bg-white shadow-[0_12px_32px_rgba(0,0,0,0.07)] border border-[#eceaf0] p-8">
            <p className="text-xs uppercase tracking-[0.2em] text-[#807b73] mb-2">Welcome</p>
            <p className="text-lg text-[#3d3a35] leading-relaxed">
              Pair your displays, curate your gallery, and push 4K content to every screen—instantly.
            </p>
          </div>
          <div className="rounded-[28px] bg-white shadow-[0_12px_32px_rgba(0,0,0,0.07)] border border-[#eceaf0] p-8 flex flex-col justify-center">
            <p className="text-xs uppercase tracking-[0.2em] text-[#807b73] mb-3">Next step</p>
            <Link
              href="/admin"
              className="text-[#C5A059] font-medium inline-flex items-center gap-2 hover:underline"
            >
              Go to dashboard
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>

        <p className="text-center text-sm text-[#9a958c]">
          TV receivers use <code className="text-[#5c574e] bg-[#ece8df] px-1.5 py-0.5 rounded">/player/[id]</code> after pairing.
        </p>
      </div>
    </main>
  );
}
