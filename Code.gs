/**
 * Resident safety reporting app: a volunteer residents' initiative, not an official app of the society.
 * Standalone Apps Script web app. Run setup() once, then deploy (see README.md).
 */
const CONFIG = {
  SOCIETY: "Godrej Park Retreat residents' safety initiative", // not the society or its committee
  CONTACT_EMAIL: 'napaankur@gmail.com',
  NOTICE_VERSION: 'v2, 14 October 2026',
  TOWERS: ['Tower A', 'Tower B', 'Tower C', 'Tower D', 'Tower E', 'Tower F', 'Tower G', 'Tower H',
    'Parking', 'Clubhouse', 'Gate and driveway', 'Garden or play area', 'Other common area'],
  // Safety only. Keep in step with EN_CAT in I18n.html, which holds the translations.
  CATEGORIES: ['Lift stuck or not working', 'Lift alarm or intercom not working', 'Fire, smoke or burning smell',
    'Fire equipment missing or not working', 'Fire exit or staircase blocked', 'Gas leak smell',
    'Electrical danger (open wires, sparks, shocks)', 'Structural danger (cracks, falling plaster, broken railing)',
    'Flooding or water near electrics', 'Security or suspicious person',
    'Danger to children (open shaft, unsafe play area)', 'Other safety risk'],
  // Urgent ones fold the optional questions away on the form and email the data contact at once.
  URGENT: ['Lift stuck or not working', 'Fire, smoke or burning smell', 'Gas leak smell',
    'Electrical danger (open wires, sparks, shocks)', 'Flooding or water near electrics'],
  // Johnson Care breakdown line, from the plate inside the lifts (job number differs per lift).
  LIFT_HELPLINE: ['08023201400', '08023201401', '08023201402', '08023201403'],
  SAFETY_GROUP_URL: 'https://chat.whatsapp.com/BgTJMNNCUoG1Ey9GQViZXB',
  LANGS: ['en', 'hi', 'kn', 'bn', 'or', 'pa', 'ta', 'te', 'ml', 'mr', 'gu'],
  STATUSES: ['New', 'Under review', 'Action taken', 'Closed'],
  MYGATE_OUTCOMES: ['No response', 'Acknowledged but not fixed', 'Closed without a fix', 'Fixed'],
  RETAIN_DAYS: 180,
  MAX_PHOTOS: 3,
  MAX_PHOTO_CHARS: 3000000, // base64 length, about 2.2 MB per photo
  VOICE_TYPES: { 'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg' },
  MAX_VOICE_CHARS: 2000000, // base64 length, about 1.5 MB, well over 2 minutes at 32 kbps
  HOURLY_CAP: 60, // ponytail: one global cap, Apps Script cannot see who is submitting
};

const SHARED_HEADERS = ['Ticket ID', 'Submitted at', 'Category', 'Tower or area', 'Exact spot',
  'When it happened', 'Description', 'Photos and voice note', 'Raised on MyGate', 'MyGate ticket', 'MyGate outcome'];
const RAW_HEADERS = [...SHARED_HEADERS, 'Phone', 'Notice version', 'Notice language'];
const TRIAGE_HEADERS = [...SHARED_HEADERS, 'Status', 'Action note', 'Last updated'];
const COL = { DESCRIPTION: 7, PHOTOS: 8, CONTACT: 12, STATUS: 12, ACTION: 13, LAST_UPDATED: 14 };

function doGet() {
  const page = HtmlService.createTemplateFromFile('Index');
  page.cfg = pageConfig_();
  return page.evaluate()
    .setTitle('Report a safety problem')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .addMetaTag('mobile-web-app-capable', 'yes')
    .addMetaTag('apple-mobile-web-app-capable', 'yes')
    .addMetaTag('apple-mobile-web-app-title', 'Safety')
    .addMetaTag('apple-mobile-web-app-status-bar-style', 'default');
}

