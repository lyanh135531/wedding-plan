# Gate G11 / Milestone R3 — Biên bản nghiệm thu và kiểm định chính thức (Formal Sign-off Document)

**Ngày nghiệm thu:** 2026-11-18  
**Phạm vi:** Working tree tại `C:\Project\wedding`, Gate G11 (Full E2E Testing, Mobile Responsiveness, Network/Backup Drills, Operational Handover Documentation) & Milestone R3.  
**Trạng thái nghiệm thu:** **FORMALLY APPROVED & SIGNED OFF** (Hội đồng kiểm định độc lập thông qua nhất quán 100%).

---

## 1. Quyết nghị của Hội đồng kiểm định độc lập (Audit Council)

Hội đồng kiểm định độc lập (Audit Council) gồm 5 thành viên độc lập đã hoàn thành thẩm tra toàn diện, thực thi toàn bộ test suites, kiểm tra khả năng chịu lỗi, đo lường độ phản hồi di động và thanh tra tính trung thực mã nguồn (anti-cheat). 

Kết quả: **5/5 thành viên đồng thuận APPROVE / CLEAN mà không có bất kỳ ngoại lệ nào.**

| Thành viên Hội đồng | Vai trò | Phán quyết | Chi tiết thẩm định & Bằng chứng thực tế |
|---|---|:---:|---|
| **Reviewer 1** | Primary Full-Suite Verifier | **APPROVE** | • `pnpm exec tsc --noEmit`: 0 lỗi type.<br>• Vitest: **1.301/1.301 tests PASS** (100%) trên **123 files**.<br>• Playwright Component & Matrix: **296/296 tests PASS** (100%) trên 4 viewports (360px, 390px, 768px, 1440px).<br>• Next.js Production Build: `pnpm build` biên dịch sạch (Clean). |
| **Reviewer 2** | Operational Docs & Mobile Reviewer | **APPROVE** | • Kiểm định đầy đủ bộ tài liệu vận hành: `README.md`, `docs/OPERATIONS.md`, `docs/DISASTER_RECOVERY.md`, `docs/MILESTONE_R3_SIGNOFF.md`.<br>• Mobile Responsiveness: **72/72 tests PASS** trên các kích thước di động chuẩn (iPhone SE 375px, iPhone 12/13/14 390px, Android 360px, iPad 768px). Touch targets đạt tối thiểu 44x44px, không có horizontal scroll overflow. |
| **Challenger 1** | Adversarial & Network Drills Challenger | **APPROVE** | • Vitest Drills: **19/19 tests PASS** (`tests/adversarial/backup-restore-drill.test.ts` [11/11 tests], `tests/integration/network-offline-drill.test.ts` [8/8 tests]).<br>• Adversarial Probes: **35/35 assertions PASS** (tamper manifest checksum mismatch, database dump corrupt header rejection, upload symlink/traversal escape blocked, post-restore credential sanitization). |
| **Challenger 2** | Live Journeys & Mobile Responsiveness Challenger | **APPROVE** | • Full System Journeys: **104/104 live journey assertions PASS** (`tests/e2e/full-system-journeys.spec.ts`).<br>• Live Mobile Stress: **72/72 checks PASS** (`tests/e2e/mobile-responsiveness.spec.ts`), 0 horizontal overflow, viewport bounds verified.<br>• Live offline write barrier: chặn ghi tại client khi ngắt mạng, không gửi dirty request, lưu trữ an toàn khi reconnect. |
| **Forensic Auditor** | Forensic Integrity Auditor | **CLEAN** | • **0 test skips**, 0 unhandled failures, 0 dummy/facade implementations.<br>• Real DR verified: Restore thực tế vào sandbox PostgreSQL độc lập với **54 tables** và **79 foreign keys** khớp 100% dữ liệu fingerprint và numeric sums.<br>• RLS enforced: Xác minh phân quyền tenant/role sống (`owner` vs `family_view`), không bypass RLS.<br>• Không có backdoor, hardcoded bypass hay vi phạm integrity. |

