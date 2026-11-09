# Review PLAN.md — 04/11/2026

Đối tượng: bản 1.1. Kết quả sửa: bản 1.2. Đây là review tài liệu và đối chiếu thiết kế, không phải kiểm thử ứng dụng, kiểm tra server hay kết luận an toàn cho một hệ thống đã triển khai.

Ghi chú phiên bản: báo cáo này giữ nguyên kết quả review 1.1 → 1.2. PLAN hiện đã lên 1.3 với [đặc tả UI/UX](UI_UX_SPEC.md); ước lượng hiện tại là 37–59 ngày, R1 23–37 ngày, giữ 62 ca AT và bổ sung 28 ca UXT. Các số 35–56/21–34 bên dưới là lịch sử của bản 1.2, không phải lịch hiện hành.

## Kết luận

Hướng sản phẩm và lựa chọn self-host phù hợp với yêu cầu đã xác nhận. Bản 1.1 còn thiếu quy tắc làm thay đổi tiền, quyền và dữ liệu đã bàn giao; chưa nên coi là đặc tả cuối để code toàn bộ. Các phát hiện dưới đây đã được xử lý trong bản 1.2.

Sau sửa, có thể bắt đầu G0/G1 và triển khai theo mốc. Dictionary trường, hợp đồng thao tác và prototype vẫn là đầu ra bắt buộc của G0/G1; chưa có các đầu ra đó thì không gọi schema/giao diện đã chốt. Không phát sinh kết nối hoặc thay đổi server từ lần review này.

## Phát hiện và xử lý

| Mã | Mức ảnh hưởng | Lỗ hổng ở bản 1.1 | Cách sửa trong bản 1.2 | Nghiệm thu liên quan |
| --- | --- | --- | --- | --- |
| RV01 | Cao | Quỹ có số dư ban đầu nhưng không có thời điểm mở sổ. Nhập lại khoản cọc cũ có thể bị trừ thêm lần nữa. | Mục 9.2 thêm `opening_as_of`; chi phí tính toàn lịch sử, quỹ chỉ lấy giao dịch từ mốc. Có ví dụ 90 triệu giữ nguyên khi thêm khoản cọc trước mốc. | AT45. |
| RV02 | Cao | Bắt buộc phân bổ hết vào lịch trả nhưng lại cho đặt cọc khi chưa có lịch. | Mục 9.3 thêm phần trả trước/chưa phân đợt; chuyển phân bổ không tạo giao dịch mới. | AT46. |
| RV03 | Cao | Chưa định nghĩa chi phí cuối khi hủy dịch vụ, mất cọc hoặc nhận hoàn do giảm giá. Giữ giá cũ có thể tạo khoản nợ không có thật. | Mục 9.5 tách trạng thái hủy, nghĩa vụ cuối và dòng tiền; giữ giá trị 0 hợp lệ, không tính phí hủy hai lần. | AT47–AT48. |
| RV04 | Cao | Có lời mời nhưng không có quy trình tạo chủ sở hữu đầu tiên; chưa có phục hồi khi mất tài khoản. Không rõ gửi lời mời bằng cách nào khi không dùng email service. | Mục 5.3 seed đúng hai email đã xác nhận, không có first-user-admin; chủ tự gửi link mời, có token một lần; có bàn giao và khôi phục qua server mà vẫn cần Google xác thực. | AT49–AT50; luồng khôi phục cần diễn tập G6. |
| RV05 | Cao | Cờ chia sẻ và RLS dễ bị hiểu là đã che được mọi trường riêng; view và connection pool còn đường thực hiện sai. | Mục 5.4/21.2 tách nội dung vận hành, deny khi thiếu context, DTO chọn cột, view chạy quyền invoker, test pool; role backup tách khỏi role người dùng. | AT57, AT59 và AT03/AT36. |
| RV06 | Cao | Bản in lấy dữ liệu hiện tại, không có danh sách đã chốt với nhà hàng; sửa sau chốt dễ làm mọi người dùng các số khác nhau. | Mục 13.3 thêm snapshot bất biến theo phiên bản và cảnh báo thay đổi chưa bàn giao lại; số đặt/chốt không tự đổi. | AT52, AT61. |
| RV07 | Cao | Backup có nói read-only nhưng chưa đủ ranh giới ghi/job/auth; chưa xử lý hồi sinh session/quyền cũ khi restore. | Mục 22.1 thêm rào ghi nghiệp vụ, lease/deadline, staging nhất quán cả file còn trong thời gian khôi phục, không khóa suốt truyền backup; sau restore vô hiệu phiên/lời mời và xác nhận lại quyền xem. | AT55–AT56, AT32/AT43. |
| RV08 | Vừa | Tổng dự báo có thể bị hiểu là đầy đủ khi còn khoản thiếu giá; quà nhận ròng chưa có dữ liệu trả lại tương ứng. | Mục 9.6 gắn nhãn tổng tạm tính, không kết luận dư; mục 16 và schema thêm `gift_returns`, áp dụng mốc quỹ. | AT51, AT53. |
| RV09 | Vừa | Chống nhấn lặp mới là yêu cầu chung; chưa có quy tắc cùng key khác payload hoặc replay khi đã mất quyền. | Mục 20.2 thêm record chống trùng với hash payload, kiểm tra quyền trước replay, khóa nghiệp vụ lâu dài. | AT54, AT13/AT28. |
| RV10 | Vừa | Hứa giữ form qua hết phiên nhưng bản nháp chỉ được mô tả trong bộ nhớ; OAuth redirect có thể mất bản nháp. | Mục 4.2 nêu sessionStorage theo tài khoản/tab, TTL, kiểm tra version; logout xóa và không phục hồi sang người khác. | AT60. |
| RV11 | Vừa | Giới hạn upload đồng thời có thể chỉ áp dụng ở UI; hàng đợi RAM chết khi restart; import 5 MB không giới hạn dữ liệu sau giải nén. | Mục 17.1 thêm request riêng, limit cụ thể, slot/lease toàn server; mục 19.2 thêm trần giải nén/ô/thời gian và từ chối ô công thức. | AT39/AT42/AT44; G6 kiểm tra tệp nhập vượt giới hạn. |
| RV12 | Vừa | Đội hỗ trợ bị ghi P2 nhưng lại có trong R2; R1 cần menu/nhà cung cấp trong khi module đầy đủ ở R2. | Mục 14 đưa hồ sơ đội về P1; mục 20.3 chốt dữ liệu danh mục/đầu mối tối thiểu R1; R2 thêm module đầy đủ, không dựng màn hình rỗng. | AT58. |
| RV13 | Vừa | Ngày chính trong settings và ngày buổi có thể lệch. Khách phát sinh khi điểm danh chưa có quy tắc. | Mục 6.2 dùng buổi đại diện làm nguồn duy nhất; mục 14.3 thêm luồng phát sinh có hồ sơ/audit và kiểm tra sức chứa. | AT61–AT62. |
| RV14 | Vừa | Có nhiều tên bảng nhưng chưa có dictionary trường/hợp đồng thao tác; câu về adapter Sheet dễ bị hiểu adapter đã tồn tại. Ước lượng chưa phản ánh các luồng bổ sung. | Mục 19.2 sửa rõ adapter chưa triển khai; mục 20.3/24 bắt buộc dictionary/prototype trước code từng mốc; điều chỉnh ước lượng. | Cổng nghiệm thu G0/G1 và bảng giai đoạn mục 24. |

