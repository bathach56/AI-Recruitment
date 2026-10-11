# Pretrained Sentence-BERT — thử nghiệm độc lập

## Phương pháp

Model được chọn để thử: `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`. [Model card chính thức](https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2) liệt kê tiếng Việt, embedding 384 chiều và giới hạn cấu hình 128 tokens. Đây là lựa chọn ban đầu phù hợp dữ liệu đa ngôn ngữ, chưa phải kết luận model tốt nhất cho tuyển dụng.

Không train hoặc fine-tune. Model được tải một lần từ Hugging Face, ghim revision vào `.cache/sbert/provenance.json`, sau đó load local với `local_files_only=True`, `trust_remote_code=False`, chạy CPU. Script không gửi CV/JD lên dịch vụ ngoài.

## Văn bản dài và điểm số

1. Dùng semantic_text của preprocessing hiện có, giữ dấu, hoa/thường và phủ định.
2. Chia thành các đoạn theo ranh giới khoảng trắng, đếm bằng tokenizer thật, tính cả special tokens. Mọi đoạn phải vừa max_seq_length; không âm thầm cắt đuôi. Một từ đơn vượt giới hạn gây lỗi rõ ràng.
3. Encode từng đoạn và chuẩn hóa L2 embedding.
4. Lấy trung bình embedding các đoạn theo số token nội dung, rồi chuẩn hóa L2 một lần nữa để có vector văn bản.
5. Cosine là tích vô hướng hai vector đơn vị. Giữ cosine gốc trong [-1, 1]; overall_score = max(0, cosine) × 100.

Cách chia đoạn và tổng hợp là giả định kỹ thuật ban đầu, cần đánh giá; ranh giới có thể cắt câu và làm mất ngữ cảnh. Không đảm bảo cosine cao đồng nghĩa đáp ứng kỹ năng/thâm niên. Chưa điều chỉnh ngưỡng phân loại.

## Chạy từ thư mục gốc

```powershell
# Cần internet khi tải model lần đầu
& './backend test/.venv/Scripts/python.exe' './backend test/scripts/download_sbert.py'

# Inference local: cặp mặc định CV_001 / JOB_001
& './backend test/.venv/Scripts/python.exe' './backend test/scripts/run_sbert.py'

# Output phải là tên file chưa tồn tại
& './backend test/.venv/Scripts/python.exe' './backend test/scripts/run_sbert.py' --output './research/backend_test/sbert_dev_v1/result.json'

& './backend test/.venv/Scripts/python.exe' -m unittest discover -s './backend test/tests' -v
```

Thiếu model, thiếu thư viện hoặc inference lỗi thì dừng với lỗi; không fallback thành keyword matching. `.cache/` đã được ignore, không đưa weights vào Git. Không sửa `.venv`/cache của ứng dụng chính.

## Dùng để trình bày

JSON lưu tên/revision model, phiên bản thư viện, hash input, văn bản từng đoạn, số token và offsets trong semantic_text, hai embedding tổng hợp, ma trận cosine giữa các đoạn, cosine toàn văn và thời gian.

Hội đồng có thể quan sát CV/JD → các đoạn → vector 384 chiều → cosine. Không gán một chiều vector cho một kỹ năng; ma trận đoạn chỉ cho thấy sự tương đồng, không phải giải thích nhân quả của model hoặc đóng góp cộng được như bảng TF-IDF.

Thời gian load model được tách khỏi xử lý. Thời gian xử lý gồm preprocessing/chunking/encode/aggregation; chưa warm-up hay benchmark trên nhiều cặp. Không so latency trực tiếp với TF-IDF rồi kết luận hiệu năng nghiên cứu.

## Kiểm chứng

Đã chạy toàn bộ 30/30 tests đạt, không skip; sau chỉnh phần đếm token để không phát cảnh báo cho đoạn ứng viên chưa được đưa vào model, chạy lại riêng 5/5 tests SBERT đạt. Có tests chia đoạn không mất từ, giới hạn token, văn bản rỗng/từ quá dài, inference tự so khớp, đối xứng, vector hữu hạn 384 chiều và văn bản dài trên model thật.

Kết quả tại `research/backend_test/sbert_dev_v1/result.json`:

- Revision: `e8f8c211226b894fcb81acc59f3b34ba3efd5f42`.
- Weights SHA-256 đã đối chiếu nguồn: `eaa086f0ffee582aeb45b36e34cdd1fe2d6de2bef61f8a559a1bbc9bd955917b`.
- CV_001 / JOB_001: 2 đoạn CV, 2 đoạn JD, vector 384 chiều.
- Cosine làm tròn 0.829727; score 82.97/100. Không phải accuracy hoặc xác suất tuyển dụng.
- CPU; môi trường cài torch 2.14.1+cpu, CUDA không khả dụng trong môi trường này. Chưa kiểm tra máy có GPU NVIDIA vật lý hay chưa; không kết luận máy không có GPU.
- Lần tải Xet bị treo, tải lại bằng HTTPS thông thường đã thành công. Trọng số được lưu local khoảng 471 MB.

TF-IDF cho cùng cặp khoảng 34.91/100 còn SBERT khoảng 82.97/100: thang điểm và cách biểu diễn khác nhau, không chứng minh SBERT chính xác hơn. Không chọn model thắng từ một ví dụ.

`scripts/check_environment.py` đã chạy: import các thư viện, phép tính Pandas, vẽ PNG Matplotlib trong bộ nhớ và FastAPI TestClient đều đạt; `pip check` không có dependency bị lỗi. Starlette có cảnh báo deprecation của httpx trong TestClient nhưng kiểm tra vẫn đạt; chưa nâng/chuyển thư viện chỉ để bỏ cảnh báo.

Dependencies chính ở requirements.txt; toàn bộ phiên bản môi trường hiện tại ở requirements-lock.txt. Cài chính xác trên môi trường Python/platform tương thích bằng `python -m pip install -r "backend test/requirements-lock.txt"`. Báo cáo môi trường: `reports/environment_current.json`. ipykernel đã cài nhưng chưa mở notebook UI hay đăng ký kernel toàn máy; trong VS Code chọn Python `.venv/Scripts/python.exe` của backend test.

Pandas/Matplotlib phục vụ nghiên cứu; FastAPI/Uvicorn/python-multipart được cài sẵn theo yêu cầu người dùng, chưa có nghĩa AI service chính đã tích hợp xong.

Chưa có Precision/Recall/F1 vì nhãn/tập test độc lập chưa được khóa. Dữ liệu demo vẫn là fixture phát triển giả lập.
