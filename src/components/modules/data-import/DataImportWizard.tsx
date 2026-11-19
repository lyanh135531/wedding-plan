'use client';

import * as React from 'react';
import { useRole } from '@/context/RoleContext';
import { PrototypeState } from '@/components/testing/PrototypeToolbar';
import { StateWrapper } from '@/components/testing/StateWrapper';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FileUp, CheckCircle2, AlertTriangle, ArrowRight, RotateCcw, FileSpreadsheet } from 'lucide-react';

const h = React.createElement;

export interface ImportErrorRow {
  rowNumber: number;
  fieldName: string;
  rawValue: string;
  errorMessage: string;
}

export const SAMPLE_IMPORT_ERRORS: ImportErrorRow[] = [
  { rowNumber: 14, fieldName: 'phone', rawValue: '09012abc', errorMessage: 'Số điện thoại chứa ký tự chữ không hợp lệ' },
  { rowNumber: 42, fieldName: 'ageTier', rawValue: 'thanh_nien', errorMessage: 'Độ tuổi không thuộc danh mục: adult, child, baby' },
];

export interface DataImportWizardProps {
  initialState?: PrototypeState;
}

export const DataImportWizard: React.FC<DataImportWizardProps> = ({
  initialState = 'populated',
}) => {
  const { isFamily } = useRole();
  const [state, setState] = React.useState<PrototypeState>(initialState);
  const [step, setStep] = React.useState<number>(3); // Default to Step 3 for testing row error review per UXT23
  const [skipErrors, setSkipErrors] = React.useState(true);
  const [isCommitted, setIsCommitted] = React.useState(false);

  React.useEffect(() => {
    setState(initialState);
  }, [initialState]);

  // Family View is strictly forbidden from import (R3 / UXT16)
  const effectiveState = isFamily ? 'permission_denied' : state;

  const loadingSkeleton = h(
    'div',
    { className: 'space-y-4 animate-pulse', role: 'status', 'aria-label': 'Đang phân tích tệp dữ liệu' },
    h('div', { className: 'h-16 bg-border-subtle rounded-control' }),
    h('div', { className: 'h-64 bg-border-subtle rounded-card' })
  );

  return h(
    StateWrapper,
    {
      state: effectiveState,
      loadingSkeleton,
      emptyTitle: 'Chưa có tệp nào được tải lên',
      emptyDescription: 'Chọn tệp CSV hoặc Excel (tối đa 5MB, 5.000 dòng) từ máy tính của bạn.',
      emptyActionLabel: 'Chọn tệp từ máy',
      onEmptyAction: () => {
        setStep(1);
        setState('populated');
      },
      errorTitle: 'Lỗi định dạng tệp tải lên',
      errorMessage: 'Tệp tải lên không đúng định dạng CSV/XLSX hoặc bị hỏng.',
      errorRequestId: 'REQ-20261106-IMPORT-ERR',
      onRetry: () => setState('populated'),
      filteredTitle: 'Không có dòng dữ liệu hợp lệ',
      filteredDescription: 'Toàn bộ các dòng trong tệp đều không đạt chuẩn hợp lệ.',
      onClearFilter: () => setState('populated'),
      permissionDeniedMessage: 'Tính năng Nhập dữ liệu chỉ dành cho Chủ sở hữu đám cưới.',
    },
    h(
      'div',
      { className: 'space-y-6 max-w-4xl mx-auto' },
      // Header
      h(
        'div',
        { className: 'border-b border-border-subtle pb-4' },
        h('h1', { className: 'text-2xl font-bold text-text-main tracking-tight' }, 'Nhập Khách Mời Hàng Loạt (Excel/CSV)'),
        h('p', { className: 'text-sm text-text-muted mt-0.5' }, 'Quy trình 5 bước: Kiểm tra an toàn, lọc lỗi theo dòng và commit nguyên tử')
      ),

      // Step indicator
      h(
        'div',
        { className: 'flex items-center justify-between text-xs font-semibold text-text-muted bg-page p-3 rounded-control border border-border-subtle' },
        h('span', { className: step === 1 ? 'text-primary font-bold' : '' }, '1. Chọn tệp'),
        h(ArrowRight, { className: 'w-3 h-3 text-text-muted' }),
        h('span', { className: step === 2 ? 'text-primary font-bold' : '' }, '2. Khớp cột'),
        h(ArrowRight, { className: 'w-3 h-3 text-text-muted' }),
        h('span', { className: step === 3 ? 'text-primary font-bold' : '' }, '3. Xử lý dòng lỗi (UXT23)'),
        h(ArrowRight, { className: 'w-3 h-3 text-text-muted' }),
        h('span', { className: step === 4 ? 'text-primary font-bold' : '' }, '4. Xem trước'),
        h(ArrowRight, { className: 'w-3 h-3 text-text-muted' }),
        h('span', { className: step === 5 ? 'text-primary font-bold' : '' }, '5. Hoàn tất')
      ),

      // Step 3: Row-by-row error table (UXT23)
      step === 3 &&
        h(
          'div',
          { className: 'bg-surface border border-border-subtle rounded-card shadow-sm p-6 space-y-4' },
          h(
            'div',
            { className: 'flex items-center justify-between border-b border-border-subtle pb-3' },
            h(
              'div',
              { className: 'flex items-center gap-2' },
              h(AlertTriangle, { className: 'w-5 h-5 text-warning' }),
              h('h2', { className: 'text-base font-bold text-text-main' }, 'Phát hiện 2 dòng dữ liệu lỗi')
            ),
            h(
              'span',
              { className: 'text-xs bg-danger-bg text-danger font-semibold px-2 py-0.5 rounded' },
              '2 / 100 dòng'
            )
          ),

          h(
            'p',
            { className: 'text-xs text-text-muted' },
            'Các dòng dưới đây không đạt quy tắc xác thực. Bạn có thể chọn bỏ qua các dòng lỗi này để tiếp tục tạo 98 khách hợp lệ còn lại.'
          ),

          // Error Grid Table
          h(
            'div',
            { className: 'w-full overflow-x-auto border border-border-subtle rounded text-xs' },
            h(
              'table',
              { className: 'w-full text-left border-collapse', 'aria-label': 'Bảng chi tiết dòng lỗi' },
              h(
                'thead',
                { className: 'bg-page font-semibold text-text-muted uppercase border-b border-border-subtle' },
                h(
                  'tr',
                  null,
                  h('th', { className: 'p-2.5' }, 'Dòng số'),
                  h('th', { className: 'p-2.5' }, 'Trường lỗi'),
                  h('th', { className: 'p-2.5' }, 'Giá trị gốc'),
                  h('th', { className: 'p-2.5' }, 'Lý do từ chối')
                )
              ),
              h(
                'tbody',
                { className: 'divide-y divide-border-subtle' },
                SAMPLE_IMPORT_ERRORS.map((err) =>
                  h(
                    'tr',
                    { key: err.rowNumber, className: 'hover:bg-black/[0.02]' },
                    h('td', { className: 'p-2.5 font-mono font-bold' }, `#${err.rowNumber}`),
                    h('td', { className: 'p-2.5 font-semibold text-text-main' }, err.fieldName),
                    h('td', { className: 'p-2.5 font-mono text-danger' }, err.rawValue),
                    h('td', { className: 'p-2.5 text-text-muted' }, err.errorMessage)
                  )
                )
              )
            )
          ),

          // Checkbox Skip Invalid Rows (UXT23)
          h(
            'div',
            { className: 'p-3 bg-page border border-border-subtle rounded-control' },
            h(Checkbox, {
              checked: skipErrors,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => setSkipErrors(e.target.checked),
              label: 'Bỏ qua 2 dòng lỗi này và tiếp tục nhập 98 dòng hợp lệ',
            })
          ),

          // Actions
          h(
            'div',
            { className: 'flex justify-end gap-3 pt-3 border-t border-border-subtle' },
            h(Button, { variant: 'secondary', onClick: () => setStep(2) }, 'Quay lại khớp cột'),
            h(Button, { variant: 'primary', onClick: () => setStep(4) }, 'Tiếp tục xem trước (Bước 4)')
          )
        ),

      // Step 4: Summary Preview
      step === 4 &&
        h(
          'div',
          { className: 'bg-surface border border-border-subtle rounded-card shadow-sm p-6 space-y-4' },
          h('h2', { className: 'text-base font-bold text-text-main' }, 'Xác nhận cam kết nhập dữ liệu (Commit Preview)'),
          h(
            'div',
            { className: 'p-4 bg-primary/10 border border-primary/20 rounded-control space-y-1.5 text-sm text-text-main' },
            h('p', { className: 'font-semibold text-primary' }, '📋 Tóm tắt kết quả:'),
            h('p', null, '• Sẽ tạo mới: ', h('span', { className: 'font-bold' }, '98 khách mời')),
            h('p', null, '• Bỏ qua: ', h('span', { className: 'font-bold text-danger' }, '2 dòng lỗi')),
            h('p', null, '• Cơ chế: Toàn vẹn nguyên tử (Atomic transaction), không ghi đè hồ sơ cũ')
          ),
          h(
            'div',
            { className: 'flex justify-end gap-3 pt-3 border-t border-border-subtle' },
            h(Button, { variant: 'secondary', onClick: () => setStep(3) }, 'Quay lại'),
            h(
              Button,
              {
                variant: 'primary',
                onClick: () => {
                  setIsCommitted(true);
                  setStep(5);
                },
              },
              'Xác nhận nhập 98 khách mời'
            )
          )
        ),

      // Step 5: Finished & Rollback option
      step === 5 &&
        h(
          'div',
          { className: 'bg-surface border border-border-subtle rounded-card shadow-sm p-6 text-center space-y-4' },
          h(
            'div',
            { className: 'w-16 h-16 rounded-full bg-[#E8F5E9] text-[#2E7D32] flex items-center justify-center mx-auto' },
            h(CheckCircle2, { className: 'w-8 h-8' })
          ),
          h('h2', { className: 'text-lg font-bold text-text-main' }, 'Đã nhập thành công 98 khách mời!'),
          h(
            'p',
            { className: 'text-xs text-text-muted max-w-md mx-auto' },
            'Dữ liệu đã được lưu trữ an toàn trong cơ sở dữ liệu. Mã batch: BATCH-20261106-01.'
          ),
          h(
            'div',
            { className: 'flex items-center justify-center gap-3 pt-3' },
            h(
              Button,
              {
                variant: 'secondary',
                leftIcon: h(RotateCcw, { className: 'w-4 h-4' }),
                onClick: () => {
                  setIsCommitted(false);
                  setStep(1);
                },
              },
              'Hoàn tác batch (Rollback)'
            ),
            h(
              Button,
              {
                variant: 'primary',
                onClick: () => {
                  window.location.href = '/guests';
                },
              },
              'Đi tới danh sách khách mời'
            )
          )
        )
    )
  );
};
