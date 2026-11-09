# Kế hoạch và đặc tả web quản lý đám cưới cá nhân

Phiên bản: 1.3 — ngày 04/11/2026. Trạng thái: đủ để bắt đầu G0/G1, chưa phải bằng chứng ứng dụng đã được triển khai hoặc kiểm thử. Cập nhật 1.3: bổ sung đặc tả UI/UX đầy đủ tại [docs/UI_UX_SPEC.md](docs/UI_UX_SPEC.md), điều hướng mobile, bộ thành phần, bố cục màn hình, luồng thao tác và nghiệm thu UX. Review nghiệp vụ bản 1.1 → 1.2 được giữ tại [docs/PLAN_REVIEW.md](docs/PLAN_REVIEW.md).

Tài liệu này mô tả sản phẩm, dữ liệu, hành vi, giới hạn, thứ tự xây dựng và điều kiện nghiệm thu. Những con số về hiệu năng và quy mô bên dưới là mục tiêu thiết kế và kiểm thử, không phải kết quả đo của một ứng dụng đã có.

## 1. Các quyết định đã xác nhận

| Nội dung | Quyết định |
| --- | --- |
| Mục đích | Dùng riêng cho đám cưới của bạn, không kinh doanh dịch vụ cho nhiều cặp đôi. |
| Thời gian | Dự kiến sau Tết âm lịch 2028. Chưa có ngày dương lịch cụ thể. |
| Người chỉnh sửa | Hai vợ chồng cùng quản lý. |
| Người nhà | Chỉ xem phần thông tin được chia sẻ, không chỉnh sửa. |
| Xác nhận khách tham dự | Hai vợ chồng tự liên hệ rồi cập nhật trong web. |
| Link cho khách tự xác nhận | Không xây trong phạm vi này. |
| Dữ liệu trong Google Sheets | Toàn bộ là dữ liệu mẫu, chỉ tham khảo cấu trúc và chức năng. |
| Dữ liệu khi bắt đầu dùng thật | Trống. Không nhập khách, chi phí, quà hay giao dịch mẫu vào dữ liệu thật. |
| Cách làm hiện tại | Lên kế hoạch chi tiết trước, chưa tạo ứng dụng, tài khoản dịch vụ hay chi phí vận hành. |
| Hạ tầng | Bạn có server Linux, Docker và tên miền HTTPS. Dùng hạ tầng này cho ứng dụng, PostgreSQL và ảnh/tệp. |
| Thông số máy | Bạn xác nhận không cần quan tâm RAM/ổ đĩa trong bước chốt plan; không yêu cầu cung cấp thêm cấu hình máy để tiếp tục thiết kế. |

### 1.1. Những mặc định được đề xuất

Đây là các quyết định thiết kế có thể thực hiện ngay nếu bạn không thay đổi. Chúng không phải thông tin thực tế về đám cưới.

| Mã | Mặc định |
| --- | --- |
| D01 | Tiếng Việt, tiền VND, múi giờ `Asia/Ho_Chi_Minh`, tuần bắt đầu thứ Hai. |
| D02 | Một đám cưới có thể gồm nhiều buổi: ăn hỏi, gia tiên, tiệc cưới, buổi khác. Không tự tạo các buổi khi chưa được chọn. |
| D03 | Hai tài khoản chủ sở hữu có quyền ngang nhau. Không yêu cầu người còn lại duyệt mỗi thay đổi. |
| D04 | Người nhà chỉ thấy bản vận hành: ngày/địa điểm đã công bố, lịch trình, công việc được chia sẻ, khách và bàn ở các buổi được cấp quyền. |
| D05 | Chi phí, quà mừng, nguồn tiền, hợp đồng, ghi chú riêng, số điện thoại và địa chỉ khách không xuất hiện trong bản xem của người nhà. |
| D06 | Đăng nhập Google; chỉ tài khoản được mời mới vào được. Không có đăng ký công khai. |
| D07 | Không có trang đám cưới công khai, không nhắn tin hàng loạt, không tự gửi thiệp. |
| D08 | Dữ liệu dùng thật lưu trực tuyến. Demo nằm ở môi trường riêng, không dùng chung cơ sở dữ liệu với bản thật. |
| D09 | Nhắc việc trong ứng dụng. Không phụ thuộc email, SMS, Zalo hay thông báo đẩy để vận hành. |
| D10 | Hỗ trợ bản in và gói tài liệu để dùng khi mạng yếu. Bản đầu không hỗ trợ chỉnh sửa ngoại tuyến. |
| D11 | Không đồng bộ hai chiều với Google Sheets. Web là nơi lưu dữ liệu chính khi chuyển sang dùng thật. |
| D12 | Không dùng AI để tự quyết định khách, ngân sách, ngày cưới, nhà cung cấp hoặc xếp bàn. |
| D13 | Dùng Docker Compose trên server hiện có. Dùng reverse proxy/HTTPS đã có, không thay hoặc chiếm cấu hình các website đang chạy. |
| D14 | Ảnh và tài liệu nằm ở thư mục bền vững trên server, ngoài web root; metadata/quyền/liên kết nằm trong PostgreSQL. |

### 1.2. Thông tin thực tế chưa có và cách xử lý

| Chưa có | Hành vi khi chưa có | Khi cần bổ sung |
| --- | --- | --- |
| Ngày cưới cụ thể | Hiển thị nguyên văn “Dự kiến sau Tết âm lịch 2028”; không đếm ngược. | Trước khi tạo hạn tính lùi và chốt nhà cung cấp. |
| Số lượng khách | Không gán số giả. Thiết kế thử với tối đa 2.000 người. | Khi bắt đầu lập danh sách. |
| Số buổi, địa điểm | Có thao tác thêm buổi; chưa có thì hiển thị màn hình thiết lập. | Trước khi gán khách, bàn và lịch trình theo buổi. |
| Ngân sách | Để trống, không mặc định bằng 0. Vẫn nhập được khoản dự kiến. | Trước khi đánh giá vượt ngân sách. |
| Email hai chủ sở hữu | Cấu hình lúc triển khai, không hardcode trong mã nguồn. | Trước khi bật bản thật. |
| Người nhà và phạm vi xem | Chưa có ai được cấp quyền. | Khi chủ sở hữu mời từng người. |
| Phong cách giao diện | Token màu, font, kích thước và bố cục đã có mặc định cụ thể trong UI_UX_SPEC; prototype sẽ dựng theo đó, thay đổi cập nhật lại token. | Kiểm chứng trên prototype G1, không tự coi tài liệu là giao diện đã duyệt. |
| Hostname/path cụ thể và nơi backup | Bạn đã có tên miền HTTPS; chốt subdomain hoặc đường dẫn ứng dụng cùng đích backup ngoài server, không cần mua hosting managed. | Trước khi phát hành. |

Không tự quy đổi “sau Tết âm lịch 2028” thành một ngày cưới. Nếu sau này hiển thị ngày âm, ngày dương được bạn xác nhận vẫn là nguồn chính cho lịch và nhắc việc.

## 2. Đối chiếu với Google Sheets

