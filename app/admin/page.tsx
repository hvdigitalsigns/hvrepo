"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "react-hot-toast";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutGrid,
  Film,
  Monitor,
  Settings,
  Bell,
  User,
  UploadCloud,
  RefreshCw,
  X,
  Plus,
  WifiOff,
  Search,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Screen = {
  id: string;
  name: string | null;
  user_id: string | null;
  pairing_code: string | null;
  is_paired: boolean | null;
  content_type: string | null;
  current_content_url: string | null;
  last_ping?: string | null;
};

type MediaItem = {
  path: string;
  name: string;
  publicUrl: string;
  kind: "video" | "image";
};

function getUrlExt(url: string) {
  const clean = url.split("?")[0].toLowerCase();
  const parts = clean.split(".");
  if (parts.length < 2) return "";
  return parts[parts.length - 1] ?? "";
}

function inferKind(url: string | null): "video" | "image" | null {
  if (!url) return null;
  const ext = getUrlExt(url);
  if (ext === "mp4") return "video";
  if (ext === "png" || ext === "jpg" || ext === "jpeg") return "image";
  return "image";
}

const bentoContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.06 },
  },
};

const bentoItem = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 380, damping: 28 },
  },
};

export default function AdminPage() {
  const router = useRouter();
  const [screens, setScreens] = useState<Screen[]>([]);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isPairModalOpen, setIsPairModalOpen] = useState(false);
  const [isPickerModalOpen, setIsPickerModalOpen] = useState(false);
  const [targetScreenId, setTargetScreenId] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState("");
  const [isDragActive, setIsDragActive] = useState(false);
  const [quickUploadProgress, setQuickUploadProgress] = useState(0);
  const quickProgressTimerRef = useRef<number | null>(null);
  const quickUploadInputRef = useRef<HTMLInputElement | null>(null);

  const hasSupabaseConfig = useMemo(() => {
    return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  }, []);

  async function loadScreens(targetUserId: string) {
    const { data, error } = await supabase
      .from("screens")
      .select("id,name,user_id,pairing_code,is_paired,content_type,current_content_url,last_ping")
      .eq("user_id", targetUserId)
      .limit(200);

    if (error) {
      toast.error(error.message);
      return;
    }
    setScreens((data ?? []) as Screen[]);
  }

  async function loadMediaLibrary() {
    const { data, error } = await supabase.storage.from("media").list("", {
      limit: 100,
      sortBy: { column: "created_at", order: "desc" },
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    const items = (data ?? [])
      .filter((item) => Boolean(item.name))
      .map((item) => {
        const path = item.name;
        const kind = inferKind(path) === "video" ? "video" : "image";
        const { data: pub } = supabase.storage.from("media").getPublicUrl(path);
        return {
          path,
          name: item.name,
          publicUrl: pub.publicUrl,
          kind,
        } as MediaItem;
      });

    setMediaItems(items);
  }

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setCheckingAuth(false);
      setLoading(false);
      return;
    }
    let mounted = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (!mounted) return;
      if (error || !data.user) {
        router.replace("/login");
        setCheckingAuth(false);
        return;
      }
      setUserId(data.user.id);
      Promise.all([loadScreens(data.user.id), loadMediaLibrary()]).finally(() => {
        setCheckingAuth(false);
        setLoading(false);
      });
    });
    return () => {
      mounted = false;
    };
  }, [hasSupabaseConfig, router]);

  async function quickUpload(file: File) {
    setQuickUploadProgress(7);
    quickProgressTimerRef.current = window.setInterval(() => {
      setQuickUploadProgress((prev) => Math.min(prev + 6, 90));
    }, 220);
    const toastId = toast.loading("Uploading media…");
    const storagePath = `${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("media").upload(storagePath, file, {
      contentType: file.type,
      upsert: true,
    });
    if (error) {
      if (quickProgressTimerRef.current) {
        window.clearInterval(quickProgressTimerRef.current);
        quickProgressTimerRef.current = null;
      }
      setQuickUploadProgress(0);
      toast.error(error.message, { id: toastId });
      return;
    }
    if (quickProgressTimerRef.current) {
      window.clearInterval(quickProgressTimerRef.current);
      quickProgressTimerRef.current = null;
    }
    setQuickUploadProgress(100);
    toast.success("Uploaded to media library", { id: toastId });
    await loadMediaLibrary();
    window.setTimeout(() => setQuickUploadProgress(0), 500);
  }

  async function pairDevice() {
    const code = pairingCode.trim();
    if (!/^\d{6}$/.test(code)) {
      toast.error("Enter a valid 6-digit code.");
      return;
    }
    if (!userId) return;

    const toastId = toast.loading("Pairing device…");
    const { data: existing, error: lookupError } = await supabase
      .from("screens")
      .select("id")
      .eq("pairing_code", code)
      .single();

    if (lookupError || !existing?.id) {
      toast.error("Pairing code not found.", { id: toastId });
      return;
    }

    const { error: pairError } = await supabase
      .from("screens")
      .update({ user_id: userId, is_paired: true })
      .eq("id", existing.id);

    if (pairError) {
      toast.error(pairError.message, { id: toastId });
      return;
    }

    toast.success("Device paired.", { id: toastId });
    setPairingCode("");
    setIsPairModalOpen(false);
    await loadScreens(userId);
  }

  async function updateName(screenId: string, nextName: string) {
    const safeName = nextName.trim();
    const { error } = await supabase.from("screens").update({ name: safeName }).eq("id", screenId);
    if (error) {
      toast.error(error.message);
      return;
    }
    setScreens((prev) =>
      prev.map((screen) => (screen.id === screenId ? { ...screen, name: safeName } : screen))
    );
  }

  async function pushToAllScreens(item: MediaItem) {
    if (!userId) return;
    const toastId = toast.loading("Pushing to all screens…");
    const contentType = item.kind === "video" ? "video" : "image";
    const { error } = await supabase
      .from("screens")
      .update({ current_content_url: item.publicUrl, content_type: contentType })
      .eq("user_id", userId);

    if (error) {
      toast.error(error.message, { id: toastId });
      return;
    }
    toast.success("Pushed to all screens", { id: toastId });
    await loadScreens(userId);
  }

  async function pushToSingleScreen(item: MediaItem, screenId: string) {
    const contentType = item.kind === "video" ? "video" : "image";
    const { error } = await supabase
      .from("screens")
      .update({ current_content_url: item.publicUrl, content_type: contentType })
      .eq("id", screenId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Screen updated");
    if (userId) await loadScreens(userId);
  }

  async function nudgeScreen(screenId: string) {
    const { error } = await supabase
      .from("screens")
      .update({ last_ping: new Date().toISOString() })
      .eq("id", screenId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Refresh signal sent");
    setScreens((prev) =>
      prev.map((screen) =>
        screen.id === screenId ? { ...screen, last_ping: new Date().toISOString() } : screen
      )
    );
  }

  function onPickFile(screenId: string) {
    setTargetScreenId(screenId);
    setIsPickerModalOpen(true);
  }

  function onQuickUploadChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    quickUpload(file).catch(() => toast.error("Upload failed"));
  }

  function isOnline(lastPing: string | null | undefined) {
    if (!lastPing) return false;
    const ms = new Date(lastPing).getTime();
    if (Number.isNaN(ms)) return false;
    return Date.now() - ms < 1000 * 60 * 3;
  }

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F7F5] font-[family-name:var(--font-inter)] text-[#333]">
        Loading…
      </div>
    );
  }

  const displayCount = loading ? "—" : String(Math.max(screens.length, 0));
  const syncHealth = "99.9%";

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#F8F7F5] font-[family-name:var(--font-inter)] text-[#1a1a1a] antialiased">
      {/* Fixed sidebar — 280px */}
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-[280px] flex-col border-r border-[#e8e5df] bg-[#faf9f7] px-4 py-8">
        <nav className="flex flex-1 flex-col gap-1">
          <button
            type="button"
            className="flex items-center gap-3 rounded-xl bg-white px-3 py-3 text-sm font-medium text-[#C5A059] shadow-[0_1px_8px_rgba(0,0,0,0.04)]"
          >
            <LayoutGrid className="h-5 w-5 shrink-0 text-[#C5A059]" strokeWidth={1.75} />
            Dashboard
          </button>
          <button
            type="button"
            className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-[#8a847a] transition hover:bg-white/80"
          >
            <Film className="h-5 w-5 shrink-0 text-[#a39e94]" strokeWidth={1.5} />
            Media Library
          </button>
          <button
            type="button"
            className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-[#8a847a] transition hover:bg-white/80"
          >
            <Monitor className="h-5 w-5 shrink-0 text-[#a39e94]" strokeWidth={1.5} />
            Screens
          </button>
          <button
            type="button"
            className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-[#8a847a] transition hover:bg-white/80"
          >
            <Settings className="h-5 w-5 shrink-0 text-[#a39e94]" strokeWidth={1.5} />
            Settings
          </button>
        </nav>
        <div className="mt-auto flex items-center gap-3 rounded-2xl bg-[#EEECE8] px-4 py-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ddd8cf]">
            <User className="h-5 w-5 text-[#5c574e]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[#2a2723]">Curator Workspace</div>
            <div className="text-xs text-[#7a766d]">Premium Access</div>
          </div>
        </div>
      </aside>

      <div className="pl-[280px]">
        {/* Global header */}
        <header className="sticky top-0 z-30 border-b border-[#e8e5df] bg-[#F8F7F5]/90 backdrop-blur-md">
          <div className="mx-auto flex h-[72px] max-w-[1200px] items-center gap-6 px-6 lg:px-8">
            <div className="font-[family-name:var(--font-playfair),Georgia,serif] text-[22px] font-semibold tracking-tighter text-[#C5A059]">
              MONARCH OS
            </div>
            <div className="relative hidden min-w-0 flex-1 md:block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a958c]" />
              <input
                type="search"
                placeholder="Search library, screens, events…"
                className="w-full rounded-full border border-transparent bg-[#EEECE8] py-2.5 pl-11 pr-4 text-sm text-[#333] placeholder:text-[#9a958c] outline-none transition focus:border-[#e0dcd4] focus:bg-white"
                aria-label="Search"
              />
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => setIsPairModalOpen(true)}
                className="rounded-full bg-[#C5A059] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_2px_12px_rgba(197,160,89,0.35)] transition hover:opacity-95"
              >
                Pair Screen
              </button>
              <button
                type="button"
                className="relative rounded-full p-2 text-[#555] transition hover:bg-[#ebe8e2]"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" strokeWidth={1.75} />
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#C5A059] ring-2 ring-[#F8F7F5]" />
              </button>
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#ddd6c9] bg-white shadow-sm"
                aria-hidden
              >
                <User className="h-5 w-5 text-[#666]" strokeWidth={1.5} />
              </div>
            </div>
          </div>
          <div className="border-t border-[#e8e5df] px-6 py-3 md:hidden">
            <div className="relative mx-auto max-w-[1200px]">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a958c]" />
              <input
                type="search"
                placeholder="Search…"
                className="w-full rounded-full border border-transparent bg-[#EEECE8] py-2.5 pl-11 pr-4 text-sm outline-none"
                aria-label="Search"
              />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1200px] space-y-8 px-6 pb-32 pt-8 lg:px-8">
          {/* Bento hero */}
          <motion.div
            className="grid grid-cols-1 gap-6 lg:grid-cols-2"
            variants={bentoContainer}
            initial="hidden"
            animate="show"
          >
            <motion.div
              layout
              variants={bentoItem}
              className="rounded-[32px] bg-white p-8 shadow-[0_8px_40px_rgba(0,0,0,0.05)]"
            >
              <p className="text-xs font-medium uppercase tracking-widest text-[#888]">System Status</p>
              <h2 className="mt-4 font-[family-name:var(--font-playfair),Georgia,serif] text-xl font-semibold text-[#1a1a1a] md:text-2xl">
                Active Displays
              </h2>
              <p className="mt-2 font-[family-name:var(--font-inter)] text-7xl font-semibold tabular-nums leading-none tracking-tight text-[#1a1a1a] md:text-8xl">
                {displayCount}
              </p>
              <div className="mt-10 flex items-center gap-2.5 border-t border-[#f0ede6] pt-6 text-sm font-medium text-[#444]">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-55" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                Global Sync Health {syncHealth}
              </div>
            </motion.div>

            <motion.div layout variants={bentoItem} className="rounded-[32px] bg-white p-8 shadow-[0_8px_40px_rgba(0,0,0,0.05)]">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragActive(true);
                }}
                onDragLeave={() => setIsDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragActive(false);
                  const file = e.dataTransfer.files?.[0];
                  if (!file) return;
                  quickUpload(file).catch(() => toast.error("Upload failed"));
                }}
                className={`flex min-h-[280px] flex-col items-center justify-center rounded-[32px] border-2 border-dashed px-6 py-12 text-center transition-colors ${
                  isDragActive ? "border-[#C5A059] bg-[#fffdf9]" : "border-[#E5E7EB] bg-[#fafaf8]"
                }`}
              >
                <div className="mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#f3efe8]">
                  <UploadCloud className="h-9 w-9 text-[#C5A059]" strokeWidth={1.4} />
                </div>
                <p className="max-w-sm text-lg font-semibold text-[#2a2723]">Drag &amp; Drop your 4K Wedding Video</p>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-[#6b6560]">
                  MP4, MOV, ProRes — upload cinematic content to your canvas.
                </p>
                <button
                  type="button"
                  onClick={() => quickUploadInputRef.current?.click()}
                  className="mt-8 rounded-full border border-[#d1cdc4] bg-transparent px-8 py-2.5 text-sm font-semibold text-[#4a4640] transition hover:bg-[#f5f3ef]"
                >
                  SELECT FILES
                </button>
                <div className="mt-6 h-1 w-full max-w-xs overflow-hidden rounded-full bg-[#ece8df]">
                  <motion.div
                    className="h-full bg-[#C5A059]"
                    layout
                    initial={{ width: 0 }}
                    animate={{ width: `${quickUploadProgress}%` }}
                    transition={{ duration: 0.2 }}
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>

          <input
            ref={quickUploadInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={onQuickUploadChange}
          />

          {/* Active curator — screens */}
          <motion.section layout className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="font-[family-name:var(--font-playfair),Georgia,serif] text-2xl font-semibold text-[#1a1a1a]">
                Current Gallery Screens
              </h2>
              <button
                type="button"
                className="rounded-full bg-[#E5E7EB] px-5 py-2.5 text-sm font-medium text-[#444] transition hover:bg-[#dcdad6]"
              >
                Filter
              </button>
            </div>

            <div className="space-y-4">
              {screens.length === 0 && !loading ? (
                <p className="text-sm text-[#777]">No screens yet. Pair a display to get started.</p>
              ) : null}
              {screens.map((screen, idx) => {
                const online = isOnline(screen.last_ping);
                const displayName = screen.name?.trim() || "Screen";
                const filename =
                  screen.current_content_url?.split("/").pop()?.split("?")[0] ?? "—";
                const loc =
                  idx === 0
                    ? "Main Hall • Portrait"
                    : idx === 1
                      ? "South Wing • Landscape"
                      : "2nd Floor • Portrait";
                return (
                  <motion.div
                    key={screen.id}
                    layout
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    className={`rounded-[24px] border border-[#ebe8e2] bg-white p-5 shadow-[0_4px_24px_rgba(0,0,0,0.04)] ${!online ? "opacity-[0.72]" : ""}`}
                  >
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:gap-6">
                      <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-xl bg-[#e8e4dc] lg:w-[220px]">
                        {!online ? (
                          <div className="flex h-full min-h-[120px] w-full flex-col items-center justify-center">
                            <WifiOff className="h-9 w-9 text-[#9a958c]" strokeWidth={1.5} />
                          </div>
                        ) : screen.current_content_url ? (
                          inferKind(screen.current_content_url) === "video" ? (
                            <video
                              src={screen.current_content_url}
                              className="h-full w-full object-cover"
                              muted
                              playsInline
                              loop
                            />
                          ) : (
                            <Image
                              src={screen.current_content_url}
                              alt=""
                              width={440}
                              height={248}
                              className="h-full w-full object-cover"
                              unoptimized
                            />
                          )
                        ) : (
                          <div className="flex h-full min-h-[120px] items-center justify-center text-xs text-[#9a958c]">
                            No preview
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1 space-y-3">
                        <div>
                          <input
                            defaultValue={displayName}
                            onBlur={(e) =>
                              updateName(screen.id, e.target.value).catch(() => toast.error("Update failed"))
                            }
                            className="w-full border-none bg-transparent font-[family-name:var(--font-inter)] text-lg font-bold text-[#1a1a1a] outline-none placeholder:text-[#999]"
                          />
                          <p className="mt-0.5 text-sm text-[#6b6560]">{loc}</p>
                        </div>

                        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between lg:gap-6">
                          <span
                            className={`inline-flex items-center gap-2 text-sm font-semibold ${online ? "text-emerald-600" : "text-red-500"}`}
                          >
                            <span
                              className={`h-2.5 w-2.5 rounded-full ${online ? "bg-emerald-500" : "bg-red-500"}`}
                            />
                            {online ? "Online" : "Offline"}
                          </span>

                          {online ? (
                            <div className="min-w-0 flex flex-col gap-0.5 sm:flex-1 sm:px-2">
                              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#666]">
                                PLAYING NOW
                              </span>
                              <span className="truncate text-sm font-medium text-[#333]">{filename}</span>
                            </div>
                          ) : (
                            <span className="text-xs font-semibold uppercase tracking-wide text-red-500">
                              Check Connection
                            </span>
                          )}

                          <div className="flex items-center gap-2 sm:ml-auto">
                            <button
                              type="button"
                              onClick={() => nudgeScreen(screen.id).catch(() => toast.error("Refresh failed"))}
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e0dcd4] bg-[#faf9f7] text-[#555] transition hover:bg-white"
                              aria-label="Refresh"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </button>
                            {online ? (
                              <button
                                type="button"
                                onClick={() => onPickFile(screen.id)}
                                className="rounded-full bg-[#D9C8A9] px-4 py-2 text-sm font-semibold text-[#2a2723] transition hover:opacity-95"
                              >
                                Change Content
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled
                                className="cursor-not-allowed rounded-full bg-[#e8e4dc] px-4 py-2 text-sm font-semibold text-red-600"
                              >
                                Check Connection
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.section>

          {/* Media gallery */}
          <motion.section layout className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-[#888]">
                Recently Curated Media
              </h3>
              <button type="button" className="text-sm font-semibold text-[#C5A059] hover:underline">
                View All
              </button>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {mediaItems.slice(0, 3).map((item) => (
                <motion.article
                  key={item.path}
                  layout
                  whileHover={{ y: -3 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden rounded-[24px] border border-[#ebe8e2] bg-[#fafaf8] shadow-[0_4px_20px_rgba(0,0,0,0.04)]"
                >
                  <div className="relative aspect-video overflow-hidden rounded-[24px] bg-[#e8e4dc]">
                    {item.kind === "video" ? (
                      <video src={item.publicUrl} className="h-full w-full object-cover" muted playsInline />
                    ) : (
                      <Image
                        src={item.publicUrl}
                        alt={item.name}
                        width={400}
                        height={225}
                        className="h-full w-full object-cover"
                        unoptimized
                      />
                    )}
                    <div className="absolute right-3 top-3 rounded-full bg-black/75 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                      {item.kind === "video" ? "4K • 0:45" : "IMG • Static"}
                    </div>
                  </div>
                  <div className="p-5 pt-4">
                    <div className="font-bold text-[#1a1a1a]">{item.name}</div>
                    <div className="mt-1 text-sm text-[#777]">Added 2 hours ago</div>
                    <button
                      type="button"
                      onClick={() => pushToAllScreens(item).catch(() => toast.error("Push failed"))}
                      className="mt-5 w-full rounded-full bg-[#D9C8A9] py-3 text-sm font-semibold text-[#2a2723] transition hover:opacity-95"
                    >
                      Push to All Screens
                    </button>
                  </div>
                </motion.article>
              ))}
              {mediaItems.length === 0 && (
                <p className="col-span-full text-sm text-[#777]">Upload files to populate your gallery.</p>
              )}
            </div>
          </motion.section>
        </main>
      </div>

      <button
        type="button"
        onClick={() => quickUploadInputRef.current?.click()}
        className="fixed bottom-8 right-8 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#C5A059] text-white shadow-[0_8px_28px_rgba(197,160,89,0.45)] transition hover:opacity-95"
        aria-label="Add media"
      >
        <Plus className="h-7 w-7 stroke-[2.5]" />
      </button>

      <AnimatePresence>
        {isPairModalOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="w-full max-w-md rounded-2xl border border-[#e5e0d5] bg-white p-6 shadow-xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Pair Screen</h3>
                <button type="button" onClick={() => setIsPairModalOpen(false)} className="rounded-lg p-1 hover:bg-[#f5f5f5]">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mb-4 text-sm text-[#666]">Enter the 6-digit code from your display.</p>
              <input
                value={pairingCode}
                onChange={(e) => setPairingCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full rounded-xl border border-[#ded8cd] bg-[#faf9f7] px-4 py-3 text-center text-2xl tracking-[0.35em] outline-none focus:border-[#C5A059]"
                placeholder="••••••"
              />
              <button
                type="button"
                onClick={() => pairDevice().catch(() => toast.error("Pairing failed"))}
                className="mt-4 w-full rounded-full bg-[#C5A059] py-3 text-sm font-semibold text-white"
              >
                Pair Screen
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {isPickerModalOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-[#e5e0d5] bg-white shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-[#eee] px-5 py-4">
                <div>
                  <div className="font-semibold">Change Content</div>
                  <div className="text-sm text-[#666]">Select from gallery</div>
                </div>
                <button type="button" onClick={() => setIsPickerModalOpen(false)} className="rounded-lg p-1 hover:bg-[#f5f5f5]">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto p-4 md:grid-cols-3">
                {mediaItems.map((item) => (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => {
                      if (!targetScreenId) return;
                      pushToSingleScreen(item, targetScreenId).finally(() => setIsPickerModalOpen(false));
                    }}
                    className="rounded-xl border border-[#ebe8e2] p-2 text-left transition hover:bg-[#faf9f7]"
                  >
                    <div className="relative aspect-video overflow-hidden rounded-lg bg-[#e8e4dc]">
                      {item.kind === "video" ? (
                        <video src={item.publicUrl} className="h-full w-full object-cover" muted playsInline />
                      ) : (
                        <Image
                          src={item.publicUrl}
                          alt=""
                          width={200}
                          height={112}
                          className="h-full w-full object-cover"
                          unoptimized
                        />
                      )}
                    </div>
                    <div className="mt-2 truncate text-xs text-[#555]">{item.name}</div>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
