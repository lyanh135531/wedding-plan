# E2E Test Suite Ready — Gate G8 (Seating, Catering & Logistics)

## Test Runner
- Command: `pnpm vitest run tests/adversarial/g8- tests/integration/api/g8- tests/unit/db/g8-`
- Full Suite Command: `pnpm vitest run`
- Expected: All tests pass with exit code 0

## Coverage Summary
| Tier | Count | Description |
|------|------:|-------------|
| 1. Feature Coverage | 24 | Tables, seats, menus, meal items, logistics, RLS schema |
| 2. Boundary & Corner | 20 | Concurrency race (AT21), capacity reduction floor (AT22), non-seat infants (AT07), optimistic version locking (AT30) |
| 3. Cross-Feature | 18 | RSVP decline auto-unseat (AT10), split-family warnings (AT06/AT09), catering snapshot locking (AT52) |
| 4. Real-World Application | 9 | Family view full redaction & 403 write blocks (AT03, AT26), realistic 4-person family group seating |
| **Total** | **71** | 35 adversarial/integration tests + 36 DB unit tests (100% pass) |

## Feature Checklist
| Feature | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---------|:------:|:------:|:------:|:------:|
| Seating & Table Capacity (AT21) | 5 | 5 | ✓ | ✓ |
| Capacity Reduction Guard (AT22) | 5 | 5 | ✓ | ✓ |
| Infant Non-Seat Policy (AT07) | 5 | 5 | ✓ | ✓ |
| RSVP Decline Auto-Unseat (AT10) | 5 | 5 | ✓ | ✓ |
| Family View Security & Redaction (AT03, AT26) | 5 | 5 | ✓ | ✓ |
| Optimistic Locking (AT30) | 5 | 5 | ✓ | ✓ |
| Catering Dietary & Meal Summary | 5 | 5 | ✓ | ✓ |
| Logistics & Vehicle Capacity (AT22) | 5 | 5 | ✓ | ✓ |
