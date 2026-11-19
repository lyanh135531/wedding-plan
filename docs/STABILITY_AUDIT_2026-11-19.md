# Rà soát độ ổn định — 19/11/2026

## Kết luận và phạm vi

Không có cơ sở để khẳng định toàn bộ dự án không còn lỗi. Đợt này kiểm tra mã nguồn, TypeScript, dependency, build production, unit/integration/adversarial tests, browser component tests, HTTP trên server dev và hành trình có ghi dữ liệu trên PostgreSQL tách biệt.

Các màn hình chưa nối luồng lưu thật được ghi rõ bên dưới. Không coi việc trả HTTP 200 hoặc render component thành công là bằng chứng rằng mọi tính năng đã hoạt động.

## Lỗi đã sửa

| Vấn đề | Thay đổi |
| --- | --- |
| Đăng nhập Google thành công nhưng bị trả về login | Xác minh chữ ký cookie Better Auth, lấy đúng token để kiểm tra database; hỗ trợ cookie có tiền tố `__Secure-`. |
| Timeout database bị hiểu thành chưa đăng nhập | Phân biệt lỗi kho phiên với phiên không hợp lệ; không đưa token từ SQL lỗi vào log. |
| Auth client luôn trỏ về localhost khi không có biến môi trường public | Dùng origin hiện tại của trình duyệt; giữ tùy chọn override URL. Cookie trên URL HTTPS có cờ Secure. |
| OAuth lỗi nhưng không hiện thông báo | Xử lý lỗi khởi tạo đăng nhập và callback; trang login chuyển người đã có phiên sang luồng setup/overview. |
| Setup chỉ chuyển trang, không lưu | API settings và transaction tạo settings, buổi lễ và danh mục đã chọn; khóa tránh khởi tạo trùng, giữ form khi lưu thất bại. Không điền tên mẫu cho người dùng thật. |
| Nhập liệu trước hydration có thể mất ô đầu tiên trên Safari | Chỉ hiển thị form setup sau khi phía trình duyệt sẵn sàng. |
| Modal tự chuyển focus sau khi người dùng đã bắt đầu nhập | Không chạy autofocus trễ nếu focus đã nằm trong modal. |
| Cài đặt chỉ hiện alert thành công | Đọc/ghi database, hiện lỗi và kiểm tra version chống ghi đè. |
| Tổng quan dùng số liệu, tên và lịch mẫu | Trang thật lấy overview/settings từ API; không dùng các con số mẫu của component prototype. |
| Công việc chỉ cập nhật state trong bộ nhớ | Trang thật tạo công việc, đọc hạn và lưu trạng thái qua API, có kiểm tra version; hỗ trợ hạn theo buổi lễ và chia sẻ với người nhà. |
| API công việc cho người nhà nhận sai cấu trúc dữ liệu | Ánh xạ row camelCase sang DTO công khai đúng schema; không trả ghi chú riêng/người phụ trách. Sửa điều kiện lọc sự kiện và tìm kiếm tiêu đề công khai. |
| Chọn phạm vi không cập nhật consumer React | Bổ sung state thay đổi vào dependency của context value. |
| Điều hướng trên Safari có thể phát sinh các yêu cầu prefetch bị hủy và tải nền thừa | Tắt prefetch tự động của sidebar, thanh điều hướng mobile và breadcrumb; giữ điều hướng khi người dùng chọn liên kết. |
| Lịch hẹn dùng dữ liệu mẫu | Trang lịch lấy feed thật, chọn khoảng ngày và tải lịch ICS. |
| Nút CSV chỉ hiện alert | Tải CSV từ API xuất dữ liệu thật; bản in đọc danh sách khách thật, giữ xử lý chống formula injection. |
| Liên kết `/documents`, `/history`, `/fund` trả 404 | Bổ sung trang đọc dữ liệu thật. Tài liệu hỗ trợ tải ảnh/PDF lên; sổ quỹ hỗ trợ lưu mốc mở sổ. |
| Upload/đọc file không đặt ngữ cảnh RLS | Các truy vấn metadata chạy trong transaction có user/role; đã kiểm tra bằng tài khoản PostgreSQL NOSUPERUSER/NOBYPASSRLS. |
| Ghi đè/khởi tạo trùng cấu hình quỹ | Khóa transaction khi cập nhật, kiểm tra version và trả 409 cho yêu cầu cũ. |
| Hạn ngày tính theo UTC | Dùng ngày theo Asia/Ho_Chi_Minh cho lịch/buổi lễ, hết hạn lúc cuối ngày Việt Nam; không chậm bảy giờ. |
| JSON rỗng/HTML lỗi làm API client ném lỗi parser | Hỗ trợ 204 và thông báo lỗi dễ hiểu cho response không phải JSON. |
| Sidebar có thuộc tính đã xóa khỏi type | Xóa hai thuộc tính milestone còn sót; cập nhật kỳ vọng giao diện và thêm kiểm tra mọi liên kết sidebar có trang. |
| Dependency có cảnh báo bảo mật | Nâng Next.js 14.2.15 lên 15.5.29; override PostCSS và esbuild bị ảnh hưởng. Chuyển dynamic params/header API sang dạng async tương thích Next 15. |
| Build kiểm định có thể đụng cache dev và làm máy thiếu tài nguyên | Cho phép `NEXT_DIST_DIR=.next-audit`, bỏ thư mục này khỏi watcher dev, loại các bản sao standalone/dependency khỏi TypeScript. Chạy các bộ browser lớn lần lượt. |