/** Everything the page needs from CONFIG. The local preview builder calls this too. */
function pageConfig_() {
  return {
    society: CONFIG.SOCIETY, email: CONFIG.CONTACT_EMAIL, version: CONFIG.NOTICE_VERSION,
    towers: CONFIG.TOWERS, categories: CONFIG.CATEGORIES, mygateOutcomes: CONFIG.MYGATE_OUTCOMES,
    urgent: CONFIG.URGENT, maxPhotos: CONFIG.MAX_PHOTOS, retainDays: CONFIG.RETAIN_DAYS,
    safetyGroup: CONFIG.SAFETY_GROUP_URL, liftHelpline: CONFIG.LIFT_HELPLINE,
  };
}

/** JSON endpoint for the GitHub Pages app. Runs the same checks as submit(). */
function doPost(e) {
  let out;
  try {
    out = { ok: true, ...submit(JSON.parse(e.postData.contents)) };
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/** Called from the page. Returns the ticket ID or throws an error key the page translates (e_*). */
function submit(form) {
  if (form && form.website) return { ticket: 'TKT-0000' }; // honeypot hit: fake success, store nothing
  const problem = validate_(form);
  if (problem) throw new Error(problem);

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (!underRateLimit_()) throw new Error('e_rate');
    const props = PropertiesService.getScriptProperties();
    const n = Number(props.getProperty('LAST_TICKET') || 0) + 1;
    props.setProperty('LAST_TICKET', String(n));
    const ticket = 'TKT-' + String(n).padStart(4, '0');

    const now = new Date();
    const shared = [ticket, now, form.category, form.tower, cell_(form.spot), cell_(form.when),
      cell_(form.description), saveMedia_(ticket, form.photos || [], form.voice, form.voiceType), form.mygate || 'Not answered',
      form.mygate === 'Yes' ? cell_(form.mygateRef) : '', form.mygate === 'Yes' ? form.mygateOutcome : ''];
    book_('PRIVATE_ID').getSheetByName('Raw').appendRow([...shared, normPhone_(form.contact), CONFIG.NOTICE_VERSION,
      CONFIG.LANGS.includes(form.lang) ? form.lang : 'en']);
    book_('MONITOR_ID').getSheetByName('Triage').appendRow([...shared, 'New', '', now]);
    if (CONFIG.URGENT.includes(form.category)) alertUrgent_(ticket, form);
    return { ticket };
  } finally {
    lock.releaseLock();
  }
}

function validate_(f) {
  if (!f || f.consent !== true) return 'e_consent';
  if (!CONFIG.CATEGORIES.includes(f.category) || !CONFIG.TOWERS.includes(f.tower)) return 'e_place';
  if (!normPhone_(f.contact)) return 'e_phone'; // required: the form says so up front
  if (!['Yes', 'No', '', undefined].includes(f.mygate)) return 'e_mygate'; // optional: nobody stuck in a lift answers this
  if (f.mygate === 'Yes' && !CONFIG.MYGATE_OUTCOMES.includes(f.mygateOutcome)) return 'e_mygate';
  const hasVoice = Boolean(f.voice);
  if (hasVoice && (!(f.voiceType in CONFIG.VOICE_TYPES) || typeof f.voice !== 'string' ||
      f.voice.length > CONFIG.MAX_VOICE_CHARS || !/^[A-Za-z0-9+/=]+$/.test(f.voice))) return 'e_generic';
  const d = String(f.description || '').trim();
  const hasPhoto = Array.isArray(f.photos) && f.photos.length > 0;
  // Category plus tower is enough to act on. Only 'Other safety risk' needs a word, a voice note or a photo.
  const needsDetail = f.category === 'Other safety risk' && !hasVoice && !hasPhoto && d.length < 3;
  if (d.length > 2000 || needsDetail) return 'e_desc';
  if (String(f.spot || '').length > 200 || String(f.when || '').length > 50 || String(f.contact || '').length > 40 ||
      String(f.mygateRef || '').length > 40) {
    return 'e_long';
  }
  const p = f.photos || [];
  if (!Array.isArray(p) || p.length > CONFIG.MAX_PHOTOS) return 'e_photos_max';
  const badPhoto = p.some(x => typeof x !== 'string' || x.length > CONFIG.MAX_PHOTO_CHARS ||
    !x.startsWith('/9j/') || !/^[A-Za-z0-9+/=]+$/.test(x)); // '/9j/' is the JPEG signature in base64
  if (badPhoto) return 'e_photo';
  return '';
}

/** Emails the data contact for urgent tickets. Holds no contact details. A mail failure never loses the report. */
function alertUrgent_(ticket, form) {
  try {
    MailApp.sendEmail(CONFIG.CONTACT_EMAIL, 'URGENT ' + ticket + ': ' + form.category + ', ' + form.tower,
      ticket + '\n' + form.category + '\n' + form.tower + ' ' + String(form.spot || '') + '\n\n' +
      String(form.description || '(voice note or photo only)') + '\n\nMonitors sheet: ' + book_('MONITOR_ID').getUrl());
  } catch (e) {
    console.error('Urgent email failed for ' + ticket + ': ' + e);
  }
}

/** Indian mobile number as 10 digits, or '' if it is not one. Accepts +91, 91 or 0 in front, spaces and dashes. */
function normPhone_(v) {
  const digits = String(v || '').replace(/[\s()-]/g, '').replace(/^(\+?91|0)(?=\d{10}$)/, '');
  return /^[6-9]\d{9}$/.test(digits) ? digits : '';
}

/** Stops typed text being run as a spreadsheet formula. */
function cell_(v) {
  const s = String(v || '').trim();
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function underRateLimit_() {
  const cache = CacheService.getScriptCache();
  const key = 'count-' + Math.floor(Date.now() / 3600000);
  const n = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(n), 3600);
  return n <= CONFIG.HOURLY_CAP;
}

/** Saves photos and the voice note as TKT-0001-1.jpg, TKT-0001-voice.webm. eraseTicket_ relies on that prefix. */
function saveMedia_(ticket, photos, voice, voiceType) {
  const folder = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('PHOTOS_ID'));
  const blobs = photos.map((b64, i) => Utilities.newBlob(Utilities.base64Decode(b64), 'image/jpeg', ticket + '-' + (i + 1) + '.jpg'));
  if (voice) {
    blobs.push(Utilities.newBlob(Utilities.base64Decode(voice), voiceType, ticket + '-voice.' + CONFIG.VOICE_TYPES[voiceType]));
  }
  return blobs.map(b => folder.createFile(b).getUrl()).join('\n');
}

