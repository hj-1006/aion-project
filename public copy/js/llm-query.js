async function loadUser() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    const data = await res.json();
    if (!data.success) { window.location.href = '/'; return; }
    var u = data.user;
    document.getElementById('userName').textContent = (u?.display_name || u?.username || '-') + (u?.email ? ' (' + u.email + ') 님 환영합니다' : '');
  } catch (_) { window.location.href = '/'; }
}
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  window.location.href = '/';
});

// 탭 전환: 일반 질의응답 / AI 네트워크 장비 원격제어
document.getElementById('tabChat').addEventListener('click', () => {
  document.getElementById('tabChat').classList.add('active');
  document.getElementById('tabNetwork').classList.remove('active');
  document.getElementById('panelChat').classList.add('active');
  document.getElementById('panelNetwork').classList.remove('active');
});
document.getElementById('tabNetwork').addEventListener('click', () => {
  document.getElementById('tabNetwork').classList.add('active');
  document.getElementById('tabChat').classList.remove('active');
  document.getElementById('panelNetwork').classList.add('active');
  document.getElementById('panelChat').classList.remove('active');
});

// 일반 질의응답 (가벼운 Q&A)
document.getElementById('chatBtn').addEventListener('click', submitChat);
document.getElementById('chatInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitChat();
});

function buildLogsText(data) {
  var parts = [];
  if (data.logs && data.logs.trim()) parts.push('[Python stderr]\n' + data.logs.trim());
  if (data.server_logs) {
    if (data.server_logs.exit_code !== undefined) parts.push('\n[server_logs] exit_code: ' + data.server_logs.exit_code);
    if (data.server_logs.stderr && data.server_logs.stderr.trim()) parts.push('stderr: ' + data.server_logs.stderr.trim());
    if (data.server_logs.stdout && data.server_logs.stdout.trim()) parts.push('stdout: ' + data.server_logs.stdout.trim());
  }
  return parts.length ? parts.join('\n') : '(로그 없음)';
}

async function submitChat() {
  const input = document.getElementById('chatInput');
  const btn = document.getElementById('chatBtn');
  const resultDiv = document.getElementById('chatResult');
  const output = document.getElementById('chatOutput');
  const errEl = document.getElementById('chatError');
  const logsWrap = document.getElementById('chatLogsWrap');
  const logsEl = document.getElementById('chatLogs');
  const withLogs = document.getElementById('chatWithLogs').checked;
  const text = (input.value || '').trim();
  if (!text) return;
  btn.disabled = true;
  resultDiv.style.display = 'block';
  output.textContent = 'AI 응답 대기 중... (최대 60초)';
  output.classList.remove('llm-error');
  errEl.style.display = 'none';
  logsWrap.style.display = 'none';
  logsEl.textContent = '';
  try {
    const url = withLogs ? '/api/llm/python-chat' : '/api/llm/chat';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ message: text })
    });
    const data = await res.json();
    if (data.success && (data.response != null || data.response === '')) {
      console.log('data: ',data);
      output.textContent = data.response || '(응답 없음)';
      if (withLogs) {
        logsWrap.style.display = 'block';
        logsEl.textContent = buildLogsText(data);
      }
    } else {
      errEl.textContent = data.error || data.message || '오류 발생';
      errEl.style.display = 'block';
      output.textContent = data.response != null ? data.response : '';
      if (withLogs) {
        logsWrap.style.display = 'block';
        logsEl.textContent = buildLogsText(data);
      }
    }
  } catch (err) {
    errEl.textContent = '연결 오류: ' + err.message;
    errEl.style.display = 'block';
    output.textContent = '';
  }
  btn.disabled = false;
}

document.getElementById('chatLogsToggle').addEventListener('click', () => {
  const pre = document.getElementById('chatLogs');
  pre.style.display = pre.style.display === 'none' ? 'block' : 'none';
});

// AI 네트워크 장비 원격제어
document.getElementById('submitBtn').addEventListener('click', submitQuery);
document.getElementById('questionInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitQuery();
});

async function submitQuery() {
  const input = document.getElementById('questionInput');
  const btn = document.getElementById('submitBtn');
  const area = document.getElementById('resultArea');
  const meta = document.getElementById('resultMeta');
  const output = document.getElementById('resultOutput');
  const summary = document.getElementById('resultSummary');
  const errEl = document.getElementById('resultError');
  const q = (input.value || '').trim();
  if (!q) return;
  btn.disabled = true;
  area.style.display = 'block';
  meta.textContent = 'LLM 해석 후 Ansible 실행 중...';
  output.textContent = '';
  summary.style.display = 'none';
  errEl.style.display = 'none';
  try {
    const res = await fetch('/api/llm/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ question: q, summarize: true })
    });
    const data = await res.json();
    meta.textContent = data.hostname && data.command
      ? '장비: ' + data.hostname + ' / 명령: ' + data.command
      : '';
    if (data.success) {
      output.textContent = data.output || '(출력 없음)';
      if (data.summary) {
        summary.style.display = 'block';
        summary.textContent = data.summary;
      }
    } else {
      errEl.textContent = data.error || data.message || '오류 발생';
      errEl.style.display = 'block';
      output.textContent = data.output || '';
    }
  } catch (err) {
    errEl.textContent = '연결 오류: ' + err.message;
    errEl.style.display = 'block';
  }
  btn.disabled = false;
}

loadUser();
