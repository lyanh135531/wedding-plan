'use client';

import * as React from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { Alert } from '@/components/ui/alert';
import { Pagination } from '@/components/ui/pagination';
import { useRole } from '@/context/RoleContext';
import { api } from '@/lib/api/request';
import { EmptyState } from '@/components/ui/empty-state';
import { DocumentActions } from '@/components/modules/DocumentActions';
import { FileText } from 'lucide-react';

const h = React.createElement;
interface Document {
  id: string;
  originalName: string;
  mimeType: string;
  fileSizeBytes: string;
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
}

export default function DocumentsPage() {
  const { isOwner } = useRole();
  const [files, setFiles] = React.useState<Document[]>([]);
  const [archived, setArchived] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [totalItems, setTotalItems] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [revision, setRevision] = React.useState(0);
  const [query, setQuery] = React.useState('');
  const [uploadResults, setUploadResults] = React.useState<string[]>([]);
  const uploadRef = React.useRef(false);

  React.useEffect(() => {
    const controller = new AbortController();
    const offset = (currentPage - 1) * pageSize;
    setLoading(true);
    setError(null);
    api<{ data: Document[]; total?: number; hasMore: boolean }>(
      `/api/v1/documents?offset=${offset}&limit=${pageSize}&archived=${archived}&q=${encodeURIComponent(query)}`,
      { signal: controller.signal }
    )
      .then((result) => {
        if (!controller.signal.aborted) {
          setFiles(result.data);
          setTotalItems(result.total ?? offset + result.data.length);
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError((failure as Error).message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [currentPage, pageSize, revision, archived, query]);

  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const selectedFiles = Array.from(input.files || []);
    if (!selectedFiles.length || uploadRef.current) return;
    if (selectedFiles.length > 20) {
      setError('Chọn tối đa 20 tệp mỗi lần.');
      input.value = '';
      return;
    }
    uploadRef.current = true;
    setUploading(true);
    setError(null);
    setUploadResults([]);
    const results: string[] = [];
    try {
      for (const file of selectedFiles) {
        try {
          const body = new FormData();
          body.set('file', file);
          body.set('entity_type', 'wedding');
          body.set('is_private', 'true');
          body.set('owner_only', 'true');
          const response = await fetch('/api/upload', { method: 'POST', body });
          const result = await response.json();
          if (!response.ok) throw new Error(result.message || 'Không thể tải tệp lên.');
          results.push(`${file.name}: đã tải lên`);
        } catch (failure) {
          results.push(`${file.name}: ${(failure as Error).message}`);
        }
        setUploadResults([...results]);
      }
      input.value = '';
      setCurrentPage(1);
      setRevision((value) => value + 1);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      uploadRef.current = false;
      setUploading(false);
    }
  };

  return h(
    PageShell,
    { title: 'Tài liệu & Ảnh', showScopeSelector: false },
    h(
      'div',
      { className: 'space-y-4' },
      h(
        'div',
        { className: 'mb-6' },
        h('p', { className: 'eyebrow mb-3' }, 'Lưu giữ mọi chi tiết'),
        h('h1', { className: 'text-[28px] sm:text-[32px] font-medium' }, 'Tài liệu & hình ảnh')
      ),
      isOwner &&
        h(
          'div',
          { className: 'surface-card p-5 sm:p-6 space-y-3' },
          h('label', { htmlFor: 'document-upload', className: 'block font-medium' }, 'Tải tài liệu hoặc ảnh lên'),
          h('input', {
            id: 'document-upload',
            type: 'file',
            multiple: true,
            className:
              'w-full text-xs text-text-muted file:mr-4 file:rounded-control file:border-0 file:bg-primary file:px-4 file:py-3 file:text-xs file:font-medium file:text-white hover:file:bg-primary-hover',
            accept: 'image/jpeg,image/png,image/webp,application/pdf',
            disabled: loading || uploading,
            onChange: upload,
          }),
          h(
            'p',
            { className: 'text-sm text-text-muted' },
            uploading
              ? 'Đang tải lên...'
              : 'Ảnh tối đa 20 MB, PDF tối đa 10 MB. Tệp tải lên chỉ chủ sở hữu được xem.'
          )
        ),
      uploadResults.length > 0 &&
        h(
          'ul',
          { role: 'status', className: 'text-sm space-y-1' },
          uploadResults.map((result, index) => h('li', { key: index }, result))
        ),
      h(
        'label',
        { className: 'block space-y-2' },
        'Tìm tài liệu theo tên',
        h('input', {
          type: 'search',
          value: query,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
            setQuery(e.target.value);
            setCurrentPage(1);
          },
          className: 'w-full min-h-11 border rounded-control p-3',
        })
      ),
      isOwner &&
        h(
          'label',
          { className: 'flex items-center gap-2 min-h-11' },
          h('input', {
            type: 'checkbox',
            checked: archived,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
              setArchived(e.target.checked);
              setCurrentPage(1);
            },
          }),
          'Xem tài liệu đã lưu trữ'
        ),
      error &&
        h(
          Alert,
          { variant: 'danger', action: { label: 'Thử tải lại', onClick: () => setRevision((value) => value + 1) } },
          error
        ),
      loading
        ? h('p', { role: 'status' }, 'Đang tải tài liệu...')
        : files.length
        ? h(
            React.Fragment,
            null,
            h(
              'ul',
              { className: 'space-y-2' },
              files.map((file) =>
                h(
                  'li',
                  { key: file.id, className: 'bg-surface border rounded-card p-4' },
                  h(
                    'a',
                    {
                      href: `/api/files/${file.id}${isOwner ? '' : '?variant=preview'}`,
                      target: '_blank',
                      rel: 'noopener noreferrer',
                      className: 'font-medium text-primary underline break-all',
                    },
                    file.originalName
                  ),
                  isOwner && h(DocumentActions, { file, reload: () => setRevision((value) => value + 1) }),
                  h(
                    'p',
                    { className: 'text-xs text-text-muted mt-1' },
                    `${(Number(file.fileSizeBytes) / 1024).toFixed(1)} KB • ${new Date(
                      file.createdAt
                    ).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`
                  )
                )
              )
            ),
            h(Pagination, {
              currentPage,
              pageSize,
              totalItems,
              onPageChange: setCurrentPage,
              onPageSizeChange: (nextSize) => {
                setPageSize(nextSize);
                setCurrentPage(1);
              },
              pageSizeOptions: [10, 25, 50, 100],
              unitLabel: 'tài liệu',
            })
          )
        : h(EmptyState, {
            title: 'Tài liệu cho ngày chung đôi',
            description:
              'Lưu hợp đồng, hình ảnh và các tài liệu cần thiết trong một không gian riêng, dễ tìm lại khi cần.',
            icon: h(FileText, { className: 'w-7 h-7 text-accent', strokeWidth: 1.4 }),
          })
    )
  );
}
