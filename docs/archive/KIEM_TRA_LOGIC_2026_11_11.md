# Kiểm tra logic và điều hướng — 11/11/2026

> Tài liệu lịch sử/thiết kế tại thời điểm viết; không dùng thay hướng dẫn hiện tại. Xem [mục lục tài liệu](../README.md).

Phạm vi ban đầu: mã nguồn tại commit `218919b`, kiểm thử JavaScript/Python, biên dịch .NET, kiểm thử SQL hoàn tác và HTTP local.

**Cập nhật sau rà soát:** theo yêu cầu tiếp theo, cả 6 điểm bên dưới đã được sửa trong working tree. Đã thêm kiểm thử hồi quy cho chuyển hướng, phản hồi cũ ghi đè mục mới, ngành nghề, kinh nghiệm, tin đóng/hết hạn và hơn 200 tin. Đồng thời đã chuyển 36 tài liệu sang SQL và kiểm tra 6 CV với AI thật đọc từ SQL; xem `docs/CHAY_LOCAL.md`. Bên dưới giữ bằng chứng lỗi ban đầu, không còn là danh sách lỗi đang mở. Chưa commit/push các sửa đổi này.

## Các lỗi cần sửa

### 1. Đăng nhập không quay lại trang đối chiếu/kết quả — ưu tiên cao

Nguồn: `webAI/wwwroot/js/career.js:231–233`.

Khách mở `/Matching?job=25` được máy chủ đưa tới đăng nhập với ReturnUrl đúng. Nhưng sau đăng nhập Recruiter, JavaScript chỉ cho quay về tiền tố `/Recruiter`, `/` hoặc `/Jobs/<số>`. Vì vậy trang đối chiếu và `/ReviewResults?batch=...` đều bị chuyển thành `/Recruiter`, mất JD/đợt xét đang muốn mở. Admin với ReturnUrl `/Admin` cũng bị đưa về `/`.

Đã thực thi trực tiếp biểu thức chuyển hướng hiện có trong môi trường JavaScript cô lập và xác nhận các đích sai trên. Đường dẫn ứng viên `/Candidate?tab=applications&application=112` được giữ đúng.

Đề xuất: danh sách đường dẫn nội bộ hợp lệ theo từng vai trò, kiểm tra chính xác pathname và bảo toàn query cần thiết; bổ sung kiểm thử sau đăng nhập cho Matching, ReviewResults, Admin. Liên kết từ đăng nhập sang đăng ký hiện cũng không mang ReturnUrl, cần giữ ngữ cảnh qua cả hai bước.

### 2. Yêu cầu lưu cũ có thể xóa nội dung mục vừa chuyển tới — ưu tiên cao

Nguồn: `webAI/wwwroot/js/career.js:285–288,300,305,312`; các lần tải lại danh sách ứng viên có mô thức tương tự.

Cách xảy ra: bấm đóng tin/cập nhật trạng thái, chuyển sang Gửi phản hồi khi mạng còn chờ; callback sau khi lưu gọi lại `recruiterPanel(tab)` của mục cũ. Hàm thay nội dung bằng “Đang tải…” trước khi kiểm tra `paramsTab()`. Sau đó phát hiện đã đổi mục thì thoát, để mục hiện tại bị mất nội dung.

Đã tái hiện bằng cách chạy chính hàm `recruiterPanel` trong môi trường JavaScript cô lập: gọi làm mới `jobs` khi tab hiện tại là `notifications` thay thế nội dung hiện tại trước khi thoát. Chưa bấm tái hiện trên trình duyệt vì kết nối công cụ UI không hoạt động.

Đề xuất: kiểm tra tab trước mọi thay đổi DOM, dùng mã phiên render để loại phản hồi cũ; callback lưu chỉ tải lại nếu vẫn đang ở đúng mục. Kiểm tra cả trường hợp đi khỏi một mục rồi quay lại khi yêu cầu trước chưa xong.

### 3. Đăng tin không chọn/gửi ngành nghề — ưu tiên cao

Nguồn: `webAI/wwwroot/js/career.js:293`; `webAI/Controllers/WorkspaceController.cs:262,387`.

Payload đăng tin thiếu `category`; DTO mặc định là “Công nghệ”. Biểu mẫu hiện không cung cấp lựa chọn ngành để người tuyển dụng sửa điều này. Tin tiếp thị, thiết kế hoặc dữ liệu tạo qua giao diện cũng bị lưu thành Công nghệ, làm bộ lọc ngành cho kết quả sai.

Đề xuất: cho chọn ngành từ cùng danh mục bộ lọc, truyền vào API, kiểm tra phía máy chủ và kiểm thử tạo tin từng ngành rồi tìm lại. Không chỉ sửa dữ liệu mẫu vì sẽ không giải quyết tin mới.

### 4. Trang chi tiết phụ thuộc danh sách 200 tin đang mở — ưu tiên vừa

Nguồn: `webAI/Controllers/JobsController.cs:18–25`; `webAI/wwwroot/js/career.js:74–77`; `webAI/wwwroot/js/candidate-applications.js` liên kết Xem tin tuyển dụng.

Trang `/Jobs/<id>` tải toàn bộ danh sách công khai rồi tìm ID trong đó. Tin đóng/hết hạn bị loại khỏi danh sách; tin vẫn đang mở nhưng nằm ngoài 200 tin mới nhất cũng không được tìm thấy. Vì vậy liên kết từ Việc đã lưu/Việc đã ứng tuyển có thể mở màn hình không tìm thấy dù bản ghi còn trong SQL.

