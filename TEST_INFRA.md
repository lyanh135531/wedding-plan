# TEST_INFRA — Central Test Strategy & Acceptance Matrix

**Document Version:** 1.0.0  
**Target Milestone:** Milestone R1 (Daily Management: Gates G0 to G6)  
**Author:** Test Infrastructure Writer (`test_writer_infra`)  
**Status:** Approved & Active Test Runner Baseline  
**Reference Standards:** `ORIGINAL_REQUEST.md`, `PLAN.md`, `docs/UI_UX_SPEC.md`, `PROJECT.md`, `qa_matrix_spec.md`

---

## 1. Test Philosophy & Core Engineering Tenets

1. **Opaque-Box & Requirement-Driven**:
   Tests are formulated directly against explicit business contracts, mathematical invariants, and functional specifications defined in `ORIGINAL_REQUEST.md`, `PROJECT.md`, and `docs/UI_UX_SPEC.md`. Tests verify observable external behavior (HTTP response codes, DTO shapes, database state transitions, UI element visibility, and calculation outputs) rather than internal implementation nuances.

2. **Absolute Elimination of Facade Tests**:
   No test shall merely assert truthy defaults or mock away business logic to achieve artificial green checkmarks. Every test must execute real assertions with derived expected values, verify failure paths, and test edge conditions.

3. **Strict Currency Math & Float Rejection**:
   All monetary amounts in the Wedding Management System are denominated in Vietnamese Dong (VND) and modeled strictly as TypeScript native `bigint` integers. Floating-point types (`number`, `parseFloat`) are prohibited in the financial domain. Financial tests assert exact Dong-level values without rounding or precision loss.

4. **Self-Contained & Independent Execution**:
   Each test case configures its own state, isolates database changes using transactional rollbacks (`BEGIN ... ROLLBACK`), resets mock client state, and leaves zero persistent side effects.

5. **Multi-Role Privacy & Row Level Security (RLS)**:
   The testing topology validates isolation between **Owner** (Groom & Bride) and **Family View-only** roles. Family users are blocked from all financial ledgers, private guest notes, phone numbers, and administrative controls at the Database (RLS), API (DTO filtering), and UI layers.

---

## 2. Test Architecture & Directory Layout

The system employs a dual-runner configuration:
- **Vitest**: Executes high-speed Unit (Tier 1), Boundary (Tier 2), and Database/API Integration (Tier 3) tests with native ESM, TypeScript strict mode, and `@vitest/coverage-v8`.
- **Playwright**: Executes End-to-End User Journeys (Tier 4) across 4 mandatory responsive viewports and role-specific storage states.

### 2.1. Directory Structure

