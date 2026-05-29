"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useCompression } from "../src/hooks/useCompression";
import { getFileCategory } from "../src/services/compression/index";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

const ACCEPTED = "image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm";
const MAX_MB = 500;

async function normalizeFile(f: File): Promise<File> {
  const isHeic = f.type === "image/heic" || f.type === "image/heif" ||
    f.name.toLowerCase().endsWith(".heic") || f.name.toLowerCase().endsWith(".heif");
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
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Browser cannot decode this HEIC file")); };
      img.src = url;
    });
  }
  return f;
}

function useCountUp(target: number, duration: number = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return value;
}

function SnugIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="22" height="22" rx="5" stroke="#C4956A" strokeWidth="1.5"/>
      <rect x="7" y="7" width="14" height="14" rx="3" stroke="#C4956A" strokeWidth="1.5"/>
      <rect x="11" y="11" width="6" height="6" rx="1.5" fill="#C4956A"/>
    </svg>
  );
}

function PrivacyBadge() {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: "6px",
      padding: "5px 12px", borderRadius: "20px",
      border: "1px solid #E2DDD6", backgroundColor: "#F0EDE8",
      fontSize: "11px", color: "#8C8580",
      letterSpacing: "0.05em", textTransform: "uppercase" as const,
    }}>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M5 1L9 3V5.5C9 7.5 7.2 9.2 5 9.8C2.8 9.2 1 7.5 1 5.5V3L5 1Z" stroke="#8C8580" strokeWidth="1" fill="none"/>
        <path d="M3.5 5L4.5 6L6.5 4" stroke="#8C8580" strokeWidth="1" strokeLinecap="round"/>
      </svg>
      Files never leave your browser
    </div>
  );
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [quality, setQuality] = useState(80);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [converting, setConverting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { state, compress, reset } = useCompression();
  const animatedSavings = useCountUp(state.status === "done" ? state.savings : 0);

  useEffect(() => { setMounted(true); }, []);

  async function pickFile(f: File) {
    const isHeic = f.type === "image/heic" || f.type === "image/heif" ||
      f.name.toLowerCase().endsWith(".heic") || f.name.toLowerCase().endsWith(".heif");
    const category = getFileCategory(f);
    if (!category && !isHeic) { toast.error("Unsupported file type."); return; }
    const sizeMB = f.size / (1024 * 1024);
    if (sizeMB > MAX_MB) { toast.error(`File too large. Max is ${MAX_MB} MB.`); return; }
    if (isHeic) {
      setConverting(true);
      try {
        const converted = await normalizeFile(f);
        setFile(converted);
        toast.success("HEIC converted to JPEG");
      } catch {
        toast.error("HEIC not supported in this browser. Export as JPEG first.");
      } finally { setConverting(false); }
    } else { setFile(f); }
    reset();
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) pickFile(f);
  }, []);

  function handleDownload() {
    if (!state.outputUrl) return;
    const a = document.createElement("a");
    a.href = state.outputUrl; a.download = state.outputFilename; a.click();
    toast.success("Downloaded");
  }

  function handleWaitlistSubmit() {
    if (!email.includes("@")) { toast.error("Please enter a valid email."); return; }
    setEmailSubmitted(true); toast.success("You're on the list");
  }

  function handleReset() { setFile(null); reset(); }

  const isCompressing = state.status === "compressing";
  const isOptimized = (state.status as string) === "optimized";
  const isDone = state.status === "done" || (state.status as string) === "optimized";
  const category = file ? getFileCategory(file) : null;
  const isPng = file?.type === "image/png";

  return (
    <main style={{
      minHeight: "100vh", backgroundColor: "#FAF8F5", color: "#1A1714",
      fontFamily: "'Geist', system-ui, sans-serif",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "48px 24px",
      opacity: mounted ? 1 : 0, transition: "opacity 0.4s ease",
    }}>
      <Toaster theme="light" toastOptions={{ style: {
        backgroundColor: "#FAF8F5", border: "1px solid #E2DDD6",
        color: "#1A1714", fontSize: "13px", borderRadius: "10px",
      }}}/>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "48px", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <SnugIcon />
          <span style={{ fontSize: "28px", fontWeight: "500", letterSpacing: "-0.02em", color: "#1A1714" }}>
            PixSnug<span style={{ fontSize: "13px", fontWeight: "400", color: "#8C8580", verticalAlign: "super", marginLeft: "1px" }}>™</span>
          </span>
        </div>
        <p style={{ fontSize: "14px", color: "#8C8580", letterSpacing: "0.01em", fontWeight: "300" }}>
          Squeeze your images & videos tiny — free, private, instant
        </p>
      </div>

      {/* Drop Zone */}
      {!file && !converting && (
        <div
          style={{
            width: "100%", maxWidth: "520px",
            border: `1.5px solid ${dragging ? "#C4956A" : "#E2DDD6"}`,
            borderRadius: "16px", padding: "64px 48px",
            textAlign: "center", cursor: "pointer",
            transition: "all 0.2s ease",
            backgroundColor: dragging ? "#F5F1EA" : "#FAF8F5",
          }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input ref={inputRef} type="file" accept={ACCEPTED} style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); }}/>
          <span style={{ fontSize: "32px", marginBottom: "16px", display: "block" }}>
            {dragging ? "📂" : "📁"}
          </span>
          <p style={{ fontSize: "16px", fontWeight: "400", color: "#1A1714", marginBottom: "8px" }}>
            {dragging ? "Release to compress" : "Drop a file or click to browse"}
          </p>
          <p style={{ fontSize: "12px", color: "#B8B3AE", letterSpacing: "0.03em" }}>
            JPEG · PNG · WebP · HEIC · MP4 · MOV · WebM · max {MAX_MB} MB
          </p>
        </div>
      )}

      {/* Converting */}
      {converting && (
        <div style={{ textAlign: "center", padding: "64px 0" }}>
          <SnugIcon />
          <p style={{ fontSize: "14px", color: "#8C8580", marginTop: "16px", letterSpacing: "0.02em" }}>Converting HEIC…</p>
        </div>
      )}

      {/* Compression Panel */}
      {file && !converting && (
        <div style={{ width: "100%", maxWidth: "520px", display: "flex", flexDirection: "column", gap: "20px" }}>

          {/* File info */}
          <div style={{ backgroundColor: "#F0EDE8", borderRadius: "12px", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontSize: "14px", fontWeight: "400", color: "#1A1714", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "280px" }}>{file.name}</p>
              <p style={{ fontSize: "12px", color: "#8C8580", marginTop: "3px" }}>
                {state.originalSizeFormatted || `${(file.size / (1024 * 1024)).toFixed(2)} MB`}
              </p>
            </div>
            <span style={{ fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase", color: "#8C8580", border: "1px solid #E2DDD6", borderRadius: "20px", padding: "3px 10px", backgroundColor: "#FAF8F5" }}>
              {category}
            </span>
          </div>

          {/* Quality slider — JPEG/WebP */}
          {!isDone && category === "image" && !isPng && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#8C8580" }}>
                <span style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "11px" }}>Quality</span>
                <span>{quality}%</span>
              </div>
              <input type="range" min={1} max={100} value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                disabled={isCompressing} style={{ width: "100%", accentColor: "#C4956A" }}/>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#C4BAB3" }}>
                <span>Smaller file</span><span>Better quality</span>
              </div>
            </div>
          )}

          {/* PNG notice */}
          {!isDone && isPng && (
            <p style={{ fontSize: "12px", color: "#B8B3AE", textAlign: "center", letterSpacing: "0.02em" }}>
              PNG will be converted to WebP for maximum compression
            </p>
          )}

          {/* Quality slider — video */}
          {!isDone && category === "video" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#8C8580" }}>
                <span style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "11px" }}>Quality</span>
                <span>{quality}%</span>
              </div>
              <input type="range" min={1} max={100} value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                disabled={isCompressing} style={{ width: "100%", accentColor: "#C4956A" }}/>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#C4BAB3" }}>
                <span>Smaller file</span><span>Better quality</span>
              </div>
            </div>
          )}

          {/* Progress */}
          {isCompressing && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "center" }}>
              <div style={{ width: "100%", height: "2px", backgroundColor: "#E2DDD6", borderRadius: "2px", overflow: "hidden" }}>
                <div style={{ height: "100%", backgroundColor: "#C4956A", borderRadius: "2px", transition: "width 0.3s ease", width: `${state.progress}%` }}/>
              </div>
              <p style={{ fontSize: "12px", color: "#8C8580", letterSpacing: "0.03em" }}>
                {state.progress < 5 ? "Initialising…" : `Compressing — ${state.progress}%`}
              </p>
            </div>
          )}

          {/* Result */}
          {isDone && (
            <div style={{ backgroundColor: "#F0EDE8", borderRadius: "16px", padding: "40px 32px", textAlign: "center" }}>
              <div style={{ fontSize: "72px", fontWeight: "200", letterSpacing: "-0.04em", color: "#1A1714", lineHeight: "1", marginBottom: "12px" }}>
                <span style={{ color: "#C4956A" }}>−</span>
                {animatedSavings}
                <span style={{ fontSize: "36px", fontWeight: "200" }}>%</span>
              </div>
              <p style={{ fontSize: "13px", color: "#8C8580", letterSpacing: "0.01em" }}>
                {state.originalSizeFormatted} → {state.compressedSizeFormatted}
              </p>
            </div>
          )}

          {/* Error */}
          {state.status === "error" && (
            <div style={{ backgroundColor: "#FDF0F0", border: "1px solid #F0DADA", borderRadius: "12px", padding: "14px 18px", fontSize: "13px", color: "#C46A6A" }}>
              {state.errorMsg}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={handleReset} disabled={isCompressing} style={{ flex: 1, height: "44px", backgroundColor: "transparent", border: "1.5px solid #E2DDD6", borderRadius: "10px", fontSize: "13px", color: "#8C8580", cursor: "pointer", letterSpacing: "0.01em" }}>
              New file
            </button>
            {!isDone && (
              <button onClick={() => compress(file, quality)} disabled={isCompressing} style={{ flex: 1, height: "44px", backgroundColor: "#1A1714", border: "none", borderRadius: "10px", fontSize: "13px", color: "#FAF8F5", cursor: "pointer", letterSpacing: "0.01em" }}>
                {isCompressing ? "Compressing…" : "Compress"}
              </button>
            )}
            {isDone && (
              <button onClick={handleDownload} style={{ flex: 1, height: "44px", backgroundColor: "#1A1714", border: "none", borderRadius: "10px", fontSize: "13px", color: "#FAF8F5", cursor: "pointer", letterSpacing: "0.01em" }}>
                Download
              </button>
            )}
          </div>

          {/* Waitlist */}
          {isDone && (
            <p style={{ textAlign: "center", fontSize: "12px", color: "#B8B3AE", letterSpacing: "0.01em" }}>
              Want batch processing & API access?{" "}
              <button onClick={() => setWaitlistOpen(true)} style={{ color: "#C4956A", background: "none", border: "none", borderBottom: "1px solid #E8D5C0", paddingBottom: "1px", cursor: "pointer", fontSize: "12px", letterSpacing: "0.01em" }}>
                Join the waitlist
              </button>
            </p>
          )}
        </div>
      )}

      {/* Privacy badge */}
      <div style={{ marginTop: "48px" }}>
        <PrivacyBadge />
      </div>

      {/* Waitlist Modal */}
      <Dialog open={waitlistOpen} onOpenChange={setWaitlistOpen}>
        <DialogContent style={{ backgroundColor: "#FAF8F5", border: "1px solid #E2DDD6", borderRadius: "16px", maxWidth: "360px", padding: "32px" }}>
          <DialogHeader>
            <DialogTitle style={{ fontSize: "18px", fontWeight: "400", color: "#1A1714", letterSpacing: "-0.01em" }}>
              Early access
            </DialogTitle>
          </DialogHeader>
          {!emailSubmitted ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", paddingTop: "8px" }}>
              <p style={{ fontSize: "13px", color: "#8C8580", lineHeight: "1.6" }}>
                Batch compression, API access, and WordPress plugin — coming soon.
              </p>
              <input type="email" placeholder="your@email.com" value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleWaitlistSubmit()}
                style={{ width: "100%", backgroundColor: "#F0EDE8", border: "1px solid #E2DDD6", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", color: "#1A1714", outline: "none", boxSizing: "border-box" }}/>
              <button onClick={handleWaitlistSubmit} style={{ width: "100%", height: "42px", backgroundColor: "#1A1714", border: "none", borderRadius: "8px", fontSize: "13px", color: "#FAF8F5", cursor: "pointer", letterSpacing: "0.01em" }}>
                I&apos;m in
              </button>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "24px 0", display: "flex", flexDirection: "column", gap: "8px" }}>
              <p style={{ fontSize: "24px" }}>✓</p>
              <p style={{ fontSize: "14px", fontWeight: "400", color: "#1A1714" }}>You&apos;re on the list.</p>
              <p style={{ fontSize: "12px", color: "#8C8580" }}>We&apos;ll reach out when API access opens.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
