const CHEKI_SYNC_FUNCTION_URL_PROPERTY = "CHEKI_SYNC_FUNCTION_URL";
const CHEKI_SYNC_TOKEN_PROPERTY = "CHEKI_SYNC_TOKEN";
const CHEKI_SYNC_TIMEZONE = "Asia/Tokyo";

const CHEKI_BASE_COLUMNS = {
  eventName: 1,
  eventDate: 2,
  groupName: 3,
  staffName: 4,
  status: 5,
  employeeName: 6,
  liveType: 7,
  venue: 8,
};

const CHEKI_CONTROL_HEADERS = [
  "row_uid",
  "反映状態",
  "反映日時",
  "アプリ募集ID",
  "アプリ枠ID",
  "エラー内容",
];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("チェキ募集")
    .addItem("初期設定", "setupChekiSync")
    .addItem("管理列を追加", "prepareChekiSyncSheet")
    .addSeparator()
    .addItem("選択行をアプリへ反映", "syncSelectedChekiRows")
    .addItem("反映待ちをまとめて反映", "syncPendingChekiRows")
    .addItem("接続テスト", "testChekiSyncConnection")
    .addToUi();
}

function setupChekiSync() {
  const ui = SpreadsheetApp.getUi();
  const functionUrl = ui.prompt(
    "同期先URL",
    "Supabase Edge FunctionのURLを入力してください。",
    ui.ButtonSet.OK_CANCEL,
  );
  if (functionUrl.getSelectedButton() !== ui.Button.OK) return;

  const token = ui.prompt(
    "同期トークン",
    "CHEKI_SHEET_SYNC_TOKENに設定した値を入力してください。",
    ui.ButtonSet.OK_CANCEL,
  );
  if (token.getSelectedButton() !== ui.Button.OK) return;

  PropertiesService.getScriptProperties().setProperties({
    [CHEKI_SYNC_FUNCTION_URL_PROPERTY]: functionUrl.getResponseText().trim(),
    [CHEKI_SYNC_TOKEN_PROPERTY]: token.getResponseText().trim(),
  });
  ui.alert("初期設定を保存しました。次に「管理列を追加」を実行してください。");
}

function prepareChekiSyncSheet() {
  const sheet = SpreadsheetApp.getActiveSheet();
  ensureChekiControlColumns_(sheet);
  SpreadsheetApp.getUi().alert("同期管理用の列を確認しました。");
}

function testChekiSyncConnection() {
  const sheet = SpreadsheetApp.getActiveSheet();
  try {
    const response = callChekiImportFunction_({
      spreadsheetId: SpreadsheetApp.getActive().getId(),
      sheetId: String(sheet.getSheetId()),
      sheetName: sheet.getName(),
      testOnly: true,
      rows: [],
    });
    SpreadsheetApp.getUi().alert(response.ok ? "接続できました。" : `接続に失敗しました: ${response.error || response.detail}`);
  } catch (error) {
    SpreadsheetApp.getUi().alert(error instanceof Error ? error.message : String(error));
  }
}

function syncSelectedChekiRows() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const range = sheet.getActiveRange();
  if (!range) {
    SpreadsheetApp.getUi().alert("反映する行を選択してください。");
    return;
  }

  const start = Math.max(2, range.getRow());
  const end = range.getLastRow();
  const rowNumbers = [];
  for (let rowNumber = start; rowNumber <= end; rowNumber += 1) {
    rowNumbers.push(rowNumber);
  }
  syncChekiRows_(sheet, expandChekiRowNumbersByLive_(sheet, rowNumbers));
}

function syncPendingChekiRows() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const control = ensureChekiControlColumns_(sheet);
  const lastRow = sheet.getLastRow();
  const rowNumbers = [];
  for (let rowNumber = 2; rowNumber <= lastRow; rowNumber += 1) {
    const eventName = cellText_(sheet.getRange(rowNumber, CHEKI_BASE_COLUMNS.eventName).getValue());
    const eventDate = cellText_(sheet.getRange(rowNumber, CHEKI_BASE_COLUMNS.eventDate).getValue());
    const groupName = cellText_(sheet.getRange(rowNumber, CHEKI_BASE_COLUMNS.groupName).getValue());
    const syncStatus = cellText_(sheet.getRange(rowNumber, control.statusColumn).getValue());
    if (eventName && eventDate && groupName && syncStatus !== "反映済み") {
      rowNumbers.push(rowNumber);
    }
  }
  syncChekiRows_(sheet, expandChekiRowNumbersByLive_(sheet, rowNumbers));
}

