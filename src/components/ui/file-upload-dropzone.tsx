import * as React from 'react';
import { AlertCircle, FileText, UploadCloud, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const h = React.createElement;

export interface UploadFileItem {
  id: string;
  file: File;
  progress: number;
  error?: string;
}

export interface FileUploadDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  maxSizeMB?: number;
  files?: UploadFileItem[];
  onRemoveFile?: (id: string) => void;
  disabled?: boolean;
  className?: string;
}

export const FileUploadDropzone: React.FC<FileUploadDropzoneProps> = ({
  onFilesSelected,
  accept = 'image/jpeg,image/png,image/webp,application/pdf',
  maxSizeMB = 20,
  files = [],
  onRemoveFile,
  disabled = false,
  className,
}) => {
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const validateAndAdd = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setValidationError(null);

    const validFiles: File[] = [];
    const maxBytes = maxSizeMB * 1024 * 1024;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];

      if (file.name.toLowerCase().endsWith('.heic') || file.type.includes('heic')) {
        setValidationError(`Định dạng HEIC không được hỗ trợ. Vui lòng chuyển sang JPEG hoặc PNG.`);
        return;
      }

      if (file.size > maxBytes) {
        setValidationError(`Tệp "${file.name}" vượt quá dung lượng tối đa ${maxSizeMB}MB.`);
        return;
      }

      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;
    validateAndAdd(e.dataTransfer.files);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    validateAndAdd(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return h(
    'div',
    { className: cn('w-full flex flex-col gap-3', className) },
    h(
      'div',
      {
        onDragOver: (e: React.DragEvent) => {
          e.preventDefault();
          if (!disabled) setIsDragOver(true);
        },
        onDragLeave: () => setIsDragOver(false),
        onDrop: handleDrop,
        onClick: () => !disabled && fileInputRef.current?.click(),
        className: cn(
          'w-full p-8 border-2 border-dashed rounded-card flex flex-col items-center justify-center text-center cursor-pointer transition-colors',
          isDragOver
            ? 'border-primary bg-primary/5'
            : 'border-border-control/60 hover:border-text-main/60 bg-[#FAF9F5]',
          disabled && 'opacity-50 cursor-not-allowed'
        ),
      },
      h('input', {
        ref: fileInputRef,
        type: 'file',
        accept,
        multiple: true,
        disabled,
        onChange: handleChange,
        className: 'sr-only',
      }),
      h(
        'div',
        {
          className:
            'w-12 h-12 rounded-full bg-surface border border-border-subtle flex items-center justify-center text-primary mb-3',
        },
        h(UploadCloud, { className: 'w-6 h-6' })
      ),
      h(
        'p',
        { className: 'text-sm font-semibold text-text-main mb-1' },
        'Kéo thả tệp vào đây hoặc ',
        h('span', { className: 'text-primary underline' }, 'chọn từ thiết bị')
      ),
      h(
        'p',
        { className: 'text-xs text-text-muted' },
        'Hỗ trợ ảnh JPEG, PNG, WebP (tối đa 20MB) và PDF (tối đa 10MB)'
      )
    ),
    validationError &&
      h(
        'div',
        {
          className:
            'flex items-center gap-2 text-xs font-medium text-danger bg-danger-bg p-2.5 rounded-control',
        },
        h(AlertCircle, { className: 'w-4 h-4 shrink-0' }),
        h('span', null, validationError)
      ),
    files.length > 0 &&
      h(
        'div',
        { className: 'flex flex-col gap-2 mt-2' },
        files.map((item) =>
          h(
            'div',
            {
              key: item.id,
              className:
                'flex items-center justify-between p-3 rounded-control bg-surface border border-border-subtle text-sm',
            },
            h(
              'div',
              { className: 'flex items-center gap-3 overflow-hidden' },
              h(FileText, { className: 'w-4 h-4 text-text-muted shrink-0' }),
              h('span', { className: 'truncate text-text-main font-medium' }, item.file.name),
              h(
                'span',
                { className: 'text-xs text-text-muted shrink-0' },
                `(${(item.file.size / 1024 / 1024).toFixed(2)} MB)`
              )
            ),
            onRemoveFile &&
              h(
                'button',
                {
                  type: 'button',
                  onClick: () => onRemoveFile(item.id),
                  'aria-label': 'Xóa tệp',
                  className: 'p-1 text-text-muted hover:text-danger rounded',
                },
                h(X, { className: 'w-4 h-4' })
              )
          )
        )
      )
  );
};
