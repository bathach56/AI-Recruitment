# Kết quả thực hiện ưu tiên tiếp theo — 11/11/2026

> Tài liệu lịch sử/thiết kế tại thời điểm viết; không dùng thay hướng dẫn hiện tại. Xem [mục lục tài liệu](../README.md).

## 1. Hàng đợi xét CV

Đã triển khai BackgroundService trong ASP.NET Core hiện có, không thêm hệ thống dịch vụ hoặc thư viện ngoài. Hàng đợi lưu `QueueState` trong SQL; mỗi CV vẫn có trạng thái Queued/Running/Complete/Incomplete/Error và thời điểm nhận xử lý. Công ty chỉ đưa vào hàng đợi hoặc tạm dừng đợt của chính mình.

Sau khi chọn CV và bấm phân tích, đợt được đưa vào hàng đợi rồi chuyển tới Kết quả xét CV. Trang này tự tải tiến độ, có nút tạm dừng sau CV hiện tại và nút chạy tiếp/thử lại. Đóng trang không dừng worker. Dừng máy chủ giữ phần chưa xử lý trong SQL; lease hết hạn sau 5 phút giúp nhận lại hồ sơ bị bỏ dở khi máy chủ chết đột ngột. Kết quả hoàn tất không bị chấm lại; lỗi không bị biến thành điểm giả hoặc thử lại vô hạn.

Đã kiểm thử thực tế: tạo đợt từ 2 CV mẫu, đưa vào hàng đợi, tạm dừng, khởi động lại web, xác nhận tạm dừng còn nguyên, gửi chạy tiếp rồi thoát client. Sau đó client mới đọc lại xác nhận cả hai CV đã hoàn tất trên máy chủ. Báo cáo local: `webAI/App_Data/queue-check.json`.

Kiểm thử SQL hoàn tác kiểm tra quyền công ty, pause, lease đang chạy không bị chiếm, lease hết hạn được nhận lại, thử lại lỗi và không chấm lại mục đã xong. Phần tắt cưỡng bức giữa một suy luận chưa được thử trực tiếp trên tiến trình thật; tình huống lease hết hạn được kiểm thử bằng fixture SQL.

Máy chủ web/SQL/AI vẫn cần hoạt động để xử lý; đây không phải dịch vụ chạy khi máy tính tắt. Một worker chạy tuần tự trong mỗi tiến trình; chưa phải hàng đợi phân tán dành cho triển khai nhiều máy chủ.

## 2. Khôi phục dự phòng

Đã sao lưu và khôi phục thực tế sang database riêng `AIRecruitmentRecovery_39f8c6a05476`, không ghi đè database nguồn. CHECKDB đạt; cả 36 tài liệu khớp SHA-256 và không có tham chiếu tài liệu bị thiếu. Đã mở bản web cổng 5133, tắt worker, chạy hai bài HTTP đăng nhập/xem CV/phân quyền đạt; sau đó dừng đúng web thử, giữ database bản sao.

Báo cáo ở `webAI/App_Data/backups/sql-20261111-051442-377239/recovery-report.json`. Công cụ `--verify-restore` tạo bản sao và database mới mỗi lần, không dùng REPLACE hay tự xóa dữ liệu. Xem [CHAY_LOCAL.md](../CHAY_LOCAL.md) để chạy lại khi cần.

Đây là kiểm tra phục hồi trên cùng máy. Việc xác nhận máy dự phòng có đủ SQL/.NET/Python/cache mô hình vẫn cần thử trên chính máy đó; phiên này không có quyền truy cập một máy vật lý thứ hai.

## 3. Nhãn và đánh giá AI

Đã bổ sung công cụ nhập phiếu người đánh giá, ghi CSV nguyên tử, theo dõi tiến độ/đồng thuận, duyệt yêu cầu JD cho Hybrid và pipeline đánh giá dùng đúng mã AI hiện hành. Ngưỡng chọn trên validation; test giữ riêng, TF-IDF fit trên train; xuất chỉ số và coverage theo ngôn ngữ, cấu hình, hash và thời gian thực. Công cụ gán nhãn không gọi AI hoặc tự quyết định nhãn.

Đã kiểm thử 10 bài công cụ nghiên cứu và chạy thử thật đường đánh giá TF-IDF/Sentence-BERT/Hybrid trên fixture phần mềm trong thư mục tạm, đánh dấu pilot_only, không xuất thành kết quả nghiên cứu của đồ án. Bộ dữ liệu mẫu thật của repository vẫn có 36 cặp, **0 phiếu hoàn tất và 0 cặp được duyệt**. Khi chưa có nhãn, công cụ từ chối huấn luyện/đánh giá và các chỉ số đồng thuận là null.

Chưa thể hoàn thành phần chuyên môn thay người đánh giá: cần hai người gán nhãn độc lập, xử lý bất đồng, duyệt bản dịch/yêu cầu JD và thu thập bộ dữ liệu có nguồn phù hợp cho train/validation/test độc lập. Không có kết quả Precision/Recall/F1 hoặc mô hình tinh chỉnh mới để tuyên bố trong lần này. Hướng dẫn thao tác từng cặp ở [research/bilingual/README.md](../../research/bilingual/README.md).

## Bàn giao

Các thay đổi kỹ thuật đã được kiểm chứng bằng kiểm thử mã, SQL và HTTP; công cụ UI vẫn chưa kết nối được nên chưa có xác minh bằng bấm/ảnh chụp trình duyệt sau thay đổi. Không tự gửi kết quả tuyển dụng cho ứng viên, không commit/push. Database phục hồi và bản sao chứa thông tin riêng được giữ ngoài Git.
