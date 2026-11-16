# Project: Wedding Management Platform — Gate G8

## Architecture
- **Layered Architecture**:
  - **Database Layer**: Drizzle ORM (`src/db/schema/seating.ts`, `catering.ts`, `logistics.ts`, `index.ts`), PostgreSQL RLS policies (`src/db/migrations/0003_seating_catering_logistics.sql`), session context injection (`app.current_user_id`, `app.current_role`) via `withTransactionScopedContext`.
  - **Repository Layer**: Transaction-aware data access objects (`src/lib/seating/`, `src/lib/catering/`, `src/lib/logistics/`) using `.for('update')` row locking and optimistic locking (`version: integer`).
  - **Domain Service Layer**: Headcount arithmetic, seat capacity validation (AT21), non-seat infant logic (AT07), RSVP cancellation unseating hook (AT10), capacity reduction guard (AT22), meal counting & dietary aggregation, sanitized A4 exports (AT26).
  - **API Route Handlers**: Next.js App Router (`/api/v1/tables`, `/api/v1/menus`, `/api/v1/transport`, `/api/v1/accommodations`) enforcing live DB session, `family_view` 403 on writes (AT03, AT26), and optimistic locking 409 responses (AT30).
  - **Frontend UI Layer**: Desktop drag-and-drop & mobile tap-to-seat workflow (S18 `/seating`), catering management & meal locking (S19 `/menus`), accommodations & shuttle coordination (S20 `/logistics`), wrapped in `PageShell` and role-aware contexts.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 0 | Gate G7 Commit Baseline | Resolve 34 vendor tests and commit Gate G7 clean | M8.0 | R1, Survey |
| 1 | Seating Schema Migration | `tables`, `seat_assignments` with constraints & RLS | M8.1 | R1, PLAN §12 |
| 2 | Catering Schema Migration | `menus`, `menu_items`, `guest_meal_selections`, snapshots with RLS | M8.1 | R1, PLAN §13 |
| 3 | Logistics Schema Migration | `accommodations`, `room_assignments`, `transport_trips`, `trip_passengers` with RLS | M8.1 | R1, PLAN §13 |
| 4 | RLS Policies Enforcement | Restrict `family_view` to read-only sanitized event data | M8.1 | R1, AT03, AT26 |
| 5 | Table & Seat Repository | CRUD tables, assign/unassign seats with row locking | M8.2 | R2, AT21 |
| 6 | Seating Capacity Guard | In-transaction server capacity check preventing over-allocation | M8.2 | R2, AT21 |
| 7 | Infant Non-Seat Policy | Children `needs_seat = false` do not consume table capacity | M8.2 | R2, AT07 |
| 8 | RSVP Decline Auto-Unseat | Changing RSVP to declined unseats guest automatically | M8.2 | R2, AT10 |
| 9 | Capacity Reduction Guard | Block decreasing capacity below assigned count | M8.2 | R2, AT22 |
| 10 | Catering Domain Service | Aggregate meal counts (adult, child, veg) vs confirmed RSVP | M8.2 | R2, PLAN §13 |
| 11 | Sanitized A4 Seating Export | Export layout without private notes or contact info | M8.2 | R2, AT26 |
| 12 | Logistics Domain Service | Room/trip assignments, vehicle capacity reduction guard | M8.2 | R2, AT22 |
| 13 | Table & Seat API Routes | `/api/v1/tables`, `/api/v1/tables/[id]/seats` with AT30 locking | M8.3 | R3, PLAN §12 |
| 14 | Menu & Meal API Routes | `/api/v1/menus`, `/api/v1/menus/[id]/items`, meal selections | M8.3 | R3, PLAN §13 |
| 15 | Transport API Routes | `/api/v1/transport`, trips, passenger assignment | M8.3 | R3, PLAN §13 |
| 16 | Accommodation API Routes | `/api/v1/accommodations`, rooms, guest assignment | M8.3 | R3, PLAN §13 |
| 17 | Family View Authorization | Block write access with 403 Forbidden for `family_view` | M8.3 | R3, AT03, AT26 |
| 18 | S18 Seating Screen Desktop | Table arrangement & drag-and-drop seating chart | M8.4 | R4, UI_UX §7.6 |
| 19 | S18 Seating Screen Mobile | Tap-to-seat alternative workflow for mobile screens | M8.4 | R4, UI_UX §7.6 |
| 20 | S19 Menus & Meals Screen | Menu management, dietary counts, final lock with restaurant | M8.4 | R4, UI_UX §7.6 |
| 21 | S20 Logistics Screen | Accommodation and transport assignment management | M8.4 | R4, UI_UX §7.6 |
| 22 | Seating Conflict Warnings | Warn on split families, unassigned guests, overcapacity | M8.4 | R4, AT06, AT09 |
| 23 | E2E Test Suite | Comprehensive tests covering AT06, AT07, AT09, AT10, AT21, AT22, AT26, AT30 | M8.5 | R5, PLAN §25 |
| 24 | Adversarial Hardening | Concurrency race condition stress tests & edge-case probes | M8.5 | R5, PLAN §25 |
| 25 | Independent Council Review | Reviewers, Challengers, and Forensic Auditor verification | M8.5 | R5, Acceptance |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M8.0 | Gate G7 Commit Baseline | Resolve 34 vendor tests & commit Gate G7 clean | none | IN_PROGRESS |
| M8.1 | Database Schema & RLS | Seating, catering, logistics Drizzle schemas & SQL RLS | M8.0 | PLANNED |
| M8.2 | Repositories & Domain Services | Concurrency locking, AT07, AT10, AT21, AT22, meal aggregation | M8.1 | PLANNED |
| M8.3 | REST API Route Handlers | `/api/v1/tables`, `/menus`, `/transport`, `/accommodations` + AT30 + 403 | M8.2 | PLANNED |
| M8.4 | Frontend UI Modules & Pages | S18 seating, S19 menus, S20 logistics, conflict alerts | M8.3 | PLANNED |
| M8.5 | E2E Testing & Council Review | 100% E2E tests, adversarial stress tests, council signoff | M8.4 | PLANNED |