```text
C:\Project\wedding\
├── vitest.config.ts             # Vitest runner configuration with @/* aliases & v8 coverage
├── playwright.config.ts         # Playwright E2E configuration with 4 mandatory viewports
├── tsconfig.json                # Strict TypeScript configuration with path mapping
├── tests/
│   ├── setup.ts                 # Global Vitest lifecycle setup (timezone Asia/Ho_Chi_Minh)
│   ├── helpers/                 # Shared test utilities & domain test engines
│   │   ├── index.ts             # Barrel export for all test helpers
│   │   ├── bigint.ts            # Pure BigInt VND math & balance calculation helpers
│   │   ├── auth.ts              # Mock user session generation & role permission checks
│   │   ├── db.ts                # Mock DB client, transaction scoping & pool sanitization
│   │   └── security.ts          # Formula injection escape & storage key path validation
│   ├── smoke/
│   │   └── runner.test.ts       # Vitest test runner baseline verification (13 tests)
│   ├── fixtures/
│   │   ├── standard_wedding.json# Standard wedding dataset (2 events, 100 guests, 12 budget items)
│   │   ├── edge_cases_family.json# 4-person family group (FX01), cancelled vendor (FX02)
│   │   └── malicious_payloads.json# Formula injection strings, path traversal keys
│   ├── unit/                    # Tier 1 & Tier 2 Unit Test Suites
│   │   ├── math/                # Bigint currency invariants (AT11, AT12, AT15, AT38, AT45, AT48)
│   │   ├── validation/          # Zod schemas, phone regex, bigint string validators (F02)
│   │   ├── guests/              # Headcount, seating, meals calculation rules (AT05, AT06, AT07)
│   │   ├── tasks/               # Relative deadline shifting, DAG cycle detection (AT18, AT19, AT62)
│   │   └── security/            # Formula injection escaping, MIME validation (AT29, AT41)
│   ├── integration/             # Tier 2 & Tier 3 Integration Test Suites
│   │   ├── db/
│   │   │   ├── rls_isolation.test.ts    # Owner vs Family view-only RLS policies (AT03, AT57)
│   │   │   ├── connection_pool.test.ts # Connection checkout/checkin sanitization (AT57)
│   │   │   ├── transactions.test.ts    # Atomic batch imports & rollback (AT27, AT28)
│   │   │   └── idempotency.test.ts     # SHA-256 idempotency key replay & collision (AT13, AT54)
│   │   └── api/
│   │       ├── upload_route.test.ts    # Sharp image processing & EXIF stripping (AT39, AT41)
│   │       └── export_route.test.ts    # Anti-formula CSV/XLSX & RFC 5545 .ics generation (AT29)
│   └── e2e/                     # Tier 4 Playwright User Journey Suites
│       ├── smoke.spec.ts        # E2E runner & viewport verification
│       ├── auth.spec.ts         # Dual owner login & stranger rejection (AT02, AT50)
│       ├── guests.spec.ts       # Guest creation, family invitations, RSVP (UXT01-UXT05)
│       ├── budget.spec.ts       # Cost tracking, deposit payments, cash balance (UXT06-UXT09)
│       ├── tasks.spec.ts        # Tasks, calendar milestones, rescheduling (UXT10, UXT11)
│       └── responsive.spec.ts   # 4-viewport layout validation & offline drafts (UXT16-UXT28)
```

### 2.2. Standard Runner Commands

| Command | Target Runner | Description |
|---|---|---|
| `pnpm test` | Vitest | Executes all unit, integration, and smoke test suites |
| `pnpm test:smoke` | Vitest | Executes test runner baseline smoke test (`tests/smoke/runner.test.ts`) |
| `pnpm test:unit` | Vitest | Executes pure domain math, validation, and logic unit tests (`tests/unit/`) |
| `pnpm test:integration` | Vitest | Executes database RLS, connection pool, and API route integration tests (`tests/integration/`) |
| `pnpm test:coverage` | Vitest | Generates V8 test coverage report with thresholds |
| `pnpm test:e2e` | Playwright | Executes full E2E user journeys across all 4 responsive viewports |
| `pnpm test:e2e:ui` | Playwright | Opens Playwright Interactive UI Mode for visual debugging |
| `pnpm test:all` | Vitest + Playwright | Executes entire automated verification battery for release sign-off |

---

## 3. Feature Inventory & Test Coverage Mapping (F01–F34)

