function excelSerialToDate(serial) {
  return new Date((serial - 25569) * 86400 * 1000);
}
function plainText(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  return s.startsWith("'") ? s.slice(1) : s;
}
function safeText(val) {
  if (val === null || val === undefined) return '';
  const s = String(val).replace(/^'+/, '');
  return s ? "'" + s : '';
}
function _cmpUsername(sheetVal, inputVal) {
  var a = String(sheetVal == null ? '' : sheetVal).trim();
  var b = String(inputVal  == null ? '' : inputVal ).trim();
  if (a === b) return true;
  var na = parseFloat(a), nb = parseFloat(b);
  if (!isNaN(na) && !isNaN(nb) && isFinite(na) && isFinite(nb) && a !== '' && b !== '') {
    return na === nb;
  }
  return false;
}
const OTP_SHEET = 'Email_OTP';
const OTP_HEADER = [
  'id',
  'username',
  'email_target',
  'otp_hash',
  'created_at',
  'expires_at',
  'attempts_used',
  'status'
];
const OTP_LIFETIME_SEC = 600;   
const OTP_COOLDOWN_SEC = 60;    
const OTP_DAILY_LIMIT  = 5;     
const OTP_MAX_ATTEMPTS = 5;     
const COL_EMAIL_VERIFIED = 18;
function _migrateAddEmailVerified_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  if (!sheet) return;
  const lastCol = Math.max(1, sheet.getLastColumn());
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  if (headers[COL_EMAIL_VERIFIED - 1] === 'EmailVerified') return;
  sheet.getRange(1, COL_EMAIL_VERIFIED).setValue('EmailVerified');
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const range = sheet.getRange(2, COL_EMAIL_VERIFIED, lastRow - 1, 1);
    const current = range.getValues();
    const next = current.map(function (row) {
      const v = row[0];
      const isEmpty = (v === '' || v === null || v === undefined);
      return [isEmpty ? false : v];
    });
    range.setValues(next);
  }
}
function _ensureEmailOtpSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(OTP_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(OTP_SHEET);
    sheet.getRange(1, 1, 1, OTP_HEADER.length).setValues([OTP_HEADER]);
    sheet.getRange(1, 1, 1, OTP_HEADER.length)
      .setFontWeight('bold')
      .setBackground('#e0e7ff')
      .setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
    return sheet;
  }
  const lastCol = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();
  if (lastRow === 0 || lastCol === 0) {
    sheet.getRange(1, 1, 1, OTP_HEADER.length).setValues([OTP_HEADER]);
    sheet.getRange(1, 1, 1, OTP_HEADER.length)
      .setFontWeight('bold')
      .setBackground('#e0e7ff')
      .setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
  }
  return sheet;
}
function _readOtpRows_() {
  const sheet = _ensureEmailOtpSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const lastCol = OTP_HEADER.length;
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const out = [];
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const created = row[4];
    const expires = row[5];
    out.push({
      rowIndex: i + 2, 
      id: String(row[0] == null ? '' : row[0]),
      username: plainText(row[1]),
      email_target: String(row[2] == null ? '' : row[2]),
      otp_hash: String(row[3] == null ? '' : row[3]),
      created_at: created instanceof Date ? created : (created ? new Date(created) : null),
      expires_at: expires instanceof Date ? expires : (expires ? new Date(expires) : null),
      attempts_used: Number(row[6] || 0),
      status: String(row[7] == null ? '' : row[7])
    });
  }
  return out;
}
function _appendOtpRow_(record) {
  const sheet = _ensureEmailOtpSheet_();
  sheet.appendRow([
    record.id,
    safeText(record.username),
    record.email_target,
    record.otp_hash,
    record.created_at,
    record.expires_at,
    0,
    'PENDING'
  ]);
}
function _updateOtpStatusById_(id, newStatus, opts) {
  const sheet = _ensureEmailOtpSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  const lastCol = OTP_HEADER.length;
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const incrementAttempts = !!(opts && opts.incrementAttempts);
  const targetId = String(id == null ? '' : id);
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) !== targetId) continue;
    const rowIndex = i + 2;
    sheet.getRange(rowIndex, 8).setValue(newStatus);
    if (incrementAttempts) {
      const current = Number(values[i][6] || 0);
      sheet.getRange(rowIndex, 7).setValue(current + 1);
    }
    return true;
  }
  return false;
}
function _supersedePendingOtpForUser_(username, emailTarget) {
  const sheet = _ensureEmailOtpSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  const lastCol = OTP_HEADER.length;
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const filterPair = (emailTarget !== undefined && emailTarget !== null);
  const targetEmailNorm = filterPair ? String(emailTarget).trim().toLowerCase() : '';
  let count = 0;
  for (let i = 0; i < values.length; i++) {
    const status = String(values[i][7] || '');
    if (status !== 'PENDING') continue;
    if (!_cmpUsername(values[i][1], username)) continue;
    if (filterPair) {
      const rowEmailNorm = String(values[i][2] == null ? '' : values[i][2]).trim().toLowerCase();
      if (rowEmailNorm !== targetEmailNorm) continue;
    }
    const rowIndex = i + 2;
    sheet.getRange(rowIndex, 8).setValue('SUPERSEDED');
    count++;
  }
  return count;
}
function _generateOtpCode_() {
  const hex = Utilities.getUuid().replace(/-/g, '').slice(0, 8);
  const n = parseInt(hex, 16) % 1000000;
  return String(n).padStart(6, '0');
}
function _hashOtp_(plaintext, salt) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(plaintext) + ':' + String(salt),
    Utilities.Charset.UTF_8
  );
  return Utilities.base64Encode(bytes);
}
function _timingSafeEquals_(a, b) {
  const sa = String(a == null ? '' : a);
  const sb = String(b == null ? '' : b);
  if (sa.length !== sb.length) {
    let _drain = 0;
    for (let i = 0; i < sa.length; i++) {
      _drain |= sa.charCodeAt(i) ^ sa.charCodeAt(i);
    }
    return false;
  }
  let diff = 0;
  for (let i = 0; i < sa.length; i++) {
    diff |= sa.charCodeAt(i) ^ sb.charCodeAt(i);
  }
  return diff === 0;
}
function _maskEmail_(email) {
  const s = String(email == null ? '' : email);
  const atIdx = s.indexOf('@');
  if (atIdx === -1) return s;
  const local = s.slice(0, atIdx);
  const domain = s.slice(atIdx + 1);
  const head = local.slice(0, 2);
  const stars = '*'.repeat(Math.max(0, local.length - 2));
  return head + stars + '@' + domain;
}
function _buildOtpEmailBody_(otp, fullName) {
  const safeOtp = String(otp == null ? '' : otp);
  const safeName = String(fullName == null ? '' : fullName).trim() || 'Bapak/Ibu Guru';
  return (
    'Halo ' + safeName + ',\n\n' +
    'Berikut adalah Kode OTP Anda untuk verifikasi email pada SiM-Murid:\n\n' +
    '    ' + safeOtp + '\n\n' +
    'Kode ini berlaku selama 10 menit sejak email ini dikirim. ' +
    'Mohon segera masukkan Kode OTP pada Halaman Profil Anda untuk menyelesaikan verifikasi.\n\n' +
    'Demi keamanan akun Anda, jangan bagikan Kode OTP ini kepada siapa pun, ' +
    'termasuk pihak yang mengaku sebagai admin atau pengelola SiM-Murid. ' +
    'Jika Anda tidak merasa meminta kode ini, abaikan email ini.\n\n' +
    'Salam,\n' +
    'Tim SiM-Murid'
  );
}
function _requestOtpInternal_(username, sessionToken, actionLabel) {
  function _err(code, message, extra) {
    const out = { success: false, code: code, message: message };
    if (extra && typeof extra === 'object') {
      for (const k in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, k)) out[k] = extra[k];
      }
    }
    return out;
  }
  let session;
  try {
    session = verifySession(sessionToken);
  } catch (e) {
    session = { valid: false };
  }
  if (!session || session.valid !== true || !session.user
      || !_cmpUsername(session.user.username, username)) {
    return _err('SESSION_INVALID', 'Sesi tidak valid');
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const userSheet = ss.getSheetByName('Users');
  const userData = userSheet.getDataRange().getValues();
  let userRole = '';
  let userEmail = '';
  let userFullName = '';
  let userRowFound = false;
  for (let i = 1; i < userData.length; i++) {
    if (_cmpUsername(userData[i][1], username)) {
      userRole = String(userData[i][3] == null ? '' : userData[i][3]);
      userEmail = String(userData[i][15] == null ? '' : userData[i][15]);
      userFullName = String(userData[i][7] == null ? '' : userData[i][7]);
      userRowFound = true;
      break;
    }
  }
  if (!userRowFound) {
    return _err('SESSION_INVALID', 'Sesi tidak valid');
  }
  if (userRole !== 'Guru') {
    return _err('ROLE_NOT_GURU', 'Fitur verifikasi email hanya tersedia untuk role Guru');
  }
  const emailTrim = userEmail.trim();
  if (!emailTrim) {
    return _err('EMPTY_EMAIL', 'Email belum diisi pada profil');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
    return _err('INVALID_EMAIL_FORMAT', 'Format email tidak valid');
  }
  const lock = LockService.getScriptLock();
  let lockAcquired = false;
  try {
    try {
      lock.waitLock(15000);
      lockAcquired = true;
    } catch (lockErr) {
      return _err('LOCK_TIMEOUT', 'Sistem sedang sibuk, silakan coba lagi sebentar');
    }
    const now = new Date();
    const emailNorm = emailTrim.toLowerCase();
    const allRows = _readOtpRows_();
    const pairRows = allRows.filter(function (r) {
      if (!_cmpUsername(r.username, username)) return false;
      const rEmail = String(r.email_target == null ? '' : r.email_target).trim().toLowerCase();
      return rEmail === emailNorm;
    });
    if (pairRows.length > 0) {
      let last = pairRows[0];
      for (let i = 1; i < pairRows.length; i++) {
        const ti = pairRows[i].created_at ? pairRows[i].created_at.getTime() : 0;
        const tl = last.created_at ? last.created_at.getTime() : 0;
        if (ti > tl) last = pairRows[i];
      }
      if (last.status !== 'SEND_FAILED' && last.created_at) {
        const elapsedMs = now.getTime() - last.created_at.getTime();
        const remainSec = OTP_COOLDOWN_SEC - Math.floor(elapsedMs / 1000);
        if (remainSec > 0) {
          return _err(
            'RATE_COOLDOWN',
            'Silakan tunggu ' + remainSec + ' detik sebelum meminta kode baru',
            { retryAfterSeconds: remainSec }
          );
        }
      }
    }
    const windowStart = now.getTime() - 24 * 60 * 60 * 1000;
    let dailyCount = 0;
    for (let i = 0; i < pairRows.length; i++) {
      const t = pairRows[i].created_at ? pairRows[i].created_at.getTime() : -1;
      if (t >= windowStart && t <= now.getTime()) dailyCount++;
    }
    if (dailyCount >= OTP_DAILY_LIMIT) {
      return _err('RATE_DAILY', 'Batas permintaan OTP harian tercapai, silakan coba lagi besok');
    }
    _supersedePendingOtpForUser_(username, emailTrim);
    const newId = Utilities.getUuid();
    const otpPlaintext = _generateOtpCode_();
    const otpHash = _hashOtp_(otpPlaintext, newId);
    const createdAt = new Date(now.getTime());
    const expiresAt = new Date(now.getTime() + OTP_LIFETIME_SEC * 1000);
    _appendOtpRow_({
      id: newId,
      username: username,
      email_target: emailTrim,
      otp_hash: otpHash,
      created_at: createdAt,
      expires_at: expiresAt
    });
    let mailErrorMsg = '';
    let mailErrorIsTransient = false;
    try {
      MailApp.sendEmail({
        to: emailTrim,
        subject: 'Kode OTP Verifikasi Email SiM-Murid',
        body: _buildOtpEmailBody_(otpPlaintext, userFullName)
      });
    } catch (mailErr) {
      mailErrorMsg = String(mailErr && mailErr.message || mailErr);
      const lower = mailErrorMsg.toLowerCase();
      mailErrorIsTransient =
        lower.indexOf('too many times for one second') >= 0 ||
        lower.indexOf('timeout') >= 0 ||
        lower.indexOf('temporarily') >= 0;
      let retrySucceeded = false;
      if (mailErrorIsTransient) {
        Utilities.sleep(1000);
        try {
          MailApp.sendEmail({
            to: emailTrim,
            subject: 'Kode OTP Verifikasi Email SiM-Murid',
            body: _buildOtpEmailBody_(otpPlaintext, userFullName)
          });
          retrySucceeded = true;
          logActivity(username, 'EMAIL_OTP_RETRY_OK',
            'MailApp transient error, retry sukses ke ' + _maskEmail_(emailTrim));
          mailErrorMsg = ''; 
        } catch (retryErr) {
          mailErrorMsg = mailErrorMsg + ' | retry: ' + String(retryErr && retryErr.message || retryErr);
        }
      }
      if (!retrySucceeded) {
        _updateOtpStatusById_(newId, 'SEND_FAILED');
        const emailMaskedFail = _maskEmail_(emailTrim);
        logActivity(username, 'EMAIL_OTP_SEND_ERROR',
          'Email tujuan: ' + emailMaskedFail + ' | MailApp: ' + mailErrorMsg);
        let userMsg = 'Gagal mengirim email OTP. Silakan coba lagi atau hubungi admin.';
        const lowerErr = mailErrorMsg.toLowerCase();
        if (lowerErr.indexOf('authorization') >= 0 || lowerErr.indexOf('permission') >= 0
            || lowerErr.indexOf('not authorized') >= 0) {
          userMsg = 'Sistem belum diberi izin mengirim email. Admin perlu menjalankan fungsi ' +
                    '`forceReauthorize()` di Apps Script Editor.';
        } else if (lowerErr.indexOf('exceeded') >= 0 || lowerErr.indexOf('quota') >= 0
                   || lowerErr.indexOf('too many times for one day') >= 0) {
          userMsg = 'Kuota harian pengiriman email habis. Silakan coba lagi besok.';
        } else if (lowerErr.indexOf('invalid') >= 0 && lowerErr.indexOf('email') >= 0) {
          userMsg = 'Alamat email ditolak oleh server. Periksa kembali email pada profil Anda.';
        }
        return _err('MAIL_SEND_FAILED', userMsg);
      }
    }
    const emailMasked = _maskEmail_(emailTrim);
    logActivity(username, actionLabel, 'OTP dikirim ke ' + emailMasked);
    return {
      success: true,
      expiresAt: expiresAt.toISOString(),
      emailMasked: emailMasked,
      cooldownSeconds: OTP_COOLDOWN_SEC
    };
  } finally {
    if (lockAcquired) {
      try { lock.releaseLock(); } catch (_e) {}
    }
  }
}
function requestEmailOtp(username, sessionToken) {
  return _requestOtpInternal_(username, sessionToken, 'REQUEST_EMAIL_OTP');
}
function verifyEmailOtp(username, otpCode, sessionToken) {
  function _err(code, message, extra) {
    const out = { success: false, code: code, message: message };
    if (extra && typeof extra === 'object') {
      for (const k in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, k)) out[k] = extra[k];
      }
    }
    return out;
  }
  const codeStr = String(otpCode == null ? '' : otpCode);
  if (!/^[0-9]{6}$/.test(codeStr)) {
    return _err('INVALID_OTP_FORMAT', 'Kode OTP harus berupa 6 digit angka');
  }
  let session;
  try {
    session = verifySession(sessionToken);
  } catch (e) {
    session = { valid: false };
  }
  if (!session || session.valid !== true || !session.user
      || !_cmpUsername(session.user.username, username)) {
    return _err('SESSION_INVALID', 'Sesi tidak valid');
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const userSheet = ss.getSheetByName('Users');
  const userData = userSheet.getDataRange().getValues();
  let userRole = '';
  let userEmail = '';
  let userRowIndex = -1; 
  for (let i = 1; i < userData.length; i++) {
    if (_cmpUsername(userData[i][1], username)) {
      userRole = String(userData[i][3] == null ? '' : userData[i][3]);
      userEmail = String(userData[i][15] == null ? '' : userData[i][15]);
      userRowIndex = i + 1;
      break;
    }
  }
  if (userRowIndex === -1) {
    return _err('SESSION_INVALID', 'Sesi tidak valid');
  }
  if (userRole !== 'Guru') {
    return _err('ROLE_NOT_GURU', 'Fitur verifikasi email hanya tersedia untuk role Guru');
  }
  const emailTrim = userEmail.trim();
  const emailNorm = emailTrim.toLowerCase();
  const lock = LockService.getScriptLock();
  let lockAcquired = false;
  try {
    try {
      lock.waitLock(15000);
      lockAcquired = true;
    } catch (lockErr) {
      return _err('LOCK_TIMEOUT', 'Sistem sedang sibuk, silakan coba lagi sebentar');
    }
    const allRows = _readOtpRows_();
    const pairRows = allRows.filter(function (r) {
      if (!_cmpUsername(r.username, username)) return false;
      const rEmail = String(r.email_target == null ? '' : r.email_target).trim().toLowerCase();
      return rEmail === emailNorm;
    });
    for (let i = 0; i < pairRows.length; i++) {
      const r = pairRows[i];
      if (r.status === 'VERIFIED') {
        const replayHash = _hashOtp_(codeStr, r.id);
        if (_timingSafeEquals_(replayHash, String(r.otp_hash || ''))) {
          return {
            success: true,
            verified: true,
            email: emailTrim
          };
        }
      }
    }
    let pending = null;
    for (let i = 0; i < pairRows.length; i++) {
      const r = pairRows[i];
      if (r.status !== 'PENDING') continue;
      if (!pending) { pending = r; continue; }
      const tCur = r.created_at ? r.created_at.getTime() : 0;
      const tBest = pending.created_at ? pending.created_at.getTime() : 0;
      if (tCur > tBest) pending = r;
    }
    if (!pending) {
      return _err('NO_ACTIVE_OTP', 'Tidak ada Kode OTP aktif, silakan minta kode baru');
    }
    const now = new Date();
    const expMs = pending.expires_at ? pending.expires_at.getTime() : 0;
    if (now.getTime() >= expMs) {
      _updateOtpStatusById_(pending.id, 'EXPIRED');
      return _err('OTP_EXPIRED', 'Kode OTP telah kedaluwarsa, silakan minta kode baru');
    }
    const inputHash = _hashOtp_(codeStr, pending.id);
    const storedHash = String(pending.otp_hash || '');
    const matched = _timingSafeEquals_(inputHash, storedHash);
    if (matched) {
      _updateOtpStatusById_(pending.id, 'VERIFIED');
      userSheet.getRange(userRowIndex, COL_EMAIL_VERIFIED).setValue(true);
      const emailMasked = _maskEmail_(emailTrim);
      logActivity(username, 'VERIFY_EMAIL_SUCCESS',
        'Email ' + emailMasked + ' berhasil diverifikasi');
      return {
        success: true,
        verified: true,
        email: emailTrim
      };
    }
    _updateOtpStatusById_(pending.id, 'PENDING', { incrementAttempts: true });
    const newAttempts = (Number(pending.attempts_used) || 0) + 1;
    if (newAttempts >= OTP_MAX_ATTEMPTS) {
      _updateOtpStatusById_(pending.id, 'FAILED');
      const emailMaskedFail = _maskEmail_(emailTrim);
      logActivity(username, 'VERIFY_EMAIL_FAILED',
        'OTP terkunci setelah ' + OTP_MAX_ATTEMPTS + ' percobaan salah untuk ' + emailMaskedFail);
      return _err('OTP_LOCKED', 'Kode OTP telah salah 5 kali, silakan minta kode baru');
    }
    return _err(
      'OTP_MISMATCH',
      'Kode OTP salah',
      { attemptsLeft: OTP_MAX_ATTEMPTS - newAttempts }
    );
  } finally {
    if (lockAcquired) {
      try { lock.releaseLock(); } catch (_e) {}
    }
  }
}
function resendEmailOtp(username, sessionToken) {
  return _requestOtpInternal_(username, sessionToken, 'RESEND_EMAIL_OTP');
}
function diagnoseEmailOtp(testEmail) {
  const result = {
    timestamp: new Date().toISOString(),
    quotaRemaining: null,
    activeUserEmail: '',
    targetEmail: '',
    mailAppOk: null,
    mailAppError: '',
    summary: '',
    recommendations: []
  };
  try {
    result.quotaRemaining = MailApp.getRemainingDailyQuota();
  } catch (e) {
    result.mailAppError = 'getRemainingDailyQuota() throw: ' + (e.message || e);
  }
  try {
    result.activeUserEmail = Session.getActiveUser().getEmail() || '(kosong)';
  } catch (e) {
    result.activeUserEmail = '(error: ' + (e.message || e) + ')';
  }
  const target = (testEmail && String(testEmail).trim()) || result.activeUserEmail;
  result.targetEmail = target;
  if (!target || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
    result.summary = 'Target email tidak valid: ' + JSON.stringify(target);
    Logger.log(JSON.stringify(result, null, 2));
    return result;
  }
  const testBody = '[DIAGNOSTIK SiM-Murid]\n\n' +
    'Ini email tes diagnostik. Kode OTP TIDAK termasuk.\n' +
    'Timestamp: ' + result.timestamp + '\n' +
    'Akun pengirim: ' + result.activeUserEmail + '\n' +
    'Quota tersisa: ' + result.quotaRemaining + '\n\n' +
    'Jika Anda menerima email ini, MailApp berfungsi normal.';
  try {
    MailApp.sendEmail({
      to: target,
      subject: '[DIAGNOSTIK] Tes Pengiriman Email SiM-Murid',
      body: testBody
    });
    result.mailAppOk = true;
  } catch (e) {
    result.mailAppOk = false;
    result.mailAppError = String(e.message || e);
  }
  if (result.mailAppOk) {
    result.summary = 'OK: MailApp berfungsi. Jika user masih kena MAIL_SEND_FAILED, ' +
                     'cek apakah email user di Sheet Users valid (bukan typo) dan kuota harian belum habis.';
  } else {
    result.summary = 'GAGAL: MailApp tidak dapat mengirim email.';
    const lower = String(result.mailAppError).toLowerCase();
    if (lower.indexOf('authorization') >= 0 || lower.indexOf('permission') >= 0
        || lower.indexOf('not authorized') >= 0) {
      result.recommendations.push(
        'Jalankan fungsi forceReauthorize() dari dropdown Apps Script Editor → Run. ' +
        'Saat dialog izin muncul, klik Allow untuk scope "Send email as you".'
      );
      result.recommendations.push(
        'Jika masih gagal setelah re-authorize, periksa apakah file appsscript.json ' +
        'memiliki oauthScopes yang menyertakan "https://www.googleapis.com/auth/script.send_mail".'
      );
    } else if (lower.indexOf('quota') >= 0 || lower.indexOf('exceeded') >= 0
               || lower.indexOf('too many times for one day') >= 0) {
      result.recommendations.push(
        'Quota harian tercapai (100/hari consumer, 1500/hari Workspace). ' +
        'Tunggu reset 24 jam atau gunakan akun Google Workspace.'
      );
    } else if (lower.indexOf('invalid') >= 0 && lower.indexOf('email') >= 0) {
      result.recommendations.push(
        'Alamat email tujuan ditolak. Pastikan format valid dan domain dapat menerima email dari Gmail.'
      );
    } else {
      result.recommendations.push('Detail error MailApp: ' + result.mailAppError);
    }
  }
  try {
    logActivity(
      result.activeUserEmail || 'SYSTEM',
      'DIAGNOSE_EMAIL_OTP',
      result.summary + ' | quota=' + result.quotaRemaining + ' | mail=' + result.mailAppOk
    );
  } catch (_e) {  }
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
function forceReauthorize() {
  try {
    const quota = MailApp.getRemainingDailyQuota();
    let activeEmail = '';
    try { activeEmail = Session.getActiveUser().getEmail() || ''; } catch (_e) {}
    try {
      logActivity(activeEmail || 'SYSTEM', 'FORCE_REAUTHORIZE',
        'Re-authorize berhasil. Quota MailApp tersisa: ' + quota);
    } catch (_e) {}
    Logger.log('forceReauthorize OK. quota=' + quota + ', user=' + activeEmail);
    return { ok: true, quota: quota, user: activeEmail };
  } catch (e) {
    const msg = String(e.message || e);
    Logger.log('forceReauthorize FAILED: ' + msg);
    return { ok: false, error: msg };
  }
}
function _assertEmailGate(username) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (_cmpUsername(data[i][1], username)) {
      const role = data[i][3];
      const verified = data[i][17] === true;
      if (role === 'Guru' && !verified) {
        throw new Error('GATE: Anda harus memverifikasi email terlebih dahulu sebelum dapat menggunakan fitur ini');
      }
      return;
    }
  }
}
function doGet() {
  try { _ensureNotifPiketTriggers_(); } catch (_e) {}
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('SiM-Murid')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
}
function loginUser(username, password, remember, userAgent) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const userSheet = ss.getSheetByName('Users');
  const sessionSheet = ss.getSheetByName('Sessions');
  if (!userSheet) return { success: false, message: 'Konfigurasi sistem tidak ditemukan. Hubungi administrator.' };
  if (!sessionSheet) return { success: false, message: 'Konfigurasi sistem tidak ditemukan. Hubungi administrator.' };
  const users = userSheet.getDataRange().getValues();
  users.shift();
  let userFound = null;
  let isDefaultPassword = false;
  let hasSecurityQuestion = false;
  for (let i = 0; i < users.length; i++) {
    if (_cmpUsername(users[i][1], username) && String(users[i][2]) === String(password)) {
      userFound = {
        id: users[i][0],
        username: users[i][1],
        role: String(users[i][3] || '').trim(),
        tugasTambahan: users[i][4] ? users[i][4].toString().split(',').map(function(item) { return item.trim(); }) : [],
        fullName: users[i][7] || '',
        piket: users[i][8] || '',
        kelas: users[i][6] || '',
        aksesPremium: users[i][10] === true,
        aksesTabungan: users[i][13] === true,
        noHP:  users[i][14] || '',
        email: users[i][15] || '',
        bio:   users[i][16] || '',
        emailVerified: users[i][17] === true
      };
      isDefaultPassword = (String(password) === '123456');
      hasSecurityQuestion = !!(users[i][11] && users[i][12]);
      break;
    }
  }
  if (!userFound) {
    return { success: false, message: "Username atau Password salah!" };
  }
  const sessionData = sessionSheet.getDataRange().getValues();
  const now = new Date();
  for (let i = sessionData.length - 1; i >= 1; i--) {
    if (_cmpUsername(sessionData[i][1], userFound.username)) {
      const expiredAt = new Date(sessionData[i][2]);
      if (expiredAt > now) {
        return {
          success: false,
          message: "Akun sedang aktif di perangkat lain. Silakan logout dari perangkat tersebut atau hubungi Admin untuk mereset sesi login Anda."
        };
      } else {
        sessionSheet.deleteRow(i + 1);
      }
    }
  }
  const token = Utilities.getUuid();
  const durationHours = remember ? 168 : 1;
  const expiredAt = new Date(now.getTime() + (durationHours * 60 * 60 * 1000));
  const ua = userAgent ? String(userAgent) : '';
  let deviceLabel = 'Perangkat tidak diketahui';
  if (ua) {
    const isAndroid  = /Android/i.test(ua);
    const isIphone   = /iPhone/i.test(ua);
    const isIpad     = /iPad/i.test(ua);
    const isWindows  = /Windows NT/i.test(ua);
    const isMac      = /Macintosh|Mac OS X/i.test(ua);
    const isLinux    = /Linux/i.test(ua) && !isAndroid;
    const isChrome   = /Chrome\/[\d.]+/i.test(ua) && !/Edg\//i.test(ua) && !/OPR\//i.test(ua);
    const isFirefox  = /Firefox\/[\d.]+/i.test(ua);
    const isEdge     = /Edg\/[\d.]+/i.test(ua);
    const isSafari   = /Safari\/[\d.]+/i.test(ua) && !/Chrome/i.test(ua);
    const isOpera    = /OPR\/[\d.]+/i.test(ua);
    let browser = isChrome ? 'Chrome' : isFirefox ? 'Firefox' : isEdge ? 'Edge' : isSafari ? 'Safari' : isOpera ? 'Opera' : 'Browser';
    let os = isAndroid ? 'Android' : isIphone ? 'iPhone' : isIpad ? 'iPad' : isWindows ? 'Windows' : isMac ? 'Mac' : isLinux ? 'Linux' : 'Perangkat';
    deviceLabel = browser + ' – ' + os;
  }
  sessionSheet.appendRow([token, safeText(userFound.username), expiredAt, now, deviceLabel]);
  logActivity(userFound.username, 'LOGIN', 'User berhasil login ke sistem.');
  const menus = generateMenu(userFound);
  let badgeCount = 0;
  if(userFound.role === 'Admin') {
    badgeCount = getPendingResetCount(userFound.username);
  }
  let isProfileIncomplete = false;
  if (userFound && (userFound.role === 'Siswa' || userFound.role === 'Calon Siswa Baru')) {
    isProfileIncomplete = checkProfileIncomplete(username);
  }
  let surveiWajib = null;
  try {
    const _sw = cekSurveiWajib(userFound.username);
    if (_sw && _sw.success) surveiWajib = _sw.data || null;
  } catch (e) {
    surveiWajib = null;
  }
  return {
    success: true,
    user: userFound,
    menus: menus,
    token: token,
    resetCount: badgeCount,
    isDefaultPassword: isDefaultPassword,
    isProfileIncomplete: isProfileIncomplete,
    isSecurityQuestionSet: hasSecurityQuestion,
    surveiWajib: surveiWajib
  };
}
function adminResetPassword(id, adminUser) {
  _assertEmailGate(adminUser);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  const data = sheet.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] == id) {
      sheet.getRange(i + 1, 3).setValue("'123456");
      sheet.getRange(i + 1, 6).setValue(false);
      const username = data[i][1];
      logActivity(adminUser, 'RESET_PASSWORD', `Mereset password user: ${username}`);
      return { success: true };
    }
  }
  throw new Error("User ID tidak ditemukan.");
}
function getAllUsers(_callerUsername) {
  _assertEmailGate(_callerUsername);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  data.shift();
  const sessionSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sessions');
  const sessionData = (sessionSheet && sessionSheet.getLastRow() > 0) ? sessionSheet.getDataRange().getValues() : [];
  const now = new Date();
  const activeUsers = sessionData.filter(r => new Date(r[2]) > now).map(r => plainText(r[1]).trim().toLowerCase());
  const rolePriority = {
    'Admin': 1,
    'Guru': 2,
    'Siswa': 3,
    'Nasabah': 4,
    'Calon Siswa Baru': 5
  };
  return data.map(row => {
    // plainText() strips the leading apostrophe that safeText()/addUser() writes to the sheet.
    // Without this, row[1] comes back as "'admin123" and breaks search, role-filter, and isOnline.
    const uname = plainText(row[1]).trim();
    const roleStr = plainText(row[3]).trim();
    const kelasStr = String(row[6] || '').trim();
    return {
      id: row[0],
      username: uname,
      role: roleStr,
      tugas: row[4] ? String(row[4]).trim() : '',
      isResetReq: row[5] === true,
      kelas: kelasStr,
      fullName: row[7] || '',
      piket: row[8] || '',
      isResetSesiReq: row[9] === true,
      aksesPremium: row[10] === true,
      aksesTabungan: row[13] === true,
      isOnline: activeUsers.includes(uname.toLowerCase())
    };
  }).sort((a, b) => {
    const priorityA = rolePriority[a.role] || 6;
    const priorityB = rolePriority[b.role] || 6;
    if (priorityA !== priorityB) return priorityA - priorityB;
    const nameA = (a.fullName || a.username).toLowerCase();
    const nameB = (b.fullName || b.username).toLowerCase();
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;
    return 0;
  });
}
function getPendingResetCount(_callerUsername) {
  _assertEmailGate(_callerUsername);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  const data = sheet.getDataRange().getValues();
  let count = 0;
  for(let i=1; i<data.length; i++){
    if(data[i][5] === true || data[i][9] === true) count++;
  }
  return count;
}
function adminResetSession(username, adminUser) {
  _assertEmailGate(adminUser);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sessions');
  const data = sheet.getDataRange().getValues();
  let found = false;
  for (let i = data.length - 1; i >= 1; i--) {
    if (_cmpUsername(data[i][1], username)) {
      sheet.deleteRow(i + 1);
      found = true;
    }
  }
  const userSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  const userData = userSheet.getDataRange().getValues();
  for (let i = 1; i < userData.length; i++) {
    if (_cmpUsername(userData[i][1], username)) {
      userSheet.getRange(i + 1, 10).setValue(false);
      break;
    }
  }
  logActivity(adminUser, 'RESET_SESSION', `Mereset sesi login user: ${username}`);
  return { success: true, message: found ? "Sesi berhasil direset." : "User tidak memiliki sesi aktif." };
}
function generateMenu(user) {
  let menus = [];
  if (user.role === 'Admin') {
    menus.push('Dashboard', 'Buku Digital', 'Manajemen Guru', 'Manajemen Siswa', 'Manajemen Calon Siswa', 'Manajemen Orang Tua', 'Manajemen Nilai', 'Manajemen Jadwal', 'Manajemen Iuran Komite', 'Manajemen Tabungan', 'Manajemen Absensi', 'Manajemen Guru Piket', 'Manajemen Kelas', 'Manajemen Guru Wali', 'Manajemen Poin Siswa', 'Dashboard Analitik SPK', 'Manajemen Alumni', 'Manajemen Ijazah', 'Manajemen Survei', 'Manajemen User', 'Log Aktivitas', 'Profil', 'Keamanan Akun', 'Fee Transaksi', 'Master Mata Pelajaran', 'Kenaikan Kelas', 'Hari Libur', 'Master Hafalan', 'Folder Ijazah', 'Akses Ijazah', 'Profil Sekolah', 'Konfigurasi AI');
  } else if (user.role === 'Siswa') {
    menus.push('Dashboard', 'Buku Digital', 'Jadwalku', 'Nilaiku', 'Kehadiranku', 'Poin Kedisiplinanku', 'Iuran Komiteku', 'Tabunganku', 'Laporan Bimbinganku', 'Survei Evaluasi', 'Log Aktivitas', 'Profil', 'Keamanan Akun');
  } else if (user.role === 'Guru') {
    menus.push('Dashboard', 'Buku Digital', 'Manajemen Nilai');
    const tugas = user.tugasTambahan || [];
    if (tugas.includes('Kepala Madrasah/Sekolah')) {
      menus.push('Manajemen Guru', 'Manajemen Siswa', 'Manajemen Calon Siswa', 'Manajemen Orang Tua', 'Manajemen Jadwal', 'Manajemen Iuran Komite', 'Manajemen Tabungan', 'Manajemen Absensi', 'Manajemen Kelas', 'Manajemen Guru Wali', 'Manajemen Survei', 'Manajemen User');
    }
    if (tugas.includes('Bendahara Komite')) menus.push('Manajemen Iuran Komite');
    if (tugas.includes('Pengelola Tabungan')) menus.push('Manajemen Tabungan', 'Fee Transaksi');
    if (tugas.includes('Guru Piket')) menus.push('Manajemen Absensi');
    // Guru pengganti (bukan Guru Piket) yang sudah dikonfirmasi hari ini juga
    // mendapat akses Manajemen Absensi untuk hari bersangkutan.
    if (!tugas.includes('Guru Piket') && _isPiketTerkonfirmasi_(user.username)) {
      menus.push('Manajemen Absensi');
    }
    // BUG FIX #2: Manajemen Jadwal hanya ditambahkan untuk Wali Kelas jika belum
    // ada dari blok Kepala Madrasah/Sekolah di atas (mencegah duplikat eksplisit
    // sebelum de-duplikasi via Set di akhir).
    if (tugas.includes('Wali Kelas') && !tugas.includes('Kepala Madrasah/Sekolah')) {
      menus.push('Manajemen Kelas', 'Absensi Kelasku', 'Manajemen Jadwal');
    } else if (tugas.includes('Wali Kelas')) {
      menus.push('Manajemen Kelas', 'Absensi Kelasku');
    }
    if (tugas.includes('Guru Wali')) menus.push('Manajemen Guru Wali');
    menus.push('Manajemen Poin Siswa');
    menus.push('Log Aktivitas');
    menus.push('Survei Evaluasi');
    if (user.aksesTabungan) menus.push('Tabunganku');
    menus.push('Profil', 'Keamanan Akun');
  } else if (user.role === 'Nasabah') {
    menus.push('Dashboard', 'Buku Digital', 'Tabunganku', 'Log Aktivitas', 'Profil', 'Keamanan Akun');
  } else if (user.role === 'Alumni') {
    menus.push('Dashboard', 'Buku Digital', 'Ijazahku', 'Tabunganku', 'Log Aktivitas', 'Profil', 'Keamanan Akun');
  } else if (user.role === 'Orangtua') {
    menus.push('Dashboard', 'Nilai Anak', 'Kehadiran Anak', 'Poin Anak', 'Iuran Anak', 'Tabungan Anak', 'Laporan Bimbingan Anak', 'Buku Digital', 'Survei Evaluasi', 'Log Aktivitas', 'Profil', 'Keamanan Akun');
  } else if (user.role === 'Calon Siswa Baru') {
    menus.push('Dashboard', 'Buku Digital', 'Log Aktivitas', 'Profil', 'Keamanan Akun');
  }
  return [...new Set(menus)];
}
function _getActivityLogsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Activity_Logs');
  if (!sheet) {
    sheet = ss.insertSheet('Activity_Logs');
    sheet.appendRow(['ID', 'Timestamp', 'Username', 'Action', 'Description']);
    const headerRange = sheet.getRange(1, 1, 1, 5);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#1e293b');
    headerRange.setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function logActivity(username, action, description) {
  try {
    const sheet = _getActivityLogsSheet();
    const id = Utilities.getUuid();
    const timestamp = new Date();
    sheet.appendRow([id, timestamp, safeText(username || 'SYSTEM'), action || 'LOG', description || '']);
  } catch (err) {
    Logger.log('logActivity Error: ' + err.toString());
  }
}

function _parseIsoTimestamp(val) {
  if (!val) return null;
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch (e) {
    return null;
  }
}

function getLogData(_callerUsername) {
  try {
    const sheet = _getActivityLogsSheet();
    if (sheet.getLastRow() < 2) return [];

    const data = sheet.getDataRange().getValues();
    if (data.length > 0 && String(data[0][0]).toUpperCase() === 'ID') {
      data.shift();
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const parsed = data
      .map(row => {
        const d = row[1] ? new Date(row[1]) : null;
        const timeMs = d && !isNaN(d.getTime()) ? d.getTime() : 0;
        return {
          id: String(row[0] || ''),
          timestamp: _parseIsoTimestamp(row[1]),
          timeMs: timeMs,
          username: String(row[2] || ''),
          action: String(row[3] || ''),
          desc: String(row[4] || '')
        };
      })
      .filter(item => item.timeMs === 0 || item.timeMs >= thirtyDaysAgo.getTime());

    parsed.sort((a, b) => b.timeMs - a.timeMs);

    return parsed.slice(0, 200).map(item => ({
      id: item.id,
      timestamp: item.timestamp,
      username: item.username,
      action: item.action,
      desc: item.desc
    }));
  } catch (err) {
    Logger.log('getLogData Error: ' + err.toString());
    return [];
  }
}

function getLogDataByUser(username) {
  try {
    if (!username) return [];
    const sheet = _getActivityLogsSheet();
    if (sheet.getLastRow() < 2) return [];

    const data = sheet.getDataRange().getValues();
    if (data.length > 0 && String(data[0][0]).toUpperCase() === 'ID') {
      data.shift();
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const targetUser = String(username || '').trim().toLowerCase();

    const parsed = data
      .filter(row => {
        const u = String(row[2] || '').trim().toLowerCase();
        return u === targetUser;
      })
      .map(row => {
        const d = row[1] ? new Date(row[1]) : null;
        const timeMs = d && !isNaN(d.getTime()) ? d.getTime() : 0;
        return {
          id: String(row[0] || ''),
          timestamp: _parseIsoTimestamp(row[1]),
          timeMs: timeMs,
          username: String(row[2] || ''),
          action: String(row[3] || ''),
          desc: String(row[4] || '')
        };
      })
      .filter(item => item.timeMs === 0 || item.timeMs >= thirtyDaysAgo.getTime());

    parsed.sort((a, b) => b.timeMs - a.timeMs);

    return parsed.slice(0, 100).map(item => ({
      id: item.id,
      timestamp: item.timestamp,
      username: item.username,
      action: item.action,
      desc: item.desc
    }));
  } catch (err) {
    Logger.log('getLogDataByUser Error: ' + err.toString());
    return [];
  }
}
function logoutUser(token) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sessions');
  if (!sheet) return true;
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][0] == token) {
      sheet.deleteRow(i + 1);
    }
  }
  return true;
}
function verifySession(token) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sessions');
  if (!sheet) return { valid: false };
  const data = sheet.getDataRange().getValues();
  const now = new Date();
  let sessionData = null;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == token) {
      if (new Date(data[i][2]) > now) {
        sessionData = { username: data[i][1] };
      } else {
        sheet.deleteRow(i + 1);
      }
      break;
    }
  }
  if (sessionData) {
    const userSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
    if (!userSheet) return { valid: false };
    const users = userSheet.getDataRange().getValues();
    users.shift();
    let userFound = null;
    let isDefaultPassword = false;
    let hasSecurityQuestion = false;
    for (let i = 0; i < users.length; i++) {
      if (users[i][1] == sessionData.username) {
        userFound = {
          id: users[i][0],
          username: users[i][1],
          role: String(users[i][3] || '').trim(),
          tugasTambahan: users[i][4] ? users[i][4].toString().split(',').map(function(item) { return item.trim(); }) : [],
          fullName: users[i][7] || '',
          piket: users[i][8] || '',
          kelas: users[i][6] || '',
          aksesPremium: users[i][10] === true,
          aksesTabungan: users[i][13] === true,
          noHP:  users[i][14] || '',
          email: users[i][15] || '',
          bio:   users[i][16] || '',
          emailVerified: users[i][17] === true
        };
        isDefaultPassword = (String(users[i][2]) === '123456');
        hasSecurityQuestion = !!(users[i][11] && users[i][12]);
        break;
      }
    }
    if (userFound) {
      let badgeCount = 0;
      if(userFound.role === 'Admin') {
        badgeCount = getPendingResetCount();
      }
      let isProfileIncomplete = false;
      if (userFound.role === 'Siswa' || userFound.role === 'Calon Siswa Baru') {
        isProfileIncomplete = checkProfileIncomplete(userFound.username);
      }
      let surveiWajib = null;
      try {
        const _sw = cekSurveiWajib(userFound.username);
        if (_sw && _sw.success) surveiWajib = _sw.data || null;
      } catch (e) {
        surveiWajib = null;
      }
      return {
        valid: true,
        user: userFound,
        menus: generateMenu(userFound),
        resetCount: badgeCount,
        isDefaultPassword: isDefaultPassword,
        isProfileIncomplete: isProfileIncomplete,
        isSecurityQuestionSet: hasSecurityQuestion,
        surveiWajib: surveiWajib
      };
    }
  }
  return { valid: false };
}
function deleteSchedule(id, adminUser) {
  _assertEmailGate(adminUser);
  const lock = LockService.getScriptLock();
  // BUG FIX: lock harus di-acquire dulu sebelum bisa di-release.
  // Sebelumnya releaseLock() dipanggil tanpa waitLock() sehingga
  // Apps Script melempar exception di blok finally.
  try {
    lock.waitLock(10000);
  } catch (lockErr) {
    return { success: false, message: 'Sistem sedang sibuk, silakan coba lagi.' };
  }
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Schedules');
    const data = sheet.getDataRange().getValues();
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] == id) {
        sheet.deleteRow(i + 1);
        logActivity(adminUser, 'DELETE_SCHEDULE', `Menghapus jadwal ID: ${id}`);
        return { success: true };
      }
    }
    throw new Error("Jadwal tidak ditemukan.");
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}
function getScheduleByClass(kelas, _callerUsername) {
  _assertEmailGate(_callerUsername);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Schedules');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  data.shift();
  return data.filter(r => {
    return String(r[1] || '').trim().toLowerCase() === String(kelas || '').trim().toLowerCase();
  }).map(r => {
    let detail = {};
    try { detail = JSON.parse(r[5] || '{}'); } catch(e) { detail = { text: r[5] }; }
    return {
      id: r[0], kelas: r[1], kategori: r[2], hari: r[3], jam: r[4] || '', detail: detail
    };
  });
}
function getStudentSchedules(username) {
  _assertEmailGate(username);
  const userSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  if (!userSheet || userSheet.getLastRow() < 2) return [];
  const users = userSheet.getDataRange().getValues();
  let kelas = '';
  for (let i = 1; i < users.length; i++) {
    if (String(users[i][1] || '').trim() === String(username || '').trim()) {
      kelas = String(users[i][6] || '').trim();
      break;
    }
  }
  if (!kelas) return [];
  // BUG FIX: Teruskan username sebagai _callerUsername agar _assertEmailGate
  // di getScheduleByClass tidak menerima undefined dan melempar error gate.
  return getScheduleByClass(kelas, username);
}
function getIuranSiswa(username) {
  _assertEmailGate(username);
  const userSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  let fullName = username;
  const users = userSheet.getDataRange().getValues();
  // Helper: bandingkan username dengan toleran terhadap leading apostrophe
  // (prefix `'` yang ditambahkan oleh safeText() saat menulis ke sheet
  // dalam mode text). Tanpa helper ini, `r[1] === username` selalu false
  // untuk data yang disimpan via safeText karena raw value sebenarnya
  // berisi apostrof di awal.
  const _norm = (v) => String(v == null ? '' : v).replace(/^'+/, '').trim();
  const targetUser = _norm(username);
  for(let i=1; i<users.length; i++) {
    if (_norm(users[i][1]) === targetUser) { fullName = users[i][7] || username; break; }
  }
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Iuran_Komite');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  data.shift();
  return data.filter(r => {
    const rowUser = _norm(r[1]);
    return rowUser === targetUser || rowUser === _norm(fullName);
  }).map(row => {
    let dateStr = null;
    if (row[3]) {
      const d = new Date(row[3]);
      if (!isNaN(d.getTime())) dateStr = d.toISOString();
    }
    return { id: row[0], tanggal: dateStr, jumlah: row[4], ket: row[5], pencatat: row[6] };
  }).reverse();
}
function getIuranRecapSiswa(username) {
  _assertEmailGate(username);
  const ss         = SpreadsheetApp.getActiveSpreadsheet();
  const iuranSheet = ss.getSheetByName('Iuran_Komite');
  if (!iuranSheet || iuranSheet.getLastRow() < 2) return [];
  const today      = new Date();
  const currentYear = today.getFullYear();
  const taYear  = today.getMonth() >= 6 ? currentYear : currentYear - 1;
  const taYear2 = taYear + 1;
  const monthNames = ['Januari','Februari','Maret','April','Mei','Juni',
                      'Juli','Agustus','September','Oktober','November','Desember'];
  const S1_MONTHS  = ['Juli','Agustus','September','Oktober','November','Desember'];
  const S2_MONTHS  = ['Januari','Februari','Maret','April','Mei','Juni'];
  const iuranData  = iuranSheet.getDataRange().getValues();
  const s1 = { bulanDibayar: [], totalDibayar: 0, nominalPerBulan: 0 };
  const s2 = { bulanDibayar: [], totalDibayar: 0, nominalPerBulan: 0 };
  // Strip leading apostrophe (text-mode prefix) supaya match data yang
  // disimpan via `safeText()`. Tanpa ini, raw value `"'rifki01"` tidak
  // pernah cocok dengan `username` parameter `"rifki01"` sehingga semua
  // baris di-skip dan rekap selalu kosong.
  const _norm = (v) => String(v == null ? '' : v).replace(/^'+/, '').trim();
  const target = _norm(username);
  for (let i = 1; i < iuranData.length; i++) {
    const row    = iuranData[i];
    const siswa  = _norm(row[1]);
    if (siswa !== target) continue;
    const tanggal = row[3];
    const jumlah  = parseFloat(row[4]) || 0;
    const ket     = String(row[5] || '');
    let transYear = 0, transMonth = 0;
    if (tanggal) {
      let d;
      if (tanggal instanceof Date)          d = tanggal;
      else if (typeof tanggal === 'number') d = excelSerialToDate(tanggal);
      else                                  d = new Date(tanggal);
      if (d && !isNaN(d.getTime())) {
        transYear  = d.getFullYear();
        transMonth = d.getMonth() + 1;
      }
    }
    const isS1 = transYear === taYear  && transMonth >= 7;
    const isS2 = transYear === taYear2 && transMonth <= 6;
    if (!isS1 && !isS2) continue;
    const target2 = isS1 ? s1 : s2;
    target2.totalDibayar += jumlah;
    const match = ket.match(/Bayar Bulan\s+(.+?)\s+\d{4}/);
    if (match) {
      const bulanList = match[1].split(',').map(b => b.trim()).filter(Boolean);
      bulanList.forEach(bulan => {
        if (monthNames.includes(bulan) && !target2.bulanDibayar.includes(bulan)) {
          target2.bulanDibayar.push(bulan);
        }
      });
      if (bulanList.length > 0) {
        const nominalThisTrans = Math.floor(jumlah / bulanList.length);
        if (nominalThisTrans > target2.nominalPerBulan) {
          target2.nominalPerBulan = nominalThisTrans;
        }
      }
    }
  }
  // Selalu kembalikan dua entri (S1 & S2) — meski salah satu kosong —
  // supaya konsumen FE bisa menampilkan progress per-semester dengan
  // benar (mis. "0/6 Bulan" untuk semester yang belum ada transaksinya).
  // Sebelumnya entri di-skip kalau totalDibayar=0, sehingga FE kehilangan
  // info bahwa seluruh bulan semester itu belum dibayar.
  const result = [];
  const sudahSet1   = new Set(s1.bulanDibayar);
  const belumBayar1 = S1_MONTHS.filter(m => !sudahSet1.has(m));
  result.push({
    semester     : `Semester 1 (Ganjil) ${taYear}/${taYear2}`,
    statusIuran  : belumBayar1.length === 0 ? 'Lunas' : 'Kurang',
    totalBayar   : s1.totalDibayar,
    bulanLunas   : s1.bulanDibayar.sort((a, b) => monthNames.indexOf(a) - monthNames.indexOf(b)),
    bulanKurang  : belumBayar1,
    nominalPerBulan: s1.nominalPerBulan,
    nominalKurang: s1.nominalPerBulan * belumBayar1.length
  });
  const sudahSet2   = new Set(s2.bulanDibayar);
  const belumBayar2 = S2_MONTHS.filter(m => !sudahSet2.has(m));
  result.push({
    semester     : `Semester 2 (Genap) ${taYear}/${taYear2}`,
    statusIuran  : belumBayar2.length === 0 ? 'Lunas' : 'Kurang',
    totalBayar   : s2.totalDibayar,
    bulanLunas   : s2.bulanDibayar.sort((a, b) => monthNames.indexOf(a) - monthNames.indexOf(b)),
    bulanKurang  : belumBayar2,
    nominalPerBulan: s2.nominalPerBulan,
    nominalKurang: s2.nominalPerBulan * belumBayar2.length
  });
  return result;
}
function getSavingsSiswa(username) {
  _assertEmailGate(username);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Savings');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  data.shift();
  const timeZone = Session.getScriptTimeZone();
  return data.filter(r => _cmpUsername(plainText(r[3]), username)).map(row => {
    let dateStr = '';
    if (row[1]) {
      const d = new Date(row[1]);
      if (!isNaN(d.getTime())) dateStr = Utilities.formatDate(d, timeZone, "yyyy-MM-dd");
    }
    return { id: row[0], tanggal: dateStr, jenis: row[5], jumlah: parseFloat(row[6]) || 0, ket: row[7], pencatat: row[8] };
  }).reverse();
}
function getSavingsRecapSiswa(username) {
  _assertEmailGate(username);
  const allRecaps = getSavingsRecap(null, null, username);
  return allRecaps.filter(r => _cmpUsername(r.username, username));
}
function getClassData(_callerUsername) {
  _assertEmailGate(_callerUsername);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Classes');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  data.shift();
  return data.map(row => ({
    id: row[0],
    tingkat: row[1],
    nama: row[2],
    waliUsername: row[3],
    waliName: row[4]
  })).sort((a, b) => a.tingkat - b.tingkat);
}
function addClass(tingkat, nama, waliUsername, waliName, adminUser) {
  _assertEmailGate(adminUser);
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Classes');
    const id = Utilities.getUuid();
    sheet.appendRow([id, tingkat, nama, waliUsername, waliName]);
    logActivity(adminUser, 'CREATE_CLASS', `Menambah kelas: ${tingkat} ${nama}`);
    return { success: true };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}
function updateClass(id, tingkat, nama, waliUsername, waliName, adminUser) {
  _assertEmailGate(adminUser);
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Classes');
    const data = sheet.getDataRange().getValues();
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] == id) {
        sheet.getRange(i + 1, 2, 1, 4).setValues([[tingkat, nama, waliUsername, waliName]]);
        logActivity(adminUser, 'UPDATE_CLASS', `Mengedit kelas ID: ${id}`);
        return { success: true };
      }
    }
    throw new Error("Kelas tidak ditemukan.");
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}
function deleteClass(id, adminUser) {
  _assertEmailGate(adminUser);
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Classes');
    const data = sheet.getDataRange().getValues();
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] == id) {
        sheet.deleteRow(i + 1);
        logActivity(adminUser, 'DELETE_CLASS', `Menghapus kelas ID: ${id}`);
        return { success: true };
      }
    }
    throw new Error("Kelas tidak ditemukan.");
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}
function getIuranData(_callerUsername) {
  _assertEmailGate(_callerUsername);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Iuran_Komite');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  data.shift();
  return data.map(function(row) {
    let dateStr = null;
    if (row[3]) {
      const d = new Date(row[3]);
      if (!isNaN(d.getTime())) {
        dateStr = d.toISOString();
      }
    }
    return {
      id: row[0],
      siswa: plainText(row[1]),
      kelas: row[2] || '',
      tanggal: dateStr,
      jumlah: row[4],
      ket: row[5],
      pencatat: plainText(row[6])
    };
  }).reverse();
}
function addIuran(siswa, kelas, tanggal, jumlah, ket, pencatat, logUser) {
  _assertEmailGate(logUser);
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Iuran_Komite');
    const id = Utilities.getUuid();
    sheet.appendRow([id, safeText(siswa), kelas, tanggal, jumlah, ket, safeText(pencatat)]);
    logActivity(logUser, 'CREATE', `Menambahkan iuran siswa: ${siswa}, Kelas: ${kelas}, Jumlah: ${jumlah}`);
    _syncSaudaraIuran(siswa, kelas, tanggal, ket, logUser);
    return { success: true };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}
function _syncSaudaraIuran(usernameYangBayar, kelasYangBayar, tanggal, ket, logUser) {
  try {
    const ss          = SpreadsheetApp.getActiveSpreadsheet();
    const detailSheet = ss.getSheetByName('SiswaDetail');
    if (!detailSheet || detailSheet.getLastRow() < 2) return;
    const detailData    = detailSheet.getDataRange().getValues();
    const detailHeaders = detailData[0];
    const ortuColIdx    = detailHeaders.indexOf('Username_Ortu');
    const usernameColIdx = 0;
    if (ortuColIdx < 0) return;
    let ortuUsername = '';
    for (let i = 1; i < detailData.length; i++) {
      if (String(detailData[i][usernameColIdx]).trim() === String(usernameYangBayar).trim()) {
        ortuUsername = String(detailData[i][ortuColIdx] || '').trim();
        break;
      }
    }
    if (!ortuUsername) return;
    const userSheet = ss.getSheetByName('Users');
    const userData  = userSheet ? userSheet.getDataRange().getValues() : [];
    const kelasMap  = {};
    for (let i = 1; i < userData.length; i++) {
      kelasMap[String(userData[i][1]).trim()] = userData[i][6] || '';
    }
    const saudaraList = [];
    for (let i = 1; i < detailData.length; i++) {
      const uname    = String(detailData[i][usernameColIdx] || '').trim();
      const ortuVal  = String(detailData[i][ortuColIdx] || '').trim();
      const ortuArr  = ortuVal.split(',').map(s => s.trim()).filter(Boolean);
      if (!ortuArr.includes(ortuUsername)) continue;
      if (uname === String(usernameYangBayar).trim()) continue;
      saudaraList.push({ username: uname, kelas: kelasMap[uname] || '' });
    }
    if (saudaraList.length === 0) return;
    const semua = [
      { username: String(usernameYangBayar).trim(), kelas: kelasYangBayar || '' },
      ...saudaraList
    ];
    semua.sort((a, b) => {
      const ka = String(a.kelas).toLowerCase();
      const kb = String(b.kelas).toLowerCase();
      return ka.localeCompare(kb, 'id', { numeric: true });
    });
    const siswaGratis = semua[0];
    if (siswaGratis.username === String(usernameYangBayar).trim()) return;
    const monthNames = ['Januari','Februari','Maret','April','Mei','Juni',
                        'Juli','Agustus','September','Oktober','November','Desember'];
    const ketStr = String(ket || '');
    const matchKet = ketStr.match(/Bayar Bulan\s+(.+?)\s+(\d{4})/);
    if (!matchKet) return;
    const bulanList = matchKet[1].split(',').map(b => b.trim()).filter(b => monthNames.includes(b));
    const tahunKet  = matchKet[2];
    if (!bulanList.length) return;
    const iuranSheet = ss.getSheetByName('Iuran_Komite');
    if (!iuranSheet) return;
    const iuranData  = iuranSheet.getDataRange().getValues();
    const sudahBayarGratis = new Set();
    for (let i = 1; i < iuranData.length; i++) {
      const u   = String(iuranData[i][1] || '').replace(/^'+/, '').trim();
      if (u !== siswaGratis.username) continue;
      const mKet = String(iuranData[i][5] || '');
      const mMatch = mKet.match(/Bayar Bulan\s+(.+?)\s+(\d{4})/);
      if (mMatch && mMatch[2] === tahunKet) {
        mMatch[1].split(',').map(b => b.trim()).forEach(b => sudahBayarGratis.add(b));
      }
    }
    const bulanBelum = bulanList.filter(b => !sudahBayarGratis.has(b));
    if (!bulanBelum.length) return;
    const ketGratis = `Bayar Bulan ${bulanBelum.join(', ')} ${tahunKet} (Gratis - Diskon Saudara Kandung)`;
    const kelasGratis = siswaGratis.kelas || kelasYangBayar;
    iuranSheet.appendRow([
      Utilities.getUuid(),
      safeText(siswaGratis.username),
      kelasGratis,
      tanggal,
      0,
      ketGratis,
      safeText('SISTEM')
    ]);
    logActivity(logUser || 'SISTEM', 'AUTO_DISKON_SAUDARA',
      `Iuran gratis otomatis untuk ${siswaGratis.username} (${bulanBelum.join(', ')} ${tahunKet}) — diskon saudara kandung dari ${usernameYangBayar}`);
  } catch (e) {
    Logger.log('[_syncSaudaraIuran] Error: ' + e.toString());
  }
}
function deleteIuran(id, logUser) {
  _assertEmailGate(logUser);
  const lock = LockService.getScriptLock();
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Iuran_Komite');
    const data = sheet.getDataRange().getValues();
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] == id) {
        const siswa = data[i][1];
        sheet.deleteRow(i + 1);
        logActivity(logUser, 'DELETE', `Menghapus iuran siswa: ${siswa}`);
        return { success: true };
      }
    }
    return { success: false };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}
function updateIuran(id, siswa, kelas, tanggal, jumlah, ket, pencatat, logUser) {
  _assertEmailGate(logUser);
  const lock = LockService.getScriptLock();
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Iuran_Komite');
    const data = sheet.getDataRange().getValues();
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] == id) {
        sheet.getRange(i + 1, 2, 1, 6).setValues([[siswa, kelas, tanggal, jumlah, ket, pencatat]]);
        logActivity(logUser, 'UPDATE', `Mengedit iuran ID: ${id}, Siswa: ${siswa}, Kelas: ${kelas}`);
        return { success: true };
      }
    }
    throw new Error("Data tidak ditemukan.");
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}
function addUser(username, password, role, tugas, kelas, fullName, hariPiket, aksesPremium, aksesTabungan, adminUser) {
  _assertEmailGate(adminUser);
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
    const data = sheet.getDataRange().getValues();
    const uClean = String(username || '').trim();
    for (let i = 1; i < data.length; i++) {
      if (_cmpUsername(data[i][1], uClean)) throw new Error("Username sudah digunakan.");
    }
    const id = Utilities.getUuid();
    sheet.appendRow([id, "'" + uClean, "'" + password, role, tugas, false, kelas, fullName, hariPiket, false, aksesPremium, '', '', aksesTabungan]);
    logActivity(adminUser, 'CREATE_USER', `Menambah user baru: ${uClean} (${role})`);
    return { success: true };
  } catch (e) {
    throw e;
  } finally {
    lock.releaseLock();
  }
}
function editUser(id, username, role, tugas, kelas, fullName, hariPiket, aksesPremium, aksesTabungan, adminUser) {
  _assertEmailGate(adminUser);
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
    const data = sheet.getDataRange().getValues();
    const uClean = String(username || '').trim();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] != id && _cmpUsername(data[i][1], uClean)) {
        throw new Error("Username sudah digunakan oleh user lain.");
      }
    }
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] == id) {
        sheet.getRange(i + 1, 2).setValue("'" + uClean);
        sheet.getRange(i + 1, 4).setValue(role);
        sheet.getRange(i + 1, 5).setValue(tugas);
        sheet.getRange(i + 1, 7).setValue(kelas);
        sheet.getRange(i + 1, 8).setValue(fullName);
        sheet.getRange(i + 1, 9).setValue(hariPiket);
        sheet.getRange(i + 1, 11).setValue(aksesPremium);
        sheet.getRange(i + 1, 14).setValue(aksesTabungan);
        logActivity(adminUser, 'UPDATE_USER', `Mengedit data user: ${uClean}`);
        return { success: true };
      }
    }
    throw new Error("User ID tidak ditemukan.");
  } catch (e) {
    throw e;
  } finally {
    lock.releaseLock();
  }
}
function deleteUser(id, username, adminUser) {
  _assertEmailGate(adminUser);
  if (_cmpUsername(username, adminUser)) {
    throw new Error("Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif digunakan.");
  }
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
    const data = sheet.getDataRange().getValues();
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] == id) {
        sheet.deleteRow(i + 1);
        const sessionSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sessions');
        if (sessionSheet && sessionSheet.getLastRow() > 1) {
          const sessionData = sessionSheet.getDataRange().getValues();
          for (let j = sessionData.length - 1; j >= 1; j--) {
            if (_cmpUsername(sessionData[j][1], username)) sessionSheet.deleteRow(j + 1);
          }
        }
        logActivity(adminUser, 'DELETE_USER', `Menghapus user: ${username}`);
        return { success: true };
      }
    }
    throw new Error("User tidak ditemukan.");
  } finally {
    lock.releaseLock();
  }
}
function getStudentsByClass(kelasTarget, _callerUsername) {
  _assertEmailGate(_callerUsername);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  data.shift();
  // Normalisasi nilai kelas: lowercase + strip semua whitespace + buang
  // leading apostrophe (text-mode di Google Sheets). Berlaku untuk
  // nilai sheet maupun parameter target. Membuat pencocokan toleran
  // terhadap variasi penulisan ("7A" vs "7 A" vs "'7A").
  const norm = (v) => String(v == null ? '' : v).replace(/^'+/, '').replace(/\s+/g, '').toLowerCase();
  const target = norm(kelasTarget);
  return data
    .filter(row => {
      const role = String(row[3] || '').trim().toLowerCase();
      return role === 'siswa' && norm(row[6]) === target;
    })
    .map(row => {
      const username = String(row[1] || '').replace(/^'+/, '').trim();
      const fullName = String(row[7] || row[1] || '').replace(/^'+/, '').trim();
      return {
        username: username,
        fullName: fullName,
        nama:     fullName
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}
function getClassList(_callerUsername) {
  _assertEmailGate(_callerUsername);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Classes');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  data.shift();
  return data.map(r => r[2]).sort();
}
function getStudentsByWali(waliUsername) {
  _assertEmailGate(waliUsername);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const classSheet = ss.getSheetByName('Classes');
  const classData = classSheet.getDataRange().getValues();
  let targetClass = null;
  let targetTingkat = '';
  for(let i=1; i<classData.length; i++) {
    if(classData[i][3] == waliUsername) {
      targetTingkat = classData[i][1];
      targetClass = classData[i][2];
      break;
    }
  }
  if(!targetClass) return { found: false };
  const userSheet = ss.getSheetByName('Users');
  const userData = userSheet.getDataRange().getValues();
  userData.shift();
  const students = userData
    .filter(u => u[3] === 'Siswa' && u[6] === targetClass)
    .map(u => ({
      id: u[0],
      username: u[1],
      nama: u[7] || u[1],
      kelas: u[6],
      tingkat: targetTingkat
    }));
  const today = new Date();
  const timeZone = Session.getScriptTimeZone();
  const todayStr = Utilities.formatDate(today, timeZone, "yyyy-MM-dd");
  const attSheet = ss.getSheetByName('Attendance');
  const attData = attSheet ? attSheet.getDataRange().getValues() : [];
  const iuranSheet = ss.getSheetByName('Iuran_Komite');
  const iuranData = iuranSheet ? iuranSheet.getDataRange().getValues() : [];
  const savingsSheet = ss.getSheetByName('Savings');
  const savingsData = savingsSheet ? savingsSheet.getDataRange().getValues() : [];
  const gwSheet = ss.getSheetByName('Guru_Wali');
  const gwData = gwSheet ? gwSheet.getDataRange().getValues() : [];
  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const currentYear = today.getFullYear();
  const taYear = today.getMonth() >= 6 ? currentYear : currentYear - 1;
  const taYear2 = taYear + 1;
  const currentSemester = today.getMonth() >= 6 ? 1 : 2;
  const S1_MONTHS_WALI = ['Juli','Agustus','September','Oktober','November','Desember'];
  const S2_MONTHS_WALI = ['Januari','Februari','Maret','April','Mei','Juni'];
  const semMonths = currentSemester === 1 ? S1_MONTHS_WALI : S2_MONTHS_WALI;
  const result = students.map(s => {
    const username = s.username;
    let kehadiranHariIni = '-';
    for (let i = 1; i < attData.length; i++) {
      const _attDateCell = attData[i][1];
      let _attDateStr = '';
      if (_attDateCell instanceof Date) {
        _attDateStr = Utilities.formatDate(_attDateCell, timeZone, "yyyy-MM-dd");
      } else if (typeof _attDateCell === 'number') {
        _attDateStr = Utilities.formatDate(new Date((_attDateCell - 25569) * 86400 * 1000), timeZone, "yyyy-MM-dd");
      } else if (_attDateCell) {
        const _dd = new Date(_attDateCell);
        if (!isNaN(_dd.getTime())) _attDateStr = Utilities.formatDate(_dd, timeZone, "yyyy-MM-dd");
      }
      if (_attDateStr === todayStr && attData[i][3] == username) {
        kehadiranHariIni = attData[i][5];
        break;
      }
    }
    let saldo = 0;
    for (let i = 1; i < savingsData.length; i++) {
      if (_cmpUsername(plainText(savingsData[i][3]), username)) {
        const amount = parseFloat(savingsData[i][6]) || 0;
        if (savingsData[i][5] === 'Setor') saldo += amount;
        else if (savingsData[i][5] === 'Tarik') saldo -= amount;
      }
    }
    const bulanLunas = [];
    let totalBayar = 0;
    let nominalPerBulan = 0;
    for (let i = 1; i < iuranData.length; i++) {
      if (iuranData[i][1] == s.nama) {
        const tanggal = iuranData[i][3];
        let _transYear = 0, _transMonth = 0;
        if (tanggal) {
          let _d;
          if (tanggal instanceof Date) _d = tanggal;
          else if (typeof tanggal === 'number') _d = excelSerialToDate(tanggal);
          else _d = new Date(tanggal);
          if (_d && !isNaN(_d.getTime())) {
            _transYear  = _d.getFullYear();
            _transMonth = _d.getMonth() + 1;
          }
        }
        const _iS1 = _transYear === taYear  && _transMonth >= 7;
        const _iS2 = _transYear === taYear2 && _transMonth <= 6;
        if (!_iS1 && !_iS2) continue;
        const jumlah = parseFloat(iuranData[i][4]) || 0;
        totalBayar += jumlah;
        const ket = iuranData[i][5] || '';
        const match = ket.match(/Bayar Bulan\s+(.+?)\s+\d{4}/);
        if (match) {
          const bulanList = match[1].split(',').map(b => b.trim());
          bulanList.forEach(b => {
            if (monthNames.includes(b) && !bulanLunas.includes(b)) bulanLunas.push(b);
          });
          if (bulanList.length > 0) {
            const nominalThis = Math.floor(jumlah / bulanList.length);
            if (nominalThis > nominalPerBulan) nominalPerBulan = nominalThis;
          }
        }
      }
    }
    const bulanKurang = semMonths.filter(b => !bulanLunas.includes(b));
    let statusIuran = 'Lunas';
    if (bulanKurang.length > 0) {
      const jumlahKurang = nominalPerBulan * bulanKurang.length;
      statusIuran = `Kurang ${bulanKurang.length} bulan (${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(jumlahKurang)})`;
    }
    let guruWali = '-';
    for (let i = 1; i < gwData.length; i++) {
      try {
        const siswaList = JSON.parse(gwData[i][3] || '[]');
        if (siswaList.some(siswa => siswa.username === username)) {
          guruWali = gwData[i][2];
          break;
        }
      } catch(e) {}
    }
    return {
      username: s.username,
      nama: s.nama,
      kelas: s.kelas,
      tingkat: s.tingkat,
      kehadiranHariIni: kehadiranHariIni,
      statusIuran: statusIuran,
      saldoTabungan: saldo,
      guruWali: guruWali
    };
  });
  return { found: true, className: `${targetTingkat} ${targetClass}`, students: result };
}
function getWaliKelasList(_callerUsername) {
  _assertEmailGate(_callerUsername);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  const data = sheet.getDataRange().getValues();
  data.shift();
  return data
    .filter(row => row[3] === 'Guru' && row[4].includes('Wali Kelas'))
    .map(row => ({
      username: row[1],
      fullName: row[7] || row[1]
    }));
}
function getAttendanceData(_callerUsername) {
  _assertEmailGate(_callerUsername);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Attendance');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  data.shift();
  const timeZone = Session.getScriptTimeZone();
  const _clean = (v) => String(v == null ? '' : v).replace(/^'+/, '').trim();

  // Tentukan scope data berdasarkan role pemanggil:
  // - Admin  → semua data tanpa filter kelas
  // - Guru dengan tugas Kepala Madrasah/Sekolah atau Guru Piket → semua data
  // - Guru dengan tugas Wali Kelas → hanya kelas yang dipegang
  // - Lainnya (tidak diharapkan di halaman ini) → kosong
  const callerData = _getUserData_(_callerUsername);
  const callerRole = callerData ? String(callerData.role || '').trim() : '';
  const callerTugas = callerData ? (callerData.tugasTambahan || []) : [];

  let kelasFilter = null; // null = semua kelas, string = filter ke kelas tertentu

  if (callerRole === 'Admin') {
    kelasFilter = null; // Admin melihat semua
  } else if (callerRole === 'Guru') {
    const isKepala   = callerTugas.includes('Kepala Madrasah/Sekolah');
    const isPiket    = callerTugas.includes('Guru Piket');
    const isWali     = callerTugas.includes('Wali Kelas');
    // Guru Pengganti: dikonfirmasi hari ini sebagai pengganti guru piket
    const isPengganti = !isPiket && _isPiketTerkonfirmasi_(_callerUsername);

    if (isKepala || isPiket || isPengganti) {
      kelasFilter = null; // Kepala, Guru Piket, & Guru Pengganti melihat semua
    } else if (isWali) {
      // Wali Kelas hanya melihat kelasnya sendiri
      const kelasInfo = getWaliKelasByGuru(_callerUsername);
      if (!kelasInfo) return [];
      kelasFilter = String(kelasInfo.nama || '').trim();
    } else {
      // Guru biasa tanpa tugas khusus yang relevan — kosong
      return [];
    }
  } else {
    return [];
  }

  const rows = kelasFilter
    ? data.filter(row => String(row[2] || '').trim() === kelasFilter)
    : data;

  return rows.map(row => ({
      id: row[0],
      tanggal: row[1] ? Utilities.formatDate(new Date(row[1]), timeZone, "yyyy-MM-dd") : '',
      kelas: row[2],
      username: _clean(row[3]),
      nama: row[4],
      status: row[5],
      ket: row[6],
      pencatat: _clean(row[7])
    })).reverse();
}
function saveAttendanceBatch(attendanceList, pencatat, logUser) {
  _assertEmailGate(logUser);
  // Piket_Gatekeeper
  const _pgUserData = _getUserData_(logUser);
  if (_pgUserData && _pgUserData.role === 'Guru'
      && (_pgUserData.tugasTambahan || []).includes('Guru Piket')) {
    if (!_isPiketTerkonfirmasi_(logUser)) {
      return { success: false,
               message: 'Kehadiran Anda sebagai guru piket belum dikonfirmasi oleh Admin untuk hari ini.' };
    }
  }
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    if (!Array.isArray(attendanceList) || attendanceList.length === 0) {
      return { success: false, message: 'Daftar absensi kosong.' };
    }
    const VALID_STATUS = ['Hadir', 'Sakit', 'Izin', 'Alpha'];
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    for (let n = 0; n < attendanceList.length; n++) {
      const it = attendanceList[n];
      if (!it || !it.tanggal || !dateRe.test(String(it.tanggal))) {
        return { success: false, message: 'Format tanggal tidak valid (harus yyyy-MM-dd).' };
      }
      if (!it.kelas || !it.username) {
        return { success: false, message: 'Data siswa tidak lengkap (kelas/username kosong).' };
      }
      if (VALID_STATUS.indexOf(it.status) < 0) {
        return { success: false, message: 'Status tidak valid: ' + it.status };
      }
    }
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Attendance');
    if (!sheet) throw new Error('Sheet Attendance tidak ditemukan.');
    const existingData = sheet.getDataRange().getValues();
    const existingSet = new Set();
    const timeZone = Session.getScriptTimeZone();
    for (let i = 1; i < existingData.length; i++) {
      const row = existingData[i];
      const tanggal = row[1];
      const kelas = row[2];
      const username = String(row[3] == null ? '' : row[3]).replace(/^'+/, '').trim();
      let dateStr;
      if (tanggal instanceof Date) {
        dateStr = Utilities.formatDate(tanggal, timeZone, "yyyy-MM-dd");
      } else if (typeof tanggal === 'number') {
        dateStr = Utilities.formatDate(new Date((tanggal - 25569) * 86400 * 1000), timeZone, "yyyy-MM-dd");
      } else {
        const d = new Date(tanggal);
        dateStr = isNaN(d.getTime()) ? String(tanggal) : Utilities.formatDate(d, timeZone, "yyyy-MM-dd");
      }
      const numKey = parseFloat(username);
      const userKey = (!isNaN(numKey) && isFinite(numKey) && username !== '') ? String(numKey) : username;
      existingSet.add(dateStr + '|' + kelas + '|' + userKey);
    }
    for (let i = 0; i < attendanceList.length; i++) {
      const item = attendanceList[i];
      const u = String(item.username || '').replace(/^'+/, '').trim();
      const numKey = parseFloat(u);
      const userKey = (!isNaN(numKey) && isFinite(numKey) && u !== '') ? String(numKey) : u;
      const key = item.tanggal + '|' + item.kelas + '|' + userKey;
      if (existingSet.has(key)) {
        return { success: false, message: `Data absensi untuk siswa ${item.nama} pada tanggal ${item.tanggal} sudah ada.` };
      }
    }
    const dataToAppend = attendanceList.map(item => {
      return [
        Utilities.getUuid(),
        item.tanggal,
        item.kelas,
        safeText(String(item.username || '').trim()),
        item.nama,
        item.status,
        item.ket || '',
        safeText(pencatat)
      ];
    });
    if (dataToAppend.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, dataToAppend.length, 8).setValues(dataToAppend);
    }
    logActivity(logUser, 'CREATE_ATTENDANCE', `Input Absensi Batch: ${attendanceList[0].kelas} (${dataToAppend.length} Siswa)`);
    return { success: true };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}
function updateAttendance(id, tanggal, kelas, username, nama, status, ket, logUser) {
  _assertEmailGate(logUser);
  // Piket_Gatekeeper
  const _pgUserData = _getUserData_(logUser);
  if (_pgUserData && _pgUserData.role === 'Guru'
      && (_pgUserData.tugasTambahan || []).includes('Guru Piket')) {
    if (!_isPiketTerkonfirmasi_(logUser)) {
      return { success: false,
               message: 'Kehadiran Anda sebagai guru piket belum dikonfirmasi oleh Admin untuk hari ini.' };
    }
  }
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    if (!id) throw new Error('ID absensi kosong.');
    const VALID_STATUS = ['Hadir', 'Sakit', 'Izin', 'Alpha'];
    if (VALID_STATUS.indexOf(status) < 0) {
      return { success: false, message: 'Status tidak valid: ' + status };
    }
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (!tanggal || !dateRe.test(String(tanggal))) {
      return { success: false, message: 'Format tanggal tidak valid.' };
    }
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Attendance');
    if (!sheet) throw new Error('Sheet Attendance tidak ditemukan.');
    const data = sheet.getDataRange().getValues();
    const userSheet = ss.getSheetByName('Users');
    const users = userSheet.getDataRange().getValues();
    let requestingRole = '';
    let requestingFullName = '';
    const cleanLogUser = String(logUser || '').replace(/^'+/, '');
    for (let u = 1; u < users.length; u++) {
      if (_cmpUsername(users[u][1], cleanLogUser)) {
        requestingRole    = users[u][3] || '';
        requestingFullName = String(users[u][7] || '').trim();
        break;
      }
    }
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) {
        const pencatat = String(data[i][7] || '').replace(/^'+/, '').trim();
        const isAdmin  = requestingRole === 'Admin';
        const isOwner  = pencatat === (requestingFullName || cleanLogUser) || pencatat === cleanLogUser;
        if (!isAdmin && !isOwner) {
          return { success: false, message: 'Akses ditolak. Anda hanya dapat mengedit absensi yang Anda catat sendiri.' };
        }
        sheet.getRange(i + 1, 2, 1, 6).setValues([[tanggal, kelas, safeText(String(username || '').trim()), nama, status, ket || '']]);
        logActivity(logUser, 'UPDATE_ATTENDANCE', `Edit Absensi ID: ${id}`);
        return { success: true };
      }
    }
    throw new Error("Data Absensi tidak ditemukan.");
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}
function deleteAttendance(id, logUser) {
  _assertEmailGate(logUser);
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    if (!id) throw new Error('ID absensi kosong.');
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Attendance');
    if (!sheet) throw new Error('Sheet Attendance tidak ditemukan.');
    const data = sheet.getDataRange().getValues();
    const userSheet = ss.getSheetByName('Users');
    const users = userSheet.getDataRange().getValues();
    let requestingRole = '';
    let requestingFullName = '';
    const cleanLogUser = String(logUser || '').replace(/^'+/, '');
    for (let u = 1; u < users.length; u++) {
      if (_cmpUsername(users[u][1], cleanLogUser)) {
        requestingRole     = users[u][3] || '';
        requestingFullName = String(users[u][7] || '').trim();
        break;
      }
    }
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) {
        const pencatat = String(data[i][7] || '').replace(/^'+/, '').trim();
        const isAdmin  = requestingRole === 'Admin';
        const isOwner  = pencatat === (requestingFullName || cleanLogUser) || pencatat === cleanLogUser;
        if (!isAdmin && !isOwner) {
          return { success: false, message: 'Akses ditolak. Anda hanya dapat menghapus absensi yang Anda catat sendiri.' };
        }
        sheet.deleteRow(i + 1);
        logActivity(logUser, 'DELETE_ATTENDANCE', `Hapus Absensi ID: ${id}`);
        return { success: true };
      }
    }
    throw new Error("Data Absensi tidak ditemukan.");
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}
function getSavingsData(_callerUsername) {
  _assertEmailGate(_callerUsername);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Savings');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  data.shift();
  const timeZone = Session.getScriptTimeZone();
  return data.map(row => {
    let dateStr = '';
    try {
      const dateVal = row[1];
      if (dateVal) {
        let dateObj = null;
        if (dateVal instanceof Date) {
          dateObj = dateVal;
        } else if (typeof dateVal === 'number') {
          dateObj = new Date((dateVal - 25569) * 86400 * 1000);
        } else {
          const parsed = new Date(dateVal);
          if (!isNaN(parsed.getTime())) dateObj = parsed;
        }
        if (dateObj) {
          dateStr = Utilities.formatDate(dateObj, timeZone, "yyyy-MM-dd");
        }
      }
    } catch (e) {
      dateStr = '';
    }
    return {
      id: row[0] || '',
      tanggal: dateStr,
      kelas: row[2] || '',
      username: plainText(row[3]),
      nama: row[4] || '',
      jenis: row[5] || '',
      jumlah: parseFloat(row[6]) || 0,
      ket: row[7] || '',
      pencatat: plainText(row[8]),
      penabungType: row[9] || 'Siswa'
    };
  }).reverse();
}
/**
 * Menghitung saldo tabungan penabung sebelum transaksi dengan ID excludeId.
 *
 * Iterasi seluruh savingsData (skip row header index 0), cocokkan username
 * dengan kolom index 3 (kolom 4, 1-indexed) menggunakan _cmpUsername().
 * Abaikan baris dengan id (kolom index 0) sama dengan excludeId.
 * jenis 'Setor' (kolom index 5) → tambahkan jumlah (kolom index 6).
 * jenis 'Tarik' (kolom index 5) → kurangi jumlah (kolom index 6).
 * Nilai non-numerik di kolom index 6 diperlakukan sebagai 0.
 * Saldo bisa negatif — tidak ada floor.
 *
 * @param {string} username    - Username penabung
 * @param {string} excludeId   - ID transaksi yang diabaikan (transaksi yang baru disimpan)
 * @param {Array}  savingsData - Array rows dari Sheet_Savings (termasuk header di index 0)
 * @returns {number}           - Saldo sebelum transaksi (bisa negatif)
 */
function _calcSaldoSebelum_(username, excludeId, savingsData) {
  var saldo = 0;
  for (var i = 1; i < savingsData.length; i++) {
    var row = savingsData[i];
    var rowId    = row[0];
    var rowUser  = row[3];
    var rowJenis = row[5];
    var rowJumlah = row[6];

    // Abaikan baris dengan id sama dengan excludeId
    if (String(rowId == null ? '' : rowId) === String(excludeId == null ? '' : excludeId)) {
      continue;
    }

    // Cocokkan username menggunakan _cmpUsername()
    if (!_cmpUsername(rowUser, username)) {
      continue;
    }

    // Nilai non-numerik di kolom jumlah diperlakukan sebagai 0
    var jumlahNum = parseFloat(rowJumlah);
    if (isNaN(jumlahNum)) {
      jumlahNum = 0;
    }

    if (rowJenis === 'Setor') {
      saldo += jumlahNum;
    } else if (rowJenis === 'Tarik') {
      saldo -= jumlahNum;
    }
  }
  return saldo;
}

/**
 * Mengonversi bilangan bulat non-negatif (0–1.000.000.000) ke kalimat
 * Bahasa Indonesia yang diakhiri 'Rupiah'.
 *
 * Fungsi murni — tidak mengakses Spreadsheet, tidak melakukan I/O.
 *
 * @param {number} angka  Bilangan bulat, 0 ≤ angka ≤ 1.000.000.000
 * @returns {string}  e.g. terbilang(50000)      → "Lima Puluh Ribu Rupiah"
 *                         terbilang(0)           → "Nol Rupiah"
 *                         terbilang(1000)        → "Seribu Rupiah"
 *                         terbilang(-1)          → "Tidak Diketahui"
 *                         terbilang(1000000001)  → "Tidak Diketahui"
 */
function terbilang(angka) {
  // --- validasi input ---
  if (typeof angka !== 'number' || isNaN(angka) || !isFinite(angka)) {
    return 'Tidak Diketahui';
  }
  // harus integer
  if (angka !== Math.floor(angka)) {
    return 'Tidak Diketahui';
  }
  if (angka < 0 || angka > 1000000000) {
    return 'Tidak Diketahui';
  }

  // --- satuan ---
  var satuan = [
    '', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima',
    'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh',
    'Sebelas', 'Dua Belas', 'Tiga Belas', 'Empat Belas', 'Lima Belas',
    'Enam Belas', 'Tujuh Belas', 'Delapan Belas', 'Sembilan Belas'
  ];

  /**
   * Konversi bilangan 0–999 ke kata.
   * @param {number} n  Integer 0–999
   * @returns {string}
   */
  function ratusan(n) {
    if (n === 0) return '';
    if (n < 20) return satuan[n];

    var r = '';
    if (n >= 100) {
      var ratusDigit = Math.floor(n / 100);
      r += (ratusDigit === 1 ? 'Seratus' : satuan[ratusDigit] + ' Ratus');
      n = n % 100;
      if (n > 0) r += ' ';
    }
    if (n === 0) return r;
    if (n < 20) return r + satuan[n];

    var puluhDigit = Math.floor(n / 10);
    var satuDigit  = n % 10;
    r += satuan[puluhDigit] + ' Puluh';
    if (satuDigit > 0) r += ' ' + satuan[satuDigit];
    return r;
  }

  // kasus khusus nol
  if (angka === 0) return 'Nol Rupiah';

  var hasil = '';
  var n = angka;

  // miliar (10^9)
  if (n >= 1000000000) {
    var miliarDigit = Math.floor(n / 1000000000);
    hasil += ratusan(miliarDigit) + ' Miliar';
    n = n % 1000000000;
    if (n > 0) hasil += ' ';
  }

  // juta (10^6)
  if (n >= 1000000) {
    var jutaDigit = Math.floor(n / 1000000);
    hasil += ratusan(jutaDigit) + ' Juta';
    n = n % 1000000;
    if (n > 0) hasil += ' ';
  }

  // ribu (10^3)
  if (n >= 1000) {
    var ribuDigit = Math.floor(n / 1000);
    if (ribuDigit === 1) {
      hasil += 'Seribu';
    } else {
      hasil += ratusan(ribuDigit) + ' Ribu';
    }
    n = n % 1000;
    if (n > 0) hasil += ' ';
  }

  // ratusan–satuan sisa
  if (n > 0) {
    hasil += ratusan(n);
  }

  return hasil.trim() + ' Rupiah';
}

/**
 * Memformat angka ke string Rupiah Indonesia.
 * Contoh: 50000 → "Rp 50.000"
 * @param {number} n
 * @returns {string}
 */
function _formatRupiah_(n) {
  var num = typeof n === 'number' ? n : parseFloat(n) || 0;
  // Tangani negatif
  var isNeg = num < 0;
  var abs = Math.abs(Math.round(num));
  var str = String(abs).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return 'Rp ' + (isNeg ? '-' : '') + str;
}

/**
 * Membangun konten HTML Slip Penarikan Tabungan.
 *
 * @param {Object} params
 * @param {string}  params.noSlip          - Nomor slip hasil _generateNoSlip_
 * @param {string}  params.tanggalStr      - Tanggal format "dd/mmm/yyyy" Bahasa Indonesia
 * @param {string}  params.nama            - Nama lengkap penabung
 * @param {string}  params.kelas           - Kelas / label tipe penabung
 * @param {number}  params.jumlah          - Nominal penarikan
 * @param {string}  params.ket             - Keterangan / alasan
 * @param {number}  params.saldoSebelum
 * @param {number}  params.saldoSesudah
 * @param {string}  params.logoSekolahUrl  - URL logo sekolah
 * @param {string}  params.logoKoperasiUrl - URL logo koperasi
 * @param {string}  params.namaSekolah     - Nama sekolah
 * @returns {{ html: string, plainText: string }}
 */
function _buildSlipPenarikanHtml(params) {
  var noSlip         = params.noSlip || '-';
  var tanggalStr     = params.tanggalStr || '-';
  var namaRaw        = params.nama;
  var kelasRaw       = params.kelas;
  var jumlah         = params.jumlah || 0;
  var ket            = params.ket || '';
  var saldoSebelum   = typeof params.saldoSebelum === 'number' ? params.saldoSebelum : 0;
  var saldoSesudah   = typeof params.saldoSesudah === 'number' ? params.saldoSesudah : 0;
  var biayaAdmin     = typeof params.biayaAdmin === 'number'   ? params.biayaAdmin   : 0;
  var jumlahDiterima = jumlah - biayaAdmin;
  var logoSekolahUrl = params.logoSekolahUrl || '';
  var logoKoperasiUrl = params.logoKoperasiUrl || '';
  var namaSekolah    = params.namaSekolah || 'MADRASAH TSANAWIYAH NURUL FALAH';

  // Tampilkan '-' jika kosong
  var namaTampil  = (namaRaw  != null && String(namaRaw).trim()  !== '') ? String(namaRaw).trim()  : '-';
  var kelasTampil = (kelasRaw != null && String(kelasRaw).trim() !== '') ? String(kelasRaw).trim() : '-';

  // Mapping alasan penarikan dari ket (case-insensitive)
  var ketStr = (ket != null) ? String(ket).toLowerCase() : '';
  var alasan;
  if (ketStr.indexOf('sekolah') !== -1) {
    alasan = 'Sekolah';
  } else if (ketStr.indexOf('pribadi') !== -1) {
    alasan = 'Pribadi';
  } else if (ketStr.indexOf('orang tua') !== -1 || ketStr.indexOf('wali') !== -1) {
    alasan = 'Orang Tua/Wali';
  } else {
    alasan = 'Lainnya';
  }

  // Format Rupiah
  var nominalFmt        = _formatRupiah_(jumlah);
  var saldoSebelumFmt   = _formatRupiah_(saldoSebelum);
  var saldoSesudahFmt   = _formatRupiah_(saldoSesudah);
  var biayaAdminFmt     = _formatRupiah_(biayaAdmin);
  var jumlahDiterimarFmt = _formatRupiah_(jumlahDiterima);
  var terbilangStr      = terbilang(jumlah);

  // Elemen logo
  var logoKiri  = logoSekolahUrl  ? '<img src="' + logoSekolahUrl  + '" alt="Logo Sekolah"  style="max-height:60px;max-width:120px;">'  : '<span style="font-size:12px;color:#888;">[Logo Sekolah]</span>';
  var logoKanan = logoKoperasiUrl ? '<img src="' + logoKoperasiUrl + '" alt="Logo Koperasi" style="max-height:60px;max-width:120px;">' : '<span style="font-size:12px;color:#888;">[Logo Koperasi]</span>';

  // Catatan (ket asli tanpa modifikasi)
  var catatanTampil = (ket != null && String(ket).trim() !== '') ? String(ket) : '-';

  var html = '' +
    '<div style="font-family:\'Segoe UI\',Arial,sans-serif;max-width:600px;margin:0 auto;' +
    'background:#fff;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,0.12);overflow:hidden;">' +

    // Header: logo + nama lembaga
    '<div style="background:#1a5276;padding:16px 20px;color:#fff;">' +
      '<table width="100%" cellpadding="0" cellspacing="0"><tr>' +
        '<td style="width:80px;vertical-align:middle;">' + logoKiri + '</td>' +
        '<td style="text-align:center;vertical-align:middle;">' +
          '<div style="font-size:15px;font-weight:700;letter-spacing:0.5px;">KOPERASI NURUL FALAH (KNF)</div>' +
          '<div style="font-size:12px;margin-top:2px;opacity:0.9;">' + namaSekolah + '</div>' +
          '<div style="margin-top:6px;font-size:14px;font-weight:600;letter-spacing:1px;' +
          'background:rgba(255,255,255,0.15);border-radius:4px;padding:4px 8px;display:inline-block;">' +
          'SLIP PENARIKAN TABUNGAN</div>' +
        '</td>' +
        '<td style="width:80px;vertical-align:middle;text-align:right;">' + logoKanan + '</td>' +
      '</tr></table>' +
    '</div>' +

    // Info dasar
    '<div style="padding:16px 20px;border-bottom:1px solid #eee;">' +
      '<table width="100%" cellpadding="4" cellspacing="0" style="font-size:13px;">' +
        '<tr><td style="color:#555;width:130px;">No. Slip</td><td style="color:#333;font-weight:600;">: ' + noSlip + '</td></tr>' +
        '<tr><td style="color:#555;">Tanggal</td><td style="color:#333;">: ' + tanggalStr + '</td></tr>' +
        '<tr><td style="color:#555;">Nama</td><td style="color:#333;">: ' + namaTampil + '</td></tr>' +
        '<tr><td style="color:#555;">Kelas</td><td style="color:#333;">: ' + kelasTampil + '</td></tr>' +
      '</table>' +
    '</div>' +

    // Detail transaksi
    '<div style="padding:16px 20px;border-bottom:1px solid #eee;">' +
      '<table width="100%" cellpadding="4" cellspacing="0" style="font-size:13px;">' +
        '<tr><td style="color:#555;width:130px;">Nominal Penarikan</td><td style="color:#c0392b;font-weight:700;">: ' + nominalFmt + '</td></tr>' +
        '<tr><td style="color:#555;">Terbilang</td><td style="color:#333;font-style:italic;">: ' + terbilangStr + '</td></tr>' +
        '<tr><td style="color:#555;">Alasan Penarikan</td><td style="color:#333;">: ' + alasan + '</td></tr>' +
        '<tr><td style="color:#555;">Catatan</td><td style="color:#333;">: ' + catatanTampil + '</td></tr>' +
        '<tr><td style="color:#555;">Biaya Admin</td><td style="color:#e67e22;">: ' + biayaAdminFmt + '</td></tr>' +
        '<tr style="border-top:1px solid #eee;"><td style="color:#555;font-weight:600;padding-top:8px;">Jumlah Diterima</td><td style="color:#27ae60;font-weight:700;padding-top:8px;">: ' + jumlahDiterimarFmt + '</td></tr>' +
      '</table>' +
    '</div>' +

    // Saldo
    '<div style="padding:16px 20px;border-bottom:1px solid #eee;background:#f8f9fa;">' +
      '<table width="100%" cellpadding="4" cellspacing="0" style="font-size:13px;">' +
        '<tr><td style="color:#555;width:130px;">Saldo Sebelum</td><td style="color:#333;">: ' + saldoSebelumFmt + '</td></tr>' +
        '<tr><td style="color:#555;">Saldo Sesudah</td><td style="color:#27ae60;font-weight:700;">: ' + saldoSesudahFmt + '</td></tr>' +
      '</table>' +
    '</div>' +

    // Footer
    '<div style="padding:14px 20px;text-align:center;background:#f0f3f4;">' +
      '<div style="font-size:12px;color:#555;">Pengelola: <strong>Randi Pratama, S.Pd.</strong></div>' +
      '<div style="font-size:11px;color:#888;margin-top:4px;font-style:italic;">' +
        '&ldquo;Menabung Hari Ini, Menggapai Impian Esok Hari&rdquo;' +
      '</div>' +
    '</div>' +

    '</div>';

  // Plain text fallback — minimal: nama, kelas, nominal (Rp), tanggal
  var plainText = [
    'SLIP PENARIKAN TABUNGAN',
    '========================',
    'No. Slip         : ' + noSlip,
    'Tanggal          : ' + tanggalStr,
    'Nama             : ' + namaTampil,
    'Kelas            : ' + kelasTampil,
    '------------------------',
    'Nominal Penarikan: ' + nominalFmt,
    'Terbilang        : ' + terbilangStr,
    'Alasan Penarikan : ' + alasan,
    'Catatan          : ' + catatanTampil,
    'Biaya Admin      : ' + biayaAdminFmt,
    'Jumlah Diterima  : ' + jumlahDiterimarFmt,
    '------------------------',
    'Saldo Sebelum    : ' + saldoSebelumFmt,
    'Saldo Sesudah    : ' + saldoSesudahFmt,
    '========================',
    'Pengelola: Randi Pratama, S.Pd.',
    '"Menabung Hari Ini, Menggapai Impian Esok Hari"'
  ].join('\n');

  return { html: html, plainText: plainText };
}

/**
 * Membuat PDF Slip Penarikan Tabungan secara programmatic menggunakan DocumentApp.
 *
 * Pendekatan: buat Google Doc baru → isi konten sesuai format slip fisik → export PDF blob
 * → hapus Doc dari Drive. Tidak membutuhkan template file.
 *
 * Format slip mengikuti dokumen fisik KNF:
 * - Header: logo kiri | nama lembaga | logo kanan
 * - Judul: SLIP PENARIKAN TABUNGAN
 * - Tabel data: No. Slip, Tanggal, Nama, Kelas, Nominal, Terbilang, Alasan (checkbox), dll.
 * - Footer: tanda tangan Penarik dan Pengelola, tagline
 *
 * @param {Object} params  — parameter sama dengan _buildSlipPenarikanHtml
 * @returns {Blob|null}    — PDF Blob siap attach ke email, atau null jika gagal
 */
function _buildSlipPenarikanPdfBlob_(params) {
  var doc = null;
  var docId = null;
  try {
    var noSlip          = params.noSlip         || '-';
    var tanggalStr      = params.tanggalStr      || '-';
    var namaRaw         = params.nama;
    var kelasRaw        = params.kelas;
    var jumlah          = params.jumlah          || 0;
    var ket             = params.ket             || '';
    var saldoSebelum    = typeof params.saldoSebelum === 'number' ? params.saldoSebelum : 0;
    var saldoSesudah    = typeof params.saldoSesudah === 'number' ? params.saldoSesudah : 0;
    var biayaAdmin      = typeof params.biayaAdmin   === 'number' ? params.biayaAdmin   : 0;
    var jumlahDiterima  = jumlah - biayaAdmin;
    var logoSekolahUrl  = params.logoSekolahUrl  || '';
    var logoKoperasiUrl = params.logoKoperasiUrl || '';
    var namaSekolah     = params.namaSekolah     || 'MADRASAH TSANAWIYAH NURUL FALAH';

    var namaTampil  = (namaRaw  != null && String(namaRaw).trim()  !== '') ? String(namaRaw).trim()  : '-';
    var kelasTampil = (kelasRaw != null && String(kelasRaw).trim() !== '') ? String(kelasRaw).trim() : '-';

    // Mapping alasan + checkbox
    var ketStr = (ket != null) ? String(ket).toLowerCase() : '';
    var alasan;
    if      (ketStr.indexOf('sekolah')   !== -1)                                        alasan = 'Sekolah';
    else if (ketStr.indexOf('pribadi')   !== -1)                                        alasan = 'Pribadi';
    else if (ketStr.indexOf('orang tua') !== -1 || ketStr.indexOf('wali') !== -1)       alasan = 'Orang Tua/Wali';
    else                                                                                 alasan = 'Lainnya';

    // Format checkbox: ☑ untuk yang dipilih, ☐ untuk yang tidak
    var cbSekolah   = (alasan === 'Sekolah')       ? '\u2611 Sekolah'        : '\u2610 Sekolah';
    var cbPribadi   = (alasan === 'Pribadi')        ? '\u2611 Pribadi'        : '\u2610 Pribadi';
    var cbOrtu      = (alasan === 'Orang Tua/Wali') ? '\u2611 Orang Tua/Wali' : '\u2610 Orang Tua/Wali';
    var lainnyaTeks = (alasan === 'Lainnya')
      ? '\u2611 Lainnya: ' + (String(ket).trim() || '...')
      : '\u2610 Lainnya: ...';
    var alasanCb = cbSekolah + '   ' + cbPribadi + '   ' + cbOrtu + '   ' + lainnyaTeks;

    var nominalFmt        = _formatRupiah_(jumlah);
    var saldoSebelumFmt   = _formatRupiah_(saldoSebelum);
    var saldoSesudahFmt   = _formatRupiah_(saldoSesudah);
    var biayaAdminFmt     = _formatRupiah_(biayaAdmin);
    var jumlahDiterimaFmt = _formatRupiah_(jumlahDiterima);
    var terbilangStr      = terbilang(jumlah);
    var catatanTampil     = (ket != null && String(ket).trim() !== '') ? String(ket) : '-';
    var fileName          = 'Slip-Tarik-' + noSlip + '.pdf';

    // ── Buat Google Doc ──────────────────────────────────────────────
    // FIX: DocumentApp.create() langsung, page size diset via Document API (bukan Body)
    doc   = DocumentApp.create('TEMP_SLIP_' + noSlip + '_' + new Date().getTime());
    docId = doc.getId();

    // FIX: setPageWidth/Height ada di Document level, bukan Body
    // Ukuran A4 portrait dalam pt (1pt = 1/72 inch, 1 inch = 2.54cm)
    // A4: 210mm x 297mm = 595.28pt x 841.89pt — ini default, tidak perlu set eksplisit
    // Set margin kecil via Body
    var body = doc.getBody();
    body.setMarginTop(36);
    body.setMarginBottom(36);
    body.setMarginLeft(36);
    body.setMarginRight(36);

    // ── Header: logo kiri | teks lembaga | logo kanan ───────────────
    // Buat tabel header 1 baris x 3 kolom
    var headerTbl = body.appendTable([['', '', '']]);
    headerTbl.setBorderWidth(0);
    headerTbl.setColumnWidth(0, 60);
    headerTbl.setColumnWidth(2, 60);

    // Logo sekolah (kiri)
    var cellKiri = headerTbl.getCell(0, 0);
    cellKiri.setVerticalAlignment(DocumentApp.VerticalAlignment.MIDDLE);
    if (logoSekolahUrl) {
      try {
        var imgBlobS = UrlFetchApp.fetch(logoSekolahUrl).getBlob();
        // FIX: hapus konten cell dengan setText('') dulu, lalu appendImage
        cellKiri.setText('');
        var imgEl = cellKiri.appendImage(imgBlobS);
        imgEl.setWidth(48).setHeight(48);
      } catch (_logoErr) {
        cellKiri.setText('[Logo\nSekolah]');
      }
    } else {
      cellKiri.setText('[Logo\nSekolah]');
    }

    // Teks tengah
    var cellTengah = headerTbl.getCell(0, 1);
    cellTengah.setVerticalAlignment(DocumentApp.VerticalAlignment.MIDDLE);
    // FIX: gunakan setText untuk baris pertama, appendParagraph untuk baris berikutnya
    cellTengah.setText('KOPERASI NURUL FALAH (KNF)');
    var pKnf = cellTengah.getParagraphs()[0];
    pKnf.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    pKnf.editAsText().setBold(true).setFontSize(13);

    var pMts = cellTengah.appendParagraph(namaSekolah.toUpperCase());
    pMts.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    pMts.editAsText().setBold(true).setFontSize(11);

    // Logo koperasi (kanan)
    var cellKanan = headerTbl.getCell(0, 2);
    cellKanan.setVerticalAlignment(DocumentApp.VerticalAlignment.MIDDLE);
    if (logoKoperasiUrl) {
      try {
        var imgBlobK = UrlFetchApp.fetch(logoKoperasiUrl).getBlob();
        // FIX: sama seperti logo kiri
        cellKanan.setText('');
        var imgElK = cellKanan.appendImage(imgBlobK);
        imgElK.setWidth(48).setHeight(48);
      } catch (_logoErrK) {
        cellKanan.setText('[Logo\nKoperasi]');
      }
    } else {
      cellKanan.setText('[Logo\nKoperasi]');
    }

    // Garis pemisah + judul
    body.appendParagraph('').setSpacingBefore(4).setSpacingAfter(4);
    var pJudul = body.appendParagraph('SLIP PENARIKAN TABUNGAN');
    pJudul.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    pJudul.editAsText().setBold(true).setUnderline(true).setFontSize(14);
    body.appendParagraph('').setSpacingBefore(2).setSpacingAfter(2);

    // ── Tabel data utama ─────────────────────────────────────────────
    // Setiap baris: [label1, nilai1, label2, nilai2]
    // Baris single: [label, nilai_panjang, '', '']
    var dataRows = [
      ['No. Slip',          noSlip,           'Tanggal',  tanggalStr  ],
      ['Nama',              namaTampil,        'Kelas',    kelasTampil ],
      ['Nominal Penarikan', nominalFmt,        '',         ''          ],
      ['Terbilang',         terbilangStr,      '',         ''          ],
      ['Alasan Penarikan',  alasanCb,          '',         ''          ],
      ['Saldo Sebelum',     saldoSebelumFmt,   '',         ''          ],
      ['Saldo Setelah',     saldoSesudahFmt,   '',         ''          ],
      ['Catatan',           catatanTampil,     '',         ''          ],
      ['Nominal Diterima',  jumlahDiterimaFmt, '',         ''          ]
    ];

    // FIX: build tabel dengan appendTable passing 2D array (cara paling stabil di GAS)
    var tableData = [];
    for (var ri = 0; ri < dataRows.length; ri++) {
      var rd = dataRows[ri];
      var hasSecondPair = (rd[2] !== '');
      if (hasSecondPair) {
        tableData.push([rd[0], rd[1], rd[2], rd[3]]);
      } else {
        // Nilai memanjang — tulis di kolom kedua, kolom 3+4 kosong
        tableData.push([rd[0], rd[1], '', '']);
      }
    }
    var dataTbl = body.appendTable(tableData);
    // Style kolom label
    for (var ri2 = 0; ri2 < dataTbl.getNumRows(); ri2++) {
      var tRow = dataTbl.getRow(ri2);
      tRow.getCell(0).editAsText().setBold(true).setFontSize(10);
      tRow.getCell(1).editAsText().setFontSize(10);
      tRow.getCell(2).editAsText().setBold(true).setFontSize(10);
      tRow.getCell(3).editAsText().setFontSize(10);
      // Lebar kolom label
      tRow.getCell(0).setWidth(110);
      tRow.getCell(2).setWidth(80);
    }

    // ── Baris tanda tangan ───────────────────────────────────────────
    body.appendParagraph('').setSpacingBefore(8).setSpacingAfter(2);
    var ttData = [
      ['Tanda Tangan',  'Penarik,',                         'Pengelola,'          ],
      ['',              '',                                   ''                    ],
      ['',              '',                                   ''                    ],
      ['',              '(..............................)',    'Randi Pratama, S.Pd.']
    ];
    var ttTbl = body.appendTable(ttData);
    ttTbl.setBorderWidth(0);
    // Row 0: label kolom
    ttTbl.getRow(0).getCell(0).editAsText().setBold(true).setFontSize(10);
    ttTbl.getRow(0).getCell(1).editAsText().setFontSize(10);
    ttTbl.getRow(0).getCell(2).editAsText().setFontSize(10);
    // Row 3: nama penanda tangan
    ttTbl.getRow(3).getCell(1).editAsText().setFontSize(10);
    ttTbl.getRow(3).getCell(2).editAsText().setBold(true).setUnderline(true).setFontSize(10);

    // ── Footer tagline ───────────────────────────────────────────────
    body.appendParagraph('').setSpacingBefore(4).setSpacingAfter(2);
    var pTagline = body.appendParagraph('\u201cMenabung Hari Ini, Menggapai Impian Esok Hari\u201d');
    pTagline.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    pTagline.editAsText().setItalic(true).setFontSize(10);

    // ── Simpan & export PDF ──────────────────────────────────────────
    doc.saveAndClose();
    doc = null;

    // FIX: tambah Utilities.sleep kecil agar GAS flush write sebelum getAs()
    Utilities.sleep(500);

    var pdfBlob = DriveApp.getFileById(docId)
      .getAs('application/pdf')
      .setName(fileName);

    // Hapus Doc temp dari Drive
    try { DriveApp.getFileById(docId).setTrashed(true); } catch (_) {}

    return pdfBlob;

  } catch (pdfErr) {
    // Log error agar bisa diketahui penyebabnya
    try {
      var logUser2 = (params && params._logUser) ? params._logUser : 'SYSTEM';
      logActivity(logUser2, 'EMAIL_SLIP_TARIK_PDF_ERROR',
        'Gagal generate PDF slip: ' + pdfErr.toString() +
        ' | noSlip: ' + (params ? params.noSlip : '?'));
    } catch (_) {}
    // Pastikan Doc temp terhapus meski error
    if (doc)  { try { doc.saveAndClose(); } catch (_) {} }
    if (docId){ try { DriveApp.getFileById(docId).setTrashed(true); } catch (_) {} }
    return null;
  }
}

/**
 * Membaca Sheet Users dan mengumpulkan Penerima_Email untuk slip penarikan.
 *
 * Pengelola_Tabungan: role==='Guru' AND tugasTambahan contains 'Pengelola Tabungan'
 *                     AND emailVerified===true AND email non-empty (trimmed)
 * Admin:              role==='Admin' AND email non-empty (trimmed) — tanpa syarat emailVerified
 * Cap: 50 penerima pertama.
 *
 * Sheet_Users kolom (1-indexed): id(1), username(2), password(3), role(4),
 *   tugasTambahan(5), ..., fullName(8), ..., email(16), bio(17), emailVerified(18)
 * JS index (0-based):            0       1           2          3
 *   4                                   7               15          16        17
 *
 * @returns {{ recipients: Array<{username: string, email: string}>, totalCandidates: number }}
 */
function _getSlipEmailRecipients_() {
  var recipients = [];
  var totalCandidates = 0;
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Users');
    if (!sheet) return { recipients: [], totalCandidates: 0 };
    var data = sheet.getDataRange().getValues();
    // data[0] = header row, skip
    for (var i = 1; i < data.length; i++) {
      var row          = data[i];
      var role         = String(row[3] || '').trim();
      var tugasTambahan = String(row[4] || '');
      var email        = String(row[15] || '').trim();
      var emailVerified = row[17];
      var uname        = String(row[1] || '').replace(/^'/, '').trim();

      if (!email) continue; // email kosong — tidak eligible

      var isGuru  = role === 'Guru'  && tugasTambahan.indexOf('Pengelola Tabungan') !== -1 && emailVerified === true;
      var isAdmin = role === 'Admin';

      if (isGuru || isAdmin) {
        totalCandidates++;
        if (recipients.length < 50) {
          recipients.push({ username: uname, email: email });
        }
      }
    }
  } catch (e) {
    // Jika gagal baca sheet, kembalikan kosong — dispatcher akan return tanpa email
    return { recipients: [], totalCandidates: 0 };
  }
  return { recipients: recipients, totalCandidates: totalCandidates };
}

/**
 * Menghitung biaya admin berdasarkan konfigurasi bracket fee.
 *
 * Cari bracket yang cocok: min <= jumlah <= max (max null = tidak terbatas).
 * Biaya = Math.round(jumlah * feePercentage / 100).
 * Jika tidak ada bracket yang cocok, biaya = 0.
 *
 * @param {number} jumlah       - Nominal penarikan
 * @param {Array}  feeConfigs   - Array dari getFeeConfig(): [{min, max, feePercentage}]
 * @returns {number}            - Biaya admin (integer, >= 0)
 */
function _calcFeeAmount_(jumlah, feeConfigs) {
  if (!feeConfigs || feeConfigs.length === 0) return 0;
  for (var i = 0; i < feeConfigs.length; i++) {
    var cfg = feeConfigs[i];
    var inMin = jumlah >= cfg.min;
    var inMax = (cfg.max === null || cfg.max === undefined) ? true : jumlah <= cfg.max;
    if (inMin && inMax) {
      return Math.round(jumlah * (cfg.feePercentage || 0) / 100);
    }
  }
  return 0;
}

/**
 * Mengirim email Slip Penarikan Tabungan kepada seluruh Pengelola_Tabungan dan Admin.
 *
 * Fungsi ini bersifat non-blocking — tidak melempar exception ke pemanggil.
 * Semua kegagalan ditangkap di dalam dan dicatat via logActivity.
 *
 * @param {Object} params
 * @param {string}      params.id           - UUID transaksi (dipakai sebagai excludeId saldo)
 * @param {Date|string} params.tanggal      - Tanggal transaksi
 * @param {string}      params.kelas        - Kelas dari data transaksi (untuk Siswa)
 * @param {string}      params.username     - Username penabung
 * @param {string}      params.nama         - Nama singkat (fallback jika fullName tidak ditemukan)
 * @param {string}      params.penabungType - 'Siswa' | 'Guru' | 'Nasabah'
 * @param {number}      params.jumlah       - Nominal penarikan
 * @param {string}      params.ket          - Keterangan / alasan
 * @param {string}      params.pencatat     - Username pencatat
 * @param {string}      params.logUser      - User untuk logActivity
 */
function _dispatchSlipPenarikanEmail(params) {
  try {
    var id          = params.id;
    var tanggal     = params.tanggal;
    var kelas       = params.kelas || '';
    var username    = params.username;
    var nama        = params.nama || '';
    var penabungType = params.penabungType || 'Siswa';
    var jumlah      = params.jumlah || 0;
    var ket         = params.ket || '';
    var logUser     = params.logUser || '';

    // 1. Kumpulkan penerima
    var recipientsResult = _getSlipEmailRecipients_();
    var recipients     = recipientsResult.recipients;
    var totalCandidates = recipientsResult.totalCandidates;

    // 2. Tidak ada penerima → return diam-diam
    if (!recipients || recipients.length === 0) return;

    // 3. Jika terpotong → catat log
    if (totalCandidates > 50) {
      try {
        logActivity(logUser, 'EMAIL_SLIP_TARIK_RECIPIENTS_CAPPED',
          'Penerima slip dibatasi 50 dari ' + totalCandidates + ' kandidat. txId: ' + id);
      } catch (_) {}
    }

    // 4. Baca Sheet Savings
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var savingsSheet = ss.getSheetByName('Savings');
    var savingsData = savingsSheet ? savingsSheet.getDataRange().getValues() : [[]];

    // 5. Cari fullName penabung dari Sheet Users kolom H (index 7)
    var fullName = nama; // fallback default
    try {
      var usersSheet = ss.getSheetByName('Users');
      if (usersSheet) {
        var usersData = usersSheet.getDataRange().getValues();
        for (var i = 1; i < usersData.length; i++) {
          var rowUname = String(usersData[i][1] || '').replace(/^'/, '').trim();
          if (_cmpUsername(rowUname, username)) {
            var fn = String(usersData[i][7] || '').trim();
            if (fn) { fullName = fn; }
            break;
          }
        }
      }
    } catch (_) {}

    // 6. Baca profil sekolah
    var logoSekolahUrl  = '';
    var logoKoperasiUrl = '';
    var namaSekolah     = 'MADRASAH TSANAWIYAH NURUL FALAH';
    try {
      var profile = getSchoolProfile();
      if (profile) {
        logoSekolahUrl  = profile.logoUrl        || '';
        logoKoperasiUrl = profile.logoKoperasiUrl || '';
        namaSekolah     = profile.namaSekolah     || namaSekolah;
      }
    } catch (_) {}

    // 7. Generate nomor slip
    var noSlip = _generateNoSlip_(penabungType, tanggal, savingsData);

    // 8. Hitung kelasDisplay berdasarkan penabungType
    var kelasDisplay;
    if (penabungType === 'Guru') {
      kelasDisplay = 'G';
    } else if (penabungType === 'Nasabah') {
      kelasDisplay = 'N';
    } else if (penabungType === 'Siswa') {
      kelasDisplay = kelas ? ('S-' + kelas) : 'S';
    } else {
      kelasDisplay = '-';
    }

    // 9. Hitung saldo sebelum dan sesudah
    var saldoSebelum = _calcSaldoSebelum_(username, id, savingsData);
    var saldoSesudah = saldoSebelum - jumlah;

    // 9b. Hitung biaya admin dari FeeConfig
    var biayaAdmin = 0;
    try {
      var feeConfigs = getFeeConfig();
      biayaAdmin = _calcFeeAmount_(jumlah, feeConfigs);
    } catch (_) {}

    // 10. Format tanggal ke dd/mmm/yyyy Bahasa Indonesia
    var bulanId = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    var tgl = (tanggal instanceof Date) ? tanggal : new Date(tanggal);
    var dd  = String(tgl.getDate()).padStart(2, '0');
    var mmm = bulanId[tgl.getMonth()];
    var yyyy = tgl.getFullYear();
    var tanggalStr = dd + '/' + mmm + '/' + yyyy;

    // 11. Bangun slip HTML
    var slipResult = _buildSlipPenarikanHtml({
      noSlip:          noSlip,
      tanggalStr:      tanggalStr,
      nama:            fullName,
      kelas:           kelasDisplay,
      jumlah:          jumlah,
      ket:             ket,
      biayaAdmin:      biayaAdmin,
      saldoSebelum:    saldoSebelum,
      saldoSesudah:    saldoSesudah,
      logoSekolahUrl:  logoSekolahUrl,
      logoKoperasiUrl: logoKoperasiUrl,
      namaSekolah:     namaSekolah
    });
    var htmlBody  = slipResult.html;
    var plainBody = slipResult.plainText;

    // 11b. Generate PDF slip untuk attachment email
    var pdfBlob = null;
    try {
      pdfBlob = _buildSlipPenarikanPdfBlob_({
        noSlip:          noSlip,
        tanggalStr:      tanggalStr,
        nama:            fullName,
        kelas:           kelasDisplay,
        jumlah:          jumlah,
        ket:             ket,
        biayaAdmin:      biayaAdmin,
        saldoSebelum:    saldoSebelum,
        saldoSesudah:    saldoSesudah,
        logoSekolahUrl:  logoSekolahUrl,
        logoKoperasiUrl: logoKoperasiUrl,
        namaSekolah:     namaSekolah,
        _logUser:        logUser
      });
    } catch (_pdfErr) {
      pdfBlob = null; // non-fatal — kirim email tanpa attachment jika gagal
    }

    // 12. Format subject
    var subjectNama  = (fullName  && String(fullName).trim())  ? String(fullName).trim()  : '-';
    var subjectKelas = (kelasDisplay && String(kelasDisplay).trim()) ? String(kelasDisplay).trim() : '-';
    var subject = '[SiM-Murid] Slip Penarikan Tabungan \u2014 ' + subjectNama + ' (' + subjectKelas + ')';

    // 13. Kirim email per penerima
    for (var j = 0; j < recipients.length; j++) {
      var r = recipients[j];
      try {
        var mailOpts = {
          to:       r.email,
          subject:  subject,
          htmlBody: htmlBody,
          body:     plainBody
        };
        if (pdfBlob) {
          mailOpts.attachments = [pdfBlob];
        }
        MailApp.sendEmail(mailOpts);
        try {
          logActivity(logUser, 'EMAIL_SLIP_TARIK_SENT',
            'Slip ' + noSlip + ' terkirim ke ' + r.username + '. txId: ' + id);
        } catch (_) {}
      } catch (sendErr) {
        try {
          logActivity(logUser, 'EMAIL_SLIP_TARIK_ERROR',
            'Gagal kirim ke ' + r.username + ': ' + sendErr.toString() + ', txId: ' + id);
        } catch (_) {}
      }
    }
  } catch (outerErr) {
    // Outer catch — pastikan tidak ada exception yang keluar dari fungsi ini
    try {
      logActivity(
        (params && params.logUser) ? params.logUser : '',
        'EMAIL_SLIP_TARIK_ERROR',
        'Dispatcher error: ' + outerErr.toString() + ', txId: ' + ((params && params.id) ? params.id : '')
      );
    } catch (_) {}
  }
}

function saveSavings(tanggal, kelas, username, nama, jenis, jumlah, ket, pencatat, penabungType, logUser) {
  _assertEmailGate(logUser);
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Savings');
    const data = sheet.getDataRange().getValues();
    const timeZone = Session.getScriptTimeZone();
    const inputDateStr = Utilities.formatDate(new Date(tanggal), timeZone, "yyyy-MM-dd");
    if (jenis === 'Setor') {
      for (let i = 1; i < data.length; i++) {
        const rowUsername = plainText(data[i][3]);
        const rowJenis = data[i][5];
        if (_cmpUsername(rowUsername, username) && rowJenis == 'Setor') {
          const rowDateStr = Utilities.formatDate(new Date(data[i][1]), timeZone, "yyyy-MM-dd");
          if (rowDateStr === inputDateStr) {
            return {
              success: false,
              status: 'DUPLICATE',
              existingData: {
                id: data[i][0],
                tanggal: rowDateStr,
                kelas: data[i][2],
                username: rowUsername,
                nama: data[i][4],
                jenis: data[i][5],
                jumlah: data[i][6],
                ket: data[i][7],
                pencatat: data[i][8],
                penabungType: data[i][9] || 'Siswa'
              }
            };
          }
        }
      }
    }
    const id = Utilities.getUuid();
    sheet.appendRow([id, tanggal, kelas, safeText(username), nama, jenis, jumlah, ket, safeText(pencatat), penabungType || 'Siswa']);
    logActivity(logUser, 'CREATE_SAVING', `Input Tabungan: ${nama} (${jenis})`);
    if (jenis === 'Tarik') {
      _dispatchSlipPenarikanEmail({ id, tanggal, kelas, username, nama, penabungType, jumlah, ket, pencatat, logUser });
    }
    return { success: true, status: 'CREATED' };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}
function updateSavings(id, tanggal, kelas, username, nama, jenis, jumlah, ket, penabungType, logUser) {
  _assertEmailGate(logUser);
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Savings');
    const data = sheet.getDataRange().getValues();
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] == id) {
        sheet.getRange(i + 1, 2, 1, 9).setValues([[tanggal, kelas, safeText(username), nama, jenis, jumlah, ket, data[i][8], penabungType || 'Siswa']]);
        logActivity(logUser, 'UPDATE_SAVING', `Edit Tabungan ID: ${id}`);
        return { success: true };
      }
    }
    throw new Error("Data Tabungan tidak ditemukan.");
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}
function deleteSavings(id, logUser) {
  _assertEmailGate(logUser);
  const lock = LockService.getScriptLock();
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Savings');
    const data = sheet.getDataRange().getValues();
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] == id) {
        sheet.deleteRow(i + 1);
        logActivity(logUser, 'DELETE_SAVING', `Hapus Tabungan ID: ${id}`);
        return { success: true };
      }
    }
    throw new Error("Data Tabungan tidak ditemukan.");
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}
function getStudentSavingsInfo(username, dateStr, callerUsername) {
  _assertEmailGate(callerUsername || username);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Savings');
  if (!sheet || sheet.getLastRow() < 2) return { balance: 0, existing: null };
  const data = sheet.getDataRange().getValues();
  data.shift();
  let balance = 0;
  let existingTransaction = null;
  const timeZone = Session.getScriptTimeZone();
  data.forEach(row => {
    if (_cmpUsername(plainText(row[3]), username)) {
      const amount = parseFloat(row[6]) || 0;
      if (row[5] === 'Setor') {
        balance += amount;
      } else if (row[5] === 'Tarik') {
        balance -= amount;
      }
      if (dateStr && row[1]) {
        const rowDate = Utilities.formatDate(new Date(row[1]), timeZone, "yyyy-MM-dd");
        if (rowDate === dateStr) {
          existingTransaction = {
            id: row[0],
            tanggal: rowDate,
            kelas: row[2],
            username: plainText(row[3]),
            nama: row[4],
            jenis: row[5],
            jumlah: row[6],
            ket: row[7],
            pencatat: row[8],
            penabungType: row[9] || 'Siswa'
          };
        }
      }
    }
  });
  return { balance: balance, existing: existingTransaction };
}
function getSavingsRecap(startDate, endDate, _callerUsername) {
  _assertEmailGate(_callerUsername);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Savings');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  data.shift();
  const timeZone = Session.getScriptTimeZone();
  const summary = {};
  data.forEach(row => {
    const rawUsername = row[3];
    if (!rawUsername) return;
    // Normalisasi username: buang prefix safeText agar entri tidak terpecah
    const username = plainText(rawUsername);
    if (!username) return;
    if (startDate || endDate) {
      let dateStr = '';
      try {
        const dateVal = row[1];
        if (dateVal) {
          let dateObj = null;
          if (dateVal instanceof Date) {
            dateObj = dateVal;
          } else if (typeof dateVal === 'number') {
            dateObj = new Date((dateVal - 25569) * 86400 * 1000);
          } else {
            const parsed = new Date(dateVal);
            if (!isNaN(parsed.getTime())) dateObj = parsed;
          }
          if (dateObj) dateStr = Utilities.formatDate(dateObj, timeZone, "yyyy-MM-dd");
        }
      } catch (e) { dateStr = ''; }
      if (startDate && dateStr && dateStr < startDate) return;
      if (endDate   && dateStr && dateStr > endDate)   return;
    }
    const amount = parseFloat(row[6]) || 0;
    const type = row[5];
    const penabungType = row[9] || 'Siswa';
    if (!summary[username]) {
      summary[username] = {
        username: username,
        nama: row[4] || username,
        kelas: row[2] || '',
        totalSetor: 0,
        totalTarik: 0,
        saldo: 0,
        penabungType: penabungType
      };
    }
    if (type === 'Setor') {
      summary[username].totalSetor += amount;
      summary[username].saldo += amount;
    } else if (type === 'Tarik') {
      summary[username].totalTarik += amount;
      summary[username].saldo -= amount;
    }
  });
  return Object.values(summary).sort((a, b) => {
    if (a.penabungType !== b.penabungType) {
      return a.penabungType === 'Siswa' ? -1 : 1;
    }
    if (a.kelas < b.kelas) return -1;
    if (a.kelas > b.kelas) return 1;
    if (a.nama < b.nama) return -1;
    if (a.nama > b.nama) return 1;
    return 0;
  });
}
function getIuranHistoryByStudent(studentName, yearFilter, _callerUsername) {
  _assertEmailGate(_callerUsername);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Iuran_Komite');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  const history = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === studentName) {
      const dateVal = data[i][3];
      const jumlah = parseFloat(data[i][4]) || 0;
      const ket = data[i][5] || '';
      let transYear = new Date().getFullYear();
      if (dateVal) {
        if (dateVal instanceof Date) {
          transYear = dateVal.getFullYear();
        } else if (typeof dateVal === 'number') {
          transYear = excelSerialToDate(dateVal).getFullYear();
        } else {
          const d = new Date(dateVal);
          if(!isNaN(d.getTime())) transYear = d.getFullYear();
        }
      }
      if (yearFilter && transYear != yearFilter) continue;
      const match = String(ket).match(/Bayar Bulan\s+(.+?)\s+(\d{4})/);
      if (match) {
        const bulanList = match[1].split(',').map(b => b.trim()).filter(b => b.length > 0);
        const tahunFromKet = parseInt(match[2]) || transYear;
        if (bulanList.length > 0) {
          history.push({
            tahun: tahunFromKet,
            bulanArray: bulanList,
            nominalPerBulan: Math.floor(jumlah / bulanList.length),
            originalKet: ket
          });
        }
      }
    }
  }
  return history;
}
function getIuranRecap(tahunAjaran, _callerUsername) {
  _assertEmailGate(_callerUsername);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const iuranSheet = ss.getSheetByName('Iuran_Komite');
  const userSheet = ss.getSheetByName('Users');
  if (!iuranSheet || iuranSheet.getLastRow() < 2) return [];
  const currentYear = new Date().getFullYear();
  const taYear  = tahunAjaran ? parseInt(tahunAjaran) : (new Date().getMonth() >= 6 ? currentYear : currentYear - 1);
  const taYear2 = taYear + 1;
  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const S1_MONTHS = ['Juli','Agustus','September','Oktober','November','Desember'];
  const S2_MONTHS = ['Januari','Februari','Maret','April','Mei','Juni'];

  // Bangun map user dari sheet Users (username → fullName, kelas)
  const userMap = {};
  if (userSheet && userSheet.getLastRow() >= 2) {
    const userData = userSheet.getDataRange().getValues();
    for (let i = 1; i < userData.length; i++) {
      const uname = plainText(userData[i][1]);
      if (uname) {
        userMap[uname] = {
          fullName: String(userData[i][7] || '').trim() || uname,
          kelas: String(userData[i][6] || '').trim()
        };
      }
    }
  }

  // Kumpulkan semua siswa aktif role Siswa agar yang belum bayar juga masuk rekap
  const allSiswaKeys = Object.keys(userMap).filter(u => {
    // userSheet col 3 = role
    // Kita ambil dari userMap saja — siswa ada di userMap
    return true; // akan diisi dari recap transaksi + siswa aktif di bawah
  });

  const iuranData = iuranSheet.getDataRange().getValues();
  const recap = {};

  for (let i = 1; i < iuranData.length; i++) {
    const row = iuranData[i];
    // Normalisasi username (hapus prefix apostrof yang mungkin ada)
    const siswa   = plainText(row[1]);
    if (!siswa) continue;
    const kelas   = String(row[2] || '').trim();
    const tanggal = row[3];
    const jumlah  = parseFloat(row[4]) || 0;
    const ket     = String(row[5] || '');

    let transDate = null;
    if (tanggal instanceof Date) {
      transDate = tanggal;
    } else if (typeof tanggal === 'number') {
      transDate = excelSerialToDate(tanggal);
    } else if (tanggal) {
      const parsed = new Date(tanggal);
      if (!isNaN(parsed.getTime())) transDate = parsed;
    }
    if (!transDate) continue;

    const transYear  = transDate.getFullYear();
    const transMonth = transDate.getMonth() + 1;

    // Hanya proses transaksi dalam rentang TA yang dipilih
    const isS1 = (transYear === taYear  && transMonth >= 7);
    const isS2 = (transYear === taYear2 && transMonth <= 6);
    if (!isS1 && !isS2) continue;

    if (!recap[siswa]) {
      const uInfo = userMap[siswa] || {};
      recap[siswa] = {
        username: siswa,
        fullName: uInfo.fullName || siswa,
        kelas: kelas || uInfo.kelas || '',
        bulanDibayar: [],
        totalDibayar: 0,
        nominalPerBulan: 0
      };
    }
    // Gunakan kelas dari transaksi terbaru (lebih akurat dari data user)
    if (kelas) recap[siswa].kelas = kelas;

    // Tentukan bulan yang dibayar dari field keterangan (format: "Bayar Bulan X, Y YYYY")
    const matchKet = ket.match(/Bayar Bulan\s+(.+?)\s+(\d{4})/);
    if (matchKet) {
      const bulanList = matchKet[1].split(',').map(b => b.trim()).filter(b => monthNames.includes(b));
      // Validasi tahun di keterangan sesuai TA
      const ketYear = parseInt(matchKet[2]);
      bulanList.forEach(bulan => {
        // Verifikasi bulan sesuai semester TA yang dipilih
        const bulanIsS1 = S1_MONTHS.includes(bulan) && ketYear === taYear;
        const bulanIsS2 = S2_MONTHS.includes(bulan) && ketYear === taYear2;
        if ((bulanIsS1 || bulanIsS2) && !recap[siswa].bulanDibayar.includes(bulan)) {
          recap[siswa].bulanDibayar.push(bulan);
        }
      });
      if (bulanList.length > 0) {
        const nominalThisTrans = Math.floor(jumlah / bulanList.length);
        if (nominalThisTrans > recap[siswa].nominalPerBulan) {
          recap[siswa].nominalPerBulan = nominalThisTrans;
        }
      }
    } else {
      // Fallback: jika keterangan tidak sesuai format, tandai bulan transaksi sebagai sudah dibayar
      const bulanTrans = monthNames[transMonth - 1];
      if (bulanTrans && !recap[siswa].bulanDibayar.includes(bulanTrans)) {
        recap[siswa].bulanDibayar.push(bulanTrans);
      }
      if (jumlah > recap[siswa].nominalPerBulan) {
        recap[siswa].nominalPerBulan = jumlah;
      }
    }
    recap[siswa].totalDibayar += jumlah;
  }

  const result = Object.values(recap).map(item => {
    const sudahSet = new Set(item.bulanDibayar);
    // Hitung belumBayar untuk KEDUA semester penuh — tidak bergantung pada apakah sudah ada bayar
    const belumBayarS1 = S1_MONTHS.filter(m => !sudahSet.has(m));
    const belumBayarS2 = S2_MONTHS.filter(m => !sudahSet.has(m));
    const belumBayar   = [
      ...belumBayarS1,
      ...belumBayarS2
    ].sort((a, b) => monthNames.indexOf(a) - monthNames.indexOf(b));

    return {
      username:        item.username,
      nama:            item.fullName,
      kelas:           item.kelas,
      sudahBayar:      item.bulanDibayar.sort((a, b) => monthNames.indexOf(a) - monthNames.indexOf(b)),
      nominalSudah:    item.totalDibayar,
      belumBayar:      belumBayar,
      nominalKurang:   item.nominalPerBulan * belumBayar.length,
      nominalPerBulan: item.nominalPerBulan
    };
  });

  return result.sort((a, b) => {
    if (a.kelas < b.kelas) return -1;
    if (a.kelas > b.kelas) return 1;
    if (a.nama  < b.nama)  return -1;
    if (a.nama  > b.nama)  return 1;
    return 0;
  });
}
function getGuruList(_callerUsername) {
  _assertEmailGate(_callerUsername);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  data.shift();
  return data.filter(r => r[3] === 'Guru').map(r => r[7] || r[1]);
}
function getMapelList(_callerUsername) {
  _assertEmailGate(_callerUsername);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings');
  if (sheet) {
    const data = sheet.getDataRange().getValues();
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === 'Mata Pelajaran') {
        return data[i][1].split(',').map(m => m.trim());
      }
    }
  }
  return ['Matematika', 'Bahasa Indonesia', 'Bahasa Inggris', 'IPA', 'IPS', 'Pend. Agama'];
}
function getScheduleData(_callerUsername) {
  _assertEmailGate(_callerUsername);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Schedules');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  data.shift();
  return data.map(r => {
    let detail = {};
    try { detail = JSON.parse(r[5] || '{}'); } catch(e) { detail = { text: r[5] }; }
    return { id: r[0], kelas: r[1], kategori: r[2], hari: r[3], jam: r[4] || '', detail: detail };
  }).reverse();
}
function saveScheduleBatch(payload, adminUser) {
  _assertEmailGate(adminUser);
  // BUG FIX: Tambahkan LockService untuk mencegah race condition saat dua
  // pengguna menyimpan jadwal bersamaan (terutama Piket yang delete+appendRow).
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (lockErr) {
    return { success: false, message: 'Sistem sedang sibuk, silakan coba lagi.' };
  }
  try {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Schedules');
  if (payload.kategori === 'Pelajaran') {
    const id = payload.id || Utilities.getUuid();
    const jam = `${payload.waktuMulai} - ${payload.waktuSelesai}`;
    const detailObj = { mapel: payload.mapel, guru: payload.guru, jtm: payload.jtm };
    const istNum = parseInt(payload.istirahat || 0);
    if (istNum > 0) detailObj.istirahat = istNum;
    const detail = JSON.stringify(detailObj);
    if (payload.id) {
      const data = sheet.getDataRange().getValues();
      for (let i = 0; i < data.length; i++) {
        if (data[i][0] === id) {
          sheet.getRange(i + 1, 2, 1, 5).setValues([[payload.kelas, payload.kategori, payload.hari, jam, detail]]);
          break;
        }
      }
      logActivity(adminUser, 'UPDATE_SCHEDULE', `Mengedit jadwal Pelajaran kelas ${payload.kelas}`);
    } else {
      sheet.appendRow([id, payload.kelas, payload.kategori, payload.hari, jam, detail]);
      logActivity(adminUser, 'CREATE_SCHEDULE', `Menambah jadwal Pelajaran kelas ${payload.kelas}`);
    }
  } else if (payload.kategori === 'Piket') {
    const data = sheet.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][1] === payload.kelas && data[i][2] === 'Piket') {
        sheet.deleteRow(i + 1);
      }
    }
    payload.piketData.forEach(p => {
      const id = Utilities.getUuid();
      const detail = JSON.stringify({ namaSiswa: p.namaSiswa });
      sheet.appendRow([id, payload.kelas, payload.kategori, p.hari, '-', detail]);
    });
    logActivity(adminUser, 'UPDATE_SCHEDULE', `Mengupdate jadwal Piket kelas ${payload.kelas}`);
  }
  return { success: true };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}
function getUserFreshData(username) {
  _assertEmailGate(username);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  if (!sheet || sheet.getLastRow() < 2) return null;
  const data = sheet.getDataRange().getValues();
  let userObj = null;
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === username) {
      // Kembalikan SEMUA field yang dipakai oleh activeUser di FE supaya
      // saat hasil ini di-overwrite ke sessionStorage tidak ada field
      // yang hilang. Sebelumnya field `emailVerified` dan beberapa
      // lainnya tidak disertakan, sehingga setelah Guru memverifikasi
      // email lalu berpindah halaman, gate verifikasi seakan "lupa"
      // status verifikasi (undefined !== true → gate aktif kembali).
      userObj = {
        id:            data[i][0],
        username:      data[i][1],
        role:          data[i][3],
        tugasTambahan: data[i][4] ? data[i][4].toString().split(',').map(function(item) { return item.trim(); }) : [],
        kelas:         data[i][6] || '',
        fullName:      data[i][7] || data[i][1],
        piket:         data[i][8] || '',
        aksesPremium:  data[i][10] === true,
        aksesTabungan: data[i][13] === true,
        noHP:          data[i][14] || '',
        email:         data[i][15] || '',
        bio:           data[i][16] || '',
        emailVerified: data[i][17] === true
      };
      break;
    }
  }
  if (userObj && userObj.role === 'Guru' && String(userObj.tugasTambahan).includes('Wali Kelas')) {
    if (!userObj.kelas || String(userObj.kelas).trim() === '') {
      const classSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Classes');
      if (classSheet && classSheet.getLastRow() > 1) {
        const cData = classSheet.getDataRange().getValues();
        const targetU = String(userObj.username).trim().toLowerCase();
        const targetF = String(userObj.fullName).trim().toLowerCase();
        for (let i = 1; i < cData.length; i++) {
          const waliUser = String(cData[i][3] || '').trim().toLowerCase();
          const waliNama = String(cData[i][4] || '').trim().toLowerCase();
          if (waliUser === targetU || waliNama === targetF || waliNama.includes(targetF) || targetF.includes(waliNama)) {
            userObj.kelas = cData[i][2];
            break;
          }
        }
      }
    }
  }
  return userObj;
}
function getAllAlumniData(_callerUsername) {
  _assertEmailGate(_callerUsername);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  data.shift();
  return data
    .filter(row => String(row[3] || '').trim().toLowerCase() === 'alumni')
    .map(row => ({
      username : String(row[1] || '').replace(/^'+/, '').trim(),
      fullName : String(row[7] || row[1] || '').replace(/^'+/, '').trim(),
      kelasLulus: String(row[6] || '-').replace(/^'+/, '').trim()
    }));
}
function getAlumniDetailAdmin(alumniUsername, _callerUsername) {
  _assertEmailGate(_callerUsername);
  const ss         = SpreadsheetApp.getActiveSpreadsheet();
  const userSheet  = ss.getSheetByName('Users');
  const detailSheet= ss.getSheetByName('SiswaDetail');
  const result = { username: alumniUsername, fullName: alumniUsername, kelasLulus: '-', details: {} };
  const users = userSheet.getDataRange().getValues();
  for (let i = 1; i < users.length; i++) {
    const uname = String(users[i][1] || '').replace(/^'+/, '').trim();
    if (uname === String(alumniUsername).replace(/^'+/, '').trim()) {
      result.fullName  = String(users[i][7] || users[i][1] || '').replace(/^'+/, '').trim();
      result.kelasLulus= String(users[i][6] || '-').replace(/^'+/, '').trim();
      break;
    }
  }
  if (detailSheet) {
    const details = detailSheet.getDataRange().getValues();
    const headers = details[0];
    const target  = String(alumniUsername).replace(/^'+/, '').trim().toLowerCase();
    for (let i = 1; i < details.length; i++) {
      const stored = String(details[i][0] || '').replace(/^'+/, '').trim().toLowerCase();
      if (stored === target) {
        headers.forEach((h, idx) => {
          const val = details[i][idx];
          result.details[h] = val instanceof Date
            ? Utilities.formatDate(val, Session.getScriptTimeZone(), 'dd/MM/yyyy')
            : val;
        });
        break;
      }
    }
  }
  return result;
}
function getAllSiswaData(callerUsername) {
  if (callerUsername) _assertEmailGate(callerUsername);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  data.shift();
  return data.filter(row => String(row[3] || '').trim().toLowerCase() === 'siswa').map(row => ({
    username: String(row[1] || '').trim(),
    nama: String(row[7] || row[1] || '').trim(),
    kelas: String(row[6] || '-').trim()
  }));
}
function getGuruWaliCandidates(callerUsername) {
  if (callerUsername) _assertEmailGate(callerUsername);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  data.shift();
  return data.filter(r => {
    const role = String(r[3] || '').trim().toLowerCase();
    const tugas = String(r[4] || '').trim().toLowerCase();
    return role === 'guru' && tugas.includes('guru wali');
  }).map(r => ({
    username: r[1],
    nama: r[7] || r[1]
  }));
}
function getGuruWaliData(callerUsername) {
  if (callerUsername) _assertEmailGate(callerUsername);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Guru_Wali');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  data.shift();
  return data.map(r => {
    let siswa = [];
    try { siswa = JSON.parse(r[3] || '[]'); } catch(e) { siswa = []; }
    return {
      id: r[0],
      guruUsername: r[1],
      guruNama: r[2],
      siswaList: siswa
    };
  }).reverse();
}
function saveGuruWali(payload, adminUser) {
  _assertEmailGate(adminUser);
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Guru_Wali');
    if (!sheet) throw new Error("Sheet 'Guru_Wali' tidak ditemukan. Harap buat sheet ini terlebih dahulu di database.");
    const detailSiswa = JSON.stringify(payload.siswaList);
    if (payload.id) {
      const data = sheet.getDataRange().getValues();
      for (let i = 0; i < data.length; i++) {
        if (data[i][0] === payload.id) {
          sheet.getRange(i + 1, 2, 1, 3).setValues([[payload.guruUsername, payload.guruNama, detailSiswa]]);
          logActivity(adminUser, 'UPDATE_GURU_WALI', `Mengedit data Guru Wali: ${payload.guruNama}`);
          return { success: true };
        }
      }
      // Bug #6 Fix: Jika payload.id ada tapi tidak ditemukan di sheet (data sudah
      // dihapus atau ID tidak valid), jangan kembalikan success:true secara diam-diam.
      // Lempar error agar frontend bisa menginformasikan ke user.
      throw new Error("Data Guru Wali dengan ID tersebut tidak ditemukan. Mungkin sudah dihapus, coba muat ulang halaman.");
    } else {
      const id = Utilities.getUuid();
      sheet.appendRow([id, payload.guruUsername, payload.guruNama, detailSiswa]);
      logActivity(adminUser, 'CREATE_GURU_WALI', `Menambah data Guru Wali: ${payload.guruNama}`);
    }
    return { success: true };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}
function deleteGuruWali(id, adminUser) {
  _assertEmailGate(adminUser);
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Guru_Wali');
    // Bug #7 Fix: null check untuk sheet — sama seperti saveGuruWali
    if (!sheet) throw new Error("Sheet 'Guru_Wali' tidak ditemukan. Harap buat sheet ini terlebih dahulu di database.");
    const data = sheet.getDataRange().getValues();
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === id) {
        const guruNama = data[i][2];
        sheet.deleteRow(i + 1);
        logActivity(adminUser, 'DELETE_GURU_WALI', `Menghapus data Guru Wali: ${guruNama}`);
        return { success: true };
      }
    }
    throw new Error("Data tidak ditemukan.");
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}
function saveLaporanBimbingan(payload, guruUsername, guruNama) {
  _assertEmailGate(guruUsername);
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Laporan_Bimbingan');
    if (!sheet) throw new Error("Sheet 'Laporan_Bimbingan' tidak ditemukan. Harap buat sheet ini terlebih dahulu di database.");
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['ID', 'Username_Siswa', 'Nama_Siswa', 'Guru_Wali_Username', 'Guru_Wali_Nama', 'Tanggal', 'Jenis_Laporan', 'Detail_Laporan']);
    }
    const id = Utilities.getUuid();
    sheet.appendRow([
      id,
      safeText(payload.username),
      payload.namaSiswa,
      safeText(guruUsername || 'Unknown'),
      guruNama || 'Unknown',
      payload.tanggal,
      payload.jenis,
      payload.detail
    ]);
    SpreadsheetApp.flush();
    logActivity(guruUsername || 'System', 'CREATE_LAPORAN', `Membuat ${payload.jenis} untuk ${payload.namaSiswa}`);
    return { success: true };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}
function getAllLaporanBimbingan(callerUsername) {
  if (callerUsername) _assertEmailGate(callerUsername);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Laporan_Bimbingan');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length === 0) return [];
  if (String(data[0][0]).toLowerCase().includes('id')) {
    data.shift();
  }
  if (data.length === 0) return [];
  return data.map(r => {
    let detail = {};
    try {
      detail = JSON.parse(r[7] || '{}');
    } catch(e) {
      detail = { text: r[7] };
    }
    let tanggalFormat = r[5];
    if (r[5] instanceof Date) {
      tanggalFormat = Utilities.formatDate(r[5], Session.getScriptTimeZone(), "yyyy-MM-dd");
    } else if (r[5] && String(r[5]).trim() !== '') {
      // Coba normalisasi string tanggal ke yyyy-MM-dd agar konsisten
      const d = new Date(r[5]);
      if (!isNaN(d.getTime())) {
        tanggalFormat = Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
      }
    }
    return {
      id: r[0],
      username: plainText(r[1]),
      namaSiswa: r[2],
      guruUsername: plainText(String(r[3] || '').trim()),
      guruNama: r[4],
      tanggal: tanggalFormat,
      jenis: r[6],
      detail: detail
    };
  }).reverse();
}
function deleteLaporanBimbingan(id, adminUser) {
  _assertEmailGate(adminUser);
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Laporan_Bimbingan');
    const data = sheet.getDataRange().getValues();
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === id) {
        const jenis = data[i][6];
        const namaSiswa = data[i][2];
        sheet.deleteRow(i + 1);
        logActivity(adminUser, 'DELETE_LAPORAN', `Menghapus ${jenis} siswa ${namaSiswa}`);
        return { success: true };
      }
    }
    throw new Error("Data laporan tidak ditemukan.");
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}
function getLaporanBimbinganBySiswa(username) {
  // Fungsi ini dipanggil oleh role Siswa maupun Orangtua (dengan username anak).
  // _assertEmailGate hanya berlaku untuk role Guru, jadi pemanggilan di sini
  // tidak relevan dan dihapus agar tidak memblokir akses Orangtua ke data anak.
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Laporan_Bimbingan');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length === 0) return [];
  if (String(data[0][0]).toLowerCase().includes('id')) {
    data.shift();
  }
  const result = [];
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (_cmpUsername(row[1], username)) {
      let detail = {};
      try {
        detail = JSON.parse(row[7] || '{}');
      } catch(e) {
        detail = { text: row[7] };
      }
      let tanggalFormat = row[5];
      if (row[5] instanceof Date) {
        tanggalFormat = Utilities.formatDate(row[5], Session.getScriptTimeZone(), "yyyy-MM-dd");
      } else if (row[5] && String(row[5]).trim() !== '') {
        // Normalisasi string tanggal ke yyyy-MM-dd agar konsisten dengan filter frontend
        const d = new Date(row[5]);
        if (!isNaN(d.getTime())) {
          tanggalFormat = Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
        }
      }
      result.push({
        id: row[0],
        username: plainText(row[1]),
        namaSiswa: row[2],
        guruUsername: plainText(String(row[3] || '').trim()),
        guruNama: row[4],
        tanggal: tanggalFormat,
        jenis: row[6],
        detail: detail
      });
    }
  }
  return result.reverse();
}
function updateProfil(username, fullName, noHP, email, bio) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    if (!username) throw new Error('Username kosong.');
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (_cmpUsername(data[i][1], username)) {
        const oldEmail = String(data[i][15] == null ? '' : data[i][15]);
        const newEmail = (email !== undefined && email !== null) ? String(email).trim() : oldEmail;
        const newFullName = (fullName === undefined || fullName === null || String(fullName).trim() === '')
          ? data[i][7]
          : String(fullName).trim();
        sheet.getRange(i + 1, 8).setValue(newFullName);
        if (noHP  !== undefined && noHP  !== null) sheet.getRange(i + 1, 15).setValue(String(noHP).trim());
        if (email !== undefined && email !== null) sheet.getRange(i + 1, 16).setValue(String(email).trim());
        if (bio   !== undefined && bio   !== null) sheet.getRange(i + 1, 17).setValue(String(bio).trim());
        const oldNorm = oldEmail.trim().toLowerCase();
        const newNorm = newEmail.trim().toLowerCase();
        const emailChanged = oldNorm !== newNorm;
        if (emailChanged) {
          _supersedePendingOtpForUser_(username);
          sheet.getRange(i + 1, COL_EMAIL_VERIFIED).setValue(false);
          logActivity(username, 'EMAIL_CHANGED_RESET_VERIFIED',
            'Email diubah dari ' + _maskEmail_(oldEmail) + ' ke ' + _maskEmail_(newEmail));
        }
        logActivity(username, 'UPDATE_PROFIL', 'User memperbarui data profil');
        return { success: true };
      }
    }
    throw new Error("User tidak ditemukan.");
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}
function getDashboardStatsAdmin(_callerUsername) {
  _assertEmailGate(_callerUsername);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const userSheet = ss.getSheetByName('Users');
  const classSheet = ss.getSheetByName('Classes');
  const iuranSheet = ss.getSheetByName('Iuran_Komite');
  const users = userSheet.getDataRange().getValues();
  users.shift();
  const totalSiswa = users.filter(u => u[3] === 'Siswa').length;
  const totalGuru = users.filter(u => u[3] === 'Guru').length;
  let totalKelas = 0;
  if (classSheet && classSheet.getLastRow() > 1) {
    totalKelas = classSheet.getLastRow() - 1;
  }
  let totalIuranBulanIni = 0;
  if (iuranSheet && iuranSheet.getLastRow() > 1) {
    const iuranData = iuranSheet.getDataRange().getValues();
    iuranData.shift();
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    iuranData.forEach(row => {
      if (row[3]) {
        const tgl = new Date(row[3]);
        if (tgl.getMonth() === currentMonth && tgl.getFullYear() === currentYear) {
          totalIuranBulanIni += parseFloat(row[4]) || 0;
        }
      }
    });
  }
  return {
    totalSiswa: totalSiswa,
    totalGuru: totalGuru,
    totalKelas: totalKelas,
    totalIuranBulanIni: totalIuranBulanIni
  };
}
function getDashboardStatsGuru(username) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const userSheet = ss.getSheetByName('Users');
  const users = userSheet.getDataRange().getValues();
  let userData = null;
  for (let i = 1; i < users.length; i++) {
    if (users[i][1] === username) {
      userData = {
        tugas: users[i][4] ? users[i][4].toString().split(',').map(t => t.trim()) : []
      };
      break;
    }
  }
  const result = {
    isWali: userData && userData.tugas.includes('Guru Wali'),
    isBendahara: userData && userData.tugas.includes('Bendahara Komite'),
    isPengelolaTabungan: userData && userData.tugas.includes('Pengelola Tabungan'),
    isGuruPiket: userData && userData.tugas.includes('Guru Piket'),
    siswaBimbinganCount: 0,
    iuranHariIni: 0,
    tabunganHariIni: 0,
    absensiHariIni: 0
  };
  if (result.isWali) {
    result.siswaBimbinganCount = getGuruWaliStudentCount(username);
  }
  const today = new Date();
  const todayStr = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd");
  if (result.isBendahara) {
    const iuranSheet = ss.getSheetByName('Iuran_Komite');
    if (iuranSheet) {
      const iuranData = iuranSheet.getDataRange().getValues();
      iuranData.shift();
      iuranData.forEach(row => {
        if (row[3]) {
          const tgl = new Date(row[3]);
          const tglStr = Utilities.formatDate(tgl, Session.getScriptTimeZone(), "yyyy-MM-dd");
          if (tglStr === todayStr) {
            result.iuranHariIni += parseFloat(row[4]) || 0;
          }
        }
      });
    }
  }
  if (result.isPengelolaTabungan) {
    const savingsSheet = ss.getSheetByName('Savings');
    if (savingsSheet) {
      const savingsData = savingsSheet.getDataRange().getValues();
      savingsData.shift();
      result.tabunganHariIni = savingsData.filter(row => {
        if (row[1]) {
          const tgl = new Date(row[1]);
          const tglStr = Utilities.formatDate(tgl, Session.getScriptTimeZone(), "yyyy-MM-dd");
          return tglStr === todayStr;
        }
        return false;
      }).length;
    }
  }
  if (result.isGuruPiket) {
    const attSheet = ss.getSheetByName('Attendance');
    if (attSheet) {
      const attData = attSheet.getDataRange().getValues();
      attData.shift();
      result.absensiHariIni = attData.filter(row => {
        if (row[1]) {
          const tgl = new Date(row[1]);
          const tglStr = Utilities.formatDate(tgl, Session.getScriptTimeZone(), "yyyy-MM-dd");
          return tglStr === todayStr;
        }
        return false;
      }).length;
    }
  }
  return result;
}
function verifyPassword(username, password) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
    const data  = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (_cmpUsername(data[i][1], username)) {
        return { success: String(data[i][2]) === String(password) };
      }
    }
    return { success: false, message: 'User tidak ditemukan.' };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}
function changePassword(username, oldPassword, newPassword) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (_cmpUsername(data[i][1], username)) {
        if (String(data[i][2]) !== String(oldPassword)) {
          throw new Error("Password lama tidak sesuai.");
        }
        sheet.getRange(i + 1, 3).setValue(newPassword);
        const sessionSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sessions');
        const sessionData = sessionSheet.getDataRange().getValues();
        for (let j = sessionData.length - 1; j >= 1; j--) {
          if (_cmpUsername(sessionData[j][1], username)) {
            sessionSheet.deleteRow(j + 1);
          }
        }
        logActivity(username, 'CHANGE_PASSWORD', 'User mengubah password');
        return { success: true };
      }
    }
    throw new Error("User tidak ditemukan.");
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}
function getMapelData() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === 'Mata Pelajaran') {
      const mapels = data[i][1] ? data[i][1].toString().split(',').map(m => m.trim()).filter(m => m) : [];
      return mapels.map((m, idx) => ({ id: idx, nama: m }));
    }
  }
  return [];
}
function saveMapel(namaMapel, adminUser) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (namaMapel.includes(',')) throw new Error("Nama mata pelajaran tidak boleh mengandung koma");
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings');
    if (!sheet) throw new Error("Sheet Settings tidak ditemukan");
    const data = sheet.getDataRange().getValues();
    let rowIdx = -1;
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === 'Mata Pelajaran') {
        rowIdx = i + 1;
        break;
      }
    }
    if (rowIdx === -1) {
      sheet.appendRow(['Mata Pelajaran', namaMapel]);
    } else {
      const current = data[rowIdx - 1][1] || '';
      const list = current ? current.toString().split(',').map(m => m.trim()) : [];
      if (list.includes(namaMapel)) throw new Error("Mata pelajaran sudah ada");
      list.push(namaMapel);
      sheet.getRange(rowIdx, 2).setValue(list.join(', '));
    }
    logActivity(adminUser, 'CREATE_MAPEL', 'Menambah mata pelajaran: ' + namaMapel);
    return { success: true };
  } finally {
    lock.releaseLock();
  }
}
function deleteMapel(id, adminUser) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings');
    if (!sheet) throw new Error("Sheet Settings tidak ditemukan");
    const data = sheet.getDataRange().getValues();
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === 'Mata Pelajaran') {
        const list = data[i][1] ? data[i][1].toString().split(',').map(m => m.trim()).filter(m => m) : [];
        if (id >= 0 && id < list.length) {
          const deleted = list.splice(id, 1)[0];
          sheet.getRange(i + 1, 2).setValue(list.join(', '));
          logActivity(adminUser, 'DELETE_MAPEL', 'Menghapus mata pelajaran: ' + deleted);
          return { success: true };
        }
      }
    }
    throw new Error("Data tidak ditemukan");
  } finally {
    lock.releaseLock();
  }
}
function getHariLiburData() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Hari_Libur');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  data.shift();
  return data.map(r => ({
    id: r[0],
    tanggal: _normalizeTanggalLibur_(r[1]),
    keterangan: r[2] || ''
  })).sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
}
function saveHariLibur(tanggal, keterangan, adminUser) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Hari_Libur');
    if (!sheet) {
      sheet = ss.insertSheet('Hari_Libur');
      sheet.appendRow(['ID', 'Tanggal', 'Keterangan', 'Created_By']);
    }
    const id = Utilities.getUuid();
    sheet.appendRow([id, tanggal, keterangan, adminUser]);
    logActivity(adminUser, 'CREATE_LIBUR', 'Menambah hari libur: ' + tanggal);
    return { success: true };
  } finally {
    lock.releaseLock();
  }
}
function deleteHariLibur(id, adminUser) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Hari_Libur');
    if (!sheet) throw new Error("Sheet tidak ditemukan");
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        sheet.deleteRow(i + 1);
        logActivity(adminUser, 'DELETE_LIBUR', 'Menghapus hari libur ID: ' + id);
        return { success: true };
      }
    }
    throw new Error("Data tidak ditemukan");
  } finally {
    lock.releaseLock();
  }
}
function isHariLibur(tanggal) {
  if (tanggal && typeof tanggal === 'string') {
    const parts = tanggal.split('-');
    if (parts.length === 3) {
      const d = new Date(parts[0], parseInt(parts[1], 10) - 1, parts[2]);
      if (d.getDay() === 0) return true;
    }
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Hari_Libur');
  if (!sheet || sheet.getLastRow() < 2) return false;
  const cols = _resolveHariLiburCols_(sheet);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (_normalizeTanggalLibur_(data[i][cols.tanggalCol]) === tanggal) return true;
  }
  return false;
}
function getKenaikanKelasData() {
  const userSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  if (!userSheet) return { count7: 0, count8: 0, count9: 0, totalSiswa: 0, countCalon: 0 };
  const users = userSheet.getDataRange().getValues();
  let count7 = 0, count8 = 0, count9 = 0, totalSiswa = 0, countCalon = 0;
  for (let i = 1; i < users.length; i++) {
    if (users[i][3] === 'Siswa') {
      totalSiswa++;
      const kelas = String(users[i][6] || '').trim();
      if (kelas.startsWith('7')) count7++;
      else if (kelas.startsWith('8')) count8++;
      else if (kelas.startsWith('9')) count9++;
    } else if (users[i][3] === 'Calon Siswa Baru') {
      countCalon++;
    }
  }
  return { count7, count8, count9, totalSiswa, countCalon };
}

/**
 * Mendaftarkan daftar alumni baru ke sheet Ijazah.
 * Hanya memasukkan baris yang belum ada (cek berdasarkan username).
 * Kolom: username (A), fullName (B), can_view_override (W), can_download_override (X) → 'deny'
 * Kolom created_at, updated_at, updated_by juga diisi.
 *
 * @param {Array<{username:string, fullName:string}>} newAlumniList
 * @param {string} adminUser
 */
function _registerAlumniToIjazahSheet_(newAlumniList, adminUser) {
  if (!newAlumniList || newAlumniList.length === 0) return;
  ensureIjazahSheet();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Ijazah');
  const data  = sheet.getDataRange().getValues();
  const h     = data[0];

  const uIdx    = h.indexOf('username');
  const fnIdx   = h.indexOf('fullName');
  const vIdx    = h.indexOf('can_view_override');
  const dIdx    = h.indexOf('can_download_override');
  const crtIdx  = h.indexOf('created_at');
  const updIdx  = h.indexOf('updated_at');
  const ubyIdx  = h.indexOf('updated_by');

  // Bangun set username yang sudah ada di sheet Ijazah
  const existingSet = new Set();
  for (let i = 1; i < data.length; i++) {
    const u = normalizeUsername(data[i][uIdx]);
    if (u) existingSet.add(u);
  }

  const now = new Date();
  const rowsToAdd = [];

  for (const alumni of newAlumniList) {
    const normU = normalizeUsername(alumni.username);
    if (!normU || existingSet.has(normU)) continue; // skip jika sudah ada

    const newRow = h.map((col, ci) => {
      if (ci === uIdx)   return safeText(alumni.username);
      if (ci === fnIdx)  return safeText(alumni.fullName || alumni.username);
      if (ci === vIdx)   return 'deny';
      if (ci === dIdx)   return 'deny';
      if (ci === crtIdx) return now;
      if (ci === updIdx) return now;
      if (ci === ubyIdx) return safeText(adminUser);
      return '';
    });
    rowsToAdd.push(newRow);
    existingSet.add(normU); // cegah duplikat dalam batch yang sama
  }

  if (rowsToAdd.length > 0) {
    rowsToAdd.forEach(row => sheet.appendRow(row));
    SpreadsheetApp.flush();
  }
}

function processKenaikanKelas(adminUser) {
  _assertEmailGate(adminUser);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const userSheet = ss.getSheetByName('Users');
    const users = userSheet.getDataRange().getValues();
    let updatedCount = 0;
    let graduatedCount = 0;
    let promotedCount = 0;
    let hasChanges = false;
    const newAlumniList = []; // kumpulkan siswa yang baru lulus

    for (let i = 1; i < users.length; i++) {
      if (users[i][3] === 'Siswa') {
        const currentKelas = String(users[i][6] || '').trim();
        const tingkat = currentKelas.charAt(0);
        const suffix = currentKelas.substring(1);
        if (tingkat === '7') {
          users[i][6] = '8' + suffix;
          updatedCount++;
          hasChanges = true;
        } else if (tingkat === '8') {
          users[i][6] = '9' + suffix;
          updatedCount++;
          hasChanges = true;
        } else if (tingkat === '9') {
          users[i][6] = 'Alumni';
          users[i][3] = 'Alumni';
          newAlumniList.push({
            username: normalizeUsername(users[i][1]),
            fullName: String(users[i][7] || '').trim() || normalizeUsername(users[i][1])
          });
          graduatedCount++;
          hasChanges = true;
        }
      } else if (users[i][3] === 'Calon Siswa Baru') {
        users[i][3] = 'Siswa';
        users[i][6] = '7';
        promotedCount++;
        hasChanges = true;
      }
    }
    
    if (hasChanges) {
      userSheet.getRange(1, 1, users.length, users[0].length).setValues(users);
    }

    // Daftarkan alumni baru ke sheet Ijazah dengan akses default 'deny'
    if (newAlumniList.length > 0) {
      _registerAlumniToIjazahSheet_(newAlumniList, adminUser);
    }
    
    logActivity(adminUser, 'KENAIKAN_KELAS', `Memproses kenaikan kelas: ${updatedCount} naik, ${graduatedCount} lulus, ${promotedCount} calon siswa dipromosikan ke Kelas 7`);
    return { success: true, updated: updatedCount, graduated: graduatedCount, promoted: promotedCount };
  } catch (e) {
    throw new Error("Gagal memproses kenaikan kelas: " + e.message);
  } finally {
    lock.releaseLock();
  }
}

function getSiswaForKenaikan(tingkat, callerUsername) {
  _assertEmailGate(callerUsername);
  const userSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  if (!userSheet) return [];
  const users = userSheet.getDataRange().getValues();
  const result = [];
  
  for (let i = 1; i < users.length; i++) {
    const role = users[i][3];
    const kelas = String(users[i][6] || '').trim();
    
    if (tingkat === 'Calon Siswa Baru' && role === 'Calon Siswa Baru') {
      result.push({ id: users[i][0], username: String(users[i][1]).replace(/^'/, ''), nama: users[i][7] || '', kelas: kelas });
    } else if (role === 'Siswa' && kelas.startsWith(tingkat)) {
      result.push({ id: users[i][0], username: String(users[i][1]).replace(/^'/, ''), nama: users[i][7] || '', kelas: kelas });
    }
  }
  
  // Sort alphabetically by name
  result.sort((a, b) => {
    const nameA = (a.nama || a.username).toLowerCase();
    const nameB = (b.nama || b.username).toLowerCase();
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;
    return 0;
  });

  return result;
}

function processPenempatanKelas(mappingData, adminUser) {
  _assertEmailGate(adminUser);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const userSheet = ss.getSheetByName('Users');
    const users = userSheet.getDataRange().getValues();
    
    let updatedCount = 0;
    const mappingDict = {};
    for (let item of mappingData) {
      if (item.id && item.newKelas) {
        mappingDict[String(item.id)] = String(item.newKelas);
      }
    }
    
    let hasChanges = false;
    const newAlumniList = []; // kumpulkan siswa yang baru dijadikan Alumni

    for (let i = 1; i < users.length; i++) {
      const userId = String(users[i][0]);
      if (mappingDict[userId]) {
        const newKls = mappingDict[userId];
        const prevRole = String(users[i][3] || '').trim();
        users[i][6] = newKls;
        
        if (newKls === 'Alumni') {
          users[i][3] = 'Alumni';
          // Catat sebagai alumni baru hanya jika sebelumnya bukan Alumni
          if (prevRole !== 'Alumni') {
            newAlumniList.push({
              username: normalizeUsername(users[i][1]),
              fullName: String(users[i][7] || '').trim() || normalizeUsername(users[i][1])
            });
          }
        } else {
          if (prevRole === 'Calon Siswa Baru' || prevRole === 'Alumni') {
            users[i][3] = 'Siswa';
          }
        }
        updatedCount++;
        hasChanges = true;
      }
    }
    
    if (hasChanges) {
      userSheet.getRange(1, 1, users.length, users[0].length).setValues(users);
    }

    // Daftarkan alumni baru ke sheet Ijazah dengan akses default 'deny'
    if (newAlumniList.length > 0) {
      _registerAlumniToIjazahSheet_(newAlumniList, adminUser);
    }
    
    logActivity(adminUser, 'PENEMPATAN_KELAS', `Memproses penempatan kelas untuk ${updatedCount} siswa.`);
    return { success: true, updated: updatedCount };
  } catch (e) {
    throw new Error("Gagal menyimpan penempatan kelas: " + e.message);
  } finally {
    lock.releaseLock();
  }
}
function updateMapel(id, newNamaMapel, adminUser) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (newNamaMapel.includes(',')) throw new Error("Nama mata pelajaran tidak boleh mengandung koma");
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings');
    if (!sheet) throw new Error("Sheet Settings tidak ditemukan");
    const data = sheet.getDataRange().getValues();
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === 'Mata Pelajaran') {
        const list = data[i][1] ? data[i][1].toString().split(',').map(m => m.trim()).filter(m => m) : [];
        if (id >= 0 && id < list.length) {
          if (list.includes(newNamaMapel) && list.indexOf(newNamaMapel) != id) {
            throw new Error("Mata pelajaran sudah ada");
          }
          const oldName = list[id];
          list[id] = newNamaMapel;
          sheet.getRange(i + 1, 2).setValue(list.join(', '));
          logActivity(adminUser, 'UPDATE_MAPEL', `Mengedit mata pelajaran: ${oldName} menjadi ${newNamaMapel}`);
          return { success: true };
        }
      }
    }
    throw new Error("Data tidak ditemukan");
  } finally {
    lock.releaseLock();
  }
}
function updateHariLibur(id, tanggal, keterangan, adminUser) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Hari_Libur');
    if (!sheet) throw new Error("Sheet tidak ditemukan");
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        sheet.getRange(i + 1, 2).setValue(tanggal);
        sheet.getRange(i + 1, 3).setValue(keterangan);
        logActivity(adminUser, 'UPDATE_LIBUR', 'Mengedit hari libur ID: ' + id);
        return { success: true };
      }
    }
    throw new Error("Data tidak ditemukan");
  } finally {
    lock.releaseLock();
  }
}
function getAttendanceRecap(month, year) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const attSheet = ss.getSheetByName('Attendance');
  const userSheet = ss.getSheetByName('Users');
  if (!attSheet || attSheet.getLastRow() < 2) return [];
  const attData = attSheet.getDataRange().getValues();
  attData.shift();
  // BUG FIX: FE mengirim tahun KALENDER aktual (bukan tahun awal TA).
  // Filter langsung pakai month & year tanpa transformasi targetYear.
  const filtered = attData.filter(row => {
    const tgl = row[1];
    if (!tgl) return false;
    const d = new Date(tgl);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  });
  const recap = {};
  filtered.forEach(row => {
    const usernameRaw = String(row[3] == null ? '' : row[3]).replace(/^'+/, '').trim();
    const numKey = parseFloat(usernameRaw);
    const userKey = (!isNaN(numKey) && isFinite(numKey) && usernameRaw !== '') ? String(numKey) : usernameRaw;
    const nama = row[4];
    const kelas = row[2];
    const status = row[5];
    if (!recap[userKey]) {
      recap[userKey] = {
        username: usernameRaw,
        nama: nama,
        kelas: kelas,
        hadir: 0,
        alpha: 0,
        sakit: 0,
        izin: 0
      };
    }
    if (status === 'Hadir') recap[userKey].hadir++;
    else if (status === 'Alpha') recap[userKey].alpha++;
    else if (status === 'Sakit') recap[userKey].sakit++;
    else if (status === 'Izin') recap[userKey].izin++;
  });
  const result = [];
  for (let key in recap) {
    const r = recap[key];
    const totalHadir = r.hadir;
    const totalAlpha = r.alpha;
    const totalSakit = r.sakit;
    const totalIzin = r.izin;
    const totalTidakHadir = totalAlpha + totalSakit + totalIzin;
    const totalHari = totalHadir + totalTidakHadir;
    const persentase = totalHari > 0 ? (totalHadir / totalHari) * 100 : 0;
    let predikat = '';
    if (persentase > 89) predikat = 'Sangat Teladan';
    else if (persentase >= 80) predikat = 'Teladan';
    else if (persentase >= 70) predikat = 'Pemalas';
    else predikat = 'Sangat Pemalas';
    result.push({
      username: r.username,
      nama: r.nama,
      kelas: r.kelas,
      hadir: totalHadir,
      alpha: totalAlpha,
      sakit: totalSakit,
      izin: totalIzin,
      totalTidakHadir: totalTidakHadir,
      persentase: persentase.toFixed(2),
      predikat: predikat
    });
  }
  result.sort((a, b) => a.nama.localeCompare(b.nama));
  return result;
}
function getAttendanceSiswa(username) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Attendance');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  data.shift();
  const timeZone = Session.getScriptTimeZone();
  // BUG FIX: Ganti r[3] == username (equality lemah) dengan _cmpUsername()
  // agar username numerik tidak menghasilkan false match.
  return data.filter(r => _cmpUsername(r[3], username)).map(row => {
    let tgl = '';
    if (row[1]) {
      const d = new Date(row[1]);
      if (!isNaN(d.getTime())) tgl = Utilities.formatDate(d, timeZone, "yyyy-MM-dd");
    }
    // BUG FIX #1: Menambahkan username agar frontend bisa validasi relasi
    return {
      id: row[0],
      tanggal: tgl,
      kelas: row[2],
      username: plainText(row[3]), // Username siswa
      status: row[5],
      ket: row[6],
      pencatat: row[7]
    };
  }).reverse();
}
function getAttendanceRecapSiswa(username, month, year) {
  const all = getAttendanceSiswa(username);
  // BUG FIX: year yang dikirim FE adalah tahun KALENDER aktual (bukan tahun ajaran).
  // Filter langsung berdasarkan bulan dan tahun kalender tanpa transformasi tambahan.
  const filtered = all.filter(item => {
    if (!item.tanggal) return false;
    const d = new Date(item.tanggal);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  });
  let hadir = 0, alpha = 0, sakit = 0, izin = 0;
  filtered.forEach(item => {
    if (item.status === 'Hadir') hadir++;
    else if (item.status === 'Alpha') alpha++;
    else if (item.status === 'Sakit') sakit++;
    else if (item.status === 'Izin') izin++;
  });
  const totalHari = hadir + alpha + sakit + izin;
  const persentase = totalHari > 0 ? (hadir / totalHari) * 100 : 0;
  return {
    hadir, alpha, sakit, izin, totalHari, persentase: persentase.toFixed(2)
  };
}
function getWaliKelasByGuru(username) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Classes');
  if (!sheet || sheet.getLastRow() < 2) return null;
  const data = sheet.getDataRange().getValues();
  // BUG FIX #6: Gunakan _cmpUsername (yang sudah tahan angka/string) bukan
  // operator == biasa. == bisa menghasilkan kecocokan palsu (misal "123" == 123).
  for (let i = 1; i < data.length; i++) {
    if (_cmpUsername(data[i][3], username)) {
      return {
        id: data[i][0],
        tingkat: data[i][1],
        nama: data[i][2],
        waliUsername: data[i][3],
        waliName: data[i][4]
      };
    }
  }
  return null;
}
function getAttendanceByClassAndDate(kelas, tanggal) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Attendance');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  data.shift();
  const timeZone = Session.getScriptTimeZone();
  const targetDateStr = (typeof tanggal === 'string')
    ? tanggal
    : Utilities.formatDate(tanggal, timeZone, "yyyy-MM-dd");
  return data
    .filter(row => {
      if (String(row[2] || '').trim() !== String(kelas).trim()) return false;
      const cell = row[1];
      let rowDateStr = '';
      if (cell instanceof Date) {
        rowDateStr = Utilities.formatDate(cell, timeZone, "yyyy-MM-dd");
      } else if (typeof cell === 'number') {
        const dateObj = new Date((cell - 25569) * 86400 * 1000);
        rowDateStr = Utilities.formatDate(dateObj, timeZone, "yyyy-MM-dd");
      } else if (typeof cell === 'string') {
        const parsed = new Date(cell);
        if (!isNaN(parsed.getTime())) {
          rowDateStr = Utilities.formatDate(parsed, timeZone, "yyyy-MM-dd");
        } else {
          rowDateStr = cell;
        }
      }
      return rowDateStr === targetDateStr;
    })
    .map(row => ({
      username: row[3],
      nama: row[4],
      status: row[5],
      ket: row[6]
    }));
}
function getGuruWaliStudentCount(username) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Guru_Wali');
  if (!sheet) return 0;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === username) {
      try {
        const siswaList = JSON.parse(data[i][3] || '[]');
        return siswaList.length;
      } catch (e) {
        return 0;
      }
    }
  }
  return 0;
}
function getPiketDashboard(username) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const userSheet = ss.getSheetByName('Users');
  const classSheet = ss.getSheetByName('Classes');
  const attSheet = ss.getSheetByName('Attendance');
  const timeZone = Session.getScriptTimeZone();
  const today = new Date();
  const todayStr = Utilities.formatDate(today, timeZone, "yyyy-MM-dd");
  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const todayName = dayNames[today.getDay()];
  let piketDays = [];
  let userData = null;
  const users = userSheet.getDataRange().getValues();
  for (let i = 1; i < users.length; i++) {
    if (users[i][1] === username) {
      userData = users[i];
      if (users[i][8]) {
        piketDays = users[i][8].toString().split(',').map(d => d.trim());
      }
      break;
    }
  }
  const isPiketToday = piketDays.includes(todayName);
  if (!isPiketToday) {
    return { piketDays, isPiketToday: false, message: `Anda Tidak Piket Hari Ini. Anda Piket Hari ${piketDays.join(', ')}` };
  }
  const classes = classSheet.getDataRange().getValues();
  const result = { piketDays, isPiketToday: true, classes: [] };
  for (let i = 1; i < classes.length; i++) {
    const kelas = classes[i][2];
    const totalSiswa = users.filter(u => u[3] === 'Siswa' && u[6] === kelas).length;
    if (totalSiswa === 0) continue;
    let sudahAbsen = 0;
    if (attSheet && attSheet.getLastRow() > 1) {
      const attData = attSheet.getDataRange().getValues();
      for (let j = 1; j < attData.length; j++) {
        const _attCell = attData[j][1];
        let _attStr = '';
        if (_attCell instanceof Date) {
          _attStr = Utilities.formatDate(_attCell, timeZone, "yyyy-MM-dd");
        } else if (typeof _attCell === 'number') {
          _attStr = Utilities.formatDate(new Date((_attCell - 25569) * 86400 * 1000), timeZone, "yyyy-MM-dd");
        } else if (_attCell) {
          const _d = new Date(_attCell);
          if (!isNaN(_d.getTime())) _attStr = Utilities.formatDate(_d, timeZone, "yyyy-MM-dd");
        }
        if (attData[j][2] === kelas && _attStr === todayStr) {
          sudahAbsen++;
        }
      }
    }
    result.classes.push({
      kelas: kelas,
      totalSiswa: totalSiswa,
      sudahAbsen: sudahAbsen
    });
  }
  return result;
}
function getTabunganDashboard(username) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Savings');
  const timeZone = Session.getScriptTimeZone();
  const today = new Date();
  const todayStr = Utilities.formatDate(today, timeZone, "yyyy-MM-dd");
  let setorCount = 0, tarikCount = 0, setorNominal = 0, tarikNominal = 0;
  if (sheet && sheet.getLastRow() > 1) {
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const pencatat = plainText(row[8]);
      const tanggal = row[1];
      if (pencatat !== username) continue;
      let tglStr = '';
      if (tanggal instanceof Date) {
        tglStr = Utilities.formatDate(tanggal, timeZone, "yyyy-MM-dd");
      } else if (typeof tanggal === 'number') {
        tglStr = Utilities.formatDate(new Date((tanggal - 25569) * 86400 * 1000), timeZone, "yyyy-MM-dd");
      } else {
        const d = new Date(tanggal);
        if (!isNaN(d)) tglStr = Utilities.formatDate(d, timeZone, "yyyy-MM-dd");
      }
      if (tglStr !== todayStr) continue;
      const jenis = row[5];
      const jumlah = parseFloat(row[6]) || 0;
      if (jenis === 'Setor') {
        setorCount++;
        setorNominal += jumlah;
      } else if (jenis === 'Tarik') {
        tarikCount++;
        tarikNominal += jumlah;
      }
    }
  }
  return {
    setorCount, tarikCount,
    totalCount: setorCount + tarikCount,
    setorNominal, tarikNominal,
    totalNominal: setorNominal + tarikNominal
  };
}
function getIuranTotalMingguIni() {
  return hitungTotalIuranPeriode('minggu');
}
function getIuranTotalBulanIni() {
  return hitungTotalIuranPeriode('bulan');
}
function getIuranTotalTriwulanIni() {
  return hitungTotalIuranPeriode('triwulan');
}
function getIuranTotalSemesterIni() {
  return hitungTotalIuranPeriode('semester');
}
function getIuranTotalTahunIni() {
  return hitungTotalIuranPeriode('tahun');
}
function hitungTotalIuranPeriode(periode) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Iuran_Komite');
  if (!sheet || sheet.getLastRow() < 2) return 0;
  const data = sheet.getDataRange().getValues();
  data.shift();
  const now = new Date();
  const timeZone = Session.getScriptTimeZone();
  let startDate, endDate;
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  if (periode === 'hari') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23,59,59,999);
  } else if (periode === 'minggu') {
    const day = now.getDay();
    const diffToMonday = (day === 0 ? 6 : day - 1);
    startDate = new Date(now);
    startDate.setDate(now.getDate() - diffToMonday);
    startDate.setHours(0,0,0,0);
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23,59,59,999);
  } else if (periode === 'bulan') {
    startDate = new Date(currentYear, currentMonth, 1);
    endDate = new Date(currentYear, currentMonth + 1, 0, 23,59,59,999);
  } else if (periode === 'triwulan') {
    let triwulanStartMonth = Math.floor(currentMonth / 3) * 3;
    startDate = new Date(currentYear, triwulanStartMonth, 1);
    endDate = new Date(currentYear, triwulanStartMonth + 3, 0, 23,59,59,999);
  } else if (periode === 'semester') {
    let semesterStartMonth = currentMonth < 6 ? 0 : 6;
    startDate = new Date(currentYear, semesterStartMonth, 1);
    endDate = new Date(currentYear, semesterStartMonth + 6, 0, 23,59,59,999);
  } else if (periode === 'tahun') {
    startDate = new Date(currentYear, 0, 1);
    endDate = new Date(currentYear, 11, 31, 23,59,59,999);
  } else {
    return 0;
  }
  let total = 0;
  for (let i = 0; i < data.length; i++) {
    let row = data[i];
    let tanggalCell = row[3];
    if (!tanggalCell) continue;
    let tanggal;
    if (tanggalCell instanceof Date) {
      tanggal = tanggalCell;
    } else if (typeof tanggalCell === 'number') {
      tanggal = excelSerialToDate(tanggalCell);
    } else {
      tanggal = new Date(tanggalCell);
    }
    if (isNaN(tanggal.getTime())) continue;
    if (tanggal >= startDate && tanggal <= endDate) {
      total += parseFloat(row[4]) || 0;
    }
  }
  return total;
}
function getHariEfektif(startDate, endDate) {
  const liburSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Hari_Libur');
  let liburDates = [];
  if (liburSheet && liburSheet.getLastRow() > 1) {
    const liburData = liburSheet.getDataRange().getValues();
    for (let i = 1; i < liburData.length; i++) {
      let tgl = liburData[i][1];
      if (tgl) {
        if (tgl instanceof Date) liburDates.push(Utilities.formatDate(tgl, Session.getScriptTimeZone(), "yyyy-MM-dd"));
        else if (typeof tgl === 'number') liburDates.push(Utilities.formatDate(excelSerialToDate(tgl), Session.getScriptTimeZone(), "yyyy-MM-dd"));
        else {
          let d = new Date(tgl);
          if (!isNaN(d)) liburDates.push(Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd"));
        }
      }
    }
  }
  let count = 0;
  let current = new Date(startDate);
  while (current <= endDate) {
    let day = current.getDay();
    let dateStr = Utilities.formatDate(current, Session.getScriptTimeZone(), "yyyy-MM-dd");
    if (day !== 0 && !liburDates.includes(dateStr)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}
function getStudentAttendanceStats(username) {
  const all = getAttendanceSiswa(username);
  const timeZone = Session.getScriptTimeZone();
  const now = new Date();
  const todayStr = Utilities.formatDate(now, timeZone, "yyyy-MM-dd");
  const today = all.find(item => item.tanggal === todayStr);
  const todayStatus = today ? today.status : null;
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const weekData = all.filter(item => {
    if (!item.tanggal) return false;
    const d = new Date(item.tanggal);
    return d >= monday && d <= sunday;
  });
  let weekHadir = 0, weekAlpha = 0, weekSakit = 0, weekIzin = 0;
  weekData.forEach(item => {
    if (item.status === 'Hadir') weekHadir++;
    else if (item.status === 'Alpha') weekAlpha++;
    else if (item.status === 'Sakit') weekSakit++;
    else if (item.status === 'Izin') weekIzin++;
  });
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const monthData = all.filter(item => {
    if (!item.tanggal) return false;
    const d = new Date(item.tanggal);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  });
  let monthHadir = 0, monthAlpha = 0, monthSakit = 0, monthIzin = 0;
  monthData.forEach(item => {
    if (item.status === 'Hadir') monthHadir++;
    else if (item.status === 'Alpha') monthAlpha++;
    else if (item.status === 'Sakit') monthSakit++;
    else if (item.status === 'Izin') monthIzin++;
  });
  const semesterStartMonth = now.getMonth() < 6 ? 1 : 7;
  const semesterEndMonth = now.getMonth() < 6 ? 6 : 12;
  const semesterStart = new Date(year, semesterStartMonth - 1, 1);
  const semesterEnd = new Date(year, semesterEndMonth - 1, 31);
  const semesterData = all.filter(item => {
    if (!item.tanggal) return false;
    const d = new Date(item.tanggal);
    return d >= semesterStart && d <= semesterEnd;
  });
  let semesterHadir = 0, semesterAlpha = 0, semesterSakit = 0, semesterIzin = 0;
  semesterData.forEach(item => {
    if (item.status === 'Hadir') semesterHadir++;
    else if (item.status === 'Alpha') semesterAlpha++;
    else if (item.status === 'Sakit') semesterSakit++;
    else if (item.status === 'Izin') semesterIzin++;
  });
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month - 1, now.getDate());
  const hariEfektif = getHariEfektif(monthStart, monthEnd);
  const persentaseBulan = hariEfektif > 0 ? (monthHadir / hariEfektif) * 100 : 0;
  let predikat = '';
  if (persentaseBulan > 89) predikat = 'Sangat Teladan';
  else if (persentaseBulan >= 80) predikat = 'Teladan';
  else if (persentaseBulan >= 70) predikat = 'Pemalas';
  else predikat = 'Sangat Pemalas';
  return {
    today: todayStatus,
    week: { hadir: weekHadir, alpha: weekAlpha, sakit: weekSakit, izin: weekIzin, total: weekData.length },
    month: { hadir: monthHadir, alpha: monthAlpha, sakit: monthSakit, izin: monthIzin, total: monthData.length },
    semester: { hadir: semesterHadir, alpha: semesterAlpha, sakit: semesterSakit, izin: semesterIzin, total: semesterData.length },
    predikat: predikat,
    persentase: persentaseBulan.toFixed(2),
    hariEfektif: hariEfektif
  };
}
function getIuranTotalHariIni() {
  return hitungTotalIuranPeriode('hari');
}
function getGlobalSavingsSummary() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Savings');
  if (!sheet || sheet.getLastRow() < 2) return { setorCount:0, tarikCount:0, setorNominal:0, tarikNominal:0, totalCount:0, totalNominal:0 };
  const data = sheet.getDataRange().getValues();
  data.shift();
  const today = new Date();
  const timeZone = Session.getScriptTimeZone();
  const todayStr = Utilities.formatDate(today, timeZone, "yyyy-MM-dd");
  let setorCount=0, tarikCount=0, setorNominal=0, tarikNominal=0;
  data.forEach(row => {
    let tgl = row[1];
    if (!tgl) return;
    let tglStr = '';
    if (tgl instanceof Date) {
      tglStr = Utilities.formatDate(tgl, timeZone, "yyyy-MM-dd");
    } else if (typeof tgl === 'number') {
      tglStr = Utilities.formatDate(excelSerialToDate(tgl), timeZone, "yyyy-MM-dd");
    } else {
      const d = new Date(tgl);
      if (!isNaN(d)) tglStr = Utilities.formatDate(d, timeZone, "yyyy-MM-dd");
      else return;
    }
    if (tglStr !== todayStr) return;
    const jenis = row[5];
    const jumlah = parseFloat(row[6]) || 0;
    if (jenis === 'Setor') {
      setorCount++;
      setorNominal += jumlah;
    } else if (jenis === 'Tarik') {
      tarikCount++;
      tarikNominal += jumlah;
    }
  });
  return {
    setorCount, tarikCount,
    setorNominal, tarikNominal,
    totalCount: setorCount + tarikCount,
    totalNominal: setorNominal + tarikNominal
  };
}
function getGlobalAttendanceSummary() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Attendance');
  if (!sheet || sheet.getLastRow() < 2) return { hadir:0, alpha:0, sakit:0, izin:0, total:0 };
  const data = sheet.getDataRange().getValues();
  data.shift();
  const today = new Date();
  const timeZone = Session.getScriptTimeZone();
  const todayStr = Utilities.formatDate(today, timeZone, "yyyy-MM-dd");
  let hadir=0, alpha=0, sakit=0, izin=0;
  data.forEach(row => {
    let tgl = row[1];
    if (!tgl) return;
    let tglStr = '';
    if (tgl instanceof Date) {
      tglStr = Utilities.formatDate(tgl, timeZone, "yyyy-MM-dd");
    } else if (typeof tgl === 'number') {
      tglStr = Utilities.formatDate(excelSerialToDate(tgl), timeZone, "yyyy-MM-dd");
    } else {
      const d = new Date(tgl);
      if (!isNaN(d)) tglStr = Utilities.formatDate(d, timeZone, "yyyy-MM-dd");
      else return;
    }
    if (tglStr !== todayStr) return;
    const status = row[5];
    if (status === 'Hadir') hadir++;
    else if (status === 'Alpha') alpha++;
    else if (status === 'Sakit') sakit++;
    else if (status === 'Izin') izin++;
  });
  return { hadir, alpha, sakit, izin, total: hadir+alpha+sakit+izin };
}
function saveHariLiburBatchRange(startDate, endDate, keterangan, adminUser) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Hari_Libur');
    if (!sheet) {
      sheet = ss.insertSheet('Hari_Libur');
      sheet.appendRow(['ID', 'Tanggal', 'Keterangan', 'Created_By']);
    }
    const existingData = sheet.getDataRange().getValues();
    const existingDates = new Set();
    for (let i = 1; i < existingData.length; i++) {
      const tgl = existingData[i][1];
      if (tgl) {
        existingDates.add(_normalizeTanggalLibur_(tgl));
      }
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    const currentDate = new Date(start);
    let successCount = 0;
    let skippedCount = 0;
    
    const rowsToAdd = [];
    while (currentDate <= end) {
      const dateStr = Utilities.formatDate(currentDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
      if (!existingDates.has(dateStr)) {
        const id = Utilities.getUuid();
        rowsToAdd.push([id, dateStr, keterangan, adminUser]);
        successCount++;
      } else {
        skippedCount++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    if (rowsToAdd.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAdd.length, rowsToAdd[0].length).setValues(rowsToAdd);
    }
    
    if (successCount > 0) {
      logActivity(adminUser, 'CREATE_LIBUR_BATCH', `Menambah ${successCount} hari libur batch (rentang), ${skippedCount} dilewati`);
    }
    return {
      success: successCount,
      skipped: skippedCount
    };
  } catch (e) {
    return { success: 0, skipped: 0, error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}
function getFeeConfig() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('FeeConfig');
  if (!sheet) {
    sheet = ss.insertSheet('FeeConfig');
    sheet.appendRow(['ID', 'Min', 'Max', 'FeePercentage']);
    return [];
  }
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  data.shift();
  let configs = data.map(row => ({
    id: row[0],
    min: parseFloat(row[1]),
    max: row[2] === '' ? null : parseFloat(row[2]),
    feePercentage: parseFloat(row[3])
  }));
  configs.sort((a, b) => a.min - b.min);
  return configs;
}
function saveFeeConfig(payload, adminUser) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('FeeConfig');
    if (!sheet) {
      sheet = ss.insertSheet('FeeConfig');
      sheet.appendRow(['ID', 'Min', 'Max', 'FeePercentage']);
    }
    if (payload.id) {
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === payload.id) {
          sheet.getRange(i + 1, 2, 1, 3).setValues([[payload.min, payload.max === '' ? null : payload.max, payload.feePercentage]]);
          logActivity(adminUser, 'UPDATE_FEE_CONFIG', `Mengedit bracket fee ID: ${payload.id}`);
          return { success: true };
        }
      }
      throw new Error("Bracket tidak ditemukan.");
    } else {
      const id = Utilities.getUuid();
      sheet.appendRow([id, payload.min, payload.max === '' ? null : payload.max, payload.feePercentage]);
      logActivity(adminUser, 'CREATE_FEE_CONFIG', `Menambah bracket fee: ${payload.min} - ${payload.max || '∞'} (${payload.feePercentage}%)`);
      return { success: true };
    }
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}
function deleteFeeConfig(id, adminUser) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('FeeConfig');
    if (!sheet) throw new Error("Sheet FeeConfig tidak ditemukan");
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        sheet.deleteRow(i + 1);
        logActivity(adminUser, 'DELETE_FEE_CONFIG', `Menghapus bracket fee ID: ${id}`);
        return { success: true };
      }
    }
    throw new Error("Bracket tidak ditemukan.");
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}
function getHariLiburKeterangan(tanggal) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Hari_Libur');
  if (!sheet || sheet.getLastRow() < 2) return null;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1]) {
      const tglLibur = Utilities.formatDate(new Date(data[i][1]), Session.getScriptTimeZone(), "yyyy-MM-dd");
      if (tglLibur === tanggal) return data[i][2] || null;
    }
  }
  return null;
}
function getTodayScheduleForTeacher(teacherName, day) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Schedules');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  data.shift();
  return data.filter(r => {
    if (r[2] !== 'Pelajaran') return false;
    if (r[3] !== day) return false;
    let detail;
    try { detail = JSON.parse(r[5]); } catch(e) { return false; }
    return detail.guru === teacherName;
  }).map(r => {
    let detail;
    try { detail = JSON.parse(r[5]); } catch(e) { detail = {}; }
    return { kelas: r[1], jam: r[4], detail: detail };
  });
}
function updateLaporanBimbingan(id, payload, guruUsername) {
  _assertEmailGate(guruUsername);
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Laporan_Bimbingan');
    const data = sheet.getDataRange().getValues();
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === id) {
        // Kolom 1-based: 3=Nama_Siswa, 6=Tanggal, 7=Jenis_Laporan, 8=Detail_Laporan
        if (payload.namaSiswa) sheet.getRange(i + 1, 3).setValue(payload.namaSiswa);
        sheet.getRange(i + 1, 6).setValue(payload.tanggal);
        if (payload.jenis)  sheet.getRange(i + 1, 7).setValue(payload.jenis);
        sheet.getRange(i + 1, 8).setValue(payload.detail);
        SpreadsheetApp.flush();
        logActivity(guruUsername, 'UPDATE_LAPORAN', `Mengedit ${payload.jenis || data[i][6]} untuk ${payload.namaSiswa || data[i][2]}`);
        return { success: true };
      }
    }
    throw new Error("Laporan tidak ditemukan.");
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}
function getEBooks() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('eBook');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  data.shift();
  return data.map(row => ({
    id: row[0],
    judul: row[1],
    penulis: row[2],
    penerbit: row[3],
    tahun: row[4],
    versi: row[5],
    kategori: row[6],
    mapel: row[7],
    kelas: row[8],
    url: row[9],
    premium: row[10] === true || row[10] === 'TRUE'
  }));
}
function addEBook(judul, penulis, penerbit, tahun, versi, kategori, mapel, kelas, url, premium, adminUser) {
  const lock = LockService.getScriptLock();
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('eBook');
    if (!sheet) throw new Error("Sheet eBook tidak ditemukan.");
    const id = Utilities.getUuid();
    sheet.appendRow([id, judul, penulis, penerbit, tahun, versi, kategori, mapel, kelas, url, premium]);
    logActivity(adminUser, 'CREATE_EBOOK', `Menambah buku digital: ${judul}`);
    return { success: true };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}
function updateEBook(id, judul, penulis, penerbit, tahun, versi, kategori, mapel, kelas, url, premium, adminUser) {
  const lock = LockService.getScriptLock();
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('eBook');
    const data = sheet.getDataRange().getValues();
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] == id) {
        sheet.getRange(i + 1, 2, 1, 10).setValues([[judul, penulis, penerbit, tahun, versi, kategori, mapel, kelas, url, premium]]);
        logActivity(adminUser, 'UPDATE_EBOOK', `Mengedit buku digital: ${judul}`);
        return { success: true };
      }
    }
    throw new Error("Buku tidak ditemukan.");
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}
function deleteEBook(id, adminUser) {
  const lock = LockService.getScriptLock();
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('eBook');
    const data = sheet.getDataRange().getValues();
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] == id) {
        sheet.deleteRow(i + 1);
        logActivity(adminUser, 'DELETE_EBOOK', `Menghapus buku digital ID: ${id}`);
        return { success: true };
      }
    }
    throw new Error("Buku tidak ditemukan.");
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}
function deleteSchedulesBatch(ids, adminUser) {
  _assertEmailGate(adminUser);
  const lock = LockService.getScriptLock();
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Schedules');
    const data = sheet.getDataRange().getValues();
    for (let i = data.length - 1; i >= 0; i--) {
      if (ids.includes(data[i][0])) {
        sheet.deleteRow(i + 1);
      }
    }
    logActivity(adminUser, 'DELETE_SCHEDULE_BATCH', `Menghapus ${ids.length} jadwal`);
    return { success: true };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}
function getHafalanData() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === 'Hafalan') {
      const hafalan = data[i][1] ? data[i][1].toString().split(';').map(h => h.trim()).filter(h => h) : [];
      return hafalan.map((h, idx) => ({ id: idx, nama: h }));
    }
  }
  return [];
}
function saveHafalan(namaHafalan, adminUser) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings');
  if (!sheet) throw new Error("Sheet Settings tidak ditemukan");
  
  // Ganti titik koma (;) menjadi koma (,) agar tidak bentrok dengan pemisah data
  namaHafalan = String(namaHafalan || '').replace(/;/g, ',').trim();
  
  const data = sheet.getDataRange().getValues();
  let rowIdx = -1;
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === 'Hafalan') {
      rowIdx = i + 1;
      break;
    }
  }
  if (rowIdx === -1) {
    sheet.appendRow(['Hafalan', namaHafalan]);
  } else {
    const current = data[rowIdx - 1][1] || '';
    const list = current ? current.toString().split(';').map(h => h.trim()) : [];
    if (list.includes(namaHafalan)) throw new Error("Hafalan sudah ada");
    list.push(namaHafalan);
    sheet.getRange(rowIdx, 2).setValue(list.join('; '));
  }
  logActivity(adminUser, 'CREATE_HAFALAN', 'Menambah hafalan: ' + namaHafalan);
  return { success: true };
}
function updateHafalan(id, newNamaHafalan, adminUser) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings');
  if (!sheet) throw new Error("Sheet Settings tidak ditemukan");
  
  // Ganti titik koma (;) menjadi koma (,) agar tidak bentrok dengan pemisah data
  newNamaHafalan = String(newNamaHafalan || '').replace(/;/g, ',').trim();
  
  const data = sheet.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === 'Hafalan') {
      const list = data[i][1] ? data[i][1].toString().split(';').map(h => h.trim()).filter(h => h) : [];
      if (id >= 0 && id < list.length) {
        const oldName = list[id];
        list[id] = newNamaHafalan;
        sheet.getRange(i + 1, 2).setValue(list.join('; '));
        logActivity(adminUser, 'UPDATE_HAFALAN', `Mengedit hafalan: ${oldName} menjadi ${newNamaHafalan}`);
        return { success: true };
      }
    }
  }
  throw new Error("Data tidak ditemukan");
}
function deleteHafalan(id, adminUser) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings');
  if (!sheet) throw new Error("Sheet Settings tidak ditemukan");
  const data = sheet.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === 'Hafalan') {
      const list = data[i][1] ? data[i][1].toString().split(';').map(h => h.trim()).filter(h => h) : [];
      if (id >= 0 && id < list.length) {
        const deleted = list.splice(id, 1)[0];
        sheet.getRange(i + 1, 2).setValue(list.join('; '));
        logActivity(adminUser, 'DELETE_HAFALAN', 'Menghapus hafalan: ' + deleted);
        return { success: true };
      }
    }
  }
  throw new Error("Data tidak ditemukan");
}
function getSiswaDetail(username) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('SiswaDetail');
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return null;
  const headers = data[0];
  const target = String(username).replace(/\s+/g, '').toLowerCase();
  for (let i = 1; i < data.length; i++) {
    let stored = String(data[i][0] || '').replace(/\s+/g, '').toLowerCase();
    if (stored.startsWith("'")) {
      stored = stored.substring(1);
    }
    if (stored === target) {
      let obj = {};
      headers.forEach((h, idx) => {
        let value = data[i][idx];
        if (value instanceof Date) {
           value = Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
        }
        obj[h] = value;
      });
      return obj;
    }
  }
  return null;
}
function saveSiswaDetail(data, username) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    if (!username) throw new Error('Username kosong.');
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureSiswaDetailHeaders();
    let sheet = ss.getSheetByName('SiswaDetail');
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    const headers = values[0];
    let rowIndex = -1;
    for (let i = 1; i < values.length; i++) {
      if (_cmpUsername(values[i][0], username)) {
        rowIndex = i + 1;
        break;
      }
    }
    const safeText = (val) => val ? "'" + val : '';
    const statusTinggal = String(data['SiswaStatusTempatTinggal'] || '').trim();
    let usernameOrtuAuto = '';
    if (statusTinggal === 'Tinggal dengan Ayah Kandung') {
      usernameOrtuAuto = String(data['AyahNama'] || '').trim();
    } else if (statusTinggal === 'Tinggal dengan Ibu Kandung') {
      usernameOrtuAuto = String(data['IbuNama'] || '').trim();
    } else {
      usernameOrtuAuto = String(data['WaliNama'] || '').trim();
    }
    if (usernameOrtuAuto) {
      data['Username_Ortu'] = usernameOrtuAuto;
    } else if (!data['Username_Ortu']) {
      const ortuColIdx = headers.indexOf('Username_Ortu');
      const existingOrtu = (rowIndex !== -1 && ortuColIdx >= 0)
        ? String(values[rowIndex - 1][ortuColIdx] || '').replace(/^'/, '')
        : '';
      data['Username_Ortu'] = existingOrtu;
    }
    const newRow = [];
    headers.forEach((header, idx) => {
      if (header === 'username') {
        newRow.push(safeText(username));
      } else {
        const docPrefix = DOCUMENT_TYPES.find(type => header === type + '_FileName' || header === type + '_FileUrl');
        if (docPrefix) {
          if (rowIndex !== -1) {
            newRow.push(values[rowIndex - 1][idx]);
          } else {
            newRow.push('');
          }
        } else {
          const val = data[header];
          if (val === undefined) {
            newRow.push('');
          } else if (typeof val === 'boolean') {
            newRow.push(val);
          } else {
            newRow.push(safeText(val.toString()));
          }
        }
      }
    });
    if (rowIndex === -1) {
      sheet.appendRow(newRow);
    } else {
      sheet.getRange(rowIndex, 1, 1, newRow.length).setValues([newRow]);
    }
    const ortuUsername = String(data['Username_Ortu'] || '').trim();
    if (ortuUsername) {
      const userSheet  = ss.getSheetByName('Users');
      const userValues = userSheet.getDataRange().getValues();
      const userHeaders = userValues[0];
      const alreadyExists = userValues.slice(1).some(
        row => _cmpUsername(row[1], ortuUsername)
      );
      if (!alreadyExists) {
        let fullNameOrtu = ortuUsername;
        if (statusTinggal === 'Tinggal dengan Ayah Kandung') {
          fullNameOrtu = String(data['AyahNama'] || ortuUsername).trim();
        } else if (statusTinggal === 'Tinggal dengan Ibu Kandung') {
          fullNameOrtu = String(data['IbuNama'] || ortuUsername).trim();
        } else {
          fullNameOrtu = String(data['WaliNama'] || ortuUsername).trim();
        }
        const newUserId = Utilities.getUuid();
        userSheet.appendRow([
          newUserId,
          "'" + ortuUsername,
          "'123456",
          'Orangtua',
          '',
          false,
          '',
          fullNameOrtu,
          '',
          false,
          false,
          '',
          '',
          false
        ]);
        logActivity(username, 'AUTO_CREATE_ORTU',
          `Akun Orang Tua "${ortuUsername}" dibuat otomatis dari data profil siswa ${username}`);
      }
    }
    logActivity(username, 'UPDATE_PROFIL', 'Memperbarui data profil lengkap');
    return { success: true };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}
function checkProfileIncomplete(username) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('SiswaDetail');
  if (!sheet) return "Sheet SiswaDetail tidak ditemukan";
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  let rowData = null;
  for (let i = 1; i < data.length; i++) {
    if (_cmpUsername(data[i][0], username)) {
      rowData = data[i];
      break;
    }
  }
  if (!rowData) return "Data belum tersimpan di database";
  const getVal = (field) => {
    const idx = headers.indexOf(field);
    return idx >= 0 ? rowData[idx] : '';
  };
  // Helper: nilai checkbox bisa true / 'true' / 'TRUE' / 1
  const _truthy = (v) => {
    if (v === true || v === 1) return true;
    return String(v == null ? '' : v).trim().toLowerCase() === 'true';
  };
  const waliPilihan       = String(getVal('WaliPilihan') || '').trim();
  const ayahStatus        = String(getVal('AyahStatus') || '').trim();
  const ibuStatus         = String(getVal('IbuStatus') || '').trim();
  const ayahLuarNegeri    = _truthy(getVal('AyahAlamatTinggalLuarNegeri'));
  const ibuLuarNegeri     = _truthy(getVal('IbuAlamatTinggalLuarNegeri'));
  const ibuSamaAyah       = _truthy(getVal('IbuAlamatSamadenganAyah'));
  const waliLuarNegeri    = _truthy(getVal('WaliAlamatTinggalLuarNegeri'));
  const waliAlamatStatus  = String(getVal('WaliAlamatStatus') || '').trim();

  const requiredFields = [];

  // ── Data Siswa ──────────────────────────────────────────────────────────
  const siswaFields = ['NIK','TempatLahir','TanggalLahir','JenisKelamin','JumlahSaudara','AnakKe','Agama','CitaCita','Hobi','NoHP','Email','BiayaSekolah','PraSekolah','NomorKK','NamaKepalaKeluarga'];
  siswaFields.forEach(f => requiredFields.push(f));

  // ── Ayah biodata (selalu wajib) ─────────────────────────────────────────
  const ayahBio = ['AyahNama','AyahStatus','AyahNIK','AyahTempatLahir','AyahTanggalLahir','AyahPendidikan','AyahPekerjaan','AyahPenghasilan','AyahNoHP'];
  ayahBio.forEach(f => requiredFields.push(f));

  // Ayah alamat hanya wajib bila ayah masih hidup DAN tidak tinggal di luar
  // negeri. Bila Sudah Meninggal / Tidak Diketahui / Luar Negeri, UI sengaja
  // men-disable field tsb dan mengirim "" — backend HARUS konsisten supaya
  // user tidak terjebak dalam infinite force-profile-update.
  if (ayahStatus === 'Masih Hidup' && !ayahLuarNegeri) {
    const ayahAlamat = ['AyahStatusKepemilikanRumah','AyahProvinsi','AyahKabupaten','AyahKecamatan','AyahKelurahan','AyahRW','AyahRT','AyahJalan','AyahKodePos'];
    ayahAlamat.forEach(f => requiredFields.push(f));
  }

  // ── Ibu biodata (selalu wajib) ──────────────────────────────────────────
  const ibuBio = ['IbuNama','IbuStatus','IbuNIK','IbuTempatLahir','IbuTanggalLahir','IbuPendidikan','IbuPekerjaan','IbuPenghasilan','IbuNoHP'];
  ibuBio.forEach(f => requiredFields.push(f));

  // Ibu alamat wajib bila ibu masih hidup, tidak luar negeri, dan tidak
  // memilih opsi "Sama dengan Ayah Kandung".
  if (ibuStatus === 'Masih Hidup' && !ibuLuarNegeri && !ibuSamaAyah) {
    const ibuAlamat = ['IbuStatusKepemilikanRumah','IbuProvinsi','IbuKabupaten','IbuKecamatan','IbuKelurahan','IbuRW','IbuRT','IbuJalan','IbuKodePos'];
    ibuAlamat.forEach(f => requiredFields.push(f));
  }

  // ── Wali ────────────────────────────────────────────────────────────────
  // WaliPilihan selalu wajib (Ayah / Ibu / Lainnya).
  requiredFields.push('WaliPilihan');

  if (waliPilihan === 'Lainnya') {
    const waliBio = ['WaliNama','WaliStatus','WaliNIK','WaliTempatLahir','WaliTanggalLahir','WaliPendidikan','WaliPekerjaan','WaliPenghasilan','WaliNoHP','WaliAlamatStatus'];
    waliBio.forEach(f => requiredFields.push(f));

    // Detail alamat wali hanya wajib bila WaliAlamatStatus="Lainnya" dan
    // tidak tinggal di luar negeri. Bila status "Samadengan Ayah/Ibu",
    // alamat di-copy otomatis dari ayah/ibu.
    if (waliAlamatStatus === 'Lainnya' && !waliLuarNegeri) {
      const waliAlamat = ['WaliStatusKepemilikanRumah','WaliProvinsi','WaliKabupaten','WaliKecamatan','WaliKelurahan','WaliRW','WaliRT','WaliJalan','WaliKodePos'];
      waliAlamat.forEach(f => requiredFields.push(f));
    }
  }

  // ── Alamat Siswa (selalu wajib) ─────────────────────────────────────────
  const siswaAlamat = ['SiswaStatusTempatTinggal','SiswaProvinsi','SiswaKabupaten','SiswaKecamatan','SiswaKelurahan','SiswaRW','SiswaRT','SiswaJalan','SiswaKodePos','SiswaJarak','SiswaTransportasi','SiswaWaktuTempuh'];
  siswaAlamat.forEach(f => requiredFields.push(f));

  // ── Dokumen wajib ───────────────────────────────────────────────────────
  requiredFields.push('KK_FileUrl');
  requiredFields.push('AKTA_FileUrl');
  requiredFields.push('IJAZAH_MI_FileUrl');
  if (ayahStatus === 'Masih Hidup') {
    requiredFields.push('KTP_AYAH_FileUrl');
  }
  if (ibuStatus === 'Masih Hidup') {
    requiredFields.push('KTP_IBU_FileUrl');
  }
  if (waliPilihan === 'Lainnya') {
    requiredFields.push('KTP_WALI_FileUrl');
  }

  for (let field of requiredFields) {
    const idx = headers.indexOf(field);
    if (idx === -1) continue;
    const value = rowData[idx];
    if (value === "" || value === null || value === undefined || String(value).trim() === "") {
      return field;
    }
  }
  return false;
}
function getGuruDetail(username) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const userSheet = ss.getSheetByName('Users');
  const scheduleSheet = ss.getSheetByName('Schedules');
  const gwSheet = ss.getSheetByName('Guru_Wali');
  const users = userSheet.getDataRange().getValues();
  let guruInfo = { username: username, fullName: '', tugasTambahan: [], schedules: [], siswaBimbingan: [] };
  for (let i = 1; i < users.length; i++) {
    if (users[i][1] === username) {
      guruInfo.fullName = users[i][7];
      guruInfo.tugasTambahan = users[i][4] ? users[i][4].toString().split(',').map(s => s.trim()).filter(Boolean) : [];
      break;
    }
  }
  const schedules = scheduleSheet.getDataRange().getValues();
  for (let i = 1; i < schedules.length; i++) {
    if (schedules[i][5]) {
      try {
        const desc = JSON.parse(schedules[i][5]);
        if (desc.guru === guruInfo.fullName) {
          guruInfo.schedules.push({
            kelas: schedules[i][1],
            hari: schedules[i][3],
            jam: schedules[i][4],
            mapel: desc.mapel
          });
        }
      } catch(e) {}
    }
  }
  if (gwSheet) {
    const gwData = gwSheet.getDataRange().getValues();
    for (let i = 1; i < gwData.length; i++) {
      if (gwData[i][1] === username) {
        try {
          const siswaList = JSON.parse(gwData[i][3] || '[]');
          guruInfo.siswaBimbingan = siswaList.map(s => ({
            username: s.username,
            nama: s.nama
          }));
        } catch (e) {
          console.warn('Gagal parse daftar siswa bimbingan untuk guru', username);
        }
        break;
      }
    }
  }
  return guruInfo;
}
function getAllGuruSummary() {
  var ss           = SpreadsheetApp.getActiveSpreadsheet();
  var userSheet    = ss.getSheetByName('Users');
  var schedSheet   = ss.getSheetByName('Schedules');
  var gwSheet      = ss.getSheetByName('Guru_Wali');
  var classSheet   = ss.getSheetByName('Classes');
  var users    = userSheet.getDataRange().getValues();
  var guruMap  = {};
  var guruList = [];
  for (var i = 1; i < users.length; i++) {
    if (users[i][3] === 'Guru') {
      var g = {
        username      : users[i][1],
        fullName      : users[i][7] || '',
        tugasTambahan : users[i][4]
          ? users[i][4].toString().split(',').map(function(s){ return s.trim(); }).filter(Boolean)
          : [],
        jadwalCount   : 0,
        siswaCount    : 0,
        waliKelas     : null
      };
      guruMap[g.username] = g;
      guruList.push(g);
    }
  }
  if (classSheet && classSheet.getLastRow() > 1) {
    var classData = classSheet.getDataRange().getValues();
    for (var c = 1; c < classData.length; c++) {
      var waliUsername = classData[c][3];
      if (guruMap[waliUsername]) {
        guruMap[waliUsername].waliKelas = classData[c][2];
      }
    }
  }
  if (schedSheet && schedSheet.getLastRow() > 1) {
    var schedules = schedSheet.getDataRange().getValues();
    for (var s = 1; s < schedules.length; s++) {
      if (schedules[s][5]) {
        try {
          var desc  = JSON.parse(schedules[s][5]);
          var match = guruList.filter(function(g){ return g.fullName === desc.guru; })[0];
          if (match) match.jadwalCount++;
        } catch(e) {}
      }
    }
  }
  if (gwSheet && gwSheet.getLastRow() > 1) {
    var gwData = gwSheet.getDataRange().getValues();
    for (var w = 1; w < gwData.length; w++) {
      var guru = guruMap[gwData[w][1]];
      if (guru) {
        try {
          var siswaList  = JSON.parse(gwData[w][3] || '[]');
          guru.siswaCount = siswaList.length;
        } catch(e) {}
      }
    }
  }
  return guruList;
}
function getSiswaDetailAdmin(username) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const userSheet = ss.getSheetByName('Users');
  const detailSheet = ss.getSheetByName('SiswaDetail');
  const classSheet = ss.getSheetByName('Classes');
  const gwSheet = ss.getSheetByName('Guru_Wali');
  let result = { username: username, fullName: username, kelas: '-', waliKelas: '-', guruWali: '-', details: {} };
  const users = userSheet.getDataRange().getValues();
  for (let i = 1; i < users.length; i++) {
    if (users[i][1] === username) {
      result.fullName = users[i][7] || username;
      result.kelas = users[i][6] || '-';
      break;
    }
  }
  if (result.kelas !== '-') {
    const classes = classSheet.getDataRange().getValues();
    for (let i = 1; i < classes.length; i++) {
      if (classes[i][2] === result.kelas) {
        result.waliKelas = classes[i][4] || '-';
        break;
      }
    }
  }
  const gws = gwSheet.getDataRange().getValues();
  for (let i = 1; i < gws.length; i++) {
    if (gws[i][3]) {
      try {
        const parsed = JSON.parse(gws[i][3]);
        const daftarSiswa = Array.isArray(parsed) ? parsed : [];
        if (daftarSiswa.some(s => String(s.username) === String(username))) {
          result.guruWali = gws[i][2];
          break;
        }
      } catch(e) {}
    }
  }
  if (detailSheet) {
    const details = detailSheet.getDataRange().getValues();
    const headers = details[0];
    for (let i = 1; i < details.length; i++) {
      if (String(details[i][0]) === String(username)) {
        for (let j = 0; j < headers.length; j++) {
          result.details[headers[j]] = details[i][j] instanceof Date ?
            Utilities.formatDate(details[i][j], Session.getScriptTimeZone(), "dd/MM/yyyy") :
            details[i][j];
        }
        break;
      }
    }
  }
  return result;
}
function getAttendanceRecapByPeriod(period, year) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const attSheet = ss.getSheetByName('Attendance');
  const userSheet = ss.getSheetByName('Users');
  if (!attSheet || attSheet.getLastRow() < 2) return [];
  const attData = attSheet.getDataRange().getValues();
  attData.shift();
  const filtered = attData.filter(row => {
    const tgl = row[1];
    if (!tgl) return false;
    const d = new Date(tgl);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    
    switch(period) {
      case 'triwulan1': return m >= 1 && m <= 3 && y === year + 1;
      case 'triwulan2': return m >= 4 && m <= 6 && y === year + 1;
      case 'triwulan3': return m >= 7 && m <= 9 && y === year;
      case 'triwulan4': return m >= 10 && m <= 12 && y === year;
      case 'semester1': return m >= 7 && m <= 12 && y === year;
      case 'semester2': return m >= 1 && m <= 6 && y === year + 1;
      case 'tahun': return (m >= 7 && m <= 12 && y === year) || (m >= 1 && m <= 6 && y === year + 1);
      default: return false;
    }
  });
  const recap = {};
  filtered.forEach(row => {
    const usernameRaw = String(row[3] == null ? '' : row[3]).replace(/^'+/, '').trim();
    const numKey = parseFloat(usernameRaw);
    const userKey = (!isNaN(numKey) && isFinite(numKey) && usernameRaw !== '') ? String(numKey) : usernameRaw;
    const nama = row[4];
    const kelas = row[2];
    const status = row[5];
    if (!recap[userKey]) {
      recap[userKey] = { username: usernameRaw, nama, kelas, hadir:0, alpha:0, sakit:0, izin:0 };
    }
    if (status === 'Hadir') recap[userKey].hadir++;
    else if (status === 'Alpha') recap[userKey].alpha++;
    else if (status === 'Sakit') recap[userKey].sakit++;
    else if (status === 'Izin') recap[userKey].izin++;
  });
  const result = Object.values(recap);
  // BUG FIX: Tambahkan totalTidakHadir dan persentase agar konsisten dengan
  // getAttendanceRecap() dan dapat digunakan oleh renderRekapData & PDF generator.
  result.forEach(r => {
    const totalTidakHadir = (r.alpha || 0) + (r.sakit || 0) + (r.izin || 0);
    const totalHari = (r.hadir || 0) + totalTidakHadir;
    const persentase = totalHari > 0 ? ((r.hadir || 0) / totalHari) * 100 : 0;
    let predikat = '';
    if (persentase > 89) predikat = 'Sangat Teladan';
    else if (persentase >= 80) predikat = 'Teladan';
    else if (persentase >= 70) predikat = 'Pemalas';
    else predikat = 'Sangat Pemalas';
    r.totalTidakHadir = totalTidakHadir;
    r.persentase = persentase.toFixed(2);
    r.predikat = predikat;
  });
  result.sort((a, b) => a.nama.localeCompare(b.nama));
  return result;
}
function _buildAlamatGabungan_(profile) {
  profile = profile || {};
  const alamatLengkap = String(profile.alamatLengkap || '').trim();
  const kelNama       = String(profile.kelurahan    || '').trim();
  const kecNama       = String(profile.kecamatan    || '').trim();
  const kabNama       = String(profile.kabupaten    || '').trim();
  const provNama      = String(profile.provinsi     || '').trim();
  const parts = [];
  if (alamatLengkap) parts.push(alamatLengkap);
  if (kelNama)       parts.push('Kel. ' + kelNama);
  if (kecNama)       parts.push('Kec. ' + kecNama);
  if (kabNama)       parts.push(kabNama);
  if (provNama)      parts.push(provNama);
  return parts.join(', ');
}
function getSchoolProfile() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('SchoolProfile');
  if (!sheet) {
    sheet = ss.insertSheet('SchoolProfile');
    sheet.appendRow([
      'ID', 'NamaSekolah', 'Alamat', 'LogoUrl', 'KepalaSekolah', 'NIPKepala',
      'ProvinsiId', 'ProvinsiNama',
      'KabupatenId', 'KabupatenNama', 'KecamatanId', 'KecamatanNama',
      'KelurahanId', 'KelurahanNama', 'AlamatLengkap', 'Telepon', 'NPSN', 'LogoKoperasiUrl'
    ]);
    sheet.appendRow([
      Utilities.getUuid(), 'Madrasah Tsanawiyah Contoh', 'Jl. Contoh No. 1', '',
      'Drs. H. Contoh', '196001011990011001',
      '', '', '', '', '', '', '', '', '', '', '', ''
    ]);
  } else {
    const headers = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0];
    const need = ['ProvinsiId','ProvinsiNama','KabupatenId','KabupatenNama','KecamatanId','KecamatanNama','KelurahanId','KelurahanNama','AlamatLengkap','Telepon','NPSN','LogoKoperasiUrl'];
    let nextCol = sheet.getLastColumn() + 1;
    need.forEach(h => {
      if (headers.indexOf(h) < 0) {
        sheet.getRange(1, nextCol).setValue(h);
        nextCol++;
      }
    });
  }
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return null;
  const headers = data[0];
  const row = data[1];
  const get = (h) => {
    const idx = headers.indexOf(h);
    return idx >= 0 ? (row[idx] == null ? '' : String(row[idx])) : '';
  };
  const profile = {
    id:             get('ID'),
    namaSekolah:    get('NamaSekolah'),
    alamat:         get('Alamat'),
    logoUrl:        get('LogoUrl'),
    kepalaSekolah:  get('KepalaSekolah'),
    nipKepala:      get('NIPKepala'),
    provinsiId:     get('ProvinsiId'),
    provinsi:       get('ProvinsiNama'),
    kabupatenId:    get('KabupatenId'),
    kabupaten:      get('KabupatenNama'),
    kecamatanId:    get('KecamatanId'),
    kecamatan:      get('KecamatanNama'),
    kelurahanId:    get('KelurahanId'),
    kelurahan:      get('KelurahanNama'),
    alamatLengkap:  get('AlamatLengkap'),
    telepon:        get('Telepon'),
    npsn:           get('NPSN'),
    logoKoperasiUrl: get('LogoKoperasiUrl')
  };
  const rebuilt = _buildAlamatGabungan_(profile);
  if (rebuilt) profile.alamat = rebuilt;
  return profile;
}
function saveSchoolProfile(profile, adminUser) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('SchoolProfile');
    const HEADERS = [
      'ID', 'NamaSekolah', 'Alamat', 'LogoUrl', 'KepalaSekolah', 'NIPKepala',
      'ProvinsiId', 'ProvinsiNama',
      'KabupatenId', 'KabupatenNama', 'KecamatanId', 'KecamatanNama',
      'KelurahanId', 'KelurahanNama', 'AlamatLengkap', 'LogoKoperasiUrl'
    ];
    if (!sheet) {
      sheet = ss.insertSheet('SchoolProfile');
      sheet.appendRow(HEADERS);
    } else {
      const headers = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0];
      let nextCol = sheet.getLastColumn() + 1;
      HEADERS.forEach(h => {
        if (headers.indexOf(h) < 0) {
          sheet.getRange(1, nextCol).setValue(h);
          nextCol++;
        }
      });
    }
    profile = profile || {};
    const provNama = String(profile.provinsi || '').trim();
    const kabNama  = String(profile.kabupaten || '').trim();
    const kecNama  = String(profile.kecamatan || '').trim();
    const kelNama  = String(profile.kelurahan || '').trim();
    const alamatLengkap = String(profile.alamatLengkap || '').trim();
    const alamatGabungan = _buildAlamatGabungan_(profile);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const lastRow = sheet.getLastRow();
    const idIdx = headers.indexOf('ID');
    const idVal = (lastRow >= 2 && idIdx >= 0)
      ? sheet.getRange(2, idIdx + 1).getValue() || Utilities.getUuid()
      : Utilities.getUuid();
    const valueByHeader = {
      'ID':             idVal,
      'NamaSekolah':    String(profile.namaSekolah || '').trim(),
      'Alamat':         alamatGabungan,
      'LogoUrl':        String(profile.logoUrl || '').trim(),
      'KepalaSekolah':  String(profile.kepalaSekolah || '').trim(),
      'NIPKepala':      String(profile.nipKepala || '').trim(),
      'ProvinsiId':     String(profile.provinsiId || '').trim(),
      'ProvinsiNama':   provNama,
      'KabupatenId':    String(profile.kabupatenId || '').trim(),
      'KabupatenNama':  kabNama,
      'KecamatanId':    String(profile.kecamatanId || '').trim(),
      'KecamatanNama':  kecNama,
      'KelurahanId':    String(profile.kelurahanId || '').trim(),
      'KelurahanNama':  kelNama,
      'AlamatLengkap':  alamatLengkap,
      'LogoKoperasiUrl': String(profile.logoKoperasiUrl || '').trim()
    };
    const newRow = headers.map(h => valueByHeader[h] != null ? valueByHeader[h] : '');
    if (lastRow < 2) {
      sheet.appendRow(newRow);
    } else {
      sheet.getRange(2, 1, 1, headers.length).setValues([newRow]);
    }
    logActivity(adminUser, 'UPDATE_SCHOOL_PROFILE', 'Memperbarui profil sekolah');
    return { success: true };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}
function uploadFileToDrive(base64, fileName, adminUser) {
  try {
    const blob = Utilities.newBlob(Utilities.base64Decode(base64), 'application/pdf', fileName);
    let folder;
    const folders = DriveApp.getFoldersByName('Asest eBook');
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder('Asest eBook');
    }
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const fileUrl = file.getUrl();
    logActivity(adminUser, 'UPLOAD_FILE', `Upload file: ${fileName} ke folder Asest eBook`);
    return fileUrl;
  } catch (e) {
    throw new Error('Gagal upload ke Drive: ' + e.toString());
  }
}
const DOCUMENT_TYPES = ['KK', 'AKTA', 'IJAZAH_MI', 'IJAZAH_TK', 'KIP', 'BPJS', 'KKS', 'PKH', 'KTP_AYAH', 'KTP_IBU', 'KTP_WALI'];
const STUDENT_DOC_ALLOWED_EXT = {
  KK:        ['pdf'],
  AKTA:      ['pdf'],
  IJAZAH_MI: ['pdf'],
  IJAZAH_TK: ['pdf'],
  KIP:       ['png', 'jpg', 'jpeg'],
  BPJS:      ['png', 'jpg', 'jpeg'],
  KKS:       ['png', 'jpg', 'jpeg'],
  PKH:       ['png', 'jpg', 'jpeg'],
  KTP_AYAH:  ['png', 'jpg', 'jpeg'],
  KTP_IBU:   ['png', 'jpg', 'jpeg'],
  KTP_WALI:  ['png', 'jpg', 'jpeg']
};
const STUDENT_DOC_MAX_BYTES = 50 * 1024 * 1024;
function _detectFileExtFromBytes_(bytes) {
  if (!bytes || bytes.length < 4) return '';
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return 'pdf';
  }
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 &&
      bytes[2] === 0x4E && bytes[3] === 0x47 && bytes[4] === 0x0D &&
      bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A) {
    return 'png';
  }
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return 'jpg';
  }
  return '';
}
function _validateStudentDocFormat_(documentType, fileName, base64File) {
  const allowed = STUDENT_DOC_ALLOWED_EXT[documentType];
  if (!allowed) {
    return {
      ok: false,
      code: 'UNKNOWN_DOC_TYPE',
      message: 'Tipe dokumen "' + documentType + '" tidak dikenali.'
    };
  }
  const fileExt = String(fileName || '').split('.').pop().toLowerCase();
  if (allowed.indexOf(fileExt) < 0) {
    return {
      ok: false,
      code: 'EXT_NOT_ALLOWED',
      message: 'Format file tidak didukung. Hanya menerima: ' +
               allowed.map(function(e) { return '.' + e; }).join(', ') + '.'
    };
  }
  let bytes;
  try {
    bytes = Utilities.base64Decode(base64File);
  } catch (e) {
    return {
      ok: false,
      code: 'INVALID_BASE64',
      message: 'Data file tidak valid (decode error).'
    };
  }
  if (!bytes || bytes.length === 0) {
    return { ok: false, code: 'EMPTY_FILE', message: 'File kosong.' };
  }
  if (bytes.length > STUDENT_DOC_MAX_BYTES) {
    return {
      ok: false,
      code: 'FILE_TOO_LARGE',
      message: 'Ukuran file melebihi batas maksimal 50 MB.'
    };
  }
  const head = bytes.slice(0, 8).map(function(b) { return b & 0xff; });
  const detected = _detectFileExtFromBytes_(head);
  if (!detected) {
    return {
      ok: false,
      code: 'UNRECOGNIZED_FORMAT',
      message: 'Format file tidak dapat dikenali. Hanya menerima: ' +
               allowed.map(function(e) { return '.' + e; }).join(', ') + '.'
    };
  }
  const canonicalAllowed = allowed.map(function(e) { return e === 'jpeg' ? 'jpg' : e; });
  if (canonicalAllowed.indexOf(detected) < 0) {
    return {
      ok: false,
      code: 'CONTENT_MISMATCH',
      message: 'Isi file tidak sesuai dengan ekstensi-nya. Pastikan benar-benar mengunggah ' +
               allowed.map(function(e) { return '.' + e; }).join(' / ') + '.'
    };
  }
  const extCanonical = (fileExt === 'jpeg') ? 'jpg' : fileExt;
  if (extCanonical !== detected) {
    return {
      ok: false,
      code: 'EXT_CONTENT_MISMATCH',
      message: 'Ekstensi file (.' + fileExt + ') tidak cocok dengan isi file (.' + detected + ').'
    };
  }
  return { ok: true, ext: detected };
}
function ensureSiswaDetailHeaders() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('SiswaDetail');
  if (!sheet) {
    sheet = ss.insertSheet('SiswaDetail');
  }
  const existingHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  const requiredHeaders = [
    'username', 'NIK', 'TempatLahir', 'TanggalLahir', 'JenisKelamin', 'JumlahSaudara', 'AnakKe', 'Agama', 'CitaCita', 'Hobi', 'NoHP', 'Email', 'BiayaSekolah', 'PraSekolah', 'NomorKK', 'NamaKepalaKeluarga',
    'AyahNama', 'AyahStatus', 'AyahNIK', 'AyahTempatLahir', 'AyahTanggalLahir', 'AyahPendidikan', 'AyahPekerjaan', 'AyahPenghasilan', 'AyahNoHP',
    'IbuNama', 'IbuStatus', 'IbuNIK', 'IbuTempatLahir', 'IbuTanggalLahir', 'IbuPendidikan', 'IbuPekerjaan', 'IbuPenghasilan', 'IbuNoHP',
    'WaliPilihan', 'WaliNama', 'WaliStatus', 'WaliNIK', 'WaliTempatLahir', 'WaliTanggalLahir', 'WaliPendidikan', 'WaliPekerjaan', 'WaliPenghasilan', 'WaliNoHP',
    'AyahAlamatTinggalLuarNegeri', 'AyahStatusKepemilikanRumah', 'AyahProvinsi', 'AyahKabupaten', 'AyahKecamatan', 'AyahKelurahan', 'AyahRW', 'AyahRT', 'AyahJalan', 'AyahKodePos',
    'IbuAlamatSamadenganAyah', 'IbuAlamatTinggalLuarNegeri', 'IbuStatusKepemilikanRumah', 'IbuProvinsi', 'IbuKabupaten', 'IbuKecamatan', 'IbuKelurahan', 'IbuRW', 'IbuRT', 'IbuJalan', 'IbuKodePos',
    'WaliAlamatStatus', 'WaliAlamatTinggalLuarNegeri', 'WaliStatusKepemilikanRumah', 'WaliProvinsi', 'WaliKabupaten', 'WaliKecamatan', 'WaliKelurahan', 'WaliRW', 'WaliRT', 'WaliJalan', 'WaliKodePos',
    'SiswaStatusTempatTinggal', 'SiswaProvinsi', 'SiswaKabupaten', 'SiswaKecamatan', 'SiswaKelurahan', 'SiswaRW', 'SiswaRT', 'SiswaJalan', 'SiswaKodePos', 'SiswaJarak', 'SiswaTransportasi', 'SiswaWaktuTempuh',
    'Username_Ortu'
  ];
  DOCUMENT_TYPES.forEach(type => {
    requiredHeaders.push(type + '_FileName');
    requiredHeaders.push(type + '_FileUrl');
  });
  requiredHeaders.forEach((header, idx) => {
    if (!existingHeaders.includes(header)) {
      const insertCol = Math.max(existingHeaders.filter(Boolean).length, idx) + 1;
      sheet.getRange(1, insertCol).setValue(header);
      existingHeaders[insertCol - 1] = header;
    }
  });
}
function uploadStudentDocument(username, documentType, base64File, fileName, fullName) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const fmt = _validateStudentDocFormat_(documentType, fileName, base64File);
    if (!fmt.ok) {
      try {
        logActivity(username, 'UPLOAD_DOCUMENT_REJECTED',
          'Tipe ' + documentType + ' (' + fileName + '): ' + fmt.code + ' — ' + fmt.message);
      } catch (_e) {}
      return { success: false, code: fmt.code, message: fmt.message };
    }
    const folderName = 'Dokumen Siswa';
    let folder;
    const folders = DriveApp.getFoldersByName(folderName);
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
    }
    const extension = fileName.split('.').pop();
    const safeFullName = fullName.replace(/[^a-zA-Z0-9\s]/g, '_').replace(/\s+/g, '_');
    const newFileName = safeFullName + '_' + documentType + '.' + extension;
    const blob = Utilities.newBlob(Utilities.base64Decode(base64File), '', newFileName);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const fileUrl = file.getUrl();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('SiswaDetail');
    if (!sheet) throw new Error('Sheet SiswaDetail tidak ditemukan');
    ensureSiswaDetailHeaders();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const nameCol = headers.indexOf('username');
    if (nameCol === -1) throw new Error('Kolom username tidak ditemukan');
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][nameCol]).trim() === String(username).trim()) {
        rowIndex = i + 1;
        break;
      }
    }
    if (rowIndex === -1) throw new Error('Data siswa tidak ditemukan');
    const fileNameCol = headers.indexOf(documentType + '_FileName');
    const fileUrlCol = headers.indexOf(documentType + '_FileUrl');
    if (fileNameCol === -1 || fileUrlCol === -1) {
      throw new Error('Kolom dokumen tidak ditemukan');
    }
    const oldFileUrl = data[rowIndex - 1][fileUrlCol];
    if (oldFileUrl) {
      const oldFileId = extractDriveFileId(oldFileUrl);
      if (oldFileId) {
        try {
          DriveApp.getFileById(oldFileId).setTrashed(true);
        } catch (e) {
          console.warn('Gagal menghapus file lama:', e);
        }
      }
    }
    sheet.getRange(rowIndex, fileNameCol + 1).setValue(newFileName);
    sheet.getRange(rowIndex, fileUrlCol + 1).setValue(fileUrl);
    SpreadsheetApp.flush();
    logActivity(username, 'UPLOAD_DOCUMENT', `Mengunggah dokumen: ${documentType} (${newFileName})`);
    return { success: true, fileUrl: fileUrl };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}
function deleteStudentDocument(documentType, username) {
  const lock = LockService.getScriptLock();
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('SiswaDetail');
    if (!sheet) throw new Error('Sheet SiswaDetail tidak ditemukan');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const nameCol = headers.indexOf('username');
    if (nameCol === -1) throw new Error('Kolom username tidak ditemukan');
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][nameCol]).trim() === String(username).trim()) {
        rowIndex = i + 1;
        break;
      }
    }
    if (rowIndex === -1) throw new Error('Data siswa tidak ditemukan');
    const fileNameCol = headers.indexOf(documentType + '_FileName');
    const fileUrlCol = headers.indexOf(documentType + '_FileUrl');
    if (fileNameCol === -1 || fileUrlCol === -1) throw new Error('Kolom dokumen tidak ditemukan');
    const oldFileUrl = data[rowIndex - 1][fileUrlCol];
    if (oldFileUrl) {
      const fileId = extractDriveFileId(oldFileUrl);
      if (fileId) {
        try {
          DriveApp.getFileById(fileId).setTrashed(true);
        } catch (e) {
          console.warn('Gagal menghapus file dari Drive:', e);
        }
      }
    }
    sheet.getRange(rowIndex, fileNameCol + 1).setValue('');
    sheet.getRange(rowIndex, fileUrlCol + 1).setValue('');
    SpreadsheetApp.flush();
    logActivity(username, 'DELETE_DOCUMENT', `Menghapus dokumen: ${documentType}`);
    return { success: true };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}
function getIjazahAccessSetting() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings');
    if (!sheet) return { canView: true, canDownload: true };
    const data = sheet.getDataRange().getValues();
    let canView = true, canDownload = true;
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0]).trim() === 'Ijazah_Access_View')
        canView = String(data[i][1]).trim() !== 'false';
      if (String(data[i][0]).trim() === 'Ijazah_Access_Download')
        canDownload = String(data[i][1]).trim() !== 'false';
    }
    return { canView, canDownload };
  } catch(e) {
    throw new Error('getIjazahAccessSetting: ' + e.toString());
  }
}
function saveIjazahAccessSetting(canView, canDownload, adminUser) {
  _assertEmailGate(adminUser);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings');
    if (!sheet) throw new Error('Sheet Settings tidak ditemukan');
    const data = sheet.getDataRange().getValues();
    const upsert = (key, val) => {
      for (let i = 0; i < data.length; i++) {
        if (String(data[i][0]).trim() === key) { sheet.getRange(i + 1, 2).setValue(val); return; }
      }
      sheet.appendRow([key, val]);
    };
    upsert('Ijazah_Access_View',     canView     ? 'true' : 'false');
    upsert('Ijazah_Access_Download', canDownload ? 'true' : 'false');
    SpreadsheetApp.flush();
    logActivity(adminUser, 'SAVE_IJAZAH_ACCESS',
      'Atur akses global ijazah: Lihat=' + canView + ', Unduh=' + canDownload);
    return { success: true };
  } catch(e) { throw new Error(e.message || e.toString()); }
}
function getIjazahAccessForUser(username) {
  try {
    const global = getIjazahAccessSetting();
    const norm   = normalizeUsername(username);
    ensureIjazahSheet();
    const sheet  = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Ijazah');
    const data   = sheet.getDataRange().getValues();
    const h      = data[0];
    const uIdx   = h.indexOf('username');
    const vIdx   = h.indexOf('can_view_override');
    const dIdx   = h.indexOf('can_download_override');
    if (uIdx < 0) return global;
    for (let i = 1; i < data.length; i++) {
      if (normalizeUsername(data[i][uIdx]) !== norm) continue;
      const vOvr = vIdx >= 0 ? String(data[i][vIdx] || '').trim() : '';
      const dOvr = dIdx >= 0 ? String(data[i][dIdx] || '').trim() : '';
      return {
        canView    : vOvr === 'allow' ? true  : vOvr === 'deny' ? false : global.canView,
        canDownload: dOvr === 'allow' ? true  : dOvr === 'deny' ? false : global.canDownload,
        viewOverride: vOvr,
        dlOverride  : dOvr
      };
    }
    return { canView: global.canView, canDownload: global.canDownload, viewOverride: '', dlOverride: '' };
  } catch(e) { throw new Error('getIjazahAccessForUser: ' + e.toString()); }
}
function getIjazahAccessAll() {
  try {
    const global  = getIjazahAccessSetting();
    const alumni  = getAlumniListForIjazah();
    ensureIjazahSheet();
    const sheet   = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Ijazah');
    const data    = sheet.getDataRange().getValues();
    const h       = data[0];
    const uIdx    = h.indexOf('username');
    const vIdx    = h.indexOf('can_view_override');
    const dIdx    = h.indexOf('can_download_override');
    const tIdx    = h.indexOf('tahun_lulus');
    const overMap = {};
    for (let i = 1; i < data.length; i++) {
      const norm = normalizeUsername(data[i][uIdx]);
      if (!norm) continue;
      overMap[norm] = {
        viewOverride: vIdx >= 0 ? String(data[i][vIdx] || '').trim() : '',
        dlOverride  : dIdx >= 0 ? String(data[i][dIdx] || '').trim() : '',
        tahun_lulus : tIdx >= 0 ? String(data[i][tIdx] || '').trim() : ''
      };
    }
    const result = alumni.map(a => {
      const norm = normalizeUsername(a.username);
      const ov   = overMap[norm] || { viewOverride: '', dlOverride: '', tahun_lulus: '' };
      return {
        username    : a.username,
        fullName    : a.fullName,
        kelas       : a.kelas,
        tahun_lulus : ov.tahun_lulus,
        viewOverride: ov.viewOverride,
        dlOverride  : ov.dlOverride
      };
    });
    return { global, alumni: result };
  } catch(e) { throw new Error('getIjazahAccessAll: ' + e.toString()); }
}
function saveAlumniIjazahAccess(username, viewOverride, dlOverride, adminUser) {
  _assertEmailGate(adminUser);
  try {
    const lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      const { sheet, data, h, rowIndex } = getOrCreateIjazahRow(username, '', adminUser);
      const vIdx = h.indexOf('can_view_override');
      const dIdx = h.indexOf('can_download_override');
      const now  = new Date();
      if (vIdx >= 0) sheet.getRange(rowIndex, vIdx + 1).setValue(viewOverride || '');
      if (dIdx >= 0) sheet.getRange(rowIndex, dIdx + 1).setValue(dlOverride || '');
      sheet.getRange(rowIndex, h.indexOf('updated_at') + 1).setValue(now);
      sheet.getRange(rowIndex, h.indexOf('updated_by') + 1).setValue(safeText(adminUser));
      SpreadsheetApp.flush();
      logActivity(adminUser, 'SAVE_ALUMNI_IJAZAH_ACCESS',
        'Atur akses alumni ' + username + ': Lihat=' + (viewOverride||'global') + ', Unduh=' + (dlOverride||'global'));
      return { success: true };
    } finally { lock.releaseLock(); }
  } catch(e) { throw new Error('saveAlumniIjazahAccess: ' + e.toString()); }
}
function saveAlumniIjazahAccessMassal(usernames, grantAccess, adminUser) {
  _assertEmailGate(adminUser);
  try {
    const lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      ensureIjazahSheet();
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Ijazah');
      const data = sheet.getDataRange().getValues();
      const h = data[0];
      const uIdx = h.indexOf('username');
      const fnIdx = h.indexOf('fullName');
      const vIdx = h.indexOf('can_view_override');
      const dIdx = h.indexOf('can_download_override');
      const updatedIdx = h.indexOf('updated_at');
      const updatedByIdx = h.indexOf('updated_by');
      const now = new Date();
      
      const valStr = grantAccess ? 'allow' : 'deny';
      
      // Buat map username → fullName dari sheet Users
      const fullNameMap = {};
      try {
        const userSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
        if (userSheet) {
          const uData = userSheet.getDataRange().getValues();
          for (let i = 1; i < uData.length; i++) {
            const uNorm = normalizeUsername(uData[i][1]);
            if (uNorm) fullNameMap[uNorm] = String(uData[i][7] || '').trim() || normalizeUsername(uData[i][1]);
          }
        }
      } catch(_e) {}
      
      const userMap = {};
      usernames.forEach(u => { userMap[normalizeUsername(u)] = u; });
      
      for (let i = 1; i < data.length; i++) {
        const u = normalizeUsername(data[i][uIdx]);
        if (userMap[u]) {
          if (vIdx >= 0) sheet.getRange(i + 1, vIdx + 1).setValue(valStr);
          if (dIdx >= 0) sheet.getRange(i + 1, dIdx + 1).setValue(valStr);
          if (updatedIdx >= 0) sheet.getRange(i + 1, updatedIdx + 1).setValue(now);
          if (updatedByIdx >= 0) sheet.getRange(i + 1, updatedByIdx + 1).setValue(safeText(adminUser));
          // Update fullName jika belum diisi dengan benar
          if (fnIdx >= 0 && fullNameMap[u]) {
            const existingFn = String(data[i][fnIdx] || '').replace(/^'+/, '').trim();
            if (!existingFn || existingFn === u) {
              sheet.getRange(i + 1, fnIdx + 1).setValue(safeText(fullNameMap[u]));
            }
          }
          delete userMap[u];
        }
      }
      
      for (const u in userMap) {
        const rawUsername = userMap[u];
        const resolvedFullName = fullNameMap[normalizeUsername(rawUsername)] || normalizeUsername(rawUsername);
        const newRow = h.map(col => {
          if (col === 'username') return safeText(rawUsername);
          if (col === 'fullName') return safeText(resolvedFullName);
          if (col === 'created_at') return now;
          if (col === 'updated_at') return now;
          if (col === 'updated_by') return safeText(adminUser);
          if (col === 'can_view_override') return valStr;
          if (col === 'can_download_override') return valStr;
          return '';
        });
        sheet.appendRow(newRow);
      }
      
      SpreadsheetApp.flush();
      logActivity(adminUser, 'SAVE_ALUMNI_IJAZAH_ACCESS_MASSAL', 
        'Atur akses ijazah massal (' + usernames.length + ' siswa): Akses=' + grantAccess);
      return { success: true };
    } finally { lock.releaseLock(); }
  } catch(e) { throw new Error('saveAlumniIjazahAccessMassal: ' + e.toString()); }
}
function getIjazahFolderSetting() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings');
    if (!sheet) return { folderId: null, folderUrl: null, folderName: null };
    const data = sheet.getDataRange().getValues();
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0]).trim() === 'Ijazah_Folder_Id') {
        const raw = String(data[i][1] || '').trim();
        if (!raw) return { folderId: null, folderUrl: null, folderName: null };
        const folderId = extractDriveFolderId(raw);
        if (!folderId) return { folderId: null, folderUrl: null, folderName: null };
        try {
          const folder = DriveApp.getFolderById(folderId);
          return {
            folderId  : folderId,
            folderUrl : folder.getUrl(),
            folderName: folder.getName()
          };
        } catch(e) {
          return { folderId: folderId, folderUrl: null, folderName: null, error: 'Folder tidak ditemukan atau tidak dapat diakses' };
        }
      }
    }
    return { folderId: null, folderUrl: null, folderName: null };
  } catch(e) {
    throw new Error('getIjazahFolderSetting: ' + e.toString());
  }
}
function saveIjazahFolderSetting(folderIdOrUrl, adminUser) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings');
    if (!sheet) throw new Error('Sheet Settings tidak ditemukan');
    const raw = String(folderIdOrUrl || '').trim();
    if (!raw) throw new Error('Folder ID atau URL tidak boleh kosong');
    const folderId = extractDriveFolderId(raw);
    if (!folderId) throw new Error('Format Folder ID atau URL tidak valid');
    let folderName;
    try {
      const folder = DriveApp.getFolderById(folderId);
      folderName = folder.getName();
    } catch(e) {
      throw new Error('Folder tidak ditemukan atau tidak dapat diakses. Pastikan folder sudah dibagikan ke akun ini.');
    }
    const data = sheet.getDataRange().getValues();
    let rowIdx = -1;
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0]).trim() === 'Ijazah_Folder_Id') { rowIdx = i + 1; break; }
    }
    if (rowIdx === -1) {
      sheet.appendRow(['Ijazah_Folder_Id', folderId]);
    } else {
      sheet.getRange(rowIdx, 2).setValue(folderId);
    }
    SpreadsheetApp.flush();
    logActivity(adminUser, 'SAVE_IJAZAH_FOLDER', 'Mengatur folder ijazah: ' + folderName + ' (' + folderId + ')');
    return { success: true, folderId: folderId, folderName: folderName };
  } catch(e) {
    throw new Error(e.message || e.toString());
  }
}
function extractDriveFolderId(input) {
  if (!input) return null;
  const s = String(input).trim();
  if (/^[-\w]{25,}$/.test(s)) return s;
  const m = s.match(/\/folders\/([\w-]{25,})/);
  if (m) return m[1];
  const m2 = s.match(/[-\w]{25,}/);
  return m2 ? m2[0] : null;
}
function ensureIjazahSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Ijazah');
  const REQUIRED_HEADERS = [
    'username','fullName','kelas_lulus','tahun_lulus',
    'nomor_ijazah','tanggal_ijazah','kepala_sekolah','nip_kepala_sekolah',
    'nilai_rata_rata','predikat',
    'nomor_transkrip','tanggal_transkrip',
    'nomor_skl','tanggal_skl','keterangan_skl',
    'IJAZAH_FileName','IJAZAH_FileUrl',
    'TRANSKRIP_FileName','TRANSKRIP_FileUrl',
    'SKL_FileName','SKL_FileUrl',
    'can_view_override','can_download_override',
    'created_at','updated_at','updated_by'
  ];
  if (!sheet) {
    sheet = ss.insertSheet('Ijazah');
    sheet.getRange(1, 1, 1, REQUIRED_HEADERS.length).setValues([REQUIRED_HEADERS]);
    sheet.getRange(1, 1, 1, REQUIRED_HEADERS.length).setFontWeight('bold');
  } else {
    const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const missing = REQUIRED_HEADERS.filter(h => !existingHeaders.includes(h));
    if (missing.length > 0) {
      const nextCol = sheet.getLastColumn() + 1;
      missing.forEach((header, idx) => {
        const col = nextCol + idx;
        sheet.getRange(1, col).setValue(header).setFontWeight('bold');
      });
      SpreadsheetApp.flush();
    }
  }
  return sheet;
}
function getAlumniListForIjazah() {
  try {
    const userSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
    if (!userSheet) return [];
    const data = userSheet.getDataRange().getValues();
    const result = [];
    for (let i = 1; i < data.length; i++) {
      const role = String(data[i][3] || '').trim();
      if (role === 'Alumni') {
        result.push({
          username : data[i][1],
          fullName : data[i][7] || data[i][1],
          kelas    : 'LULUS'
        });
      }
    }
    return result;
  } catch(e) {
    throw new Error('getAlumniListForIjazah: ' + e.toString());
  }
}
function getIjazahData(username) {
  try {
    ensureIjazahSheet();
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Ijazah');
    const data  = sheet.getDataRange().getValues();
    const h     = data[0];
    const uIdx  = h.indexOf('username');
    const target = normalizeUsername(username);
    for (let i = 1; i < data.length; i++) {
      if (normalizeUsername(data[i][uIdx]) === target) {
        const row = {};
        h.forEach((col, ci) => {
          const v = data[i][ci];
          if (v instanceof Date) {
            row[col] = !isNaN(v) ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd') : '';
          } else {
            row[col] = (v !== null && v !== undefined) ? String(v).replace(/^\'+/, '').trim() : '';
          }
        });
        return row;
      }
    }
    return null;
  } catch(e) {
    throw new Error('getIjazahData: ' + e.toString());
  }
}
function getAllIjazahData() {
  try {
    ensureIjazahSheet();
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Ijazah');
    const data  = sheet.getDataRange().getValues();
    if (data.length < 2) return {};
    const h      = data[0];
    const uIdx   = h.indexOf('username');
    const result = {};
    for (let i = 1; i < data.length; i++) {
      const uname = normalizeUsername(data[i][uIdx]);
      if (!uname) continue;
      const row = {};
      h.forEach((col, ci) => {
        const v = data[i][ci];
        if (v instanceof Date) {
          row[col] = !isNaN(v) ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd') : '';
        } else {
          row[col] = (v !== null && v !== undefined) ? String(v).replace(/^\'+/, '').trim() : '';
        }
      });
      result[uname] = row;
    }
    return result;
  } catch(e) {
    throw new Error('getAllIjazahData: ' + e.toString());
  }
}
function getIjazahByUsername(username) {
  return getIjazahData(username);
}
function normalizeUsername(val) {
  return String(val || '').replace(/^'+/, '').trim();
}
function getOrCreateIjazahRow(username, fullName, adminUser) {
  ensureIjazahSheet();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Ijazah');
  const data  = sheet.getDataRange().getValues();
  const h     = data[0];
  const uIdx  = h.indexOf('username');
  const safeUname = normalizeUsername(username);
  for (let i = 1; i < data.length; i++) {
    if (normalizeUsername(data[i][uIdx]) === safeUname) {
      return { sheet, data, h, rowIndex: i + 1 };
    }
  }
  const now    = new Date();
  const newRow = h.map(col => {
    if (col === 'username')   return safeText(username);
    if (col === 'fullName')   return safeText(fullName || username);
    if (col === 'created_at') return now;
    if (col === 'updated_at') return now;
    if (col === 'updated_by') return safeText(adminUser);
    return '';
  });
  sheet.appendRow(newRow);
  SpreadsheetApp.flush();
  const data2 = sheet.getDataRange().getValues();
  for (let i = 1; i < data2.length; i++) {
    if (normalizeUsername(data2[i][uIdx]) === safeUname) {
      return { sheet, data: data2, h, rowIndex: i + 1 };
    }
  }
  throw new Error('Gagal membuat baris ijazah untuk: ' + username);
}
function saveIjazahData(payload, adminUser) {
  try {
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      const { sheet, data, h, rowIndex } = getOrCreateIjazahRow(
        payload.username, payload.fullName, adminUser
      );
      const now    = new Date();
      const fields = {
        username          : safeText(payload.username),
        fullName          : safeText(payload.fullName || ''),
        kelas_lulus       : payload.kelas_lulus       || '',
        tahun_lulus       : payload.tahun_lulus        || '',
        nomor_ijazah      : payload.nomor_ijazah       || '',
        tanggal_ijazah    : payload.tanggal_ijazah     || '',
        kepala_sekolah    : payload.kepala_sekolah     || '',
        nip_kepala_sekolah: payload.nip_kepala_sekolah || '',
        nilai_rata_rata   : payload.nilai_rata_rata    || '',
        predikat          : payload.predikat           || '',
        nomor_transkrip   : payload.nomor_transkrip    || '',
        tanggal_transkrip : payload.tanggal_transkrip  || '',
        nomor_skl         : payload.nomor_skl          || '',
        tanggal_skl       : payload.tanggal_skl        || '',
        keterangan_skl    : payload.keterangan_skl     || '',
        updated_at        : now,
        updated_by        : safeText(adminUser)
      };
      h.forEach((col, ci) => {
        if (fields[col] !== undefined) {
          sheet.getRange(rowIndex, ci + 1).setValue(fields[col]);
        }
      });
      SpreadsheetApp.flush();
      logActivity(adminUser, 'SAVE_IJAZAH', 'Simpan data ijazah untuk: ' + payload.username);
      return { success: true };
    } finally {
      lock.releaseLock();
    }
  } catch(e) {
    throw new Error('saveIjazahData: ' + e.toString());
  }
}
function uploadIjazahDocument(username, docType, base64File, fileName, fullName, adminUser) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    let folder;
    const folderSetting = getIjazahFolderSetting();
    if (folderSetting.folderId) {
      try { folder = DriveApp.getFolderById(folderSetting.folderId); } catch(e) { folder = null; }
    }
    if (!folder) {
      const folderName = 'Dokumen Ijazah';
      const folders    = DriveApp.getFoldersByName(folderName);
      folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
    }
    const ext      = fileName.split('.').pop().toLowerCase();
    const safeName = (fullName || username).replace(/[^a-zA-Z0-9\s]/g, '_').replace(/\s+/g, '_');
    const newFileName = safeName + '_' + docType + '_' + new Date().getTime() + '.' + ext;
    const blob = Utilities.newBlob(Utilities.base64Decode(base64File), 'application/pdf', newFileName);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const fileUrl = file.getUrl();
    const { sheet, data, h, rowIndex } = getOrCreateIjazahRow(username, fullName, adminUser);
    const fnCol = h.indexOf(docType + '_FileName');
    const fuCol = h.indexOf(docType + '_FileUrl');
    const oldUrl = data[rowIndex - 1][fuCol];
    if (oldUrl) {
      const oldId = extractDriveFileId(String(oldUrl));
      if (oldId) { try { DriveApp.getFileById(oldId).setTrashed(true); } catch(e2) {} }
    }
    sheet.getRange(rowIndex, fnCol + 1).setValue(newFileName);
    sheet.getRange(rowIndex, fuCol + 1).setValue(fileUrl);
    sheet.getRange(rowIndex, h.indexOf('username')   + 1).setValue(safeText(username));
    sheet.getRange(rowIndex, h.indexOf('fullName')   + 1).setValue(safeText(fullName || username));
    sheet.getRange(rowIndex, h.indexOf('updated_at') + 1).setValue(new Date());
    sheet.getRange(rowIndex, h.indexOf('updated_by') + 1).setValue(safeText(adminUser));
    SpreadsheetApp.flush();
    logActivity(adminUser, 'UPLOAD_IJAZAH_DOC', 'Upload dokumen ' + docType + ' untuk: ' + username);
    return { success: true, fileUrl: fileUrl, fileName: newFileName };
  } catch(e) {
    throw new Error('uploadIjazahDocument: ' + e.toString());
  } finally {
    lock.releaseLock();
  }
}
function deleteIjazahDocument(username, docType, adminUser) {
  try {
    ensureIjazahSheet();
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Ijazah');
    const data  = sheet.getDataRange().getValues();
    const h = data[0];
    const uIdx = h.indexOf('username');
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][uIdx]).trim() === String(username).trim()) {
        const fuCol = h.indexOf(docType + '_FileUrl');
        const fnCol = h.indexOf(docType + '_FileName');
        const oldUrl = data[i][fuCol];
        if (oldUrl) {
          const oldId = extractDriveFileId(oldUrl);
          if (oldId) { try { DriveApp.getFileById(oldId).setTrashed(true); } catch(e) {} }
        }
        sheet.getRange(i + 1, fnCol + 1).setValue('');
        sheet.getRange(i + 1, fuCol + 1).setValue('');
        sheet.getRange(i + 1, h.indexOf('updated_at') + 1).setValue(new Date());
        sheet.getRange(i + 1, h.indexOf('updated_by') + 1).setValue(adminUser);
        SpreadsheetApp.flush();
        logActivity(adminUser, 'DELETE_IJAZAH_DOC', 'Hapus dokumen ' + docType + ' untuk: ' + username);
        return { success: true };
      }
    }
    return { success: false, message: 'Data tidak ditemukan' };
  } catch(e) {
    throw new Error('deleteIjazahDocument: ' + e.toString());
  }
}
function getDocumentForDownload(fileUrl) {
  try {
    const fileId = extractDriveFileId(fileUrl || '');
    if (!fileId) throw new Error('File ID tidak valid');
    const file = DriveApp.getFileById(fileId);
    const blob = file.getBlob();
    return {
      base64   : Utilities.base64Encode(blob.getBytes()),
      mimeType : blob.getContentType() || 'application/pdf',
      fileName : file.getName()
    };
  } catch(e) {
    throw new Error('getDocumentForDownload: ' + e.toString());
  }
}
function extractDriveFileId(url) {
  const match = url.match(/[-\w]{25,}/);
  return match ? match[0] : null;
}
function getDocumentBase64(fileId) {
  try {
    if (!fileId) return null;
    const file = DriveApp.getFileById(fileId);
    if (!file) return null;
    const blob = file.getBlob();
    return Utilities.base64Encode(blob.getBytes());
  } catch (e) {
    // Lempar error agar frontend bisa menampilkan pesan yang tepat
    throw new Error('Gagal mengambil file PDF: ' + e.toString());
  }
}
function hashAnswer(answer) {
  if (!answer) return '';
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, answer, Utilities.Charset.UTF_8);
  return Utilities.base64Encode(digest);
}
function updateSecurityQuestion(username, question, answer) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (_cmpUsername(data[i][1], username)) {
        sheet.getRange(i + 1, 12).setValue(question);
        sheet.getRange(i + 1, 13).setValue(hashAnswer(answer));
        logActivity(username, 'UPDATE_SECURITY_QUESTION', 'User memperbarui pertanyaan keamanan');
        return { success: true };
      }
    }
    throw new Error("User tidak ditemukan.");
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}
function getSecurityQuestion(username) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (_cmpUsername(data[i][1], username)) {
      const question = data[i][11] || '';
      return { success: true, question: question };
    }
  }
  return { success: false, message: "Username tidak ditemukan." };
}
function requestUserReset(username, answer) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (_cmpUsername(data[i][1], username)) {
        rowIndex = i;
        break;
      }
    }
    if (rowIndex === -1) {
      return { success: false, message: "Username tidak ditemukan." };
    }
    const storedHash = data[rowIndex][12] || '';
    if (!storedHash) {
      return { success: false, message: "Anda belum mengatur pertanyaan keamanan. Silakan hubungi admin." };
    }
    const inputHash = hashAnswer(answer);
    if (storedHash !== inputHash) {
      return { success: false, message: "Jawaban pertanyaan keamanan salah." };
    }
    sheet.getRange(rowIndex + 1, 6).setValue(true);
    SpreadsheetApp.flush();
    logActivity(username, 'REQUEST_RESET', 'User meminta reset password dengan verifikasi keamanan');
    return { success: true };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}
function selfResetPassword(username, newPassword) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
    const data  = sheet.getDataRange().getValues();
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (_cmpUsername(data[i][1], username)) {
        rowIndex = i;
        break;
      }
    }
    if (rowIndex === -1) return { success: false, message: 'Username tidak ditemukan.' };
    sheet.getRange(rowIndex + 1, 3).setValue(newPassword);
    sheet.getRange(rowIndex + 1, 6).setValue(false);
    const sessionSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sessions');
    if (sessionSheet && sessionSheet.getLastRow() > 1) {
      const sessionData = sessionSheet.getDataRange().getValues();
      for (let j = sessionData.length - 1; j >= 1; j--) {
        if (_cmpUsername(sessionData[j][1], username)) {
          sessionSheet.deleteRow(j + 1);
        }
      }
    }
    SpreadsheetApp.flush();
    logActivity(username, 'SELF_RESET_PASSWORD', 'User mereset password sendiri melalui verifikasi keamanan');
    return { success: true };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}
function requestUserResetSesi(username, answer) {
  const lock = LockService.getScriptLock();
  try {
    const userSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
    const userData = userSheet.getDataRange().getValues();
    let userExists = false;
    let rowIndex = -1;
    for (let i = 1; i < userData.length; i++) {
      if (userData[i][1] == username) {
        userExists = true;
        rowIndex = i;
        break;
      }
    }
    if (!userExists) {
      return { success: false, message: "Username tidak ditemukan." };
    }
    const storedHash = userData[rowIndex][12] || '';
    if (!storedHash) {
      return { success: false, message: "Anda belum mengatur pertanyaan keamanan. Silakan hubungi admin." };
    }
    const inputHash = hashAnswer(answer);
    if (storedHash !== inputHash) {
      return { success: false, message: "Jawaban pertanyaan keamanan salah." };
    }
    const sessionSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sessions');
    const sessionData = sessionSheet.getDataRange().getValues();
    const now = new Date();
    let hasActiveSession = false;
    for (let i = 1; i < sessionData.length; i++) {
      if (sessionData[i][1] == username && new Date(sessionData[i][2]) > now) {
        hasActiveSession = true;
        break;
      }
    }
    if (!hasActiveSession) {
      return { success: false, message: "Anda tidak memiliki sesi aktif saat ini." };
    }
    userSheet.getRange(rowIndex + 1, 10).setValue(true);
    logActivity(username, 'REQUEST_RESET_SESI', 'User meminta reset sesi dengan verifikasi keamanan');
    return { success: true };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}
function getActiveSessionInfo(username) {
  try {
    const timeZone = Session.getScriptTimeZone();
    const sessionSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sessions');
    if (!sessionSheet || sessionSheet.getLastRow() < 2) {
      return { success: true, count: 0, sessions: [] };
    }
    const sessionData = sessionSheet.getDataRange().getValues();
    const now = new Date();
    const activeSessions = [];
    for (let i = 1; i < sessionData.length; i++) {
      const row = sessionData[i];
      if (String(row[1]).trim() !== String(username).trim()) continue;
      const expiry = new Date(row[2]);
      if (expiry <= now) continue;
      const createdAt = row[3] ? Utilities.formatDate(new Date(row[3]), timeZone, "dd MMM yyyy, HH:mm") : '-';
      const expiryStr = Utilities.formatDate(expiry, timeZone, "dd MMM yyyy, HH:mm");
      activeSessions.push({
        createdAt : createdAt,
        expiry    : expiryStr,
        device    : row[4] || 'Perangkat tidak diketahui'
      });
    }
    return { success: true, count: activeSessions.length, sessions: activeSessions };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}
function selfResetSesi(username) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const userSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
    const userData  = userSheet.getDataRange().getValues();
    let rowIndex = -1;
    for (let i = 1; i < userData.length; i++) {
      if (String(userData[i][1]).trim() === String(username).trim()) {
        rowIndex = i; break;
      }
    }
    if (rowIndex === -1) return { success: false, message: 'Username tidak ditemukan.' };
    const sessionSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sessions');
    let deletedCount = 0;
    if (sessionSheet && sessionSheet.getLastRow() > 1) {
      const sessionData = sessionSheet.getDataRange().getValues();
      for (let j = sessionData.length - 1; j >= 1; j--) {
        if (String(sessionData[j][1]).trim() === String(username).trim()) {
          sessionSheet.deleteRow(j + 1);
          deletedCount++;
        }
      }
    }
    userSheet.getRange(rowIndex + 1, 10).setValue(false);
    SpreadsheetApp.flush();
    logActivity(username, 'SELF_RESET_SESI', `User mereset sesi sendiri (${deletedCount} sesi dihapus)`);
    return { success: true, deletedCount: deletedCount };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}
function verifySecurityAnswer(username, answer) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] == username) {
      const storedHash = data[i][12] || '';
      if (!storedHash) return { success: false, message: "Pertanyaan keamanan belum diatur." };
      const inputHash = hashAnswer(answer);
      return { success: true, valid: (storedHash === inputHash) };
    }
  }
  return { success: false, message: "Username tidak ditemukan." };
}
function getNasabahList() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  data.shift();
  return data
    .filter(row => {
      const role = row[3];
      const aksesTabungan = row[13] === true;
      return role === 'Nasabah' || (role === 'Guru' && aksesTabungan);
    })
    .map(row => ({
      username: plainText(row[1]),
      nama: String(row[7] || '').replace(/^'+/, '') || plainText(row[1]),
      role: row[3]
    }))
    .sort((a, b) => a.nama.localeCompare(b.nama));
}
function getGuruMapelKelas(username) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const schedSheet = ss.getSheetByName('Schedules');
  if (!schedSheet) return [];
  const data = schedSheet.getDataRange().getValues();
  data.shift();
  const result = [];
  const seen = new Set();
  const getFullName = (uname) => {
    const userSheet = ss.getSheetByName('Users');
    const userData = userSheet.getDataRange().getValues();
    for (let i = 1; i < userData.length; i++) {
      if (userData[i][1] == uname) return userData[i][7] || uname;
    }
    return uname;
  };
  const fullName = getFullName(username);
  data.forEach(row => {
    if (row[2] !== 'Pelajaran') return;
    try {
      const detail = JSON.parse(row[5] || '{}');
      if (detail.guru === username || detail.guru === fullName) {
        const key = row[1] + '|' + detail.mapel;
        if (!seen.has(key)) {
          seen.add(key);
          result.push({ kelas: row[1], mapel: detail.mapel });
        }
      }
    } catch (e) {
    }
  });
  return result;
}
function saveNilaiBatch(nilaiList, guruUsername, kkmSaatIni) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Nilai');
    if (!sheet) {
      sheet = ss.insertSheet('Nilai');
      sheet.appendRow(['ID', 'Tanggal', 'Guru', 'Kelas', 'Mapel', 'Tipe', 'Username', 'Nama', 'Nilai', 'Keterangan', 'KKM']);
    } else {
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      if (headers.length < 11 || headers[10] !== 'KKM') {
        sheet.getRange(1, 11).setValue('KKM');
      }
    }
    const userSheet = ss.getSheetByName('Users');
    const userData = userSheet.getDataRange().getValues();
    let guruNama = guruUsername;
    for (let i = 1; i < userData.length; i++) {
      if (userData[i][1] == guruUsername) {
        guruNama = userData[i][7] || guruUsername;
        break;
      }
    }
    const data = sheet.getDataRange().getValues();
    const rows = data.slice(1);
    function getSemester(tanggalStr) {
      const d = new Date(tanggalStr);
      if (isNaN(d.getTime())) return { semester: -1, tahun: -1 };
      const bulan = d.getMonth() + 1;
      const tahunData = d.getFullYear();
      if (bulan >= 7) {
        return { semester: 1, tahun: tahunData };
      } else {
        return { semester: 2, tahun: tahunData - 1 };
      }
    }

    const hasPH = nilaiList.some(item => item.tipe === 'PH');
    let phNumber = 0;
    if (hasPH) {
      const first = nilaiList[0];
      const mapelVal = first.mapel;
      const kelasVal = first.kelas;
      let maxNumber = 0;
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (row[2] === guruNama && row[4] === mapelVal && row[3] === kelasVal && String(row[5]).startsWith('PH-')) {
          const parts = row[5].split('-');
          if (parts.length > 1) {
            const num = parseInt(parts[1], 10);
            if (!isNaN(num) && num > maxNumber) maxNumber = num;
          }
        }
      }
      phNumber = maxNumber + 1;
    }

    const safeText = (val) => val ? "'" + val : '';
    const rowsToAdd = [];
    const rowsToUpdate = [];

    for (let i = 0; i < nilaiList.length; i++) {
      const item = nilaiList[i];
      let tipe = item.tipe;
      let isDuplicate = false;
      let existingRowIdx = -1;
      let existingId = null;

      if (tipe === 'ATS' || tipe === 'ASAS' || tipe === 'Praktik') {
        const { semester, tahun } = getSemester(item.tanggal);
        for (let j = 0; j < rows.length; j++) {
          const row = rows[j];
          if (row[5] === tipe && row[4] === item.mapel && row[3] === item.kelas && _cmpUsername(row[6], item.username)) {
            const existingSemester = getSemester(row[1]);
            if (existingSemester.semester === semester && existingSemester.tahun === tahun) {
              isDuplicate = true;
              existingRowIdx = j + 2;
              existingId = row[0];
              break;
            }
          }
        }
      }

      if (tipe === 'PH' && phNumber > 0) {
        tipe = 'PH-' + phNumber;
      }

      if (isDuplicate) {
        rowsToUpdate.push({
          row: existingRowIdx,
          data: [
            existingId,
            item.tanggal,
            guruNama,
            item.kelas,
            item.mapel,
            tipe,
            safeText(item.username),
            item.nama,
            item.nilai,
            item.keterangan || '',
            kkmSaatIni
          ]
        });
      } else {
        rowsToAdd.push([
          Utilities.getUuid(),
          item.tanggal,
          guruNama,
          item.kelas,
          item.mapel,
          tipe,
          safeText(item.username),
          item.nama,
          item.nilai,
          item.keterangan || '',
          kkmSaatIni
        ]);
      }
    }

    if (rowsToAdd.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAdd.length, rowsToAdd[0].length).setValues(rowsToAdd);
    }
    
    for (let i = 0; i < rowsToUpdate.length; i++) {
      sheet.getRange(rowsToUpdate[i].row, 1, 1, rowsToUpdate[i].data.length).setValues([rowsToUpdate[i].data]);
    }

    logActivity(guruUsername, 'CREATE_NILAI', `Menyimpan ${nilaiList.length} data nilai (${rowsToAdd.length} baru, ${rowsToUpdate.length} diupdate)`);
    return { success: true };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}
function getRiwayatNilai(guru, mapel, kelas, tipe, phNumber) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Nilai');
    if (!sheet || sheet.getLastRow() < 2) return [];
    const data = sheet.getDataRange().getValues();
    data.shift();
    return data
      .filter(row => {
        if (guru && row[2] !== guru) return false;
        if (mapel && row[4] !== mapel) return false;
        if (kelas && row[3] !== kelas) return false;
        const tipeCell = String(row[5] || '').trim();
        if (tipe) {
          if (tipe === 'PH') {
            if (phNumber) {
              const targetTipe = 'PH-' + String(phNumber).trim();
              if (tipeCell !== targetTipe) return false;
            } else {
              if (!tipeCell.startsWith('PH')) return false;
            }
          } else {
            if (tipeCell !== tipe) return false;
          }
        }
        return true;
      })
      .map(row => {
        let tanggalStr = null;
        if (row[1]) {
          try {
            const d = new Date(row[1]);
            if (!isNaN(d.getTime())) tanggalStr = d.toISOString();
          } catch (e) {
          }
        }
        const rawUsername = row[6] != null ? row[6].toString() : '';
        const cleanUsername = rawUsername.replace(/^'/, '').replace(/\.0$/, '');
        return {
          id: row[0],
          tanggal: tanggalStr,
          guru: row[2],
          kelas: row[3],
          mapel: row[4],
          tipe: row[5],
          username: cleanUsername,
          nama: row[7] || '',
          nilai: row[8],
          keterangan: row[9] || '',
          kkm: row[10] ? parseFloat(row[10]) : 75
        };
      })
      .reverse();
  } catch (e) {
    return [];
  }
}
function deleteNilai(id, guru) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    if (!id) throw new Error('ID nilai kosong.');
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Nilai');
    if (!sheet) throw new Error('Sheet Nilai tidak ditemukan.');
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) {
        sheet.deleteRow(i + 1);
        logActivity(guru, 'DELETE_NILAI', `Menghapus nilai ID: ${id}`);
        return { success: true };
      }
    }
    throw new Error('Data tidak ditemukan');
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}
function updateNilai(id, payload, guru) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    if (!id) throw new Error('ID nilai kosong.');
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Nilai');
    if (!sheet) throw new Error('Sheet Nilai tidak ditemukan.');
    ensureNilaiSheetHasKKM();
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) {
        const existingKKM = data[i][10] || 75;
        const nilaiNum = parseFloat(payload.nilai);
        if (isNaN(nilaiNum) || nilaiNum < 0 || nilaiNum > 100) {
          throw new Error('Nilai harus antara 0–100.');
        }
        const ket = nilaiNum < existingKKM ? 'Remedial' : 'Tuntas';
        sheet.getRange(i + 1, 2, 1, 10).setValues([[
          payload.tanggal,
          guru,
          payload.kelas,
          payload.mapel,
          payload.tipe,
          safeText(String(payload.username || '').trim()),
          payload.nama,
          nilaiNum,
          ket,
          existingKKM
        ]]);
        logActivity(guru, 'UPDATE_NILAI', `Mengupdate nilai ID: ${id}`);
        return { success: true };
      }
    }
    throw new Error('Data tidak ditemukan');
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}
function getRekapNilai(guru, mapel, kelas, tahun, semester) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Nilai');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  data.shift();
  const { start, end } = getSemesterDateRange(tahun, semester);
  const filtered = data.filter(row => {
    if (guru && row[2] !== guru) return false;
    if (row[4] !== mapel) return false;
    if (row[3] !== kelas) return false;
    const tgl = new Date(row[1]);
    if (isNaN(tgl.getTime())) return false;
    return tgl >= start && tgl <= end;
  });
  const siswaMap = {};
  filtered.forEach(row => {
    const rawUsername = String(row[6] == null ? '' : row[6]).replace(/^'/, '');
    const username = rawUsername.replace(/\.0$/, '').trim();
    if (!username) return;
    const nama = row[7];
    const tipe = row[5];
    const nilai = parseFloat(row[8]) || 0;
    const numKey = parseFloat(username);
    const key = (!isNaN(numKey) && isFinite(numKey)) ? String(numKey) : username;
    if (!siswaMap[key]) {
      siswaMap[key] = {
        username: username,
        nama: nama,
        ph: [],
        ats: null,
        asas: null,
        praktik: null
      };
    }
    if (String(tipe).startsWith('PH')) {
      siswaMap[key].ph.push(nilai);
    } else if (tipe === 'ATS') {
      siswaMap[key].ats = nilai;
    } else if (tipe === 'ASAS') {
      siswaMap[key].asas = nilai;
    } else if (tipe === 'Praktik') {
      siswaMap[key].praktik = nilai;
    }
  });
  const kkm = getKKMByPeriode(kelas, mapel, tahun, semester);
  const result = [];
  for (let key in siswaMap) {
    const s = siswaMap[key];
    const rataPH = s.ph.length ? (s.ph.reduce((a, b) => a + b, 0) / s.ph.length) : 0;
    const ats = s.ats || 0;
    const asas = s.asas || 0;
    const praktik = s.praktik || 0;
    const nilaiRapor = ((2 * rataPH) + (3 * ats) + (5 * asas)) / 10;
    const nilaiRaporFixed = Math.round(nilaiRapor * 100) / 100;
    let predikat = '';
    if (nilaiRaporFixed < kkm) {
      predikat = 'D';
    } else {
      const interval = (100 - kkm) / 3;
      if (nilaiRaporFixed >= kkm + 2 * interval) {
        predikat = 'A';
      } else if (nilaiRaporFixed >= kkm + interval) {
        predikat = 'B';
      } else {
        predikat = 'C';
      }
    }
    result.push({
      username: s.username,
      nama: s.nama,
      kelas: kelas,
      rataPH: rataPH.toFixed(2),
      ats: ats.toFixed(2),
      asas: asas.toFixed(2),
      praktik: praktik.toFixed(2),
      nilaiRapor: nilaiRaporFixed.toFixed(2),
      predikat: predikat
    });
  }
  result.sort((a, b) => a.nama.localeCompare(b.nama));
  return result;
}
function getDistinctPHNumbers(guru, mapel, kelas) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Nilai');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  data.shift();
  const numbers = new Set();
  data.forEach(row => {
    if (guru && row[2] !== guru) return;
    if (mapel && row[4] !== mapel) return;
    if (kelas && row[3] !== kelas) return;
    const tipe = String(row[5] || '').trim();
    if (tipe.startsWith('PH-')) {
      const parts = tipe.split('-');
      if (parts.length > 1) {
        const num = parts[1];
        if (num && !isNaN(num)) numbers.add(parseInt(num, 10));
      }
    }
  });
  return Array.from(numbers).sort((a, b) => a - b);
}
function getNilaiSiswa(username) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Nilai');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  data.shift();
  const cleanUsername = (raw) => {
    if (!raw) return '';
    return raw.toString().replace(/^'/, '').replace(/\.0$/, '');
  };
  return data
    .filter(row => cleanUsername(row[6]) === cleanUsername(username))
    .map(row => {
      let tanggalStr = null;
      if (row[1]) {
        try {
          const d = new Date(row[1]);
          if (!isNaN(d.getTime())) tanggalStr = d.toISOString();
        } catch (e) {
        }
      }
      return {
        id: row[0],
        tanggal: tanggalStr,
        guru: row[2] ? String(row[2]) : '',
        kelas: row[3] ? String(row[3]) : '',
        mapel: row[4] ? String(row[4]) : '',
        tipe: row[5] ? String(row[5]) : '',
        nilai: (row[8] !== '' && row[8] !== null && row[8] !== undefined) ? row[8] : null,
        keterangan: row[9] || '',
        kkm: row[10] ? parseFloat(row[10]) : 75
      };
    })
    .reverse();
}
function getKKM(kelas, mapel, tahun, semester) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('KKM');
  if (!sheet) return 75;
  const data = sheet.getDataRange().getValues();
  if (tahun && semester) {
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] == kelas && data[i][2] == mapel &&
          data[i][4] == tahun && data[i][5] == semester) {
        const kkm = parseFloat(data[i][3]);
        return isNaN(kkm) ? 75 : kkm;
      }
    }
  }
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] == kelas && data[i][2] == mapel) {
      const kkm = parseFloat(data[i][3]);
      return isNaN(kkm) ? 75 : kkm;
    }
  }
  return 75;
}
function saveKKM(kelas, mapel, kkm, user, tgl) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('KKM');
    if (!sheet) {
      sheet = ss.insertSheet('KKM');
      sheet.appendRow(['ID', 'Kelas', 'Mapel', 'KKM', 'Tahun', 'Semester']);
    }
    const targetDate = tgl ? new Date(tgl) : new Date();
    const { tahun, semester } = getTahunSemester(targetDate);
    const data = sheet.getDataRange().getValues();
    let foundRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] == kelas && data[i][2] == mapel && data[i][4] == tahun && data[i][5] == semester) {
        foundRow = i + 1;
        break;
      }
    }
    if (foundRow === -1) {
      const id = Utilities.getUuid();
      sheet.appendRow([id, kelas, mapel, kkm, tahun, semester]);
    } else {
      sheet.getRange(foundRow, 4).setValue(kkm);
    }
    const nilaiSheet = ss.getSheetByName('Nilai');
    if (nilaiSheet && nilaiSheet.getLastRow() > 1) {
      const nilaiData = nilaiSheet.getDataRange().getValues();
      const outValues = [];
      let changed = false;
      for (let i = 1; i < nilaiData.length; i++) {
        const row = nilaiData[i];
        let val = row[10];
        if (row[3] == kelas && row[4] == mapel) {
          const tglCell = row[1];
          if (tglCell) {
            let tglVal;
            if (tglCell instanceof Date) {
              tglVal = tglCell;
            } else if (typeof tglCell === 'number') {
              tglVal = new Date((tglCell - 25569) * 86400 * 1000);
            } else {
              tglVal = new Date(tglCell);
            }
            if (!isNaN(tglVal.getTime())) {
              const { tahun: rowTahun, semester: rowSemester } = getTahunSemester(tglVal);
              if (rowTahun === tahun && rowSemester === semester) {
                val = kkm;
                changed = true;
              }
            }
          }
        }
        outValues.push([val]);
      }
      if (changed) {
        nilaiSheet.getRange(2, 11, outValues.length, 1).setValues(outValues);
      }
    }
    logActivity(user, 'SAVE_KKM', `Menyimpan KKM ${mapel} kelas ${kelas} semester ${semester} tahun ${tahun}: ${kkm}`);
    return { success: true };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}
function getKKMByPeriode(kelas, mapel, tahun, semester) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('KKM');
  if (!sheet || sheet.getLastRow() < 2) return 75;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] == kelas && data[i][2] == mapel && data[i][4] == tahun && data[i][5] == semester) {
      const kkm = parseFloat(data[i][3]);
      return isNaN(kkm) ? 75 : kkm;
    }
  }
  return 75;
}
function getAllKKM() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('KKM');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  data.shift();
  return data.map(row => ({
    id      : row[0],
    kelas   : row[1],
    mapel   : row[2],
    kkm     : parseFloat(row[3]) || 75,
    tahun   : row[4] !== undefined && row[4] !== '' ? parseInt(row[4]) : null,
    semester: row[5] !== undefined && row[5] !== '' ? parseInt(row[5]) : null
  }));
}
function ensureNilaiSheetHasKKM() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Nilai');
  if (!sheet) {
    sheet = ss.insertSheet('Nilai');
    sheet.appendRow(['ID', 'Tanggal', 'Guru', 'Kelas', 'Mapel', 'Tipe', 'Username', 'Nama', 'Nilai', 'Keterangan', 'KKM']);
  } else {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (headers.length < 11 || headers[10] !== 'KKM') {
      sheet.getRange(1, 11).setValue('KKM');
    }
  }
}
function getSemesterDateRange(tahun, semester) {
  if (semester == 1) {
    return {
      start: new Date(tahun, 6, 1),
      end  : new Date(tahun, 11, 31, 23, 59, 59)
    };
  } else {
    return {
      start: new Date(tahun + 1, 0, 1),
      end  : new Date(tahun + 1, 5, 30, 23, 59, 59)
    };
  }
}
function getTahunSemester(tanggal) {
  const d = new Date(tanggal);
  const tahun = d.getFullYear();
  const bulan = d.getMonth() + 1;
  if (bulan >= 7) {
    return { tahun: tahun, semester: 1 };
  } else {
    return { tahun: tahun - 1, semester: 2 };
  }
}
function getRaportSiswa(username, tahun, semester, jenis) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const nilaiSheet = ss.getSheetByName('Nilai');
  const userSheet = ss.getSheetByName('Users');
  let kelasSiswa = '';
  const users = userSheet.getDataRange().getValues();
  for (let i = 1; i < users.length; i++) {
    if (_cmpUsername(users[i][1], username)) {
      kelasSiswa = users[i][6] || '';
      break;
    }
  }
  if (!kelasSiswa) return [];
  const nilaiData = nilaiSheet.getDataRange().getValues();
  const mapelMap = {};
  for (let i = 1; i < nilaiData.length; i++) {
    const row = nilaiData[i];
    if (!_cmpUsername(row[6], username)) continue;
    const tglCell = row[1];
    if (!tglCell) continue;
    let tgl;
    if (tglCell instanceof Date) {
      tgl = tglCell;
    } else if (typeof tglCell === 'number') {
      tgl = new Date((tglCell - 25569) * 86400 * 1000);
    } else {
      tgl = new Date(tglCell);
    }
    if (isNaN(tgl.getTime())) continue;
    const rowTahun = tgl.getFullYear();
    const rowBulan = tgl.getMonth() + 1;
    if (semester == 1) {
      if (rowTahun !== tahun) continue;
      if (rowBulan < 7 || rowBulan > 12) continue;
    } else {
      if (rowTahun !== tahun + 1) continue;
      if (rowBulan < 1 || rowBulan > 6) continue;
    }
    const tipe = String(row[5] || '').trim();
    if (tipe !== jenis) continue;
    const mapel = row[4];
    const nilai = parseFloat(row[8]) || 0;
    const kkm = parseFloat(row[10]) || 75;
    mapelMap[mapel] = { nilai: nilai, kkm: kkm };
  }
  const hasil = [];
  for (let mapel in mapelMap) {
    const item = mapelMap[mapel];
    const kkm = item.kkm;
    const nilai = item.nilai;
    let predikat = '';
    if (nilai < kkm) {
      predikat = 'D';
    } else {
      const interval = (100 - kkm) / 3;
      if (nilai >= kkm + 2 * interval) {
        predikat = 'A';
      } else if (nilai >= kkm + interval) {
        predikat = 'B';
      } else {
        predikat = 'C';
      }
    }
    hasil.push({
      mapel: mapel,
      kkm: kkm,
      nilai: nilai,
      predikat: predikat
    });
  }
  const urutanMapel = [
    'Al Quran Hadis', 'Akidah Akhlak', 'Fikih', 'SKI', 'Bahasa Arab',
    'Pend. Pancasila', 'Bahasa Indonesia', 'Matematika', 'IPA', 'IPS',
    'Bahasa Inggris', 'Informatika', 'PJOK', 'Seni Budaya', 'BTQ', 'KKA'
  ];
  hasil.sort((a, b) => {
    const idxA = urutanMapel.indexOf(a.mapel);
    const idxB = urutanMapel.indexOf(b.mapel);
    if (idxA === -1 && idxB === -1) return a.mapel.localeCompare(b.mapel);
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  });
  return hasil;
}
function getAnakList(usernameOrtu) {
  try {
    const ss          = SpreadsheetApp.getActiveSpreadsheet();
    const detailSheet = ss.getSheetByName('SiswaDetail');
    const userSheet   = ss.getSheetByName('Users');
    if (!detailSheet || !userSheet) return { success: false, message: 'Sheet tidak ditemukan.', anak: [] };
    const detailData = detailSheet.getDataRange().getValues();
    const detailHeaders = detailData[0];
    const ortuColIdx = detailHeaders.indexOf('Username_Ortu');
    if (ortuColIdx < 0) return { success: true, anak: [] };
    const userData = userSheet.getDataRange().getValues();
    const userMap = {};
    for (let i = 1; i < userData.length; i++) {
      // Bersihkan prefix ' dari safeText dan spasi ekstra
      const rawUsername = String(userData[i][1] == null ? '' : userData[i][1]).replace(/^'+/, '').replace(/\.0$/, '').trim();
      if (!rawUsername) continue;
      userMap[rawUsername] = {
        fullName : String(userData[i][7] || '').trim() || rawUsername,
        kelas    : userData[i][6] || '-',
        role     : userData[i][3] || ''
      };
    }
    const anakList = [];
    for (let i = 1; i < detailData.length; i++) {
      const row     = detailData[i];
      const ortuVal = String(row[ortuColIdx] || '').trim();
      const ortuArr = ortuVal.split(',').map(s => s.replace(/^'+/, '').replace(/\.0$/, '').trim()).filter(Boolean);
      if (!ortuArr.some(o => _cmpUsername(o, usernameOrtu))) continue;
      const usernameAnak = String(row[0] || '').replace(/^'+/, '').replace(/\.0$/, '').trim();
      if (!usernameAnak) continue;
      const uData = userMap[usernameAnak] || {};
      anakList.push({
        username  : usernameAnak,
        fullName  : uData.fullName || row[detailHeaders.indexOf('NIK')] || usernameAnak,
        kelas     : uData.kelas   || '-',
        namaAyah  : row[detailHeaders.indexOf('AyahNama')] || '-',
        namaIbu   : row[detailHeaders.indexOf('IbuNama')]  || '-',
      });
    }
    return { success: true, anak: anakList };
  } catch (e) {
    return { success: false, message: e.toString(), anak: [] };
  }
}
function getOrangtuaDashboard(usernameOrtu) {
  try {
    const anakRes = getAnakList(usernameOrtu);
    if (!anakRes.success) return { success: false, message: anakRes.message };
    const anakList = anakRes.anak;
    if (!anakList.length) return { success: true, anak: [] };

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const tz = Session.getScriptTimeZone();
    const todayStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');

    // Build set username untuk filter cepat
    const anakUsernames = anakList.map(a => String(a.username));
    const anakSet = {};
    anakUsernames.forEach(u => { anakSet[u] = true; });

    const cleanUsername = (raw) => {
      if (raw === null || raw === undefined) return '';
      return String(raw).replace(/^'/, '').replace(/\.0$/, '');
    };

    // ── SINGLE-PASS Attendance: hari ini per anak ──────────────────────
    const todayAtt = {}; // { username: status }
    const attSheet = ss.getSheetByName('Attendance');
    if (attSheet && attSheet.getLastRow() > 1) {
      const ad = attSheet.getDataRange().getValues();
      ad.shift();
      for (let i = 0; i < ad.length; i++) {
        const r = ad[i];
        const un = cleanUsername(r[3]);
        if (!anakSet[un]) continue;
        if (todayAtt[un]) continue; // sudah ditemukan
        const tgl = r[1];
        let tglStr = '';
        if (tgl instanceof Date)            tglStr = Utilities.formatDate(tgl, tz, 'yyyy-MM-dd');
        else if (typeof tgl === 'number')   tglStr = Utilities.formatDate(excelSerialToDate(tgl), tz, 'yyyy-MM-dd');
        else if (tgl) { const d = new Date(tgl); if (!isNaN(d)) tglStr = Utilities.formatDate(d, tz, 'yyyy-MM-dd'); }
        if (tglStr === todayStr) todayAtt[un] = r[5] || '-';
      }
    }

    // ── SINGLE-PASS Savings: saldo per anak ────────────────────────────
    const saldo = {}; // { username: number }
    anakUsernames.forEach(u => { saldo[u] = 0; });
    const svSheet = ss.getSheetByName('Savings');
    if (svSheet && svSheet.getLastRow() > 1) {
      const sd = svSheet.getDataRange().getValues();
      sd.shift();
      // Sheet Savings: id(0), tanggal(1), namaSiswa(2), username(3), kelas(4),
      // jenis(5), jumlah(6), ket(7), pencatat(8). Username ada di kolom 3.
      sd.forEach(r => {
        const un = cleanUsername(r[3]);
        if (!anakSet[un]) return;
        const jenis = r[5];
        const jumlah = parseFloat(r[6]) || 0;
        if (jenis === 'Setor') saldo[un] += jumlah;
        else if (jenis === 'Tarik') saldo[un] -= jumlah;
      });
    }

    // ── SINGLE-PASS Nilai: nilai terbaru per anak ─────────────────────
    const nilaiTerbaru = {}; // { username: 'mapel: nilai' }
    const nilaiSheet = ss.getSheetByName('Nilai');
    if (nilaiSheet && nilaiSheet.getLastRow() > 1) {
      const nd = nilaiSheet.getDataRange().getValues();
      nd.shift();
      // Cari row terakhir per anak (data tidak pasti sorted, jadi ambil
      // yang tanggalnya terbaru).
      const lastByUser = {};
      for (let i = 0; i < nd.length; i++) {
        const r = nd[i];
        const un = cleanUsername(r[6]);
        if (!anakSet[un]) continue;
        const tgl = r[1] instanceof Date ? r[1] : (r[1] ? new Date(r[1]) : null);
        const tglMs = (tgl && !isNaN(tgl.getTime())) ? tgl.getTime() : 0;
        if (!lastByUser[un] || tglMs >= lastByUser[un].ms) {
          lastByUser[un] = { ms: tglMs, mapel: r[4], nilai: r[8] };
        }
      }
      Object.keys(lastByUser).forEach(un => {
        const last = lastByUser[un];
        if (last && last.mapel != null && last.nilai != null) {
          nilaiTerbaru[un] = last.mapel + ': ' + last.nilai;
        }
      });
    }

    const ringkasan = anakList.map(anak => {
      const un = String(anak.username);
      return {
        username        : anak.username,
        fullName        : anak.fullName,
        kelas           : anak.kelas,
        kehadiranHariIni: todayAtt[un] || '-',
        saldoTabungan   : saldo[un] || 0,
        nilaiTerbaru    : nilaiTerbaru[un] || '-'
      };
    });
    return { success: true, anak: ringkasan };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}
function verifyAnakRelasi(usernameOrtu, usernameAnak) {
  try {
    const anakRes = getAnakList(usernameOrtu);
    if (!anakRes.success) return false;
    return anakRes.anak.some(a => _cmpUsername(a.username, usernameAnak));
  } catch(e) { return false; }
}
function getNilaiAnak(usernameOrtu, usernameAnak) {
  if (!verifyAnakRelasi(usernameOrtu, usernameAnak)) {
    return { success: false, message: 'Akses ditolak.' };
  }
  try {
    const data = getNilaiSiswa(usernameAnak);
    return { success: true, data: data };
  } catch(e) { return { success: false, message: e.toString() }; }
}
function getKehadiranAnak(usernameOrtu, usernameAnak) {
  if (!verifyAnakRelasi(usernameOrtu, usernameAnak)) {
    return { success: false, message: 'Akses ditolak.' };
  }
  try {
    const data = getAttendanceSiswa(usernameAnak);
    return { success: true, data: data };
  } catch(e) { return { success: false, message: e.toString() }; }
}
function getTabunganAnak(usernameOrtu, usernameAnak) {
  if (!verifyAnakRelasi(usernameOrtu, usernameAnak)) {
    return { success: false, message: 'Akses ditolak.' };
  }
  try {
    const data = getSavingsSiswa(usernameAnak);
    return { success: true, data: data };
  } catch(e) { return { success: false, message: e.toString() }; }
}
function getIuranAnak(usernameOrtu, usernameAnak) {
  if (!verifyAnakRelasi(usernameOrtu, usernameAnak)) {
    return { success: false, message: 'Akses ditolak.' };
  }
  try {
    const riwayat = getIuranSiswa(usernameAnak);
    const rekap   = getIuranRecapSiswa(usernameAnak);
    return { success: true, riwayat: riwayat, rekap: rekap };
  } catch(e) { return { success: false, message: e.toString() }; }
}
function formatTanggalSPK(d, tampilkanHari, tampilkanWaktu) {
  if (!d) d = new Date();
  const ZONA_WIB   = 'Asia/Jakarta';
  const NAMA_BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const NAMA_HARI  = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const opsi = { timeZone: ZONA_WIB, year: 'numeric', month: '2-digit', day: '2-digit',
                 hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
  const parts = new Intl.DateTimeFormat('id-ID', opsi).formatToParts(d);
  const get = (type) => parts.find(p => p.type === type)?.value || '0';
  const dd = get('day').padStart(2,'0');
  const bulan = parseInt(get('month')) - 1;
  const yyyy = get('year');
  const hh = get('hour').padStart(2,'0');
  const mm = get('minute').padStart(2,'0');
  const ss = get('second').padStart(2,'0');
  const tglWIB = new Date(d.toLocaleString('en-US', { timeZone: ZONA_WIB }));
  const namaHari = NAMA_HARI[tglWIB.getDay()];
  let hasil = '';
  if (tampilkanHari) hasil += namaHari + ', ';
  hasil += dd + ' ' + NAMA_BULAN[bulan] + ' ' + yyyy;
  if (tampilkanWaktu) hasil += ' | ' + hh + ':' + mm + ':' + ss + ' WIB';
  return hasil;
}
function getBulanSPK(d) {
  if (!d) d = new Date();
  const ZONA_WIB = 'Asia/Jakarta';
  const tglWIB = new Date(d.toLocaleString('en-US', { timeZone: ZONA_WIB }));
  const yyyy = tglWIB.getFullYear();
  const mm = String(tglWIB.getMonth() + 1).padStart(2, '0');
  return yyyy + '-' + mm;
}
function _normalizeBulanSPK(val) {
  if (val instanceof Date && !isNaN(val)) {
    const ZONA_WIB = 'Asia/Jakarta';
    const w = new Date(val.toLocaleString('en-US', { timeZone: ZONA_WIB }));
    const y = w.getFullYear();
    const m = String(w.getMonth() + 1).padStart(2, '0');
    return y + '-' + m;
  }
  const s = plainText(val).trim();
  // Normalisasi string tanggal lengkap (yyyy-MM-dd atau yyyy-MM-ddT...) ke yyyy-MM
  const m = s.match(/^(\d{4})-(\d{2})/);
  return m ? (m[1] + '-' + m[2]) : s;
}
function _parseSaldoSPK(val, defaultSaldo) {
  if (val === '' || val === null || val === undefined) return defaultSaldo;
  const n = parseFloat(val);
  return isNaN(n) ? defaultSaldo : n;
}

// Helper aman untuk mengubah string 'yyyy-MM' menjadi label bulan Indonesia.
// Mengembalikan string kosong jika format tidak valid.
function _bulanLabel(bulan) {
  if (!bulan || typeof bulan !== 'string') return '';
  const parts = bulan.split('-');
  if (parts.length < 2) return bulan;
  const BULAN_LABEL = ['Januari','Februari','Maret','April','Mei','Juni',
                       'Juli','Agustus','September','Oktober','November','Desember'];
  const idx = parseInt(parts[1]) - 1;
  if (isNaN(idx) || idx < 0 || idx > 11) return bulan;
  return BULAN_LABEL[idx] + ' ' + parts[0];
}
function hitungLevel(saldo) {
  if (saldo >= 51) return 0;
  if (saldo >= 31) return 1;
  if (saldo >= 21) return 2;
  if (saldo >= 11) return 3;
  if (saldo >= 1)  return 4;
  return 5;
}
function initSheetsSPK() {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const cache = CacheService.getScriptCache();
    const sudahDibuat = cache.get('spk_sheets_created') === 'true';
    let katalogSheet = ss.getSheetByName('PoinKatalog');
    if (!katalogSheet) {
      katalogSheet = ss.insertSheet('PoinKatalog');
      katalogSheet.appendRow(['kodeID','kategori','deskripsi','poin','konsekuensiTambahan','statusAktif','createdBy','createdAt','lastEditedBy','lastEditedAt']);
    }
    if (katalogSheet.getLastRow() <= 1) {
      const defaultKatalog = [
        ['A01','Kehadiran','Terlambat datang ke sekolah < 15 menit',-2,'',true,'admin',new Date(),'',''],
        ['A02','Kehadiran','Terlambat datang ke sekolah 15–30 menit',-4,'',true,'admin',new Date(),'',''],
        ['A03','Kehadiran','Terlambat datang ke sekolah > 30 menit',-6,'',true,'admin',new Date(),'',''],
        ['A04','Kehadiran','Tidak hadir tanpa keterangan (Alpha)',-8,'',true,'admin',new Date(),'',''],
        ['B01','Penampilan','Tidak memakai seragam lengkap/sesuai',-3,'',true,'admin',new Date(),'',''],
        ['B02','Penampilan','Rambut panjang / tidak rapi (putra)',-3,'',true,'admin',new Date(),'',''],
        ['B03','Penampilan','Memakai aksesoris dilarang (gelang, kalung)',-2,'',true,'admin',new Date(),'',''],
        ['C01','Etika','Berkata kasar/tidak sopan kepada guru/teman',-5,'',true,'admin',new Date(),'',''],
        ['C02','Etika','Membully atau mengintimidasi teman',-10,'Wajib Restitusi Sosial',true,'admin',new Date(),'',''],
        ['C03','Etika','Tidak mengerjakan tugas/PR tanpa alasan',-3,'',true,'admin',new Date(),'',''],
        ['C04','Etika','Membawa/menggunakan HP saat KBM',-5,'Wajib serahkan HP ke Wali Kelas',true,'admin',new Date(),'',''],
        ['D01','Kebersihan','Membuang sampah sembarangan',-2,'',true,'admin',new Date(),'',''],
        ['D02','Kebersihan','Merusak fasilitas/sarana sekolah',-8,'Wajib Restitusi Fisik',true,'admin',new Date(),'',''],
        ['E01','Keamanan','Berkelahi atau terlibat perkelahian',-15,'Panggilan Wali + Pernyataan Tertulis',true,'admin',new Date(),'',''],
        ['E02','Keamanan','Membawa benda tajam/berbahaya',-10,'Konfiskasi Barang',true,'admin',new Date(),'',''],
        ['F01','Prestasi Akademik','Peringkat 1–3 di kelas',5,'',true,'admin',new Date(),'',''],
        ['F02','Prestasi Akademik','Nilai sempurna (100) pada ulangan',3,'',true,'admin',new Date(),'',''],
        ['G01','Prestasi Non-Akademik','Memenangkan perlombaan tingkat sekolah',5,'',true,'admin',new Date(),'',''],
        ['G02','Prestasi Non-Akademik','Memenangkan perlombaan tingkat Kab/Kota',8,'',true,'admin',new Date(),'',''],
        ['H01','Kontribusi','Memimpin kegiatan ekstra/OSIS',3,'',true,'admin',new Date(),'',''],
        ['H02','Kontribusi','Aktif membantu kegiatan madrasah',2,'',true,'admin',new Date(),'',''],
        ['I01','Perilaku Baik','Melaporkan pelanggaran teman secara jujur',2,'',true,'admin',new Date(),'',''],
        ['I02','Perilaku Baik','Membantu teman yang kesulitan belajar',2,'',true,'admin',new Date(),'',''],
        ['I03','Perilaku Baik','Tidak pernah terlambat selama 1 bulan',3,'',true,'admin',new Date(),'',''],
        ['I04','Perilaku Baik','Hafal surat pendek tambahan / prestasi Al-Quran',4,'',true,'admin',new Date(),'',''],
      ];
      katalogSheet.getRange(2, 1, defaultKatalog.length, defaultKatalog[0].length)
                  .setValues(defaultKatalog);
    }
    if (!sudahDibuat) {
      if (!ss.getSheetByName('PoinEvent')) {
        const s = ss.insertSheet('PoinEvent');
        s.appendRow(['id','tanggal','username','kelas','kodeID','poinDasar','pengaliResidivis','efekR03','poinFinal','saldoSebelum','saldoSesudah','keterangan','dicatatOleh','timestampInput','statusEvent','logAudit']);
      }
      if (!ss.getSheetByName('PoinSaldo')) {
        const s = ss.insertSheet('PoinSaldo');
        s.appendRow(['username','bulan','saldoAktif','totalPelanggaran','totalKebaikan','levelKonsekuensi','flagR03','flagPanggilanWali','updateTerakhir']);
      }
      if (!ss.getSheetByName('PoinResetLog')) {
        const s = ss.insertSheet('PoinResetLog');
        s.appendRow(['periodeAkhir','username','saldoAkhir','levelAkhir','flagSPAktif','timestampReset']);
      }
      if (!ss.getSheetByName('PoinNotifikasi')) {
        const s = ss.insertSheet('PoinNotifikasi');
        s.appendRow(['id','targetUsername','tipe','pesan','sudahDibaca','timestamp']);
      }
      cache.put('spk_sheets_created', 'true', 21600);
    }
    return { success: true, message: 'Sheet SPK berhasil diinisialisasi.' };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
function getPoinKatalog(termasukNonaktif) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('PoinKatalog');
    if (!sheet || sheet.getLastRow() < 2) {
      initSheetsSPK();
      SpreadsheetApp.flush();
      sheet = ss.getSheetByName('PoinKatalog');
    }
    if (!sheet || sheet.getLastRow() < 2) return { success: true, data: [], debug: 'sheet kosong' };
    const data = sheet.getDataRange().getValues();
    if (!data || data.length < 2) return { success: true, data: [], debug: 'tidak ada baris data' };
    const headerRow = data[0].map(h => String(h || '').trim());
    const idx = {};
    headerRow.forEach((h, j) => { idx[h.toLowerCase()] = j; });
    const col = (name) => (name in idx ? idx[name] : -1);
    const cKode    = col('kodeid');
    const cKat     = col('kategori');
    const cDesk    = col('deskripsi');
    const cPoin    = col('poin');
    const cKonseq  = col('konsekuensitambahan');
    const cStatus  = col('statusaktif');
    if (cKode < 0) {
      return { success: false, message: 'Header kolom "kodeID" tidak ditemukan di sheet PoinKatalog. Header saat ini: [' + headerRow.join(', ') + ']' };
    }
    const includeNonaktif = (termasukNonaktif === true || termasukNonaktif === 'true');
    const rows = [];
    for (let i = 1; i < data.length; i++) {
      const r = data[i];
      const kode = String(r[cKode] != null ? r[cKode] : '').trim();
      if (!kode) continue;
      const statusRaw = cStatus >= 0 ? r[cStatus] : true;
      const aktif = (statusRaw === true || String(statusRaw).toUpperCase() === 'TRUE');
      rows.push({
        kodeID:              kode,
        kategori:            cKat   >= 0 ? String(r[cKat]   || '').trim() : '',
        deskripsi:           cDesk  >= 0 ? String(r[cDesk]  || '').trim() : '',
        poin:                cPoin  >= 0 ? (parseFloat(r[cPoin]) || 0)    : 0,
        konsekuensiTambahan: cKonseq>= 0 ? String(r[cKonseq] || '').trim(): '',
        statusAktif:         aktif,
        _rowIndex:           i + 1
      });
    }
    const result = includeNonaktif ? rows : rows.filter(r => r.statusAktif === true);
    return { success: true, data: result, total: rows.length, aktif: result.length };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
function savePoinKatalog(data, adminUser) {
  try {
    initSheetsSPK();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('PoinKatalog');
    const allData = sheet.getDataRange().getValues();
    for (let i = 1; i < allData.length; i++) {
      if (String(allData[i][0]).toUpperCase() === String(data.kodeID).toUpperCase() &&
          (!data._rowIndex || data._rowIndex !== (i + 1))) {
        return { success: false, message: 'Kode ID "' + data.kodeID + '" sudah digunakan. Pilih kode ID yang berbeda.' };
      }
    }
    const now = formatTanggalSPK(new Date(), true, true);
    const row = [
      String(data.kodeID).toUpperCase(), data.kategori, data.deskripsi,
      parseFloat(data.poin), data.konsekuensiTambahan || '',
      data.statusAktif !== false, adminUser, '', adminUser, now
    ];
    if (data._rowIndex) {
      const existing = allData[data._rowIndex - 1];
      row[6] = existing[6];
      row[7] = existing[7];
      sheet.getRange(data._rowIndex, 1, 1, row.length).setValues([row]);
      logActivity(adminUser, 'EDIT_POIN_KATALOG', 'Mengedit katalog kode: ' + data.kodeID);
    } else {
      row[7] = now;
      row[8] = '';
      row[9] = '';
      sheet.appendRow([
        String(data.kodeID).toUpperCase(), data.kategori, data.deskripsi,
        parseFloat(data.poin), data.konsekuensiTambahan || '',
        data.statusAktif !== false, adminUser, now, '', ''
      ]);
      logActivity(adminUser, 'CREATE_POIN_KATALOG', 'Menambah katalog kode: ' + data.kodeID);
    }
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
function deletePoinKatalog(kodeID, adminUser) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('PoinKatalog');
    if (!sheet) return { success: false, message: 'Sheet PoinKatalog tidak ditemukan.' };
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).toUpperCase() === String(kodeID).toUpperCase()) {
        sheet.getRange(i + 1, 6).setValue(false);
        sheet.getRange(i + 1, 9).setValue(adminUser);
        sheet.getRange(i + 1, 10).setValue(formatTanggalSPK(new Date(), true, true));
        logActivity(adminUser, 'DEACTIVATE_POIN_KATALOG', 'Menonaktifkan katalog kode: ' + kodeID);
        return { success: true };
      }
    }
    return { success: false, message: 'Kode tidak ditemukan.' };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
function cekResidivis(username, kodeID, bulan) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('PoinEvent');
    if (!sheet || sheet.getLastRow() < 2) return { success: true, count: 0, pengali: 1, efekR03: false };
    const data = sheet.getDataRange().getValues();
    let count = 0;
    for (let i = 1; i < data.length; i++) {
      if (data[i][14] === 'dibatalkan') continue;
      const rowKode     = String(data[i][4]).trim();
      const rowTanggal  = data[i][1];
      let rowBulan = '';
      if (rowTanggal) {
        const d = rowTanggal instanceof Date ? rowTanggal : new Date(rowTanggal);
        if (!isNaN(d)) rowBulan = getBulanSPK(d);
      }
      if (_cmpUsername(data[i][2], username) && rowKode === String(kodeID).toUpperCase() && rowBulan === bulan) {
        count++;
      }
    }
    let pengali = 1;
    let efekR03 = false;
    if (count === 1) pengali = 2;
    else if (count === 2) pengali = 3;
    else if (count >= 3) efekR03 = true;
    return { success: true, count: count, pengali: pengali, efekR03: efekR03 };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
function recalculateSaldoSiswa(username, bulan) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const eventSheet = ss.getSheetByName('PoinEvent');
  const saldoSheet = ss.getSheetByName('PoinSaldo');

  // Guard: jika salah satu sheet tidak ada, tidak bisa menghitung
  if (!eventSheet || !saldoSheet) return { saldo: 50, level: 1 };

  const eventData = eventSheet.getDataRange().getValues();
  
  let saldo = 50;
  let totalPelanggaran = 0;
  let totalKebaikan = 0;
  let flagR03 = false;
  let flagPanggilanWali = false;
  
  const kodeCountMap = {};
  const kategoriPelanggaran = ['A','B','C','D','E'];
  const userEvents = [];
  
  for (let i = 1; i < eventData.length; i++) {
    const row = eventData[i];
    if (row[14] === 'dibatalkan') continue;
    const rowTanggal = row[1];
    let rowBulan = '';
    let d = null;
    if (rowTanggal) {
      d = rowTanggal instanceof Date ? rowTanggal : new Date(rowTanggal);
      if (!isNaN(d)) rowBulan = getBulanSPK(d);
    }
    if (!_cmpUsername(row[2], username) || rowBulan !== bulan) continue;
    
    userEvents.push({
      date: d ? d.getTime() : 0,
      index: i,
      rowIdx: i + 1,
      row: row
    });
  }
  
  // Urutkan kronologis, fallback ke urutan insert (index)
  userEvents.sort((a, b) => {
    if (a.date !== b.date) return a.date - b.date;
    return a.index - b.index;
  });
  
  const updates = [];
  
  for (let i = 0; i < userEvents.length; i++) {
    const item = userEvents[i];
    const row = item.row;
    const kodeID = String(row[4]).toUpperCase().trim();
    const poinDasar = parseFloat(row[5]) || 0;
    
    let pengali = 1;
    let efekR03 = false;
    
    if (poinDasar < 0 && kodeID && kategoriPelanggaran.includes(kodeID[0])) {
      kodeCountMap[kodeID] = (kodeCountMap[kodeID] || 0) + 1;
      const count = kodeCountMap[kodeID];
      if (count === 1) pengali = 1;
      else if (count === 2) pengali = 2;
      else if (count === 3) pengali = 3;
      else if (count >= 4) efekR03 = true;
    }
    
    const poinFinal = efekR03 ? 0 : (poinDasar * pengali);
    const saldoSebelum = saldo;
    let saldoSesudah;
    
    if (efekR03) {
      saldoSesudah = 0;
      flagR03 = true;
    } else {
      saldoSesudah = Math.min(100, Math.max(-50, saldoSebelum + poinFinal));
    }
    
    if (pengali >= 3) flagPanggilanWali = true;
    if (poinFinal < 0) totalPelanggaran++;
    else if (poinFinal > 0) totalKebaikan++;
    
    if (pengali !== (parseInt(row[6]) || 1) || 
        efekR03 !== (row[7] === true || row[7] === 'TRUE') ||
        poinFinal !== (parseFloat(row[8]) || 0) ||
        saldoSebelum !== (parseFloat(row[9]) || 0) ||
        saldoSesudah !== (parseFloat(row[10]) || 0)) {
        
        updates.push({
          rowIdx: item.rowIdx,
          pengali: pengali,
          efekR03: efekR03,
          poinFinal: poinFinal,
          saldoSebelum: saldoSebelum,
          saldoSesudah: saldoSesudah
        });
    }
    
    saldo = saldoSesudah;
  }
  
  if (updates.length > 0) {
    updates.forEach(u => {
      eventSheet.getRange(u.rowIdx, 7, 1, 5).setValues([[
        u.pengali, u.efekR03, u.poinFinal, u.saldoSebelum, u.saldoSesudah
      ]]);
    });
  }
  
  saldo = Math.min(100, Math.max(-50, saldo));
  const level = hitungLevel(saldo);
  const saldoData = saldoSheet.getDataRange().getValues();
  const matchedRows = [];
  for (let i = 1; i < saldoData.length; i++) {
    if (!_cmpUsername(saldoData[i][0], username)) continue;
    if (_normalizeBulanSPK(saldoData[i][1]) !== bulan) continue;
    matchedRows.push(i + 1); 
  }
  
  if (matchedRows.length > 0) {
    const targetRow = matchedRows[matchedRows.length - 1];
    saldoSheet.getRange(targetRow, 1, 1, 9).setValues([[
      safeText(username), safeText(bulan), saldo, totalPelanggaran, totalKebaikan,
      level, flagR03, flagPanggilanWali, new Date()
    ]]);
    for (let j = 0; j < matchedRows.length - 1; j++) {
      const dupRow = matchedRows[j];
      saldoSheet.getRange(dupRow, 1, 1, 2).setValues([[
        safeText('_dup_' + plainText(saldoData[dupRow - 1][0])),
        ''
      ]]);
    }
  } else {
    saldoSheet.appendRow([safeText(username), safeText(bulan), saldo, totalPelanggaran, totalKebaikan, level, flagR03, flagPanggilanWali, new Date()]);
  }
  return { saldo: saldo, level: level };
}
function kirimNotifikasiSPK(targetUsername, tipe, pesan) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('PoinNotifikasi');
    if (!sheet) return;
    const id = 'notif_' + Utilities.getUuid().replace(/-/g,'').substring(0,12);
    sheet.appendRow([id, safeText(targetUsername), tipe, pesan, false, new Date()]);
  } catch(e) {}
}
function savePoinEvent(eventData, pencatat) {
  const lock = LockService.getScriptLock();
  let lockAcquired = false;
  try {
    try {
      lock.waitLock(5000);
      lockAcquired = true;
    } catch (lockErr) {
      return { success: false, message: 'Sistem sedang sibuk, silakan coba lagi sebentar.' };
    }
    initSheetsSPK();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const eventSheet = ss.getSheetByName('PoinEvent');
    const userSheet  = ss.getSheetByName('Users');
    if (!eventSheet) throw new Error('Sheet PoinEvent tidak ditemukan. Jalankan initSheetsSPK() terlebih dahulu.');
    const username   = String(eventData.username || '').trim();
    const kodeID     = String(eventData.kodeID || '').toUpperCase().trim();
    const tanggal    = eventData.tanggal || Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
    const katalogRes = getPoinKatalog(true);
    if (!katalogRes.success) throw new Error('Gagal memuat katalog kode.');
    const kodeObj = katalogRes.data.find(k => k.kodeID === kodeID);
    if (!kodeObj) throw new Error('Kode ' + kodeID + ' tidak ditemukan di katalog.');
    if (!kodeObj.statusAktif) throw new Error('Kode ' + kodeID + ' sudah tidak aktif.');
    const poinDasar = parseFloat(kodeObj.poin);
    const bulan = getBulanSPK(new Date(tanggal));
    const kelas = eventData.kelas || '';
    const kategoriPelanggaran = ['A','B','C','D','E'];
    const ispelanggaran = poinDasar < 0 && kategoriPelanggaran.includes(kodeID[0]);
    let pengali = 1;
    let efekR03 = false;
    if (ispelanggaran) {
      const res = cekResidivis(username, kodeID, bulan);
      pengali = res.pengali;
      efekR03 = res.efekR03;
    }
    const poinFinal = efekR03 ? 0 : (poinDasar * pengali);
    const saldoRes = getPoinSiswa(username, bulan);
    const saldoSebelum = saldoRes.saldo;
    let saldoSesudah;
    if (efekR03) {
      saldoSesudah = 0;
    } else {
      saldoSesudah = Math.min(100, Math.max(-50, saldoSebelum + poinFinal));
    }
    const id = 'evt_' + Utilities.getUuid().replace(/-/g,'').substring(0,16);
    const now = new Date();
    eventSheet.appendRow([
      id, tanggal, safeText(username), kelas, kodeID,
      poinDasar, pengali, efekR03, poinFinal,
      saldoSebelum, saldoSesudah,
      eventData.keterangan || '',
      safeText(pencatat), now, 'original', '[]'
    ]);
    const updated = recalculateSaldoSiswa(username, bulan);
    const levelBaru = updated.level;
    if (levelBaru >= 2 && poinDasar < 0) {
      const labelLevel = ['Baik/Teladan','Perlu Perhatian','Waspada','Berbahaya','Kritis','Darurat/DO'];
      const pesan = `Poin ${eventData.namaLengkap || username} (${kelas}) turun ke ${updated.saldo} poin — Tingkat ${levelBaru} (${labelLevel[levelBaru]}).`;
      kirimNotifikasiSPK(username, 'poin_turun', pesan);
      if (userSheet) {
        const users = userSheet.getDataRange().getValues();
        for (let i = 1; i < users.length; i++) {
          const tugas = String(users[i][4] || '');
          if (tugas.includes('Guru BK')) {
            kirimNotifikasiSPK(String(users[i][1]), 'poin_bk', pesan);
          }
        }
      }
      const classSheet = ss.getSheetByName('Classes');
      if (classSheet && classSheet.getLastRow() >= 2) {
        const classData = classSheet.getDataRange().getValues();
        for (let i = 1; i < classData.length; i++) {
          if (String(classData[i][2] || '').trim() === kelas) {
            const waliUsername = String(classData[i][3] || '').trim();
            if (waliUsername) kirimNotifikasiSPK(waliUsername, 'poin_kelas', pesan);
            break;
          }
        }
      }
      try {
        const detailSheet = ss.getSheetByName('SiswaDetail');
        if (detailSheet) {
          const detailData = detailSheet.getDataRange().getValues();
          const headers = detailData[0];
          const ortuIdx = headers.indexOf('Username_Ortu');
          if (ortuIdx >= 0) {
            for (let i = 1; i < detailData.length; i++) {
              if (String(detailData[i][0]).trim() === username) {
                const ortuList = String(detailData[i][ortuIdx] || '').split(',').map(s => s.trim()).filter(Boolean);
                ortuList.forEach(ortu => kirimNotifikasiSPK(ortu, 'poin_anak', pesan));
                break;
              }
            }
          }
        }
      } catch(e) {}
      if (levelBaru >= 3) {
        kirimNotifikasiSPK('admin', 'poin_kritis', pesan);
      }
    }
    if (efekR03) {
      const pesanR03 = `[RESIDIVIS R03] ${eventData.namaLengkap || username}: Saldo direset ke 0 karena pelanggaran kode ${kodeID} ke-4 kali di bulan ini.`;
      kirimNotifikasiSPK(username, 'residivis_r03', pesanR03);
      kirimNotifikasiSPK('admin', 'residivis_r03', pesanR03);
    } else if (pengali >= 3) {
      const pesanR02 = `[RESIDIVIS R02] ${eventData.namaLengkap || username}: Pelanggaran kode ${kodeID} ke-3 kali. Panggilan Wali Murid diperlukan.`;
      kirimNotifikasiSPK('admin', 'residivis_r02', pesanR02);
    }
    logActivity(pencatat, 'SAVE_POIN_EVENT', `Mencatat poin event ${kodeID} untuk siswa: ${username}`);
    return { success: true, id: id, saldoBaru: updated.saldo, levelBaru: levelBaru, pengali: pengali, efekR03: efekR03 };
  } catch (e) {
    return { success: false, message: e.message };
  } finally {
    if (lockAcquired) {
      try { lock.releaseLock(); } catch (_e) {}
    }
  }
}
function deletePoinEvent(id, pencatat) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const eventSheet = ss.getSheetByName('PoinEvent');
    if (!eventSheet) return { success: false, message: 'Sheet PoinEvent tidak ditemukan.' };
    const data = eventSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) {
        eventSheet.getRange(i+1, 15).setValue('dibatalkan');
        const username = plainText(data[i][2]).trim();
        const tanggal  = data[i][1];
        const d = tanggal instanceof Date ? tanggal : new Date(tanggal);
        const bulan = getBulanSPK(d);
        recalculateSaldoSiswa(username, bulan);
        logActivity(pencatat, 'DELETE_POIN_EVENT', 'Membatalkan event poin ID: ' + id);
        return { success: true };
      }
    }
    return { success: false, message: 'Event tidak ditemukan.' };
  } catch(e) {
    return { success: false, message: e.message };
  }
}
function getPoinSiswa(username, bulan) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!bulan) bulan = getBulanSPK();
    const saldoSheet = ss.getSheetByName('PoinSaldo');
    let saldo = 50, level = 1, totalPelanggaran = 0, totalKebaikan = 0, flagR03 = false, flagPanggilanWali = false;
    if (saldoSheet && saldoSheet.getLastRow() >= 2) {
      const saldoData = saldoSheet.getDataRange().getValues();
      for (let i = 1; i < saldoData.length; i++) {
        if (_cmpUsername(saldoData[i][0], username) && _normalizeBulanSPK(saldoData[i][1]) === bulan) {
          saldo = _parseSaldoSPK(saldoData[i][2], 50);
          totalPelanggaran = parseInt(saldoData[i][3]) || 0;
          totalKebaikan    = parseInt(saldoData[i][4]) || 0;
          level            = parseInt(saldoData[i][5]) || 0;
          flagR03          = saldoData[i][6] === true;
          flagPanggilanWali= saldoData[i][7] === true;
        }
      }
    }
    const eventSheet = ss.getSheetByName('PoinEvent');
    let events = [];
    if (eventSheet && eventSheet.getLastRow() >= 2) {
      const eventData = eventSheet.getDataRange().getValues();
      for (let i = 1; i < eventData.length; i++) {
        const row = eventData[i];
        if (row[14] === 'dibatalkan') continue;
        if (!_cmpUsername(row[2], username)) continue;
        const tanggal = row[1];
        const d = tanggal instanceof Date ? tanggal : new Date(tanggal);
        if (isNaN(d)) continue;
        const rowBulan = getBulanSPK(d);
        if (rowBulan !== bulan) continue;
        events.push({
          id: row[0], tanggal: d.toISOString().split('T')[0],
          kodeID: row[4], poinDasar: row[5], pengaliResidivis: row[6],
          efekR03: row[7], poinFinal: row[8], saldoSebelum: row[9], saldoSesudah: row[10],
          keterangan: row[11], dicatatOleh: row[12],
          timestampInput: row[13] ? new Date(row[13]).toISOString() : '',
          statusEvent: row[14]
        });
      }
      events.sort((a, b) => {
        const dateDiff = new Date(b.tanggal) - new Date(a.tanggal);
        if (dateDiff !== 0) return dateDiff;
        // Fallback ke timestampInput agar urutan deterministik untuk event hari yang sama
        const tsA = a.timestampInput ? new Date(a.timestampInput).getTime() : 0;
        const tsB = b.timestampInput ? new Date(b.timestampInput).getTime() : 0;
        return tsB - tsA;
      });
    }
    return { success: true, saldo: saldo, level: level, events: events,
             totalPelanggaran: totalPelanggaran, totalKebaikan: totalKebaikan,
             flagR03: flagR03, flagPanggilanWali: flagPanggilanWali, bulan: bulan };
  } catch(e) {
    return { success: false, message: e.message, saldo: 50, level: 1, events: [] };
  }
}
function getPoinPerKelas(kelas, bulan) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!bulan) bulan = getBulanSPK();
    const userSheet = ss.getSheetByName('Users');
    if (!userSheet) return { success: false, message: 'Sheet Users tidak ditemukan.' };
    const userData = userSheet.getDataRange().getValues();
    const siswaList = [];
    for (let i = 1; i < userData.length; i++) {
      if (userData[i][3] === 'Siswa' && String(userData[i][6] || '').trim() === kelas) {
        siswaList.push({ username: String(userData[i][1]).trim(), fullName: userData[i][7] || userData[i][1] });
      }
    }
    const saldoSheet = ss.getSheetByName('PoinSaldo');
    const saldoData  = saldoSheet ? saldoSheet.getDataRange().getValues() : [[]];
    const saldoMap = {};
    for (let i = 1; i < saldoData.length; i++) {
      if (_normalizeBulanSPK(saldoData[i][1]) !== bulan) continue;
      const u = plainText(saldoData[i][0]).trim();
      if (!u || u.indexOf('_dup_') === 0) continue;
      saldoMap[u] = {
        saldo:            _parseSaldoSPK(saldoData[i][2], 50),
        totalPelanggaran: parseInt(saldoData[i][3]) || 0,
        totalKebaikan:    parseInt(saldoData[i][4]) || 0,
        level:            parseInt(saldoData[i][5]) || 0,
        flagR03:          saldoData[i][6] === true
      };
    }
    const result = siswaList.map(siswa => {
      let info = saldoMap[siswa.username];
      if (!info) {
        for (const k in saldoMap) {
          if (_cmpUsername(k, siswa.username)) { info = saldoMap[k]; break; }
        }
      }
      const sd = info || { saldo: 50, totalPelanggaran: 0, totalKebaikan: 0, level: 1, flagR03: false };
      return { ...siswa, kelas: kelas, saldo: sd.saldo, level: sd.level,
               totalPelanggaran: sd.totalPelanggaran, totalKebaikan: sd.totalKebaikan, flagR03: sd.flagR03 };
    });
    result.sort((a, b) => a.saldo - b.saldo);
    return { success: true, data: result, bulan: bulan, kelas: kelas };
  } catch(e) {
    return { success: false, message: e.message };
  }
}
function getPoinRekap(bulan, kelas) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!bulan) bulan = getBulanSPK();
    const userSheet = ss.getSheetByName('Users');
    if (!userSheet) return { success: false, message: 'Sheet Users tidak ditemukan.' };
    const userData = userSheet.getDataRange().getValues();
    const siswaList = [];
    for (let i = 1; i < userData.length; i++) {
      if (userData[i][3] !== 'Siswa') continue;
      const userKelas = String(userData[i][6] || '').trim();
      if (kelas && kelas !== 'semua' && userKelas !== kelas) continue;
      siswaList.push({ username: String(userData[i][1]).trim(), fullName: userData[i][7] || userData[i][1], kelas: userKelas });
    }
    const saldoSheet = ss.getSheetByName('PoinSaldo');
    const saldoData  = saldoSheet ? saldoSheet.getDataRange().getValues() : [[]];
    const saldoMap = {};
    for (let i = 1; i < saldoData.length; i++) {
      if (_normalizeBulanSPK(saldoData[i][1]) !== bulan) continue;
      const u = plainText(saldoData[i][0]).trim();
      if (!u || u.indexOf('_dup_') === 0) continue;
      saldoMap[u] = {
        saldo:            _parseSaldoSPK(saldoData[i][2], 50),
        totalPelanggaran: parseInt(saldoData[i][3]) || 0,
        totalKebaikan:    parseInt(saldoData[i][4]) || 0,
        level:            parseInt(saldoData[i][5]) || 0,
        flagR03:          saldoData[i][6] === true
      };
    }
    const result = siswaList.map(siswa => {
      let info = saldoMap[siswa.username];
      if (!info) {
        for (const k in saldoMap) {
          if (_cmpUsername(k, siswa.username)) { info = saldoMap[k]; break; }
        }
      }
      const sd = info || { saldo: 50, totalPelanggaran: 0, totalKebaikan: 0, level: 1, flagR03: false };
      return { ...siswa, saldo: sd.saldo, level: sd.level,
               totalPelanggaran: sd.totalPelanggaran, totalKebaikan: sd.totalKebaikan, flagR03: sd.flagR03 };
    });
    result.sort((a, b) => a.saldo - b.saldo);
    return { success: true, data: result, bulan: bulan };
  } catch(e) {
    return { success: false, message: e.message };
  }
}
function getDashboardStatsPoin() {
  try {
    const bulan = getBulanSPK();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const saldoSheet = ss.getSheetByName('PoinSaldo');
    const eventSheet = ss.getSheetByName('PoinEvent');
    let distribusi = [0,0,0,0,0,0];
    if (saldoSheet && saldoSheet.getLastRow() >= 2) {
      const saldoData = saldoSheet.getDataRange().getValues();
      const levelByUser = {};
      for (let i = 1; i < saldoData.length; i++) {
        if (_normalizeBulanSPK(saldoData[i][1]) !== bulan) continue;
        const u = plainText(saldoData[i][0]).trim();
        if (!u || u.indexOf('_dup_') === 0) continue;
        levelByUser[u] = parseInt(saldoData[i][5]) || 0;
      }
      Object.values(levelByUser).forEach(level => {
        distribusi[Math.min(Math.max(level, 0), 5)]++;
      });
    }
    const kodeCount = {};
    if (eventSheet && eventSheet.getLastRow() >= 2) {
      const eventData = eventSheet.getDataRange().getValues();
      for (let i = 1; i < eventData.length; i++) {
        if (eventData[i][14] === 'dibatalkan') continue;
        const tanggal = eventData[i][1];
        const d = tanggal instanceof Date ? tanggal : new Date(tanggal);
        if (getBulanSPK(d) !== bulan) continue;
        const kode = String(eventData[i][4]);
        kodeCount[kode] = (kodeCount[kode] || 0) + 1;
      }
    }
    const topKode = Object.entries(kodeCount).sort((a,b) => b[1]-a[1]).slice(0,10).map(([k,c]) => ({kode:k,count:c}));
    return { success: true, distribusi: distribusi, topKode: topKode, bulan: bulan };
  } catch(e) {
    return { success: false, message: e.message };
  }
}
function resetPoinBulanan() {
  try {
    initSheetsSPK();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const saldoSheet    = ss.getSheetByName('PoinSaldo');
    const resetLogSheet = ss.getSheetByName('PoinResetLog');
    const now = new Date();
    const tglKemarin = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const bulanLama  = tglKemarin.getFullYear() + '-' + String(tglKemarin.getMonth() + 1).padStart(2, '0');
    const bulanBaru  = getBulanSPK(now);
    if (!saldoSheet || saldoSheet.getLastRow() < 2) {
      return { success: true, jumlahSiswa: 0, message: 'Tidak ada data saldo untuk direset.' };
    }
    if (!resetLogSheet) {
      return { success: false, message: 'Sheet PoinResetLog tidak ditemukan. Jalankan initSheetsSPK() terlebih dahulu.' };
    }
    const saldoData = saldoSheet.getDataRange().getValues();
    const snapshotMap = {};
    for (let i = 1; i < saldoData.length; i++) {
      if (_normalizeBulanSPK(saldoData[i][1]) !== bulanLama) continue;
      const username = plainText(saldoData[i][0]).trim();
      if (!username || username.indexOf('_dup_') === 0) continue;
      snapshotMap[username] = {
        saldoAkhir: _parseSaldoSPK(saldoData[i][2], 50),
        levelAkhir: parseInt(saldoData[i][5]) || 0
      };
    }
    let jumlahReset = 0;
    Object.keys(snapshotMap).forEach(username => {
      const snap = snapshotMap[username];
      resetLogSheet.appendRow([safeText(bulanLama), safeText(username), snap.saldoAkhir, snap.levelAkhir, '', now]);
      saldoSheet.appendRow([safeText(username), safeText(bulanBaru), 50, 0, 0, 1, false, false, now]);
      jumlahReset++;
    });
    kirimNotifikasiSPK('admin', 'reset_bulanan', `Reset poin bulanan berhasil. ${jumlahReset} siswa direset ke saldo 50 untuk periode ${bulanLama}.`);
    logActivity('system', 'RESET_POIN_BULANAN', `Reset poin bulanan ${bulanLama}: ${jumlahReset} siswa.`);
    return { success: true, jumlahSiswa: jumlahReset, periodeReset: bulanLama };
  } catch(e) {
    return { success: false, message: e.message };
  }
}
function triggerResetPoinBulanan() {
  resetPoinBulanan();
}
function rebuildPoinSaldo(bulan) {
  try {
    initSheetsSPK();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const eventSheet = ss.getSheetByName('PoinEvent');
    const saldoSheet = ss.getSheetByName('PoinSaldo');
    const pasangan = {}; 
    if (eventSheet && eventSheet.getLastRow() >= 2) {
      const eventData = eventSheet.getDataRange().getValues();
      for (let i = 1; i < eventData.length; i++) {
        const row = eventData[i];
        if (row[14] === 'dibatalkan') continue;
        const username = plainText(row[2]).trim();
        if (!username) continue;
        const t = row[1];
        const d = t instanceof Date ? t : new Date(t);
        if (isNaN(d)) continue;
        const rowBulan = getBulanSPK(d);
        if (bulan && rowBulan !== bulan) continue;
        pasangan[username + '|' + rowBulan] = { username: username, bulan: rowBulan };
      }
    }
    if (saldoSheet && saldoSheet.getLastRow() >= 2) {
      const saldoData = saldoSheet.getDataRange().getValues();
      for (let i = 1; i < saldoData.length; i++) {
        const u = plainText(saldoData[i][0]).trim();
        if (!u || u.indexOf('_dup_') === 0) continue;
        const b = _normalizeBulanSPK(saldoData[i][1]);
        if (!b) continue;
        if (bulan && b !== bulan) continue;
        const key = u + '|' + b;
        if (!pasangan[key]) pasangan[key] = { username: u, bulan: b };
      }
    }
    let total = 0;
    Object.keys(pasangan).forEach(k => {
      recalculateSaldoSiswa(pasangan[k].username, pasangan[k].bulan);
      total++;
    });
    return { success: true, total: total, bulan: bulan || 'semua' };
  } catch(e) {
    return { success: false, message: e.message };
  }
}
function setupTriggerResetBulanan() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'triggerResetPoinBulanan') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('triggerResetPoinBulanan')
    .timeBased()
    .onMonthDay(1)
    .atHour(0)
    .create();
  return { success: true, message: 'Trigger reset bulanan berhasil diatur.' };
}
function getNotifikasi(username) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('PoinNotifikasi');
    if (!sheet || sheet.getLastRow() < 2) return { success: true, data: [] };
    const data = sheet.getDataRange().getValues();
    const result = [];
    for (let i = 1; i < data.length; i++) {
      if (_cmpUsername(data[i][1], username) && data[i][4] !== true) {
        result.push({
          id: data[i][0], tipe: data[i][2], pesan: data[i][3],
          sudahDibaca: data[i][4] === true,
          timestamp: data[i][5] ? new Date(data[i][5]).toISOString() : '',
          _rowIndex: i + 1
        });
      }
    }
    result.sort((a,b) => {
      const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return tB - tA;
    });
    return { success: true, data: result };
  } catch(e) {
    return { success: false, message: e.message };
  }
}
function tandaiDibaca(notifId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('PoinNotifikasi');
    if (!sheet) return { success: false, message: 'Sheet tidak ditemukan.' };
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(notifId)) {
        sheet.getRange(i + 1, 5).setValue(true);
        return { success: true };
      }
    }
    return { success: false, message: 'Notifikasi tidak ditemukan.' };
  } catch(e) {
    return { success: false, message: e.message };
  }
}
function tandaiSemuaDibaca(username) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('PoinNotifikasi');
    if (!sheet || sheet.getLastRow() < 2) return { success: true };
    
    const data = sheet.getDataRange().getValues();
    const readStatus = sheet.getRange(1, 5, data.length, 1).getValues();
    let isChanged = false;
    
    for (let i = 1; i < data.length; i++) {
      if (_cmpUsername(data[i][1], username) && data[i][4] !== true) {
        readStatus[i][0] = true;
        isChanged = true;
      }
    }
    
    if (isChanged) {
      sheet.getRange(1, 5, data.length, 1).setValues(readStatus);
    }
    return { success: true };
  } catch(e) {
    return { success: false, message: e.message };
  }
}
function getDaftarKelasSPK() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Classes');
    if (!sheet || sheet.getLastRow() < 2) return { success: true, data: [] };
    const data = sheet.getDataRange().getValues();
    const result = data.slice(1)
      .filter(r => r[2])
      .map(r => ({ id: r[0], nama: String(r[2]).trim() }))
      .sort((a, b) => a.nama.localeCompare(b.nama));
    return { success: true, data: result };
  } catch(e) {
    return { success: false, message: e.message };
  }
}
function getSiswaPerKelasSPK(kelas) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Users');
    if (!sheet) return { success: true, data: [] };
    const data = sheet.getDataRange().getValues();
    const result = [];
    for (let i = 1; i < data.length; i++) {
      const role      = String(data[i][3] || '').trim();
      const kelasUser = String(data[i][6] || '').trim();
      if (role !== 'Siswa' || kelasUser !== String(kelas).trim()) continue;
      result.push({
        username: plainText(String(data[i][1] || '')),
        fullName: plainText(String(data[i][7] || data[i][1] || ''))
      });
    }
    result.sort((a, b) => a.fullName.localeCompare(b.fullName));
    return { success: true, data: result };
  } catch(e) {
    return { success: false, message: e.message };
  }
}
function getExportDataPoinSiswa(username, bulan) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!bulan) bulan = getBulanSPK();
    const userSheet = ss.getSheetByName('Users');
    if (!userSheet) throw new Error('Sheet Users tidak ditemukan.');
    const userData = userSheet.getDataRange().getValues();
    let siswaInfo = null;
    let waliKelasInfo = null;
    let kelas = '';

    // Pass pertama: temukan data siswa dan kelas-nya
    for (let i = 1; i < userData.length; i++) {
      if (_cmpUsername(userData[i][1], username)) {
        kelas = String(userData[i][6] || '').trim();
        siswaInfo = {
          username: username,
          fullName: userData[i][7] || username,
          kelas: kelas,
          noHP: userData[i][14] || '',
          email: userData[i][15] || ''
        };
        break;
      }
    }

    // Pass kedua: temukan wali kelas yang mengampu kelas siswa dari sheet Classes
    if (kelas) {
      const classSheet = ss.getSheetByName('Classes');
      if (classSheet) {
        const classesData = classSheet.getDataRange().getValues();
        for (let c = 1; c < classesData.length; c++) {
          if (String(classesData[c][2]).trim() === kelas) {
            const namaWali = String(classesData[c][4] || '').trim();
            if (namaWali) {
              waliKelasInfo = { fullName: namaWali, username: '' };
            }
            break;
          }
        }
      }
    }
    if (!siswaInfo) throw new Error('Siswa dengan username "' + username + '" tidak ditemukan.');
    const poinRes = getPoinSiswa(username, bulan);
    if (!poinRes.success) throw new Error(poinRes.message || 'Gagal memuat data poin.');
    const katalogRes = getPoinKatalog(true);
    const katalogMap = {};
    if (katalogRes.success) {
      katalogRes.data.forEach(k => { katalogMap[k.kodeID] = k; });
    }
    const events = (poinRes.events || []).map(e => ({
      ...e,
      deskripsiKode: katalogMap[e.kodeID] ? katalogMap[e.kodeID].deskripsi : '',
      kategoriKode:  katalogMap[e.kodeID] ? katalogMap[e.kodeID].kategori  : '',
      konsekuensi:   katalogMap[e.kodeID] ? (katalogMap[e.kodeID].konsekuensiTambahan || '') : ''
    }));
    const profile = getSchoolProfile();
    const bulanLabel  = _bulanLabel(bulan);
    const tanggalCetak = formatTanggalSPK(new Date(), true, false);
    return {
      success: true,
      siswa: siswaInfo,
      waliKelas: waliKelasInfo,
      saldo: poinRes.saldo,
      level: poinRes.level,
      totalPelanggaran: poinRes.totalPelanggaran,
      totalKebaikan: poinRes.totalKebaikan,
      flagR03: poinRes.flagR03,
      flagPanggilanWali: poinRes.flagPanggilanWali,
      events: events,
      bulan: bulan,
      bulanLabel: bulanLabel,
      profile: profile,
      tanggalCetak: tanggalCetak
    };
  } catch(e) {
    return { success: false, message: e.message };
  }
}
function getExportDataPoinGlobal(bulan, kelas) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!bulan) bulan = getBulanSPK();
    const katalogRes = getPoinKatalog(true);
    const katalogMap = {};
    if (katalogRes.success) katalogRes.data.forEach(k => { katalogMap[k.kodeID] = k; });
    const userSheet = ss.getSheetByName('Users');
    if (!userSheet) throw new Error('Sheet Users tidak ditemukan.');
    const userData = userSheet.getDataRange().getValues();
    const siswaList = [];
    for (let i = 1; i < userData.length; i++) {
      if (userData[i][3] !== 'Siswa') continue;
      const rowKelas = String(userData[i][6] || '').trim();
      if (kelas && kelas !== 'semua' && rowKelas !== kelas) continue;
      siswaList.push({
        username: String(userData[i][1]).trim(),
        fullName: userData[i][7] || userData[i][1],
        kelas: rowKelas
      });
    }
    const saldoSheet = ss.getSheetByName('PoinSaldo');
    const saldoData  = saldoSheet ? saldoSheet.getDataRange().getValues() : [[]];
    const saldoMap = {};
    for (let i = 1; i < saldoData.length; i++) {
      if (_normalizeBulanSPK(saldoData[i][1]) !== bulan) continue;
      const u = plainText(saldoData[i][0]).trim();
      if (!u || u.indexOf('_dup_') === 0) continue;
      saldoMap[u] = {
        saldo:             _parseSaldoSPK(saldoData[i][2], 50),
        totalPelanggaran:  parseInt(saldoData[i][3]) || 0,
        totalKebaikan:     parseInt(saldoData[i][4]) || 0,
        level:             parseInt(saldoData[i][5]) || 0,
        flagR03:           saldoData[i][6] === true,
        flagPanggilanWali: saldoData[i][7] === true
      };
    }
    const rekapSaldo = siswaList.map(siswa => {
      let info = saldoMap[siswa.username];
      if (!info) {
        for (const k in saldoMap) {
          if (_cmpUsername(k, siswa.username)) { info = saldoMap[k]; break; }
        }
      }
      const sd = info || { saldo: 50, totalPelanggaran: 0, totalKebaikan: 0, level: 1, flagR03: false, flagPanggilanWali: false };
      const labelLevel = ['Baik/Teladan','Perlu Perhatian','Waspada','Berbahaya','Kritis','Darurat/DO'];
      return {
        ...siswa, saldo: sd.saldo, level: sd.level,
        labelLevel: 'Tingkat ' + sd.level + ' — ' + (labelLevel[sd.level] || ''),
        totalPelanggaran: sd.totalPelanggaran,
        totalKebaikan:    sd.totalKebaikan,
        flagR03:           sd.flagR03 ? 'Ya' : 'Tidak',
        flagPanggilanWali: sd.flagPanggilanWali ? 'Ya' : 'Tidak'
      };
    });
    rekapSaldo.sort((a, b) => a.saldo - b.saldo);
    const eventSheet = ss.getSheetByName('PoinEvent');
    const allEvents  = [];
    if (eventSheet && eventSheet.getLastRow() >= 2) {
      const eventData = eventSheet.getDataRange().getValues();
      const userMap = {};
      siswaList.forEach(s => { userMap[s.username] = s; });
      const findUser = (u) => {
        if (userMap[u]) return userMap[u];
        for (const k in userMap) { if (_cmpUsername(k, u)) return userMap[k]; }
        return null;
      };
      for (let i = 1; i < eventData.length; i++) {
        const row = eventData[i];
        if (row[14] === 'dibatalkan') continue;
        const rowUsername = plainText(row[2]).trim();
        const tanggal = row[1];
        const d = tanggal instanceof Date ? tanggal : new Date(tanggal);
        if (isNaN(d)) continue;
        const rowBulan = getBulanSPK(d);
        if (rowBulan !== bulan) continue;
        const userInfo = findUser(rowUsername);
        if (kelas && kelas !== 'semua' && userInfo && userInfo.kelas !== kelas) continue;
        if (kelas && kelas !== 'semua' && !userInfo) continue;
        const kodeID = String(row[4]).trim();
        allEvents.push({
          tanggal: d.toISOString().split('T')[0],
          username: rowUsername,
          fullName: userInfo ? userInfo.fullName : rowUsername,
          kelas: userInfo ? userInfo.kelas : row[3],
          kodeID: kodeID,
          deskripsiKode: katalogMap[kodeID] ? katalogMap[kodeID].deskripsi : '',
          kategoriKode:  katalogMap[kodeID] ? katalogMap[kodeID].kategori  : '',
          poinDasar:     parseFloat(row[5]) || 0,
          pengaliResidivis: parseInt(row[6]) || 1,
          efekR03:       row[7] === true ? 'Ya' : 'Tidak',
          poinFinal:     parseFloat(row[8]) || 0,
          saldoSebelum:  parseFloat(row[9]) || 0,
          saldoSesudah:  parseFloat(row[10]) || 0,
          keterangan:    row[11] || '',
          dicatatOleh:   String(row[12]).trim(),
          statusEvent:   row[14] || 'original'
        });
      }
    }
    allEvents.sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
    const distribusi = [0, 0, 0, 0, 0, 0];
    rekapSaldo.forEach(s => {
      const lv = Math.min(s.level, 5);
      distribusi[lv]++;
    });
    const kodeCount = {};
    allEvents.forEach(e => {
      if (e.poinFinal < 0) kodeCount[e.kodeID] = (kodeCount[e.kodeID] || 0) + 1;
    });
    const topKode = Object.entries(kodeCount).sort((a,b) => b[1]-a[1]).slice(0, 10).map(([k, c]) => ({
      kodeID: k,
      deskripsi: katalogMap[k] ? katalogMap[k].deskripsi : '',
      kategori:  katalogMap[k] ? katalogMap[k].kategori  : '',
      count: c
    }));
    const bulanLabel = _bulanLabel(bulan);
    const profile     = getSchoolProfile();
    const tanggalCetak = formatTanggalSPK(new Date(), true, false);
    return {
      success: true,
      rekapSaldo: rekapSaldo,
      allEvents: allEvents,
      distribusi: distribusi,
      topKode: topKode,
      totalSiswa: rekapSaldo.length,
      bulan: bulan,
      bulanLabel: bulanLabel,
      kelas: kelas || 'semua',
      profile: profile,
      tanggalCetak: tanggalCetak
    };
  } catch(e) {
    return { success: false, message: e.message };
  }
}
function getKonfigurasiSPK() {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Settings');
    const defaults = {
      spk_email_enabled:   false,
      spk_wa_enabled:      false,
      spk_wa_api_url:      '',
      spk_wa_api_key:      '',
      spk_notif_threshold: 3,
      spk_mapel_afektif:   'Akhlak & Budi Pekerti',
      spk_sotm_enabled:    true
    };
    if (!sheet) return { success: true, config: defaults };
    const data = sheet.getDataRange().getValues();
    const config = Object.assign({}, defaults);
    data.forEach(row => {
      const key = String(row[0] || '').trim();
      if (key in defaults) {
        const val = row[1];
        if (typeof defaults[key] === 'boolean') config[key] = val === true || val === 'true' || val === 'TRUE';
        else if (typeof defaults[key] === 'number') config[key] = parseInt(val) || defaults[key];
        else config[key] = String(val || defaults[key]);
      }
    });
    return { success: true, config: config };
  } catch(e) {
    return { success: false, message: e.message };
  }
}
function saveKonfigurasiSPK(config, adminUser) {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Settings');
    if (!sheet) throw new Error('Sheet Settings tidak ditemukan.');
    const keys = [
      'spk_email_enabled','spk_wa_enabled','spk_wa_api_url',
      'spk_wa_api_key','spk_notif_threshold','spk_mapel_afektif','spk_sotm_enabled'
    ];
    const data = sheet.getDataRange().getValues();
    keys.forEach(key => {
      if (!(key in config)) return;
      let rowIdx = -1;
      for (let i = 0; i < data.length; i++) {
        if (String(data[i][0]).trim() === key) { rowIdx = i + 1; break; }
      }
      if (rowIdx === -1) {
        sheet.appendRow([key, config[key]]);
      } else {
        sheet.getRange(rowIdx, 2).setValue(config[key]);
      }
    });
    logActivity(adminUser, 'SAVE_CONFIG_SPK', 'Memperbarui konfigurasi SPK Fase 3.');
    return { success: true };
  } catch(e) {
    return { success: false, message: e.message };
  }
}
function kirimEmailSPK(emailTo, namaOrtu, namaSiswa, kelas, saldo, level, tanggalEvent) {
  try {
    if (!emailTo || !emailTo.includes('@')) return { success: false, message: 'Alamat email tidak valid.' };
    const labelLevel = ['Baik/Teladan','Perlu Perhatian','Waspada','Berbahaya','Kritis','Darurat/DO'];
    const warnaTeks  = ['#059669','#d97706','#ea580c','#dc2626','#991b1b','#111827'];
    const BULAN_LABEL = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const now = new Date();
    const tglStr = now.getDate() + ' ' + BULAN_LABEL[now.getMonth()] + ' ' + now.getFullYear();
    const subject = '[SiM-Murid] Poin Kedisiplinan ' + namaSiswa + ' — Tingkat ' + level + ' (' + (labelLevel[level]||'') + ')';
    const htmlBody = `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;background:#f8fafc;padding:24px;">
        <div style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">
          <div style="background:linear-gradient(135deg,#4f46e5,#6366f1);padding:20px 28px;">
            <h2 style="color:#fff;margin:0;font-size:18px;font-weight:800;">&#128276; Notifikasi Poin Kedisiplinan</h2>
            <p style="color:rgba(255,255,255,.75);margin:4px 0 0;font-size:13px;">SiM-Murid &#8212; MTs Nurul Falah</p>
          </div>
          <div style="padding:24px 28px;">
            <p style="color:#374151;font-size:14px;margin:0 0 16px;">Yth. Bapak/Ibu <strong>${namaOrtu}</strong>,</p>
            <p style="color:#374151;font-size:14px;margin:0 0 20px;">Kami menyampaikan informasi terkini terkait poin kedisiplinan putra/putri Anda:</p>
            <div style="background:#f5f3ff;border-left:4px solid #6366f1;border-radius:8px;padding:16px 18px;margin-bottom:20px;">
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:4px 0;color:#6b7280;font-size:13px;width:44%;">Nama Siswa</td><td style="padding:4px 0;font-weight:700;color:#111827;font-size:13px;">: ${namaSiswa}</td></tr>
                <tr><td style="padding:4px 0;color:#6b7280;font-size:13px;">Kelas</td><td style="padding:4px 0;font-weight:700;color:#111827;font-size:13px;">: ${kelas}</td></tr>
                <tr><td style="padding:4px 0;color:#6b7280;font-size:13px;">Saldo Poin Terkini</td><td style="padding:4px 0;font-weight:900;color:${warnaTeks[Math.min(level,5)]};font-size:18px;">: ${saldo} poin</td></tr>
                <tr><td style="padding:4px 0;color:#6b7280;font-size:13px;">Status Kedisiplinan</td><td style="padding:4px 0;font-size:13px;">: <span style="background:${warnaTeks[Math.min(level,5)]};color:#fff;padding:2px 10px;border-radius:20px;font-weight:700;font-size:12px;">Tingkat ${level} &#8212; ${labelLevel[level]||''}</span></td></tr>
                <tr><td style="padding:4px 0;color:#6b7280;font-size:13px;">Tanggal Pencatatan</td><td style="padding:4px 0;font-size:13px;color:#111827;">: ${tanggalEvent || tglStr}</td></tr>
              </table>
            </div>
            ${level >= 4 ? `<div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:8px;padding:12px 16px;margin-bottom:20px;">
              <p style="color:#991b1b;font-weight:700;font-size:13px;margin:0 0 4px;">&#9888;&#65039; Perhatian Khusus Diperlukan</p>
              <p style="color:#7f1d1d;font-size:12.5px;margin:0;">Saldo poin siswa telah mencapai tingkat yang memerlukan perhatian serius. Kami mengundang Bapak/Ibu untuk hadir ke madrasah guna berdiskusi bersama Guru BK dan Wali Kelas.</p>
            </div>` : `<div style="background:#fffbeb;border:1.5px solid #fcd34d;border-radius:8px;padding:12px 16px;margin-bottom:20px;">
              <p style="color:#78350f;font-weight:700;font-size:13px;margin:0 0 4px;">&#8505;&#65039; Informasi</p>
              <p style="color:#92400e;font-size:12.5px;margin:0;">Mohon untuk memberikan perhatian dan dukungan kepada putra/putri Anda agar dapat meningkatkan kedisiplinan. Detail riwayat poin dapat dilihat langsung di aplikasi SiM-Murid.</p>
            </div>`}
            <p style="color:#9ca3af;font-size:11.5px;margin:16px 0 0;line-height:1.6;">Email ini dikirim otomatis oleh Sistem Informasi Manajemen Murid (SiM-Murid) MTs Nurul Falah pada ${tglStr}. Jangan balas email ini. Untuk informasi lebih lanjut, hubungi pihak madrasah.</p>
          </div>
        </div>
      </div>`;
    MailApp.sendEmail({ to: emailTo, subject: subject, htmlBody: htmlBody });
    return { success: true };
  } catch(e) {
    return { success: false, message: e.message };
  }
}
function kirimWhatsAppSPK(noHP, pesan, apiUrl, apiKey) {
  try {
    if (!noHP || !apiUrl) return { success: false, message: 'Nomor HP atau API URL tidak dikonfigurasi.' };
    let nomor = String(noHP).replace(/\D/g, '');
    if (nomor.startsWith('0')) nomor = '62' + nomor.substring(1);
    else if (!nomor.startsWith('62')) nomor = '62' + nomor;
    const payload = JSON.stringify({ target: nomor, message: pesan });
    const options = {
      method: 'POST',
      contentType: 'application/json',
      headers: { 'Authorization': apiKey || '' },
      payload: payload,
      muteHttpExceptions: true
    };
    const response = UrlFetchApp.fetch(apiUrl, options);
    const code     = response.getResponseCode();
    if (code >= 200 && code < 300) {
      return { success: true };
    } else {
      return { success: false, message: 'WA Gateway error: HTTP ' + code + ' — ' + response.getContentText().substring(0, 120) };
    }
  } catch(e) {
    return { success: false, message: e.message };
  }
}
function kirimNotifEksternalSPK(username, namaLengkap, kelas, saldo, level, tanggalEvent) {
  try {
    const cfgRes = getKonfigurasiSPK();
    if (!cfgRes.success) return;
    const cfg = cfgRes.config;
    const threshold = parseInt(cfg.spk_notif_threshold) || 3;
    if (level < threshold) return;
    const ss          = SpreadsheetApp.getActiveSpreadsheet();
    const detailSheet = ss.getSheetByName('SiswaDetail');
    if (!detailSheet) return;
    const detailData = detailSheet.getDataRange().getValues();
    if (detailData.length < 2) return;
    const headers    = detailData[0];
    const idxUser     = headers.indexOf('username');
    const idxAyahHP   = headers.indexOf('AyahNoHP');
    const idxIbuHP    = headers.indexOf('IbuNoHP');
    const idxWaliHP   = headers.indexOf('WaliNoHP');
    const idxWaliPil  = headers.indexOf('WaliPilihan');
    // Guard: kolom wajib harus ada
    if (idxUser < 0) return;
    const userSheet = ss.getSheetByName('Users');
    const userData  = userSheet ? userSheet.getDataRange().getValues() : [[]];
    for (let i = 1; i < detailData.length; i++) {
      if (!_cmpUsername(detailData[i][idxUser], username)) continue;
      const waliPilihan = String(detailData[i][idxWaliPil] || '').toLowerCase();
      let noHP = '';
      if (waliPilihan === 'wali') noHP = String(detailData[i][idxWaliHP]  || '');
      else if (waliPilihan === 'ibu') noHP = String(detailData[i][idxIbuHP] || '');
      else noHP = String(detailData[i][idxAyahHP] || '');
      const ortuUsername = headers.indexOf('Username_Ortu') >= 0
        ? String(detailData[i][headers.indexOf('Username_Ortu')] || '').trim()
        : '';
      let emailOrtu = '';
      let namaOrtu  = 'Wali Murid';
      if (ortuUsername) {
        for (let u = 1; u < userData.length; u++) {
          if (_cmpUsername(userData[u][1], ortuUsername)) {
            emailOrtu = String(userData[u][15] || '').trim();
            namaOrtu  = String(userData[u][7]  || userData[u][1] || '').trim();
            break;
          }
        }
      }
      const labelLevel = ['Baik/Teladan','Perlu Perhatian','Waspada','Berbahaya','Kritis','Darurat/DO'];
      const pesanWA = `[SiM-Murid] Assalamu'alaikum ${namaOrtu}, kami menginformasikan bahwa poin kedisiplinan ${namaLengkap} (Kelas ${kelas}) saat ini: *${saldo} poin* - Tingkat ${level} (${labelLevel[level]||''}). Mohon berikan perhatian lebih kepada putra/putri Anda. Detail dapat dilihat di aplikasi SiM-Murid.`;
      if (cfg.spk_wa_enabled && noHP) {
        kirimWhatsAppSPK(noHP, pesanWA, cfg.spk_wa_api_url, cfg.spk_wa_api_key);
      }
      if (cfg.spk_email_enabled && emailOrtu) {
        kirimEmailSPK(emailOrtu, namaOrtu, namaLengkap, kelas, saldo, level, tanggalEvent);
      }
      break;
    }
  } catch(e) {
    Logger.log('kirimNotifEksternalSPK error: ' + e.message);
  }
}
function getStudentOfTheMonth(bulan) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!bulan) bulan = getBulanSPK();
    const userSheet  = ss.getSheetByName('Users');
    const saldoSheet = ss.getSheetByName('PoinSaldo');
    if (!userSheet) return { success: false, message: 'Sheet Users tidak ditemukan.' };
    const userData  = userSheet.getDataRange().getValues();
    const saldoData = saldoSheet ? saldoSheet.getDataRange().getValues() : [[]];
    const saldoMap = {};
    for (let i = 1; i < saldoData.length; i++) {
      if (_normalizeBulanSPK(saldoData[i][1]) !== bulan) continue;
      const u = plainText(saldoData[i][0]).trim();
      if (!u || u.indexOf('_dup_') === 0) continue;
      saldoMap[u] = {
        saldo:            _parseSaldoSPK(saldoData[i][2], 50),
        totalPelanggaran: parseInt(saldoData[i][3])   || 0,
        totalKebaikan:    parseInt(saldoData[i][4])   || 0,
        level:            parseInt(saldoData[i][5])   || 1
      };
    }
    const classSheet = ss.getSheetByName('Classes');
    const classWaliMap = {};
    if (classSheet) {
      const classesData = classSheet.getDataRange().getValues();
      for (let c = 1; c < classesData.length; c++) {
        const k = String(classesData[c][2]).trim();
        const w = String(classesData[c][4]).trim();
        if (k) classWaliMap[k] = w;
      }
    }
    
    const kelasSiswaMap = {};
    for (let i = 1; i < userData.length; i++) {
      if (userData[i][3] !== 'Siswa') continue;
      const un    = String(userData[i][1]).trim();
      const kelas = String(userData[i][6] || '').trim();
      const nama  = String(userData[i][7] || un);
      const sd    = saldoMap[un] || { saldo: 50, totalPelanggaran: 0, totalKebaikan: 0, level: 1 };
      if (!kelasSiswaMap[kelas]) kelasSiswaMap[kelas] = [];
      kelasSiswaMap[kelas].push({ username: un, fullName: nama, kelas: kelas, ...sd });
    }
    const sotmPerKelas = [];
    Object.keys(kelasSiswaMap).sort().forEach(kelas => {
      const sorted = kelasSiswaMap[kelas].sort((a, b) => {
        if (b.saldo !== a.saldo) return b.saldo - a.saldo;
        return a.totalPelanggaran - b.totalPelanggaran;
      });
      if (sorted.length > 0) sotmPerKelas.push({ kelas: kelas, siswa: sorted[0], runnerUp: sorted[1] || null, waliKelas: classWaliMap[kelas] || null });
    });
    const allSiswa = Object.values(kelasSiswaMap).flat().sort((a, b) => {
      if (b.saldo !== a.saldo) return b.saldo - a.saldo;
      return a.totalPelanggaran - b.totalPelanggaran;
    });
    const globalTerbaik = allSiswa.slice(0, 3);
    const profile = getSchoolProfile();
    const tanggalCetak = formatTanggalSPK(new Date(), true, false);
    return { success: true, sotmPerKelas: sotmPerKelas, globalTerbaik: globalTerbaik, bulan: bulan, bulanLabel: _bulanLabel(bulan), profile: profile, tanggalCetak: tanggalCetak };
  } catch(e) {
    return { success: false, message: e.message };
  }
}
function syncNilaiAfektifSPK(periodeResetLog, adminUser) {
  try {
    initSheetsSPK();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const cfgRes = getKonfigurasiSPK();
    const mapelAfektif = (cfgRes.success ? cfgRes.config.spk_mapel_afektif : null) || 'Akhlak & Budi Pekerti';
    let saldoSumber = [];
    let periodeLabel = periodeResetLog;
    if (periodeResetLog) {
      const resetSheet = ss.getSheetByName('PoinResetLog');
      if (!resetSheet || resetSheet.getLastRow() < 2) throw new Error('Tidak ada data reset log untuk periode ' + periodeResetLog + '.');
      const resetData = resetSheet.getDataRange().getValues();
      for (let i = 1; i < resetData.length; i++) {
        if (_normalizeBulanSPK(resetData[i][0]) !== periodeResetLog) continue;
        saldoSumber.push({ username: plainText(resetData[i][1]).trim(), saldo: _parseSaldoSPK(resetData[i][2], 50) });
      }
      if (saldoSumber.length === 0) throw new Error('Tidak ada data snapshot untuk periode ' + periodeResetLog + '. Pastikan reset bulanan sudah berjalan untuk periode ini.');
    } else {
      const bulanBerjalan = getBulanSPK();
      periodeLabel = bulanBerjalan;
      const saldoSheet = ss.getSheetByName('PoinSaldo');
      if (!saldoSheet || saldoSheet.getLastRow() < 2) throw new Error('Tidak ada data saldo untuk bulan berjalan.');
      const saldoData = saldoSheet.getDataRange().getValues();
      for (let i = 1; i < saldoData.length; i++) {
        if (_normalizeBulanSPK(saldoData[i][1]) !== bulanBerjalan) continue;
        saldoSumber.push({ username: plainText(saldoData[i][0]).trim(), saldo: _parseSaldoSPK(saldoData[i][2], 50) });
      }
    }
    if (saldoSumber.length === 0) throw new Error('Tidak ada data poin untuk disinkronkan.');
    function konversiNilaiAfektif(saldo) {
      const normalized = Math.min(100, Math.max(0, ((saldo + 50) / 150) * 100));
      const nilai = Math.round(normalized);
      let predikat;
      if (nilai >= 90) predikat = 'A - Sangat Baik';
      else if (nilai >= 80) predikat = 'B - Baik';
      else if (nilai >= 70) predikat = 'C - Cukup';
      else if (nilai >= 60) predikat = 'D - Kurang';
      else predikat = 'E - Sangat Kurang';
      return { nilai: nilai, predikat: predikat };
    }
    let afektifSheet = ss.getSheetByName('NilaiAfektif');
    if (!afektifSheet) {
      afektifSheet = ss.insertSheet('NilaiAfektif');
      afektifSheet.appendRow([
        'ID', 'Periode', 'Mapel', 'Username', 'Nama', 'Kelas',
        'SaldoPoin', 'NilaiAfektif', 'Predikat', 'Keterangan',
        'DisinkronOleh', 'TanggalSync'
      ]);
    }
    const userSheet = ss.getSheetByName('Users');
    const userData  = userSheet ? userSheet.getDataRange().getValues() : [[]];
    const userMap   = {};
    for (let i = 1; i < userData.length; i++) {
      if (userData[i][3] !== 'Siswa') continue;
      const un = String(userData[i][1]).trim();
      userMap[un] = { fullName: userData[i][7] || un, kelas: String(userData[i][6] || '').trim() };
    }
    const tanggalSync = new Date();
    let jumlahDisync  = 0;
    let jumlahDilewati = 0;
    const existData = afektifSheet.getLastRow() >= 2 ? afektifSheet.getDataRange().getValues() : [[]];
    const dupList   = [];
    for (let i = 1; i < existData.length; i++) {
      const rowPeriode = String(existData[i][1] || '').trim();
      const rowMapel   = String(existData[i][2] || '').trim();
      const rowUser    = existData[i][3];
      if (rowPeriode === periodeLabel && rowMapel === mapelAfektif) {
        dupList.push(rowUser);
      }
    }
    saldoSumber.forEach(s => {
      if (!userMap[s.username]) return;
      const sudahAda = dupList.some(function(u) { return _cmpUsername(u, s.username); });
      if (sudahAda) { jumlahDilewati++; return; }
      const { nilai, predikat } = konversiNilaiAfektif(s.saldo);
      const info       = userMap[s.username];
      const id         = 'af_' + Utilities.getUuid().replace(/-/g,'').substring(0,12);
      const keterangan = 'Saldo poin akhir: ' + s.saldo + ' | Konversi: ' + predikat;
      afektifSheet.appendRow([
        id,
        periodeLabel,
        mapelAfektif,
        safeText(s.username),
        info.fullName,
        info.kelas,
        s.saldo,
        nilai,
        predikat,
        keterangan,
        safeText(adminUser),
        tanggalSync
      ]);
      jumlahDisync++;
    });
    logActivity(adminUser, 'SYNC_NILAI_AFEKTIF', 'Sync nilai afektif SPK → sheet NilaiAfektif, periode ' + periodeLabel + ': ' + jumlahDisync + ' siswa.');
    return {
      success: true,
      jumlahDisync: jumlahDisync,
      jumlahDilewati: jumlahDilewati,
      periode: periodeLabel,
      mapelAfektif: mapelAfektif,
      pesan: jumlahDisync + ' nilai afektif berhasil disinkronkan ke sheet NilaiAfektif' +
             (jumlahDilewati > 0 ? ', ' + jumlahDilewati + ' dilewati (sudah ada).' : '.')
    };
  } catch(e) {
    return { success: false, message: e.message };
  }
}
function getDashboardAnalitikSPK() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const BULAN_LABEL = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    const now = new Date();
    const bulanList = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      bulanList.push({
        key: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'),
        label: BULAN_LABEL[d.getMonth()] + ' \'' + String(d.getFullYear()).slice(2)
      });
    }
    const saldoSheet = ss.getSheetByName('PoinSaldo');
    const resetSheet = ss.getSheetByName('PoinResetLog');
    const trendMap = {};
    bulanList.forEach(b => { trendMap[b.key] = {}; });
    if (resetSheet && resetSheet.getLastRow() >= 2) {
      const resetData = resetSheet.getDataRange().getValues();
      for (let i = 1; i < resetData.length; i++) {
        const periode  = _normalizeBulanSPK(resetData[i][0]);
        const username = plainText(resetData[i][1]).trim();
        const saldo    = _parseSaldoSPK(resetData[i][2], 50);
        if (!trendMap[periode]) continue;
        if (!trendMap[periode].__rawReset) trendMap[periode].__rawReset = [];
        trendMap[periode].__rawReset.push({ username, saldo });
      }
    }
    if (saldoSheet && saldoSheet.getLastRow() >= 2) {
      const saldoData = saldoSheet.getDataRange().getValues();
      for (let i = 1; i < saldoData.length; i++) {
        const periode  = _normalizeBulanSPK(saldoData[i][1]);
        const username = plainText(saldoData[i][0]).trim();
        const saldo    = _parseSaldoSPK(saldoData[i][2], 50);
        if (!trendMap[periode]) continue;
        if (!trendMap[periode].__rawSaldo) trendMap[periode].__rawSaldo = [];
        trendMap[periode].__rawSaldo.push({ username, saldo });
      }
    }
    const userSheet = ss.getSheetByName('Users');
    const userMap   = {};
    const kelasList = new Set();
    if (userSheet) {
      const userData = userSheet.getDataRange().getValues();
      for (let i = 1; i < userData.length; i++) {
        if (userData[i][3] !== 'Siswa') continue;
        const un    = String(userData[i][1]).trim();
        const kelas = String(userData[i][6] || '').trim();
        userMap[un] = kelas;
        if (kelas) kelasList.add(kelas);
      }
    }
    const kelasSorted = Array.from(kelasList).sort();
    const trendPerKelas = {};
    const trendGlobal   = [];
    bulanList.forEach((b, idx) => {
      const rawReset = trendMap[b.key].__rawReset || [];
      const rawSaldo = trendMap[b.key].__rawSaldo || [];
      const combined = {};
      rawSaldo.forEach(r => { combined[r.username] = r.saldo; });
      rawReset.forEach(r => { combined[r.username] = r.saldo; });
      const kelasSaldoSum   = {};
      const kelasSaldoCount = {};
      let globalSum = 0, globalCount = 0;
      Object.keys(combined).forEach(un => {
        const kelas = userMap[un];
        if (!kelas) return;
        const saldo = combined[un];
        kelasSaldoSum[kelas]   = (kelasSaldoSum[kelas]   || 0) + saldo;
        kelasSaldoCount[kelas] = (kelasSaldoCount[kelas] || 0) + 1;
        globalSum   += saldo;
        globalCount += 1;
      });
      kelasSorted.forEach(kelas => {
        if (!trendPerKelas[kelas]) trendPerKelas[kelas] = new Array(12).fill(null);
        trendPerKelas[kelas][idx] = kelasSaldoCount[kelas]
          ? Math.round((kelasSaldoSum[kelas] / kelasSaldoCount[kelas]) * 10) / 10
          : null;
      });
      trendGlobal[idx] = globalCount ? Math.round((globalSum / globalCount) * 10) / 10 : null;
    });
    const bulanIni = bulanList[bulanList.length - 1].key;
    const distribusiPerKelas = {};
    kelasSorted.forEach(k => { distribusiPerKelas[k] = [0,0,0,0,0,0]; });
    if (saldoSheet && saldoSheet.getLastRow() >= 2) {
      const saldoData = saldoSheet.getDataRange().getValues();
      for (let i = 1; i < saldoData.length; i++) {
        if (_normalizeBulanSPK(saldoData[i][1]) !== bulanIni) continue;
        const un    = plainText(saldoData[i][0]).trim();
        const kelas = userMap[un];
        const level = parseInt(saldoData[i][5]) || 0;
        if (kelas && distribusiPerKelas[kelas]) {
          distribusiPerKelas[kelas][Math.max(0, Math.min(level, 5))]++;
        }
      }
    }
    const rankingKelas = kelasSorted.map(kelas => {
      const arr = trendPerKelas[kelas] || [];
      const last = arr[arr.length - 1];
      return { kelas: kelas, rataSaldo: last !== null ? last : 50, distribusi: distribusiPerKelas[kelas] || [0,0,0,0,0,0] };
    }).sort((a, b) => b.rataSaldo - a.rataSaldo);
    const rataBulanIni    = trendGlobal[11] !== null ? trendGlobal[11] : 50;
    const rataBulanLalu   = trendGlobal[10] !== null ? trendGlobal[10] : 50;
    const trenGlobal      = rataBulanIni - rataBulanLalu;
    return {
      success: true,
      bulanLabels:    bulanList.map(b => b.label),
      trendPerKelas:  trendPerKelas,
      trendGlobal:    trendGlobal,
      distribusiPerKelas: distribusiPerKelas,
      rankingKelas:   rankingKelas,
      kelasList:      kelasSorted,
      rataBulanIni:   rataBulanIni,
      rataBulanLalu:  rataBulanLalu,
      trenGlobal:     trenGlobal,
      bulanIni:       bulanIni
    };
  } catch(e) {
    return { success: false, message: e.message };
  }
}
function savePoinEventF3(eventData, pencatat) {
  const result = savePoinEvent(eventData, pencatat);
  if (result.success) {
    try {
      const cfgRes    = getKonfigurasiSPK();
      const threshold = (cfgRes.success && cfgRes.config) ? (parseInt(cfgRes.config.spk_notif_threshold) || 3) : 3;
      if (result.levelBaru >= threshold) {
        kirimNotifEksternalSPK(
          eventData.username, eventData.namaLengkap || eventData.username,
          eventData.kelas, result.saldoBaru, result.levelBaru,
          eventData.tanggal || Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd')
        );
      }
    } catch(e) { Logger.log('F3 notif eksternal error: ' + e.message); }
  }
  return result;
}
function triggerResetPoinBulananF3() {
  resetPoinBulanan();
  try {
    const cfgRes = getKonfigurasiSPK();
    if (!cfgRes.success) return;
    const cfg = cfgRes.config;
    if (!cfg.spk_email_enabled && !cfg.spk_wa_enabled) return;
    const ss         = SpreadsheetApp.getActiveSpreadsheet();
    const resetSheet = ss.getSheetByName('PoinResetLog');
    if (!resetSheet || resetSheet.getLastRow() < 2) return;
    const nowF3 = new Date();
    const tglBulanLamaF3 = new Date(nowF3.getFullYear(), nowF3.getMonth() - 1, 1);
    const bulanLama = tglBulanLamaF3.getFullYear() + '-' + String(tglBulanLamaF3.getMonth() + 1).padStart(2, '0');
    const resetData = resetSheet.getDataRange().getValues();
    const userSheet = ss.getSheetByName('Users');
    const userData  = userSheet ? userSheet.getDataRange().getValues() : [[]];
    const userMap   = {};
    for (let i = 1; i < userData.length; i++) {
      const un = String(userData[i][1]).trim();
      userMap[un] = { fullName: userData[i][7] || un, kelas: String(userData[i][6] || '').trim() };
    }
    for (let i = 1; i < resetData.length; i++) {
      const level    = parseInt(resetData[i][3]) || 0;
      const username = plainText(resetData[i][1]).trim();
      const saldo    = _parseSaldoSPK(resetData[i][2], 50);
      const periode  = _normalizeBulanSPK(resetData[i][0]);
      if (level < (cfg.spk_notif_threshold || 3)) continue;
      if (!userMap[username]) continue;
      if (periode !== bulanLama) continue;
      kirimNotifEksternalSPK(
        username, userMap[username].fullName, userMap[username].kelas,
        saldo, level, formatTanggalSPK(new Date(), false, false)
      );
    }
  } catch(e) { Logger.log('F3 reset eksternal error: ' + e.message); }
}
function setupTriggerResetBulananF3() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    const fn = t.getHandlerFunction();
    if (fn === 'triggerResetPoinBulanan' || fn === 'triggerResetPoinBulananF3') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('triggerResetPoinBulananF3')
    .timeBased().onMonthDay(1).atHour(0).create();
  return { success: true, message: 'Trigger reset bulanan (Fase 3) berhasil diperbarui.' };
}
function getPoinSiswaBimbingan(guruUsername, bulan) {
  try {
    initSheetsSPK();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!bulan) bulan = getBulanSPK();
    const gwSheet = ss.getSheetByName('Guru_Wali');
    if (!gwSheet || gwSheet.getLastRow() < 2) {
      return { success: true, data: [], bulan: bulan, message: 'Belum ada data Guru Wali.' };
    }
    const gwData   = gwSheet.getDataRange().getValues();
    let siswaList  = [];
    for (let i = 1; i < gwData.length; i++) {
      if (String(gwData[i][1]).trim() !== String(guruUsername).trim()) continue;
      try {
        const parsed = JSON.parse(gwData[i][3] || '[]');
        siswaList = parsed.filter(s => s && s.username);
      } catch(e) { siswaList = []; }
      break;
    }
    if (siswaList.length === 0) {
      return { success: true, data: [], bulan: bulan, message: 'Tidak ada siswa bimbingan yang terdaftar.' };
    }
    const saldoSheet = ss.getSheetByName('PoinSaldo');
    const saldoData  = saldoSheet ? saldoSheet.getDataRange().getValues() : [[]];
    const saldoMap = {};
    for (let i = 1; i < saldoData.length; i++) {
      if (_normalizeBulanSPK(saldoData[i][1]) !== bulan) continue;
      const u = plainText(saldoData[i][0]).trim();
      if (!u || u.indexOf('_dup_') === 0) continue;
      saldoMap[u] = {
        saldo:            _parseSaldoSPK(saldoData[i][2], 50),
        totalPelanggaran: parseInt(saldoData[i][3]) || 0,
        totalKebaikan:    parseInt(saldoData[i][4]) || 0,
        level:            parseInt(saldoData[i][5]) || 0,
        flagR03:          saldoData[i][6] === true
      };
    }
    const userSheet = ss.getSheetByName('Users');
    const userData  = userSheet ? userSheet.getDataRange().getValues() : [[]];
    const userMap   = {};
    for (let i = 1; i < userData.length; i++) {
      const un = plainText(String(userData[i][1] || ''));
      userMap[un] = {
        fullName: plainText(String(userData[i][7] || userData[i][1] || '')),
        kelas:    String(userData[i][6] || '').trim()
      };
    }
    const result = siswaList.map(s => {
      const username = String(s.username).trim();
      const info     = userMap[username] || { fullName: s.nama || username, kelas: '-' };
      let sd = saldoMap[username];
      if (!sd) {
        for (const k in saldoMap) {
          if (_cmpUsername(k, username)) { sd = saldoMap[k]; break; }
        }
      }
      sd = sd || { saldo: 50, totalPelanggaran: 0, totalKebaikan: 0, level: 1, flagR03: false };
      return {
        username,
        fullName:         info.fullName,
        kelas:            info.kelas,
        saldo:            sd.saldo,
        level:            sd.level,
        totalPelanggaran: sd.totalPelanggaran,
        totalKebaikan:    sd.totalKebaikan,
        flagR03:          sd.flagR03
      };
    });
    result.sort((a, b) => a.saldo - b.saldo);
    return { success: true, data: result, bulan: bulan };
  } catch(e) {
    return { success: false, message: e.message };
  }
}
function getPoinSiswaDashboard(username, bulan) {
  try {
    initSheetsSPK();
    if (!bulan) bulan = getBulanSPK();
    const poinRes = getPoinSiswa(username, bulan);
    if (!poinRes.success) return { success: false, message: poinRes.message };
    const ss         = SpreadsheetApp.getActiveSpreadsheet();
    const saldoSheet = ss.getSheetByName('PoinSaldo');
    const resetSheet = ss.getSheetByName('PoinResetLog');
    const BULAN_LABEL = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    const now = new Date();
    const tren = [];
    for (let i = 11; i >= 0; i--) {
      const d    = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key  = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      const label = BULAN_LABEL[d.getMonth()] + ' \'' + String(d.getFullYear()).slice(2);
      tren.push({ key: key, label: label, saldo: null });
    }
    if (saldoSheet && saldoSheet.getLastRow() >= 2) {
      const saldoData = saldoSheet.getDataRange().getValues();
      for (let i = 1; i < saldoData.length; i++) {
        if (!_cmpUsername(saldoData[i][0], username)) continue;
        const key   = _normalizeBulanSPK(saldoData[i][1]);
        const saldo = parseFloat(saldoData[i][2]);
        const t     = tren.find(x => x.key === key);
        if (t) t.saldo = isNaN(saldo) ? 50 : saldo;
      }
    }
    if (resetSheet && resetSheet.getLastRow() >= 2) {
      const resetData = resetSheet.getDataRange().getValues();
      for (let i = 1; i < resetData.length; i++) {
        if (!_cmpUsername(resetData[i][1], username)) continue;
        const key   = _normalizeBulanSPK(resetData[i][0]);
        const saldo = parseFloat(resetData[i][2]);
        const t     = tren.find(x => x.key === key);
        if (t && t.saldo === null) t.saldo = isNaN(saldo) ? 50 : saldo;
      }
    }
    const sotmList = [];
    {
      // Bug fix #4: SoTM ditentukan dari PoinSaldo (saldo aktif per bulan)
      // bukan PoinResetLog, agar bulan aktif yang belum di-reset pun terdeteksi.
      const userSheet = ss.getSheetByName('Users');
      let kelasUser = '';
      const userKelasMap = {};
      if (userSheet) {
        const udCache = userSheet.getDataRange().getValues();
        for (let u = 1; u < udCache.length; u++) {
          // Bug fix #10: bersihkan prefix ' (safeText) dan .0 (angka float) agar
          // key di userKelasMap konsisten dengan plainText() yang dipakai saat lookup.
          const rawU = String(udCache[u][1] == null ? '' : udCache[u][1])
            .replace(/^'+/, '').replace(/\.0$/, '').trim();
          if (!rawU) continue;
          userKelasMap[rawU] = String(udCache[u][6] || '').trim();
          if (_cmpUsername(rawU, username) && !kelasUser) {
            kelasUser = userKelasMap[rawU];
          }
        }
      }
      if (kelasUser && saldoSheet && saldoSheet.getLastRow() >= 2) {
        const saldoData2 = saldoSheet.getDataRange().getValues();
        // Kumpulkan bulan unik yang ada di PoinSaldo
        const bulanUnikSet = new Set();
        for (let i = 1; i < saldoData2.length; i++) {
          const b = _normalizeBulanSPK(saldoData2[i][1]);
          if (b) bulanUnikSet.add(b);
        }
        const bulanUnik = Array.from(bulanUnikSet)
          .sort()
          .slice(-12);  // maks 12 bulan terakhir
        for (const bln of bulanUnik) {
          const saldoKelas = [];
          for (let i = 1; i < saldoData2.length; i++) {
            if (_normalizeBulanSPK(saldoData2[i][1]) !== bln) continue;
            const rowUser = plainText(saldoData2[i][0]).trim();
            if (userKelasMap[rowUser] === kelasUser) {
              saldoKelas.push({
                username: rowUser,
                saldo: _parseSaldoSPK(saldoData2[i][2], 50)
              });
            }
          }
          if (saldoKelas.length > 0) {
            saldoKelas.sort((a, b) => b.saldo - a.saldo);
            if (_cmpUsername(saldoKelas[0].username, username)) {
              sotmList.push({
                bulan: bln,
                bulanLabel: _bulanLabel(bln),
                kelas: kelasUser,
                saldo: saldoKelas[0].saldo
              });
            }
          }
        }
      }
    }
    const katalogRes = getPoinKatalog(true);
    const katalogMap = {};
    if (katalogRes.success) katalogRes.data.forEach(k => { katalogMap[k.kodeID] = k; });
    const events = (poinRes.events || []).map(e => ({
      ...e,
      deskripsiKode: katalogMap[e.kodeID] ? katalogMap[e.kodeID].deskripsi : '',
      kategoriKode:  katalogMap[e.kodeID] ? katalogMap[e.kodeID].kategori  : ''
    }));
    const profileRes = getSchoolProfile();
    const tanggalCetak = formatTanggalSPK(new Date(), true, false);
    const bulanLabel = _bulanLabel(bulan);
    return {
      success:      true,
      saldo:        poinRes.saldo,
      level:        poinRes.level,
      totalPelanggaran: poinRes.totalPelanggaran,
      totalKebaikan:    poinRes.totalKebaikan,
      flagR03:      poinRes.flagR03,
      flagPanggilanWali: poinRes.flagPanggilanWali,
      events:       events,
      bulan:        bulan,
      bulanLabel:   bulanLabel,
      tren:         tren,
      sotmList:     sotmList,
      profile:      profileRes,
      tanggalCetak: tanggalCetak
    };
  } catch(e) {
    return { success: false, message: e.message };
  }
}
function _surveiFormatWIB(date) {
  if (!(date instanceof Date)) date = new Date(date);
  return Utilities.formatDate(date, 'Asia/Jakarta', 'dd MMMM yyyy, HH:mm:ss');
}
function _surveiFormatTanggal(date) {
  if (!(date instanceof Date)) date = new Date(date);
  return Utilities.formatDate(date, 'Asia/Jakarta', 'dd MMMM yyyy');
}
function _surveiParseDate(val) {
  if (!val && val !== 0) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'number') {
    const d = new Date((val - 25569) * 86400 * 1000);
    return isNaN(d.getTime()) ? null : d;
  }
  const s = String(val).trim();
  if (!s) return null;
  let d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  const bulan = ['januari','februari','maret','april','mei','juni','juli','agustus','september','oktober','november','desember'];
  const m = s.toLowerCase().match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})(?:,\s*(\d{1,2}):(\d{1,2}):(\d{1,2}))?/);
  if (m) {
    const idx = bulan.indexOf(m[2]);
    if (idx >= 0) {
      d = new Date(parseInt(m[3], 10), idx, parseInt(m[1], 10),
                   m[4] ? parseInt(m[4], 10) : 0,
                   m[5] ? parseInt(m[5], 10) : 0,
                   m[6] ? parseInt(m[6], 10) : 0);
      if (!isNaN(d.getTime())) return d;
    }
  }
  return null;
}
function _surveiIsUjian(keterangan) {
  if (!keterangan) return false;
  const k = String(keterangan).toLowerCase();
  return /\bujian\b|\buts\b|\buas\b|\bpas\b|\bpat\b|\basesmen\b|\bulangan\b|\busbn\b|\bus\b|\bsumatif\b/i.test(k);
}
function initSheetsSurvei() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = [
    {
      nama: 'Survei_Periode',
      header: ['ID', 'Nama_Periode', 'Tahun_Ajaran', 'Semester', 'Tipe', 'Target_Role',
               'Tanggal_Buka', 'Tanggal_Tutup', 'Status', 'Rencana_Aksi_Status',
               'Dibuat_Oleh', 'Dibuat_Pada', 'Diarsipkan_Pada']
    },
    {
      nama: 'Survei_Jawaban',
      header: ['ID', 'Periode_ID', 'Username', 'Nama_Lengkap', 'Role', 'Kelas',
               'Kode_Pertanyaan', 'Bagian', 'Tipe_Jawaban',
               'Jawaban_Skala', 'Jawaban_Teks', 'Timestamp']
    },
    {
      nama: 'Survei_Peer',
      header: ['ID', 'Periode_ID', 'Penilai_Username', 'Penilai_Nama',
               'Dinilai_Username', 'Dinilai_Nama',
               'PTS_1', 'PTS_2', 'PTS_3', 'PTS_4', 'PTS_5', 'PTS_6', 'PTS_7_Esai',
               'TT_1', 'TT_2', 'TT_3', 'TT_4', 'TT_5', 'TT_6',
               'Status', 'Timestamp_Draft', 'Timestamp_Submit']
    },
    {
      nama: 'Survei_Progress',
      header: ['ID', 'Periode_ID', 'Username', 'Nama_Lengkap', 'Role', 'Kelas',
               'Status_Utama', 'Status_Peer', 'Persen_Selesai',
               'Mapel_Rotasi', 'Peer_Snapshot',
               'Flag_Straightline', 'Flag_Waktu_Singkat', 'Flag_Attention', 'Flag_Keandalan',
               'Waktu_Pengisian_Detik', 'Catatan_Admin',
               'Timestamp_Mulai', 'Timestamp_Selesai']
    },
    {
      nama: 'Survei_Rencana_Aksi',
      header: ['ID', 'Periode_ID', 'No_Urut', 'Deskripsi_Tindakan', 'Penanggung_Jawab',
               'Target_Waktu', 'Aspek_Terkait', 'Status_Ketercapaian',
               'Dibuat_Oleh', 'Dibuat_Pada', 'Diperbarui_Pada']
    },
    {
      nama: 'Survei_AI_Analisis',
      header: ['ID', 'Periode_ID', 'Scope_Analisis', 'Jumlah_Esai_Dianalisis',
               'Hasil_Ringkasan', 'Diminta_Oleh', 'Timestamp_Analisis',
               'Model_AI', 'Token_Digunakan', 'Status', 'Pesan_Error']
    }
  ];
  sheets.forEach(s => {
    let sh = ss.getSheetByName(s.nama);
    if (!sh) {
      sh = ss.insertSheet(s.nama);
      sh.appendRow(s.header);
      sh.getRange(1, 1, 1, s.header.length)
        .setFontWeight('bold')
        .setBackground('#e0e7ff')
        .setFontColor('#3730a3');
      sh.setFrozenRows(1);
    } else {
      if (sh.getLastRow() === 0) {
        sh.appendRow(s.header);
        sh.getRange(1, 1, 1, s.header.length)
          .setFontWeight('bold')
          .setBackground('#e0e7ff')
          .setFontColor('#3730a3');
        sh.setFrozenRows(1);
      }
    }
  });
  const settingsSheet = ss.getSheetByName('Settings');
  if (settingsSheet) {
    const data = settingsSheet.getDataRange().getValues();
    const existingKeys = new Set(data.map(r => String(r[0] || '').trim()));
    const defaults = [
      ['Survei_Threshold_Waktu_Siswa', '120'],
      ['Survei_Threshold_Waktu_Guru', '180'],
      ['Survei_Min_Peer_Substantif', '5'],
      ['Survei_Warning_Hari_Ujian', '14'],
      ['Anthropic_API_Key', ''],
      ['Anthropic_Model', 'claude-sonnet-4-20250514']
    ];
    defaults.forEach(d => {
      if (!existingKeys.has(d[0])) settingsSheet.appendRow(d);
    });
  }
  return { success: true, message: 'Sheet survei siap digunakan.' };
}
function _ensureSheetsSurvei() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName('Survei_Periode') ||
      !ss.getSheetByName('Survei_Jawaban') ||
      !ss.getSheetByName('Survei_Peer') ||
      !ss.getSheetByName('Survei_Progress') ||
      !ss.getSheetByName('Survei_Rencana_Aksi') ||
      !ss.getSheetByName('Survei_AI_Analisis')) {
    initSheetsSurvei();
  }
}
function _isAdminAtauKepalaMadrasah(adminUser) {
  if (!adminUser) return false;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  if (!sheet) return false;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1] || '').trim() === String(adminUser).trim()) {
      const role = data[i][3];
      const tugasRaw = data[i][4] ? String(data[i][4]) : '';
      const tugasArr = tugasRaw.split(',').map(t => t.trim());
      if (role === 'Admin') return true;
      if (role === 'Guru' && tugasArr.indexOf('Kepala Madrasah/Sekolah') >= 0) return true;
      return false;
    }
  }
  return false;
}
function _surveiPeriodeRowToObj(row) {
  if (!row) return null;
  let tBuka  = row[6];
  let tTutup = row[7];
  if (tBuka instanceof Date)  tBuka  = _surveiFormatTanggal(tBuka);
  if (tTutup instanceof Date) tTutup = _surveiFormatTanggal(tTutup);
  let targetRole = [];
  let pertanyaan = [];
  try {
    const parsed = row[5] ? JSON.parse(String(row[5])) : null;
    if (Array.isArray(parsed)) {
      targetRole = parsed;
    } else if (parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed.target))     targetRole = parsed.target;
      if (Array.isArray(parsed.pertanyaan)) pertanyaan = parsed.pertanyaan;
    }
  } catch (e) {
    targetRole = String(row[5] || '').split(',').map(s => s.trim()).filter(s => s);
  }
  return {
    id:                 row[0] || '',
    namaPeriode:        row[1] || '',
    tahunAjaran:        row[2] || '',
    semester:           row[3] || '',
    tipe:               row[4] || '',
    targetRole:         targetRole,
    pertanyaan:         pertanyaan,
    tanggalBuka:        tBuka  || '',
    tanggalTutup:       tTutup || '',
    status:             row[8] || '',
    rencanaAksiStatus:  row[9] || 'belum_diisi',
    dibuatOleh:         row[10] || '',
    dibuatPada:         row[11] || '',
    diarsipkanPada:     row[12] || ''
  };
}
function getSurveiPeriodeAktif() {
  try {
    _ensureSheetsSurvei();
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Survei_Periode');
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true, data: null };
    }
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][4]) === 'semester' && String(data[i][8]) === 'Aktif') {
        return { success: true, data: _surveiPeriodeRowToObj(data[i]) };
      }
    }
    return { success: true, data: null };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
function cekSurveiWajib(username) {
  try {
    if (!username) return { success: true, data: { wajib: false, alasan: 'no_user' } };
    _ensureSheetsSurvei();
    const aktifRes = getSurveiPeriodeAktif();
    if (!aktifRes || !aktifRes.success || !aktifRes.data) {
      return { success: true, data: { wajib: false, alasan: 'no_periode' } };
    }
    const periode = aktifRes.data;
    if (String(periode.tipe || '').toLowerCase() !== 'semester') {
      return { success: true, data: { wajib: false, alasan: 'tipe_bukan_semester' } };
    }
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tglBuka = _surveiParseDate(periode.tanggalBuka);
    const tglTutup = _surveiParseDate(periode.tanggalTutup);
    if (tglBuka && today.getTime() < tglBuka.getTime()) {
      return { success: true, data: { wajib: false, alasan: 'belum_buka' } };
    }
    if (tglTutup) {
      const tutupEnd = new Date(tglTutup.getFullYear(), tglTutup.getMonth(), tglTutup.getDate(), 23, 59, 59, 999);
      if (now.getTime() > tutupEnd.getTime()) {
        return { success: true, data: { wajib: false, alasan: 'sudah_tutup' } };
      }
    }
    const userInfo = _surveiGetUserInfo(username);
    if (!userInfo) return { success: true, data: { wajib: false, alasan: 'user_not_found' } };
    const role = String(userInfo.role || '').trim();
    const targetRoles = Array.isArray(periode.targetRole) ? periode.targetRole : [];
    if (targetRoles.length > 0 && targetRoles.indexOf(role) < 0) {
      return { success: true, data: { wajib: false, alasan: 'role_tidak_target' } };
    }
    if (['Siswa', 'Guru', 'Orangtua'].indexOf(role) < 0) {
      return { success: true, data: { wajib: false, alasan: 'role_tidak_didukung' } };
    }
    const progSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Survei_Progress');
    let statusUtama = 'belum_mulai';
    if (progSheet && progSheet.getLastRow() > 1) {
      const progData = progSheet.getDataRange().getValues();
      for (let i = 1; i < progData.length; i++) {
        if (String(progData[i][1]) === String(periode.id) && _cmpUsername(progData[i][2], username)) {
          statusUtama = String(progData[i][6] || 'belum_mulai').toLowerCase();
          break;
        }
      }
    }
    if (statusUtama === 'selesai' || statusUtama === 'submitted') {
      return { success: true, data: { wajib: false, alasan: 'sudah_selesai', statusUtama: statusUtama } };
    }
    return {
      success: true,
      data: {
        wajib: true,
        statusUtama: statusUtama,
        role: role,
        periode: {
          id: periode.id,
          namaPeriode: periode.namaPeriode,
          tahunAjaran: periode.tahunAjaran,
          tanggalTutup: periode.tanggalTutup
        }
      }
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
function getAllSurveiPeriode(adminUser) {
  try {
    if (!_isAdminAtauKepalaMadrasah(adminUser)) {
      return { success: false, message: 'Akses ditolak. Hanya Admin atau Kepala Madrasah yang dapat mengakses fitur ini.' };
    }
    _ensureSheetsSurvei();
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Survei_Periode');
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true, data: [] };
    }
    const data = sheet.getDataRange().getValues();
    const list = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) list.push(_surveiPeriodeRowToObj(data[i]));
    }
    list.sort((a, b) => {
      if (a.status === 'Aktif' && b.status !== 'Aktif') return -1;
      if (a.status !== 'Aktif' && b.status === 'Aktif') return 1;
      const da = _surveiParseDate(a.dibuatPada);
      const db = _surveiParseDate(b.dibuatPada);
      if (da && db) return db.getTime() - da.getTime();
      return 0;
    });
    return { success: true, data: list };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
function cekTimingUjian(tglBuka) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let warningHari = 14;
    const settings = ss.getSheetByName('Settings');
    if (settings) {
      const sd = settings.getDataRange().getValues();
      for (let i = 0; i < sd.length; i++) {
        if (String(sd[i][0]).trim() === 'Survei_Warning_Hari_Ujian') {
          const n = parseInt(sd[i][1], 10);
          if (!isNaN(n) && n > 0) warningHari = n;
          break;
        }
      }
    }
    const tBuka = _surveiParseDate(tglBuka);
    if (!tBuka) {
      return { success: true, data: { aman: true, selisihHari: null, pesanPeringatan: '' } };
    }
    tBuka.setHours(0, 0, 0, 0);
    const liburSheet = ss.getSheetByName('Hari_Libur');
    if (!liburSheet || liburSheet.getLastRow() < 2) {
      return { success: true, data: { aman: true, selisihHari: null, pesanPeringatan: '' } };
    }
    const data = liburSheet.getDataRange().getValues();
    let nearestUjian = null;
    let nearestKet   = '';
    let nearestSelisih = Infinity;
    for (let i = 1; i < data.length; i++) {
      const tgl = _surveiParseDate(data[i][1]);
      const ket = data[i][2];
      if (!tgl || !_surveiIsUjian(ket)) continue;
      tgl.setHours(0, 0, 0, 0);
      const selisihHari = Math.round((tgl.getTime() - tBuka.getTime()) / (1000 * 60 * 60 * 24));
      if (selisihHari < 0) continue;
      if (selisihHari < nearestSelisih) {
        nearestSelisih = selisihHari;
        nearestUjian   = tgl;
        nearestKet     = ket;
      }
    }
    if (!nearestUjian) {
      return { success: true, data: { aman: true, selisihHari: null, pesanPeringatan: '' } };
    }
    const aman = nearestSelisih >= warningHari;
    const pesan = aman ? '' :
      'Survei akan dibuka ' + nearestSelisih + ' hari sebelum jadwal ujian (' +
      _surveiFormatTanggal(nearestUjian) + ' — ' + nearestKet + '). ' +
      'Respons yang diberikan dalam kondisi tekanan ujian berpotensi tidak mencerminkan kondisi sebenarnya. ' +
      'Disarankan membuka survei minimal ' + warningHari + ' hari sebelum ujian. Lanjutkan tetap?';
    return {
      success: true,
      data: {
        aman: aman,
        selisihHari: nearestSelisih,
        tanggalUjian: _surveiFormatTanggal(nearestUjian),
        keteranganUjian: String(nearestKet || ''),
        pesanPeringatan: pesan
      }
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
function createSurveiPeriode(nama, tahunAjaran, semester, tipe, targetRole, tglBuka, tglTutup, adminUser, overrideTimingWarning) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    if (!_isAdminAtauKepalaMadrasah(adminUser)) {
      return { success: false, message: 'Akses ditolak. Hanya Admin atau Kepala Madrasah yang dapat membuat periode survei.' };
    }
    nama        = String(nama || '').trim();
    tahunAjaran = String(tahunAjaran || '').trim();
    semester    = String(semester || '').trim();
    tipe        = String(tipe || '').trim().toLowerCase();
    if (!nama)        return { success: false, message: 'Nama periode wajib diisi.' };
    if (!tahunAjaran) return { success: false, message: 'Tahun ajaran wajib diisi.' };
    if (tipe !== 'semester' && tipe !== 'mikro') {
      return { success: false, message: 'Tipe periode harus "semester" atau "mikro".' };
    }
    if (tipe === 'semester' && semester !== 'Ganjil' && semester !== 'Genap') {
      return { success: false, message: 'Semester harus "Ganjil" atau "Genap" untuk tipe semester.' };
    }
    let targetRoleArr = [];
    if (Array.isArray(targetRole)) {
      targetRoleArr = targetRole.map(r => String(r || '').trim()).filter(r => r);
    } else if (typeof targetRole === 'string') {
      try {
        const p = JSON.parse(targetRole);
        if (Array.isArray(p)) targetRoleArr = p.map(r => String(r || '').trim()).filter(r => r);
      } catch (_) {
        targetRoleArr = targetRole.split(',').map(r => r.trim()).filter(r => r);
      }
    }
    const validRoles = ['Siswa', 'Guru', 'Orangtua'];
    targetRoleArr = targetRoleArr.filter(r => validRoles.indexOf(r) >= 0);
    if (targetRoleArr.length === 0) {
      return { success: false, message: 'Pilih minimal satu target role (Siswa / Guru / Orangtua).' };
    }
    const tBuka  = _surveiParseDate(tglBuka);
    const tTutup = _surveiParseDate(tglTutup);
    if (!tBuka)  return { success: false, message: 'Tanggal buka tidak valid.' };
    if (!tTutup) return { success: false, message: 'Tanggal tutup tidak valid.' };
    if (tTutup.getTime() <= tBuka.getTime()) {
      return { success: false, message: 'Tanggal tutup harus lebih besar dari tanggal buka.' };
    }
    _ensureSheetsSurvei();
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Survei_Periode');
    if (tipe === 'semester') {
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][4]) === 'semester' && String(data[i][8]) === 'Aktif') {
          return {
            success: false,
            message: 'Sudah ada periode semester yang Aktif: "' + (data[i][1] || '-') +
                     '". Tutup periode tersebut terlebih dahulu sebelum membuat yang baru.'
          };
        }
      }
    }
    const timing = cekTimingUjian(tglBuka);
    if (timing && timing.success && timing.data && !timing.data.aman && !overrideTimingWarning) {
      return {
        success: false,
        needConfirm: true,
        timingWarning: timing.data,
        message: timing.data.pesanPeringatan
      };
    }
    const id = Utilities.getUuid();
    const now = new Date();
    sheet.appendRow([
      id,
      nama,
      tahunAjaran,
      tipe === 'semester' ? semester : '',
      tipe,
      JSON.stringify(targetRoleArr),
      _surveiFormatTanggal(tBuka),
      _surveiFormatTanggal(tTutup),
      'Aktif',
      'belum_diisi',
      adminUser,
      _surveiFormatWIB(now),
      ''
    ]);
    logActivity(adminUser, 'CREATE_SURVEI_PERIODE',
      'Membuat periode survei: ' + nama + ' (' + tipe + ')');
    return {
      success: true,
      data: { id: id, nama: nama },
      timingWarning: (timing && timing.success) ? timing.data : null
    };
  } catch (e) {
    return { success: false, message: e.message };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}
function updateSurveiPeriode(periodeId, nama, tahunAjaran, semester, targetRole, tglBuka, tglTutup, adminUser) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    if (!_isAdminAtauKepalaMadrasah(adminUser)) {
      return { success: false, message: 'Akses ditolak. Hanya Admin atau Kepala Madrasah yang dapat mengedit periode survei.' };
    }
    nama        = String(nama || '').trim();
    tahunAjaran = String(tahunAjaran || '').trim();
    semester    = String(semester || '').trim();
    if (!nama)        return { success: false, message: 'Nama periode wajib diisi.' };
    if (!tahunAjaran) return { success: false, message: 'Tahun ajaran wajib diisi.' };
    let targetRoleArr = [];
    if (Array.isArray(targetRole)) {
      targetRoleArr = targetRole.map(function(r) { return String(r || '').trim(); }).filter(function(r) { return r; });
    } else if (typeof targetRole === 'string') {
      try {
        var p = JSON.parse(targetRole);
        if (Array.isArray(p)) targetRoleArr = p.map(function(r) { return String(r || '').trim(); }).filter(function(r) { return r; });
      } catch (_) {
        targetRoleArr = targetRole.split(',').map(function(r) { return r.trim(); }).filter(function(r) { return r; });
      }
    }
    var validRoles = ['Siswa', 'Guru', 'Orangtua'];
    targetRoleArr = targetRoleArr.filter(function(r) { return validRoles.indexOf(r) >= 0; });
    if (targetRoleArr.length === 0) {
      return { success: false, message: 'Pilih minimal satu target role (Siswa / Guru / Orangtua).' };
    }
    var tBuka  = _surveiParseDate(tglBuka);
    var tTutup = _surveiParseDate(tglTutup);
    if (!tBuka)  return { success: false, message: 'Tanggal buka tidak valid.' };
    if (!tTutup) return { success: false, message: 'Tanggal tutup tidak valid.' };
    if (tTutup.getTime() <= tBuka.getTime()) {
      return { success: false, message: 'Tanggal tutup harus lebih besar dari tanggal buka.' };
    }
    _ensureSheetsSurvei();
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Survei_Periode');
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: false, message: 'Periode tidak ditemukan.' };
    }
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(periodeId)) {
        var tipe = String(data[i][4] || '').toLowerCase();
        if (tipe === 'mikro') {
          return { success: false, message: 'Periode Mikro tidak dapat diedit melalui fungsi ini.' };
        }
        if (tipe === 'semester' && semester !== 'Ganjil' && semester !== 'Genap') {
          return { success: false, message: 'Semester harus "Ganjil" atau "Genap" untuk tipe semester.' };
        }
        sheet.getRange(i + 1, 2).setValue(nama);
        sheet.getRange(i + 1, 3).setValue(tahunAjaran);
        sheet.getRange(i + 1, 4).setValue(tipe === 'semester' ? semester : '');
        sheet.getRange(i + 1, 6).setValue(JSON.stringify(targetRoleArr));
        sheet.getRange(i + 1, 7).setValue(_surveiFormatTanggal(tBuka));
        sheet.getRange(i + 1, 8).setValue(_surveiFormatTanggal(tTutup));
        logActivity(adminUser, 'UPDATE_SURVEI_PERIODE',
          'Mengedit periode survei: ' + nama + ' (ID: ' + periodeId + ')');
        return { success: true, data: { id: periodeId, nama: nama } };
      }
    }
    return { success: false, message: 'Periode tidak ditemukan.' };
  } catch (e) {
    return { success: false, message: e.message };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}
function tutupSurveiPeriode(periodeId, adminUser) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    if (!_isAdminAtauKepalaMadrasah(adminUser)) {
      return { success: false, message: 'Akses ditolak. Hanya Admin atau Kepala Madrasah yang dapat menutup periode.' };
    }
    if (!periodeId) {
      return { success: false, message: 'ID periode tidak boleh kosong.' };
    }
    _ensureSheetsSurvei();
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Survei_Periode');
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: false, message: 'Periode tidak ditemukan.' };
    }
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(periodeId)) {
        if (String(data[i][8]) !== 'Aktif') {
          return { success: false, message: 'Periode ini sudah tidak aktif.' };
        }
        sheet.getRange(i + 1, 9).setValue('Arsip');
        sheet.getRange(i + 1, 13).setValue(_surveiFormatWIB(new Date()));
        SpreadsheetApp.flush();
        logActivity(adminUser, 'CLOSE_SURVEI_PERIODE',
          'Menutup periode survei: ' + (data[i][1] || periodeId));
        return { success: true, data: { id: periodeId, nama: data[i][1] || '' } };
      }
    }
    return { success: false, message: 'Periode tidak ditemukan.' };
  } catch (e) {
    return { success: false, message: e.message };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}
function _surveiKodeWajibBaginA() {
  return [
    'A1-1','A1-2','A1-3','A1-4',
    'A2-1','A2-2','A2-3','A2-4',
    'A3-1','A3-2','A3-3','A3-4',
    'A4-1','A4-2','A4-3',
    'A5-1','A5-2','A5-3','A5-4',
    'A6-1','A6-2','A6-3'
  ];
}
function _surveiKodeEsaiBaginA() { return ['A7-1','A7-2','A7-3']; }
function _surveiKodeBaginBLikert(role) {
  const prefix = (role === 'Siswa') ? 'BS' : (role === 'Orangtua') ? 'BOT' : 'BG';
  const arr = [];
  for (let i = 1; i <= 10; i++) arr.push(prefix + '-' + i);
  return arr;
}
function _surveiKodeBaginBEsai(role) {
  const prefix = (role === 'Siswa') ? 'BS' : (role === 'Orangtua') ? 'BOT' : 'BG';
  return [prefix + '-11', prefix + '-12'];
}
function _surveiKodeAttention(role) {
  return (role === 'Siswa') ? ['ATT-1','ATT-2'] : ['ATT-1'];
}
function _surveiAttentionExpected(kode, role) {
  if (kode === 'ATT-1') return 1;
  if (kode === 'ATT-2' && role === 'Siswa') return 5;
  return 1;
}
function _surveiTotalWajibAB(role) {
  const att = (role === 'Siswa') ? 2 : 1;
  return 25 + 12 + att;
}
function _surveiGetUserInfo(username) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    // BUG FIX #2: Gunakan _cmpUsername agar konsisten dengan seluruh codebase
    // dan tahan terhadap username numerik yang tersimpan sebagai angka di sheet.
    if (_cmpUsername(data[i][1], username)) {
      return {
        username: data[i][1],
        role: data[i][3],
        kelas: data[i][6] || '',
        fullName: data[i][7] || data[i][1] || ''
      };
    }
  }
  return null;
}
function _surveiGetOrCreateProgressRow(periodeId, username, opts) {
  _ensureSheetsSurvei();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Survei_Progress');
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(periodeId) && _cmpUsername(data[i][2], username)) {
      return { rowIdx: i + 1, record: _surveiProgressRowToObj(data[i]), sheet: sheet };
    }
  }
  opts = opts || {};
  const info = opts.userInfo || _surveiGetUserInfo(username);
  if (!info) throw new Error('Pengguna tidak ditemukan: ' + username);
  const id = Utilities.getUuid();
  const now = new Date();
  const row = [
    id,
    periodeId,
    safeText(info.username),  
    info.fullName,
    info.role,
    info.kelas || '',
    'belum_mulai',
    'belum_mulai',
    0,
    '',
    '',
    false,
    false,
    'aman',
    'tinggi',
    0,
    '',
    opts.markStart ? _surveiFormatWIB(now) : '',
    ''
  ];
  sheet.appendRow(row);
  SpreadsheetApp.flush();
  const rowIdx = sheet.getLastRow();
  return { rowIdx: rowIdx, record: _surveiProgressRowToObj(row), sheet: sheet };
}
function _surveiProgressRowToObj(row) {
  if (!row) return null;
  let mapelRot = null;
  try { mapelRot = row[9] ? JSON.parse(String(row[9])) : null; } catch (_) { mapelRot = null; }
  let peerSnap = null;
  try { peerSnap = row[10] ? JSON.parse(String(row[10])) : null; } catch (_) { peerSnap = null; }
  return {
    id:                  row[0] || '',
    periodeId:           row[1] || '',
    username:            row[2] || '',
    namaLengkap:         row[3] || '',
    role:                row[4] || '',
    kelas:               row[5] || '',
    statusUtama:         row[6] || 'belum_mulai',
    statusPeer:          row[7] || 'belum_mulai',
    persenSelesai:       parseFloat(row[8]) || 0,
    mapelRotasi:         mapelRot,
    peerSnapshot:        peerSnap,
    flagStraightline:    row[11] === true || String(row[11]).toLowerCase() === 'true',
    flagWaktuSingkat:    row[12] === true || String(row[12]).toLowerCase() === 'true',
    flagAttention:       row[13] || 'aman',
    flagKeandalan:       row[14] || 'tinggi',
    waktuPengisianDetik: parseInt(row[15], 10) || 0,
    catatanAdmin:        row[16] || '',
    timestampMulai:      row[17] || '',
    timestampSelesai:    row[18] || ''
  };
}
function getSurveiStatus(username, periodeId) {
  try {
    if (!username) return { success: false, message: 'Username kosong.' };
    _ensureSheetsSurvei();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let periode = null;
    if (periodeId) {
      const psheet = ss.getSheetByName('Survei_Periode');
      const pdata  = psheet.getDataRange().getValues();
      for (let i = 1; i < pdata.length; i++) {
        if (String(pdata[i][0]) === String(periodeId)) {
          periode = _surveiPeriodeRowToObj(pdata[i]);
          break;
        }
      }
      if (!periode) return { success: false, message: 'Periode tidak ditemukan.' };
    } else {
      const aktif = getSurveiPeriodeAktif();
      if (!aktif || !aktif.success || !aktif.data) {
        return { success: true, data: { periode: null, progress: null, jawaban: [] } };
      }
      periode = aktif.data;
      periodeId = periode.id;
    }
    const progressSheet = ss.getSheetByName('Survei_Progress');
    const pdata2 = progressSheet.getDataRange().getValues();
    let progress = null;
    for (let i = 1; i < pdata2.length; i++) {
      if (String(pdata2[i][1]) === String(periodeId) && _cmpUsername(pdata2[i][2], username)) {
        progress = _surveiProgressRowToObj(pdata2[i]);
        break;
      }
    }
    const jawaban = [];
    const jsheet = ss.getSheetByName('Survei_Jawaban');
    if (jsheet && jsheet.getLastRow() > 1) {
      const jdata = jsheet.getDataRange().getValues();
      for (let i = 1; i < jdata.length; i++) {
        if (String(jdata[i][1]) === String(periodeId) && _cmpUsername(jdata[i][2], username)) {
          jawaban.push({
            kode:      jdata[i][6] || '',
            bagian:    jdata[i][7] || '',
            tipe:      jdata[i][8] || '',
            skala:     (jdata[i][9] === '' || jdata[i][9] === null) ? null : parseInt(jdata[i][9], 10),
            teks:      jdata[i][10] == null ? '' : String(jdata[i][10]),
            timestamp: jdata[i][11] || ''
          });
        }
      }
    }
    return {
      success: true,
      data: {
        periode:  periode,
        progress: progress,
        jawaban:  jawaban
      }
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
function getRencanaAksiPublik(periodeId) {
  try {
    _ensureSheetsSurvei();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!periodeId) {
      const psheet = ss.getSheetByName('Survei_Periode');
      const pdata  = psheet.getDataRange().getValues();
      let candidates = [];
      for (let i = 1; i < pdata.length; i++) {
        if (String(pdata[i][4]) === 'semester') {
          candidates.push({ row: pdata[i], dibuat: _surveiParseDate(pdata[i][11]) });
        }
      }
      candidates.sort(function(a, b) {
        return (b.dibuat ? b.dibuat.getTime() : 0) - (a.dibuat ? a.dibuat.getTime() : 0);
      });
      if (candidates.length === 0) return { success: true, data: { periode: null, poin: [] } };
      periodeId = candidates[0].row[0];
    }
    const psheet = ss.getSheetByName('Survei_Periode');
    const pdata  = psheet.getDataRange().getValues();
    let periode = null;
    for (let i = 1; i < pdata.length; i++) {
      if (String(pdata[i][0]) === String(periodeId)) {
        periode = _surveiPeriodeRowToObj(pdata[i]);
        break;
      }
    }
    if (!periode) return { success: true, data: { periode: null, poin: [] } };
    if (periode.rencanaAksiStatus !== 'sudah_diisi') {
      return { success: true, data: { periode: periode, poin: [] } };
    }
    const sheet = ss.getSheetByName('Survei_Rencana_Aksi');
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true, data: { periode: periode, poin: [] } };
    }
    const data = sheet.getDataRange().getValues();
    const poin = [];
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]) === String(periodeId)) {
        poin.push({
          id:                data[i][0] || '',
          noUrut:            parseInt(data[i][2], 10) || 0,
          deskripsi:         data[i][3] || '',
          penanggungJawab:   data[i][4] || '',
          targetWaktu:       data[i][5] || '',
          aspekTerkait:      data[i][6] || '',
          statusKetercapaian: data[i][7] || 'belum',
          dibuatPada:        data[i][9] || '',
          diperbaruiPada:    data[i][10] || ''
        });
      }
    }
    poin.sort(function(a, b) { return a.noUrut - b.noUrut; });
    return { success: true, data: { periode: periode, poin: poin } };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
function _surveiMapelKodeAll() {
  return ['AQH','AKA','FIK','SKI','BAR','PPC','BIN','MTK','IPA','IPS','BIG','INF','PJK','SBD','BTQ'];
}
function _surveiKegiatanKodeAll() { return ['UPB','RHS','SNM','MSP']; }
function _surveiKodeCSiswa(mapelRotasi) {
  const arr = [];
  (mapelRotasi || []).forEach(function(m) {
    arr.push(m + '-1', m + '-2', m + '-3', m + '-4');
    arr.push(m + '-5');
  });
  return arr;
}
function _surveiKodeDSiswa() {
  const arr = [];
  _surveiKegiatanKodeAll().forEach(function(k) {
    arr.push(k + '-1', k + '-2', k + '-3');
    arr.push(k + '-4');
  });
  return arr;
}
function _surveiSeededHash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
function _surveiPrng(seed) {
  let s = seed >>> 0;
  return function() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function generateMapelRotasi(username, periodeId) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    if (!username)  return { success: false, message: 'Username kosong.' };
    if (!periodeId) return { success: false, message: 'Periode tidak ditemukan.' };
    _ensureSheetsSurvei();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const info = _surveiGetUserInfo(username);
    if (!info) return { success: false, message: 'Pengguna tidak ditemukan.' };
    if (info.role !== 'Siswa') {
      return { success: false, message: 'Rotasi mapel hanya untuk role Siswa.' };
    }
    const prog = _surveiGetOrCreateProgressRow(periodeId, username, { userInfo: info, markStart: true });
    if (prog.record.mapelRotasi && Array.isArray(prog.record.mapelRotasi) && prog.record.mapelRotasi.length === 8) {
      return { success: true, data: { mapelRotasi: prog.record.mapelRotasi, baru: false } };
    }
    const periodeSheet = ss.getSheetByName('Survei_Progress');
    const allRows = periodeSheet.getDataRange().getValues();
    const histori = {};
    _surveiMapelKodeAll().forEach(function(m) { histori[m] = 0; });
    for (let i = 1; i < allRows.length; i++) {
      if (!_cmpUsername(allRows[i][2], username)) continue;
      if (String(allRows[i][1] || '') === String(periodeId)) continue;
      const raw = allRows[i][9];
      if (!raw) continue;
      try {
        const arr = JSON.parse(String(raw));
        if (Array.isArray(arr)) {
          arr.forEach(function(m) { if (histori[m] != null) histori[m]++; });
        }
      } catch (_) {}
    }
    const seedStr = String(username) + '|' + String(periodeId);
    const rng = _surveiPrng(_surveiSeededHash(seedStr));
    const candidates = _surveiMapelKodeAll().map(function(m) {
      return { kode: m, count: histori[m] || 0, jitter: rng() };
    });
    candidates.sort(function(a, b) {
      if (a.count !== b.count) return a.count - b.count;
      return a.jitter - b.jitter;
    });
    const chosen = candidates.slice(0, 8).map(function(c) { return c.kode; });
    periodeSheet.getRange(prog.rowIdx, 10).setValue(JSON.stringify(chosen));
    SpreadsheetApp.flush();
    return { success: true, data: { mapelRotasi: chosen, baru: true } };
  } catch (e) {
    return { success: false, message: e.message };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}
function _surveiGetMapelRotasiSiswa(periodeId, username) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Survei_Progress');
  if (!sheet || sheet.getLastRow() < 2) return null;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(periodeId) && _cmpUsername(data[i][2], username)) {
      try {
        const arr = JSON.parse(String(data[i][9] || ''));
        if (Array.isArray(arr) && arr.length === 8) return arr;
      } catch (_) {}
    }
  }
  return null;
}
function saveSurveiJawaban(periodeId, username, jawabanList, logUser) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    if (!periodeId)             return { success: false, message: 'Periode tidak ditemukan.' };
    if (!username)              return { success: false, message: 'Pengguna tidak teridentifikasi.' };
    if (!Array.isArray(jawabanList) || jawabanList.length === 0) {
      return { success: false, message: 'Tidak ada jawaban untuk disimpan.' };
    }
    _ensureSheetsSurvei();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const psheet = ss.getSheetByName('Survei_Periode');
    const pdata  = psheet.getDataRange().getValues();
    let periodeRow = null;
    for (let i = 1; i < pdata.length; i++) {
      if (String(pdata[i][0]) === String(periodeId)) { periodeRow = pdata[i]; break; }
    }
    if (!periodeRow) return { success: false, message: 'Periode tidak ditemukan.' };
    if (String(periodeRow[8]) !== 'Aktif') {
      return { success: false, message: 'Periode survei sudah ditutup. Jawaban tidak dapat disimpan.' };
    }
    const userInfo = _surveiGetUserInfo(username);
    if (!userInfo) return { success: false, message: 'Pengguna tidak ditemukan.' };
    const prog = _surveiGetOrCreateProgressRow(periodeId, username, { userInfo: userInfo, markStart: true });
    const progressSheet = prog.sheet;
    const progressRowIdx = prog.rowIdx;
    if (!prog.record.timestampMulai) {
      progressSheet.getRange(progressRowIdx, 18).setValue(_surveiFormatWIB(new Date()));
    }
    if (prog.record.statusUtama === 'selesai') {
      return { success: false, message: 'Survei sudah disubmit final dan tidak dapat diubah.' };
    }
    let mapelRotasi = null;
    if (userInfo.role === 'Siswa') {
      mapelRotasi = _surveiGetMapelRotasiSiswa(periodeId, username);
    }
    const allMapelKodeSet = {};
    _surveiMapelKodeAll().forEach(function(m) { allMapelKodeSet[m] = true; });
    const allKegiatanSet = {};
    _surveiKegiatanKodeAll().forEach(function(k) { allKegiatanSet[k] = true; });
    const jsheet = ss.getSheetByName('Survei_Jawaban');
    const jdata  = jsheet.getDataRange().getValues();
    const existingMap = {};
    for (let i = 1; i < jdata.length; i++) {
      if (String(jdata[i][1]) === String(periodeId) && _cmpUsername(jdata[i][2], username)) {
        existingMap[String(jdata[i][6] || '')] = i + 1;
      }
    }
    const ts = _surveiFormatWIB(new Date());
    let upserted = 0;
    const rejected = [];
    jawabanList.forEach(function(j) {
      const kode  = String(j.kode || '').trim();
      if (!kode) return;
      let bagian = String(j.bagian || '').trim();
      let tipe   = String(j.tipe   || '').trim().toLowerCase();
      if (kode.indexOf('ATT-') === 0) bagian = 'ATTENTION';
      const m1 = kode.match(/^([A-Z]{2,3})-(\d)$/);
      if (m1 && userInfo.role === 'Siswa') {
        const prefix = m1[1];
        if (allMapelKodeSet[prefix]) {
          if (!mapelRotasi || mapelRotasi.indexOf(prefix) < 0) {
            rejected.push(kode);
            return;
          }
          if (!bagian) bagian = 'C';
        } else if (allKegiatanSet[prefix]) {
          if (!bagian) bagian = 'D';
        }
      } else if (m1 && userInfo.role !== 'Siswa') {
        if (allMapelKodeSet[m1[1]] || allKegiatanSet[m1[1]]) {
          rejected.push(kode);
          return;
        }
      }
      if (!bagian) {
        if (kode.indexOf('A') === 0)  bagian = 'A';
        else if (kode.indexOf('BS-') === 0 || kode.indexOf('BOT-') === 0 || kode.indexOf('BG-') === 0) bagian = 'B';
      }
      if (!tipe) {
        tipe = (j.skala != null && j.skala !== '') ? 'likert' : 'esai';
      }
      let skala = null;
      let teks  = null;
      if (tipe === 'likert') {
        const v = parseInt(j.skala, 10);
        if (isNaN(v) || v < 1 || v > 5) return;
        skala = v;
      } else if (tipe === 'esai') {
        teks = (j.teks == null) ? '' : String(j.teks);
      } else {
        return;
      }
      if (existingMap[kode]) {
        const r = existingMap[kode];
        jsheet.getRange(r, 8).setValue(bagian);
        jsheet.getRange(r, 9).setValue(tipe);
        jsheet.getRange(r, 10).setValue(skala === null ? '' : skala);
        jsheet.getRange(r, 11).setValue(teks  === null ? '' : teks);
        jsheet.getRange(r, 12).setValue(ts);
      } else {
        const id = Utilities.getUuid();
        jsheet.appendRow([
          id,
          periodeId,
          safeText(userInfo.username),  
          userInfo.fullName,
          userInfo.role,
          userInfo.kelas || '',
          kode,
          bagian,
          tipe,
          skala === null ? '' : skala,
          teks  === null ? '' : teks,
          ts
        ]);
        existingMap[kode] = jsheet.getLastRow();
      }
      upserted++;
    });
    const newJData = jsheet.getDataRange().getValues();
    const filledKodeSet = {};
    for (let i = 1; i < newJData.length; i++) {
      if (String(newJData[i][1]) !== String(periodeId)) continue;
      if (!_cmpUsername(newJData[i][2], username))  continue;
      const kode = String(newJData[i][6] || '');
      const tipeR = String(newJData[i][8] || '').toLowerCase();
      const skalaR = newJData[i][9];
      const teksR  = newJData[i][10];
      let isFilled = false;
      if (tipeR === 'likert') {
        const v = parseInt(skalaR, 10);
        isFilled = !isNaN(v) && v >= 1 && v <= 5;
      } else if (tipeR === 'esai') {
        isFilled = (teksR != null && String(teksR).trim().length > 0);
      }
      if (isFilled) filledKodeSet[kode] = true;
    }
    const role = userInfo.role;
    const kodeWajibA   = _surveiKodeWajibBaginA();
    const kodeEsaiA    = _surveiKodeEsaiBaginA();
    const kodeWajibBL  = _surveiKodeBaginBLikert(role);
    const kodeEsaiB    = _surveiKodeBaginBEsai(role);
    const kodeAtt      = _surveiKodeAttention(role);
    let semuaWajib = kodeWajibA.concat(kodeEsaiA, kodeWajibBL, kodeEsaiB, kodeAtt);
    if (role === 'Siswa') {
      if (mapelRotasi && mapelRotasi.length === 8) {
        semuaWajib = semuaWajib.concat(_surveiKodeCSiswa(mapelRotasi));
      }
      semuaWajib = semuaWajib.concat(_surveiKodeDSiswa());
    }
    let cnt = 0;
    semuaWajib.forEach(function(k) { if (filledKodeSet[k]) cnt++; });
    const total = semuaWajib.length;
    const persen = total > 0 ? Math.round((cnt / total) * 1000) / 10 : 0;
    // BUG FIX #3: Jangan timpa statusUtama jika sudah 'selesai'.
    // submitSurveiUtama() bisa sudah set status ke 'selesai', dan jika
    // saveSurveiJawaban dipanggil lagi (mis. race condition atau retry
    // dari client), status akan di-reset paksa ke 'in_progress'.
    const currentStatus = prog.record.statusUtama || 'belum_mulai';
    if (currentStatus === 'selesai') {
      return { success: false, message: 'Survei sudah disubmit final dan tidak dapat diubah.' };
    }
    const statusUtama = (cnt === 0) ? 'belum_mulai' : 'in_progress';
    progressSheet.getRange(progressRowIdx, 7).setValue(statusUtama);
    progressSheet.getRange(progressRowIdx, 9).setValue(persen);
    SpreadsheetApp.flush();
    const result = {
      success: true,
      data: {
        upserted:      upserted,
        persenSelesai: persen,
        statusUtama:   statusUtama,
        total:         total,
        terisi:        cnt
      }
    };
    if (rejected.length > 0) {
      result.data.rejected = rejected;
      result.data.warning = 'Beberapa jawaban ditolak karena kode mapel di luar rotasi siswa atau tidak relevan dengan role: ' + rejected.slice(0,5).join(', ') + (rejected.length > 5 ? '...' : '');
    }
    return result;
  } catch (e) {
    return { success: false, message: e.message };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}
function submitSurveiUtama(periodeId, username, logUser) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    if (!periodeId) return { success: false, message: 'Periode tidak ditemukan.' };
    if (!username)  return { success: false, message: 'Pengguna tidak teridentifikasi.' };
    _ensureSheetsSurvei();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const psheet = ss.getSheetByName('Survei_Periode');
    const pdata  = psheet.getDataRange().getValues();
    let periodeRow = null;
    for (let i = 1; i < pdata.length; i++) {
      if (String(pdata[i][0]) === String(periodeId)) { periodeRow = pdata[i]; break; }
    }
    if (!periodeRow) return { success: false, message: 'Periode tidak ditemukan.' };
    if (String(periodeRow[8]) !== 'Aktif') {
      return { success: false, message: 'Periode survei sudah ditutup.' };
    }
    const userInfo = _surveiGetUserInfo(username);
    if (!userInfo) return { success: false, message: 'Pengguna tidak ditemukan.' };
    const prog = _surveiGetOrCreateProgressRow(periodeId, username, { userInfo: userInfo, markStart: false });
    if (prog.record.statusUtama === 'selesai') {
      return { success: false, message: 'Survei sudah disubmit sebelumnya.' };
    }
    const jsheet = ss.getSheetByName('Survei_Jawaban');
    const jdata  = jsheet.getDataRange().getValues();
    const filled = {};
    for (let i = 1; i < jdata.length; i++) {
      if (String(jdata[i][1]) !== String(periodeId)) continue;
      if (!_cmpUsername(jdata[i][2], username))  continue;
      const kode  = String(jdata[i][6] || '');
      const tipe  = String(jdata[i][8] || '').toLowerCase();
      const skala = jdata[i][9];
      const teks  = jdata[i][10];
      filled[kode] = { tipe: tipe, skala: skala, teks: teks };
    }
    const role = userInfo.role;
    const wajibLikertA = _surveiKodeWajibBaginA();
    const wajibEsaiA   = _surveiKodeEsaiBaginA();
    const wajibLikertB = _surveiKodeBaginBLikert(role);
    const wajibEsaiB   = _surveiKodeBaginBEsai(role);
    const wajibAtt     = _surveiKodeAttention(role);
    const missing = [];
    function checkLikertList(list) {
      list.forEach(function(k) {
        const f = filled[k];
        if (!f || f.tipe !== 'likert') { missing.push(k); return; }
        const v = parseInt(f.skala, 10);
        if (isNaN(v) || v < 1 || v > 5) missing.push(k);
      });
    }
    function checkEsaiList(list) {
      list.forEach(function(k) {
        const f = filled[k];
        if (!f || f.tipe !== 'esai') { missing.push(k); return; }
        if (!f.teks || String(f.teks).trim().length === 0) missing.push(k);
      });
    }
    checkLikertList(wajibLikertA);
    checkEsaiList  (wajibEsaiA);
    checkLikertList(wajibLikertB);
    checkEsaiList  (wajibEsaiB);
    checkLikertList(wajibAtt);
    if (role === 'Siswa') {
      const mapelRotasi = _surveiGetMapelRotasiSiswa(periodeId, username);
      if (!mapelRotasi || mapelRotasi.length !== 8) {
        return { success: false, message: 'Rotasi mata pelajaran belum dibuat. Silakan buka kembali Bagian C terlebih dahulu.' };
      }
      mapelRotasi.forEach(function(m) {
        for (let n = 1; n <= 4; n++) {
          const k = m + '-' + n;
          const f = filled[k];
          if (!f || f.tipe !== 'likert') { missing.push(k); continue; }
          const v = parseInt(f.skala, 10);
          if (isNaN(v) || v < 1 || v > 5) missing.push(k);
        }
        const e = m + '-5';
        const fe = filled[e];
        if (!fe || fe.tipe !== 'esai') missing.push(e);
        else if (!fe.teks || String(fe.teks).trim().length === 0) missing.push(e);
      });
      _surveiKegiatanKodeAll().forEach(function(k) {
        for (let n = 1; n <= 3; n++) {
          const code = k + '-' + n;
          const f = filled[code];
          if (!f || f.tipe !== 'likert') { missing.push(code); continue; }
          const v = parseInt(f.skala, 10);
          if (isNaN(v) || v < 1 || v > 5) missing.push(code);
        }
        const e = k + '-4';
        const fe = filled[e];
        if (!fe || fe.tipe !== 'esai') missing.push(e);
        else if (!fe.teks || String(fe.teks).trim().length === 0) missing.push(e);
      });
    } else if (role === 'Guru') {
      let hasPeer = false;
      const peerSheet = ss.getSheetByName('Survei_Peer');
      if (peerSheet && peerSheet.getLastRow() > 1) {
        const pd = peerSheet.getDataRange().getValues();
        for (let i = 1; i < pd.length; i++) {
          if (String(pd[i][1]) === String(periodeId) &&
              String(pd[i][2]) === String(username) &&
              String(pd[i][19]).toLowerCase() === 'submitted') {
            hasPeer = true;
            break;
          }
        }
      }
      if (!hasPeer) {
        return { success: false, message: 'Penilaian Teman Sejawat (Bagian C) belum lengkap. Silakan selesaikan terlebih dahulu sebelum submit final.' };
      }
    }
    if (missing.length > 0) {
      return {
        success: false,
        message: 'Masih ada ' + missing.length + ' pertanyaan wajib yang belum terisi: ' +
                 missing.slice(0, 5).join(', ') + (missing.length > 5 ? ', ...' : ''),
        data: { missing: missing }
      };
    }
    let allLikertCodes = wajibLikertA.concat(wajibLikertB);
    if (role === 'Siswa') {
      const mapelRotasi = _surveiGetMapelRotasiSiswa(periodeId, username) || [];
      mapelRotasi.forEach(function(m) {
        allLikertCodes = allLikertCodes.concat([m+'-1', m+'-2', m+'-3', m+'-4']);
      });
      _surveiKegiatanKodeAll().forEach(function(k) {
        allLikertCodes = allLikertCodes.concat([k+'-1', k+'-2', k+'-3']);
      });
    }
    let firstVal = null, isStraight = true;
    if (allLikertCodes.length >= 20) {
      for (let i = 0; i < allLikertCodes.length; i++) {
        const v = parseInt((filled[allLikertCodes[i]] || {}).skala, 10);
        // BUG FIX #4: Abaikan nilai NaN (jawaban tidak valid/kosong) dalam deteksi
        // straightline. Sebelumnya, jika v=NaN dan firstVal=NaN, kondisi v !== firstVal
        // selalu true (NaN !== NaN), sehingga isStraight=false meski semua nilai valid sama.
        if (isNaN(v)) continue;
        if (firstVal === null) { firstVal = v; continue; }
        if (v !== firstVal) { isStraight = false; break; }
      }
      // Jika firstVal masih null berarti tidak ada jawaban valid sama sekali → bukan straightline
      if (firstVal === null) isStraight = false;
    } else { isStraight = false; }
    let thresholdSiswa = 120, thresholdGuru = 180;
    const settings = ss.getSheetByName('Settings');
    if (settings) {
      const sd = settings.getDataRange().getValues();
      for (let i = 0; i < sd.length; i++) {
        const k = String(sd[i][0]).trim();
        if (k === 'Survei_Threshold_Waktu_Siswa') {
          const n = parseInt(sd[i][1], 10);
          if (!isNaN(n) && n > 0) thresholdSiswa = n;
        } else if (k === 'Survei_Threshold_Waktu_Guru') {
          const n = parseInt(sd[i][1], 10);
          if (!isNaN(n) && n > 0) thresholdGuru = n;
        }
      }
    }
    const tMulai   = _surveiParseDate(prog.record.timestampMulai);
    const tSelesai = new Date();
    let waktuDetik = 0;
    if (tMulai) waktuDetik = Math.max(0, Math.round((tSelesai.getTime() - tMulai.getTime()) / 1000));
    let isWaktuSingkat = false;
    if (role === 'Siswa')      isWaktuSingkat = waktuDetik > 0 && waktuDetik < thresholdSiswa;
    else if (role === 'Guru')  isWaktuSingkat = waktuDetik > 0 && waktuDetik < thresholdGuru;
    else                       isWaktuSingkat = waktuDetik > 0 && waktuDetik < thresholdSiswa;
    let attGagal = 0;
    wajibAtt.forEach(function(k) {
      const f = filled[k];
      if (!f) { attGagal++; return; }
      const v = parseInt(f.skala, 10);
      const expected = _surveiAttentionExpected(k, role);
      if (v !== expected) attGagal++;
    });
    const flagAttention = (attGagal === 0) ? 'aman' : (attGagal === 1 ? 'peringatan' : 'tidak_valid');
    let flagKeandalan = 'tinggi';
    const flagsActive = (isStraight ? 1 : 0) + (isWaktuSingkat ? 1 : 0) + (flagAttention === 'tidak_valid' ? 1 : 0);
    if (flagsActive >= 2) flagKeandalan = 'rendah';
    else if (flagsActive === 1 || flagAttention === 'peringatan') flagKeandalan = 'sedang';
    const progressSheet = prog.sheet;
    const r = prog.rowIdx;
    progressSheet.getRange(r, 7).setValue('selesai');
    progressSheet.getRange(r, 9).setValue(100);
    progressSheet.getRange(r, 12).setValue(isStraight === true);
    progressSheet.getRange(r, 13).setValue(isWaktuSingkat === true);
    progressSheet.getRange(r, 14).setValue(flagAttention);
    progressSheet.getRange(r, 15).setValue(flagKeandalan);
    progressSheet.getRange(r, 16).setValue(waktuDetik);
    progressSheet.getRange(r, 19).setValue(_surveiFormatWIB(tSelesai));
    SpreadsheetApp.flush();
    logActivity(logUser || username, 'SUBMIT_SURVEI',
      'Submit final survei (' + role + '): periode=' + (periodeRow[1] || periodeId) +
      '; durasi=' + waktuDetik + 's; flags={ straight:' + isStraight + ', waktu:' + isWaktuSingkat + ', att:' + flagAttention + ', keandalan:' + flagKeandalan + ' }');
    return {
      success: true,
      data: {
        statusUtama:      'selesai',
        flagStraightline: isStraight,
        flagWaktuSingkat: isWaktuSingkat,
        flagAttention:    flagAttention,
        flagKeandalan:    flagKeandalan,
        waktuDetik:       waktuDetik,
        rencanaAksiStatus: periodeRow[9] || 'belum_diisi',
        namaPeriode:      periodeRow[1] || ''
      }
    };
  } catch (e) {
    return { success: false, message: e.message };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}
function _surveiGetAllGuruAktif() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const out = [];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][3] || '').trim() !== 'Guru') continue;
    out.push({
      username: String(data[i][1] || '').trim(),
      fullName: String(data[i][7] || data[i][1] || '').trim(),
      tugasTambahan: data[i][4] ? String(data[i][4]).split(',').map(function(t){return t.trim();}) : []
    });
  }
  return out.filter(function(u) { return u.username; });
}
function generatePeerSnapshot(periodeId, penilaiUsername) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    if (!penilaiUsername) return { success: false, message: 'Username penilai kosong.' };
    if (!periodeId)       return { success: false, message: 'Periode tidak ditemukan.' };
    _ensureSheetsSurvei();
    const info = _surveiGetUserInfo(penilaiUsername);
    if (!info) return { success: false, message: 'Pengguna tidak ditemukan.' };
    if (info.role !== 'Guru') {
      return { success: false, message: 'Penilaian Teman Sejawat hanya untuk role Guru.' };
    }
    const prog = _surveiGetOrCreateProgressRow(periodeId, penilaiUsername, { userInfo: info, markStart: true });
    if (prog.record.peerSnapshot && Array.isArray(prog.record.peerSnapshot) && prog.record.peerSnapshot.length > 0) {
      return { success: true, data: { peerSnapshot: prog.record.peerSnapshot, baru: false } };
    }
    const allGuru = _surveiGetAllGuruAktif();
    const peers = allGuru.filter(function(g) { return g.username !== penilaiUsername; });
    if (peers.length === 0) {
      return { success: false, message: 'Tidak ada rekan guru aktif untuk dinilai.' };
    }
    let chosen = peers.map(function(p) { return p.username; });
    if (chosen.length > 12) {
      const seed = _surveiSeededHash(String(penilaiUsername) + '|' + String(periodeId));
      const rng = _surveiPrng(seed);
      chosen = peers.slice().map(function(p) {
        return { username: p.username, jitter: rng() };
      }).sort(function(a, b) { return a.jitter - b.jitter; }).slice(0, 12).map(function(p) { return p.username; });
    }
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Survei_Progress');
    sheet.getRange(prog.rowIdx, 11).setValue(JSON.stringify(chosen));
    SpreadsheetApp.flush();
    return { success: true, data: { peerSnapshot: chosen, baru: true } };
  } catch (e) {
    return { success: false, message: e.message };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}
function getSurveiPeerStatus(periodeId, penilaiUsername) {
  try {
    if (!penilaiUsername) return { success: false, message: 'Username penilai kosong.' };
    if (!periodeId)       return { success: false, message: 'Periode tidak ditemukan.' };
    _ensureSheetsSurvei();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const info = _surveiGetUserInfo(penilaiUsername);
    if (!info) return { success: false, message: 'Pengguna tidak ditemukan.' };
    if (info.role !== 'Guru') {
      return { success: false, message: 'Penilaian Teman Sejawat hanya untuk role Guru.' };
    }
    const snapRes = generatePeerSnapshot(periodeId, penilaiUsername);
    if (!snapRes || !snapRes.success) return snapRes;
    const peerSnapshot = snapRes.data.peerSnapshot || [];
    const userMap = {};
    _surveiGetAllGuruAktif().forEach(function(g) { userMap[g.username] = g.fullName; });
    const peerSheet = ss.getSheetByName('Survei_Peer');
    const peerData  = (peerSheet && peerSheet.getLastRow() > 1) ? peerSheet.getDataRange().getValues() : [];
    const draftMap = {};
    for (let i = 1; i < peerData.length; i++) {
      if (String(peerData[i][1]) !== String(periodeId))            continue;
      if (String(peerData[i][2]) !== String(penilaiUsername))      continue;
      const dinilai = String(peerData[i][4] || '');
      if (!dinilai) continue;
      draftMap[dinilai] = {
        id:          peerData[i][0],
        pts1:        peerData[i][6]  === '' || peerData[i][6]  === null ? null : parseInt(peerData[i][6],  10),
        pts2:        peerData[i][7]  === '' || peerData[i][7]  === null ? null : parseInt(peerData[i][7],  10),
        pts3:        peerData[i][8]  === '' || peerData[i][8]  === null ? null : parseInt(peerData[i][8],  10),
        pts4:        peerData[i][9]  === '' || peerData[i][9]  === null ? null : parseInt(peerData[i][9],  10),
        pts5:        peerData[i][10] === '' || peerData[i][10] === null ? null : parseInt(peerData[i][10], 10),
        pts6:        peerData[i][11] === '' || peerData[i][11] === null ? null : parseInt(peerData[i][11], 10),
        pts7Esai:    peerData[i][12] == null ? '' : String(peerData[i][12]),
        tt1:         peerData[i][13] === true || String(peerData[i][13]).toLowerCase() === 'true',
        tt2:         peerData[i][14] === true || String(peerData[i][14]).toLowerCase() === 'true',
        tt3:         peerData[i][15] === true || String(peerData[i][15]).toLowerCase() === 'true',
        tt4:         peerData[i][16] === true || String(peerData[i][16]).toLowerCase() === 'true',
        tt5:         peerData[i][17] === true || String(peerData[i][17]).toLowerCase() === 'true',
        tt6:         peerData[i][18] === true || String(peerData[i][18]).toLowerCase() === 'true',
        status:      String(peerData[i][19] || 'draft').toLowerCase()
      };
    }
    const peerList = peerSnapshot.map(function(u) {
      const rec = draftMap[u];
      let status = 'belum_dimulai';
      if (rec) status = rec.status === 'submitted' ? 'submitted' : 'draft';
      return {
        username: u,
        fullName: userMap[u] || u,
        status:   status,
        ptsData:  rec ? {
          pts1: rec.pts1, pts2: rec.pts2, pts3: rec.pts3, pts4: rec.pts4, pts5: rec.pts5, pts6: rec.pts6,
          pts7Esai: rec.pts7Esai,
          tt1: rec.tt1, tt2: rec.tt2, tt3: rec.tt3, tt4: rec.tt4, tt5: rec.tt5, tt6: rec.tt6
        } : null
      };
    });
    const prog = _surveiGetOrCreateProgressRow(periodeId, penilaiUsername, { userInfo: info, markStart: false });
    return {
      success: true,
      data: {
        peerList:    peerList,
        statusPeer:  prog.record.statusPeer || 'belum_mulai',
        peerSnapshot: peerSnapshot
      }
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
function saveSurveiPeerDraft(periodeId, penilaiUsername, dinilaiUsername, ptsData, logUser) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    if (!periodeId)        return { success: false, message: 'Periode tidak ditemukan.' };
    if (!penilaiUsername)  return { success: false, message: 'Penilai tidak teridentifikasi.' };
    if (!dinilaiUsername)  return { success: false, message: 'Rekan yang dinilai tidak teridentifikasi.' };
    if (penilaiUsername === dinilaiUsername) {
      return { success: false, message: 'Anda tidak dapat menilai diri sendiri.' };
    }
    _ensureSheetsSurvei();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const psheet = ss.getSheetByName('Survei_Periode');
    const pdata  = psheet.getDataRange().getValues();
    let periodeRow = null;
    for (let i = 1; i < pdata.length; i++) {
      if (String(pdata[i][0]) === String(periodeId)) { periodeRow = pdata[i]; break; }
    }
    if (!periodeRow) return { success: false, message: 'Periode tidak ditemukan.' };
    if (String(periodeRow[8]) !== 'Aktif') {
      return { success: false, message: 'Periode survei sudah ditutup.' };
    }
    const info = _surveiGetUserInfo(penilaiUsername);
    if (!info) return { success: false, message: 'Penilai tidak ditemukan di sistem.' };
    if (info.role !== 'Guru') return { success: false, message: 'Penilaian Teman Sejawat hanya untuk role Guru.' };
    const dinilaiInfo = _surveiGetUserInfo(dinilaiUsername);
    if (!dinilaiInfo) return { success: false, message: 'Rekan yang dinilai tidak ditemukan.' };
    if (dinilaiInfo.role !== 'Guru') return { success: false, message: 'Rekan yang dinilai bukan role Guru.' };
    const prog = _surveiGetOrCreateProgressRow(periodeId, penilaiUsername, { userInfo: info, markStart: true });
    let snapshot = prog.record.peerSnapshot;
    if (!snapshot || !Array.isArray(snapshot) || snapshot.length === 0) {
      const snapRes = generatePeerSnapshot(periodeId, penilaiUsername);
      if (!snapRes.success) return snapRes;
      snapshot = snapRes.data.peerSnapshot;
    }
    if (snapshot.indexOf(dinilaiUsername) < 0) {
      return { success: false, message: 'Rekan ini tidak termasuk daftar penilaian Anda untuk periode ini.' };
    }
    if (prog.record.statusUtama === 'selesai') {
      return { success: false, message: 'Survei sudah disubmit final dan tidak dapat diubah.' };
    }
    ptsData = ptsData || {};
    function num(v) {
      if (v === null || v === undefined || v === '') return null;
      const n = parseInt(v, 10);
      if (isNaN(n) || n < 1 || n > 5) return null;
      return n;
    }
    function bln(v) { return v === true || String(v).toLowerCase() === 'true'; }
    const norm = {
      pts1: num(ptsData.pts1), pts2: num(ptsData.pts2), pts3: num(ptsData.pts3),
      pts4: num(ptsData.pts4), pts5: num(ptsData.pts5), pts6: num(ptsData.pts6),
      pts7Esai: ptsData.pts7Esai == null ? '' : String(ptsData.pts7Esai),
      tt1: bln(ptsData.tt1), tt2: bln(ptsData.tt2), tt3: bln(ptsData.tt3),
      tt4: bln(ptsData.tt4), tt5: bln(ptsData.tt5), tt6: bln(ptsData.tt6)
    };
    ['1','2','3','4','5','6'].forEach(function(n) {
      if (norm['tt' + n]) norm['pts' + n] = null;
    });
    const peerSheet = ss.getSheetByName('Survei_Peer');
    const peerData  = peerSheet.getDataRange().getValues();
    let foundRow = -1;
    for (let i = 1; i < peerData.length; i++) {
      if (String(peerData[i][1]) === String(periodeId) &&
          String(peerData[i][2]) === String(penilaiUsername) &&
          String(peerData[i][4]) === String(dinilaiUsername)) {
        foundRow = i + 1;
        break;
      }
    }
    const ts = _surveiFormatWIB(new Date());
    if (foundRow > 0) {
      const curStatus = String(peerData[foundRow - 1][19] || '').toLowerCase();
      if (curStatus === 'submitted') {
        return { success: false, message: 'Penilaian untuk rekan ini sudah disubmit final dan tidak dapat diubah.' };
      }
      peerSheet.getRange(foundRow, 7).setValue (norm.pts1 == null ? '' : norm.pts1);
      peerSheet.getRange(foundRow, 8).setValue (norm.pts2 == null ? '' : norm.pts2);
      peerSheet.getRange(foundRow, 9).setValue (norm.pts3 == null ? '' : norm.pts3);
      peerSheet.getRange(foundRow, 10).setValue(norm.pts4 == null ? '' : norm.pts4);
      peerSheet.getRange(foundRow, 11).setValue(norm.pts5 == null ? '' : norm.pts5);
      peerSheet.getRange(foundRow, 12).setValue(norm.pts6 == null ? '' : norm.pts6);
      peerSheet.getRange(foundRow, 13).setValue(norm.pts7Esai);
      peerSheet.getRange(foundRow, 14).setValue(norm.tt1);
      peerSheet.getRange(foundRow, 15).setValue(norm.tt2);
      peerSheet.getRange(foundRow, 16).setValue(norm.tt3);
      peerSheet.getRange(foundRow, 17).setValue(norm.tt4);
      peerSheet.getRange(foundRow, 18).setValue(norm.tt5);
      peerSheet.getRange(foundRow, 19).setValue(norm.tt6);
      peerSheet.getRange(foundRow, 20).setValue('draft');
      peerSheet.getRange(foundRow, 21).setValue(ts);
    } else {
      const id = Utilities.getUuid();
      peerSheet.appendRow([
        id,
        periodeId,
        info.username,
        info.fullName,
        dinilaiInfo.username,
        dinilaiInfo.fullName,
        norm.pts1 == null ? '' : norm.pts1,
        norm.pts2 == null ? '' : norm.pts2,
        norm.pts3 == null ? '' : norm.pts3,
        norm.pts4 == null ? '' : norm.pts4,
        norm.pts5 == null ? '' : norm.pts5,
        norm.pts6 == null ? '' : norm.pts6,
        norm.pts7Esai,
        norm.tt1, norm.tt2, norm.tt3, norm.tt4, norm.tt5, norm.tt6,
        'draft',
        ts,
        ''
      ]);
    }
    const newStatusPeer = _surveiHitungStatusPeer(periodeId, penilaiUsername);
    const progSheet = ss.getSheetByName('Survei_Progress');
    progSheet.getRange(prog.rowIdx, 8).setValue(newStatusPeer);
    SpreadsheetApp.flush();
    return { success: true, data: { statusPeer: newStatusPeer } };
  } catch (e) {
    return { success: false, message: e.message };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}
function _surveiHitungStatusPeer(periodeId, penilaiUsername) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const progSheet = ss.getSheetByName('Survei_Progress');
  const pdata = progSheet.getDataRange().getValues();
  let snapshot = [];
  for (let i = 1; i < pdata.length; i++) {
    if (String(pdata[i][1]) === String(periodeId) && _cmpUsername(pdata[i][2], penilaiUsername)) {
      try {
        const arr = JSON.parse(String(pdata[i][10] || ''));
        if (Array.isArray(arr)) snapshot = arr;
      } catch (_) {}
      break;
    }
  }
  if (snapshot.length === 0) return 'belum_mulai';
  const peerSheet = ss.getSheetByName('Survei_Peer');
  if (!peerSheet || peerSheet.getLastRow() < 2) return 'belum_mulai';
  const peerData = peerSheet.getDataRange().getValues();
  let countDraft = 0, countSubmitted = 0;
  const seen = {};
  for (let i = 1; i < peerData.length; i++) {
    if (String(peerData[i][1]) !== String(periodeId)) continue;
    if (String(peerData[i][2]) !== String(penilaiUsername)) continue;
    const dn = String(peerData[i][4] || '');
    if (!dn || snapshot.indexOf(dn) < 0) continue;
    if (seen[dn]) continue;
    seen[dn] = true;
    const st = String(peerData[i][19] || '').toLowerCase();
    if (st === 'submitted') countSubmitted++;
    else countDraft++;
  }
  const totalIsi = countDraft + countSubmitted;
  if (totalIsi === 0) return 'belum_mulai';
  if (countSubmitted === snapshot.length) return 'selesai';
  return 'in_progress';
}
function submitSurveiPeer(periodeId, penilaiUsername, logUser) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    if (!periodeId)       return { success: false, message: 'Periode tidak ditemukan.' };
    if (!penilaiUsername) return { success: false, message: 'Penilai tidak teridentifikasi.' };
    _ensureSheetsSurvei();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const psheet = ss.getSheetByName('Survei_Periode');
    const pdata  = psheet.getDataRange().getValues();
    let periodeRow = null;
    for (let i = 1; i < pdata.length; i++) {
      if (String(pdata[i][0]) === String(periodeId)) { periodeRow = pdata[i]; break; }
    }
    if (!periodeRow) return { success: false, message: 'Periode tidak ditemukan.' };
    if (String(periodeRow[8]) !== 'Aktif') {
      return { success: false, message: 'Periode survei sudah ditutup.' };
    }
    const info = _surveiGetUserInfo(penilaiUsername);
    if (!info) return { success: false, message: 'Penilai tidak ditemukan.' };
    if (info.role !== 'Guru') return { success: false, message: 'Hanya Guru yang dapat submit Peer Assessment.' };
    const prog = _surveiGetOrCreateProgressRow(periodeId, penilaiUsername, { userInfo: info, markStart: false });
    const snapshot = (prog.record.peerSnapshot && Array.isArray(prog.record.peerSnapshot)) ? prog.record.peerSnapshot : [];
    if (snapshot.length === 0) {
      return { success: false, message: 'Daftar rekan belum dibuat. Silakan buka Bagian C dahulu.' };
    }
    const peerSheet = ss.getSheetByName('Survei_Peer');
    if (!peerSheet || peerSheet.getLastRow() < 2) {
      return { success: false, message: 'Belum ada penilaian yang disimpan. Lengkapi penilaian seluruh rekan terlebih dahulu.' };
    }
    const peerData = peerSheet.getDataRange().getValues();
    const recordRowsByDinilai = {};
    for (let i = 1; i < peerData.length; i++) {
      if (String(peerData[i][1]) !== String(periodeId)) continue;
      if (String(peerData[i][2]) !== String(penilaiUsername)) continue;
      const dn = String(peerData[i][4] || '');
      if (!dn) continue;
      recordRowsByDinilai[dn] = i + 1;
    }
    const missing = snapshot.filter(function(u) { return !recordRowsByDinilai[u]; });
    if (missing.length > 0) {
      return { success: false, message: 'Penilaian belum lengkap. Masih ada ' + missing.length + ' rekan yang belum dinilai.' };
    }
    const incomplete = [];
    snapshot.forEach(function(u) {
      const r = recordRowsByDinilai[u];
      const row = peerData[r - 1];
      let count = 0;
      for (let n = 0; n < 6; n++) {
        const skor = row[6 + n];
        const tt   = row[13 + n];
        const v = (skor === '' || skor === null) ? null : parseInt(skor, 10);
        const isTT = tt === true || String(tt).toLowerCase() === 'true';
        if (isTT) count++;
        else if (v != null && !isNaN(v) && v >= 1 && v <= 5) count++;
      }
      if (count < 6) incomplete.push(u);
    });
    if (incomplete.length > 0) {
      return { success: false, message: 'Masih ada ' + incomplete.length + ' rekan yang belum dinilai pada seluruh 6 dimensi (PTS-1..6).' };
    }
    const ts = _surveiFormatWIB(new Date());
    snapshot.forEach(function(u) {
      const r = recordRowsByDinilai[u];
      if (!r) return;
      peerSheet.getRange(r, 20).setValue('submitted');
      peerSheet.getRange(r, 22).setValue(ts);
    });
    const progSheet = ss.getSheetByName('Survei_Progress');
    progSheet.getRange(prog.rowIdx, 8).setValue('selesai');
    SpreadsheetApp.flush();
    logActivity(logUser || penilaiUsername, 'SUBMIT_SURVEI_PEER',
      'Submit Peer Assessment: penilai=' + penilaiUsername + '; ' + snapshot.length + ' rekan; periode=' + (periodeRow[1] || periodeId));
    return { success: true, data: { jumlahRekan: snapshot.length, statusPeer: 'selesai' } };
  } catch (e) {
    return { success: false, message: e.message };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}
function getSkorPeerSayaSendiri(periodeId, username) {
  try {
    if (!username)  return { success: false, message: 'Username kosong.' };
    if (!periodeId) return { success: false, message: 'Periode tidak ditemukan.' };
    _ensureSheetsSurvei();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let threshold = 5;
    const settings = ss.getSheetByName('Settings');
    if (settings) {
      const sd = settings.getDataRange().getValues();
      for (let i = 0; i < sd.length; i++) {
        if (String(sd[i][0]).trim() === 'Survei_Min_Peer_Substantif') {
          const n = parseInt(sd[i][1], 10);
          if (!isNaN(n) && n > 0) threshold = n;
          break;
        }
      }
    }
    const peerSheet = ss.getSheetByName('Survei_Peer');
    const peerData  = (peerSheet && peerSheet.getLastRow() > 1) ? peerSheet.getDataRange().getValues() : [];
    const sumByDim = [0, 0, 0, 0, 0, 0];
    const cntByDim = [0, 0, 0, 0, 0, 0];
    const ttByDim  = [0, 0, 0, 0, 0, 0];
    let jumlahPenilai = 0;
    let jumlahPenilaiSubstantif = 0;
    const kutipan = [];
    for (let i = 1; i < peerData.length; i++) {
      if (String(peerData[i][1]) !== String(periodeId)) continue;
      if (String(peerData[i][4]) !== String(username))  continue;
      const status = String(peerData[i][19] || '').toLowerCase();
      if (status !== 'submitted') continue;
      jumlahPenilai++;
      let punyaSubstantif = false;
      for (let d = 0; d < 6; d++) {
        const skor = peerData[i][6 + d];
        const tt   = peerData[i][13 + d];
        const isTT = tt === true || String(tt).toLowerCase() === 'true';
        if (isTT) {
          ttByDim[d]++;
        } else {
          const v = (skor === '' || skor === null) ? null : parseInt(skor, 10);
          if (v != null && !isNaN(v) && v >= 1 && v <= 5) {
            sumByDim[d] += v;
            cntByDim[d]++;
            punyaSubstantif = true;
          }
        }
      }
      if (punyaSubstantif) jumlahPenilaiSubstantif++;
      const esai = String(peerData[i][12] || '').trim();
      if (esai) kutipan.push(esai);
    }
    const layak = jumlahPenilaiSubstantif >= threshold;
    const ptsRataRata = {};
    let totalSum = 0, totalCnt = 0;
    if (layak) {
      for (let d = 0; d < 6; d++) {
        if (cntByDim[d] > 0) {
          ptsRataRata['PTS-' + (d+1)] = Math.round((sumByDim[d] / cntByDim[d]) * 100) / 100;
          totalSum += sumByDim[d];
          totalCnt += cntByDim[d];
        } else {
          ptsRataRata['PTS-' + (d+1)] = null;
        }
      }
    }
    const ptsKeseluruhan = (layak && totalCnt > 0) ? Math.round((totalSum / totalCnt) * 100) / 100 : null;
    let kutipanApresiasi = [];
    if (layak && kutipan.length > 0) {
      const seed = _surveiSeededHash(String(periodeId) + '|' + String(username) + '|peer-quotes');
      const rng = _surveiPrng(seed);
      const arr = kutipan.slice();
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      kutipanApresiasi = arr.slice(0, 3);
    }
    return {
      success: true,
      data: {
        threshold:                threshold,
        jumlahPenilai:            jumlahPenilai,
        jumlahPenilaiSubstantif:  jumlahPenilaiSubstantif,
        layakDitampilkan:         layak,
        ptsRataRata:              layak ? ptsRataRata : null,
        ptsKeseluruhan:           ptsKeseluruhan,
        ttPerDimensi:             ttByDim,
        kutipanApresiasi:         kutipanApresiasi
      }
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
function getLaporanPersonalGuru(periodeId, username) {
  try {
    if (!username)  return { success: false, message: 'Username kosong.' };
    if (!periodeId) return { success: false, message: 'Periode tidak ditemukan.' };
    _ensureSheetsSurvei();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const info = _surveiGetUserInfo(username);
    if (!info) return { success: false, message: 'Pengguna tidak ditemukan.' };
    if (info.role !== 'Guru') {
      return { success: false, message: 'Laporan personal hanya untuk role Guru.' };
    }
    const schedSheet = ss.getSheetByName('Schedules');
    const kelasSet = {};
    if (schedSheet && schedSheet.getLastRow() > 1) {
      const sd = schedSheet.getDataRange().getValues();
      const head = sd[0];
      let idxUser = -1, idxKelas = -1;
      head.forEach(function(h, i) {
        const k = String(h || '').toLowerCase();
        if (k.indexOf('user') >= 0 || k.indexOf('guru') >= 0) idxUser = i;
        if (k === 'kelas' || k.indexOf('kelas') >= 0) idxKelas = i;
      });
      if (idxUser < 0 || idxKelas < 0) {
        for (let r = 1; r < sd.length; r++) {
          const row = sd[r];
          let foundUser = false, foundKelas = '';
          for (let c = 0; c < row.length; c++) {
            const v = String(row[c] || '').trim();
            if (v === username) foundUser = true;
            if (/^\d[A-Z]?$/.test(v)) foundKelas = v;
          }
          if (foundUser && foundKelas) kelasSet[foundKelas] = true;
        }
      } else {
        for (let r = 1; r < sd.length; r++) {
          const row = sd[r];
          if (String(row[idxUser] || '').trim() === username) {
            const k = String(row[idxKelas] || '').trim();
            if (k) kelasSet[k] = true;
          }
        }
      }
    }
    const daftarKelas = Object.keys(kelasSet).sort();
    const a1Codes = ['A1-1','A1-2','A1-3','A1-4'];
    const jSheet = ss.getSheetByName('Survei_Jawaban');
    const jdata  = (jSheet && jSheet.getLastRow() > 1) ? jSheet.getDataRange().getValues() : [];
    const sumPerKelas = {};
    let sumMad = 0, cntMad = 0;
    for (let i = 1; i < jdata.length; i++) {
      if (String(jdata[i][1]) !== String(periodeId)) continue;
      if (String(jdata[i][4]) !== 'Siswa')           continue;
      const kode = String(jdata[i][6] || '');
      if (a1Codes.indexOf(kode) < 0) continue;
      const v = parseInt(jdata[i][9], 10);
      if (isNaN(v) || v < 1 || v > 5) continue;
      const kls = String(jdata[i][5] || '').trim();
      sumMad += v; cntMad++;
      if (kls) {
        if (!sumPerKelas[kls]) sumPerKelas[kls] = { sum: 0, cnt: 0 };
        sumPerKelas[kls].sum += v;
        sumPerKelas[kls].cnt++;
      }
    }
    const a1Madrasah = cntMad > 0 ? Math.round((sumMad / cntMad) * 100) / 100 : null;
    const a1PerKelas = daftarKelas.map(function(k) {
      const r = sumPerKelas[k];
      return {
        kelas:    k,
        rataRata: (r && r.cnt > 0) ? Math.round((r.sum / r.cnt) * 100) / 100 : null,
        jumlahResponden: r ? r.cnt : 0
      };
    });
    const peerRes = getSkorPeerSayaSendiri(periodeId, username);
    const peer = (peerRes && peerRes.success) ? peerRes.data : null;
    return {
      success: true,
      data: {
        siswa: {
          a1Madrasah:    a1Madrasah,
          a1PerKelas:    a1PerKelas,
          totalRespondenMadrasah: cntMad
        },
        peer: peer
      }
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
function _surveiIsRowFlagged(progressObj) {
  if (!progressObj) return false;
  if (progressObj.flagStraightline === true) return true;
  if (progressObj.flagWaktuSingkat === true) return true;
  if (String(progressObj.flagAttention || '').toLowerCase() === 'tidak_valid') return true;
  if (String(progressObj.flagKeandalan || '').toLowerCase() === 'rendah') return true;
  return false;
}
function _surveiProgressMap(periodeId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Survei_Progress');
  const map = {};
  if (!sheet || sheet.getLastRow() < 2) return map;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) !== String(periodeId)) continue;
    const obj = _surveiProgressRowToObj(data[i]);
    if (!obj || !obj.username) continue;
    const key = plainText(obj.username).trim();
    if (!key) continue;
    const existing = map[key];
    if (!existing) {
      map[key] = obj;
    } else {
      const order = { 'belum_mulai': 0, 'in_progress': 1, 'submitted': 2, 'selesai': 3 };
      const a = order[String(existing.statusUtama || '').toLowerCase()] || 0;
      const b = order[String(obj.statusUtama || '').toLowerCase()]      || 0;
      if (b > a) map[key] = obj;
      else if (b === a && (parseFloat(obj.persenSelesai) || 0) > (parseFloat(existing.persenSelesai) || 0)) {
        map[key] = obj;
      }
    }
  }
  return map;
}
function _surveiFlaggedUsernames(periodeId) {
  const m = _surveiProgressMap(periodeId);
  const set = {};
  Object.keys(m).forEach(function(u) {
    if (_surveiIsRowFlagged(m[u])) set[u] = true;
  });
  return set;
}
function _surveiTargetUsers(targetRoleArr) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  const out = { Siswa: [], Guru: [], Orangtua: [] };
  if (!sheet || sheet.getLastRow() < 2) return out;
  const data = sheet.getDataRange().getValues();
  const roleSet = {};
  (targetRoleArr || []).forEach(function(r) { roleSet[r] = true; });
  for (let i = 1; i < data.length; i++) {
    const role = String(data[i][3] || '').trim();
    const username = plainText(data[i][1] || '').trim();
    if (!username) continue;
    if (!roleSet[role]) continue;
    if (out[role]) {
      out[role].push({
        username: username,
        fullName: data[i][7] || username,
        kelas: data[i][6] || ''
      });
    }
  }
  return out;
}
function _surveiGetPeriodeById(periodeId) {
  _ensureSheetsSurvei();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Survei_Periode');
  if (!sheet || sheet.getLastRow() < 2) return null;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(periodeId)) {
      return _surveiPeriodeRowToObj(data[i]);
    }
  }
  return null;
}
function getSurveiProgressAll(periodeId, adminUser) {
  try {
    if (!_isAdminAtauKepalaMadrasah(adminUser)) {
      return { success: false, message: 'Akses ditolak. Hanya Admin atau Kepala Madrasah yang dapat melihat progress.' };
    }
    if (!periodeId) return { success: false, message: 'ID periode tidak boleh kosong.' };
    const periode = _surveiGetPeriodeById(periodeId);
    if (!periode) return { success: false, message: 'Periode tidak ditemukan.' };
    _ensureSheetsSurvei();
    const targets = _surveiTargetUsers(periode.targetRole || []);
    const progressMap = _surveiProgressMap(periodeId);
    const findProgress = function(username) {
      if (progressMap[username]) return progressMap[username];
      const keys = Object.keys(progressMap);
      for (let i = 0; i < keys.length; i++) {
        if (_cmpUsername(keys[i], username)) return progressMap[keys[i]];
      }
      return null;
    };
    const rows = [];
    const summary = {
      perRole: { Siswa: null, Guru: null, Orangtua: null },
      total: { target: 0, mulai: 0, selesai: 0, terflag: 0 }
    };
    ['Siswa', 'Guru', 'Orangtua'].forEach(function(role) {
      if (!targets[role] || targets[role].length === 0) return;
      let mulai = 0, selesai = 0, terflag = 0;
      targets[role].forEach(function(u) {
        const p = findProgress(u.username);
        let row;
        if (p) {
          row = {
            id: p.id,
            username: u.username,
            namaLengkap: p.namaLengkap || u.fullName,
            role: p.role || role,
            kelas: p.kelas || u.kelas || '',
            statusUtama: p.statusUtama || 'belum_mulai',
            statusPeer: p.statusPeer || 'belum_mulai',
            persenSelesai: p.persenSelesai || 0,
            timestampSelesai: p.timestampSelesai || '',
            timestampMulai: p.timestampMulai || '',
            waktuPengisianDetik: p.waktuPengisianDetik || 0,
            flagStraightline: !!p.flagStraightline,
            flagWaktuSingkat: !!p.flagWaktuSingkat,
            flagAttention: p.flagAttention || 'aman',
            flagKeandalan: p.flagKeandalan || 'tinggi',
            terflag: _surveiIsRowFlagged(p),
            catatanAdmin: p.catatanAdmin || ''
          };
          if (p.statusUtama && p.statusUtama !== 'belum_mulai') mulai++;
          if (p.statusUtama === 'selesai' || p.statusUtama === 'submitted') selesai++;
          if (row.terflag) terflag++;
        } else {
          row = {
            id: '',
            username: u.username,
            namaLengkap: u.fullName,
            role: role,
            kelas: u.kelas || '',
            statusUtama: 'belum_mulai',
            statusPeer: 'belum_mulai',
            persenSelesai: 0,
            timestampSelesai: '',
            timestampMulai: '',
            waktuPengisianDetik: 0,
            flagStraightline: false,
            flagWaktuSingkat: false,
            flagAttention: 'aman',
            flagKeandalan: 'tinggi',
            terflag: false,
            catatanAdmin: ''
          };
        }
        rows.push(row);
      });
      summary.perRole[role] = {
        target: targets[role].length,
        mulai: mulai,
        selesai: selesai,
        terflag: terflag
      };
      summary.total.target  += targets[role].length;
      summary.total.mulai   += mulai;
      summary.total.selesai += selesai;
      summary.total.terflag += terflag;
    });
    const statusOrder = { 'belum_mulai': 0, 'in_progress': 1, 'submitted': 2, 'selesai': 3 };
    rows.sort(function(a, b) {
      const sa = statusOrder[a.statusUtama] != null ? statusOrder[a.statusUtama] : 99;
      const sb = statusOrder[b.statusUtama] != null ? statusOrder[b.statusUtama] : 99;
      if (sa !== sb) return sa - sb;
      const ra = ['Siswa','Guru','Orangtua'].indexOf(a.role);
      const rb = ['Siswa','Guru','Orangtua'].indexOf(b.role);
      if (ra !== rb) return ra - rb;
      return String(a.namaLengkap || '').localeCompare(String(b.namaLengkap || ''));
    });
    return {
      success: true,
      data: {
        periode: {
          id: periode.id,
          namaPeriode: periode.namaPeriode,
          status: periode.status,
          tipe: periode.tipe,
          targetRole: periode.targetRole
        },
        summary: summary,
        rows: rows
      }
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
function _surveiLoadJawabanPeriode(periodeId, excludeUsernames) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Survei_Jawaban');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  const out = [];
  const ex = excludeUsernames || {};
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) !== String(periodeId)) continue;
    const u = plainText(data[i][2]).trim();
    if (ex[u]) continue;
    out.push({
      username: u,
      namaLengkap: data[i][3] || '',
      role:   String(data[i][4] || '').trim(),
      kelas:  data[i][5] || '',
      kode:   String(data[i][6] || ''),
      bagian: String(data[i][7] || ''),
      tipe:   String(data[i][8] || '').toLowerCase(),
      skala:  (data[i][9] === '' || data[i][9] == null) ? null : parseInt(data[i][9], 10),
      teks:   data[i][10] == null ? '' : String(data[i][10]),
      ts:     data[i][11] || ''
    });
  }
  return out;
}
function getSurveiRekapAspek(periodeId, adminUser, excludeFlag) {
  try {
    if (!_isAdminAtauKepalaMadrasah(adminUser)) {
      return { success: false, message: 'Akses ditolak.' };
    }
    if (!periodeId) return { success: false, message: 'ID periode tidak boleh kosong.' };
    _ensureSheetsSurvei();
    const flagged = (excludeFlag === true || String(excludeFlag) === 'true')
      ? _surveiFlaggedUsernames(periodeId) : {};
    const jawaban = _surveiLoadJawabanPeriode(periodeId, flagged);
    const aspekList = ['A1','A2','A3','A4','A5','A6'];
    const rolesAll = ['Siswa','Guru','Orangtua'];
    const acc = { ALL: {} };
    rolesAll.forEach(function(r) { acc[r] = {}; });
    aspekList.forEach(function(a) {
      acc.ALL[a] = { sum: 0, cnt: 0 };
      rolesAll.forEach(function(r) { acc[r][a] = { sum: 0, cnt: 0 }; });
    });
    for (let i = 0; i < jawaban.length; i++) {
      const r = jawaban[i];
      if (r.tipe !== 'likert') continue;
      if (r.bagian !== 'A')    continue;
      const m = String(r.kode).toUpperCase().match(/^(A[1-6])-/);
      if (!m) continue;
      const aspek = m[1];
      const v = parseInt(r.skala, 10);
      if (isNaN(v) || v < 1 || v > 5) continue;
      acc.ALL[aspek].sum += v; acc.ALL[aspek].cnt++;
      const rl = r.role;
      if (acc[rl] && acc[rl][aspek]) {
        acc[rl][aspek].sum += v; acc[rl][aspek].cnt++;
      }
    }
    const rata = function(o) { return o.cnt > 0 ? Math.round((o.sum / o.cnt) * 100) / 100 : null; };
    const out = {
      keseluruhan: aspekList.map(function(a) { return { aspek: a, rataRata: rata(acc.ALL[a]), n: acc.ALL[a].cnt }; }),
      perRole: {}
    };
    rolesAll.forEach(function(rl) {
      out.perRole[rl] = aspekList.map(function(a) { return { aspek: a, rataRata: rata(acc[rl][a]), n: acc[rl][a].cnt }; });
    });
    return { success: true, data: out, jumlahDikecualikan: Object.keys(flagged).length };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
function getSurveiRekapMapel(periodeId, adminUser, excludeFlag) {
  try {
    if (!_isAdminAtauKepalaMadrasah(adminUser)) {
      return { success: false, message: 'Akses ditolak.' };
    }
    if (!periodeId) return { success: false, message: 'ID periode tidak boleh kosong.' };
    _ensureSheetsSurvei();
    const flagged = (excludeFlag === true || String(excludeFlag) === 'true')
      ? _surveiFlaggedUsernames(periodeId) : {};
    const jawaban = _surveiLoadJawabanPeriode(periodeId, flagged);
    const mapelKodes = _surveiMapelKodeAll();
    const acc = {};
    const respondenSet = {};
    mapelKodes.forEach(function(k) { acc[k] = { sum: 0, cnt: 0, respondenSet: {} }; });
    for (let i = 0; i < jawaban.length; i++) {
      const r = jawaban[i];
      if (r.role !== 'Siswa')   continue;
      if (r.bagian !== 'C')     continue;
      if (r.tipe !== 'likert')  continue;
      const m = String(r.kode).toUpperCase().match(/^([A-Z]{2,4})-([1-4])$/);
      if (!m) continue;
      const mapel = m[1];
      if (!acc[mapel]) continue;
      const v = parseInt(r.skala, 10);
      if (isNaN(v) || v < 1 || v > 5) continue;
      acc[mapel].sum += v;
      acc[mapel].cnt++;
      acc[mapel].respondenSet[r.username] = true;
    }
    const PRD_MAPEL_NAMA = {
      'AQH': 'Al Quran Hadis', 'AKA': 'Akidah Akhlak', 'FIK': 'Fikih',
      'SKI': 'Sejarah Kebudayaan Islam', 'BAR': 'Bahasa Arab', 'PPC': 'Pendidikan Pancasila',
      'BIN': 'Bahasa Indonesia', 'MTK': 'Matematika', 'IPA': 'Ilmu Pengetahuan Alam',
      'IPS': 'Ilmu Pengetahuan Sosial', 'BIG': 'Bahasa Inggris', 'INF': 'Informatika',
      'PJK': 'PJOK', 'SBD': 'Seni Budaya', 'BTQ': 'Baca Tulis Quran'
    };
    const data = mapelKodes.map(function(k) {
      const a = acc[k];
      const jumlahResponden = Object.keys(a.respondenSet).length;
      return {
        kode: k,
        nama: PRD_MAPEL_NAMA[k] || k,
        rataRata: a.cnt > 0 ? Math.round((a.sum / a.cnt) * 100) / 100 : null,
        jumlahJawaban: a.cnt,
        jumlahResponden: jumlahResponden
      };
    });
    return { success: true, data: data, jumlahDikecualikan: Object.keys(flagged).length };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
function getSurveiRekapKegiatan(periodeId, adminUser, excludeFlag) {
  try {
    if (!_isAdminAtauKepalaMadrasah(adminUser)) {
      return { success: false, message: 'Akses ditolak.' };
    }
    if (!periodeId) return { success: false, message: 'ID periode tidak boleh kosong.' };
    _ensureSheetsSurvei();
    const flagged = (excludeFlag === true || String(excludeFlag) === 'true')
      ? _surveiFlaggedUsernames(periodeId) : {};
    const jawaban = _surveiLoadJawabanPeriode(periodeId, flagged);
    const kegiatanKodes = _surveiKegiatanKodeAll();
    const acc = {};
    kegiatanKodes.forEach(function(k) { acc[k] = { sum: 0, cnt: 0, respondenSet: {} }; });
    for (let i = 0; i < jawaban.length; i++) {
      const r = jawaban[i];
      if (r.role !== 'Siswa') continue;
      if (r.bagian !== 'D')   continue;
      if (r.tipe !== 'likert') continue;
      const m = String(r.kode).toUpperCase().match(/^([A-Z]{2,4})-([1-3])$/);
      if (!m) continue;
      const keg = m[1];
      if (!acc[keg]) continue;
      const v = parseInt(r.skala, 10);
      if (isNaN(v) || v < 1 || v > 5) continue;
      acc[keg].sum += v;
      acc[keg].cnt++;
      acc[keg].respondenSet[r.username] = true;
    }
    const PRD_KEG_NAMA = {
      'UPB': { nama: 'Upacara Bendera', jadwal: 'Setiap Hari Senin' },
      'RHS': { nama: 'Rohani Islami (Rohis)', jadwal: 'Setiap Hari Jumat' },
      'SNM': { nama: 'Senam Pagi Bersama', jadwal: 'Setiap Hari Sabtu' },
      'MSP': { nama: 'Membaca Surah Pendek', jadwal: 'Setiap pagi & sebelum pulang' }
    };
    const data = kegiatanKodes.map(function(k) {
      const a = acc[k];
      const meta = PRD_KEG_NAMA[k] || { nama: k, jadwal: '' };
      return {
        kode: k,
        nama: meta.nama,
        jadwal: meta.jadwal,
        rataRata: a.cnt > 0 ? Math.round((a.sum / a.cnt) * 100) / 100 : null,
        jumlahJawaban: a.cnt,
        jumlahResponden: Object.keys(a.respondenSet).length
      };
    });
    return { success: true, data: data, jumlahDikecualikan: Object.keys(flagged).length };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
function getSurveiRekapPeer(periodeId, adminUser) {
  try {
    if (!_isAdminAtauKepalaMadrasah(adminUser)) {
      return { success: false, message: 'Akses ditolak.' };
    }
    if (!periodeId) return { success: false, message: 'ID periode tidak boleh kosong.' };
    _ensureSheetsSurvei();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Survei_Peer');
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true, data: [] };
    }
    let threshold = 5;
    try {
      const settings = ss.getSheetByName('Settings');
      if (settings) {
        const sd = settings.getDataRange().getValues();
        for (let i = 0; i < sd.length; i++) {
          if (String(sd[i][0]).trim() === 'Survei_Min_Peer_Substantif') {
            const n = parseInt(sd[i][1], 10);
            if (!isNaN(n) && n > 0) threshold = n;
            break;
          }
        }
      }
    } catch (_) {}
    const data = sheet.getDataRange().getValues();
    const acc = {};
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]).trim().toUpperCase() !== String(periodeId).trim().toUpperCase()) continue;
      const status = String(data[i][19] || '').toLowerCase();
      if (status !== 'submitted') continue;
      const dinilaiU_raw = String(data[i][4] || '').trim();
      const dinilaiU = dinilaiU_raw.toLowerCase();
      const dinilaiN = String(data[i][5] || '').trim();
      const penilaiU = String(data[i][2] || '').trim().toLowerCase();
      if (!dinilaiU) continue;
      if (!acc[dinilaiU]) {
        acc[dinilaiU] = {
          username: dinilaiU_raw,
          nama: dinilaiN,
          sum: [0,0,0,0,0,0],
          cnt: [0,0,0,0,0,0],
          penilaiSet: {},
          penilaiSubstantifSet: {}
        };
      }
      acc[dinilaiU].penilaiSet[penilaiU] = true;
      let punyaSubstantif = false;
      for (let d = 0; d < 6; d++) {
        const ttRaw = data[i][13 + d];
        const tt = (ttRaw === true) || (String(ttRaw).toLowerCase() === 'true');
        if (tt) continue;
        const v = parseInt(data[i][6 + d], 10);
        if (isNaN(v) || v < 1 || v > 5) continue;
        acc[dinilaiU].sum[d] += v;
        acc[dinilaiU].cnt[d]++;
        punyaSubstantif = true;
      }
      if (punyaSubstantif) acc[dinilaiU].penilaiSubstantifSet[penilaiU] = true;
    }
    const rata = function(s, c) { return c > 0 ? Math.round((s / c) * 100) / 100 : null; };
    const out = Object.keys(acc).map(function(u) {
      const a = acc[u];
      const jmlSub = Object.keys(a.penilaiSubstantifSet).length;
      let totSum = 0, totCnt = 0;
      const perDim = [0,1,2,3,4,5].map(function(d) {
        if (jmlSub >= threshold) {
          totSum += a.sum[d]; totCnt += a.cnt[d];
          return { kode: 'PTS-' + (d + 1), rataRata: rata(a.sum[d], a.cnt[d]), n: a.cnt[d] };
        } else {
          return { kode: 'PTS-' + (d + 1), rataRata: null, n: 0 };
        }
      });
      return {
        username: a.username,
        nama: a.nama,
        perDimensi: perDim,
        rataRataKeseluruhan: (jmlSub >= threshold) ? rata(totSum, totCnt) : null,
        jumlahPenilai: Object.keys(a.penilaiSet).length,
        jumlahPenilaiSubstantif: jmlSub
      };
    });
    out.sort(function(a, b) {
      const av = a.rataRataKeseluruhan == null ? -1 : a.rataRataKeseluruhan;
      const bv = b.rataRataKeseluruhan == null ? -1 : b.rataRataKeseluruhan;
      if (bv !== av) return bv - av;
      return String(a.nama || '').localeCompare(String(b.nama || ''));
    });
    return { success: true, data: out, threshold: threshold };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
function getSurveiEsaiAll(periodeId, bagian, kodeFilter, adminUser) {
  try {
    if (!_isAdminAtauKepalaMadrasah(adminUser)) {
      return { success: false, message: 'Akses ditolak.' };
    }
    if (!periodeId) return { success: false, message: 'ID periode tidak boleh kosong.' };
    _ensureSheetsSurvei();
    const bg = String(bagian || '').trim().toUpperCase();
    const kf = String(kodeFilter || '').trim().toUpperCase();
    const out = [];
    if (bg !== 'PEER') {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Survei_Jawaban');
      if (sheet && sheet.getLastRow() > 1) {
        const data = sheet.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][1]).trim().toUpperCase() !== String(periodeId).trim().toUpperCase()) continue;
          if (String(data[i][8] || '').toLowerCase() !== 'esai') continue;
          const rowBg = String(data[i][7] || '').toUpperCase();
          if (rowBg === 'ATTENTION') continue;
          if (bg && rowBg !== bg) continue;
          const kode = String(data[i][6] || '').toUpperCase();
          if (kf && kode.indexOf(kf) !== 0) continue;
          const teks = String(data[i][10] || '').trim();
          if (!teks) continue;
          out.push({
            sumber: 'jawaban',
            bagian: rowBg,
            kode: kode,
            username: data[i][2] || '',
            namaLengkap: data[i][3] || '',
            role: data[i][4] || '',
            kelas: data[i][5] || '',
            teks: teks,
            timestamp: data[i][11] || ''
          });
        }
      }
    }
    if (!bg || bg === 'PEER') {
      const peerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Survei_Peer');
      if (peerSheet && peerSheet.getLastRow() > 1) {
        const pdata = peerSheet.getDataRange().getValues();
        for (let i = 1; i < pdata.length; i++) {
          if (String(pdata[i][1]).trim().toUpperCase() !== String(periodeId).trim().toUpperCase()) continue;
          if (String(pdata[i][19] || '').toLowerCase() !== 'submitted') continue;
          const teks = String(pdata[i][12] || '').trim();
          if (!teks) continue;
          if (kf && 'PTS-7'.indexOf(kf) !== 0 && 'PTS'.indexOf(kf) !== 0) continue;
          out.push({
            sumber: 'peer',
            bagian: 'PEER',
            kode: 'PTS-7',
            username: '',
            namaLengkap: '— anonim —',
            role: 'Guru',
            kelas: '',
            tentangNama: pdata[i][5] || '',
            teks: teks,
            timestamp: pdata[i][21] || ''
          });
        }
      }
    }
    out.sort(function(a, b) {
      const va = a.timestamp instanceof Date ? a.timestamp.getTime() : (new Date(a.timestamp || 0).getTime() || 0);
      const vb = b.timestamp instanceof Date ? b.timestamp.getTime() : (new Date(b.timestamp || 0).getTime() || 0);
      return vb - va;
    });
    return { success: true, data: out };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
function setCatatanAdminSurvei(periodeId, username, catatan, adminUser) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    if (!_isAdminAtauKepalaMadrasah(adminUser)) {
      return { success: false, message: 'Akses ditolak.' };
    }
    if (!periodeId) return { success: false, message: 'ID periode tidak boleh kosong.' };
    if (!username)  return { success: false, message: 'Username tidak boleh kosong.' };
    _ensureSheetsSurvei();
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Survei_Progress');
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: false, message: 'Belum ada data progress untuk periode ini.' };
    }
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]) === String(periodeId) &&
          _cmpUsername(data[i][2], username)) {
        sheet.getRange(i + 1, 17).setValue(String(catatan || ''));
        SpreadsheetApp.flush();
        logActivity(adminUser, 'UPDATE_CATATAN_SURVEI',
          'Memperbarui catatan flag survei untuk: ' + username);
        return { success: true, data: { username: username, catatan: String(catatan || '') } };
      }
    }
    return { success: false, message: 'Data progress untuk pengguna ini tidak ditemukan. Pastikan responden telah memulai survei.' };
  } catch (e) {
    return { success: false, message: e.message };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}
function _isKepalaMadrasah(username) {
  if (!username) return false;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  if (!sheet) return false;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1] || '').trim() === String(username).trim()) {
      const role = data[i][3];
      const tugasRaw = data[i][4] ? String(data[i][4]) : '';
      const tugasArr = tugasRaw.split(',').map(t => t.trim());
      return role === 'Guru' && tugasArr.indexOf('Kepala Madrasah/Sekolah') >= 0;
    }
  }
  return false;
}
function simpanRencanaAksi(periodeId, poinList, kepalaUser) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    if (!_isKepalaMadrasah(kepalaUser)) {
      return { success: false, message: 'Akses ditolak. Hanya Kepala Madrasah yang dapat mengisi Rencana Aksi.' };
    }
    if (!periodeId) return { success: false, message: 'ID periode tidak boleh kosong.' };
    if (!Array.isArray(poinList)) {
      return { success: false, message: 'Format poin tidak valid.' };
    }
    if (poinList.length < 3 || poinList.length > 7) {
      return { success: false, message: 'Rencana Aksi harus berisi minimal 3 dan maksimal 7 poin.' };
    }
    _ensureSheetsSurvei();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const psheet = ss.getSheetByName('Survei_Periode');
    const pdata  = psheet.getDataRange().getValues();
    let periodeRowIdx = -1;
    let periodeNama = '';
    let periodeTglTutupRaw = '';
    for (let i = 1; i < pdata.length; i++) {
      if (String(pdata[i][0]).trim().toUpperCase() === String(periodeId).trim().toUpperCase()) {
        periodeRowIdx = i + 1;
        periodeNama   = pdata[i][1] || '';
        periodeTglTutupRaw = pdata[i][7]; // Kolom 8 = Tanggal_Tutup (index 7)
        break;
      }
    }
    if (periodeRowIdx < 0) return { success: false, message: 'Periode tidak ditemukan.' };

    // BUG FIX #5: Validasi batas waktu H+30 di sisi server sebagai lapisan keamanan
    // tambahan, mencegah penyimpanan yang melewati batas bahkan jika client-side
    // bypass diabaikan. Ini juga mencegah status 'sudah_diisi' ditandai secara salah.
    if (periodeTglTutupRaw) {
      const tglTutupDate = _surveiParseDate(periodeTglTutupRaw);
      if (tglTutupDate) {
        const now = new Date();
        const tutupMidnight = new Date(tglTutupDate.getFullYear(), tglTutupDate.getMonth(), tglTutupDate.getDate(), 23, 59, 59, 999);
        const batasAkhir = new Date(tglTutupDate.getFullYear(), tglTutupDate.getMonth(), tglTutupDate.getDate() + 30, 23, 59, 59, 999);
        if (now <= tutupMidnight) {
          return { success: false, message: 'Rencana Aksi baru dapat diisi setelah periode pengisian survei ditutup.' };
        }
        if (now > batasAkhir) {
          return { success: false, message: 'Batas pengisian Rencana Aksi (H+30 dari penutupan survei) telah berakhir.' };
        }
      }
    }
    const VALID_ASPEK = ['Pengajaran', 'Fasilitas', 'Kurikulum', 'Karakter', 'Disiplin', 'Budaya'];
    const VALID_STATUS = ['belum', 'proses', 'selesai'];
    const cleanList = [];
    for (let i = 0; i < poinList.length; i++) {
      const p = poinList[i] || {};
      const desk = String(p.deskripsi || p.deskripsiTindakan || '').trim();
      const pj   = String(p.penanggungJawab || '').trim();
      const tw   = String(p.targetWaktu || '').trim();
      const aspek = String(p.aspekTerkait || '').trim();
      const stat  = String(p.statusKetercapaian || 'belum').trim().toLowerCase();
      if (!desk) return { success: false, message: 'Poin #' + (i + 1) + ': Deskripsi tindakan wajib diisi.' };
      if (!pj)   return { success: false, message: 'Poin #' + (i + 1) + ': Penanggung jawab wajib diisi.' };
      if (!tw)   return { success: false, message: 'Poin #' + (i + 1) + ': Target waktu wajib diisi.' };
      if (VALID_ASPEK.indexOf(aspek) < 0) {
        return { success: false, message: 'Poin #' + (i + 1) + ': Aspek terkait harus salah satu dari: ' + VALID_ASPEK.join(', ') + '.' };
      }
      const finalStatus = (VALID_STATUS.indexOf(stat) >= 0) ? stat : 'belum';
      cleanList.push({
        deskripsi: desk,
        penanggungJawab: pj,
        targetWaktu: tw,
        aspekTerkait: aspek,
        statusKetercapaian: finalStatus,
        id: String(p.id || '').trim() || Utilities.getUuid()
      });
    }
    const sheet = ss.getSheetByName('Survei_Rencana_Aksi');
    if (sheet.getLastRow() > 1) {
      const data = sheet.getDataRange().getValues();
      const rowsToDelete = [];
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][1]).trim().toUpperCase() === String(periodeId).trim().toUpperCase()) {
          rowsToDelete.push(i + 1);
        }
      }
      rowsToDelete.sort(function(a, b) { return b - a; });
      rowsToDelete.forEach(function(r) { sheet.deleteRow(r); });
    }
    const now = new Date();
    const tsNow = _surveiFormatWIB(now);
    cleanList.forEach(function(p, idx) {
      sheet.appendRow([
        p.id,
        periodeId,
        idx + 1,
        p.deskripsi,
        p.penanggungJawab,
        p.targetWaktu,
        p.aspekTerkait,
        p.statusKetercapaian,
        kepalaUser,
        tsNow,
        ''
      ]);
    });
    psheet.getRange(periodeRowIdx, 10).setValue('sudah_diisi');
    SpreadsheetApp.flush();
    logActivity(kepalaUser, 'SIMPAN_RENCANA_AKSI',
      'Menyimpan ' + cleanList.length + ' poin Rencana Aksi untuk: ' + periodeNama);
    return {
      success: true,
      data: { periodeId: periodeId, jumlahPoin: cleanList.length }
    };
  } catch (e) {
    return { success: false, message: e.message };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}
function getRencanaAksi(periodeId) {
  try {
    if (!periodeId) return { success: false, message: 'ID periode tidak boleh kosong.' };
    _ensureSheetsSurvei();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const periode = _surveiGetPeriodeById(periodeId);
    if (!periode) return { success: false, message: 'Periode tidak ditemukan.' };
    const sheet = ss.getSheetByName('Survei_Rencana_Aksi');
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true, data: { periode: periode, poin: [] } };
    }
    const data = sheet.getDataRange().getValues();
    const poin = [];
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]).trim().toUpperCase() !== String(periodeId).trim().toUpperCase()) continue;
      poin.push({
        id:                 data[i][0] || '',
        noUrut:             parseInt(data[i][2], 10) || 0,
        deskripsi:          data[i][3] || '',
        penanggungJawab:    data[i][4] || '',
        targetWaktu:        data[i][5] || '',
        aspekTerkait:       data[i][6] || '',
        statusKetercapaian: data[i][7] || 'belum',
        dibuatOleh:         data[i][8] || '',
        dibuatPada:         data[i][9] || '',
        diperbaruiPada:     data[i][10] || ''
      });
    }
    poin.sort(function(a, b) { return a.noUrut - b.noUrut; });
    return { success: true, data: { periode: periode, poin: poin } };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
function updateStatusKetercapaian(rencanaAksiId, statusBaru, kepalaUser) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    if (!_isKepalaMadrasah(kepalaUser)) {
      return { success: false, message: 'Akses ditolak. Hanya Kepala Madrasah yang dapat memperbarui status.' };
    }
    if (!rencanaAksiId) return { success: false, message: 'ID Rencana Aksi tidak boleh kosong.' };
    const stat = String(statusBaru || '').trim().toLowerCase();
    const VALID_STATUS = ['belum', 'proses', 'selesai'];
    if (VALID_STATUS.indexOf(stat) < 0) {
      return { success: false, message: 'Status harus salah satu dari: belum, proses, atau selesai.' };
    }
    _ensureSheetsSurvei();
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Survei_Rencana_Aksi');
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: false, message: 'Tidak ada data Rencana Aksi.' };
    }
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(rencanaAksiId)) {
        sheet.getRange(i + 1, 8).setValue(stat);
        sheet.getRange(i + 1, 11).setValue(_surveiFormatWIB(new Date()));
        SpreadsheetApp.flush();
        logActivity(kepalaUser, 'UPDATE_STATUS_RENCANA_AKSI',
          'Mengubah status poin "' + (data[i][3] || '').toString().substring(0, 60) + '" menjadi: ' + stat);
        return { success: true, data: { id: rencanaAksiId, statusKetercapaian: stat } };
      }
    }
    return { success: false, message: 'Poin Rencana Aksi tidak ditemukan.' };
  } catch (e) {
    return { success: false, message: e.message };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}
function getTrenAnterSemester(adminUser, aspek, role, jumlahPeriode) {
  try {
    if (!_isAdminAtauKepalaMadrasah(adminUser)) {
      return { success: false, message: 'Akses ditolak.' };
    }
    _ensureSheetsSurvei();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const psheet = ss.getSheetByName('Survei_Periode');
    if (!psheet || psheet.getLastRow() < 2) {
      return { success: true, data: { periodeList: [], series: [], cukup: false } };
    }
    const limit = Math.max(1, Math.min(20, parseInt(jumlahPeriode, 10) || 6));
    const aspekFilter = String(aspek || 'ALL').trim();
    const roleFilter  = String(role || 'ALL').trim();
    const pdata = psheet.getDataRange().getValues();
    const periodeAll = [];
    for (let i = 1; i < pdata.length; i++) {
      if (String(pdata[i][4]) !== 'semester') continue;
      const p = _surveiPeriodeRowToObj(pdata[i]);
      if (!p) continue;
      periodeAll.push(p);
    }
    if (periodeAll.length === 0) {
      return { success: true, data: { periodeList: [], series: [], cukup: false } };
    }
    // BUG FIX #1: Gunakan tahunAjaran + semester sebagai kunci sort primer,
    // bukan dibuatPada. dibuatPada tidak andal karena admin bisa membuat
    // periode lama setelah periode baru, menyebabkan urutan grafik kacau.
    // Urutan yang benar: Ganjil < Genap dalam tahun yang sama;
    // jika tahunAjaran tidak bisa diparsing, gunakan dibuatPada sebagai fallback.
    periodeAll.sort(function(a, b) {
      // Ekstrak tahun pertama dari format "YYYY/YYYY" atau "YYYY"
      const parseTA = function(ta) {
        const m = String(ta || '').match(/(\d{4})/);
        return m ? parseInt(m[1], 10) : 0;
      };
      const semOrder = function(sem) {
        return String(sem || '').toLowerCase() === 'ganjil' ? 0 : 1;
      };
      const taA = parseTA(a.tahunAjaran), taB = parseTA(b.tahunAjaran);
      if (taA !== taB) return taA - taB;
      const semA = semOrder(a.semester), semB = semOrder(b.semester);
      if (semA !== semB) return semA - semB;
      // Fallback ke dibuatPada jika tahun ajaran/semester sama
      const da = _surveiParseDate(a.dibuatPada);
      const db = _surveiParseDate(b.dibuatPada);
      return (da ? da.getTime() : 0) - (db ? db.getTime() : 0);
    });
    const periodeUsed = periodeAll.slice(-limit);
    const periodeIdSet = {};
    periodeUsed.forEach(function(p) { periodeIdSet[String(p.id).trim().toUpperCase()] = p.id; });
    // BUG FIX #2: Hitung `cukup` dari periodeUsed (bukan periodeAll) agar
    // kondisi "minimal 2 arsip" relevan dengan data yang benar-benar ditampilkan.
    const cukup = periodeUsed.filter(function(p) { return p.status === 'Arsip'; }).length >= 2;
    const aspekRegex = (aspekFilter === 'ALL')
      ? /^A([1-6])-/
      : new RegExp('^' + aspekFilter.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '-');
    const isMapelMode = /^[A-Z]{2,4}$/.test(aspekFilter) && _surveiMapelKodeAll().indexOf(aspekFilter) >= 0;
    const isKegiatanMode = aspekFilter.indexOf('KEGIATAN_') === 0;
    const kegiatanKode = isKegiatanMode ? aspekFilter.replace('KEGIATAN_', '') : '';
    const jsheet = ss.getSheetByName('Survei_Jawaban');
    const jdata  = (jsheet && jsheet.getLastRow() > 1) ? jsheet.getDataRange().getValues() : [];
    // BUG FIX #3: Hapus deklarasi rataPerPeriode dan nPerPeriode yang tidak pernah
    // digunakan. Semua akumulasi dilakukan via sumAcc/cntAcc di bawah.
    const sumAcc = {};
    const cntAcc = {};
    periodeUsed.forEach(function(p) { sumAcc[p.id] = 0; cntAcc[p.id] = 0; });
    for (let i = 1; i < jdata.length; i++) {
      const pidRaw = String(jdata[i][1] || '');
      const pid = periodeIdSet[pidRaw.trim().toUpperCase()];
      if (!pid) continue;
      if (String(jdata[i][8] || '').toLowerCase() !== 'likert') continue;
      const v = parseInt(jdata[i][9], 10);
      if (isNaN(v) || v < 1 || v > 5) continue;
      const kode = String(jdata[i][6] || '').toUpperCase();
      const rl   = String(jdata[i][4] || '');
      const bgn  = String(jdata[i][7] || '');
      let match = false;
      if (isMapelMode) {
        if (rl !== 'Siswa' || bgn !== 'C') continue;
        match = (new RegExp('^' + aspekFilter + '-([1-4])$')).test(kode);
      } else if (isKegiatanMode) {
        if (rl !== 'Siswa' || bgn !== 'D') continue;
        match = (new RegExp('^' + kegiatanKode + '-([1-3])$')).test(kode);
      } else {
        if (bgn !== 'A') continue;
        if (roleFilter !== 'ALL' && rl !== roleFilter) continue;
        match = aspekRegex.test(kode);
      }
      if (!match) continue;
      sumAcc[pid] += v;
      cntAcc[pid]++;
    }
    const series = periodeUsed.map(function(p) {
      const cnt = cntAcc[p.id] || 0;
      const rata = cnt > 0 ? Math.round((sumAcc[p.id] / cnt) * 100) / 100 : null;
      return {
        periodeId: p.id,
        label: p.namaPeriode,
        tahunAjaran: p.tahunAjaran,
        semester: p.semester,
        status: p.status,
        rataRata: rata,
        jumlahJawaban: cnt
      };
    });
    return {
      success: true,
      data: {
        periodeList: periodeUsed.map(function(p) { return { id: p.id, namaPeriode: p.namaPeriode, status: p.status }; }),
        series: series,
        cukup: cukup
      }
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
function getSurveiMikroAktif() {
  try {
    _ensureSheetsSurvei();
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Survei_Periode');
    if (!sheet || sheet.getLastRow() < 2) return { success: true, data: [] };
    const data = sheet.getDataRange().getValues();
    const list = [];
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][4]) !== 'mikro') continue;
      if (String(data[i][8]) !== 'Aktif') continue;
      const p = _surveiPeriodeRowToObj(data[i]);
      if (p) list.push(p);
    }
    return { success: true, data: list };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
function getSurveiMikroAktifUntukUser(username) {
  try {
    if (!username) return { success: true, data: [] };
    _ensureSheetsSurvei();
    const userInfo = _surveiGetUserInfo(username);
    if (!userInfo) return { success: true, data: [] };
    const aktif = getSurveiMikroAktif();
    if (!aktif || !aktif.success) return { success: true, data: [] };
    const mikroList = (aktif.data || []).filter(function(p) {
      const tr = Array.isArray(p.targetRole) ? p.targetRole : [];
      return tr.length === 0 || tr.indexOf(userInfo.role) >= 0;
    });
    if (mikroList.length === 0) return { success: true, data: [] };
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const progSheet = ss.getSheetByName('Survei_Progress');
    const progData  = (progSheet && progSheet.getLastRow() > 1) ? progSheet.getDataRange().getValues() : [];
    const submittedSet = {};
    for (let i = 1; i < progData.length; i++) {
      if (!_cmpUsername(progData[i][2], username)) continue;
      const status = String(progData[i][6] || '').toLowerCase();
      if (status === 'selesai' || status === 'submitted') submittedSet[String(progData[i][1])] = true;
    }
    const result = mikroList.map(function(p) {
      return { periode: p, sudahMengisi: !!submittedSet[p.id] };
    });
    return { success: true, data: result };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
function createSurveiMikro(nama, pertanyaanList, targetRole, tglBuka, tglTutup, adminUser) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    if (!_isAdminAtauKepalaMadrasah(adminUser)) {
      return { success: false, message: 'Akses ditolak. Hanya Admin atau Kepala Madrasah yang dapat membuat survei mikro.' };
    }
    nama = String(nama || '').trim();
    if (!nama) return { success: false, message: 'Nama survei wajib diisi.' };
    if (!Array.isArray(pertanyaanList) || pertanyaanList.length < 3 || pertanyaanList.length > 7) {
      return { success: false, message: 'Survei mikro harus berisi 3 hingga 7 pertanyaan.' };
    }
    let targetRoleArr = [];
    if (Array.isArray(targetRole)) {
      targetRoleArr = targetRole.map(function(r) { return String(r || '').trim(); }).filter(function(r) { return r; });
    } else if (typeof targetRole === 'string') {
      try {
        const p = JSON.parse(targetRole);
        if (Array.isArray(p)) targetRoleArr = p;
      } catch (_) {
        targetRoleArr = String(targetRole).split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s; });
      }
    }
    const validRoles = ['Siswa', 'Guru', 'Orangtua'];
    targetRoleArr = targetRoleArr.filter(function(r) { return validRoles.indexOf(r) >= 0; });
    if (targetRoleArr.length === 0) {
      return { success: false, message: 'Pilih minimal satu target role.' };
    }
    let jumlahEsai = 0;
    const cleanQ = [];
    for (let i = 0; i < pertanyaanList.length; i++) {
      const q = pertanyaanList[i] || {};
      const tipe = String(q.tipe || 'likert').trim().toLowerCase();
      const label = String(q.label || q.teks || '').trim();
      if (!label) return { success: false, message: 'Pertanyaan #' + (i + 1) + ' kosong.' };
      if (tipe !== 'likert' && tipe !== 'esai') {
        return { success: false, message: 'Pertanyaan #' + (i + 1) + ': tipe harus "likert" atau "esai".' };
      }
      if (tipe === 'esai') jumlahEsai++;
      cleanQ.push({
        kode: 'MK-' + (i + 1),
        tipe: tipe,
        label: label
      });
    }
    if (jumlahEsai > 1) {
      return { success: false, message: 'Maksimal 1 pertanyaan tipe esai per survei mikro (sesuai PRD).' };
    }
    const tBuka  = _surveiParseDate(tglBuka);
    const tTutup = _surveiParseDate(tglTutup);
    if (!tBuka)  return { success: false, message: 'Tanggal buka tidak valid.' };
    if (!tTutup) return { success: false, message: 'Tanggal tutup tidak valid.' };
    if (tTutup.getTime() <= tBuka.getTime()) {
      return { success: false, message: 'Tanggal tutup harus lebih besar dari tanggal buka.' };
    }
    const selisihHari = Math.round((tTutup.getTime() - tBuka.getTime()) / (1000 * 60 * 60 * 24));
    if (selisihHari < 3 || selisihHari > 14) {
      return { success: false, message: 'Durasi survei mikro harus antara 3 hingga 14 hari (saat ini: ' + selisihHari + ' hari).' };
    }
    _ensureSheetsSurvei();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Survei_Periode');
    const id = Utilities.getUuid();
    const now = new Date();
    const payload = JSON.stringify({
      target: targetRoleArr,
      pertanyaan: cleanQ
    });
    sheet.appendRow([
      id,
      nama,
      '',
      '',
      'mikro',
      payload,
      _surveiFormatTanggal(tBuka),
      _surveiFormatTanggal(tTutup),
      'Aktif',
      'belum_diisi',
      adminUser,
      _surveiFormatWIB(now),
      ''
    ]);
    logActivity(adminUser, 'CREATE_SURVEI_MIKRO',
      'Membuat survei mikro: ' + nama + ' (' + cleanQ.length + ' pertanyaan)');
    return {
      success: true,
      data: { id: id, nama: nama, jumlahPertanyaan: cleanQ.length }
    };
  } catch (e) {
    return { success: false, message: e.message };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}
function saveSurveiMikroJawaban(periodeId, username, jawabanList, logUser) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    if (!periodeId) return { success: false, message: 'Periode tidak ditemukan.' };
    if (!username)  return { success: false, message: 'Pengguna tidak teridentifikasi.' };
    if (!Array.isArray(jawabanList) || jawabanList.length === 0) {
      return { success: false, message: 'Tidak ada jawaban untuk disimpan.' };
    }
    _ensureSheetsSurvei();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const periode = _surveiGetPeriodeById(periodeId);
    if (!periode) return { success: false, message: 'Periode tidak ditemukan.' };
    if (String(periode.tipe) !== 'mikro') {
      return { success: false, message: 'Periode bukan survei mikro.' };
    }
    if (String(periode.status) !== 'Aktif') {
      return { success: false, message: 'Survei mikro sudah ditutup.' };
    }
    const userInfo = _surveiGetUserInfo(username);
    if (!userInfo) return { success: false, message: 'Pengguna tidak ditemukan.' };
    const tr = periode.targetRole || [];
    if (tr.length > 0 && tr.indexOf(userInfo.role) < 0) {
      return { success: false, message: 'Survei ini tidak ditargetkan untuk role Anda.' };
    }
    const qMap = {};
    (periode.pertanyaan || []).forEach(function(q) { qMap[q.kode] = q; });
    const prog = _surveiGetOrCreateProgressRow(periodeId, username, { userInfo: userInfo, markStart: true });
    const progressSheet = prog.sheet;
    const progressRowIdx = prog.rowIdx;
    if (!prog.record.timestampMulai) {
      progressSheet.getRange(progressRowIdx, 18).setValue(_surveiFormatWIB(new Date()));
    }
    if (prog.record.statusUtama === 'selesai' || prog.record.statusUtama === 'submitted') {
      return { success: false, message: 'Survei mikro sudah disubmit dan tidak dapat diubah.' };
    }
    const jsheet = ss.getSheetByName('Survei_Jawaban');
    const jdata  = jsheet.getDataRange().getValues();
    const existingMap = {};
    for (let i = 1; i < jdata.length; i++) {
      if (String(jdata[i][1]) === String(periodeId) && _cmpUsername(jdata[i][2], username)) {
        existingMap[String(jdata[i][6] || '')] = i + 1;
      }
    }
    const ts = _surveiFormatWIB(new Date());
    let upserted = 0;
    const rejected = [];
    jawabanList.forEach(function(j) {
      const kode = String(j.kode || '').trim();
      if (!kode) return;
      const q = qMap[kode];
      if (!q) { rejected.push(kode); return; }
      const tipe = q.tipe;
      let skala = null;
      let teks  = null;
      if (tipe === 'likert') {
        const v = parseInt(j.skala, 10);
        if (isNaN(v) || v < 1 || v > 5) return;
        skala = v;
      } else if (tipe === 'esai') {
        teks = (j.teks == null) ? '' : String(j.teks);
      } else {
        return;
      }
      if (existingMap[kode]) {
        const r = existingMap[kode];
        jsheet.getRange(r, 8).setValue('MIKRO');
        jsheet.getRange(r, 9).setValue(tipe);
        jsheet.getRange(r, 10).setValue(skala === null ? '' : skala);
        jsheet.getRange(r, 11).setValue(teks  === null ? '' : teks);
        jsheet.getRange(r, 12).setValue(ts);
      } else {
        const id = Utilities.getUuid();
        jsheet.appendRow([
          id,
          periodeId,
          safeText(userInfo.username),  
          userInfo.fullName,
          userInfo.role,
          userInfo.kelas || '',
          kode,
          'MIKRO',
          tipe,
          skala === null ? '' : skala,
          teks  === null ? '' : teks,
          ts
        ]);
        existingMap[kode] = jsheet.getLastRow();
      }
      upserted++;
    });
    SpreadsheetApp.flush();
    const totalQ = (periode.pertanyaan || []).length;
    const newJData = jsheet.getDataRange().getValues();
    let cnt = 0;
    for (let i = 1; i < newJData.length; i++) {
      if (String(newJData[i][1]) !== String(periodeId)) continue;
      if (!_cmpUsername(newJData[i][2], username))  continue;
      // BUG FIX #4: Tambahkan filter kolom Bagian = 'MIKRO' untuk memastikan
      // hanya jawaban survei mikro ini yang dihitung, bukan jawaban dari survei
      // lain yang mungkin tersimpan di sheet Survei_Jawaban dengan periodeId berbeda
      // tapi username yang sama. Ini juga mengamankan dari edge case data korup.
      if (String(newJData[i][7] || '').toUpperCase() !== 'MIKRO') continue;
      const tipeR = String(newJData[i][8] || '').toLowerCase();
      const skalaR = newJData[i][9];
      const teksR  = newJData[i][10];
      let isFilled = false;
      if (tipeR === 'likert') {
        const v = parseInt(skalaR, 10);
        isFilled = !isNaN(v) && v >= 1 && v <= 5;
      } else if (tipeR === 'esai') {
        isFilled = (teksR != null && String(teksR).trim().length > 0);
      }
      if (isFilled) cnt++;
    }
    const persen = totalQ > 0 ? Math.round((cnt / totalQ) * 1000) / 10 : 0;
    const statusUtama = (cnt === 0) ? 'belum_mulai' : (cnt >= totalQ ? 'selesai' : 'in_progress');
    progressSheet.getRange(progressRowIdx, 7).setValue(statusUtama);
    progressSheet.getRange(progressRowIdx, 9).setValue(persen);
    if (statusUtama === 'selesai') {
      progressSheet.getRange(progressRowIdx, 19).setValue(_surveiFormatWIB(new Date()));
    }
    SpreadsheetApp.flush();
    if (statusUtama === 'selesai') {
      logActivity(logUser || username, 'SUBMIT_SURVEI_MIKRO',
        'Submit survei mikro: ' + periode.namaPeriode);
    }
    const result = {
      success: true,
      data: {
        upserted: upserted,
        persenSelesai: persen,
        statusUtama: statusUtama,
        total: totalQ,
        terisi: cnt
      }
    };
    if (rejected.length > 0) {
      result.data.rejected = rejected;
      result.data.warning = 'Beberapa jawaban ditolak karena kode tidak ditemukan dalam pertanyaan survei: ' + rejected.join(', ');
    }
    return result;
  } catch (e) {
    return { success: false, message: e.message };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}
function getLaporanSurveiMikro(periodeId, adminUser) {
  try {
    if (!_isAdminAtauKepalaMadrasah(adminUser)) {
      return { success: false, message: 'Akses ditolak.' };
    }
    if (!periodeId) return { success: false, message: 'ID periode tidak boleh kosong.' };
    _ensureSheetsSurvei();
    const periode = _surveiGetPeriodeById(periodeId);
    if (!periode) return { success: false, message: 'Periode tidak ditemukan.' };
    if (String(periode.tipe) !== 'mikro') {
      return { success: false, message: 'Periode bukan survei mikro.' };
    }
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const jsheet = ss.getSheetByName('Survei_Jawaban');
    const jdata  = (jsheet && jsheet.getLastRow() > 1) ? jsheet.getDataRange().getValues() : [];
    const respondenSet = {};
    const perKode = {};
    (periode.pertanyaan || []).forEach(function(q) {
      const k = String(q.kode).trim().toUpperCase();
      perKode[k] = {
        kode: q.kode,
        tipe: q.tipe,
        label: q.label,
        likertHist: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        likertSum: 0,
        likertCnt: 0,
        esaiList: []
      };
    });
    for (let i = 1; i < jdata.length; i++) {
      if (String(jdata[i][1]).trim().toUpperCase() !== String(periodeId).trim().toUpperCase()) continue;
      if (String(jdata[i][7] || '').toUpperCase() !== 'MIKRO') continue;
      const kode = String(jdata[i][6] || '').trim().toUpperCase();
      const u    = String(jdata[i][2] || '');
      respondenSet[u] = true;
      const acc = perKode[kode];
      if (!acc) continue;
      const tipeR = String(jdata[i][8] || '').toLowerCase();
      if (tipeR === 'likert') {
        const v = parseInt(jdata[i][9], 10);
        if (isNaN(v) || v < 1 || v > 5) continue;
        acc.likertHist[v]++;
        acc.likertSum += v;
        acc.likertCnt++;
      } else if (tipeR === 'esai') {
        const teks = String(jdata[i][10] || '').trim();
        if (!teks) continue;
        acc.esaiList.push({
          username:    jdata[i][2] || '',
          namaLengkap: jdata[i][3] || '',
          role:        jdata[i][4] || '',
          kelas:       jdata[i][5] || '',
          teks:        teks,
          timestamp:   jdata[i][11] || ''
        });
      }
    }
    const perPertanyaan = (periode.pertanyaan || []).map(function(q) {
      const k = String(q.kode).trim().toUpperCase();
      const acc = perKode[k];
      const out = {
        kode: q.kode,
        tipe: q.tipe,
        label: q.label
      };
      if (q.tipe === 'likert') {
        out.distribusi = acc.likertHist;
        out.rataRata = acc.likertCnt > 0 ? Math.round((acc.likertSum / acc.likertCnt) * 100) / 100 : null;
        out.jumlahJawaban = acc.likertCnt;
      } else {
        // BUG FIX #5: localeCompare pada timestamp format "dd MMMM yyyy, HH:mm:ss"
        // (bahasa Indonesia) tidak andal karena urutan leksikografis string
        // tidak sama dengan urutan kronologis. Gunakan _surveiParseDate untuk
        // konversi ke Date object yang bisa dibandingkan secara numerik.
        out.esaiList = acc.esaiList.sort(function(a, b) {
          const ta = _surveiParseDate(String(a.timestamp || ''));
          const tb = _surveiParseDate(String(b.timestamp || ''));
          const va = ta ? ta.getTime() : 0;
          const vb = tb ? tb.getTime() : 0;
          return vb - va; // descending: terbaru di atas
        });
        out.jumlahJawaban = acc.esaiList.length;
      }
      return out;
    });
    return {
      success: true,
      data: {
        periode: periode,
        jumlahResponden: Object.keys(respondenSet).length,
        perPertanyaan: perPertanyaan
      }
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
function _isAdminOnly(adminUser) {
  if (!adminUser) return false;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  if (!sheet) return false;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1] || '').trim() === String(adminUser).trim()) {
      return data[i][3] === 'Admin';
    }
  }
  return false;
}
function _surveiSettingsGet(key) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings');
  if (!sheet) return '';
  const data = sheet.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0] || '').trim() === String(key)) {
      return String(data[i][1] || '');
    }
  }
  return '';
}
function _surveiSettingsSet(key, value) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings');
  if (!sheet) throw new Error('Sheet Settings tidak ditemukan.');
  const data = sheet.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0] || '').trim() === String(key)) {
      sheet.getRange(i + 1, 2).setValue(value);
      SpreadsheetApp.flush();
      return true;
    }
  }
  sheet.appendRow([key, value]);
  SpreadsheetApp.flush();
  return true;
}

function simpanKonfigurasiAI(config, adminUser) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    if (!_isAdminOnly(adminUser)) {
      return { success: false, message: 'Akses ditolak. Hanya Admin yang dapat mengkonfigurasi AI.' };
    }
    
    if (config.apiKey !== undefined) _surveiSettingsSet('Gemini_API_Key', String(config.apiKey).trim());
    if (config.model !== undefined) _surveiSettingsSet('Gemini_Model', String(config.model).trim());
    if (config.temperature !== undefined) _surveiSettingsSet('Gemini_Temperature', String(config.temperature).trim());
    
    logActivity(adminUser, 'KONFIGURASI_AI', 'Menyimpan konfigurasi Gemini AI (Key, Model, Temperature).');
    
    return { success: true, message: 'Konfigurasi AI berhasil disimpan.' };
  } catch (e) {
    return { success: false, message: e.message };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function getKonfigurasiAI(adminUser) {
  if (!_isAdminOnly(adminUser)) {
    return { apiKey: '', model: 'gemini-2.5-flash', temperature: 0.7 };
  }
  
  const tempStr = _surveiSettingsGet('Gemini_Temperature');
  const temp = tempStr ? parseFloat(tempStr) : 0.7;

  return {
    apiKey: _surveiSettingsGet('Gemini_API_Key') || '',
    model: _surveiSettingsGet('Gemini_Model') || 'gemini-2.5-flash',
    temperature: isNaN(temp) ? 0.7 : temp
  };
}
function simpanAnthropicApiKey(apiKey, adminUser) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    if (!_isAdminOnly(adminUser)) {
      return { success: false, message: 'Akses ditolak. Hanya Admin yang dapat mengkonfigurasi API key Anthropic.' };
    }
    const key = String(apiKey || '').trim();
    if (key && !/^sk-ant-[A-Za-z0-9_\-]+$/.test(key)) {
      return { success: false, message: 'Format API key Anthropic tidak valid. Key biasanya dimulai dengan "sk-ant-".' };
    }
    _surveiSettingsSet('Anthropic_API_Key', key);
    logActivity(adminUser, 'KONFIGURASI_AI',
      key ? 'Mengkonfigurasi API key Anthropic.' : 'Menghapus API key Anthropic.');
    return {
      success: true,
      message: key ? 'API key Anthropic berhasil disimpan.' : 'API key Anthropic berhasil dihapus.',
      data: { status: key ? 'terkonfigurasi' : 'belum' }
    };
  } catch (e) {
    return { success: false, message: e.message };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}
function getAnthropicConfig(adminUser) {
  try {
    if (!_isAdminAtauKepalaMadrasah(adminUser)) {
      return { success: false, message: 'Akses ditolak.' };
    }
    const apiKey = _surveiSettingsGet('Anthropic_API_Key');
    let model = _surveiSettingsGet('Anthropic_Model');
    if (!model) model = 'claude-sonnet-4-20250514';
    return {
      success: true,
      data: {
        model: model,
        status: apiKey ? 'terkonfigurasi' : 'belum',
        hint: apiKey ? ('•••• ' + apiKey.slice(-4)) : ''
      }
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
function getEsaiUntukAnalisis(periodeId, scopeAnalisis, adminUser) {
  try {
    if (!_isAdminAtauKepalaMadrasah(adminUser)) {
      return { success: false, message: 'Akses ditolak.' };
    }
    if (!periodeId)     return { success: false, message: 'ID periode tidak boleh kosong.' };
    if (!scopeAnalisis) return { success: false, message: 'Cakupan analisis tidak boleh kosong.' };
    _ensureSheetsSurvei();
    const scope = String(scopeAnalisis).trim().toUpperCase();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const out = [];
    if (scope === 'PEER_PTS7' || scope === 'PEER' || scope === 'PEER-PTS7') {
      const peerSheet = ss.getSheetByName('Survei_Peer');
      if (peerSheet && peerSheet.getLastRow() > 1) {
        const pdata = peerSheet.getDataRange().getValues();
        for (let i = 1; i < pdata.length; i++) {
          if (String(pdata[i][1]).trim().toUpperCase() !== String(periodeId).trim().toUpperCase()) continue;
          if (String(pdata[i][19] || '').toLowerCase() !== 'submitted') continue;
          const teks = String(pdata[i][12] || '').trim();
          if (!teks) continue;
          out.push({ teks: teks, kode: 'PTS-7' });
        }
      }
      return { success: true, data: out };
    }
    const sheet = ss.getSheetByName('Survei_Jawaban');
    if (!sheet || sheet.getLastRow() < 2) return { success: true, data: [] };
    const data = sheet.getDataRange().getValues();
    let bagian = '';
    let roleFilter = '';
    let kodePrefix = '';
    let kodeSuffix = '';
    if (scope.indexOf('BAGIAN_A') === 0) {
      bagian = 'A';
      kodePrefix = 'A7';
      if (scope === 'BAGIAN_A_SISWA')    roleFilter = 'Siswa';
      else if (scope === 'BAGIAN_A_GURU')     roleFilter = 'Guru';
      else if (scope === 'BAGIAN_A_ORANGTUA') roleFilter = 'Orangtua';
    } else if (scope.indexOf('BAGIAN_B') === 0) {
      bagian = 'B';
      if (scope === 'BAGIAN_B_SISWA')    roleFilter = 'Siswa';
      else if (scope === 'BAGIAN_B_GURU')     roleFilter = 'Guru';
      else if (scope === 'BAGIAN_B_ORANGTUA') roleFilter = 'Orangtua';
    } else if (scope.indexOf('MAPEL_') === 0) {
      bagian = 'C';
      const kode = scope.replace('MAPEL_', '');
      kodeSuffix = kode + '-5';
    } else if (scope.indexOf('KEGIATAN_') === 0) {
      bagian = 'D';
      const kode = scope.replace('KEGIATAN_', '');
      kodeSuffix = kode + '-4';
    } else {
      return { success: false, message: 'Cakupan analisis tidak dikenali: ' + scopeAnalisis };
    }
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]).trim().toUpperCase() !== String(periodeId).trim().toUpperCase()) continue;
      if (String(data[i][8] || '').toLowerCase() !== 'esai') continue;
      const rowBg = String(data[i][7] || '').toUpperCase();
      if (rowBg === 'ATTENTION') continue;
      if (bagian && rowBg !== bagian) continue;
      const kode = String(data[i][6] || '').toUpperCase();
      if (kodeSuffix && kode !== kodeSuffix) continue;
      if (kodePrefix && kode.indexOf(kodePrefix) !== 0) continue;
      const role = String(data[i][4] || '');
      if (roleFilter && role !== roleFilter) continue;
      const teks = String(data[i][10] || '').trim();
      if (!teks) continue;
      out.push({ teks: teks, kode: kode });
    }
    return { success: true, data: out };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
function getHasilAnalisisAI(periodeId, scopeAnalisis, adminUser) {
  try {
    if (!_isAdminAtauKepalaMadrasah(adminUser)) {
      return { success: false, message: 'Akses ditolak.' };
    }
    if (!periodeId)     return { success: false, message: 'ID periode tidak boleh kosong.' };
    if (!scopeAnalisis) return { success: false, message: 'Cakupan analisis tidak boleh kosong.' };
    _ensureSheetsSurvei();
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Survei_AI_Analisis');
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true, data: null };
    }
    const data = sheet.getDataRange().getValues();
    let found = null;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]).trim().toUpperCase() !== String(periodeId).trim().toUpperCase()) continue;
      if (String(data[i][2]).trim().toUpperCase() !== String(scopeAnalisis).trim().toUpperCase()) continue;
      if (String(data[i][9]) !== 'selesai') continue;
      // BUG FIX #3: Timestamp format "dd MMMM yyyy, HH:mm:ss" (bahasa Indonesia)
      // tidak dapat dibandingkan reliabel dengan localeCompare string karena
      // urutan leksikografis tidak sama dengan urutan kronologis (misal "01 Februari"
      // < "01 Januari" secara leksikografis padahal Februari > Januari).
      // Gunakan _surveiParseDate untuk konversi ke Date object yang bisa dibandingkan.
      const tsNew = _surveiParseDate(String(data[i][6] || ''));
      const tsOld = found ? _surveiParseDate(String(found.timestamp || '')) : null;
      if (!found || (tsNew && (!tsOld || tsNew.getTime() > tsOld.getTime()))) {
        found = {
          id:                data[i][0] || '',
          periodeId:         data[i][1] || '',
          scopeAnalisis:     data[i][2] || '',
          jumlahEsai:        Number(data[i][3] || 0),
          hasilAnalisis:     null,
          dimintaOleh:       data[i][5] || '',
          timestamp:         data[i][6] || '',
          modelAI:           data[i][7] || '',
          tokenDigunakan:    Number(data[i][8] || 0),
          status:            data[i][9] || '',
          pesanError:        data[i][10] || ''
        };
        try { found.hasilAnalisis = JSON.parse(String(data[i][4] || '{}')); }
        catch (_) { found.hasilAnalisis = null; }
      }
    }
    if (!found) return { success: true, data: null };
    return { success: true, data: found };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
function jalankanAnalisisAI(periodeId, scopeAnalisis, adminUser) {
  try {
    if (!_isAdminAtauKepalaMadrasah(adminUser)) {
      return { success: false, message: 'Akses ditolak.' };
    }
    if (!periodeId)     return { success: false, message: 'ID periode tidak boleh kosong.' };
    if (!scopeAnalisis) return { success: false, message: 'Cakupan analisis tidak boleh kosong.' };
    _ensureSheetsSurvei();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const esaiRes = getEsaiUntukAnalisis(periodeId, scopeAnalisis, adminUser);
    if (!esaiRes || !esaiRes.success) {
      return { success: false, message: (esaiRes && esaiRes.message) || 'Gagal mengambil daftar esai.' };
    }
    const esaiList = esaiRes.data || [];
    if (esaiList.length < 5) {
      return {
        success: false,
        message: 'Minimal 5 jawaban esai diperlukan untuk analisis. Saat ini tersedia ' + esaiList.length + ' esai.'
      };
    }
    const apiKey = _surveiSettingsGet('Anthropic_API_Key');
    if (!apiKey) {
      return { success: false, message: 'API Key Anthropic belum dikonfigurasi. Hubungi Admin.' };
    }
    let modelName = _surveiSettingsGet('Anthropic_Model');
    if (!modelName) modelName = 'claude-sonnet-4-20250514';
    // BUG FIX #1: Batasi jumlah esai yang dikirim ke Claude agar tidak melampaui
    // context window dan mencegah biaya token yang tidak terduga.
    // Maksimal 150 esai dipilih secara acak (shuffle sederhana) agar representatif.
    const MAX_ESAI_ANALISIS = 150;
    let esaiUntukAnalisis = esaiList;
    if (esaiList.length > MAX_ESAI_ANALISIS) {
      // Fisher-Yates shuffle deterministik dengan seed sederhana
      const shuffled = esaiList.slice();
      for (let si = shuffled.length - 1; si > 0; si--) {
        const sj = Math.floor(Math.abs(Math.sin(si * 9301 + 49297)) * shuffled.length) % (si + 1);
        const tmp = shuffled[si]; shuffled[si] = shuffled[sj]; shuffled[sj] = tmp;
      }
      esaiUntukAnalisis = shuffled.slice(0, MAX_ESAI_ANALISIS);
    }
    const esaiGabung = esaiUntukAnalisis.map(function(e, idx) {
      let teks = String(e.teks || '');
      if (teks.length > 1500) teks = teks.substring(0, 1500) + '... [dipotong]';
      return (idx + 1) + '. ' + teks;
    }).join('\n');
    const systemPrompt = [
      'Kamu adalah analis pendidikan profesional yang membantu kepala madrasah memahami',
      'umpan balik dari survei evaluasi pembelajaran. Tugasmu adalah menganalisis kumpulan',
      'jawaban esai responden dan menghasilkan ringkasan terstruktur yang objektif, akurat,',
      'dan dapat ditindaklanjuti. Selalu gunakan Bahasa Indonesia yang formal dan lugas.',
      'Jaga kerahasiaan — jangan mencoba mengidentifikasi individu dari jawaban mereka.',
      'Respons HANYA dalam format JSON yang valid, tanpa teks tambahan di luar JSON.'
    ].join(' ');
    const userPrompt = [
      'Berikut adalah ' + esaiUntukAnalisis.length + ' jawaban esai dari responden survei' +
        (esaiList.length > MAX_ESAI_ANALISIS ? ' (sampel dari ' + esaiList.length + ' total)' : '') + '.',
      'Topik/cakupan: ' + scopeAnalisis,
      '',
      '--- JAWABAN ESAI ---',
      esaiGabung,
      '--- AKHIR JAWABAN ---',
      '',
      'Analisis seluruh jawaban di atas dan kembalikan HANYA objek JSON berikut',
      '(tanpa markdown, tanpa kode blok, tanpa teks di luar JSON):',
      '{',
      '  "ringkasan_umum": "Paragraf 2-3 kalimat yang merangkum keseluruhan umpan balik.",',
      '  "tema_positif": ["tema positif 1", "tema 2", "tema 3"],',
      '  "tema_perlu_perhatian": ["tema yang perlu diperbaiki 1", "tema 2"],',
      '  "kutipan_representatif": [',
      '    {"teks": "kutipan singkat mewakili sentimen positif", "sentimen": "positif"},',
      '    {"teks": "kutipan singkat mewakili masukan konstruktif", "sentimen": "konstruktif"}',
      '  ],',
      '  "rekomendasi_tindakan": [',
      '    "rekomendasi konkret 1 yang dapat ditindaklanjuti",',
      '    "rekomendasi konkret 2",',
      '    "rekomendasi konkret 3"',
      '  ],',
      '  "skor_sentimen_keseluruhan": "positif"',
      '}',
      '',
      'Nilai "skor_sentimen_keseluruhan" hanya boleh: "positif", "campuran", atau "perlu_perhatian".'
    ].join('\n');
    const payload = {
      model: modelName,
      max_tokens: 2048,
      temperature: 0.3,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    };
    const options = {
      method: 'POST',
      contentType: 'application/json',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    const response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    if (responseCode !== 200) {
      let errMsg = '';
      try { errMsg = JSON.parse(responseText).error.message; }
      catch (pe) { errMsg = responseText; }
      _surveiAiCacheTulisError(periodeId, scopeAnalisis, esaiUntukAnalisis.length, adminUser, modelName,
        'API error ' + responseCode + ': ' + errMsg);
      return { success: false, message: 'Anthropic API error ' + responseCode + ': ' + errMsg };
    }
    const responseJson = JSON.parse(responseText);
    if (!responseJson.content || !responseJson.content[0] || !responseJson.content[0].text) {
      _surveiAiCacheTulisError(periodeId, scopeAnalisis, esaiUntukAnalisis.length, adminUser, modelName,
        'Format response tidak valid dari Claude.');
      return { success: false, message: 'Format response tidak valid dari Claude.' };
    }
    const rawText = responseJson.content[0].text;
    const cleanJson = rawText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();
    let hasilAnalisis;
    try {
      hasilAnalisis = JSON.parse(cleanJson);
    } catch (parseErr) {
      _surveiAiCacheTulisError(periodeId, scopeAnalisis, esaiUntukAnalisis.length, adminUser, modelName,
        'Gagal mem-parse JSON dari Claude: ' + parseErr.message);
      return { success: false, message: 'Gagal mem-parse hasil dari Claude. Coba lagi atau periksa konfigurasi.' };
    }
    const tokenDigunakan = responseJson.usage
      ? (Number(responseJson.usage.input_tokens || 0) + Number(responseJson.usage.output_tokens || 0))
      : 0;
    const cacheSheet = ss.getSheetByName('Survei_AI_Analisis');
    if (cacheSheet && cacheSheet.getLastRow() > 1) {
      const cdata = cacheSheet.getDataRange().getValues();
      for (let i = cdata.length - 1; i >= 1; i--) {
        if (String(cdata[i][1]) === String(periodeId) &&
            String(cdata[i][2]) === String(scopeAnalisis) &&
            String(cdata[i][9]) === 'selesai') {
          cacheSheet.deleteRow(i + 1);
        }
      }
    }
    const wib = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd MMMM yyyy, HH:mm:ss');
    const newId = Utilities.getUuid();
    cacheSheet.appendRow([
      newId,
      periodeId,
      scopeAnalisis,
      esaiUntukAnalisis.length,
      JSON.stringify(hasilAnalisis),
      adminUser,
      wib,
      modelName,
      tokenDigunakan,
      'selesai',
      ''
    ]);
    SpreadsheetApp.flush();
    logActivity(adminUser, 'ANALISIS_AI',
      'Scope: ' + scopeAnalisis + ' | ' + esaiUntukAnalisis.length + ' dari ' + esaiList.length + ' esai | ' + tokenDigunakan + ' token');
    return {
      success: true,
      data: {
        id:             newId,
        periodeId:      periodeId,
        scopeAnalisis:  scopeAnalisis,
        jumlahEsai:     esaiUntukAnalisis.length,
        hasilAnalisis:  hasilAnalisis,
        dimintaOleh:    adminUser,
        timestamp:      wib,
        modelAI:        modelName,
        tokenDigunakan: tokenDigunakan,
        status:         'selesai',
        pesanError:     ''
      },
      fromCache: false
    };
  } catch (e) {
    try {
      _surveiAiCacheTulisError(periodeId, scopeAnalisis, 0, adminUser,
        _surveiSettingsGet('Anthropic_Model') || 'claude-sonnet-4-20250514',
        e.message || String(e));
    } catch (_) {}
    return { success: false, message: 'Terjadi kesalahan: ' + (e.message || e) };
  }
}
function _surveiAiCacheTulisError(periodeId, scopeAnalisis, jumlahEsai, adminUser, modelName, pesanError) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Survei_AI_Analisis');
    if (!sheet) return;
    const wib = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd MMMM yyyy, HH:mm:ss');
    sheet.appendRow([
      Utilities.getUuid(),
      periodeId,
      scopeAnalisis,
      jumlahEsai || 0,
      '{}',
      adminUser || '',
      wib,
      modelName || 'claude-sonnet-4-20250514',
      0,
      'gagal',
      String(pesanError || '')
    ]);
    SpreadsheetApp.flush();
  } catch (_) {
  }
}
function hapusCacheAnalisisAI(periodeId, scopeAnalisis, adminUser) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    if (!_isAdminAtauKepalaMadrasah(adminUser)) {
      return { success: false, message: 'Akses ditolak.' };
    }
    if (!periodeId)     return { success: false, message: 'ID periode tidak boleh kosong.' };
    if (!scopeAnalisis) return { success: false, message: 'Cakupan analisis tidak boleh kosong.' };
    _ensureSheetsSurvei();
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Survei_AI_Analisis');
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true, data: { dihapus: 0 } };
    }
    const data = sheet.getDataRange().getValues();
    let dihapus = 0;
    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][1]).trim().toUpperCase() === String(periodeId).trim().toUpperCase() &&
          String(data[i][2]).trim().toUpperCase() === String(scopeAnalisis).trim().toUpperCase()) {
        // BUG FIX #2: Hapus SEMUA baris terkait (selesai maupun gagal) bukan hanya 'selesai'.
        // Sebelumnya baris status='gagal' tidak ikut dihapus sehingga menumpuk di sheet.
        const statusRow = String(data[i][9] || '');
        if (statusRow === 'selesai' || statusRow === 'gagal') {
          sheet.deleteRow(i + 1);
          dihapus++;
        }
      }
    }
    SpreadsheetApp.flush();
    logActivity(adminUser, 'HAPUS_CACHE_AI',
      'Scope: ' + scopeAnalisis + ' | ' + dihapus + ' baris cache dihapus');
    return { success: true, data: { dihapus: dihapus } };
  } catch (e) {
    return { success: false, message: e.message };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}
function _ensurePiketHadirSheet_() {
  const HEADER = ['id','tanggal','username_piket','fullName_piket','tipe',
                  'username_digantikan','status_konfirmasi','dikonfirmasi_oleh','waktu_konfirmasi'];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Piket_Hadir');
  if (!sheet) {
    sheet = ss.insertSheet('Piket_Hadir');
    sheet.getRange(1, 1, 1, HEADER.length).setValues([HEADER]);
    sheet.setFrozenRows(1);
    // Paksa kolom tanggal (B) sebagai plain text agar tidak auto-convert ke Date
    sheet.getRange('B:B').setNumberFormat('@');
  } else {
    // Jika kolom B belum plain text, migrasi data lama dan set format
    const fmt = sheet.getRange('B2').getNumberFormat();
    if (fmt !== '@') {
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        // Baca semua nilai tanggal (baris 2 dst), normalize ke string, tulis kembali
        const tanggalRange = sheet.getRange(2, 2, lastRow - 1, 1);
        const tanggalVals = tanggalRange.getValues();
        const tz = Session.getScriptTimeZone();
        const normalized = tanggalVals.map(function(row) {
          var v = row[0];
          if (v instanceof Date) {
            return [Utilities.formatDate(v, tz, 'yyyy-MM-dd')];
          }
          return [String(v).trim()];
        });
        // Set format dulu ke '@' sebelum tulis string agar tidak di-reconvert
        sheet.getRange('B:B').setNumberFormat('@');
        tanggalRange.setValues(normalized);
      } else {
        sheet.getRange('B:B').setNumberFormat('@');
      }
    }
  }
  return sheet;
}

function _todayStr_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

// Normalize nilai tanggal dari sel sheet (bisa Date object atau string) ke string 'yyyy-MM-dd'
function _normalizeDateStr_(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  // Sudah string, kembalikan apa adanya (trim whitespace)
  return String(val).trim();
}

function _isAdmin_(username) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Users');
  if (!sheet) return false;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === username) {
      return data[i][3] === 'Admin';
    }
  }
  return false;
}

function _getUserData_(username) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Users');
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === username) {
      const tugasTambahanStr = data[i][4] ? String(data[i][4]) : '';
      const piketStr = data[i][8] ? String(data[i][8]) : '';
      return {
        role: data[i][3],
        tugasTambahan: tugasTambahanStr ? tugasTambahanStr.split(',').map(s => s.trim()) : [],
        fullName: data[i][7],
        piket: piketStr ? piketStr.split(',').map(s => s.trim()) : []
      };
    }
  }
  return null;
}

function _isPiketTerkonfirmasi_(username) {
  const sheet = _ensurePiketHadirSheet_();
  const data = sheet.getDataRange().getValues();
  const today = _todayStr_();
  for (let i = 1; i < data.length; i++) {
    if (data[i][2] === username
        && _normalizeDateStr_(data[i][1]) === today
        && data[i][6] === 'Hadir') {
      return true;
    }
  }
  return false;
}

/**
 * Fungsi publik untuk frontend: mengecek apakah guru yang sedang login
 * merupakan guru piket pengganti yang sudah dikonfirmasi (status Hadir)
 * di sheet Piket_Hadir untuk hari ini, tanpa memandang tipe (Utama/Pengganti).
 * Digunakan oleh halaman Manajemen Absensi di frontend sebelum memblokir
 * akses guru yang punya jadwal piket di hari lain namun hari ini ditunjuk
 * sebagai pengganti dan sudah dikonfirmasi.
 */
function cekPiketPenggantiTerkonfirmasi(username, sessionToken) {
  let session;
  try { session = verifySession(sessionToken); } catch (e) { session = { valid: false }; }
  if (!session || session.valid !== true || !session.user
      || !_cmpUsername(session.user.username, username)) {
    return { success: false, terkonfirmasi: false };
  }
  return { success: true, terkonfirmasi: _isPiketTerkonfirmasi_(username) };
}

function initPiketHadirSheet(adminUsername) {
  if (!_isAdmin_(adminUsername)) {
    return { success: false, message: 'Akses ditolak.' };
  }
  _ensurePiketHadirSheet_();
  return { success: true };
}

function getPiketHariIni(adminUsername) {
  if (!_isAdmin_(adminUsername)) {
    return { success: false, message: 'Akses ditolak.' };
  }
  const DAY_NAMES = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const todayName = DAY_NAMES[new Date().getDay()];
  const today = _todayStr_();

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Baca Users: filter guru piket hari ini
  const usersSheet = ss.getSheetByName('Users');
  const usersData = usersSheet ? usersSheet.getDataRange().getValues() : [];
  const guruPiket = [];
  for (let i = 1; i < usersData.length; i++) {
    const row = usersData[i];
    const role = row[3];
    const tugasTambahanStr = row[4] ? String(row[4]) : '';
    const tugasTambahan = tugasTambahanStr ? tugasTambahanStr.split(',').map(s => s.trim()) : [];
    const piketStr = row[8] ? String(row[8]) : '';
    const piket = piketStr ? piketStr.split(',').map(s => s.trim()) : [];
    if (role === 'Guru' && tugasTambahan.includes('Guru Piket') && piket.includes(todayName)) {
      guruPiket.push({ username: row[1], fullName: row[7] });
    }
  }

  // Baca Piket_Hadir: buat map username → status_konfirmasi untuk hari ini tipe Utama
  // dan set username guru yang sudah ditunjuk penggantinya (tipe Pengganti)
  const piketSheet = _ensurePiketHadirSheet_();
  const piketData = piketSheet.getDataRange().getValues();
  const statusMap = {};
  const digantikanSet = new Set(); // username guru yang sudah ada penggantinya hari ini
  for (let i = 1; i < piketData.length; i++) {
    const row = piketData[i];
    if (_normalizeDateStr_(row[1]) !== today) continue;
    if (row[4] === 'Utama') {
      statusMap[row[2]] = row[6]; // username_piket → status_konfirmasi
    } else if (row[4] === 'Pengganti' && row[5]) {
      digantikanSet.add(String(row[5]).trim()); // username_digantikan
    }
  }

  // Gabungkan
  return guruPiket.map(g => ({
    username: g.username,
    fullName: g.fullName,
    status_konfirmasi: statusMap[g.username] || 'Belum Dikonfirmasi',
    sudah_ada_sesi: !!statusMap[g.username],
    sudah_digantikan: digantikanSet.has(String(g.username).trim())
  }));
}

function konfirmasiPiketUtama(usernameGuru, adminUsername) {
  if (!_isAdmin_(adminUsername)) {
    return { success: false, message: 'Akses ditolak.' };
  }

  const DAY_NAMES = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const todayName = DAY_NAMES[new Date().getDay()];
  const today = _todayStr_();

  const userData = _getUserData_(usernameGuru);
  if (!userData || userData.role !== 'Guru'
      || !(userData.tugasTambahan || []).includes('Guru Piket')
      || !(userData.piket || []).includes(todayName)) {
    return { success: false, message: 'Guru ini tidak terjadwal piket hari ini.' };
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const sheet = _ensurePiketHadirSheet_();
    const data = sheet.getDataRange().getValues();

    // Cek duplikat di konfirmasiPiketUtama
    for (let i = 1; i < data.length; i++) {
      if (_normalizeDateStr_(data[i][1]) === today && data[i][2] === usernameGuru
          && data[i][4] === 'Utama' && data[i][6] === 'Hadir') {
        return { success: false, message: 'Guru piket tersebut sudah dikonfirmasi untuk hari ini.' };
      }
    }

    // Tulis baris baru
    const nowIso = new Date().toISOString();
    sheet.appendRow([
      Utilities.getUuid(),    // id
      today,                  // tanggal
      usernameGuru,           // username_piket
      userData.fullName,      // fullName_piket
      'Utama',                // tipe
      '',                     // username_digantikan
      'Hadir',                // status_konfirmasi
      adminUsername,          // dikonfirmasi_oleh
      nowIso                  // waktu_konfirmasi
    ]);
  } finally {
    lock.releaseLock();
  }

  logActivity(adminUsername, 'KONFIRMASI_PIKET_UTAMA', usernameGuru + ' dikonfirmasi hadir piket utama');
  return { success: true };
}

function tunjukPiketPengganti(usernameGuru, usernameDigantikan, adminUsername) {
  if (!_isAdmin_(adminUsername)) {
    return { success: false, message: 'Akses ditolak.' };
  }

  const today = _todayStr_();
  const userData = _getUserData_(usernameGuru);
  if (!userData || userData.role !== 'Guru') {
    return { success: false, message: 'Pengguna bukan Guru yang valid.' };
  }

  const lock = LockService.getScriptLock();
  let newId;
  try {
    lock.waitLock(10000);
    const sheet = _ensurePiketHadirSheet_();
    const data = sheet.getDataRange().getValues();

    // Cek duplikat di tunjukPiketPengganti
    for (let i = 1; i < data.length; i++) {
      if (_normalizeDateStr_(data[i][1]) === today && data[i][2] === usernameGuru
          && data[i][4] === 'Pengganti' && data[i][5] === usernameDigantikan) {
        return { success: false, message: 'Penugasan pengganti ini sudah ada untuk hari ini.' };
      }
    }

    // Tulis baris baru
    newId = Utilities.getUuid();
    sheet.appendRow([
      newId,                  // id
      today,                  // tanggal
      usernameGuru,           // username_piket
      userData.fullName,      // fullName_piket
      'Pengganti',            // tipe
      usernameDigantikan,     // username_digantikan
      'Belum Dikonfirmasi',   // status_konfirmasi
      '',                     // dikonfirmasi_oleh
      ''                      // waktu_konfirmasi
    ]);
  } finally {
    lock.releaseLock();
  }

  logActivity(adminUsername, 'TUNJUK_PIKET_PENGGANTI',
    usernameGuru + ' ditunjuk menggantikan ' + usernameDigantikan);
  return { success: true, id: newId };
}

function getPiketPenggantiHariIni(adminUsername) {
  if (!_isAdmin_(adminUsername)) {
    return { success: false, message: 'Akses ditolak.' };
  }
  const today = _todayStr_();
  const sheet = _ensurePiketHadirSheet_();
  const data = sheet.getDataRange().getValues();

  // Buat map username → fullName dari sheet Users untuk resolve nama yang digantikan
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const usersSheet = ss.getSheetByName('Users');
  const fullNameMap = {};
  if (usersSheet) {
    const usersData = usersSheet.getDataRange().getValues();
    for (let i = 1; i < usersData.length; i++) {
      if (usersData[i][1]) fullNameMap[usersData[i][1]] = usersData[i][7] || usersData[i][1];
    }
  }

  const result = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (_normalizeDateStr_(row[1]) === today && row[4] === 'Pengganti') {
      result.push({
        id: row[0],
        username_piket: row[2],
        fullName_piket: row[3],
        username_digantikan: row[5],
        fullName_digantikan: fullNameMap[row[5]] || row[5],
        status_konfirmasi: row[6]
      });
    }
  }
  return result;
}

function konfirmasiPiketPengganti(idSesi, adminUsername) {
  if (!_isAdmin_(adminUsername)) {
    return { success: false, message: 'Akses ditolak.' };
  }

  const lock = LockService.getScriptLock();
  let targetUsername = '';
  try {
    lock.waitLock(10000);
    const sheet = _ensurePiketHadirSheet_();
    const data = sheet.getDataRange().getValues();

    let targetRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === idSesi) {
        targetRow = i;
        break;
      }
    }

    if (targetRow === -1 || data[targetRow][4] !== 'Pengganti') {
      return { success: false, message: 'Sesi piket tidak ditemukan.' };
    }
    if (data[targetRow][6] === 'Hadir') {
      return { success: false, message: 'Guru piket pengganti ini sudah dikonfirmasi.' };
    }

    targetUsername = data[targetRow][2]; // username_piket
    const nowIso = new Date().toISOString();
    // Update ketiga kolom sekaligus dalam satu operasi untuk mengurangi API calls
    const sheetRow = targetRow + 1;
    sheet.getRange(sheetRow, 7, 1, 3).setValues([['Hadir', adminUsername, nowIso]]);
  } finally {
    lock.releaseLock();
  }

  logActivity(adminUsername, 'KONFIRMASI_PIKET_PENGGANTI',
    targetUsername + ' dikonfirmasi hadir piket pengganti');
  return { success: true };
}

function getAllGuruForPiket(adminUsername) {
  if (!_isAdmin_(adminUsername)) {
    return { success: false, message: 'Akses ditolak.' };
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Users');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const result = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][3] === 'Guru') {
      result.push({ username: data[i][1], fullName: data[i][7] || data[i][1] });
    }
  }
  return result;
}

// Batalkan konfirmasi kehadiran guru piket utama (hapus baris dari Piket_Hadir)
function batalKonfirmasiPiketUtama(usernameGuru, adminUsername) {
  if (!_isAdmin_(adminUsername)) {
    return { success: false, message: 'Akses ditolak.' };
  }
  const today = _todayStr_();
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const sheet = _ensurePiketHadirSheet_();
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (_normalizeDateStr_(data[i][1]) === today
          && data[i][2] === usernameGuru
          && data[i][4] === 'Utama') {
        sheet.deleteRow(i + 1); // +1 karena data[0] = header = row 1
        logActivity(adminUsername, 'BATAL_KONFIRMASI_PIKET_UTAMA',
          usernameGuru + ' dibatalkan konfirmasi piket utama');
        return { success: true };
      }
    }
    return { success: false, message: 'Sesi piket utama tidak ditemukan.' };
  } finally {
    lock.releaseLock();
  }
}

// Batalkan konfirmasi kehadiran guru piket pengganti (kembalikan status ke Belum Dikonfirmasi)
function batalKonfirmasiPiketPengganti(idSesi, adminUsername) {
  if (!_isAdmin_(adminUsername)) {
    return { success: false, message: 'Akses ditolak.' };
  }
  const lock = LockService.getScriptLock();
  let targetUsername = '';
  try {
    lock.waitLock(10000);
    const sheet = _ensurePiketHadirSheet_();
    const data = sheet.getDataRange().getValues();
    let targetRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === idSesi) { targetRow = i; break; }
    }
    if (targetRow === -1 || data[targetRow][4] !== 'Pengganti') {
      return { success: false, message: 'Sesi piket tidak ditemukan.' };
    }
    if (data[targetRow][6] !== 'Hadir') {
      return { success: false, message: 'Sesi ini belum dikonfirmasi, tidak perlu dibatalkan.' };
    }
    targetUsername = data[targetRow][2];
    const sheetRow = targetRow + 1;
    sheet.getRange(sheetRow, 7, 1, 3).setValues([['Belum Dikonfirmasi', '', '']]);
  } finally {
    lock.releaseLock();
  }
  logActivity(adminUsername, 'BATAL_KONFIRMASI_PIKET_PENGGANTI',
    targetUsername + ' dibatalkan konfirmasi piket pengganti');
  return { success: true };
}

// Batalkan penunjukan guru piket pengganti (hapus baris dari Piket_Hadir)
function batalTunjukPiketPengganti(idSesi, adminUsername) {
  if (!_isAdmin_(adminUsername)) {
    return { success: false, message: 'Akses ditolak.' };
  }
  const lock = LockService.getScriptLock();
  let targetUsername = '';
  try {
    lock.waitLock(10000);
    const sheet = _ensurePiketHadirSheet_();
    const data = sheet.getDataRange().getValues();
    let targetRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === idSesi) { targetRow = i; break; }
    }
    if (targetRow === -1 || data[targetRow][4] !== 'Pengganti') {
      return { success: false, message: 'Sesi piket tidak ditemukan.' };
    }
    if (data[targetRow][6] === 'Hadir') {
      return { success: false, message: 'Tidak dapat membatalkan penunjukan yang sudah dikonfirmasi. Batalkan konfirmasi terlebih dahulu.' };
    }
    targetUsername = data[targetRow][2];
    sheet.deleteRow(targetRow + 1);
  } finally {
    lock.releaseLock();
  }
  logActivity(adminUsername, 'BATAL_TUNJUK_PIKET_PENGGANTI',
    targetUsername + ' dibatalkan penunjukan piket pengganti');
  return { success: true };
}

const NOTIF_PIKET_HANDLER = 'kirimNotifikasiPiketHarian';
const NOTIF_PIKET_HOURS = [15, 17, 19, 21, 23];
const NOTIF_PIKET_LOG_ACTION = 'NOTIF_PIKET_SENT';
const HARI_LIBUR_SHEET = 'Hari_Libur';
const HARI_LIBUR_HEADER = ['tanggal', 'keterangan'];
const _NOTIF_PIKET_DAY_NAMES = [
  'Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'
];
function _hitungProgressPiketHariIni_(username) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const userSheet = ss.getSheetByName('Users');
  const classSheet = ss.getSheetByName('Classes');
  const attSheet = ss.getSheetByName('Attendance');
  const timeZone = Session.getScriptTimeZone();
  const today = new Date();
  const todayStr = Utilities.formatDate(today, timeZone, 'yyyy-MM-dd');
  const result = { totalSiswa: 0, sudahAbsen: 0, belumAbsen: 0, perKelas: [] };
  if (!userSheet || !classSheet) return result;
  const users = userSheet.getDataRange().getValues();
  let tugasArr = [];
  let waliKelas = '';
  for (let i = 1; i < users.length; i++) {
    if (_cmpUsername(users[i][1], username)) {
      tugasArr = users[i][4]
        ? String(users[i][4]).split(',').map(t => t.trim()).filter(t => t)
        : [];
      waliKelas = users[i][6] ? String(users[i][6]).trim() : '';
      break;
    }
  }
  const isWali = tugasArr.indexOf('Guru Wali') >= 0 || tugasArr.indexOf('Wali Kelas') >= 0;
  const classes = classSheet.getDataRange().getValues();
  const kelasList = [];
  for (let i = 1; i < classes.length; i++) {
    const k = classes[i][2];
    if (!k) continue;
    if (isWali && waliKelas && String(k) !== waliKelas) continue;
    kelasList.push(String(k));
  }
  const totalPerKelas = {};
  for (let i = 1; i < users.length; i++) {
    if (users[i][3] !== 'Siswa') continue;
    const k = users[i][6] ? String(users[i][6]).trim() : '';
    if (!k) continue;
    if (kelasList.indexOf(k) < 0) continue;
    totalPerKelas[k] = (totalPerKelas[k] || 0) + 1;
  }
  const sudahPerKelas = {};
  if (attSheet && attSheet.getLastRow() > 1) {
    const att = attSheet.getDataRange().getValues();
    for (let j = 1; j < att.length; j++) {
      const _attCell = att[j][1];
      let _attStr = '';
      if (_attCell instanceof Date) {
        _attStr = Utilities.formatDate(_attCell, timeZone, 'yyyy-MM-dd');
      } else if (typeof _attCell === 'number') {
        _attStr = Utilities.formatDate(new Date((_attCell - 25569) * 86400 * 1000), timeZone, 'yyyy-MM-dd');
      } else if (_attCell) {
        const _d = new Date(_attCell);
        if (!isNaN(_d.getTime())) _attStr = Utilities.formatDate(_d, timeZone, 'yyyy-MM-dd');
      }
      if (_attStr !== todayStr) continue;
      const kCell = att[j][2] ? String(att[j][2]).trim() : '';
      if (!kCell) continue;
      if (kelasList.indexOf(kCell) < 0) continue;
      sudahPerKelas[kCell] = (sudahPerKelas[kCell] || 0) + 1;
    }
  }
  for (let i = 0; i < kelasList.length; i++) {
    const k = kelasList[i];
    const total = totalPerKelas[k] || 0;
    if (total === 0) continue; 
    const sudah = Math.min(sudahPerKelas[k] || 0, total); 
    const belum = Math.max(0, total - sudah);
    result.perKelas.push({ kelas: k, total: total, sudahAbsen: sudah, belumAbsen: belum });
    result.totalSiswa += total;
    result.sudahAbsen += sudah;
    result.belumAbsen += belum;
  }
  return result;
}
function _buildPiketReminderEmailBody_(fullName, todayName, summary) {
  const safeName = String(fullName || 'Bapak/Ibu Guru');
  const lines = [];
  lines.push('Yth. ' + safeName + ',');
  lines.push('');
  lines.push('Hari ini (' + todayName + ') Anda tercatat sebagai Guru Piket pada SiM-Murid.');
  lines.push('Sistem mendeteksi masih ada siswa yang BELUM tercatat absensi kehadirannya:');
  lines.push('');
  if (summary && Array.isArray(summary.perKelas) && summary.perKelas.length > 0) {
    summary.perKelas.forEach(function(c) {
      if (c.belumAbsen <= 0) return;
      lines.push('  - ' + c.kelas + ': ' + c.sudahAbsen + ' / ' + c.total +
                 ' siswa sudah diabsen (' + c.belumAbsen + ' belum).');
    });
  }
  lines.push('');
  lines.push('Total: ' + (summary ? summary.sudahAbsen : 0) + ' dari ' +
             (summary ? summary.totalSiswa : 0) + ' siswa sudah diabsensi (' +
             (summary ? summary.belumAbsen : 0) + ' belum).');
  lines.push('');
  lines.push('Mohon segera membuka SiM-Murid dan menyelesaikan input absensi pada');
  lines.push('menu "Manajemen Absensi". Pesan ini dikirim otomatis dan akan berhenti');
  lines.push('begitu seluruh siswa selesai diabsensi atau hari piket Anda berakhir.');
  lines.push('');
  lines.push('Jika Anda merasa tidak seharusnya menerima notifikasi ini, silakan');
  lines.push('hubungi admin untuk pemeriksaan jadwal piket Anda.');
  lines.push('');
  lines.push('— SiM-Murid (Sistem Informasi Manajemen Murid)');
  return lines.join('\n');
}
function _alreadySentPiketReminderToday_(username, todayStr) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Activity_Logs');
  if (!sheet || sheet.getLastRow() < 2) return false;
  const data = sheet.getDataRange().getValues();
  const tz = Session.getScriptTimeZone();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][3]) !== NOTIF_PIKET_LOG_ACTION) continue;
    if (!_cmpUsername(data[i][2], username)) continue;
    const ts = data[i][1];
    let tsStr = '';
    if (ts instanceof Date) tsStr = Utilities.formatDate(ts, tz, 'yyyy-MM-dd');
    else if (typeof ts === 'number') tsStr = Utilities.formatDate(new Date((ts - 25569) * 86400 * 1000), tz, 'yyyy-MM-dd');
    else if (ts) {
      const d = new Date(ts);
      if (!isNaN(d.getTime())) tsStr = Utilities.formatDate(d, tz, 'yyyy-MM-dd');
    }
    if (tsStr === todayStr) return true;
  }
  return false;
}
function _piketCandidatesForToday_() {
  const userSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  const out = [];
  if (!userSheet || userSheet.getLastRow() < 2) return out;
  const tz = Session.getScriptTimeZone();
  const today = new Date();
  const todayName = _NOTIF_PIKET_DAY_NAMES[today.getDay()];
  const data = userSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const role = data[i][3];
    if (role !== 'Guru') continue;
    const tugasRaw = data[i][4] ? String(data[i][4]) : '';
    const tugasArr = tugasRaw.split(',').map(t => t.trim()).filter(t => t);
    if (tugasArr.indexOf('Guru Piket') < 0) continue;
    const piketDaysRaw = data[i][8] ? String(data[i][8]) : '';
    const piketDays = piketDaysRaw.split(',').map(d => d.trim()).filter(d => d);
    if (piketDays.indexOf(todayName) < 0) continue;
    const username = String(data[i][1] == null ? '' : data[i][1]).replace(/^'+/, '');
    out.push({
      username: username,
      fullName: data[i][7] || username,
      email: data[i][15] ? String(data[i][15]).trim() : '',
      piketDays: piketDays
    });
  }
  return out;
}
function kirimNotifikasiPiketHarian(opts) {
  const dryRun = !!(opts && opts.dryRun === true);
  const summary = {
    ok: true, todayName: '', sent: 0, skipped: 0, errors: 0,
    holiday: false, items: []
  };
  try {
    const tz = Session.getScriptTimeZone();
    const today = new Date();
    const todayStr = Utilities.formatDate(today, tz, 'yyyy-MM-dd');
    summary.todayName = _NOTIF_PIKET_DAY_NAMES[today.getDay()];
    if (_isHariLiburHariIni_()) {
      summary.holiday = true;
      if (!dryRun) {
        try {
          logActivity('SYSTEM', 'NOTIF_PIKET_SKIP_HOLIDAY',
            'Hari libur (' + todayStr + ') — pengiriman dilewati');
        } catch (_e) {}
      }
      return summary;
    }
    const candidates = _piketCandidatesForToday_();
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const item = {
        username: c.username,
        fullName: c.fullName,
        email: c.email,
        emailMasked: c.email ? _maskEmail_(c.email) : '',
        status: '',
        reason: '',
        progress: null
      };
      if (!c.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) {
        item.status = 'SKIPPED';
        item.reason = 'EMAIL_TIDAK_VALID';
        summary.skipped++;
        summary.items.push(item);
        continue;
      }
      if (_alreadySentPiketReminderToday_(c.username, todayStr)) {
        item.status = 'SKIPPED';
        item.reason = 'SUDAH_DIKIRIM_HARI_INI';
        summary.skipped++;
        summary.items.push(item);
        continue;
      }
      const progress = _hitungProgressPiketHariIni_(c.username);
      item.progress = progress;
      if (progress.totalSiswa === 0) {
        item.status = 'SKIPPED';
        item.reason = 'TIDAK_ADA_SISWA';
        summary.skipped++;
        summary.items.push(item);
        continue;
      }
      if (progress.belumAbsen <= 0) {
        item.status = 'SKIPPED';
        item.reason = 'SEMUA_SUDAH_DIABSEN';
        summary.skipped++;
        summary.items.push(item);
        continue;
      }
      if (dryRun) {
        item.status = 'WILL_SEND';
        item.reason = '';
        summary.sent++;
        summary.items.push(item);
        continue;
      }
      try {
        const subject = '[SiM-Murid] Pengingat Piket: ' + progress.belumAbsen +
                        ' siswa belum diabsen hari ini';
        const body = _buildPiketReminderEmailBody_(c.fullName, summary.todayName, progress);
        MailApp.sendEmail({ to: c.email, subject: subject, body: body });
        try {
          logActivity(c.username, NOTIF_PIKET_LOG_ACTION,
            'Reminder piket dikirim ke ' + _maskEmail_(c.email) +
            ' (' + progress.belumAbsen + '/' + progress.totalSiswa + ' belum absen)');
        } catch (_logErr) {  }
        item.status = 'SENT';
        summary.sent++;
      } catch (mailErr) {
        item.status = 'ERROR';
        item.reason = 'MAIL_SEND_FAILED: ' + (mailErr && mailErr.message ? mailErr.message : mailErr);
        summary.errors++;
        try {
          logActivity(c.username, 'NOTIF_PIKET_SEND_ERROR',
            'Gagal kirim reminder ke ' + _maskEmail_(c.email) + ': ' +
            (mailErr && mailErr.message ? mailErr.message : mailErr));
        } catch (_logErr) {}
      }
      summary.items.push(item);
    }
    return summary;
  } catch (e) {
    summary.ok = false;
    summary.error = e && e.message ? e.message : String(e);
    return summary;
  }
}
function previewNotifikasiPiketHarian() {
  return kirimNotifikasiPiketHarian({ dryRun: true });
}
function runNotifikasiPiketHarianNow(adminUser) {
  if (!_isAdminAtauKepalaMadrasah(adminUser)) {
    return { success: false, message: 'Akses ditolak. Hanya Admin / Kepala Madrasah yang dapat menjalankan notifikasi piket.' };
  }
  const r = kirimNotifikasiPiketHarian({ dryRun: false });
  try {
    logActivity(adminUser, 'NOTIF_PIKET_RUN_MANUAL',
      'Manual run: holiday=' + !!r.holiday + ', sent=' + r.sent +
      ', skipped=' + r.skipped + ', errors=' + r.errors);
  } catch (_e) {}
  return { success: r.ok !== false, data: r };
}
function _ensureHariLiburSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(HARI_LIBUR_SHEET);
  if (!sh) {
    // Sheet baru: pakai schema 2-kolom legacy supaya kompatibel dengan
    // unit test & implementasi ringan. Production sudah memakai schema
    // 4-kolom kanonik (`ID, Tanggal, Keterangan, Created_By`) yang dibuat
    // lewat `saveHariLibur()`. Kedua schema didukung oleh
    // `_resolveHariLiburCols_()` di bawah.
    sh = ss.insertSheet(HARI_LIBUR_SHEET);
    sh.appendRow(HARI_LIBUR_HEADER);
    try { sh.setFrozenRows(1); } catch (_e) {}
  } else if (sh.getLastRow() === 0) {
    sh.appendRow(HARI_LIBUR_HEADER);
  }
  return sh;
}

/**
 * Pemetaan kolom sheet Hari_Libur. Mendukung dua schema:
 *   - 4-kolom kanonik production: ID | Tanggal | Keterangan | Created_By
 *   - 2-kolom legacy/test       : tanggal | keterangan
 * Helper ini mendeteksi header (case-insensitive) lalu mengembalikan indeks
 * kolom yang dipakai. Bila sheet kosong/baru tanpa header valid, fallback ke
 * konvensi 2-kolom (kolom 0 = tanggal, kolom 1 = keterangan) untuk
 * kompatibilitas mundur.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sh
 * @returns {{tanggalCol:number, keteranganCol:number, idCol:number,
 *            createdByCol:number, hasId:boolean, totalCols:number}}
 */
function _resolveHariLiburCols_(sh) {
  const result = { tanggalCol: 0, keteranganCol: 1, idCol: -1, createdByCol: -1, hasId: false, totalCols: 2 };
  if (!sh || sh.getLastRow() < 1) return result;
  const lastCol = Math.max(sh.getLastColumn(), 1);
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(h => String(h == null ? '' : h).trim().toLowerCase());
  result.totalCols = headers.length;
  const findIdx = (...candidates) => {
    for (const c of candidates) {
      const idx = headers.indexOf(c);
      if (idx >= 0) return idx;
    }
    return -1;
  };
  const tIdx = findIdx('tanggal', 'date', 'tgl');
  const kIdx = findIdx('keterangan', 'ket', 'description', 'desc');
  const iIdx = findIdx('id');
  const cIdx = findIdx('created_by', 'createdby', 'created by');
  if (tIdx >= 0) result.tanggalCol = tIdx;
  if (kIdx >= 0) result.keteranganCol = kIdx;
  if (iIdx >= 0) { result.idCol = iIdx; result.hasId = true; }
  if (cIdx >= 0) result.createdByCol = cIdx;
  return result;
}
function _normalizeTanggalLibur_(v) {
  if (v == null || v === '') return '';
  const tz = Session.getScriptTimeZone();
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return '';
    return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  }
  if (typeof v === 'number') {
    const d = new Date((v - 25569) * 86400 * 1000);
    return isNaN(d.getTime()) ? '' : Utilities.formatDate(d, tz, 'yyyy-MM-dd');
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return isNaN(d.getTime()) ? '' : Utilities.formatDate(d, tz, 'yyyy-MM-dd');
}
function _isHariLiburHariIni_() {
  const today = new Date();
  if (today.getDay() === 0) return true; // Minggu selalu libur
  
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HARI_LIBUR_SHEET);
  if (!sh || sh.getLastRow() < 2) return false;
  const todayStr = Utilities.formatDate(
    today, Session.getScriptTimeZone(), 'yyyy-MM-dd'
  );
  const cols = _resolveHariLiburCols_(sh);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (_normalizeTanggalLibur_(data[i][cols.tanggalCol]) === todayStr) return true;
  }
  return false;
}
function listHariLibur() {
  try {
    const sh = _ensureHariLiburSheet_();
    if (sh.getLastRow() < 2) return { success: true, data: [] };
    const cols = _resolveHariLiburCols_(sh);
    const data = sh.getDataRange().getValues();
    const out = [];
    for (let i = 1; i < data.length; i++) {
      const t = _normalizeTanggalLibur_(data[i][cols.tanggalCol]);
      if (!t) continue;
      out.push({ tanggal: t, keterangan: String(data[i][cols.keteranganCol] || '') });
    }
    out.sort(function(a, b) { return a.tanggal.localeCompare(b.tanggal); });
    return { success: true, data: out };
  } catch (e) {
    return { success: false, message: e && e.message ? e.message : String(e) };
  }
}
function addHariLibur(tanggalStr, keterangan, adminUser) {
  if (!_isAdminAtauKepalaMadrasah(adminUser)) {
    return { success: false, message: 'Akses ditolak.' };
  }
  const norm = _normalizeTanggalLibur_(tanggalStr);
  if (!norm) return { success: false, message: 'Format tanggal tidak valid.' };
  const ket = String(keterangan == null ? '' : keterangan).trim();
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const sh = _ensureHariLiburSheet_();
    const cols = _resolveHariLiburCols_(sh);
    const data = sh.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (_normalizeTanggalLibur_(data[i][cols.tanggalCol]) === norm) {
        // Update tanggal (normalisasi) & keterangan saja; ID & created_by
        // tidak disentuh agar audit trail tetap utuh.
        sh.getRange(i + 1, cols.tanggalCol + 1).setValue(norm);
        sh.getRange(i + 1, cols.keteranganCol + 1).setValue(ket);
        try {
          logActivity(adminUser, 'HARI_LIBUR_UPDATE',
            'Update hari libur ' + norm + ' (' + ket + ')');
        } catch (_e) {}
        return { success: true, data: { tanggal: norm, keterangan: ket }, updated: true };
      }
    }
    // Bangun row sesuai jumlah kolom sheet dan posisi kolom yang dipetakan.
    const newRow = new Array(cols.totalCols).fill('');
    newRow[cols.tanggalCol]    = norm;
    newRow[cols.keteranganCol] = ket;
    if (cols.hasId)               newRow[cols.idCol] = Utilities.getUuid();
    if (cols.createdByCol >= 0)   newRow[cols.createdByCol] = String(adminUser || '');
    sh.appendRow(newRow);
    try {
      logActivity(adminUser, 'HARI_LIBUR_ADD',
        'Tambah hari libur ' + norm + ' (' + ket + ')');
    } catch (_e) {}
    return { success: true, data: { tanggal: norm, keterangan: ket }, updated: false };
  } catch (e) {
    return { success: false, message: e && e.message ? e.message : String(e) };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}
function removeHariLibur(tanggalStr, adminUser) {
  if (!_isAdminAtauKepalaMadrasah(adminUser)) {
    return { success: false, message: 'Akses ditolak.' };
  }
  const norm = _normalizeTanggalLibur_(tanggalStr);
  if (!norm) return { success: false, message: 'Format tanggal tidak valid.' };
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const sh = _ensureHariLiburSheet_();
    const cols = _resolveHariLiburCols_(sh);
    const data = sh.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) {
      if (_normalizeTanggalLibur_(data[i][cols.tanggalCol]) === norm) {
        sh.deleteRow(i + 1);
        try {
          logActivity(adminUser, 'HARI_LIBUR_REMOVE', 'Hapus hari libur ' + norm);
        } catch (_e) {}
        return { success: true, removed: true };
      }
    }
    return { success: true, removed: false };
  } catch (e) {
    return { success: false, message: e && e.message ? e.message : String(e) };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}
function _ensureNotifPiketTriggers_() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    const existingHours = {};
    for (let i = 0; i < triggers.length; i++) {
      const t = triggers[i];
      if (t.getHandlerFunction() !== NOTIF_PIKET_HANDLER) continue;
      existingHours['_' + i] = t;
    }
    const desired = NOTIF_PIKET_HOURS.length;
    const matchedCount = Object.keys(existingHours).length;
    if (matchedCount === desired) return { ok: true, action: 'noop', count: desired };
    for (let i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === NOTIF_PIKET_HANDLER) {
        try { ScriptApp.deleteTrigger(triggers[i]); } catch (_e) {}
      }
    }
    let installed = 0;
    for (let h = 0; h < NOTIF_PIKET_HOURS.length; h++) {
      const hour = NOTIF_PIKET_HOURS[h];
      try {
        ScriptApp.newTrigger(NOTIF_PIKET_HANDLER)
          .timeBased()
          .atHour(hour)
          .everyDays(1)
          .create();
        installed++;
      } catch (_e) {}
    }
    return { ok: true, action: 'reinstalled', count: installed };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
}
function getStatusTriggerNotifPiket() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    let count = 0;
    for (let i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === NOTIF_PIKET_HANDLER) count++;
    }
    return {
      success: true,
      active: count > 0,
      count: count,
      expected: NOTIF_PIKET_HOURS.length,
      hours: NOTIF_PIKET_HOURS.slice(),
      isHoliday: _isHariLiburHariIni_()
    };
  } catch (e) {
    return { success: false, message: e && e.message ? e.message : String(e) };
  }
}


// ════════════════════════════════════════════════════════════════════════
// DASHBOARD BUNDLE ENDPOINTS
// ════════════════════════════════════════════════════════════════════════
// Setiap RPC google.script.run round-trip ke Apps Script ~800ms-2000ms.
// Halaman Dashboard sebelumnya memanggil 5-10 RPC sekuensial dan setiap
// fungsi sering membaca sheet yang sama (Iuran_Komite, Savings, Attendance)
// berkali-kali. Bundle endpoints di bawah:
//   1. Membaca tiap sheet HANYA SATU KALI per RPC.
//   2. Menggabungkan banyak metrik menjadi satu response.
// Hasilnya: dashboard load 3-6× lebih cepat tanpa mengubah skema sheet
// maupun fungsi-fungsi backend yang sudah ada (mereka tetap dipakai
// halaman lain dan oleh test harness).
// ════════════════════════════════════════════════════════════════════════

/**
 * Hitung total iuran untuk semua periode (hari/minggu/bulan/triwulan/
 * semester/tahun) sekaligus, hanya dengan satu kali baca sheet.
 * @returns {Object} { hari, minggu, bulan, triwulan, semester, tahun }
 */
function _hitungAllIuranPeriode_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Iuran_Komite');
  const empty = { hari:0, minggu:0, bulan:0, triwulan:0, semester:0, tahun:0 };
  if (!sheet || sheet.getLastRow() < 2) return empty;
  const data = sheet.getDataRange().getValues();
  data.shift();

  const now = new Date();
  const cy  = now.getFullYear();
  const cm  = now.getMonth();

  const startToday = new Date(cy, cm, now.getDate());
  const endToday   = new Date(cy, cm, now.getDate(), 23,59,59,999);

  const day = now.getDay();
  const diffToMonday = (day === 0 ? 6 : day - 1);
  const startMon = new Date(now); startMon.setDate(now.getDate() - diffToMonday); startMon.setHours(0,0,0,0);
  const endSun   = new Date(startMon); endSun.setDate(startMon.getDate() + 6); endSun.setHours(23,59,59,999);

  const startBulan = new Date(cy, cm, 1);
  const endBulan   = new Date(cy, cm + 1, 0, 23,59,59,999);

  const triwM = Math.floor(cm / 3) * 3;
  const startTriw = new Date(cy, triwM, 1);
  const endTriw   = new Date(cy, triwM + 3, 0, 23,59,59,999);

  const semM = cm < 6 ? 0 : 6;
  const startSem = new Date(cy, semM, 1);
  const endSem   = new Date(cy, semM + 6, 0, 23,59,59,999);

  const startTahun = new Date(cy, 0, 1);
  const endTahun   = new Date(cy, 11, 31, 23,59,59,999);

  let hari=0, minggu=0, bulan=0, triwulan=0, semester=0, tahun=0;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const tanggalCell = row[3];
    if (!tanggalCell) continue;
    let tanggal;
    if (tanggalCell instanceof Date)            tanggal = tanggalCell;
    else if (typeof tanggalCell === 'number')   tanggal = excelSerialToDate(tanggalCell);
    else                                         tanggal = new Date(tanggalCell);
    if (isNaN(tanggal.getTime())) continue;

    const nominal = parseFloat(row[4]) || 0;
    if (tanggal >= startToday && tanggal <= endToday)   hari     += nominal;
    if (tanggal >= startMon   && tanggal <= endSun)     minggu   += nominal;
    if (tanggal >= startBulan && tanggal <= endBulan)   bulan    += nominal;
    if (tanggal >= startTriw  && tanggal <= endTriw)    triwulan += nominal;
    if (tanggal >= startSem   && tanggal <= endSem)     semester += nominal;
    if (tanggal >= startTahun && tanggal <= endTahun)   tahun    += nominal;
  }
  return { hari, minggu, bulan, triwulan, semester, tahun };
}

/**
 * Bundle: Dashboard Admin / Kepsek.
 * Menggantikan: getDashboardStatsAdmin + getIuranTotalHariIni..Tahun (6 calls)
 * + getGlobalSavingsSummary + getGlobalAttendanceSummary.
 *
 * Total RPC sebelumnya: 9 → setelah: 1.
 *
 * @param {string} callerUsername Untuk gate Guru-unverified (caller selain Guru
 *                                bebas gate).
 * @returns {Object} { totalSiswa, totalGuru, totalKelas, iuran, savings,
 *                    attendance, totalIuranBulanIni }
 */
function getDashboardBundleAdmin(callerUsername) {
  _assertEmailGate(callerUsername);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = Session.getScriptTimeZone();
  const todayStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');

  // ── Users (totalSiswa, totalGuru) ──────────────────────────────────────
  const userSheet = ss.getSheetByName('Users');
  let totalSiswa = 0, totalGuru = 0;
  if (userSheet && userSheet.getLastRow() > 1) {
    const userData = userSheet.getDataRange().getValues();
    for (let i = 1; i < userData.length; i++) {
      const role = userData[i][3];
      if (role === 'Siswa') totalSiswa++;
      else if (role === 'Guru') totalGuru++;
    }
  }

  // ── Classes (totalKelas) ───────────────────────────────────────────────
  const classSheet = ss.getSheetByName('Classes');
  const totalKelas = (classSheet && classSheet.getLastRow() > 1) ? classSheet.getLastRow() - 1 : 0;

  // ── Iuran semua periode (single pass) ─────────────────────────────────
  const iuran = _hitungAllIuranPeriode_();

  // ── Global savings summary (today only) ───────────────────────────────
  const savings = { setorCount:0, tarikCount:0, setorNominal:0, tarikNominal:0, totalCount:0, totalNominal:0 };
  const savingsSheet = ss.getSheetByName('Savings');
  if (savingsSheet && savingsSheet.getLastRow() > 1) {
    const sd = savingsSheet.getDataRange().getValues();
    sd.shift();
    sd.forEach(row => {
      const tgl = row[1];
      if (!tgl) return;
      let tglStr = '';
      if (tgl instanceof Date)            tglStr = Utilities.formatDate(tgl, tz, 'yyyy-MM-dd');
      else if (typeof tgl === 'number')   tglStr = Utilities.formatDate(excelSerialToDate(tgl), tz, 'yyyy-MM-dd');
      else { const d = new Date(tgl); if (!isNaN(d)) tglStr = Utilities.formatDate(d, tz, 'yyyy-MM-dd'); }
      if (tglStr !== todayStr) return;
      const jumlah = parseFloat(row[6]) || 0;
      if (row[5] === 'Setor') { savings.setorCount++; savings.setorNominal += jumlah; }
      else if (row[5] === 'Tarik') { savings.tarikCount++; savings.tarikNominal += jumlah; }
    });
    savings.totalCount   = savings.setorCount + savings.tarikCount;
    savings.totalNominal = savings.setorNominal + savings.tarikNominal;
  }

  // ── Global attendance summary (today only) ────────────────────────────
  const attendance = { hadir:0, alpha:0, sakit:0, izin:0, total:0 };
  const attSheet = ss.getSheetByName('Attendance');
  if (attSheet && attSheet.getLastRow() > 1) {
    const ad = attSheet.getDataRange().getValues();
    ad.shift();
    ad.forEach(row => {
      const tgl = row[1];
      if (!tgl) return;
      let tglStr = '';
      if (tgl instanceof Date)            tglStr = Utilities.formatDate(tgl, tz, 'yyyy-MM-dd');
      else if (typeof tgl === 'number')   tglStr = Utilities.formatDate(excelSerialToDate(tgl), tz, 'yyyy-MM-dd');
      else { const d = new Date(tgl); if (!isNaN(d)) tglStr = Utilities.formatDate(d, tz, 'yyyy-MM-dd'); }
      if (tglStr !== todayStr) return;
      const status = row[5];
      if (status === 'Hadir') attendance.hadir++;
      else if (status === 'Alpha') attendance.alpha++;
      else if (status === 'Sakit') attendance.sakit++;
      else if (status === 'Izin') attendance.izin++;
    });
    attendance.total = attendance.hadir + attendance.alpha + attendance.sakit + attendance.izin;
  }

  return {
    totalSiswa, totalGuru, totalKelas,
    totalIuranBulanIni: iuran.bulan,
    iuran:      iuran,
    savings:    savings,
    attendance: attendance
  };
}

/**
 * Bundle: Dashboard Guru.
 *
 * Menggabungkan getDashboardStatsGuru + iuran 6-periode (untuk Bendahara) +
 * getTabunganDashboard (Pengelola) + getPiketDashboard (Guru Piket) +
 * data Wali Kelas (kelas + isLibur + students + attendance hari ini) +
 * jadwal hari ini + waliKelasInfo.
 *
 * Total RPC sebelumnya: 8-12 → setelah: 1.
 *
 * @param {string} username
 * @returns {Object} bundle untuk render dashboard guru
 */
function getDashboardBundleGuru(username) {
  _assertEmailGate(username);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = Session.getScriptTimeZone();
  const today = new Date();
  const todayStr = Utilities.formatDate(today, tz, 'yyyy-MM-dd');
  const dayNames = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const todayName = dayNames[today.getDay()];

  // ── Lookup user → tugas, fullName ─────────────────────────────────────
  const userSheet = ss.getSheetByName('Users');
  let userRow = null;
  if (userSheet) {
    const ud = userSheet.getDataRange().getValues();
    for (let i = 1; i < ud.length; i++) {
      if (ud[i][1] === username) { userRow = ud[i]; break; }
    }
  }
  const tugas = userRow && userRow[4] ? String(userRow[4]).split(',').map(t => t.trim()) : [];
  const fullName = userRow ? userRow[7] : '';
  const tugasTambahan = tugas;
  const stats = {
    isWali:              tugas.indexOf('Guru Wali') >= 0,
    isBendahara:         tugas.indexOf('Bendahara Komite') >= 0,
    isPengelolaTabungan: tugas.indexOf('Pengelola Tabungan') >= 0,
    isGuruPiket:         tugas.indexOf('Guru Piket') >= 0,
    isWaliKelas:         tugas.indexOf('Wali Kelas') >= 0,
    siswaBimbinganCount: 0,
    iuranHariIni:        0,
    tabunganHariIni:     0,
    absensiHariIni:      0
  };

  // ── Hari libur cache (sekali baca) ────────────────────────────────────
  let isHariLibur = false;
  let hariLiburKet = '';
  const liburSheet = ss.getSheetByName('Hari_Libur');
  if (liburSheet && liburSheet.getLastRow() > 1) {
    const ld = liburSheet.getDataRange().getValues();
    for (let i = 1; i < ld.length; i++) {
      let tgl = ld[i][1];
      let tglStr = '';
      if (tgl instanceof Date)            tglStr = Utilities.formatDate(tgl, tz, 'yyyy-MM-dd');
      else if (typeof tgl === 'number')   tglStr = Utilities.formatDate(excelSerialToDate(tgl), tz, 'yyyy-MM-dd');
      else if (tgl) { const d = new Date(tgl); if (!isNaN(d)) tglStr = Utilities.formatDate(d, tz, 'yyyy-MM-dd'); }
      if (tglStr === todayStr) { isHariLibur = true; hariLiburKet = String(ld[i][2] || ''); break; }
    }
  }

  // ── Iuran semua periode (untuk Bendahara) ─────────────────────────────
  let iuranAll = null;
  if (stats.isBendahara) {
    iuranAll = _hitungAllIuranPeriode_();
    stats.iuranHariIni = iuranAll.hari;
  }

  // ── Tabungan hari ini (untuk Pengelola Tabungan) ──────────────────────
  let tabunganHariIni = null;
  if (stats.isPengelolaTabungan) {
    tabunganHariIni = { setorCount:0, tarikCount:0, setorNominal:0, tarikNominal:0, totalCount:0, totalNominal:0 };
    const sv = ss.getSheetByName('Savings');
    if (sv && sv.getLastRow() > 1) {
      const sd = sv.getDataRange().getValues();
      sd.shift();
      sd.forEach(row => {
        const tgl = row[1];
        let tglStr = '';
        if (tgl instanceof Date)            tglStr = Utilities.formatDate(tgl, tz, 'yyyy-MM-dd');
        else if (typeof tgl === 'number')   tglStr = Utilities.formatDate(excelSerialToDate(tgl), tz, 'yyyy-MM-dd');
        else if (tgl) { const d = new Date(tgl); if (!isNaN(d)) tglStr = Utilities.formatDate(d, tz, 'yyyy-MM-dd'); }
        if (tglStr !== todayStr) return;
        const jumlah = parseFloat(row[6]) || 0;
        if (row[5] === 'Setor') { tabunganHariIni.setorCount++; tabunganHariIni.setorNominal += jumlah; }
        else if (row[5] === 'Tarik') { tabunganHariIni.tarikCount++; tabunganHariIni.tarikNominal += jumlah; }
      });
      tabunganHariIni.totalCount   = tabunganHariIni.setorCount + tabunganHariIni.tarikCount;
      tabunganHariIni.totalNominal = tabunganHariIni.setorNominal + tabunganHariIni.tarikNominal;
    }
  }

  // ── Guru Wali (siswa bimbingan count) ─────────────────────────────────
  if (stats.isWali) {
    try { stats.siswaBimbinganCount = getGuruWaliStudentCount(username); } catch(e) {}
  }

  // ── Guru Piket dashboard ──────────────────────────────────────────────
  let piketData = null;
  if (stats.isGuruPiket) {
    try { piketData = getPiketDashboard(username); } catch(e) {}
  }

  // ── Wali Kelas: classInfo + students + attendance ─────────────────────
  let waliKelasInfo = null;
  let waliAttendance = null;  // { hadir, alpha, sakit, izin, students, listH, listA, listS, listI }
  if (stats.isWaliKelas) {
    try {
      waliKelasInfo = getWaliKelasByGuru(username);
      if (waliKelasInfo && !isHariLibur && today.getDay() !== 0) {
        const namaKelas = waliKelasInfo.nama;
        let students = [];
        try { students = getStudentsByClass(namaKelas) || []; } catch(e) {}
        let attList = [];
        try { attList = getAttendanceByClassAndDate(namaKelas, todayStr) || []; } catch(e) {}
        waliAttendance = { hadir:0, alpha:0, sakit:0, izin:0, total: students.length, listH:[], listA:[], listS:[], listI:[] };
        attList.forEach(item => {
          if (item.status === 'Hadir')      { waliAttendance.hadir++; waliAttendance.listH.push(item.nama); }
          else if (item.status === 'Alpha') { waliAttendance.alpha++; waliAttendance.listA.push(item.nama); }
          else if (item.status === 'Sakit') { waliAttendance.sakit++; waliAttendance.listS.push(item.nama); }
          else if (item.status === 'Izin')  { waliAttendance.izin++;  waliAttendance.listI.push(item.nama); }
        });
      }
    } catch(e) {}
  }

  // ── Jadwal hari ini ───────────────────────────────────────────────────
  let jadwalHariIni = [];
  try {
    jadwalHariIni = getTodayScheduleForTeacher(fullName || username, todayName) || [];
  } catch(e) {}

  // ── Mapel kelas (jadwal lengkap untuk widget profil di header) ────────
  let mapelKelas = [];
  try { mapelKelas = getGuruMapelKelas(username) || []; } catch(e) {}

  return {
    success: true,
    user: { username, fullName, tugasTambahan },
    stats: stats,
    iuran: iuranAll,
    tabunganHariIni: tabunganHariIni,
    piketData: piketData,
    waliKelasInfo: waliKelasInfo,
    waliAttendance: waliAttendance,
    jadwalHariIni: jadwalHariIni,
    mapelKelas: mapelKelas,
    isHariLibur: isHariLibur,
    hariLiburKet: hariLiburKet,
    todayName: todayName,
    todayStr: todayStr
  };
}

/**
 * Bundle: Dashboard Siswa.
 *
 * Menggabungkan getStudentAttendanceStats + getIuranSiswa(top1) +
 * getSavingsSiswa (saldo) + getJadwalHariIniSiswa + getPoinSiswaDashboard +
 * getHariLiburKeterangan.
 *
 * Total RPC sebelumnya: 6-7 → setelah: 1.
 */
function getDashboardBundleSiswa(username) {
  _assertEmailGate(username);
  const tz = Session.getScriptTimeZone();
  const today = new Date();
  const todayStr = Utilities.formatDate(today, tz, 'yyyy-MM-dd');

  // Attendance stats (reuse, sudah single-pass)
  let attendance = null;
  try { attendance = getStudentAttendanceStats(username); } catch(e) {}

  // Hari libur keterangan (sekali baca)
  let hariLiburKet = '';
  try { hariLiburKet = getHariLiburKeterangan(todayStr) || ''; } catch(e) {}

  // Iuran siswa - rekap (untuk widget status)
  let iuranRecap = [];
  try { iuranRecap = getIuranRecapSiswa(username) || []; } catch(e) {}

  // Savings (saldo)
  let saldoTabungan = 0;
  try {
    const savings = getSavingsSiswa(username) || [];
    const setor = savings.filter(r => r.jenis === 'Setor').reduce((s, r) => s + (parseFloat(r.jumlah) || 0), 0);
    const tarik = savings.filter(r => r.jenis === 'Tarik').reduce((s, r) => s + (parseFloat(r.jumlah) || 0), 0);
    saldoTabungan = setor - tarik;
  } catch(e) {}

  // Jadwal hari ini (siswa) — filter dari semua jadwal student
  let jadwalHariIni = [];
  try {
    if (typeof getStudentSchedules === 'function') {
      const all = getStudentSchedules(username) || [];
      const dayNames = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
      const todayName = dayNames[today.getDay()];
      jadwalHariIni = all.filter(s => s.hari === todayName);
    }
  } catch(e) {}

  // Poin siswa
  let poin = null;
  try { poin = getPoinSiswaDashboard(username, null); } catch(e) {}

  return {
    success: true,
    attendance:    attendance,
    hariLiburKet:  hariLiburKet,
    iuran:         iuranRecap,
    saldoTabungan: saldoTabungan,
    jadwalHariIni: jadwalHariIni,
    poin:          poin,
    todayStr:      todayStr
  };
}

function getDashboardBundleSavings(username) {
  _assertEmailGate(username);
  let savings = [];
  try { savings = getSavingsSiswa(username) || []; } catch(e) {}
  const setor = savings.filter(r => r.jenis === 'Setor').reduce((s, r) => s + (parseFloat(r.jumlah) || 0), 0);
  const tarik = savings.filter(r => r.jenis === 'Tarik').reduce((s, r) => s + (parseFloat(r.jumlah) || 0), 0);
  return {
    success: true,
    saldo:        setor - tarik,
    totalSetor:   setor,
    totalTarik:   tarik,
    transaksi:    savings
  };
}

// --- MANAJEMEN CALON SISWA DAN ORANG TUA ---

function getCalonSiswaData(callerUsername) {
  _assertEmailGate(callerUsername);
  logActivity(callerUsername, 'VIEW_DATA', 'Membuka menu Manajemen Calon Siswa');
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  data.shift(); // remove header
  
  const detailSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('SiswaDetail');
  let detailData = [];
  let detailHeaders = [];
  if (detailSheet && detailSheet.getLastRow() > 0) {
    const d = detailSheet.getDataRange().getValues();
    if (d.length > 0) {
      detailHeaders = d[0];
      detailData = d.slice(1);
    }
  }

  const detailMap = {};
  for (let i = 0; i < detailData.length; i++) {
    const un = String(detailData[i][0]).toLowerCase().trim();
    if (un) detailMap[un] = detailData[i];
  }

  const results = [];
  for (let i = 0; i < data.length; i++) {
    if (data[i][3] === 'Calon Siswa Baru') { // role is in column index 3
      const usernameRaw = String(data[i][1]).replace(/^'/, '');
      const cleanUn = usernameRaw.toLowerCase().trim();
      const rowData = detailMap[cleanUn];
      const progress = rowData ? _calculateProfileProgressPercentage(rowData, detailHeaders) : 0;
      
      results.push({
        id: data[i][0],
        username: usernameRaw, // handle safeText
        fullName: String(data[i][7] || ''),
        kelas: String(data[i][6] || ''),
        noHP: String(data[i][14] || ''),
        email: String(data[i][15] || ''),
        emailVerified: data[i][17] === true,
        progress: progress,
        createdDate: new Date().toISOString() // Placeholder as it's not stored in Users
      });
    }
  }
  
  results.sort((a, b) => {
    const nameA = String(a.fullName || a.username || '').toLowerCase();
    const nameB = String(b.fullName || b.username || '').toLowerCase();
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;
    return 0;
  });
  
  return results;
}

function _calculateProfileProgressPercentage(rowData, headers) {
  const getVal = (field) => {
    const idx = headers.indexOf(field);
    return idx >= 0 ? rowData[idx] : '';
  };
  const _truthy = (v) => {
    if (v === true || v === 1) return true;
    return String(v == null ? '' : v).trim().toLowerCase() === 'true';
  };
  const waliPilihan       = String(getVal('WaliPilihan') || '').trim();
  const ayahStatus        = String(getVal('AyahStatus') || '').trim();
  const ibuStatus         = String(getVal('IbuStatus') || '').trim();
  const ayahLuarNegeri    = _truthy(getVal('AyahAlamatTinggalLuarNegeri'));
  const ibuLuarNegeri     = _truthy(getVal('IbuAlamatTinggalLuarNegeri'));
  const ibuSamaAyah       = _truthy(getVal('IbuAlamatSamadenganAyah'));
  const waliLuarNegeri    = _truthy(getVal('WaliAlamatTinggalLuarNegeri'));
  const waliAlamatStatus  = String(getVal('WaliAlamatStatus') || '').trim();

  const requiredFields = [];
  const siswaFields = ['NIK','TempatLahir','TanggalLahir','JenisKelamin','JumlahSaudara','AnakKe','Agama','CitaCita','Hobi','NoHP','Email','BiayaSekolah','PraSekolah','NomorKK','NamaKepalaKeluarga'];
  siswaFields.forEach(f => requiredFields.push(f));

  const ayahBio = ['AyahNama','AyahStatus','AyahNIK','AyahTempatLahir','AyahTanggalLahir','AyahPendidikan','AyahPekerjaan','AyahPenghasilan','AyahNoHP'];
  ayahBio.forEach(f => requiredFields.push(f));

  if (ayahStatus === 'Masih Hidup' && !ayahLuarNegeri) {
    const ayahAlamat = ['AyahStatusKepemilikanRumah','AyahProvinsi','AyahKabupaten','AyahKecamatan','AyahKelurahan','AyahRW','AyahRT','AyahJalan','AyahKodePos'];
    ayahAlamat.forEach(f => requiredFields.push(f));
  }

  const ibuBio = ['IbuNama','IbuStatus','IbuNIK','IbuTempatLahir','IbuTanggalLahir','IbuPendidikan','IbuPekerjaan','IbuPenghasilan','IbuNoHP'];
  ibuBio.forEach(f => requiredFields.push(f));

  if (ibuStatus === 'Masih Hidup' && !ibuLuarNegeri && !ibuSamaAyah) {
    const ibuAlamat = ['IbuStatusKepemilikanRumah','IbuProvinsi','IbuKabupaten','IbuKecamatan','IbuKelurahan','IbuRW','IbuRT','IbuJalan','IbuKodePos'];
    ibuAlamat.forEach(f => requiredFields.push(f));
  }

  requiredFields.push('WaliPilihan');
  if (waliPilihan === 'Lainnya') {
    const waliBio = ['WaliNama','WaliStatus','WaliNIK','WaliTempatLahir','WaliTanggalLahir','WaliPendidikan','WaliPekerjaan','WaliPenghasilan','WaliNoHP','WaliAlamatStatus'];
    waliBio.forEach(f => requiredFields.push(f));

    if (waliAlamatStatus === 'Lainnya' && !waliLuarNegeri) {
      const waliAlamat = ['WaliStatusKepemilikanRumah','WaliProvinsi','WaliKabupaten','WaliKecamatan','WaliKelurahan','WaliRW','WaliRT','WaliJalan','WaliKodePos'];
      waliAlamat.forEach(f => requiredFields.push(f));
    }
  }

  const siswaAlamat = ['SiswaStatusTempatTinggal','SiswaProvinsi','SiswaKabupaten','SiswaKecamatan','SiswaKelurahan','SiswaRW','SiswaRT','SiswaJalan','SiswaKodePos','SiswaJarak','SiswaTransportasi','SiswaWaktuTempuh'];
  siswaAlamat.forEach(f => requiredFields.push(f));

  requiredFields.push('KK_FileUrl');
  requiredFields.push('AKTA_FileUrl');
  requiredFields.push('IJAZAH_MI_FileUrl');
  if (ayahStatus === 'Masih Hidup') requiredFields.push('KTP_AYAH_FileUrl');
  if (ibuStatus === 'Masih Hidup') requiredFields.push('KTP_IBU_FileUrl');
  if (waliPilihan === 'Lainnya') requiredFields.push('KTP_WALI_FileUrl');

  let filledCount = 0;
  for (let field of requiredFields) {
    const idx = headers.indexOf(field);
    if (idx === -1) continue;
    const value = rowData[idx];
    if (value !== "" && value !== null && value !== undefined && String(value).trim() !== "") {
      filledCount++;
    }
  }

  if (requiredFields.length === 0) return 100;
  return Math.round((filledCount / requiredFields.length) * 100);
}

function getCalonSiswaDetail(userId, callerUsername) {
  _assertEmailGate(callerUsername);
  logActivity(callerUsername, 'VIEW_DETAIL', `Melihat detail Calon Siswa ID: ${userId}`);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const userSheet = ss.getSheetByName('Users');
  if (!userSheet) throw new Error("Database Users tidak ditemukan");
  
  const userData = userSheet.getDataRange().getValues();
  let userRow = null;
  
  for (let i = 1; i < userData.length; i++) {
    if (userData[i][0] === userId) {
      userRow = userData[i];
      break;
    }
  }
  
  if (!userRow) throw new Error("User ID tidak ditemukan");
  if (userRow[3] !== 'Calon Siswa Baru') throw new Error("Akses ditolak: User bukan Calon Siswa Baru");
  
  const cleanUsername = String(userRow[1]).replace(/^'/, '');
  const result = {
    id: userRow[0],
    username: cleanUsername,
    fullName: userRow[7] || '-',
    kelas: userRow[6] || '-',
    noHP: userRow[14] || '-',
    email: userRow[15] || '-',
    bio: userRow[16] || '-',
    emailVerified: userRow[17] === true,
    createdDate: '-' // Default placeholder
  };
  
  const detailSheet = ss.getSheetByName('SiswaDetail');
  if (detailSheet && detailSheet.getLastRow() > 1) {
    const detailData = detailSheet.getDataRange().getValues();
    const headers = detailData[0];
    let detailRow = null;
    
    for (let i = 1; i < detailData.length; i++) {
      if (_cmpUsername(detailData[i][0], cleanUsername)) {
        detailRow = detailData[i];
        break;
      }
    }
    
    if (detailRow) {
      const getVal = (field) => {
        const idx = headers.indexOf(field);
        const val = idx >= 0 ? detailRow[idx] : '';
        if (val instanceof Date) return val;
        return (val === null || val === '') ? '-' : val;
      };
      
      result.details = {};
      for (let j = 0; j < headers.length; j++) {
        result.details[headers[j]] = detailRow[j] instanceof Date ?
          Utilities.formatDate(detailRow[j], "Asia/Jakarta", "yyyy-MM-dd") :
          (detailRow[j] === "" ? "" : detailRow[j]);
      }
      
      result.NIK = getVal('NIK');
      result.tempatLahir = getVal('TempatLahir');
      result.tanggalLahir = getVal('TanggalLahir');
      result.jenisKelamin = getVal('JenisKelamin');
      result.agama = getVal('Agama');
      result.alamat = getVal('SiswaAlamatJalan') !== '-' ? getVal('SiswaAlamatJalan') : '-';
      result.nomorKK = getVal('NomorKK');
      result.namaKepalaKeluarga = getVal('NamaKepalaKeluarga');
      
      result.ayahNama = getVal('AyahNama');
      result.ayahNIK = getVal('AyahNIK');
      result.ayahNoHP = getVal('AyahNoHP');
      result.ibuNama = getVal('IbuNama');
      result.ibuNIK = getVal('IbuNIK');
      result.ibuNoHP = getVal('IbuNoHP');
      
      result.createdDate = getVal('Timestamp') !== '-' ? getVal('Timestamp') : '-';
    }
  }
  
  return result;
}

function getOrangTuaData(callerUsername) {
  _assertEmailGate(callerUsername);
  logActivity(callerUsername, 'VIEW_DATA', 'Membuka menu Manajemen Akun Orang Tua');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const userSheet = ss.getSheetByName('Users');
  const detailSheet = ss.getSheetByName('SiswaDetail');
  
  if (!userSheet || userSheet.getLastRow() < 2) return [];
  
  const userData = userSheet.getDataRange().getValues();
  // Build lookup for children (Siswa / Calon Siswa)
  const childMap = {};
  for (let i = 1; i < userData.length; i++) {
    const role = userData[i][3];
    if (role === 'Siswa' || role === 'Calon Siswa Baru') {
      const uname = String(userData[i][1]).replace(/^'/, '');
      childMap[uname] = {
        fullName: String(userData[i][7] || uname),
        kelas: String(userData[i][6] || '-'),
        role: role,
        hasParent: false
      };
    }
  }
  
  // Extract detail relations
  const parentChildrenMap = {}; // { parentUsername: { anak: [], fallbackHP: '' } }
  if (detailSheet && detailSheet.getLastRow() > 1) {
    const detailData = detailSheet.getDataRange().getValues();
    const headers = detailData[0];
    const ortuColIdx = headers.indexOf('Username_Ortu');
    const nisnColIdx = headers.indexOf('NISN');
    const idxWaliPil = headers.indexOf('WaliPilihan');
    const idxAyahHP  = headers.indexOf('AyahNoHP');
    const idxIbuHP   = headers.indexOf('IbuNoHP');
    const idxWaliHP  = headers.indexOf('WaliNoHP');
    
    if (ortuColIdx >= 0) {
      for (let i = 1; i < detailData.length; i++) {
        const childUname = String(detailData[i][0]).replace(/^'/, '');
        const ortuVal = String(detailData[i][ortuColIdx] || '').trim();
        const nisnVal = nisnColIdx >= 0 && detailData[i][nisnColIdx] ? String(detailData[i][nisnColIdx]) : childUname;
        
        let childHP = '';
        if (idxWaliPil >= 0) {
          const wp = String(detailData[i][idxWaliPil] || '').toLowerCase();
          if (wp === 'wali') childHP = String(detailData[i][idxWaliHP] || '');
          else if (wp === 'ibu') childHP = String(detailData[i][idxIbuHP] || '');
          else childHP = String(detailData[i][idxAyahHP] || '');
        }
        if (!childHP) {
          childHP = String((idxAyahHP >= 0 ? detailData[i][idxAyahHP] : '') || (idxIbuHP >= 0 ? detailData[i][idxIbuHP] : '') || (idxWaliHP >= 0 ? detailData[i][idxWaliHP] : '') || '');
        }
        
        if (ortuVal && childMap[childUname]) {
          childMap[childUname].hasParent = true;
          const ortuArr = ortuVal.split(',').map(s => s.trim()).filter(Boolean);
          ortuArr.forEach(parentUname => {
            if (!parentChildrenMap[parentUname]) parentChildrenMap[parentUname] = { anak: [], fallbackHP: '' };
            parentChildrenMap[parentUname].anak.push({
              username: childUname,
              nisn: nisnVal,
              fullName: childMap[childUname].fullName,
              kelas: childMap[childUname].kelas,
              role: childMap[childUname].role
            });
            if (!parentChildrenMap[parentUname].fallbackHP && childHP) {
              parentChildrenMap[parentUname].fallbackHP = childHP;
            }
          });
        }
      }
    }
  }
  
  const results = [];
  for (let i = 1; i < userData.length; i++) {
    if (userData[i][3] === 'Orangtua') {
      const uname = String(userData[i][1]).replace(/^'/, '');
      const pMap = parentChildrenMap[uname] || { anak: [], fallbackHP: '' };
      let hp = String(userData[i][14] || '').trim();
      if (!hp || hp === '-') hp = pMap.fallbackHP || '-';
      
      results.push({
        id: userData[i][0],
        username: uname,
        fullName: String(userData[i][7] || uname),
        noHP: hp,
        email: String(userData[i][15] || '-'),
        jumlahAnak: pMap.anak.length,
        anak: pMap.anak
      });
    }
  }
  
  results.sort((a, b) => {
    const nameA = String(a.fullName || '').toLowerCase();
    const nameB = String(b.fullName || '').toLowerCase();
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;
    return 0;
  });
  
  const stats = {
    totalAnak: 0,
    linkedAnak: 0,
    orphanedAnak: []
  };
  
  for (const uname in childMap) {
    stats.totalAnak++;
    if (childMap[uname].hasParent) {
      stats.linkedAnak++;
    } else {
      stats.orphanedAnak.push({
        username: uname,
        fullName: childMap[uname].fullName,
        kelas: childMap[uname].kelas,
        role: childMap[uname].role
      });
    }
  }
  
  return {
    parents: results,
    stats: stats
  };
}

function uploadFileToDrive(base64Data, filename, adminUser) {
  const lock = LockService.getScriptLock();
  try {
    const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), MimeType.PDF, filename);
    let folder;
    const folders = DriveApp.getFoldersByName("Buku Digital SiM-Murid");
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder("Buku Digital SiM-Murid");
      folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    logActivity(adminUser, 'UPLOAD_EBOOK', `Mengupload file PDF: ${filename}`);
    return file.getUrl();
  } catch (e) {
    throw new Error(e.toString());
  } finally {
    if (lock) lock.releaseLock();
  }
}

// (fungsi getDocumentBase64 telah didefinisikan di atas — duplikat dihapus)

/**
 * Menghasilkan nomor slip penarikan berformat "[Tipe]-dd-mmm-yy-[NNN]".
 *
 * Mapping prefix penabungType:
 *   'Siswa'   → 'S'
 *   'Guru'    → 'G'
 *   'Nasabah' → 'N'
 *   selainnya → 'N'
 *
 * Format output: [Prefix]-dd-mmm-yy-NNN
 *   dd  = hari 2 digit (01–31)
 *   mmm = singkatan bulan Bahasa Indonesia (Jan, Feb, Mar, Apr, Mei, Jun,
 *                                           Jul, Agu, Sep, Okt, Nov, Des)
 *   yy  = tahun 2 digit (25 untuk 2025)
 *   NNN = total baris jenis === 'Tarik' di savingsData (termasuk baris baru),
 *         di-pad 3 digit (001, 002, ...)
 *
 * savingsData diterima sebagai parameter (sudah di-load sebelumnya).
 * Index 0 adalah baris header; jenis berada di kolom index 5 (kolom ke-6).
 *
 * Contoh output: "S-03-Jan-25-007", "G-15-Mar-25-012", "N-01-Jul-25-001"
 *
 * @param {string}       penabungType  - 'Siswa' | 'Guru' | 'Nasabah'
 * @param {Date|string|number} tanggal - Tanggal transaksi
 * @param {Array}        savingsData   - Rows dari Sheet_Savings (index 0 = header)
 * @returns {string}
 */
function _generateNoSlip_(penabungType, tanggal, savingsData) {
  // --- 1. Tentukan prefix dari penabungType ---
  var prefixMap = { 'Siswa': 'S', 'Guru': 'G', 'Nasabah': 'N' };
  var prefix = prefixMap[penabungType] || 'N';

  // --- 2. Normalisasi tanggal ---
  var date;
  if (tanggal instanceof Date) {
    date = tanggal;
  } else if (typeof tanggal === 'number') {
    // Mungkin serial Excel (GAS seringkali menyimpan tanggal sebagai serial)
    date = new Date((tanggal - 25569) * 86400 * 1000);
  } else {
    date = new Date(tanggal);
  }
  // Fallback ke hari ini jika parse gagal
  if (isNaN(date.getTime())) {
    date = new Date();
  }

  var bulanIndo = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
                   'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  var dd  = String(date.getDate()).padStart(2, '0');
  var mmm = bulanIndo[date.getMonth()];
  var yy  = String(date.getFullYear()).slice(-2);

  // --- 3. Hitung NNN = total baris jenis === 'Tarik' di savingsData ---
  // (termasuk baris baru yang sudah tersimpan — jenis di kolom index 5)
  var tarikCount = 0;
  if (Array.isArray(savingsData)) {
    for (var i = 1; i < savingsData.length; i++) {  // i=0 adalah header
      var row = savingsData[i];
      if (Array.isArray(row) && String(row[5]) === 'Tarik') {
        tarikCount++;
      }
    }
  }
  var nnn = String(tarikCount).padStart(3, '0');

  return prefix + '-' + dd + '-' + mmm + '-' + yy + '-' + nnn;
}
