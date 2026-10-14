// Apply the saved appearance before rendering; only appearance is persisted.
(() => {
    const root = document.documentElement;
    let theme = 'dark';
    try { theme = localStorage.getItem('recruitai-theme') || theme; } catch { /* Storage may be disabled. */ }
    root.dataset.bsTheme = theme === 'light' ? 'light' : 'dark';
    document.addEventListener('DOMContentLoaded', () => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'theme-toggle';
        function update() {
            const dark = root.dataset.bsTheme === 'dark';
            button.setAttribute('aria-label', dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối');
            button.setAttribute('aria-pressed', String(dark));
            button.innerHTML = dark ? '<i class="bi bi-sun" aria-hidden="true"></i>' : '<i class="bi bi-moon-stars" aria-hidden="true"></i>';
        }
        button.addEventListener('click', () => {
            root.dataset.bsTheme = root.dataset.bsTheme === 'dark' ? 'light' : 'dark';
            try { localStorage.setItem('recruitai-theme', root.dataset.bsTheme); } catch { /* The toggle still works without storage. */ }
            update();
        });
        update();
        const host = document.querySelector('.site-nav .navbar-nav, .navbar-public .container > div:last-child');
        if (host) host.append(button);
        else { button.classList.add('theme-toggle-floating'); document.body.append(button); }
    });
})();
