'use client';

import { useState, useCallback, useRef } from 'react';
import { compressImage } from '../src/services/compression/compressImage';
import { getFileCategory } from '../src/services/compression/index';

const MAX_BYTES = 500 * 1024 * 1024; // 500MB

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
    if (f.size > MAX_BYTES) {
      setError(`File too large. Max is 500 MB.`);
      return;
    }
    if (!getFileCategory(f)) {
      setError('Unsupported file type. Please use JPEG, PNG, WebP, HEIC, MP4, MOV, or WebM.');
      return;
    }
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    setFile(f);
    setError(null);
    setProgress(0);
    setStatus('idle');
    setOutputUrl(null);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) pickFile(f);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) pickFile(f);
  }

  const handleCompress = useCallback(async () => {
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    setStatus('processing');
    setIsServerMode(isVideo);
    setProgress(isVideo ? 5 : 0);
    setError(null);

    try {
      if (isVideo) {
        // Videos always go to server — FFmpeg is faster and more reliable than browser WASM
        const formData = new FormData();
        formData.append('file', file);
        formData.append('quality', String(quality));

        const controller = new AbortController();
        abortRef.current = controller;
        const timeout = setTimeout(() => controller.abort(), 300_000);

        try {
          const res = await fetch('/api/compress', {
            method: 'POST',
            body: formData,
            signal: controller.signal,
          });

          clearTimeout(timeout);
          setProgress(90);

          if (!res.ok) {
            const body = await res.json().catch(() => ({ error: 'Server error' }));
            throw new Error(body.error || `Server error ${res.status}`);
          }

          const blob = await res.blob();
          const origSize = parseInt(res.headers.get('X-Original-Size') || String(file.size));
          const compSize = parseInt(res.headers.get('X-Compressed-Size') || String(blob.size));

          setOutputUrl(URL.createObjectURL(blob));
          setOutputFilename(`compressed-${file.name.replace(/\.[^.]+$/, '')}.mp4`);
          setOriginalSize(origSize);
          setCompressedSize(compSize);
        } finally {
          clearTimeout(timeout);
        }
      } else {
        // Images: compress in browser first, server is the implementation (Sharp via API)
        const result = await compressImage(file, { quality });
        const res = await fetch(result.dataUrl);
        const blob = await res.blob();

        setOutputUrl(URL.createObjectURL(blob));
        const ext = blob.type.includes('webp') ? 'webp' : blob.type.includes('png') ? 'png' : 'jpg';
        setOutputFilename(`compressed-${file.name.replace(/\.[^.]+$/, '')}.${ext}`);
        setOriginalSize(file.size);
        setCompressedSize(result.sizeBytes);
        setProgress(100);
      }

      setProgress(100);
      setStatus('completed');
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Compression timed out. Try a smaller file or check your connection.');
      } else {
        setError(err instanceof Error ? err.message : 'Compression failed. Please try again.');
      }
      setStatus('error');
    }
  }, [file, quality]);

  const handleDownload = useCallback(() => {
    if (!outputUrl) return;
    const a = document.createElement('a');
    a.href = outputUrl;
    a.download = outputFilename;
    a.click();
  }, [outputUrl, outputFilename]);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    setFile(null);
    setStatus('idle');
    setProgress(0);
    setError(null);
    setOutputUrl(null);
  }, [outputUrl]);

  const isVideo = file?.type.startsWith('video/');
  const savings = originalSize > 0 ? Math.max(0, Math.round((1 - compressedSize / originalSize) * 100)) : 0;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">

      {/* Drop Zone */}
      {!file && (
        <div
          className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer bg-gray-50 ${dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => document.getElementById('upload')?.click()}
        >
          <input type="file" onChange={onInputChange} className="hidden" id="upload"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm" />
          <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-lg font-semibold text-gray-800">
            {dragging ? 'Release to compress' : 'Drop your file here or click to browse'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            JPEG · PNG · WebP · HEIC · MP4 · MOV · WebM · max 500 MB
          </p>
        </div>
      )}

      {/* File Info */}
      {file && (
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200 flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900 truncate max-w-xs">{file.name}</p>
            <p className="text-sm text-gray-500">{formatSize(file.size)} · {isVideo ? 'Video' : 'Image'}</p>
          </div>
          {status === 'idle' && (
            <button onClick={handleReset} className="text-sm text-gray-400 hover:text-gray-600 ml-4">✕</button>
          )}
        </div>
      )}

      {/* Privacy Badge — videos */}
      {file && isVideo && status === 'idle' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl overflow-hidden">
          <div className="bg-blue-600 text-white px-4 py-2 font-semibold flex items-center gap-2 text-sm">
            <span>⚡</span> Fast &amp; Secure Server Compression
          </div>
          <div className="p-4 bg-white m-3 rounded-lg shadow-sm border border-gray-100">
            <p className="font-semibold text-gray-900 mb-2 text-sm">🔒 Privacy Guarantee:</p>
            <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
              <li>Transferred via HTTPS — encrypted in transit</li>
              <li>Automatically deleted within 1 second of completion</li>
              <li>Never stored, logged, or shared</li>
            </ul>
          </div>
        </div>
      )}

      {/* Quality Slider */}
      {file && status === 'idle' && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span className="font-medium">Quality</span>
            <span>{quality}%</span>
          </div>
          <input
            type="range" min={1} max={100} value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
            className="w-full accent-blue-600"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>Smaller file</span>
            <span>Better quality</span>
          </div>
        </div>
      )}

      {/* Compress Button */}
      {file && status === 'idle' && (
        <button
          onClick={handleCompress}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-full shadow-lg shadow-blue-500/30 transition-all"
        >
          Compress {isVideo ? 'Video' : 'Image'}
        </button>
      )}

      {/* Progress */}
      {status === 'processing' && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm font-medium text-gray-700">
            <span>
              {isServerMode
                ? progress < 90 ? 'Uploading to secure server…' : 'Compressing…'
                : 'Compressing in browser…'}
            </span>
            <span>{progress > 5 ? `${progress}%` : 'Please wait'}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-2.5 rounded-full transition-all duration-500 ${progress <= 5 ? 'animate-pulse bg-blue-400 w-full' : 'bg-blue-600'}`}
              style={{ width: progress > 5 ? `${progress}%` : '100%' }}
            />
          </div>
          <p className="text-xs text-gray-500 text-center">
            {isServerMode ? 'Large files may take 10–60 seconds to process.' : 'Processing locally in your browser.'}
          </p>
        </div>
      )}

      {/* Success */}
      {status === 'completed' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center space-y-4">
          <h3 className="text-xl font-bold text-green-800">✅ Compression Complete!</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Original</p>
              <p className="font-semibold text-gray-800">{formatSize(originalSize)}</p>
            </div>
            <div>
              <p className="text-gray-500">Compressed</p>
              <p className="font-semibold text-gray-800">{formatSize(compressedSize)}</p>
            </div>
            <div>
              <p className="text-gray-500">Saved</p>
              <p className="font-bold text-green-700 text-lg">{savings}%</p>
            </div>
          </div>
          <div className="flex gap-3 justify-center pt-2 flex-wrap">
            <button
              onClick={handleDownload}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-8 rounded-full shadow-lg shadow-green-500/30 transition-all"
            >
              Download
            </button>
            <button
              onClick={handleReset}
              className="bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 px-6 rounded-full border border-gray-200 transition-all"
            >
              Compress Another
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="space-y-3">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-center text-sm">
            {error || 'Compression failed. Please try again.'}
          </div>
          <button onClick={handleReset} className="w-full text-sm text-gray-500 hover:text-gray-700 py-2">
            ← Try a different file
          </button>
        </div>
      )}
    </div>
  );
}
