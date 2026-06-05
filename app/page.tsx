import CompressionTool from '@/components/CompressionTool';

export default function Home() {
  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F9FAFB', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <header style={{
        backgroundColor: '#FFFFFF', borderBottom: '1px solid #E5E7EB',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ textDecoration: 'none', fontSize: 20, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' }}>
            PixSnug<sup style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 400, marginLeft: 1 }}>™</sup>
          </a>
          <a
            href="https://ko-fi.com/pixsnug"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 13, color: '#6B7280', border: '1px solid #E5E7EB', borderRadius: 20, padding: '5px 14px', textDecoration: 'none' }}
          >
            ☕ Support
          </a>
        </div>
      </header>

      {/* Hero */}
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '48px 24px 8px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 20, padding: '5px 14px', fontSize: 12, color: '#2563EB', fontWeight: 500, marginBottom: 18 }}>
          🔒 Free · Private · No account needed
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: '#111827', margin: '0 0 12px', letterSpacing: '-0.02em' }}>
          Compress Images &amp; Videos
        </h1>
        <p style={{ fontSize: 16, color: '#6B7280', margin: 0, lineHeight: 1.6 }}>
          Up to 500 MB. JPEG · PNG · HEIC · MP4 · WebM. Files deleted from server instantly.
        </p>
      </div>

      {/* Tool */}
      <CompressionTool />

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #E5E7EB', padding: '28px 24px', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: 12, color: '#9CA3AF' }}>© 2025 PixSnug™ — Built by a Navy veteran in Patong, Thailand</p>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9CA3AF' }}>Files are never stored, logged, or shared.</p>
      </footer>

    </main>
  );
}
