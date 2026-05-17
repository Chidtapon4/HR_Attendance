/**
 * approve.js — หน้าอนุมัติคำขอ (สำหรับ HR / หัวหน้า)
 *   - HR: อนุมัติพนักงานใหม่ + คำขอลา/OT ทั้งหมด
 *   - หัวหน้า: อนุมัติคำขอลา/OT เฉพาะลูกทีม
 */
(function () {
  'use strict';

  var userId = null;
  var busy = false;

  var el = {
    loading: document.getElementById('loading'),
    error: document.getElementById('error'),
    errorMsg: document.getElementById('error-msg'),
    retryBtn: document.getElementById('retry-btn'),
    main: document.getElementById('main'),
    empSection: document.getElementById('emp-section'),
    empList: document.getElementById('emp-list'),
    reqList: document.getElementById('req-list'),
    refreshBtn: document.getElementById('refresh-btn'),
  };

  function show(name) {
    ['loading', 'error', 'main'].forEach(function (s) {
      el[s].classList.toggle('hidden', s !== name);
    });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // --- วาดรายการพนักงานใหม่ ---
  function renderEmployees(list) {
    if (!list.length) {
      el.empList.innerHTML = '<p class="empty">ไม่มีพนักงานรออนุมัติ</p>';
      return;
    }
    el.empList.innerHTML = list.map(function (e) {
      return '<div class="req-item" data-emp="' + escapeHtml(e.emp_id) + '">' +
        '<div class="req-top"><span class="req-title">' + escapeHtml(e.name) +
        '</span><span class="req-sub">' + escapeHtml(e.emp_id) + '</span></div>' +
        '<div class="req-sub">' + escapeHtml(e.department || '-') +
        (e.phone ? ' · ' + escapeHtml(e.phone) : '') + '</div>' +
        '<div class="req-actions">' +
        '<button class="btn-sm btn-ok" data-act="emp-approve">อนุมัติ</button>' +
        '<button class="btn-sm btn-bad" data-act="emp-reject">ปฏิเสธ</button>' +
        '</div></div>';
    }).join('');
  }

  // --- วาดรายการคำขอลา/OT ---
  function renderRequests(list) {
    if (!list.length) {
      el.reqList.innerHTML = '<p class="empty">ไม่มีคำขอรออนุมัติ</p>';
      return;
    }
    el.reqList.innerHTML = list.map(function (r) {
      var title, detail;
      if (r.kind === 'leave') {
        title = r.emp_name + ' — ' + r.type_label + ' ' + r.days + ' วัน';
        detail = r.date_from + (r.date_from !== r.date_to ? ' ถึง ' + r.date_to : '');
      } else {
        title = r.emp_name + ' — OT ' + r.hours + ' ชม.';
        detail = r.date;
      }
      return '<div class="req-item" data-kind="' + r.kind +
        '" data-req="' + escapeHtml(r.req_id) + '">' +
        '<div class="req-top"><span class="req-title">' + escapeHtml(title) +
        '</span></div>' +
        '<div class="req-sub">' + escapeHtml(detail) + ' · ' +
        escapeHtml(r.reason) + '</div>' +
        '<div class="req-actions">' +
        '<button class="btn-sm btn-ok" data-act="req-approve">อนุมัติ</button>' +
        '<button class="btn-sm btn-bad" data-act="req-reject">ปฏิเสธ</button>' +
        '</div></div>';
    }).join('');
  }

  // --- จัดการคลิกปุ่มอนุมัติ/ปฏิเสธ (event delegation) ---
  async function onClick(e) {
    var btn = e.target.closest('button[data-act]');
    if (!btn || busy) return;
    var act = btn.getAttribute('data-act');
    var item = btn.closest('.req-item');

    var decision = act.indexOf('approve') >= 0 ? 'approve' : 'reject';
    if (decision === 'reject' && !confirm('ยืนยันปฏิเสธรายการนี้?')) return;

    busy = true;
    item.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
    try {
      if (act.indexOf('emp-') === 0) {
        await API.call('decideEmployee', {
          line_user_id: userId,
          emp_id: item.getAttribute('data-emp'),
          decision: decision,
        });
      } else {
        await API.call('decideRequest', {
          line_user_id: userId,
          kind: item.getAttribute('data-kind'),
          req_id: item.getAttribute('data-req'),
          decision: decision,
        });
      }
      item.remove();
      cleanupEmpty();
    } catch (err) {
      alert(err.message || 'เกิดข้อผิดพลาด');
      item.querySelectorAll('button').forEach(function (b) { b.disabled = false; });
    } finally {
      busy = false;
    }
  }

  function cleanupEmpty() {
    if (!el.empList.querySelector('.req-item') &&
        !el.empSection.classList.contains('hidden')) {
      el.empList.innerHTML = '<p class="empty">ไม่มีพนักงานรออนุมัติ</p>';
    }
    if (!el.reqList.querySelector('.req-item')) {
      el.reqList.innerHTML = '<p class="empty">ไม่มีคำขอรออนุมัติ</p>';
    }
  }

  async function load() {
    show('loading');
    try {
      var data = await API.call('listApprovals', { line_user_id: userId });
      el.empSection.classList.toggle('hidden', !data.is_hr);
      if (data.is_hr) renderEmployees(data.pending_employees);
      renderRequests(data.pending_requests);
      show('main');
    } catch (e) {
      el.errorMsg.textContent = e.message || 'โหลดข้อมูลไม่สำเร็จ';
      show('error');
    }
  }

  async function start() {
    show('loading');
    try {
      userId = await window.initUser();
      await load();
    } catch (e) {
      el.errorMsg.textContent = e.message || 'เริ่มต้นระบบไม่สำเร็จ';
      show('error');
    }
  }

  el.main.addEventListener('click', onClick);
  el.refreshBtn.addEventListener('click', load);
  el.retryBtn.addEventListener('click', start);

  start();
})();
