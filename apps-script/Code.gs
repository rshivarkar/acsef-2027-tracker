/**
 * ACSEF 2027 Project Tracker: team sync backend (Google Apps Script web app).
 *
 * Stores the tracker's shared data in the Google Sheet this script is attached to.
 * The web page sends POST requests with a JSON body:
 *   { action: "get", passcode }
 *   { action: "put", passcode, baseRevision, force, by, state }
 * Every successful "put" increases the revision number. A "put" whose baseRevision is
 * not the current revision is refused with error "conflict" and the current data, so the
 * page can merge and try again (unless force is true, used for Import / Start over).
 *
 * Setup steps are in the README: https://github.com/rshivarkar/acsef-2027-tracker#team-sync-setup
 *
 * @OnlyCurrentDoc  (only asks for access to this one spreadsheet)
 */

// 1) Change this to a team passcode before deploying. Share it only with the team.
const PASSCODE = 'CHANGE-ME';

const STATE_SHEET = '_tracker_state'; // hidden tab holding the raw data; do not edit by hand
const CHUNK = 40000;                  // a Sheets cell holds at most 50,000 characters
const MAX_CHARS = 2000000;

function doGet() {
  return json_({ ok: true, service: 'acsef-tracker-sync', note: 'This web app only answers POST requests from the tracker page.' });
}

function doPost(e) {
  let req;
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || '');
  } catch (err) {
    return json_({ ok: false, error: 'bad_request' });
  }
  if (!req || typeof req !== 'object') return json_({ ok: false, error: 'bad_request' });
  if (!PASSCODE || PASSCODE === 'CHANGE-ME') return json_({ ok: false, error: 'passcode_not_set' });
  if (req.passcode !== PASSCODE) {
    Utilities.sleep(800); // slow down guessing
    return json_({ ok: false, error: 'bad_passcode' });
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return json_({ ok: false, error: 'busy' });
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const cur = readState_(ss);

    if (req.action === 'get') {
      return json_({ ok: true, revision: cur.revision, updatedAt: cur.updatedAt, updatedBy: cur.updatedBy, state: cur.state });
    }

    if (req.action === 'put') {
      if (!req.state || typeof req.state !== 'object' || !Array.isArray(req.state.tasks)) {
        return json_({ ok: false, error: 'bad_request' });
      }
      if (!req.force && req.baseRevision !== cur.revision) {
        return json_({ ok: false, error: 'conflict', revision: cur.revision, updatedAt: cur.updatedAt, updatedBy: cur.updatedBy, state: cur.state });
      }
      const text = JSON.stringify(req.state);
      if (text.length > MAX_CHARS) return json_({ ok: false, error: 'too_large' });
      const rev = cur.revision + 1;
      writeState_(ss, rev, text, String(req.by || '').slice(0, 40));
      try {
        writeViews_(ss, req.state);
      } catch (err) {
        console.warn('Could not refresh the readable tabs: ' + err);
      }
      return json_({ ok: true, revision: rev });
    }

    return json_({ ok: false, error: 'bad_request' });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- Raw state storage ---------- */

function stateSheet_(ss) {
  let sh = ss.getSheetByName(STATE_SHEET);
  if (!sh) {
    sh = ss.insertSheet(STATE_SHEET);
    sh.getRange(1, 1, 1, 4).setValues([[0, '', '', 'Tracker data used by the web app. Do not edit this tab.']]);
    try { sh.hideSheet(); } catch (err) { /* cannot hide the only visible tab; that is fine */ }
  }
  return sh;
}

function readState_(ss) {
  const sh = stateSheet_(ss);
  const head = sh.getRange(1, 1, 1, 3).getValues()[0];
  const last = sh.getLastRow();
  let text = '';
  if (last >= 2) {
    // Each chunk is stored with a leading "x" so Sheets never treats it as a number, date or formula.
    text = sh.getRange(2, 1, last - 1, 1).getValues()
      .map(function (r) { return String(r[0]).slice(1); })
      .join('');
  }
  let state = null;
  if (text) {
    try { state = JSON.parse(text); } catch (err) { state = null; }
  }
  return { revision: Number(head[0]) || 0, updatedAt: Number(head[1]) || 0, updatedBy: String(head[2] || ''), state: state };
}

function writeState_(ss, rev, text, by) {
  const sh = stateSheet_(ss);
  const chunks = [];
  for (let i = 0; i < text.length; i += CHUNK) chunks.push(['x' + text.slice(i, i + CHUNK)]);
  const last = sh.getLastRow();
  if (last >= 2) sh.getRange(2, 1, last - 1, 1).clearContent();
  if (chunks.length) {
    const range = sh.getRange(2, 1, chunks.length, 1);
    range.setNumberFormat('@');
    range.setValues(chunks);
  }
  sh.getRange(1, 1, 1, 3).setValues([[rev, Date.now(), by]]);
  SpreadsheetApp.flush();
}

/* ---------- Readable tabs (rewritten on every save; edits there are not read back) ---------- */

function writeViews_(ss, state) {
  const phaseName = {};
  (state.phases || []).forEach(function (p) { phaseName[p.id] = p.name; });

  writeTable_(ss, 'Tasks',
    ['Phase', 'Task', 'Description', 'Owner', 'Due', 'Status', 'Completed', 'Notes'],
    (state.tasks || []).map(function (t) {
      return [phaseName[t.phase] || '', t.title, t.desc, t.owner, t.due, t.status, t.completedAt, t.notes];
    }));

  writeTable_(ss, 'AI Use Log',
    ['Date', 'Student', 'Tool', 'Prompt / question', 'What it helped with', 'How it was cited'],
    (state.aiLog || []).map(function (r) { return [r.date, r.student, r.tool, r.prompt, r.purpose, r.citation]; }));

  writeTable_(ss, 'Experiment Log',
    ['Date', 'Test', 'Start', 'End', 'Outdoor °F', 'Weather', 'Window / vent / door settings', 'Who ran it', 'Notes'],
    (state.expLog || []).map(function (r) {
      return [r.date, r.test, r.start, r.end, r.outdoor, r.weather, r.settings, r.ranBy, r.notes];
    }));

  writeTable_(ss, 'Parts',
    ['Item', 'Qty', 'Cost each ($)', 'Line total ($)', 'Ordered', 'Received'],
    (state.parts || []).map(function (r) {
      const qty = parseFloat(r.qty) || 0, cost = parseFloat(r.cost) || 0;
      return [r.item, r.qty, r.cost, Math.round(qty * cost * 100) / 100, !!r.ordered, !!r.received];
    }));
}

function writeTable_(ss, name, head, rows) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clearContents();
  const data = [head].concat(rows).map(function (r) { return r.map(safeCell_); });
  sh.getRange(1, 1, data.length, head.length).setValues(data);
  sh.getRange(1, 1, 1, head.length).setFontWeight('bold');
  sh.setFrozenRows(1);
}

/** Keeps typed text from being run as a spreadsheet formula. */
function safeCell_(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  const s = String(v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
