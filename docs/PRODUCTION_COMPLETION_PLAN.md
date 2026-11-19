# Kế hoạch hoàn thiện sản phẩm và phát hành production

Ngày rà soát: 19/11/2026. Trạng thái: **đã triển khai các luồng menu dùng dữ liệu thật; đang kiểm chứng bản ứng viên phát hành**. Xem [biên bản hoàn thiện](COMPLETION_REPORT_2026-11-19.md) cho kết quả mới nhất.

## 1. Kết luận rà soát ban đầu và phạm vi

Dự án có nền tảng database, nghiệp vụ và API đáng kể, nhưng giao diện sử dụng thật chưa bao phủ đặc tả. Có 8 route bị khóa bằng `FeaturePreview`, trang thiệp mời vẫn dùng dữ liệu mẫu và state cục bộ, một tab nghiệm thu dùng fixtures và hai luồng nhà cung cấp tự thay lỗi API bằng dữ liệu mẫu. Nối API cho 8 trang bị khóa vẫn chưa đủ để phát hành: phải hoàn thiện các thao tác còn thiếu ở trang đã chạy, quyền người nhà, nhiều buổi lễ, nhập/xuất, vận hành và kiểm chứng thực tế.

Đích đến là toàn bộ phạm vi sản phẩm trong `PLAN.md` và `docs/UI_UX_SPEC.md`, bao gồm chức năng trước, trong và sau cưới. Thứ tự ưu tiên dưới đây là thứ tự thực hiện, không phải cắt bớt tính năng khỏi release cuối. Giữ phạm vi dùng riêng cho một đám cưới, hai owner, người nhà chỉ xem; không mở rộng sang SaaS, RSVP công khai hoặc gửi tin hàng loạt.

Dữ liệu thật khởi tạo trống. Checklist/danh mục gợi ý chỉ được tạo khi người dùng chọn. Fixtures chỉ dùng ở test hoặc môi trường demo riêng.

## 2. Bằng chứng và giới hạn của đợt rà soát

Đã đọc danh sách route dashboard/API, sidebar, các component live/prototype, các service liên quan, schema, migration journal, Docker, cấu hình test, đặc tả và biên bản kiểm định cũ. Đây là rà soát tĩnh phục vụ kế hoạch; chưa phải kiểm toán bảo mật toàn bộ hoặc UAT từng thao tác trên trình duyệt.

Khi lập kế hoạch ban đầu, checkout không có `node_modules` và `pnpm` chưa có trên PATH. Theo yêu cầu bổ sung của người dùng, đã cài pnpm 12.18.0, cài dependencies bằng `pnpm install --frozen-lockfile` và cài Chromium/WebKit cho Playwright. Lockfile không thay đổi.

Kiểm tra lại sau cài đặt: TypeScript `--noEmit --incremental false` thành công; Vitest 126 files / 1.315 tests pass, không fail/skip; production build thành công với `NEXT_DIST_DIR=.next-audit`. Báo cáo Vitest: `test-results/release-plan-vitest.json`; log build: `audit-release-build.log` (artifacts local được gitignore). Không thay đổi database, secrets, phiên đăng nhập hoặc môi trường triển khai của người dùng. Các kiểm tra này không thay thế live E2E có PostgreSQL thật hoặc nghiệm thu release.

Playwright component/browser: 296 tests pass trên bốn viewport, Chromium/WebKit; báo cáo `playwright-report/components/index.html`, log `audit-release-browser.log`. Bộ này dùng nội dung component render sẵn, không chứng minh ghi và tải lại dữ liệu trên ứng dụng thật.

Các số test pass trong `docs/STABILITY_AUDIT_2026-11-19.md` là bằng chứng lịch sử với phạm vi riêng. Bộ live hiện có còn kiểm tra rằng các trang chưa hoàn thiện bị khóa; test đó pass không chứng minh các trang đã hoàn thiện.

## 3. Vấn đề chặn phát hành tại thời điểm rà soát ban đầu

