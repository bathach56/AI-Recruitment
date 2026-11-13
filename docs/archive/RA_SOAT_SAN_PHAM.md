# Rà soát phục vụ báo cáo đồ án — 09/11/2026

> Tài liệu lịch sử/thiết kế tại thời điểm viết; không dùng thay hướng dẫn hiện tại. Xem [mục lục tài liệu](../README.md).

> Tài liệu lịch sử. Bộ 6 CV/3 JD và các tệp kết quả cũ đã được thay/dọn ngày 11/11/2026. Xem [tổng kết hiện trạng mới](../TONG_KET_HIEN_TRANG_2026_11_11.md); không coi các điểm hoặc số lượng dưới đây là dữ liệu đang hoạt động.

## Kết luận hiện tại

Luồng demo có xử lý thật qua web, SQL Server và dịch vụ AI. Chưa có căn cứ gọi mô hình là chính xác 100%, đã huấn luyện riêng hoặc sẵn sàng vận hành thực tế. Mô hình đang dùng là Sentence-BERT đa ngôn ngữ huấn luyện sẵn; bộ nhãn nghiên cứu hiện chưa được duyệt.

## Những kiểm tra đã chạy

- Biên dịch ASP.NET Core thành công: 0 lỗi, 0 cảnh báo.
- 39 kiểm thử JavaScript đạt: phân trang, chọn hồ sơ, lưu/hủy lưu, điều hướng, phản hồi, hiển thị điểm và lỗi AI.
- 2 kiểm thử HTTP thật đạt: quyền xem CV/kết quả/thông báo của ứng viên, công cụ tuyển dụng và từ chối gửi phản hồi sai quyền mà không gửi tin thật.
- Kiểm thử SQL trong giao dịch hoàn tác đạt: phân tách 30/50/20 hồ sơ theo JD, chặn công ty khác và chọn CV nhầm JD; lưu phản hồi/thông báo; xem CV PDF/DOCX; xuất/nhập Excel, chống công thức, phân biệt điểm 0 và thiếu điểm; lỗi/thử lại khi AI không sẵn sàng.
- 56 kiểm thử Python AI đạt. Một kiểm thử chủ động mô phỏng mô hình không sẵn sàng nên có log lỗi dự kiến, không phải kết quả suy luận giả.
- 5 kiểm thử quy trình gán nhãn đạt: từ chối thiếu nhãn, một người đóng cả hai vai, rò rỉ nhóm/bản dịch, nguồn thay đổi hoặc dùng bộ thử như dữ liệu nghiên cứu.
- Kiểm tra tiền huấn luyện từ chối đúng: 36 cặp, 0 cặp được duyệt. Chưa chạy tối ưu hóa mô hình hoặc đánh giá chất lượng có nhãn.

## Kiểm tra AI thực tế trên dữ liệu tiếng Việt

Tài khoản công ty chính có 3 JD tiếng Việt, mỗi JD có 2 CV PDF tiếng Việt. Kiểm tra qua API thật xác nhận 8 tin công khai thuộc 6 công ty, chỉ lấy đúng 2 hồ sơ của mỗi JD và chặn JD công ty khác. Cả 6 PDF đã cho kết quả hoàn chỉnh; kiểm tra sắp xếp, ngưỡng điểm và xuất XLSX đạt. TF-IDF và Sentence-BERT cũng được gọi thật với một CV của từng JD.

Chi tiết có thời điểm chạy, cấu hình và điểm thực ở `webAI/App_Data/scenario-ai-report.json` trên máy này; tệp chứa thông tin tài khoản mẫu nên không đưa lên Git. Các lần chạy là kiểm tra chức năng, không phải thực nghiệm chứng minh phương pháp nào tốt hơn. Không dùng 6 CV giả lập để báo cáo Precision/Recall/F1.

Đã sửa lỗi tên tệp tiếng Việt khi web chuyển PDF sang dịch vụ AI: tên hiển thị được giữ nguyên, tên truyền nội bộ dùng ký tự ASCII và giữ đuôi tệp. Có kiểm thử hồi quy. Hai lần kiểm tra trước bản sửa đã tạo đợt lỗi thật; chúng được giữ lại để có thể xem và chạy lại, không biến lỗi thành điểm giả.

