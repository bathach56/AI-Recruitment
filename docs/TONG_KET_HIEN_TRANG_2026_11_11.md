# Tổng kết hiện trạng và rà soát mã nguồn — 11/11/2026

## Dữ liệu sau khi làm sạch

- Giữ 5 ứng viên, 5 công ty có tài khoản riêng, 5 JD công khai và 5 CV PDF tiếng Việt khác nhau; xem [tài khoản](ACCOUNTS.md).
- Không còn tài khoản, tin tuyển dụng, công ty, CV hoặc đợt xét cũ trong database hoạt động. Bộ mới chưa có đơn ứng tuyển, phản hồi hoặc kết quả AI.
- Đã dọn 266 tệp trong 23 mục cũ: CV xuất trước đây, tài liệu lưu ngoài SQL đã được di chuyển, bảng Excel/kết quả cũ, bản build xem trước và log cũ ở gốc dự án; sau đó dọn tệp công cụ khôi phục/phiên test đã dùng xong.
- Giữ đúng một bản sao lưu SQL trước lần thay dữ liệu: `webAI/App_Data/backups/sql-20261111-115755-1ac164/AIRecruitmentDb.bak`; đã kiểm tra lại bằng RESTORE VERIFYONLY/CHECKSUM. Các thông tin phục hồi riêng nằm cùng thư mục và không đưa lên Git.
- Database khôi phục thử nghiệm đã được dọn. Chỉ còn database dự án `AIRecruitmentDb` trong nhóm database AIRecruitment.
- Giữ dữ liệu nghiên cứu, mô hình pretrained, mã nguồn và lịch sử Git để tái lập thí nghiệm. Những phần này không phải hồ sơ người dùng đang hoạt động.

## Chức năng đã có

### Tài khoản và lưu trữ

- Đăng ký/đăng nhập, phân vai Candidate/Recruiter; quyền được kiểm tra ở backend.
- Mật khẩu băm, cookie đăng nhập, CSRF và giới hạn số lần gọi đăng nhập/đăng ký. Tài khoản đã xóa/khóa không dùng tiếp cookie cũ.
- SQL Server lưu người dùng, công ty, JD, CV nhị phân/SHA-256, ứng tuyển, thông báo, đợt xét và kết quả. Có công cụ sao lưu và kiểm tra khôi phục.

### Ứng viên

- Tìm/lọc công việc, tìm không dấu, xem chi tiết tin, lưu/hủy lưu và ứng tuyển bằng CV thuộc tài khoản.
- Cập nhật hồ sơ, tải PDF/DOCX, xem CV cá nhân; có trình soạn CV để in PDF.
- Việc đã ứng tuyển hiện danh sách gọn; bấm mở popup công ty, trạng thái, nội dung phản hồi và CV đã nộp.
- Chuông thông báo dẫn đến đúng hồ sơ nhận kết quả. Trang chủ 5 mục, các danh sách khác tối đa 10 mục mỗi trang.

### Công ty và AI xét CV

- Công ty quản lý tin riêng; tạo/sửa tin nháp, nhân bản tin, đăng/đóng tin. Tin đã có hồ sơ hoặc kết quả phân tích không được sửa làm mất lịch sử.
- Chọn JD từ tin của công ty; chỉ lấy CV đã ứng tuyển vào đúng JD, không trộn công ty hay vị trí khác.
- Hai cột nguồn CV: hồ sơ trên web và hồ sơ ngoài qua PDF/DOCX, Excel hoặc văn bản; chọn nhiều/chọn trang, tối đa 50 CV/đợt.
- Ba phương pháp: TF-IDF, Sentence-BERT pretrained và Kết hợp ngữ nghĩa/kỹ năng/kinh nghiệm. Điểm kèm bằng chứng; lỗi hoặc thiếu dữ liệu không được thay bằng điểm giả.
- Hàng đợi SQL chạy ở máy chủ, có tiến độ, tạm dừng và thử lại; đóng trình duyệt không dừng máy chủ xử lý.
- Kết quả: tìm đợt theo tên/ngày, chọn đợt rồi mới mở bảng; lọc/sắp xếp, xem CV gốc và bằng chứng AI riêng; xuất Excel hoặc JSON theo bộ lọc.
- Bản CV và JD trong đợt giữ theo dữ liệu đã dùng khi xét. Xem/tải CV kiểm tra quyền công ty và đúng hồ sơ trong đợt.
- Chọn nhiều ứng viên để gửi cùng kết quả; bước xác nhận trước khi gửi, backend kiểm tra toàn bộ người nhận và lưu trong một giao dịch. Đã bỏ giao diện lịch sử trao đổi như yêu cầu.