| Mã | Bằng chứng trong repository | Việc cần làm và điều kiện đóng |
| --- | --- | --- |
| B01 | 8 page dùng `FeaturePreview`: menus, logistics, ideas, support, preparation, timeline, after-wedding, data/import | Hoàn thiện luồng thật, kiểm tra lưu–reload–đọc từ phiên khác; chỉ bỏ khóa khi từng module đã đạt nghiệm thu. |
| B02 | `VendorCompareScreen.tsx` dùng fixture khi API lỗi và ánh xạ vendor ID sang quote ID mẫu; `QuoteToCostPreviewModal.tsx` dùng fixture khi tải preview lỗi | Loại fallback ở runtime thật; lấy đúng quote của vendor; lỗi phải hiện đúng và cho thử lại. Không hiện giá/category mẫu hoặc cho chuyển đổi từ preview lỗi. |
| B03 | `/handovers` render `R2SignoffDashboard` với fixtures, số khách/ghế/suất hardcode và snapshot chỉ nằm trong state | Thay bằng dữ liệu thật; snapshot có ID database, lịch sử, nội dung bất biến và thông tin bàn giao thật. |
| B04 | POST `/api/v1/r2-signoff` gọi `evaluateR2Readiness`; service dựng object `isImmutable: true` nhưng không ghi snapshot | Tách đánh giá chỉ đọc khỏi thao tác lưu snapshot trong transaction; GET không báo đã lưu; POST chỉ báo thành công khi commit. Hash là checksum, không gọi là chữ ký số khi chưa có cơ chế ký. |
| B05 | `createFamilyInvite` tạo URL `/invite?token=...`; chưa có route nhận lời mời, API/UI quản lý thành viên trong cây source | Hoàn thiện tạo/nhận/thu hồi lời mời, cấp/thu hồi quyền theo buổi, đúng email, hết hạn, dùng một lần, kiểm tra lại quyền mỗi request. Đưa truy vấn invite vào transaction/context phù hợp. |
| B06 | Compose dùng `${DB_USER}` cho cả `POSTGRES_USER` và `DATABASE_URL` của app | Tách bootstrap/migration role khỏi app role; app phải `NOSUPERUSER NOBYPASSRLS`, quyền tối thiểu; kiểm định trên image PostgreSQL đích. |
| B07 | Journal Drizzle không chứa `0001_rls_policies.sql`; chưa có lệnh migrate trong package scripts | Một quy trình migrations có version/checksum, bao gồm RLS/extensions, khóa chạy đồng thời và fail trước khi app phục vụ nếu schema không phù hợp. Thử cả DB trống và nâng cấp DB cũ. |
| B08 | `checkArchivalFreezeGuard` mới được gọi ở một nhóm route G10; chưa bao phủ mọi đường ghi | Áp dụng chặn ghi nhất quán cho khách/tiền/cấu hình/import/upload và module khác, có ngoại lệ mở lưu trữ được kiểm soát. Thử gọi trực tiếp API và tình huống ghi đồng thời với freeze. |
| B09 | `CheckInDashboard` có component/API nhưng chưa có page sử dụng trong cây app; `/after-wedding` chưa có mục sidebar | Bổ sung lối vào điểm danh theo buổi và hậu cưới, quyền đúng, trạng thái không có buổi rõ ràng; điểm danh tùy chọn nhưng phải dùng được khi bật. |
| B10 | Không có `.github`/workflow trong checkout; runbook ghi Docker và môi trường production chưa kiểm định | Thêm CI và quy trình release staging → production, kiểm định image/DB/uploads/proxy/restore, có rollback được diễn tập. |
| B11 | `/invitations` render `InvitationsManager`, khởi tạo `INITIAL_INVITATIONS`; xác nhận gửi chỉ gọi `setInvitations` | Nối danh sách/nhóm thiệp và thao tác gửi hàng loạt vào API thật; reload giữ kết quả, không báo thành công từ state cục bộ. |

B06–B08 là khoảng trống cấu hình/bao phủ được phát hiện từ source; cần kiểm chứng trên database đích, không suy diễn rằng dữ liệu thật đã bị truy cập trái phép.

## 4. Ma trận phạm vi từ đợt rà soát ban đầu