## Các giới hạn chủ động giữ lại

- Người nhà chỉ xem, không được điểm danh hay sửa. Hai chủ sở hữu tự cập nhật hoặc dùng bản bàn giao. Muốn giao người khác nhập liệu phải đổi phạm vi quyền rõ ràng.
- Đăng nhập Google-only; Google gián đoạn thì dùng tài liệu đã xuất. Không thêm một đường bỏ qua xác thực vì tiện.
- Ảnh JPEG/PNG/WebP và PDF; HEIC/RAW/video chưa hỗ trợ. Đã có thông báo cụ thể để không hứa upload mọi định dạng điện thoại.
- Không chỉnh sửa offline, không đồng bộ Sheet, không gửi email/Zalo/SMS tự động.
- Không xây hệ thống kế toán vay/nợ cá nhân. Khoản ứng hộ cần hoàn phải được ghi nhận là nghĩa vụ chưa đối chiếu, không giả thành góp tiền.
- Bản đầu không có realtime kiểu Google Docs. Có version, phát hiện xung đột, tải lại khi focus và kiểm tra thay đổi định kỳ.
- Không yêu cầu thêm số liệu RAM/ổ đĩa để tiếp tục plan, theo yêu cầu của bạn. Mount, quyền ghi và backup vẫn là kiểm tra vận hành khi deploy.

## Những việc còn phải hoàn thành trước khi code/phát hành

| Mốc | Đầu ra/điều kiện cần có |
| --- | --- |
| G0 | Dictionary trường/enum/null/default, quan hệ và ràng buộc R1; danh sách command/query; kết quả mong đợi cho ví dụ tiền/khách/quyền. |
| G1 | Prototype 6 màn hình cốt lõi với trạng thái rỗng/lỗi/xung đột trên mobile và desktop; chốt cách hiển thị chỉ số và phạm vi chia sẻ. |
| Trước G2 deploy | Chọn hostname cụ thể, hai email, Google OAuth callback, đường dẫn dữ liệu và cách đi qua proxy hiện có. |
| Trước R1 dùng thật | Đích backup ngoài server và lần restore thành công; đăng nhập/cấp quyền/khôi phục chạy thật; bản production trống. |
| Trước R2/R3 | Dictionary/hợp đồng phần mở rộng và test tương ứng; không thay đổi ngầm quy tắc R1. |

Đây là các cổng đã lên kế hoạch, không phải câu hỏi bắt buộc người dùng phải trả lời hết ngay. Số lượng ca nghiệm thu là danh sách phải kiểm chứng, không phải số test đã chạy.

## Kiểm tra tính nhất quán sau sửa

- 27 phần chính, số thứ tự liên tục; mã nghiệm thu AT01–AT62 không trùng.
- Giai đoạn G0–G11 cộng thành 35–56 ngày; G0–G6 của R1 là 21–34 ngày; 6 giờ/ngày cho tổng 210–336 giờ.
- Chưa có code, tài khoản dịch vụ hoặc triển khai thật; chỉ các file kế hoạch/review được sửa.
- Không coi review này là chứng minh tuyệt đối không còn thiếu sót. Các cổng G0/G1 và test ở từng mốc là nơi tiếp tục kiểm chứng thiết kế.
