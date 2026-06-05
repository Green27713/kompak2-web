"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useCompression } from "../src/hooks/useCompression";
import { getFileCategory } from "../src/services/compression/index";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";


const ACCEPTED = "image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm";
const MAX_MB = 500;
const VIDEO_WARNING_MB = 50;

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

function SnugIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
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

function DropIllustration() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="56" height="56" rx="12" stroke="#E2DDD6" strokeWidth="1.5"/>
      <rect x="12" y="12" width="40" height="40" rx="8" stroke="#E2DDD6" strokeWidth="1.5"/>
      <rect x="20" y="20" width="24" height="24" rx="4" fill="#F0EDE8" stroke="#D5CFC8" strokeWidth="1.5"/>
      <path d="M32 27V37M32 27L28 31M32 27L36 31" stroke="#C4956A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
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
  const [originalPreview, setOriginalPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { state, compress, reset } = useCompression();
  const animatedSavings = useCountUp(state.status === "done" || (state.status as string) === "optimized" ? state.savings : 0);
  const isDone = state.status === "done" || (state.status as string) === "optimized";
  const isCompressing = state.status === "compressing";

  useEffect(() => { setMounted(true); }, []);

  async function pickFile(f: File) {
    const isHeic = f.type === "image/heic" || f.type === "image/heif" ||
      f.name.toLowerCase().endsWith(".heic") || f.name.toLowerCase().endsWith(".heif");
    const category = getFileCategory(f);
    if (!category && !isHeic) { toast.error("Unsupported file type."); return; }
    const sizeMB = f.size / (1024 * 1024);
    if (sizeMB > MAX_MB) { toast.error(`File too large. Max is ${MAX_MB} MB.`); return; }
    if (category === "video" && sizeMB > VIDEO_WARNING_MB) {
      toast.info(`Large video (${sizeMB.toFixed(0)} MB) — using fast server compression. This may take 15–60 seconds.`, { duration: 6000, icon: "⚡" });
    }

    // Store original preview for before/after
    const previewUrl = URL.createObjectURL(f);
    setOriginalPreview(previewUrl);

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

  async function handleWaitlistSubmit() {
    if (!email.includes("@")) { toast.error("Please enter a valid email."); return; }
    try {
      const res = await fetch("/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      if (!res.ok) throw new Error();
    } catch { toast.error("Something went wrong. Try again."); return; }
    setEmailSubmitted(true); toast.success("You're on the list");
  }

  function handleReset() {
    setFile(null);
    setOriginalPreview(null);
    reset();
  }

  const category = file ? getFileCategory(file) : null;
  const isPng = file?.type === "image/png";
  const isImage = category === "image";

  return (
    <main style={{
      minHeight: "100vh", backgroundColor: "#FAF8F5", color: "#1A1714",
      fontFamily: "'Geist', system-ui, sans-serif",
      opacity: mounted ? 1 : 0, transition: "opacity 0.4s ease",
    }}>
      <Toaster theme="light" toastOptions={{ style: {
        backgroundColor: "#FAF8F5", border: "1px solid #E2DDD6",
        color: "#1A1714", fontSize: "13px", borderRadius: "10px",
      }}}/>

      {/* Nav */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "20px 40px", borderBottom: "1px solid #F0EDE8",
        backgroundColor: "#FAF8F5", position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <SnugIcon />
          <span style={{ fontSize: "20px", fontWeight: "500", letterSpacing: "-0.02em" }}>
            PixSnug<span style={{ fontSize: "11px", color: "#8C8580", verticalAlign: "super", marginLeft: "1px" }}>™</span>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <a href="#how-it-works" style={{ fontSize: "13px", color: "#8C8580", textDecoration: "none" }}>How it works</a>
          <a href="#formats" style={{ fontSize: "13px", color: "#8C8580", textDecoration: "none" }}>Formats</a>
          <a href="#faq" style={{ fontSize: "13px", color: "#8C8580", textDecoration: "none" }}>FAQ</a>
          <a href="https://ko-fi.com/pixsnug" target="_blank" rel="noopener noreferrer" style={{
            fontSize: "12px", color: "#C4956A", border: "1px solid #E8D5C0",
            borderRadius: "20px", padding: "5px 14px", textDecoration: "none",
            letterSpacing: "0.02em",
          }}>☕ Support</a>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", padding: "80px 24px 60px",
        textAlign: "center",
      }}>
        <div style={{ marginBottom: "24px" }}>
          <PrivacyBadge />
        </div>
        <h1 style={{
          fontSize: "clamp(36px, 6vw, 64px)", fontWeight: "300",
          letterSpacing: "-0.03em", lineHeight: "1.1",
          color: "#1A1714", marginBottom: "20px", maxWidth: "700px",
        }}>
          Squeeze your files.<br />
          <span style={{ color: "#C4956A" }}>Keep the quality.</span>
        </h1>
        <p style={{
          fontSize: "16px", color: "#8C8580", maxWidth: "480px",
          lineHeight: "1.7", marginBottom: "48px", fontWeight: "300",
        }}>
          Free image & video compression that runs entirely in your browser.
          No uploads. No signup. No limits.
        </p>

        {/* Drop Zone */}
        {!file && !converting && (
          <div
            style={{
              width: "100%", maxWidth: "560px",
              border: `1.5px solid ${dragging ? "#C4956A" : "#E2DDD6"}`,
              borderRadius: "20px", padding: "56px 48px",
              textAlign: "center", cursor: "pointer",
              transition: "all 0.2s ease",
              backgroundColor: dragging ? "#F5F1EA" : "#FDFCFA",
              boxShadow: "0 2px 20px rgba(0,0,0,0.04)",
            }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input ref={inputRef} type="file" accept={ACCEPTED} style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); }}/>
            <div style={{ marginBottom: "20px", display: "flex", justifyContent: "center" }}>
              <DropIllustration />
            </div>
            <p style={{ fontSize: "17px", fontWeight: "400", color: "#1A1714", marginBottom: "8px" }}>
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
            <SnugIcon size={40} />
            <p style={{ fontSize: "14px", color: "#8C8580", marginTop: "16px" }}>Converting HEIC…</p>
          </div>
        )}

        {/* Compression Panel */}
        {file && !converting && (
          <div style={{ width: "100%", maxWidth: "560px", display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* File info */}
            <div style={{ backgroundColor: "#F0EDE8", borderRadius: "14px", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: "14px", fontWeight: "400", color: "#1A1714", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "320px" }}>{file.name}</p>
                <p style={{ fontSize: "12px", color: "#8C8580", marginTop: "3px" }}>
                  {state.originalSizeFormatted || `${(file.size / (1024 * 1024)).toFixed(2)} MB`}
                </p>
              </div>
              <span style={{ fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase", color: "#8C8580", border: "1px solid #E2DDD6", borderRadius: "20px", padding: "3px 10px", backgroundColor: "#FAF8F5" }}>
                {category}
              </span>
            </div>

            {/* Quality slider */}
            {!isDone && !isPng && (
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

            {isPng && !isDone && (
              <p style={{ fontSize: "12px", color: "#B8B3AE", textAlign: "center" }}>
                PNG will be converted to WebP for maximum compression
              </p>
            )}

            {/* Progress */}
            {isCompressing && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "center" }}>
                <div style={{ width: "100%", height: "2px", backgroundColor: "#E2DDD6", borderRadius: "2px", overflow: "hidden" }}>
                  <div style={{ height: "100%", backgroundColor: "#C4956A", borderRadius: "2px", transition: "width 0.3s ease", width: `${state.progress}%` }}/>
                </div>
                <p style={{ fontSize: "12px", color: "#8C8580" }}>
                  {state.progress < 5 ? "Initialising…" : `Compressing — ${state.progress}%`}
                </p>
              </div>
            )}

            {/* Result */}
            {isDone && (
              <>
                <div style={{ backgroundColor: "#F0EDE8", borderRadius: "16px", padding: "32px", textAlign: "center" }}>
                  <div style={{ fontSize: "64px", fontWeight: "200", letterSpacing: "-0.04em", color: "#1A1714", lineHeight: "1", marginBottom: "8px" }}>
                    <span style={{ color: "#C4956A" }}>−</span>
                    {animatedSavings}
                    <span style={{ fontSize: "32px", fontWeight: "200" }}>%</span>
                  </div>
                  <p style={{ fontSize: "13px", color: "#8C8580" }}>
                    {state.originalSizeFormatted} → {state.compressedSizeFormatted}
                  </p>
                </div>

                {/* Before/After Preview */}
                {isImage && originalPreview && state.outputUrl && (
                  <div style={{ borderRadius: "14px", overflow: "hidden", border: "1px solid #E2DDD6" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                      <div style={{ position: "relative" }}>
                        <img src={originalPreview} alt="Original" style={{ width: "100%", height: "160px", objectFit: "cover", display: "block" }}/>
                        <div style={{ position: "absolute", bottom: "8px", left: "8px", backgroundColor: "rgba(26,23,20,0.7)", color: "white", fontSize: "10px", padding: "3px 8px", borderRadius: "10px", letterSpacing: "0.05em" }}>
                          ORIGINAL · {state.originalSizeFormatted}
                        </div>
                      </div>
                      <div style={{ position: "relative" }}>
                        <img src={state.outputUrl} alt="Compressed" style={{ width: "100%", height: "160px", objectFit: "cover", display: "block" }}/>
                        <div style={{ position: "absolute", bottom: "8px", right: "8px", backgroundColor: "rgba(196,149,106,0.9)", color: "white", fontSize: "10px", padding: "3px 8px", borderRadius: "10px", letterSpacing: "0.05em" }}>
                          COMPRESSED · {state.compressedSizeFormatted}
                        </div>
                      </div>
                    </div>
                    <div style={{ backgroundColor: "#F0EDE8", padding: "8px", textAlign: "center", fontSize: "11px", color: "#8C8580", letterSpacing: "0.03em" }}>
                      BEFORE · AFTER
                    </div>
                  </div>
                )}

                {/* Ko-fi support */}
                <div style={{ textAlign: "center", padding: "4px 0" }}>
                  <a href="https://ko-fi.com/pixsnug" target="_blank" rel="noopener noreferrer" style={{
                    display: "inline-flex", alignItems: "center", gap: "6px",
                    fontSize: "12px", color: "#8C8580", textDecoration: "none",
                    border: "1px solid #E2DDD6", borderRadius: "20px", padding: "5px 14px",
                    backgroundColor: "#FAF8F5", transition: "all 0.15s ease",
                  }}>
                    ☕ Buy me a coffee if this helped
                  </a>
                </div>
              </>
            )}

            {/* Error */}
            {state.status === "error" && (
              <div style={{ backgroundColor: "#FDF0F0", border: "1px solid #F0DADA", borderRadius: "12px", padding: "14px 18px", fontSize: "13px", color: "#C46A6A" }}>
                {state.errorMsg}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={handleReset} disabled={isCompressing} style={{ flex: 1, height: "44px", backgroundColor: "transparent", border: "1.5px solid #E2DDD6", borderRadius: "10px", fontSize: "13px", color: "#8C8580", cursor: "pointer" }}>
                New file
              </button>
              {!isDone && (
                <button onClick={() => compress(file, quality)} disabled={isCompressing} style={{ flex: 1, height: "44px", backgroundColor: "#1A1714", border: "none", borderRadius: "10px", fontSize: "13px", color: "#FAF8F5", cursor: "pointer" }}>
                  {isCompressing ? "Compressing…" : "Compress"}
                </button>
              )}
              {isDone && (
                <button onClick={handleDownload} style={{ flex: 1, height: "44px", backgroundColor: "#1A1714", border: "none", borderRadius: "10px", fontSize: "13px", color: "#FAF8F5", cursor: "pointer" }}>
                  Download
                </button>
              )}
            </div>

            {isDone && (
              <p style={{ textAlign: "center", fontSize: "12px", color: "#B8B3AE" }}>
                Want batch processing & API access?{" "}
                <button onClick={() => setWaitlistOpen(true)} style={{ color: "#C4956A", background: "none", border: "none", borderBottom: "1px solid #E8D5C0", paddingBottom: "1px", cursor: "pointer", fontSize: "12px" }}>
                  Join the waitlist
                </button>
              </p>
            )}
          </div>
        )}
      </section>

      {/* How it works */}
      <section id="how-it-works" style={{ padding: "80px 24px", backgroundColor: "#F5F2EE", borderTop: "1px solid #EDE9E4" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#C4956A", marginBottom: "16px" }}>How it works</p>
          <h2 style={{ fontSize: "32px", fontWeight: "300", letterSpacing: "-0.02em", marginBottom: "48px", color: "#1A1714" }}>
            Three steps. Done.
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "32px" }}>
            {[
              { step: "01", title: "Drop your file", desc: "Drag and drop any image or video. JPEG, PNG, WebP, HEIC, MP4, MOV, WebM." },
              { step: "02", title: "Adjust quality", desc: "Move the slider to find your perfect balance between file size and visual quality." },
              { step: "03", title: "Download", desc: "Your compressed file is ready instantly. Files never leave your device." },
            ].map((item) => (
              <div key={item.step} style={{ textAlign: "left", padding: "24px", backgroundColor: "#FAF8F5", borderRadius: "16px", border: "1px solid #EDE9E4" }}>
                <div style={{ fontSize: "11px", letterSpacing: "0.1em", color: "#C4956A", marginBottom: "12px" }}>{item.step}</div>
                <h3 style={{ fontSize: "16px", fontWeight: "500", marginBottom: "8px", color: "#1A1714" }}>{item.title}</h3>
                <p style={{ fontSize: "13px", color: "#8C8580", lineHeight: "1.6" }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Formats */}
      <section id="formats" style={{ padding: "80px 24px", backgroundColor: "#FAF8F5" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#C4956A", marginBottom: "16px" }}>Supported formats</p>
          <h2 style={{ fontSize: "32px", fontWeight: "300", letterSpacing: "-0.02em", marginBottom: "48px", color: "#1A1714" }}>
            Every format. One tool.
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
            {[
              { format: "JPEG", desc: "Server-side mozjpeg compression. 40-60% smaller without visible quality loss.", badge: "Most popular" },
              { format: "PNG", desc: "Converted to WebP automatically. Up to 95% smaller with full transparency support.", badge: "Best savings" },
              { format: "WebP", desc: "Re-compressed at optimal quality. The modern standard for web images.", badge: "Modern" },
              { format: "HEIC", desc: "iPhone photos converted and compressed automatically. Works in Safari.", badge: "iPhone" },
              { format: "MP4", desc: "FFmpeg WASM compression. Reduce video file size without re-uploading anywhere.", badge: "Video" },
              { format: "PDF", desc: "Server-side PDF compression coming soon. Join the waitlist for early access.", badge: "Coming soon", soon: true },
              { format: "MP4 (Server)", desc: "Server-side FFmpeg compression for all videos. 300MB compressed in under 60 seconds. Automatic fallback to browser if needed.", badge: "Fast" },
            ].map((item) => (
              <div key={item.format} style={{ textAlign: "left", padding: "20px 24px", backgroundColor: item.soon ? "#FAF8F5" : "#F5F2EE", borderRadius: "14px", border: `1px solid ${item.soon ? "#EDE9E4" : "#E2DDD6"}`, opacity: item.soon ? 0.6 : 1 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontSize: "16px", fontWeight: "500", color: "#1A1714" }}>{item.format}</span>
                  <span style={{ fontSize: "10px", letterSpacing: "0.06em", textTransform: "uppercase", color: item.soon ? "#B8B3AE" : "#C4956A", border: `1px solid ${item.soon ? "#E2DDD6" : "#E8D5C0"}`, borderRadius: "10px", padding: "2px 8px" }}>{item.badge}</span>
                </div>
                <p style={{ fontSize: "13px", color: "#8C8580", lineHeight: "1.6" }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About / Avatar */}
      <section style={{ padding: "80px 24px", backgroundColor: "#F5F2EE", borderTop: "1px solid #EDE9E4" }}>
        <div style={{ maxWidth: "600px", margin: "0 auto", textAlign: "center" }}>
          <img
            src="/Mark_Avatar.png"
            alt="Mark — founder of PixSnug"
            style={{ width: "80px", height: "80px", borderRadius: "50%", objectFit: "cover", marginBottom: "20px", border: "2px solid #E2DDD6" }}
          />
          <h2 style={{ fontSize: "24px", fontWeight: "300", letterSpacing: "-0.02em", marginBottom: "16px", color: "#1A1714" }}>
            Built by a Navy veteran in Patong, Thailand
          </h2>
          <p style={{ fontSize: "14px", color: "#8C8580", lineHeight: "1.8", marginBottom: "24px" }}>
          After 30 years in US Navy aviation as an Aviation Maintenance Officer — responsible for naval aviation readiness, logistics, and airworthiness — I started building digital tools that work the way operations should: simple on the outside, solid on the inside. PixSnug™ is one of them.
          </p>
          <a href="https://ko-fi.com/pixsnug" target="_blank" rel="noopener noreferrer" style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            fontSize: "13px", color: "#C4956A", textDecoration: "none",
            border: "1px solid #E8D5C0", borderRadius: "20px", padding: "8px 20px",
          }}>
            ☕ Buy me a coffee
          </a>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ padding: "80px 24px", backgroundColor: "#FAF8F5" }}>
        <div style={{ maxWidth: "640px", margin: "0 auto" }}>
          <p style={{ fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#C4956A", marginBottom: "16px", textAlign: "center" }}>FAQ</p>
          <h2 style={{ fontSize: "32px", fontWeight: "300", letterSpacing: "-0.02em", marginBottom: "40px", textAlign: "center", color: "#1A1714" }}>
            Common questions
          </h2>
          {[
            { q: "Are my files safe?", a: "Yes. All compression happens in your browser or on our server with no storage. Files are never saved, logged, or shared. Server-processed files are deleted immediately after compression." },
            { q: "Is PixSnug really free?", a: "Yes, completely free. No signup, no limits, no watermarks. If you find it useful, you can buy me a coffee — but it's never required." },
            { q: "Why convert PNG to WebP?", a: "WebP is a modern format that achieves significantly better compression than PNG while maintaining quality. All modern browsers support it." },
            { q: "Why does HEIC only work in Safari?", a: "HEIC is Apple's format and requires Apple's codec, which is only available natively on Apple devices. On Safari and Chrome/Edge on Mac, it works automatically. On Windows or Firefox, export as JPEG first." },
            { q: "What's coming next?", a: "PDF compression, batch processing, API access for developers, and a WordPress plugin. Join the waitlist to be first." },
          ].map((item, i) => (
            <div key={i} style={{ borderBottom: "1px solid #EDE9E4", padding: "20px 0" }}>
              <p style={{ fontSize: "15px", fontWeight: "400", color: "#1A1714", marginBottom: "8px" }}>{item.q}</p>
              <p style={{ fontSize: "13px", color: "#8C8580", lineHeight: "1.7" }}>{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: "40px 24px", borderTop: "1px solid #EDE9E4", backgroundColor: "#F5F2EE" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <SnugIcon size={20} />
            <span style={{ fontSize: "14px", fontWeight: "500", color: "#1A1714" }}>
              PixSnug<span style={{ fontSize: "10px", color: "#8C8580", verticalAlign: "super" }}>™</span>
            </span>
          </div>
          <PrivacyBadge />
          <p style={{ fontSize: "12px", color: "#B8B3AE" }}>
            © 2025 PixSnug. All rights reserved.
          </p>
        </div>
      </footer>

      {/* Waitlist Modal */}
      <Dialog open={waitlistOpen} onOpenChange={setWaitlistOpen}>
        <DialogContent style={{ backgroundColor: "#FAF8F5", border: "1px solid #E2DDD6", borderRadius: "16px", maxWidth: "360px", padding: "32px" }}>
          <DialogHeader>
            <DialogTitle style={{ fontSize: "18px", fontWeight: "400", color: "#1A1714" }}>Early access</DialogTitle>
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
              <button onClick={handleWaitlistSubmit} style={{ width: "100%", height: "42px", backgroundColor: "#1A1714", border: "none", borderRadius: "8px", fontSize: "13px", color: "#FAF8F5", cursor: "pointer" }}>
                I&apos;m in
              </button>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "24px 0", display: "flex", flexDirection: "column", gap: "8px" }}>
              <p style={{ fontSize: "24px" }}>✓</p>
              <p style={{ fontSize: "14px", color: "#1A1714" }}>You&apos;re on the list.</p>
              <p style={{ fontSize: "12px", color: "#8C8580" }}>We&apos;ll reach out when API access opens.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