“Có API thật” chỉ mô tả trạng thái nối dữ liệu, không phải kết luận module đã đủ chức năng hoặc đã nghiệm thu production.

| Màn hình / luồng | Hiện trạng quan sát | Phần phải hoàn thiện trước release cuối |
| --- | --- | --- |
| Đăng nhập và setup | Session server, Google và setup lưu DB đã có | OAuth thật trên domain HTTPS với hai owner; email lạ; callback lỗi; hết phiên; thiết lập không bắt buộc ngày/ngân sách; khởi tạo đồng thời không trùng. |
| Cài đặt, buổi lễ, thành viên | Trang settings chủ yếu sửa tên hiển thị; service khởi tạo một buổi | Sửa thông tin hai người; thêm/sửa/hủy buổi, ngày/giờ/địa điểm; chọn buổi đại diện; danh mục; người nhà và quyền. Đổi ngày phải có preview ảnh hưởng, kiểm version, giữ hạn cố định. |
| Tổng quan `/overview` | Có component live | Đối chiếu chỉ số với danh sách/DB; thiếu giá/ngân sách/ngày phải hiển thị đúng; liên kết chỉ số mở đúng bộ lọc; phạm vi all/common/buổi nhất quán. |
| Nhật ký `/history` | Đọc API thật | Bộ lọc, phân trang, tên hành động dễ hiểu, đối chiếu trước/sau, quyền xem; không lộ secrets hoặc ghi chú riêng cho người nhà. |
| Công việc `/tasks` | Live tạo và đổi trạng thái | Sửa/chi tiết, người phụ trách, checklist, phụ thuộc, chặn chu trình, lý do vượt tiền đề, hạn tương đối, tìm/lọc; tiêu đề chia sẻ tách khỏi nội dung nội bộ. |
| Lịch `/calendar` | Feed thật và ICS | Đủ công việc, hạn trả, buổi lễ; lọc nguồn/buổi và mở bản ghi gốc; sửa/đổi ngày không còn mục cũ; timezone Việt Nam và quyền export. |
| Nhà cung cấp `/vendors`, chi tiết, compare | Directory/detail có API; compare/preview còn fallback mẫu | CRUD và archive, bộ lọc, báo giá phiên bản, giá thiếu/VAT/phí; hợp đồng và file; so sánh từ quote thật; chuyển thành khoản chi đúng một lần và không tự sinh thanh toán. |
| Tài liệu `/documents` | Upload và danh sách/tải thật | Gắn tệp vào bản ghi, thư viện/tìm/lọc, quyền chia sẻ rõ, nhiều tệp và lỗi từng tệp, đổi metadata/lưu trữ/xóa theo chính sách; thumbnail/EXIF, file lỗi và dọn tệp mồ côi. |
| Ý tưởng `/ideas` | Preview và local state | CRUD, ảnh/link/tag, lọc; liên kết công việc/khoản chi; preview chuyển đổi, tạo thật chống trùng, truy ngược nguồn. |
| Khách `/guests` | Live thêm người/gia đình, RSVP và xem chi tiết | Sửa hồ sơ, tìm/lọc/phân trang server, nhóm và nhãn; phát hiện/gộp trùng với giải quyết xung đột; archive/khôi phục; thiệp/người/tham dự/ghế/suất tách biệt. |
| Thiệp `/invitations` | Page dùng `InvitationsManager` với danh sách mẫu và cập nhật state cục bộ | Thay bằng dữ liệu thật; quản lý nhóm thiệp/đại diện/thành viên, cách gửi, ngày/người gửi, cập nhật hàng loạt có preview; tách tiến độ gửi khỏi RSVP từng buổi. |
| Xếp bàn `/seating` | Workspace thật | Kiểm tra đủ thêm/sửa/xóa bàn, phân/gỡ/chuyển khách, xử lý đổi RSVP; trẻ em/em bé, giảm sức chứa, tranh ghế cuối, export và bản in thật. |
| Thực đơn `/menus` | Preview | CRUD menu/món, gắn buổi, lựa chọn món/ăn kiêng, suất theo chính sách từng khách; tổng hợp đối chiếu bàn; chốt snapshot nhà hàng và chênh lệch sau chốt. |
| Lưu trú & Xe `/logistics` | Preview | CRUD phòng/chuyến, phân/gỡ khách, giờ/địa điểm/liên hệ, sức chứa và trùng phân công; giảm sức chứa có giải quyết; danh sách xuất/in được chia sẻ đúng quyền. |
| Ngân sách `/budget` | Tạo danh mục/khoản chi và đọc thật | Sửa danh mục/khoản chi, dự toán/giá chốt/quyết toán, phân bổ ngân sách, nợ và thiếu giá; hủy dịch vụ/phí hủy; nguồn báo giá; không thay null bằng 0. |
| Thanh toán `/payments` | Ghi chi, hoàn, void thật | Lịch trả nhiều đợt, phân/tái phân bổ, người trả/phương thức/chứng từ, trả hộ trực tiếp, giao dịch lịch sử; lọc/đối soát; retry và hoàn đồng thời an toàn. |
| Quỹ `/fund` | Đọc nguồn tiền và lưu mốc mở sổ | Thêm/hủy khoản góp, cam kết/chưa nhận/đã nhận, trả thẳng NCC, chuyển trạng thái có lịch sử; số dư sau mốc không trừ lại cọc cũ; đối chiếu với payments và gifts. |
| Quà `/gifts` | Dashboard gọi API thật | Nghiệm thu đủ phong bì chung, nhiều người gửi, tiền/hiện vật/trả lại/void, cảm ơn; số tiền tính một lần, dòng tiền theo mốc và quyền riêng tư. |
| Lịch trình `/timeline` | Preview | CRUD theo buổi, thứ tự, phụ trách/địa điểm, ghi giờ thực tế, hiện tại/tiếp theo, dịch lịch có preview và kiểm version; giữ kế hoạch gốc, bản in và bản chia sẻ. |
| Điểm danh | Có component/API, thiếu lối vào | Trang hoặc tab theo buổi; tìm khách/check-in/undo/khách phát sinh; không tự đổi RSVP hoặc snapshot; kiểm ghế và audit. |
| Bàn giao `/handovers` | Day-of có API; tab nghiệm thu còn mẫu | Thống nhất mô hình snapshot/readiness; nội dung thực, lịch sử và diff, người nhận/kênh/thời gian; bản đã chốt bất biến, phát hiện stale, in đúng phiên bản đã chọn. |
| Đội hỗ trợ `/support` | Preview | CRUD thành viên/vai trò/liên hệ, phân công theo buổi, liên kết timeline/task; bản cho người nhà chỉ có thông tin vận hành đã chia sẻ. |
| Chuẩn bị `/preparation` | Preview cho đồ dùng, nhạc, ảnh | CRUD đồ/mua/thuê/mượn/người giữ/hạn trả; nhạc thứ tự theo nghi lễ; shot list/phụ trách/trạng thái bàn giao; liên kết ý tưởng, không mất dữ liệu khi đổi tab. |
| Hậu cưới `/after-wedding` | Bị khóa; component đã gọi một số API nhưng media link mẫu/state | Checklist thật, liên kết album/video lưu DB và kiểm URL, trả đồ/hoàn tiền/cảm ơn; freeze/mở lại có lý do và audit, toàn app chỉ đọc khi đóng. |
| Nhập `/data/import` | Preview; API stage nhận rows JSON, chưa phải bộ đọc file hoàn chỉnh | Chọn/đọc CSV và XLSX, ánh xạ cột, chuẩn hóa tiếng Việt/SĐT, giới hạn file/dòng, lỗi từng dòng, xử lý trùng; stage → preview → commit nguyên tử → rollback có điều kiện; thử lại không nhân bản. |
| Xuất `/data/export` | CSV khách và bản in hai cột thật | Xuất đúng các bộ dữ liệu trong PLAN §19.3: khách, ngân sách/giao dịch, bàn/suất, danh sách vận hành; XLSX/CSV theo định dạng đặc tả, A4 đúng dữ liệu/bộ lọc/buổi, phân quyền và chống công thức. |
| Header, điều hướng, thông báo | Chuông chưa có luồng đọc; thiếu lối vào vài module | Thông báo trong app từ việc/hạn trả/thiếu dữ liệu, chống trùng, đọc/hoãn, mở đúng bản ghi; điều hướng desktop/mobile đủ module và quyền. Tìm kiếm theo phạm vi đặc tả. |

