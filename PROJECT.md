> **Current release status — 2026-11-19:** Dashboard menus now use persistent APIs; previews and runtime fixture fallbacks were replaced. Docker/PostgreSQL 16 passed 60 live browser tests and persisted database/uploads across restart. The selected installation target is this machine at localhost:3000; see [Local usage](docs/LOCAL_USAGE.md) and [Completion report](docs/COMPLETION_REPORT_2026-11-19.md). Interactive Google sign-in, full UAT and any future HTTPS/offsite deployment remain separate acceptance checks.
>
> **Historical 2026-11-18 Audit Council Sign-off:** Gate G11 and Milestone R3 were signed off for the scope documented in `docs/MILESTONE_R3_SIGNOFF.md`; historical test counts are not evidence that all product workflows are complete.

# Project: Wedding Management Platform — Gate G11 & Milestone R3

## Architecture
- **Layered Architecture**:
  - **Database Layer**: Drizzle ORM schemas (`src/db/schema/`), PostgreSQL RLS policies enforcing tenant/role separation (`owner` vs `family_view`), transaction-scoped context (`withTransactionScopedContext`), connection pool sanitization (`DISCARD ALL`), staged backup and verified sandbox restore scripts (`scripts/backup.ts`, `scripts/restore-drill.ts`).
  - **Repository & Domain Service Layer**: High-integrity services for all wedding management domains:
    - Guests, invitations, RSVPs, multi-event attendance (AT05, AT06, AT08, AT09, AT10).
    - Budget, deposits, multi-installment payments, refunds, cash gift ledgers, multi-contributor envelopes (AT11-AT17, AT25, AT45-AT48, AT51).
    - Tasks, DAG cycle prevention, schedule diffs, calendar feeds, timeline live markers, schedule shift previews (AT18-AT20, AT34, AT62).
    - Vendors, quotes, contracts, seating charts, meal aggregates, transport and accommodation logistics (AT07, AT21, AT22, AT26, AT30, AT52).
    - Handover packets (A4 day-of printouts, versioned snapshots, delta diffs).
    - Archival freeze (read-only mode, immutable audit logging, unarchiving AT35).
    - Offline resilience (PLAN §22.2: OfflineBanner and API/form write barrier implemented; live vendor form retention/reconnect verified, day-of handover packet reference).
  - **API Layer**: Next.js App Router (`/api/v1/`) with session authorization, RLS context injection, 403 Forbidden for `family_view` on writes (AT03), optimistic locking (AT30), and structured error formatting.
  - **Frontend Layer**: Responsive web application built with Tailwind CSS, supporting 4 viewports (`360px`, `390px`, `768px`, `1440px`), touch-target compliance (>=44px), mobile bottom navigation, desktop sidebar, print styles for A4 exports, and offline status indicators.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Gate G10 Commit Clean Baseline | Stage 79 Gate G10 files and commit to git cleanly | M11.0 | R1, Survey |
