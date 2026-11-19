# Sử dụng trên máy này

Mở **http://localhost:3000** bằng trình duyệt trên máy đã cài dự án. Đăng nhập Google bằng một trong hai email owner đã cấu hình, sau đó hoàn tất thiết lập đám cưới. Không nạp khách, ngân sách hoặc sự kiện mẫu. Các menu hiển thị dữ liệu bạn nhập.

Docker Desktop phải đang chạy. Từ thư mục dự án:

```powershell
pnpm local:start
pnpm local:status
pnpm local:backup
pnpm local:stop
```

`start` build image production, chạy migrations và tạo/cập nhật hai owner; chạy lại an toàn với dữ liệu hiện có. `stop` giữ nguyên database và uploads. Containers tự khởi động lại khi Docker Engine hoạt động trở lại. Địa chỉ chỉ mở trên loopback của máy này, chưa dành cho truy cập từ điện thoại hoặc Internet.

Lần đầu, launcher đọc Google OAuth và hai email từ `.env`, tạo mật khẩu database và auth secret ngẫu nhiên rồi lưu riêng tại `.local-artifacts/runtime/compose.env`. File `.env` gốc được giữ nguyên. Cấu hình runtime không tự đồng bộ khi sửa `.env`; nếu thay credentials, cập nhật file runtime riêng rồi chạy lại `local:start`. Không gửi file này lên Git hoặc chia sẻ qua chat.

Owner thứ hai được người dùng để cấu hình sau. Các email Gmail mẫu của template cũ được thay bằng địa chỉ dự phòng `.invalid` không thể đăng nhập Google. Khi cần, sửa `OWNER_EMAIL_2` trong file runtime thành email thật rồi chạy `pnpm local:start`; không cần tạo lại database. Launcher chỉ dọn identity mẫu cũ chưa từng có account hoặc session, không xóa tài khoản đã sử dụng.

Database nằm trong volume `wedding-local-postgres`, tệp tải lên trong `wedding-local-uploads`. Không dùng `docker volume rm`, `docker system prune --volumes` hoặc `compose down --volumes` với các volume này. Giữ file cấu hình runtime cùng bản sao lưu ở nơi riêng tư; không xóa hoặc tạo lại mật khẩu khi muốn tiếp tục dùng database hiện tại.

Google OAuth phải cho phép callback **http://localhost:3000/api/auth/callback/google** trong OAuth client đã cấu hình. Nếu Google báo `redirect_uri_mismatch`, thêm đúng callback này tại Google Cloud Console. Lần đăng nhập tương tác bằng tài khoản Google thật cần người sở hữu tài khoản thực hiện; kiểm thử tự động không đăng nhập hộ.

`pnpm local:backup` tạm dừng app để giữ database và uploads đồng nhất, dùng `pg_dump` cùng phiên bản server, đóng gói uploads, phục hồi dump sang database tạm riêng và so số dòng từng bảng. Archive uploads được giải nén thử; manifest lưu SHA-256 của cả hai file. App được bật lại khi kết thúc, kể cả khi kiểm tra thất bại. Chỉ dùng bundle có `manifest.json` hoàn tất. Kết quả nằm tại `.local-artifacts/runtime/backups/<timestamp>/`; database tạm được xóa sau drill, database nguồn được giữ nguyên.

Đây là backup tại máy, chưa có lịch tự động, retention hay bản sao offsite. Chạy backup trước nâng cấp và sau những lần nhập liệu quan trọng; sao chép bundle hoàn tất sang nơi lưu an toàn khác. Quy trình khôi phục đầy đủ và thu hồi credentials cũ nằm trong [hướng dẫn DR](DISASTER_RECOVERY.md).

Kiểm định release Docker độc lập với dữ liệu đang dùng:

```powershell
pnpm test:containers
```

Harness dùng cổng ngẫu nhiên, fake OAuth và volumes tạm riêng, không sử dụng cấu hình runtime hoặc `.env` thật. Chỉ volumes của harness bị dọn sau kiểm tra.
