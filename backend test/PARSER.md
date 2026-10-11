# Parser PDF/DOCX — bước kỹ thuật sau ngày 2

## Đã triển khai

`core/document_parser.py` là module độc lập, dùng PyMuPDF cho PDF và python-docx cho DOCX. Đây là bước parser của roadmap; gán nhãn/chốt tập test ngày 2–3 vẫn chưa hoàn thành.

- `parse_bytes(content, filename)` dành cho lớp upload tương lai; filename chỉ dùng xác định định dạng và tên hiển thị, không dùng làm đường dẫn ghi file.
- `parse_file(path)` dành cho đường dẫn local tin cậy, đọc tối đa 10 MiB + 1 byte để phát hiện quá giới hạn.
- Trả raw_text, từng segment với vị trí trang/đoạn/ô bảng, hash file, tên/version parser, thời gian xử lý và cảnh báo.
- PDF đọc theo từng trang; DOCX giữ thứ tự đoạn/bảng trong thân tài liệu, hỗ trợ bảng lồng nhau.
- Từ chối file rỗng, quá 10 MiB, sai định dạng, DOC cũ, PDF cần mật khẩu, PDF quá 200 trang và DOCX có tổng dung lượng giải nén vượt 50 MiB hoặc quá 2.000 thành phần.
- File không có text trả lỗi `no_text`, thiếu thư viện trả `missing_dependency`; không sinh text hoặc điểm giả để báo thành công.

Các giới hạn là cấu hình ban đầu cho CV trong lab, không phải benchmark hiệu năng hay đảm bảo sandbox cho mọi file độc hại. Khi triển khai API vẫn cần timeout/resource limits của tiến trình và xử lý upload tại backend.

## Cách chạy

Từ thư mục gốc project:

```powershell
# Mặc định đọc CV_001 từ demo_pair.json
& './backend test/.venv/Scripts/python.exe' './backend test/scripts/parse_cv.py'

# Đọc file riêng (thay đường dẫn ví dụ bằng file thực tế)
& './backend test/.venv/Scripts/python.exe' './backend test/scripts/parse_cv.py' 'D:/CV/cv.pdf'

# Lưu bằng chứng vào file mới; từ chối ghi đè kết quả cũ
& './backend test/.venv/Scripts/python.exe' './backend test/scripts/parse_cv.py' --output './backend test/reports/cv001_second_run.json'

& './backend test/.venv/Scripts/python.exe' -m unittest discover -s './backend test/tests' -v
```

Dependencies đã cài và khóa trong `requirements.txt`: PyMuPDF 1.28.2, python-docx 1.2.0, lxml 6.1.3, typing_extensions 4.16.0. Muốn tái tạo: dùng Python của môi trường riêng chạy `-m pip install -r "backend test/requirements.txt"`. Chỉ thư viện parser đã được xác minh, chưa có thư viện/model ML.

## Kết quả đã kiểm chứng

- 13/13 tests đạt: 5 kiểm tra dataset cũ và 8 kiểm tra parser.
- Đọc được toàn bộ 20 DOCX mẫu; đây là smoke test về khả năng đọc, không chứng minh mọi nội dung đều trích xuất hoàn hảo.
- Kiểm tra thứ tự đoạn/bảng lồng, tiếng Việt và C#/C++/.NET bằng DOCX tạo trong test với nội dung kỳ vọng được xác định trước.
- Kiểm tra PDF nhiều trang có text và trang trắng; file khóa mật khẩu, file rỗng/hỏng, thiếu dependency và giới hạn kích thước/archive.
- `pip check`: không có dependency bị lỗi.
- Kết quả CV_001: `reports/cv001_parsed.json`, có 13 segments và nội dung tiếng Việt. Chưa tính matching score hay suy luận kỹ năng/kinh nghiệm.

## Giới hạn để trình bày trung thực

- Chưa OCR: PDF scan/ảnh không có text sẽ báo lỗi; PDF chỉ có một phần text sẽ có cảnh báo cho trang rỗng nhưng không phát hiện được mọi phần bị thiếu.
- PDF nhiều cột có thể sai thứ tự đọc; chưa xác minh bằng một tập CV PDF thực tế đa dạng. PDF trong tests là fixture tổng hợp.
- DOCX chỉ đọc thân tài liệu và bảng; chưa đọc header/footer, textbox, ảnh và tracked changes. Các giới hạn được trả trong warnings.
- raw_text là văn bản parser đọc được, không phải bản sao giữ nguyên bố cục hay mọi ký tự whitespace trong file gốc.
- Vị trí segment giúp truy ngược nội dung; chưa phải bằng chứng rằng một kỹ năng được thành thạo hoặc số năm kinh nghiệm đã được xác nhận.

## Tiếp theo

Tiền xử lý giữ tiếng Việt/tên công nghệ và phủ định, sau đó nhận diện kỹ năng với đoạn bằng chứng. Tách nội dung gốc khỏi nội dung dùng cho từng model; chưa làm TF-IDF/SBERT trước khi input đã được kiểm tra.

Tài liệu API đã đối chiếu: [python-docx Document](https://python-docx.readthedocs.io/en/latest/api/document.html), [PyMuPDF basics](https://pymupdf.readthedocs.io/en/latest/the-basics.html).
