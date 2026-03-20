"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "react-hot-toast";
import { AnimatePresence, motion } from "framer-motion";
import {
  Monitor,
  Upload,
  Video,
  Image as ImageIcon,
  Link2,
  X,
  RefreshCcw,
  CloudUpload,
  PlaySquare,
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
  // Unknown types: treat as image to keep it simple for the operator.
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
  const [pairingCode, setPairingCode] = useState("");
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadingScreenId, setUploadingScreenId] = useState<string | null>(null);
  const [quickUploading, setQuickUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [activeUploadScreenId, setActiveUploadScreenId] = useState<string | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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

  function startUploadProgress(screenId: string) {
    setUploadingScreenId(screenId);
    setUploadProgress((prev) => ({ ...prev, [screenId]: 8 }));
    progressTimerRef.current = window.setInterval(() => {
      setUploadProgress((prev) => {
        const current = prev[screenId] ?? 8;
        const next = Math.min(current + 7, 92);
        return { ...prev, [screenId]: next };
      });
    }, 250);
  }

  function finishUploadProgress(screenId: string) {
    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    setUploadProgress((prev) => ({ ...prev, [screenId]: 100 }));
    window.setTimeout(() => {
      setUploadProgress((prev) => ({ ...prev, [screenId]: 0 }));
      setUploadingScreenId((prev) => (prev === screenId ? null : prev));
    }, 600);
  }

  async function uploadAndSync(screenId: string, file: File) {
    startUploadProgress(screenId);
    const toastUploadId = toast.loading("Uploading media…");

    const storagePath = `screens/${screenId}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      finishUploadProgress(screenId);
      toast.error(uploadError.message, { id: toastUploadId });
      return;
    }

    // Assumes bucket `media` is public. If it's private, switch to signed URLs.
    const { data: publicUrlData } = supabase.storage.from("media").getPublicUrl(storagePath);
    const publicUrl = publicUrlData.publicUrl;
    const contentType = inferKind(publicUrl) === "video" ? "video" : "image";

    toast.success("Upload complete", { id: toastUploadId });

    const toastSyncId = toast.loading("Syncing screen…");
    const { error: syncError } = await supabase
      .from("screens")
      .update({ current_content_url: publicUrl, content_type: contentType })
      .eq("id", screenId);

    if (syncError) {
      finishUploadProgress(screenId);
      toast.error(syncError.message, { id: toastSyncId });
      return;
    }

    finishUploadProgress(screenId);
    toast.success("Screen synced", { id: toastSyncId });
    if (userId) await loadScreens(userId);
    await loadMediaLibrary();
  }

  async function quickUpload(file: File) {
    setQuickUploading(true);
    const toastId = toast.loading("Uploading media…");
    const storagePath = `${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("media").upload(storagePath, file, {
      contentType: file.type,
      upsert: true,
    });
    if (error) {
      setQuickUploading(false);
      toast.error(error.message, { id: toastId });
      return;
    }
    setQuickUploading(false);
    toast.success("Uploaded to media library", { id: toastId });
    await loadMediaLibrary();
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
    setActiveUploadScreenId(screenId);
    fileInputRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const screenId = activeUploadScreenId;

    // Reset input so selecting the same file again still triggers `onChange`.
    e.target.value = "";

    if (!file || !screenId) return;
    uploadAndSync(screenId, file).catch((err) => {
      toast.error(err?.message ?? "Upload failed");
    });
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

  return (
    <div className="min-h-screen bg-[#f5f5f3] text-[#1f1e1c] no-scrollbar overflow-auto">
      <header className="max-w-7xl mx-auto px-4 md:px-8 py-6 border-b border-[#e7e4dc]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <div className="text-2xl md:text-3xl font-light tracking-tight">MONARCH OS</div>
              <div className="text-xs md:text-sm text-[#7a766d] font-light">
                Powered by HV Digital Signs
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsPairModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-[#b49a61] bg-[#b49a61] text-white px-5 py-2 text-sm font-light hover:opacity-90"
          >
            <Link2 className="h-4 w-4" />
            Pair Screen
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8 grid grid-cols-1 xl:grid-cols-12 gap-6">
        <section className="xl:col-span-5 rounded-3xl bg-white shadow-[0_10px_35px_rgba(0,0,0,0.06)] p-6 border border-[#ece8de]">
          <div className="text-xs uppercase tracking-[0.2em] text-[#7c786d] mb-3">Your Screens</div>
          <div className="text-3xl font-light mb-4">{loading ? "..." : screens.length} Active Screens</div>
          <div className="space-y-3">
            {screens.map((screen) => {
              const online = isOnline(screen.last_ping);
              const contentLabel = screen.current_content_url
                ? screen.current_content_url.split("/").pop()
                : "No content selected";
              return (
                <div
                  key={screen.id}
                  className="rounded-2xl border border-[#ece8de] bg-[#fbfaf7] p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <input
                        defaultValue={screen.name?.trim() || "Untitled Screen"}
                        onBlur={(e) => {
                          updateName(screen.id, e.target.value).catch(() => toast.error("Name update failed"));
                        }}
                        className="bg-transparent border-none p-0 text-lg font-light outline-none"
                      />
                      <div className="flex items-center gap-2 text-sm mt-1">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${online ? "bg-emerald-500" : "bg-red-500"}`}
                        />
                        <span className={online ? "text-emerald-700" : "text-red-700"}>
                          {online ? "Online" : "Offline"}
                        </span>
                      </div>
                      <div className="text-xs text-[#7b776f] mt-1 truncate max-w-[320px]">
                        Now Playing: {contentLabel}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => nudgeScreen(screen.id).catch(() => toast.error("Refresh failed"))}
                        className="inline-flex items-center gap-1 rounded-full border border-[#e4dfd3] bg-white px-3 py-1.5 text-xs hover:bg-[#f7f5ef]"
                      >
                        <RefreshCcw className="h-3 w-3" />
                        Refresh
                      </button>
                      <button
                        onClick={() => onPickFile(screen.id)}
                        className="inline-flex items-center gap-1 rounded-full border border-[#b49a61] bg-[#b49a61] text-white px-3 py-1.5 text-xs hover:opacity-90"
                      >
                        <Upload className="h-3 w-3" />
                        Change
                      </button>
                    </div>
                  </div>
                  {uploadingScreenId === screen.id && (
                    <div className="mt-3 h-1.5 w-full rounded bg-[#ebe7dc] overflow-hidden">
                      <motion.div
                        className="h-full bg-[#b49a61]"
                        initial={{ width: 0 }}
                        animate={{ width: `${uploadProgress[screen.id] ?? 0}%` }}
                        transition={{ ease: "easeOut", duration: 0.2 }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
            {!loading && screens.length === 0 ? (
              <div className="rounded-2xl border border-[#ece8de] bg-[#fbfaf7] p-5 text-sm text-[#7a766d]">
                No screens paired yet. Click "Pair Screen" to connect your first TV.
              </div>
            ) : null}
          </div>
        </section>

        <section className="xl:col-span-7 rounded-3xl bg-white shadow-[0_10px_35px_rgba(0,0,0,0.06)] p-6 border border-[#ece8de]">
          <div className="text-xs uppercase tracking-[0.2em] text-[#7c786d] mb-3">Quick Upload</div>
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
            className={`rounded-3xl border-2 border-dashed p-10 md:p-14 text-center transition ${
              isDragActive ? "border-[#b49a61] bg-[#fbf8ef]" : "border-[#e8e3d8] bg-[#faf9f4]"
            }`}
          >
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-white border border-[#e6e0d5] flex items-center justify-center">
              <CloudUpload className="h-5 w-5 text-[#6f6a60]" />
            </div>
            <div className="text-2xl font-light mb-2">Drag &amp; Drop your 4K Wedding Video</div>
            <div className="text-sm text-[#78746a] mb-6">Drop File Here or select from your device</div>
            <button
              onClick={() => quickUploadInputRef.current?.click()}
              className="inline-flex items-center rounded-full border border-[#d7d0c3] bg-white px-5 py-2 text-sm hover:bg-[#f6f4ed]"
            >
              Select Files
            </button>
            {quickUploading ? (
              <div className="mt-4 text-sm text-[#7d786f]">Uploading...</div>
            ) : null}
          </div>
        </section>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={onFileChange}
        />
        <input
          ref={quickUploadInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={onQuickUploadChange}
        />

        <section className="xl:col-span-12 rounded-3xl bg-white shadow-[0_10px_35px_rgba(0,0,0,0.06)] p-6 border border-[#ece8de]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-[#7c786d] mb-1">Recent Content</div>
              <div className="text-2xl font-light">Media Library</div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {mediaItems.map((item) => (
              <div key={item.path} className="rounded-2xl border border-[#ece8de] bg-[#fbfaf7] p-3">
                <div className="rounded-xl overflow-hidden bg-[#ece8df] h-40 flex items-center justify-center">
                  {item.kind === "video" ? (
                    <video src={item.publicUrl} className="h-full w-full object-cover" muted playsInline />
                  ) : (
                    <Image src={item.publicUrl} alt={item.name} width={480} height={240} className="h-full w-full object-cover" unoptimized />
                  )}
                </div>
                <div className="mt-2 text-sm font-light truncate">{item.name}</div>
                <button
                  onClick={() => pushToAllScreens(item).catch(() => toast.error("Push failed"))}
                  className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-full border border-[#d7d0c3] bg-white px-4 py-2 text-xs hover:bg-[#f6f4ed]"
                >
                  <PlaySquare className="h-3.5 w-3.5" />
                  Push to All Screens
                </button>
              </div>
            ))}
            {mediaItems.length === 0 ? (
              <div className="col-span-full text-sm text-[#7a766d] rounded-2xl border border-[#ece8de] bg-[#fbfaf7] p-6">
                No uploads yet. Use Quick Upload to add your first video or image.
              </div>
            ) : null}
          </div>
        </section>
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
                <div className="text-lg font-light tracking-tight">Pair Screen</div>
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
    </div>
  );
}

