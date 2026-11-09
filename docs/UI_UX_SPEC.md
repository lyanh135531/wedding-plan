# Đặc tả UI/UX — web quản lý đám cưới cá nhân

Phiên bản 1.0 — 04/11/2026. Đi kèm `PLAN.md` phiên bản 1.3.

Đây là đặc tả giao diện và tương tác để triển khai. Các wireframe trong tài liệu là sơ đồ bố cục bằng chữ, chưa phải prototype đã dựng hay giao diện đã được người dùng kiểm thử. Màu, kích thước, hành vi và tiêu chí dưới đây là mặc định cụ thể cho bản đầu; thay đổi phải được cập nhật vào tài liệu trước khi làm khác.

## 1. Ranh giới và nguyên tắc quyết định

- Dùng cho một đám cưới; hai chủ sở hữu được sửa, người nhà chỉ xem phần được chia sẻ.
- Ưu tiên thao tác hằng ngày: khách, tiền, công việc. Phần ý tưởng, nhạc và đồ dùng không lấn chỗ của ba nhóm này.
- Mở trang phải biết đang xem buổi nào, dữ liệu đã được lưu chưa và việc tiếp theo có thể làm là gì.
- Bước thêm mới chỉ yêu cầu dữ liệu đủ để tạo bản ghi hợp lệ; chi tiết bổ sung có thể nhập sau. Không biến một biểu mẫu thành toàn bộ bảng tính.
- Chỉ số, danh sách, bộ lọc và bản in dùng đúng định nghĩa nghiệp vụ của PLAN. UI không tự rút gọn nghĩa của nợ, trả trước, tham dự, ghế hoặc suất.
- Không có dữ liệu thật thì hiển thị trạng thái trống. Dữ liệu minh họa chỉ tồn tại trong môi trường demo có nhãn.
- Không có nội dung chung chung như “Hệ thống thông minh”, điểm tiến độ tự bịa hoặc thông báo thành công trước khi máy chủ xác nhận.
- Nếu hai tài liệu mâu thuẫn về tiền, quyền hoặc dữ liệu, dừng thay đổi phần liên quan và sửa đặc tả; không để người lập trình tự chọn một cách hiểu. PLAN sở hữu nghiệp vụ, tài liệu này sở hữu cách trình bày và thao tác.

## 2. Bộ quy chuẩn thị giác

### 2.1. Màu

| Token | Giá trị | Dùng cho |
| --- | --- | --- |
| `background` | `#F7F5F0` | Nền trang. |
| `surface` | `#FFFFFF` | Thẻ, form, dialog và vùng dữ liệu. |
| `primary` | `#23483E` | Nút chính, mục điều hướng đang chọn. |
| `primary-hover` | `#19382F` | Hover/pressed của nút chính. |
| `text` | `#1F2933` | Tiêu đề và nội dung chính. |
| `text-muted` | `#52616B` | Ghi chú, nhãn phụ, thời gian cập nhật. |
| `border-control` | `#7A8881` | Viền trường nhập và điều khiển cần nhận biết. |
| `border-subtle` | `#E2E8E4` | Đường chia trang trí; không thay viền điều khiển cần tương phản. |
| `success` / nền | `#166534` / `#ECFDF3` | Đã xác nhận, đã hoàn thành. |
| `warning` / nền | `#854D0E` / `#FFF8E1` | Chưa chốt, sắp hạn, cần rà soát. |
| `danger` / nền | `#B42318` / `#FEF3F2` | Lỗi, quá hạn, thao tác xóa/hủy. |
| `info` / nền | `#175CD3` / `#EFF8FF` | Hướng dẫn có ích và thông tin trạng thái. |
| `focus` | `#1D4ED8` | Viền focus bàn phím; 2 px và offset 2 px. |

Không dùng vàng nhạt làm chữ trên nền trắng hoặc màu pastel để biểu thị số tiền quan trọng. Mỗi badge có chữ, màu chỉ bổ trợ. Không có dark mode trong bản đầu để giảm số biến thể cần kiểm tra.

Đã tính tương phản tĩnh của token chữ trên nền trắng khi lập đặc tả: primary khoảng 10,15:1; text 14,76:1; muted 6,40:1; các màu trạng thái đều trên 5,9:1. Đây là kiểm tra cặp màu cơ sở, không phải chứng nhận toàn giao diện. Khi render vẫn phải kiểm tra nền thực tế, overlay, hover, disabled và focus.

### 2.2. Chữ và khoảng cách

- Font mặc định: Be Vietnam Pro tự host cùng ứng dụng, đủ glyph tiếng Việt; fallback `system-ui, sans-serif`. Không bắt trình duyệt gọi dịch vụ font ngoài trong bản dùng thật.
- Cỡ chữ nội dung/trường nhập: 16 px, line-height 1,5. Chữ phụ/label: 14 px. Nhãn thanh điều hướng điện thoại có thể 12 px; không dùng 12 px cho tiền, nội dung form hoặc thông báo lỗi.
- H1: 28 px desktop, 24 px mobile, weight 600. H2: 22/20 px. Chỉ số lớn: 32/28 px; số liệu dài được xuống dòng hoặc dùng cỡ nội dung, không cắt phần cuối.
- Số tiền dùng chữ số cùng độ rộng nếu font hỗ trợ; căn phải trong bảng, không căn phải tên khách.
- Thang khoảng cách: 4, 8, 12, 16, 24, 32, 48 px. Padding trang 16 px mobile, 24 px tablet, 32 px desktop; khoảng giữa nhóm nội dung 24 px.
- Bo góc input/nút 8 px, thẻ/dialog 12 px. Viền 1 px; shadow chỉ dùng cho lớp nổi, không đặt shadow đậm cho từng hàng dữ liệu.
- Icon thống nhất một bộ SVG dạng nét, mặc định 20 px. Icon là dấu hỗ trợ, hành động quan trọng có nhãn chữ; nút chỉ icon có accessible name và tooltip khi phù hợp.
- Nút/input cao tối thiểu 44 px, nút chính trên mobile 48 px; hàng danh sách mobile tối thiểu 64 px, tăng chiều cao theo nội dung.
- Hiệu ứng nhỏ 120–180 ms; tôn trọng reduced motion. Không có chuyển cảnh trang, confetti hoặc animation tự chạy trên trang vận hành.

### 2.3. Responsive và khung trang

| Viewport | Khung |
| --- | --- |
| 360–639 px | Một cột, thanh điều hướng dưới, form một cột, danh sách dạng thẻ; không sidebar cố định. |
| 640–1023 px | Một hoặc hai cột phù hợp nội dung; điều hướng mở bằng nút Menu, chưa hiện sidebar thường trực. |
| Từ 1024 px | Sidebar 240 px, header 64 px; trang danh sách dùng bảng, chi tiết dùng cột chính/phụ khi đủ rộng. |

Nội dung thông thường tối đa 1.440 px; form đơn tối đa 760 px; trang đọc tài liệu tối đa 880 px. Sơ đồ bàn và trang so sánh được dùng hết chiều rộng còn lại. Không ép hai cột form khi nhãn hoặc giá trị không đủ chỗ.

Zoom trình duyệt 200% phải reflow về bố cục hẹp phù hợp; không mất nút Lưu. Chỉ canvas sơ đồ hoặc bảng so sánh có vùng cuộn ngang riêng khi cần, có chỉ dẫn và cách xem danh sách thay thế; toàn trang không cuộn ngang ở 360 px.

## 3. Điều hướng, ngữ cảnh và quyền

### 3.1. Khung của chủ sở hữu

- Desktop: sidebar theo 5 nhóm trong PLAN mục 4.1. Header gồm tên trang, bộ chọn buổi nếu trang dùng buổi, tìm kiếm và thông báo; avatar mở tài khoản/đăng xuất.
- Mobile: 5 mục `Tổng quan`, `Khách`, `Ngân sách`, `Công việc`, `Menu`. Menu là trang danh sách các phần còn lại theo nhóm, không phải nút thêm bản ghi.
- Nút thêm bản ghi nằm ở header của trang, có chữ cụ thể như `Thêm khách`, `Thêm khoản chi`; trang Tổng quan có `Thêm nhanh` mở danh sách lựa chọn. Không có hai nút dấu cộng trôi nổi cạnh nhau.
- Trang chi tiết có Back và tiêu đề nhận diện được. Quay lại danh sách giữ bộ lọc, trang dữ liệu, vị trí cuộn và mục vừa mở.
- Mỗi trang có tối đa một CTA chính trong header. Các thao tác Xuất, Lưu trữ, Xóa nằm ở nút phụ/menu hành động, không tranh màu với CTA chính.

### 3.2. Khung của người nhà

- Mobile: `Tổng quan`, `Khách`, `Lịch trình`, `Menu`. Chỉ hiện Lịch trình khi module R3 đã phát hành và có nội dung được phép xem; trước đó dùng 3 mục còn lại, không để nút chết.
- Desktop chỉ có những nhóm có dữ liệu được cấp quyền. Không hiển thị mục Tài chính/Quà/Quản trị rồi yêu cầu người nhà bấm vào để biết bị cấm.
- Hiển thị nhãn `Chỉ xem`. Không có nút Lưu, Upload, Điểm danh hoặc checkbox giống điều khiển có thể sửa.
- Nếu chưa được cấp buổi nào: trang “Bạn chưa được chia sẻ buổi nào” và hướng dẫn liên hệ hai chủ sở hữu; không hiện danh sách tên buổi chưa được phép.

### 3.3. Chọn buổi và ghi nhớ ngữ cảnh