Phần chi tiết ứng tuyển riêng vẫn lấy được thông tin JD qua API có phân quyền; đây là lỗi đường dẫn xem tin, không phải mất hồ sơ ứng tuyển.

Đề xuất: API lấy chi tiết đúng ID, quy tắc rõ cho tin đóng/hết hạn và người đã ứng tuyển/chủ tin; danh sách tìm kiếm cần phân trang phía máy chủ nếu vượt giới hạn, không âm thầm cắt còn 200.

### 5. Bộ lọc kinh nghiệm không bao phủ giá trị có thể nhập — ưu tiên vừa

Nguồn: `webAI/wwwroot/js/career.js:49,65`.

Lựa chọn lọc bị viết cố định, so khớp chuỗi tuyệt đối. Các giá trị như `1–2 năm`, `2–3 năm`, `Dưới 1 năm` không có lựa chọn tương ứng; cách viết `2-4 năm` và `2–4 năm` cũng không trùng nhau. Bộ lọc không thể hiện hết dữ liệu mà biểu mẫu/tin mẫu sử dụng.

Đề xuất: thống nhất nhóm kinh nghiệm và chuẩn hóa giá trị giữa đăng tin, lưu trữ và lọc; cần quyết định rõ lọc theo nhóm chính xác hay theo khoảng giao nhau trước khi triển khai.

### 6. Nhãn phương pháp AI sai nghĩa — ưu tiên thấp

Nguồn: `webAI/wwwroot/js/career.js:311`.

Tổng quan tuyển dụng ghi “TF-IDF, Sentence-BERT hoặc Kết hợp tại văn phòng và từ xa”. Cụm sau là cách làm việc, không phải phương pháp Hybrid. Nên hiển thị “Kết hợp” hoặc “Phương pháp kết hợp”. Mã phương pháp gửi AI vẫn là Hybrid nên đây là lỗi diễn giải trên giao diện, không phải đổi thuật toán.

## Những kiểm tra đã đạt trong lần này

- .NET build: 0 lỗi, 0 cảnh báo. Lần đầu sandbox chặn ghi tệp obj; chạy lại có quyền phù hợp thành công.
- 39/39 kiểm thử JavaScript đạt; 56/56 kiểm thử Python AI đạt. Log mô phỏng mô hình không sẵn sàng trong kiểm thử là lỗi được chủ động tạo để kiểm tra xử lý thất bại.
- 2/2 kiểm thử HTTP có đăng nhập đạt: ứng viên chỉ đọc CV/kết quả/thông báo của mình; công cụ tuyển dụng chặn truy cập chéo và từ chối gửi phản hồi sai quyền trước khi gửi tin nào.
- Bộ kiểm thử SQL hoàn tác đạt: 30/50/20 hồ sơ theo ba JD, cách ly công ty, cấu hình JD phía máy chủ, xem CV, phản hồi/thông báo, trạng thái xử lý/thử lại và XLSX. Không giữ lại các điểm fixture hay phản hồi của kiểm thử.
- Kịch bản HTTP chỉ đọc xác nhận 3 JD của công ty chính, đúng 2 CV/JD, 8 tin công khai thuộc 6 công ty; chặn JD công ty khác và chọn CV sai JD.
- `/`, `/Login`, `/Register`, `/Jobs/25` trả 200; tài nguyên CSS/JS tham chiếu từ các trang đó trả 200; `/Status/404` trả 404.
- Khách mở Candidate, Recruiter, Matching, ReviewResults, Admin được chuyển tới Login với ReturnUrl đúng. API hồ sơ ứng tuyển trả 401 cho khách. Lỗi số 1 nằm ở bước JavaScript sau đăng nhập, không ở bước chuyển của máy chủ.
- Điều hướng thông báo chứa đúng ID ứng tuyển; kiểm thử giao diện ở cấp mã và API đều kiểm tra cách ly chủ hồ sơ. Phân trang trang chủ 5 mục, các danh sách đã cấu hình khác 10 mục được kiểm thử hiện có xác nhận.

## Giới hạn xác minh

Thử khởi tạo skill computer-use thành công nhưng `sky.list_apps()` báo không có kết nối native pipe. Do đó chưa kiểm chứng bằng thao tác/ảnh chụp trình duyệt, màn hình di động, nút Back/Forward thực tế và bố cục. HTTP 200 và kiểm thử DOM mô phỏng không thay thế việc đó.

Không gửi phản hồi thật, không tạo tài khoản/tin tuyển dụng mới, không xóa dữ liệu người dùng trong lần này. Chưa chạy lại đợt xét lưu đủ 6 CV; kiểm thử Python và quyền truy cập AI đã chạy, kết quả 6 CV của lần trước không được tính thành thực nghiệm mới ngày hôm nay. Chưa có nhãn nghiên cứu độc lập, nên không có kết luận độ chính xác/F1 mới.

## Thứ tự xử lý đề nghị

Sửa 1–3 trước vì ảnh hưởng trực tiếp việc quay đúng nơi, hiển thị đúng mục và lọc đúng ngành. Sau đó sửa 4–5 để xử lý dữ liệu tăng lên và tin đóng/hết hạn; sửa 6 cùng đợt. Mỗi lỗi nên có kiểm thử hồi quy cho đúng tình huống phát hiện, rồi kiểm tra lại trên trình duyệt khi công cụ kết nối được.