function book_(key) {
  return SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty(key));
}

/** Run once from the editor. Creates the folder, both sheets, the dashboard and the triggers. */
function setup() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('MONITOR_ID')) throw new Error('Already set up.');

  const root = DriveApp.createFolder(CONFIG.SOCIETY + ' complaints');
  const photos = root.createFolder('Photos');
  const priv = SpreadsheetApp.create('Complaints PRIVATE (data contact only)');
  const mon = SpreadsheetApp.create('Complaints for monitors');
  [priv, mon].forEach(ss => DriveApp.getFileById(ss.getId()).moveTo(root));

  const raw = priv.getSheets()[0].setName('Raw');
  raw.appendRow(RAW_HEADERS);
  raw.setFrozenRows(1);

  const tri = mon.getSheets()[0].setName('Triage');
  tri.appendRow(TRIAGE_HEADERS);
  tri.setFrozenRows(1);
  tri.getRange('L2:L').setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(CONFIG.STATUSES, true).setAllowInvalid(false).build());
  const locked = tri.getRange('A:K').protect().setDescription('Filled by the form. Monitors edit Status and Action note only.');
  locked.removeEditors(locked.getEditors());
  buildDashboard_(mon.insertSheet('Dashboard'));

  props.setProperties({ PRIVATE_ID: priv.getId(), MONITOR_ID: mon.getId(), PHOTOS_ID: photos.getId() });
  ScriptApp.newTrigger('stampUpdate').forSpreadsheet(mon).onEdit().create();
  ScriptApp.newTrigger('purgeOld').timeBased().everyDays(1).atHour(3).create();
  Logger.log('Monitors sheet: ' + mon.getUrl());
  Logger.log('Private sheet: ' + priv.getUrl());
  Logger.log('Photos folder (share view only with monitors): ' + photos.getUrl());
}

