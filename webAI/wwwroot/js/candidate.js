// Local file selection only. Submission awaits the application API.
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('candidateCv');
    const status = document.getElementById('candidateCvStatus');
    const error = document.getElementById('candidateCvError');
    const remove = document.getElementById('removeCandidateCv');
    function update() {
        const file = input.files[0];
        let message = '';
        if (file && !/\.(pdf|docx)$/i.test(file.name)) message = 'Chỉ hỗ trợ PDF hoặc DOCX.';
        else if (file && (file.size === 0 || file.size > 10 * 1024 * 1024)) message = 'Tệp phải có nội dung và không vượt quá 10 MiB.';
        if (message) input.value = '';
        error.textContent = message;
        error.hidden = !message;
        input.setAttribute('aria-invalid', String(Boolean(message)));
        status.textContent = file && !message
            ? `${file.name} · ${Math.ceil(file.size / 1024)} KiB · Chưa gửi`
            : 'Chưa chọn CV.';
        remove.hidden = !file || Boolean(message);
    }
    input.addEventListener('change', update);
    remove.addEventListener('click', () => { input.value = ''; update(); input.focus(); });
});
