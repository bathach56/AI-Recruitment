# Chọn hồ sơ và lưu kết quả xét CV

Trên `/Matching`, nhà tuyển dụng chọn tin tuyển dụng của công ty thay vì nhập lại JD. Backend lấy mô tả, yêu cầu, kỹ năng và kinh nghiệm của tin đã lưu làm chuẩn; chỉ phương pháp và trọng số thử nghiệm lấy từ giao diện. Có phần xem trước JD chỉ đọc. Trong bước Hồ sơ có ba nguồn có thể chọn chung trong một đợt:

1. **CV đã ứng tuyển:** chỉ hiển thị hồ sơ nộp vào đúng tin đang xét; tick từng hồ sơ hoặc chọn tất cả sau tìm kiếm. Đổi tin sẽ bỏ lựa chọn ứng tuyển của tin trước. Backend cũng chặn hồ sơ thuộc tin khác, kể cả cùng công ty.
2. **Excel:** tải mẫu `.xlsx`, nhập các cột `candidate_name`, `email`, `cv_text`. Email có thể để trống; tên và nội dung CV bắt buộc. Xem danh sách đã đọc, sau đó tick từng dòng hoặc chọn tất cả.
3. **Tệp / văn bản:** vẫn tải PDF/DOCX hoặc dán nội dung như trước; tệp tải lên cũng có tick chọn và chọn tất cả.

Danh sách xét CV gọi `GET /api/workspace/applications?jobId=...`: API kiểm tra tin thuộc công ty hiện tại và lọc ngay trong SQL bằng cả CompanyId và JobId. ID tin là khóa chính riêng, không dùng tên tin để phân nhóm. Đổi tin sẽ xóa các tick chọn trước đó (kể cả Excel/tệp ngoài); danh sách tệp ngoài vẫn giữ để chọn lại có chủ ý. Phản hồi cũ khi đổi tin nhanh không được ghi đè danh sách của tin mới. Hiển thị số hồ sơ và JD ID của tin đang chọn. API không truyền jobId vẫn dành cho hộp thư quản lý chung của chính công ty, không dùng cho bộ chọn CV của trang Matching.

Đã kiểm tra bằng transaction SQL rollback: một công ty có Backend 30, Frontend 50, Database 20 hồ sơ; chỉ trả đúng nhóm theo tin. Tin cùng tên của công ty khác, CV khác tin và CV khác công ty đều bị chặn. Đây là dữ liệu kiểm thử nghiệp vụ, không phải số liệu tuyển dụng hoặc kết quả nghiên cứu.

Excel dùng **nội dung văn bản của CV**, không dùng đường dẫn Gmail/Drive, không tự đọc hộp thư hoặc tải URL. Với CV đính kèm email, có thể tải PDF/DOCX về máy rồi chọn tệp trực tiếp. Excel tối đa 50 hồ sơ, 10 MiB/file, 32.767 ký tự/ô; từ chối công thức, macro và workbook chứa externalLinks. Tổng được chọn của các nguồn tối đa 50 CV/đợt; tệp PDF/DOCX tối đa 10 MiB/tệp và tổng 100 MiB.

## Lưu và xử lý

`POST /api/recruiter/reviews` yêu cầu jobId, kiểm tra tin thuộc công ty và ứng tuyển đúng tin rồi tạo đợt trong SQL. JD/tiêu đề/kỹ năng/kinh nghiệm client gửi không được dùng để thay dữ liệu tin đã lưu. Không nhận điểm AI do client gửi. CV tải từ máy được lưu riêng ngoài wwwroot; CV ứng tuyển sử dụng bản đã lưu riêng hiện có.

Snapshot JD gồm mô tả, yêu cầu ứng viên và nội dung kinh nghiệm; kỹ năng bắt buộc lấy từ Skills. Tin hiện chưa có cột kỹ năng ưu tiên nên không tự tạo thêm. Kinh nghiệm có dạng số rõ ràng như “2–4 năm” lấy mức tối thiểu 2 năm; “Không yêu cầu” là 0; trường hợp như “Thực tập sinh” không tự quy thành số năm mà để null. Cập nhật tin sau này không đổi snapshot của đợt cũ. Không cần đổi schema cho liên kết này: job_id đã nằm trong cấu hình lưu của đợt.

