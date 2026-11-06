// Local preparation only. No contact details or CV are sent to a server.
document.addEventListener('DOMContentLoaded', () => {
    'use strict';
    const $ = id => document.getElementById(id);
    const form = $('candidateInfoForm'), input = $('candidateCv');
    const preferences = window.RecruitAIPreferences, saved = preferences?.get();
    const fields = ['candidateFullName', 'candidateEmail', 'candidatePhone', 'candidateTargetTitle'];
    let file = null, previewUrl = '', current = 1;
    if (saved) {
        $('candidateFullName').value = saved.name;
        $('candidateTargetTitle').value = saved.title;
        $('rememberProfile').checked = Boolean(saved.name || saved.title);
    }
    function releasePreview() {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = '';
        $('candidatePreview').replaceChildren();
    }
    function syncSummary() {
        const name = $('candidateFullName').value.trim();
        $('summaryName').textContent = name || 'Hồ sơ của bạn';
        $('candidateAvatar').textContent = name ? name.split(/\s+/).slice(-2).map(word => Array.from(word)[0]).join('').toUpperCase() : 'R';
        $('summaryEmail').textContent = $('candidateEmail').value.trim() || 'Chưa bổ sung';
        $('summaryPhone').textContent = $('candidatePhone').value.trim() || 'Chưa bổ sung';
        $('summaryTitle').textContent = $('candidateTargetTitle').value.trim() || 'Chưa bổ sung';
        $('profileReadiness').textContent = form.checkValidity() ? (file ? 'Đã chuẩn bị thông tin & CV · Chưa gửi' : 'Thông tin đã đủ · Thêm CV của bạn') : 'Bổ sung thông tin cá nhân của bạn';
    }
    function remember() {
        const enabled = $('rememberProfile').checked;
        const ok = preferences?.save({ name: enabled ? $('candidateFullName').value.trim() : '', title: enabled ? $('candidateTargetTitle').value.trim() : '', role: 'candidate' });
        $('profileSaveStatus').textContent = !enabled ? 'Tên và vị trí không được ghi nhớ.' : ok ? 'Đã ghi nhớ tên và vị trí trên trình duyệt này.' : 'Trình duyệt không cho phép lưu. Bạn vẫn có thể tiếp tục trong trang đang mở.';
    }
    function error(message) {
        $('candidateCvError').textContent = message;
        $('candidateCvError').hidden = !message;
        input.setAttribute('aria-invalid', String(Boolean(message)));
    }
    function selectFile(next) {
        releasePreview();
        let message = '';
        if (next && !/\.(pdf|docx)$/i.test(next.name)) message = 'Chỉ hỗ trợ PDF hoặc DOCX.';
        else if (next && (!next.size || next.size > 10 * 1024 * 1024)) message = 'Tệp phải có nội dung và không vượt quá 10 MiB.';
        file = message ? null : next;
        if (!file) input.value = '';
        error(message);
        $('candidateCvStatus').textContent = file ? `${file.name} · ${Math.ceil(file.size / 1024)} KiB · Chưa gửi` : 'Chưa chọn CV.';
        $('removeCandidateCv').hidden = !file;
        syncSummary();
    }
    function renderPreview() {
        releasePreview();
        const list = $('previewProfile');
        list.replaceChildren();
        ['Họ và tên', 'Email', 'Điện thoại', 'Vị trí mong muốn'].forEach((label, index) => {
            const item = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd');
            dt.textContent = label;
            dd.textContent = $(fields[index]).value.trim() || 'Chưa bổ sung';
            item.append(dt, dd); list.append(item);
        });
        if (/\.pdf$/i.test(file.name)) {
            previewUrl = URL.createObjectURL(file);
            const object = document.createElement('object');
            object.type = 'application/pdf'; object.data = previewUrl;
            object.setAttribute('aria-label', `Xem trước ${file.name}`);
            const fallback = document.createElement('p');
            fallback.className = 'docx-preview';
            fallback.textContent = 'Trình duyệt chưa hỗ trợ xem PDF trực tiếp. ';
            const link = document.createElement('a');
            link.href = previewUrl; link.target = '_blank'; link.rel = 'noopener'; link.textContent = 'Mở PDF để kiểm tra';
            fallback.append(link); object.append(fallback); $('candidatePreview').append(object);
        } else {
            const box = document.createElement('div'), icon = document.createElement('i'), name = document.createElement('strong'), note = document.createElement('p');
            box.className = 'docx-preview'; icon.className = 'bi bi-file-earmark-word'; icon.setAttribute('aria-hidden', 'true');
            name.textContent = file.name; note.className = 'mt-3';
            note.textContent = 'DOCX đã được chọn. Chưa hỗ trợ xem trực tiếp nội dung DOCX; hãy kiểm tra bằng ứng dụng đọc tài liệu trên thiết bị.';
            box.append(icon, name, note); $('candidatePreview').append(box);
        }
    }
    function step(number) {
        if (number > 1 && !form.checkValidity()) {
            document.querySelectorAll('[data-candidate-panel]').forEach(panel => { panel.hidden = panel.dataset.candidatePanel !== '1'; });
            number = 1;
            form.reportValidity();
        }
        if (number === 3 && !file) { number = 2; error('Chọn một tệp CV hợp lệ trước khi xem trước.'); }
        current = number;
        document.querySelectorAll('[data-candidate-panel]').forEach(panel => { panel.hidden = Number(panel.dataset.candidatePanel) !== number; });
        document.querySelectorAll('[data-candidate-step]').forEach(button => {
            if (Number(button.dataset.candidateStep) === number) button.setAttribute('aria-current', 'step');
            else button.removeAttribute('aria-current');
        });
        if (number === 3) renderPreview();
        document.querySelector(`[data-candidate-panel="${number}"] h2`).focus();
    }
    form.addEventListener('input', syncSummary);
    form.addEventListener('change', event => {
        if ($('rememberProfile').checked && ['candidateFullName', 'candidateTargetTitle'].includes(event.target.id)) remember();
    });
    form.addEventListener('submit', event => { event.preventDefault(); if (form.reportValidity()) { remember(); step(2); } });
    $('rememberProfile').addEventListener('change', remember);
    document.querySelectorAll('[data-candidate-step]').forEach(button => button.addEventListener('click', () => step(Number(button.dataset.candidateStep))));
    document.querySelectorAll('[data-candidate-back]').forEach(button => button.addEventListener('click', () => step(Number(button.dataset.candidateBack))));
    $('previewCandidate').addEventListener('click', () => step(3));
    input.addEventListener('change', () => selectFile(input.files[0] || null));
    $('removeCandidateCv').addEventListener('click', () => { selectFile(null); $('candidateDropzone').focus(); });
    const dropzone = $('candidateDropzone');
    dropzone.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input.click(); }
    });
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(type => dropzone.addEventListener(type, event => {
        event.preventDefault(); dropzone.classList.toggle('is-dragging', type === 'dragenter' || type === 'dragover');
        if (type === 'drop') {
            if (event.dataTransfer.files.length > 1) { selectFile(null); error('Mỗi hồ sơ chỉ chọn một CV.'); }
            else selectFile(event.dataTransfer.files[0] || null);
        }
    }));
    window.addEventListener('recruitai:preferences', event => {
        if (!event.detail.name && !event.detail.title && !event.detail.role) {
            $('rememberProfile').checked = false;
            $('profileSaveStatus').textContent = 'Đã xóa thông tin ghi nhớ. Bản nháp trong trang vẫn còn để bạn chỉnh sửa.';
        }
    });
    window.addEventListener('pagehide', releasePreview);
    window.addEventListener('pageshow', () => { if (current === 3 && file && !previewUrl) renderPreview(); });
    syncSummary();
});
