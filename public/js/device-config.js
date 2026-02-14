(function () {
  var currentUser = null;
  var editingId = null;

  async function loadUser() {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await res.json();
      if (!data.success) { window.location.href = '/'; return; }
      currentUser = data.user || null;
      var u = currentUser;
      document.getElementById('userName').textContent = (u?.display_name || u?.username || '-') + (u?.email ? ' (' + u.email + ') 님 환영합니다' : '');

      if (!currentUser || currentUser.role !== 'admin') {
        document.getElementById('deviceNoPermission').style.display = 'block';
        document.getElementById('deviceGrid').style.display = 'none';
        return;
      }
      document.getElementById('deviceNoPermission').style.display = 'none';
      document.getElementById('deviceGrid').style.display = 'grid';
    } catch (_) {
      window.location.href = '/';
    }
  }

  function escapeHtml(s) {
    if (s === undefined || s === null) return '';
    const div = document.createElement('div');
    div.textContent = String(s);
    return div.innerHTML;
  }

  function typeLabel(t) {
    if (t === 'router') return '라우터';
    if (t === 'switch') return '스위치';
    if (t === 'server') return '서버';
    return '기타';
  }
  function roleLabel(r) {
    if (r === 'hq') return 'hq';
    if (r === 'research') return 'research';
    if (r === 'datacenter') return 'datacenter';
    if (r === 'control') return 'control';
    return 'other';
  }

  async function loadAssets() {
    const tbody = document.getElementById('deviceTableBody');
    if (!currentUser || currentUser.role !== 'admin') return;
    try {
      const res = await fetch('/api/assets', { credentials: 'include' });
      const data = await res.json();
      if (!data.success) {
        tbody.innerHTML = '<tr><td colspan="6">목록 조회 실패</td></tr>';
        return;
      }
      const assets = data.assets || [];
      if (!assets.length) {
        tbody.innerHTML = '<tr><td colspan="6">등록된 장비가 없습니다.</td></tr>';
        return;
      }
      tbody.innerHTML = assets.map(function (a) {
        return '<tr>' +
          '<td>' + escapeHtml(a.device_id || '-') + '</td>' +
          '<td>' + escapeHtml(a.ip || '-') + '</td>' +
          '<td>' + escapeHtml(typeLabel(a.type)) + '</td>' +
          '<td>' + escapeHtml(roleLabel(a.role)) + '</td>' +
          '<td>' + escapeHtml(a.location || '-') + '</td>' +
          '<td>' +
            '<button type="button" class="btn-mini btn-icon-only" data-action="edit" data-id="' + a.id + '" data-device_id="' + escapeHtml(a.device_id) + '" data-ip="' + escapeHtml(a.ip) + '" data-type="' + escapeHtml(a.type || 'other') + '" data-role="' + escapeHtml(a.role || '') + '" data-location="' + escapeHtml(a.location || '') + '" aria-label="수정" title="수정"><svg class="icon" aria-hidden="true"><use href="/icons/sprite.svg#icon-pencil"/></svg></button>' +
            ' ' +
            '<button type="button" class="btn-mini danger btn-icon-only" data-action="delete" data-id="' + a.id + '" aria-label="삭제" title="삭제"><svg class="icon" aria-hidden="true"><use href="/icons/sprite.svg#icon-trash-2"/></svg></button>' +
          '</td>' +
        '</tr>';
      }).join('');

      tbody.querySelectorAll('button[data-action="edit"]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          editingId = btn.getAttribute('data-id');
          document.getElementById('formTitle').textContent = '장비 수정';
          document.getElementById('deviceId').value = editingId;
          document.getElementById('deviceName').value = btn.getAttribute('data-device_id') || '';
          document.getElementById('deviceIp').value = btn.getAttribute('data-ip') || '';
          document.getElementById('deviceType').value = btn.getAttribute('data-type') || 'other';
          document.getElementById('deviceGroup').value = btn.getAttribute('data-role') || 'other';
          document.getElementById('deviceLocation').value = btn.getAttribute('data-location') || '';
          document.getElementById('cancelEditBtn').style.display = 'inline-block';
        });
      });
      tbody.querySelectorAll('button[data-action="delete"]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          const id = btn.getAttribute('data-id');
          if (!id || !confirm('이 장비를 삭제할까요?')) return;
          await fetch('/api/assets/' + encodeURIComponent(id), { method: 'DELETE', credentials: 'include' });
          loadAssets();
        });
      });
    } catch (_) {
      tbody.innerHTML = '<tr><td colspan="6">목록을 불러올 수 없습니다.</td></tr>';
    }
  }

  function resetForm() {
    editingId = null;
    document.getElementById('deviceId').value = '';
    document.getElementById('deviceName').value = '';
    document.getElementById('deviceIp').value = '';
    document.getElementById('deviceType').value = 'router';
    document.getElementById('deviceGroup').value = 'other';
    document.getElementById('deviceLocation').value = '';
    document.getElementById('formTitle').textContent = '장비 추가';
    document.getElementById('cancelEditBtn').style.display = 'none';
  }

  document.getElementById('deviceForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const name = document.getElementById('deviceName').value.trim();
    const ip = document.getElementById('deviceIp').value.trim();
    const type = document.getElementById('deviceType').value;
    const role = document.getElementById('deviceGroup').value.trim();
    const location = document.getElementById('deviceLocation').value.trim();
    const msg = document.getElementById('deviceFormMsg');
    if (!name || !ip) {
      msg.textContent = '장비명과 IP 주소는 필수입니다.';
      return;
    }
    try {
      const body = JSON.stringify({ device_id: name, ip, type, role, location });
      if (editingId) {
        await fetch('/api/assets/' + encodeURIComponent(editingId), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body
        });
        msg.textContent = '수정되었습니다.';
      } else {
        await fetch('/api/assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body
        });
        msg.textContent = '추가되었습니다.';
      }
      resetForm();
      loadAssets();
    } catch (_) {
      msg.textContent = '저장 실패. 서버를 확인하세요.';
    }
  });

  document.getElementById('cancelEditBtn').addEventListener('click', resetForm);
  document.getElementById('logoutBtn').addEventListener('click', async function () {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/';
  });

  loadUser().then(function () {
    if (currentUser && currentUser.role === 'admin') loadAssets();
  });
})();
