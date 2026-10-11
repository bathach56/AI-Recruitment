# Ngày 2 — Chuẩn bị dữ liệu phát triển

## Đã thực hiện

- Tạo `data/development_v1` riêng: 20 văn bản CV từ DOCX, 10 văn bản JD từ JSON, 200 cặp có liên kết nguồn.
- Không sửa 20 TXT hỏng hay dữ liệu nguồn. Kiểm tra hash nguồn trước/sau tạo dữ liệu và khi validate.
- Rà soát từng dòng của hai file nhãn cũ: 110 dòng đều được để chờ xác minh, không chuyển nhãn tự động.
- Tạo hai phiếu annotation độc lập với nhãn trống và hướng dẫn dựa trên rubric hiện có.
- Có manifest version/hash, kiểm tra liên kết và chặn ghi đè thư mục đầu ra.
- Chưa train/fine-tune, chưa tạo benchmark hay tích hợp ứng dụng chính.

## Kết quả rà soát liên kết cũ

- 100/100 dòng file chính không tìm được cv_id trong manifest CV mẫu.
- Trong file chính, 88 dòng có job_id tồn tại nhưng tên chức danh không trùng chính xác tên trong JD mẫu; 12 dòng còn lại thiếu job_id trong bộ mẫu. Chênh tên là cờ rà soát, không tự kết luận các chức danh không tương đương.
- 10/10 dòng template có cv_id tồn tại nhưng job_id không tồn tại; còn có xung đột mô tả CV đã ghi ở ngày 1.
- Các ID có thể thuộc dataset khác; chưa có mapping chứng minh. Không sửa ID bằng cách đoán từ số thứ tự hoặc tự sao chép nhãn sang cặp khác.

## Kiểm chứng đã chạy

Từ thư mục gốc:

```powershell
& './backend test/.venv/Scripts/python.exe' './backend test/scripts/prepare_dataset.py' --validate
& './backend test/.venv/Scripts/python.exe' -m unittest discover -s './backend test/tests' -v
```

Kết quả: validate 200 cặp thành công; 5/5 tests đạt, kiểm tra nhãn khởi tạo trống, hash nguồn, từ chối ID trùng, phát hiện văn bản/sai liên kết bị thay đổi và không ghi đè khi chạy lại.

Lệnh tạo đã chạy một lần:

```powershell
& './backend test/.venv/Scripts/python.exe' './backend test/scripts/prepare_dataset.py'
```

Lệnh này từ chối chạy lại vào thư mục tồn tại, kể cả khi nhãn còn trống. Dùng `--validate` để kiểm tra; dùng version đầu ra mới khi thực sự cần tạo lại. Không xóa công việc người gán nhãn.

## Giới hạn và phần tiếp theo

Chuẩn bị kỹ thuật đã xong; **gán nhãn và chốt rubric chưa hoàn thành**. 200 cặp là fixture phát triển giả lập, không phải 200 mẫu thực tế độc lập. Chưa kiểm tra gần trùng, license của nguồn ngoài hoặc tạo tập test nghiên cứu. Không công bố Precision/Recall/F1 từ bộ này như kết quả tổng quát hóa.

Bạn có thể đọc `ANNOTATION_GUIDE.md` và thử 10 cặp đầu theo hướng dẫn. Hai người gán nhãn độc lập là đề xuất để tăng chất lượng; nếu chỉ một người làm phải ghi rõ giới hạn. AI không tự điền tên người đánh giá hay nhãn chuyên gia.

Trong lúc rà soát nhãn, bước kỹ thuật tiếp theo vẫn có thể làm: parser PDF/DOCX chính và kiểm tra bằng chứng kỹ năng/kinh nghiệm trên fixture. Việc này không phụ thuộc ground truth cuối cùng; đánh giá model thì phải chờ nhãn và cách chia tập phù hợp.