Giao diện gọi `POST /api/recruiter/reviews/{batch}/items/{item}/analyze` tuần tự. Backend đọc đúng đầu vào đã lưu, gọi AI service hiện có và lưu kết quả/bằng chứng hoặc lỗi. Điểm 0 được giữ; thiếu dữ liệu và lỗi có điểm null. Đợt lưu cả cấu hình JD/model/trọng số, nguồn hồ sơ, thời gian xét và kết quả gốc để có thể xem lại. Hồ sơ đã có kết quả không bị chạy lại chỉ vì request được gửi lặp.

Đóng trang không làm mất đợt; các hồ sơ chưa gọi AI vẫn ở trạng thái Queued. Không có background worker tự chạy sau khi đóng tab. Mục **Kết quả xét CV** (`/ReviewResults`) cho xem từng đợt và chạy tiếp hồ sơ chưa xét/lỗi. Yêu cầu Running bị treo do tiến trình chết có thể nhận lại sau lease 5 phút; request còn chạy bình thường không nhận bản chạy thứ hai.

## Bộ lọc và Excel

Lọc tên/email, trạng thái, điểm tối thiểu; sắp xếp điểm cao/thấp hoặc tên. Dấu “—” là không có điểm; khi sắp xếp theo điểm, giá trị null ở cuối. Chi tiết hiển thị điểm thành phần và bằng chứng kỹ năng từ kết quả AI.

**Tải Excel** là XLSX thực, dùng cùng truy vấn lọc và thứ tự với bảng đang xem. Các cột gồm ứng viên, email, nguồn, JD, phương pháp, trạng thái, điểm tổng/thành phần, lỗi và thời điểm xét. Điểm lưu dạng số từ 0 đến 100; không đổi thành accuracy. Ô thiếu điểm trống; dữ liệu chuỗi được ghi bằng inline string, không biến nội dung bắt đầu bằng `=` thành công thức. Có header xanh, freeze hàng đầu và autofilter.

Mọi endpoint chỉ dành cho Recruiter, kiểm tra công ty sở hữu đợt; mutation kiểm tra antiforgery. Công ty khác không xem, chạy hay tải Excel của đợt. Không thêm OAuth/Gmail hoặc package Excel mới: codec ZIP/XML có phạm vi cố định cho mẫu nhập và bản xuất của ứng dụng.

## Nâng cấp database

Repository hiện chưa có EF migrations. Thêm hai bảng `CvReviewBatches`, `CvReviewItems` bằng lệnh khởi tạo riêng, chỉ CREATE nếu chưa tồn tại; không xóa/tạo lại database hoặc thay dữ liệu cũ:

```powershell
dotnet build webAI/webAI.csproj -o .preview-build-check
cd webAI
dotnet ../.preview-build-check/webAI.dll --initialize-reviews --environment Development
```

## Kiểm tra

- `tests/CvReviewChecks`: kiểm tra XLSX/Unicode, dữ liệu dài, công thức bị từ chối, giới hạn 50 dòng, điểm 0/null; lưu/đọc kết quả, retry, truy cập chéo công ty, bộ lọc và XLSX tương ứng. Điểm fixture chỉ ở trong transaction rồi rollback, không tạo kết quả demo giả.
- `webAI/tests/reviews.integration.cjs`: HTTP phân quyền, tạo đợt từ ba nguồn, lưu trạng thái, API Excel và trường hợp AI chưa sẵn sàng. Bài kiểm tra tạo đợt có nhãn `[Kiểm thử API]`, không phải kết quả nghiên cứu.
- Đã khôi phục môi trường AI và chạy thật 6 CV PDF với Hybrid, thêm TF-IDF và Sentence-BERT trên một CV của mỗi nhóm. Xem `LOCAL_SCENARIO.md` và báo cáo cục bộ trong App_Data. Nếu service không chạy, kết quả vẫn ghi Error và không có điểm thay thế. Kiểm tra chức năng không chứng minh chất lượng mô hình.
- Chưa xác minh trực quan bằng trình duyệt thật vì browser/native host không khả dụng trong phiên này.