function syncChekiRows_(sheet, rowNumbers) {
  const ui = SpreadsheetApp.getUi();
  const control = ensureChekiControlColumns_(sheet);
  const rows = rowNumbers.map((rowNumber) => readChekiRow_(sheet, rowNumber, control.uidColumn)).filter(Boolean);

  if (rows.length === 0) {
    ui.alert("反映できる行がありません。イベント名、実施日、グループ名を確認してください。");
    return;
  }

  markChekiRows_(sheet, control, rows, "反映中", "", "", "");
  let response;
  try {
    response = callChekiImportFunction_({
      spreadsheetId: SpreadsheetApp.getActive().getId(),
      sheetId: String(sheet.getSheetId()),
      sheetName: sheet.getName(),
      rows,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    markChekiRows_(sheet, control, rows, "エラー", "", "", message);
    ui.alert(message);
    return;
  }

  if (!response.ok) {
    markChekiRows_(sheet, control, rows, "エラー", "", "", response.error || response.detail || "unknown_error");
    ui.alert(`反映に失敗しました: ${response.error || response.detail || "unknown_error"}`);
    return;
  }

  const resultByUid = new Map((response.rows || []).map((row) => [row.rowUid, row]));
  rows.forEach((row) => {
    const result = resultByUid.get(row.rowUid);
    const rowNumber = row.rowNumber;
    sheet.getRange(rowNumber, control.statusColumn).setValue(result ? "反映済み" : "未反映");
    sheet.getRange(rowNumber, control.syncedAtColumn).setValue(new Date());
    sheet.getRange(rowNumber, control.recruitmentIdColumn).setValue(result ? result.recruitmentId : "");
    sheet.getRange(rowNumber, control.slotIdColumn).setValue(result ? result.slotId : "");
    sheet.getRange(rowNumber, control.errorColumn).setValue(result ? "" : "response_not_found");
  });

  ui.alert(`${response.importedRows || rows.length}行を反映しました。`);
}

function readChekiRow_(sheet, rowNumber, uidColumn) {
  const eventName = cellText_(sheet.getRange(rowNumber, CHEKI_BASE_COLUMNS.eventName).getValue());
  const eventDate = dateText_(sheet.getRange(rowNumber, CHEKI_BASE_COLUMNS.eventDate).getValue());
  const groupName = cellText_(sheet.getRange(rowNumber, CHEKI_BASE_COLUMNS.groupName).getValue());
  if (!eventName || !eventDate || !groupName || eventName === "イベント名") return null;

  let rowUid = cellText_(sheet.getRange(rowNumber, uidColumn).getValue());
  if (!rowUid) {
    rowUid = Utilities.getUuid();
    sheet.getRange(rowNumber, uidColumn).setValue(rowUid);
  }

  return {
    rowNumber,
    rowUid,
    eventName,
    eventDate,
    groupName,
    staffName: cellText_(sheet.getRange(rowNumber, CHEKI_BASE_COLUMNS.staffName).getValue()),
    status: cellText_(sheet.getRange(rowNumber, CHEKI_BASE_COLUMNS.status).getValue()),
    employeeName: cellText_(sheet.getRange(rowNumber, CHEKI_BASE_COLUMNS.employeeName).getValue()),
    liveType: cellText_(sheet.getRange(rowNumber, CHEKI_BASE_COLUMNS.liveType).getValue()),
    venue: cellText_(sheet.getRange(rowNumber, CHEKI_BASE_COLUMNS.venue).getValue()),
  };
}

function expandChekiRowNumbersByLive_(sheet, rowNumbers) {
  const selectedKeys = new Set(rowNumbers.map((rowNumber) => chekiLiveKeyFromRow_(sheet, rowNumber)).filter(Boolean));
  if (selectedKeys.size === 0) return rowNumbers;

  const expanded = new Set(rowNumbers);
  const lastRow = sheet.getLastRow();
  for (let rowNumber = 2; rowNumber <= lastRow; rowNumber += 1) {
    if (selectedKeys.has(chekiLiveKeyFromRow_(sheet, rowNumber))) {
      expanded.add(rowNumber);
    }
  }
  return Array.from(expanded).sort((a, b) => a - b);
}

function chekiLiveKeyFromRow_(sheet, rowNumber) {
  const eventName = cellText_(sheet.getRange(rowNumber, CHEKI_BASE_COLUMNS.eventName).getValue());
  const eventDate = dateText_(sheet.getRange(rowNumber, CHEKI_BASE_COLUMNS.eventDate).getValue());
  const groupName = cellText_(sheet.getRange(rowNumber, CHEKI_BASE_COLUMNS.groupName).getValue());
  const liveType = cellText_(sheet.getRange(rowNumber, CHEKI_BASE_COLUMNS.liveType).getValue());
  const venue = cellText_(sheet.getRange(rowNumber, CHEKI_BASE_COLUMNS.venue).getValue());
  if (!eventName || !eventDate || !groupName || eventName === "イベント名") return "";
  return [groupName, eventDate, eventName, venue, liveType].join("|");
}

function ensureChekiControlColumns_(sheet) {
  const headerValues = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0].map(String);
  let lastColumn = headerValues.length;
  CHEKI_CONTROL_HEADERS.forEach((header) => {
    if (!headerValues.includes(header)) {
      lastColumn += 1;
      sheet.getRange(1, lastColumn).setValue(header);
      headerValues.push(header);
    }
  });

  const nextHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  return {
    uidColumn: nextHeaders.indexOf("row_uid") + 1,
    statusColumn: nextHeaders.indexOf("反映状態") + 1,
    syncedAtColumn: nextHeaders.indexOf("反映日時") + 1,
    recruitmentIdColumn: nextHeaders.indexOf("アプリ募集ID") + 1,
    slotIdColumn: nextHeaders.indexOf("アプリ枠ID") + 1,
    errorColumn: nextHeaders.indexOf("エラー内容") + 1,
  };
}

function markChekiRows_(sheet, control, rows, status, recruitmentId, slotId, error) {
  rows.forEach((row) => {
    sheet.getRange(row.rowNumber, control.statusColumn).setValue(status);
    sheet.getRange(row.rowNumber, control.syncedAtColumn).setValue(new Date());
    sheet.getRange(row.rowNumber, control.recruitmentIdColumn).setValue(recruitmentId);
    sheet.getRange(row.rowNumber, control.slotIdColumn).setValue(slotId);
    sheet.getRange(row.rowNumber, control.errorColumn).setValue(error);
  });
}

function callChekiImportFunction_(body) {
  const properties = PropertiesService.getScriptProperties();
  const functionUrl = properties.getProperty(CHEKI_SYNC_FUNCTION_URL_PROPERTY);
  const token = properties.getProperty(CHEKI_SYNC_TOKEN_PROPERTY);
  if (!functionUrl || !token) {
    throw new Error("初期設定が未完了です。メニューの「初期設定」を実行してください。");
  }

  const response = UrlFetchApp.fetch(functionUrl, {
    method: "post",
    contentType: "application/json",
    headers: {
      "x-sheet-sync-token": token,
    },
    muteHttpExceptions: true,
    payload: JSON.stringify(body),
  });
  const text = response.getContentText();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (error) {
    data = { detail: text || String(error) };
  }
  if (response.getResponseCode() >= 400) {
    return {
      ok: false,
      error: data.error || `http_${response.getResponseCode()}`,
      detail: data.detail || text,
    };
  }
  return data;
}

function cellText_(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function dateText_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !Number.isNaN(value.getTime())) {
    return Utilities.formatDate(value, CHEKI_SYNC_TIMEZONE, "yyyy-MM-dd");
  }
  return cellText_(value);
}
