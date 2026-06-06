'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { compressImage } from '../src/services/compression/compressImage';
import { getFileCategory } from '../src/services/compression/index';

const MAX_BYTES = 500 * 1024 * 1024;
const CHUNK_SIZE = 5 * 1024 * 1024;
const CHUNKED_THRESHOLD = 50 * 1024 * 1024;

const C = {
  blue: '#2563EB', blueDark: '#1D4ED8', blue50: '#EFF6FF', blue100: '#DBEAFE', blue200: '#BFDBFE',
  gray50: '#F9FAFB', gray100: '#F3F4F6', gray200: '#E5E7EB', gray300: '#D1D5DB',
  gray400: '#9CA3AF', gray500: '#6B7280', gray700: '#374151', gray900: '#111827',
  green: '#16A34A', green50: '#F0FDF4', green200: '#BBF7D0', green800: '#166534',
  red: '#DC2626', red50: '#FEF2F2', red200: '#FECACA',
  white: '#FFFFFF',
};

type Mode = 'compress' | 'convert';
type VideoFmt = 'mp4' | 'webm';
type ImageFmt = 'jpg' | 'webp' | 'png';

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

function isHEICFile(f: File) {
  return f.type === 'image/heic' || f.type === 'image/heif' ||
    f.name.toLowerCase().endsWith('.heic') || f.name.toLowerCase().endsWith('.heif');
}

async function normalizeHEIC(f: File): Promise<File> {
  try {
    return await new Promise<File>((resolve, reject) => {
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) { URL.revokeObjectURL(url); reject(new Error('canvas')); return; }
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        canvas.toBlob(blob => {
          if (!blob) { reject(new Error('blob')); return; }
          resolve(new File([blob], f.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.92);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
      img.src = url;
    });
  } catch {
    const heic2any = (await import('heic2any')).default;
    const result = await heic2any({ blob: f, toType: 'image/jpeg', quality: 0.92 });
    const blob = Array.isArray(result) ? result[0] : result;
    return new File([blob], f.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
  }
}

async function chunkedVideoUpload(
  file: File,
  quality: number,
  outputFormat: string,
  signal: AbortSignal,
  onProgress: (pct: number) => void,
  onUploadComplete: () => void,
  onCompressProgress: (pct: number) => void,
): Promise<{ blob: Blob; origSize: number; compSize: number }> {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const uploadId = crypto.randomUUID();

  const initRes = await fetch('/api/upload/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uploadId, filename: file.name, totalChunks }),
    signal,
  });
  if (!initRes.ok) throw new Error('Failed to initialize upload');

  for (let i = 0; i < totalChunks; i++) {
    if (signal.aborted) throw Object.assign(new Error('Cancelled'), { name: 'AbortError' });
    const chunk = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const res = await fetch('/api/upload/chunk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Upload-ID': uploadId,
        'X-Chunk-Index': String(i),
      },
      body: chunk,
      signal,
    });
    if (!res.ok) throw new Error(`Chunk ${i} failed`);
    onProgress(Math.round(((i + 1) / totalChunks) * 75));
  }

  const finalRes = await fetch('/api/upload/finalize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uploadId }),
    signal,
  });
  if (!finalRes.ok) throw new Error('Failed to finalize upload');

  onUploadComplete();

  // POST /api/compress returns 202 immediately with a jobId
  const compressRes = await fetch('/api/compress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uploadId, quality, outputFormat }),
    signal,
  });
  if (!compressRes.ok) {
    const b = await compressRes.json().catch(() => ({}));
    throw new Error((b as { error?: string }).error || `Server error ${compressRes.status}`);
  }
  const { jobId } = await compressRes.json();

  // Poll /api/status every 3 seconds until done
  while (true) {
    if (signal.aborted) throw Object.assign(new Error('Cancelled'), { name: 'AbortError' });
    await new Promise(r => setTimeout(r, 3000));
    if (signal.aborted) throw Object.assign(new Error('Cancelled'), { name: 'AbortError' });

    const statusRes = await fetch(`/api/status?jobId=${jobId}`, { signal });
    if (!statusRes.ok) continue; // transient error — retry next tick

    const status = await statusRes.json() as { status: string; progress?: number; error?: string };

    if (status.status === 'error') {
      throw new Error(status.error || 'Compression failed on server');
    }

    if (status.status === 'complete') {
      onCompressProgress(100);
      const downloadRes = await fetch(`/api/download?jobId=${jobId}`, { signal });
      if (!downloadRes.ok) throw new Error('Download failed');
      const blob = await downloadRes.blob();
      return {
        blob,
        origSize: parseInt(downloadRes.headers.get('X-Original-Size') || '0'),
        compSize: parseInt(downloadRes.headers.get('X-Compressed-Size') || '0'),
      };
    }

    if (typeof status.progress === 'number') onCompressProgress(status.progress);
  }
}