Nguồn tham khảo: [Google Sheets bạn cung cấp](https://docs.google.com/spreadsheets/d/1IF4mtUtSMUo9kPCDnSwMCgFrQerA_Zei494tjqMRUKY/edit?gid=567689348).

Đã đọc cấu trúc bản xuất XLSX và xác nhận có 5 worksheet: `Cài đặt`, `Dashboard`, `Ngân sách`, `Lịch`, `Danh sách khách mời`. Đây là kết quả kiểm tra bản xuất tại thời điểm lập tài liệu, không phải khẳng định rằng mọi chức năng của mẫu gốc đã được kiểm tra đầy đủ.

| Nguồn đã xác minh | Nội dung giữ lại | Điều chỉnh trên web |
| --- | --- | --- |
| `Cài đặt`, phần thông tin cơ bản và danh mục | Tên hai người, ngày cưới, nhóm khách, lưu trú, món ăn, yêu cầu ăn uống. | Biểu mẫu thiết lập, danh mục có thể sửa, hỗ trợ ngày chưa chốt. |
| `Dashboard` | Tóm tắt chi phí, thanh toán, số khách, công việc sắp tới. | Mỗi chỉ số dẫn đến danh sách chi tiết đúng bộ lọc; không che dữ liệu thiếu bằng số 0. |
| `Ngân sách`, hàng 35 và hàng 80 | Nhóm chi phí, dự kiến, thực tế, đã trả, còn nợ, hạn trả, ghi chú. | Tách khoản chi, lịch thanh toán và giao dịch để hỗ trợ nhiều đợt, hoàn tiền, chia người trả. |
| `Lịch` | Lịch tháng, ngày quan trọng, lọc việc và hạn thanh toán. | Có chế độ danh sách trên điện thoại; sự kiện được liên kết tới bản ghi gốc. |
| `Danh sách khách mời`, hàng 21 | Tên, nhóm, giữ lịch, thiệp, tham dự, lưu trú, món, ăn kiêng, liên hệ, địa chỉ, quà, cảm ơn. | Tách người, nhóm nhận thiệp và tham dự từng buổi. Quà mừng chuyển sang sổ riêng để tránh ghi đôi. |

Menu mẫu còn liệt kê công việc, so sánh nhà cung cấp, so sánh địa điểm, sơ đồ chỗ ngồi, thực đơn, lịch trình ngày cưới, nhạc, phù dâu/phù rể, liên hệ, đồ cần chuẩn bị, chụp ảnh và bảng ý tưởng. Chưa xác minh được các worksheet tương ứng trong bản xuất; các phần này bên dưới là đặc tả mới, không phải tuyên bố sao chép chính xác chức năng đã đọc.

### 2.1. Hạn chế của bản xuất

- Có công thức bị chuyển thành `__xludf.DUMMYFUNCTION`; không dùng kết quả lưu sẵn làm bằng chứng công thức tính đúng.
- Có validation khách mời và công thức lịch tham chiếu `#REF!` trong bản xuất. Chưa đủ bằng chứng kết luận Google Sheet đang mở trên Google cũng lỗi giống vậy.
- `DAYSLEFT`, `SPACEINDAYS`, `CALCONTENT` và các tên khác có định nghĩa dạng LAMBDA trong workbook. Chúng là logic có thể đọc lại và viết lại, không mặc định là Apps Script.
- Không nhập công thức vào web để chạy. Chỉ dùng dữ liệu nhập đã kiểm tra và các quy tắc nghiệp vụ trong tài liệu này.
- Không cố duy trì các giới hạn vùng cố định như 1.000 hàng khách hoặc 500 dòng chi phí của mẫu.

## 3. Mục tiêu và phạm vi phát hành

### 3.1. Khi hoàn thành, ứng dụng phải trả lời được

1. Tuần này hai người cần làm gì và ai phụ trách?
2. Tổng dự kiến chi bao nhiêu, đã chốt bao nhiêu, đã trả bao nhiêu và còn phải chuẩn bị bao nhiêu tiền?
3. Khách nào đã được mời, đã xác nhận, chưa rõ, cần liên hệ lại?
4. Với từng buổi, có bao nhiêu người, bao nhiêu ghế và bao nhiêu suất ăn?
5. Khách ngồi bàn nào, bàn nào còn chỗ, có ai bị xếp trùng hoặc thiếu chỗ?
6. Trong ngày cưới, việc gì xảy ra tiếp theo, ai phụ trách và gọi ai khi phát sinh?
7. Sau cưới, còn thanh toán, hoàn đồ, nhận ảnh và cảm ơn những ai?

### 3.2. Ba mốc sản phẩm

| Mốc | Bao gồm | Điều kiện sử dụng |
| --- | --- | --- |
| R1 — Quản lý hằng ngày | Đăng nhập, thiết lập, khách mời, ngân sách, lịch thanh toán, nguồn tiền, công việc, lịch, tổng quan, quyền xem, upload chứng từ, nhập/xuất cơ bản, sao lưu và nhật ký. | Đủ điều kiện thay Sheet cho những chức năng cốt lõi, sau khi kiểm thử và diễn tập khôi phục đạt. |
| R2 — Chuẩn bị đầy đủ | Nhà cung cấp/địa điểm, xếp bàn, thực đơn, lưu trú/di chuyển, tài liệu, ý tưởng, nhạc, chụp ảnh, đồ dùng, đội hỗ trợ. | Bao phủ các nhóm chức năng được liệt kê trong menu mẫu bằng thiết kế mới. |
| R3 — Vận hành và sau cưới | Lịch trình ngày cưới, điểm danh tùy chọn, bộ tài liệu bàn giao, quà mừng, cảm ơn, hậu kiểm và lưu trữ. | Hoàn tất phạm vi trong tài liệu; không coi R1 là bản đầy đủ cuối cùng. |

Mức ưu tiên: P0 = phải có trong R1; P1 = phải có trong R2; P2 = phải có trong R3. “Tùy chọn” là chức năng có thể bật/tắt theo nhu cầu; nếu nằm trong R2/R3 vẫn phải hoàn thành trước khi gọi mốc đó là xong.

### 3.3. Ngoài phạm vi

Không xây nền tảng cho nhiều đám cưới, thu phí thuê bao, marketplace nhà cung cấp, thanh toán trực tuyến, kết nối ngân hàng, ứng dụng iOS/Android riêng, trang thiệp công khai, khách tự RSVP, tự động gửi Zalo/SMS, đồng bộ Google Calendar hai chiều, chỉnh sửa offline, sơ đồ không gian 3D, AI xếp bàn hay lịch âm chọn ngày tốt. Có thể xem xét riêng sau này; chúng không phải phần thiếu của các mốc đã định nghĩa.

## 4. Tổ chức màn hình và điều hướng

### 4.1. Điều hướng

Máy tính dùng thanh bên với 5 nhóm; các phần chỉ xuất hiện khi đã có ở mốc phát hành tương ứng.

| Nhóm | Màn hình |
| --- | --- |
| Tổng quan | Trang chủ, thông báo, nhật ký gần đây. |
| Chuẩn bị | Công việc, lịch, nhà cung cấp/địa điểm, tài liệu, ý tưởng. |
| Khách & tiệc | Khách mời, thiệp, xếp bàn, thực đơn, lưu trú/di chuyển. |
| Tài chính | Ngân sách, thanh toán, nguồn tiền, quà mừng. |
| Ngày cưới & cài đặt | Lịch trình, đội hỗ trợ, đồ dùng, nhạc/chụp ảnh, thiết lập, chia sẻ, nhập/xuất. |

Điện thoại của chủ sở hữu có thanh dưới: `Tổng quan`, `Khách`, `Ngân sách`, `Công việc`, `Menu`. `Menu` chứa các phần còn lại, không phải nút thêm bản ghi. Người nhà có `Tổng quan`, `Khách`, `Lịch trình`, `Menu`; mục Lịch trình chỉ xuất hiện khi module R3 đã phát hành và có nội dung được chia sẻ. Nút Thêm nhanh ở Tổng quan và nút thêm cụ thể ở từng trang; người xem không thấy nút tạo/sửa. Thanh tab ẩn khi mở form toàn màn hình để không đè lên nút Lưu/bàn phím.

### 4.2. Quy ước giao diện dùng chung

- Ngôn ngữ hiển thị hoàn toàn tiếng Việt; mã kỹ thuật không xuất hiện trong luồng người dùng.
- Màn hình 360 px trở lên không cuộn ngang toàn trang. Bảng lớn trên máy tính chuyển thành danh sách/thẻ trên điện thoại.
- Nội dung chính: tiêu đề, hành động chính, chỉ số liên quan, bộ lọc, danh sách. Không đặt quá nhiều biểu đồ trước dữ liệu cần xử lý.
- Mỗi trang có trạng thái đang tải, chưa có dữ liệu, không có kết quả lọc, lỗi tải, không có quyền và mất mạng.
- Khi dữ liệu thiếu, ghi rõ “Chưa nhập”, “Chưa chốt”, “Chưa có hạn”; không biến thành 0.
- Bộ lọc nằm trong URL, giữ khi mở chi tiết rồi quay lại. Đổi buổi đang xem cập nhật toàn bộ số liệu của trang.
- Các biểu mẫu có nút `Lưu`; không ghi lên máy chủ khi người dùng mới gõ một ký tự. Sau khi lưu, hiển thị giờ lưu đã được máy chủ xác nhận.
- Ghi chú dài chỉ lưu bản nháp tạm trong bộ nhớ phiên. Khi rời trang có thay đổi chưa lưu, cảnh báo; đăng xuất xóa bản nháp.
- Bản nháp form chưa lưu dùng `sessionStorage` theo tài khoản + tab + bản ghi, TTL tối đa 2 giờ, để sống qua chuyển hướng OAuth trong cùng tab. Chỉ phục hồi khi đăng nhập lại đúng tài khoản và phiên bản bản ghi còn phù hợp; có xung đột thì xem trước, không tự ghi. Không lưu token hoặc cache toàn bộ danh sách khách. Đăng xuất chủ động xóa bản nháp; tài khoản khác không được nhìn thấy nội dung bản nháp cũ. Không hứa khôi phục nếu đã đóng/xóa phiên trình duyệt.
- Lỗi kiểm tra nằm cạnh trường tương ứng và có tóm tắt đầu form. Dữ liệu đã nhập còn nguyên sau lỗi mạng.
- Thao tác xóa/ghi hàng loạt có màn hình xem trước số bản ghi và hậu quả. Có thể lưu trữ/khôi phục thay vì xóa ngay.
- Tiền: `12.500.000 ₫`; ngày: `dd/mm/yyyy`; giờ: 24 giờ. Số điện thoại lưu dạng chuỗi để giữ số 0 đầu.
- Phím Tab thao tác được toàn bộ form; nhãn rõ ràng; không dùng màu làm dấu hiệu duy nhất; nút chạm tối thiểu 44×44 px.
- Mặc định phong cách gọn, tương phản đủ đọc ngoài sảnh tiệc. Không dùng nền ảnh hoặc hiệu ứng làm chậm thao tác.

### 4.3. Màn hình bắt đầu

Lần đầu: đăng nhập → nhập tên hai người → nhập thời gian dự kiến hoặc ngày chính thức → chọn có thêm buổi lễ ngay không → chọn danh mục/checklist gợi ý → vào tổng quan.

Có thể bỏ qua ngân sách, ngày cụ thể và danh sách khách. Bước bị bỏ qua xuất hiện trong mục “Cần thiết lập”, không chặn toàn bộ ứng dụng. Không tự tạo dữ liệu mẫu để làm dashboard trông đầy hơn.

### 4.4. Đặc tả UI/UX bắt buộc khi triển khai

[UI_UX_SPEC.md](docs/UI_UX_SPEC.md) là phần của kế hoạch này, không phải tài liệu tham khảo tùy chọn. Nó cụ thể hóa:

- Bộ token màu, font, khoảng cách, breakpoint, kích thước điều khiển và nguyên tắc responsive.
- 35 màn hình S01–S35, path, mốc phát hành và quyền/hành động chính; sáu màn hình chính có wireframe bằng chữ, thứ tự khối, cột/trường và hành vi desktop/mobile.
- Các màn còn lại có trường, hành động, xác nhận, trạng thái và cách xử lý theo module; không coi một sơ đồ màn hình là đã chốt toàn bộ UX.
- Hợp đồng tương tác của component, biểu mẫu, bộ lọc, phân trang, chọn nhiều, ảnh, dialog, lỗi và chỉ đọc.
- 20 luồng FL01–FL20; 28 kịch bản UXT01–UXT28 bổ sung AT01–AT62; quy trình thử với người dùng và mức lỗi chặn phát hành.
- Gói đầu ra prototype HTML bấm được, dữ liệu fixture giả, component gallery, desktop/mobile và state phải có trước khi nhân rộng giao diện.

Các giá trị là mặc định để làm, không còn chừa câu “tùy thiết kế” ở các quyết định đã nêu. Prototype và kiểm thử với người dùng chưa được thực hiện; hoàn tất đặc tả không đồng nghĩa đã chứng minh UX tốt. Khi có xung đột, PLAN sở hữu nghiệp vụ/quyền/tính toán, UI_UX_SPEC sở hữu biểu diễn và tương tác; phải sửa tài liệu liên quan trước khi triển khai khác.

## 5. Tài khoản, chia sẻ và riêng tư — P0

### 5.1. Ma trận quyền

| Hành động/dữ liệu | Chủ sở hữu | Người nhà chỉ xem |
| --- | --- | --- |
| Xem và sửa thông tin cưới | Có | Chỉ xem thông tin đã công bố. |
| Khách và bàn theo buổi | Toàn bộ | Chỉ các buổi được cấp quyền; tên, nhóm, trạng thái tham dự và bàn. |
| Liên hệ, địa chỉ, ghi chú riêng của khách | Có | Không. |
| Thực đơn | Toàn bộ | Thực đơn chung và tổng suất; không thấy ghi chú sức khỏe riêng của từng người. |
| Công việc/lịch trình | Tất cả | Chỉ bản ghi có cờ `Chia sẻ với người nhà`. |
| Ngân sách, thanh toán, quà mừng, nguồn tiền | Toàn bộ | Không, kể cả tổng số và tên tệp có thể tiết lộ số tiền. |
| Hợp đồng, biên lai, giấy tờ | Có | Không; tài liệu hướng dẫn vận hành có thể được chia sẻ riêng. |
| Sửa, điểm danh, xác nhận thanh toán | Có | Không. |
| Xuất dữ liệu | Toàn bộ | Chỉ bản in vận hành được phép xem, không có xuất toàn bộ. |
| Mời/thu hồi thành viên | Có | Không. |
| Nhật ký, thùng rác, sao lưu | Có | Không. |

### 5.2. Quy tắc

- Hai vợ chồng đều có thể mời và thu hồi quyền người nhà. Mọi thay đổi quyền được ghi nhật ký.
- Người nhà không được truy cập chỉ bằng biết URL. Mỗi tài khoản phải đăng nhập và có quyền đang còn hiệu lực.
- Mời theo email, chọn buổi được xem. Chỉ đúng email đăng nhập đã được mời mới nhận quyền. Có thời hạn lời mời 7 ngày, có thể tạo lại.
- Không cho xóa hoặc hạ quyền tài khoản chủ sở hữu cuối cùng. Đổi tài khoản của hai vợ chồng qua quy trình bàn giao cho email mới đã xác thực.
- Thu hồi quyền có hiệu lực ở lần yêu cầu máy chủ tiếp theo; dữ liệu đã tải trên thiết bị hoặc bản in đã phát ra không thể thu hồi từ xa. Giao diện đang mở kiểm tra lại quyền định kỳ.
- Không tạo hệ thống tùy chỉnh hàng chục quyền theo từng trường. Bản đầu có hai vai trò và phạm vi buổi; cách hiển thị riêng tư cố định như bảng trên.
- Kiểm tra quyền ở máy chủ và cơ sở dữ liệu; ẩn nút trên giao diện không phải biện pháp bảo vệ.
- Tệp riêng không có URL công khai cố định. Link tải có thời hạn tối đa 5 phút, chỉ tạo sau khi kiểm tra quyền.

Phân quyền thực hiện trong lớp truy cập dữ liệu của ứng dụng, DTO theo vai trò và chính sách PostgreSQL cho bảng nghiệp vụ. Trình duyệt không kết nối trực tiếp vào DB hoặc thư mục lưu ảnh. Đường tải ảnh/tệp xác thực người dùng rồi kiểm tra quyền với bản ghi liên quan trước khi stream dữ liệu. Mỗi thao tác máy chủ tự kiểm tra quyền theo [hướng dẫn xác thực Next.js](https://nextjs.org/docs/app/guides/authentication).

**Nghiệm thu:** người nhà truy cập trực tiếp URL tài chính, gọi API sửa dữ liệu hoặc đoán ID tệp đều bị từ chối; dữ liệu riêng không xuất hiện trong HTML, JSON, thông báo, bộ nhớ cache chia sẻ hoặc bản in của họ.

### 5.3. Khởi tạo, lời mời và khôi phục tài khoản

- Trước lần đăng nhập đầu, người triển khai chạy lệnh seed một lần trên server với đúng hai email do bạn cung cấp. Seed tạo quyền chờ xác nhận, không tạo mật khẩu hoặc phiên đăng nhập. Có thể chạy lại an toàn, không cấp quyền cho email khác.
- Lần đăng nhập Google đầu tiên phải khớp email đã được Google xác minh và bản ghi chờ; sau đó liên kết bằng ID người dùng/provider ổn định. Không dùng quy tắc “người đăng nhập đầu tiên là chủ”, không bỏ dấu chấm hoặc phần `+...` để tự suy đoán email tương đương.
- Người chưa có quyền bị chặn trước khi vào dữ liệu đám cưới; việc OAuth thành công không đồng nghĩa được làm thành viên. Không bật account linking tự động với nhà cung cấp danh tính khác.
- Lời mời người nhà được tạo trong ứng dụng rồi chủ sở hữu tự sao chép link gửi bằng kênh mình chọn. Ứng dụng không cần SMTP, không tự gửi email. Token một lần, lưu bản băm, hết hạn sau 7 ngày; vẫn cần đăng nhập đúng Google email được mời.
- Session mặc định 7 ngày, có thể gia hạn theo hoạt động qua cơ chế thư viện. Kiểm tra membership hiện tại trên mỗi yêu cầu dữ liệu; không lấy vai trò từ cookie đã cache để quyết định quyền. Có đăng xuất thiết bị hiện tại và thu hồi các phiên khác của chính mình.
- Nếu một chủ sở hữu mất tài khoản Google: người còn lại mời tài khoản thay thế, xác nhận đăng nhập đúng email, chuyển quyền, thu hồi tài khoản/phiên cũ và ghi audit. Không được nhân cơ hội biến người nhà thành chủ sở hữu ngoài luồng bàn giao này.
- Nếu cả hai mất truy cập: người có quyền SSH chạy quy trình khôi phục đã bàn giao, thay quyền chờ sang email Google mới đã được bạn xác nhận, thu hồi mọi phiên/lời mời cũ. Lần vào tiếp theo vẫn phải xác thực Google; không xây URL bí mật hoặc mật khẩu cửa hậu để bỏ qua xác thực.
- Nếu Google tạm gián đoạn: dùng tài liệu vận hành đã xuất; đây là phụ thuộc chấp nhận được của phương án Google-only. Không tự chuyển sang đăng nhập không xác thực.

Tham chiếu cấu hình [Google provider](https://better-auth.com/docs/authentication/google) và [session Better Auth](https://better-auth.com/docs/concepts/session-management). Các thời hạn và quy trình cấp quyền trên là lựa chọn của sản phẩm, không dựa vào cấu hình mặc định chưa kiểm chứng.

### 5.4. Nội dung được chia sẻ

Cờ chia sẻ không có nghĩa gửi toàn bộ bản ghi. Công việc/lịch trình có tiêu đề và ghi chú vận hành riêng; tiêu đề nội bộ, số tiền, liên kết khoản chi, checklist/tệp riêng vẫn bị loại. Ảnh/tệp mới mặc định riêng, không tự thừa hưởng quyền công khai từ một hồ sơ đã chia sẻ. Tệp tài chính luôn riêng cho chủ sở hữu. Đầu mối MC/xe/điều phối có thể chia sẻ số liên hệ khi chủ sở hữu chọn rõ; số liên hệ trong hồ sơ khách vẫn riêng như mục 5.1.

## 6. Thiết lập đám cưới và nhiều buổi — P0

### 6.1. Dữ liệu

- Tên cô dâu/chú rể hoặc nhãn hai người tùy chỉnh; tên hiển thị ngắn.
- Ghi chú thời gian dự kiến; trạng thái ngày: `Chưa chốt` hoặc `Đã chốt`.
- Ngày dương lịch chính thức chỉ có khi đã chốt. Một ngày khác dùng cho đặt thử phải được gắn rõ `Tạm tính`, không dùng làm đếm ngược chính thức.
- Mỗi buổi gồm tên, loại, trạng thái dự kiến/đã chốt/hủy/hoàn tất, ngày giờ bắt đầu/kết thúc, địa điểm, địa chỉ, link bản đồ, đầu mối và ghi chú riêng/công khai.
- Buổi nào cũng có tập khách, bàn và thực đơn riêng; chi phí và công việc có thể thuộc một buổi hoặc thuộc chung đám cưới.

### 6.2. Đổi ngày

1. Hiển thị ngày cũ, ngày mới và số công việc có hạn tương đối bị ảnh hưởng.
2. Công việc gắn mốc `X ngày trước buổi Y` được tính lại, trừ công việc đã hoàn tất hoặc đã ghim hạn thủ công.
3. Ngày hợp đồng, hạn thanh toán, lịch hẹn nhà cung cấp và bản ghi đã chốt không tự dời. Hiển thị danh sách để hai người rà soát.
4. Chỉ ghi thay đổi sau màn hình xem trước; ghi nhật ký trước/sau.
5. Nếu chuyển về chưa chốt, hạn tương đối chưa đến hạn trở thành `Chờ ngày chính thức`; không xóa hạn cố định.
6. Ngày cưới đại diện liên kết tới đúng một buổi được chọn, không nhập hai bản độc lập trong settings và events. Khi chưa có buổi đại diện chỉ có ghi chú dự kiến; khi đã chọn, đếm ngược và ngày chính lấy từ buổi đó. Dời ngày buổi đại diện đi qua cùng quy trình xem trước, không cập nhật một nơi rồi quên nơi còn lại.

**Nghiệm thu:** ở trạng thái hiện tại của bạn không xuất hiện số ngày đếm ngược hoặc ngày cưới tự bịa; đổi một buổi không làm đổi lịch của buổi khác.

## 7. Tổng quan — P0

### 7.1. Cấu trúc trang

1. Tên hai người và thời gian cưới. Chưa chốt thì hiển thị ghi chú thời gian dự kiến.
2. Các chỉ số: tổng chi dự báo, đã chốt giá, đã thanh toán ròng, dự kiến còn phải chi; khách theo buổi; công việc quá hạn/sắp hạn.
3. `Cần xử lý`: thanh toán quá hạn, khách chờ liên hệ, công việc gấp, các vấn đề dữ liệu cần sửa.
4. Lịch 7 ngày tới. Nếu ít dữ liệu, hiển thị lời hướng dẫn thêm dữ liệu thay vì biểu đồ rỗng.
5. Tiến độ theo nhóm việc, các hạng mục chi lớn và thay đổi gần đây.

### 7.2. Định nghĩa

- Không gộp tổng người dự hai buổi thành tổng số người duy nhất. Hiển thị riêng `Người duy nhất` và `Lượt tham dự` nếu chọn tất cả buổi.
- Tiến độ công việc = hoàn tất / (tổng việc không hủy). Việc chưa gán người vẫn ở mẫu số. Nếu không có việc, hiển thị `Chưa có công việc`.
- Quá hạn công việc ngày = ngày hạn < ngày hiện tại ở múi giờ đám cưới, trạng thái chưa xong/chưa hủy. Có giờ thì so timestamp chính xác.
- Thanh toán đến hạn hôm nay không gọi là quá hạn cho tới khi hết ngày, trừ khi có giờ hạn cụ thể.
- Mỗi chỉ số có mô tả cách tính và link đến dữ liệu tạo ra nó. Số liệu lấy từ cùng logic với trang chi tiết.
- Người nhà nhận dashboard riêng chỉ có thông tin vận hành được phép xem.

**Nghiệm thu:** bấm “Khách đã xác nhận” mở đúng buổi và đúng bộ lọc; số dòng/người khớp chỉ số. Không hiện ngân sách cho người nhà.

## 8. Khách mời, thiệp và tham dự — P0

### 8.1. Ba khái niệm phải tách

- **Người:** một cá nhân, có một ID ổn định; không dùng tên làm khóa.
- **Nhóm nhận thiệp:** một người, cặp đôi hoặc gia đình được mời chung trong một buổi. Một nhóm thiệp chứa nhiều người.
- **Tham dự:** trạng thái riêng của từng người trong từng buổi. Một người có thể dự tiệc cưới nhưng không dự gia tiên.

Ví dụ: gia đình 4 người nhận 1 thiệp, 3 người dự buổi tiệc. Kết quả phải là 1 thiệp, 4 người được mời, 3 người xác nhận, không phải 1 khách.

### 8.2. Trường dữ liệu

| Đối tượng | Trường và quy tắc |
| --- | --- |
| Người | Tên hiển thị; bên mời: nhà trai/nhà gái/chung/chưa phân; nhóm quan hệ chính; nhãn phụ; người lớn/trẻ em/em bé; điện thoại, email, địa chỉ tùy chọn; ghi chú riêng. |
| Nhóm thiệp | Tên nhóm, người đại diện, thành viên, buổi, hình thức giấy/điện tử/trực tiếp, người phụ trách, trạng thái chuẩn bị và ngày gửi. |
| Tham dự theo buổi | Chưa hỏi/chờ phản hồi/có thể/đồng ý/từ chối; số lần/ghi chú liên hệ; món; nhu cầu ăn uống; lưu trú/xe; có cần ghế; có cần suất ăn; trạng thái điểm danh ở R3. |
| Theo dõi liên hệ | Người cập nhật, thời điểm, kết quả, ngày cần hỏi lại. Không tự nhắn tin ra ngoài. |

Tên bắt buộc với người đã biết danh tính. Người đi cùng chưa rõ tên dùng bản ghi placeholder có nhãn `Người đi cùng của …`, không tạo tên giả. Khi biết tên, cập nhật cùng ID để giữ lịch sử, bàn và thiệp.

### 8.3. Luồng thao tác

1. Thêm một người hoặc thêm cả gia đình; liên hệ có thể dùng chung người đại diện.
2. Chọn các buổi được mời. Tạo nhóm thiệp cho từng buổi; có thao tác sao chép danh sách người giữa các buổi với màn hình kiểm tra.
3. Đánh dấu đã báo giữ lịch, đã chuẩn bị thiệp, đã gửi thiệp, ngày và người gửi. Đây là các trạng thái độc lập với tham dự.
4. Sau khi gọi điện/liên hệ, cập nhật trạng thái từng thành viên; thao tác cập nhật cả nhóm luôn hiển thị danh sách bị tác động trước khi lưu.
5. Khi khách đồng ý, đưa vào danh sách cần xếp bàn và tổng suất ăn tương ứng.
6. Khi khách từ chối hoặc bị rút lời mời, hỏi gỡ chỗ đang xếp, thực hiện cùng giao dịch; giữ lịch sử thay đổi.

### 8.4. Tìm kiếm và xử lý dữ liệu

- Tìm tên có dấu/không dấu, số điện thoại đã bỏ khoảng trắng, tên nhóm và nhãn.
- Bộ lọc: buổi, bên mời, nhóm, gửi thiệp, tham dự, chưa có bàn, ăn uống, lưu trú, cần liên hệ lại.
- Thay đổi hàng loạt: nhóm/bên mời, ngày gửi, người phụ trách, tham dự; có xem trước và ghi nhật ký.
- Gợi ý trùng khi trùng tên chuẩn hóa và số điện thoại hoặc tên + nhóm nhận thiệp. Không chặn chỉ vì cùng tên hoặc dùng chung số điện thoại gia đình.
- Gộp trùng phải chọn bản giữ, xem các xung đột của từng buổi, giữ quan hệ thiệp/bàn/quà. Không tự gộp.
- Một người không thuộc hai nhóm thiệp cùng một buổi; chuyển nhóm phải hiện các liên kết thay đổi.
- Địa chỉ/số liên hệ không bắt buộc; không lấy email giả làm giá trị mặc định.

### 8.5. Quy tắc đếm

Với từng buổi: tổng được mời = số ID người được mời đang hoạt động. Xác nhận = trạng thái đồng ý. Chưa chốt = chưa hỏi + chờ phản hồi + có thể. Từ chối hiển thị riêng.

Số ghế xác nhận = người đồng ý và có cờ cần ghế. Số suất xác nhận = người đồng ý và có yêu cầu suất. Trẻ em có thể cần ghế nhưng dùng suất trẻ em; em bé có thể không cần cả hai. Không tự suy ra 0,5 ghế hoặc 0,5 suất từ tuổi.

Số liệu giữa các buổi không chia sẻ trạng thái tham dự. Không đánh dấu gửi thiệp là đã đồng ý.

**Nghiệm thu:** gia đình 4 người, 2 người lớn đồng ý, 1 trẻ em đồng ý cần ghế/suất trẻ em, 1 em bé từ chối tạo đúng 1 thiệp, 4 người mời, 3 xác nhận, 3 ghế và cơ cấu suất đúng. Một khách dự hai buổi vẫn chỉ có một hồ sơ cá nhân.

## 9. Ngân sách, thanh toán và nguồn tiền — P0

### 9.1. Dữ liệu và màn hình

- Ngân sách mục tiêu toàn đám cưới; ngân sách từng hạng mục; khoản dự phòng. Ngân sách hạng mục là phân bổ của tổng, không cộng thêm một lần vào tổng mục tiêu.
- Hạng mục mặc định có thể chọn: địa điểm, ăn uống, ảnh/quay, trang phục, trang trí/hoa, nhẫn, trang điểm, MC/điều phối, thiệp, xe, quà, chi phí khác.
- Khoản chi: tên, hạng mục, buổi hoặc dùng chung, nhà cung cấp, dự toán, giá chốt, chi phí quyết toán nếu có, người phụ trách, trạng thái, ghi chú, tệp.
- Lịch trả: từng đợt, số phải trả, ngày hạn, trạng thái dự kiến/đã thỏa thuận/hủy; một khoản có nhiều đợt.
- Giao dịch: chi ra hoặc hoàn về, số tiền, thời điểm, người trả/nhận, tiền mặt/chuyển khoản/khác, chứng từ, đợt được phân bổ.
- Nguồn tiền: số dư ban đầu, khoản góp thực nhận và khoản hứa góp chưa nhận; người góp là tùy chọn. Không coi tiền hứa góp là tiền đang có.

### 9.2. Các số tiền không được nhập nhằng

| Chỉ số | Công thức/quy tắc |
| --- | --- |
| Dự toán của khoản | Ước lượng ban đầu, có thể để trống. |
| Giá đã chốt | Tổng nghĩa vụ hiện tại đã đồng ý với bên cung cấp. Có thể thay đổi kèm lý do, không đồng nghĩa với đã trả tiền. |
| Quyết toán | Giá cuối cùng sau khi hoàn thành và xác nhận. Chưa quyết toán phải để trống, không tự sao chép dự toán. |
| Chi phí dự báo của khoản | Quyết toán nếu có; nếu chưa có dùng giá chốt; nếu chưa chốt dùng dự toán. Cả ba trống thì báo khoản thiếu giá. |
| Đã thanh toán ròng | Tổng giao dịch chi hợp lệ − tổng hoàn tiền hợp lệ, theo khoản. |
| Còn phải trả đã xác nhận | `max((quyết toán hoặc giá chốt) − đã thanh toán ròng, 0)`; chưa có cả hai thì chưa xác định, không trả về 0 giả. |
| Dự kiến còn phải chi | `max(chi phí dự báo − đã thanh toán ròng, 0)` cho từng khoản rồi cộng; báo số khoản thiếu giá. |
| Dư thanh toán | `max(đã thanh toán ròng − (quyết toán hoặc giá chốt), 0)`; hiển thị riêng, không dùng để bù nợ khoản khác. |
| Chênh lệch ngân sách | Tổng mục tiêu − tổng chi phí dự báo. Âm nghĩa là vượt; chưa có mục tiêu thì không đánh giá vượt. |
| Tiền có thể sử dụng | Số dư ban đầu + tiền góp thực nhận + quà tiền đã nhận ròng − chi thanh toán ròng. Chỉ là sổ theo dõi, không phải số dư ngân hàng xác thực. |

Tổng “chi phí thực tế/quyết toán” chỉ phản ánh khoản đã quyết toán và luôn kèm mức độ bao phủ, ví dụ “đã quyết toán 8/20 khoản”. Không đưa một tổng chưa đầy đủ lên dashboard với nhãn khiến người dùng tưởng đó là toàn bộ chi phí cuối cùng.

Chỉ hiển thị “tiền có thể sử dụng” khi chủ sở hữu đã xác nhận số dư ban đầu, thời điểm bắt đầu sổ `opening_as_of` và phạm vi quỹ được theo dõi. Nếu chưa thiết lập, hiển thị `Chưa thiết lập quỹ`, vẫn xem được thu/chi đã ghi. Số dư bằng 0 đã xác nhận khác với chưa nhập số dư. Sổ mặc định theo dõi chung phần tiền dành cho đám cưới của hai người, không theo dõi toàn bộ tài khoản cá nhân.

Số dư ban đầu là tiền còn có ngay tại `opening_as_of`, đã bao gồm ảnh hưởng của mọi thu/chi trước mốc đó. Phép tính quỹ chỉ cộng/trừ giao dịch từ mốc này trở đi; báo cáo chi phí/đã thanh toán vẫn tính toàn bộ lịch sử, kể cả trước mốc. Mọi giao dịch có thời điểm hạch toán; xác nhận số dư theo thời điểm đủ ngày/giờ để không lẫn các giao dịch cùng ngày. Đổi mốc hoặc số dư cần màn hình đối chiếu trước/sau và lý do. Ví dụ: đã cọc 10 triệu trước mốc, quỹ còn 90 triệu tại mốc; nhập lại giao dịch lịch sử vẫn cho quỹ 90 triệu, không thành 80 triệu.

Nếu người thân trả thẳng cho nhà cung cấp và xác nhận đó là khoản góp không cần hoàn lại, thao tác `Người khác góp bằng cách trả hộ` tạo đồng thời khoản góp trực tiếp và giao dịch chi được liên kết, cùng số tiền, trong một transaction. Khoản này vào tổng chi phí/đã trả nhưng không làm tăng tiền còn sẵn trong quỹ; không gọi là đã nhận tiền mặt. Hoàn lại khoản trả hộ này cũng phải có bút toán đối ứng liên kết, không tự cộng tiền vào quỹ hai người. Khoản vay hoặc ứng hộ cần trả lại không được giả thành tiền góp: bản này chỉ ghi ghi chú nghĩa vụ và công việc đối chiếu, không cung cấp sổ vay/nợ cá nhân; không dùng chỉ số quỹ làm quyết định tài chính khi có khoản ứng hộ chưa đối chiếu.

### 9.3. Quy tắc thanh toán

- Tiền VND lưu số nguyên, không dùng số thực để tính. Số tiền giao dịch phải > 0; số 0 hợp lệ cho dự toán hoặc dịch vụ miễn phí nếu ghi rõ.
- Một lần trả có thể phân bổ cho nhiều đợt của cùng khoản chi. Tổng phân bổ bằng tổng giao dịch; không tự áp dụng sang khoản khác.
- Chưa có lịch trả thì phần chưa phân bổ gắn `Trả trước/chưa phân đợt` của đúng khoản chi; tổng phân bổ vào các đợt + phần trả trước phải bằng giao dịch. Khi có lịch mới chỉ chuyển phân bổ, không tạo thêm lần chi. Phần phân bổ không vượt nghĩa vụ đợt; phần dư ở trả trước/dư thanh toán và phải được đối chiếu.
- Đợt còn nợ = số đến hạn − thanh toán ròng đã phân bổ; quá hạn khi còn nợ và ngày hạn đã qua.
- Hoàn tiền tham chiếu giao dịch chi gốc, phân bổ ngược về đợt tương ứng. Không được hoàn quá số còn có thể hoàn của giao dịch gốc.
- Giảm giá chốt xuống dưới số đã trả tạo trạng thái dư thanh toán/đang chờ hoàn, không tự tạo giao dịch hoàn tiền.
- Khoản chưa chốt vẫn được ghi đặt cọc. Dashboard phải nêu nghĩa vụ còn chưa xác định.
- Tổng lịch trả có thể chưa đủ khi đang dự thảo; khi đánh dấu lịch đã thỏa thuận phải bằng giá chốt/quyết toán. Nếu thay đổi giá, bắt buộc rà soát lịch trả.
- Tiền cho nhà cung cấp cùng hạng mục vẫn là nhiều khoản riêng; không cộng thêm tổng hợp hợp đồng lần thứ hai.
- Giao dịch đã ghi nhận không xóa im lặng. Có thao tác hủy ghi nhận với lý do, nhật ký và tính lại số dư; hoàn tiền thật dùng giao dịch hoàn tiền.
- Không hủy ghi nhận một giao dịch gốc khi còn hoàn tiền/phân bổ điều chỉnh phụ thuộc chưa được xử lý. Bút toán góp trực tiếp/trả hộ luôn hủy hoặc sửa cùng cặp liên kết; không được để một vế vào quỹ một mình.
- Nút lưu giao dịch chống nhấn hai lần và thử lại khi mạng chập chờn bằng khóa chống trùng ở máy chủ.
- Chi phí chung nhiều buổi gắn `Chung`; tổng đám cưới cộng một lần. Bản đầu không tự chia chi phí chung cho từng buổi.
- Không có tự động thanh toán, kết nối tài khoản ngân hàng, ngoại tệ hay tỷ giá trong bản này.

### 9.4. Luồng ví dụ nghiệm thu

Giá chốt chụp ảnh 30.000.000 ₫, trả 3 đợt 10 triệu. Ghi chi 10 triệu đợt 1, 5 triệu đợt 2: đã trả 15 triệu, còn 15 triệu; nếu đợt 2 quá hạn thì quá hạn 5 triệu. Nhận hoàn 2 triệu từ lần trả đợt 1: đã trả ròng 13 triệu, còn 17 triệu; hiển thị lịch trả cần xem lại nếu thỏa thuận hoàn có thay đổi nghĩa vụ. Lưu lại cùng yêu cầu không tạo thêm một giao dịch nữa.

Nếu khoản A dư 2 triệu và khoản B nợ 5 triệu, dashboard phải hiển thị dư 2 triệu và nợ 5 triệu riêng, không chỉ hiển thị “còn nợ 3 triệu”.

### 9.5. Hủy dịch vụ, mất cọc và hoàn tiền

- Khoản chi có trạng thái dự kiến, đã chốt, hoàn tất, đang xử lý hủy, đã hủy. Hủy buổi hoặc nhà cung cấp không tự hủy khoản chi và không xóa lịch sử thanh toán.
- Khi hủy, ghi nghĩa vụ cuối cùng còn phải chịu: phí hủy/mất cọc, chi phí đã cung cấp và số còn tranh chấp. Chưa có thỏa thuận cuối thì ở `Đang xử lý hủy`, báo nghĩa vụ chưa chốt; không coi dự toán cũ là chi phí cuối hoặc coi mọi thứ bằng 0.
- Khi đã xác nhận nghĩa vụ cuối, dùng số đó làm quyết toán của khoản đã hủy, thay lịch trả còn hiệu lực và giữ các phiên bản giá trước. Không tạo một khoản phí hủy thứ hai nếu phí đã nằm trong quyết toán này.
- Ví dụ đã trả 10 triệu, hủy chịu phí 3 triệu: chi phí cuối 3 triệu, đã trả ròng 10 triệu, cần nhận lại 7 triệu. Nhận hoàn 7 triệu thì đã trả ròng còn 3 triệu, dư/nợ bằng 0; không trở thành còn phải trả 7 triệu.
- Hoàn tiền chỉ thay dòng tiền thực tế; không tự thay giá/nghĩa vụ. Nếu hoàn do giảm giá, người dùng xác nhận cả giá mới và giao dịch hoàn trong cùng luồng; nếu chỉ hoàn khoản trả nhầm, giữ nguyên nghĩa vụ.
- Giá trị 0 là quyết toán hợp lệ khi hủy không mất phí. Quy tắc chọn quyết toán/giá chốt/dự toán dựa vào null, không dựa vào kiểm tra truthy làm bỏ qua 0.

### 9.6. Độ đầy đủ của tổng và nguồn quỹ

- Nếu có khoản chưa có giá, tổng dự báo gắn nhãn `Tạm tính — còn N khoản thiếu giá`; chưa được kết luận còn dư hoặc đủ ngân sách từ tổng này. Vẫn cảnh báo vượt nếu riêng phần đã biết đã lớn hơn mục tiêu.
- Nguồn góp có loại thực nhận vào quỹ, góp trực tiếp trả nhà cung cấp và hứa góp. Loại thứ hai có cặp giao dịch chi đối ứng; loại thứ ba không vào số dư. Tất cả đều tuân theo mốc mở sổ.
- R1 chưa có sổ quà: không có dòng quà giả bằng 0 để khiến sổ trông hoàn chỉnh. Khi bật sổ quà ở R3, mỗi khoản quà sau mốc mở sổ đóng góp trực tiếp một lần vào phép tính quỹ; không tạo bản sao trong nguồn góp.

## 10. Công việc và lịch — P0

### 10.1. Công việc

- Trường: tiêu đề, nhóm, buổi, người chịu trách nhiệm, người hỗ trợ, ưu tiên, trạng thái, hạn, checklist con, liên kết nhà cung cấp/tài liệu, ghi chú riêng và nội dung chia sẻ.
- Trạng thái: chưa làm → đang làm → đang chờ → hoàn tất; có hủy riêng. Được mở lại việc đã xong, ghi rõ thời gian mở lại.
- Mỗi việc có một người chịu trách nhiệm chính là một trong hai chủ sở hữu hoặc `Chưa phân công`. Người nhà/nhà cung cấp có thể là người hỗ trợ được ghi tên nhưng không có quyền sửa.
- Hạn có 3 kiểu: ngày cố định, thời điểm cụ thể hoặc số ngày trước/sau một buổi. Chỉ tính kiểu tương đối khi buổi có ngày chính thức.
- Checklist gợi ý chia giai đoạn: định hình nhu cầu, dự toán, nhà cung cấp, thiệp/khách, trước cưới, trong ngày, sau cưới. Chủ sở hữu chọn gói, xem trước và xác nhận thêm; thêm lại không tạo bản trùng của cùng mẫu.
- Phụ thuộc công việc: cảnh báo việc tiền đề chưa hoàn thành; không cho tạo chu trình A → B → A. Có thể hoàn thành vượt cảnh báo với lý do; không tự dời hạn dây chuyền.
- Hai chế độ danh sách và bảng theo trạng thái; thao tác chính không phụ thuộc kéo thả.

### 10.2. Lịch

- Chế độ tháng và danh sách theo ngày; lọc buổi, người phụ trách và loại.
- Lịch gom công việc có hạn, đợt thanh toán, cuộc hẹn và mốc buổi lễ. Mục tổng hợp mở bản ghi gốc, không tạo một sự kiện độc lập bị lệch khi sửa.
- Cuộc hẹn tự tạo gồm tiêu đề, bắt đầu/kết thúc, địa điểm, người liên quan và ghi chú.
- Cảnh báo trùng lịch có cùng người phụ trách và giao nhau thời gian. Cảnh báo, không chặn tuyệt đối.
- Xuất `.ics` cho các mục được chọn. Đây là bản sao tại thời điểm xuất; sửa trên web không tự sửa lịch đã nhập vào ứng dụng khác.

**Nghiệm thu:** thanh toán đổi hạn thì mục lịch đổi theo; hoàn tất công việc làm giảm đúng số quá hạn; chưa chốt ngày không tự phát sinh lịch nhắc tương đối.

## 11. Nhà cung cấp và địa điểm — P1

### 11.1. Quản lý lựa chọn

- Hồ sơ gồm tên, loại dịch vụ, đầu mối, số liên hệ, địa chỉ/link bản đồ, website, trạng thái, ghi chú.
- Trạng thái: đang tìm, đã liên hệ, đã có báo giá, danh sách rút gọn, đã chọn, không chọn, hủy.
- Một nhà cung cấp có nhiều báo giá hoặc phiên bản báo giá. Lưu ngày nhận, hạn hiệu lực, gói, nội dung bao gồm, phần loại trừ, điều kiện cọc/hủy/hoàn, tệp.
- So sánh 2–4 lựa chọn bằng cùng tiêu chí. Giá trống hiển thị `Chưa báo`, không xếp như miễn phí. Không chấm điểm hoặc tự chọn nếu chưa có bộ tiêu chí người dùng xác định.
- Chọn nhà cung cấp không tự tạo tiền đã thanh toán. Nút `Tạo khoản chi từ báo giá` xem trước, chọn giá/nhóm/buổi, chống tạo trùng từ cùng báo giá.

### 11.2. Riêng địa điểm

Thêm sức chứa, số người tối thiểu, giá bàn, số ghế/bàn, phí thuê, thuế/phí phục vụ đã gồm hay chưa, giờ được vào chuẩn bị, giờ kết thúc, chi phí phát sinh, bãi xe, phương án mưa, yêu cầu trang trí/âm thanh.

So sánh tổng chi phí tại cùng kịch bản số bàn. Gói 20 bàn không so thẳng với gói 30 bàn chỉ bằng tổng tiền; phải hiển thị giả định. Giá chưa gồm phí phải được gắn nhãn. Dữ liệu thiếu không được tự lấy bằng 0.

**Nghiệm thu:** chọn gói 30 triệu tạo đúng một khoản chi 30 triệu nếu người dùng xác nhận; mở lại báo giá không tạo thêm khoản; giá đổi phải hiển thị phiên bản, không sửa lén hợp đồng cũ.

## 12. Sơ đồ bàn và chỗ ngồi — P1

- Mỗi buổi có danh sách bàn, tên/số bàn duy nhất, loại tròn/chữ nhật, sức chứa ghế nguyên dương, vị trí trên sơ đồ và ghi chú.
- Một người có tối đa một bàn trong một buổi; mặc định chỉ người đồng ý tham dự mới được xếp. Khách `có thể` không bị tính là đã đủ chỗ, nằm ở danh sách dự phòng.
- Hai cách xếp: chọn người rồi chọn bàn; kéo thả trên máy tính. Trên điện thoại luôn có thao tác chọn bàn thay thế.
- Mỗi lần xếp/đổi chỗ kiểm tra sức chứa ở máy chủ trong cùng giao dịch; hai người cùng xếp không thể làm vượt số ghế mà không có cảnh báo.
- Không cho vượt sức chứa đang cấu hình. Muốn thêm ghế, chủ sở hữu sửa sức chứa trước với lý do; không có nút bỏ qua âm thầm.
- Người không cần ghế có thể đi cùng bàn của gia đình mà không chiếm ghế; vẫn nằm trong số người tại bàn và nhu cầu suất ăn nếu có.
- Có cảnh báo gia đình bị tách bàn, người chưa xếp, nhóm ăn uống chưa đủ thông tin. Gợi ý này không tự di chuyển khách.
- Hủy/từ chối tham dự gỡ gán bàn sau xác nhận. Đổi sức chứa nhỏ hơn số đang ngồi bị chặn và đưa ra danh sách cần chuyển.
- Bản sơ đồ là công cụ bố trí vận hành, không cam kết đúng tỉ lệ kiến trúc hoặc lối thoát hiểm của địa điểm.
- Xuất A4: sơ đồ bàn và danh sách theo bàn; bản cho người nhà không có quà, điện thoại, địa chỉ hoặc ghi chú riêng.

**Nghiệm thu:** bàn 10 ghế nhận 10 người cần ghế; người thứ 11 bị từ chối kể cả khi hai chủ sở hữu thao tác gần đồng thời. Một em bé không cần ghế không làm số ghế thành 11.

## 13. Thực đơn, suất ăn, lưu trú và di chuyển — P1

### 13.1. Thực đơn

- Tạo thực đơn theo buổi: gói, món, đồ uống, giá tham khảo, nhà cung cấp, ghi chú.
- Từng người chọn gói thường/chay/trẻ em/khác hoặc một menu đã tạo; ghi yêu cầu kiêng/dị ứng riêng khi cần.
- Tổng suất được tính từ khách đồng ý và có nhu cầu suất; các lựa chọn còn thiếu hiện riêng.
- Dự phòng do người dùng nhập theo số suất hoặc số bàn, ghi tách với số đã xác nhận. Không tự thêm tỷ lệ dự phòng hoặc coi nó là khách thật.
- Nếu địa điểm bán theo bàn, số bàn phải đặt là số nguyên người dùng chốt. Có thể gợi ý `ceil(số ghế yêu cầu / ghế mỗi bàn)`, nhưng không gọi đó là số bàn đã đặt.
- Bản gửi nhà hàng có số lượng suất, bàn có yêu cầu đặc biệt và nội dung cần phục vụ. Chi tiết sức khỏe không cần thiết không đưa ra bản dùng chung.

### 13.2. Lưu trú và xe

- Chỉ bật nếu cần. Ghi nhận khách nào cần hỗ trợ, số người, đêm lưu trú, nơi ở, phòng/xe/chuyến được gán, người liên hệ và trạng thái đã xác nhận.
- Chuyến xe có điểm đón, giờ đón, điểm đến, chỗ tối đa, tài xế/đầu mối; không phân công quá chỗ.
- Không xử lý đặt phòng/đặt xe hoặc gửi thông tin cá nhân ra nhà cung cấp tự động. Chủ sở hữu chọn dữ liệu và tự bàn giao.
- Chi phí liên quan được liên kết khoản chi hiện có hoặc tạo khoản mới có xem trước; không cộng hai lần cùng chi phí.

**Nghiệm thu:** tổng suất người lớn/trẻ em/chay đối chiếu được với danh sách người; khách không dự không còn nằm trong số suất cần phục vụ.

### 13.3. Chốt danh sách với nhà hàng — P1

- Mỗi buổi có hạn chốt khách/suất và bản chốt được chủ sở hữu tạo thủ công. Bản chốt có ID phiên bản, giờ tạo, danh sách người, gán bàn, cơ cấu suất, số bàn đặt, dự phòng và ghi chú bàn giao.
- Đó là snapshot bất biến; dữ liệu đang làm việc tiếp tục thay đổi nhưng không sửa bản đã bàn giao. Màn hình hiển thị rõ `Đang chuẩn bị` và `Đã bàn giao phiên bản X`.
- Thay đổi sau chốt phải xem chênh lệch người/ghế/suất/bàn và xác nhận lý do. Gắn cờ `Chưa bàn giao lại`; không tự báo nhà hàng đã nhận thay đổi.
- Khi đã liên hệ nhà hàng, chủ sở hữu tạo phiên bản mới và đánh dấu thời điểm/người đã nhận thông tin theo ghi nhận thủ công. Cùng số liệu nhưng xuất lại tài liệu không tự trở thành một lần nhà hàng đã nhận.
- Nếu đổi thực đơn hoặc sơ đồ bàn, snapshot cũ vẫn giữ nhãn/giá trị tại lúc chốt, không tham chiếu sang tên menu/bàn mới rồi mất nội dung đã giao.
- Bản chốt không khóa khả năng thêm khách, nhưng mọi phát sinh luôn có dấu hiệu chưa đối chiếu. Không tự sửa số bàn đã đặt chỉ vì tăng headcount.

## 14. Lịch trình ngày cưới — P2; hồ sơ đội hỗ trợ — P1

### 14.1. Lịch trình

- Mỗi buổi có các mục: tên, thời gian dự kiến bắt đầu/kết thúc, thời gian thực tế tùy chọn, địa điểm, người phụ trách, đầu mối dự phòng, đồ cần, ghi chú vận hành.
- Ví dụ nhóm mục: trang điểm, xe đón, gia tiên, di chuyển, chuẩn bị sảnh, đón khách, nghi lễ, nhập tiệc, chụp hình, kết thúc, bàn giao.
- Trạng thái: chưa bắt đầu, đang diễn ra, hoàn tất, bỏ qua. Người nhà chỉ xem; hai chủ sở hữu cập nhật.
- Màn hình `Hôm nay` chữ lớn, hiển thị hiện tại/tiếp theo, trễ so với kế hoạch và đầu mối cần gọi.
- Đánh dấu thực tế không sửa mốc kế hoạch. Khi dời các mục sau, có xem trước và chỉ áp dụng mục chưa bắt đầu, không tự dịch toàn bộ.
- Cho phép lịch song song ở địa điểm khác hoặc người phụ trách khác. Trùng người và thời gian là cảnh báo.

### 14.2. Đội hỗ trợ — P1

Hồ sơ liên hệ: tên, vai trò cô dâu/chú rể/phù dâu/phù rể/MC/điều phối/người thân/nhà cung cấp/khác, số điện thoại, đầu việc, giờ có mặt, người dự phòng. Vai trò hỗ trợ không tự cấp tài khoản hoặc quyền chỉnh sửa.

### 14.3. Điểm danh tùy chọn

- Chủ sở hữu tìm tên, đánh dấu đã đến và xem bàn; có hoàn tác và giờ ghi nhận.
- Điểm danh khác với đồng ý tham dự. Khách xác nhận nhưng chưa đến không được tính là đã đến.
- Không có QR cá nhân cho khách trong phạm vi này. Có thể tắt toàn bộ nếu không ai phụ trách điểm danh.
- Nếu muốn người nhà điểm danh sau này, cần thay đổi rõ quyền từ chỉ xem; không tự thêm vai trò đó vào bản hiện tại.
- Khách phát sinh tại chỗ được chủ sở hữu thêm người/placeholder và tham dự với nguồn `Phát sinh tại buổi`, sau đó gán bàn nếu còn ghế. Không đánh dấu đến cho một người không có bản ghi, không âm thầm đổi khách từng từ chối thành đã đến; cần xác nhận thay đổi trạng thái. Số người thực đến tách với số đã đặt/chốt và số đã xác nhận trước đó.

### 14.4. Bộ bàn giao

Tạo bộ bản in gồm lịch trình, sơ đồ bàn, số suất, danh sách đầu mối được chủ sở hữu chọn và checklist đồ dùng. Mỗi trang có buổi, ngày, số phiên bản/thời gian xuất. Dữ liệu tiền chỉ vào bản riêng cho hai chủ sở hữu.

**Nghiệm thu:** xuất bộ tài liệu rồi mở/in khi không có mạng; thứ tự, dấu tiếng Việt và phân trang đọc được; người nhà không tự xuất được bộ tài chính.

## 15. Nhạc, chụp ảnh, đồ dùng và ý tưởng — P1

Các phần này dùng giao diện danh sách/checklist tương tự nhau, không cần xây một ứng dụng riêng cho từng phần.

| Phần | Dữ liệu và thao tác |
| --- | --- |
| Âm nhạc | Tên bài, người trình bày, link nghe, đoạn nghi lễ sử dụng, thứ tự, thời lượng tùy chọn, lưu ý vào nhạc, cờ không phát. Link bên ngoài được mở khi người dùng chọn; không tải/lưu bản nhạc. |
| Kế hoạch ảnh/quay | Cảnh cần có, nhóm người, buổi, thời điểm/địa điểm, ưu tiên bắt buộc/nên có, người tập hợp, đã bàn giao cho ekip, đã thực hiện. |
| Đồ cần chuẩn bị | Tên đồ, số lượng, ai giữ, ở đâu, mang đến lúc nào, đã chuẩn bị/đã đóng gói/đã mang/đã nhận lại, có phải đồ thuê, hạn trả, ghi chú. |
| Ý tưởng | Tiêu đề, nhóm phong cách/trang trí/trang phục/khác, ảnh hoặc link, ghi chú, trạng thái tham khảo/cân nhắc/chốt/bỏ, liên kết nhà cung cấp hoặc công việc. |
| Phù dâu/phù rể | Dùng hồ sơ đội hỗ trợ, thêm trang phục, giờ có mặt, nhiệm vụ và đồ được giao. Không lưu lặp cùng một người thành nhiều danh bạ khác nhau. |

Mục được chốt không tự tạo một khoản chi hoặc công việc; có nút tạo có xem trước và liên kết nguồn để tránh trùng. Checklist đồ thuê tạo nhắc trả khi có hạn.

**Nghiệm thu:** một đồ thuê có hạn trả xuất hiện trong lịch và mục hậu cưới; nhạc/ảnh đã giao cho ekip vẫn giữ liên kết và bản ghi thời điểm giao thủ công.

## 16. Quà mừng, cảm ơn và sau cưới — P2

- Sổ quà có ngày nhận, người/nhóm gửi, loại tiền/quà hiện vật, số tiền VND nếu là tiền, mô tả quà, người nhận hộ, ghi chú, đã cảm ơn/ngày cảm ơn.
- Một phong bì chung của một gia đình là một bản ghi có nhiều người đóng góp, không sao chép tiền vào từng người.
- Cho phép chưa xác định người gửi; giữ danh sách cần đối chiếu, không tự gán người có tên gần giống.
- Tiền mừng thực nhận vào phép tính tiền có thể sử dụng một lần; không tạo thêm bản ghi nguồn góp tương ứng. Quà hiện vật không tự quy ra tiền.
- Nếu ghi sai tiền quà, hủy ghi nhận bản sai có lý do và thay bằng bản đúng; nếu có trả lại tiền thực tế, ghi `gift_returns` liên kết bản nhận, thời điểm và số tiền, không quá phần còn giữ. Quà tiền nhận ròng = nhận hợp lệ − trả lại hợp lệ. Giao dịch trước mốc mở sổ chỉ ảnh hưởng báo cáo quà, không cộng/trừ lại quỹ đã gồm trong số dư đầu. Trả quà hiện vật ghi trạng thái trả, không tự tạo dòng tiền.
- Không dự báo sẽ “thu hồi” được chi phí bằng mức mừng giả định. Nếu muốn mô phỏng sau này thì là phân tích riêng, không lẫn sổ thực nhận.
- Đánh dấu đã cảm ơn là ghi nhận thủ công; ứng dụng không tự gửi lời cảm ơn.
- Checklist sau cưới: thanh toán nốt, nhận hoàn cọc, trả đồ thuê, nhận album/video, cảm ơn, đối chiếu quà, xuất lưu trữ.
- Khi chuyển đám cưới sang lưu trữ, mặc định chỉ đọc. Chủ sở hữu có thể mở lại có ghi nhật ký.

**Nghiệm thu:** phong bì 2 triệu của 2 người chỉ cộng 2 triệu; xem một trong hai hồ sơ vẫn thấy liên kết tới cùng bản ghi. Người nhà không đọc được sổ quà hoặc tổng tiền.

## 17. Tài liệu, tìm kiếm và thông báo

### 17.1. Upload ảnh và tài liệu trực tiếp lên server — nền tảng P0, thư viện đầy đủ P1

#### Người dùng thao tác

1. Tại hồ sơ nhà cung cấp, khoản chi, bảng ý tưởng hoặc mục chuẩn bị, chọn `Tải ảnh/tệp lên`.
2. Chọn từ máy tính, thư viện ảnh điện thoại hoặc chụp ảnh qua bộ chọn tệp nếu trình duyệt hỗ trợ. Không bắt buộc dùng camera hoặc cấp quyền truy cập cả thư viện.
3. Thấy thumbnail xem trước, tên tệp, dung lượng; có thể bỏ tệp trước khi gửi, ghi chú và chọn quyền chia sẻ phù hợp.
4. Từng tệp có tiến độ riêng, trạng thái đang tải/đang xử lý/hoàn tất/lỗi. Tải nhiều tệp tối đa 10 tệp/lượt, chạy đồng thời tối đa 2 tệp.
5. Tệp lỗi có thể thử lại riêng, không tải lại tất cả. Chỉ báo thành công khi dữ liệu đã ghi bền vững và metadata đã hoàn tất.
6. Xem ảnh phóng lớn, sắp xếp thứ tự, chọn ảnh đại diện cho hồ sơ, sửa chú thích, tải bản gốc hoặc đưa vào thùng rác theo quyền.

Upload là gửi từ trình duyệt qua ứng dụng về chính server Linux của bạn; không bắt buộc qua Google Drive, Supabase Storage, dịch vụ ảnh hay đường dẫn ảnh bên ngoài. Bản này quản lý ảnh tham khảo, ảnh hồ sơ, biên lai, báo giá và ảnh cưới được chọn; không phải thư viện hàng nghìn file RAW/video nguyên gốc của ekip.

#### Loại và giới hạn mặc định

- Ảnh: JPEG, PNG, WebP; tối đa 20 MiB/tệp, tối đa 40 megapixel sau giải mã. Chưa nhận HEIC/HEIF, RAW, SVG, GIF động và video trong phạm vi ban đầu. Nếu điện thoại trả HEIC, báo rõ cần xuất/chọn JPEG; không báo chung chung là lỗi mạng.
- Tài liệu: PDF tối đa 10 MiB/tệp. Không tải ZIP, tệp thực thi hoặc Office có macro. File loại khác có thể dùng link tham chiếu riêng.
- Người nhà chỉ xem không được upload. Mỗi yêu cầu upload kiểm tra lại quyền, không tin chỉ dẫn quyền do trình duyệt gửi lên.
- Mỗi tệp là một request riêng; mặc định giới hạn request ảnh 21 MiB (tệp tối đa 20 MiB cộng metadata/multipart), PDF 11 MiB. Giới hạn byte nội dung tệp vẫn giữ 20/10 MiB; không cho lợi dụng overhead để tải tệp lớn hơn.
- Giới hạn request ở ứng dụng và reverse proxy phải thống nhất với dung lượng tệp cộng overhead multipart. Không để tầng proxy chặn 1 MiB trong khi giao diện hứa nhận 20 MiB.
- Có giới hạn tốc độ và đồng thời xử lý ảnh để upload không chặn xử lý khách/tiền. Không yêu cầu khảo sát RAM/ổ đĩa để chốt chức năng; giới hạn tài nguyên là cấu hình triển khai, không phải giả định tài nguyên vô hạn.

#### Cách lưu và xử lý

- Thư mục host mặc định `/srv/wedding/data/uploads`, bind-mount vào container tại `/data/uploads`. Đây là đường dẫn đề xuất, chưa tạo trên server.
- Không lưu upload trong source code, thư mục `public`, Docker image hay filesystem tạm của container. Khởi động lại, thay container hoặc deploy bản mới vẫn giữ ảnh.
- Ảnh/tệp dùng ID UUID và đường dẫn do server tạo; tên gốc chỉ dùng hiển thị. Không cho người dùng quyết định đường dẫn vật lý hoặc truy cập `../` ra ngoài thư mục.
- Kiểm tra chữ ký tệp, giải mã ảnh và giới hạn pixel, không chỉ kiểm tra đuôi/MIME do trình duyệt gửi. Xử lý ảnh bằng [Sharp](https://sharp.pixelplumbing.com/) với phiên bản được khóa khi triển khai; tham khảo [cách xuất ảnh và metadata](https://sharp.pixelplumbing.com/api-output/) khi sinh bản hiển thị.
- Sinh ảnh xem trước cạnh dài tối đa 1.600 px và thumbnail cạnh dài tối đa 320 px, không phóng lớn ảnh nhỏ. Tôn trọng hướng xoay; bỏ EXIF/GPS khỏi các bản hiển thị.
- Giữ bản gốc riêng tư để chủ sở hữu có thể tải lại. Bản gốc có thể còn EXIF/GPS, vì vậy người nhà chỉ được lấy biến thể hiển thị của ảnh đã được chia sẻ, không lấy bản gốc hoặc metadata gốc.
- Ảnh biên lai, hợp đồng, giấy tờ tài chính mặc định riêng cho hai chủ sở hữu. Không tự công khai vì cùng nằm trong thư mục ảnh.
- Metadata gồm ID, storage key, tên gốc, MIME đã xác minh, số byte, width/height, checksum, biến thể, trạng thái xử lý, người tải, đối tượng liên kết và quyền.
- Dùng trạng thái `pending` → `ready` hoặc `failed`; tệp tạm được đổi tên atomically sau xử lý. DB và filesystem không có một transaction chung: khi một bên thất bại phải dọn bù, giữ trạng thái lỗi và đối soát, không để metadata `ready` trỏ tới file mất.
- Tệp tạm hoặc pending lỗi quá 24 giờ được dọn bởi job có khóa chống chạy chồng; không xóa tệp ready dựa đơn thuần vào tên/thời gian sửa.
- Giới hạn 2 upload là giới hạn trên server cho toàn ứng dụng, không chỉ là hai ô đang chạy ở giao diện. Trạng thái DB giữ lease của tác vụ và khóa slot; lease được gia hạn khi xử lý. App chết thì tác vụ được đánh dấu cần kiểm tra/thử lại, không mất hàng đợi trong RAM và không tự chạy vô hạn. Chưa cần Redis; HTTP request giữ tiến độ, DB giữ trạng thái để đối soát.
- Thay tệp tạo phiên bản mới. Xóa mềm giữ khôi phục 30 ngày; sau thời hạn, xóa bản gốc/biến thể nếu không còn liên kết. Backup có lịch giữ riêng nên việc xóa không có nghĩa tệp biến mất ngay khỏi mọi backup.
- Endpoint xem/tải kiểm tra phiên và quyền theo từng yêu cầu; đường vật lý không bao giờ thành URL công khai. Nếu dùng link tải tạm, cần cả quyền hợp lệ và thời hạn tối đa 5 phút. Phản hồi riêng tư không cache công khai.

P0 có upload chứng từ cho khoản chi và hạ tầng lưu tệp; P1 bổ sung thư viện lọc theo loại/đối tượng, ảnh nhà cung cấp, bảng ý tưởng, chọn đại diện và sắp xếp. Không trì hoãn tính bền vững hoặc quyền tải tệp tới P1.

**Nghiệm thu:** upload từ điện thoại được; lỗi từng tệp không mất các tệp đã thành công; redeploy container vẫn xem được ảnh; người nhà không đoán ID để lấy ảnh riêng; restore khôi phục cả metadata, bản gốc và thumbnail.

### 17.2. Tìm kiếm — P0, mở rộng P1

P0 tìm trong khách, công việc và khoản chi; P1 mở rộng nhà cung cấp, liên hệ và tiêu đề tài liệu. Không OCR nội dung hợp đồng. Kết quả theo quyền, không để lộ một dòng khớp trong nội dung riêng cho người nhà.

### 17.3. Thông báo — P0

- Trung tâm thông báo gom việc quá hạn, việc đến hạn trong 7 ngày, đợt trả sắp hạn, khách cần liên hệ và dữ liệu thiếu quan trọng.
- Nhắc thanh toán mặc định 7 ngày, 3 ngày và ngày đến hạn; có thể tắt từng khoản. Công việc có thể chọn trước 1/3/7 ngày.
- Sự kiện đã xong/hủy không tiếp tục nhắc. Có đánh dấu đã đọc và tạm ẩn; tạm ẩn không làm công việc thành hoàn tất.
- Trạng thái quá hạn tính khi tải trang, không phụ thuộc một tác vụ chạy nền có đúng giờ hay không.
- Đổi hạn làm vô hiệu thông báo cũ. Khóa chống trùng gồm đối tượng, loại nhắc và mốc hạn; không nhân bản khi chạy lại.
- Email tóm tắt và push không thuộc các mốc hiện tại. Nếu bổ sung sẽ cần cấu hình dịch vụ và kiểm tra chi phí riêng.

## 18. Quy tắc dữ liệu dùng chung và trường hợp lỗi

| Tình huống | Hành vi bắt buộc |
| --- | --- |
| Hai người sửa cùng bản ghi | Dùng phiên bản; nếu dữ liệu đã đổi, báo xung đột, hiện bản mới và bản đang nhập. Không ghi đè âm thầm. |
| Hai người thêm vào bàn/chuyến xe gần đầy | Khóa/kiểm tra ở cơ sở dữ liệu trong giao dịch; chỉ thao tác hợp lệ được lưu. |
| Nhấn lưu nhiều lần hoặc mất phản hồi | Thao tác tài chính, nhập dữ liệu và thao tác hàng loạt có khóa chống trùng. Kiểm tra trạng thái trước khi thử lại. |
| Mất mạng | Thanh trạng thái rõ; không báo đã lưu. Giữ form trong phiên để thử lại. Không tự xếp hàng giao dịch tài chính để gửi ngầm sau đó. |
| Phiên đăng nhập hết hạn | Yêu cầu đăng nhập lại; không mất dữ liệu form còn trong phiên nếu cùng tài khoản đăng nhập lại. |
| Lỗi máy chủ | Thông báo dễ hiểu, mã yêu cầu để tra cứu; không hiện khóa, câu SQL hoặc thông tin người khác. |
| Bản ghi đang được dùng | Chặn xóa gây mất liên kết, cho lưu trữ hoặc hướng dẫn chuyển liên kết. |
| Danh mục bị đổi tên | Đổi nhãn theo ID; lịch sử tài chính giữ phiên bản cần thiết. Không mất liên kết vì so chuỗi tên. |
| Buổi bị hủy | Không tự xóa khách hay giao dịch. Cảnh báo việc, lịch, bàn và hợp đồng liên quan; người dùng chọn xử lý. |
| Khách bị trùng | Đề nghị rà soát/gộp; không tự gộp theo tên. |
| Dữ liệu thiếu | Hiển thị số bản ghi thiếu và đường dẫn bổ sung. Không che bằng tổng trông có vẻ đầy đủ. |
| Giao dịch bị nhập sai | Hủy ghi nhận có lý do hoặc tạo điều chỉnh đúng loại; có thể đối chiếu lịch sử. |
| Thay đổi quyền khi trang còn mở | Yêu cầu tiếp theo bị từ chối; không dựa vào quyền đã lưu ở trình duyệt. |
| Tên có dấu/ký tự đặc biệt | Lưu Unicode, hiển thị nguyên văn; tìm kiếm có thể chuẩn hóa nhưng không sửa tên gốc. |
| CSV/Excel chứa công thức | Không chạy macro/công thức từ file nhập; khi xuất, xử lý text bắt đầu bằng ký tự công thức để tránh thực thi ngoài ý muốn. |

### 18.1. Xóa và khôi phục

- Khách, công việc, nội dung chuẩn bị: lưu trữ hoặc xóa mềm, khôi phục trong 30 ngày. Xóa khách có liên kết quà/giao dịch bị chặn hoặc chuyển sang lưu trữ.
- Sổ tài chính dùng hủy ghi nhận và audit, không có tự động xóa cứng sau 30 ngày.
- Thao tác xóa toàn bộ dữ liệu không nằm trong giao diện sử dụng hằng ngày; cần bản xuất và bước xác nhận cụ thể của chủ sở hữu.
- Nhật ký lưu trong suốt thời gian dùng ứng dụng; không xem là bản sao lưu độc lập.

## 19. Nhập dữ liệu, demo và xuất dữ liệu

### 19.1. Khởi tạo trống — P0

- Không nhập khách/giao dịch/chi phí/ngày mẫu từ file hiện tại.
- Có gói danh mục và checklist gợi ý do người dùng chọn. Danh mục mặc định là cấu trúc, không phải khoản chi thật.
- Demo dùng dữ liệu giả ở môi trường riêng, có nhãn rõ ở mọi trang. Tài khoản và môi trường demo không mở dữ liệu thật.
- Test tự động và ảnh minh họa dùng dữ liệu tổng hợp, không dùng thông tin khách thật.

### 19.2. Nhập dữ liệu thật về sau — P0

Hỗ trợ CSV/XLSX không có macro, tối đa 5 MiB và 5.000 dòng/lần; trước mắt cho khách và khoản chi. Dùng mẫu xuất từ ứng dụng để tránh đoán cột. Chưa có adapter Google Sheets được triển khai: chỉ viết adapter nếu sau này có dữ liệu thật cần nhập từ mẫu khác; không nằm trên đường bắt buộc để phát hành R1.

Quy trình: chọn loại → tải tệp → chọn sheet/cột → xem dữ liệu đã chuẩn hóa → xem lỗi/trùng → chọn sửa hoặc bỏ các dòng lỗi → xem bản nhập cuối → xác nhận.

- Người dùng tự xác nhận định dạng ngày khi có giá trị mơ hồ như `03/04/2028`; không tự đoán.
- Giới hạn sau giải nén XLSX 50 MiB, tối đa 250.000 ô không rỗng và 50 cột trong vùng nhập; giới hạn thời gian đọc 30 giây. Tệp vượt giới hạn bị từ chối trước khi ghi DB. Ô công thức ở cột nhập bị báo lỗi, yêu cầu dán giá trị; không chạy hoặc ngầm tin kết quả cached. Không tải tài nguyên bên ngoài theo liên kết trong workbook.
- `6.530.000` chỉ thành 6.530.000 VND khi cột được xác nhận là tiền theo định dạng Việt Nam. Quà tiền và mô tả hiện vật tách riêng.
- Người chưa phản hồi không trở thành từ chối; ô trống không thành `Không`.
- Mỗi bản ghi có batch ID và dòng nguồn. Một batch được xác nhận và ghi atomically; lỗi kiểm tra hoặc lỗi cơ sở dữ liệu không để nửa batch vào dữ liệu thật.
- Các dòng được chủ động bỏ qua không thuộc batch ghi; có báo cáo để tải xuống.
- Nhập lại tệp chỉ gợi ý trùng; không tự cập nhật hồ sơ cũ. Có chế độ cập nhật bằng ID do chính ứng dụng xuất, với xem trước và kiểm tra phiên bản.
- Có hoàn tác batch nếu bản ghi chưa bị chỉnh hoặc phát sinh liên kết. Nếu đã có liên kết, liệt kê cần xử lý thay vì xóa cưỡng bức.
- Kiểm tra cả thay đổi gián tiếp khi hoàn tác: nhóm thiệp/tham dự được tạo cùng batch không ngăn hoàn tác nếu chưa ai sửa; bàn/quà/giao dịch tạo về sau thì phải chặn và liệt kê. Batch đang nhập không được xác nhận hai lần.
- Tệp nhập tạm riêng tư tự xóa sau 7 ngày; chỉ giữ báo cáo cần thiết và nhật ký, không giữ vô hạn tệp chứa thông tin khách.

### 19.3. Xuất — P0, mở rộng P1/P2

- CSV/XLSX: danh sách khách, nhóm thiệp, ngân sách, đợt trả, giao dịch, công việc; mở rộng quà và các phần chuẩn bị ở mốc tương ứng.
- Bản in/PDF qua chế độ in: danh sách theo bàn, thực đơn/suất, lịch trình, checklist, liên hệ vận hành. Kiểm tra phân trang A4 và dấu tiếng Việt.
- `.ics`: lịch đã chọn, có múi giờ và UID ổn định. Nêu rõ là bản sao, không đồng bộ.
- Mỗi file có thời điểm xuất, buổi/bộ lọc và giải thích các cột tiền. Có lựa chọn toàn bộ hoặc theo bộ lọc, mặc định theo bộ lọc hiện tại và ghi rõ số dòng.
- Người nhà chỉ tạo bản in được phép; không dùng API xuất của chủ sở hữu.
- Xuất đầy đủ để lưu trữ gồm dữ liệu có schema/version và tệp đính kèm; định dạng này dùng cho khôi phục, khác với bảng Excel để xem.

## 20. Mô hình dữ liệu đề xuất

Một cơ sở dữ liệu cho một đám cưới. Không cần thiết kế tenant, gói thuê bao hoặc quản lý nhiều đám cưới. Dùng quan hệ chuẩn hóa cho người, buổi, tiền và chỗ ngồi; trường tùy chọn ít quan trọng có thể dùng JSON có schema, không dùng JSON để che quan hệ tài chính.

### 20.1. Các bảng/nhóm bảng

| Nhóm | Bảng chính | Trách nhiệm |
| --- | --- | --- |
| Tài khoản | Các bảng xác thực do Better Auth quản lý; `profiles`, `memberships`, `member_event_access`, `member_invites` | Phiên đăng nhập, danh tính Google, vai trò, buổi được xem, lời mời; liên kết bằng ID xác thực ổn định. |
| Thiết lập | `wedding_settings`, `events`, `guest_groups` | Thông tin cưới dạng singleton, buổi đại diện, các buổi, danh mục quan hệ. |
| Khách | `guests`, `invitations`, `invitation_members`, `attendance`, `contact_followups` | Người, nhóm thiệp theo buổi, tham dự, lịch liên hệ. |
| Bàn | `tables`, `table_assignments` | Bàn theo buổi, sức chứa và gán người. |
| Ngân sách | `budget_categories`, `category_budgets`, `cost_items` | Danh mục, phân bổ, dự toán/giá chốt/quyết toán. |
| Thanh toán | `fund_settings`, `payment_schedules`, `payments`, `payment_allocations`, `funding_entries` | Mốc/số dư mở sổ, đợt, giao dịch/hoàn, phân bổ và trả trước, nguồn tiền. |
| Quà | `gifts`, `gift_contributors`, `gift_returns` | Một quà nhiều người gửi, trả lại quà/tiền có liên kết, trạng thái nhận/cảm ơn. |
| Công việc | `tasks`, `task_checklist_items`, `task_dependencies`, `appointments` | Việc, việc con, phụ thuộc, lịch hẹn tự tạo. |
| Nhà cung cấp | `vendors`, `vendor_quotes`, `contacts` | Nhà cung cấp/địa điểm, phiên bản báo giá, đầu mối dùng chung. |
| Tiệc và hậu cần | `menus`, `menu_items`, `event_handover_versions`, `accommodations`, `transport_trips`, `transport_assignments` | Thực đơn, snapshot bàn giao theo phiên bản, chỗ ở, xe và gán người. |
| Ngày cưới | `timeline_items`, `support_assignments` | Lịch trình, vai trò và đầu việc đội hỗ trợ. |
| Nội dung chuẩn bị | `preparation_items` | Bốn loại có schema riêng: nhạc, cảnh chụp, đồ dùng, ý tưởng. |
| Tệp và hệ thống | `attachments`, `attachment_variants`, `audit_logs`, `notifications`, `idempotency_records`, `import_batches`, `import_rows` | Metadata/storage key tệp và biến thể trên server, trạng thái/lease xử lý, thay đổi, nhắc, chống trùng, nhập dữ liệu và lỗi. |

### 20.2. Quy ước và ràng buộc

- ID UUID; `created_at`, `updated_at`, người tạo/sửa và `version` cho bản ghi được chỉnh đồng thời.
- Thời điểm lưu UTC với kiểu có múi giờ; ngày hạn không có giờ lưu kiểu date. Khi hiển thị và tính quá hạn dùng múi giờ đám cưới.
- Tiền dùng `bigint` VND với giới hạn nhập nghiệp vụ hợp lý; chuyển qua API dạng chuỗi số nguyên để tránh mất chính xác.
- `attendance` duy nhất theo `(guest_id, event_id)`; ràng buộc nhóm thiệp bảo đảm một người chỉ thuộc một nhóm trong cùng buổi.
- `table_assignments` duy nhất theo `(guest_id, event_id)`; bàn và tham dự phải cùng buổi. Kiểm tra sức chứa trong transaction, không chỉ `CHECK` trên một hàng.
- Số lượng, sức chứa không âm; giờ kết thúc sau giờ bắt đầu; email/số điện thoại khách không đặt unique toàn cục vì có liên hệ gia đình dùng chung.
- Tiền hoàn, phân bổ và tổng lịch trả có kiểm tra tổng hợp trong giao dịch/DB function; không dùng dữ liệu tổng do trình duyệt gửi lên làm sự thật.
- Dữ liệu liên quan tiền, quyền, gán chỗ hoặc cập nhật nhiều bảng đi trong transaction. Audit quan trọng ghi cùng transaction.
- Không lưu tổng dashboard như các ô cho người dùng sửa. Tính bằng truy vấn/SQL view cùng một định nghĩa nghiệp vụ.
- Khóa ngoại và quy tắc không xóa dây chuyền dữ liệu tài chính phải được khai báo trong migration.
- Các liên kết tệp và nội dung chuẩn bị theo loại có kiểm tra đối tượng đích tồn tại và người dùng có quyền; không tin ID trần từ trình duyệt.
- Các trường ghi chú riêng tách khỏi nội dung chia sẻ. DTO cho người nhà chỉ chứa trường được phép, không gửi cả bản ghi rồi giấu bằng CSS.
- Khóa chống trùng gồm người dùng, loại thao tác và UUID yêu cầu; lưu hash payload cùng kết quả trong transaction nghiệp vụ. Cùng khóa/cùng payload trả kết quả cũ; cùng khóa/khác payload trả xung đột, không tạo tiền mới. Kiểm tra quyền hiện tại trước khi trả kết quả cũ. Giữ khóa 30 ngày; ràng buộc batch/nguồn báo giá/giao dịch đối ứng vẫn tồn tại lâu dài theo ID để ngăn trùng nghiệp vụ.

### 20.3. Chốt schema theo từng mốc, không xây tất cả cùng lúc

G2–G6 chỉ migrate các bảng của R1 và phụ thuộc tối thiểu. R1 có danh mục bữa ăn/lưu trú đơn giản và đầu mối nhà cung cấp tối thiểu để khoản chi/khách không phụ thuộc màn hình R2; R2 mới thêm so sánh báo giá, menu đầy đủ, bàn và hậu cần. R3 mới thêm quà, lịch trình và điểm danh. Không tạo hàng chục màn hình rỗng hoặc tầng abstraction cho các tính năng chưa tới mốc.

Trước khi lập trình một mốc phải có dictionary trường cụ thể cho mốc đó: kiểu, null/default, enum, khóa ngoại, unique, kiểm tra và quyền; sơ đồ quan hệ; danh sách command/query; input/output và lỗi. Bảng mục 20.1 là bản đồ khái niệm, không giả là migration/schema cuối cùng.

## 21. Kiến trúc và công nghệ đề xuất

### 21.1. Lựa chọn mặc định

| Thành phần | Lựa chọn | Lý do |
| --- | --- | --- |
| Ứng dụng | Next.js App Router + TypeScript, một codebase. | Có giao diện và xử lý máy chủ cùng nơi; không cần tách nhiều dịch vụ cho hai người dùng chính. |
| Giao diện | Tailwind CSS và component dựa trên shadcn/ui; biểu mẫu được kiểm tra schema. | Tạo màn hình nhất quán, thao tác bàn phím và điện thoại có thể kiểm thử. |
| Dữ liệu | PostgreSQL chạy Docker trên server Linux của bạn. | Quan hệ rõ cho người/buổi/tiền; dữ liệu bền vững ngoài container, không cần Supabase. |
| Đăng nhập | Better Auth + Google OAuth, session lưu PostgreSQL, chỉ cho thành viên được mời. | [Google provider](https://better-auth.com/docs/authentication/google) và [PostgreSQL adapter](https://better-auth.com/docs/adapters/postgresql); không tự xây lưu mật khẩu. |
| Tệp | Filesystem bền vững `/srv/wedding/data/uploads`, metadata trong PostgreSQL. | Upload trực tiếp lên server, kiểm tra quyền qua ứng dụng, không cần object storage để chạy bản chính. |
| Xử lý ảnh | Sharp ở phía server, biến thể sinh khi upload. | Ảnh nhẹ để xem trên điện thoại; bản gốc và biến thể đều được bảo vệ theo quyền. |
| Hosting | Server Linux và Docker Compose có sẵn. | Không thuê Vercel hay gói Supabase; dùng tên miền HTTPS đã có. |
| Reverse proxy | Tích hợp vào reverse proxy đang quản lý HTTPS của bạn. | Chỉ thêm route/subdomain riêng, giữ nguyên các website hiện hữu; nếu chưa có proxy tương thích mới cân nhắc Caddy/Nginx. |
| Kiểm thử | Unit/integration cho nghiệp vụ và DB; Playwright cho luồng chính. | Kiểm chứng số liệu, quyền và thao tác thật, thay vì chỉ chụp giao diện. |
| Triển khai | Git, Docker image có tag cố định, Docker Compose, migration SQL; demo/production tách database, thư mục và secret. | Có thể quay lại bản mã và thử dữ liệu giả trước khi thay bản thật. |

Phiên bản thư viện cụ thể chốt khi bắt đầu lập trình, dùng bản ổn định còn hỗ trợ tại thời điểm đó, có lockfile và ghi lại phiên bản. Không coi phiên bản hiện tại là quyết định bất biến tới 2028.

### 21.2. Luồng xử lý

Trình duyệt → yêu cầu máy chủ đã xác thực → kiểm tra vai trò/phạm vi → kiểm tra schema → transaction nghiệp vụ → dữ liệu + audit → phản hồi → cập nhật danh sách và chỉ số liên quan.

- Không đưa token OAuth, cookie secret hoặc thông tin kết nối DB vào mã phía trình duyệt. Không có Supabase service-role key trong kiến trúc này.
- Endpoint cho thành viên được mời kiểm tra danh tính ở máy chủ; tắt hoặc chặn đường tạo thành viên ngoài danh sách cho phép.
- Các truy vấn tài chính và thông tin khách riêng không cache công khai. Nếu cache theo tài khoản, khóa cache phải gồm quyền và phạm vi truy cập, được vô hiệu khi thu hồi quyền.
- Đồng bộ hai thiết bị: tải lại khi tab được focus và kiểm tra thay đổi tối đa mỗi 30 giây khi trang đang hiển thị. Sau thao tác của chính mình cập nhật ngay khi máy chủ xác nhận. Chưa cần Realtime hoặc cộng tác kiểu Google Docs.
- Phần nhắc việc trên màn hình tính trực tiếp. Job nền chỉ dùng cho sao lưu/thu dọn, không dùng cho thao tác bắt buộc chính xác từng phút trong ngày cưới.
- Bảo vệ yêu cầu ghi theo cơ chế của framework và kiểm tra Origin/CSRF cho các endpoint phù hợp; rate limit đăng nhập, lời mời, tải tệp, nhập/xuất.
- Có health check không lộ thông tin, logging lỗi đã lọc thông tin cá nhân, timeout và giới hạn kích thước yêu cầu.
- Tài khoản DB chạy ứng dụng không là superuser, không sở hữu các bảng nghiệp vụ và không có `BYPASSRLS`. Role migration tách riêng. Chính sách RLS nhận ID người dùng đã xác minh do server đặt trong transaction qua `SET LOCAL`; không nhận role/ID người dùng tự khai từ request và không để context rò sang kết nối tái sử dụng.
- Mọi truy vấn nghiệp vụ có cùng wrapper transaction/context; thiếu ID đã xác thực thì mặc định từ chối, kể cả truy vấn đọc. Dùng `pg` với truy vấn tham số hóa, không ghép chuỗi input thành SQL. RLS bảo vệ hàng, không tự giấu cột riêng: DTO/query chia sẻ phải chọn rõ cột. View nghiệp vụ có `security_invoker=true`; không cấp đường đi qua view/function chạy quyền owner rồi bỏ qua policy. Quy trình backup dùng role riêng có quyền đọc đủ dữ liệu, không dùng role của một chủ sở hữu rồi vô tình chỉ backup một phần.
- Auth adapter dùng schema/quyền cần thiết riêng, không dựa vào RLS của bảng nghiệp vụ để bảo vệ bảng session. Không có cổng PostgreSQL cho trình duyệt hoặc Internet; chỉ dịch vụ được cấp quyền trong mạng Docker nội bộ mới kết nối.

Tham chiếu [RLS PostgreSQL](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) và [quyền thực thi view](https://www.postgresql.org/docs/current/sql-createview.html). Chính sách membership phải tránh truy vấn vòng lại chính bảng membership gây đệ quy; cách triển khai phải có test cho role thật, truy vấn không có context và tái sử dụng pool giữa chủ sở hữu/người nhà.

### 21.3. Cấu trúc mã dự kiến

```text
src/app/                 routes và khung ứng dụng
src/features/            guests, budget, tasks, seating, timeline, ...
src/components/          thành phần giao diện dùng chung
src/lib/auth/            phiên đăng nhập, quyền, DTO
src/lib/db/              truy vấn và ranh giới transaction
src/lib/validation/      schema kiểm tra dữ liệu
src/lib/import-export/   đọc dữ liệu và các adapter
db/migrations/           schema, ràng buộc, RLS, DB functions
src/lib/storage/         upload, kiểm tra quyền, biến thể ảnh, đối soát tệp
ops/                     Compose, Dockerfile, proxy mẫu, backup/restore
tests/unit/              quy tắc đếm, tiền, ngày
tests/integration/       DB, quyền, đồng thời, batch nhập
tests/e2e/               các luồng thao tác chính
docs/                    đặc tả, vận hành, khôi phục, thay đổi
```

### 21.4. Bố trí Docker trên server hiện có

```text
Điện thoại / máy tính
        |
Tên miền HTTPS + reverse proxy hiện có
        |
Ứng dụng Next.js (Docker, cổng nội bộ)
        |                          |
PostgreSQL (Docker nội bộ)    /data/uploads (mount bền vững)
        |                          |
/srv/wedding/data/postgres    /srv/wedding/data/uploads
        +----------- backup nhất quán -----------+
                            |
                 Bản sao mã hóa ngoài server
```

- Compose riêng tên dự án `wedding`, mặc định có `app`, `db`; xử lý ảnh trong app có hàng đợi giới hạn đồng thời. Không cần Redis, MinIO hay Kubernetes cho phạm vi này.
- Nếu proxy hiện tại cũng là Docker, kết nối app vào mạng proxy phù hợp; nếu proxy chạy trên host, publish cổng app chỉ vào `127.0.0.1` tại một cổng còn trống. Không expose app bằng `0.0.0.0` khi không cần.
- Giữ tên miền/cấu hình HTTPS hiện có; hostname cụ thể chốt khi triển khai. Google OAuth phải có callback đúng HTTPS origin của app và tách khỏi localhost/demo.
- Mặc định triển khai ở root của một subdomain riêng, không mặc định ghép dưới `/wedding` của ứng dụng khác; chọn hostname thật trước G2. Cấu hình OAuth `baseURL`, callback và trusted origins cố định; cookie theo host, Secure/HttpOnly và chính sách SameSite phù hợp OAuth. Chỉ tin forwarded headers từ proxy được kiểm soát, không mở trusted origins bằng wildcard toàn miền.
- Xử lý upload bằng Route Handler chạy Node.js với streaming/giới hạn byte; không đi qua một Server Action có body limit nhỏ mặc định. Kiểm tra giới hạn/timeout ở proxy và app bằng tệp cỡ tối đa.
- Container app chạy người dùng không root; chỉ được ghi các thư mục dữ liệu/tạm cần thiết. Tệp runtime và ảnh không trộn với mã/image.
- PostgreSQL, uploads, cấu hình quan trọng và secret được mount từ đường dẫn riêng. Đường dẫn là cấu hình nhưng không nằm trong vùng bị thay thế khi deploy.
- Cấu hình restart và health check; app thử lại kết nối DB có giới hạn, trả trạng thái lỗi rõ nếu DB chưa sẵn sàng. Không coi container `running` là ứng dụng khỏe.
- Rotate log để không tăng vô hạn; log không chứa ảnh, token, chuỗi kết nối hoặc toàn bộ thông tin khách.
- Không thực hiện `docker compose down -v`, prune volume hoặc xóa thư mục dữ liệu trong quy trình cập nhật chuẩn. Bản hướng dẫn phải ghi rõ thao tác nào chỉ thay mã, thao tác nào hủy dữ liệu.
- Tôn trọng firewall, cổng và dịch vụ đang chạy trên server. Chưa được cung cấp truy cập server và chưa triển khai gì trong bước lập plan.

[Next.js hướng dẫn đặt reverse proxy khi tự host](https://nextjs.org/docs/app/guides/self-hosting). [Docker mô tả lưu trữ bền vững bằng volume](https://docs.docker.com/engine/storage/volumes/); phương án này dùng bind mount với đường dẫn host rõ ràng để kiểm soát backup và không phụ thuộc vòng đời container. Nếu cần proxy mới, [Caddy hỗ trợ tự quản lý HTTPS](https://caddyserver.com/docs/automatic-https), nhưng không cài thêm hoặc thay proxy đang có chỉ vì plan dùng ví dụ đó.

### 21.5. Quy trình phát hành và quay lại

1. Build/test image từ mã đã chốt ở máy phát triển hoặc runner riêng; gắn tag phiên bản cụ thể, không dựa vào `latest` để rollback.
2. Chạy thử trên demo dùng database và thư mục ảnh riêng. Demo vẫn không chứa dữ liệu thật.
3. Tạo backup đầy đủ; kiểm tra backup thành công trước thay đổi schema hoặc dữ liệu thật.
4. Chạy migration bằng role riêng, có kế hoạch tương thích giữa schema cũ/mới. Không tự tạo lại DB khi container khởi động.
5. Cập nhật container app, kiểm tra đăng nhập, khách, một phép tính tiền và ảnh cũ/mới. Chỉ hoàn tất phát hành khi health check và smoke test đạt.
6. Nếu chỉ mã lỗi và schema còn tương thích, quay lại image trước. Nếu schema không tương thích, thực hiện kế hoạch migration bù hoặc restore đã thử; không hứa chỉ đổi image là khôi phục được mọi trường hợp.
7. Xác nhận ảnh và dữ liệu còn nguyên sau redeploy, restart container và restart server. Lưu biên bản phiên bản, migration và bản backup tương ứng.

## 22. Sao lưu, vận hành và thời gian dùng tới 2028

### 22.1. Sao lưu và khôi phục

- Mục tiêu RPO: mất tối đa 24 giờ dữ liệu nếu cần khôi phục từ backup định kỳ. Đây là mục tiêu; chỉ được coi đã đạt sau khi job và restore thử thành công.
- Mục tiêu RTO: khôi phục trong 4 giờ cho quy mô thiết kế, có người quản trị đủ quyền và dịch vụ hoạt động. Thời gian thực tế phụ thuộc nhà cung cấp; không phải SLA cam kết.
- Sao lưu dữ liệu và tệp sang nơi độc lập, mã hóa. Lưu bản hằng ngày 7 ngày và bản hằng tuần 12 tuần; chủ sở hữu có quyền lấy bản sao, không chỉ người phát triển giữ.
- Không lưu bản sao chứa dữ liệu thật vào Git hoặc môi trường demo. Khóa mã hóa/cách truy cập phải được bàn giao riêng cho chủ sở hữu.
- Kiểm tra bản sao theo lịch; nếu quá 26 giờ chưa có bản thành công, hiện cảnh báo chủ sở hữu khi vào ứng dụng và cảnh báo vận hành.
- Diễn tập restore trước R1, trước mốc khóa danh sách khách và trước tuần cưới. Đối chiếu số bản ghi, tổng tiền, liên kết và mẫu tệp mở được.
- Trước nhập hàng loạt, đổi schema hoặc cập nhật bản lớn, tạo bản sao và xác nhận đã hoàn tất.
- File Excel xuất tay không thay thế backup có quan hệ/ID và tệp.

Với server tự quản lý, backup gồm database PostgreSQL, bản gốc/biến thể ảnh, tài liệu, manifest checksum, phiên bản schema và cấu hình cần để dựng lại. Không copy trực tiếp thư mục PostgreSQL đang chạy rồi mặc định đó là backup hợp lệ.

- Job mặc định chạy hằng ngày bằng systemd timer trên host, có khóa chống chạy chồng; lịch theo múi giờ đám cưới, không phụ thuộc trình duyệt đang mở.
- Với quy mô ứng dụng này, dùng dump nhất quán `pg_dump -Fc`, khôi phục bằng `pg_restore`, kiểm tra phiên bản client tương thích; tham khảo [tài liệu PostgreSQL](https://www.postgresql.org/docs/current/app-pgdump.html). Roles/quyền cần để dựng lại được quản lý bằng cấu hình/migration, không giả định một dump đã chứa toàn bộ cấu hình PostgreSQL của host.
- Trong cửa sổ backup, bật rào chặn ghi nghiệp vụ ở server/DB cho mọi đường ghi, kể cả job thu dọn, đổi quyền, batch nhập và upload; chờ transaction/upload đang chạy kết thúc rồi lấy dump + bản sao file cùng manifest vào staging riêng. Giữ cả file xóa mềm còn trong hạn khôi phục, không chỉ file ready đang được liên kết. Copy trực tiếp thư mục PostgreSQL đang chạy không thay bước dump này.
- Rào có job ID và lease được gia hạn, khóa chạy chồng, deadline 5 phút cho bước tạo tập staging. Không xong trong hạn thì hủy lần backup, báo thất bại và giải phóng rào sau khi chắc tiến trình snapshot đã dừng. Nếu lease mất giữa chừng, snapshot bị coi không hợp lệ. Upload bị từ chối trả lỗi bảo trì và giữ form, không giả đã lưu.
- Auth có thể refresh session khi đọc; nó không được coi là thay đổi nghiệp vụ. Không ép toàn bộ database vào read-only làm hỏng đăng nhập. Notification sinh từ dữ liệu sẵn có, job và thao tác đánh dấu đọc được hoãn trong cửa sổ chụp. Sau khi staging nhất quán hoàn tất, mở lại ghi rồi mới chuyển staging mã hóa ra ngoài server; không khóa người dùng suốt thời gian truyền ảnh qua mạng.
- Dùng restic để mã hóa và chuyển tập backup sang đích ngoài server, ưu tiên máy khác qua SFTP hoặc object storage do bạn chọn; [restic hỗ trợ repository từ xa](https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html). Không cần chạy object storage trên server ứng dụng chỉ để phục vụ ảnh.
- Lưu một bản khác thư mục nhưng cùng server chỉ hỗ trợ lỗi thao tác, không chống mất server/ổ đĩa. Chưa có đích ngoài server thì chưa đạt điều kiện backup bản thật của R1.
- Restore thử trên database và thư mục ảnh tách biệt, đối chiếu manifest; không thử ghi đè bản đang dùng. Phải tải được ảnh gốc và thumbnail sau restore, không chỉ đếm được dòng DB.
- Sau restore thật phải vô hiệu toàn bộ session và token lời mời trong bản khôi phục, kiểm tra lại hai chủ sở hữu và giữ quyền người nhà ở trạng thái chờ xác nhận lại. Chỉ mở Internet sau bước này để không hồi sinh quyền/phiên đã thu hồi sau thời điểm backup. Không cho restore thử tự gửi thông báo hay tác động production.

### 22.2. Không có mạng trong ngày cưới

- Có nút tải/xuất bộ bàn giao trước buổi. Chủ sở hữu chủ động giữ bản trên điện thoại hoặc bản giấy.
- Web không nhận sửa offline trong bản này; tránh tạo hai sổ tiền hoặc hai sơ đồ bàn mâu thuẫn.
- Trường hợp mạng mất: tra bản bàn giao và ghi phát sinh ngoài ứng dụng, cập nhật lại khi mạng ổn định với thời điểm thực tế và người nhập.
- Bản bàn giao có ngày giờ xuất để không dùng nhầm phiên bản. Ghi rõ người chịu trách nhiệm cập nhật cuối cùng trước khi phát ra.

### 22.3. Bảo trì đến và sau đám cưới

- Mỗi tháng kiểm tra backup, dung lượng và lỗi. Mỗi quý kiểm tra dependency/security, đăng nhập và diễn tập luồng cốt lõi trên điện thoại.
- Trước khi cưới 60 ngày: rà soát server, gia hạn tên miền/chứng chỉ, backup ngoài máy và tài khoản, kiểm thử đăng nhập của cả hai người.
- Trước 14 ngày: diễn tập lịch trình, bàn, suất ăn và bộ bản in với số liệu thật đã chốt.
- Trước 7 ngày: hạn chế thêm tính năng; chỉ sửa lỗi ảnh hưởng vận hành, mọi cập nhật phải có backup và đường quay lại.
- Sau cưới 30 ngày: đối chiếu tài chính và công việc còn mở. Không tự đóng sổ nếu còn khoản đang tranh chấp hoặc chưa nhận hoàn.
- Sau khi hoàn tất: xuất lưu trữ, thu hồi quyền không cần thiết, chọn giữ web chỉ đọc hoặc tắt dịch vụ có backup độc lập.

## 23. Hiệu năng, khả dụng và chất lượng

Mục tiêu kiểm thử: 2.000 hồ sơ khách, 5 buổi, 10.000 dòng tham dự, 200 bàn, 1.000 khoản chi, 5.000 giao dịch, 2.000 công việc, 20 tài khoản người nhà; thường xuyên 2 người chỉnh và tối đa 10 phiên đang xem. Đây là dữ liệu thử, không phải dự đoán quy mô đám cưới của bạn.

| Hạng mục | Tiêu chí chấp nhận |
| --- | --- |
| Tải trang | Luồng chính dùng được trong khoảng 3 giây với mạng 4G ổn định ở điện thoại thử; đo riêng lần đầu và lần sau. |
| Truy vấn | Danh sách phân trang phía máy chủ; mục tiêu p95 yêu cầu đọc thông thường ≤ 1 giây ở môi trường đo đã ghi cấu hình; lần đánh thức dịch vụ báo riêng. |
| Lưu | Lưu bản ghi thông thường mục tiêu p95 ≤ 2 giây; có trạng thái đang xử lý và chống nhấn lặp. |
| Tìm kiếm | Có debounce khoảng 300 ms, hủy bỏ phản hồi cũ để không hiện kết quả sai khi gõ nhanh. |
| Dữ liệu | Không tính tiền bằng float; không đếm trùng người/buổi; số liệu chi tiết và tổng hợp khớp. |
| Thiết bị | Chrome/Edge desktop, Chrome Android, Safari iPhone; kiểm tra ít nhất 360 px, 390 px, 768 px, 1440 px. |
| Trợ năng | Kiểm tra tương phản chữ thông thường mục tiêu ≥ 4,5:1, focus rõ/không bị che, form có label, không bắt buộc kéo thả; theo UI_UX_SPEC mục 11, không tự nhận đạt chuẩn chỉ vì dùng component library. |
| In | A4 ngang/dọc theo tài liệu, tiêu đề cột lặp, không cắt tên/số tiền, không in nút và menu. |
| Lỗi | Không để exception làm mất form; lỗi tài chính không để ghi dữ liệu nửa chừng. |
| Quyền | Không có đường đọc/sửa tài chính hay dữ liệu khách riêng bằng tài khoản chỉ xem. |

Không cam kết uptime theo phần trăm khi chưa chọn gói có SLA. Giảm phụ thuộc vào uptime bằng bộ tài liệu bàn giao và backup được kiểm chứng.

Chất lượng UI/UX còn phải đạt các UXT theo mốc trong UI_UX_SPEC mục 15: hoàn thành tác vụ không cần chỉ sẵn nút, phân biệt đúng người/thiệp/ghế/suất và các loại tiền, giữ trạng thái khi lỗi/Back, không còn lỗi UX nghiêm trọng/cao trước phát hành. Mục tiêu thời gian trong UXT là chỉ tiêu kiểm chứng ban đầu, chưa phải số đo đã đạt.

## 24. Lộ trình, phụ thuộc và ước lượng

Các con số sau là ước lượng kỹ thuật cho một người triển khai có kinh nghiệm, khoảng 6 giờ tập trung/ngày. Chưa phải cam kết lịch giao. Không tính thời gian chờ bạn góp ý, duyệt thiết kế, tạo tài khoản, nhà cung cấp gián đoạn hoặc thay đổi phạm vi.

| Giai đoạn | Việc cần hoàn thành | Phụ thuộc | Ước lượng |
| --- | --- | --- | --- |
| G0 | Chốt đặc tả R1, dictionary trường/enum, sơ đồ quan hệ, command/query + lỗi, fixture và expected result của các test cốt lõi; chốt phạm vi P1/P2. Không xây adapter cho Sheet mẫu. | Không. | 2–3 ngày. |
| G1 | Token/component gallery; prototype HTML bấm được cho 6 màn chính desktop/mobile + state rỗng/lỗi/chỉ xem; luồng và fixture theo UI_UX_SPEC mục 14; thử tác vụ với người dùng, sửa lỗi UX nghiêm trọng/cao. R2/R3 ở đây là prototype, không phải module đã lưu dữ liệu thật. | G0. | 4–6 ngày. |
| G2 | Khởi tạo mã, schema, Auth, quyền, RLS, audit, lỗi chung, Docker/môi trường demo/production, nền tảng upload bền vững. | G0, G1. | 3–5 ngày. |
| G3 | Thiết lập, khách, nhóm thiệp, tham dự theo buổi, tìm kiếm, quyền xem. | G2. | 3–5 ngày. |
| G4 | Ngân sách, lịch trả/trả trước, giao dịch, hủy dịch vụ, hoàn tiền, mốc quỹ, nguồn góp/trả hộ, phép tính và chống trùng. | G2. | 5–8 ngày. |
| G5 | Công việc, checklist, lịch, đổi ngày, nhắc trong ứng dụng, tổng quan từ dữ liệu thật. | G3, G4. | 2–4 ngày. |
| G6 | Import/export cốt lõi, backup nhất quán DB/tệp, restore và vô hiệu phiên cũ, kiểm thử quyền và chạy thử R1. | G3–G5. | 4–6 ngày. |
| G7 | Nhà cung cấp/địa điểm, báo giá, thư viện ảnh/tài liệu và các biến thể. | G4, G6. | 3–4 ngày. |
| G8 | Xếp bàn, menu, chốt/bàn giao theo phiên bản, lưu trú/xe, kiểm thử sức chứa và đồng thời. | G3, G7. | 4–6 ngày. |
| G9 | Ý tưởng, đồ dùng, nhạc/ảnh, đội hỗ trợ; nghiệm thu R2. | G7, G8. | 2–3 ngày. |
| G10 | Lịch trình ngày cưới, điểm danh tùy chọn, quà/cảm ơn, bộ bàn giao và lưu trữ. | G6, G8, G9. | 2–4 ngày. |
| G11 | Kiểm thử tổng thể, chạy trên thiết bị thật, diễn tập mất mạng/restore, tài liệu bàn giao; nghiệm thu R3. | Tất cả. | 3–5 ngày. |

Tổng dự kiến sau bổ sung UI/UX: 37–59 ngày triển khai, tương đương khoảng 222–354 giờ, khoảng 8–12 tuần làm việc đầy đủ. R1 khoảng 23–37 ngày theo các giai đoạn G0–G6, đã bao gồm thiết kế/prototype UX, Docker, upload bền vững, kiểm thử và backup cốt lõi. Đây là baseline ước lượng, không có cơ sở hứa một ngày giao cụ thể trước khi xong G0/G1. Phần tự quản lý auth, file, phân quyền và khôi phục chiếm công đáng kể; không bỏ kiểm tra quyền hoặc tiền để đạt một mốc nhanh hơn. G7–G10 bao gồm cụ thể hóa các màn mở rộng theo mẫu đã chốt trước khi code, không yêu cầu code cả 35 màn ngay trong G1.

### 24.1. Cổng nghiệm thu

- Sau G1: đủ đầu ra tại UI_UX_SPEC mục 14: sáu màn chính, desktop/mobile, state cần thiết, component gallery và prototype bấm được; chạy UXT thuộc G1, ghi vấn đề và sửa lỗi nghiêm trọng/cao. Không chỉ duyệt một ảnh tĩnh rồi coi luồng đã xong.
- Không coi plan là đã chốt giao diện hoặc schema vật lý: G0/G1 phải xuất ra các tài liệu ở mục 20.3 và prototype có luồng rỗng/lỗi/xung đột. Khi tới R2/R3, bổ sung dictionary và hợp đồng cho phần mới trước khi code; giữ nguyên các quy tắc đã chốt của R1.
- Sau G4: kiểm tra bộ ví dụ tài chính bằng tay và test tự động, sửa sai số trước khi ghép dashboard.
- Trước R1: mọi test cốt lõi về khách/tiền/quyền qua; backup và restore đã thử; bản thật trống, demo riêng; hai chủ sở hữu đăng nhập thành công.
- Thứ tự ưu tiên trong R1 là tính đúng và quyền trước, dữ liệu trước dashboard. Không đưa dữ liệu mẫu vào bản thật chỉ để trình diễn tiến độ.
- Trước R2: bàn/ghế/suất khớp danh sách; nhà cung cấp không tạo chi phí trùng; bản in đúng quyền.
- Trước R3: diễn tập một buổi cưới giả hoàn chỉnh, mất mạng dùng bản bàn giao, sau đó cập nhật và đóng sổ.
- Trước mỗi R1/R2/R3: chạy các UXT thuộc mốc trên bản dựng đã lưu bền vững, kiểm tra thiết bị thật và bản in liên quan. Prototype không thay test chức năng; tài liệu mô tả không thay review hình ảnh thực tế.

### 24.2. Phân công trách nhiệm

- Bạn và người cùng quản lý: cung cấp thông tin thực tế, quyết định phong cách/luồng, kiểm tra biểu mẫu với cách làm của gia đình, chọn dữ liệu chia sẻ và xác nhận nghiệm thu.
- Người triển khai: đặc tả kỹ thuật, xây dựng, migration, kiểm thử, kiểm tra quyền, thiết lập backup/khôi phục và hướng dẫn vận hành.
- Tài khoản hosting, DB, tên miền và bản backup phải thuộc quyền kiểm soát của bạn; không phụ thuộc tài khoản cá nhân duy nhất của người triển khai.
- Chưa cần bạn có đủ ngày cưới, khách hay ngân sách để bắt đầu G0–G2. Dùng dữ liệu tổng hợp để làm và kiểm thử.

## 25. Bộ kịch bản nghiệm thu bắt buộc

Khi triển khai, mỗi kịch bản phải được cụ thể hóa bằng dữ liệu đầu vào xác định, kết quả mong đợi, người chạy và bằng chứng; bảng dưới đây là yêu cầu nghiệm thu, chưa phải các test đã chạy. Test tự động dành cho nghiệp vụ/quyền/DB; review thủ công dành cho bố cục, dùng trên điện thoại và bản in.

| Mã | Kịch bản | Kết quả đạt |
| --- | --- | --- |
| AT01 | Tạo đám cưới chưa có ngày, ngân sách, khách. | Không có dữ liệu mẫu, không có ngày/số đếm tự gán, thêm dữ liệu được. |
| AT02 | Hai chủ sở hữu đăng nhập; email lạ đăng nhập. | Hai người có quyền đúng; email lạ không có dữ liệu/quyền thành viên. |
| AT03 | Người nhà thử URL/API/tệp/export tài chính. | Bị từ chối ở máy chủ/DB, không rò metadata riêng. |
| AT04 | Thu hồi quyền người nhà đang mở trang. | Yêu cầu tiếp theo bị từ chối; không tiếp tục tải dữ liệu bằng phiên cũ. |
| AT05 | Một người được mời hai buổi. | Hai trạng thái tham dự độc lập; tổng người duy nhất không nhân đôi. |
| AT06 | Gia đình 4 người, một thiệp, tham dự không đồng đều. | Thiệp/người/ghế/suất ăn đúng định nghĩa mục 8. |
| AT07 | Trẻ em/em bé không cần ghế hoặc suất. | Headcount, ghế và suất khác nhau đúng cấu hình. |
| AT08 | Trùng tên và số điện thoại gia đình dùng chung. | Có gợi ý phù hợp; không chặn hoặc gộp sai người. |
| AT09 | Gộp hai hồ sơ có RSVP/bàn xung đột. | Có màn hình giải quyết; không mất quan hệ, không gán hai bàn. |
| AT10 | Khách đã có bàn đổi sang từ chối. | Gỡ bàn sau xác nhận; cập nhật ghế/suất, giữ audit. |
| AT11 | Khoản chưa chốt giá nhưng đã đặt cọc. | Có tiền đã trả; còn phải trả chưa xác định, không hiện 0 giả. |
| AT12 | Bài toán trả nhiều đợt và hoàn 2 triệu ở mục 9. | Đúng số nợ từng đợt và tổng ròng. |
| AT13 | Trả trùng yêu cầu do nhấn hai lần/mất phản hồi. | Chỉ một giao dịch tồn tại. |
| AT14 | Hoàn quá giao dịch gốc; tiền âm không đúng loại. | Bị chặn, không có dữ liệu ghi dở. |
| AT15 | Khoản A dư, khoản B nợ. | Không bù trừ làm mất thông tin nợ. |
| AT16 | Giá chốt thay đổi sau khi trả cọc. | Không sửa lịch sử tiền; cảnh báo lịch trả cần rà soát. |
| AT17 | Ngân sách chưa nhập và khoản chưa có giá. | Báo thiếu dữ liệu; không gắn nhãn còn dư ngân sách giả. |
| AT18 | Đổi ngày buổi cưới. | Chỉ hạn tương đối hợp lệ đổi; hạn hợp đồng/cố định giữ nguyên. |
| AT19 | Công việc phụ thuộc tạo chu trình. | Bị chặn; hoàn thành vượt tiền đề cần lý do. |
| AT20 | Sửa hạn thanh toán và mở lịch. | Cùng một nguồn dữ liệu, không còn mục lịch cũ. |
| AT21 | Hai người xếp vào ghế cuối cùng một lúc. | Chỉ một thao tác nhận ghế; sức chứa không vượt. |
| AT22 | Giảm sức chứa bàn/xe dưới số đã phân. | Bị chặn hoặc phải phân lại trước. |
| AT23 | Báo giá được tạo khoản chi hai lần. | Ngăn trùng từ cùng nguồn; không tự ghi thanh toán. |
| AT24 | Một món/chi phí chưa có giá trong báo giá. | Không coi là miễn phí; so sánh nêu phần thiếu. |
| AT25 | Phong bì chung nhiều người gửi. | Tiền cộng một lần; liên kết tới tất cả người gửi. |
| AT26 | Người nhà xem lịch trình, menu và bản in. | Chỉ thấy nội dung chia sẻ đúng phạm vi buổi. |
| AT27 | Import file lỗi ngày, trùng, dòng thiếu; hủy trước xác nhận. | Không ghi dữ liệu; báo từng lỗi; không sửa dữ liệu cũ. |
| AT28 | Import thành công và thử lại cùng batch. | Không nhân bản; batch toàn vẹn; hoàn tác theo điều kiện. |
| AT29 | Xuất Excel/CSV có tên bắt đầu bằng dấu công thức. | Không thực thi thành công thức khi mở file. |
| AT30 | Hai chủ sở hữu sửa cùng khoản chi. | Phát hiện version cũ, không ghi đè âm thầm. |
| AT31 | Mất mạng khi lưu và đăng nhập hết hạn. | Không báo đã lưu sai; còn form để đăng nhập/thử lại. |
| AT32 | Restore database và tệp ở môi trường thử. | Số bản ghi/tổng tiền/quan hệ đúng; tệp mở được. |
| AT33 | Xem/in ở màn hình điện thoại và A4. | Không cắt thao tác, tiền, tên; không cần kéo ngang toàn trang. |
| AT34 | Đánh dấu thực tế trong ngày cưới. | Giữ kế hoạch gốc; hiển thị hiện tại/tiếp theo đúng giờ. |
| AT35 | Bật lưu trữ sau cưới rồi mở lại. | Chỉ đọc khi lưu trữ; mở lại có audit, không mất dữ liệu. |
| AT36 | Dữ liệu tải theo vai trò và cache nhiều phiên. | Không trả dữ liệu của chủ sở hữu sang phiên người nhà. |
| AT37 | Chưa thiết lập quỹ; sau đó xác nhận số dư 0. | Phân biệt chưa có số dư với số dư 0, không hiện tiền sẵn có giả. |
| AT38 | Người thân góp bằng cách trả thẳng 5 triệu cho nhà cung cấp. | Chi phí đã trả tăng 5 triệu; khoản góp đối ứng tăng 5 triệu; tiền còn sẵn của hai người không tăng/giảm do thao tác này. |
| AT39 | Upload nhiều ảnh, một ảnh sai loại/quá kích thước/giải mã lỗi. | Tệp lỗi báo cụ thể, các tệp hợp lệ được giữ; không có bản ghi ready trỏ tới tệp lỗi. |
| AT40 | Deploy image mới, restart container rồi restart host. | Khách, tiền, phiên bản ảnh gốc/thumbnail còn nguyên; app phục hồi kết nối DB. |
| AT41 | Người nhà đoán URL ảnh riêng, ảnh gốc hoặc đường dẫn `../`. | Bị từ chối; không lộ filesystem, EXIF gốc hoặc tài liệu tài chính. |
| AT42 | DB ghi lỗi sau khi xử lý ảnh hoặc ghi file thất bại. | Có dọn bù/đối soát, không báo thành công giả; thử lại không tạo file rác không kiểm soát. |
| AT43 | Restore sang máy/thư mục trống theo bộ backup đầy đủ. | Dựng lại DB, quyền, liên kết và ảnh; người được phép xem/tải đúng tệp. |
| AT44 | Upload tệp tối đa qua tên miền HTTPS thật. | Proxy và app đều nhận đúng giới hạn, không gặp body limit nhỏ hoặc timeout sai cấu hình. |
| AT45 | Nhập khoản cọc lịch sử trước mốc mở quỹ 90 triệu. | Đã trả/ngân sách ghi nhận khoản cọc; quỹ vẫn 90 triệu, không trừ lần hai. |
| AT46 | Ghi cọc trước khi có lịch trả, sau đó tạo và phân đợt. | Có khoản trả trước; tái phân bổ không sinh thêm giao dịch chi. |
| AT47 | Đã cọc 10 triệu, hủy chịu phí 3 triệu, nhận hoàn 7 triệu. | Chi phí cuối/đã trả ròng đều 3 triệu, không còn dư/nợ, không đếm phí hủy hai lần. |
| AT48 | Quyết toán 0 và hoàn tiền do giảm giá. | 0 không bị thay bằng dự toán; giá/nghĩa vụ và dòng tiền chỉ đổi theo xác nhận rõ. |
| AT49 | Email lạ đăng nhập trước hai chủ sở hữu; chạy seed hai lần. | Email lạ không thành chủ; chỉ hai email đã xác nhận nhận quyền, seed không nhân bản. |
| AT50 | Mời người nhà không có SMTP; sai email hoặc token dùng lại. | Chủ tự gửi link; đúng email mới nhận; token dùng lại/sai/hết hạn bị từ chối. |
| AT51 | Quà tiền có trả lại và có giao dịch trước mốc quỹ. | Báo cáo quà và dòng tiền sau mốc khớp, không cộng/trừ trùng. |
| AT52 | Bàn giao phiên bản 1 rồi thêm khách/đổi menu. | Bản 1 không đổi; danh sách làm việc báo chênh lệch/chưa bàn giao lại; tạo được bản 2. |
| AT53 | Chưa có giá ở một khoản và tổng phần đã biết dưới ngân sách. | Hiện tổng tạm tính, không kết luận còn dư/đủ ngân sách. |
| AT54 | Cùng idempotency key nhưng payload khác; replay sau thu hồi quyền. | Payload khác bị xung đột; người mất quyền không đọc được phản hồi cũ. |
| AT55 | Job backup chết, vượt deadline hoặc mất lease khi có upload. | Không công nhận snapshot lỗi; dừng snapshot trước mở lại ghi; không kẹt bảo trì. |
| AT56 | Restore backup có phiên/lời mời/quyền người nhà đã bị thu hồi sau thời điểm backup. | Các session/token bị vô hiệu, quyền xem cần xác nhận lại trước mở Internet. |
| AT57 | Truy vấn thiếu context, qua view và reuse connection pool giữa hai vai trò. | Mặc định từ chối, view không vượt RLS, không rò cột riêng hoặc context chủ sở hữu. |
| AT58 | Chạy R1 khi chưa có module menu/báo giá/xếp bàn R2. | Khách, khoản chi và chứng từ vẫn dùng được; UI không có nút dẫn tới màn hình chưa xây. |
| AT59 | Công việc chia sẻ có tiêu đề nội bộ chứa tiền/tệp riêng. | Người nhà chỉ thấy bản vận hành đã chọn, không suy ra giá hoặc lấy tệp theo quyền cha. |
| AT60 | OAuth redirect trong cùng tab sau khi form hết phiên; sau đó đổi tài khoản. | Đúng tài khoản phục hồi draft còn hạn; tài khoản khác không thấy; không ghi đè phiên bản mới. |
| AT61 | Điểm danh khách phát sinh sau bản chốt nhà hàng. | Có hồ sơ và audit, kiểm tra bàn còn ghế; bản đã chốt không tự đổi và hiện chênh lệch. |
| AT62 | Đổi ngày buổi đại diện và xem tổng quan/lịch/hạn tính lùi. | Dùng một nguồn ngày, số đếm và hạn cập nhật nhất quán sau xác nhận. |

Định nghĩa hoàn thành cho mỗi tính năng: có giao diện, kiểm tra dữ liệu, lưu bền vững, quyền, trạng thái lỗi/rỗng, audit phù hợp, kiểm thử nghiệp vụ liên quan và hoạt động trên điện thoại. Nút có mặt nhưng chưa lưu thật không được tính là hoàn thành.

Ngoài 62 ca AT, có 28 ca UX ở [UI_UX_SPEC mục 15](docs/UI_UX_SPEC.md#15-kiểm-thử-ux-và-tiêu-chí-chấp-nhận). Khi nghiệm thu phải ghi riêng kết quả nghiệp vụ và khả năng sử dụng. Không suy ra tất cả đã qua chỉ từ việc đếm số ca hoặc chụp ảnh giao diện.

## 26. Chi phí dự kiến và điều kiện phát hành

### 26.1. Chi phí dịch vụ

Phương án đã đổi sang server Linux của bạn. Không cần đăng ký Vercel, Supabase hoặc dịch vụ lưu ảnh bên ngoài để ứng dụng chạy. Chưa phát sinh mua, kết nối server hay triển khai từ bản kế hoạch này.

| Thành phần | Định hướng | Điều cần biết |
| --- | --- | --- |
| Hosting/DB | Chạy Docker trên server hiện có. | Không thêm phí gói managed bắt buộc; chi phí server hiện tại và công bảo trì vẫn tồn tại. |
| Ảnh/tài liệu | Lưu trực tiếp ổ đĩa server. | Không thêm dịch vụ lưu ảnh để dùng chính; dùng thư mục bền vững, backup riêng và quản lý file rác. |
| Đăng nhập | Better Auth tự host + Google OAuth. | Cần cấu hình client/callback bằng tài khoản bạn kiểm soát; không cần gói Supabase Auth. |
| Backup độc lập | Phải có cho bản thật. | Có thể tận dụng máy/NAS khác hoặc nơi lưu ngoài server đã có; chi phí phụ thuộc đích chọn. Chưa chọn thì ghi chưa chốt, không coi sao lưu cùng ổ là đủ. |
| Tên miền/HTTPS | Bạn đã có. | Dùng subdomain/route riêng, theo dõi gia hạn; không mua lại mặc định. |
| Email/SMS/Zalo | Không cần trong phạm vi hiện tại. | Không cộng chi phí tích hợp không dùng. |

Không cần khảo sát RAM/ổ đĩa để tiếp tục theo yêu cầu của bạn. Khi triển khai vẫn phải kiểm tra quyền ghi, tính bền vững của mount, giới hạn upload, backup và tình trạng đầy ổ để ứng dụng không báo lưu thành công sai. Lịch backup dùng timer của Linux; các cảnh báo công việc hiển thị được tính trực tiếp khi mở ứng dụng.

### 26.2. Bàn giao trước khi phát hành bản thật

1. Mã nguồn và hướng dẫn chạy; lockfile, cấu hình mẫu không chứa bí mật.
2. Migration và dữ liệu danh mục/checklist gợi ý, tách riêng dữ liệu demo.
3. Danh sách hostname, đường dẫn dữ liệu, tài khoản/secret, đích backup và chủ sở hữu quyền quản trị.
4. Kết quả nghiệm thu R1/R2/R3 tương ứng; các giới hạn còn lại ghi cụ thể.
5. Hướng dẫn mời người nhà, thu hồi quyền, nhập/xuất, hủy giao dịch và xử lý xung đột.
6. Tài liệu backup/restore có lần diễn tập thành công và cách lấy khóa truy cập.
7. Dockerfile, Compose, cấu hình tích hợp proxy hiện tại, hướng dẫn deploy/rollback, xử lý migration lỗi, restart host và liên hệ vận hành.
8. Kiểm tra bản thật bắt đầu trống, chỉ có danh mục/checklist đã chọn; không có thông tin mẫu trong khách, tiền, lịch hay quà.
9. Token/component gallery và prototype, đặc tả màn hình theo mốc, kết quả UXT/ảnh kiểm tra responsive/bản in; các thay đổi đã được cập nhật vào UI_UX_SPEC.

## 27. Những quyết định cần chốt ở từng thời điểm

Không cần trả lời toàn bộ ngay. Các nội dung chưa xác định không bị giấu trong mã hoặc tự đoán.

| Thời điểm | Quyết định | Nếu chưa chốt |
| --- | --- | --- |
| Trước khi viết giao diện đầy đủ | Dựng và thử prototype theo token, bố cục, luồng đã đặc tả trong UI_UX_SPEC; xác nhận thay đổi sau thử và phạm vi P1/P2. | Triển khai mặc định đã ghi để review; không cần hỏi lại từng màu/khoảng cách, nhưng chưa coi prototype đã được người dùng duyệt hoặc test. |
| Trước triển khai thật | Hai email chủ sở hữu, hostname cụ thể, cách tích hợp proxy, tài khoản OAuth, đường dẫn dữ liệu và đích backup ngoài server. Không yêu cầu thêm thông số RAM/ổ đĩa để chốt plan. | Chỉ chạy môi trường phát triển/demo; chưa nhập dữ liệu thật. |
| Khi thêm dữ liệu thật | Các buổi, nhóm khách, nhóm chi phí, người nhà được xem buổi nào. | Giữ trống và hướng dẫn thiết lập; không tự cấp quyền. |
| Khi chốt lịch cưới | Ngày chính thức từng buổi, địa điểm, hạn cố định cần rà lại. | Không tính hạn tương đối chính thức. |
| Trước chốt nhà hàng | Ghế/bàn, số bàn đặt, suất ăn, hạn khóa khách và chính sách thêm khách. | Chỉ dùng dự kiến, gắn nhãn chưa chốt. |
| Trước 14 ngày | Người giữ bản bàn giao, dùng điểm danh hay không, danh sách đầu mối được chia sẻ. | Tắt điểm danh, vẫn xuất lịch trình/bàn/suất; chủ sở hữu giữ bộ riêng. |
| Sau hoàn tất | Giữ web hay chỉ lưu trữ, thời gian giữ dữ liệu khách và tệp. | Không tự xóa; cảnh báo chi phí tiếp tục và chờ quyết định chủ sở hữu. |

Mọi thay đổi phạm vi sau khi chốt được ghi: yêu cầu thay đổi, màn hình/dữ liệu bị ảnh hưởng, tiêu chí nghiệm thu mới, chi phí/thời gian tăng hoặc giảm. Các quy tắc về tiền, quyền và nguồn dữ liệu phải sửa trong tài liệu trước khi đổi triển khai.