- Khách, lịch và tổng quan có `Tất cả buổi` và từng buổi được phép xem. Xếp bàn, menu, lịch trình và bản chốt yêu cầu đúng một buổi; trước khi chọn thì hiển thị bộ chọn, không ngầm lấy buổi đầu tiên.
- Ngân sách có phạm vi `Toàn đám cưới`, `Chung` và từng buổi. Chi phí chung không bị cộng lặp khi xem toàn bộ.
- Bộ chọn buổi nằm ngay dưới tiêu đề trên mobile, không ẩn trong bộ lọc nhiều bước. Buổi bị hủy có badge Hủy, không làm biến mất lịch sử.
- ID buổi/bộ lọc/sort/page có thể nằm trong URL. Chuỗi tìm tên, điện thoại, ghi chú và số tiền nhập chưa lưu nằm trong state/session của tab; không ghi vào URL dùng chia sẻ hoặc log không che dữ liệu cá nhân.
- Chuyển buổi không thay đổi ngữ cảnh của form đang nhập. Phải Lưu/Bỏ thay đổi trước khi chuyển; form luôn hiện buổi đích rõ ràng.
- Không có buổi thì vẫn tạo được hồ sơ khách chung, khoản chi Chung và công việc chung. Các thao tác thiệp/bàn/tham dự dẫn tới tạo/chọn buổi.

## 4. Danh mục màn hình và đường đi

Path là quy ước triển khai để không đặt tên màn hình tùy ý; ID trong `:id` phải được kiểm tra quyền phía server. Tất cả các đường dưới đây đều riêng tư, trừ trang đăng nhập và callback xác thực. Callback không phải màn hình cho người dùng thao tác.

| ID | Màn hình / path | Mốc | Quyền / hành động chính |
| --- | --- | --- | --- |
| S01 | Đăng nhập `/login` | R1 | Mọi người: Đăng nhập Google; không đăng ký công khai. |
| S02 | Thiết lập lần đầu `/setup` | R1 | Chủ: Lưu thông tin và tiếp tục/bỏ qua mục tùy chọn. |
| S03 | Tổng quan `/overview` | R1 | Chủ: Thêm nhanh; người nhà: mở thông tin được chia sẻ. |
| S04 | Các buổi `/events`, `/events/:id` | R1 | Chủ: Thêm/sửa/chọn buổi đại diện; người nhà chỉ xem phần công bố. |
| S05 | Khách `/guests` | R1 | Chủ: Thêm khách/gia đình; người nhà xem theo buổi được cấp. |
| S06 | Hồ sơ khách `/guests/:id` | R1 | Chủ: Sửa thông tin/cập nhật theo buổi; người nhà chỉ đọc trường được phép. |
| S07 | Thiệp `/invitations` | R1 | Chủ: Tạo nhóm, cập nhật gửi; trạng thái cần thiết hiển thị trong hồ sơ khách. |
| S08 | Ngân sách `/budget` | R1 | Chủ: Thêm khoản chi. |
| S09 | Chi tiết khoản chi `/costs/:id` | R1 | Chủ: Ghi thanh toán, sửa giá, lịch trả và tài liệu. |
| S10 | Ghi/hoàn/hủy giao dịch `/payments` và form từ S09 | R1 | Chủ: Xem trước và xác nhận giao dịch. |
| S11 | Quỹ `/fund` | R1 | Chủ: Thiết lập mốc quỹ, ghi nguồn góp. |
| S12 | Công việc `/tasks` | R1 | Chủ: Thêm việc, lọc/gán; người nhà chỉ xem việc chia sẻ. |
| S13 | Chi tiết việc `/tasks/:id` | R1 | Chủ: Sửa/đánh dấu tiến độ; người nhà đọc bản vận hành. |
| S14 | Lịch `/calendar` | R1 | Chủ: Thêm cuộc hẹn; người nhà chỉ xem mục chia sẻ. |
| S15 | Nhà cung cấp `/vendors` | R2 | Chủ: Thêm lựa chọn. |
| S16 | Hồ sơ nhà cung cấp `/vendors/:id` | R2 | Chủ: Báo giá, liên hệ, tài liệu, liên kết khoản chi. |
| S17 | So sánh `/vendors/compare` | R2 | Chủ: So sánh 2–4 gói cùng giả định. |
| S18 | Xếp bàn `/seating` | R2 | Chủ: Tạo bàn, gán/chuyển khách; người nhà xem bản được phép. |
| S19 | Thực đơn `/menus` | R2 | Chủ: Chốt menu/suất; người nhà xem menu và tổng được chia sẻ. |
| S20 | Lưu trú/xe `/logistics` | R2 | Chủ: Tạo/gán nơi ở, chuyến xe; người nhà chỉ nội dung vận hành được chọn. |
| S21 | Ảnh/tài liệu `/documents` | R2; upload từ S09 có R1 | Chủ: Upload, lọc, xem, khôi phục; người nhà xem tệp chia sẻ qua đối tượng liên quan. |
| S22 | Ý tưởng `/ideas` | R2 | Chủ: Thêm ảnh/link, chốt hoặc bỏ ý tưởng. |
| S23 | Đồ dùng/nhạc/ảnh `/preparation` | R2 | Chủ: Checklist và nội dung từng loại, lọc buổi/người giữ. |
| S24 | Đội hỗ trợ `/support` | R2 | Chủ: Gán vai trò/đầu việc; người nhà xem đầu mối được chọn chia sẻ. |
| S25 | Lịch trình `/timeline` | R3 | Chủ: Sửa kế hoạch, cập nhật thực tế; người nhà chỉ xem. |
| S26 | Quà/cảm ơn `/gifts` | R3 | Chủ: Ghi nhận/trả lại/cảm ơn. |
| S27 | Bản chốt/bàn giao `/handovers` | R2; bộ ngày cưới mở rộng R3 | Chủ: Xem chênh lệch, tạo bản mới, ghi đã bàn giao; người nhà chỉ bản được chia sẻ. |
| S28 | Thông báo `/notifications` | R1 | Theo quyền: Mở mục, đánh dấu đọc; nội dung riêng không xuất hiện ở người nhà. |
| S29 | Tìm kiếm `/search` | R1, mở rộng R2 | Theo quyền: tìm và mở đúng đối tượng. |
| S30 | Cài đặt `/settings` | R1 | Chủ: Sửa thông tin, danh mục; mỗi người tự quản lý phiên. |
| S31 | Chia sẻ `/sharing` | R1 | Chủ: Mời, xem phạm vi và thu hồi quyền. |
| S32 | Nhập `/data/import` | R1 | Chủ: Mapping, rà lỗi, xác nhận batch. |
| S33 | Xuất `/data/export` | R1, mở rộng R2/R3 | Chủ: chọn dữ liệu/bản in; người nhà chỉ lệnh in tại trang được phép. |
| S34 | Nhật ký/thùng rác `/history` | R1 | Chủ: Xem thay đổi/khôi phục bản ghi hợp lệ. |
| S35 | Hậu cưới/lưu trữ `/after-wedding` | R3 | Chủ: xử lý việc còn mở, xuất lưu trữ, chuyển chỉ đọc. |

R1 có đầu mối nhà cung cấp tối thiểu trong khoản chi, không tạo S15/S16 rỗng. Tương tự, nhu cầu suất/lưu trú có trường đơn giản trong S06 trước khi có module S19/S20.

## 5. Bộ thành phần giao diện dùng chung

| Thành phần | Hợp đồng tương tác |
| --- | --- |
| Khung trang | Có H1, ngữ cảnh buổi, một hành động chính; loading chỉ thay vùng dữ liệu, không làm thanh điều hướng nhảy vị trí. |
| Thẻ chỉ số | Nhãn, giá trị, đơn vị, phạm vi và trạng thái đầy đủ/tạm tính; click mở danh sách cùng phạm vi/bộ lọc. Không hiển thị 0 khi chưa biết. |
| Thanh bộ lọc | Tìm kiếm, tối đa 3 filter phổ biến, nút Bộ lọc có số filter đang bật, nút Xóa bộ lọc. Mobile mở sheet với Áp dụng/Hủy. |
| Bảng/list | Tên là link; cột hành động riêng; checkbox chọn hàng không mở chi tiết. Sort có chiều đang chọn. Mobile thẻ hiển thị dữ liệu ưu tiên, không thu nhỏ toàn bộ bảng. |
| Phân trang | Mặc định 25 mục/trang, chọn 25/50/100; nhãn “1–25 / 143 người”. Không dùng infinite scroll cho tiền/khách cần đối chiếu. |
| Chọn nhiều | Toolbar hiện số bản ghi, chỉ chọn trang hiện tại mặc định. Chọn toàn bộ kết quả là thao tác thứ hai ghi rõ số; không mặc định gồm hàng đang bị lọc ẩn. |
| Badge | Chữ đầy đủ hoặc có chú giải ngay tại chỗ; không dùng riêng chấm đỏ/xanh. Badge chỉ đọc không có hình dáng giống checkbox. |
| Nút | Primary/secondary/ghost/danger; đang gửi có spinner + “Đang lưu…”, không chỉ disable không rõ lý do. Tooltip không thay thông báo lỗi. |
| Text/textarea | Label luôn hiện, placeholder chỉ ví dụ; bắt buộc ghi rõ. Helper dưới label/trường; lỗi gắn với trường và xuất hiện trong tóm tắt. |
| Tiền | Nhập chữ số, hiện phân cách nghìn theo VND khi hợp lệ; parse rõ 1.500.000; không nhập âm cho giao dịch chi. Chưa nhập khác 0. Không che đơn vị. |
| Số lượng | Số nguyên, có min/max theo nghiệp vụ; bàn phím số trên mobile; nút tăng/giảm vẫn nhập trực tiếp được. |
| Ngày/giờ | Picker và nhập tay `dd/mm/yyyy`, lỗi ngày không tồn tại; giờ 24h; ngày chưa chốt có lựa chọn riêng, không phải ngày giả. Không tự sửa 03/04 thành định dạng khác. |
| Combobox | Tìm có dấu/không dấu, cho xem giá trị đã chọn; không tạo danh mục mới chỉ vì gõ không thấy. Nút “Tạo…” tách, chỉ chủ sở hữu. |
| Chọn người/buổi | Có tên, nhóm, ngữ cảnh đủ phân biệt trùng tên; không dùng ảnh làm cách nhận diện duy nhất. Người ngoài hai chủ là đầu mối hỗ trợ, không tự có quyền sửa. |
| Form dài | Chia nhóm có tiêu đề; phần bổ sung đóng mặc định nhưng nếu có lỗi phải mở ra và focus tới lỗi. Không tạo wizard nhiều bước cho form 3 trường. |
| Dialog xác nhận | Tên đối tượng, tác động, nút cụ thể “Hủy ghi nhận 5.000.000 ₫”; không dùng “OK”. Esc/đóng tương đương hủy trước khi gửi. |
| Sheet/drawer | Desktop rộng 480–640 px cho form ngắn; mobile dùng trang/form toàn màn hình. Không lồng dialog trong drawer thành nhiều lớp không rõ Back. |
| Thanh lưu | Hủy và Lưu; sticky chỉ khi không che nội dung. Ẩn thanh tab dưới khi đang form toàn màn hình, có padding tránh bàn phím/safe area. |
| Upload | Chọn tệp hoặc kéo thả; xem trước, tên, kích thước, quyền, tiến độ từng tệp, thử lại/xóa; không gửi khi mới chọn nếu chưa xác nhận Upload/Lưu theo luồng. |
| Xem ảnh | Phóng lớn/thu nhỏ, trước/sau, Esc/đóng; có chú thích. Người xem không có nút lấy bản gốc nếu không được quyền. |
| Toast | Xác nhận thao tác phụ, tồn tại khoảng 5 giây; thông báo quan trọng còn ở trang. Không chứa số tiền/quà/địa chỉ trên phiên người nhà. |
| Banner | Mất mạng, bảo trì, dữ liệu cũ hoặc chỉ đọc; ảnh hưởng gì và cách xử lý. Không biến lỗi toàn trang thành toast biến mất. |
| Trống | Nói rõ chưa có dữ liệu hay không khớp bộ lọc; một hành động phù hợp. Người nhà không có CTA thêm. |
| Xung đột | Hiện bản máy chủ và nội dung đang nhập, những trường khác; Tải bản mới hoặc Chọn lại thay đổi. Không có mặc định ghi đè tiền/chỗ ngồi. |
| Bản in | Layout riêng; có phạm vi/buổi/thời điểm/phiên bản, không menu, không nút, không cột nhạy cảm sai quyền. |

