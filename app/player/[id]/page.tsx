"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
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
        .select("id,name,current_content_url")
        .eq("id", id)
        .single();

      if (cancelled) return;
      if (error) return;

      setName(data?.name ?? "");
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
          const newRow = (payload as any)?.new;
          const nextUrl = newRow?.current_content_url ?? null;
          setCurrentContentUrl(typeof nextUrl === "string" ? nextUrl : null);
          if (typeof newRow?.name === "string") setName(newRow.name);
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
          const newRow = (payload as any)?.new;
          const nextUrl = newRow?.current_content_url ?? null;
          setCurrentContentUrl(typeof nextUrl === "string" ? nextUrl : null);
          if (typeof newRow?.name === "string") setName(newRow.name);
        }
      );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const altText = name?.trim() ? name : "Digital signage screen";

  return (
    <div className="fixed inset-0 bg-black overflow-hidden cursor-none">
      {currentContentUrl ? (
        kind === "video" ? (
          <video
            key={currentContentUrl}
            src={currentContentUrl}
            autoPlay
            muted
            playsInline
            loop
            className="h-full w-full object-contain"
          />
        ) : (
          <img
            key={currentContentUrl}
            src={currentContentUrl}
            alt={altText}
            className="h-full w-full object-contain select-none pointer-events-none"
            draggable={false}
          />
        )
      ) : null}
    </div>
  );
}

