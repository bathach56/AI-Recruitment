# Bộ kiểm thử tuyển dụng cục bộ v1

Nguồn fixture: `tools/DemoScenario/scenario.json`. Sáu hồ sơ và toàn bộ doanh nghiệp là giả lập, không phải dữ liệu cá nhân hoặc cơ hội tuyển dụng thật. Bộ này kiểm tra chức năng, không có nhãn ground truth để tính Precision/Recall/F1.

## Chuẩn bị trên máy mới

1. Cài SQL Server LocalDB, .NET SDK tương ứng project và Python tương thích với `backend test/requirements.txt`.
2. Build web; chạy các lệnh `--initialize-database`, `--initialize-accounts`, `--initialize-reviews` trong Development theo các hướng dẫn tài khoản và xét CV. Cấp tài khoản Recruiter `congty@recruitai.test` và mật khẩu qua biến môi trường TestAccounts, không ghi vào source.
3. Build `tools/DemoScenario/DemoScenario.csproj`, chạy DLL với `--replace-demo-data <repository-root>`. Lệnh này có chủ đích thay bộ mẫu cũ, sao lưu trước và từ chối chạy trùng bộ tài khoản mới. Không dùng trên production.
4. Tạo môi trường Python, cài requirements hiện có; chạy `backend test/scripts/download_sbert.py`. Script lưu revision của mô hình trong `.cache/sbert/provenance.json`.
5. Chạy `tools/DemoScenario/create_cvs.py` bằng Python của môi trường AI. CV có tên, kỹ năng, kinh nghiệm, dự án, học vấn và nhãn giả lập; xuất PDF cùng PNG kiểm tra trong App_Data.
6. Khởi động web tại localhost:5132 và AI bằng `python -m uvicorn api:app --app-dir "backend test" --host 127.0.0.1 --port 8000` từ repository root.
7. Cấp `TEST_RECRUITER_PASSWORD` qua môi trường rồi chạy `node tools/DemoScenario/verify-flow.cjs --submit --analyze`. Các lần sau dùng `--analyze` nếu muốn tạo thêm đợt xét mới.

Luồng kiểm tra đăng nhập bằng tài khoản thật trong SQL, upload PDF qua API riêng tư, nộp vào đúng tin, kiểm tra mỗi JD có 2 CV, chặn truy cập chéo công ty và chọn CV khác tin. Sau đó tạo 3 đợt Hybrid, chạy tuần tự cả 6 CV, kiểm tra sắp xếp điểm, lọc điểm tối thiểu và xuất XLSX. Mỗi nhóm còn chạy TF-IDF và Sentence-BERT trên một CV để xác nhận cả ba phương pháp hoạt động.

## Kết quả thực hiện ngày 09 tháng 11 năm 2026

Đã chạy CPU với `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`, revision `e8f8c211226b894fcb81acc59f3b34ba3efd5f42`, sentence-transformers 6.1.0, transformers 5.19.0, torch 2.14.1. TF-IDF dùng corpus `data/development_v1`, kiểm tra hash manifest trước khi fit. Tiền xử lý `text-features-v1`; đối chiếu kinh nghiệm `structured-matching-v1.1` nhận trường số năm tự khai báo đứng riêng trên dòng trong trang PDF hoặc đoạn DOCX, giữ offset bằng chứng và không suy đoán từ mốc thời gian.

Hybrid dùng trọng số thử nghiệm ngữ nghĩa 0,5; kỹ năng 0,3; kinh nghiệm 0,2. Đây là giả định cấu hình, chưa tối ưu thực nghiệm. Điểm phù hợp thực tế từ lần chạy này:

| JD | Ứng viên 1 | Điểm | Ứng viên 2 | Điểm |
| --- | --- | ---: | --- | ---: |
| Backend | Nguyễn Minh An | 82,07 | Trần Quốc Bảo | 77,94 |
| Frontend | Lê Thu Hà | 76,25 | Phạm Gia Linh | 62,68 |
| Database | Đỗ Đức Minh | 76,15 | Vũ Ngọc Mai | 67,07 |

Đây là điểm CV–JD, không phải độ chính xác mô hình hoặc quyết định tuyển dụng. Báo cáo JSON đầy đủ với ID đợt, điểm thành phần và thời gian HTTP đo thực lưu tại `webAI/App_Data/scenario-ai-report.json`; XLSX từng nhóm cùng thư mục. Các kết quả hiện trong mục Kết quả xét CV của tài khoản công ty. Không coi thời gian từ một lần chạy chức năng là benchmark.

Đã sửa hai lỗi giao diện: nhãn option của bộ chọn JD bị gán nhầm thành class khiến danh sách trắng; và sự kiện input của biểu mẫu đặt lại checkbox chọn tất cả trước sự kiện change. Kiểm thử hồi quy thực thi các đoạn xử lý này. Backend vẫn kiểm tra CompanyId và JobId trong SQL; giao diện chỉ hiển thị các tin của tài khoản công ty được API trả về.