Mỗi component phải có loading, focus, disabled, error và read-only tương ứng trước khi nhân rộng sang nhiều màn hình. Không xây một bộ component tổng quát phức tạp hơn nhu cầu trong bảng này.

## 6. Sáu màn hình chính — bố cục và hành vi chi tiết

### 6.1. S03 — Tổng quan

**Thứ tự desktop:** header tên hai người/thời gian → chọn buổi → hàng chỉ số → cột trái Cần xử lý (2/3), cột phải Lịch 7 ngày (1/3) → tiến độ công việc và hạng mục chi lớn → thay đổi gần đây. Không đặt biểu đồ lớn lên trước việc phải làm.

```text
[Tên hai người | Dự kiến sau Tết âm lịch 2028]   [Thêm nhanh]
[Phạm vi: Toàn đám cưới v]
[Chi dự báo] [Đã trả] [Còn phải chi] [Khách xác nhận*]
[Cần xử lý: việc / thanh toán / khách]  [Lịch 7 ngày]
[Tiến độ công việc]                    [Chi theo nhóm]
[Thay đổi gần đây]
* Có nhãn Người duy nhất/Lượt tham dự khi xem nhiều buổi.
```

**Mobile:** tên + thời gian, phạm vi, Cần xử lý, 4 thẻ chỉ số thành lưới 2×2, Lịch 7 ngày, tiến độ; lịch sử nằm cuối. Nút Thêm nhanh ở header, không che thanh tab.

- Cần xử lý mặc định tối đa 5 mục, ưu tiên quá hạn trước, trong cùng nhóm sắp theo hạn gần nhất; có Xem tất cả theo từng loại. Chưa biết hạn nằm trong “Cần bổ sung”, không bị gán quá hạn.
- Chọn thẻ Đã trả mở giao dịch; Còn phải chi mở khoản còn nghĩa vụ; Khách mở danh sách đúng phạm vi/trạng thái. Có nút chú giải nhãn tiền, không yêu cầu nhớ công thức.
- Chưa có ngân sách/giá: hiện số đã biết kèm “Tạm tính — còn N khoản thiếu giá”, không gắn nhãn đủ tiền. Không có buổi: thay thẻ khách theo buổi bằng hướng dẫn thiết lập.
- Chủ sở hữu mới thấy checklist thiết lập: thêm buổi, thêm khách, nhập khoản đầu, tạo việc. Mỗi dòng có thể mở lại, không tự đánh dấu xong do đã mở trang.
- Người nhà chỉ thấy ngày/địa điểm công bố, công việc chia sẻ, lịch trình và thông tin khách/bàn được phép; các ô tiền không xuất hiện, không để ô trắng có nhãn tiền.

### 6.2. S05/S06 — Khách và hồ sơ

**Desktop danh sách:** tiêu đề + Thêm khách (menu có Thêm gia đình), chọn buổi, chỉ số người/thiệp/tham dự, thanh tìm/lọc, bảng.

Cột mặc định: Tên, Bên/nhóm, Nhóm thiệp, Tham dự, Thiệp, Bàn (R2), hành động. Số điện thoại là cột tùy chọn cho chủ; địa chỉ/quà/ghi chú dài không vào bảng mặc định. Xem Tất cả buổi không có một badge tham dự chung sai nghĩa; hiện “2 buổi được mời, 1 đồng ý” và mở chi tiết theo buổi.

```text
[Khách mời]                          [Thêm khách v]
[Buổi v] [Người mời / Đồng ý / Chưa chốt / Từ chối]
[Tìm tên/SĐT] [Bên mời v] [Tham dự v] [Bộ lọc (n)]
[ ] Tên         Nhóm thiệp      Tham dự     Bàn    [...]
[ ] ...
[25 mục/trang]                         [Trước / Sau]
```

**Mobile:** thẻ mỗi người gồm tên, bên/nhóm, tham dự của buổi, nhãn thiệp và bàn. Chạm thân thẻ mở hồ sơ; menu ba chấm dành cho hành động. Không dùng swipe làm cách duy nhất để cập nhật/xóa.

**Thêm nhanh một người:** Tên bắt buộc; Bên mời mặc định Chưa phân; nhóm quan hệ, điện thoại tùy chọn; chọn buổi muốn mời. Các trường Email/địa chỉ/ghi chú/ăn uống nằm phần bổ sung. Tên người đi cùng chưa biết có nút riêng, không buộc bịa tên. Không chọn buổi vẫn lưu hồ sơ, ghi rõ chưa thuộc danh sách mời buổi nào.

**Thêm gia đình:** tên nhóm thiệp và buổi, danh sách dòng thành viên (tên hoặc placeholder, loại người), người đại diện; liên hệ chung tùy chọn. Xem trước “1 thiệp, 4 người” trước lưu; server tạo cả nhóm trong một transaction.

**Hồ sơ:** phần đầu tên/bên/nhóm; tab `Thông tin`, `Theo từng buổi`, `Liên hệ`; R3 thêm liên kết quà riêng cho chủ. Mỗi buổi có tham dự, trạng thái gửi thiệp, ghế/suất, món/lưu trú, bàn và lần liên hệ tiếp theo. Người nhà chỉ có bản rút gọn theo quyền, không có tab liên hệ riêng.

**Cập nhật phản hồi:** chọn buổi → chọn trạng thái → tùy chọn ghi chú/ngày hỏi lại → Lưu. Nếu từ chối làm gỡ bàn, màn hình xác nhận nêu bàn bị gỡ và thay đổi suất. Cập nhật cả gia đình phải tích rõ thành viên, không suy ra tất cả đồng ý từ lời người đại diện.

**Gộp trùng:** chủ chọn hai hồ sơ → chọn bản giữ → so theo trường và từng buổi → giải quyết bàn/thiệp/trạng thái xung đột → xem trước → xác nhận. Không có nút một chạm Gộp tất cả gợi ý.

### 6.3. S08/S09/S10 — Ngân sách, khoản chi và giao dịch

**Ngân sách desktop:** mục tiêu và phạm vi → thẻ dự báo/đã chốt/đã trả/còn nợ → tab Khoản chi/Hạn thanh toán → bảng. Cột khoản chi: tên, nhóm, dự báo, giá chốt, đã trả ròng, còn phải trả, hạn gần nhất. Khoản chưa chốt có chữ Chưa xác định ở cột nợ; không hiển thị dấu gạch mà không chú giải.

**Mobile:** chỉ số thành lưới, tab 2 mục; thẻ khoản gồm tên, nhóm, trạng thái, giá hiện dùng, đã trả và còn phải trả. Hạn quá hạn ở dòng riêng. Giá trị tiền không viết tắt thành “1,2tr” trong luồng ghi/đối chiếu giao dịch.

**Tạo khoản chi:** Tên + hạng mục bắt buộc; phạm vi buổi/Chung hiển thị rõ; dự toán và nhà cung cấp tùy chọn. Chưa biết giá vẫn lưu với nhãn Thiếu giá. R1 có đầu mối nhà cung cấp dạng trường đơn giản; không dẫn sang màn chưa tồn tại.

```text
[Chụp ảnh cưới] [Đã chốt]               [Ghi thanh toán]
[Hạng mục | Buổi/Chung | Nhà cung cấp]
[Dự toán] [Giá chốt] [Đã trả ròng] [Còn nợ / Dư]
[Lịch trả: hạn | nghĩa vụ | đã phân bổ | còn nợ]
[Giao dịch: chi / hoàn / hủy ghi nhận]
[Chứng từ] [Lịch sử thay đổi]
```

**Chi tiết khoản:** tab Tổng quan/Lịch trả/Giao dịch/Tệp/Lịch sử hoặc anchor tương ứng; trên mobile mỗi vùng xếp dọc và có jump link, tránh một hàng 5 tab bị cắt.

**Ghi thanh toán:** số tiền, ngày giờ, người trả, phương thức, phân bổ vào đợt hoặc trả trước, chứng từ tùy chọn. Chọn Người khác trả hộ phải chọn rõ Góp không hoàn lại hoặc Nghĩa vụ cần đối chiếu, không tự giả khoản góp. Màn xem trước luôn có khoản chi đích, số tiền, đợt/trả trước và ảnh hưởng đến quỹ.

