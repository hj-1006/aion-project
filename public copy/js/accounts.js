(function () {
  var currentUser = null;

  async function loadUser() {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await res.json();
      if (!data.success) {
        window.location.href = '/';
        return;
      }
      currentUser = data.user || null;
      var u = currentUser;
    document.getElementById('userName').textContent = (u?.display_name || u?.username || '-') + (u?.email ? ' (' + u.email + ') 님 환영합니다' : '');

      if (!currentUser || currentUser.role !== 'admin') {
        document.getElementById('accountsNoPermission').style.display = 'block';
        document.getElementById('accountsGrid').style.display = 'none';
        return;
      }
      document.getElementById('accountsNoPermission').style.display = 'none';
      document.getElementById('accountsGrid').style.display = 'grid';
    } catch (_) {
      window.location.href = '/';
    }
  }

  async function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    if (!currentUser || currentUser.role !== 'admin') return;
    try {
      const res = await fetch('/api/accounts', { credentials: 'include' });
      const data = await res.json();
      if (!data.success) {
        tbody.innerHTML = '<tr><td colspan="7">목록 조회 실패</td></tr>';
        return;
      }
      const users = data.users || [];
      if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">등록된 계정이 없습니다.</td></tr>';
        return;
      }
      var roleLabel = function (r) {
        if (r === 'admin') return '관리자';
        if (r === 'operator') return '운영';
        if (r === 'viewer') return '읽기전용';
        return '일반';
      };
      tbody.innerHTML = users.map(function (u) {
        var useMail = u.can_use_mail === 1 || u.can_use_mail === true;
        return '<tr><td>' + (u.id || '-') + '</td><td>' + (u.username || '-') + '</td><td>' + (u.display_name || '-') + '</td><td>' + roleLabel(u.role) + '</td><td>' + (u.email || '-') + '</td><td>' + (useMail ? '예' : '아니오') + '</td><td><button type="button" class="btn-edit" data-id="' + (u.id || '') + '" data-username="' + (u.username || '').replace(/"/g, '&quot;') + '" data-display_name="' + (u.display_name || '').replace(/"/g, '&quot;') + '" data-email="' + (u.email || '').replace(/"/g, '&quot;') + '" data-can_use_mail="' + (useMail ? '1' : '0') + '" data-role="' + (u.role || 'user') + '">수정</button></td></tr>';
      }).join('');

      tbody.querySelectorAll('.btn-edit').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-id');
          var username = btn.getAttribute('data-username') || '';
          document.getElementById('editId').value = id;
          document.getElementById('editUsername').textContent = '(' + username + ')';
          document.getElementById('edit_display_name').value = btn.getAttribute('data-display_name') || '';
          document.getElementById('edit_role').value = btn.getAttribute('data-role') || 'user';
          document.getElementById('edit_email').value = btn.getAttribute('data-email') || '';
          document.getElementById('edit_can_use_mail').checked = btn.getAttribute('data-can_use_mail') === '1';
          document.getElementById('editFormMsg').style.display = 'none';
          document.getElementById('editModal').classList.add('show');
        });
      });
    } catch (_) {
      tbody.innerHTML = '<tr><td colspan="7">연결 오류</td></tr>';
    }
  }

  document.getElementById('addAccountForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const display_name = document.getElementById('display_name').value.trim();
    const role = document.getElementById('role').value;
    const email = document.getElementById('email').value.trim();
    const can_use_mail = document.getElementById('can_use_mail').checked;
    const msgEl = document.getElementById('formMsg');
    const addBtn = document.getElementById('addBtn');

    if (!username || !password) {
      msgEl.className = 'form-msg error';
      msgEl.textContent = '아이디와 비밀번호를 입력하세요.';
      msgEl.style.display = 'block';
      return;
    }

    addBtn.disabled = true;
    msgEl.style.display = 'none';

    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password, display_name: display_name || null, role: role || 'user', email: email || null, can_use_mail: can_use_mail })
      });
      const data = await res.json();
      msgEl.style.display = 'block';
      if (data.success) {
        msgEl.className = 'form-msg success';
        msgEl.textContent = data.message || '계정이 추가되었습니다.';
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        document.getElementById('display_name').value = '';
        document.getElementById('email').value = '';
        document.getElementById('role').value = 'user';
        document.getElementById('can_use_mail').checked = false;
        loadUsers();
      } else {
        msgEl.className = 'form-msg error';
        msgEl.textContent = data.message || '추가 실패';
      }
    } catch (err) {
      msgEl.style.display = 'block';
      msgEl.className = 'form-msg error';
      msgEl.textContent = '연결 오류. 서버를 확인하세요.';
    } finally {
      addBtn.disabled = false;
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', async function () {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/';
  });

  function closeEditModal() {
    document.getElementById('editModal').classList.remove('show');
  }

  document.getElementById('editCancelBtn').addEventListener('click', closeEditModal);
  document.getElementById('editModal').addEventListener('click', function (e) {
    if (e.target === document.getElementById('editModal')) closeEditModal();
  });

  document.getElementById('editAccountForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var id = document.getElementById('editId').value;
    var display_name = document.getElementById('edit_display_name').value.trim();
    var role = document.getElementById('edit_role').value;
    var email = document.getElementById('edit_email').value.trim();
    var can_use_mail = document.getElementById('edit_can_use_mail').checked;
    var msgEl = document.getElementById('editFormMsg');
    var saveBtn = document.getElementById('editSaveBtn');

    saveBtn.disabled = true;
    msgEl.style.display = 'none';

    try {
      var res = await fetch('/api/accounts/' + encodeURIComponent(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ display_name: display_name || null, role: role || 'user', email: email || null, can_use_mail: can_use_mail })
      });
      var data = await res.json();
      msgEl.style.display = 'block';
      if (data.success) {
        msgEl.className = 'form-msg success';
        msgEl.textContent = data.message || '수정되었습니다.';
        loadUsers();
        setTimeout(closeEditModal, 800);
      } else {
        msgEl.className = 'form-msg error';
        msgEl.textContent = data.message || '수정 실패';
      }
    } catch (err) {
      msgEl.style.display = 'block';
      msgEl.className = 'form-msg error';
      msgEl.textContent = '연결 오류. 서버를 확인하세요.';
    } finally {
      saveBtn.disabled = false;
    }
  });

  loadUser().then(function () {
    if (currentUser && currentUser.role === 'admin') loadUsers();
  });
})();