## 5. Hợp đồng hoàn thành chung cho mỗi module

1. Có ma trận hành động: xem, tạo, sửa, xóa/lưu trữ/khôi phục hoặc void theo đúng nghiệp vụ. Ghi rõ hành động nào không áp dụng; không ép xóa giao dịch lịch sử.
2. UI → API → transaction/service → PostgreSQL thật; DTO và tên trường thống nhất. API đã có cũng phải được kiểm tra lại khi nối UI.
3. Loading, trống, lỗi tải, validation từng trường, lỗi 401/403/409/413/500 và thử lại đều dùng được; chỉ báo thành công sau commit.
4. Sau lưu, reload trang và phiên owner thứ hai thấy dữ liệu đúng; hai owner sửa đồng thời không ghi đè âm thầm. Hủy phản hồi tải cũ khi đổi buổi/bộ lọc.
5. Owner/family được kiểm tra ở máy chủ, truy vấn DB, file và export. Dữ liệu riêng không nằm trong HTML/JSON/cache gửi cho family.
6. Retry tài chính/import/chuyển đổi không tạo bản ghi đôi. Số tiền giữ dạng nguyên chính xác, phân biệt null và 0; thời gian thống nhất Việt Nam.
7. Mất mạng không ghi/báo lưu giả; lỗi giữ nội dung form. Draft qua OAuth đúng tài khoản, TTL và version theo PLAN; đăng xuất/đổi tài khoản không lộ draft.
8. Desktop/mobile/bàn phím, focus/modal và A4 đạt đặc tả; bỏ nội dung kỹ thuật không giúp người dùng ra quyết định khỏi màn hình sản phẩm.
9. Có hành trình browser thật chứng minh thao tác chính và lỗi quan trọng, đối chiếu DB. Component render test chỉ hỗ trợ, không thay thế persistence test.