- Nút cuối ghi `Xác nhận chi 5.000.000 ₫`, bị khóa khi đang xử lý; thành công hiển thị mã giao dịch/giờ và số dư mới, rồi có Về khoản chi.
- Chưa biết request trước thành công hay chưa: nút Kiểm tra kết quả, thử lại cùng mã yêu cầu. Không tạo giao dịch mới bằng UUID mới chỉ để giải quyết timeout.
- Hoàn tiền bắt đầu từ giao dịch chi gốc, hiển thị còn có thể hoàn; hỏi lý do và có thay đổi nghĩa vụ hay không. Hủy ghi nhận dành cho nhập sai, nêu rõ không phải hoàn tiền thực tế.
- Sửa giá và hủy dịch vụ mở form riêng; hiển thị nghĩa vụ cũ/mới, phần đã trả, cần trả/nhận lại và lịch bị ảnh hưởng. Không đặt chung một nút Xóa để xử lý cả hủy dịch vụ lẫn xóa nháp.
- Khoản chi tạm tính, dư thanh toán, đang hủy và đã quyết toán có nhãn chữ khác nhau; không gom thành Đã xong.

### 6.4. S12/S13/S14 — Công việc và lịch

**Công việc:** tiêu đề + Thêm việc, bộ lọc Của tôi/Tất cả, buổi, trạng thái, ưu tiên; mặc định danh sách theo hạn với nhóm Quá hạn/Hôm nay/7 ngày/Chưa có hạn. Tab Bảng trạng thái là cách xem phụ; kéo thả luôn có menu đổi trạng thái tương đương.

```text
[Công việc]                       [Thêm việc]
[Của tôi / Tất cả] [Buổi v] [Trạng thái v]
[Quá hạn: n]
[ ] Chốt thực đơn    Người A    05/03    [Chi tiết]
[Hôm nay / 7 ngày / Chưa có hạn]
```

**Thêm việc:** tiêu đề bắt buộc; người phụ trách mặc định người đang tạo, có thể đổi/để chưa phân; buổi, hạn và ưu tiên tùy chọn. Nhãn chia sẻ mặc định Tắt. Trường phụ thuộc/checklist/ghi chú tách nhóm bổ sung.

**Hạn tương đối:** chọn buổi + số ngày + Trước/Sau. Buổi chưa chốt hiện “Hạn sẽ được tính khi chốt ngày”, không gắn một ngày tạm. Công việc chung không có buổi thì không cho chọn hạn tương đối tới buổi rỗng.

**Chi tiết:** tiêu đề, trạng thái, người phụ trách/hạn, checklist, phụ thuộc, ghi chú/tài liệu, nội dung chia sẻ. Hoàn thành với tiền đề chưa xong mở cảnh báo và ô lý do. Việc không có ràng buộc hoàn thành bằng một lần xác nhận trạng thái đã lưu; lỗi mạng khôi phục checkbox và báo Chưa lưu.

**Lịch desktop:** toolbar Hôm nay/Trước/Sau, tháng và đổi Tháng/Danh sách; loại việc/đợt trả/hẹn có biểu tượng + chữ. Một ô ngày hiển thị tối đa 3 mục, `+n mục` mở danh sách ngày.

**Lịch mobile:** mặc định danh sách 7 ngày với ngày cố định ở nhóm; có đổi tháng nhưng không ép toàn bộ lịch ô vào chiều ngang nhỏ. Bấm hạn trả mở khoản chi/đợt, không mở form sự kiện lịch độc lập. Người nhà không có lớp thanh toán.

### 6.5. S18 — Xếp bàn

**Desktop:** chọn đúng buổi → thanh tổng người/ghế/đã xếp/chưa xếp → cột khách 320 px bên trái, canvas ở giữa, thông tin bàn bên phải hoặc panel mở khi chọn. Có tab Sơ đồ/Danh sách bàn. Không mở hai inspector chồng lên canvas.

```text
[Buổi v] [Khách / Ghế / Chưa xếp]       [Thêm bàn] [Bản chốt]
[Tìm khách       ] [Canvas: bàn A1 8/10, A2 10/10 ...]
[Chưa xếp / nhóm ] [Chọn bàn để xem danh sách người]
[Gia đình ...    ] [Zoom +/-] [Vừa khung] [Danh sách bàn]
```

**Mobile:** mặc định Danh sách bàn; mỗi bàn có tên, ghế đang dùng/tổng, số người và nút Xem. Chọn khách → Chọn bàn → xem tác động → Lưu. Canvas chỉ là chế độ phụ có pan/zoom trong vùng riêng; không bắt kéo thả để hoàn thành tác vụ.

- Hàng khách có tên, nhóm, cần ghế/suất và bàn hiện tại; không dùng “10 khách/10 chỗ” nếu có em bé không cần ghế.
- Gán cả gia đình hiển thị thành viên và tổng ghế cần trước khi lưu. Bàn thiếu chỗ bị disabled kèm số thiếu và liên kết chọn bàn khác; không âm thầm tách gia đình.
- Đổi bàn giữ gán cũ cho tới khi transaction mới thành công. Nếu người kia vừa lấy ghế cuối, báo “Bàn A2 vừa hết chỗ”, tải sức chứa mới và giữ lựa chọn khách.
- Tạo bàn yêu cầu tên/số và sức chứa. Đổi vị trí sơ đồ chỉ lưu vị trí, không thay danh sách khách; có trạng thái chưa lưu sơ đồ và nút Lưu bố trí.
- Bản chốt và danh sách hiện tại có nhãn phiên bản/giờ; thay đổi sau chốt hiện banner Chưa bàn giao lại. Người nhà chỉ xem phiên bản được chủ chọn công bố, không tự thấy bản nháp đang sửa.

### 6.6. S25 — Lịch trình ngày cưới

**Desktop:** buổi + ngày/địa điểm → hai thẻ Đang diễn ra/Tiếp theo → timeline theo thời gian → panel chi tiết. Có đổi Kế hoạch/Vận hành. Không đẩy bảng thời gian xuống dưới ảnh trang trí.

**Mobile vận hành:** thời gian hiện tại + buổi, mục hiện tại và tiếp theo, thời điểm dự kiến/thực tế, người phụ trách, nút gọi đầu mối được phép; bên dưới là danh sách phần còn lại. Chủ có Bắt đầu/Hoàn tất/Bỏ qua; người nhà chỉ xem.

```text
[Tiệc cưới | địa điểm | giờ hiện tại]
[Đang diễn ra: Đón khách | kế hoạch 17:30–18:00]
[Phụ trách: ...] [Đầu mối gọi nếu được chia sẻ]
[Tiếp theo: Nghi lễ 18:00]
[Các mục còn lại theo giờ]
```

- Bắt đầu/hoàn tất ghi thời gian thực tế, không thay kế hoạch. Mục chưa bắt đầu dù đã quá giờ có nhãn Chưa bắt đầu — trễ X phút, không tự thành Đang diễn ra.
- Lịch song song có nhãn địa điểm/đội, không chọn một mục hiện tại rồi giấu các mục đang diễn ra khác. Thẻ hiện tại có thể có nhiều mục; ưu tiên mục của người đang xem trước khi cùng quyền.
- Dời các mục sau mở xem trước từng thay đổi giờ và cảnh báo người trùng; chỉ mục chưa bắt đầu được chọn. Không kéo trễ dây chuyền nếu chưa xác nhận.
- Có nút Bộ tài liệu đã xuất, ghi giờ/phiên bản. Mất mạng hiện banner và hướng dẫn mở bản đã tải/in; không hiện dữ liệu cũ như đang cập nhật trực tiếp.

## 7. Đặc tả các màn hình còn lại

Mỗi mục dưới đây dùng khung/controls ở mục 5; cách ghi trường bắt buộc áp dụng ở cả desktop/mobile. Người nhà chỉ được xuất hiện ở các luồng ghi rõ quyền xem; không suy từ việc có route mà cho đọc toàn bộ.

### 7.1. S01/S02 — Đăng nhập và thiết lập

- S01 ở giữa trang: tên ứng dụng, một câu giải thích riêng tư, Đăng nhập Google. Không nút Đăng ký hay biểu mẫu mật khẩu. Sau OAuth quay về trang trước nếu còn được quyền, nếu không về Tổng quan.
- Email không được mời: “Tài khoản này chưa được cấp quyền”, hiện email vừa dùng và Đổi tài khoản. Không tiết lộ email hai chủ nếu chưa được công bố.
- S02 chia 3 bước nhẹ: Hai người → Thời gian/buổi → Danh mục gợi ý. Có quay lại, trạng thái bước, Bỏ qua với trường tùy chọn. Tên hai người là dữ liệu tối thiểu.
- Chọn Chưa chốt ngày thì hiện ô ghi chú dự kiến, không đặt picker bắt buộc. Thông tin “sau Tết âm lịch 2028” là giá trị dự kiến của bạn, không chuyển thành một ngày cụ thể.
- Gói gợi ý có xem trước số danh mục/việc; không chọn sẵn khách, tiền, địa điểm hoặc ngày mẫu.

### 7.2. S04/S30 — Buổi và cài đặt

- Danh sách buổi hiển thị tên, loại, trạng thái ngày, địa điểm, số mời/xác nhận, badge Buổi đại diện. Form tạo: tên bắt buộc, loại và ngày giờ/địa điểm tùy chọn.
- Đổi ngày có bước So sánh hạn bị ảnh hưởng, nhóm tự tính lại/giữ nguyên/cần rà soát; nút “Xác nhận đổi ngày” thay Lưu chung chung.
- Cài đặt có nhóm Thông tin, Danh mục, Tài khoản của tôi, Dữ liệu; mỗi nhóm tự lưu. Không gom sửa tên cô dâu với xóa nhóm khách trong một lần lưu toàn trang.
- Danh mục đang dùng: cho đổi tên/lưu trữ; nếu muốn xóa phải chọn danh mục chuyển các bản ghi sang và xem số lượng. Tiền tệ/múi giờ cố định theo phạm vi VND/Vietnam, không bày chọn ngoại tệ chưa hỗ trợ.

