import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-black text-slate-100 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="text-3xl font-light tracking-tight">HVStudio</div>
        <p className="text-slate-300">Control Center and Player are ready.</p>
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 rounded border border-neutral-800 bg-neutral-950 px-4 py-2 text-sm text-slate-100 hover:bg-neutral-900"
          >
            Go to Control Center
          </Link>
        </div>
      </div>
    </main>
  );
}

