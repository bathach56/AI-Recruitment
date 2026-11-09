# Gán nhãn và huấn luyện CV–JD tiếng Việt, tiếng Anh

## Trạng thái thực tế

Chưa có bộ nhãn được con người phê duyệt; chưa huấn luyện riêng mô hình của đồ án. Ứng dụng tiếp tục dùng Sentence-BERT đa ngôn ngữ huấn luyện sẵn. Mô hình gốc hỗ trợ cả tiếng Việt và tiếng Anh, nhưng điều đó không chứng minh chất lượng xét tuyển trên dữ liệu của đồ án.

Nguồn: [thẻ mô hình](https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2), [danh sách ngôn ngữ chính thức](https://www.sbert.net/docs/sentence_transformer/pretrained_models.html).

## Bộ làm quen để gán nhãn

Thư mục `data/bilingual_pilot_v1` có 6 CV × 3 JD × 2 ngôn ngữ = 36 cặp, tương ứng 18 cặp nội dung được dịch. Đây là dữ liệu giả lập, không phải 36 quan sát độc lập hay tập kiểm chứng chất lượng. Tên, email và địa chỉ đã được loại khỏi văn bản phục vụ nghiên cứu. Người thông thạo hai ngôn ngữ cần kiểm tra bản dịch trước khi dùng.

- `pairs.csv`: mã cặp, ngôn ngữ, nhóm CV/JD và đường dẫn văn bản.
- `reviewer_a.csv`, `reviewer_b.csv`: hai người đánh giá độc lập, không xem nhãn của nhau hoặc điểm AI trước khi ghi nhãn.
- `adjudication.csv`: người phân xử ghi nhãn cuối, lý do và tập dữ liệu.
- `manifest.json`: nguồn, mục đích sử dụng và mã kiểm tra nội dung.

Mọi nhãn ban đầu đều trống. Không dùng AI tự điền nhãn để chứng minh chính chất lượng của AI đó. Dữ liệu `development_v1` đã dùng phát triển hệ thống cũng không được gọi là tập kiểm tra độc lập.

## Quy tắc đánh giá cần thống nhất trước

Nhãn `1`: hồ sơ có bằng chứng đáp ứng các yêu cầu cốt lõi đã thống nhất của vị trí, đủ để chuyển cho người tuyển dụng xem xét. Nhãn `0`: có bằng chứng không đáp ứng yêu cầu cốt lõi. Nhãn `uncertain`: chưa đủ thông tin hoặc yêu cầu chưa rõ; không suy diễn thành phù hợp hay không phù hợp.

Mỗi người ghi `reviewer_id`, `label`, bằng chứng về lĩnh vực (`domain_evidence`), kỹ năng (`skill_evidence`), kinh nghiệm (`experience_evidence`) và `notes`. Ghi rõ “không thấy bằng chứng” khi thông tin thiếu; phân biệt điều này với bằng chứng không đáp ứng. Không dùng tuổi, giới tính, tên hoặc thông tin không liên quan để quyết định nhãn.

Thử gán nhãn một nhóm nhỏ, thảo luận điểm bất đồng rồi chốt phiên bản hướng dẫn trước đợt chính. Lưu cả hai phiếu gốc; người phân xử ghi `final_label` bằng 0/1, `adjudicator_id`, `rationale`. Chỉ chốt nhãn khi đủ cơ sở. Tính tỷ lệ đồng thuận và Cohen's kappa từ phiếu thật, không điền số minh họa vào báo cáo.

## Thu thập và chia tập chính thức

Thu thập thêm CV–JD có quyền sử dụng, khử nhận dạng và ghi nguồn/giấy phép/người duyệt trong manifest (`source_notes`, `license`, `approved_by`, `intended_use=research`). Không chỉ đổi cờ của bộ giả lập để tuyên bố đây là dữ liệu nghiên cứu thực tế.

Chốt trước giao thức, tỷ lệ chia và hạt ngẫu nhiên; cân bằng ngôn ngữ, nhóm nghề và nhãn theo khả năng dữ liệu. Các bản dịch của cùng CV/JD phải ở cùng một tập. Mặc định `--split-policy both` yêu cầu cả nhóm CV và JD không giao nhau giữa `train`, `validation`, `test`. Vì bộ làm quen chứa toàn bộ tổ hợp 6×3, không thể chia nguyên tất cả các cặp thành ba tập độc lập theo cách này; cần thiết kế nhóm thu thập riêng hoặc loại các cặp giao nhau.

Chỉ dùng `--split-policy cv` khi nghiên cứu đã công bố rõ tình huống CV mới, JD đã biết; cách đó không chứng minh khả năng với JD mới. Không chia ngẫu nhiên từng dòng rồi để bản dịch hoặc CV trùng lọt qua tập kiểm tra.

## Lệnh kiểm tra và huấn luyện

Chạy từ gốc dự án bằng PowerShell, dùng môi trường Python hiện có:

```powershell
& 'backend test/.venv/Scripts/python.exe' research/bilingual/train.py --dataset data/bilingual_pilot_v1 --check-only
```

Hiện lệnh này phải từ chối vì thiếu nhãn và bộ làm quen chưa được duyệt cho nghiên cứu. Đây là cơ chế kiểm soát đầu vào, không phải kết quả huấn luyện. `--allow-pilot` chỉ phục vụ thử quy trình sau khi có nhãn; không bỏ qua kiểm tra nhãn, nguồn văn bản hoặc rò rỉ tập.

Sau khi có bộ chính thức được duyệt, thay đường dẫn bộ dữ liệu và thư mục đầu ra mới:

```powershell
& 'backend test/.venv/Scripts/python.exe' research/bilingual/train.py --dataset data/bo_nhan_da_duyet --check-only
& 'backend test/.venv/Scripts/python.exe' research/bilingual/train.py --dataset data/bo_nhan_da_duyet --output research/runs/vi_en_lan_01 --epochs 3 --device cpu --seed 42
```

Phương án ban đầu là tinh chỉnh Sentence-BERT bằng sai số bình phương giữa cosine và nhãn 0/1. Đây là lựa chọn thí nghiệm cần đánh giá, chưa được chứng minh tối ưu. Script giữ cách tiền xử lý/chia đoạn của hệ thống, chỉ cập nhật từ tập huấn luyện, chọn ứng viên theo sai số tập xác thực và ghi cấu hình, nguồn mô hình, mã kiểm tra nhãn. Không dùng tập kiểm tra để chọn checkpoint; không tự thay mô hình của website. Nếu không cải thiện so với mô hình gốc trên tập xác thực thì không lưu ứng viên mới.

Nhánh huấn luyện thực sự chưa chạy vì chưa có nhãn; kiểm thử hiện tại xác minh bộ kiểm tra dữ liệu và việc chặn huấn luyện, chưa chứng minh chất lượng mô hình hoặc toàn bộ lần chạy tối ưu hóa.

## Đánh giá trước khi tích hợp

Đóng băng tập kiểm tra. So sánh TF-IDF, Sentence-BERT gốc, Sentence-BERT tinh chỉnh và phương pháp kết hợp trên cùng giao thức; chỉ chọn ngưỡng và trọng số bằng tập xác thực. Báo cáo Precision, Recall, F1, ma trận nhầm lẫn, thời gian xử lý, phần cứng, phiên bản dữ liệu/mô hình và cấu hình từ lần chạy thật. Phân tách kết quả Việt, Anh; nếu muốn tuyên bố hỗ trợ đối chiếu chéo ngôn ngữ thì cần thêm CV Việt–JD Anh và chiều ngược lại, bộ hiện tại chưa có hai chiều này.

Điểm tương đồng không phải độ chính xác hay xác suất trúng tuyển. Chỉ tích hợp mô hình mới sau khi kết quả độc lập và các lỗi điển hình đã được rà soát. Quyết định tuyển dụng vẫn thuộc nhà tuyển dụng.