## 6. Thứ tự triển khai và sản phẩm bàn giao từng giai đoạn

| Giai đoạn | Công việc | Phụ thuộc | Điều kiện kết thúc |
| --- | --- | --- | --- |
| R0 — Nền tảng release | Cài môi trường theo lockfile; baseline build/test; xử lý B02/B04/B06/B07/B08; thống nhất lỗi/DTO/version/idempotency; tách fixtures khỏi runtime; CI ban đầu | Không | Build/test tái lập; migrate DB trống/nâng cấp thành công; app role không bypass RLS; không còn fallback mẫu/báo lưu giả ở đường sử dụng thật. |
| R1 — Tài khoản và cấu hình | Setup, thông tin cưới, CRUD nhiều buổi, buổi đại diện/đổi ngày, danh mục, lời mời và quyền người nhà, draft hết phiên | R0 | Hai owner và family thao tác đúng; nhận/thu hồi lời mời thực; không có dữ liệu mẫu; đổi ngày cập nhật nguồn liên quan đúng. |
| R2 — Luồng cốt lõi đầy đủ | Khách/thiệp/gộp trùng; công việc/phụ thuộc/lịch; ngân sách/lịch trả/thanh toán/quỹ/quà; NCC/báo giá/tài liệu; nhập dữ liệu | R1 | Dùng UI hoàn tất được vòng tạo → sửa → liên kết → đối soát → export; không cần sửa DB tay; tiền/khách không đếm trùng. |
| R3 — Chuẩn bị toàn diện | Support, ideas, preparation, menus, logistics; hoàn thiện seating và liên kết liên module | R2 | Cả các tab nhạc/ảnh/đồ và phân xe/phòng/suất ăn lưu thật; sức chứa và chốt nhà hàng đúng; không còn preview trong nhóm chuẩn bị. |
| R4 — Ngày cưới và hậu cưới | Timeline, điểm danh, readiness/snapshot/bàn giao, xuất/in, checklist/media/freeze; thông báo và hoàn thiện tổng quan | R3 | Chạy trọn hành trình trước–trong–sau cưới; snapshot bền vững; phát sinh sau chốt báo diff; toàn app tuân thủ archive. |
| R5 — Release candidate | Hồi quy toàn bộ, tải thử, accessibility/mobile/A4, kiểm quyền/log/uploads; build Docker, staging HTTPS, nâng cấp và rollback, restore offsite | R4 | Toàn bộ cổng phát hành ở mục 8 có bằng chứng; không còn lỗi chặn; tài liệu vận hành khớp image được test. |
| R6 — Phát hành và kiểm tra sau triển khai | Backup trước deploy; migrate bằng role riêng; deploy image đã test; OAuth thật; smoke owner/family; bật backup/giám sát và diễn tập restart | R5 và cấu hình hạ tầng thật | Bản release chạy tại domain đích, có version/image digest, log kiểm tra, backup khôi phục được và người vận hành xác định. |

