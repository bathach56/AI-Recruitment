// Only completed health requests from this page become telemetry.
(() => {
    const samples = [];
    const $ = id => document.getElementById(id);
    document.addEventListener('recruitai:health', event => {
        const data = event.detail;
        if (data.source !== 'serviceStatus') return;
        $('webApiStatus').textContent = data.reachable ? 'Có phản hồi' : 'Chưa kết nối';
        $('webApiStatus').dataset.state = data.reachable ? 'ready' : 'offline';
        $('aiApiStatus').textContent = data.connected ? 'Đang hoạt động' : 'Chưa sẵn sàng';
        $('aiApiStatus').dataset.state = data.connected ? 'ready' : 'offline';
        $('healthLatency').textContent = data.connected ? `${Math.round(data.elapsed)} ms` : '—';
        const log = $('healthLog');
        if (!log.querySelector('time')) log.replaceChildren();
        const row = document.createElement('li'), time = document.createElement('time'), message = document.createElement('span');
        const now = new Date();
        time.dateTime = now.toISOString();
        time.textContent = now.toLocaleTimeString('vi-VN');
        message.textContent = data.connected ? `AI sẵn sàng · ${Math.round(data.elapsed)} ms` : data.reachable ? 'Web có phản hồi · AI chưa sẵn sàng' : 'Không nhận được phản hồi hợp lệ';
        row.append(time, message); log.prepend(row);
        while (log.children.length > 8) log.lastChild.remove();
        if (!data.connected) return;
        samples.push(Math.round(data.elapsed));
        if (samples.length > 8) samples.shift();
        if (samples.length < 2) return;
        const ns = 'http://www.w3.org/2000/svg';
        const chart = document.createElementNS(ns, 'svg');
        chart.setAttribute('viewBox', '0 0 600 170'); chart.setAttribute('class', 'health-chart');
        chart.setAttribute('role', 'img'); chart.setAttribute('aria-label', `Thời gian kiểm tra theo thứ tự: ${samples.join(', ')} ms`);
        const maximum = Math.max(...samples, 1) * 1.2;
        const points = samples.map((value, index) => [20 + index * 560 / (samples.length - 1), 150 - value / maximum * 130]);
        const line = document.createElementNS(ns, 'polyline');
        line.setAttribute('points', points.map(point => point.join(',')).join(' '));
        line.setAttribute('fill', 'none'); line.setAttribute('stroke', 'currentColor'); line.setAttribute('stroke-width', '3');
        chart.append(line);
        points.forEach(([x, y]) => {
            const dot = document.createElementNS(ns, 'circle');
            dot.setAttribute('cx', x); dot.setAttribute('cy', y); dot.setAttribute('r', '4'); dot.setAttribute('fill', 'currentColor'); chart.append(dot);
        });
        $('latencyChart').className = ''; $('latencyChart').replaceChildren(chart);
        $('latencyRange').textContent = `${samples.length} lần thành công gần nhất · Thấp nhất ${Math.min(...samples)} ms · Cao nhất ${Math.max(...samples)} ms`;
    });
})();