### 7.3. S07 — Thiệp

- Bảng theo nhóm nhận thiệp: tên nhóm, buổi, người đại diện, số người, hình thức, giữ lịch/chuẩn bị/gửi, ngày gửi, phụ trách.
- Thêm nhóm: chọn buổi trước, tìm/thêm thành viên, chọn đại diện; chỉ hiện khách chưa thuộc nhóm thiệp khác ở buổi đó hoặc có thao tác chuyển rõ ràng.
- Gửi thiệp hàng loạt: chọn nhóm, xem đúng số thiệp và số người liên quan, ngày gửi/người gửi → xác nhận. Không thay trạng thái đồng ý tham dự.
- Đã gửi nhưng quên ngày: cho ghi Ngày gửi chưa rõ, không tự gán hôm nay thành ngày quá khứ đã xảy ra. Có ngày ghi nhận để phân biệt.

### 7.4. S11 — Quỹ

- Chưa thiết lập: giải thích ngắn quỹ khác ngân sách, hỏi số dư tại ngày/giờ nào và phạm vi tiền theo dõi. Số 0 phải được nhập/chọn rõ.
- Đã thiết lập: số dư theo sổ, mốc mở sổ, Thu/Chi sau mốc, khoản hứa góp tách riêng, danh sách nguồn. Nhãn “Theo dữ liệu đã ghi — không phải số dư ngân hàng”.
- Thêm nguồn: loại thực nhận/hứa góp/góp trả thẳng, số tiền, thời điểm, người góp tùy chọn. Góp trả thẳng dẫn tới chọn khoản chi và cặp giao dịch, không tạo hai form nhập cùng tiền độc lập.
- Đổi số dư/mốc mở sổ cần màn so trước/sau, danh sách giao dịch chuyển phạm vi và lý do. Nợ/ứng hộ chưa đối chiếu hiện cảnh báo giới hạn số dư.

### 7.5. S15/S16/S17 — Nhà cung cấp và so sánh

- Danh sách có lọc loại, trạng thái, buổi và Thêm nhà cung cấp; thẻ/tên dẫn tới hồ sơ.
- Hồ sơ gồm đầu mối, trạng thái, báo giá theo phiên bản, khoản chi liên kết, tài liệu và ghi chú. Nút Thêm báo giá yêu cầu tên gói, ngày nhận; giá có thể Chưa báo.
- So sánh chọn 2–4 gói → chốt giả định số khách/bàn → bảng cùng hàng: giá/phí đã gồm, phần thiếu, điều kiện cọc/hủy, sức chứa, điểm phù hợp do bạn ghi. Mobile chuyển từng thẻ theo tiêu chí, luôn giữ tên gói đang xem.
- Chọn gói cập nhật lựa chọn; Tạo khoản chi là thao tác riêng có xem trước. Nguồn đã có khoản chi hiển thị Mở khoản chi, không còn CTA tạo trùng.

### 7.6. S19 — Thực đơn và suất

- Chọn buổi → menu đã chọn và trạng thái chốt → bảng suất thường/chay/trẻ em/thiếu lựa chọn, danh sách cần liên hệ.
- Tổng xác nhận và dự phòng là hai cột khác nhau. Chỉnh dự phòng không thêm khách giả.
- Thêm menu: tên/gói, món theo thứ tự, nhà cung cấp/giá tham khảo tùy chọn. Nếu có người đang chọn menu bị xóa, yêu cầu chuyển hoặc lưu trữ, không làm mất suất.
- Nút Tạo bản chốt mở S27 với số khách/ghế/suất và số bàn đã đặt rõ ràng. Bản cho nhà hàng chỉ chứa thông tin phục vụ cần thiết, không ghi chú riêng.

### 7.7. S20 — Lưu trú và xe

- Hai tab Lưu trú/Di chuyển. Chỉ hiển thị phần được bật; chưa cần thì có lời giải thích và nút Bật cho chủ, không chiếm dashboard.
- Lưu trú: nơi ở, ngày đến/đi, phòng/nhóm khách, trạng thái xác nhận; form yêu cầu nơi hoặc nhãn tạm và khoảng ngày hợp lệ.
- Xe: điểm đón/đến, ngày giờ, số chỗ, đầu mối; danh sách gán người và còn chỗ. Không nhận người vượt chỗ; đổi chuyến phải giữ chuyến cũ tới khi lưu thành công.
- Bản chia sẻ chọn rõ đầu mối, giờ/điểm; không mặc định công khai danh sách địa chỉ cá nhân khách.

### 7.8. S21/S22 — Thư viện và ý tưởng

- Thư viện có tab Ảnh/Tài liệu, lọc loại/đối tượng/quyền, xem lưới hoặc danh sách. Ảnh có thumbnail, tiêu đề, đối tượng, quyền; PDF có icon/metadata, không thumbnail giả nếu chưa tạo được.
- Upload tại hồ sơ tự gắn đối tượng đích; upload từ thư viện phải chọn đối tượng hoặc thư mục Ý tưởng riêng. Có thể chọn nhiều file nhưng mỗi file có trạng thái và quyền riêng.
- Người nhà mở ảnh từ hồ sơ/bản bàn giao được chia sẻ, không có thư viện tổng hợp tiết lộ tiêu đề tệp riêng.
- Ý tưởng có nhóm, trạng thái tham khảo/cân nhắc/chốt/bỏ. Thẻ gồm ảnh/link, tiêu đề, ghi chú ngắn; thêm link không tự tải nội dung từ nguồn ngoài hay lộ metadata tài khoản người dùng.
- Chốt ý tưởng chỉ đổi trạng thái; nếu muốn tạo việc/khoản chi có nút riêng với xem trước.

### 7.9. S23/S24 — Chuẩn bị và đội hỗ trợ

- Trang chuẩn bị có bốn tab Đồ dùng/Nhạc/Ảnh quay/Ý tưởng liên kết; chỉ một tab dữ liệu mở tại một thời điểm.
- Đồ dùng: tên/số lượng/người giữ/trạng thái/giờ mang/hạn trả; mặc định nhóm Chưa chuẩn bị/Đã đóng gói/Đã mang/Chờ nhận lại. Đồ thuê có hạn trả rõ.
- Nhạc: tên bài, link, đoạn sử dụng, thứ tự; đổi thứ tự bằng kéo hoặc nút lên/xuống. Không có trình phát bắt buộc hoặc upload bản nhạc.
- Ảnh quay: cảnh, nhóm người, buổi/thời điểm, mức bắt buộc, người tập hợp và đã giao ekip; lưu thời điểm ghi nhận bàn giao thủ công.
- Đội hỗ trợ: danh sách người/vai trò, giờ có mặt, đầu việc và dự phòng; một hồ sơ liên hệ dùng cho nhiều vai trò. Gán vai trò không gửi lời mời tài khoản.

### 7.10. S26 — Quà và cảm ơn

- Header riêng tư, tổng tiền nhận/trả/ròng, tab Quà tiền/Hiện vật/Cần cảm ơn/Chưa rõ người gửi.
- Thêm quà: loại, số tiền nếu tiền hoặc mô tả nếu hiện vật, người/nhóm gửi (nhiều người được chọn), thời điểm nhận, người nhận hộ; cho Chưa xác định người gửi. Form ghi rõ Một quà chung chỉ tạo một dòng.
- Bản chi tiết có danh sách người đóng góp, trạng thái cảm ơn và lịch sử trả lại. Trả tiền bắt đầu từ bản nhận, hiện tối đa còn giữ; không dùng sửa số nhận để ghi tiền đã trả lại thực tế.
- Hành động Đã cảm ơn có ngày và người ghi nhận; không có chữ Đã gửi nếu ứng dụng chưa gửi gì ra ngoài.

### 7.11. S27/S33 — Bản chốt, bàn giao và xuất

- Danh sách theo buổi: phiên bản, giờ tạo, phạm vi, ai tạo, trạng thái Chưa bàn giao/Đã ghi nhận bàn giao và chênh lệch với bản đang làm.
- Tạo bản mới: chọn nội dung → xem số người/ghế/suất/bàn và phần còn thiếu → xem trước trang in → xác nhận snapshot. Tạo PDF/in không tự đánh dấu nhà hàng đã nhận.
- Chủ đánh dấu đã bàn giao bằng ngày/giờ, người nhận và kênh ghi nhận thủ công. Không cần tích hợp email để hoàn thành luồng.
- Xuất dữ liệu: Loại dữ liệu → Buổi/bộ lọc/toàn bộ → Cột/phạm vi → xem số dòng/quyền → Tải. Rõ nhãn Bản đang làm hoặc Phiên bản đã chốt. Đường xuất lớn có trạng thái chuẩn bị và lỗi thử lại, không treo nút vô hạn.
- Người nhà chỉ in phiên bản/nội dung đã chia sẻ; bản không có quyền trả trang không truy cập được, không gửi JSON đầy đủ xuống rồi bỏ cột khi in.

### 7.12. S28/S29 — Thông báo và tìm kiếm

- Thông báo nhóm Cần xử lý/Đã đọc, hiện loại, đối tượng, hạn và hành động; mở mục đánh dấu đọc sau phản hồi thành công. Tạm ẩn không đổi trạng thái công việc.
- Tìm kiếm chỉ bắt đầu khi người dùng nhập, không gợi ý thông tin riêng của tài khoản khác. Nhóm kết quả Khách/Công việc/Khoản chi, mở rộng R2; mỗi nhóm có Xem thêm, không trộn tên người và giao dịch thành danh sách khó hiểu.
- Khi kết quả trả về chậm hơn chuỗi gõ mới thì bỏ kết quả cũ. Không có kết quả phân biệt với lỗi tải.
- Trạng thái loading không làm mất chuỗi tìm/bộ lọc. Đổi quyền trong khi mở kết quả: lần mở tiếp theo kiểm tra quyền hiện tại.

### 7.13. S31 — Chia sẻ và phiên đăng nhập

