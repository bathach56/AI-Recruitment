# Backend test — Roadmap lõi AI Recruitment

**Bàn giao cho đồng đội:** bắt đầu tại [HANDOFF.md](HANDOFF.md), có danh sách
file ASP.NET đã sửa, request mẫu, quy tắc đọc response và phần SQL/phân quyền/UI
cần nối tiếp. Gói này giữ phạm vi AI; chưa triển khai thêm backend nghiệp vụ.

**Cập nhật API backend:** có API Python dùng lõi kiểm chứng và ASP.NET gọi thật,
upload CV + JD, không còn fallback C# ở matching. Đã kiểm tra HTTP local cho ba
phương pháp và trạng thái thiếu dữ liệu. Xem [BACKEND_API.md](BACKEND_API.md)
để chạy đúng dịch vụ và xem các giới hạn về SQL, phân quyền, giao diện.

**Cập nhật chuẩn bị đánh giá:** có `scripts/audit_annotations.py` kiểm tra tiến độ,
bằng chứng và bất đồng giữa hai phiếu mà không sửa nhãn. Lần chạy hiện tại:
200 cặp đều chờ nhãn; chưa sẵn sàng tính metrics nghiên cứu. Bắt đầu vòng thử
10 cặp theo [ANNOTATION_GUIDE.md](ANNOTATION_GUIDE.md), sau đó chốt rubric.

**Cập nhật Hybrid:** đã ghép SBERT, kỹ năng và kinh nghiệm; công khai trọng số/đóng góp và trả thiếu dữ liệu khi chưa thể tính tổng. Xem [HYBRID.md](HYBRID.md) để chạy và đối chiếu phạm vi báo cáo. Bước tiếp theo: dữ liệu gán nhãn, đánh giá và kiểm tra CV thực tế trước tích hợp.

**Trạng thái mới nhất:** đã có skill matching và trích xuất kinh nghiệm kèm bằng chứng; toàn bộ 38 tests đạt, gồm SBERT chạy model local. Xem [STRUCTURED_MATCHING.md](STRUCTURED_MATCHING.md) để chạy demo và giải thích công thức. Bước tiếp theo là Hybrid. Các ghi chú tiến độ bên dưới ghi lại từng giai đoạn trước; nhãn nghiên cứu vẫn chưa hoàn tất và chưa tích hợp ứng dụng chính.

Trạng thái: đã chạy ngày 1 và hoàn thành phần chuẩn bị kỹ thuật ngày 2. Xem [DAY1.md](DAY1.md), [DAY2.md](DAY2.md) và [hướng dẫn gán nhãn](ANNOTATION_GUIDE.md). Đã có bản dữ liệu phát triển riêng; nhãn vẫn trống, chưa khóa rubric hoặc tập test. Chưa chạy mô hình AI hoặc tích hợp ứng dụng chính; input/output mới là đề xuất chờ đồng đội xác nhận.

## Mục tiêu và phạm vi

**Cập nhật SBERT:** pretrained đa ngôn ngữ đã tải và chạy local trên CPU; vector 384 chiều, chia đoạn có kiểm soát, 30 tests đạt. Xem [SBERT.md](SBERT.md). Đã bổ sung thư viện nghiên cứu/API và requirements-lock.txt; chưa fine-tuning, chưa có đánh giá ground truth.

**Cập nhật TF-IDF:** baseline chạy thật, tách fit/transform, có bảng trọng số và đóng góp cosine. Tổng cộng 25 tests; xem [TFIDF.md](TFIDF.md). Kết quả demo chỉ thuộc dữ liệu phát triển, chưa phải đánh giá nghiên cứu.

**Cập nhật parser:** đã có module PDF/DOCX thật và CLI riêng, 13 tests đạt. Xem [PARSER.md](PARSER.md) và `reports/cv001_parsed.json`. Chưa OCR, chưa chạy matching; nhãn/tập test vẫn chưa khóa.

**Cập nhật tiền xử lý:** đã có biểu diễn riêng cho semantic/TF-IDF và bằng chứng kỹ năng kèm vị trí nguồn; tổng cộng 21 tests đạt. Xem [TEXT_FEATURES.md](TEXT_FEATURES.md). Chưa chấm matching hoặc suy luận kinh nghiệm.

Xây dựng một khu vực thử nghiệm độc lập cho CV–JD matching, giải thích được quá trình xử lý và đánh giá bằng dữ liệu thật. Khi đạt các tiêu chí bên dưới mới tích hợp vào ứng dụng chính. Thư mục này tập trung Python AI, không thay thế ASP.NET Core backend của đồ án.

Đọc `../AGENTS.md` trước khi làm việc. Không sửa `../ai-service/` hoặc `../webAI/` trong giai đoạn thử nghiệm nếu chưa có yêu cầu tích hợp. Không làm đăng nhập, phân quyền, quản lý tuyển dụng, database nghiệp vụ hoặc dashboard quản trị ở đây.

Hai tuần là thời gian mục tiêu, không phải cam kết hoàn thành bất kể chất lượng dữ liệu. Không bỏ kiểm chứng hoặc tạo số liệu để kịp lịch.

