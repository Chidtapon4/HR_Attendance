/**
 * liff-init.js — เริ่ม LIFF และดึง LINE userId
 *
 * คืน promise เป็น userId ของผู้ใช้
 * ถ้า DEV_MODE = true จะข้าม LINE แล้วใช้ MOCK_USER_ID (ไว้ทดสอบบนเครื่อง)
 */
window.initUser = async function () {
  var cfg = window.APP_CONFIG;

  if (cfg.DEV_MODE) {
    return cfg.MOCK_USER_ID;
  }

  if (!cfg.LIFF_ID || cfg.LIFF_ID.indexOf('PUT_YOUR') === 0) {
    throw new Error('ยังไม่ได้ตั้งค่า LIFF_ID ใน config.js');
  }

  await liff.init({ liffId: cfg.LIFF_ID });

  if (!liff.isLoggedIn()) {
    liff.login({ redirectUri: window.location.href });
    // หน้าเว็บจะ redirect ไป login — โค้ดหลังจากนี้จะไม่ทำงาน
    return new Promise(function () {});
  }

  var profile = await liff.getProfile();
  return profile.userId;
};
