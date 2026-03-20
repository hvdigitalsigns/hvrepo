"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "react-hot-toast";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronRight,
  Link2,
  X,
  RefreshCcw,
  CloudUpload,
  PlaySquare,
  Sparkles,
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
      <div className="min-h-screen bg-black text-slate-100 flex items-center justify-center font-light">
        Loading Control Center…
      </div>
    );
  }

  const liveCount = screens.filter((screen) => isOnline(screen.last_ping)).length;
  const offlineCount = Math.max(screens.length - liveCount, 0);
  const engagementBars = [32, 46, 61, 52, 75, 88, 67];

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1f1e1c] no-scrollbar overflow-auto [font-family:Inter,system-ui,sans-serif]">
      <header className="max-w-7xl mx-auto px-4 md:px-8 py-5">
        <div className="flex items-center justify-between gap-4 border-b border-[#e7e4dd] pb-4">
          <div className="flex items-center gap-8 min-w-0">
            <div>
              <div className="text-[30px] leading-none tracking-tight [font-family:'Playfair Display',Georgia,serif]">
                Galacreate
              </div>
              <div className="text-[11px] md:text-xs text-[#7a766d] font-light truncate mt-1">
                Powered by HV Digital Signs
              </div>
            </div>
            <nav className="hidden md:flex items-center gap-6 text-[12px] tracking-[0.12em] uppercase text-[#7f7a71]">
              <span className="text-[#272521]">Dashboard</span>
              <span>Media Library</span>
              <span>Screens</span>
            </nav>
          </div>

          <button
            onClick={() => setIsPairModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-[#C5A059] bg-[#C5A059] text-white px-5 py-2 text-sm font-medium shadow-[0_8px_20px_rgba(197,160,89,0.28)] hover:opacity-90"
          >
            <Link2 className="h-4 w-4" />
            + Pair New Display
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8 grid grid-cols-1 xl:grid-cols-12 gap-6">
        <aside className="xl:col-span-2 hidden xl:block">
          <div className="rounded-[28px] bg-white shadow-[0_12px_32px_rgba(0,0,0,0.06)] border border-[#eceaf0] p-4 space-y-2">
            <div className="text-sm font-medium px-3 py-2 rounded-xl bg-[#f6f3ec] text-[#2e2a23]">Dashboard</div>
            <div className="text-sm font-light px-3 py-2 rounded-xl text-[#7f7a71]">Media Library</div>
            <div className="text-sm font-light px-3 py-2 rounded-xl text-[#7f7a71]">Screens</div>
            <div className="text-sm font-light px-3 py-2 rounded-xl text-[#7f7a71]">Settings</div>
          </div>
        </aside>

        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="xl:col-span-6 rounded-[28px] bg-white shadow-[0_12px_32px_rgba(0,0,0,0.07)] p-6 border border-[#eceaf0]"
        >
          <div className="text-xs uppercase tracking-[0.2em] text-[#807b73] mb-2">Commander</div>
          <div className="text-[34px] leading-tight font-semibold mb-6">Your Displays</div>
          <div className="flex flex-wrap items-center gap-7">
            <div>
              <div className="text-5xl font-semibold leading-none">{liveCount}</div>
              <div className="mt-2 flex items-center gap-2 text-sm text-[#4a6c5b]">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#10B981] opacity-70" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-[#10B981]" />
                </span>
                Live in Canada
              </div>
            </div>
            <div>
              <div className="text-5xl font-semibold leading-none">{offlineCount}</div>
              <div className="mt-2 text-sm text-[#8a8680]">Offline</div>
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="xl:col-span-4 rounded-[28px] bg-white shadow-[0_12px_32px_rgba(0,0,0,0.07)] p-6 border border-[#eceaf0]"
        >
          <div className="text-xs uppercase tracking-[0.2em] text-[#807b73] mb-2">Quick Upload</div>
          <div className="text-2xl font-semibold mb-3">Add to Gallery</div>
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
            className={`rounded-2xl border-2 border-dashed p-8 text-center transition ${
              isDragActive ? "border-[#C5A059] bg-[#fcf8f0]" : "border-[#ece7dc] bg-[#faf8f4]"
            }`}
          >
            <div className="mx-auto mb-3 h-11 w-11 rounded-full bg-white border border-[#ece7dc] flex items-center justify-center">
              <CloudUpload className="h-5 w-5 text-[#8b8477]" />
            </div>
            <div className="text-lg font-medium">Drag &amp; Drop your 4K Wedding Video</div>
            <div className="text-sm text-[#7f7a71] mt-1 mb-4">mp4 / png / jpg</div>
            <button
              onClick={() => quickUploadInputRef.current?.click()}
              className="inline-flex items-center rounded-full border border-[#dfd7c8] bg-white px-4 py-2 text-sm hover:bg-[#f7f3ec]"
            >
              Select File
            </button>
            <div className="mt-5 h-1.5 w-full rounded bg-[#ece7dc] overflow-hidden">
              <motion.div
                className="h-full bg-[#C5A059]"
                initial={{ width: 0 }}
                animate={{ width: `${quickUploadProgress}%` }}
                transition={{ duration: 0.25 }}
              />
            </div>
          </div>
        </motion.section>

        <input
          ref={quickUploadInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={onQuickUploadChange}
        />

        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="xl:col-span-10 xl:col-start-3 rounded-[28px] bg-white shadow-[0_12px_32px_rgba(0,0,0,0.07)] p-6 border border-[#eceaf0]"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-[#807b73] mb-1">Screen List</div>
              <div className="text-2xl font-semibold">Your Screens</div>
            </div>
            <button
              onClick={() => (userId ? loadScreens(userId) : Promise.resolve())}
              className="inline-flex items-center gap-2 rounded-full border border-[#e8e3d8] bg-white px-4 py-2 text-sm hover:bg-[#f8f6f1]"
            >
              <RefreshCcw className="h-4 w-4" />
              Sync
            </button>
          </div>
          <div className="space-y-3">
            {screens.map((screen) => {
              const online = isOnline(screen.last_ping);
              const displayName = screen.name?.trim() || "Main Ballroom Entrance";
              const nowPlaying = screen.current_content_url?.split("/").pop() ?? "No content selected";
              return (
                <motion.div
                  key={screen.id}
                  layout
                  className="rounded-2xl border border-[#ece7dd] bg-[#faf9f5] p-4"
                >
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="w-full md:w-[260px] h-[146px] rounded-xl overflow-hidden bg-[#ece7dd] shrink-0">
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={screen.current_content_url ?? `empty-${screen.id}`}
                          initial={{ opacity: 0.2 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0.2 }}
                          transition={{ duration: 0.35 }}
                          className="h-full w-full"
                        >
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
                                alt={displayName}
                                width={520}
                                height={292}
                                className="h-full w-full object-cover"
                                unoptimized
                              />
                            )
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-[#8f8779] text-sm">
                              No Preview
                            </div>
                          )}
                        </motion.div>
                      </AnimatePresence>
                    </div>

                    <div className="flex-1 min-w-0">
                      <input
                        defaultValue={displayName}
                        onBlur={(e) => {
                          updateName(screen.id, e.target.value).catch(() => toast.error("Name update failed"));
                        }}
                        className="bg-transparent border-none p-0 text-xl font-medium outline-none"
                      />
                      <div className="mt-2 flex items-center gap-2 text-sm">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${online ? "bg-[#10B981]" : "bg-red-500"}`}
                        />
                        <span className={online ? "text-[#0f7d62]" : "text-red-600"}>
                          {online ? "Online" : "Offline"}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-[#807b73] truncate">Now Playing: {nowPlaying}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => nudgeScreen(screen.id).catch(() => toast.error("Refresh failed"))}
                        className="inline-flex items-center justify-center rounded-full border border-[#e0d9ca] bg-white h-9 w-9 hover:bg-[#f7f4ee]"
                        aria-label="Refresh screen"
                      >
                        <RefreshCcw className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onPickFile(screen.id)}
                        className="inline-flex items-center gap-2 rounded-full border border-[#C5A059] bg-[#C5A059] text-white px-4 py-2 text-sm hover:opacity-90"
                      >
                        Change Content
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
          className="xl:col-span-4 xl:col-start-3 rounded-[28px] bg-white shadow-[0_12px_32px_rgba(0,0,0,0.07)] p-6 border border-[#eceaf0]"
        >
          <div className="text-xs uppercase tracking-[0.2em] text-[#807b73] mb-1">Guest Stream Analytics</div>
          <div className="text-2xl font-semibold mb-5">Guest Engagement</div>
          <div className="h-48 rounded-2xl bg-[#faf8f4] border border-[#ece7dd] p-4 flex items-end gap-2">
            {engagementBars.map((value, idx) => (
              <motion.div
                key={`bar-${idx}`}
                initial={{ height: 0 }}
                animate={{ height: `${value}%` }}
                transition={{ duration: 0.45, delay: idx * 0.04 }}
                className="flex-1 rounded-t-lg bg-gradient-to-t from-[#C5A059] to-[#e1cca3]"
              />
            ))}
          </div>
          <div className="mt-3 text-sm text-[#807b73]">
            {mediaItems.length * 12 + liveCount * 7} photos/videos beamed today.
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.2 }}
          className="xl:col-span-6 rounded-[28px] bg-white shadow-[0_12px_32px_rgba(0,0,0,0.07)] p-6 border border-[#eceaf0]"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-[#807b73] mb-1">Media Library</div>
              <div className="text-2xl font-semibold">Master Gallery</div>
            </div>
            <Sparkles className="h-5 w-5 text-[#C5A059]" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {mediaItems.slice(0, 9).map((item) => (
              <motion.div layout key={item.path} className="rounded-2xl border border-[#ece7dd] bg-[#faf9f5] p-2">
                <div className="rounded-xl overflow-hidden bg-[#ece7dd] h-24 md:h-28">
                  {item.kind === "video" ? (
                    <video src={item.publicUrl} className="h-full w-full object-cover" muted playsInline />
                  ) : (
                    <Image
                      src={item.publicUrl}
                      alt={item.name}
                      width={360}
                      height={220}
                      className="h-full w-full object-cover"
                      unoptimized
                    />
                  )}
                </div>
                <div className="mt-2 text-xs text-[#6f6a62] truncate">{item.name}</div>
                <button
                  onClick={() => pushToAllScreens(item).catch(() => toast.error("Push failed"))}
                  className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-full border border-[#dfd8ca] bg-white px-3 py-1.5 text-[11px] hover:bg-[#f7f4ee]"
                >
                  <PlaySquare className="h-3.5 w-3.5" />
                  Push to All
                </button>
              </motion.div>
            ))}
            {mediaItems.length === 0 ? (
              <div className="col-span-full text-sm text-[#7a766d] rounded-2xl border border-[#ece8de] bg-[#fbfaf7] p-6">
                No uploads yet. Use Quick Upload to add your first video or image.
              </div>
            ) : null}
          </div>
        </motion.section>
      </div>

      <AnimatePresence>
        {isPairModalOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center px-4 z-50"
          >
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md rounded-2xl border border-[#e5e0d5] bg-white p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="text-lg font-medium tracking-tight">Pair New Display</div>
                <button
                  onClick={() => setIsPairModalOpen(false)}
                  className="rounded border border-[#e5dfd4] p-1.5 hover:bg-[#f8f6ef]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-sm text-[#7a766d] font-light mb-3">
                Enter the 6-digit code shown on the TV in Canada.
              </p>
              <input
                value={pairingCode}
                onChange={(e) => setPairingCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full rounded-xl border border-[#ded8cd] bg-[#fbfaf7] px-3 py-2 text-center text-xl tracking-[0.3em] font-extralight outline-none focus:border-[#b49a61]"
                placeholder="123456"
              />
              <button
                onClick={() => pairDevice().catch(() => toast.error("Pairing failed"))}
                className="mt-4 w-full rounded-xl border border-[#b49a61] bg-[#b49a61] text-white py-2 font-light hover:opacity-90"
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
            className="fixed inset-0 bg-black/65 flex items-center justify-center px-4 z-50"
          >
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-3xl rounded-2xl border border-[#e5e0d5] bg-white p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-lg font-medium">Change Content</div>
                  <div className="text-sm text-[#7f7a71]">Pick an item from Master Gallery.</div>
                </div>
                <button
                  onClick={() => setIsPickerModalOpen(false)}
                  className="rounded border border-[#e5dfd4] p-1.5 hover:bg-[#f8f6ef]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[60vh] overflow-auto no-scrollbar">
                {mediaItems.map((item) => (
                  <button
                    key={`picker-${item.path}`}
                    onClick={() => {
                      if (!targetScreenId) return;
                      pushToSingleScreen(item, targetScreenId).finally(() => setIsPickerModalOpen(false));
                    }}
                    className="rounded-2xl border border-[#ece7dd] bg-[#faf9f5] p-2 text-left hover:bg-[#f4f1ea]"
                  >
                    <div className="rounded-xl overflow-hidden bg-[#ece7dd] h-24">
                      {item.kind === "video" ? (
                        <video src={item.publicUrl} className="h-full w-full object-cover" muted playsInline />
                      ) : (
                        <Image
                          src={item.publicUrl}
                          alt={item.name}
                          width={360}
                          height={220}
                          className="h-full w-full object-cover"
                          unoptimized
                        />
                      )}
                    </div>
                    <div className="mt-2 text-xs truncate text-[#6e6960]">{item.name}</div>
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