Mỗi giai đoạn cập nhật backlog, bằng chứng và tài liệu ngay khi hoàn thành; không đóng toàn bộ milestone chỉ vì bộ test cũ pass. Khi R0/R1 phát hiện sai lệch schema hoặc API, xử lý trước khi nhân rộng sang các màn hình khác. Không đưa ngày hoàn thành cố định khi chưa dựng lại baseline và đo khối lượng thực hiện R0.

## 7. Kế hoạch kiểm định

- Đối chiếu từng AT01–AT62 trong `PLAN.md` và UXT01–UXT28 trong `UI_UX_SPEC.md` sang: module, hành động UI, API, kiểm tra DB, test/evidence và trạng thái. Tiêu chí chưa có bằng chứng giữ trạng thái chưa nghiệm thu.
- Unit cho quy tắc nghiệp vụ rủi ro; integration với PostgreSQL thật cho transaction/RLS/concurrency, gồm app role không đặc quyền. Không chỉ dựa vào mock.
- Live E2E mở rộng `tests/live/g11-journeys.spec.ts` cho toàn bộ module và tab. Thay test “preview bị khóa” bằng test nghiệp vụ sau khi mỗi module được nối thật; vẫn kiểm tra demo không lọt production.
- Hành trình tổng: DB trống → OAuth/setup → hai buổi → mời family → khách/gia đình/thiệp/RSVP → NCC/báo giá/chi phí/lịch trả/quỹ → bàn/menu/xe/phòng → chuẩn bị/timeline → snapshot/bàn giao → check-in/phát sinh → quà/cảm ơn/trả đồ → archive/mở lại → export/backup/restore.
- Lặp tình huống lỗi: API ngắt, hết phiên, thu hồi quyền, gửi đôi, phản hồi bị mất sau commit, version cũ, hai người tranh chỗ/hoàn tiền, upload ghi file hoặc DB thất bại, lỗi giữa batch, restart giữa thao tác.
- Thiết bị: 360/390/768/1440 px, Chromium và WebKit; kiểm tra thủ công Safari iPhone/Chrome Android và luồng OAuth thật. PDF/bản in A4 có dữ liệu dài, nhiều trang và tổng tiền.
- Quy mô theo PLAN §23: 2.000 khách, 5 buổi, 10.000 attendance, 200 bàn, 1.000 khoản chi, 5.000 giao dịch, 2.000 việc, 20 family; thường xuyên 2 người sửa/10 phiên xem. Danh sách phân trang server, không tải toàn bộ chỉ để lọc client.
- Mục tiêu đo theo PLAN: p95 đọc thông thường ≤1 giây, lưu ≤2 giây; luồng chính dùng được khoảng 3 giây trên cấu hình/mạng 4G được ghi rõ. Không biến mục tiêu thành kết quả khi chưa đo.

## 8. Cổng phát hành bắt buộc

