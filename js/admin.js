/**
 * admin.js — หน้าจัดการระบบสำหรับ HR
 *   แท็บ: Dashboard วันนี้ / รายงานรายเดือน / จัดการพนักงาน
 */
(function () {
  'use strict';

  var userId = null;
  var loaded = { dash: false, manage: false };
  var manageData = null;     // { employees, shifts }
  var reportRows = null;     // ผลรายงานล่าสุด (ไว้ทำ CSV)
  var reportMonth = '';

  var el = {
    loading: document.getElementById('loading'),
    error: document.getElementById('error'),
    errorMsg: document.getElementById('error-msg'),
    retryBtn: document.getElementById('retry-btn'),
    main: document.getElementById('main'),
    statusLine: document.getElementById('status-line'),
    dashSummary: document.getElementById('dash-summary'),
    dashList: document.getElementById('dash-list'),
    dashRefresh: document.getElementById('dash-refresh'),
    reportMonth: document.getElementById('report-month'),
    reportLoad: document.getElementById('report-load'),
    reportResult: document.getElementById('report-result'),
    reportCsv: document.getElementById('report-csv'),
    manageList: document.getElementById('manage-list'),
    manageRefresh: document.getElementById('manage-refresh'),
  };

  var STATUS_TH = {
    present: { text: 'มาตรงเวลา', cls: 'badge-ok' },
    late: { text: 'มาสาย', cls: 'badge-pending' },
    absent: { text: 'ยังไม่มา', cls: 'badge-bad' },
    leave: { text: 'ลา', cls: 'badge-neutral' },
  };
  var ROLE_TH = { employee: 'พนักงาน', manager: 'หัวหน้า', hr: 'HR' };
  var FLAG_TH = {
    low_accuracy: 'GPS แม่นยำต่ำ',
    device_change: 'เปลี่ยนเครื่อง',
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

  // --- สลับแท็บ ---
  document.querySelectorAll('.tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.tab').forEach(function (b) {
        b.classList.remove('active');
      });
      btn.classList.add('active');
      var tab = btn.getAttribute('data-tab');
      ['dash', 'report', 'manage'].forEach(function (t) {
        document.getElementById('tab-' + t).classList.toggle('hidden', t !== tab);
      });
      if (tab === 'dash' && !loaded.dash) loadDashboard();
      if (tab === 'manage' && !loaded.manage) loadManage();
    });
  });

  // ===== แท็บ Dashboard =====
  async function loadDashboard() {
    el.dashSummary.innerHTML = '<p class="empty">กำลังโหลด...</p>';
    el.dashList.innerHTML = '';
    try {
      var data = await API.call('getDashboard', { line_user_id: userId });
      var s = data.summary;
      el.dashSummary.innerHTML =
        statCard('ทั้งหมด', s.total, '') +
        statCard('มาตรงเวลา', s.present, 'stat-ok') +
        statCard('มาสาย', s.late, 'stat-warn') +
        statCard('ยังไม่มา', s.absent, 'stat-bad') +
        statCard('ลา', s.leave, '');

      if (!data.employees.length) {
        el.dashList.innerHTML = '<p class="empty">ไม่มีพนักงาน</p>';
      } else {
        el.dashList.innerHTML = data.employees.map(function (e) {
          var st = STATUS_TH[e.status] || { text: e.status, cls: '' };
          var time = '';
          if (e.check_in) {
            time = 'เข้า ' + e.check_in +
              (e.late_minutes ? ' (สาย ' + e.late_minutes + ' น.)' : '') +
              (e.check_out ? ' · ออก ' + e.check_out : '');
          }
          var flagHtml = '';
          if (e.flags) {
            e.flags.split(',').forEach(function (f) {
              if (!f) return;
              flagHtml += '<span class="flag-warn">⚠ ' +
                escapeHtml(FLAG_TH[f] || f) + '</span>';
            });
          }
          return '<div class="req-item">' +
            '<div class="req-top"><span class="req-title">' +
            escapeHtml(e.name) + flagHtml + '</span>' +
            '<span class="badge ' + st.cls + '">' + st.text + '</span></div>' +
            '<div class="req-sub">' + escapeHtml(e.department || '-') +
            (time ? ' · ' + time : '') + '</div></div>';
        }).join('');
      }
      loaded.dash = true;
    } catch (e) {
      el.dashSummary.innerHTML = '<p class="empty">' +
        escapeHtml(e.message || 'โหลดไม่สำเร็จ') + '</p>';
    }
  }
  function statCard(label, value, cls) {
    return '<div class="stat ' + cls + '">' +
      '<div class="stat-num">' + value + '</div>' +
      '<div class="stat-label">' + label + '</div></div>';
  }

  // ===== แท็บ รายงานเดือน =====
  async function loadReport() {
    var month = el.reportMonth.value;
    if (!month) { alert('กรุณาเลือกเดือน'); return; }
    el.reportResult.innerHTML = '<p class="empty">กำลังโหลด...</p>';
    el.reportCsv.classList.add('hidden');
    try {
      var data = await API.call('getMonthlyReport', {
        line_user_id: userId, month: month,
      });
      reportRows = data.employees;
      reportMonth = data.month;
      if (!reportRows.length) {
        el.reportResult.innerHTML = '<p class="empty">ไม่มีข้อมูล</p>';
        return;
      }
      var head = '<tr><th>ชื่อ</th><th>มา</th><th>สาย</th>' +
        '<th>นาทีสาย</th><th>ลา</th><th>OT</th></tr>';
      var body = reportRows.map(function (r) {
        return '<tr><td class="t-name">' + escapeHtml(r.name) + '</td>' +
          '<td>' + r.present_days + '</td>' +
          '<td>' + r.late_count + '</td>' +
          '<td>' + r.late_minutes + '</td>' +
          '<td>' + r.leave_days + '</td>' +
          '<td>' + r.ot_hours + '</td></tr>';
      }).join('');
      el.reportResult.innerHTML =
        '<p class="report-cap">รายงานเดือน ' + reportMonth +
        ' (มา = วันมาทำงาน, สาย = จำนวนครั้ง, ลา = วัน, OT = ชม.)</p>' +
        '<div class="table-wrap"><table class="rpt">' +
        head + body + '</table></div>';
      el.reportCsv.classList.remove('hidden');
    } catch (e) {
      el.reportResult.innerHTML = '<p class="empty">' +
        escapeHtml(e.message || 'โหลดไม่สำเร็จ') + '</p>';
    }
  }

  // สร้างไฟล์ CSV ที่ฝั่ง backend (เก็บใน Drive) แล้วเปิดลิงก์
  // — ดาวน์โหลดในแอป LINE ตรงๆ ไม่ได้ จึงต้องผ่าน Drive
  async function exportCsv() {
    if (!reportMonth) return;
    el.reportCsv.disabled = true;
    el.statusLine.textContent = 'กำลังสร้างไฟล์ CSV...';
    try {
      var res = await API.call('exportReportCsv', {
        line_user_id: userId, month: reportMonth,
      });
      el.statusLine.textContent = 'เปิดไฟล์ ' + res.name + ' แล้ว';
      openUrl(res.url);
    } catch (e) {
      el.statusLine.textContent = '';
      alert(e.message || 'สร้างไฟล์ไม่สำเร็จ');
    } finally {
      el.reportCsv.disabled = false;
    }
  }

  function openUrl(url) {
    if (typeof liff !== 'undefined' && liff.isInClient && liff.isInClient()) {
      liff.openWindow({ url: url, external: true });
    } else {
      window.open(url, '_blank');
    }
  }

  // ===== แท็บ จัดการพนักงาน =====
  async function loadManage() {
    el.manageList.innerHTML = '<p class="empty">กำลังโหลด...</p>';
    try {
      manageData = await API.call('listEmployees', { line_user_id: userId });
      renderManageList();
      loaded.manage = true;
    } catch (e) {
      el.manageList.innerHTML = '<p class="empty">' +
        escapeHtml(e.message || 'โหลดไม่สำเร็จ') + '</p>';
    }
  }

  function renderManageList() {
    if (!manageData.employees.length) {
      el.manageList.innerHTML = '<p class="empty">ไม่มีพนักงาน</p>';
      return;
    }
    el.manageList.innerHTML = manageData.employees.map(function (e) {
      return '<div class="req-item emp-card" data-emp="' +
        escapeHtml(e.emp_id) + '">' +
        '<div class="req-top emp-head"><span class="req-title">' +
        escapeHtml(e.name) + '</span>' +
        '<span class="req-sub">' + escapeHtml(e.emp_id) + ' · ' +
        (ROLE_TH[e.role] || e.role) + ' · ' + escapeHtml(e.status) +
        '</span></div></div>';
    }).join('');
  }

  // เปิดฟอร์มแก้ไขเมื่อกดที่การ์ดพนักงาน
  function onManageClick(e) {
    var head = e.target.closest('.emp-head');
    if (!head) return;
    var card = head.closest('.emp-card');
    var existing = card.querySelector('.emp-form');
    if (existing) { existing.remove(); return; }   // กดซ้ำ = ปิด
    card.querySelectorAll('.emp-form').forEach(function (f) { f.remove(); });
    var emp = manageData.employees.filter(function (x) {
      return String(x.emp_id) === card.getAttribute('data-emp');
    })[0];
    if (emp) card.appendChild(buildEditForm(emp));
  }

  function buildEditForm(emp) {
    var form = document.createElement('div');
    form.className = 'emp-form';

    var shiftOpts = manageData.shifts.map(function (s) {
      return opt(s.shift_id, s.shift_id + ' - ' + s.name, emp.shift_id);
    }).join('');
    var mgrOpts = '<option value="">— ไม่มี —</option>' +
      manageData.employees
        .filter(function (x) { return x.emp_id !== emp.emp_id; })
        .map(function (x) {
          return opt(x.emp_id, x.emp_id + ' - ' + x.name, emp.manager_id);
        }).join('');

    form.innerHTML =
      fieldText('ชื่อ-นามสกุล', 'name', emp.name) +
      fieldSelect('บทบาท', 'role',
        opt('employee', 'พนักงาน', emp.role) +
        opt('manager', 'หัวหน้า', emp.role) +
        opt('hr', 'HR', emp.role)) +
      fieldText('แผนก', 'department', emp.department) +
      fieldSelect('กะงาน', 'shift_id', shiftOpts) +
      fieldSelect('หัวหน้า', 'manager_id', mgrOpts) +
      fieldSelect('สถานะ', 'status',
        opt('active', 'ใช้งาน (active)', emp.status) +
        opt('inactive', 'ปิดใช้งาน (inactive)', emp.status) +
        opt('pending', 'รออนุมัติ (pending)', emp.status) +
        opt('rejected', 'ถูกปฏิเสธ (rejected)', emp.status)) +
      fieldNum('โควตาลาพักร้อน (วัน)', 'leave_quota_annual', emp.leave_quota_annual) +
      fieldNum('โควตาลาป่วย (วัน)', 'leave_quota_sick', emp.leave_quota_sick) +
      '<button class="btn btn-primary emp-save">บันทึก</button>';

    form.querySelector('.emp-save').addEventListener('click', function () {
      saveEmployee(emp.emp_id, form);
    });
    return form;
  }

  function opt(value, label, current) {
    return '<option value="' + escapeHtml(value) + '"' +
      (String(value) === String(current) ? ' selected' : '') + '>' +
      escapeHtml(label) + '</option>';
  }
  function fieldText(label, name, val) {
    return '<label class="field"><span>' + label + '</span>' +
      '<input type="text" data-f="' + name + '" value="' +
      escapeHtml(val) + '" /></label>';
  }
  function fieldNum(label, name, val) {
    return '<label class="field"><span>' + label + '</span>' +
      '<input type="number" min="0" data-f="' + name + '" value="' +
      escapeHtml(val) + '" /></label>';
  }
  function fieldSelect(label, name, options) {
    return '<label class="field"><span>' + label + '</span>' +
      '<select data-f="' + name + '">' + options + '</select></label>';
  }

  async function saveEmployee(empId, form) {
    var btn = form.querySelector('.emp-save');
    btn.disabled = true;
    el.statusLine.textContent = 'กำลังบันทึก...';
    var payload = { line_user_id: userId, emp_id: empId };
    form.querySelectorAll('[data-f]').forEach(function (inp) {
      payload[inp.getAttribute('data-f')] = inp.value;
    });
    try {
      await API.call('updateEmployee', payload);
      el.statusLine.textContent = 'บันทึกข้อมูล ' + empId + ' แล้ว';
      loaded.manage = false;
      await loadManage();
    } catch (e) {
      btn.disabled = false;
      el.statusLine.textContent = '';
      alert(e.message || 'บันทึกไม่สำเร็จ');
    }
  }

  // ===== เริ่มต้น =====
  async function start() {
    show('loading');
    try {
      userId = await window.initUser();
      var me = await API.call('getMe', { line_user_id: userId });
      if (!me.registered) throw new Error('ยังไม่ได้ลงทะเบียน');
      if (!me.is_hr) throw new Error('หน้านี้สำหรับ HR เท่านั้น');
      el.reportMonth.value = new Date().toISOString().slice(0, 7);
      show('main');
      loadDashboard();
    } catch (e) {
      el.errorMsg.textContent = e.message || 'เริ่มต้นระบบไม่สำเร็จ';
      show('error');
    }
  }

  el.dashRefresh.addEventListener('click', loadDashboard);
  el.reportLoad.addEventListener('click', loadReport);
  el.reportCsv.addEventListener('click', exportCsv);
  el.manageRefresh.addEventListener('click', function () {
    loaded.manage = false;
    loadManage();
  });
  el.manageList.addEventListener('click', onManageClick);
  el.retryBtn.addEventListener('click', start);

  start();
})();
