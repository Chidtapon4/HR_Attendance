/**
 * config.js — ค่าตั้งของหน้าเว็บ
 * แก้ 2 ค่านี้หลัง deploy (ดูขั้นตอนใน docs/SETUP.md)
 */
window.APP_CONFIG = {
  // LIFF ID จาก LINE Developers Console
  LIFF_ID: '2010106208-4YvH4UGf',

  // URL ของ Apps Script Web App (ลงท้ายด้วย /exec)
  API_URL: 'https://script.google.com/macros/s/AKfycbxJFTpQ8fr7FwsB9rYX9Cl9fafKXdk3s_km1aJoORxPTdSMX3-CPG56i-QwpvzP4IaYmw/exec',

  // โหมดทดสอบบนเครื่อง (ไม่ผ่าน LINE) — ตั้ง true เพื่อใช้ MOCK_USER_ID แทน
  DEV_MODE: false,
  MOCK_USER_ID: 'Udev0000000000000000000000000000',
};
