(() => {
  /* 관리자 전용 메뉴 숨김 해제: 아래 블록 주석 처리 — 비관리자에게도 장비 설정/데이터 관리/계정 관리 메뉴 표시 */
  // function hideAdminOnly() {
  //   const targets = document.querySelectorAll('[data-requires-admin]');
  //   if (!targets.length) return;
  //   targets.forEach((el) => { el.style.display = 'none'; });
  // }
  // async function applyAdminVisibility() {
  //   const targets = document.querySelectorAll('[data-requires-admin]');
  //   if (!targets.length) return;
  //   try {
  //     const res = await fetch('/api/auth/me', { credentials: 'include' });
  //     const data = await res.json();
  //     const role = data.user?.role != null ? String(data.user.role).toLowerCase() : '';
  //     if (!data.success || !data.user || role !== 'admin') {
  //       hideAdminOnly();
  //       return;
  //     }
  //   } catch (_) {
  //     hideAdminOnly();
  //   }
  // }

  function initNavHover() {
    const groups = Array.from(document.querySelectorAll('.nav-group'));
    if (!groups.length) return;
    groups.forEach((group) => {
      group.open = false;
      const summary = group.querySelector('summary');
      const sub = group.querySelector('.nav-sub');
      if (!summary) return;
      group.addEventListener('mouseenter', () => {
        group.open = true;
      });
      group.addEventListener('mouseleave', () => {
        group.open = false;
      });
      summary.addEventListener('click', (e) => {
        e.preventDefault();
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // applyAdminVisibility(); // 관리자 전용 메뉴 숨김 해제로 주석 처리
      initNavHover();
    });
  } else {
    // applyAdminVisibility(); // 관리자 전용 메뉴 숨김 해제로 주석 처리
    initNavHover();
  }
})();
