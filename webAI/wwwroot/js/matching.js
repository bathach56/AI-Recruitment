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
            if (!response.ok) {
                const error = new Error(errorMessages[response.status] || `Yêu cầu thất bại (HTTP ${response.status}).`);
                error.httpStatus = response.status;
                throw error;
            }
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
    let reviewToken = null;
    async function reviewRequest(url,options={}) {
        if(options.method && options.method!=='GET') {
            reviewToken=(await request('/api/account/session')).token;
            options={...options,headers:{...options.headers,'X-CSRF-TOKEN':reviewToken}};
        }
        const response=await fetch(url,{...options,cache:'no-store'});
        const data=await response.json().catch(()=>null);
        if(!response.ok)throw new Error(data?.message || (response.status===401?'Phiên đăng nhập đã hết hạn. Đăng nhập lại để tiếp tục.':response.status===413?'Đợt tải lên quá lớn. Giảm số tệp và thử lại.':'Không xử lý được yêu cầu. Kiểm tra dữ liệu và thử lại.'));
        return data;
    }

    const batch = {
        mergeFiles(current, incoming, limit = 50) {
            const files = [...current];
            for (const file of incoming) {
                if (!/\.(pdf|docx)$/i.test(file.name) || file.size <= 0 || file.size > 10 * 1024 * 1024)
                    throw new Error('Chọn CV PDF hoặc DOCX có nội dung, tối đa 10 MiB mỗi tệp. Danh sách cũ vẫn được giữ.');
                if (!files.some(f => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified)) files.push(file);
            }
            if (files.length > limit) throw new Error(`Mỗi đợt tối đa ${limit} CV. Hãy chia thành các đợt nhỏ hơn.`);
            if (files.reduce((sum, f) => sum + f.size, 0) > 100 * 1024 * 1024) throw new Error('Tổng tệp mỗi đợt tối đa 100 MiB. Danh sách cũ vẫn được giữ.');
            return files;
        },
        sorted(entries, order = 'score') {
            const score = entry => typeof entry.data?.overall_score === 'number' ? entry.data.overall_score : -1;
            return [...entries].sort((a, b) => order === 'name' ? a.name.localeCompare(b.name, 'vi')
                : order === 'original' ? a.index - b.index : score(b) - score(a) || a.index - b.index);
        },
        async run(entries, process, update, stopped) {
            for (const entry of entries) {
                if (entry.state !== 'queued') continue;
                if (stopped()) { entry.state = 'stopped'; update(); continue; }
                entry.state = 'running'; delete entry.error; update();
                try { entry.data = await process(entry); entry.state = 'complete'; }
                catch (error) { delete entry.data; entry.error = error.message; entry.state = 'error'; }
                update();
            }
        }
    };
    window.RecruitAI.batch = batch;

    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }
    const scoreText = value => typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)}%` : 'Chưa có dữ liệu';

    async function checkHealth(status, button) {
        const started = performance.now();
        let reachable = false;
        let connected = false;
        button.disabled = true;
        status.dataset.state = 'checking';
        status.textContent = 'Đang kiểm tra kết nối…';
        try {
            const data = await api.health();
            reachable = true;
            if (data.ai_service_connected !== true) throw new Error('AI chưa sẵn sàng.');
            connected = true;
            status.dataset.state = 'ready';
            status.textContent = 'AI sẵn sàng';
        } catch (error) {
            reachable = reachable || Boolean(error.httpStatus);
            status.dataset.state = 'offline';
            status.textContent = 'AI chưa kết nối · thử lại';
        } finally {
            button.disabled = false;
            document.dispatchEvent(new CustomEvent('recruitai:health', { detail: {
                source: status.id, reachable, connected, elapsed: performance.now() - started
            } }));
        }
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
        const section = details('Yêu cầu công việc và bằng chứng CV', parent);
        section.open = true;
        if (!rows.length) {
            section.append(element('p', 'text-secondary mt-3 mb-0', 'Chưa nhập yêu cầu kỹ năng; chưa có điểm kỹ năng.'));
            return;
        }
        const table = element('table', 'evidence-table');
        const caption = element('caption', 'visually-hidden', 'Đối chiếu từng yêu cầu kỹ năng với bằng chứng trong CV');
        const head = element('thead');
        const heading = element('tr');
        ['Yêu cầu', 'Bằng chứng trong CV', 'Trạng thái'].forEach(label => {
            const th = element('th', '', label);
            th.scope = 'col';
            heading.append(th);
        });
        head.append(heading);
        const body = element('tbody');
        const statuses = { matched: 'Đã đề cập', not_found: 'Chưa tìm thấy', needs_review: 'Cần rà soát' };
        for (const row of rows) {
            const tr = element('tr');
            const requirement = element('td');
            requirement.dataset.label = 'Yêu cầu';
            requirement.append(element('strong', '', row.requirement || row.normalized || 'Kỹ năng'),
                element('small', '', row.group === 'required' ? 'Bắt buộc' : 'Ưu tiên'));
            const evidenceCell = element('td');
            evidenceCell.dataset.label = 'Bằng chứng trong CV';
            for (const evidence of row.evidence || []) {
                evidenceCell.append(element('blockquote', '', evidence.context || evidence.matched_text || ''),
                    element('small', '', `Vị trí: ${evidence.location || 'Chưa xác định'}`));
            }
            if (!evidenceCell.childElementCount) evidenceCell.append(element('span', 'text-secondary', 'Chưa có đoạn trích tương ứng.'));
            const status = element('td');
            status.dataset.label = 'Trạng thái';
            const statusClass = Object.hasOwn(statuses, row.status) ? `status-${row.status}` : '';
            status.append(element('span', `evidence-status ${statusClass}`, statuses[row.status] || 'Chưa xác định'));
            tr.append(requirement, evidenceCell, status);
            body.append(tr);
        }
        table.append(caption, head, body);
        section.append(table, element('p', 'small text-secondary mt-3 mb-0',
            '“Đã đề cập” chưa chứng minh mức độ thành thạo. “Chưa tìm thấy” cần được kiểm tra lại với ứng viên.'));
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
        const review = entry.data?.overall_score === null || entry.data?.explanation?.skills?.requirements?.some(row => row.status === 'needs_review' || row.status === 'not_found');
        card.dataset.resultState = entry.error ? 'error' : review ? 'review' : 'computed';
        card.dataset.computed = String(Boolean(entry.data));
        if (entry.error) {
            card.append(element('h3', 'h6', entry.name), element('div', 'alert alert-danger mb-0', entry.error));
            return card;
        }
        const data = entry.data;
        const explanation = data.explanation || {};
        const incomplete = data.overall_score === null;
        const summary = element('div', 'result-summary');
        const info = element('div');
        const avatar = element('span', 'result-avatar');
        const avatarIcon = element('i', 'bi bi-person');
        avatarIcon.setAttribute('aria-hidden', 'true');
        avatar.append(avatarIcon);
        info.append(avatar);
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
        center.append(element('strong', '', incomplete ? '—' : scoreText(data.overall_score)), element('small', '', 'Điểm đối chiếu'));
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
        const requirements = explanation.skills?.requirements;
        if (Array.isArray(requirements) && requirements.length) {
            const chips = element('div', 'skill-chip-row');
            requirements.slice(0, 12).forEach(row => {
                const chip = element('span', `skill-chip ${row.status === 'matched' ? 'matched' : row.status === 'not_found' ? 'not_found' : ''}`, `${row.requirement || row.normalized || 'Kỹ năng'} · ${row.status === 'matched' ? 'Đã đề cập' : row.status === 'not_found' ? 'Chưa thấy' : 'Rà soát'}`);
                chips.append(chip);
            });
            card.append(chips);
        }
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
        const selectedFiles = new Set(), selectedApplications = new Set(), selectedExcel = new Set();
        let applications=[], excelRows=[], reviewId=null, postedJobs=[], applicationRequestVersion=0;
        let busy = false;
        let activeFilter = 'all';
        let batchEntries = [], batchPayload = null, batchMode = 'file', stopRequested = false, selectedEntry = null, batchStale = false, displayedData = null;
        const states = { queued: 'Chờ phân tích', running: 'Đang phân tích', complete: 'Đã phân tích', error: 'Lỗi', stopped: 'Chưa xử lý' };
        function renderBatch() {
            if (!$('batchPanel')) return;
            $('batchPanel').hidden = !batchEntries.length;
            const complete = batchEntries.filter(e => e.state === 'complete').length;
            const errors = batchEntries.filter(e => e.state === 'error').length;
            const done = complete + errors;
            $('batchProgress').value = done;
            $('batchProgress').max = Math.max(batchEntries.length, 1);
            $('batchSummary').textContent = `${complete} đã phân tích · ${errors} lỗi · ${batchEntries.length - done} chưa hoàn tất`;
            $('batchCancel').hidden = !busy;
            $('batchCancel').disabled = stopRequested;
            $('batchCancel').textContent = stopRequested ? 'Đang chờ CV hiện tại hoàn tất…' : 'Dừng sau CV hiện tại';
            $('batchRetry').disabled = busy || batchStale || !batchEntries.some(e => ['error','stopped'].includes(e.state));
            $('batchDownload').disabled = busy;
            const query = $('batchSearch').value.trim().toLocaleLowerCase('vi');
            const filter = $('batchState').value;
            const entries = batch.sorted(batchEntries, $('batchSort').value).filter(e => (!query || e.name.toLocaleLowerCase('vi').includes(query)) && (filter === 'all' || e.state === filter));
            $('batchRows').replaceChildren();
            for (const entry of entries) {
                const row = element('tr');
                if (entry.index === selectedEntry) row.className = 'batch-selected';
                const name = element('td'); name.append(element('strong','',entry.name),element('small','',`CV ${entry.index + 1}`));
                const status = element('td'); status.append(element('span',`batch-state batch-${entry.state}`,entry.state === 'complete' && entry.data.overall_score === null ? 'Thiếu dữ liệu tính tổng' : states[entry.state]));
                if(entry.error) status.append(element('small','',entry.error));
                const hybrid = entry.data?.model_used === 'Hybrid';
                const values = [entry.data?.overall_score, entry.data?.breakdown?.semantic_score, hybrid ? entry.data?.breakdown?.skill_score : null, hybrid ? entry.data?.breakdown?.experience_score : null];
                const cells = values.map(value => element('td','batch-score',typeof value === 'number' ? `${value.toFixed(1)}%` : '—'));
                const action = element('td');
                const view = element('button','btn btn-sm btn-outline-secondary','Xem bằng chứng');view.type = 'button'; view.disabled = !entry.data;
                view.addEventListener('click',()=>{selectedEntry=entry.index;renderBatch();$('resultCards').scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})});
                action.append(view);row.append(name,status,...cells,action);$('batchRows').append(row);
            }
            $('batchNoMatches').hidden = entries.length > 0;
            if (selectedEntry === null) selectedEntry = batchEntries.find(e=>e.data)?.index ?? null;
            const selected = batchEntries.find(e=>e.index===selectedEntry && e.data);
            if(selected && displayedData !== selected.data){$('resultCards').replaceChildren(resultCard(selected,selected.index));displayedData=selected.data}
            $('resultsCount').textContent = `${complete}/${batchEntries.length} hồ sơ đã phân tích`;
            $('resultsContext').textContent = `${batchPayload?.job_title || 'JD đã nhập'} · ${batchPayload?.model_type || ''} · Cùng một JD cho cả đợt`;
        }
        async function runBatch() {
            busy = true; stopRequested = false;
            $('matchingFields').disabled = true;$('matchingForm').setAttribute('aria-busy','true');
            $('dropzone').setAttribute('aria-disabled','true');
            $('analyzeButton').textContent = 'Đang xử lý nhóm CV…';
            $('requestProgress').hidden = false;$('requestActivity').hidden = false;
            $('emptyResults').hidden = true;$('resultsSection').hidden = false;
            try {
                await batch.run(batchEntries, async entry => {
                    $('requestProgress').textContent = `Đang phân tích CV ${entry.index + 1}/${batchEntries.length}: ${entry.name}`;
                    const row=await reviewRequest(`/api/recruiter/reviews/${reviewId}/items/${entry.remoteId}/analyze`,{method:'POST'});
                    if(row.state==='Error')throw new Error(row.error);
                    return validateResult(row.result);
                }, renderBatch, ()=>stopRequested);
                $('requestProgress').textContent = stopRequested ? 'Đã dừng đợt. Các kết quả hoàn tất được giữ lại; bạn có thể chạy tiếp phần chưa xử lý.' : 'Đã xử lý xong đợt. Sắp xếp bảng để ưu tiên đọc, sau đó mở bằng chứng của hồ sơ cần xem.';
            } finally {
                busy=false;$('matchingFields').disabled=false;$('matchingForm').removeAttribute('aria-busy');$('dropzone').removeAttribute('aria-disabled');
                $('requestActivity').hidden=true;$('analyzeButton').textContent='Phân tích đợt mới';renderBatch();
            }
        }
        if ($('batchPanel')) {
            ['batchSearch','batchSort','batchState'].forEach(id=>$(id).addEventListener(id==='batchSearch'?'input':'change',renderBatch));
            $('batchCancel').addEventListener('click',()=>{stopRequested=true;renderBatch()});
            $('batchRetry').addEventListener('click',()=>{
                if(busy||batchStale)return;
                batchEntries.forEach(e=>{if(['error','stopped'].includes(e.state))e.state='queued'});
                runBatch().catch(error=>showError(error.message));
            });
            $('batchDownload').addEventListener('click',()=>{
                const data={created_at:new Date().toISOString(),job:batchPayload,results:batchEntries.map(({name,state,data,error,index})=>({index,name,state,data,error}))};
                const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
                const link=element('a');link.href=url;link.download='recruitai-batch-results.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
            });
        }
        const showStep = id => {
            for (const [tab, panel] of [['jobStepTab','jobStepPane'],['cvStepTab','cvStepPane']]) {
                const active = tab === id;
                $(tab).classList.toggle('active', active);
                $(tab).setAttribute('aria-selected', String(active));
                $(tab).tabIndex = active ? 0 : -1;
                $(panel).classList.toggle('active', active);
                $(panel).classList.toggle('show', active);
            }
            const pane = $(id === 'jobStepTab' ? 'jobStepPane' : 'cvStepPane');
            pane.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        };
        ['jobStepTab','cvStepTab'].forEach(id => {
            $(id).addEventListener('click', () => showStep(id));
            $(id).addEventListener('keydown', event => {
                if (['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
                    event.preventDefault();
                    const next = event.key === 'Home' ? 'jobStepTab' : event.key === 'End' ? 'cvStepTab' : id === 'jobStepTab' ? 'cvStepTab' : 'jobStepTab';
                    showStep(next); $(next).focus();
                }
            });
        });
        const filterButtons = [...root.querySelectorAll('[data-result-filter]')];
        function applyFilter() {
            const cards = [...$('resultCards').children];
            filterButtons.forEach(button => {
                const value = button.dataset.resultFilter;
                const count = cards.filter(card => value === 'all' || (value === 'computed' ? card.dataset.computed === 'true' : card.dataset.resultState === value)).length;
                const labels = { all: 'Tất cả', computed: 'Đã phân tích', review: 'Cần rà soát', error: 'Lỗi' };
                button.textContent = `${labels[value]} (${count})`;
                button.setAttribute('aria-pressed', String(value === activeFilter));
            });
            let shown = 0;
            cards.forEach(card => {
                card.hidden = !(activeFilter === 'all' || (activeFilter === 'computed' ? card.dataset.computed === 'true' : card.dataset.resultState === activeFilter));
                if (!card.hidden) shown++;
            });
            $('filterEmpty').hidden = shown > 0;
        }
        filterButtons.forEach(button => button.addEventListener('click', () => { activeFilter = button.dataset.resultFilter; applyFilter(); }));
        const weightIds = ['semanticWeight', 'skillWeight', 'experienceWeight'];
        function updateWeights() {
            const total = weightIds.reduce((sum, id) => sum + Number($(id).value), 0);
            weightIds.forEach(id => { $(`${id}Value`).textContent = `${$(id).value}%`; });
            $('weightTotal').textContent = `Tổng ${total}% · ${total ? 'API chuẩn hóa theo tổng trọng số. Chưa tối ưu thực nghiệm.' : 'Cần ít nhất một trọng số lớn hơn 0.'}`;
            if ($('modelType').value === 'Hybrid') $('methodNote').textContent = 'Hybrid kết hợp ngữ nghĩa, kỹ năng và kinh nghiệm theo trọng số bạn chọn. Trọng số chưa được xác thực bằng thực nghiệm.';
        }
        weightIds.forEach(id => $(id).addEventListener('input', updateWeights));
        function selectedJob(){return postedJobs.find(job=>job.id===Number($('postedJob').value))}
        function validateJob() {
            if(selectedJob())return true;
            showStep('jobStepTab');$('postedJob').classList.add('is-invalid');$('postedJob').setAttribute('aria-invalid','true');$('postedJob').focus();
            $('postedJobStatus').textContent='Chọn tin tuyển dụng của công ty để lấy JD làm chuẩn.';return false;
        }
        $('nextCvStep').addEventListener('click', () => { if (validateJob()) showStep('cvStepTab'); });
        $('backToJobStep')?.addEventListener('click', () => showStep('jobStepTab'));
        if (recruiter) {
            $('workspaceTitle').textContent = 'Đọc đúng hồ sơ. Hiểu rõ mức độ phù hợp.';
            $('workspaceIntro').textContent = 'Chọn tin tuyển dụng để dùng JD đã lưu của công ty làm chuẩn. Xét nhóm CV và kiểm tra bằng chứng trước khi đánh giá.';
            $('cvIntro').textContent = 'Tick chọn các CV đã nhận, nhập hồ sơ qua Excel hoặc tải PDF/DOCX. Tối đa 50 CV được chọn cho một JD.';
            $('cvFiles').multiple = true;
            $('dropzoneTitle').textContent = 'Chọn hoặc kéo thả các CV vào đây';
        }
        function updateRecruiterContext() {
            const job=selectedJob();$('postedJobPreview').hidden=!job;
            $('recruiterContext').textContent=job?'Đang đối chiếu theo JD đã lưu: '+job.title:'Chọn tin tuyển dụng của công ty để lấy JD làm chuẩn.';
            $('postedJobStatus').textContent=job?'JD, kỹ năng và kinh nghiệm được lấy từ tin đã lưu tại thời điểm tạo đợt. Bạn vẫn có thể đổi phương pháp và trọng số để thử nghiệm.':'Chưa chọn tin tuyển dụng.';
            if(job){$('postedJobTitle').textContent=job.title;$('postedJobDescription').textContent=job.description||'Chưa có mô tả.';$('postedJobRequirements').textContent=job.requirements||'Chưa có yêu cầu.';$('postedJobSkills').textContent='Kỹ năng: '+(job.skills||'Chưa khai báo');$('postedJobExperience').textContent='Kinh nghiệm: '+(job.experience||'Chưa khai báo')}
        }
        $('postedJob').addEventListener('change',()=>{
            selectedExcel.clear();selectedFiles.clear();invalidateResults();updateRecruiterContext();renderExcel();renderFiles();loadApplicationsForJob();
            const job=selectedJob();history.replaceState(null,'',job?'/Matching?job='+job.id:'/Matching');
        });
        request('/api/workspace/jobs').then(data=>{
            postedJobs=data;$('postedJob').replaceChildren();const placeholder=element('option','','Chọn tin tuyển dụng…');placeholder.value='';$('postedJob').append(placeholder);
            const names={Draft:'Bản nháp',Published:'Đang tuyển',Closed:'Đã đóng'};
            for(const job of postedJobs){const option=element('option','',job.title+' · JD #'+job.id+' · '+(names[job.status]||job.status));option.value=String(job.id);$('postedJob').append(option)}
            const wanted=Number(new URLSearchParams(location.search).get('job'));
            if(postedJobs.some(j=>j.id===wanted))$('postedJob').value=String(wanted);else if(postedJobs.length===1)$('postedJob').value=String(postedJobs[0].id);
            updateRecruiterContext();loadApplicationsForJob();
            if(!postedJobs.length)$('postedJobStatus').textContent='Chưa có tin tuyển dụng. Tạo tin trong Quản lý tuyển dụng trước khi xét CV.';
        }).catch(()=>{$('postedJob').replaceChildren();$('postedJobStatus').textContent='Chưa tải được tin tuyển dụng. Tải lại trang để thử lại.'});
        const showError = message => {
            $('requestError').textContent = message;
            $('requestError').hidden = !message;
            if (message) $('requestError').focus();
        };
        function clearResults() {
            activeFilter = 'all';
            $('staleResults').hidden = true;
            $('resultCards').replaceChildren();
            $('resultsSection').hidden = true;
            $('emptyResults').hidden = false;
            $('requestProgress').hidden = true;
            $('requestActivity').hidden = true;
            showError('');
        }
        function invalidateResults() {
            if(batchEntries.length){batchStale=true;renderBatch()}
            $('staleResults').hidden = $('resultsSection').hidden;
            $('requestProgress').hidden = true;
            showError('');
        }
        function visibleApplications(){const query=$('applicationSearch')?.value.trim().toLocaleLowerCase('vi')||'';return applications.filter(a=>a.jobId===selectedJob()?.id&&(!query||`${a.fullName} ${a.title}`.toLocaleLowerCase('vi').includes(query)))}
        async function loadApplicationsForJob(){
            const job=selectedJob(),version=++applicationRequestVersion;
            applications=[];selectedApplications.clear();renderApplications();
            if(!job)return;
            $('applicationChoices').textContent='Đang tải CV cho tin tuyển dụng này…';
            try{
                const rows=await request('/api/workspace/applications?jobId='+job.id);
                if(version!==applicationRequestVersion||selectedJob()?.id!==job.id)return;
                if(!Array.isArray(rows))throw new Error('Invalid applications response');
                applications=rows;renderApplications();
            }catch(error){if(version===applicationRequestVersion&&selectedJob()?.id===job.id){$('applicationChoices').textContent='Chưa tải được CV của tin này. Chọn lại tin để thử lại.';if($('applicationScopeStatus'))$('applicationScopeStatus').textContent='Chưa tải được danh sách.';}}
        }
        function updateSourceCount(){
            const mode=root.querySelector('[name="cvMode"]:checked')?.value;
            const total=selectedApplications.size+selectedExcel.size+(mode==='text'?($('cvText').value.trim()?1:0):selectedFiles.size);
            if($('sourceSelectionCount'))$('sourceSelectionCount').textContent=`Đã chọn ${total}/50 hồ sơ: ${selectedApplications.size} ứng tuyển, ${selectedExcel.size} Excel, ${mode==='text'?($('cvText').value.trim()?1:0):selectedFiles.size} tải lên / văn bản.`;
            function all(id,count,size){const node=$(id);if(!node)return;node.checked=size>0&&count===size;node.indeterminate=count>0&&count<size;node.disabled=!size}
            const visible=visibleApplications();all('selectAllApplications',visible.filter(a=>selectedApplications.has(a.id)).length,visible.length);
            all('selectAllExcel',selectedExcel.size,excelRows.length);all('selectAllUploadFiles',selectedFiles.size,files.length);
        }
        function renderApplications(){
            const list=$('applicationChoices');if(!list)return;list.replaceChildren();
            const job=selectedJob();if($('applicationScopeStatus'))$('applicationScopeStatus').textContent=job?`${visibleApplications().length}/${applications.length} hồ sơ · JD #${job.id}: ${job.title}`:'Chọn tin tuyển dụng để xem hồ sơ.';
            for(const a of visibleApplications()){
                const label=element('label','source-choice'),checkbox=element('input');checkbox.type='checkbox';checkbox.checked=selectedApplications.has(a.id);
                checkbox.addEventListener('change',()=>{checkbox.checked?selectedApplications.add(a.id):selectedApplications.delete(a.id);invalidateResults();updateSourceCount()});
                const info=element('span');info.append(element('strong','',a.fullName),element('small','',`${a.title} · ${a.email}`));label.append(checkbox,info);list.append(label);
            }
            if(!list.childElementCount)list.append(element('p','form-text',selectedJob()?'Chưa có hồ sơ ứng tuyển hiển thị cho tin này. Có thể thêm CV từ Excel hoặc tải tệp.':'Chọn tin tuyển dụng ở bước 1 để xem CV đã nộp vào đúng tin.'));
            updateSourceCount();
        }
        function renderExcel(){
            if(!$('excelChoices'))return;$('excelChoices').replaceChildren();
            excelRows.forEach((row,index)=>{const label=element('label','source-choice'),checkbox=element('input');checkbox.type='checkbox';checkbox.checked=selectedExcel.has(index);
                checkbox.addEventListener('change',()=>{checkbox.checked?selectedExcel.add(index):selectedExcel.delete(index);invalidateResults();updateSourceCount()});
                const info=element('span');info.append(element('strong','',row.name),element('small','',`${row.email||'Không có email'} · ${row.cvText.length.toLocaleString('vi')} ký tự CV`));label.append(checkbox,info);$('excelChoices').append(label)});updateSourceCount();
        }
        if($('applicationChoices')){
            renderApplications();
            $('applicationSearch').addEventListener('input',renderApplications);
            $('selectAllApplications').addEventListener('change',event=>{visibleApplications().forEach(a=>event.target.checked?selectedApplications.add(a.id):selectedApplications.delete(a.id));invalidateResults();renderApplications()});
            $('selectAllExcel').addEventListener('change',event=>{selectedExcel.clear();if(event.target.checked)excelRows.forEach((_,i)=>selectedExcel.add(i));invalidateResults();renderExcel()});
            $('selectAllUploadFiles').addEventListener('change',event=>{selectedFiles.clear();if(event.target.checked)files.forEach(f=>selectedFiles.add(f));invalidateResults();renderFiles();updateSourceCount()});
            $('clearExcelCvs').addEventListener('click',()=>{excelRows=[];selectedExcel.clear();$('excelImportStatus').textContent='Đã bỏ danh sách Excel.';invalidateResults();renderExcel()});
            $('excelCvImport').addEventListener('change',async event=>{
                const file=event.target.files[0];if(!file)return;
                const form=new FormData();form.append('file',file);event.target.disabled=true;$('excelImportStatus').textContent='Đang kiểm tra file Excel…';
                try{const rows=await reviewRequest('/api/recruiter/reviews/import-excel',{method:'POST',body:form});excelRows=rows;selectedExcel.clear();invalidateResults();renderExcel();$('excelImportStatus').textContent=`Đã đọc ${rows.length} hồ sơ. Tick chọn các hồ sơ cần xét.`}
                catch(error){$('excelImportStatus').textContent=error.message}finally{event.target.disabled=false;event.target.value=''}
            });
        }
        function renderFiles() {
            $('selectedFiles').replaceChildren();
            files.forEach((file, index) => {
                const li = element('li');
                const choose=element('input');choose.type='checkbox';choose.checked=selectedFiles.has(file);choose.setAttribute('aria-label',`Chọn CV ${file.name}`);
                choose.addEventListener('change',()=>{choose.checked?selectedFiles.add(file):selectedFiles.delete(file);invalidateResults();updateSourceCount()});
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
                    selectedFiles.delete(file);
                    $('cvFiles').value = '';
                    invalidateResults();
                    renderFiles();
                    updateSourceCount();
                });
                li.append(choose, thumbnail, description, remove);
                $('selectedFiles').append(li);
            });
        }
        function selectFiles(list) {
            if (busy) return;
            try {
                const selected = batch.mergeFiles(files,Array.from(list),recruiter?50:1);
                selected.filter(f=>!files.includes(f)).forEach(f=>selectedFiles.add(f));
                files = selected; invalidateResults(); renderFiles(); updateSourceCount(); showError('');
            } catch(error) { showError(error.message); }
            $('cvFiles').value = '';
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
            invalidateResults();
            updateSourceCount();
        }));
        const hints = {
            Hybrid: 'Hybrid kết hợp ngữ nghĩa, kỹ năng và kinh nghiệm theo trọng số bạn chọn. Đây là giả định, chưa tối ưu bằng thực nghiệm. Thiếu thành phần có trọng số sẽ chưa có điểm tổng.',
            'Sentence-BERT': 'Sentence-BERT đo tương đồng ngữ nghĩa giữa CV và JD. Phương pháp này không chấm riêng kỹ năng và kinh nghiệm.',
            'TF-IDF': 'TF-IDF đo tương đồng từ vựng trên bộ từ vựng phát triển đã cố định. Từ mới ngoài bộ từ vựng có thể chưa được biểu diễn.'
        };
        $('modelType').addEventListener('change', () => {
            $('methodNote').textContent = hints[$('modelType').value];
            $('modelWeights').hidden = $('modelType').value !== 'Hybrid';
        });
        $('matchingForm').addEventListener('input', event => {
            if (busy) return;
            // Selection controls own their change handlers. Updating counts here
            // would reset a select-all checkbox before its change event fires.
            if (event.target.type === 'checkbox' || ['applicationSearch','excelCvImport','cvFiles'].includes(event.target.id)) return;
            event.target.classList.remove('is-invalid');
            event.target.removeAttribute('aria-invalid');
            invalidateResults();
            updateSourceCount();
        });
        $('matchingForm').addEventListener('change', event => { if (!busy && !['cvFiles','applicationSearch','excelCvImport'].includes(event.target.id)) invalidateResults(); });

        $('matchingForm').addEventListener('submit', async event => {
            event.preventDefault();
            if (busy) return;
            showError('');
            if(!validateJob())return;
            const mode = root.querySelector('[name="cvMode"]:checked').value;
            const uploadSelection=mode==='file'?files.filter(f=>selectedFiles.has(f)):[];
            const externalSelection=[...selectedExcel].map(i=>excelRows[i]);
            if(mode==='text'&&$('cvText').value.trim())externalSelection.push({name:'CV từ văn bản',email:'',cvText:$('cvText').value.trim()});
            const count=selectedApplications.size+externalSelection.length+uploadSelection.length;
            if(count<1||count>50){showStep('cvStepTab');showError('Tick chọn từ 1 đến 50 CV từ các nguồn để phân tích.');return;}
            let payload;
            try {
                const weights = {
                    semantic_weight: Number($('semanticWeight').value) / 100,
                    skill_weight: Number($('skillWeight').value) / 100,
                    experience_weight: Number($('experienceWeight').value) / 100
                };
                if ($('modelType').value === 'Hybrid' && !Object.values(weights).some(value => value > 0)) throw new Error('Chọn ít nhất một trọng số lớn hơn 0.');
                payload = {model_type:$('modelType').value,weights};
            } catch (error) { showError(error.message); return; }
            busy=true;$('matchingFields').disabled=true;$('analyzeButton').textContent='Đang lưu đợt và hồ sơ đã chọn…';
            try{
                const form=new FormData();form.append('requestJson',JSON.stringify({jobId:selectedJob().id,configuration:payload,applicationIds:[...selectedApplications],externalRows:externalSelection}));
                uploadSelection.forEach(f=>form.append('files',f));
                const saved=await reviewRequest('/api/recruiter/reviews',{method:'POST',body:form});
                reviewId=saved.id;const detail=await reviewRequest('/api/recruiter/reviews/'+reviewId);
                clearResults();batchStale=false;batchPayload=detail.configuration;batchMode=mode;selectedEntry=null;displayedData=null;
                batchEntries=detail.items.map((item,index)=>({index,name:item.name,remoteId:item.id,state:'queued'}));
                $('savedReviewLink').href='/ReviewResults?batch='+reviewId;$('savedReviewLink').hidden=false;
                await runBatch();
            }catch(error){showError(error.message)}finally{busy=false;$('matchingFields').disabled=false;$('analyzeButton').textContent='Phân tích đợt mới'}
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
        document.querySelectorAll('[data-matching-workspace="recruiter"]').forEach(mountWorkspace);
        const status = document.getElementById('serviceStatus');
        const button = document.getElementById('refreshService');
        if (status && button) {
            const refresh = () => checkHealth(status, button);
            button.addEventListener('click', refresh);
            refresh();
        }
    });
})();
