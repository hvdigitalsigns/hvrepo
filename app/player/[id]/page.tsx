"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/lib/supabase";

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
  // Unknown types: keep it black; default to image to be operator-friendly.
  return "image";
}

export default function PlayerPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [name, setName] = useState<string>("");
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [isPaired, setIsPaired] = useState<boolean>(false);
  const [currentContentUrl, setCurrentContentUrl] = useState<string | null>(null);

  const kind = useMemo(() => inferKind(currentContentUrl), [currentContentUrl]);

  useEffect(() => {
    document.documentElement.style.cursor = "none";
    document.body.style.cursor = "none";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.cursor = "";
      document.body.style.cursor = "";
    };
  }, []);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("screens")
        .select("id,name,pairing_code,is_paired,current_content_url")
        .eq("id", id)
        .single();

      if (cancelled) return;
      if (error) return;

      setName(data?.name ?? "");
      setPairingCode(data?.pairing_code ?? null);
      setIsPaired(Boolean(data?.is_paired));
      setCurrentContentUrl(data?.current_content_url ?? null);
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;

    // Realtime subscription scoped to this screen ID.
    const channel = supabase
      .channel(`realtime-screen-${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "screens",
          filter: `id=eq.${id}`,
        },
        (payload) => {
          const newRow = (payload as Record<string, any>)?.new;
          const nextUrl = newRow?.current_content_url ?? null;
          setCurrentContentUrl(typeof nextUrl === "string" ? nextUrl : null);
          if (typeof newRow?.name === "string") setName(newRow.name);
          if (typeof newRow?.pairing_code === "string") setPairingCode(newRow.pairing_code);
          if (typeof newRow?.is_paired === "boolean") setIsPaired(newRow.is_paired);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "screens",
          filter: `id=eq.${id}`,
        },
        (payload) => {
          const newRow = (payload as Record<string, any>)?.new;
          const nextUrl = newRow?.current_content_url ?? null;
          setCurrentContentUrl(typeof nextUrl === "string" ? nextUrl : null);
          if (typeof newRow?.name === "string") setName(newRow.name);
          if (typeof newRow?.pairing_code === "string") setPairingCode(newRow.pairing_code);
          if (typeof newRow?.is_paired === "boolean") setIsPaired(newRow.is_paired);
        }
      );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const altText = name?.trim() ? name : "Digital signage screen";
  const showContent = isPaired && Boolean(currentContentUrl);

  return (
    <div className="fixed inset-0 bg-black overflow-hidden cursor-none no-scrollbar">
      <AnimatePresence mode="wait">
        {!showContent ? (
          <motion.div
            key="pairing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="h-full w-full flex flex-col items-center justify-center text-white px-6"
          >
            <div className="text-3xl md:text-4xl font-light tracking-tight mb-10">HVStudio</div>
            <div className="text-7xl md:text-8xl font-extralight tracking-[0.2em] mb-6">
              {(pairingCode ?? "------").slice(0, 6)}
            </div>
            <div className="text-sm md:text-base text-slate-300 font-light tracking-wide">
              Waiting for pairing at hvstudio.com
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={currentContentUrl ?? "content"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="h-full w-full"
          >
            {kind === "video" ? (
              <video
                src={currentContentUrl ?? ""}
                autoPlay
                muted
                playsInline
                loop
                className="h-full w-full object-cover"
              />
            ) : (
              <img
                src={currentContentUrl ?? ""}
                alt={altText}
                className="h-full w-full object-cover select-none pointer-events-none"
                draggable={false}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

