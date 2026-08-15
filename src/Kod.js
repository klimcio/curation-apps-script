const CURATED_API_URL = "https://api.curated.co/api/v3/publications";
const TOKEN_PROPERTY = "CURATED_API_TOKEN";
const PHASE2_STATUS = "Phase 2";

const COL = {
  OLD_TITLE: 1,
  NEW_TITLE: 2,
  NOTES: 3,
  URL: 4,
  NEW_URL: 5,
  SOURCE: 6,
  TARGET_CATEGORY: 7,
  STATUS: 8,
  ADDED_DATE: 9,
};
const HEADER_ROW = 1;
const DATA_START_ROW = 2;

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("Curated")
    .addItem("Set API Token", "setCuratedApiToken")
    .addItem("Fetch Publications", "fetchPublications")
    .addItem("Open Phase 1 Curation", "openPhase1Form")
    .addToUi();
}

function setCuratedApiToken() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    "Curated API Token",
    "Paste your token:",
    ui.ButtonSet.OK_CANCEL
  );
  if (response.getSelectedButton() === ui.Button.OK) {
    const token = response.getResponseText().trim();
    PropertiesService.getScriptProperties().setProperty(TOKEN_PROPERTY, token);
    ui.alert("Token saved.");
  }
}

function fetchPublications() {
  const token = PropertiesService.getScriptProperties().getProperty(TOKEN_PROPERTY);
  if (!token) {
    throw new Error("API token not set. Use the 'Set API Token' menu item first.");
  }

  try {
    const response = UrlFetchApp.fetch(CURATED_API_URL, {
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Token token="${token}"`,
      },
    });
    const data = JSON.parse(response.getContentText());
    console.log(data);
    showJsonDialog_(data);
  } catch (error) {
    console.error("Failed to fetch publications:", error);
    throw error;
  }
}

function showJsonDialog_(data) {
  const template = HtmlService.createTemplateFromFile("Viewer");
  template.json = JSON.stringify(data, null, 2);
  const html = template.evaluate().setWidth(720).setHeight(520);
  SpreadsheetApp.getUi().showModalDialog(html, "Publications (JSON)");
}

function openPhase1Form() {
  const html = HtmlService.createTemplateFromFile("Phase1Form")
    .evaluate()
    .setWidth(680)
    .setHeight(500);
  SpreadsheetApp.getUi().showModalDialog(html, "Phase 1 — Daily Curation");
}

function getNextPhase1Item() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < DATA_START_ROW) {
    return null;
  }

  const numRows = lastRow - DATA_START_ROW + 1;
  const statuses = sheet.getRange(DATA_START_ROW, COL.STATUS, numRows, 1).getValues();

  for (let i = 0; i < statuses.length; i++) {
    const row = DATA_START_ROW + i;
    if (String(statuses[i][0] ?? "").trim() !== "") {
      continue;
    }

    const values = sheet.getRange(row, 1, 1, 9).getValues()[0];
    if (values.every((value) => String(value ?? "").trim() === "")) {
      continue;
    }

    return {
      row: row,
      oldTitle: String(values[COL.OLD_TITLE - 1] ?? ""),
      newTitle: String(values[COL.NEW_TITLE - 1] ?? ""),
      notes: String(values[COL.NOTES - 1] ?? ""),
      url: String(values[COL.URL - 1] ?? ""),
      source: String(values[COL.SOURCE - 1] ?? ""),
    };
  }

  return null;
}

function assertPhase1Pending_(sheet, row) {
  const current = String(sheet.getRange(row, COL.STATUS).getValue() ?? "").trim();
  if (current !== "") {
    throw new Error(`Row ${row} already has Status "${current}". Reloading next item.`);
  }
}

function markPhase1Curated(row) {
  const sheet = SpreadsheetApp.getActiveSheet();
  assertPhase1Pending_(sheet, row);
  sheet.getRange(row, COL.STATUS).setValue(PHASE2_STATUS);
}

function deletePhase1Row(row) {
  const sheet = SpreadsheetApp.getActiveSheet();
  assertPhase1Pending_(sheet, row);
  sheet.deleteRow(row);
}