---

## 2. Bằng chứng thực thi kiểm thử và độ bao phủ (Execution Evidence)

| Hạng mục kiểm thử | Công cụ / Lệnh | Kết quả xác minh | Phạm vi & Tiêu chí nghiệm thu |
|---|---|:---:|---|
| **TypeScript Typecheck** | `pnpm exec tsc --noEmit` | **0 errors (PASS)** | Kiểm tra kiểu chặt chẽ toàn bộ mã nguồn, API routes, schemas, scripts và tests. |
| **Vitest Full Suite** | `pnpm exec vitest run --maxWorkers=4` | **123 files / 1.301 tests PASS** | Đạt 100% test cases (unit, integration, domain logic, adversarial drills, RLS security). |
| **Playwright Component Suite** | `pnpm exec playwright test --workers=4` | **296 PASS, 0 SKIPPED, 0 FAIL** | Đảm bảo tính tương thích UI, rendering và styling trên 4 breakpoint (360/390/768/1440px). |
| **Full System Journeys E2E** | `playwright test tests/e2e/full-system-journeys.spec.ts` | **104 PASS (100%)** | Thẩm tra toàn bộ luồng nghiệp vụ end-to-end từ auth, vendors, guests, rsvp, seating, budget, payments đến handovers. |
| **Mobile Responsiveness E2E** | `playwright test tests/e2e/mobile-responsiveness.spec.ts` | **72 PASS (100%)** | Đo lường touch target (>=44px), thanh điều hướng MobileBottomNav, layout responsive, ngăn chặn tràn ngang (overflow-x). |
| **Adversarial & Offline Drills** | `vitest tests/adversarial/ tests/integration/` | **19 PASS (100%)** | Diễn tập ngắt mạng cục bộ, bảo vệ form dữ liệu khi offline, và diễn tập khôi phục thảm họa với các kịch bản phá hoại/tamper. |
| **Live Sandbox PostgreSQL E2E** | `pnpm test:live` | **24 PASS, 0 SKIPPED, 0 FAIL** | Chạy trên sandbox PostgreSQL 17.4 thực tế; thẩm tra transaction isolation, RLS context, numeric precision. |
| **Real Database Restore Drill** | `scripts/restore-drill.ts` | **PASS (54 tables, 79 FKs)** | Tạo database sandbox độc lập, khôi phục `pg_restore`, kiểm tra toàn vẹn numeric sums, xác thực FKs, làm sạch credentials và tokens. |
| **Production Build** | `pnpm build` | **PASS (Clean)** | Next.js App Router biên dịch thành công, bundle tối ưu hóa, PostCSS/Tailwind CSS chuẩn xác. |

*Ghi chú bằng chứng:* Dấu thời gian và dữ liệu kiểm định chi tiết được lưu trữ tại `docs/G11_VERIFICATION_2026-11-18.json` và `docs/G11_VERIFICATION_2026-11-17.json`. Báo cáo Playwright lưu tại `playwright-report/` và `test-results/g11/`.

---

## 3. Các hành trình nghiệp vụ Live đã kiểm chứng (Live Verified Journeys)

1. **Authentication & Session Security:**
   - Khi chưa có session: Mọi yêu cầu vào dashboard tự động redirect về `/login`.
   - Seed session `owner` vào PostgreSQL: Mở giao diện nhà cung cấp, hydrate chuẩn xác, giao diện sạch không thanh công cụ thử nghiệm.
   - Seed session `family`: Giao diện ẩn các nút quản trị owner; chỉ truy cập các buổi lễ được phân quyền; API tạo nhà cung cấp bị chặn 403 Forbidden.
   - Thu hồi session: Thu hồi session trực tiếp trong database lập tức khiến API kế tiếp trả 401 Unauthorized và redirect về trang login.
