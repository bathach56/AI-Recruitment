# Bộ dữ liệu kiểm thử nội bộ

## Mục đích

Thư mục này chứa fixture phục vụ phát triển, kiểm thử parser và kiểm thử thuật toán matching ban đầu. Đây không phải dữ liệu dùng để công bố kết quả Precision, Recall hoặc F1-score.

## Nguồn gốc và quyền riêng tư

- `sample_cvs/`: 20 CV giả lập, đã ẩn danh. Các tên, mô tả và kinh nghiệm là dữ liệu kiểm thử; không đại diện cho ứng viên thật.
- `sample_jds/`: 10 JD mẫu được viết để bao phủ các nhóm vị trí CNTT; không được mô tả là tin tuyển dụng đang hoạt động.
- `ground_truth/`: template khởi đầu cho quy trình gán nhãn. Cần được rà soát ID, mở rộng và gán nhãn bởi người đánh giá trước khi dùng để tính metric nghiên cứu.
- `processed/` và `raw_resumes/`: dữ liệu nguồn bên ngoài. Trước khi dùng trong báo cáo hoặc triển khai, phải kiểm tra license, provenance và loại bỏ dữ liệu cá nhân nếu có.

## Cách sử dụng

1. Dùng tệp `.docx` để kiểm thử trích xuất bằng `python-docx` và tệp `.txt` cùng tên làm đối chiếu.
2. Dùng `sample_jds.json` làm input Job Description.
3. Ghi rõ version dataset, cấu hình mô hình, ngưỡng và thời điểm chạy cho mọi thí nghiệm.
4. Chỉ công bố Precision, Recall, F1-score và Processing Time sau khi chạy pipeline có thể tái lập trên ground truth đã được xác nhận.
