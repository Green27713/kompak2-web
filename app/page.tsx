"use client";

import { useState, useRef, useCallback } from "react";
import { useCompression } from "../src/hooks/useCompression";
import { getFileCategory } from "../src/services/compression/index";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

const ACCEPTED = "image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm";
const MAX_MB = 500;

async function normalizeFile(f: File): Promise<File> {
  const isHeic =
    f.type === "image/heic" ||
    f.type === "image/heif" ||
    f.name.toLowerCase().endsWith(".heic") ||
    f.name.toLowerCase().endsWith(".heif");

  if (isHeic) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas failed")); return; }
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error("Conversion failed")); return; }
          resolve(new File([blob], f.name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg" }));
        }, "image/jpeg", 0.95);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Browser cannot decode this HEIC file"));
      };
      img.src = url;
    });
  }
  return f;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [quality, setQuality] = useState(75);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [converting, setConverting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { state, compress, reset } = useCompression();

  async function pickFile(f: File) {
    const isHeic =
      f.type === "image/heic" ||
      f.type === "image/heif" ||
      f.name.toLowerCase().endsWith(".heic") ||
      f.name.toLowerCase().endsWith(".heif");

    const category = getFileCategory(f);
    if (!category && !isHeic) {
      toast.error("Unsupported file type. Use JPEG, PNG, WebP, HEIC, MP4, MOV, or WebM.");
      return;
    }
    const sizeMB = f.size / (1024 * 1024);
    if (sizeMB > MAX_MB) {
      toast.error(`File too large (${sizeMB.toFixed(0)} MB). Max is ${MAX_MB} MB.`);
      return;
    }

    if (isHeic) {
      setConverting(true);
      try {
        const converted = await normalizeFile(f);
        setFile(converted);
        toast.success("HEIC converted to JPEG");
      } catch {
        toast.error("Failed to convert HEIC file.");
      } finally {
        setConverting(false);
      }
    } else {
      setFile(f);
    }
    reset();
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) pickFile(f);
  }, []);

  function handleDownload() {
    if (!state.outputUrl) return;
    const a = document.createElement("a");
    a.href = state.outputUrl;
    a.download = state.outputFilename;
    a.click();
    toast.success("Downloaded!");
  }

  function handleWaitlistSubmit() {
    if (!email.includes("@")) {
      toast.error("Please enter a valid email.");
      return;
    }
    setEmailSubmitted(true);
    toast.success("You're on the list!");
  }

  function handleReset() {
    setFile(null);
    reset();
  }

  const isCompressing = state.status === "compressing";
  const isDone = state.status === "done";
  const category = file ? getFileCategory(file) : null;
  const isPng = file?.type === "image/png";

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <Toaster theme="dark" />

      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Kompak2</h1>
        <p className="text-zinc-400 text-sm">
          Compress images & videos — free, private, runs in your browser
        </p>
      </div>

      {/* Screen 1 — Drop Zone */}
      {!file && !converting && (
        <div
          className={`w-full max-w-xl border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-colors ${
            dragging
              ? "border-white bg-zinc-900"
              : "border-zinc-700 hover:border-zinc-500"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); }}
          />
          <div className="text-5xl mb-4">📦</div>
          <p className="text-lg font-medium mb-1">
            {dragging ? "Drop it here" : "Drop a file or click to browse"}
          </p>
          <p className="text-zinc-500 text-sm">
            JPEG · PNG · WebP · HEIC · MP4 · MOV · WebM · max {MAX_MB} MB
          </p>
        </div>
      )}

      {/* HEIC converting state */}
      {converting && (
        <div className="w-full max-w-xl text-center py-16">
          <div className="text-4xl mb-4">⚙️</div>
          <p className="text-zinc-300">Converting HEIC to JPEG…</p>
        </div>
      )}

      {/* Screen 2 — Compression Panel */}
      {file && !converting && (
        <div className="w-full max-w-xl space-y-6">

          {/* File info */}
          <div className="flex items-center justify-between bg-zinc-900 rounded-xl p-4">
            <div>
              <p className="font-medium truncate max-w-xs">{file.name}</p>
              <p className="text-zinc-400 text-sm">{state.originalSizeFormatted || `${(file.size / (1024 * 1024)).toFixed(2)} MB`}</p>
            </div>
            <Badge variant="outline" className="text-zinc-300 border-zinc-600">
              {category}
            </Badge>
          </div>

          {/* Quality slider — images only, not PNG */}
          {!isDone && category === "image" && !isPng && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-zinc-400">
                <span>Quality</span>
                <span>{quality}%</span>
              </div>
              <input
                type="range"
                min={1}
                max={100}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                disabled={isCompressing}
                className="w-full accent-white"
              />
              <div className="flex justify-between text-xs text-zinc-600">
                <span>Smaller file</span>
                <span>Better quality</span>
              </div>
            </div>
          )}

          {/* PNG notice */}
          {!isDone && isPng && (
            <p className="text-zinc-500 text-sm text-center">
              PNG will be converted to WebP for maximum compression
            </p>
          )}

          {/* Video quality slider */}
          {!isDone && category === "video" && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-zinc-400">
                <span>Quality</span>
                <span>{quality}%</span>
              </div>
              <input
                type="range"
                min={1}
                max={100}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                disabled={isCompressing}
                className="w-full accent-white"
              />
              <div className="flex justify-between text-xs text-zinc-600">
                <span>Smaller file</span>
                <span>Better quality</span>
              </div>
            </div>
          )}

          {/* Progress bar */}
          {isCompressing && (
            <div className="space-y-2">
              <Progress value={state.progress} className="h-2" />
              <p className="text-sm text-zinc-400 text-center">
                Compressing… {state.progress}%
              </p>
            </div>
          )}

          {/* Result */}
          {isDone && (
            <div className="bg-zinc-900 rounded-xl p-6 text-center space-y-1">
              <p className="text-5xl font-bold text-white">−{state.savings}%</p>
              <p className="text-zinc-400 text-sm">
                {state.originalSizeFormatted} → {state.compressedSizeFormatted}
              </p>
            </div>
          )}

          {/* Error */}
          {state.status === "error" && (
            <div className="bg-red-950 border border-red-800 rounded-xl p-4 text-red-300 text-sm">
              {state.errorMsg}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={isCompressing}
              className="flex-1 border-zinc-600 bg-zinc-800 text-white hover:bg-zinc-700 hover:text-white"
            >
              New File
            </Button>
            {!isDone && (
              <Button
                onClick={() => compress(file, quality)}
                disabled={isCompressing}
                className="flex-1 bg-white text-black hover:bg-zinc-200"
              >
                {isCompressing ? "Compressing…" : "Compress"}
              </Button>
            )}
            {isDone && (
              <Button
                onClick={handleDownload}
                className="flex-1 bg-white text-black hover:bg-zinc-200"
              >
                Download
              </Button>
            )}
          </div>

          {/* Soft waitlist prompt */}
          {isDone && (
            <p className="text-center text-zinc-500 text-sm">
              Want batch processing & API access?{" "}
              <button
                onClick={() => setWaitlistOpen(true)}
                className="text-white underline underline-offset-2 hover:text-zinc-300"
              >
                Join the waitlist
              </button>
            </p>
          )}
        </div>
      )}

      {/* Screen 3 — Waitlist Modal */}
      <Dialog open={waitlistOpen} onOpenChange={setWaitlistOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl">Get early access</DialogTitle>
          </DialogHeader>
          {!emailSubmitted ? (
            <div className="space-y-4 pt-2">
              <p className="text-zinc-400 text-sm">
                Batch compression, API access, and WordPress plugin — coming soon.
              </p>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleWaitlistSubmit()}
                className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400"
              />
              <Button
                onClick={handleWaitlistSubmit}
                className="w-full bg-white text-black hover:bg-zinc-200"
              >
                I&apos;m in
              </Button>
            </div>
          ) : (
            <div className="text-center py-4 space-y-2">
              <p className="text-2xl">✅</p>
              <p className="font-medium">You&apos;re on the list.</p>
              <p className="text-zinc-400 text-sm">We&apos;ll reach out when API access opens.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
