# Chọn đợt xét và xem lại hồ sơ

Cập nhật ngày 11/11/2026.

## Cách sử dụng

1. Vào Kết quả xét CV. Trang chưa mở sẵn đợt đầu tiên.
2. Tìm theo tên JD, ngày tạo hoặc chọn gồm đợt lưu trữ. Mỗi lần tìm trả tối đa 200 đợt mới nhất; thu hẹp tên hoặc ngày để tìm các đợt cũ hơn.
3. Chọn đợt trong danh sách. Bảng dưới hiện đúng hồ sơ, điểm và trạng thái của đợt đó. Chọn lại dòng trống để ẩn bảng.
4. Bấm **Xem CV** để xem bản đã lưu; bấm **Xem đánh giá AI** để xem điểm thành phần, kỹ năng và bằng chứng.
5. Lọc tên/email, trạng thái hoặc điểm, sắp xếp cao/thấp; mỗi trang 10 hồ sơ. Excel và JSON vẫn xuất theo bộ lọc.

Các ô tìm kiếm chấp nhận có dấu hoặc không dấu và không phân biệt hoa/thường, kể cả Đ/đ. Ví dụ `du lieu` tìm được “Dữ liệu”, `do nguyen` tìm được “Đỗ Nguyễn”. Bộ lọc SQL và Excel áp dụng cùng quy tắc; dữ liệu gốc vẫn giữ nguyên dấu. Quy tắc này cũng áp dụng cho tìm việc, hồ sơ ứng tuyển, gửi phản hồi và chọn CV.

Liên kết có `?batch=...` từ trang phân tích sẽ mở thẳng đợt tương ứng. Tìm đợt mới không tự chuyển khỏi đợt đang xem; đợt đang mở ngoài bộ lọc được ghi rõ trong danh sách chọn.

## Ý nghĩa dữ liệu

- Tên/email là ảnh chụp dữ liệu khi tạo đợt; chưa khẳng định danh tính được xác minh.
- CV tải lên riêng chỉ có tên tệp thì không đoán tên/email người gửi.
- Ngày nhận trong bảng là thời điểm thêm hồ sơ vào đợt, không phải ngày nộp đơn ban đầu.
- PDF được xem trực tiếp và tải bản gốc. DOCX hiện văn bản; tải tệp gốc để xem bố cục/hình ảnh.
- Excel/văn bản hiện nội dung đã nhập, không tạo tệp gốc giả.
- CV được đọc qua khóa tài liệu đã lưu trong đợt; ứng viên thay CV mới không thay đổi bản đã xét.
- JD chuẩn có thể mở từ phần thông tin đợt; đây là bản đã lưu lúc tạo đợt.

## Quyền truy cập và kiểm tra

API xem/tải CV kiểm tra đồng thời công ty sở hữu đợt và hồ sơ thuộc đúng đợt. Không dùng ID CV hoặc khóa tài liệu do trình duyệt tự cung cấp. Không đổi cấu trúc cơ sở dữ liệu.

Kiểm tra JavaScript bao gồm chưa chọn đợt, đổi nhanh đợt, tìm theo ngày, mở từ liên kết và xem CV văn bản. Kiểm tra SQL trong giao dịch rollback bao gồm PDF, DOCX, văn bản, bản CV cố định và chặn truy cập công ty khác. Các điểm giả lập trong kiểm tra phần mềm không phải kết quả nghiên cứu.
