import * as React from 'react';

/** A preview must not report successful writes when it has no persistence. */
export function FeaturePreview({ children }: { children: React.ReactNode }) {
  return <section className="space-y-4">
    <div role="status" className="rounded-card border border-warning/30 bg-warning-bg p-4 text-sm">
      <p className="font-semibold">Tính năng đang hoàn thiện</p>
      <p>Nội dung bên dưới là dữ liệu minh họa để xem trước. Chức năng lưu thay đổi chưa sẵn sàng.</p>
    </div>
    <fieldset disabled className="min-w-0" aria-label="Bản xem trước, chưa hỗ trợ lưu dữ liệu">
      <div inert>{children}</div>
    </fieldset>
  </section>;
}