Không đổi secret hoặc xóa phiên đăng nhập, không chạy thử ghi lên database của người dùng. Server dev đã được khởi động lại bằng Next.js mới.

## Phần chưa hoàn thiện

Các trang sau vẫn dùng component prototype, dữ liệu minh họa và thao tác trong state cục bộ; backend tồn tại không đồng nghĩa giao diện đã nối backend:

- `/menus`: thực đơn/suất ăn.
- `/logistics`: lưu trú/xe và phân chỗ.
- `/ideas`: ý tưởng và chuyển thành công việc/khoản chi.
- `/support`: thành viên hỗ trợ.
- `/preparation`: đồ dùng, nhạc, danh sách ảnh.
- `/timeline`: thao tác lịch trình trên giao diện.
- `/after-wedding`: checklist và lưu trữ trên giao diện.
- `/data/import`: chọn, phân tích và ghi tệp từ giao diện.

Các màn hình này được đánh dấu rõ là bản xem trước và khóa tương tác để tránh thông báo đã lưu dù dữ liệu không được ghi. Đây là biện pháp ngăn mất dữ liệu; chưa phải hoàn thiện chức năng. Cần nối API, xử lý lỗi/phiên bản/phân quyền và bổ sung hành trình lưu–tải lại trước khi nghiệm thu từng màn hình.

Chuông thông báo trên header chưa có luồng đọc thông báo. Sổ quỹ mới có đọc nguồn tiền và cấu hình mốc mở sổ; giao diện thêm/hủy từng nguồn đóng góp chưa được triển khai trong đợt này. Việc chọn tài khoản và chấp thuận OAuth trên Google thật chưa được tự động kiểm thử; hành trình ứng dụng dùng phiên cookie có chữ ký trên database sandbox.

## Bằng chứng và chạy lại

| Kiểm tra | Kết quả |
| --- | --- |
| Vitest đầy đủ | 126 files, 1.315 tests pass |
| Hồi quy layout/modal sau thay đổi cuối | 54 tests pass |
| Playwright component | 296 pass |
| Playwright ứng dụng thật + PostgreSQL riêng | 36 pass, bốn viewport, Chromium/WebKit |
| Backup/restore thật và đối chiếu dữ liệu | Pass; 54 bảng, 79 khóa ngoại |
| Production build và TypeScript | Pass |
| HTTP dev smoke | 109 yêu cầu; không có lỗi 404/500 trong các trang/API được kiểm tra |
| `pnpm audit` toàn bộ dependencies | 0 cảnh báo được registry ghi nhận tại thời điểm kiểm tra |

Kết quả live cuối được ghi nhận lúc 07:54 UTC ngày 19/11/2026. Những lỗi được cố ý tạo trong test rollback/retry không được tính là lỗi ứng dụng còn tồn tại; test xác minh xử lý và đối chiếu database sau lỗi đó.

- `audit-vitest.log`: kết quả bộ Vitest đầy đủ; bao gồm các kiểm thử cookie có chữ ký, phiên bị thu hồi/hết hạn, lỗi API và biên ngày theo giờ Việt Nam.
- `audit-build.log`: build production có kiểm tra TypeScript.
- `audit-browser.log`: 296 browser component tests trên bốn viewport. Bộ này dùng HTML render sẵn, không chứng minh persistence.
- `audit-live.log`, `test-results/g11/verification.json`, `test-results/g11/live-results.json`: hành trình browser có hydration và ghi PostgreSQL sandbox, phân quyền, offline, đối chiếu dữ liệu, thanh toán lớn hơn Number.MAX_SAFE_INTEGER, đồng thời/rollback, backup/restore thật.
- `test-results/audit/http-smoke.json`: các trang hiện có, liên kết sidebar và GET API trên server local; cả request owner và request không đăng nhập. HTTP smoke không thay thế kiểm thử mọi trường nhập và mọi tình huống nghiệp vụ.
- `test-results/audit/dependencies.json`: kết quả `pnpm audit` sau sửa, gồm dependency phát triển.

```powershell
pnpm test
pnpm exec tsc --noEmit --incremental false
pnpm exec playwright test --workers=4
$env:NEXT_DIST_DIR='.next-audit'
pnpm build
pnpm test:live
Remove-Item Env:NEXT_DIST_DIR
# Chỉ đọc; cần pnpm dev đang chạy và có một phiên owner đang hiệu lực:
pnpm exec tsx scripts/audit-local.ts
pnpm audit
```

`test:live` tự tạo cluster và database tạm; không dùng DATABASE_URL của người dùng. PostgreSQL binaries và browser Playwright phải có sẵn. Artifacts kiểm định nằm trong thư mục bị gitignore và không chứa giá trị cookie/token đăng nhập trong báo cáo HTTP.