- [x] Các route dashboard đã nối dữ liệu thật; không còn `FeaturePreview`, thiệp mẫu hoặc fixture fallback trong luồng dashboard.
- [ ] Mọi tổ hợp thao tác ở ma trận màn hình đã được UAT đầy đủ trên môi trường release; bản in nội dung dài và thiết bị thật có bằng chứng.
- [ ] AT01–AT62 và UXT01–UXT28 có kết quả/bằng chứng; ngoại lệ phải được ghi rõ và giải quyết trước release đầy đủ.
- [ ] Toàn bộ kiểm tra bắt buộc build/TypeScript/unit/integration/live E2E thành công trên commit release; dependency scan tại thời điểm release, không còn vấn đề nghiêm trọng chưa xử lý.
- [ ] Hai owner và family được kiểm tra trên domain HTTPS; OAuth thật, sai email, thu hồi quyền, tệp và export đều đúng; không rò dữ liệu riêng.
- [ ] Không còn lỗi mức chặn/nghiêm trọng/cao về dữ liệu, quyền, chức năng hoặc UX; lỗi còn lại có mức độ, tác động và hướng xử lý rõ.
- [ ] Docker build/run với DB phiên bản triển khai thành công; app non-root, DB role tối thiểu; dữ liệu/ảnh vẫn còn sau restart container/host.
- [ ] Migrate mới/nâng cấp và rollback đã diễn tập; restore backup cả DB/uploads từ đích offsite sang môi trường trống thành công, đối soát tiền/quan hệ/file và vô hiệu credentials cũ.
- [ ] Proxy HTTPS nhận upload tối đa theo đặc tả; cookie, cache theo quyền, giới hạn request, URL/file path và log được kiểm tra.
- [ ] Backup theo lịch, retention, cảnh báo lỗi backup/health/dung lượng và trách nhiệm xử lý đã cấu hình thực; runbook không chỉ là câu lệnh mẫu.
- [ ] Release note, version, commit/image digest, migration version, báo cáo nghiệm thu và danh sách kiểm tra sau deploy được lưu cùng release.

## 9. Hạ tầng cần xác nhận ở giai đoạn triển khai

Các việc lập trình và kiểm định sandbox có thể tiến hành ngay. Trước triển khai thật cần domain/đường dẫn, quyền truy cập server và reverse proxy hiện có, Google OAuth production, hai email owner, đích backup offsite/credentials, lịch backup và đầu mối vận hành. Tái sử dụng cấu hình hiện có nếu đã được xác nhận; không ghi giá trị secret vào tài liệu hoặc commit.

Những thông tin này chỉ chặn R6 hoặc phép thử cần dịch vụ thật, không chặn việc hoàn thiện các module. Không dùng database hiện tại của người dùng làm dữ liệu kiểm thử và không xóa dữ liệu mẫu bằng lệnh hàng loạt khi chưa phân loại/backup.

## 10. Theo dõi tiến độ

Đã thực hiện phần lập trình của R0–R4: thay preview/fixtures, CRUD các menu, chia sẻ, nhập/xuất, snapshot, tài chính và các lớp kiểm soát dữ liệu. Docker production/PostgreSQL 16 đã qua 60 live browser tests, non-root và kiểm DB/uploads sau restart. Người dùng chọn dùng trên máy này; bổ sung launcher local và backup có restore drill. Bằng chứng và giới hạn nghiệm thu R5/R6 được cập nhật ở [biên bản hoàn thiện](COMPLETION_REPORT_2026-11-19.md). Google OAuth tương tác, UAT đầy đủ và offsite vẫn cần nghiệm thu riêng. Các bảng ở mục 3–4 lưu phát hiện ban đầu để truy vết; không còn là mô tả hiện trạng của từng trang.

Mỗi đầu việc khi triển khai cần ghi: mã backlog/module, thay đổi, migration nếu có, test và đường dẫn evidence, phần còn thiếu, trạng thái `todo / in_progress / verified`. Chỉ dùng `verified` khi có bằng chứng theo hợp đồng mục 5; không dùng số lượng tests hoặc nhãn version `1.0.0` làm đại diện cho độ hoàn thiện sản phẩm.