- Chủ thấy hai khối: Hai chủ sở hữu và Người nhà. Mỗi người có email, vai trò, buổi được xem, trạng thái Chờ nhận/Đang có quyền/Đã thu hồi.
- Mời: email + chọn buổi → xem trước đúng phạm vi người nhà thấy → Tạo lời mời → Sao chép link. Nút ghi Tạo lời mời, không ghi Gửi email.
- Thu hồi: nêu tài khoản, phạm vi mất quyền và việc bản đã tải/in không thể thu hồi; xác nhận rồi cập nhật danh sách. Không bắt nhập lại mật khẩu của hệ thống không có mật khẩu.
- Tài khoản của tôi: xem thiết bị/phiên, Đăng xuất phiên này/Thu hồi phiên khác. Bàn giao chủ có bước xác minh tài khoản mới; không nằm cùng menu mời người nhà thông thường.

### 7.14. S32 — Nhập dữ liệu

- Wizard 5 bước: Chọn loại/tệp → Ghép cột → Rà lỗi/trùng → Xem trước bản sẽ ghi → Kết quả.
- Rà lỗi dùng bảng số dòng nguồn, giá trị, lý do và cách xử lý; có tải báo cáo. Bỏ dòng lỗi là lựa chọn rõ, không mặc định nhập các dòng còn lại khi người dùng chưa xác nhận.
- Trước ghi hiện “Sẽ tạo N người/M khoản; bỏ K dòng; không cập nhật hồ sơ cũ” hoặc chế độ cập nhật bằng ID đã chọn. Nếu sửa mapping, hủy kết quả preview cũ và kiểm tra lại.
- Khi submit khóa thao tác nhưng vẫn có tiến độ/trạng thái; mất mạng dùng Kiểm tra batch, không tự gửi batch mới. Kết quả có số đã tạo/bỏ, link xem và điều kiện hoàn tác.

### 7.15. S34/S35 — Nhật ký, thùng rác và hậu cưới

- Nhật ký: người, lúc, đối tượng, loại thay đổi; mở trước/sau của trường cần thiết, che token/secret hoàn toàn. Lọc theo buổi/loại, không cho người nhà truy cập.
- Thùng rác: đối tượng, ngày xóa, hạn khôi phục, liên kết chặn nếu có; Khôi phục xem trước xung đột. Tài chính không xuất hiện như hàng xóa mềm có thể biến mất sau 30 ngày.
- Hậu cưới: checklist thanh toán/hoàn cọc/trả đồ/nhận ảnh/cảm ơn; liên kết bản ghi thật, không có checklist thứ hai tính tiến độ độc lập sai số.
- Lưu trữ: xem việc/nghĩa vụ còn mở và xuất dữ liệu trước khi xác nhận Chuyển chỉ đọc. Bản đang lưu trữ có banner xuyên suốt; chủ có Mở lại, người nhà không có. Server vẫn chặn ghi, không chỉ disable UI.

## 8. Luồng thao tác chuẩn

Các đường dưới đây là luồng phải dựng được trong prototype/ứng dụng. Dấu → là chuyển bước; mọi bước ghi vẫn theo quyền và transaction của PLAN.

| Luồng | Đường thao tác | Kết quả bắt buộc |
| --- | --- | --- |
| FL01 | S01 → S02 → S03 | Chủ vào ứng dụng trống, giữ ghi chú ngày dự kiến; không có ngày giả. |
| FL02 | S05 → Thêm gia đình → xem trước → S06 | Một nhóm thiệp, nhiều người, giữ số lượng đúng. |
| FL03 | S06 → chọn buổi → cập nhật phản hồi → lưu | Chỉ buổi/thành viên đã chọn thay đổi. |
| FL04 | S07 → chọn nhóm → ngày/người gửi → xác nhận | Đổi trạng thái thiệp, không đổi tham dự. |
| FL05 | S08 → thêm khoản chưa biết giá → S09 | Khoản tồn tại và tổng có nhãn tạm tính. |
| FL06 | S09 → ghi cọc → xem trước → xác nhận | Một giao dịch, có phân bổ hoặc trả trước; không cần hợp đồng đã chốt. |
| FL07 | S09 → chọn giao dịch → hoàn tiền/điều chỉnh nghĩa vụ | Tiền và nợ/dư cập nhật đúng, không lẫn hủy ghi nhận. |
| FL08 | S09 → hủy dịch vụ → nghĩa vụ cuối → ghi hoàn khi thực nhận | Giữ lịch sử, phí hủy và khoản cần hoàn đúng. |
| FL09 | S11 → mở sổ → ghi khoản lịch sử | Mốc quỹ và số dư không bị trừ lại khoản trước mốc. |
| FL10 | S12 → thêm việc → chọn hạn tương đối chưa chốt ngày | Lưu việc chờ ngày; không sinh quá hạn giả. |
| FL11 | S04 → đổi ngày → xem ảnh hưởng → xác nhận | Ngày đại diện/lịch/hạn tương đối khớp; hạn cố định không tự đổi. |
| FL12 | S18 → chọn gia đình → bàn → lưu/chuyển | Đủ ghế, không tách ngầm, xung đột còn dữ liệu để chọn lại. |
| FL13 | S19/S18 → S27 → chốt → ghi bàn giao | Phiên bản bất biến; sửa tiếp hiện chênh lệch chưa giao lại. |
| FL14 | S16 → upload ảnh/báo giá → chọn → tạo khoản chi | Tệp có quyền đúng, không tạo chi phí trùng từ nguồn. |
| FL15 | S25 → Bắt đầu/Hoàn tất → dời mục chưa bắt đầu | Giữ kế hoạch gốc, thực tế và xem trước thay đổi. |
| FL16 | S26 → quà gia đình → đánh dấu cảm ơn → trả lại nếu có | Không nhân tiền theo số người, dòng tiền theo mốc mở sổ. |
| FL17 | S31 → mời → tự gửi link → người nhà đăng nhập | Đúng email, chỉ buổi được chia sẻ, không có nút sửa. |
| FL18 | S32 → rà lỗi → xác nhận batch → S05/S08 | Chỉ bản đã xem trước được ghi; không ghi nửa batch. |
| FL19 | Form đang nhập → hết phiên/mất mạng → đăng nhập/thử lại | Phục hồi đúng tài khoản, không tự ghi đè, không lặp giao dịch. |
| FL20 | S35 → xuất lưu trữ → chuyển chỉ đọc → mở lại | Có xác nhận và audit, không mất dữ liệu khi đổi trạng thái. |

## 9. Trạng thái và phản hồi khi có lỗi

| Trạng thái | Giao diện | Hành động |
| --- | --- | --- |
| Tải lần đầu | Skeleton đúng kích thước vùng dữ liệu; không có số 0 giả trong thẻ. | Chờ; lỗi chuyển sang retry. |
| Tải lại/lọc | Giữ nội dung cũ với nhãn Đang cập nhật, khóa thao tác phụ thuộc kết quả mới khi cần. | Không reset lọc hoặc cuộn lên đầu vô cớ. |
| Chưa có dữ liệu | Nói rõ chưa có khách/chi/việc; CTA đầu tiên đúng quyền. | Thêm mới hoặc chọn danh mục gợi ý. |
| Không khớp lọc | “Không có kết quả với bộ lọc này”, hiển thị filter. | Xóa/đổi lọc; không đề nghị tạo bản trùng ngay. |
| Chưa chốt/thông tin thiếu | Chữ Chưa chốt/Chưa nhập, giải thích ảnh hưởng chỉ số. | Link tới trường cần nhập. |
| Đang lưu | Nút Đang lưu, form không cho gửi lại; dữ liệu gõ còn nguyên. | Chờ hoặc kiểm tra kết quả khi timeout. |
| Lưu thành công | Xác nhận đã lưu + giờ; cập nhật dữ liệu từ máy chủ. | Quay lại hoặc thêm tiếp theo lựa chọn của người dùng. |
| Lỗi từng trường | Tóm tắt đầu form + lỗi sát trường, focus lỗi đầu tiên. | Sửa, không nhập lại cả form. |
| Xung đột phiên bản | Nêu người/giờ cập nhật mới nếu được phép, phần thay đổi và draft. | Tải bản mới/chọn lại; không force overwrite mặc định. |
| Mất mạng | Banner còn hiển thị; đánh dấu dữ liệu có thể cũ, giữ draft. | Thử lại; ngày cưới mở bản đã tải/in. |
| Hết phiên | Nhắc đăng nhập lại; giữ draft đúng tài khoản trong thời hạn. | Đăng nhập cùng tài khoản, kiểm tra version trước lưu. |
| Không có quyền/đã bị thu hồi | Trang phù hợp, không hé tên/tổng tiền của đối tượng riêng. | Về phần còn được xem hoặc đổi tài khoản. |
| Bảo trì/backup | “Tạm dừng lưu dữ liệu, vui lòng thử lại”; không gọi lỗi nhập sai. | Giữ form và thử lại, không gửi ngầm. |
| Tệp lỗi | Nguyên nhân loại/kích thước/xử lý/kết nối cụ thể trên đúng tệp. | Bỏ hoặc thử lại tệp đó. |
| Chỉ đọc/lưu trữ | Banner xuyên trang, không có nút ghi khả dụng. | Chủ mở lại qua luồng có xác nhận. |

Thông báo lỗi có mã yêu cầu để vận hành tra cứu nhưng không đổ stack trace/SQL lên UI. Focus và thông báo dùng live region phù hợp; không đọc lại toàn bộ trang mỗi lần đổi filter.

## 10. Ngôn ngữ và cách trình bày dữ liệu

