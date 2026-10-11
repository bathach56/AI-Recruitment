# BÁO CÁO KẾ HOẠCH TUẦN 1 — NGÀY 2
**Phân công thực hiện**: Người 2 (AI, Frontend & Research)  
**Đề tài**: Hệ thống Tuyển dụng Thông minh & So khớp Hồ sơ CV với Job Description (AI Recruitment & Resume Matching System)  
**Ngày thực hiện**: Ngày 2 / Tuần 1  

---

## MỤC TIÊU CÔNG VIỆC NGÀY 2 (NGƯỜI 2)
1. **Nhiệm vụ nghiên cứu chính**: Nghiên cứu phương pháp luận xây dựng tập nhãn **Ground-truth** chuẩn để đo lường thực nghiệm các chỉ số **Precision, Recall, F1-score**.
2. **Giao điểm phối hợp với Người 1**: Rà soát và thống nhất danh mục tính năng chức năng (**Functional Requirements - FR**) giữa bản đặc tả Use Case (Người 1) và Giao diện UI / Module AI (Người 2).

---

# PHẦN 1: NGHIÊN CỨU PHƯƠNG PHÁP XÂY DỰNG TẬP NHÃN GROUND-TRUTH VÀ ĐO LƯỜNG METRICS

## 1. Bản chất bài toán và lý do bắt buộc phải có Ground-Truth
Trong bài toán so khớp CV và JD (Resume - Job Description Matching), các thuật toán AI như TF-IDF hay Sentence-BERT chỉ tính toán ra **Điểm tương đồng Cosine Similarity** (giá trị liên tục từ $0.0$ đến $1.0$).
- Tuy nhiên, điểm số tương đồng cosine toán học cao **chưa đồng nghĩa với việc ứng viên thực sự phù hợp để tuyển dụng** ngoài thực tế (ví dụ: CV chứa nhiều từ khóa lặp lại hoặc mô tả chung chung vẫn có thể cho Cosine cao).
- Để đánh giá một cách khoa học xem mô hình nào (TF-IDF vs Sentence-BERT vs Hybrid) đưa ra quyết định chính xác nhất, theo quy định nghiên cứu của đề tài, hệ thống **bắt buộc phải có một tập nhãn chuẩn khách quan (Ground-truth labels)** đại diện cho quyết định đúng đắn của con người (Recruiter).
- Nhờ có tập Ground-truth, ta mới có thể ánh xạ bài toán sang đánh giá phân loại / xếp hạng và tính toán được: **Precision, Recall, F1-score, Precision@K** và **Processing Time**.

---

## 2. Tiêu chí gán nhãn khoa học (Annotation Rubric)
Để loại bỏ tính cảm tính chủ quan khi tạo tập dữ liệu Ground-truth, quy trình gán nhãn được chuẩn hóa dựa trên **Bộ tiêu chí 3 trụ cột (3-Pillar Rubric)**:

| Trụ cột đánh giá | Trọng số thực tế | Tiêu chuẩn đánh giá |
| :--- | :---: | :--- |
| **Trụ cột 1: Lĩnh vực & Chức danh (Domain & Title)** | 25% | Chức danh, ngành nghề và định hướng của ứng viên trong CV có tương thích với vị trí JD đang tuyển dụng hay không (ví dụ: Backend Engineer vs Frontend, Data Science vs Business Analyst). |
| **Trụ cột 2: Kỹ năng bắt buộc (Core / Must-have Skills)** | 50% | Tỷ lệ đáp ứng các kỹ năng công nghệ cốt lõi của JD. Phải đạt tối thiểu $\ge 60\%$ danh mục kỹ năng cốt lõi (ví dụ: JD .NET cần C#, ASP.NET Core, SQL Server; nếu CV chỉ có Java/PHP thì không đạt). |
| **Trụ cột 3: Thâm niên & Trình độ (Seniority / Years of Experience)** | 25% | Số năm kinh nghiệm làm việc thực tế của ứng viên so với yêu cầu JD (ví dụ: JD Senior cần $\ge 4$ năm; nếu ứng viên là Fresher/Intern mới ra trường thì không đạt tiêu chuẩn tuyển dụng). |

### Quy tắc xác định nhãn Nhị phân ($y \in \{0, 1\}$):
- **Nhãn 1 (Match / Phù hợp)**:
  - Trụ cột 1: Đúng miền chuyên môn.
  - Trụ cột 2: Đáp ứng $\ge 60\%$ kỹ năng bắt buộc.
  - Trụ cột 3: Không chênh lệch quá 1 cấp độ kinh nghiệm (ví dụ: tuyển Mid-level, ứng viên Junior 2 năm có thể chấp nhận; nhưng tuyển Senior mà ứng viên chưa có kinh nghiệm thì loại).
- **Nhãn 0 (Mismatch / Không phù hợp)**:
  - Vi phạm Trụ cột 1 (hoàn toàn trái ngành: HR, Kế toán, Bán hàng nộp vào IT).
  - Hoặc thiếu đa số kỹ năng cốt lõi ở Trụ cột 2 ($< 50\%$).
  - Hoặc thiếu hụt nghiêm trọng về kinh nghiệm ở Trụ cột 3.

---

## 3. Chiến lược lấy mẫu (Sampling Strategy) từ Dataset hiện có
Dataset hiện tại của dự án gồm có:
- **962 CV** thuộc 25 chuyên mục tại `data/processed/UpdatedResumeDataSet.csv`.
- **2,277 JD** thực tế tại `data/processed/job_title_des.csv`.

Quy mô tập Ground-truth được đề xuất là **100 đến 150 cặp (CV, JD)**. Đây là quy mô phù hợp cho dự án đồ án 3 tháng của 2 sinh viên: vừa đảm bảo gán nhãn thủ công kỹ lưỡng, chính xác từng mẫu, vừa đủ ý nghĩa thống kê để kiểm định mô hình.

Cấu trúc phân bổ 100 mẫu như sau:

```text
Tập Ground-Truth (100 Cặp CV - JD)
├── 50 Cặp Tích cực (Positive Pairs - Label = 1): 50%
│   └── CV và JD cùng lĩnh vực kỹ thuật, thỏa mãn kỹ năng & thâm niên.
│
└── 50 Cặp Tiêu cực (Negative Pairs - Label = 0): 50%
    ├── 25 Cặp Easy Negatives (25%):
    │   └── Cặp khác biệt hoàn toàn (ví dụ: CV HR/Advocate ghép với JD Java Developer).
    │
    └── 25 Cặp Hard Negatives (25%):
        └── Cặp cùng ngành IT nhưng khác stack công nghệ hoặc lệch sâu trình độ
            (ví dụ: CV Python/Data Science ghép với JD Java Spring Boot; 
             hoặc CV Intern 6 tháng ghép với JD Senior Architect 8 năm).
```
> **Ý nghĩa của Hard Negatives**: Giúp bộc lộ rõ rệt sự khác biệt giữa các phương pháp. TF-IDF thường bị đánh lừa bởi các từ khóa chung chung (git, database, computer), trong khi Sentence-BERT và Hybrid Model sẽ nhận diện được sự khác biệt về ngữ nghĩa và điều kiện tiên quyết.

---

## 4. Định dạng lưu trữ tập Ground-truth (`data/ground_truth/`)
Tập Ground-truth sẽ được lưu trữ dưới tệp CSV chuẩn tại:  
`data/ground_truth/ground_truth_matching.csv`

### Cấu trúc các trường dữ liệu:
1. `pair_id`: Mã định danh cặp mẫu (VD: `PAIR_001`).
2. `cv_id`: ID hoặc chỉ số hàng của CV trong `UpdatedResumeDataSet.csv`.
3. `cv_category`: Lĩnh vực chuyên môn của CV (Java Developer, DotNet Developer, Data Science,...).
4. `job_id`: ID của tin tuyển dụng trong `job_title_des.csv`.
5. `job_title`: Chức danh công việc của JD (ví dụ: Flutter Developer, Backend .NET,...).
6. `ground_truth_label`: Nhãn nhị phân (`1`: Match, `0`: Mismatch).
7. `matched_core_skills`: Danh sách các kỹ năng cốt lõi trùng khớp (phân tách bởi dấu phẩy).
8. `missing_core_skills`: Danh sách kỹ năng bắt buộc mà ứng viên còn thiếu.
9. `experience_level`: Mức độ kinh nghiệm (`Junior`, `Mid`, `Senior`, `Lead`).
10. `relevance_score_expert`: Điểm chuyên gia đánh giá tham chiếu (thang 1 - 5 sao).
11. `notes`: Ghi chú lý do gán nhãn.

---

## 5. Phương pháp tính toán các chỉ số nghiên cứu (Evaluation Metrics)

Khi cho từng mô hình (TF-IDF, Sentence-BERT, Hybrid) dự đoán trên cùng tập Ground-truth với một ngưỡng phân định phù hợp $\theta$ (ví dụ: $\theta = 0.65$ hay $65\%$ Matching Score):
- Nếu $\text{Matching Score} \ge \theta \rightarrow \hat{y} = 1$ (Mô hình dự đoán Phù hợp).
- Nếu $\text{Matching Score} < \theta \rightarrow \hat{y} = 0$ (Mô hình dự đoán Không phù hợp).

Từ bảng ma trận nhầm lẫn (Confusion Matrix):
- **True Positive (TP)**: Mô hình đoán Match, Thực tế là Match ($y=1, \hat{y}=1$).
- **False Positive (FP)**: Mô hình đoán Match, nhưng Thực tế là Mismatch ($y=0, \hat{y}=1$).
- **True Negative (TN)**: Mô hình đoán Mismatch, Thực tế là Mismatch ($y=0, \hat{y}=0$).
- **False Negative (FN)**: Mô hình đoán Mismatch, nhưng Thực tế là Match ($y=1, \hat{y}=0$).

### Công thức tính toán:
1. **Precision (Độ chuẩn xác)**:
   $$\text{Precision} = \frac{TP}{TP + FP}$$
   *Ý nghĩa*: Trong số các ứng viên mà AI gợi ý cho nhà tuyển dụng là phù hợp, có bao nhiêu % thực sự đáp ứng yêu cầu công việc. Precision cao giúp nhà tuyển dụng không mất thời gian phỏng vấn nhầm người.

2. **Recall (Độ phủ / Độ nhạy)**:
   $$\text{Recall} = \frac{TP}{TP + FN}$$
   *Ý nghĩa*: Trong tổng số ứng viên tài năng thực sự phù hợp, AI đã tìm và phát hiện được bao nhiêu %. Recall cao giúp doanh nghiệp không bỏ sót nhân tài.

3. **F1-Score (Trung bình điều hòa giữa Precision và Recall)**:
   $$F_1 = 2 \times \frac{\text{Precision} \times \text{Recall}}{\text{Precision} + \text{Recall}}$$
   *Ý nghĩa*: Thước đo tổng hợp cốt lõi để so sánh hiệu năng tổng thể giữa 3 mô hình.

4. **Precision@K (với $K \in \{3, 5, 10\}$)**:
   $$\text{Precision@K} = \frac{\text{Số ứng viên thực sự phù hợp trong Top } K}{K}$$
   *Ý nghĩa*: Mô phỏng trực tiếp hành vi của Recruiter khi chỉ xem Top 5 hoặc Top 10 hồ sơ đứng đầu bảng xếp hạng.

5. **Processing Time (Thời gian xử lý / Độ trễ tính toán)**:
   Thời gian trung bình (tính bằng milliseconds) để trích xuất đặc trưng và tính toán điểm so khớp cho 1 cặp CV-JD. Giúp đánh giá tính khả thi khi triển khai hệ thống thời gian thực.

---

# PHẦN 2: GIAO ĐIỂM PHỐI HỢP — RÀ SOÁT DANH SÁCH TÍNH NĂNG (FUNCTIONAL REQUIREMENTS - FR)

Để đồng bộ giữa **Đặc tả Use Case của Người 1 (Backend)** và **Thiết kế UI / Module AI của Người 2 (Frontend & Research)**, danh mục tính năng được chuẩn hóa như sau:

| Mã FR | Tên tính năng chức năng | Mô tả chi tiết | Phân hệ (Role) | Phối hợp Người 1 & Người 2 |
| :--- | :--- | :--- | :---: | :--- |
| **FR_AUTH_01** | Xác thực & Phân quyền RBAC | Đăng nhập/Đăng ký với 3 vai trò độc lập: Candidate, Recruiter, Admin. Điều hướng đúng portal sau khi xác thực. | Chung | Người 1: JWT & Identity Auth API.<br>Người 2: Form UI, Role Switcher, Autofill demo. |
| **FR_CAND_01** | Tìm kiếm & Xem chi tiết JD | Tìm kiếm việc làm theo từ khóa, ngành nghề; xem yêu cầu kỹ năng và mô tả chi tiết công việc. | Candidate | Người 1: API Get Jobs, Filter.<br>Người 2: UI Danh sách việc làm & Drawer chi tiết. |
| **FR_CAND_02** | AI Pre-screening & Tải CV | Tải file CV (.pdf/.docx), hệ thống tự động bóc tách text và gửi đến AI tính điểm tương thích trước khi nộp. | Candidate | Người 1: Upload API, Lưu trữ file.<br>Người 2: Dropzone UI, Radar Gauge, API gọi AI. |
| **FR_CAND_03** | Báo cáo khoảng trống kỹ năng (Skill Gap) | Hiển thị danh sách kỹ năng ứng viên đã có khớp với JD và các kỹ năng còn thiếu cần bổ sung. | Candidate | Người 1: API trả về kết quả Matching.<br>Người 2: UI hiển thị Badge xanh/đỏ (Matched vs Missing). |
| **FR_CAND_04** | Nộp hồ sơ & Lịch sử ứng tuyển | Nộp đơn ứng tuyển cho công việc đã chọn kèm CV; theo dõi trạng thái hồ sơ (Pending/Shortlisted/Rejected). | Candidate | Người 1: API Applications CRUD.<br>Người 2: Tab lịch sử ứng tuyển & Timeline trạng thái. |
| **FR_REC_01** | Đăng tin tuyển dụng (Job Posting) | Tạo chiến dịch việc làm mới kèm danh mục kỹ năng chuẩn hóa (Skill Ontology) và số năm kinh nghiệm. | Recruiter | Người 1: API Create/Update Job.<br>Người 2: Modal đăng việc, Tag input kỹ năng. |
| **FR_REC_02** | Bảng xếp hạng ứng viên theo AI Match Score | Tự động xếp hạng danh sách ứng viên theo điểm tương thích giảm dần với thanh trạng thái màu (Xanh/Vàng/Đỏ). | Recruiter | Người 1: API Get Candidates by Job có sắp xếp.<br>Người 2: Table xếp hạng, Search, Filter theo điểm. |
| **FR_REC_03** | Explainable AI Modal | Modal phân rã điểm số 3 thành phần: Ngữ nghĩa (50%), Kỹ năng (35%), Kinh nghiệm (15%) và khuyến nghị phỏng vấn. | Recruiter | Người 1: DTO chi tiết kết quả Matching.<br>Người 2: Modal UI, Chart.js Radar phân rã, Export PDF. |
| **FR_REC_04** | Cập nhật trạng thái ứng viên & Xuất báo cáo | Thay đổi trạng thái hồ sơ (Mời phỏng vấn, Từ chối) và xuất danh sách ứng viên ra định dạng CSV. | Recruiter | Người 1: API Update Status, Export CSV API.<br>Người 2: Dropdown cập nhật nhanh, Client-side CSV download. |
| **FR_ADM_01** | Bảng theo dõi Benchmark mô hình AI | Hiển thị biểu đồ và bảng so sánh các chỉ số thực nghiệm của 3 mô hình (TF-IDF vs Sentence-BERT vs Hybrid). | Admin | Người 1: Lưu trữ thông số thí nghiệm trong DB.<br>Người 2: Biểu đồ trực quan Bar/Line Chart.js. |
| **FR_ADM_02** | Tinh chỉnh trọng số Hybrid Model | Cho phép Admin kéo thanh trượt điều chỉnh tỷ trọng giữa Semantic, Skill và Experience Matching. | Admin | Người 1: API lưu cấu hình trọng số hệ số Matching.<br>Người 2: UI Slider kiểm tra tổng $100\%$ theo thời gian thực. |
| **FR_ADM_03** | Quản lý người dùng & Duyệt việc làm | Khóa/Mở tài khoản; phê duyệt hoặc ẩn tin tuyển dụng vi phạm chính sách. | Admin | Người 1: API Manage Users/Jobs.<br>Người 2: Bảng quản trị & Modal thao tác. |
| **FR_AI_01** | Bóc tách & Tiền xử lý văn bản CV/JD | Đọc định dạng PDF/DOCX, loại bỏ stop words, chuẩn hóa font, lowercase và trích xuất token. | AI Engine | Người 1: Truyền file/path sang AI Service.<br>Người 2: Triển khai pipeline trích xuất văn bản (PyMuPDF/docx). |
| **FR_AI_02** | So khớp Baseline TF-IDF | Biểu diễn văn bản dưới dạng TF-IDF Vector và tính Cosine Similarity. | AI Engine | Người 2: Xây dựng pipeline Scikit-learn TfidfVectorizer. |
| **FR_AI_03** | So khớp Ngữ nghĩa Sentence-BERT | Tạo vector nhúng ngữ nghĩa (embeddings) bằng Sentence-Transformers và tính Cosine Similarity. | AI Engine | Người 2: Tải mô hình `all-MiniLM-L6-v2` / HuggingFace. |
| **FR_AI_04** | So khớp Đa tầng Hybrid Model | Kết hợp điểm Ngữ nghĩa, Tỷ lệ trùng khớp Kỹ năng (Jaccard / Overlap) và Sai lệch Kinh nghiệm thành một điểm số chuẩn hóa duy nhất. | AI Engine | Người 2: Thiết kế công thức trọng số và kiểm thử. |

---

## KẾT LUẬN & KẾ HOẠCH BÀN GIAO CHO NGÀY 3
- Đã hoàn thành toàn bộ phần nghiên cứu phương pháp luận gán nhãn Ground-truth và công thức tính toán chỉ số khoa học cho Ngày 2.
- Đã rà soát và khớp 100% danh mục tính năng với Use Case và bản thiết kế giao diện.
- **Kế hoạch Ngày 3**:
  - Người 2 sẽ viết chi tiết các câu hỏi nghiên cứu (**Research Questions - RQ**).
  - Khởi tạo danh mục từ khóa kỹ năng chuẩn hóa (**Skill Taxonomy**).
  - Thống nhất cấu trúc bảng dữ liệu `MATCHING_RESULTS` và `SKILLS` với Người 1.
