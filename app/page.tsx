import CompressionTool from '@/components/CompressionTool';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-xl font-semibold text-gray-900 tracking-tight">
            PixSnug<sup className="text-xs text-gray-400 font-normal ml-0.5">™</sup>
          </span>
          <a
            href="https://ko-fi.com/pixsnug"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-full px-3 py-1 transition-colors"
          >
            ☕ Support
          </a>
        </div>
      </header>

      {/* Hero */}
      <div className="max-w-2xl mx-auto px-6 pt-12 pb-4 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          Compress Images &amp; Videos
        </h1>
        <p className="text-gray-500">
          Free, fast, and private. Up to 500 MB. Files deleted from server within seconds.
        </p>
      </div>

      {/* Tool */}
      <CompressionTool />

      {/* Footer */}
      <footer className="mt-16 py-8 border-t border-gray-200 text-center text-xs text-gray-400">
        <p>© 2025 PixSnug™ — Built by a Navy veteran in Patong, Thailand</p>
        <p className="mt-1">Files are never stored, logged, or shared.</p>
      </footer>
    </main>
  );
}