function buildDashboard_(sh) {
  sh.getRange('A1:B8').setValues([
    ['Total tickets', '=COUNTA(Triage!A2:A)'],
    ['Open', '=COUNTIFS(Triage!A2:A,"<>",Triage!L2:L,"<>Closed")'],
    ['Open over 7 days', '=COUNTIFS(Triage!A2:A,"<>",Triage!L2:L,"<>Closed",Triage!B2:B,"<"&(NOW()-7))'],
    ['Raised in the last 7 days', '=COUNTIFS(Triage!B2:B,">="&(NOW()-7))'],
    ['Closed', '=COUNTIF(Triage!L2:L,"Closed")'],
    ['Raised on MyGate first', '=COUNTIF(Triage!I2:I,"Yes")'],
    ['MyGate tickets not fixed', '=COUNTIFS(Triage!I2:I,"Yes",Triage!K2:K,"<>Fixed")'],
    ['Urgent and open', '=SUMPRODUCT(ISNUMBER(MATCH(Triage!C2:C,{"' + CONFIG.URGENT.join('";"') + '"},0))*(Triage!A2:A<>"")*(Triage!L2:L<>"Closed"))'],
  ]);
  const q = (col, label) => `=QUERY(Triage!A2:N,"select ${col}, count(A) where A is not null group by ${col} ` +
    `order by count(A) desc label ${col} '${label}', count(A) 'Tickets'",0)`;
  sh.getRange('A10').setFormula(q('C', 'Category'));
  sh.getRange('D10').setFormula(q('D', 'Tower or area'));
  sh.getRange('G10').setFormula(q('L', 'Status'));
  sh.getRange('M10').setFormula(q('K', 'MyGate outcome'));
  sh.getRange('J10').setFormula('=QUERY(Triage!A2:N,"select year(B), month(B)+1, count(A) where A is not null ' +
    "group by year(B), month(B)+1 label year(B) 'Year', month(B)+1 'Month', count(A) 'Tickets'\",0)");
  sh.getRange('A1:A8').setFontWeight('bold');
  sh.getRange('A1:B8').setFontSize(12);
}

/** Installable onEdit on the monitors sheet: stamps when a ticket's status or note changed. */
function stampUpdate(e) {
  const r = e.range;
  if (r.getSheet().getName() !== 'Triage' || r.getRow() < 2) return;
  if (r.getColumn() > COL.ACTION || r.getLastColumn() < COL.STATUS) return;
  r.getSheet().getRange(r.getRow(), COL.LAST_UPDATED, r.getNumRows(), 1).setValue(new Date());
}

/** Daily: erases content of tickets closed longer than RETAIN_DAYS. Counts stay. */
function purgeOld() {
  const cutoff = Date.now() - CONFIG.RETAIN_DAYS * 864e5;
  const rows = book_('MONITOR_ID').getSheetByName('Triage').getDataRange().getValues().slice(1);
  rows.filter(r => r[COL.STATUS - 1] === 'Closed' && r[COL.LAST_UPDATED - 1] instanceof Date &&
      r[COL.LAST_UPDATED - 1].getTime() < cutoff && !String(r[COL.DESCRIPTION - 1]).startsWith('[Erased'))
    .forEach(r => eraseTicket_(r[0], '[Erased after retention period]'));
}

/** For an erasure request: set the ticket ID below, then run from the editor. */
function deleteOnRequest() {
  const ticket = 'TKT-0000';
  eraseTicket_(ticket, '[Erased on request ' + new Date().toISOString().slice(0, 10) + ']');
}

