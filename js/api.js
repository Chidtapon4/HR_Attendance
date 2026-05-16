/**
 * api.js — เรียก Apps Script Web App
 *
 * ใช้ Content-Type: text/plain เพื่อเลี่ยง CORS preflight
 * (Apps Script ไม่ตอบ OPTIONS request)
 */
window.API = {
  /**
   * เรียก API
   * @param {string} action  ชื่อคำสั่ง เช่น 'getStatus', 'checkin'
   * @param {object} payload ข้อมูลที่ส่งไป
   * @returns {Promise<object>} data ที่ backend ส่งกลับ
   */
  call: async function (action, payload) {
    var res;
    try {
      res = await fetch(window.APP_CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: action, payload: payload || {} }),
      });
    } catch (e) {
      throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบอินเทอร์เน็ต');
    }
    if (!res.ok) throw new Error('เซิร์ฟเวอร์ตอบกลับผิดพลาด (' + res.status + ')');

    var json;
    try {
      json = await res.json();
    } catch (e) {
      throw new Error('ข้อมูลตอบกลับไม่ถูกต้อง');
    }
    if (!json.ok) throw new Error(json.error || 'เกิดข้อผิดพลาด');
    return json.data;
  },
};