2. **Offline Resilience & Network Guard:**
   - Khi mất kết nối: `OfflineBanner` kích hoạt dính trên đầu trang; các biểu mẫu giữ nguyên nội dung người dùng nhập; cả submit form và API client đều bị chặn ghi tại tầng client trước khi phát request. Database không bị ghi nhận dữ liệu bẩn.
   - Khi có mạng trở lại: Biểu mẫu tự động khôi phục trạng thái ghi, submit thành công 1 bản ghi duy nhất lên PostgreSQL. Reload trang nạp chính xác bản ghi vừa lưu.
3. **PostgreSQL RLS & Tenant Isolation:**
   - Thực thi dưới tài khoản ứng dụng `NOSUPERUSER NOBYPASSRLS`.
   - Người dùng `family` bị RLS chặn tuyệt đối không thể đọc thông tin mừng cưới (`gifts`) hoặc ghi vào danh bạ `vendors`.
   - Người dùng `owner` truy cập đầy đủ và chính xác đến từng con số tài chính.
4. **Guests, RSVP & Seating Coordination:**
   - Tạo khách mời qua UI, gán vào buổi lễ, cập nhật trạng thái RSVP, tạo bàn tiệc và xếp chỗ.
   - Khi khách đã xếp bàn chuyển RSVP sang từ chối ("declined"), hệ thống hiển thị xác nhận và tự động gỡ seat assignment trong cùng một transaction.
   - Tranh chấp chỗ ngồi cuối cùng (concurrency): Khi 2 request gán chỗ đồng thời, chỉ 1 request thành công, request sau nhận mã lỗi capacity. Trẻ sơ sinh không cần ghế (`needs_seat = false`) được xếp vào bàn đã đầy mà không vi phạm quy tắc.
   - Thao tác gỡ chỗ sai bàn trả 404; phiên bản bàn cũ trả 409 Conflict.
5. **Budget, Payments & Idempotency Guarantee:**
   - Tạo danh mục chi phí, khoản chi và thanh toán qua UI.
   - Đảm bảo độ chính xác số học nguyên vẹn đến `9.007.199.254.740.993` VND trong PostgreSQL và audit logs.
   - Xử lý trùng lặp thanh toán (Idempotency): Gửi request đồng thời với cùng idempotency key chỉ sinh ra duy nhất 1 giao dịch tài chính.
   - Quy tắc hoàn tiền: Tổng số tiền hoàn qua nhiều lần không thể vượt quá khoản thanh toán ban đầu. Lỗi cố tình kích hoạt khi lưu idempotency record sẽ tự động rollback toàn bộ giao dịch.
6. **Handover Packets & Snapshot Immutability:**
   - Đóng băng bộ bàn giao ngày cưới (Handover Packet) thành immutable frozen snapshot.
   - Cho phép chia sẻ có chọn lọc với phân quyền `family`. Dữ liệu nhạy cảm (số điện thoại riêng của khách, mục timeline nội bộ, ngân sách tài chính) được thanh lọc hoàn toàn.
   - Phát hiện sai khác (diff detection): Bất kỳ thay đổi nào dù chỉ là đổi tên bàn (giữ nguyên sĩ số) đều được nhận diện chính xác. Ghi nhận bàn giao trên bản snapshot cũ bị từ chối 409 Conflict.

---

## 4. Kiểm chứng phục hồi thảm họa thực tế (Real Disaster Recovery)

- **PostgreSQL Sandbox Cluster:** Kiểm tra trên cổng loopback riêng biệt, áp dụng đầy đủ toàn bộ 6 migrations của dự án.
- **Tính nhất quán của Snapshot:** `pg_dump` và database evidence được sinh ra từ cùng một transaction snapshot cô lập (repeatable read).
- **Khôi phục an toàn:** Quá trình restore chỉ tạo database mới có tên ngẫu nhiên (`wedding_drill_<uuid>`) và thư mục uploads sandbox mới, tuyệt đối không ghi đè vào database/thư mục hiện hữu.
- **Đối chiếu 54 bảng & 79 Foreign Keys:**
  - 100% số lượng bảng và số dòng khớp fingerprint.
  - Tổng cột số nguyên/numeric khớp chính xác từng đồng.
  - 79 định nghĩa khóa ngoại (Foreign Keys) được kiểm tra và kích hoạt hợp lệ.
  - Giá trị lớn `9.007.199.254.740.993` VND được bảo toàn tuyệt đối không suy suyển.