function eraseTicket_(ticket, note) {
  const folder = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('PHOTOS_ID'));
  const files = folder.searchFiles(`title contains '${ticket}-'`);
  while (files.hasNext()) files.next().setTrashed(true);

  [['PRIVATE_ID', 'Raw', true], ['MONITOR_ID', 'Triage', false]].forEach(([key, tab, hasContact]) => {
    const sh = book_(key).getSheetByName(tab);
    const hit = sh.getRange('A:A').createTextFinder(ticket).matchEntireCell(true).findNext();
    if (!hit) throw new Error(ticket + ' not found in ' + tab);
    const row = hit.getRow();
    sh.getRange(row, COL.DESCRIPTION, 1, 2).setValues([[note, '']]);
    sh.getRange(row, 5, 1, 2).setValues([['', '']]); // exact spot and time can identify a flat
    if (hasContact) sh.getRange(row, COL.CONTACT).setValue('');
  });
}

/** Run from the editor after any change to validate_ or cell_. */
function selfTest() {
  const ok = { consent: true, category: CONFIG.CATEGORIES[0], tower: CONFIG.TOWERS[0],
    description: 'Lift 3 alarm button gets no answer', photos: [], mygate: 'No', contact: '98450 12345' };
  const check = (cond, msg) => { if (!cond) throw new Error('selfTest failed: ' + msg); };
  check(validate_(ok) === '', 'valid report rejected');
  check(validate_({ ...ok, photos: ['/9j/4AAQSkZJRg=='] }) === '', 'valid photo rejected');
  check(validate_({ ...ok, consent: false }) !== '', 'missing consent accepted');
  check(validate_({ ...ok, category: 'Hack' }) !== '', 'unknown category accepted');
  check(validate_({ ...ok, description: 'short' }) === '', 'short description rejected');
  check(validate_({ ...ok, photos: ['/9j/', '/9j/', '/9j/', '/9j/'] }) !== '', 'too many photos accepted');
  check(validate_({ ...ok, photos: ['PHNjcmlwdD4='] }) !== '', 'non-JPEG accepted');
  check(validate_({ ...ok, description: '', voice: 'GkXfo0', voiceType: 'audio/webm' }) === '', 'voice-only report rejected');
  check(validate_({ ...ok, description: '', voice: 'GkXfo0', voiceType: 'text/html' }) !== '', 'bad voice type accepted');
  check(validate_({ ...ok, description: '' }) === '', 'category plus tower rejected');
  check(validate_({ ...ok, category: 'Other safety risk', description: '' }) === 'e_desc', 'empty Other report accepted');
  check(validate_({ ...ok, category: 'Other safety risk', description: 'Loose tile' }) === '', 'short Other report rejected');
  check(validate_({ ...ok, category: 'Noise' }) === 'e_place', 'non-safety category accepted');
  check(validate_({ ...ok, mygate: '' }) === '', 'unanswered MyGate blocked an urgent report');
  check(validate_({ ...ok, description: '', photos: ['/9j/4AAQ'] }) === '', 'photo-only report rejected');
  check(validate_({ ...ok, mygate: 'Yes' }) !== '', 'MyGate Yes without outcome accepted');
  check(validate_({ ...ok, mygate: 'Yes', mygateOutcome: 'No response', mygateRef: '12345' }) === '', 'valid MyGate rejected');
  check(validate_({ ...ok, contact: '' }) === 'e_phone', 'missing phone accepted');
  check(validate_({ ...ok, contact: '12345' }) === 'e_phone', 'short phone accepted');
  check(normPhone_('+91 98450-12345') === '9845012345', '+91 phone not normalised');
  check(normPhone_('09845012345') === '9845012345', 'leading 0 phone not normalised');
  check(normPhone_('1845012345') === '', 'non-mobile number accepted');
  check(cell_('=IMPORTXML("x")') === "'=IMPORTXML(\"x\")", 'formula not neutralised');
  check(cell_('plain text') === 'plain text', 'plain text changed');
  Logger.log('selfTest passed');
}