| 2 | Prototype Test Assertion Fix | Fix string mismatch in `uxt-criteria-matrix.spec.ts:210` | M11.1 | R2, Survey |
| 3 | Live E2E System User Journeys | Static component coverage across G0-G10 plus live vendor/auth/offline, guest/RSVP, seating, core finance and handover journeys | M11.1 | R2, PLAN §24 |
| 4 | 100% Automated Test Pass Rate | Ensure 0 failures across all Vitest and Playwright test suites | M11.1 | R2, Acceptance |
| 5 | Mobile Responsive Layouts | Zero horizontal overflow and responsive reflow across 360-1440px | M11.2 | R3, UI_UX_SPEC |
| 6 | Mobile Touch & Nav Usability | 44px touch targets, mobile bottom nav, modal auto-centering | M11.2 | R3, UI_UX_SPEC |
| 7 | Global OfflineBanner & Input Preservation | Offline status banner, submit protection, form input retention | M11.3 | R4, PLAN §22.2 |
| 8 | Automated Network Failure Drill | E2E/integration drill simulating disconnect, state retention & reconnect | M11.3 | R4, PLAN §26 |
| 9 | Automated Backup Restore Drill | Comprehensive drill verifying DB dump, uploads tarball, checksums, FKs | M11.3 | R4, PLAN §26 |
| 10 | Project README & Quickstart | Comprehensive README.md covering setup, scripts, architecture | M11.4 | R5, Rule 10 |
| 11 | Operations Runbook (`docs/OPERATIONS.md`) | Startup, container commands, health checks, secrets, migrations | M11.4 | R5, PLAN §26.2 |
| 12 | Disaster Recovery Manual (`docs/DISASTER_RECOVERY.md`) | Backup execution, restic offsite setup, emergency restore & wipe | M11.4 | R5, PLAN §26.2 |
| 13 | Milestone R3 Formal Sign-off Document | Formal sign-off and audit council verdict package | M11.4 | R5, Acceptance |
| 14 | Independent Audit Council Review | Formal verification by Reviewers, Challengers, and Forensic Auditor | M11.5 | R5, Acceptance |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M11.0 | Gate G10 Commit Baseline | Stage and commit 79 Gate G10 files cleanly | none | DONE |
| M11.1 | Full E2E System Testing | 296 component checks plus 24 live cases covering auth/offline, vendors, guests/RSVP, seating, core finance and handovers | M11.0 | DONE |
| M11.2 | Mobile Responsiveness & Usability | Viewport validation (360/390/768/1440px), touch targets, overflow checks (72/72 PASS) | M11.1 | DONE |
| M11.3 | Network Failure & Backup Restore Drills | Real sandbox restore (54 tables, 79 FKs), credential reset, tamper rejection, live offline/reconnect form drill verified | M11.1 | DONE |
| M11.4 | Operational Handover Documentation | README, operations runbook, DR manual, and milestone sign-off documentation | M11.1 | DONE |
| M11.5 | Independent Audit Council Sign-off | Formal sign-off: Reviewers (APPROVE), Challengers (APPROVE), Forensic Auditor (CLEAN) | M11.2, M11.3, M11.4 | DONE |
| M11.6 | Luxury UI Enhancements | Design system (colors/typography), Dashboard/Screen refinement | M11.5 | DONE |


---

## Interface Contracts
### Offline Resilience ↔ PageShell
- `useNetworkStatus() => { isOnline: boolean }`
- `OfflineBanner: React.FC` renders sticky top notification when `!isOnline`, showing the offline warning and pointing to printed Handover Packets; the banner alone does not enforce read-only behavior.

### Backup & Restore Drill ↔ Verification Harness
- `createAtomicBackup(options) => Promise<BackupManifest>`: real bundles include database/upload evidence; DB evidence and dump share an exported snapshot.
- `executeRestoreDrill(backupPath, { adminUrl, sandboxRoot, ownerEmails })`: fresh DB/uploads only, reconciles evidence and sanitizes credentials.
- Implemented real sandbox restore: checksum/tamper checks, row fingerprints/counts, numeric totals, FK definitions/validation, uploads hashes and post-restore credential cleanup. Mock mode remains checksum-only.
- Evidence: `docs/G11_VERIFICATION_2026-11-18.json` (24 live cases, 54 tables, 79 FKs, PostgreSQL 17.4). Production/Compose 16 and offsite drills remain pending.

---

## Code Layout
- Backup & Restore scripts: `scripts/backup.ts`, `scripts/restore-drill.ts`
- Offline components: `src/components/common/OfflineBanner.tsx`
- Layout components: `src/components/layout/PageShell.tsx`, `Header.tsx`, `DesktopSidebar.tsx`, `MobileBottomNav.tsx`
- Test suites:
  - Unit/Integration: `tests/unit/`, `tests/integration/`
  - Adversarial & Drills: `tests/adversarial/`
  - Playwright E2E: `tests/e2e/`
- Documentation:
  - `README.md`
  - `docs/OPERATIONS.md`
  - `docs/DISASTER_RECOVERY.md`
  - `docs/MILESTONE_R3_SIGNOFF.md`
