'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock,
  Crown,
  Edit3,
  ExternalLink,
  MapPin,
  Phone,
  Plus,
  Sparkles,
  User,
  Wallet,
} from 'lucide-react';
import { useRole } from '@/context/RoleContext';
import { api, jsonBody } from '@/lib/api/request';
import { formatVND } from '@/lib/utils';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { useLoadState } from '@/components/common/useLoadState';
import { PinSecuritySettings } from '@/components/modules/PinSecuritySettings';
import { CoupleSettingsModal } from './CoupleSettingsModal';
import { CeremonyEditorModal } from './CeremonyEditorModal';
import {
  EVENT_STATUS_META,
  EVENT_TYPE_LABELS,
  computeSettingsSummary,
  formatCeremonyTimeRange,
  sortCeremoniesForSettings,
  type WeddingConfigurationDto,
  type WeddingEventDto,
  type WeddingSettingsPublicDto,
} from './settingsHelpers';

export function LiveSettingsWorkspace() {
  const router = useRouter();
  const { isOwner } = useRole();
  const { loading, refreshing, beginLoad, markLoaded, finishLoad } = useLoadState();

  const [publicSettings, setPublicSettings] = React.useState<WeddingSettingsPublicDto | null>(null);
  const [config, setConfig] = React.useState<WeddingConfigurationDto | null>(null);
  const [events, setEvents] = React.useState<WeddingEventDto[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  // Inline Wedding Display Title editor
  const [weddingName, setWeddingName] = React.useState('');
  const [savingTitle, setSavingTitle] = React.useState(false);
  const [titleSaved, setTitleSaved] = React.useState(false);
  const [titleError, setTitleError] = React.useState<string | null>(null);
  const titleInputId = React.useId();

  // Modals
  const [coupleModalOpen, setCoupleModalOpen] = React.useState(false);
  const [ceremonyModalTarget, setCeremonyModalTarget] = React.useState<
    WeddingEventDto | null | undefined
  >(undefined);

  const generation = React.useRef(0);

  const load = React.useCallback(async () => {
    const requestId = ++generation.current;
    beginLoad('settings');
    setError(null);
    try {
      const [settingsRes, eventsRes, configRes] = await Promise.all([
        api<{ data: WeddingSettingsPublicDto | null }>('/api/v1/settings'),
        api<{ data: WeddingEventDto[] }>('/api/v1/events'),
        isOwner
          ? api<{ data: WeddingConfigurationDto | null }>('/api/v1/configuration').catch(() => ({
              data: null,
            }))
          : Promise.resolve({ data: null }),
      ]);
      if (requestId !== generation.current) return;

      const loadedPublic = settingsRes.data;
      const loadedConfig =
        configRes.data ||
        (loadedPublic
          ? { ...loadedPublic, budgetTarget: null, contingencyBudget: null }
          : null);

      setPublicSettings(loadedPublic);
      setConfig(loadedConfig);
      setEvents(eventsRes.data);
      setWeddingName(
        loadedPublic
          ? loadedPublic.shortTitle || `${loadedPublic.groomName} & ${loadedPublic.brideName}`
          : ''
      );
      markLoaded('settings');
    } catch (failure) {
      if (requestId === generation.current) {
        setError((failure as Error).message || 'Không thể tải cài đặt đám cưới.');
        finishLoad();
      }
    }
  }, [isOwner, beginLoad, markLoaded, finishLoad]);

  React.useEffect(() => {
    void load();
    return () => {
      generation.current++;
    };
  }, [load]);

  const handleSaveTitle = async (e: React.FormEvent) => {
    e.preventDefault();
    const version = publicSettings?.version ?? config?.version;
    if (!isOwner || savingTitle || !version || !weddingName.trim()) return;
    setSavingTitle(true);
    setTitleSaved(false);
    setTitleError(null);
    try {
      const res = await api<{ data: { shortTitle: string; version: number } }>('/api/v1/settings', {
        method: 'PATCH',
        body: jsonBody({ shortTitle: weddingName.trim(), version }),
      });
      setPublicSettings((prev) =>
        prev ? { ...prev, shortTitle: res.data.shortTitle, version: res.data.version } : prev
      );
      setConfig((prev) =>
        prev ? { ...prev, shortTitle: res.data.shortTitle, version: res.data.version } : prev
      );
      setTitleSaved(true);
      router.refresh();
    } catch (failure) {
      setTitleError((failure as Error).message || 'Không thể lưu tên hiển thị.');
    } finally {
      setSavingTitle(false);
    }
  };

  const handleWorkspaceChanged = async (message: string) => {
    setNotice(message);
    await load();
    router.refresh();
  };

  const summary = React.useMemo(
    () => computeSettingsSummary(events, config),
    [events, config]
  );

  const sortedEvents = React.useMemo(
    () => sortCeremoniesForSettings(events, publicSettings?.representativeEventId),
    [events, publicSettings?.representativeEventId]
  );

  if (error && !publicSettings && events.length === 0) {
    return (
      <div className="max-w-7xl mx-auto">
        <Alert
          variant="danger"
          action={{ label: 'Tải lại cài đặt', onClick: () => void load() }}
        >
          {error}
        </Alert>
      </div>
    );
  }

  if (loading && !publicSettings && events.length === 0) {
    return (
      <div
        role="status"
        aria-label="Đang tải cài đặt"
        className="space-y-5 animate-pulse max-w-7xl mx-auto"
      >
        <span className="sr-only">Đang tải cài đặt...</span>
        <div className="h-52 rounded-2xl bg-[#173C33]/15" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 h-80 rounded-card bg-surface border border-border-subtle" />
          <div className="lg:col-span-5 h-72 rounded-card bg-surface border border-border-subtle" />
        </div>
      </div>
    );
  }

  const repTime = summary.representativeEvent
    ? formatCeremonyTimeRange(
        summary.representativeEvent.startTime,
        summary.representativeEvent.endTime
      )
    : null;

  const currentVersion = publicSettings?.version ?? config?.version ?? null;
  const dateStatusLabel = publicSettings?.isDateConfirmed && repTime?.isScheduled
    ? repTime.dateLabel
    : publicSettings?.tentativeDateNote?.trim() || 'Chưa chốt ngày cưới chính thức';

  return (
    <div className="max-w-7xl mx-auto space-y-5" aria-busy={refreshing}>
      {error && (
        <Alert
          variant="danger"
          action={{ label: 'Tải lại cài đặt', onClick: () => void load() }}
        >
          {error}
        </Alert>
      )}

      {notice && (
        <Alert variant="success" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {/* Unconfigured Banner */}
      {!loading && currentVersion === null && !error && isOwner && (
        <div className="surface-card p-5 flex flex-wrap items-center justify-between gap-4 border-[#D4BF8F]/60 bg-[#FAF8F4]">
          <div className="space-y-1">
            <h2 className="font-serif text-lg font-medium text-primary-luxury">
              Chưa khởi tạo hồ sơ đám cưới
            </h2>
            <p className="text-xs text-text-muted">
              Hoàn tất bước thiết lập ban đầu để đặt tên đôi uyên ương, ngày cưới và các nhóm ngân sách.
            </p>
          </div>
          <Link
            href="/setup"
            className="inline-flex items-center gap-1.5 rounded-control bg-primary text-white px-4 py-2.5 text-sm font-medium hover:bg-primary-hover transition-colors"
          >
            Thiết lập thông tin đám cưới
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      )}

      {/* Unified Couple & Wedding Profile Card */}
      <section className="rounded-2xl overflow-hidden border border-[#173C33]/20 shadow-[0_14px_34px_-16px_rgba(23,60,51,0.32)] bg-surface">
        <div className="relative overflow-hidden bg-[#173C33] text-white px-5 py-5 sm:px-7 sm:py-6">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-14 -top-14 h-52 w-52 rounded-full bg-[#D4BF8F]/15 blur-2xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-12 left-1/3 h-40 w-40 rounded-full bg-white/5 blur-2xl"
          />

          <div className="relative space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="space-y-2 min-w-0">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-[#D4BF8F]/30 px-3 py-0.5 text-[11px] font-medium tracking-wide text-[#EFE1BE]">
                  <Sparkles className="w-3 h-3 text-[#D4BF8F]" aria-hidden="true" />
                  Hồ sơ đám cưới &amp; cấu hình trung tâm
                </div>

                <h2 className="font-serif text-2xl sm:text-[30px] font-medium tracking-tight text-white leading-tight truncate">
                  {summary.coupleDisplayTitle}
                </h2>

                {publicSettings && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-white/85 pt-0.5">
                    <span>
                      Chú rể{' '}
                      <strong className="font-medium text-white">
                        {publicSettings.groomName}
                      </strong>{' '}
                      · Cô dâu{' '}
                      <strong className="font-medium text-white">
                        {publicSettings.brideName}
                      </strong>
                    </span>
                    <span className="text-[#D4BF8F]/60">•</span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-[#EFE1BE]">
                      <CalendarDays className="w-3 h-3 text-[#D4BF8F]" aria-hidden="true" />
                      {publicSettings.isDateConfirmed ? 'Đã chốt' : 'Dự kiến'} · {dateStatusLabel}
                    </span>
                  </div>
                )}
              </div>

              {isOwner && config && (
                <button
                  type="button"
                  onClick={() => setCoupleModalOpen(true)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-control bg-[#D4BF8F] text-[#173C33] hover:bg-[#DFCE9F] px-4 py-2.5 text-xs sm:text-sm font-semibold shadow-xs transition-colors shrink-0"
                >
                  <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                  Chỉnh sửa thông tin
                </button>
              )}
            </div>

            {/* 3 Glass Overview Pills */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="rounded-xl bg-white/10 border border-white/15 px-3.5 py-2.5">
                <span className="text-[11px] text-white/70 block">Buổi lễ đại diện</span>
                <span className="text-sm font-medium text-white block truncate mt-0.5">
                  {summary.representativeEvent?.title || 'Chưa chọn buổi lễ'}
                </span>
                <span className="text-[11px] text-[#EFE1BE]/85 block truncate mt-0.5">
                  {repTime ? repTime.dateLabel : 'Hiển thị đếm ngược trên Trang chủ'}
                </span>
              </div>

              <div className="rounded-xl bg-white/10 border border-white/15 px-3.5 py-2.5">
                <span className="text-[11px] text-white/70 block">Ngân sách mục tiêu</span>
                <span className="text-sm sm:text-base font-semibold text-[#EFE1BE] tabular-nums block mt-0.5">
                  {summary.budgetTarget !== null ? formatVND(summary.budgetTarget) : 'Chưa chốt'}
                </span>
                <span className="text-[11px] text-white/65 block mt-0.5">
                  Khung tổng chi toàn đám cưới
                </span>
              </div>

              <div className="rounded-xl bg-white/10 border border-white/15 px-3.5 py-2.5">
                <span className="text-[11px] text-white/70 block">Ngân sách dự phòng</span>
                <span className="text-sm sm:text-base font-semibold text-white tabular-nums block mt-0.5">
                  {summary.contingencyBudget !== null
                    ? formatVND(summary.contingencyBudget)
                    : 'Chưa đặt'}
                </span>
                <span className="text-[11px] text-white/65 block mt-0.5 tabular-nums">
                  {summary.activeCount} buổi lễ hoạt động · {summary.confirmedCount} đã chốt
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Integrated Inline Wedding Display Title Strip */}
        <form
          onSubmit={handleSaveTitle}
          className="bg-[#FAF8F4] px-5 py-4 sm:px-7 border-t border-border-subtle space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1 min-w-0 space-y-1">
              <label
                htmlFor={titleInputId}
                className="text-xs font-semibold uppercase tracking-wide text-text-muted block"
              >
                Tên hiển thị đám cưới
              </label>
              <input
                id={titleInputId}
                type="text"
                value={weddingName}
                disabled={!isOwner || loading || savingTitle || currentVersion === null}
                onChange={(e) => {
                  setWeddingName(e.target.value);
                  setTitleSaved(false);
                  setTitleError(null);
                }}
                placeholder="Ví dụ: Lê Minh & Thảo Nguyên"
                className="w-full min-h-11 rounded-control border border-border-control bg-surface px-3.5 py-2 text-sm font-medium text-text-main focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
              />
            </div>

            {isOwner && (
              <Button
                type="submit"
                variant="primary"
                disabled={loading || currentVersion === null || !weddingName.trim()}
                loading={savingTitle}
                className="shrink-0"
              >
                Lưu thay đổi
              </Button>
            )}
          </div>

          {titleError && <Alert variant="danger">{titleError}</Alert>}
          {titleSaved && (
            <Alert variant="success" onClose={() => setTitleSaved(false)}>
              Đã lưu cài đặt.
            </Alert>
          )}
        </form>
      </section>

      {/* Main 2-Column Asymmetric Settings Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Ceremonies & Venues (7 cols) */}
        <section className="lg:col-span-7 surface-card overflow-hidden">
          <div className="px-5 py-4 bg-[#FAF8F4] border-b border-border-subtle flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <CalendarDays className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-serif text-lg font-medium text-primary-luxury">
                    Các buổi lễ
                  </h2>
                  <span className="inline-flex items-center rounded-full bg-surface border border-border-subtle px-2 py-0.5 text-[11px] font-medium text-text-muted tabular-nums">
                    {summary.activeCount} hoạt động
                  </span>
                  {summary.confirmedCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success-bg border border-success/20 px-2 py-0.5 text-[11px] font-medium text-success tabular-nums">
                      <Check className="w-3 h-3" aria-hidden="true" />
                      {summary.confirmedCount} đã chốt
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-muted mt-0.5">
                  Quản lý thời gian, địa điểm và người liên hệ cho từng nghi lễ.
                </p>
              </div>
            </div>

            {isOwner && (
              <Button
                size="sm"
                variant="primary"
                leftIcon={<Plus className="w-3.5 h-3.5" aria-hidden="true" />}
                onClick={() => setCeremonyModalTarget(null)}
              >
                Thêm buổi lễ
              </Button>
            )}
          </div>

          <div className="p-5">
            {sortedEvents.length === 0 ? (
              <EmptyState
                icon={<CalendarDays className="w-7 h-7 text-[#BFA16E]" strokeWidth={1.5} aria-hidden="true" />}
                title="Chưa có buổi lễ nào"
                description="Tạo buổi lễ ăn hỏi, gia tiên hoặc tiệc cưới để đồng bộ lịch trình, khách mời và sơ đồ bàn."
                action={
                  isOwner
                    ? {
                        label: 'Thêm buổi lễ đầu tiên',
                        onClick: () => setCeremonyModalTarget(null),
                      }
                    : undefined
                }
              />
            ) : (
              <div className="space-y-3">
                {sortedEvents.map((ev) => {
                  const isRepresentative =
                    ev.status !== 'cancelled' && ev.id === publicSettings?.representativeEventId;
                  const isCancelled = ev.status === 'cancelled';
                  const statusMeta = EVENT_STATUS_META[ev.status] ?? EVENT_STATUS_META.tentative;
                  const typeLabel = EVENT_TYPE_LABELS[ev.eventType] ?? 'Khác';
                  const slot = formatCeremonyTimeRange(ev.startTime, ev.endTime);

                  return (
                    <article
                      key={ev.id}
                      className={`rounded-xl border p-4 transition-colors ${
                        isRepresentative
                          ? 'border-[#D4BF8F] bg-[#FAF8F4]'
                          : isCancelled
                          ? 'border-border-subtle bg-page/60 opacity-70'
                          : 'border-border-subtle bg-surface hover:border-border-control'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface border border-border-subtle text-[11px] font-medium text-text-main">
                              {typeLabel}
                            </span>
                            <StatusBadge
                              variant={statusMeta.badgeVariant}
                              text={statusMeta.label}
                              size="sm"
                            />
                            {isRepresentative && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#173C33] text-[#EFE1BE] text-[11px] font-medium">
                                <Crown className="w-3 h-3 text-[#D4BF8F]" aria-hidden="true" />
                                Buổi lễ đại diện
                              </span>
                            )}
                          </div>

                          <h3 className="font-serif text-base sm:text-lg font-medium text-primary-luxury leading-snug">
                            {ev.title}
                          </h3>
                        </div>

                        {isOwner && (
                          <button
                            type="button"
                            onClick={() => setCeremonyModalTarget(ev)}
                            className="inline-flex items-center gap-1.5 rounded-control border border-border-subtle bg-surface px-3 py-1.5 text-xs font-medium text-primary hover:bg-page hover:border-border-control transition-colors shrink-0"
                          >
                            <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                            Chỉnh sửa
                          </button>
                        )}
                      </div>

                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs text-text-muted">
                        <div className="flex items-start gap-2">
                          <Clock className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" aria-hidden="true" />
                          <div className="min-w-0">
                            <span
                              className={
                                slot.isScheduled ? 'font-medium text-text-main block' : 'block'
                              }
                            >
                              {slot.dateLabel}
                            </span>
                            {slot.timeLabel && (
                              <span className="tabular-nums font-mono text-[11px] text-text-muted">
                                {slot.timeLabel}
                              </span>
                            )}
                          </div>
                        </div>

                        {(ev.locationName || ev.locationAddress || ev.mapUrl) && (
                          <div className="flex items-start gap-2">
                            <MapPin
                              className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5"
                              aria-hidden="true"
                            />
                            <div className="min-w-0 space-y-0.5">
                              {ev.locationName && (
                                <span className="font-medium text-text-main block truncate">
                                  {ev.locationName}
                                </span>
                              )}
                              {ev.locationAddress && (
                                <span className="block text-[11px] leading-relaxed">
                                  {ev.locationAddress}
                                </span>
                              )}
                              {ev.mapUrl && (
                                <a
                                  href={ev.mapUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                                >
                                  Mở bản đồ
                                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                                </a>
                              )}
                            </div>
                          </div>
                        )}

                        {(ev.contactPerson || ev.contactPhone) && (
                          <div className="flex items-center gap-2 sm:col-span-2 pt-1 border-t border-border-subtle/60">
                            {ev.contactPerson ? (
                              <User className="w-3.5 h-3.5 text-text-muted shrink-0" aria-hidden="true" />
                            ) : (
                              <Phone className="w-3.5 h-3.5 text-text-muted shrink-0" aria-hidden="true" />
                            )}
                            <span className="truncate">
                              Liên hệ:{' '}
                              <span className="text-text-main font-medium">
                                {[ev.contactPerson, ev.contactPhone].filter(Boolean).join(' · ')}
                              </span>
                            </span>
                          </div>
                        )}

                        {ev.publicNotes && (
                          <p className="sm:col-span-2 text-[11px] leading-relaxed bg-page/70 rounded-control px-2.5 py-1.5 text-text-muted">
                            {ev.publicNotes}
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Right: PIN Security + Concise Navigation Shortcuts (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <PinSecuritySettings />

          <section className="surface-card p-4 space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted px-1">
              Liên kết liên quan
            </h2>
            <div className="divide-y divide-border-subtle/80">
              <Link
                href="/budget"
                className="flex items-center justify-between gap-3 py-2.5 px-1.5 rounded-control hover:bg-page transition-colors group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Wallet className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-main">Ngân sách &amp; Chi tiêu</p>
                    <p className="text-[11px] text-text-muted truncate">
                      {summary.budgetTarget !== null
                        ? `Mục tiêu ${formatVND(summary.budgetTarget)}`
                        : 'Quản lý danh mục và khoản chi'}
                    </p>
                  </div>
                </div>
                <ArrowRight
                  className="w-4 h-4 text-text-muted group-hover:text-primary shrink-0 transition-colors"
                  aria-hidden="true"
                />
              </Link>

              <Link
                href="/overview"
                className="flex items-center justify-between gap-3 py-2.5 px-1.5 rounded-control hover:bg-page transition-colors group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[#FAF3E0] text-[#9A7222] flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-main">Trang chủ Tổng quan</p>
                    <p className="text-[11px] text-text-muted truncate">
                      Xem đếm ngược ngày cưới và lịch 7 ngày tới
                    </p>
                  </div>
                </div>
                <ArrowRight
                  className="w-4 h-4 text-text-muted group-hover:text-primary shrink-0 transition-colors"
                  aria-hidden="true"
                />
              </Link>
            </div>
          </section>
        </div>
      </div>

      {/* Modals */}
      {config && (
        <CoupleSettingsModal
          isOpen={coupleModalOpen}
          onClose={() => setCoupleModalOpen(false)}
          config={config}
          events={events}
          onSaved={async (_updated, message) => {
            await handleWorkspaceChanged(message);
          }}
        />
      )}

      <CeremonyEditorModal
        isOpen={ceremonyModalTarget !== undefined}
        onClose={() => setCeremonyModalTarget(undefined)}
        event={ceremonyModalTarget ?? null}
        onSaved={handleWorkspaceChanged}
      />
    </div>
  );
}
