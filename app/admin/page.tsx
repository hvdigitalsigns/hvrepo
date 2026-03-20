"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "react-hot-toast";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard,
  Film,
  Monitor,
  Settings,
  Bell,
  User,
  Network,
  CloudUpload,
  RefreshCw,
  X,
  Plus,
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
      <div className="min-h-screen bg-monarch-bg text-[#333] flex items-center justify-center font-light">
        Loading…
      </div>
    );
  }

  const displayCount = loading ? "—" : String(screens.length);
  const syncHealth = "99.9%";

  return (
    <div className="min-h-screen bg-monarch-bg text-[#222] overflow-x-hidden no-scrollbar [font-family:var(--font-inter),system-ui,sans-serif]">
      {/* Fixed sidebar */}
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-[220px] flex-col border-r border-[#e8e5df] bg-[#faf9f7] px-3 py-6">
        <div className="px-2">
          <div className="font-[family-name:var(--font-playfair),Georgia,serif] text-[22px] font-semibold italic text-monarch-gold">
            MONARCH OS
          </div>
          <div className="mt-1 text-xs text-[#6b6560]">Digital Curator</div>
        </div>
        <nav className="mt-8 flex flex-1 flex-col gap-1 px-1">
          <button
            type="button"
            className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 text-sm text-[#2a2723] shadow-sm"
          >
            <LayoutDashboard className="h-5 w-5 text-[#8a847a]" /> Dashboard
          </button>
          <button
            type="button"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#6b6560] transition hover:bg-white/60"
          >
            <Film className="h-5 w-5 text-[#a39e94]" /> Media Library
          </button>
          <button
            type="button"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#6b6560] transition hover:bg-white/60"
          >
            <Monitor className="h-5 w-5 text-[#a39e94]" /> Screens
          </button>
          <button
            type="button"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#6b6560] transition hover:bg-white/60"
          >
            <Settings className="h-5 w-5 text-[#a39e94]" /> Settings
          </button>
        </nav>
        <div className="mt-auto flex items-center gap-3 rounded-2xl bg-[#ece8df] px-3 py-3 text-xs text-[#5c574e]">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d4cfc4]">
            <User className="h-4 w-4" />
          </div>
          <div>
            <div className="font-medium">Curator Workspace</div>
            <div className="text-[10px] text-[#7a766d]">Premium Access</div>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="pl-[220px]">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#e8e5df] bg-monarch-bg/95 px-8 backdrop-blur-sm">
          <div className="font-[family-name:var(--font-playfair),Georgia,serif] text-[26px] font-semibold text-monarch-gold">
            MONARCH OS
          </div>
          <nav className="hidden items-center gap-10 md:flex">
            {["DASHBOARD", "MEDIA LIBRARY", "SCREENS"].map((label) => (
              <span
                key={label}
                className="text-sm font-medium tracking-widest text-[#666]"
              >
                {label}
              </span>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setIsPairModalOpen(true)}
              className="rounded-full bg-monarch-gold px-6 py-2 text-sm font-medium text-white shadow-[0_2px_12px_rgba(197,160,89,0.35)] transition hover:opacity-95"
            >
              Pair Screen
            </button>
            <button type="button" className="text-[#555]">
              <Bell className="h-5 w-5" />
            </button>
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#ddd6c9] bg-white">
              <User className="h-5 w-5 text-[#666]" />
            </div>
          </div>
        </header>

        <main className="space-y-6 px-8 pb-28 pt-6">
          {/* Top grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <motion.div
              whileHover={{ y: -2 }}
              transition={{ duration: 0.2 }}
              className="rounded-[28px] border border-[#ebe8e2] bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.06)]"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#888]">
                System Status
              </div>
              <h2 className="mt-2 text-sm font-semibold text-[#444]">Active Displays</h2>
              <div className="mt-4 text-7xl font-semibold tabular-nums text-[#1a1a1a]">{displayCount}</div>
              <div className="mt-6 flex items-center gap-3 text-sm text-[#2d7a5f]">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
                </span>
                <Network className="h-4 w-4 text-[#666]" />
                <span>Global Sync Health {syncHealth}</span>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ y: -2 }}
              transition={{ duration: 0.2 }}
              className="rounded-[28px] border border-[#ebe8e2] bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.06)]"
            >
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
                className={`flex min-h-[240px] flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
                  isDragActive ? "border-monarch-gold bg-[#fffbf5]" : "border-[#E5E7EB] bg-[#fafaf8]"
                }`}
              >
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#f0ebe3]">
                  <CloudUpload className="h-7 w-7 text-[#6b6560]" />
                </div>
                <p className="text-base font-medium text-[#333]">Drag &amp; Drop your 4K Wedding Video</p>
                <p className="mt-2 text-sm text-[#777]">Supports MP4, PNG, JPG</p>
                <button
                  type="button"
                  onClick={() => quickUploadInputRef.current?.click()}
                  className="mt-6 rounded-full border border-[#cfc7ba] bg-white px-8 py-2.5 text-sm font-medium text-[#444] transition hover:bg-[#f9f7f4]"
                >
                  SELECT FILES
                </button>
                <div className="mt-4 h-1 w-full max-w-xs overflow-hidden rounded-full bg-[#ece8df]">
                  <motion.div
                    className="h-full bg-monarch-gold"
                    initial={{ width: 0 }}
                    animate={{ width: `${quickUploadProgress}%` }}
                    transition={{ duration: 0.2 }}
                  />
                </div>
              </div>
            </motion.div>
          </div>

          <input
            ref={quickUploadInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={onQuickUploadChange}
          />

          {/* Active Curator View */}
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-[28px] border border-[#ebe8e2] bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.06)]"
          >
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <h2 className="font-[family-name:var(--font-playfair),Georgia,serif] text-3xl font-semibold text-[#1a1a1a] md:text-4xl">
                Current Gallery Screens
              </h2>
              <button
                type="button"
                className="rounded-full bg-[#E5E7EB] px-5 py-2 text-sm font-medium text-[#444]"
              >
                Filter
              </button>
            </div>

            <div className="space-y-4">
              {screens.length === 0 && !loading ? (
                <p className="text-sm text-[#777]">No screens yet. Pair a display to get started.</p>
              ) : null}
              {screens.map((screen) => {
                const online = isOnline(screen.last_ping);
                const displayName = screen.name?.trim() || "Screen";
                const filename =
                  screen.current_content_url?.split("/").pop()?.split("?")[0] ?? "—";
                return (
                  <motion.div
                    key={screen.id}
                    layout
                    whileHover={{ scale: 1.002 }}
                    className="flex flex-col gap-4 rounded-[20px] border border-[#ebe8e2] bg-white p-5 shadow-sm md:flex-row md:items-center"
                  >
                    <div className="h-24 w-40 shrink-0 overflow-hidden rounded-xl bg-[#e8e4dc]">
                      {screen.current_content_url ? (
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
                            width={160}
                            height={96}
                            className="h-full w-full object-cover"
                            unoptimized
                          />
                        )
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <input
                        defaultValue={displayName}
                        onBlur={(e) =>
                          updateName(screen.id, e.target.value).catch(() => toast.error("Update failed"))
                        }
                        className="w-full border-none bg-transparent text-lg font-bold text-[#1a1a1a] outline-none"
                      />
                      <p className="mt-1 text-sm text-[#777]">Venue · Display</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <span
                          className={`inline-flex items-center gap-2 text-sm ${online ? "text-emerald-600" : "text-red-500"}`}
                        >
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${online ? "bg-emerald-500" : "bg-red-500"}`}
                          />
                          {online ? "Online" : "Offline"}
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-wide text-[#666]">
                          Playing now
                        </span>
                        <span className="truncate text-sm text-[#444]">{filename}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <button
                        type="button"
                        onClick={() => nudgeScreen(screen.id).catch(() => toast.error("Refresh failed"))}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e0dcd4] bg-white text-[#555]"
                        aria-label="Refresh"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                      {online ? (
                        <button
                          type="button"
                          onClick={() => onPickFile(screen.id)}
                          className="rounded-full bg-monarch-gold-secondary px-5 py-2.5 text-sm font-medium text-[#3d3a35]"
                        >
                          Change Content
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="cursor-not-allowed rounded-full bg-[#e5e0d8] px-5 py-2.5 text-sm font-medium text-red-600"
                        >
                          Check Connection
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.section>

          {/* Recently curated media */}
          <section className="rounded-[28px] border border-[#ebe8e2] bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
            <div className="mb-6 flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#888]">
                Recently Curated Media
              </div>
              <button type="button" className="text-sm font-medium text-monarch-gold">
                View All
              </button>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {mediaItems.slice(0, 3).map((item) => (
                <motion.div
                  key={item.path}
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden rounded-2xl border border-[#ebe8e2] bg-[#fafaf8]"
                >
                  <div className="relative aspect-video bg-[#e8e4dc]">
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
                    <div className="absolute right-2 top-2 rounded-md bg-black/65 px-2 py-1 text-[10px] font-medium text-white">
                      {item.kind === "video" ? "4K • 0:45" : "IMG • Static"}
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="font-bold text-[#1a1a1a]">{item.name}</div>
                    <div className="mt-1 text-sm text-[#777]">Added 2 hours ago</div>
                    <button
                      type="button"
                      onClick={() => pushToAllScreens(item).catch(() => toast.error("Push failed"))}
                      className="mt-4 w-full rounded-full bg-monarch-gold-secondary py-2.5 text-sm font-medium text-[#2a2723]"
                    >
                      Push to All Screens
                    </button>
                  </div>
                </motion.div>
              ))}
              {mediaItems.length === 0 && (
                <p className="col-span-full text-sm text-[#777]">Upload files to populate your gallery.</p>
              )}
            </div>
          </section>
        </main>
      </div>

      {/* FAB */}
      <button
        type="button"
        onClick={() => quickUploadInputRef.current?.click()}
        className="fixed bottom-8 right-8 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-monarch-gold text-white shadow-lg transition hover:opacity-95"
        aria-label="Add media"
      >
        <Plus className="h-7 w-7" />
      </button>

      {/* Pair modal */}
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
                className="w-full rounded-xl border border-[#ded8cd] bg-[#faf9f7] px-4 py-3 text-center text-2xl tracking-[0.35em] outline-none focus:border-monarch-gold"
                placeholder="••••••"
              />
              <button
                type="button"
                onClick={() => pairDevice().catch(() => toast.error("Pairing failed"))}
                className="mt-4 w-full rounded-full bg-monarch-gold py-3 text-sm font-medium text-white"
              >
                Pair Screen
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Media picker for Change Content */}
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
              <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto p-4 md:grid-cols-3 no-scrollbar">
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