| Feature ID | Feature Name | Milestone / Gate | Primary Test Tier | Primary Test Target |
|---|---|---|---|---|
| **F01** | Data Dictionary & Relational Schemas | M1 (G0) | Tier 2 | `tests/unit/validation/`, `tests/integration/db/` |
| **F02** | Zod Schemas & DTO Transformers | M1 (G0) | Tier 1 & Tier 2 | `tests/unit/validation/zod_schemas.test.ts` |
| **F03** | Domain Test Fixtures (FX01-FX03) | M1 (G0) | Tier 1 | `tests/fixtures/`, `tests/smoke/runner.test.ts` |
| **F04** | Design Tokens System | M2 (G1) | Tier 4 | `tests/e2e/responsive.spec.ts` |
| **F05** | UI Component Library (25 primitives) | M2 (G1) | Tier 4 | `tests/e2e/responsive.spec.ts` |
| **F06** | Navigation Architecture (Sidebar & Bottom Nav) | M2 (G1) | Tier 4 | `tests/e2e/responsive.spec.ts` (UXT16) |
| **F07** | Screen Prototypes & 6 UI States | M2 (G1) | Tier 4 | `tests/e2e/responsive.spec.ts` (UXT01-UXT28) |
| **F08** | Next.js App Router & TypeScript Codebase | M3 (G2) | Tier 1 & Tier 4 | `tests/smoke/runner.test.ts`, `tests/e2e/` |
| **F09** | Docker Compose Packaging & Healthchecks | M3 (G2) | Tier 5 | `ops/docker/`, `qa_matrix_spec §6.5` |
| **F10** | Better Auth & Google OAuth Seed Workflow | M3 (G2) | Tier 3 & Tier 4 | `tests/e2e/auth.spec.ts` (AT02, AT49, AT50) |
| **F11** | Transaction-Scoped RLS Context | M3 (G2) | Tier 3 | `tests/integration/db/rls_isolation.test.ts` (AT57) |
| **F12** | Secure Sharp Media Upload & Storage | M3 (G2) | Tier 3 & Tier 5 | `tests/integration/api/upload_route.test.ts` (AT39, AT41, AT42) |
| **F13** | Tripartite Guest Model (Person/Card/Event) | M4 (G3) | Tier 1 & Tier 3 | `tests/unit/guests/`, `tests/e2e/guests.spec.ts` (AT05, AT06) |
| **F14** | RSVP & Attendance Tracking | M4 (G3) | Tier 3 & Tier 4 | `tests/e2e/guests.spec.ts` (AT05, AT10) |
| **F15** | Guest Capacity & Meal Analytics | M4 (G3) | Tier 1 | `tests/unit/guests/meals.test.ts` (AT07) |
| **F16** | Unaccented Search & Duplicate Detection | M4 (G3) | Tier 1 & Tier 3 | `tests/unit/guests/search.test.ts` (AT08, AT09) |
| **F17** | BigInt VND Calculation Engine | M5 (G4) | Tier 1 | `tests/unit/math/currency.test.ts` (AT11, AT12, AT15) |
| **F18** | Cost Item Lifecycle & Valid 0 Settlement | M5 (G4) | Tier 1 & Tier 2 | `tests/unit/math/lifecycle.test.ts` (AT47, AT48) |
| **F19** | Payment & Multi-Stage Refund Ledgers | M5 (G4) | Tier 1 & Tier 3 | `tests/unit/math/payments.test.ts` (AT12, AT14) |
| **F20** | Opening Balance Cutoff (`opening_as_of`) | M5 (G4) | Tier 1 & Tier 3 | `tests/unit/math/opening_fund.test.ts` (AT37, AT45) |
| **F21** | Third-Party Direct Vendor Payments | M5 (G4) | Tier 1 & Tier 3 | `tests/unit/math/vendor_contributions.test.ts` (AT38) |
| **F22** | Idempotency Key Replay Protection | M5 (G4) | Tier 3 & Tier 5 | `tests/integration/db/idempotency.test.ts` (AT13, AT54) |
| **F23** | Tasks, Fixed & Relative Deadlines | M6 (G5) | Tier 1 & Tier 3 | `tests/unit/tasks/deadlines.test.ts` (AT18, AT19) |
| **F24** | Safe Wedding Date Rescheduling & Preview | M6 (G5) | Tier 3 & Tier 4 | `tests/e2e/tasks.spec.ts` (AT18, AT62, UXT11) |
| **F25** | Internal Task Reminder Center | M6 (G5) | Tier 1 & Tier 4 | `tests/unit/tasks/reminders.test.ts` (UXT10) |
| **F26** | Real-Time Live Dashboard Aggregation | M6 (G5) | Tier 3 & Tier 4 | `tests/e2e/responsive.spec.ts` (AT01, F26) |
| **F27** | Anti-Formula Injection Export Sanitization | M7 (G6) | Tier 1 & Tier 5 | `tests/unit/security/formula.test.ts` (AT29) |
| **F28** | Atomic Batch CSV/XLSX Import & Rollback | M7 (G6) | Tier 3 | `tests/integration/db/batch_import.test.ts` (AT27, AT28) |
| **F29** | RFC 5545 `.ics` Calendar Export | M7 (G6) | Tier 1 & Tier 3 | `tests/unit/io/ics_export.test.ts` (F29) |
| **F30** | CSS Print A4 Report Engine | M7 (G6) | Tier 4 | `tests/e2e/responsive.spec.ts` (UXT22) |
| **F31** | Consistent Backup Automation | M7 (G6) | Tier 5 | `ops/drills/verify_restore.ps1` (AT32, AT55) |
| **F32** | Automated Cold Restore Drill | M7 (G6) | Tier 5 | `ops/drills/verify_restore.ps1` (AT32, AT56) |
| **F33** | Requirement-Driven E2E Test Suite | E2E Track | Tiers 1–4 | `tests/` (100% of AT02-AT62 and UXT01-UXT28) |
| **F34** | Adversarial Hardening & Penetration | Final M. | Tier 5 | Security fuzzing, RLS penetration, session hijacking |

