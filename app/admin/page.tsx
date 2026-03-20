"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "react-hot-toast";
import { Plus, RotateCcw, Upload, Video, Image as ImageIcon, LayoutGrid } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Screen = {
  id: string;
  name: string | null;
  current_content_url: string | null;
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
  const [screens, setScreens] = useState<Screen[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeUploadScreenId, setActiveUploadScreenId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const hasSupabaseConfig = useMemo(() => {
    return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  }, []);

  async function loadScreens() {
    const { data, error } = await supabase
      .from("screens")
      .select("id,name,current_content_url")
      .limit(200);

    if (error) {
      toast.error(error.message);
      return;
    }
    setScreens((data ?? []) as Screen[]);
  }

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setLoading(false);
      return;
    }
    loadScreens().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSupabaseConfig]);

  async function createScreen() {
    const name = window.prompt("New screen name:", "Lobby Display");
    if (!name) return;

    toast.dismiss();
    const loadingToastId = toast.loading("Creating screen…");
    const { error } = await supabase
      .from("screens")
      .insert({ name, current_content_url: null })
      .select("id")
      .single();

    if (error) {
      toast.error(error.message, { id: loadingToastId });
      return;
    }

    toast.success("Screen created", { id: loadingToastId });
    await loadScreens();
  }

  async function uploadAndSync(screenId: string, file: File) {
    const toastUploadId = toast.loading("Uploading media…");

    const storagePath = `screens/${screenId}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      toast.error(uploadError.message, { id: toastUploadId });
      return;
    }

    // Assumes bucket `media` is public. If it's private, switch to signed URLs.
    const { data: publicUrlData } = supabase.storage.from("media").getPublicUrl(storagePath);
    const publicUrl = publicUrlData.publicUrl;

    toast.success("Upload complete", { id: toastUploadId });

    const toastSyncId = toast.loading("Syncing screen…");
    const { error: syncError } = await supabase
      .from("screens")
      .update({ current_content_url: publicUrl })
      .eq("id", screenId);

    if (syncError) {
      toast.error(syncError.message, { id: toastSyncId });
      return;
    }

    toast.success("Screen synced", { id: toastSyncId });
    await loadScreens();
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

  return (
    <div className="min-h-screen bg-black text-slate-100">
      <header className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded border border-neutral-800 flex items-center justify-center bg-neutral-950">
              <LayoutGrid className="h-5 w-5 text-slate-100" />
            </div>
            <div>
              <div className="text-xl font-light tracking-tight">Control Center</div>
              <div className="text-sm text-slate-400">Manage screens & sync media</div>
            </div>
          </div>

          <button
            onClick={() => createScreen()}
            className="inline-flex items-center gap-2 rounded border border-neutral-800 bg-neutral-950 px-4 py-2 text-sm font-light hover:bg-neutral-900"
          >
            <Plus className="h-4 w-4" />
            New Screen
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 pb-12">
        <div className="flex items-center justify-between mb-5">
          <div className="text-sm text-slate-300 font-light">
            {loading ? "Loading…" : `${screens.length} registered screen(s)`}
          </div>
          <button
            onClick={() => loadScreens().catch(() => toast.error("Failed to refresh"))}
            className="inline-flex items-center gap-2 rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs font-light hover:bg-neutral-900"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        {!hasSupabaseConfig ? (
          <div className="rounded border border-neutral-800 bg-neutral-950 p-6 text-sm text-slate-300">
            Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in your environment.
          </div>
        ) : null}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={onFileChange}
        />

        <div className="space-y-4">
          {screens.map((screen) => {
            const kind = inferKind(screen.current_content_url);
            const displayName = screen.name?.trim() ? screen.name : "Untitled Screen";

            return (
              <div
                key={screen.id}
                className="rounded border border-neutral-800 bg-neutral-950/60 p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded border border-neutral-800 bg-black flex items-center justify-center">
                        {kind === "video" ? (
                          <Video className="h-5 w-5 text-slate-100" />
                        ) : kind === "image" ? (
                          <ImageIcon className="h-5 w-5 text-slate-100" />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-slate-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-light truncate">{displayName}</div>
                        <div className="text-xs text-slate-400 truncate">
                          {screen.id.slice(0, 8)}…{screen.id.slice(-6)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-4">
                      {screen.current_content_url ? (
                        kind === "video" ? (
                          <video
                            src={screen.current_content_url}
                            className="h-14 w-24 rounded border border-neutral-800 object-cover bg-black"
                            muted
                            playsInline
                            loop
                          />
                        ) : (
                          <div className="h-14 w-24 rounded border border-neutral-800 bg-black overflow-hidden">
                            {/* Thumbnail: use Next Image so remotePatterns works */}
                            <Image
                              src={screen.current_content_url}
                              alt={displayName}
                              width={96}
                              height={56}
                              className="h-14 w-24 object-cover"
                              unoptimized
                            />
                          </div>
                        )
                      ) : (
                        <div className="text-xs text-slate-500">No content synced yet.</div>
                      )}
                      <div className="text-xs text-slate-400 truncate">
                        {screen.current_content_url ? screen.current_content_url.split("?")[0] : "—"}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex flex-col gap-2 items-end">
                    <button
                      onClick={() => onPickFile(screen.id)}
                      className="inline-flex items-center gap-2 rounded border border-neutral-800 bg-neutral-950 px-4 py-2 text-sm font-light hover:bg-neutral-900"
                    >
                      <Upload className="h-4 w-4" />
                      Upload &amp; Sync
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {screens.length === 0 && loading ? (
            <div className="rounded border border-neutral-800 bg-neutral-950 p-6 text-sm text-slate-300">
              Loading screens…
            </div>
          ) : null}

          {screens.length === 0 && !loading ? (
            <div className="rounded border border-neutral-800 bg-neutral-950 p-6 text-sm text-slate-300">
              No screens found yet. Create one with `New Screen`.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

