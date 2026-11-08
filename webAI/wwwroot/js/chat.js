(() => {
  const widget = document.createElement('aside');
  widget.className = 'recruit-chat';
  widget.setAttribute('aria-label', 'Trợ lý tuyển dụng');
  widget.innerHTML = `
    <section class="recruit-chat-panel" id="recruit-chat-panel" role="dialog"
        aria-labelledby="recruit-chat-title" hidden>
      <header class="recruit-chat-header">
        <h2 id="recruit-chat-title">Trợ lý AI</h2>
        <button type="button" class="btn btn-outline-secondary" data-chat-new>Chat mới</button>
        <button type="button" class="btn btn-outline-secondary" data-chat-close aria-label="Đóng trợ lý AI">×</button>
      </header>
      <p class="recruit-chat-note" id="recruit-chat-note">
        Hỏi về tuyển dụng, cách dùng RecruitAI hoặc cách đọc điểm CV–JD.
        Vui lòng tránh gửi CV và thông tin cá nhân.
      </p>
      <div class="recruit-chat-log" role="log" aria-label="Tin nhắn" tabindex="0"></div>
      <div class="recruit-chat-feedback">
        <p role="status"></p>
        <p role="alert"></p>
        <button type="button" class="btn btn-outline-secondary" data-chat-retry hidden>Thử lại</button>
      </div>
      <form class="recruit-chat-form">
        <label class="visually-hidden" for="recruit-chat-input">Câu hỏi của bạn</label>
        <textarea id="recruit-chat-input" class="form-control" rows="2" maxlength="1200"
            aria-describedby="recruit-chat-note" placeholder="Nhập câu hỏi…"></textarea>
        <button type="submit" class="btn btn-primary" disabled>Gửi</button>
      </form>
    </section>
    <button type="button" class="btn btn-primary recruit-chat-toggle"
        aria-controls="recruit-chat-panel" aria-expanded="false">
      <i class="bi bi-chat-dots" aria-hidden="true"></i> Trợ lý AI
    </button>`;
  document.body.append(widget);

  const panel = widget.querySelector('section');
  const toggle = widget.querySelector('.recruit-chat-toggle');
  const log = widget.querySelector('[role="log"]');
  const loading = widget.querySelector('[role="status"]');
  const error = widget.querySelector('[role="alert"]');
  const retry = widget.querySelector('[data-chat-retry]');
  const form = widget.querySelector('form');
  const input = widget.querySelector('textarea');
  const send = form.querySelector('button');
  let history = [];
  let pending = '';
  let activeRequest;

  function scrollToLatest() {
    log.scrollTop = log.scrollHeight;
  }

  function showPanel(open) {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open) {
      input.focus();
      scrollToLatest();
    } else {
      toggle.focus();
    }
  }

  function addMessage(role, content) {
    const item = document.createElement('div');
    item.className = 'recruit-chat-message';
    item.dataset.role = role;
    const label = document.createElement('strong');
    label.textContent = role === 'user' ? 'Bạn' : 'Trợ lý AI';
    const body = document.createElement('p');
    body.textContent = content;
    item.append(label, body);
    log.append(item);
    scrollToLatest();
  }

  function updateControls() {
    send.disabled = Boolean(pending) || !input.value.trim();
    retry.hidden = !pending || Boolean(activeRequest);
    loading.textContent = activeRequest ? 'Trợ lý đang phản hồi…' : '';
  }

  async function requestReply() {
    const controller = new AbortController();
    activeRequest = controller;
    error.textContent = '';
    updateControls();
    const timeout = setTimeout(() => controller.abort(), 50000);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...history, { role: 'user', content: pending }] }),
        signal: controller.signal
      });
      const result = await response.json().catch(() => null);
      if (activeRequest !== controller) return;
      if (controller.signal.aborted) throw new Error();
      if (!response.ok) {
        error.textContent = response.status === 429
          ? 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng đợi một phút rồi thử lại.'
          : result?.message || 'Không gửi được câu hỏi. Vui lòng thử lại.';
        return;
      }
      if (typeof result?.reply !== 'string' || !result.reply.trim()) throw new Error();
      addMessage('assistant', result.reply);
      history = [...history, { role: 'user', content: pending },
        { role: 'assistant', content: result.reply }].slice(-8);
      pending = '';
    } catch {
      if (activeRequest === controller) {
        error.textContent = controller.signal.aborted
          ? 'Yêu cầu đã hết thời gian. Vui lòng thử lại.'
          : 'Kết nối hoặc phản hồi gặp lỗi. Vui lòng thử lại.';
      }
    } finally {
      clearTimeout(timeout);
      if (activeRequest === controller) {
        activeRequest = null;
        updateControls();
        scrollToLatest();
      }
    }
  }

  toggle.addEventListener('click', () => showPanel(panel.hidden));
  widget.querySelector('[data-chat-close]').addEventListener('click', () => showPanel(false));
  widget.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) {
      event.preventDefault();
      showPanel(false);
    }
  });
  widget.querySelector('[data-chat-new]').addEventListener('click', () => {
    activeRequest?.abort();
    activeRequest = null;
    pending = '';
    history = [];
    input.value = '';
    error.textContent = '';
    log.replaceChildren();
    updateControls();
    input.focus();
  });
  retry.addEventListener('click', () => {
    if (!pending || activeRequest) return;
    input.focus();
    void requestReply();
  });
  input.addEventListener('input', updateControls);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const content = input.value.trim();
    if (!content || pending || content.length > 1200) return;
    pending = content;
    input.value = '';
    addMessage('user', content);
    input.focus();
    void requestReply();
  });
})();