---

## 4. Five-Tier Test Taxonomy & Coverage Thresholds

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Five-Tier Test Taxonomy                         │
├─────────┬──────────────────────────┬──────────────┬────────────────────┤
│ Tier    │ Focus Area               │ Test Runner  │ Target Execution   │
├─────────┼──────────────────────────┼──────────────┼────────────────────┤
│ Tier 1  │ Domain Logic & Math      │ Vitest       │ < 10 seconds       │
│ Tier 2  │ Boundaries & Constraints │ Vitest       │ < 30 seconds       │
│ Tier 3  │ Integration & DB Context │ Vitest       │ < 60 seconds       │
│ Tier 4  │ E2E Journeys & 4 Views   │ Playwright   │ < 3 minutes        │
│ Tier 5  │ Security & DR Drill      │ Playwright/PS│ < 5 minutes        │
└─────────┴──────────────────────────┴──────────────┴────────────────────┘
```

### Coverage Thresholds

| Metric | Target Standard | Business-Critical Modules | Failure Action |
|---|---|---|---|
| **Statement Coverage** | ≥ 80% | ≥ 95% (`lib/currency`, `db/rls`, `schemas`) | Build Blocked |
| **Branch Coverage** | ≥ 80% | ≥ 95% (BigInt math, formula escape) | Build Blocked |
| **Function Coverage** | ≥ 85% | ≥ 95% (API handlers, RLS wrappers) | Build Blocked |
| **Lines Coverage** | ≥ 80% | ≥ 95% (All core business engines) | Build Blocked |
| **AT Criteria Pass Rate** | 100% | 100% (All R1-scoped ATs) | Gate Sign-off Blocked |
| **UXT Criteria Pass Rate**| 100% | 100% (All 4 viewports) | Gate Sign-off Blocked |

---

## 5. Acceptance Test (AT) Matrix for Milestone R1

| Test ID | Gate | Tier | Description & Stimulus | Expected Authoritative Verification |
|---|---|---|---|---|
| **AT01** | G0/G2 | Tier 1 & 4 | Empty initial system state after owner seed | Database contains 0 guests/payments/tasks; UI shows guidance; countdown displays `"Dự kiến sau Tết âm lịch 2028"` |
| **AT02** | G2 | Tier 3 & 4 | Dual owner OAuth login & stranger rejection | Groom & Bride obtain equal `owner` role; uninvited stranger receives HTTP 403 Forbidden with `"Tài khoản chưa được cấp quyền truy cập"` |
| **AT03** | G2/G3/G4| Tier 3 & 5 | Strict financial & private data isolation for Family | Family view-only gets HTTP 403 on `/api/budget`, `/api/payments`; guest DTO strips `phone`, `email`, `address`, `private_notes` |
| **AT04** | G2/G3 | Tier 4 | Dynamic revocation of active family access | Owner revokes membership; family tab immediately transitions to HTTP 403 and redirects to `/login` |
| **AT05** | G3 | Tier 1 & 3 | Multiple event invitations with disjoint RSVP | Guest accepts Event 1, declines Event 2; system creates 2 independent attendance rows; global unique count = 1 |
| **AT06** | G3 | Tier 1 & 3 | 4-member family group with single invite card | 1 `invitations` record, 4 `guests`, 3 attending, 1 declined -> Headcount = 3, Seats = 3, Meals = 2 adult + 1 child |
| **AT07** | G3 | Tier 1 & 2 | Differentiated headcount, seats, and meals | Adult (seat + veg meal), Child (seat + child meal), Baby (no seat, no meal) -> Headcount = 3, Seats = 2, Meals = 2 |
| **AT08** | G3 | Tier 2 & 3 | Duplicate guest detection & phone sharing | Same unaccented name & phone in new group triggers non-blocking merge/create modal; distinct UUIDs allowed |
| **AT09** | G3 | Tier 3 & 4 | Guest profile merge with seating conflict resolution | Merge resolution screen diffs fields; winning fields chosen; no duplicate seating created |
| **AT10** | G3 | Tier 3 | Guest decline triggers atomic table unassignment | RSVP changed to `declined` in single transaction clears table assignment and decrements occupied seats |
| **AT11** | G4 | Tier 1 & 2 | Unfinalized cost item with advance deposit | 20m estimate, null locked price, 5m deposit -> Net Paid = 5m, Confirmed Remaining = null (`"Chưa xác định"`), Projected Remaining = 15m |
| **AT12** | G4 | Tier 1 & 2 | Multi-installment schedule & partial refund | 30m locked price; pay 10m + 5m, refund 2m -> Net Paid = 13m, Confirmed Remaining = 17m; Installment 1 remaining = 2m |
| **AT13** | G4 | Tier 3 | Idempotent payment submission (anti-double-click) | Duplicate concurrent POST with identical `Idempotency-Key` replays HTTP 201 response; exactly 1 DB record written |
| **AT14** | G4 | Tier 2 & 3 | Illegal refund exceeding original transaction | Refund > 5m on a 5m payment rejected with HTTP 400; negative amount rejected by schema |
| **AT15** | G4 | Tier 1 & 4 | Non-offsetting presentation of surplus and debt | Item A has 2m surplus, Item B has 5m debt -> Displays 2m surplus and 5m debt separately, NEVER net 3m debt |
| **AT16** | G4 | Tier 2 & 3 | Locked price mutation alerts downstream schedules | Locked price changed 15m -> 18m; payment history immutable; remaining re-evaluates to 13m; warning banner rendered |
| **AT17** | G4 | Tier 1 & 2 | Unset budget vs zero budget distinction | Target budget null renders `"Chưa thiết lập ngân sách mục tiêu"`; explicit 0 VND flags all expenses as overruns |
| **AT18** | G5 | Tier 2 & 3 | Wedding date reschedule shifts relative tasks only | Rescheduling event shifts relative tasks ("10 days before") while fixed contract dates remain untouched |
| **AT19** | G5 | Tier 1 & 2 | Cyclic task dependency graph rejection | Circular dependency (A -> B -> A) rejected with HTTP 400 via topological cycle detection |
| **AT20** | G5 | Tier 3 & 4 | Payment schedule update real-time calendar reflection | Altering schedule due date dynamically moves calendar milestone; zero orphan events |
| **AT27** | G6 | Tier 3 & 4 | CSV import validation error reporting & 0-row rollback | Invalid lines 12 & 35 reported by row number; cancel triggers 0 database writes; transaction rolls back |
| **AT28** | G6 | Tier 3 | Atomic batch import rollback | Re-uploading duplicate file flags duplicate rows; rollback removes batch 101 atomically |
| **AT29** | G6 | Tier 1 & 5 | Anti-Formula Injection in CSV/XLSX export | Cells starting with `=`, `+`, `-`, `@`, `\t`, `\r` are escaped with `'` prefix to neutralize spreadsheet execution |
| **AT30** | G4/G5/G6| Tier 3 & 4 | Optimistic concurrency version conflict detection | Saving outdated `version = 3` after another user saved `version = 4` fails with HTTP 409 Conflict & visual diff |
| **AT31** | G1/G6 | Tier 4 | Network interruption resilience & offline auto-draft | Network loss keeps form data in `sessionStorage`; user retries on reconnect without duplicate records |
| **AT32** | G6 | Tier 5 | Automated cold-restore data completeness drill | Ephemeral restore verifies exact row counts, BigInt VND checksums, and attachment SHA-256 hashes |
| **AT37** | G4 | Tier 1 & 2 | Initial cash fund balance & unset state | Fresh settings render `"Chưa thiết lập quỹ"`; setting initial balance 0 VND displays `0 ₫` |
| **AT38** | G4 | Tier 1 & 3 | Third-party direct vendor payment by relative | Relative pays 5m directly to vendor -> Cost net paid increases, cash balance remains untouched |
| **AT39** | G2 | Tier 3 & 4 | Batch image upload fault isolation | Uploading 2 valid images and 1 invalid payload processes the 2 valid images; invalid file reports clear error |
| **AT40** | G2 | Tier 5 | Container & host lifecycle resilience | `docker compose restart app` or container recreation preserves all original uploads and thumbnails in `/data/uploads` |
| **AT41** | G2/G6 | Tier 5 | Defense against path traversal & EXIF leakage | Path traversal (`..`, `%2F`, `/etc/passwd`) rejected with HTTP 400; EXIF/GPS metadata completely stripped |
| **AT42** | G2 | Tier 3 & 5 | Atomic storage write & orphan file cleanup | DB failure during upload deletes newly written files on disk; temp cleanup sweeper purges unreferenced files |
| **AT44** | G2 | Tier 4 & 5 | Proxy & app multipart body limit alignment | 20 MiB image + multipart envelope (~20.5 MiB) allowed without HTTP 413 Payload Too Large |
| **AT45** | G4 | Tier 1 & 3 | Historical deposit prior to opening balance milestone | 10m deposit on Jan 15 with opening on Feb 1 does not deduct twice from initial cash balance |
| **AT46** | G4 | Tier 3 | Pre-schedule deposit & later schedule allocation | Early deposit recorded as unallocated prepayment; later assigned to installment without duplicate payment |
| **AT47** | G4 | Tier 1 & 3 | Service cancellation with fee & partial refund | 10m deposit, vendor keeps 3m fee and refunds 7m -> Final settlement = 3m, Net Paid = 3m, Remaining = 0 VND |
| **AT48** | G4 | Tier 1 & 2 | Valid zero-value final settlement vs truthy bug | Cancelled item with `final_settlement = 0n` respects 0 VND without falling back to estimate or locked price |
| **AT49** | G2 | Tier 3 & 5 | Idempotent seed execution | Re-running owner seed uses `ON CONFLICT DO NOTHING`; does not duplicate records or wipe credentials |
| **AT50** | G2/G3 | Tier 3 & 4 | SMTP-free family member invitation lifecycle | 7-day cryptographic token URL generated; only designated email can claim; single-use token invalidated |
| **AT54** | G4 | Tier 3 & 5 | Idempotency key replay protection & hash mismatch | Replaying key with modified payload fails with HTTP 409 Conflict; revoked user fails with HTTP 403 |
| **AT55** | G6 | Tier 5 | Backup lease expiration & deadlock immunity | Backup write lock auto-releases after 5 minutes; system does not remain locked indefinitely |
| **AT56** | G6 | Tier 5 | Post-restore credential & token invalidation | Restoring database purges active sessions and invalidates outstanding member invites |
| **AT57** | G2/G6 | Tier 3 & 5 | Database RLS leakage prevention across connection pool | Borrowing connection after Owner query returns 0 rows without context; `DISCARD ALL` prevents context bleed |
| **AT58** | G2/G6 | Tier 4 | Milestone R1 standalone execution decoupling | R1 operates fully without broken links or 404s pointing to unimplemented R2/R3 features |
| **AT59** | G5 | Tier 3 & 4 | Shared task content sanitization for Family role | Family role sees operational title; private notes, linked cost item ID, and prices are stripped |
| **AT60** | G1/G2 | Tier 4 & 5 | Auto-draft form isolation across accounts | Session expiry restores draft for same account; account switch clears draft to prevent cross-account leak |
| **AT62** | G5 | Tier 3 & 4 | Single canonical representative wedding date | Primary wedding event date powers countdown, settings, and relative task calculations consistently |