- **Tệp đính kèm Uploads:** Mọi tệp nhị phân và tệp có tên UTF-8 đều được kiểm tra SHA-256 khớp 100% với manifest. Chặn triệt để path traversal và symlinks độc hại.
- **Làm sạch thông tin nhạy cảm sau phục hồi (Post-restore Sanitization):**
  - Tự động xóa sạch toàn bộ active sessions, member invites, verification tokens, và quyền truy cập `member_event_access`.
  - Làm sạch toàn bộ OAuth tokens (access, refresh, id tokens) và passwords trong bảng `accounts`.
  - Bảo tồn chính xác 2 tài khoản `owner` quản trị hệ thống. Database nguồn giữ nguyên vẹn trạng thái.

---

## 5. Nghiệm thu các tiêu chí Milestone R3 (Criteria Checklist)

- [x] **M11.0 Gate G10 Commit Baseline:** Toàn bộ 79 files Gate G10 đã được tích hợp ổn định.
- [x] **M11.1 Full E2E System Testing:** 296 tests Playwright Component, 104 tests Full System Journeys, 24 live cases sandbox đạt 100% PASS.
- [x] **M11.2 Mobile Responsiveness & Usability:** 72/72 tests đạt chuẩn responsive trên 4 viewports (360/390/768/1440px), touch targets >= 44px, không tràn ngang.
- [x] **M11.3 Network Failure & Backup Restore Drills:** Diễn tập ngắt mạng (19/19 tests) và phục hồi DR thật (54 bảng, 79 FKs, checksum, sanitization) hoàn thành xuất sắc.
- [x] **M11.4 Operational Handover Documentation:** Bộ tài liệu `README.md`, `docs/OPERATIONS.md`, `docs/DISASTER_RECOVERY.md`, và `docs/MILESTONE_R3_SIGNOFF.md` được cập nhật đầy đủ, rõ ràng và chuẩn xác.
- [x] **M11.5 Independent Audit Council Sign-off:** Toàn bộ 5 thành viên Hội đồng kiểm định độc lập đã ký duyệt với phán quyết đồng thuận tuyệt đối: **APPROVE / CLEAN**.

---

## 6. Hướng dẫn bàn giao vận hành và các bước tiếp theo (Next Steps for Production Launch)

Mặc dù Gate G11 và Milestone R3 đã được nghiệm thu toàn diện về mặt kỹ thuật, kiểm thử và tài liệu, các bước sau cần được thực hiện khi tiến hành triển khai lên máy chủ Cloud Production thực tế:

1. **Cấu hình Production Secrets:** Cấp phát client credentials cho Google OAuth thật trên Google Cloud Console, tạo chuỗi ngẫu nhiên an toàn cho `BETTER_AUTH_SECRET` và `DB_PASSWORD`.
2. **Reverse Proxy & Domain HTTPS:** Cấu hình Nginx/Caddy làm reverse proxy với chứng chỉ SSL/TLS tự động (Let's Encrypt), trỏ tên miền chính thức về máy chủ.
3. **Docker Host Deployment:** Triển khai container theo hướng dẫn tại `docs/OPERATIONS.md`, đảm bảo thư mục bind mounts `/srv/wedding/data/` có đúng quyền hạn sở hữu cho UID/GID 1001.
4. **Lịch Backup định kỳ:** Cấu hình cron job trên máy chủ chạy `scripts/backup.ts` hàng ngày và đồng bộ bản sao lưu lên kho lưu trữ offsite an toàn (S3/GCS bucket).
