import Link from "next/link";
import { Bell, CircleUserRound, Monitor, Settings, LayoutDashboard, Images, RefreshCw } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f3f3f2] text-[#222] overflow-hidden">
      <div className="h-screen w-full flex flex-col">
        <header className="h-16 border-b border-[#e4e1d9] bg-[#f7f7f5] px-6 flex items-center justify-between">
          <div className="[font-family:var(--font-playfair),Georgia,serif] text-[34px] tracking-tight">Galacreate</div>
          <div className="hidden md:flex items-center gap-8 text-[11px] tracking-[0.16em] uppercase text-[#69645c]">
            <span className="text-[#2a2723]">Dashboard</span>
            <span>Media Library</span>
            <span>Screens</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="rounded-full bg-[#b89446] text-white px-5 py-2 text-sm font-medium shadow-[0_8px_16px_rgba(184,148,70,0.3)]"
            >
              Pair Screen
            </Link>
            <Bell className="h-4 w-4 text-[#4d4a45]" />
            <CircleUserRound className="h-5 w-5 text-[#4d4a45]" />
          </div>
        </header>

        <div className="flex-1 grid grid-cols-[220px_1fr] gap-6 px-6 py-5">
          <aside className="rounded-[24px] bg-[#efefec] p-4 flex flex-col justify-between">
            <div>
              <div className="[font-family:var(--font-playfair),Georgia,serif] text-[34px] mb-1">Galacreate</div>
              <div className="text-sm text-[#7f7a71] mb-7">Digital Curator</div>
              <div className="space-y-2 text-sm">
                <div className="rounded-xl bg-white px-3 py-2 flex items-center gap-2"><LayoutDashboard className="h-4 w-4" /> Dashboard</div>
                <div className="rounded-xl px-3 py-2 flex items-center gap-2 text-[#676259]"><Images className="h-4 w-4" /> Media Library</div>
                <div className="rounded-xl px-3 py-2 flex items-center gap-2 text-[#676259]"><Monitor className="h-4 w-4" /> Screens</div>
                <div className="rounded-xl px-3 py-2 flex items-center gap-2 text-[#676259]"><Settings className="h-4 w-4" /> Settings</div>
              </div>
            </div>
            <div className="rounded-2xl bg-[#f6f5f1] px-3 py-3 text-sm text-[#5f5a52]">Curator Workspace<br /><span className="text-xs text-[#8b867d]">Premium Access</span></div>
          </aside>

          <section className="space-y-5 overflow-auto no-scrollbar">
            <div className="grid grid-cols-2 gap-5">
              <div className="rounded-[28px] bg-white border border-[#ebe7de] shadow-[0_8px_24px_rgba(0,0,0,0.05)] p-6">
                <div className="text-[11px] tracking-[0.2em] uppercase text-[#78736a] mb-4">Network Health</div>
                <div className="text-6xl leading-none">24 <span className="text-3xl">Active Screens</span></div>
                <div className="mt-4 text-[#1b7f61] text-sm">● System Online &amp; Optimized</div>
                <div className="mt-12 text-xs text-[#777269]">Last Update: Just Now</div>
              </div>
              <div className="rounded-[28px] bg-white border border-[#ebe7de] shadow-[0_8px_24px_rgba(0,0,0,0.05)] p-6">
                <div className="h-full rounded-2xl border-2 border-dashed border-[#ece7dd] flex items-center justify-center text-center">
                  <div>
                    <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-[#f1ede4] flex items-center justify-center text-[#6b655b]">↑</div>
                    <div className="text-3xl mb-2">Drag &amp; Drop your 4K Wedding Video</div>
                    <div className="text-[#7f7a71]">Upload cinematic content directly to your digital canvas.</div>
                    <button className="mt-5 rounded-full border border-[#d9d2c6] bg-white px-6 py-2 text-sm">Select Files</button>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] bg-white border border-[#ebe7de] shadow-[0_8px_24px_rgba(0,0,0,0.05)] p-6">
              <div className="text-[11px] tracking-[0.2em] uppercase text-[#78736a] mb-2">Active Curator View</div>
              <div className="text-5xl [font-family:var(--font-playfair),Georgia,serif] mb-5">Current Gallery Screens</div>
              <div className="space-y-3">
                {["Reception Entrance", "Grand Ballroom", "Bridal Suite"].map((name, i) => (
                  <div key={name} className="rounded-2xl bg-[#f8f7f3] border border-[#ece8df] p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-16 w-28 rounded-xl bg-[#d9d2c6]" />
                      <div>
                        <div className="text-2xl">{name}</div>
                        <div className="text-sm text-[#7d786f]">{i === 0 ? "Main Hall · Portrait Orientation" : i === 1 ? "South Wing · Landscape Ultra-Wide" : "2nd Floor · Portrait Orientation"}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-7">
                      <div className={`${i === 2 ? "text-red-500" : "text-emerald-500"} text-sm`}>● {i === 2 ? "Offline" : "Online"}</div>
                      <div className="text-sm text-[#6e695f]">{i === 2 ? "Check Connection" : i === 0 ? "Wedding_Welcome_4K.mp4" : "Evening_Gala_Slideshow.mov"}</div>
                      <button className="h-9 w-9 rounded-full border border-[#dfd8cc] flex items-center justify-center"><RefreshCw className="h-4 w-4" /></button>
                      <button className="rounded-full bg-[#b89446] text-white px-4 py-2 text-sm">Change Content</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] bg-white border border-[#ebe7de] shadow-[0_8px_24px_rgba(0,0,0,0.05)] p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-[11px] tracking-[0.2em] uppercase text-[#78736a]">Recently Curated Media</div>
                <button className="h-12 w-12 rounded-full bg-[#b89446] text-white text-2xl">+</button>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {["Cinematic_Highlights_V2.mp4", "Bridal_Portrait_Gallery.jpg", "Champagne_Toast_SlowMo.mp4"].map((item) => (
                  <div key={item} className="rounded-2xl bg-[#f8f7f3] border border-[#ece8df] p-3">
                    <div className="h-36 rounded-xl bg-[#d9d2c6]" />
                    <div className="mt-3 text-lg">{item}</div>
                    <div className="text-sm text-[#7f7a71] mt-1">Added recently</div>
                    <button className="mt-3 w-full rounded-full border border-[#ddd6c9] bg-white py-2 text-sm">Push to All Screens</button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
