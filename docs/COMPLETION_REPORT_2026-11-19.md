# Biên bản hoàn thiện các menu — 19/11/2026

Trạng thái: đã triển khai bản production local theo lựa chọn của người dùng, tại **http://localhost:3000**. Không còn trang dashboard bị khóa bằng `FeaturePreview`, thiệp mẫu hoặc fallback báo giá mẫu trong luồng sử dụng thật. Không seed dữ liệu nghiệp vụ. Owner thật hiện có được giữ; người dùng chọn cấu hình owner thứ hai sau, địa chỉ mẫu được thay bằng địa chỉ dự phòng `.invalid` không thể đăng nhập Google. Hướng dẫn bật/tắt/backup: [sử dụng local](LOCAL_USAGE.md). Chưa triển khai trên domain Internet.

## Phạm vi đã triển khai

| Menu / luồng | Chức năng thực tế |
| --- | --- |
| Cài đặt | Sửa thông tin hai người, ngân sách mục tiêu/dự phòng; thêm/sửa/hủy buổi lễ, buổi đại diện, ngày giờ/địa điểm; cảnh báo ảnh hưởng đổi ngày và kiểm phiên bản. |
| Thành viên | Tạo link mời theo email và buổi lễ; nhận lời mời một lần, hết hạn, kiểm đúng email; thu hồi lời mời/quyền/phiên người nhà. |
| Công việc | Sửa/xóa, hạn cố định/tương đối, checklist, phụ thuộc, lý do hoàn thành vượt phụ thuộc; guard chu trình ở PostgreSQL. |
| Lịch | Feed dữ liệu nghiệp vụ và lịch hẹn CRUD; liên kết nguồn; chuyển ngày giờ theo Việt Nam. |
| Nhà cung cấp | So sánh lấy báo giá thật; preview chuyển khoản chi hiện lỗi đúng khi API thất bại, không thay bằng fixtures. Các thao tác directory/detail hiện có được giữ. |
| Tài liệu | Tải nhiều ảnh/PDF, báo kết quả từng tệp; tìm tên, phân trang, đổi tên, lưu trữ/khôi phục; tải tệp được kiểm quyền. |
| Khách | Sửa hồ sơ, lưu trữ/khôi phục, rà soát và gộp trùng; RSVP/xếp bàn dùng dữ liệu thật. |
| Thiệp | Tạo/sửa thiệp chung nhiều người, ghi nhận đã gửi từng thiệp hoặc nhóm được chọn, ngày gửi và audit; giữ nguyên RSVP. |
| Ý tưởng | CRUD, trạng thái, link/màu; tạo và liên kết công việc/khoản chi theo nguồn, chống tạo trùng. |
| Chuẩn bị | CRUD đồ dùng/thuê mượn, hạn trả; nhạc, khoảnh khắc/thứ tự/blacklist; cảnh chụp, đánh dấu thực hiện và bàn giao ekip. |
| Đội hỗ trợ | CRUD nhân sự, nhiều vai trò, liên hệ/dự phòng/nhiệm vụ và chia sẻ; không tự cấp tài khoản. |
| Lưu trú & Xe | CRUD nơi lưu trú/chuyến xe; phân/gỡ khách, phòng, giờ và liên hệ; khóa parent khi phân và chặn vượt sức chứa. |
| Thực đơn | CRUD menu/món, lựa chọn suất/dị ứng theo khách, tổng hợp theo RSVP; chốt số suất với dự phòng; lưu nội dung món và lịch sử bản chốt. |
| Ngân sách & Thanh toán | Sửa danh mục/ngân sách/khoản chi, hủy dịch vụ, lịch trả nhiều đợt, phân bổ trả trước; giữ các luồng chi/hoàn/void và chống ghi trùng. |
| Quỹ | Tạo/hủy đóng góp, cam kết chưa nhận, trả thẳng NCC có payment liên kết; tính tiền quà sau mốc mở sổ, giữ số tiền nguyên chính xác. |
| Quà | Ngày nhận, nhiều người gửi, trả/void/cảm ơn/đối soát; khóa phong bì khi trả và chống tạo trùng khi retry. |
| Lịch trình | CRUD kế hoạch/giờ thực tế/trạng thái; hiện tại/tiếp theo/trễ và trùng người; dời lịch có preview, kiểm phiên bản và chống áp dụng hai lần khi retry. |
| Điểm danh | Trang riêng theo buổi, bật/tắt, tìm kiếm, check-in/undo, khách phát sinh; sửa truy vấn tên theo schema thật, kiểm sức chứa và audit. |
| Bàn giao & Nghiệm thu | Chọn buổi cụ thể; đánh giá từ DB; không báo lưu khi chỉ GET; POST lưu bản chốt kèm bằng chứng kiểm tra; chặn khi thiếu ghế hoặc chưa chốt nhà hàng. Lịch sử/diff/người nhận/bản in dùng snapshot hiện có. |
| Hậu cưới | Checklist từ nghiệp vụ thật, xác nhận nhận media/xuất hồ sơ, CRUD album/video, đóng lưu trữ/mở lại; guard database ngăn đường ghi bỏ sót. |
| Thông báo | Lấy hạn việc thật, đánh dấu đọc/nhắc lại theo tài khoản; nút chuông mở trang thông báo. |
| Nhập / Xuất | CSV/XLSX có ánh xạ cột, stage/kiểm tra/commit/rollback; đọc quoted CSV, giữ số 0 đầu, từ chối công thức XLSX; Excel nhiều sheet/JSON nghiệp vụ, CSV và ICS hiện có. |
| Dùng chung | Chọn buổi nhất quán, lưu scope; bản nháp editor theo tài khoản/bản ghi/phiên bản trong 2 giờ, phục hồi sau reload; thông báo lỗi và đăng nhập lại; đăng xuất và dọn dữ liệu phiên phía client. |