---

## 6. User Experience (UXT) Test Matrix (UXT01–UXT28)

The 28 UX test scenarios verify responsive layout, usability, and resilience across the 4 mandatory viewports.

| UXT ID | Gate | Scenario & Description | Time Budget / Criteria | Viewports |
|---|---|---|---|---|
| **UXT01** | G1 | First launch without official date | Self-guided setup; tentative date marked; no forced dummy data | 360, 390, 1440 |
| **UXT02** | G1 | Create 4-member family under 1 invite | Completed in **≤ 120s**; 1 invite / 4 guests count correct | 360, 390, 1440 |
| **UXT03** | G1 | Update 2/4 members attending in Event 1 | Other event untouched; clear distinction between guests & invite | 360, 390, 768 |
| **UXT04** | R1 | Filter guests -> Open detail -> Back | URL preserves event filter, search query, scroll position | 360, 390, 1440 |
| **UXT05** | R1 | Batch update 5 invitation groups | Confirmation verifies 5 *invitations* updated, not individuals | 390, 768, 1440 |
| **UXT06** | G1 | Create cost item without price | Saves successfully; summary reports "Tạm tính — thiếu giá" | 360, 390, 1440 |
| **UXT07** | G1 | Record 5m deposit from cost profile | Completed in **≤ 60s**; destination item verified; anti-double-click | 360, 390, 1440 |
| **UXT08** | R1 | Distinguish refund vs void/cancel | Void logs reason; refund links transaction; intuitive selection | 390, 1440 |
| **UXT09** | R1 | Open fund after historical deposit | Milestone balance warnings clear; historical deposit not deducted again | 390, 1440 |
| **UXT10** | G1 | Find personal tasks & add unscheduled task | Completed in **≤ 30s**; no confusion between "Chưa có hạn" and "Quá hạn" | 360, 390, 1440 |
| **UXT11** | R1 | Reschedule representative wedding date | Preview shows shifted vs non-shifted items; all screens update | 390, 768, 1440 |
| **UXT12** | R2 | Seat family on mobile device | Completed in **≤ 60s** via dialog without requiring drag-and-drop | 360, 390 |
| **UXT13** | R2 | Concurrent seat assignment contention | Conflict modal preserves guest selection; instant re-selection | 390, 1440 |
| **UXT14** | R2 | Finalize handover snapshot & add new guest | Snapshot immutable; delta view highlights new additions | 390, 768, 1440 |
| **UXT15** | R3 | Read day-of wedding timeline | Immediate identification of current and upcoming task in **≤ 10s** | 360, 390 |
| **UXT16** | G1 | Family view-only exploration | "Chỉ xem" badge; financial tabs omitted; private notes unsearchable | 360, 390, 1440 |
| **UXT17** | R1 | Form submission during offline/failure | Form contents preserved in `sessionStorage`; retry button active | 360, 390 |
| **UXT18** | R1 | Version conflict during editing | Side-by-side diff shows server changes vs local draft | 390, 1440 |
| **UXT19** | R1 | Upload 3 images with 1 failure | Per-file progress bars; retry failed file; valid files persist | 360, 390, 1440 |
| **UXT20** | R1 | 100% Keyboard-only navigation | Visible focus rings (`#1D4ED8`); no keyboard traps in modals | 1440 |
| **UXT21** | R1 | Zoom 200% & Virtual keyboard open | Reflows cleanly without horizontal scroll; input not obscured | 360, 390, 768 |
| **UXT22** | R2 | A4 print export & offline handover | Clean `@media print` layout; repeating headers; sensitive fields omitted | Print / A4 |
| **UXT23** | R1 | Import CSV with format errors | Downloadable error report with exact line numbers; 0 writes on cancel | 390, 1440 |
| **UXT24** | R3 | Record joint cash gift from 2 guests | Enter amount once; links to both guest profiles in gift registry | 390, 1440 |
| **UXT25** | R1 | WCAG AA Contrast & Screen Reader Smoke | Contrast ≥ 4.5:1; input labels connected; ARIA announcements | 360, 1440 |
| **UXT26** | R1 | Attempt HEIC or oversized upload | Clear message: "Vui lòng chọn JPEG/PNG/WebP dưới 20 MiB" | 360, 390 |
| **UXT27** | R1 | Invite & Revoke family member | Manual share link explanation; instant revocation modal | 390, 1440 |
| **UXT28** | R1 | OAuth session expiry & Archive state | Draft restored only for same user; archived state strictly read-only | 390, 1440 |

