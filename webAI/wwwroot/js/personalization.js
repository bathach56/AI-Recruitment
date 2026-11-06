// Device preferences only; this is not authentication or authorization.
(() => {
    'use strict';
    const key = 'recruitai-preferences-v1';
    let state = { role: '', name: '', title: '' };
    try {
        const saved = JSON.parse(localStorage.getItem(key) || '{}');
        state = {
            role: ['candidate', 'recruiter'].includes(saved?.role) ? saved.role : '',
            name: typeof saved?.name === 'string' ? saved.name.slice(0, 150) : '',
            title: typeof saved?.title === 'string' ? saved.title.slice(0, 200) : ''
        };
    } catch { /* Preferences are optional when browser storage is unavailable. */ }
    let stored = false;
    function render() {
        document.querySelectorAll('[data-personal-name]').forEach(node => { node.textContent = state.name || 'Bạn'; });
        document.querySelectorAll('[data-personal-avatar]').forEach(node => {
            node.textContent = state.name ? state.name.trim().split(/\s+/).slice(-2).map(word => Array.from(word)[0]).join('').toUpperCase() : 'R';
        });
        const welcome = document.querySelector('[data-welcome]');
        if (welcome) welcome.textContent = state.name ? `Chào ${state.name}, tiếp tục hành trình của bạn.` : 'Không gian tuyển dụng theo cách của bạn.';
        const target = document.querySelector('[data-personal-target]');
        if (target) target.textContent = state.title ? `Mục tiêu của bạn: ${state.title}` : 'Chọn vai trò để bắt đầu với công việc bạn cần.';
        document.querySelectorAll('[data-role-choice]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.roleChoice === state.role)));
        const resume = document.querySelector('[data-resume-link]');
        if (resume) {
            resume.hidden = !state.role;
            resume.href = state.role === 'candidate' ? '/Candidate' : '/Recruiter';
            resume.textContent = state.role === 'candidate' ? 'Tiếp tục chuẩn bị hồ sơ' : 'Tiếp tục đối chiếu tuyển dụng';
        }
        document.querySelectorAll('[data-clear-preferences]').forEach(button => { button.hidden = !state.name && !state.title && !state.role; });
    }
    function save(update) {
        const next = { ...state, ...update };
        state = {
            role: ['candidate', 'recruiter'].includes(next.role) ? next.role : '',
            name: typeof next.name === 'string' ? next.name.trim().slice(0, 150) : '',
            title: typeof next.title === 'string' ? next.title.trim().slice(0, 200) : ''
        };
        try { localStorage.setItem(key, JSON.stringify(state)); stored = true; }
        catch { stored = false; }
        render();
        window.dispatchEvent(new CustomEvent('recruitai:preferences', { detail: { ...state } }));
        return stored;
    }
    window.RecruitAIPreferences = { get: () => ({ ...state }), save };
    document.addEventListener('DOMContentLoaded', () => {
        const tools = document.querySelector('.nav-tools');
        if (tools) {
            const avatar = document.createElement('a');
            avatar.className = 'personal-avatar';
            avatar.href = '/Candidate';
            avatar.dataset.personalAvatar = '';
            avatar.setAttribute('aria-label', 'Thông tin cá nhân của bạn');
            tools.append(avatar);
        }
        document.querySelectorAll('[data-role-choice]').forEach(button => button.addEventListener('click', () => save({ role: button.dataset.roleChoice })));
        document.querySelectorAll('[data-clear-preferences]').forEach(button => button.addEventListener('click', () => {
            try { localStorage.removeItem(key); } catch { /* In-memory reset still works. */ }
            state = { role: '', name: '', title: '' };
            render();
            window.dispatchEvent(new CustomEvent('recruitai:preferences', { detail: { ...state } }));
        }));
        render();
    });
})();