Workspace có nút in dùng dữ liệu đang tải từ API; bộ bàn giao giữ nội dung bản chốt được chọn. Các form cũ ngoài editor dùng chung vẫn giữ cơ chế trạng thái của từng module; không diễn giải việc phục hồi editor thành bảo đảm draft cho mọi form cũ.

## Database, triển khai và CI

- Migration `0006_release_completion.sql`: media, ngày nhận quà, nội dung menu cố định, sửa `locked_by` cho ID Better Auth dạng text, guard lưu trữ và chu trình công việc.
- `pnpm db:migrate`: sổ checksum, khóa migration đồng thời, transaction từng tệp, bao gồm SQL RLS. Từ chối schema cũ không rõ sổ; `--baseline` chỉ dành cho schema 0000–0005 đã được kiểm chứng/backup.
- Compose tách tài khoản bootstrap khỏi app; app `NOSUPERUSER NOBYPASSRLS`, chờ migration thành công. Docker dùng Node 24 và có stage tools cho migration.
- Sửa adapter Better Auth để các thao tác user/account/session/verification dùng context dịch vụ trong transaction. Kiểm bằng app role bị giới hạn: CRUD auth, rollback và dọn context đều pass; ghi anonymous trực tiếp vẫn bị RLS từ chối. Không nâng quyền database của app.
- Cài Docker Desktop trên máy, chạy release với PostgreSQL 16, UID 1001 và named volumes riêng. Bổ sung `pnpm test:containers` và CI job độc lập cho môi trường Docker.
- CI mới chạy TypeScript, unit/integration, build, component browser và harness PostgreSQL thật. Workflow chưa được chạy trên GitHub trong phiên này.
- Dependency production được quét và override `exceljs>uuid` lên 11.1.1; kết quả quét hiện tại không có advisory. Đây là ảnh chụp tại thời điểm kiểm tra, không thay thế cập nhật định kỳ.

## Bằng chứng kiểm chứng

Kiểm chứng ngày 19/11/2026: TypeScript và build production thành công; **1.320 tests / 127 files** unit/integration/adversarial, **296** browser component và **60** live browser tests trên mỗi môi trường native/PostgreSQL 17 và Docker/PostgreSQL 16 đều pass, không skip trong bộ live. Unit/integration có mock; browser component và live E2E được phân biệt rõ.