---

## 7. Mandatory Responsive Viewport Matrix

Playwright tests run across the following 4 configured viewports:

```
┌──────────────────┬──────────────────┬──────────────────┬──────────────────┐
│ Mobile Narrow    │ Mobile Standard  │ Tablet           │ Desktop          │
├──────────────────┼──────────────────┼──────────────────┼──────────────────┤
│ 360 × 640 px     │ 390 × 844 px     │ 768 × 1024 px    │ 1440 × 900 px    │
│ Galaxy S8 / Android│ iPhone 14 / Safari│ iPad Mini        │ Desktop Chrome   │
│ Single Column    │ Single Column    │ Adaptive Grid    │ Permanent 240px  │
│ 64px Bottom Nav  │ 64px Bottom Nav  │ Collapsible Nav  │ Left Sidebar     │
└──────────────────┴──────────────────┴──────────────────┴──────────────────┘
```

---

## 8. Defect Severity & Release Gate Sign-off Criteria

| Severity Level | Definition | Impact on Release Gate |
|---|---|---|
| **Blocker** | Financial calculation discrepancy, loss of funds, guest headcount or meal mismatch, RLS data leak between Owner and Family, permanent form draft loss. | **Zero tolerated.** Immediate halt of release. |
| **High** | Inability to complete a primary workflow, failure to distinguish snapshot versions, unreadable financial figures on 360px viewport. | **Zero tolerated.** Gate sign-off blocked. |
| **Medium** | Minor navigation confusion, non-blocking UI discrepancies, slow rendering on large lists. | Allowed with approved remediation plan before G6. |
| **Low** | Minor cosmetic padding or typography adjustments not impacting usability. | Backlogged for routine polishing. |

