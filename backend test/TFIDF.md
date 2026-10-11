# TF-IDF baseline — cách chạy và giải thích

## Trạng thái

Đã triển khai `core/tfidf_baseline.py`, CLI `scripts/run_tfidf.py` và 4 tests mới. Tổng cộng 25 tests trong lab. Không thay đổi AI service hoặc backend chính.

Lần làm trước bị gián đoạn sau khi chạy tests/demo, trước khi cập nhật requirements và tài liệu. Đã bổ sung phiên bản dependency từ môi trường thực tế vào `requirements.txt`.

## Chạy tại thư mục gốc project

```powershell
# Cặp mặc định CV_001 / JOB_001, không ghi đè kết quả cũ
& './backend test/.venv/Scripts/python.exe' './backend test/scripts/run_tfidf.py'

# Thử cặp khác trong bộ development
& './backend test/.venv/Scripts/python.exe' './backend test/scripts/run_tfidf.py' --cv-id CV_003 --job-id JOB_001

# Lưu lần chạy mới: thư mục output phải chưa tồn tại
& './backend test/.venv/Scripts/python.exe' './backend test/scripts/run_tfidf.py' --output './research/backend_test/tfidf_dev_v2'

& './backend test/.venv/Scripts/python.exe' -m unittest discover -s './backend test/tests' -v
& './backend test/.venv/Scripts/python.exe' -m pip check
```

Để cài lại trong môi trường riêng: `python -m pip install -r "backend test/requirements.txt"` bằng đúng Python của môi trường đó. Chưa có dependency SBERT hoặc model weights.

## Nó thực sự làm gì?

1. Kiểm tra hash dữ liệu `data/development_v1` và các liên kết; đọc 20 CV + 10 JD, không đọc nhãn để fit.
2. Tiền xử lý qua tokenizer đã kiểm tra, giữ C#, C++, .NET, tiếng Việt và phủ định; dùng unigram và bigram, tối đa 5.000 features.
3. `fit` học vocabulary và IDF từ 30 văn bản phát triển. Một đối tượng không cho fit lần hai; muốn đổi corpus cần tạo model mới.
4. `explain` chỉ `transform` hai văn bản theo vocabulary/IDF đã học, không fit lại trên cặp đầu vào.
5. Tính cosine và xuất trọng số từng feature. Từ ngoài vocabulary được liệt kê; nếu toàn bộ vector bằng 0 hoặc input rỗng, báo lỗi thay vì trả điểm giả.

Trong demo, CV/JD đang hỏi **có nằm trong 30 văn bản dùng fit**. Đây là minh họa phát triển, không phải đánh giá khả năng tổng quát hóa. Khi có dataset nghiên cứu, phải fit trên tập phát triển/train đã quy định và chỉ transform validation/test.

## Giải thích công thức trước hội đồng

Với cấu hình hiện tại, TF là số lần feature xuất hiện. Một feature có thể là một token hoặc hai token liền nhau.

```text
idf(t) = log((1 + N) / (1 + df(t))) + 1
raw_weight(t, d) = tf(t, d) × idf(t)
weight(t, d) = raw_weight(t, d) / sqrt(sum(raw_weight(k, d)^2))
cosine(CV, JD) = sum(weight(t, CV) × weight(t, JD))
matching_score = cosine × 100
```

`N` là số văn bản fit; `df(t)` là số văn bản fit có feature đó. Cosine bằng tổng tích vì hai vector đã chuẩn hóa L2. Công thức tương ứng cấu hình smooth_idf=True, sublinear_tf=False của [scikit-learn](https://scikit-learn.org/stable/modules/feature_extraction.html).

Mở `research/backend_test/tfidf_dev_v1/feature_weights.csv` để xem: feature, TF ở CV/JD, IDF, trọng số sau chuẩn hóa và đóng góp vào cosine. Tổng đóng góp toàn bộ bảng phải khớp cosine; terminal chỉ hiển thị 12 feature đầu.

## Kết quả demo đã chạy

CV_001 / JOB_001; 30 văn bản fit; 2.222 features:

- Cosine làm tròn: **0.349127**.
- Điểm tương đồng làm tròn: **34.91/100**.
- Tổng đóng góp feature làm tròn: **0.349127**.

Nguồn: `research/backend_test/tfidf_dev_v1/result.json`. Đây không phải accuracy, xác suất được tuyển, hoặc kết luận CV không phù hợp. Không áp dụng ngưỡng 65/80 tùy tiện cho baseline chưa hiệu chỉnh.

Ví dụ `core` đóng góp khoảng 0.029400 và `.net` khoảng 0.025198. Cả từ kỹ thuật và từ thông thường đều có thể góp điểm; cosine chỉ đo tương đồng từ vựng, chưa xác nhận điều kiện nghề nghiệp.

## Kết quả và kiểm chứng

- `result.json`: điểm, giải thích, cấu hình, hash văn bản fit và thời gian thực tế.
- `feature_weights.csv`: bảng trọng số đầy đủ.
- `vocabulary_idf.json`: vocabulary/IDF inspect được; hiện chưa có API load model từ JSON. CLI tái fit từ nguồn có hash; không tuyên bố đã có persistence phục vụ production.
- Tests mới kiểm tra cosine/IDF theo phép tính tay, tự so khớp, đối xứng, không có feature chung, giữ token công nghệ, vocabulary/IDF không đổi khi predict, lỗi chưa fit/input rỗng/vector 0.
- Thời gian ghi trong result gồm transform + cosine + tạo giải thích; không gồm fit, import thư viện hoặc đọc file. Chưa dùng số đó để so sánh latency công bằng giữa các model.

## Giới hạn và tiếp theo

Chưa có nhãn đủ xác minh nên không tính Precision/Recall/F1. Dữ liệu là fixture giả lập có văn phong lặp, chưa bỏ toàn bộ thông tin cá nhân/boilerplate, chưa tách từ tiếng Việt chuyên biệt. Giữ từ phủ định trong tokens không đồng nghĩa TF-IDF hiểu phủ định.

Bước tiếp theo là pretrained Sentence-BERT, chọn model phù hợp ngôn ngữ rồi kiểm tra inference thật; không fallback sang đếm từ. Skill/experience matching vẫn phải hoàn thiện trước Hybrid. Việc gán nhãn và chốt tập test tiếp tục độc lập.
