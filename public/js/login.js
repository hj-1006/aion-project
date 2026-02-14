document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const errEl = document.getElementById('loginError');
  errEl.style.display = 'none';
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      credentials: 'include'
    });
    const data = await res.json();
    if (data.success) {
      window.location.href = '/dashboard';
    } else {
      errEl.textContent = data.message || '로그인에 실패했습니다.';
      errEl.style.display = 'block';
    }
  } catch (err) {
    errEl.textContent = '연결 오류. 서버를 확인하세요.';
    errEl.style.display = 'block';
  }
});