- Tên hành động dùng động từ cụ thể: Thêm khách, Ghi thanh toán, Nhận hoàn tiền, Hủy ghi nhận, Tạo bản chốt, Ghi đã bàn giao. Không dùng một chữ Xác nhận cho mọi hành động có hậu quả khác nhau.
- Phân biệt `Đã gửi thiệp`, `Đồng ý tham dự`, `Đã đến`, `Đã cảm ơn`. Không gom các trạng thái này vào một checkbox Đã xong.
- Trạng thái khách hiển thị: Chưa hỏi / Chờ phản hồi / Có thể / Đồng ý / Từ chối. Phản hồi không có dữ liệu để Chưa hỏi, không suy thành Từ chối.
- Khoản chi: Dự kiến / Đã chốt / Hoàn tất / Đang xử lý hủy / Đã hủy. Trạng thái tiền là badge khác: Chưa trả / Trả một phần / Đã đủ / Dư thanh toán / Chưa xác định nghĩa vụ.
- Ngày chính thức dùng `dd/mm/yyyy`; hạn có thể thêm “Hôm nay”, “Còn 3 ngày”, “Quá hạn 2 ngày” nhưng luôn mở được ngày tuyệt đối. Ngày chưa biết là Chưa chốt, không `01/01/2028`.
- Số tiền đầy đủ có ₫. 0 đã xác nhận hiển thị `0 ₫`; chưa có là `Chưa nhập`. Tổng tạm tính có nhãn ngay cạnh tổng, không giấu trong tooltip.
- Người duy nhất, lượt tham dự, thiệp, ghế và suất đều có đơn vị trong nhãn. Biểu đồ có giá trị text/bảng thay thế; không chỉ màu và legend.
- Câu mẫu khi chưa chốt giá: “Còn 2 khoản chưa có giá; tổng này là tạm tính”. Khi lưu lỗi: “Chưa lưu được. Nội dung bạn nhập vẫn còn.” Khi thu hồi quyền: “Bạn không còn quyền xem nội dung này.”
- Tiêu đề dài được wrap, tên khách đầy đủ ở màn chi tiết; truncate chỉ ở danh sách có cách mở xem. Không dùng tooltip hover làm cách duy nhất để đọc trên mobile.

## 11. Điện thoại, bàn phím và khả năng tiếp cận

- Bàn phím số cho tiền/số lượng/điện thoại; email dùng input phù hợp nhưng không tự viết hoa. Không chặn paste số điện thoại có dấu cách; chuẩn hóa có xem giá trị sau lưu.
- Khi bàn phím mở, trường đang nhập và nút tiếp theo không bị footer/sticky che. Điều hướng dưới không xuất hiện chồng thanh Lưu của form toàn màn hình.
- Tab order theo thứ tự nội dung; dialog giữ focus, có tên và trả focus về nút mở khi đóng. Không khóa người dùng trong canvas hoặc date picker.
- Checkbox/toggle có label bấm được, không chỉ một ô 16 px. Vùng chạm hành động tối thiểu 44×44 px là quy tắc sản phẩm, không tuyên bố đó là mọi yêu cầu tối thiểu WCAG.
- Chữ thông thường mục tiêu tương phản ít nhất 4,5:1; thành phần focus không bị che. Kiểm tra ở 200% zoom và chế độ giảm chuyển động.
- Có skip link tới nội dung chính, hierarchy tiêu đề đúng, bảng có header, ảnh có mô tả ngắn phù hợp; ảnh trang trí alt rỗng.
- Các trạng thái lỗi/thành công đọc được qua screen reader; drag/drop có menu và phím thay thế. Không dựa vào hover hoặc kéo dài để xóa.

