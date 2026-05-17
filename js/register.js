/**
 * register.js — หน้าลงทะเบียนพนักงานใหม่
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
    form: document.getElementById('form'),
    name: document.getElementById('f-name'),
    dept: document.getElementById('f-dept'),
    phone: document.getElementById('f-phone'),
    submitBtn: document.getElementById('submit-btn'),
    statusLine: document.getElementById('status-line'),
    success: document.getElementById('success'),
    successDetail: document.getElementById('success-detail'),
    doneBtn: document.getElementById('done-btn'),
  };

  function show(name) {
    ['loading', 'error', 'form', 'success'].forEach(function (s) {
      el[s].classList.toggle('hidden', s !== name);
    });
  }

  async function submit() {
    if (busy) return;
    if (!el.name.value.trim()) {
      alert('กรุณากรอกชื่อ-นามสกุล');
      return;
    }
    busy = true;
    el.submitBtn.disabled = true;
    el.statusLine.textContent = 'กำลังส่ง...';
    try {
      var res = await API.call('register', {
        line_user_id: userId,
        name: el.name.value.trim(),
        department: el.dept.value.trim(),
        phone: el.phone.value.trim(),
      });
      el.successDetail.textContent = 'รหัสพนักงานของคุณคือ ' + res.emp_id +
        '\nกรุณารอ HR อนุมัติ แล้วจึงเริ่มลงเวลาได้';
      show('success');
    } catch (e) {
      el.statusLine.textContent = '';
      el.submitBtn.disabled = false;
      alert(e.message || 'เกิดข้อผิดพลาด');
    } finally {
      busy = false;
    }
  }

  async function start() {
    show('loading');
    try {
      userId = await window.initUser();
      // ถ้าลงทะเบียนแล้ว ไม่ต้องให้กรอกซ้ำ
      var me = await API.call('getMe', { line_user_id: userId });
      if (me.registered) {
        el.errorMsg.textContent = me.status === 'pending'
          ? 'คุณลงทะเบียนแล้ว กำลังรอ HR อนุมัติ'
          : 'บัญชีนี้ลงทะเบียนแล้ว (' + me.name + ')';
        show('error');
        return;
      }
      show('form');
    } catch (e) {
      el.errorMsg.textContent = e.message || 'เริ่มต้นระบบไม่สำเร็จ';
      show('error');
    }
  }

  el.submitBtn.addEventListener('click', submit);
  el.retryBtn.addEventListener('click', start);
  el.doneBtn.addEventListener('click', function () {
    if (typeof liff !== 'undefined' && liff.isInClient && liff.isInClient()) {
      liff.closeWindow();
    } else {
      window.location.href = 'index.html';
    }
  });

  start();
})();
