'use client';

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="min-h-screen flex items-center justify-center p-6 bg-bg-page">
    <div role="alert" className="max-w-md bg-surface rounded-card border p-6 space-y-4">
      <h1 className="text-xl font-semibold">Không thể tải trang</h1>
      <p>Máy chủ gặp lỗi khi xử lý yêu cầu. Bạn có thể thử tải lại trang.</p>
      <button type="button" onClick={reset} className="min-h-[44px] px-4 py-2 rounded-control bg-primary text-white">Thử lại</button>
    </div>
  </main>;
}
