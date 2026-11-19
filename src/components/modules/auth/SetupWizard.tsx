'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation.js';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { StateWrapper } from '@/components/testing/StateWrapper';
import { PrototypeState } from '@/components/testing/PrototypeToolbar';
import { StepNames } from './StepNames';
import { StepWeddingDate } from './StepWeddingDate';
import { StepCategoryPreview, DEFAULT_STARTER_CATEGORIES, StarterCategory } from './StepCategoryPreview';
import { api, jsonBody } from '@/lib/api/request';

const h = React.createElement;

export interface SetupWizardProps {
  initialState?: PrototypeState;
  onComplete?: (data: any) => void;
  prefillExampleData?: boolean;
}

export const SetupWizard: React.FC<SetupWizardProps> = ({
  initialState = 'populated',
  onComplete,
  prefillExampleData = true,
}) => {
  let router: any = null;
  try {
    router = useRouter();
  } catch {
    router = null;
  }
  const [currentStep, setCurrentStep] = React.useState<number>(1);
  const [isSaving, setIsSaving] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const savingRef = React.useRef(false);
  React.useEffect(() => { setReady(true); }, []);

  // Form values
  const [groomName, setGroomName] = React.useState<string>(
    initialState === 'populated' && prefillExampleData ? 'Nguyễn Văn Minh' : ''
  );
  const [brideName, setBrideName] = React.useState<string>(
    initialState === 'populated' && prefillExampleData ? 'Trần Phương Linh' : ''
  );
  const [weddingDate, setWeddingDate] = React.useState<string | null>(null);
  const [isUnconfirmedDate, setIsUnconfirmedDate] = React.useState<boolean>(
    initialState === 'populated' ? true : false
  );
  const [estimatedDateNote, setEstimatedDateNote] = React.useState<string>(
    initialState === 'populated' && prefillExampleData ? 'Dự kiến sau Tết âm lịch 2028' : ''
  );
  const [categories, setCategories] = React.useState<StarterCategory[]>(DEFAULT_STARTER_CATEGORIES);

  // Validation errors
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [globalError, setGlobalError] = React.useState<string | null>(
    initialState === 'error' ? 'Vui lòng kiểm tra lại các trường bắt buộc đang để trống.' : null
  );

  React.useEffect(() => {
    if (initialState === 'populated' && prefillExampleData) {
      setGroomName('Nguyễn Văn Minh');
      setBrideName('Trần Phương Linh');
      setIsUnconfirmedDate(true);
      setWeddingDate(null);
      setEstimatedDateNote('Dự kiến sau Tết âm lịch 2028');
      setGlobalError(null);
      setErrors({});
    } else if (initialState === 'empty') {
      setGroomName('');
      setBrideName('');
      setIsUnconfirmedDate(false);
      setWeddingDate(null);
      setEstimatedDateNote('');
      setGlobalError(null);
      setErrors({});
    } else if (initialState === 'error') {
      setGlobalError('Vui lòng kiểm tra lại các trường bắt buộc đang để trống.');
      setErrors({
        groom: 'Họ và tên Chú rể không được để trống',
        bride: 'Họ và tên Cô dâu không được để trống',
      });
    }
  }, [initialState, prefillExampleData]);

  const handleToggleCategory = (id: string, selected: boolean) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, selected } : c))
    );
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};
    if (step === 1) {
      if (!groomName.trim()) newErrors.groom = 'Họ và tên Chú rể không được để trống';
      if (!brideName.trim()) newErrors.bride = 'Họ và tên Cô dâu không được để trống';
    } else if (step === 2) {
      if (!isUnconfirmedDate && !weddingDate) {
        newErrors.date = 'Vui lòng chọn ngày cưới hoặc đánh dấu chưa chốt ngày';
      }
      if (isUnconfirmedDate && !estimatedDateNote.trim()) {
        newErrors.note = 'Vui lòng nhập ghi chú dự kiến (ví dụ: Cuối năm 2028)';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setGlobalError(null);
      setCurrentStep((prev) => Math.min(prev + 1, 3));
    } else {
      setGlobalError('Vui lòng hoàn thành các thông tin bắt buộc trước khi tiếp tục.');
    }
  };

  const handleBack = () => {
    setGlobalError(null);
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleFinish = async (skipped = false) => {
    if (savingRef.current) return;
    const payload = {
      groomName,
      brideName,
      weddingDate: isUnconfirmedDate ? null : weddingDate,
      isUnconfirmedDate,
      estimatedDateNote,
      categories: skipped ? [] : categories.filter((c) => c.selected),
    };
    savingRef.current = true;
    setIsSaving(true);
    setGlobalError(null);
    try {
      if (onComplete) {
        await onComplete(payload);
      } else {
        await api('/api/v1/settings', { method: 'POST', body: jsonBody(payload) });
        router.replace('/overview');
        router.refresh();
      }
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : 'Không thể lưu thiết lập. Vui lòng thử lại.');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  // Skeleton loader for loading state
  const loadingSkeleton = h(
    'div',
    { className: 'w-full max-w-lg mx-auto p-8 bg-surface rounded-card border border-border-subtle shadow-md space-y-6 animate-pulse' },
    h('div', { className: 'h-6 w-48 bg-border-subtle rounded mb-2' }),
    h('div', { className: 'h-4 w-72 bg-border-subtle rounded mb-6' }),
    h('div', { className: 'space-y-4' },
      h('div', { className: 'h-10 w-full bg-border-subtle rounded' }),
      h('div', { className: 'h-10 w-full bg-border-subtle rounded' })
    ),
    h('div', { className: 'flex justify-between pt-6 border-t border-border-subtle' },
      h('div', { className: 'h-10 w-24 bg-border-subtle rounded' }),
      h('div', { className: 'h-10 w-32 bg-border-subtle rounded' })
    )
  );

  return h(
    StateWrapper,
    {
      // Do not accept input before hydration; early input can otherwise be reset.
      state: !ready && !prefillExampleData ? 'loading' : initialState,
      loadingSkeleton,
      emptyTitle: 'Bắt đầu thiết lập sổ cưới',
      emptyDescription: 'Nhập thông tin ban đầu để hoàn thiện không gian quản lý đám cưới.',
      emptyActionLabel: 'Bắt đầu nhập liệu',
      onEmptyAction: () => setGroomName('Nguyễn Văn Minh'),
      errorTitle: 'Lỗi thiết lập ban đầu',
      errorMessage: 'Không thể kết nối lưu trữ thông tin thiết lập. Vui lòng thử lại.',
      errorRequestId: 'REQ-20261106-SETUP-ERR',
      onRetry: () => setGlobalError(null),
      permissionDeniedMessage: 'Chỉ Chủ sở hữu đám cưới mới có quyền truy cập trình thiết lập ban đầu.',
    },
    h(
      'div',
      {
        className:
          'w-full max-w-lg mx-auto bg-surface rounded-card border border-border-subtle shadow-md p-6 sm:p-8',
      },
      // Stepper Header
      h(
        'div',
        { className: 'flex items-center justify-between border-b border-border-subtle pb-4 mb-6' },
        h(
          'div',
          null,
          h('span', { className: 'text-xs uppercase font-semibold text-primary tracking-wider' }, 'Thiết lập ban đầu'),
          h('h1', { className: 'text-xl font-bold text-text-main mt-0.5' }, 'Khởi tạo Sổ Quản Lý')
        ),
        h(
          'span',
          { className: 'text-xs font-semibold px-2.5 py-1 bg-page border border-border-control rounded-full text-text-muted' },
          `Bước ${currentStep} / 3`
        )
      ),

      // Global Error Banner if any
      globalError &&
        h(
          'div',
          { className: 'mb-4' },
          h(Alert, {
            variant: 'danger',
            title: 'Chưa đủ thông tin',
            children: globalError,
            onClose: () => setGlobalError(null),
          })
        ),

      // Wizard Steps
      currentStep === 1 &&
        h(StepNames, {
          groomName,
          brideName,
          onChangeGroom: setGroomName,
          onChangeBride: setBrideName,
          errors,
        }),

      currentStep === 2 &&
        h(StepWeddingDate, {
          weddingDate,
          isUnconfirmedDate,
          estimatedDateNote,
          onChangeDate: setWeddingDate,
          onChangeUnconfirmed: setIsUnconfirmedDate,
          onChangeEstimatedNote: setEstimatedDateNote,
          errors,
        }),

      currentStep === 3 &&
        h(StepCategoryPreview, {
          categories,
          onToggleCategory: handleToggleCategory,
        }),

      // Navigation Actions
      h(
        'div',
        {
          className:
            'flex items-center justify-between pt-6 mt-6 border-t border-border-subtle gap-3',
        },
        currentStep > 1
          ? h(
              Button,
              {
                variant: 'secondary',
                onClick: handleBack,
                disabled: isSaving,
              },
              'Quay lại'
            )
          : h('div', null),

        currentStep < 3
          ? h(
              Button,
              {
                variant: 'primary',
                onClick: handleNext,
              },
              'Tiếp tục'
            )
          : h(
              'div',
              { className: 'flex items-center gap-2' },
              h(
                Button,
                {
                  variant: 'ghost',
                  onClick: () => handleFinish(true),
                  disabled: isSaving,
                },
                'Bỏ qua bước này'
              ),
              h(
                Button,
                {
                  variant: 'primary',
                  onClick: () => handleFinish(false),
                  loading: isSaving,
                  loadingText: 'Đang lưu thiết lập...',
                },
                'Hoàn tất thiết lập'
              )
            )
      )
    )
  );
};
