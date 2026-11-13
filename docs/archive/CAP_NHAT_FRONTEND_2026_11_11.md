# Cập nhật frontend — 11/11/2026

> Tài liệu lịch sử/thiết kế tại thời điểm viết; không dùng thay hướng dẫn hiện tại. Xem [mục lục tài liệu](../README.md).

## Luồng thao tác rõ hơn

- Đối chiếu CV dùng toàn chiều rộng cho JD, phương pháp và các nguồn CV. Phần kết quả chuyển sang trang Kết quả xét CV; có hướng dẫn và đường mở các đợt đã lưu ngay trên trang chuẩn bị.
- Tạo đợt đã xếp hàng trong giao dịch SQL thì chuyển thẳng tới kết quả; bỏ lời gọi xếp hàng thừa lần hai. Hàng đợi, tạm dừng/chạy tiếp, bằng chứng và tải Excel tiếp tục dùng API hiện có.
- Xuất JSON được đưa vào mục “Tải dữ liệu đầy đủ” trên trang kết quả, theo bộ lọc đang xem. Những ID kết quả cũ trong template Matching được giữ trong khối ẩn để tránh làm hỏng handler đang tương thích; không còn chiếm cột hiển thị.

## Quản lý tuyển dụng

- Hồ sơ ứng tuyển: lọc theo tin, trạng thái, tên/email/vị trí; tìm không dấu; đếm đúng số hiển thị và có trạng thái không khớp. Lọc trên toàn bộ dữ liệu đã tải của công ty, kết hợp phân trang 10 hồ sơ, giữ bộ lọc trong URL.
- Tin tuyển dụng: tìm theo vị trí/địa điểm, lọc nháp/đang tuyển/hết hạn/đã đóng. “Hết hạn” là trạng thái hiển thị tính từ deadline; số tin đang tuyển cũng xét deadline.
- Sửa bản nháp: mở dữ liệu thật từ API có kiểm tra công ty; điền lại trường, lưu SQL và hỗ trợ đăng công khai nếu doanh nghiệp đủ điều kiện. Backend dùng giao dịch khi cập nhật.
- Tin đã nhận CV, đã có đợt xét hoặc đã công khai được giữ lịch sử. Khi mở sửa tin bị khóa, giao diện giải thích và cung cấp đường “Nhân bản thành tin mới”. Backend cũng kiểm tra điều kiện, không chỉ ẩn nút.
- Nhân bản: điền dữ liệu tin nguồn thuộc chính công ty vào biểu mẫu mới; khi lưu tạo ID mới. Hạn nộp và nội dung được người tuyển dụng kiểm tra lại. Ứng viên và kết quả cũ tiếp tục tham chiếu tin gốc.
- Biểu mẫu tin có cảnh báo thay đổi chưa lưu khi rời trang/mục; có kiểm tra khoảng lương và hạn nộp; nút lưu có trạng thái đang xử lý và chặn gửi trùng.

## Tìm việc, biểu mẫu và mobile

- Từ khóa, địa điểm, ngành, hình thức, lương, kinh nghiệm, sắp xếp và nhu cầu gấp được mã hóa trong URL để F5/chia sẻ phục hồi bộ lọc. Phân trang trang chủ vẫn 5 mục.
- Giới hạn tên/email/điện thoại/website/kỹ năng được đồng bộ với DTO tương ứng. Lỗi validation của API có thể hiện ngay tại trường, có aria-invalid, mô tả lỗi và focus.
- Đăng nhập dùng một form chung; hệ thống lấy vai trò từ SQL. Đăng ký vẫn chọn vai trò. Link đăng nhập ở header mobile được giữ; điều chỉnh nút, bộ lọc và header cho màn hình nhỏ.
- Workspace có thao tác Thử tải lại khi tải dữ liệu lỗi. Hộp thoại có tên cho công cụ đọc màn hình. Điều khiển mới dùng màu/font hiện có và hỗ trợ reduced-motion.

## Giao diện chạy local

Bootstrap 5.3.3, Bootstrap Icons 1.11.3 và Be Vietnam Pro đã được đưa về `wwwroot/vendor` kèm giấy phép và manifest SHA-256. Các trang Razor dùng tài nguyên local; font/icon bên trong CSS cũng lấy từ local. Có script `tools/Fetch-FrontendAssets.ps1` để tái tạo tài nguyên cùng phiên bản khi cần mạng, không chạy lúc mở web.

Kiểm thử HTTP kiểm tra đệ quy các URL tài nguyên CSS/JS/font từ các trang chính và xác nhận chúng trả 200 ở cùng origin. Chưa phải phép đo render trình duyệt khi chặn mạng, nhưng không còn phụ thuộc CDN trong các trang đã kiểm tra.

## Kiểm chứng

- 50 kiểm thử JavaScript đạt, gồm các kiểm tra cũ và bộ mới về URL bộ lọc, tìm hồ sơ, phân trang sau lọc, lỗi inline, trạng thái hết hạn, xuất JSON.
- Kiểm thử SQL hoàn tác đạt: sửa bản nháp của mình, khóa JD có lịch sử, chặn công ty khác và nhân bản thành tin độc lập; các kiểm tra CV/PDF/DOCX, phản hồi/thông báo, 30/50/20 theo JD, hàng đợi và XLSX vẫn đạt.
- Hai kiểm thử HTTP luồng ứng viên/nhà tuyển dụng cũ đạt; hai kiểm thử tài nguyên local/khóa sửa JD đạt.
- Build .NET đạt, 0 lỗi/cảnh báo. Dữ liệu fixture SQL mới được hoàn tác, không gửi phản hồi tuyển dụng trong lần kiểm thử này.
- Công cụ UI báo native pipe/browser host unavailable, nên chưa có ảnh chụp hoặc kiểm chứng bấm trực tiếp ở từng kích thước màn hình. Cần kiểm tra trực quan 320/375/768/1440px, sáng/tối khi kết nối công cụ được; không coi kiểm thử DOM/HTTP là thay thế bước này.

Các bộ lọc hiện xử lý toàn bộ danh sách công ty đã tải; nếu dữ liệu tăng lớn cần chuyển truy vấn/phân trang sang máy chủ. Chưa commit/push đợt cập nhật này. Web local: http://localhost:5132.
