# Trọng tâm sản phẩm: AI đối chiếu CV với JD

> Tài liệu lịch sử/thiết kế tại thời điểm viết; không dùng thay hướng dẫn hiện tại. Xem [mục lục tài liệu](../README.md).

Phạm vi được chốt ngày 11/11/2026: ưu tiên luồng xét hồ sơ; tìm việc và tài khoản ứng viên cung cấp đầu vào và nhận phản hồi.

## Luồng chính

1. Chuẩn bị JD thuộc tài khoản công ty trong mục Tin tuyển dụng.
2. Chọn JD và nhóm hồ sơ: CV đã ứng tuyển vào đúng JD, PDF/DOCX tải lên, hoặc Excel/văn bản.
3. Chọn TF-IDF, Sentence-BERT hoặc Kết hợp; tạo đợt xét trên máy chủ.
4. Mở Kết quả xét CV, lọc/sắp xếp điểm, đọc bằng chứng và tải Excel.
5. Nhà tuyển dụng rà soát rồi gửi kết quả cho ứng viên đã có tài khoản và nộp vào JD đó.

CV nhập riêng vẫn có kết quả phân tích và xuất tệp, nhưng không tự tạo tài khoản hay gửi thông báo cho địa chỉ email trong CV.

## Cập nhật giao diện

- Tổng quan nhà tuyển dụng có năm bước với liên kết đến chức năng đang hoạt động.
- Trang kết quả có đường dẫn sang phần phản hồi, mang theo JD của đợt đang xem; chỉ chọn bộ lọc nếu JD có trong danh sách hồ sơ được API cấp quyền.
- Đổi tab khác sẽ bỏ ngữ cảnh JD để tránh lọc nhầm khi quay lại.
- AI chỉ cung cấp điểm và bằng chứng. Không tự tuyển/loại, không coi điểm tương đồng là độ chính xác nghiên cứu.

Giữ chức năng tìm việc, nộp/lưu CV, thông báo, đa hồ sơ, ba phương pháp, hàng đợi và xuất Excel. Chưa thay bộ chọn đợt xét, trạng thái hồ sơ, dữ liệu mẫu hoặc thêm chatbot ở bước này.
