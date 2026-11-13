# Bắt đầu thử gán nhãn 20 cặp CV–JD

## Mục tiêu và giới hạn

Đây là bước tập thống nhất tiêu chí trước khi thu thập bộ nghiên cứu chính thức. Không huấn luyện hoặc đo độ chính xác trong bước này.

Bộ thử có 5 JD thuộc kinh doanh, thiết kế, công nghệ, tiếp thị và dữ liệu; mỗi JD được ghép với 4 hồ sơ, tổng 20 cặp. Có 10 CV: 5 CV giả lập đầy đủ từ bộ demo đã bỏ tên/email, 5 biến thể giả lập có ít thông tin hơn. Văn bản được trợ lý soạn từ fixture của dự án, cần con người đọc kiểm tra; không có nhãn hoặc điểm do AI điền. Mã CV và thứ tự cặp đã xáo trộn để không ngầm gợi ý đáp án.

Các CV/JD lặp giữa nhiều cặp và đã có nguồn từ bộ demo, nên đây **không phải 20 quan sát độc lập hoặc tập kiểm chứng mô hình**. Chưa có tiếng Anh trong đợt nhỏ này; chỉ mở rộng song ngữ khi tiêu chí tiếng Việt đủ rõ.

## Bạn làm gì trước?

1. Mở [danh sách 20 cặp](../data/annotation_trial_20_vi_v1/BAT_DAU.md). Bấm một mã để đọc toàn bộ JD và CV ngay trong IDE.
2. Hai người thống nhất cách hiểu yêu cầu bắt buộc/ưu tiên trong 5 JD **trước khi ghi nhãn**, nhưng chưa trao đổi nhận xét từng CV. Nếu JD mơ hồ, ghi lại và sửa thành phiên bản mới, không tự suy diễn yêu cầu ngầm.
3. Người A chỉ điền [reviewer_a.csv](../data/annotation_trial_20_vi_v1/reviewer_a.csv), người B chỉ điền [reviewer_b.csv](../data/annotation_trial_20_vi_v1/reviewer_b.csv). Dùng mã khác nhau, ví dụ `nguoi_01` và `nguoi_02`. Không xem phiếu của nhau hoặc điểm website trước khi hoàn tất.
4. Mỗi người làm 3–5 cặp đầu độc lập; so sánh để phát hiện tiêu chí chưa rõ. Nếu đổi tiêu chí, ghi phiên bản và đánh giá lại nhóm thử đó độc lập. Sau khi chốt, làm hết 20 cặp rồi mới xem kết quả của nhau.

## Quy tắc ghi nhãn

| Giá trị | Ý nghĩa | Khi dùng |
|---|---|---|
| `1` | Phù hợp để nhà tuyển dụng xem xét tiếp | Có bằng chứng đáp ứng các yêu cầu cốt lõi đã thống nhất; không đồng nghĩa trúng tuyển |
| `0` | Không phù hợp theo tiêu chí đã thống nhất | Có bằng chứng rõ ràng không đáp ứng yêu cầu cốt lõi, chẳng hạn số năm ghi rõ thấp hơn mức tối thiểu bắt buộc |
| `uncertain` | Chưa đủ cơ sở quyết định | Thông tin thiếu/mâu thuẫn, kinh nghiệm chưa tính được hoặc yêu cầu JD chưa rõ |

Không tự biến kỹ năng “ưu tiên” thành bắt buộc. Không tự kết luận `0` chỉ vì CV không nhắc một từ khóa; phân biệt thiếu bằng chứng với bằng chứng không đáp ứng. Chức danh/ngành khác không tự động bị loại nếu kỹ năng có thể chuyển đổi. Không dùng tên, tuổi, giới tính, trường nổi tiếng hoặc thông tin liên hệ để quyết định. Không cộng hai khoảng kinh nghiệm trùng thời gian; ghi `uncertain` khi không xác định được.

Trong bước này chỉ đánh giá **bằng chứng thể hiện trên CV**, không xác minh người viết thực sự thành thạo công nghệ hoặc đạt thành tích.

## Điền phiếu thế nào?

Giữ nguyên tên cột và `pair_id`; không thêm/bớt dòng, không sửa CV/JD trong lúc đang gán nhãn. Các tệp CSV dùng UTF-8 có BOM để mở bằng Excel; khi lưu cần giữ CSV UTF-8. Không mở CSV chứa nhãn người còn lại.

