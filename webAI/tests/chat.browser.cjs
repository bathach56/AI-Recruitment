const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');

const base = process.env.CHAT_TEST_URL || 'http://127.0.0.1:5133';
const panelName = 'Trợ lý hỗ trợ CV';

test('local chat works offline, retains history and supports keyboard and mobile', async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  try {
    const page = await browser.newPage();
    const errors = [];
    const chatRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      if (new URL(request.url()).pathname === '/api/chat') chatRequests.push(request.url());
    });
    assert.equal((await page.goto(base)).status(), 200);
    const toggle = page.getByRole('button', { name: 'Hỗ trợ CV', exact: true });
    const panel = page.getByRole('dialog', { name: panelName });
    const input = panel.getByRole('textbox', { name: 'Câu hỏi của bạn' });
    const send = panel.getByRole('button', { name: 'Gửi', exact: true });
    const replies = panel.locator('[data-role="assistant"] p');
    const questions = panel.locator('[data-role="user"] p');

    await page.context().setOffline(true);
    await toggle.press('Enter');
    assert.equal(await input.evaluate(element => element === document.activeElement), true);
    await replies.getByText(/Chào bạn/).waitFor();
    await input.fill('   ');
    await input.press('Enter');
    assert.equal(await questions.count(), 0);
    await input.fill('x'.repeat(501));
    await input.press('Enter');
    await panel.getByRole('alert').getByText(/500 ký tự/).waitFor();
    assert.equal(await questions.count(), 0);

    await input.fill('');
    await panel.getByRole('button', { name: 'Làm thế nào để tải CV?' }).click();
    await panel.getByText('Trợ lý đang nhập…').waitFor();
    assert.equal(await send.isDisabled(), true);
    await replies.getByText(/chọn hoặc kéo thả CV/).waitFor();
    await panel.getByRole('button', { name: 'Website hỗ trợ định dạng CV nào?' }).waitFor();

    await input.fill('TOI KHONG TAI DUOC CV');
    await input.press('End');
    await input.press('Shift+Enter');
    assert.match(await input.inputValue(), /\n$/);
    await input.press('Enter');
    await input.press('Enter');
    await replies.getByText(/tối đa 10 MiB/).waitFor();
    assert.equal(await questions.count(), 2);

    await input.fill('Thời tiết ở đâu?');
    await send.click();
    await replies.getByText(/chưa có câu trả lời phù hợp/).waitFor();
    await input.press('Escape');
    assert.equal(await panel.isVisible(), false);
    assert.equal(await toggle.evaluate(element => element === document.activeElement), true);
    await toggle.click();
    assert.equal(await questions.count(), 3);

    await page.context().setOffline(false);
    await page.reload();
    await toggle.click();
    assert.equal(await questions.count(), 3);
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 640 });
      const bounds = await panel.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width && bounds.y >= 0);
      assert.equal(await input.isVisible(), true);
    }
    const clear = panel.getByRole('button', { name: 'Xóa lịch sử' });
    page.once('dialog', dialog => dialog.dismiss());
    await clear.click();
    assert.equal(await questions.count(), 3);
    page.once('dialog', dialog => dialog.accept());
    await clear.click();
    assert.equal(await questions.count(), 0);
    await page.reload();
    await toggle.click();
    assert.equal(await replies.count(), 1);
    assert.deepEqual(chatRequests, []);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test('chat continues when browser storage is blocked', async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() { throw new Error('Storage denied'); }
      });
    });
    await page.goto(base);
    await page.getByRole('button', { name: 'Hỗ trợ CV', exact: true }).click();
    const panel = page.getByRole('dialog', { name: panelName });
    const input = panel.getByRole('textbox', { name: 'Câu hỏi của bạn' });
    await input.fill('Cảm ơn!');
    await input.press('Enter');
    await panel.getByText('Rất vui được hỗ trợ bạn!').waitFor();
    await panel.getByRole('alert').getByText(/chỉ lưu được trong trang/).waitFor();
  } finally {
    await browser.close();
  }
});

test('CV summaries run offline and stay out of stored chat history', async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  try {
    const page = await browser.newPage();
    const chatRequests = [];
    page.on('request', request => {
      if (new URL(request.url()).pathname === '/api/chat') chatRequests.push(request.url());
    });
    await page.goto(base);
    const toggle = page.getByRole('button', { name: 'Hỗ trợ CV', exact: true });
    await toggle.click();
    const panel = page.getByRole('dialog', { name: panelName });
    const input = panel.getByRole('textbox', { name: 'Câu hỏi của bạn' });
    await page.context().setOffline(true);

    await panel.getByRole('button', { name: 'Tóm tắt CV', exact: true }).click();
    await panel.getByText(/Gõ “Tóm tắt CV:”/).waitFor();
    await input.fill('Tom tat CV:\nHọ tên: DEMO PRIVATE\nKỹ năng: C# và SQL Server\nKinh nghiệm: Phát triển API quản lý kho');
    await input.press('Enter');
    await panel.getByText(/Tóm tắt trích từ các mục/).waitFor();
    assert.match(await panel.innerText(), /Kỹ năng: C# và SQL Server/);
    assert.doesNotMatch(await panel.innerText(), /DEMO PRIVATE/);
    const saved = await page.evaluate(() => localStorage.getItem('recruitai.cv-help.v1'));
    assert.deepEqual(JSON.parse(saved), ['Tóm tắt CV']);

    await input.fill('Tạo CV trên TopCV thế nào?');
    await input.press('Enter');
    const source = panel.getByRole('link', { name: 'Đọc hướng dẫn từ topcv.vn' });
    await source.waitFor();
    assert.match(await source.getAttribute('href'), /^https:\/\/www\.topcv\.vn\//);

    await page.context().setOffline(false);
    await page.reload();
    await toggle.click();
    assert.doesNotMatch(await panel.innerText(), /C# và SQL Server|Phát triển API quản lý kho/);
    assert.deepEqual(chatRequests, []);
  } finally {
    await browser.close();
  }
});