## Kiểm tra thực sự đã chạy trong lần rà soát này

| Nhóm | Kết quả |
|---|---|
| Build web | 0 lỗi, 0 cảnh báo |
| Cú pháp JavaScript | 14 tệp ứng dụng hợp lệ |
| Cú pháp Python | 27 tệp liên quan hợp lệ |
| JavaScript | 56 kiểm tra đạt |
| Python AI | 56 kiểm tra unittest đạt, có mô hình pretrained cục bộ |
| Quy trình nghiên cứu song ngữ | 10 kiểm tra đạt |
| SQL nghiệp vụ | Đạt kiểm tra JD/công ty, CV, Excel, phản hồi, thông báo, hàng đợi, sửa tin và tìm không dấu trong giao dịch rollback |
| Hủy yêu cầu kiểm tra AI | 7 kiểm tra đạt |
| HTTP bộ hiện tại | Đăng nhập đủ 10 tài khoản, xem 5 CV/JD, chặn truy cập chéo; không nộp đơn hoặc gửi kết quả trong bộ mới |

Đã sửa bộ kiểm tra SQL để tự tạo hồ sơ tạm khi cần, không phụ thuộc tài khoản `congty@recruitai.test` hoặc dữ liệu mẫu cũ. Dữ liệu test được hoàn tác. Một kiểm tra Python chủ động mô phỏng lỗi khởi tạo mô hình và ghi traceback dự kiến; toàn bộ suite vẫn đạt. Có cảnh báo deprecation từ thư viện TestClient, chưa thay thư viện lớn trong lần dọn dữ liệu.

Đây là rà soát mã và kiểm tra tự động các luồng liên quan, không phải chứng nhận tất cả dòng mã không có lỗi hoặc kiểm toán bảo mật chuyên sâu. Chưa kiểm tra trực quan toàn bộ trang bằng trình duyệt tự động trong lần này.

## Những gì chưa hoàn thiện

1. **Chưa fine-tune riêng hoặc có kết quả chất lượng được xác thực.** Bộ pilot có 36 cặp Việt/Anh nhưng cả hai người gán nhãn và phần phân xử đều 0 bản hoàn tất. Đã có quy trình gán nhãn/chia tập/huấn luyện/đánh giá; chưa có Precision/Recall/F1 hợp lệ để báo cáo chất lượng.
2. Trạng thái hiện còn mã Interview/Offered và nhãn mời phỏng vấn/trúng tuyển. Nên chốt chuyển ngữ nghĩa thành “đạt/không đạt vòng CV” nếu quyết định giới hạn đề tài ở xét hồ sơ; chưa tự đổi hợp đồng hoặc dữ liệu trạng thái ở đây.
3. Chưa có chatbot luyện phỏng vấn, gửi Gmail/OAuth, OCR cho PDF scan hoặc quên mật khẩu.
4. Xác minh doanh nghiệp hiện cần xử lý thủ công; 5 công ty mẫu Verified chỉ để thử trên LocalDB. Chưa có giao diện quản trị duyệt hoàn chỉnh.
5. Bộ mới đang trống để người dùng tự test; chưa chạy đợt AI lưu bền trên 5 CV mới. Kiểm tra phần mềm không thay thế thực nghiệm đánh giá mô hình.
6. Một số integration test/lệnh cũ có giả định bộ mẫu v1, được giữ để tham khảo và không chạy nguyên trạng với tài khoản mới. Dùng `verify-five-sectors.cjs` cho bộ hiện tại; công cụ tạo lại dữ liệu là lệnh phá hủy có cờ xác nhận, không chạy khi mở web.
7. LocalDB và công cụ chạy hiện ưu tiên Windows local. Triển khai thật vẫn cần cấu hình bảo mật, vận hành và sao lưu theo môi trường đích.

## Ưu tiên tiếp theo

Chốt tên trạng thái đúng phạm vi CV, rồi kiểm tra demo đầu-cuối bằng 5 ngành (nộp đúng ngành và chéo ngành, xét thật và gửi kết quả). Song song, bắt đầu gán nhãn có kiểm chứng để đánh giá mô hình. Chatbot nên là hạng mục mở rộng sau khi phần lõi và kết quả nghiên cứu đã vững.

Mở local: [CHAY_LOCAL.md](CHAY_LOCAL.md). Thông tin đăng nhập riêng: [bảng tài khoản cục bộ](../webAI/App_Data/TEST_ACCOUNTS_LOCAL.md). Các thay đổi vẫn ở máy local, chưa commit hoặc push trong lần này.