## Roadmap dự kiến

| Ngày | Công việc | Bằng chứng để chuyển bước |
|---|---|---|
| 1 | Kiểm tra Python, tạo môi trường riêng; đọc code AI hiện có; chốt input/output dự kiến với đồng đội; kiểm kê dữ liệu, ngôn ngữ và nguồn gốc | Chạy được script kiểm tra môi trường; có danh sách module tái sử dụng và lỗi cần xử lý; chọn một cặp CV–JD làm ví dụ xuyên suốt |
| 2–3 | Chốt rubric gán nhãn; rà soát ID, nguồn, trùng lặp và nhãn; tổ chức train/validation/test hoặc development/test theo nhu cầu | Manifest trỏ tới văn bản gốc; nhãn tách khỏi đầu vào; ghi cách chia theo nhóm CV/JD phù hợp mục tiêu đánh giá; test được giữ riêng |
| 4 | Trích xuất PDF/DOCX, giữ văn bản gốc, tiền xử lý riêng cho từng phương pháp; nhận diện kỹ năng và kinh nghiệm | Đối chiếu parser với TXT mẫu; có ví dụ file lỗi/rỗng; hiển thị đoạn bằng chứng; kinh nghiệm chưa biết không bị coi là chắc chắn bằng 0 |
| 5 | TF-IDF + Cosine Similarity | Chạy thật bằng scikit-learn; lưu vectorizer; giải thích từ/cụm từ, trọng số và cosine; fit vocabulary/IDF trên tập phát triển được quy định, không fit lại bằng test |
| 6 | Pretrained Sentence-BERT | Ghi model/version và cấu hình; embedding và cosine thật; kiểm tra phù hợp ngôn ngữ, giới hạn độ dài, cách xử lý văn bản dài; thiếu model phải báo lỗi rõ |
| 7–8 | Skill matching, experience matching và Hybrid | Điểm thành phần, kỹ năng khớp/thiếu và công thức tổng hợp; trọng số cấu hình được; thử thay đổi một yếu tố đầu vào; kiểm tra đóng góp từng thành phần |
| 9–10 | Đánh giá và phân tích lỗi | Cùng tập test cho các phương pháp; chọn ngưỡng/trọng số bằng validation rồi khóa; xuất dự đoán từng cặp, confusion matrix, Precision/Recall/F1 và thời gian |
| 11 | Hoàn thiện notebook hoặc báo cáo giải thích từng bước | Chạy lại được từ CV/JD tới kết quả; có trường hợp đúng, sai, diễn đạt khác và thiếu kỹ năng/kinh nghiệm; không chỉnh dữ liệu demo để che lỗi |
| 12 | Kiểm thử và khóa phiên bản lõi | Kiểm tra input lỗi, file không hỗ trợ, model thiếu, kết quả hữu hạn và tái lập trong sai số hợp lý; lưu dependency/model/config/dataset version |
| 13 | Tích hợp sau khi đạt tiêu chí | Chuyển module đã kiểm chứng sang AI service; adapter giữ contract hiện có khi phù hợp; so sánh đầu ra trực tiếp với đầu ra qua API |
| 14 | Kiểm thử xuyên suốt, dự phòng và bàn giao | CV → ASP.NET Core → Python → kết quả thật; tài liệu chạy, giới hạn, bảng thực nghiệm và kịch bản demo |

Các hoạt động rà soát/gán nhãn có thể cần nhiều thời gian hơn lịch. Nếu thiếu dữ liệu đủ chất lượng, báo cáo là thử nghiệm sơ bộ với giới hạn rõ ràng.

## Fine-tuning: quyết định trước khi bắt đầu

Chưa mặc định đưa fine-tuning vào phạm vi hai tuần. Cần xác nhận yêu cầu của giảng viên. Nếu bắt buộc, điều chỉnh lịch trước: dành thời gian chuẩn bị cặp huấn luyện, validation, GPU khi cần và so sánh pretrained với fine-tuned trên cùng test giữ riêng. Không dùng test để chọn checkpoint, ngưỡng hoặc trọng số. Không kết luận fine-tuning tốt hơn nếu chưa có kết quả.

## Cấu trúc sẽ tạo dần khi triển khai

Đây là cấu trúc dự kiến, các module dưới đây chưa được tạo:

```text
backend test/
  README.md              Roadmap và trạng thái
  requirements.txt       Dependency thực sự cần, ghi phiên bản đã kiểm chứng
  core/                  Parser, preprocessing, TF-IDF, SBERT, skill/experience, Hybrid
  scripts/               Chạy một cặp, kiểm tra môi trường
  tests/                 Kiểm tra hành vi lõi và input lỗi
```

Dùng dữ liệu hiện có trong `../data/` qua đường dẫn cấu hình; không sao chép hàng loạt hoặc thay đổi nguồn gốc âm thầm. Lưu split/manifest phát triển trong một thư mục con có tên rõ ràng dưới `../data/`. Đặt pipeline đánh giá, notebook và kết quả phiên bản mới trong thư mục con riêng dưới `../research/`, không ghi đè script hoặc kết quả cũ. Chỉ tạo các thư mục này khi tới bước triển khai tương ứng.