function xhrUpload(
  formData: FormData,
  signal: AbortSignal,
  onUploadProgress: (pct: number) => void,
  onUploadComplete?: () => void,
): Promise<{ blob: Blob; origSize: number; compSize: number }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    signal.addEventListener('abort', () => xhr.abort());
    xhr.addEventListener('abort', () => reject(Object.assign(new Error('Cancelled'), { name: 'AbortError' })));
    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable) onUploadProgress(Math.round((e.loaded / e.total) * 75));
    });
    xhr.upload.addEventListener('load', () => onUploadComplete?.());
    xhr.addEventListener('load', () => {
      if (xhr.status !== 200) {
        try { const b = JSON.parse(xhr.responseText); reject(new Error(b.error || `Server error ${xhr.status}`)); }
        catch { reject(new Error(`Server error ${xhr.status}`)); }
        return;
      }
      resolve({
        blob: xhr.response as Blob,
        origSize: parseInt(xhr.getResponseHeader('X-Original-Size') || '0'),
        compSize: parseInt(xhr.getResponseHeader('X-Compressed-Size') || '0'),
      });
    });
    xhr.addEventListener('error', () => reject(new Error('Network error. Check your connection and try again.')));
    xhr.responseType = 'blob';
    xhr.open('POST', '/api/compress');
    xhr.send(formData);
  });
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div style={{ display: 'flex', backgroundColor: C.gray100, borderRadius: 12, padding: 4, gap: 4 }}>
      {(['compress', 'convert'] as Mode[]).map(m => (
        <button
          key={m}
          onClick={() => onChange(m)}
          style={{
            flex: 1, padding: '10px 0', borderRadius: 9, border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: 600, transition: 'all 0.15s',
            backgroundColor: mode === m ? C.white : 'transparent',
            color: mode === m ? C.blue : C.gray500,
            boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
          }}
        >
          {m === 'compress' ? '🗜 Compress' : '🔄 Convert'}
        </button>
      ))}
    </div>
  );
}

function FmtPills<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string; hint: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ backgroundColor: C.white, borderRadius: 12, padding: '14px 18px', border: `1px solid ${C.gray200}` }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
        {options.map(o => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10, cursor: 'pointer', fontSize: 13,
              border: `2px solid ${value === o.value ? C.blue : C.gray200}`,
              backgroundColor: value === o.value ? C.blue50 : C.white,
              color: value === o.value ? C.blue : C.gray700,
              fontWeight: value === o.value ? 600 : 400,
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p style={{ margin: 0, fontSize: 11, color: C.gray400 }}>
        {options.find(o => o.value === value)?.hint}
      </p>
    </div>
  );
}