---

## 9. Gate G8 Test Strategy & Acceptance Matrix (Seating, Catering & Logistics)

### 9.1. Core Invariants & Acceptance Tests
| Test ID | Gate | Description & Invariant | Verification Level | Pass Criteria |
|---|---|---|---|---|
| **AT06** | G8 | 4-person family on 1 invitation | Unit / Integration | Correct headcount calculation, family members grouped or warned if split |
| **AT07** | G8 | Child/infant not needing seat (`needs_seat = false`) | Unit / Integration | Headcount and meal included; consumes 0 table seat capacity |
| **AT09** | G8 | Table / RSVP conflict warning | UI / Integration | Flag unseated confirmed guests or overcapacity tables |
| **AT10** | G8 | Cancellation / RSVP decline unseating | Domain / Integration | Auto-unseat guest from `seat_assignments` on decline, audit log created |
| **AT21** | G8 | Concurrent seating race on last seat | Adversarial / Concurrency | Database row-lock in transaction (`FOR UPDATE`); strictly 1 succeeds, no overcapacity |
| **AT22** | G8 | Reduce table/vehicle capacity below assigned | Domain / API | Rejected with 400 Bad Request (`CapacityExceededError`); requires reallocation first |
| **AT26** | G8 | Family View (`family_view`) data redaction | Security / RLS / API | 200 OK for viewing shared tables/menus; 0 private notes; 0 phone numbers; 403 on write |
| **AT30** | G8 | Optimistic locking on seating / logistics updates | API / Integration | Version check in update; 409 Conflict on stale version |
| **AT52** | G8 | Immutable catering snapshot for restaurant contract | Domain / API | Locked snapshot with timestamp and change diff tracking |

