# Đối chiếu một nhóm CV và đồng bộ giao diện

## Cách dùng

1. Đăng nhập Recruiter, mở **Đối chiếu CV & JD**.
2. Chọn tin tuyển dụng của công ty để lấy JD đã lưu, chọn TF-IDF, Sentence-BERT hoặc Hybrid rồi chuyển sang phần chọn CV. Không nhập lại JD thủ công.
3. Chọn hoặc kéo thả nhiều tệp PDF/DOCX. Có thể chọn bổ sung nhiều lần. CV nhận từ email cần được tải về máy trước khi chọn.
4. Chọn **Phân tích hồ sơ** một lần cho cả đợt. Bảng tổng hợp cập nhật khi mỗi CV hoàn tất.
5. Tìm theo tên tệp, lọc trạng thái, sắp xếp điểm tổng hoặc tên/thứ tự tải lên. Chọn **Xem bằng chứng** để mở chi tiết một CV.

Giới hạn: 50 CV/đợt, 10 MiB/tệp và tổng 100 MiB/đợt. Tệp có cùng tên, kích thước và thời điểm sửa được xem là trùng trong bộ chọn. Tệp không hợp lệ hoặc vượt giới hạn không xóa danh sách đã chọn trước đó.

## Xử lý hàng đợi

Giao diện tạo đợt qua `POST /api/recruiter/reviews`, sau đó tự gọi xét từng hồ sơ đã chọn. Backend sử dụng AI service hiện có và lưu kết quả vào SQL. Không gửi suy luận đồng thời: lõi Python đang dùng một inference lock. Người dùng không cần bấm phân tích từng tệp. Chi tiết nguồn hồ sơ, Excel và quyền truy cập xem [SAVED_CV_REVIEWS.md](SAVED_CV_REVIEWS.md).

- Có trạng thái chờ, đang phân tích, hoàn tất, lỗi và chưa xử lý.
- Một CV lỗi không làm mất hoặc dừng kết quả của các CV khác.
- **Dừng sau CV hiện tại** để CV đang chạy hoàn tất, giữ kết quả và dừng phần còn lại.
- **Chạy lại lỗi / chưa xử lý** bỏ qua hồ sơ đã hoàn tất, dùng lại đúng cấu hình của đợt.
- Nếu người dùng thay đổi JD, phương pháp, trọng số hoặc danh sách CV, kết quả cũ được đánh dấu chưa cập nhật và nút retry bị khóa. Có thể bắt đầu một đợt mới với cấu hình mới.
- **Tải cả đợt (JSON)** giữ cấu hình và kết quả, gồm lỗi từng tệp. Tệp JSON có thể chứa nội dung CV và bằng chứng: chỉ lưu/chia sẻ ở nơi phù hợp.

Bảng giữ điểm 0 thật, không đổi thiếu dữ liệu thành 0. CV chưa có điểm tổng nằm sau CV có điểm khi sắp xếp theo điểm. TF-IDF/Sentence-BERT không hiển thị điểm kỹ năng/kinh nghiệm như thể đã đo riêng. Điểm phù hợp chỉ giúp ưu tiên đọc, không phải quyết định tuyển dụng hay metric nghiên cứu.

Hàng đợi và kết quả được lưu trong SQL theo công ty. Mục Kết quả xét CV cho xem lại, lọc, chạy tiếp và tải XLSX đúng bộ lọc. Không có background worker tự xét sau khi đóng tab; hồ sơ chưa xét được giữ để chạy tiếp. Không tự đọc Gmail hay tải tệp từ hộp thư của công ty.

## Phạm vi giao diện

Tiếp tục áp dụng frontend-design và ui-ux-pro-max trên nền nhận diện hiện có: trang chủ/tìm kiếm, chi tiết công việc, các tab ứng viên, đăng nhập/đăng ký, tuyển dụng, đối chiếu, Results, Admin và trang lỗi 403/404 dùng cùng header, màu, font và quy tắc điều khiển. Các trang HTML cũ vẫn chuyển về route Razor tương ứng. Trang Results của ứng viên hướng về trạng thái/feedback, không mở công cụ chỉ dành cho Recruiter.

## Kiểm tra và giới hạn môi trường

`batch-matching.test.cjs` kiểm tra thêm tệp nhiều lần, giới hạn, sắp xếp, xử lý tuần tự, tệp lỗi, dừng và tiếp tục. Số trong fixture chỉ dùng kiểm thử phần mềm, không phải kết quả nghiên cứu. Kiểm tra API và các trang trong `accounts.integration.cjs` dùng tài khoản thử, kèm các test frontend hiện có.

Đã khôi phục `backend test/.venv`, cài requirements hiện có, tải SBERT kèm revision và chạy thật 6 CV PDF theo 3 JD. Đã kiểm tra Hybrid, TF-IDF, Sentence-BERT, lưu kết quả, lọc và xuất XLSX; xem `LOCAL_SCENARIO.md`. Khi AI không chạy, API trả 503 và giao diện ghi lỗi từng CV, không sinh điểm thay thế.

Browser/native host không khả dụng nên chưa kiểm tra trực quan bằng ảnh chụp ở các kích thước màn hình. Không tuyên bố đã xác minh bố cục bằng trình duyệt thật.
