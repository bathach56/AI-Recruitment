const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');

const base = process.env.CHAT_TEST_URL || 'http://127.0.0.1:5133';

test('chat supports keyboard, live inference, recovery and responsive layout', { timeout: 100000 }, async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    const toggle = page.locator('.recruit-chat-toggle');
    const panel = page.getByRole('dialog', { name: 'Trợ lý AI' });
    const input = panel.getByRole('textbox', { name: 'Câu hỏi của bạn' });
    const send = panel.getByRole('button', { name: 'Gửi' });
    const messages = panel.locator('.recruit-chat-message');
    const retry = panel.getByRole('button', { name: 'Thử lại' });
    const startNew = panel.getByRole('button', { name: 'Chat mới' });

    await toggle.press('Enter');
    assert.equal(await input.evaluate(element => element === document.activeElement), true);
    await input.press('Escape');
    assert.equal(await panel.count(), 0);
    assert.equal(await toggle.evaluate(element => element === document.activeElement), true);
    await toggle.click();
    await input.fill('   ');
    assert.equal(await send.isDisabled(), true);
    await input.press('Enter');
    assert.equal(await messages.count(), 0);

    await input.fill('Điểm phù hợp CV–JD nghĩa là gì?');
    await input.press('End');
    await input.press('Shift+Enter');
    assert.match(await input.inputValue(), /\n$/);
    await input.press('Enter');
    await panel.getByText('Trợ lý đang phản hồi…').waitFor();
    assert.equal(await send.isDisabled(), true);
    await messages.filter({ hasText: 'Trợ lý AI' }).waitFor({ timeout: 55000 });
    assert.equal(await messages.count(), 2);

    await page.route('**/api/chat', route => route.fulfill({
      status: 503, json: { message: 'Trợ lý đang gián đoạn.' }
    }), { times: 1 });
    await input.fill('Còn khi thiếu bằng chứng?');
    await send.click();
    await panel.getByText('Trợ lý đang gián đoạn.').waitFor();
    await retry.waitFor();
    const retryRequest = page.waitForRequest('**/api/chat');
    await retry.click();
    assert.equal((await retryRequest).postDataJSON().messages.length, 3);
    await messages.nth(3).waitFor({ timeout: 55000 });
    assert.equal(await messages.count(), 4);

    await page.route('**/api/chat', route => route.abort('failed'), { times: 1 });
    await input.fill('Lỗi mạng');
    await input.press('Enter');
    await panel.getByText(/Kết nối hoặc phản hồi gặp lỗi/).waitFor();
    await startNew.click();
    assert.equal(await messages.count(), 0);
    assert.equal(await retry.count(), 0);

    await page.clock.install();
    let finishRoute;
    await page.route('**/api/chat', async route => {
      await new Promise(resolve => { finishRoute = resolve; });
      await route.abort().catch(() => {});
    }, { times: 1 });
    await input.fill('Hết thời gian');
    const timeoutRequest = page.waitForRequest('**/api/chat');
    await input.press('Enter');
    await timeoutRequest;
    await page.clock.fastForward(51000);
    await panel.getByText(/Yêu cầu đã hết thời gian/).waitFor();
    finishRoute();
    await startNew.click();

    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 640 });
      const bounds = await panel.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width && bounds.y >= 0);
      assert.equal(await input.isVisible(), true);
    }
    await panel.getByRole('button', { name: 'Đóng trợ lý AI' }).click();
    assert.equal(await panel.count(), 0);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
