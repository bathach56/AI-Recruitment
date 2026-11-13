# Rà soát frontend: thiếu, thừa và việc nên giữ

> Tài liệu lịch sử/thiết kế tại thời điểm viết; không dùng thay hướng dẫn hiện tại. Xem [mục lục tài liệu](../README.md).

Ngày 11/11/2026, rà working tree hiện có, gồm bản xử lý nền và lưu SQL. Đợt này chỉ kiểm tra, không thay giao diện hoặc xóa chức năng. Nhận xét dựa trên mã HTML/JS/CSS, kiểm thử và HTTP; không phải kết luận đã kiểm tra trực quan mọi kích thước màn hình.

## Nên chỉnh trước khi demo

**Đã cập nhật theo yêu cầu tiếp theo:** mobile đăng nhập, tài nguyên local, bố cục Matching, bỏ lời gọi queue thừa, giới hạn/lỗi biểu mẫu, bộ lọc hồ sơ/tin/URL, nhãn hết hạn và sửa/nhân bản tin đã được triển khai. Báo cáo này giữ phát hiện ban đầu để truy nguồn; xem [CAP_NHAT_FRONTEND_2026_11_11.md](CAP_NHAT_FRONTEND_2026_11_11.md) để biết hành vi và kiểm thử mới.

| Ưu tiên | Phát hiện | Bằng chứng trong mã | Đề nghị |
| --- | --- | --- | --- |
| Cao | Đường vào đăng nhập trực tiếp ở header bị ẩn trên mobile | `workspace-refresh.css`, media max-width 760px có `.header .login-link{display:none}`; `_CareerLayout.cshtml` dùng chính class này cho link Đăng nhập, menu khách không có link đăng nhập thay thế | Giữ Đăng nhập và Đăng ký trong header hoặc thêm cả hai vào menu mobile. Không phải mất chức năng xác thực, nhưng người dùng khó tìm đường vào |
| Cao | Demo offline còn phụ thuộc CSS/icon/font bên ngoài | `Matching.cshtml`, `Admin.cshtml` tải Bootstrap và Bootstrap Icons từ jsdelivr; `_CareerLayout.cshtml` tải Google Fonts | Đóng gói dependency giao diện local để chạy khi chưa có cache/mất mạng. Font có fallback nên không đồng nghĩa toàn web trắng, nhưng bố cục/icon ở Matching/Admin vẫn có rủi ro |
| Vừa | Đối chiếu CV còn bố cục kết quả của luồng cũ | `matching-workspace.html` giữ cột `analysis-output`, empty-state Kết quả & bằng chứng và khối batch/JSON ẩn; `matching.js` nay chuyển sang ReviewResults sau khi xếp hàng | Dùng trang này cho chọn JD/CV/cấu hình và giải thích bước tiếp theo. Thu gọn/bỏ cột kết quả cũ, dành diện tích cho danh sách CV và xác nhận đợt xét |
| Vừa | Gửi lệnh xếp hàng lần hai không cần thiết | Payload tạo đợt có `runInBackground:true`; API Create đã xếp hàng trong giao dịch SQL, nhưng sau đó `matching.js` gọi `runBatch()` để POST `/queue` thêm lần nữa | Tạo thành công thì chuyển tới kết quả ngay. Giữ lệnh queue cho thao tác chạy tiếp/thử lại. API hiện có xử lý idempotent nên không mặc định gây chấm đôi, nhưng lỗi mạng ở lệnh thừa có thể làm người dùng nghĩ tạo đợt thất bại |
| Vừa | Giới hạn nhập liệu và thông báo lỗi chưa khớp API | Helper `field()` trong `career.js` mặc định email 254, các trường khác 200; ProfileRequest giới hạn tên/email 150, điện thoại 30. Wrapper `api()` chỉ hiển thị message tổng quát, không dùng `errors` theo trường | Đặt giới hạn riêng cho từng trường và chỉ rõ ô nào cần sửa. Ví dụ tên dài 151–200 ký tự hiện có thể nhập qua UI nhưng API từ chối |

## Những phần còn thiếu để sử dụng thuận tiện hơn

1. **Lọc Hồ sơ ứng tuyển theo JD/trạng thái/tên.** `recruiterApplicationsMarkup()` hiện liệt kê tất cả hồ sơ công ty, chia 10/trang; chưa có bộ lọc. Trang Gửi phản hồi đã có lọc theo tin và tìm tên nên nên dùng cùng cách thao tác. Đây là nhu cầu đáng ưu tiên khi một công ty có nhiều vị trí.
2. **Giữ bộ lọc tìm việc trong URL.** `filterJobs()` cập nhật danh sách nhưng không ghi từ khóa, thành phố, ngành, kinh nghiệm, sắp xếp vào URL. Mở `/?q=...` rồi đổi từ khóa có thể khiến URL còn truy vấn cũ; F5/chia sẻ link không khôi phục đúng trạng thái đang thấy.
3. **Phân biệt tin đã hết hạn trong quản lý tuyển dụng.** Danh sách và số lượng Đang tuyển đang xét `status==='Published'`, không xét deadline. Tin Published nhưng quá hạn có thể vẫn được ghi Đang tuyển ở dashboard dù trang chi tiết đã khóa ứng tuyển đúng. Nên có nhãn Hết hạn và cách đếm nhất quán.
4. **Chỉnh sửa tin nháp hoặc JD đã lưu.** Giao diện hiện có tạo, đăng/đóng, xem tin và đối chiếu; chưa có thao tác sửa nội dung. Backend cũng chưa có endpoint sửa nội dung tin, nên không chỉ thêm một nút giả. Cần chốt quy tắc sửa JD sau khi đã nhận CV và giữ phiên bản kết quả cũ trước khi triển khai.
5. **Phản hồi lỗi tại chỗ và hành động thử lại.** Home có nút Thử lại, nhưng nhiều workspace chỉ hiện notice/toast rồi yêu cầu người dùng tự đổi mục/tải lại trang. Nên thống nhất các trạng thái đang tải, lỗi, rỗng và nút thử lại; trường bị lỗi nên có nhãn lỗi/focus thay vì chỉ toast.

