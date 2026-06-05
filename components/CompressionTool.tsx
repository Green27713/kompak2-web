'use client';

import { useState, useCallback, useRef } from 'react';
import { compressImage } from '../src/services/compression/compressImage';
import { getFileCategory } from '../src/services/compression/index';

const MAX_BYTES = 500 * 1024 * 1024;

// Colors
const C = {
  blue: '#2563EB',
  blueDark: '#1D4ED8',
  blue50: '#EFF6FF',
  blue100: '#DBEAFE',
  blue200: '#BFDBFE',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray700: '#374151',
  gray900: '#111827',
  green: '#16A34A',
  greenDark: '#15803D',
  green50: '#F0FDF4',
  green200: '#BBF7D0',
  green800: '#166534',
  red: '#DC2626',
  red50: '#FEF2F2',
  red200: '#FECACA',
  white: '#FFFFFF',
};

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

export default function CompressionTool() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'processing' | 'completed' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isServerMode, setIsServerMode] = useState(false);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputFilename, setOutputFilename] = useState('');
  const [originalSize, setOriginalSize] = useState(0);
  const [compressedSize, setCompressedSize] = useState(0);
  const [quality, setQuality] = useState(80);
  const [dragging, setDragging] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  function pickFile(f: File) {
    if (f.size > MAX_BYTES) { setError('File too large. Max is 500 MB.'); return; }
    if (!getFileCategory(f)) { setError('Unsupported file type. Use JPEG, PNG, WebP, HEIC, MP4, MOV, or WebM.'); return; }
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    setFile(f); setError(null); setProgress(0); setStatus('idle'); setOutputUrl(null);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (f) pickFile(f);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files?.[0]; if (f) pickFile(f);
  }

  const handleCompress = useCallback(async () => {
    if (!file) return;
    const isVideo = file.type.startsWith('video/');
    setStatus('processing'); setIsServerMode(isVideo); setProgress(isVideo ? 5 : 0); setError(null);

    try {
      if (isVideo) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('quality', String(quality));
        const controller = new AbortController();
        abortRef.current = controller;
        const timeout = setTimeout(() => controller.abort(), 300_000);
        try {
          const res = await fetch('/api/compress', { method: 'POST', body: formData, signal: controller.signal });
          clearTimeout(timeout); setProgress(90);
          if (!res.ok) { const b = await res.json().catch(() => ({ error: 'Server error' })); throw new Error(b.error || `Error ${res.status}`); }
          const blob = await res.blob();
          const origSize = parseInt(res.headers.get('X-Original-Size') || String(file.size));
          const compSize = parseInt(res.headers.get('X-Compressed-Size') || String(blob.size));
          setOutputUrl(URL.createObjectURL(blob));
          setOutputFilename(`compressed-${file.name.replace(/\.[^.]+$/, '')}.mp4`);
          setOriginalSize(origSize); setCompressedSize(compSize);
        } finally { clearTimeout(timeout); }
      } else {
        const result = await compressImage(file, { quality });
        const res = await fetch(result.dataUrl);
        const blob = await res.blob();
        const ext = blob.type.includes('webp') ? 'webp' : blob.type.includes('png') ? 'png' : 'jpg';
        setOutputUrl(URL.createObjectURL(blob));
        setOutputFilename(`compressed-${file.name.replace(/\.[^.]+$/, '')}.${ext}`);
        setOriginalSize(file.size); setCompressedSize(result.sizeBytes); setProgress(100);
      }
      setProgress(100); setStatus('completed');
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') setError('Timed out. Try a smaller file or check your connection.');
      else setError(err instanceof Error ? err.message : 'Compression failed. Please try again.');
      setStatus('error');
    }
  }, [file, quality]);

  const handleDownload = useCallback(() => {
    if (!outputUrl) return;
    const a = document.createElement('a'); a.href = outputUrl; a.download = outputFilename; a.click();
  }, [outputUrl, outputFilename]);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    setFile(null); setStatus('idle'); setProgress(0); setError(null); setOutputUrl(null);
  }, [outputUrl]);

  const isVideo = file?.type.startsWith('video/');
  const savings = originalSize > 0 ? Math.max(0, Math.round((1 - compressedSize / originalSize) * 100)) : 0;

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 24px 48px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Drop Zone */}
      {!file && (
        <div
          style={{
            border: `2px dashed ${dragging ? C.blue : C.gray300}`,
            borderRadius: 16, padding: '56px 40px', textAlign: 'center',
            cursor: 'pointer', backgroundColor: dragging ? C.blue50 : C.gray50,
            transition: 'all 0.2s',
          }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => document.getElementById('ct-upload')?.click()}
        >
          <input type="file" id="ct-upload" style={{ display: 'none' }} onChange={onInputChange}
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm" />
          <div style={{ fontSize: 40, marginBottom: 12 }}>📁</div>
          <p style={{ fontSize: 17, fontWeight: 600, color: C.gray900, margin: '0 0 6px' }}>
            {dragging ? 'Release to compress' : 'Drop your file here or click to browse'}
          </p>
          <p style={{ fontSize: 13, color: C.gray500, margin: 0 }}>
            JPEG · PNG · WebP · HEIC · MP4 · MOV · WebM · max 500 MB
          </p>
        </div>
      )}

      {/* File Info */}
      {file && (
        <div style={{ backgroundColor: C.white, borderRadius: 12, padding: '14px 18px', border: `1px solid ${C.gray200}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div>
            <p style={{ margin: '0 0 3px', fontWeight: 600, color: C.gray900, fontSize: 14 }}>{file.name}</p>
            <p style={{ margin: 0, fontSize: 12, color: C.gray500 }}>{formatSize(file.size)} · {isVideo ? 'Video' : 'Image'}</p>
          </div>
          {status === 'idle' && (
            <button onClick={handleReset} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gray400, fontSize: 18, lineHeight: 1, padding: '0 0 0 12px' }}>✕</button>
          )}
        </div>
      )}

      {/* Privacy Badge — videos only */}
      {file && isVideo && status === 'idle' && (
        <div style={{ border: `1px solid ${C.blue200}`, borderRadius: 14, overflow: 'hidden', backgroundColor: C.blue50 }}>
          <div style={{ backgroundColor: C.blue, color: C.white, padding: '10px 16px', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
            ⚡ Fast &amp; Secure Server Compression
          </div>
          <div style={{ margin: 12, backgroundColor: C.white, borderRadius: 10, padding: '14px 16px', border: `1px solid ${C.gray100}` }}>
            <p style={{ margin: '0 0 8px', fontWeight: 600, color: C.gray900, fontSize: 13 }}>🔒 Privacy Guarantee:</p>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: C.gray700, lineHeight: 1.7 }}>
              <li>Transferred via HTTPS — encrypted in transit</li>
              <li>Automatically deleted within 1 second of completion</li>
              <li>Never stored, logged, or shared</li>
            </ul>
          </div>
        </div>
      )}

      {/* Quality Slider */}
      {file && status === 'idle' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.gray700, marginBottom: 8 }}>
            <span style={{ fontWeight: 500 }}>Quality</span>
            <span style={{ color: C.gray500 }}>{quality}%</span>
          </div>
          <input type="range" min={1} max={100} value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
            style={{ width: '100%', accentColor: C.blue }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.gray400, marginTop: 4 }}>
            <span>Smaller file</span><span>Better quality</span>
          </div>
        </div>
      )}

      {/* Compress Button */}
      {file && status === 'idle' && (
        <button
          onClick={handleCompress}
          style={{
            width: '100%', backgroundColor: C.blue, color: C.white,
            border: 'none', borderRadius: 50, padding: '14px 0',
            fontSize: 15, fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(37,99,235,0.35)', transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = C.blueDark)}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = C.blue)}
        >
          Compress {isVideo ? 'Video' : 'Image'}
        </button>
      )}

      {/* Progress */}
      {status === 'processing' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 500, color: C.gray700, marginBottom: 8 }}>
            <span>{isServerMode ? (progress < 90 ? 'Uploading to secure server…' : 'Compressing…') : 'Compressing in browser…'}</span>
            <span style={{ color: C.gray500 }}>{progress > 5 ? `${progress}%` : 'Please wait'}</span>
          </div>
          <div style={{ width: '100%', height: 8, backgroundColor: C.gray200, borderRadius: 999, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 999, backgroundColor: C.blue,
              width: progress > 5 ? `${progress}%` : '100%',
              transition: 'width 0.5s ease',
              animation: progress <= 5 ? 'pulse 2s cubic-bezier(.4,0,.6,1) infinite' : 'none',
            }} />
          </div>
          <p style={{ textAlign: 'center', fontSize: 12, color: C.gray400, marginTop: 8 }}>
            {isServerMode ? 'Large files may take 10–60 seconds to process.' : 'Processing locally in your browser.'}
          </p>
        </div>
      )}

      {/* Success */}
      {status === 'completed' && (
        <div style={{ backgroundColor: C.green50, border: `1px solid ${C.green200}`, borderRadius: 16, padding: 28, textAlign: 'center' }}>
          <p style={{ fontSize: 20, fontWeight: 700, color: C.green800, margin: '0 0 16px' }}>✅ Compression Complete!</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
            {[['Original', formatSize(originalSize)], ['Compressed', formatSize(compressedSize)], ['Saved', `${savings}%`]].map(([label, val], i) => (
              <div key={label}>
                <p style={{ margin: '0 0 4px', fontSize: 12, color: C.gray500 }}>{label}</p>
                <p style={{ margin: 0, fontSize: i === 2 ? 22 : 14, fontWeight: i === 2 ? 700 : 600, color: i === 2 ? C.green : C.gray900 }}>{val}</p>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={handleDownload} style={{ backgroundColor: C.green, color: C.white, border: 'none', borderRadius: 50, padding: '12px 28px', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(22,163,74,0.3)' }}>
              ⬇ Download
            </button>
            <button onClick={handleReset} style={{ backgroundColor: C.white, color: C.gray700, border: `1px solid ${C.gray200}`, borderRadius: 50, padding: '12px 22px', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
              Compress Another
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div>
          <div style={{ backgroundColor: C.red50, border: `1px solid ${C.red200}`, color: C.red, borderRadius: 12, padding: '12px 16px', fontSize: 13, textAlign: 'center' }}>
            {error || 'Compression failed. Please try again.'}
          </div>
          <button onClick={handleReset} style={{ width: '100%', marginTop: 10, background: 'none', border: 'none', color: C.gray400, fontSize: 13, cursor: 'pointer', padding: '6px 0' }}>
            ← Try a different file
          </button>
        </div>
      )}
    </div>
  );
}
