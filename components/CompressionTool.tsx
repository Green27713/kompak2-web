'use client';

import { useState, useCallback, useRef } from 'react';
import { compressImage } from '../src/services/compression/compressImage';
import { getFileCategory } from '../src/services/compression/index';

const MAX_BYTES = 500 * 1024 * 1024;

const C = {
  blue: '#2563EB', blueDark: '#1D4ED8', blue50: '#EFF6FF', blue100: '#DBEAFE', blue200: '#BFDBFE',
  gray50: '#F9FAFB', gray100: '#F3F4F6', gray200: '#E5E7EB', gray300: '#D1D5DB',
  gray400: '#9CA3AF', gray500: '#6B7280', gray700: '#374151', gray900: '#111827',
  green: '#16A34A', greenDark: '#15803D', green50: '#F0FDF4', green200: '#BBF7D0', green800: '#166534',
  red: '#DC2626', red50: '#FEF2F2', red200: '#FECACA',
  white: '#FFFFFF', purple: '#7C3AED',
};

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

async function normalizeHEIC(f: File): Promise<File> {
  // Try native decode first — works on Safari, iOS, Chrome/Edge on Mac
  try {
    return await new Promise<File>((resolve, reject) => {
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
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
    // Fallback for Firefox / Windows where HEIC codec isn't native
    const heic2any = (await import('heic2any')).default;
    const result = await heic2any({ blob: f, toType: 'image/jpeg', quality: 0.92 });
    const blob = Array.isArray(result) ? result[0] : result;
    return new File([blob], f.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
  }
}

function xhrUpload(
  formData: FormData,
  signal: AbortSignal,
  onUploadProgress: (pct: number) => void,
): Promise<{ blob: Blob; origSize: number; compSize: number; contentType: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    signal.addEventListener('abort', () => { xhr.abort(); });
    xhr.addEventListener('abort', () => reject(Object.assign(new Error('Cancelled'), { name: 'AbortError' })));
    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable) onUploadProgress(Math.round((e.loaded / e.total) * 75));
    });
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
        contentType: xhr.getResponseHeader('Content-Type') || 'video/mp4',
      });
    });
    xhr.addEventListener('error', () => reject(new Error('Network error. Check your connection and try again.')));
    xhr.responseType = 'blob';
    xhr.open('POST', '/api/compress');
    xhr.send(formData);
  });
}

type VideoFmt = 'mp4' | 'webm';

