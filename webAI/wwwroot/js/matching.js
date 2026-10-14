(() => {
    'use strict';

    const errorMessages = {
        400: 'Dữ liệu gửi lên chưa hợp lệ. Kiểm tra CV và yêu cầu công việc.',
        413: 'Tệp quá lớn. Mỗi CV được phép tối đa 10 MiB.',
        415: 'Định dạng không được hỗ trợ. Hãy chọn PDF hoặc DOCX.',
        422: 'Không thể phân tích nội dung này. Kiểm tra tệp có văn bản đọc được và các yêu cầu đã nhập.',
        503: 'Dịch vụ AI chưa sẵn sàng hoặc đang bận. Vui lòng thử lại.',
        504: 'AI phản hồi quá thời gian chờ. Vui lòng thử lại.',
        500: 'Máy chủ gặp lỗi khi phân tích. Vui lòng thử lại sau.'
    };

    async function request(url, options = {}, timeout = 75000) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal, cache: 'no-store' });
            if (!response.ok) throw new Error(errorMessages[response.status] || `Yêu cầu thất bại (HTTP ${response.status}).`);
            try { return await response.json(); }
            catch { throw new Error('Máy chủ trả về dữ liệu không hợp lệ. Vui lòng thử lại.'); }
        } catch (error) {
            if (error.name === 'AbortError') throw new Error('Đã hết thời gian chờ phản hồi. Vui lòng thử lại.');
            if (error instanceof TypeError) throw new Error('Không thể kết nối máy chủ. Kiểm tra kết nối và thử lại.');
            throw error;
        } finally { clearTimeout(timer); }
    }

    function validateResult(data) {
        const score = data?.overall_score;
        if (data?.success !== true || !['Hybrid', 'Sentence-BERT', 'TF-IDF'].includes(data.model_used)
            || !(score === null || (typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 100))
            || !['computed', 'incomplete'].includes(data.status)
            || (data.status === 'incomplete' && score !== null)
            || (data.status === 'computed' && score === null)) {
            throw new Error('Kết quả matching không đúng định dạng. Không thể hiển thị điểm.');
        }
        return data;
    }

    const api = {
        health: () => request('/api/matching/health', {}, 8000),
        matchText: async payload => validateResult(await request('/api/matching/analyze', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        })),
        matchFile: async (file, payload) => {
            const body = new FormData();
            body.append('file', file);
            body.append('request_json', JSON.stringify(payload));
            return validateResult(await request('/api/matching/analyze-file', { method: 'POST', body }));
        }
    };
    window.RecruitAI = { api };

    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }
    const scoreText = value => typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)}%` : 'Chưa có dữ liệu';

    async function checkHealth(status, button) {
        button.disabled = true;
        status.dataset.state = 'checking';
        status.textContent = 'Đang kiểm tra kết nối…';
        try {
            const data = await api.health();
            if (data.ai_service_connected !== true) throw new Error('AI chưa sẵn sàng.');
            status.dataset.state = 'ready';
            status.textContent = 'AI sẵn sàng';
        } catch {
            status.dataset.state = 'offline';
            status.textContent = 'AI chưa kết nối · thử lại';
        } finally { button.disabled = false; }
    }

    function details(title, parent) {
        const node = element('details');
        node.append(element('summary', '', title));
        parent.append(node);
        return node;
    }

    function renderSkills(parent, skills) {
        const rows = skills?.requirements;
        if (!Array.isArray(rows)) return;
        const section = details('Kỹ năng và bằng chứng trong CV', parent);
        if (!rows.length) section.append(element('p', 'text-secondary mt-2 mb-0', 'Chưa nhập yêu cầu kỹ năng; chưa có điểm kỹ năng.'));
        const statuses = {
            matched: ['Đã đề cập', 'bg-success-subtle text-success'],
            not_found: ['Chưa tìm thấy', 'bg-secondary-subtle text-secondary'],
            needs_review: ['Cần rà soát', 'bg-warning-subtle text-warning-emphasis']
        };
        for (const row of rows) {
            const item = element('div', 'evidence-item');
            const heading = element('div', 'd-flex justify-content-between align-items-center gap-2');
            heading.append(element('strong', '', row.requirement || row.normalized || 'Kỹ năng'));
            const [label, style] = statuses[row.status] || ['Chưa xác định', 'bg-secondary-subtle text-secondary'];
            heading.append(element('span', `badge ${style}`, label));
            item.append(heading, element('small', 'text-secondary', row.group === 'required' ? 'Yêu cầu bắt buộc' : 'Yêu cầu ưu tiên'));
            for (const evidence of row.evidence || []) {
                item.append(element('blockquote', '', evidence.context || evidence.matched_text || evidence.alias || ''));
                item.append(element('small', 'text-secondary', `Vị trí: ${evidence.location || 'Chưa xác định'}`));
            }
            section.append(item);
        }
        section.append(element('p', 'small text-secondary mt-3 mb-0', '“Chưa tìm thấy” không có nghĩa ứng viên thiếu kỹ năng. “Đã đề cập” chưa chứng minh mức độ thành thạo.'));
    }

    function renderExperience(parent, explanation) {
        const experience = explanation?.experience;
        if (!experience) return;
        const section = details('Thông tin kinh nghiệm', parent);
        const statuses = { explicit: 'Có số năm ghi rõ', unknown: 'Chưa tìm được số năm ghi rõ', conflicting: 'Có thông tin mâu thuẫn', no_requirement: 'Chưa có yêu cầu số năm' };
        section.append(element('p', 'mt-2 mb-1', statuses[experience.status] || 'Cần kiểm tra thông tin kinh nghiệm'));
        const years = value => typeof value === 'number' ? `${value} năm` : 'Chưa xác định';
        section.append(element('p', 'text-secondary mb-2', `CV: ${years(experience.candidate_years)} · JD: ${years(experience.required_years)}`));
        for (const evidence of explanation.experience_evidence?.evidence || []) {
            section.append(element('blockquote', 'evidence-item', `${evidence.matched_text} (${evidence.location})`));
        }
        section.append(element('p', 'small text-secondary mb-0', 'Số năm do CV tự khai chưa được xác minh, và tổng số năm chưa chứng minh kinh nghiệm phù hợp với vị trí.'));
    }

    function renderSemantic(parent, data) {
        const detail = data.model_used === 'Hybrid' ? data.explanation?.semantic : data.explanation;
        if (!detail) return;
        const section = details(data.model_used === 'TF-IDF' ? 'Từ khóa đóng góp vào độ tương đồng' : 'Thông tin so khớp ngữ nghĩa', parent);
        if (Array.isArray(detail.features)) {
            const tableWrap = element('div', 'table-responsive mt-2');
            const table = element('table', 'table align-middle');
            const head = element('thead');
            const header = element('tr');
            ['Từ khóa', 'Trọng số CV', 'Trọng số JD', 'Đóng góp cosine'].forEach(label => header.append(element('th', '', label)));
            head.append(header);
            const body = element('tbody');
            detail.features.filter(row => row.cosine_contribution > 0).slice(0, 10).forEach(row => {
                const tr = element('tr');
                tr.append(element('td', '', row.feature));
                ['cv_weight', 'jd_weight', 'cosine_contribution'].forEach(key => tr.append(element('td', '', Number(row[key]).toFixed(4))));
                body.append(tr);
            });
            table.append(head, body);
            tableWrap.append(table);
            section.append(tableWrap);
            if (!body.childElementCount) section.append(element('p', 'text-secondary', 'Không có từ khóa chung đóng góp vào điểm.'));
            section.append(element('p', 'text-secondary mb-0', 'Hiển thị tối đa 10 từ khóa đóng góp lớn nhất. TF-IDF đo tương đồng từ vựng.'));
        } else {
            section.append(element('p', 'mt-2 mb-1', `CV: ${detail.cv_chunks?.length || 0} đoạn · JD: ${detail.jd_chunks?.length || 0} đoạn`));
            if (typeof detail.cosine_similarity === 'number') section.append(element('p', 'mb-1', `Cosine similarity: ${detail.cosine_similarity.toFixed(4)}`));
            section.append(element('p', 'text-secondary mb-0', 'Văn bản dài được chia đoạn và tổng hợp embedding. Tương đồng ngữ nghĩa chưa chứng minh kỹ năng hay mức độ phù hợp thực tế.'));
        }
    }

    function resultCard(entry, index) {
        const card = element('article', 'surface-card result-card');
        if (entry.error) {
            card.append(element('h3', 'h6', entry.name), element('div', 'alert alert-danger mb-0', entry.error));
            return card;
        }
        const data = entry.data;
        const explanation = data.explanation || {};
        const incomplete = data.overall_score === null;
        const summary = element('div', 'result-summary');
        const info = element('div');
        info.append(element('h3', 'mb-2', entry.name));
        const badges = element('div', 'd-flex flex-wrap gap-2');
        badges.append(element('span', 'badge bg-primary-subtle text-primary', data.model_used),
            element('span', incomplete ? 'badge bg-warning-subtle text-warning-emphasis' : 'badge bg-success-subtle text-success', incomplete ? 'Chưa đủ dữ liệu' : 'Đã phân tích'));
        if (typeof data.processing_time_ms === 'number') badges.append(element('span', 'badge bg-light text-secondary', `${Math.round(data.processing_time_ms)} ms`));
        info.append(badges);
        const ring = element('div', 'score-ring');
        ring.style.setProperty('--score', incomplete ? 0 : data.overall_score);
        ring.setAttribute('aria-label', incomplete ? 'Chưa đủ dữ liệu để chấm tổng' : `Điểm so khớp ${scoreText(data.overall_score)}`);
        const center = element('div');
        center.append(element('strong', '', incomplete ? '—' : scoreText(data.overall_score)), element('small', '', 'ĐIỂM SO KHỚP'));
        ring.append(center);
        summary.append(info, ring);
        card.append(summary);
        if (incomplete) {
            const labels = { semantic: 'ngữ nghĩa', skills: 'kỹ năng', experience: 'kinh nghiệm' };
            const missing = (explanation.missing_components || []).map(key => labels[key] || key).join(', ');
            card.append(element('p', 'small text-warning-emphasis mt-3 mb-0', `Chưa có điểm tổng${missing ? ` vì thiếu dữ liệu ${missing}` : ''}. Các điểm thành phần có sẵn được hiển thị bên dưới.`));
        }
        const components = element('div', 'score-components');
        const weights = explanation.normalized_weights;
        const definitions = [
            ['semantic_score', data.model_used === 'TF-IDF' ? 'Tương đồng từ vựng' : 'Tương đồng ngữ nghĩa', 'semantic'],
            ['skill_score', 'Kỹ năng', 'skills'], ['experience_score', 'Kinh nghiệm', 'experience']
        ];
        for (const [key, label, weightKey] of definitions) {
            if (data.model_used !== 'Hybrid' && key !== 'semantic_score') continue;
            const component = element('div', 'score-component');
            const value = data.breakdown?.[key];
            component.append(element('small', '', `${label}${typeof weights?.[weightKey] === 'number' ? ` · ${(weights[weightKey] * 100).toFixed(0)}%` : ''}`));
            component.append(element('strong', '', scoreText(value)));
            if (typeof value === 'number' && Number.isFinite(value)) {
                const progress = element('div', 'progress');
                progress.setAttribute('role', 'progressbar');
                progress.setAttribute('aria-label', label);
                progress.setAttribute('aria-valuenow', value);
                progress.setAttribute('aria-valuemin', 0);
                progress.setAttribute('aria-valuemax', 100);
                const bar = element('div', 'progress-bar');
                bar.style.width = `${Math.max(0, Math.min(100, value))}%`;
                progress.append(bar);
                component.append(progress);
            }
            components.append(component);
        }
        card.append(components);
        renderSkills(card, explanation.skills);
        renderExperience(card, explanation);
        renderSemantic(card, data);
        if (data.document) {
            const source = details('Văn bản trích xuất từ tệp', card);
            source.append(element('p', 'text-secondary mt-2', `Trình đọc: ${data.document.parser?.name || 'Chưa xác định'} · ${data.document.size_bytes || 0} bytes`));
            source.append(element('pre', '', data.document.raw_text || ''));
            for (const warning of data.document.warnings || []) source.append(element('p', 'small text-secondary', warning));
        }
        const download = element('button', 'btn btn-sm btn-outline-secondary mt-3', 'Tải kết quả JSON');
        download.type = 'button';
        download.addEventListener('click', () => {
            const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
            const link = element('a');
            link.href = url;
            link.download = `matching-result-${index + 1}.json`;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        });
        card.append(download);
        return card;
    }

    function initWorkspace(root) {
        const $ = id => root.querySelector(`#${id}`);
        const recruiter = root.dataset.matchingWorkspace === 'recruiter';
        let files = [];
        let busy = false;
        const showStep = id => window.bootstrap.Tab.getOrCreateInstance($(id)).show();
        $('nextCvStep').addEventListener('click', () => showStep('cvStepTab'));
        if (recruiter) {
            $('workspaceTitle').textContent = 'Đối chiếu hồ sơ, xem rõ bằng chứng.';
            $('workspaceIntro').textContent = 'Phân tích các CV thực tế với cùng một JD. Kết quả giúp bạn rà soát từng hồ sơ trước khi đánh giá.';
            $('cvIntro').textContent = 'Chọn tối đa 10 CV để phân tích lần lượt, hoặc dán nội dung một CV.';
            $('cvFiles').multiple = true;
            $('dropzoneTitle').textContent = 'Chọn hoặc kéo thả các CV vào đây';
        }
        const showError = message => { $('requestError').textContent = message; $('requestError').hidden = !message; };
        function clearResults() {
            $('resultCards').replaceChildren();
            $('resultsSection').hidden = true;
            $('emptyResults').hidden = false;
            $('requestProgress').hidden = true;
            $('requestActivity').hidden = true;
            showError('');
        }
        function renderFiles() {
            $('selectedFiles').replaceChildren();
            files.forEach((file, index) => {
                const li = element('li');
                const description = element('div', 'file-name');
                const extension = file.name.split('.').pop().toUpperCase();
                const thumbnail = element('span', 'file-thumbnail');
                const icon = element('i', extension === 'PDF' ? 'bi bi-file-earmark-pdf' : 'bi bi-file-earmark-word');
                icon.setAttribute('aria-hidden', 'true');
                thumbnail.append(icon);
                description.append(element('strong', '', file.name), element('div', 'small text-secondary', `${extension} · ${(file.size / 1024).toFixed(0)} KiB · Sẵn sàng phân tích`));
                const remove = element('button', 'btn btn-sm btn-outline-secondary', 'Bỏ');
                remove.type = 'button';
                remove.setAttribute('aria-label', `Bỏ tệp ${file.name}`);
                remove.addEventListener('click', () => {
                    if (busy) return;
                    files.splice(index, 1);
                    $('cvFiles').value = '';
                    clearResults();
                    renderFiles();
                });
                li.append(thumbnail, description, remove);
                $('selectedFiles').append(li);
            });
        }
        function selectFiles(list) {
            if (busy) return;
            const selected = Array.from(list);
            clearResults();
            let error = '';
            if (selected.length > (recruiter ? 10 : 1)) error = recruiter ? 'Mỗi lần phân tích tối đa 10 CV.' : 'Vui lòng chọn một CV.';
            else if (selected.some(file => !/\.(pdf|docx)$/i.test(file.name))) error = 'Chỉ hỗ trợ tệp PDF hoặc DOCX.';
            else if (selected.some(file => file.size === 0 || file.size > 10 * 1024 * 1024)) error = 'Tệp phải có nội dung và không vượt quá 10 MiB.';
            files = error ? [] : selected;
            if (error) $('cvFiles').value = '';
            renderFiles();
            showError(error);
        }
        $('cvFiles').addEventListener('change', event => selectFiles(event.target.files));
        $('dropzone').addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (!busy) $('cvFiles').click(); }
        });
        for (const type of ['dragenter', 'dragover']) $('dropzone').addEventListener(type, event => {
            event.preventDefault();
            if (!busy) $('dropzone').classList.add('is-dragging');
        });
        for (const type of ['dragleave', 'drop']) $('dropzone').addEventListener(type, event => {
            event.preventDefault();
            $('dropzone').classList.remove('is-dragging');
            if (type === 'drop' && !busy) selectFiles(event.dataTransfer.files);
        });
        const refreshHealth = () => checkHealth($('connectionStatus'), $('checkConnection'));
        $('checkConnection').addEventListener('click', refreshHealth);
        refreshHealth();
        root.querySelectorAll('[name="cvMode"]').forEach(radio => radio.addEventListener('change', () => {
            $('filePanel').hidden = radio.value !== 'file';
            $('textPanel').hidden = radio.value !== 'text';
            clearResults();
        }));
        const hints = {
            Hybrid: 'Hybrid: ngữ nghĩa 50%, kỹ năng 30%, kinh nghiệm 20%. Đây là trọng số khởi đầu, chưa được tối ưu bằng thực nghiệm. Thiếu thành phần có trọng số sẽ chưa có điểm tổng.',
            'Sentence-BERT': 'Sentence-BERT đo tương đồng ngữ nghĩa giữa CV và JD. Phương pháp này không chấm riêng kỹ năng và kinh nghiệm.',
            'TF-IDF': 'TF-IDF đo tương đồng từ vựng trên bộ từ vựng phát triển đã cố định. Từ mới ngoài bộ từ vựng có thể chưa được biểu diễn.'
        };
        $('modelType').addEventListener('change', () => {
            $('methodNote').textContent = hints[$('modelType').value];
            $('modelWeights').hidden = $('modelType').value !== 'Hybrid';
        });
        $('matchingForm').addEventListener('input', event => {
            if (busy) return;
            event.target.classList.remove('is-invalid');
            clearResults();
        });
        $('matchingForm').addEventListener('change', event => { if (!busy && event.target.id !== 'cvFiles') clearResults(); });

        function skillNames(input) {
            const values = [...new Set(input.value.split(/[,\n]/).map(value => value.trim()).filter(Boolean))];
            if (values.length > 100 || values.some(value => value.length > 200)) throw new Error('Mỗi nhóm tối đa 100 kỹ năng; mỗi tên tối đa 200 ký tự.');
            return values;
        }
        $('matchingForm').addEventListener('submit', async event => {
            event.preventDefault();
            if (busy) return;
            showError('');
            if (!$('jobDescription').value.trim()) {
                showStep('jobStepTab');
                $('jobDescription').classList.add('is-invalid');
                $('jobDescription').focus();
                return;
            }
            if (!$('requiredYears').checkValidity()) {
                showStep('jobStepTab');
                $('requiredYears').classList.add('is-invalid');
                $('requiredYears').focus();
                return;
            }
            const mode = root.querySelector('[name="cvMode"]:checked').value;
            if (mode === 'file' && !files.length) { showStep('cvStepTab'); showError('Vui lòng chọn CV để phân tích.'); return; }
            if (mode === 'text' && !$('cvText').value.trim()) { showStep('cvStepTab'); showError('Vui lòng dán nội dung CV.'); $('cvText').focus(); return; }
            let payload;
            try {
                payload = {
                    job_title: $('jobTitle').value.trim(), job_description: $('jobDescription').value.trim(),
                    required_skills: skillNames($('requiredSkills')), nice_to_have_skills: skillNames($('optionalSkills')),
                    job_experience_years_required: $('requiredYears').value === '' ? null : Number($('requiredYears').value),
                    model_type: $('modelType').value,
                    weights: { semantic_weight: .5, skill_weight: .3, experience_weight: .2 }
                };
            } catch (error) { showError(error.message); return; }
            clearResults();
            busy = true;
            $('matchingFields').disabled = true;
            $('dropzone').setAttribute('aria-disabled', 'true');
            $('matchingForm').setAttribute('aria-busy', 'true');
            $('analyzeButton').textContent = 'Đang phân tích…';
            $('requestProgress').hidden = false;
            $('requestActivity').hidden = false;
            const inputs = mode === 'file' ? [...files] : [{ name: 'CV từ văn bản', text: $('cvText').value.trim() }];
            const entries = [];
            const renderResults = () => {
                const successful = entries.filter(entry => entry.data).length;
                $('emptyResults').hidden = true;
                $('resultsSection').hidden = false;
                $('resultsCount').textContent = `${successful}/${inputs.length} hồ sơ đã phân tích`;
                $('resultsContext').textContent = `${payload.job_title || 'JD đã nhập'} · ${payload.model_type} · Thứ tự tệp đã chọn`;
                $('resultCards').replaceChildren(...entries.map(resultCard));
            };
            try {
                // One request at a time: the Python engine deliberately rejects concurrent inference.
                for (const [index, input] of inputs.entries()) {
                    $('requestProgress').textContent = `Đang phân tích ${index + 1}/${inputs.length}: ${input.name}`;
                    try {
                        const data = mode === 'file' ? await api.matchFile(input, payload) : await api.matchText({ ...payload, cv_text: input.text });
                        entries.push({ name: input.name, data });
                    } catch (error) { entries.push({ name: input.name, error: error.message }); }
                    renderResults();
                }
                const failed = entries.filter(entry => entry.error).length;
                $('requestProgress').textContent = failed ? `Đã xử lý ${inputs.length} hồ sơ; ${failed} hồ sơ lỗi. Xem thông báo ở từng hồ sơ và thử lại.` : `Đã phân tích ${inputs.length} hồ sơ. Xem kết quả và bằng chứng bên cạnh.`;
                $('resultsSection').scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
            } finally {
                busy = false;
                $('requestActivity').hidden = true;
                $('matchingFields').disabled = false;
                $('dropzone').removeAttribute('aria-disabled');
                $('matchingForm').removeAttribute('aria-busy');
                $('analyzeButton').textContent = 'Phân tích lại hồ sơ';
            }
        });
    }

    async function mountWorkspace(root) {
        try {
            const response = await fetch('/partials/matching-workspace.html');
            if (!response.ok) throw new Error('Không tải được giao diện phân tích.');
            root.innerHTML = await response.text(); // Same-origin application template; user/API content uses textContent.
            initWorkspace(root);
        } catch {
            root.replaceChildren(element('div', 'alert alert-danger', 'Không tải được giao diện. Hãy mở trang qua máy chủ ASP.NET và tải lại.'));
        }
    }
    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('[data-matching-workspace]').forEach(mountWorkspace);
        const status = document.getElementById('serviceStatus');
        const button = document.getElementById('refreshService');
        if (status && button) {
            const refresh = () => checkHealth(status, button);
            button.addEventListener('click', refresh);
            refresh();
        }
    });
})();