Lõi tính toán phải chạy trực tiếp được, không phụ thuộc HTTP, UI hoặc SQL Server. Khi kế thừa một module hiện có, ghi rõ nguồn và thay đổi; trong giai đoạn thử nghiệm, chỉ duy trì phiên bản thử nghiệm đó, không sửa song song hai bản.

## Những gì hội đồng cần quan sát

1. **Input:** nội dung CV và JD thực sự được xử lý.
2. **Trích xuất:** văn bản máy đọc được, phần giữ/bỏ khi làm sạch, kỹ năng và đoạn văn làm căn cứ cho kinh nghiệm. Phân biệt thông tin trích xuất với thông tin được nhập thủ công.
3. **TF-IDF:** từ/cụm từ, trọng số của hai vector, cosine và giới hạn của cách so từ.
4. **SBERT:** tên model, hai vector embedding, kích thước vector và cosine. Không gán ý nghĩa giả cho từng chiều embedding; độ giống ngữ nghĩa không bảo đảm đáp ứng mọi yêu cầu nghề nghiệp.
5. **Hybrid:** ba điểm thành phần và phép cộng có trọng số. Khác biệt điểm được giải thích bằng thành phần nào thay đổi.
6. **Thử có kiểm soát:** đổi cách diễn đạt nhưng giữ nghĩa; bỏ kỹ năng bắt buộc; đổi kinh nghiệm. Hiển thị kết quả đo thực tế kể cả khi trái kỳ vọng.
7. **Kiểm chứng:** nguồn nhãn, cách chia tập, confusion matrix, metrics và trường hợp sai. Demo một cặp giải thích cơ chế; không thay thế đánh giá trên tập kiểm thử.

## Nguyên tắc thực nghiệm

- Ground truth hiện có là đầu vào cần rà soát, chưa mặc nhiên đạt chất lượng nghiên cứu. Nếu có hai người gán nhãn, ghi nhãn độc lập và cách giải quyết bất đồng; không để điểm model quyết định nhãn.
- Đọc CV/JD từ nội dung nguồn; không dựng input model từ nhãn hoặc các cột matched/missing đã gán thủ công.
- Khóa tập test; kiểm tra CV/JD trùng hoặc gần trùng giữa các tập theo mục tiêu tổng quát hóa. Ghi rõ nếu đánh giá trên ứng viên mới, công việc mới hoặc cả hai.
- Giữ thông tin hữu ích cho ngữ nghĩa ở SBERT; không mặc định dùng toàn bộ bước loại stopword của TF-IDF cho SBERT.
- Không fallback âm thầm sang thuật toán khác, không sinh điểm ngẫu nhiên, không công bố benchmark viết sẵn.
- Ghi dataset version, split, seed, preprocessing, model/revision, trọng số, ngưỡng, môi trường và thời gian chạy. Tách thời gian tải model khỏi inference; ghi rõ đo lần đầu hay sau warm-up.
- Matching score không phải accuracy hoặc xác suất được tuyển. Hybrid và trọng số ban đầu là giả thuyết cần đánh giá.

## Điều kiện tích hợp

- [ ] Parser xử lý file thật và trả lỗi rõ khi không thể trích xuất.
- [ ] TF-IDF và SBERT thực sự chạy đúng phương pháp được ghi tên.
- [ ] Hybrid có đầu ra giải thích được và xử lý dữ liệu thiếu minh bạch.
- [ ] Có kiểm tra input lỗi và ví dụ có kiểm soát cho thành phần chính.
- [ ] Có kết quả đánh giá tái lập, hoặc ghi rõ giới hạn nếu chỉ đủ dữ liệu thử nghiệm sơ bộ.
- [ ] Input/output đã thống nhất với đồng đội, đối chiếu DTO/API sẵn có trước khi thay đổi.
- [ ] Có bộ CV–JD cố định để kiểm tra tương đương trước/sau tích hợp.

Tích hợp bằng cách chuyển module lõi đã kiểm chứng sang `../ai-service/` và bổ sung lớp gọi API mỏng, không viết lại thuật toán bằng C#. Migrate kiểm thử theo module. Sau khi chuyển, khu vực thử nghiệm import lõi chính hoặc chỉ giữ script thử; không tiếp tục duy trì hai bản thuật toán. Kiểm tra qua HTTP, timeout, upload và đường dẫn tài nguyên vẫn bắt buộc vì chạy độc lập chưa bảo đảm tích hợp thành công.

## Bước tiếp theo

Rà soát/gán nhãn theo ANNOTATION_GUIDE.md, xác minh nguồn và chốt các trường hợp rubric chưa rõ. Parser, preprocessing, TF-IDF và pretrained SBERT đã chạy; bước kỹ thuật tiếp theo là skill matching và trích xuất kinh nghiệm có bằng chứng, sau đó Hybrid. Chưa chia tập test hoặc chạy đánh giá khi dữ liệu/nhãn chưa sẵn sàng.
