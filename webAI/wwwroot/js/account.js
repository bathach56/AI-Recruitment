// Account endpoints are not implemented yet. Never simulate authentication.
document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('#loginForm, #registerForm');
    if (!form) return;
    form.addEventListener('submit', event => event.preventDefault());
    document.querySelectorAll('[data-unavailable-action]').forEach(control => {
        control.setAttribute('aria-disabled', 'true');
        if (control.tagName === 'BUTTON') control.disabled = true;
        control.addEventListener('click', event => event.preventDefault());
    });
});
