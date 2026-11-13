# Giao diện ứng viên và không gian đối chiếu

> Tài liệu lịch sử/thiết kế tại thời điểm viết; không dùng thay hướng dẫn hiện tại. Xem [mục lục tài liệu](../README.md).

## Hướng thiết kế

Giữ Be Vietnam Pro, màu xanh lam và các token sáng/tối hiện có. Giao diện nhà tuyển dụng lấy luồng công việc làm điểm chính: yêu cầu công việc → hồ sơ → kết quả và bằng chứng. Các bộ đếm trên tổng quan lấy dữ liệu thật từ API; không thêm biểu đồ hoặc điểm minh họa.

Màu cơ sở: nền `#F5F7FB`, bề mặt `#FFFFFF`, chữ `#18243D`, hành động `#1458E8`, chữ phụ `#637088`, đường viền `#E2E7F0`. Chế độ tối kế thừa token trong career.css. Phần đối chiếu dùng chung header/footer, không tạo một bộ nhận diện khác.

```text
Điều hướng tài khoản
Tiêu đề + kết nối AI
Yêu cầu công việc → Thêm CV → Kiểm tra bằng chứng
Giải thích TF-IDF / Sentence-BERT / Hybrid (mở khi cần)
Nhập JD hoặc CV        Kết quả / điểm thành phần / bằng chứng
```

Đã áp dụng frontend-design và ui-ux-pro-max: phân cấp rõ, nội dung theo từng bước, nhãn trạng thái có chữ, chuông có nhãn đọc màn hình và số chưa đọc, thao tác bàn phím, token dùng chung và breakpoint cho màn hình nhỏ. Giữ font hiện tại thay vì thay bằng font lập trình do công cụ gợi ý: nội dung chính là tiếng Việt và đọc hồ sơ.

Tham khảo cấu trúc công việc và hồ sơ từ [Workable — Candidate profile in pipeline view](https://help.workable.com/hc/en-us/articles/115012857047-Candidate-profile-in-pipeline-view-overview), luồng ứng tuyển từ [TopCV](https://faq.topcv.vn/faqs/find-job-and-apply/quy-trinh-ung-tuyen-tren-topcv.html). Không sao chép thương hiệu hoặc số liệu của các website này.

## Điều hướng và thông báo

- Menu trên phân biệt Hồ sơ & CV với Việc đã ứng tuyển; menu bên, tiêu đề và aria-current đồng bộ khi đổi tab.
- Chuông dành cho ứng viên đã đăng nhập. Danh sách gần đây hiển thị tối đa 5 thông báo, badge tính tất cả bản ghi chưa đọc. Có đường dẫn xem toàn bộ thông báo.
- Làm mới khi vào trang, mở chuông, quay lại cửa sổ/tab và mỗi 60 giây khi trang đang hiển thị.
- `GET /api/workspace/notifications` thêm trường readAt. `POST /api/workspace/notifications/{id}/read` và `POST /api/workspace/notifications/read-all` lưu trạng thái vào cột ReadAt đã có. Không đổi schema. Backend giới hạn theo người nhận và kiểm tra antiforgery cho POST.
- Không tự đánh dấu đã đọc chỉ vì mở chuông. Người dùng mở một thông báo hoặc chủ động đánh dấu đã đọc.

## Giới hạn và kiểm tra

Công cụ AI vẫn gọi API hiện có, không tạo điểm fallback. Số chưa đọc không lưu trong localStorage; khởi động lại trình duyệt lấy lại trạng thái từ SQL Server. Không thêm thông báo đẩy hệ điều hành, email hay WebSocket.

Kiểm tra logic và API: `workspace-navigation.test.cjs`, `accounts.integration.cjs` cùng các test frontend hiện có. Công cụ browser/native host không khả dụng trong phiên triển khai này; chưa xác minh trực quan bằng screenshot hoặc thao tác chuột trên trình duyệt thật.

## Hoàn thiện giao diện dùng chung

Áp dụng frontend-design và ui-ux-pro-max trên nhận diện sẵn có: giữ Be Vietnam Pro, xanh thương hiệu, nền trắng/xám ở theme sáng và nền navy ở theme tối. `ui-polish.css` nạp sau các stylesheet hiện hữu qua `_CareerLayout`, tập trung vào các điều khiển còn dùng kiểu trình duyệt mặc định: bộ chọn/sắp xếp, input, file picker, thanh trọng số, nút, bảng, hộp thoại và màu trạng thái. Không thay framework hoặc thêm thư viện giao diện.

Trang ứng viên mở thẳng phần chi tiết kết quả, chỉ thêm bộ chọn nhỏ nếu có nhiều hồ sơ. Không tạo lại thẻ tóm tắt bên dưới. Bộ chọn hồ sơ dùng được bằng bàn phím và thông báo vẫn mở đúng ApplicationId. Trang chủ giữ 5 việc làm/trang; các danh sách khác giữ 10 mục/trang.

Đã rà soát template và thành phần động của trang chủ, tin tuyển dụng, đăng nhập/đăng ký, các tab ứng viên và công ty, đối chiếu AI, kết quả xét CV, Results, trạng thái hệ thống và trang lỗi. Kiểm tra HTTP xác nhận 22 trang/tab/trạng thái trả về có nạp stylesheet mới; build không lỗi/cảnh báo, 37 test JavaScript và 2 test API đạt. Admin được kiểm tra mã template và trang từ chối truy cập theo vai trò, không tạo tài khoản Admin để thử. Browser/native host vẫn không kết nối được, nên chưa xác minh ảnh chụp hoặc bố cục thực ở từng kích thước màn hình.
