# Development v1 — Dữ liệu thử nghiệm có truy nguồn

**Đây là fixture giả lập để phát triển, chưa phải tập test nghiên cứu có ground truth.** 200 cặp chỉ là tích Descartes của 20 CV × 10 JD, không phải 200 ứng viên độc lập, không bảo đảm cân bằng nhãn.

- `cvs/`: 20 bản UTF-8 mới đọc trực tiếp từ DOCX nguồn, không sửa TXT cũ bằng đoán encoding.
- `jds/`: 10 bản UTF-8 ghép từ title, description, responsibilities, required/nice-to-have skills và kinh nghiệm nguồn. Không có salary hoặc nhãn đầu ra trong văn bản.
- `pairs.csv`: ánh xạ cặp với đường dẫn tương đối trong thư mục này; tất cả là development_only.
- `reviewer_a.csv`, `reviewer_b.csv`: phiếu gán nhãn độc lập, hiện trống. Không nhập kết quả model vào hai file này.
- `legacy_link_audit.csv`: rà soát 110 dòng nhãn cũ. Không kế thừa nhãn khi liên kết chưa được xác minh. So chức danh bằng chuỗi chính xác chỉ là tín hiệu kiểm tra, không phải kết luận khác nghề.
- `manifest.json`: SHA-256 nguồn/đầu ra, số lượng và chính sách tạo dữ liệu. Không có nhóm trùng văn bản hoàn toàn ở lần tạo này; chưa kiểm tra gần trùng hoặc mẫu văn phong chung.

Nguồn giả lập và giới hạn theo `../README.md`. Bản TXT được tạo bằng XML reader kiểm kê; nó không phải oracle độc lập chứng minh parser chính đúng. Cần đối chiếu trực quan file gốc khi kiểm thử parser sau này.

Script tạo dữ liệu từ chối ghi đè thư mục đã tồn tại để bảo vệ công việc gán nhãn. Nếu thay nguồn, tạo version mới; không sửa văn bản/hash để làm kiểm tra pass.

Hướng dẫn gán nhãn: `../../backend test/ANNOTATION_GUIDE.md`. Những file nhãn và ghi chú chỉ dùng đánh giá, không đưa vào vectorizer/embedding.
