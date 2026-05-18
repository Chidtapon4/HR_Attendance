/**
 * checkin.js — ตรรกะหน้าลงเวลา
 *
 * ลำดับ: เริ่ม LIFF > ดึงสถานะ > แสดงปุ่ม > กดปุ่ม > ขอ GPS/เซลฟี่ > ส่ง API
 */
(function () {
  'use strict';

  var userId = null;
  var status = null;       // ผลจาก getStatus
  var busy = false;

  // --- อ้างอิง element ---
  var el = {
    loading: document.getElementById('loading'),
    error: document.getElementById('error'),
    errorMsg: document.getElementById('error-msg'),
    retryBtn: document.getElementById('retry-btn'),
    main: document.getElementById('main'),
    empName: document.getElementById('emp-name'),
    empDept: document.getElementById('emp-dept'),
    clockTime: document.getElementById('clock-time'),
    clockDate: document.getElementById('clock-date'),
    summary: document.getElementById('today-summary'),
    actionBtn: document.getElementById('action-btn'),
    statusLine: document.getElementById('status-line'),
    success: document.getElementById('success'),
    successTitle: document.getElementById('success-title'),
    successDetail: document.getElementById('success-detail'),
    doneBtn: document.getElementById('done-btn'),
    selfieInput: document.getElementById('selfie-input'),
    registerLink: document.getElementById('register-link'),
    navApprove: document.getElementById('nav-approve'),
  };

  // --- สลับหน้า ---
  function show(name) {
    ['loading', 'error', 'main', 'success'].forEach(function (s) {
      el[s].classList.toggle('hidden', s !== name);
    });
  }

  function showError(msg) {
    el.errorMsg.textContent = msg;
    // ยังไม่ได้ลงทะเบียน -> โชว์ปุ่มลงทะเบียน
    var notRegistered = msg && msg.indexOf('ลงทะเบียน') >= 0;
    el.registerLink.classList.toggle('hidden', !notRegistered);
    show('error');
  }

  // --- นาฬิกาเดินจริง ---
  var TH_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  var TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function tickClock() {
    var d = new Date();
    el.clockTime.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()) +
      ':' + pad(d.getSeconds());
    el.clockDate.textContent = 'วัน' + TH_DAYS[d.getDay()] + ' ' + d.getDate() +
      ' ' + TH_MONTHS[d.getMonth()] + ' ' + (d.getFullYear() + 543);
  }

  // --- ขอพิกัด GPS ---
  function getLocation() {
    return new Promise(function (resolve, reject) {
      if (!navigator.geolocation) {
        return reject(new Error('อุปกรณ์นี้ไม่รองรับ GPS'));
      }
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            gps_accuracy: Math.round(pos.coords.accuracy),
          });
        },
        function () {
          reject(new Error('เปิดการเข้าถึงตำแหน่งไม่สำเร็จ กรุณาอนุญาต GPS'));
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  }

  // --- ถ่ายเซลฟี่ + ย่อรูปให้เล็ก (~ไม่เกิน 800px, JPEG) ---
  function getSelfie() {
    return new Promise(function (resolve, reject) {
      el.selfieInput.value = '';
      el.selfieInput.onchange = function () {
        var file = el.selfieInput.files[0];
        if (!file) return reject(new Error('ไม่ได้ถ่ายรูป'));
        var reader = new FileReader();
        reader.onload = function () {
          var img = new Image();
          img.onload = function () {
            var max = 800;
            var scale = Math.min(1, max / Math.max(img.width, img.height));
            var canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
          };
          img.onerror = function () { reject(new Error('อ่านรูปไม่สำเร็จ')); };
          img.src = reader.result;
        };
        reader.onerror = function () { reject(new Error('อ่านไฟล์ไม่สำเร็จ')); };
        reader.readAsDataURL(file);
      };
      el.selfieInput.click();
    });
  }

  // --- แสดงสรุปวันนี้ + ปรับปุ่ม ---
  function renderStatus() {
    el.empName.textContent = status.name;
    el.empDept.textContent = status.department || '';
    el.navApprove.classList.toggle('hidden', !status.is_approver);

    var html = '';
    var inRec = status.records.filter(function (r) { return r.type === 'check_in'; })[0];
    var outRec = status.records.filter(function (r) { return r.type === 'check_out'; })[0];

    html += summaryRow('เข้างาน', inRec);
    html += summaryRow('ออกงาน', outRec);
    el.summary.innerHTML = html;

    var btn = el.actionBtn;
    btn.classList.remove('btn-out');
    btn.disabled = false;
    if (status.next_action === 'check_in') {
      btn.textContent = 'ลงเวลา';
    } else if (status.next_action === 'check_out') {
      btn.textContent = 'ลงเวลาออกงาน';
      btn.classList.add('btn-out');
    } else {
      btn.textContent = 'ลงเวลาครบแล้ววันนี้';
      btn.disabled = true;
    }
    el.statusLine.textContent = '';
  }

  function summaryRow(label, rec) {
    var val = 'ยังไม่ลงเวลา', cls = '';
    if (rec) {
      var time = String(rec.timestamp).split(' ')[1] || rec.timestamp;
      val = time;
      if (rec.status === 'late') {
        val += ' (สาย ' + rec.late_minutes + ' น.)';
        cls = 'tag-late';
      } else if (rec.status === 'early_leave') {
        val += ' (ออกก่อน)';
        cls = 'tag-late';
      } else {
        cls = 'tag-ok';
      }
    }
    return '<div class="summary-row"><span>' + label +
      '</span><span class="val ' + cls + '">' + val + '</span></div>';
  }

  // --- กดปุ่มลงเวลา ---
  async function onAction() {
    if (busy) return;
    busy = true;
    el.actionBtn.disabled = true;

    try {
      var payload = { line_user_id: userId, device_info: navigator.userAgent };

      if (status.require_gps) {
        el.statusLine.textContent = 'กำลังระบุตำแหน่ง...';
        var loc = await getLocation();
        payload.lat = loc.lat;
        payload.lng = loc.lng;
        payload.gps_accuracy = loc.gps_accuracy;
      }

      if (status.require_selfie) {
        el.statusLine.textContent = 'กรุณาถ่ายเซลฟี่...';
        payload.photo = await getSelfie();
      }

      el.statusLine.textContent = 'กำลังบันทึก...';
      var result = await API.call('checkin', payload);
      renderSuccess(result);
    } catch (e) {
      el.statusLine.textContent = '';
      el.actionBtn.disabled = false;
      alert(e.message || 'เกิดข้อผิดพลาด');
    } finally {
      busy = false;
    }
  }

  function renderSuccess(result) {
    var isIn = result.type === 'check_in';
    el.successTitle.textContent = isIn ? 'ลงเวลาเข้างานสำเร็จ' : 'ลงเวลาออกงานสำเร็จ';
    var time = String(result.timestamp).split(' ')[1] || result.timestamp;
    var detail = 'เวลา ' + time;
    if (result.status === 'late') {
      detail += ' · สาย ' + result.late_minutes + ' นาที';
    } else if (result.status === 'early_leave') {
      detail += ' · ออกก่อนเวลา';
    } else {
      detail += ' · ตรงเวลา';
    }
    if (result.loc_name) {
      detail += '\n' + result.loc_name + ' (ห่าง ' + result.distance_m + ' ม.)';
    }
    el.successDetail.textContent = detail;
    show('success');
  }

  // --- โหลดสถานะใหม่ ---
  async function loadStatus() {
    show('loading');
    try {
      status = await API.call('getStatus', { line_user_id: userId });
      renderStatus();
      show('main');
    } catch (e) {
      showError(e.message);
    }
  }

  // --- เริ่มต้น ---
  async function start() {
    show('loading');
    try {
      userId = await window.initUser();
      await loadStatus();
    } catch (e) {
      showError(e.message || 'เริ่มต้นระบบไม่สำเร็จ');
    }
  }

  el.actionBtn.addEventListener('click', onAction);
  el.retryBtn.addEventListener('click', start);
  el.doneBtn.addEventListener('click', function () {
    if (window.APP_CONFIG.DEV_MODE) { loadStatus(); return; }
    if (typeof liff !== 'undefined' && liff.isInClient && liff.isInClient()) {
      liff.closeWindow();
    } else {
      loadStatus();
    }
  });

  tickClock();
  setInterval(tickClock, 1000);
  start();
})();
