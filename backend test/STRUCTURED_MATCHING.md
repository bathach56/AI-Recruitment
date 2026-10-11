# Skill matching và kinh nghiệm có bằng chứng

Chạy từ thư mục gốc project:

```powershell
& './backend test/.venv/Scripts/python.exe' 'backend test/scripts/run_structured.py'
& './backend test/.venv/Scripts/python.exe' -m unittest discover -s 'backend test/tests' -p test_structured.py -v
```

Thêm `--output <đường dẫn JSON mới>` để lưu kết quả; không ghi đè file cũ.
Demo cố định dùng `demo_pair.json`, đọc DOCX và các trường JD gốc, không dùng nhãn.
Kết quả lần chạy đã lưu tại `../research/backend_test/structured_dev_v1/result.json`.

## Cách giải thích cho hội đồng

1. Mở `cv_segments` để xem văn bản parser đọc được.
2. Mở `skills.requirements`: mỗi yêu cầu có nhóm bắt buộc/ưu tiên, trọng số, trạng thái và bằng chứng kèm vị trí trong CV.
3. Điểm kỹ năng = 100 × tổng trọng số khớp / tổng trọng số yêu cầu. Trọng số mặc định 1,5 cho bắt buộc và 1 cho ưu tiên là giả định ban đầu, cấu hình được trong hàm; chưa được tối ưu bằng thực nghiệm.
4. Kỹ năng lặp được gộp; nhóm bắt buộc được ưu tiên. Yêu cầu ngoài taxonomy vẫn giữ trong mẫu số và đánh dấu cần rà soát. Không có yêu cầu trả `null`.
5. `matched` chỉ là có đề cập; `not_found` chỉ là chưa tìm thấy. Alias, phủ định, đang học hoặc bằng chứng mâu thuẫn trả `needs_review`, không tự cộng điểm.
6. Kinh nghiệm chỉ nhận trường độc lập như `Số năm kinh nghiệm: 5.5 năm`, `Total experience: 5 years`. Tách tổng kinh nghiệm và kinh nghiệm liên quan; không cộng các lần nhắc lại. Số liệu mâu thuẫn hoặc không trích xuất được trả `null`, không giả thành 0 năm.
7. Điểm số năm = 100 × min(số năm CV / số năm JD, 1). Demo dùng tổng kinh nghiệm; không chứng minh kinh nghiệm đó phù hợp công việc. JD thiếu yêu cầu hoặc yêu cầu 0 năm trả `null` vì thành phần này không áp dụng.

## Kết quả demo thực tế

CV_001 / JOB_001: 4 yêu cầu bắt buộc và 5 ưu tiên có bằng chứng khớp; RESTful API cần rà soát theo quy tắc alias/ngữ cảnh hiện tại; Message Queue chưa tìm thấy. Điểm bao phủ = 11 / 13,5 × 100 = 81,48.

CV khai tổng 5,5 năm, JD yêu cầu 4,5 năm: điểm bao phủ số năm là 100/100. Đây không phải accuracy hoặc xác suất tuyển dụng.

## Giới hạn và bước tiếp theo

Chưa suy luận từ đoạn mô tả tự do, khoảng năm hoặc lịch sử việc làm chồng lấn. Kinh nghiệm tự khai chưa được xác minh. Quy tắc taxonomy/ngữ cảnh có thể bỏ sót hoặc nhận sai; cần rà soát bằng dữ liệu gán nhãn. SHA256 nguồn CV/JD/taxonomy và thời gian xử lý được lưu để đối chiếu; một lần chạy không phải benchmark.

Bước tiếp theo: ghép SBERT + kỹ năng + kinh nghiệm thành Hybrid, công khai trọng số và xử lý thành phần `null`. Chưa tích hợp ứng dụng chính, chưa có Precision/Recall/F1.