## Việt hóa và bảo toàn dữ liệu

Đã chuyển nội dung 8 JD, 6 CV và tên các công ty giả lập sang tiếng Việt; chuyển các nhãn phương pháp, biểu mẫu nhập Excel và thông báo lỗi liên quan sang tiếng Việt. Tên công nghệ và mã giao tiếp như React, C#, SQL Server, TF-IDF, `Hybrid`, tên trường API vẫn giữ để tương thích. Bảng Excel mới có tiêu đề tiếng Việt và vẫn đọc mẫu cũ.

Đã sao lưu SQL trước khi cập nhật; giữ ID, tài khoản, trạng thái ứng tuyển và phản hồi đã có. CV được đổi phiên bản lưu trữ; kết quả đối chiếu trước Việt hóa được đánh dấu lưu trữ thay vì sửa điểm lịch sử. Nội dung do người dùng tự nhập hoặc phản hồi cũ không tự ý dịch lại. Dữ liệu khởi tạo cũ trong mã nguồn chưa phải toàn bộ kịch bản demo mới; cần dùng đúng công cụ kịch bản khi chuyển máy.

## Việc ưu tiên trước buổi bảo vệ

1. Hoàn thành gán nhãn độc lập và kiểm tra bản dịch theo `research/bilingual/README.md`; thu thập thêm dữ liệu có quyền sử dụng. Bộ 36 cặp hiện chỉ để tập gán nhãn, chưa đủ cơ sở kết luận chất lượng.
2. Chốt giao thức nghiên cứu; so sánh các phương pháp trên cùng tập kiểm tra giữ riêng. Ngưỡng và trọng số chỉ chọn trên tập xác thực. Lưu nguồn dữ liệu, cấu hình, phần cứng, thời gian và lỗi điển hình của lần chạy thật.
3. Rà soát danh mục kỹ năng theo từng nghề. Một số tên tiếng Việt hoặc bí danh chưa được xác nhận vẫn được đánh dấu cần xem lại; không nên ép thành điểm cao. Kinh nghiệm thiếu bằng chứng rõ cũng không nên tự đoán.
4. Kiểm tra giao diện thực tế trên trình duyệt, điện thoại, chế độ sáng/tối và bàn phím. Công cụ trình duyệt của phiên làm việc hiện không kết nối được nên chưa xác minh ảnh chụp giao diện sau thay đổi này. Kiểm thử mã/HTTP không thay thế bước đó.
5. Chuẩn bị máy demo sạch: hướng dẫn tạo dữ liệu, khởi động SQL/web/AI, kiểm tra sức khỏe AI trước khi xét, dự phòng bản sao lưu. Giải thích rõ tài khoản/công ty giả lập đã được xác minh phục vụ demo, không phải doanh nghiệp được xác minh thật.

## Giới hạn cần nói rõ khi hỏi đáp

- Quy trình huấn luyện có kiểm tra đầu vào và mã tối ưu hóa đã được chuẩn bị; nhánh huấn luyện thực sự chưa chạy vì chưa có nhãn được duyệt.
- PDF phải có văn bản đọc được; chưa có cơ sở tuyên bố hỗ trợ OCR mọi CV ảnh quét hoặc bố cục phức tạp.
- Nhập Excel là nhập nội dung CV, không tự đọc hộp thư Gmail hoặc đường dẫn Drive.
- Phân tích hàng loạt hiện do phiên thao tác điều phối; cần đánh giá hàng đợi nền bền vững nếu muốn tác vụ dài tiếp tục khi đóng trình duyệt.
- SQL LocalDB và dữ liệu giả lập phù hợp máy phát triển. Trước triển khai thật cần cấu hình máy chủ, HTTPS, quản lý phiên bản cơ sở dữ liệu, sao lưu/khôi phục, giám sát lỗi, quy trình xác minh doanh nghiệp và chính sách lưu/xóa CV.
- AI hỗ trợ rà soát bằng chứng; nhà tuyển dụng quyết định và gửi kết quả. Điểm tương đồng không phải xác suất được tuyển hay độ chính xác của hệ thống.