---

## Interface Contracts
### Seating Service ↔ Table API
- `assignGuestToTable(eventId, tableId, guestId, options?: { version?: number }) => Promise<{ success: boolean; version: number }>`
- `unassignGuest(eventId, guestId) => Promise<void>`
- `updateTableCapacity(eventId, tableId, newCapacity, version) => Promise<Table>` (throws `CapacityExceededError` if assigned > newCapacity)

### Catering Service ↔ Menu API
- `getMealSummary(eventId) => Promise<{ adultMeals: number; childMeals: number; vegetarianMeals: number; totalMeals: number; bufferMeals: number }>`
- `lockMenuWithVendor(eventId, menuId, snapshotData) => Promise<CateringSnapshot>`

### Logistics Service ↔ Transport API
- `assignPassengerToTrip(eventId, tripId, guestId) => Promise<TripPassenger>` (throws `TripCapacityExceededError` if full)
- `updateTripCapacity(eventId, tripId, newCapacity) => Promise<TransportTrip>` (throws `CapacityExceededError` if passengers > newCapacity)

---

## Code Layout
- Database schemas: `src/db/schema/seating.ts`, `src/db/schema/catering.ts`, `src/db/schema/logistics.ts`
- Migrations: `src/db/migrations/0003_seating_catering_logistics.sql`
- Repositories: `src/lib/seating/`, `src/lib/catering/`, `src/lib/logistics/`
- API routes: `src/app/api/v1/tables/`, `src/app/api/v1/menus/`, `src/app/api/v1/transport/`, `src/app/api/v1/accommodations/`
- UI Components: `src/components/modules/seating/`, `src/components/modules/menus/`, `src/components/modules/logistics/`
- Pages: `src/app/(dashboard)/seating/`, `src/app/(dashboard)/menus/`, `src/app/(dashboard)/logistics/`
- Tests: `tests/unit/seating/`, `tests/unit/catering/`, `tests/unit/logistics/`, `tests/integration/api/`, `tests/adversarial/`