Tham chiếu [W3C về tương phản](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [focus không bị che](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) và [vùng thao tác](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). Các quy tắc này phải kiểm tra trên bản dựng, không suy từ việc dùng component library là đã đạt chuẩn.

## 12. UX ảnh, tiến độ và quyền chia sẻ

- Trước upload hiện loại hỗ trợ, dung lượng tối đa và mặc định Riêng cho hai người. Không dùng một chữ Công khai gây hiểu là link Internet; nhãn là Chia sẻ với người nhà được cấp buổi này.
- Chọn HEIC/RAW/video: báo đúng định dạng chưa hỗ trợ và cách chọn JPEG/PNG/WebP/PDF phù hợp. Không đổi tên đuôi rồi nhận như ảnh đã chuyển đổi.
- Tiến độ tách Đang gửi byte và Đang xử lý ảnh. Gửi đủ 100% byte chưa được gọi Đã lưu khi server còn tạo biến thể/metadata.
- Người dùng có thể bỏ tệp chưa gửi. Hủy khi đang gửi có thể đua với việc server đã lưu; kiểm tra trạng thái rồi đề nghị xóa mềm bản đã hoàn tất nếu cần, không chỉ giấu thẻ ở UI.
- Người nhà chỉ thấy biến thể hiển thị của ảnh được phép và tài liệu vận hành đã chọn; không hiện link bản gốc, EXIF/GPS hoặc tên gốc tài liệu riêng.
- Đổi ảnh đại diện giữ ảnh cũ trong thư viện cho tới khi người dùng xóa; không xóa bản gốc chỉ vì bỏ đại diện.
- Upload thành công cập nhật đúng hồ sơ gốc và thumbnail; reload trang vẫn thấy. Lỗi một tệp không xóa cả batch ảnh đã thành công.

## 13. UX bản chốt, bản in và quyền riêng tư

- Có hai lựa chọn rõ: Bản làm việc hiện tại và Bản đã chốt phiên bản X. Không dùng chung tiêu đề khiến người nhận không biết số nào đã giao nhà hàng.
- Phiên bản cũ có watermark/chữ “Bản đã chốt lúc …”; banner nếu hiện tại đã có thay đổi, không âm thầm gắn dữ liệu mới vào file cũ.
- Xem trước bản bàn giao luôn thể hiện buổi, giờ xuất, phiên bản, phần dữ liệu còn thiếu và người có thể xem.
- A4 dọc cho danh sách/checklist, ngang cho sơ đồ/so sánh khi cần. Lặp header bảng, tránh tách một hàng khách/số tiền giữa hai trang; số trang ở footer.
- Bản dùng chung không có hợp đồng, giá, quà, ghi chú riêng, địa chỉ hay liên hệ khách. Danh bạ vận hành chỉ gồm đầu mối đã chọn chia sẻ.
- Hiện “Tải để dùng khi mất mạng” và hướng dẫn lưu/in trước buổi. Nút mở bản tải không hứa truy cập offline nếu trình duyệt chưa lưu tệp.
- Sao chép link không làm tăng quyền người nhận. Tên đối tượng riêng không xuất hiện trong preview lỗi quyền, toast hoặc route chứa slug có dữ liệu riêng.

## 14. Gói thiết kế phải bàn giao trước khi nhân rộng giao diện

### 14.1. Đầu ra G1

1. Bộ token/style và trang component gallery có state đầy đủ theo mục 2/5.
2. Sáu màn hình ở mục 6, mỗi màn có bản desktop 1.440 px và mobile 390 px; kiểm tra reflow 360 px và 768 px. S06/S09 có các form/chi tiết cần để luồng chính thực hiện được.
3. Prototype HTML có thể bấm, chạy local với dữ liệu giả và đường đi được mô tả. Không yêu cầu mua Figma hoặc một dịch vụ thiết kế. Có thể dùng công cụ thiết kế khác để hỗ trợ, nhưng sản phẩm review phải mở được và thao tác được.
4. Với mỗi màn chính: ít nhất trạng thái có dữ liệu, trống, loading, lỗi và quyền chỉ xem tương ứng; trạng thái tài chính không có quyền thì không có bản người nhà giả.
5. Luồng prototype bắt buộc: FL01, FL02, FL03, FL05, FL06, FL10, FL12, FL13, FL15 và FL17. R2/R3 trong G1 là kiểm chứng bố cục/luồng bằng dữ liệu giả, không phải module đã lưu thật.
6. Bản ghi review: vấn đề, mức độ, cách sửa và ảnh/chụp trạng thái sau sửa. Màu/font có thể tinh chỉnh nhưng phải cập nhật token, không tạo ngoại lệ rải rác.

### 14.2. Trước khi code từng mốc

- R1: cụ thể hóa S01–S14, S28–S34 theo màn thuộc R1, gồm form và đường lỗi. S21 chỉ dùng upload chứng từ nhúng, chưa thư viện đầy đủ.
- R2: mở rộng S15–S24 và S27, gồm snapshot bàn giao; S23 liên kết tới S22 thay nhân bản dữ liệu ý tưởng.
- R3: hoàn thiện S25/S26/S35, điểm danh, bộ bàn giao ngày cưới và mở rộng báo cáo/quà.
- Mỗi màn có bảng trường/điều kiện hiển thị, primary/secondary action, state và mapping sang command/query đã chốt ở G0 hoặc đầu mốc mới. Không code từ một screenshot thiếu hành vi.

### 14.3. Fixture dùng chung cho prototype và test

- Tập trống: chỉ tên hai người và ghi chú ngày dự kiến, không khách/chi/việc.
- Tập chuẩn: 2 buổi giả, 100 người duy nhất, 120 lượt mời phân bổ đúng, 30 nhóm thiệp; 10 bàn ở mỗi buổi; 20 công việc; 12 khoản chi. Giá trị cụ thể và expected totals phải được ghi trong file fixture, không vừa nhập vừa ước lượng tổng.
- Tập tình huống: gia đình 4 người/1 thiệp; em bé không ghế; hai khách cùng tên; khách chưa phản hồi; giá chưa chốt; cọc trước lịch trả; mất cọc/hoàn; bàn hết chỗ; người nhà bị thu hồi quyền; tên dài và tiếng Việt đầy đủ.
- Tập lỗi: request chậm 3 giây, lưu lỗi, timeout nhưng đã ghi thành công, mất mạng, version cũ, tệp sai loại và batch nhập lỗi.
- Tất cả fixture là tổng hợp, không sao chép dữ liệu mẫu của Sheet thành dữ liệu thật hoặc lấy thông tin khách thật để làm ảnh review.

## 15. Kiểm thử UX và tiêu chí chấp nhận

Các test UXT dưới đây bổ sung AT01–AT62 trong PLAN. Chúng là yêu cầu phải chạy, chưa phải kết quả test. Tác vụ có giờ đo dùng dữ liệu fixture, không gồm thời gian đi xin thông tin từ khách/nhà cung cấp; ghi rõ thiết bị và có cần người hướng dẫn hay không.

| Mã | Mốc | Bài kiểm tra | Điều kiện đạt |
| --- | --- | --- | --- |
| UXT01 | R1/G1 | Chủ mở lần đầu, chưa có ngày chính thức. | Tự tìm được bước thiết lập; không hiểu ghi chú dự kiến là ngày đã chốt; không bị bắt nhập ngày/tiền giả. |
| UXT02 | R1/G1 | Thêm gia đình 4 người cùng nhận thiệp. | Không hướng dẫn từng nút vẫn tạo đúng 1 thiệp/4 người; mục tiêu ≤ 120 giây sau khi đã có sẵn tên. |
| UXT03 | R1/G1 | Cập nhật 2/4 người đồng ý ở một trong hai buổi. | Buổi/thành viên còn lại không đổi; người dùng đọc đúng số người, không nhầm với số thiệp. |
| UXT04 | R1 | Lọc khách rồi mở chi tiết và Back. | Giữ buổi/filter/page/vị trí; không phải tìm lại từ đầu. |
| UXT05 | R1 | Gửi thiệp cho 5 nhóm. | Người dùng hiểu đang đổi 5 thiệp, không phải xác nhận mọi người tham dự; chỉ nhóm đã chọn đổi. |
| UXT06 | R1/G1 | Tạo khoản chưa có giá. | Lưu được, đọc ra tổng tạm tính; không kết luận còn dư ngân sách từ phần thiếu. |
| UXT07 | R1/G1 | Ghi cọc 5 triệu từ hồ sơ khoản chi. | Thấy khoản đích/tiền/ngày/phân bổ trước ghi; mục tiêu ≤ 60 giây khi thông tin sẵn có; không tạo đôi khi nhấn lặp. |
| UXT08 | R1 | Phân biệt hoàn tiền và hủy ghi nhận. | Người dùng chọn đúng thao tác trong hai tình huống thật/nhập sai; số liệu khớp fixture. |
| UXT09 | R1 | Mở quỹ sau khi đã cọc trước đó. | Người dùng hiểu số dư tại mốc; khoản cọc lịch sử không bị trừ lại; cảnh báo mốc rõ. |
| UXT10 | R1/G1 | Tìm việc của mình và thêm việc chưa có hạn. | Tìm được trong ≤ 30 giây; biết người phụ trách/hạn, không nhầm Chưa có hạn với quá hạn. |
| UXT11 | R1 | Đổi ngày buổi đại diện. | Đọc được nhóm tự đổi/không tự đổi; chỉ xác nhận sau xem trước; các màn khớp ngày. |
| UXT12 | R2/G1 | Xếp gia đình vào bàn trên điện thoại. | Làm được không kéo thả; thiếu chỗ có lý do; mục tiêu ≤ 60 giây với khách/bàn đã có. |
| UXT13 | R2 | Hai chủ giành ghế cuối. | Người bị từ chối còn khách đã chọn, thấy sức chứa mới và chọn bàn khác được, không phải nhập lại. |
| UXT14 | R2/G1 | Chốt số bàn/suất rồi thêm một khách. | Người dùng chỉ ra được bản đã giao và phần phát sinh chưa giao; snapshot cũ không đổi. |
| UXT15 | R3/G1 | Xem lịch trình để biết việc hiện tại/tiếp theo. | Đọc ra tên/giờ/phụ trách trong ≤ 10 giây; mục quá giờ chưa bắt đầu không bị hiểu là đã làm. |
| UXT16 | R1/G1 | Người nhà mở ứng dụng. | Tự nhận biết chỉ xem, chọn đúng buổi; không thấy hoặc tìm ra khoản tiền/tệp riêng bằng search/menu. |
| UXT17 | R1 | Nhập form rồi mất mạng/lưu lỗi. | Nội dung còn, biết chưa lưu, thử lại không tạo đôi; không có thành công giả. |
| UXT18 | R1 | Form có version cũ. | Thấy khác biệt và bản nháp, không có ghi đè mặc định; hiểu kết quả trước khi lưu lại. |
| UXT19 | R1/R2 | Upload 3 ảnh, một ảnh lỗi. | Đọc được gửi/xử lý/đã lưu; retry riêng ảnh lỗi, ảnh thành công còn sau reload. |
| UXT20 | R1/R2 | Dùng toàn bộ luồng chính bằng bàn phím. | Focus thấy được, tab order đúng, không mắc trong dialog/canvas; có cách thay drag/drop. |
| UXT21 | R1 | 360/390/768/1440 px, zoom 200%, bàn phím điện thoại mở. | Không mất chữ tiền/nút lưu, không cuộn ngang toàn trang, sticky không che trường đang nhập. |
| UXT22 | R2/R3 | Xuất A4 và xem bản tải khi mất mạng. | Phiên bản/ngày/buổi rõ, tên/tiền không cắt, dữ liệu riêng đúng quyền; mở được tệp đã chủ động lưu. |
| UXT23 | R1 | Nhập file có lỗi ngày/trùng/cột thiếu. | Người dùng tìm được dòng lỗi và xem chính xác N bản ghi sẽ tạo; hủy không ghi dữ liệu. |
| UXT24 | R3 | Ghi phong bì chung cho hai người. | Chỉ nhập số tiền một lần; biết quà chưa rõ người gửi có thể đối chiếu sau. |
| UXT25 | R1 | Tương phản, label, trạng thái lỗi, screen reader smoke test. | Cặp màu thực tế đạt mục tiêu, lỗi được đọc, trạng thái không chỉ bằng màu, nút icon có tên. |
| UXT26 | R1 | Chọn HEIC/tệp quá dung lượng. | Thông báo đúng lý do và loại cần dùng, không vòng lặp retry như lỗi mạng. |
| UXT27 | R1 | Mời/thu hồi người nhà và xem lại phạm vi chia sẻ. | Hiểu Tạo lời mời không phải email đã gửi; chỉ đúng email nhận quyền; thu hồi không được mô tả là xóa bản đã in. |
| UXT28 | R1/R3 | Hết phiên OAuth và trạng thái lưu trữ. | Draft chỉ phục hồi đúng tài khoản; trạng thái chỉ đọc rõ và không cho thao tác ghi sai quyền. |

### 15.1. Cách tổ chức test

- G1 chạy với hai chủ sở hữu nếu có thể; ít nhất người dùng chính trực tiếp thử, không chỉ người triển khai tự nhận giao diện dễ dùng. Với vai trò người nhà, dùng một phiên chỉ xem để kiểm chứng riêng.
- Người chạy được giao mục tiêu, không được chỉ sẵn nút. Ghi thành công/thất bại, thời gian, chỗ dừng, câu hỏi và lỗi hiểu sai. Mốc thời gian là mục tiêu thiết kế ban đầu để tìm điểm nghẽn, không phải kết quả đã đạt.
- Không gắn lỗi dùng chậm cho người dùng. Nếu không hoàn thành hoặc hiểu sai số tiền/phạm vi, sửa nhãn/luồng rồi chạy lại tác vụ liên quan.
- Không cần test mọi dòng UI bằng unit test. Tự động hóa các luồng có rủi ro về dữ liệu/quyền và kiểm tra regression cốt lõi; bố cục, thao tác điện thoại và bản in cần xem bản dựng thực tế.

### 15.2. Mức lỗi và cổng chấp nhận

- **Nghiêm trọng:** lưu sai/lặp tiền, sai người/buổi, lộ dữ liệu, báo đã lưu giả, mất nội dung không có đường phục hồi trong điều kiện đã hứa. Chặn phát hành mốc liên quan.
- **Cao:** không hoàn thành được tác vụ cốt lõi bằng cách thao tác được hỗ trợ, không phân biệt bản chốt hoặc không đọc được nút/tiền trên mobile. Chặn phát hành mốc liên quan.
- **Vừa:** hoàn thành được nhưng khó tìm/khó hiểu, số bước không cần thiết hoặc trạng thái thiếu nhất quán. Có phương án sửa và kiểm chứng lại trước khi nhân rộng pattern.
- **Thấp:** lệch spacing/mỹ thuật không ảnh hưởng hiểu dữ liệu hoặc thao tác; ghi lại và sửa theo ưu tiên.

G1 chỉ xong khi sáu màn hình có đủ luồng prototype và không còn lỗi nghiêm trọng/cao trong tác vụ thuộc G1. R1/R2/R3 phải chạy các UXT thuộc mốc tương ứng trên bản lưu dữ liệu thật của ứng dụng; prototype không thay thế nghiệm thu chức năng.

## 16. Truy vết với plan và quản lý thay đổi

| Phạm vi UI | Nghiệp vụ trong PLAN | Kịch bản nền |
| --- | --- | --- |
| Khách/thiệp/tham dự | Mục 8 | AT05–AT10, AT61; UXT02–UXT05. |
| Khoản chi/quỹ/hoàn/hủy | Mục 9 | AT11–AT17, AT37–AT38, AT45–AT48, AT53–AT54; UXT06–UXT09. |
| Công việc/lịch/ngày đại diện | Mục 6/10 | AT18–AT20, AT62; UXT10–UXT11. |
| Bàn/suất/bản chốt | Mục 12/13 | AT21–AT22, AT52; UXT12–UXT14. |
| Lịch trình/quà/hậu cưới | Mục 14/16 | AT25, AT34–AT35, AT51, AT61; UXT15/UXT24/UXT28. |
| Quyền/ảnh/lỗi/nhập xuất | Mục 5/17–19/22 | AT03–AT04, AT26–AT33, AT39–AT44, AT49–AT60; UXT16–UXT23/UXT25–UXT27. |

Không thêm màn công khai, RSVP tự phục vụ, người nhà sửa dữ liệu, upload video hoặc đồng bộ ngoài chỉ vì một component demo có nút đó. Mọi thay đổi ảnh hưởng hành vi phải chỉ rõ màn hình, dữ liệu, quyền, AT/UXT và ước lượng liên quan.

Mặc định để triển khai đã được ghi trong tài liệu; việc còn phải thực hiện là dựng prototype/bản giao diện theo đặc tả và kiểm chứng với người dùng. Không ghi “đã duyệt giao diện” hoặc “đã đạt UX” chỉ vì tài liệu đã hoàn tất.
