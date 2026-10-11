# Tiền xử lý và bằng chứng kỹ năng

## Đã có

Module `core/text_features.py` độc lập, không thêm dependency. Dựa trên ý tưởng taxonomy/alias từ AI service hiện có nhưng bổ sung bằng chứng và trạng thái cần rà soát; chưa sửa module chính hoặc taxonomy nguồn.

`preprocess(raw_text)` trả hai biểu diễn riêng:

- `semantic_text`: chuẩn hóa Unicode NFC, loại URL/email, chuẩn hóa khoảng trắng; giữ hoa/thường, dấu tiếng Việt, dấu câu và phủ định.
- `tfidf_tokens`/`tfidf_text`: thêm lowercase và tách token giữ các tên như C#, C++, .NET, ASP.NET, CI/CD, Node.js. Chưa bỏ stopword hay stemming. Tokenization tiếng Việt hiện dựa trên khoảng trắng/ký tự, chưa phải bộ tách từ tiếng Việt hoàn chỉnh.

Văn bản parser gốc không bị thay đổi. Chưa loại tên người hoặc mọi thông tin cá nhân; bước bỏ URL/email không phải anonymization đầy đủ. Khi fit TF-IDF sau này phải dùng tokenizer này hoặc cấu hình tương thích, không dùng tokenizer mặc định rồi làm mất C#/C++.

`SkillEvidence.extract(segments)` đọc các đoạn nguồn, so khớp taxonomy và trả:

- `mentioned_skills`: kỹ năng được nhắc bằng tên chính thức hoặc canonical ID và không bị quy tắc ngữ cảnh gắn cờ.
- `review_skills`: có ít nhất một lần nhắc cần rà soát; có thể trùng với mentioned_skills nếu xuất hiện trong nhiều ngữ cảnh khác nhau. Không tự tổng hợp thành quyết định có/không có kỹ năng.
- `evidence`: tên kỹ năng, chuỗi khớp, segment_index, location, start/end, đoạn ngữ cảnh, status và reasons. Offsets dùng chỉ số ký tự Python trong segment gốc; `segment.text[start:end]` phải bằng matched_text.
- Phiên bản thuật toán, phiên bản/hash taxonomy để truy nguồn.

Ưu tiên alias dài hơn tại cùng vị trí, chặn khớp Java bên trong JavaScript, bỏ mention chỉ xuất hiện trong URL/email. Thiếu taxonomy hoặc taxonomy rỗng sẽ báo lỗi.

## Ngữ cảnh cần rà soát

- Câu như “Chưa có kinh nghiệm Docker” hoặc “Đang học Kubernetes” có status `needs_review`.
- Từ có thể mang nghĩa thông thường như “go”, “rust”, “container” được gắn cờ.
- Alias khác tên chính thức/canonical ID đều cần rà soát, kể cả alias có thể đúng. Đây là lựa chọn bảo thủ vì taxonomy hiện có ánh xạ quá rộng, ví dụ LINQ → Entity Framework Core, NoSQL → MongoDB. Chưa âm thầm sửa định nghĩa nguồn.
- Đây là bộ quy tắc, không phải mô hình hiểu ngôn ngữ. Phủ định được kiểm tra ở phạm vi mệnh đề đơn giản; có thể gắn cờ quá rộng cho danh sách kỹ năng, bỏ sót câu phức tạp hoặc hiểu sai “không chỉ”. Không khẳng định phát hiện phủ định hoàn hảo.
- Bằng chứng so trực tiếp trên raw segment để giữ offsets; Unicode phân rã trong raw có thể làm bỏ sót alias có dấu dù semantic_text đã NFC. Tên công nghệ ASCII trong bộ test đã được kiểm tra.
- “Được nhắc đến” không có nghĩa là thành thạo; không dùng các danh sách này làm nhãn chuyên gia. Chưa có điểm skill matching hay suy luận năm kinh nghiệm.

## Chạy và xem

Tại thư mục gốc project:

```powershell
& './backend test/.venv/Scripts/python.exe' './backend test/scripts/inspect_cv.py'
& './backend test/.venv/Scripts/python.exe' './backend test/scripts/inspect_cv.py' 'D:/CV/cv.pdf'
& './backend test/.venv/Scripts/python.exe' -m unittest discover -s './backend test/tests' -v
```

Lệnh đầu đọc CV_001, in văn bản gốc → tokens → kỹ năng và đoạn nguồn. JSON đã lưu tại `reports/cv001_features.json`; có thể dùng `--output` với tên file mới để lưu lần khác, không ghi đè bằng chứng cũ.

## Kiểm chứng

21/21 tests đạt, gồm 13 tests cũ và 8 tests mới: tên công nghệ/phủ định được giữ, Unicode/contact, ranh giới từ, alias dài và offsets, câu phủ định/học tập, alias mơ hồ, taxonomy thiếu, dữ liệu đầu vào bất biến và kết quả ổn định trên CV mẫu.

CV_001 có 15 lần nhắc trong output của lần chạy này; đây là số evidence, không phải số kỹ năng khác nhau hoặc chỉ số độ chính xác. Các kiểm tra có kiểm soát chứng minh những trường hợp cụ thể, chưa chứng minh hiệu quả trích xuất trên tập CV thực tế đa dạng.

## Bước tiếp theo

Làm TF-IDF baseline với tokenizer đã kiểm chứng và hiển thị trọng số từ/cosine. Dùng dữ liệu development để phát triển; không tự tạo test metrics khi nhãn chưa được xác nhận. Trích xuất kinh nghiệm và tổng hợp skill matching cần triển khai riêng trước Hybrid, không giả định đã hoàn thành.
