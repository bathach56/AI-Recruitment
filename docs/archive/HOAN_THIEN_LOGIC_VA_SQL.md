# Hoàn thiện logic và lưu SQL — 11/11/2026

> Tài liệu lịch sử/thiết kế tại thời điểm viết; không dùng thay hướng dẫn hiện tại. Xem [mục lục tài liệu](../README.md).

## Đã sửa theo báo cáo rà soát

1. Sau đăng nhập, quay đúng Matching/JD, ReviewResults/đợt xét, Admin hoặc hồ sơ ứng viên; chỉ chấp nhận đường dẫn nội bộ đúng vai trò. Liên kết đăng nhập/đăng ký và đổi vai trò giữ ReturnUrl.
2. Không xóa nội dung mục mới khi yêu cầu lưu của mục cũ hoàn tất. Mã phiên tải ngăn phản hồi cũ của cùng mục ghi đè lần tải mới.
3. Đăng tin có lựa chọn ngành nghề, gửi ngành qua API, kiểm tra danh mục phía máy chủ và lưu đúng SQL.
4. Chi tiết tin lấy theo ID qua API riêng; tin đóng/hết hạn vẫn đọc được, khóa nút ứng tuyển. Tin nháp chỉ hiện cho chủ tin hoặc ứng viên có quan hệ ứng tuyển hợp lệ. Danh sách không còn cắt âm thầm ở 200 tin.
5. Bộ lọc kinh nghiệm lấy các lựa chọn từ dữ liệu SQL đang hiển thị, chuẩn hóa dấu gạch khoảng năm; cách lọc là nhóm chính xác, chưa phải suy luận giao nhau các khoảng số năm.
6. Tổng quan tuyển dụng hiển thị phương pháp “Kết hợp”, không còn nhầm với hình thức làm việc.

## Dữ liệu và dự phòng

Toàn bộ dữ liệu nghiệp vụ, kết quả/cấu hình AI, hồ sơ nhập Excel và nội dung tài liệu tải lên được lưu SQL. 36 tài liệu cũ đã nhập vào bảng Documents, kiểm tra byte sau ghi, giữ nguyên các ID tham chiếu và các tệp cũ. Trước chuyển đổi đã có bản sao SQL kiểm tra bằng CHECKSUM/VERIFYONLY; sau chuyển đổi và xét lại AI đã tạo thêm bản sao chứa cả tài liệu SQL.

Web đọc CV và gửi CV sang AI trực tiếp từ SQL, không dựa vào thư mục tệp cũ. Mã nguồn, mô hình, nhật ký, bản sao, bộ nghiên cứu và tùy chọn giao diện không được coi là bản ghi nghiệp vụ. Bản phát mật khẩu mẫu chỉ là tệp riêng để người demo tra cứu, xác thực vẫn dùng mật khẩu băm trong SQL.

Repository dùng nâng cấp schema bổ sung vì chưa có EF migrations; không tái tạo hoặc xóa database. Không ghi đè các trạng thái và phản hồi người dùng. Bản mã cũ đọc tệp không sử dụng được tài liệu mới chỉ lưu SQL; khi phục hồi cần dùng mã nguồn mới và bản SQL tương ứng, không tùy tiện ghi đè bằng bản sao trước chuyển đổi.

## Kiểm chứng thực hiện

- Build web và công cụ DemoScenario: 0 lỗi, 0 cảnh báo.
- 43 kiểm thử JavaScript đạt, có 4 bài hồi quy mới về đích đăng nhập, yêu cầu cũ ghi đè mục mới và kinh nghiệm.
- Kiểm thử SQL hoàn tác đạt, thêm ngành nghề/kinh nghiệm, tin nháp/đóng/hết hạn, hơn 200 tin và đọc tài liệu SQL; các kiểm tra phân quyền 30/50/20, phản hồi, PDF/DOCX và XLSX vẫn đạt.
- 2 kiểm thử HTTP có đăng nhập đạt sau chuyển đổi.
- Đã chạy AI thật trên cả 6 PDF tiếng Việt đọc từ SQL, kiểm tra tách 2 CV/JD, chặn công ty khác, sắp xếp/lọc và xuất Excel. Có ba đợt kết quả mới trong tài khoản công ty. Đây là kiểm tra chức năng, không phải đo độ chính xác nghiên cứu.
- Đã chạy script mở local, thử dừng đúng dịch vụ do script tạo và mở lại thành công. AI đã chạy sẵn được dùng lại, không bị dừng cùng web.
- Bản sao SQL sau chuyển đổi được VERIFYONLY xác nhận; chưa thử khôi phục trên một máy độc lập. Công cụ UI vẫn chưa kết nối được từ lần rà soát, nên chưa có kiểm chứng bằng ảnh chụp/bấm trực tiếp trình duyệt sau đợt sửa này.

## Góp ý nên ưu tiên tiếp theo

**Cập nhật:** hàng đợi nền và thử phục hồi database riêng đã được thực hiện trong đợt tiếp theo; công cụ gán nhãn/đánh giá đã hoàn thiện nhưng nhãn con người vẫn đang trống. Xem [UU_TIEN_TIEP_THEO.md](UU_TIEN_TIEP_THEO.md) để phân biệt việc đã kiểm chứng và phần cần người đánh giá/máy dự phòng.

1. Với phần nghiên cứu, hoàn thành bộ nhãn độc lập Việt/Anh, so sánh phương pháp trên cùng tập giữ riêng. Không gọi điểm CV–JD là độ chính xác.
2. Trước buổi bảo vệ, thử khôi phục bản SQL trên máy dự phòng rồi chạy một vòng: đăng tin → ứng tuyển → xét CV → phản hồi → mở thông báo. Chuẩn bị cache mô hình và dependency trước khi mất mạng.
3. Nếu phát triển tiếp, thêm hàng đợi nền có lưu trạng thái để việc xét nhiều CV không phụ thuộc trang trình duyệt đang mở; bổ sung luồng quản trị duyệt xác minh doanh nghiệp và phục hồi mật khẩu.
4. Khi dữ liệu tăng, chuyển tìm kiếm/lọc/phân trang danh sách công khai sang truy vấn SQL có phân trang phía máy chủ. Hiện đã hết cắt mất tin ở 200 và giao diện chia 5/10 mục, nhưng tải toàn bộ danh sách không phải giải pháp tối ưu cho lượng dữ liệu lớn.
5. SQL chứa cả tệp giúp sao lưu đồng bộ cho quy mô đồ án, nhưng kích thước bản sao sẽ tăng theo CV. Cần kế hoạch lưu trữ/xóa dữ liệu và theo dõi dung lượng nếu đưa vào sử dụng thật.

Hướng dẫn mở web và phục hồi: [CHAY_LOCAL.md](../CHAY_LOCAL.md). Chưa commit/push đợt sửa này.
