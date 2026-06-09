'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ReactCompareSlider,
  ReactCompareSliderHandle,
  ReactCompareSliderImage,
} from 'react-compare-slider';

export interface ComparisonSmartSettings {
  jpegQuality: number;
  chromaSubsampling: string;
  sharpenBeforeCompress: boolean;
}

export interface ComparisonSliderProps {
  originalUrl: string;
  compressedUrl: string;
  originalSize: number;
  compressedSize: number;
  savingsPercent: number;
  mimeType: string;
  contentType?: string;
  settings?: ComparisonSmartSettings;
}

const SMART_BADGE: Record<string, string> = {
  portrait: 'Portrait · skin chroma preserved',
  product: 'Product · full edge resolution',
  screenshot: 'Screenshot · lossless edge preservation',
  landscape: 'Landscape · aggressive chroma compression',
  graphic: 'Graphic · flat fill protection',
};

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(2) + ' MB';
}

function LabelPill({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span style={{
      display: 'inline-block',
      backgroundColor: accent ? '#16A34A' : 'rgba(0,0,0,0.55)',
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.04em',
      padding: '3px 9px',
      borderRadius: 20,
      lineHeight: 1.5,
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

function ImageSlider({ originalUrl, compressedUrl, originalSize, compressedSize, savingsPercent }: {
  originalUrl: string; compressedUrl: string;
  originalSize: number; compressedSize: number; savingsPercent: number;
}) {
  return (
    <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', lineHeight: 0 }}>
      <ReactCompareSlider
        defaultPosition={50}
        handle={
          <ReactCompareSliderHandle
            buttonStyle={{
              background: '#FFFFFF',
              border: '2px solid rgba(255,255,255,0.9)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
              color: '#374151',
              width: 44,
              height: 44,
            }}
            linesStyle={{
              background: 'rgba(255,255,255,0.85)',
              width: 2,
            }}
          />
        }
        itemOne={
          <ReactCompareSliderImage
            src={originalUrl}
            alt="Original"
            style={{ objectFit: 'contain', backgroundColor: '#F3F4F6' }}
          />
        }
        itemTwo={
          <ReactCompareSliderImage
            src={compressedUrl}
            alt="Compressed"
            style={{ objectFit: 'contain', backgroundColor: '#F3F4F6' }}
          />
        }
      />
      <div style={{
        position: 'absolute', top: 12, left: 12,
        display: 'flex', flexDirection: 'column', gap: 4,
        pointerEvents: 'none', zIndex: 10,
      }}>
        <LabelPill>Original</LabelPill>
        <LabelPill>{formatBytes(originalSize)}</LabelPill>
      </div>
      <div style={{
        position: 'absolute', top: 12, right: 12,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4,
        pointerEvents: 'none', zIndex: 10,
      }}>
        <LabelPill>Compressed</LabelPill>
        <LabelPill>{formatBytes(compressedSize)}</LabelPill>
        {savingsPercent > 0.5 && (
          <LabelPill accent>−{savingsPercent.toFixed(1)}% smaller</LabelPill>
        )}
      </div>
    </div>
  );
}

function VideoSlider({ originalUrl, compressedUrl, originalSize, compressedSize, savingsPercent }: {
  originalUrl: string; compressedUrl: string;
  originalSize: number; compressedSize: number; savingsPercent: number;
}) {
  const origRef = useRef<HTMLVideoElement>(null);
  const compRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  function toggle() {
    if (playing) {
      origRef.current?.pause();
      compRef.current?.pause();
      setPlaying(false);
    } else {
      origRef.current?.play();
      compRef.current?.play();
      setPlaying(true);
    }
  }

  return (
    <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', lineHeight: 0 }}>
      <ReactCompareSlider
        defaultPosition={50}
        handle={
          <div style={{
            width: 2, height: '100%',
            background: 'rgba(255,255,255,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'ew-resize',
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: '#FFFFFF', boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, userSelect: 'none', color: '#374151',
            }}>
              ⇔
            </div>
          </div>
        }
        itemOne={
          <video
            ref={origRef}
            src={originalUrl}
            muted
            loop
            playsInline
            style={{ width: '100%', display: 'block', backgroundColor: '#000' }}
            onSeeked={() => {
              if (compRef.current) compRef.current.currentTime = origRef.current?.currentTime ?? 0;
            }}
          />
        }
        itemTwo={
          <video
            ref={compRef}
            src={compressedUrl}
            muted
            loop
            playsInline
            style={{ width: '100%', display: 'block', backgroundColor: '#000' }}
            onSeeked={() => {
              if (origRef.current) origRef.current.currentTime = compRef.current?.currentTime ?? 0;
            }}
          />
        }
      />
      <div style={{
        position: 'absolute', top: 12, left: 12,
        display: 'flex', flexDirection: 'column', gap: 4,
        pointerEvents: 'none', zIndex: 10,
      }}>
        <LabelPill>Original</LabelPill>
        <LabelPill>{formatBytes(originalSize)}</LabelPill>
      </div>
      <div style={{
        position: 'absolute', top: 12, right: 12,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4,
        pointerEvents: 'none', zIndex: 10,
      }}>
        <LabelPill>Compressed</LabelPill>
        <LabelPill>{formatBytes(compressedSize)}</LabelPill>
        {savingsPercent > 0.5 && (
          <LabelPill accent>−{savingsPercent.toFixed(1)}% smaller</LabelPill>
        )}
      </div>
      <button
        onClick={toggle}
        style={{
          position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10, width: 40, height: 40, borderRadius: '50%',
          background: 'rgba(255,255,255,0.9)', border: 'none',
          cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {playing ? '⏸' : '▶'}
      </button>
    </div>
  );
}

function MobileStack({ originalSize, compressedSize, savingsPercent }: {
  originalSize: number; compressedSize: number; savingsPercent: number;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{
        backgroundColor: '#F9FAFB', borderRadius: 10, padding: '16px 20px',
        border: '1px solid #E5E7EB', textAlign: 'center',
      }}>
        <p style={{ margin: '0 0 4px', fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Original
        </p>
        <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>
          {formatBytes(originalSize)}
        </p>
      </div>
      <div style={{ textAlign: 'center', fontSize: 20, color: '#9CA3AF', lineHeight: 1 }}>↓</div>
      <div style={{
        backgroundColor: '#F0FDF4', borderRadius: 10, padding: '16px 20px',
        border: '1px solid #BBF7D0', textAlign: 'center',
      }}>
        <p style={{ margin: '0 0 4px', fontSize: 11, color: '#16A34A', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Compressed
        </p>
        <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#166534' }}>
          {formatBytes(compressedSize)}
        </p>
        {savingsPercent > 0.5 && (
          <span style={{
            display: 'inline-block', marginTop: 6,
            backgroundColor: '#16A34A', color: '#FFF',
            fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20,
          }}>
            −{savingsPercent.toFixed(1)}% smaller
          </span>
        )}
      </div>
    </div>
  );
}

function SmartBadge({ contentType, settings }: { contentType: string; settings?: ComparisonSmartSettings }) {
  const text = SMART_BADGE[contentType];
  if (!text) return null;

  const detail = settings
    ? ` · q${settings.jpegQuality} · ${settings.chromaSubsampling}${settings.sharpenBeforeCompress ? ' · sharpened' : ''}`
    : '';

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE',
      borderRadius: 20, padding: '6px 14px', fontSize: 12, color: '#1D4ED8',
    }}>
      <span style={{ fontSize: 14 }}>🧠</span>
      <span style={{ fontWeight: 600 }}>SmartCompress</span>
      <span style={{ color: '#60A5FA' }}>·</span>
      <span>{text}{detail}</span>
    </div>
  );
}

export default function ComparisonSlider({
  originalUrl,
  compressedUrl,
  originalSize,
  compressedSize,
  savingsPercent,
  mimeType,
  contentType,
  settings,
}: ComparisonSliderProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const isVideo = mimeType.startsWith('video/');

  return (
    <div>
      {isMobile ? (
        <MobileStack
          originalSize={originalSize}
          compressedSize={compressedSize}
          savingsPercent={savingsPercent}
        />
      ) : isVideo ? (
        <VideoSlider
          originalUrl={originalUrl}
          compressedUrl={compressedUrl}
          originalSize={originalSize}
          compressedSize={compressedSize}
          savingsPercent={savingsPercent}
        />
      ) : (
        <ImageSlider
          originalUrl={originalUrl}
          compressedUrl={compressedUrl}
          originalSize={originalSize}
          compressedSize={compressedSize}
          savingsPercent={savingsPercent}
        />
      )}

      {contentType && !isMobile && (
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <SmartBadge contentType={contentType} settings={settings} />
        </div>
      )}
    </div>
  );
}
