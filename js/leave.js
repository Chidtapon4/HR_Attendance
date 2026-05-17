/**
 * leave.js — หน้าขอลา / ขอ OT + ดูคำขอของตัวเอง
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
    quotaLine: document.getElementById('quota-line'),
    statusLine: document.getElementById('status-line'),
    myRequests: document.getElementById('my-requests'),
    lvType: document.getElementById('lv-type'),
    lvFrom: document.getElementById('lv-from'),
    lvTo: document.getElementById('lv-to'),
    lvReason: document.getElementById('lv-reason'),
    lvSubmit: document.getElementById('lv-submit'),
    otDate: document.getElementById('ot-date'),
    otHours: document.getElementById('ot-hours'),
    otReason: document.getElementById('ot-reason'),
    otSubmit: document.getElementById('ot-submit'),
  };

  var STATUS_TH = {
    pending: { text: 'รออนุมัติ', cls: 'badge-pending' },
    approved: { text: 'อนุมัติแล้ว', cls: 'badge-ok' },
    rejected: { text: 'ไม่อนุมัติ', cls: 'badge-bad' },
  };

  function show(name) {
    ['loading', 'error', 'main'].forEach(function (s) {
      el[s].classList.toggle('hidden', s !== name);
    });
  }

  // --- สลับแท็บ ---
  document.querySelectorAll('.tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.tab').forEach(function (b) {
        b.classList.remove('active');
      });
      btn.classList.add('active');
      var tab = btn.getAttribute('data-tab');
      document.getElementById('tab-leave').classList.toggle('hidden', tab !== 'leave');
      document.getElementById('tab-ot').classList.toggle('hidden', tab !== 'ot');
    });
  });

  // --- แสดงรายการคำขอ ---
  function renderRequests(data) {
    el.quotaLine.textContent = 'วันลาคงเหลือ — พักร้อน ' + data.quota_annual +
      ' วัน · ป่วย ' + data.quota_sick + ' วัน';

    if (!data.requests.length) {
      el.myRequests.innerHTML = '<p class="empty">ยังไม่มีคำขอ</p>';
      return;
    }
    el.myRequests.innerHTML = data.requests.map(function (r) {
      var st = STATUS_TH[r.status] || { text: r.status, cls: '' };
      var title, detail;
      if (r.kind === 'leave') {
        title = r.type_label + ' ' + r.days + ' วัน';
        detail = r.date_from + (r.date_from !== r.date_to ? ' ถึง ' + r.date_to : '');
      } else {
        title = 'OT ' + r.hours + ' ชม.';
        detail = r.date;
      }
      return '<div class="req-item">' +
        '<div class="req-top"><span class="req-title">' + title + '</span>' +
        '<span class="badge ' + st.cls + '">' + st.text + '</span></div>' +
        '<div class="req-sub">' + detail + ' · ' + escapeHtml(r.reason) + '</div>' +
        '</div>';
    }).join('');
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  async function refreshRequests() {
    var data = await API.call('listMyRequests', { line_user_id: userId });
    renderRequests(data);
  }

  // --- ส่งคำขอลา ---
  async function submitLeave() {
    if (busy) return;
    if (!el.lvFrom.value || !el.lvTo.value) { alert('กรุณาเลือกวันที่'); return; }
    if (!el.lvReason.value.trim()) { alert('กรุณากรอกเหตุผล'); return; }
    busy = true; el.lvSubmit.disabled = true;
    el.statusLine.textContent = 'กำลังส่งคำขอลา...';
    try {
      await API.call('submitLeave', {
        line_user_id: userId,
        type: el.lvType.value,
        date_from: el.lvFrom.value,
        date_to: el.lvTo.value,
        reason: el.lvReason.value.trim(),
      });
      el.lvReason.value = '';
      el.statusLine.textContent = 'ส่งคำขอลาแล้ว รอการอนุมัติ';
      await refreshRequests();
    } catch (e) {
      el.statusLine.textContent = '';
      alert(e.message || 'เกิดข้อผิดพลาด');
    } finally {
      busy = false; el.lvSubmit.disabled = false;
    }
  }

  // --- ส่งคำขอ OT ---
  async function submitOT() {
    if (busy) return;
    if (!el.otDate.value) { alert('กรุณาเลือกวันที่'); return; }
    if (!el.otHours.value) { alert('กรุณากรอกจำนวนชั่วโมง'); return; }
    if (!el.otReason.value.trim()) { alert('กรุณากรอกเหตุผล'); return; }
    busy = true; el.otSubmit.disabled = true;
    el.statusLine.textContent = 'กำลังส่งคำขอ OT...';
    try {
      await API.call('submitOT', {
        line_user_id: userId,
        date: el.otDate.value,
        hours: el.otHours.value,
        reason: el.otReason.value.trim(),
      });
      el.otReason.value = '';
      el.statusLine.textContent = 'ส่งคำขอ OT แล้ว รอการอนุมัติ';
      await refreshRequests();
    } catch (e) {
      el.statusLine.textContent = '';
      alert(e.message || 'เกิดข้อผิดพลาด');
    } finally {
      busy = false; el.otSubmit.disabled = false;
    }
  }

  async function start() {
    show('loading');
    try {
      userId = await window.initUser();
      await refreshRequests();
      show('main');
    } catch (e) {
      el.errorMsg.textContent = e.message || 'เริ่มต้นระบบไม่สำเร็จ';
      show('error');
    }
  }

  el.lvSubmit.addEventListener('click', submitLeave);
  el.otSubmit.addEventListener('click', submitOT);
  el.retryBtn.addEventListener('click', start);

  start();
})();
