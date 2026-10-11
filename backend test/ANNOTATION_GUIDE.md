# Hướng dẫn rà soát nhãn — bản làm việc ngày 2

## Công cụ kiểm tra tiến độ

Chạy từ thư mục gốc project sau khi lưu các phiếu:

```powershell
& './backend test/.venv/Scripts/python.exe' 'backend test/scripts/audit_annotations.py'
```

Thêm `--output <file JSON mới>` để lưu hàng đợi rà soát từng cặp. Công cụ chỉ đọc
phiếu, không điền nhãn, không hợp nhất thành ground truth và không sửa bản gốc.
Nhãn đã điền cần có mã người đánh giá, cả ba trường bằng chứng và notes. Nếu không
tìm thấy kinh nghiệm, ghi rõ “chưa tìm thấy thông tin” thay vì bỏ trống bằng chứng.
Hai người phải dùng mã khác nhau; kiểm tra này không chứng minh họ đã làm độc lập.

Kết quả `agreement_candidate` chỉ là hai phiếu đồng thuận và đủ trường; vẫn cần
kiểm tra chuyên môn, chốt rubric, phân xử và khóa phiên bản. Bộ development đã
dùng để xây mô hình nên không tự trở thành test giữ riêng dù đã gán đủ nhãn.

Lần kiểm tra sau Hybrid: 200/200 cặp còn chờ nhãn, chưa có cặp đồng thuận đủ điều
kiện. Báo cáo ở `research/backend_test/annotation_audit_v1/result.json` tính từ
gốc project, có hash các phiếu đầu vào để đối chiếu. Đây là trạng thái tại lúc
chạy; hãy chạy lại sau mỗi vòng gán nhãn.

## Mục tiêu

Đánh giá mức phù hợp theo nội dung CV–JD trong phạm vi đồ án, không quyết định tuyển dụng thật. Người đọc phải có thể chỉ ra bằng chứng trong văn bản cho nhận định của mình. Không dùng tên, giới tính, tuổi hoặc thông tin cá nhân để chấm.

Giữ ba trụ cột trong `docs/NGAY_2_NGHIEN_CUU_GROUND_TRUTH_VA_FR.md`: miền chuyên môn, kỹ năng bắt buộc, kinh nghiệm. Không thay rubric cũ bằng công thức Hybrid. Các trọng số trong tài liệu cũ là giả định, không phải kết quả nghiên cứu.

## Cách làm

1. Mở `data/development_v1/pairs.csv`, chọn pair_id và đọc hai file theo đường dẫn tương ứng trong `data/development_v1`.
2. Người A điền `reviewer_a.csv`, người B điền `reviewer_b.csv` độc lập. Đổi reviewer_id thành mã người đánh giá; lưu CSV UTF-8. Không xem điểm AI hoặc nhãn người còn lại trước khi ghi nhận đánh giá.
3. `domain_evidence`: trích đoạn hoặc chỉ vị trí cho thấy lĩnh vực phù hợp/lệch lĩnh vực; không suy luận chỉ từ tên file.
4. `skill_evidence`: đối chiếu kỹ năng bắt buộc của JD với bằng chứng CV. Không có bằng chứng nghĩa là chưa được chứng minh, không khẳng định ứng viên hoàn toàn không biết kỹ năng đó. Ghi rõ trường hợp tương đương tên công nghệ cần xem xét.
5. `experience_evidence`: ghi số năm/cấp độ và đoạn làm căn cứ; thiếu thông tin thì ghi chưa biết. Không đếm kinh nghiệm hai công việc chồng thời gian thành hai lần.
6. Điền label và notes theo quy tắc dưới đây. Chưa đọc thì để label trống.
7. Sau vòng độc lập, đối chiếu bất đồng và lưu quyết định phân xử riêng; không ghi đè nhãn gốc. Chưa có script hợp nhất hoặc nhãn final trong bước này.

## Giá trị label

- `1`: theo rubric hiện có, đúng miền, đáp ứng ít nhất 60% kỹ năng bắt buộc và không lệch quá một cấp kinh nghiệm; phải ghi bằng chứng.
- `0`: trái miền rõ ràng, dưới 50% kỹ năng bắt buộc hoặc thiếu kinh nghiệm nghiêm trọng theo rubric; phải ghi nguyên nhân cụ thể.
- `uncertain`: thiếu dữ kiện, vùng 50–dưới 60% kỹ năng, cấp độ kinh nghiệm không rõ hoặc rubric chưa đủ để quyết định.
- Trống: chưa đánh giá.

Rubric hiện còn khoảng trống ở mức kỹ năng 50–dưới 60%, định nghĩa “một cấp” và “thiếu nghiêm trọng”. Vì vậy không ép nhãn 0/1 cho các trường hợp này; cần thống nhất định nghĩa trước khi khóa ground truth. Quy trình này ghi nhận vùng chưa rõ, chưa tự thay đổi phương pháp nghiên cứu.

`notes` phải nêu lý do cho mọi nhãn. Phiếu chỉ được xem là ground truth sau khi người đánh giá thực sự đọc, xử lý bất đồng và khóa phiên bản. Kiểm tra script pass chỉ xác nhận cấu trúc/hash, không xác nhận chất lượng chuyên môn của nhãn.

## Bắt đầu nhỏ

Thử 10 cặp `CV_001__JOB_001` tới `CV_010__JOB_001` để làm quen và phát hiện chỗ rubric chưa rõ. Đây là lựa chọn thuận tiện để phát triển, không phải lấy mẫu đại diện hoặc test giữ riêng. Sau vòng thử mới thống nhất rubric và phạm vi gán nhãn tiếp; không bắt buộc làm cả 200 cặp trước khi tiếp tục parser/TF-IDF.

Không điều chỉnh rubric để làm model đang có đạt điểm cao. Không chọn ngưỡng/trọng số bằng nhãn test. Chưa chia ngẫu nhiên 200 cặp thành train/test vì cùng CV/JD sẽ xuất hiện lặp và bộ này đã được dùng để phát triển; cần dataset nghiên cứu có nguồn/nhãn đáng tin rồi chia theo mục tiêu tổng quát hóa.
