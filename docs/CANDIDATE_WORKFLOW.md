# CV, kết quả ứng tuyển và thông báo của ứng viên

**CV của tôi:** xem PDF trực tiếp hoặc văn bản DOCX bằng nút Chi tiết CV; vẫn có tải bản gốc. API xem/tải chỉ cho chủ CV hoặc công ty đã nhận đúng CV qua ứng tuyển.

**Việc đã ứng tuyển:** mở thẳng chi tiết hồ sơ mới nhất, không còn thẻ tóm tắt kèm nút Xem kết quả & phản hồi. Nếu có nhiều hồ sơ, dùng bộ chọn gọn phía trên để chuyển giữa các vị trí/công ty. Chi tiết gồm công ty, lĩnh vực, website hợp lệ, vị trí/địa điểm, trạng thái, CV đã gửi và toàn bộ phản hồi của công ty. Trúng tuyển và Không trúng tuyển chỉ hiển thị khi trạng thái tương ứng; hồ sơ đang xử lý không bị suy diễn thành kết quả cuối cùng. Chi tiết vẫn đọc được khi tin đã đóng hoặc không còn xuất hiện trong danh sách việc làm công khai.

**Thông báo:** chuông và trang Thông báo chỉ hiển thị công ty, vị trí và cập nhật ngắn; không hiển thị toàn bộ nội dung phản hồi. Mỗi thông báo gắn với ApplicationId và dẫn tới `/Candidate?tab=applications&application=<id>`. Khi vào liên kết, giao diện tự mở đúng hồ sơ, giữ mã hồ sơ khi khởi tạo tab. Phản hồi đang hiển thị được đánh dấu đã đọc, cập nhật số thông báo trên chuông. Phân trang 10 mục vẫn áp dụng cho hồ sơ, thông báo và các phản hồi.

`GET /api/workspace/applications/{id}` chỉ dành cho Candidate, kiểm tra CandidateId từ tài khoản đăng nhập trước khi trả thông tin công ty/tin/CV/phản hồi. Phản hồi lấy từ thông báo lưu với cả ApplicationId và RecipientSubject tương ứng; không ghép theo tên hoặc email. API danh sách thông báo trả ApplicationId, tên công ty/vị trí và thông tin đã đọc, không trả nội dung đầy đủ. Thông báo cũ không gắn hồ sơ vẫn được hiển thị như thông báo hệ thống.

Kiểm tra: `candidate-applications.test.cjs`, `workspace-navigation.test.cjs`, `candidate-journey.integration.cjs`, cùng kiểm thử SQL trong `tests/CvReviewChecks`. Test SQL tạo phản hồi fixture trong transaction và rollback. Test HTTP chỉ đọc CV/kết quả và kiểm tra quyền, không tạo phản hồi vào tài khoản mẫu.