export default function CompressionTool() {
  const [mode, setMode] = useState<Mode>('compress');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'converting' | 'processing' | 'completed' | 'error'>('idle');
  const [uploadPct, setUploadPct] = useState(0);
  const [phase, setPhase] = useState<'upload' | 'process'>('upload');
  const [error, setError] = useState<string | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputFilename, setOutputFilename] = useState('');
  const [originalSize, setOriginalSize] = useState(0);
  const [compressedSize, setCompressedSize] = useState(0);
  const [quality, setQuality] = useState(80);
  const [videoFmt, setVideoFmt] = useState<VideoFmt>('mp4');
  const [imageFmt, setImageFmt] = useState<ImageFmt>('jpg');
  const [dragging, setDragging] = useState(false);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [compressProgress, setCompressProgress] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  async function pickFile(raw: File) {
    if (raw.size > MAX_BYTES) { setError('File too large. Max is 500 MB.'); return; }
    if (!getFileCategory(raw) && !isHEICFile(raw)) {
      setError('Unsupported file type. Use JPEG, PNG, WebP, HEIC, MP4, MOV, or WebM.');
      return;
    }
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    setError(null); setUploadPct(0); setOutputUrl(null);

    if (isHEICFile(raw)) {
      setFile(raw); setStatus('converting');
      try {
        const converted = await normalizeHEIC(raw);
        setFile(converted); setStatus('idle');
      } catch {
        setStatus('error');
        setError('Could not convert HEIC. Try exporting as JPEG from Photos first.');
      }
    } else {
      setFile(raw); setStatus('idle');
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (f) pickFile(f);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files?.[0]; if (f) pickFile(f);
  }

  const handleAction = useCallback(async () => {
    if (!file) return;
    const isVideo = file.type.startsWith('video/');
    const useServer = isVideo || mode === 'convert';

    setStatus('processing'); setPhase('upload'); setUploadPct(0); setError(null); setElapsedSecs(0); setCompressProgress(0);

    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 1200_000); // 20 min

    try {
      if (useServer) {
        const onUploadProgress = (pct: number) => { setPhase('upload'); setUploadPct(pct); };
        const onUploadComplete = () => {
          setPhase('process'); setUploadPct(100); setElapsedSecs(0);
          let s = 0;
          intervalRef.current = setInterval(() => { s += 1; setElapsedSecs(s); }, 1000);
        };

        const useChunked = isVideo; // all videos use async chunked path
        const qualityVal = mode === 'convert' ? 100 : quality;

        const { blob, origSize, compSize } = useChunked
          ? await chunkedVideoUpload(file, qualityVal, videoFmt, controller.signal, onUploadProgress, onUploadComplete, (p) => setCompressProgress(p))
          : await xhrUpload(
              (() => {
                const fd = new FormData();
                fd.append('file', file);
                fd.append('quality', String(qualityVal));
                if (isVideo) fd.append('outputFormat', videoFmt);
                if (!isVideo) fd.append('outputImageFormat', imageFmt);
                return fd;
              })(),
              controller.signal, onUploadProgress, onUploadComplete
            );

        setPhase('process'); setUploadPct(90);
        const ext = isVideo ? videoFmt : imageFmt;
        const prefix = mode === 'convert' ? 'converted' : 'compressed';
        setOutputUrl(URL.createObjectURL(blob));
        setOutputFilename(`${prefix}-${file.name.replace(/\.[^.]+$/, '')}.${ext}`);
        setOriginalSize(origSize || file.size);
        setCompressedSize(compSize || blob.size);
      } else {
        // Compress mode + image: use compressImage (has browser fallback)
        const result = await compressImage(file, { quality });
        const res = await fetch(result.dataUrl);
        const blob = await res.blob();
        const ext = blob.type.includes('webp') ? 'webp' : blob.type.includes('png') ? 'png' : 'jpg';
        setOutputUrl(URL.createObjectURL(blob));
        setOutputFilename(`compressed-${file.name.replace(/\.[^.]+$/, '')}.${ext}`);
        setOriginalSize(file.size); setCompressedSize(result.sizeBytes);
        setUploadPct(100);
      }
      setUploadPct(100); setStatus('completed');
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError')
        setError('Timed out. The file may be too large or your connection too slow.');
      else setError(err instanceof Error ? err.message : 'Operation failed. Please try again.');
      setStatus('error');
    } finally {
      clearTimeout(timeout);
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    }
  }, [file, quality, videoFmt, imageFmt, mode]);

  const handleDownload = useCallback(() => {
    if (!outputUrl) return;
    const a = document.createElement('a'); a.href = outputUrl; a.download = outputFilename; a.click();
  }, [outputUrl, outputFilename]);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    setFile(null); setStatus('idle'); setUploadPct(0); setError(null); setOutputUrl(null); setCompressProgress(0);
  }, [outputUrl]);

  const isVideo = file?.type.startsWith('video/');
  const savings = originalSize > 0 ? Math.max(0, Math.round((1 - compressedSize / originalSize) * 100)) : 0;
  const isProcessing = status === 'processing';

  const fmtElapsed = (s: number) => s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  const progressLabel = !isProcessing ? '' :
    !isVideo && mode === 'compress' ? 'Compressing in browser…' :
    phase === 'upload' ? `Uploading — ${uploadPct}%` :
    `${mode === 'convert' ? 'Converting' : 'Compressing'} on server — ${fmtElapsed(elapsedSecs)}${compressProgress > 5 ? ` (${compressProgress}%)` : ''}`;

  const actionLabel = !file ? '' :
    mode === 'convert'
      ? `Convert to ${(isVideo ? videoFmt : imageFmt).toUpperCase()}`
      : isVideo ? `Compress to ${videoFmt.toUpperCase()}` : 'Compress Image';

  const videoFmtOptions = [
    { value: 'mp4' as VideoFmt, label: '🎬 MP4 (H.264)', hint: 'Best compatibility — plays everywhere' },
    { value: 'webm' as VideoFmt, label: '🌐 WebM (VP9)', hint: 'Smaller files for web — Chrome, Firefox, Edge' },
  ];
  const imageFmtOptions = [
    { value: 'jpg' as ImageFmt, label: '📷 JPG', hint: 'Best for photos — wide compatibility, smaller files' },
    { value: 'webp' as ImageFmt, label: '🌐 WebP', hint: 'Modern format — best compression, all major browsers' },
    { value: 'png' as ImageFmt, label: '🖼 PNG', hint: 'Lossless with transparency — best for graphics & logos' },
  ];

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 24px 48px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Mode Toggle — always visible */}
      <ModeToggle mode={mode} onChange={m => { setMode(m); handleReset(); }} />

      {/* Mode description */}
      <p style={{ margin: '-8px 0 0', textAlign: 'center', fontSize: 12, color: C.gray500 }}>
        {mode === 'compress'
          ? 'Reduce file size. Adjust quality to balance size vs. clarity.'
          : 'Change file format without losing quality. Quality locked at 100%.'}
      </p>

      {/* Drop Zone */}
      {!file && status !== 'converting' && (
        <div
          style={{ border: `2px dashed ${dragging ? C.blue : C.gray300}`, borderRadius: 16, padding: '48px 40px', textAlign: 'center', cursor: 'pointer', backgroundColor: dragging ? C.blue50 : C.gray50, transition: 'all 0.2s' }}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => document.getElementById('ct-upload')?.click()}
        >
          <input type="file" id="ct-upload" style={{ display: 'none' }} onChange={onInputChange}
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm" />
          <div style={{ width: 64, height: 64, borderRadius: '50%', backgroundColor: C.blue100, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
          <p style={{ fontSize: 17, fontWeight: 600, color: C.gray900, margin: '0 0 6px' }}>
            {dragging ? `Release to ${mode}` : `Drop your file here or click to browse`}
          </p>
          <p style={{ fontSize: 13, color: C.gray500, margin: 0 }}>
            JPEG · PNG · WebP · <strong>HEIC</strong> · MP4 · MOV · WebM · max 500 MB
          </p>
        </div>
      )}

      {/* HEIC converting spinner */}
      {status === 'converting' && (
        <div style={{ textAlign: 'center', padding: '48px 24px', backgroundColor: C.blue50, borderRadius: 16, border: `1px solid ${C.blue200}` }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔄</div>
          <p style={{ margin: '0 0 4px', fontWeight: 600, color: C.gray900 }}>Converting HEIC…</p>
          <p style={{ margin: 0, fontSize: 13, color: C.gray500 }}>Decoding to JPEG in your browser</p>
        </div>
      )}

      {/* File Info */}
      {file && status !== 'converting' && (
        <div style={{ backgroundColor: C.white, borderRadius: 12, padding: '14px 18px', border: `1px solid ${C.gray200}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ overflow: 'hidden' }}>
            <p style={{ margin: '0 0 3px', fontWeight: 600, color: C.gray900, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 380 }}>{file.name}</p>
            <p style={{ margin: 0, fontSize: 12, color: C.gray500 }}>{formatSize(file.size)} · {isVideo ? 'Video' : 'Image'}</p>
          </div>
          {status === 'idle' && (
            <button onClick={handleReset} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gray400, fontSize: 18, lineHeight: 1, padding: '0 0 0 12px', flexShrink: 0 }}>✕</button>
          )}
        </div>
      )}

      {/* Format selector — videos (both modes) */}
      {file && isVideo && status === 'idle' && (
        <FmtPills options={videoFmtOptions} value={videoFmt} onChange={setVideoFmt} />
      )}

      {/* Format selector — images (convert mode only) */}
      {file && !isVideo && mode === 'convert' && status === 'idle' && (
        <FmtPills options={imageFmtOptions} value={imageFmt} onChange={setImageFmt} />
      )}

      {/* Privacy badge — any server-side operation */}
      {file && status === 'idle' && (isVideo || mode === 'convert') && (
        <div style={{ border: `1px solid ${C.blue200}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ backgroundColor: C.blue, color: C.white, padding: '9px 16px', fontWeight: 600, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            ⚡ Secure Server Processing · Files deleted immediately after
          </div>
        </div>
      )}

      {/* Quality slider — compress mode only */}
      {file && status === 'idle' && mode === 'compress' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.gray700, marginBottom: 8 }}>
            <span style={{ fontWeight: 500 }}>Quality</span>
            <span style={{ color: C.gray500 }}>{quality}%</span>
          </div>
          <input type="range" min={1} max={100} value={quality}
            onChange={e => setQuality(Number(e.target.value))}
            style={{ width: '100%', accentColor: C.blue }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.gray400, marginTop: 4 }}>
            <span>Smaller file</span><span>Better quality</span>
          </div>
        </div>
      )}

      {/* Action button */}
      {file && status === 'idle' && (
        <button
          onClick={handleAction}
          style={{ width: '100%', backgroundColor: C.blue, color: C.white, border: 'none', borderRadius: 50, padding: '14px 0', fontSize: 15, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 14px rgba(37,99,235,0.35)', transition: 'background 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = C.blueDark)}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = C.blue)}
        >
          {actionLabel}
        </button>
      )}

      {/* Progress */}
      {isProcessing && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 500, color: C.gray700, marginBottom: 8 }}>
            <span>{progressLabel}</span>
            <span style={{ color: C.gray500 }}>{uploadPct > 0 ? `${uploadPct}%` : ''}</span>
          </div>
          <div style={{ width: '100%', height: 8, backgroundColor: C.gray200, borderRadius: 999, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 999, backgroundColor: C.blue,
              width: phase === 'process' ? `${Math.max(5, compressProgress)}%` : (uploadPct > 0 ? `${uploadPct}%` : '5%'),
              transition: 'width 0.8s ease',
              animation: phase === 'process' && compressProgress < 95 ? 'pulse 1.5s cubic-bezier(.4,0,.6,1) infinite' : 'none',
            }} />
          </div>
          <p style={{ textAlign: 'center', fontSize: 12, color: C.gray400, marginTop: 8 }}>
            {phase === 'upload'
              ? 'Uploading securely… large files can take a few minutes.'
              : isVideo
                ? '⏳ Do not close this tab. Videos take 1–5 minutes depending on size.'
                : 'Converting on server… almost done.'}
          </p>
        </div>
      )}

      {/* Success */}
      {status === 'completed' && (
        <div style={{ backgroundColor: C.green50, border: `1px solid ${C.green200}`, borderRadius: 16, padding: 28, textAlign: 'center' }}>
          <p style={{ fontSize: 20, fontWeight: 700, color: C.green800, margin: '0 0 16px' }}>
            {mode === 'convert' ? '🔄 Conversion Complete!' : '✅ Compression Complete!'}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
            {[
              ['Original', formatSize(originalSize)],
              [mode === 'convert' ? 'Converted' : 'Compressed', formatSize(compressedSize)],
              [mode === 'convert' ? 'Size change' : 'Saved', savings > 0 ? `−${savings}%` : savings === 0 ? '0%' : `+${Math.abs(savings)}%`],
            ].map(([label, val], i) => (
              <div key={label}>
                <p style={{ margin: '0 0 4px', fontSize: 12, color: C.gray500 }}>{label}</p>
                <p style={{ margin: 0, fontSize: i === 2 ? 20 : 14, fontWeight: i === 2 ? 700 : 600, color: i === 2 && savings > 0 ? C.green : C.gray900 }}>{val}</p>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={handleDownload} style={{ backgroundColor: C.green, color: C.white, border: 'none', borderRadius: 50, padding: '12px 28px', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(22,163,74,0.3)' }}>
              ⬇ Download {outputFilename.split('.').pop()?.toUpperCase()}
            </button>
            <button onClick={handleReset} style={{ backgroundColor: C.white, color: C.gray700, border: `1px solid ${C.gray200}`, borderRadius: 50, padding: '12px 22px', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
              {mode === 'convert' ? 'Convert Another' : 'Compress Another'}
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div>
          <div style={{ backgroundColor: C.red50, border: `1px solid ${C.red200}`, color: C.red, borderRadius: 12, padding: '12px 16px', fontSize: 13, textAlign: 'center' }}>
            {error || 'Operation failed. Please try again.'}
          </div>
          <button onClick={handleReset} style={{ width: '100%', marginTop: 10, background: 'none', border: 'none', color: C.gray400, fontSize: 13, cursor: 'pointer', padding: '6px 0' }}>
            ← Try a different file
          </button>
        </div>
      )}
    </div>
  );
}