## Những phần thừa hoặc nên thu gọn

- **Bộ chọn vai trò trên trang Đăng nhập:** có thể gây hiểu nhầm rằng người dùng chọn quyền đăng nhập. Quyền thực lấy từ SQL; login payload không gửi role. Nên giữ bộ chọn trên Đăng ký, còn Đăng nhập dùng chung hoặc chỉ phân biệt lời giới thiệu. `roleHint` trên Login hiện vẫn nói về “sau khi đăng ký”, nên sửa nội dung theo trang.
- **Khối kết quả/JSON cũ trong Matching:** chỉ dọn sau khi rà các handler đang tham chiếu ID. Mục kết quả thực sự hiện là ReviewResults; tránh hai nơi cùng hứa hiển thị kết quả nhưng chỉ một nơi được dùng.
- **Nhánh preview và tài nguyên cũ:** `career.js` còn nhiều nhánh giao diện xem trước. Không xóa nguyên các hàm vì nhánh Tạo CV và Tạo tin vẫn được tái sử dụng. Một số thông báo “chưa có API” trong template được hàm live xóa trước khi hiển thị, nên không được kết luận chúng đang hiện cho người dùng chỉ từ việc tìm chuỗi. Cần tách rõ phần đang dùng trước khi dọn.
- **Thông tin kỹ thuật lặp:** có thể thu gọn JD #ID, giải thích phương pháp và lưu ý dài bằng khu vực chi tiết. Vẫn giữ thông báo điểm không phải quyết định tuyển dụng và giới hạn OCR ở nơi người dùng cần biết.

## Những phần nên giữ

- Trang Hồ sơ ứng tuyển và Gửi phản hồi đã tách chức năng; ứng viên có chi tiết kết quả riêng.
- CV xem trực tiếp trên web, có đường tải tệp gốc.
- Phân trang 5 việc/trang ở trang chủ; 10 mục/trang ở các danh sách đã cấu hình.
- Icon lưu việc có trạng thái đã lưu, hủy lưu và xử lý lỗi; thông báo dẫn đúng ID ứng tuyển.
- Kết quả AI phân biệt điểm 0 với thiếu điểm/lỗi, có bằng chứng, lọc và tải Excel.
- Hàng đợi có tiến độ, tạm dừng/chạy tiếp; giải thích rõ máy chủ tiếp tục xử lý khi đóng trình duyệt.
- Có label, focus-visible, hỗ trợ reduced-motion và bảng cuộn ngang trong mã. Chưa đo đủ để kết luận đạt toàn bộ tiêu chí accessibility.

## Kiểm tra đã thực hiện và giới hạn

- 44/44 kiểm thử JavaScript hiện có đạt. Điều này không phủ hết các thiếu sót UX bên trên.
- HTTP 200 cho `/`, `/Login`, `/Register`, `/Jobs/25`, `/Recruiter`, `/Matching`, `/ReviewResults` với vai trò phù hợp; toàn bộ CSS/JS nội bộ tham chiếu từ các trang đã kiểm tra trả 200.
- Xác nhận HTML vẫn tham chiếu fonts.googleapis.com, fonts.gstatic.com, cdn.jsdelivr.net. Chưa thử giả lập mạng offline trên trình duyệt; đây là phụ thuộc xác định từ mã, không phải khẳng định đã quan sát một lần vỡ giao diện offline.
- `sky.list_apps()` báo native pipe unavailable nên chưa chụp/bấm trình duyệt, kiểm tra 320/375/768/1440px hoặc đo tương phản/render thực tế. Nhận xét CSS mobile là bằng chứng tĩnh; bố cục cần kiểm tra trực quan sau khi kết nối công cụ được.
- Dùng hướng dẫn frontend-design về nội dung/diện tích có mục đích và UI/UX Pro Max về điều hướng, nhập liệu. Tìm kiếm trong skill không có mục khớp riêng việc ẩn link đăng nhập mobile; kết luận đó dựa trực tiếp trên CSS và markup của dự án.

Thứ tự nên làm: đường đăng nhập mobile và dependency offline → thu gọn Matching/loại lời gọi thừa → giới hạn/lỗi biểu mẫu → lọc hồ sơ và giữ bộ lọc URL → trạng thái hết hạn → chỉnh sửa JD có quy tắc phiên bản. Các mục tiện ích mới cần triển khai thật và kiểm thử, không thêm nút chưa có xử lý.