| Cột | Nội dung bạn phải tự điền |
|---|---|
| `reviewer_id` | Mã của chính người đánh giá |
| `label` | `0`, `1` hoặc `uncertain` |
| `domain_evidence` | Bằng chứng công việc/nhiệm vụ liên quan; không chỉ ghi “đúng ngành” |
| `skill_evidence` | Yêu cầu JD → trích đoạn CV → đáp ứng/chưa rõ/không đáp ứng |
| `experience_evidence` | Yêu cầu kinh nghiệm → dòng trong CV → cách hiểu và điểm chưa chắc |
| `notes` | Lý do chọn nhãn, yêu cầu ưu tiên, thông tin thiếu hoặc câu hỏi cần thống nhất |

Mẫu cách viết, **không phải đáp án của cặp nào**:

> JD yêu cầu: [yêu cầu cụ thể]. CV ghi: “[trích nguyên văn]”. Nhận xét: [bằng chứng này đủ/chưa đủ ở điểm nào]. Chọn nhãn: [quyết định của người đánh giá].

## Có thể nhập bằng công cụ có sẵn

Không cần Excel. Mở terminal tại gốc dự án, mỗi lệnh nhập một cặp. Công cụ hiện JD/CV, hỏi nhãn và bằng chứng, chỉ lưu sau khi bạn gõ `LUU`.

```powershell
# Người A thực hiện bằng mã của mình
& 'backend test/.venv/Scripts/python.exe' research/bilingual/annotate.py --dataset data/annotation_trial_20_vi_v1 --role a --reviewer-id nguoi_01 --pair P001

# Người B thực hiện riêng, chưa xem phiếu của A
& 'backend test/.venv/Scripts/python.exe' research/bilingual/annotate.py --dataset data/annotation_trial_20_vi_v1 --role b --reviewer-id nguoi_02 --pair P001
```

Lặp lại với P002 đến P020. Không dùng cùng mã cho cả hai vai. Công cụ từ chối ghi đè một cặp đã có nhãn; nếu cần sửa, giữ bản phiếu ban đầu và ghi lại lý do sửa.

## Sau khi hai người đã hoàn tất

1. So sánh nhãn và bằng chứng. Phân loại nguyên nhân bất đồng: hiểu JD, kỹ năng tương đương, cách tính kinh nghiệm hoặc thiếu thông tin.
2. Thảo luận để thống nhất; tốt hơn nếu giảng viên/người có kinh nghiệm chuyên môn duyệt các ca khó. Nếu một người gán nhãn tham gia phân xử, ghi rõ đó là đồng thuận sau thảo luận, không gọi là người thứ ba độc lập.
3. Ghi nhãn cuối và lý do trong [adjudication.csv](../data/annotation_trial_20_vi_v1/adjudication.csv), giữ cả hai phiếu gốc. Có thể giữ `uncertain` khi vẫn chưa đủ cơ sở. **Cột `split` để trống** vì chưa chia tập nghiên cứu.

```powershell
# Chỉ chạy khi đã có cả hai phiếu cho cặp này
& 'backend test/.venv/Scripts/python.exe' research/bilingual/annotate.py --dataset data/annotation_trial_20_vi_v1 --role adjudicator --reviewer-id nguoi_phan_xu --pair P001

# Xem số lượng đã làm; không có nhãn thì không có số đồng thuận
& 'backend test/.venv/Scripts/python.exe' research/bilingual/progress.py data/annotation_trial_20_vi_v1
```

Tỷ lệ đồng thuận và Cohen's kappa hiện có chỉ tính trên các cặp mà hai người khác nhau đều chọn `0` hoặc `1`; cần báo cáo số cặp được tính và số ca `uncertain` riêng. Đồng thuận giữa người đánh giá **không phải độ chính xác AI**.

## Kết quả mong đợi của bước đầu

Hai phiếu độc lập, danh sách bất đồng và bản hướng dẫn rõ hơn — không phải một con số chất lượng mô hình. Sau đó mới lập bộ thu thập chính thức, chốt cách chia nhóm CV/JD và đánh giá ba phương pháp công bằng.

Nguồn và SHA-256: [manifest.json](../data/annotation_trial_20_vi_v1/manifest.json). Công cụ tạo từ fixture, không đọc SQL: `research/bilingual/prepare_annotation_trial.py`. Công cụ từ chối ghi đè một thư mục đã tồn tại để tránh mất phiếu. Bộ dữ liệu hiện tại trên website không bị thay đổi.