export default function CompressionTool() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'converting' | 'processing' | 'completed' | 'error'>('idle');
  const [uploadPct, setUploadPct] = useState(0);
  const [phase, setPhase] = useState<'upload' | 'compress'>('upload');
  const [error, setError] = useState<string | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputFilename, setOutputFilename] = useState('');
  const [originalSize, setOriginalSize] = useState(0);
  const [compressedSize, setCompressedSize] = useState(0);
  const [quality, setQuality] = useState(80);
  const [videoFmt, setVideoFmt] = useState<VideoFmt>('mp4');
  const [dragging, setDragging] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  function isHEIC(f: File) {
    return f.type === 'image/heic' || f.type === 'image/heif' ||
      f.name.toLowerCase().endsWith('.heic') || f.name.toLowerCase().endsWith('.heif');
  }

  async function pickFile(raw: File) {
    if (raw.size > MAX_BYTES) { setError('File too large. Max is 500 MB.'); return; }
    if (!getFileCategory(raw) && !isHEIC(raw)) {
      setError('Unsupported file type. Use JPEG, PNG, WebP, HEIC, MP4, MOV, or WebM.');
      return;
    }
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    setError(null); setProgress(0); setOutputUrl(null);

    if (isHEIC(raw)) {
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  function setProgress(p: number) { setUploadPct(p); }

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
    setStatus('processing'); setPhase('upload'); setUploadPct(isVideo ? 0 : 0); setError(null);

    const controller = new AbortController();
    abortRef.current = controller;
    // 10-minute hard limit — enough for a 250MB upload + compression
    const timeout = setTimeout(() => controller.abort(), 600_000);

    try {
      if (isVideo) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('quality', String(quality));
        formData.append('outputFormat', videoFmt);

        const { blob, origSize, compSize } = await xhrUpload(
          formData,
          controller.signal,
          (pct) => { setPhase('upload'); setUploadPct(pct); }
        );

        setPhase('compress'); setUploadPct(90);
        const ext = videoFmt === 'webm' ? 'webm' : 'mp4';
        setOutputUrl(URL.createObjectURL(blob));
        setOutputFilename(`compressed-${file.name.replace(/\.[^.]+$/, '')}.${ext}`);
        setOriginalSize(origSize || file.size);
        setCompressedSize(compSize || blob.size);
      } else {
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
      else setError(err instanceof Error ? err.message : 'Compression failed. Please try again.');
      setStatus('error');
    } finally {
      clearTimeout(timeout);
    }
  }, [file, quality, videoFmt]);

  const handleDownload = useCallback(() => {
    if (!outputUrl) return;
    const a = document.createElement('a'); a.href = outputUrl; a.download = outputFilename; a.click();
  }, [outputUrl, outputFilename]);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    setFile(null); setStatus('idle'); setUploadPct(0); setError(null); setOutputUrl(null);
  }, [outputUrl]);

  const isVideo = file?.type.startsWith('video/');
  const savings = originalSize > 0 ? Math.max(0, Math.round((1 - compressedSize / originalSize) * 100)) : 0;
  const isProcessing = status === 'processing';

  // Progress label
  let progressLabel = '';
  if (isProcessing) {
    if (!isVideo) progressLabel = 'Compressing in browser…';
    else if (phase === 'upload') progressLabel = uploadPct < 75 ? `Uploading — ${uploadPct}%` : 'Upload complete…';
    else progressLabel = 'Compressing on server…';
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 24px 48px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Drop Zone */}
      {!file && status !== 'converting' && (
        <div
          style={{ border: `2px dashed ${dragging ? C.blue : C.gray300}`, borderRadius: 16, padding: '56px 40px', textAlign: 'center', cursor: 'pointer', backgroundColor: dragging ? C.blue50 : C.gray50, transition: 'all 0.2s' }}
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
            JPEG · PNG · WebP · <strong>HEIC</strong> · MP4 · MOV · WebM · max 500 MB
          </p>
        </div>
      )}

      {/* HEIC converting */}
      {status === 'converting' && (
        <div style={{ textAlign: 'center', padding: '48px 24px', backgroundColor: C.blue50, borderRadius: 16, border: `1px solid ${C.blue200}` }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔄</div>
          <p style={{ margin: '0 0 4px', fontWeight: 600, color: C.gray900 }}>Converting HEIC…</p>
          <p style={{ margin: 0, fontSize: 13, color: C.gray500 }}>Converting to JPEG so it can be compressed</p>
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

      {/* Video options row — format + privacy badge */}
      {file && isVideo && status === 'idle' && (
        <>
          {/* Format selector */}
          <div style={{ backgroundColor: C.white, borderRadius: 12, padding: '14px 18px', border: `1px solid ${C.gray200}` }}>
            <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 500, color: C.gray700 }}>Output format</p>
            <div style={{ display: 'flex', gap: 10 }}>
              {(['mp4', 'webm'] as VideoFmt[]).map(fmt => (
                <button
                  key={fmt}
                  onClick={() => setVideoFmt(fmt)}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 10, border: `2px solid ${videoFmt === fmt ? C.blue : C.gray200}`,
                    backgroundColor: videoFmt === fmt ? C.blue50 : C.white,
                    color: videoFmt === fmt ? C.blue : C.gray700,
                    fontWeight: videoFmt === fmt ? 600 : 400, fontSize: 13, cursor: 'pointer',
                  }}
                >
                  {fmt === 'mp4' ? '🎬 MP4 (H.264)' : '🌐 WebM (VP9)'}
                </button>
              ))}
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 11, color: C.gray400 }}>
              {videoFmt === 'mp4' ? 'Best compatibility — plays everywhere' : 'Smaller files for web — Chrome, Firefox, Edge'}
            </p>
          </div>

          {/* Privacy badge */}
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
        </>
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
          style={{ width: '100%', backgroundColor: C.blue, color: C.white, border: 'none', borderRadius: 50, padding: '14px 0', fontSize: 15, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 14px rgba(37,99,235,0.35)', transition: 'background 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = C.blueDark)}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = C.blue)}
        >
          {isVideo ? `Compress & Convert to ${videoFmt.toUpperCase()}` : 'Compress Image'}
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
              width: uploadPct > 0 ? `${uploadPct}%` : '100%',
              transition: 'width 0.4s ease',
              animation: uploadPct === 0 ? 'pulse 2s cubic-bezier(.4,0,.6,1) infinite' : 'none',
            }} />
          </div>
          {isVideo && (
            <p style={{ textAlign: 'center', fontSize: 12, color: C.gray400, marginTop: 8 }}>
              {phase === 'upload' ? 'Uploading securely… large files can take a minute or two.' : 'Server is compressing… almost done.'}
            </p>
          )}
        </div>
      )}

      {/* Success */}
      {status === 'completed' && (
        <div style={{ backgroundColor: C.green50, border: `1px solid ${C.green200}`, borderRadius: 16, padding: 28, textAlign: 'center' }}>
          <p style={{ fontSize: 20, fontWeight: 700, color: C.green800, margin: '0 0 16px' }}>✅ Done!</p>
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
              ⬇ Download {outputFilename.split('.').pop()?.toUpperCase()}
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
