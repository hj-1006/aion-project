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
      var name = currentUser?.display_name || currentUser?.username || '-';
      var email = currentUser?.email || '';
      document.getElementById('userName').textContent = name + (email ? ' (' + email + ') 님 환영합니다' : '');
      var welcomeEl = document.getElementById('welcomeMsg');
      if (welcomeEl) welcomeEl.textContent = (email ? email + ' · ' : '') + name + ' 님 환영합니다.';

      if (!currentUser || !currentUser.can_use_mail) {
        document.getElementById('mailNoPermission').style.display = 'block';
        document.getElementById('mailTabs').style.display = 'none';
        document.querySelector('.mail-scroll').style.display = 'none';
        return;
      }
      document.getElementById('mailNoPermission').style.display = 'none';
      document.getElementById('mailInboxWrap').style.display = 'block';
      document.getElementById('mailTabs').style.display = 'flex';
      document.querySelector('.mail-scroll').style.display = 'block';
      setActiveTab('send');
      loadMailList();
    } catch (_) {
      window.location.href = '/';
    }
  }

  async function loadSmtpStatus() {
    if (!currentUser || !currentUser.can_use_mail) return;
    const badge = document.getElementById('smtpBadge');
    try {
      const res = await fetch('/api/mail/status', { credentials: 'include' });
      const data = await res.json();
      if (data.success && data.configured) {
        badge.textContent = 'SMTP 설정됨';
        badge.className = 'smtp-badge ok';
      } else {
        badge.textContent = data.message || 'SMTP 미설정';
        badge.className = 'smtp-badge off';
      }
    } catch (_) {
      badge.textContent = '연결 실패';
      badge.className = 'smtp-badge off';
    }
  }

  document.getElementById('mailForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const to = document.getElementById('to').value.trim();
    const subject = document.getElementById('subject').value.trim();
    const body = document.getElementById('body').value.trim();
    const resultEl = document.getElementById('mailResult');
    const sendBtn = document.getElementById('sendBtn');

    if (!to || !subject) {
      resultEl.style.display = 'block';
      resultEl.className = 'mail-status error';
      resultEl.textContent = '수신 주소와 제목을 입력하세요.';
      return;
    }

    sendBtn.disabled = true;
    resultEl.style.display = 'none';

    try {
      const res = await fetch('/api/mail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ to, subject, text: body })
      });
      const data = await res.json();
      resultEl.style.display = 'block';
      if (data.success) {
        resultEl.className = 'mail-status success';
        resultEl.textContent = data.message || '발송되었습니다.';
        loadMailList();
      } else {
        resultEl.className = 'mail-status error';
        resultEl.textContent = data.message || '발송에 실패했습니다.';
      }
    } catch (err) {
      resultEl.style.display = 'block';
      resultEl.className = 'mail-status error';
      resultEl.textContent = '연결 오류. 서버를 확인하세요.';
    } finally {
      sendBtn.disabled = false;
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', async function () {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/';
  });

  var INBOX_PAGE_SIZE = 20;
  var currentFolder = 'received';
  var currentPage = 1;
  var currentTotal = 0;

  function renderMailTable(list, totalCount) {
    var tbody = document.getElementById('mailInboxBody');
    var totalEl = document.getElementById('mailInboxTotal');
    if (!tbody) return;
    var count = totalCount != null ? totalCount : (list ? list.length : 0);
    if (totalEl) totalEl.textContent = '총 ' + count + '건';
    if (!list || list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4">저장된 메일이 없습니다.</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(function (m) {
      var date = m.created_at ? String(m.created_at).replace('T', ' ').substring(0, 19) : '-';
      return '<tr data-id="' + (m.id || '') + '"><td>' + (m.from_address || '-') + '</td><td>' + (m.to_address || '-') + '</td><td>' + (m.subject || '-') + '</td><td class="col-date">' + date + '</td></tr>';
    }).join('');
    tbody.querySelectorAll('tr[data-id]').forEach(function (tr) {
      tr.addEventListener('click', function () {
        var id = tr.getAttribute('data-id');
        if (id) loadMailDetail(id);
      });
    });
  }

  function renderPagination(total, page, limit) {
    var container = document.getElementById('mailPagination');
    if (!container) return;
    var totalPages = Math.max(1, Math.ceil(total / limit));
    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }
    var pages = [];
    for (var p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || (p >= page - 2 && p <= page + 2)) pages.push(p);
      else if (pages[pages.length - 1] !== '…') pages.push('…');
    }
    var html = '';
    html += '<button type="button" class="mail-page-prev" data-page="' + (page - 1) + '"' + (page <= 1 ? ' disabled' : '') + '>이전</button>';
    pages.forEach(function (p) {
      if (p === '…') html += '<span class="mail-page-ellipsis">…</span>';
      else html += '<button type="button" class="mail-page-num' + (p === page ? ' active' : '') + '" data-page="' + p + '">' + p + '</button>';
    });
    html += '<button type="button" class="mail-page-next" data-page="' + (page + 1) + '"' + (page >= totalPages ? ' disabled' : '') + '>다음</button>';
    container.innerHTML = html;
    container.querySelectorAll('button[data-page]').forEach(function (btn) {
      if (btn.disabled) return;
      btn.addEventListener('click', function () {
        var p = parseInt(btn.getAttribute('data-page'), 10);
        if (p >= 1) loadMailList(currentFolder, p, document.getElementById('mailSearch').value.trim());
      });
    });
  }

  function setActiveTab(tab) {
    const tabSend = document.getElementById('mailTabSend');
    const tabInbox = document.getElementById('mailTabInbox');
    const secSend = document.getElementById('mailSectionSend');
    const secInbox = document.getElementById('mailSectionInbox');
    if (tab === 'inbox') {
      tabInbox.classList.add('active');
      tabSend.classList.remove('active');
      secInbox.style.display = 'block';
      secSend.style.display = 'none';
    } else {
      tabSend.classList.add('active');
      tabInbox.classList.remove('active');
      secSend.style.display = 'block';
      secInbox.style.display = 'none';
    }
  }

  function loadMailList(folder, page, search) {
    if (!currentUser || !currentUser.can_use_mail) return;
    if (folder !== undefined) currentFolder = folder;
    if (page !== undefined) currentPage = page;
    if (search === undefined) search = document.getElementById('mailSearch').value.trim();
    var tbody = document.getElementById('mailInboxBody');
    var q = 'folder=' + encodeURIComponent(currentFolder) + '&page=' + currentPage + '&limit=' + INBOX_PAGE_SIZE;
    if (search) q = 'search=' + encodeURIComponent(search) + '&' + q;
    var opts = { credentials: 'include' };
    if (tbody) tbody.innerHTML = '<tr><td colspan="4">로딩 중...</td></tr>';
    document.getElementById('mailPagination').innerHTML = '';
    fetch('/api/mail/inbox?' + q, opts)
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (result) {
        if (!result.ok && result.data && result.data.message) {
          if (tbody) tbody.innerHTML = '<tr><td colspan="4">' + (result.data.message || '목록을 불러올 수 없습니다.') + '</td></tr>';
          document.getElementById('mailInboxTotal').textContent = '';
          return;
        }
        var data = result.data;
        var list = (data && data.list) || [];
        var total = (data && data.total) != null ? data.total : 0;
        currentTotal = total;
        renderMailTable(list, total);
        renderPagination(total, data.page || currentPage, data.limit || INBOX_PAGE_SIZE);
        document.querySelectorAll('.mail-category').forEach(function (btn) {
          btn.classList.toggle('active', btn.getAttribute('data-folder') === currentFolder);
        });
      })
      .catch(function () {
        if (tbody) tbody.innerHTML = '<tr><td colspan="4">목록을 불러올 수 없습니다.</td></tr>';
        document.getElementById('mailInboxTotal').textContent = '';
      });
  }

  function loadMailDetail(id) {
    fetch('/api/mail/' + id, { credentials: 'include' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var item = data.item;
        if (!item) return;
        document.getElementById('mailDetailSubject').textContent = item.subject || '(제목 없음)';
        document.getElementById('mailDetailMeta').innerHTML = '발신: ' + (item.from_address || '-') + '<br>수신: ' + (item.to_address || '-') + '<br>날짜: ' + (item.created_at || '-');
        document.getElementById('mailDetailBody').textContent = item.body_text || '(본문 없음)';
        document.getElementById('mailDetailModal').classList.add('show');
      })
      .catch(function () {});
  }

  document.getElementById('mailSearchBtn').addEventListener('click', function () {
    loadMailList(currentFolder, 1, document.getElementById('mailSearch').value.trim());
  });
  document.getElementById('mailRefreshBtn').addEventListener('click', function () {
    loadMailList(currentFolder, currentPage, document.getElementById('mailSearch').value.trim());
  });
  document.getElementById('mailSearch').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); loadMailList(currentFolder, 1, this.value.trim()); }
  });
  document.getElementById('mailCategoryReceived').addEventListener('click', function () {
    loadMailList('received', 1);
  });
  document.getElementById('mailCategorySent').addEventListener('click', function () {
    loadMailList('sent', 1);
  });
  document.getElementById('mailDetailClose').addEventListener('click', function () {
    document.getElementById('mailDetailModal').classList.remove('show');
  });
  document.getElementById('mailDetailModal').addEventListener('click', function (e) {
    if (e.target === document.getElementById('mailDetailModal')) document.getElementById('mailDetailModal').classList.remove('show');
  });

  document.getElementById('mailTabSend').addEventListener('click', function () {
    setActiveTab('send');
  });
  document.getElementById('mailTabInbox').addEventListener('click', function () {
    setActiveTab('inbox');
  });
  loadUser().then(function () {
    if (currentUser && currentUser.can_use_mail) loadSmtpStatus();
  });
})();