Live E2E đã kiểm tra ghi–reload–đối chiếu DB, gửi lại cùng khóa không tạo trùng, thiệp theo nhóm giữ RSVP, chốt nhà hàng/nghiệm thu, dời lịch từ preview và chặn preview cũ, trả quà đồng thời, tải nhiều tệp có tệp lỗi, phục hồi draft và đăng xuất. Vòng khôi phục đối soát **56 bảng, 79 khóa ngoại**, giữ nguyên nguồn và từ chối bundle bị sửa.

| Lớp kiểm tra | Bằng chứng |
| --- | --- |
| TypeScript / build production | `audit-completion-types.log`, `audit-completion-build.log` (artifacts local). |
| Unit / integration / adversarial | `audit-completion-unit.log`; quy tắc tiền, version, import, quyền và nghiệp vụ. |
| Browser component | `playwright-report/components/index.html`, `audit-completion-components.log`. |
| Docker release / PostgreSQL 16 | `test-results/containers/verification.json`, `audit-completion-containers.log`: 60 tests pass, app UID 1001, migrate trước app, DB và file giữ nguyên checksum sau restart. |
| Bản local đang sử dụng | `.local-artifacts/runtime/verification.json`: health, redirect trang bảo vệ, trang login không lỗi JavaScript, Google initiation đúng client/callback. Backup PostgreSQL 16 phục hồi riêng và đối chiếu số dòng 56 bảng, giải nén uploads thành công; manifest có checksum. Artifacts/cấu hình/backup đều bị Git bỏ qua. |
| Live ứng dụng + PostgreSQL | `tests/live/completion-journeys.spec.ts`, `tests/live/g11-journeys.spec.ts`; `test-results/g11/verification.json`, `playwright-report/live/index.html`, `audit-completion-live.log`. |
| Migration / RLS / khôi phục | Harness `scripts/verify-g11.ts`: DB mới, chạy lại migration, nâng cấp DB cũ bằng baseline đã kiểm chứng; app role không bypass RLS và không đọc sổ migration; dump/restore DB + uploads, đối soát, vô hiệu credentials cũ, từ chối backup bị sửa. |

Harness tạo cluster tạm riêng, không dùng database hay credentials thật trong `.env`. Session browser được seed vào sandbox, không thay thế Google OAuth thực. Cấu hình bốn viewport: 360, 390, 768 và 1440; Chromium/WebKit.

## Phạm vi nghiệm thu còn lại

Việc lập trình menu và kiểm chứng local không tự hoàn thành các mục sau:

1. Đăng nhập Google tương tác bằng tài khoản thật của hai owner và family. Đã kiểm khởi tạo OAuth với client thật và callback local, chưa hoàn tất consent/đăng nhập hộ người dùng.
2. Nếu chuyển lên Internet: domain HTTPS/reverse proxy; cookie/callback, upload và quyền sau thu hồi trên domain đó. Lựa chọn hiện tại là dùng trên máy này.
3. Backup theo lịch, retention/cảnh báo và restore từ đích offsite thật; xác định người vận hành.
4. UAT đầy đủ AT01–AT62/UXT01–UXT28, Safari/Android thiết bị thật, A4 nội dung dài và đo tải theo quy mô mục tiêu. Các hành trình được tự động hóa không phải bằng chứng mọi tổ hợp đã được nghiệm thu.

Các mục này tiếp tục theo R5/R6 của [kế hoạch hoàn thiện](PRODUCTION_COMPLETION_PLAN.md). Giữ nguyên `.env` gốc; migrations chỉ chạy trong sandbox và database local mới. Không dùng dữ liệu thật làm fixtures và không đưa credentials, uploads hoặc backups lên Git. Mã nguồn được chuẩn bị commit/push theo yêu cầu người dùng; trạng thái Git thực tế thể hiện trong lịch sử repository.
