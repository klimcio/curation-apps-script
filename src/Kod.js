const CURATED_API_URL = "https://api.curated.co/api/v3/publications";
const TOKEN_PROPERTY = "CURATED_API_TOKEN";
const PUBLICATION_ID_PROPERTY = "CURATED_PUBLICATION_ID";
const PHASE2_STATUS = "Phase 2";
const CURATION_STATUS = "Curation";
const PUBLISHED_STATUS = "Published";

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
  PUBLISHED_DATE: 10,
};
const HEADER_ROW = 1;
const DATA_START_ROW = 2;

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("Curated")
    .addItem("Set API Token", "setCuratedApiToken")
    .addItem("Fetch Publications", "fetchPublications")
    .addItem("Open Phase 1 Curation", "openPhase1Form")
    .addItem("Open Phase 2 Curation", "openPhase2Form")
    .addItem("Set Publication ID", "selectPublication")
    .addItem("Publish to Curated", "publishToCurated")
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
    return { item: null, remaining: 0 };
  }

  const numRows = lastRow - DATA_START_ROW + 1;
  const statuses = sheet.getRange(DATA_START_ROW, COL.STATUS, numRows, 1).getValues();

  let remaining = 0;
  let first = null;

  for (let i = 0; i < statuses.length; i++) {
    const row = DATA_START_ROW + i;
    if (String(statuses[i][0] ?? "").trim() !== "") {
      continue;
    }

    const values = sheet.getRange(row, 1, 1, 9).getValues()[0];
    if (values.every((value) => String(value ?? "").trim() === "")) {
      continue;
    }

    remaining++;
    if (!first) {
      first = {
        row: row,
        oldTitle: String(values[COL.OLD_TITLE - 1] ?? ""),
        newTitle: cleanNewTitle_(values[COL.NEW_TITLE - 1]),
        notes: String(values[COL.NOTES - 1] ?? ""),
        url: String(values[COL.URL - 1] ?? ""),
        source: String(values[COL.SOURCE - 1] ?? ""),
      };
    }
  }

  return { item: first, remaining: remaining };
}

function assertPhase1Pending_(sheet, row) {
  const current = String(sheet.getRange(row, COL.STATUS).getValue() ?? "").trim();
  if (current !== "") {
    throw new Error(`Row ${row} already has Status "${current}". Reloading next item.`);
  }
}

function cleanNewTitle_(raw) {
  const value = String(raw ?? "").trim();
  return value.toLowerCase().startsWith("en:::")
    ? value.slice(5).trim()
    : value;
}

function markPhase1Curated(row) {
  const sheet = SpreadsheetApp.getActiveSheet();
  assertPhase1Pending_(sheet, row);
  const rawTitle = String(sheet.getRange(row, COL.NEW_TITLE).getValue() ?? "");
  sheet.getRange(row, COL.NEW_TITLE).setValue(cleanNewTitle_(rawTitle));
  sheet.getRange(row, COL.STATUS).setValue(PHASE2_STATUS);
  return getNextPhase1Item();
}

function deletePhase1Row(row) {
  const sheet = SpreadsheetApp.getActiveSheet();
  assertPhase1Pending_(sheet, row);
  sheet.deleteRow(row);
  return getNextPhase1Item();
}

const TARGET_CATEGORIES = [
  "Godot-News",
  "GodotCon",
  "Resources",
  "Assets",
  "Tutorials",
  "Plugins",
  "ProTips",
  "Project-Templates",
  "Showcases",
  "Miscellanous",
  "Shaders",
];

function openPhase2Form() {
  const html = HtmlService.createTemplateFromFile("Phase2Form")
    .evaluate()
    .setWidth(680)
    .setHeight(540);
  SpreadsheetApp.getUi().showModalDialog(html, "Phase 2 — Weekly Curation");
}

function getNextPhase2Item() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < DATA_START_ROW) {
    return null;
  }

  const numRows = lastRow - DATA_START_ROW + 1;
  const statuses = sheet.getRange(DATA_START_ROW, COL.STATUS, numRows, 1).getValues();

  for (let i = 0; i < statuses.length; i++) {
    const row = DATA_START_ROW + i;
    if (String(statuses[i][0] ?? "").trim() !== PHASE2_STATUS) {
      continue;
    }

    const values = sheet.getRange(row, 1, 1, 9).getValues()[0];
    return {
      row: row,
      oldTitle: String(values[COL.OLD_TITLE - 1] ?? ""),
      newTitle: cleanNewTitle_(values[COL.NEW_TITLE - 1]),
      notes: String(values[COL.NOTES - 1] ?? ""),
      url: String(values[COL.URL - 1] ?? ""),
      source: String(values[COL.SOURCE - 1] ?? ""),
      targetCategory: String(values[COL.TARGET_CATEGORY - 1] ?? ""),
    };
  }

  return null;
}

function assertPhase2Pending_(sheet, row) {
  const current = String(sheet.getRange(row, COL.STATUS).getValue() ?? "").trim();
  if (current !== PHASE2_STATUS) {
    throw new Error(`Row ${row} has Status "${current}", expected "${PHASE2_STATUS}". Reloading next item.`);
  }
}

function markPhase2Curation(row, editedTitle, editedNewUrl, editedCategory) {
  const sheet = SpreadsheetApp.getActiveSheet();
  assertPhase2Pending_(sheet, row);
  sheet.getRange(row, COL.NEW_TITLE).setValue(editedTitle);
  sheet.getRange(row, COL.NEW_URL).setValue(editedNewUrl);
  sheet.getRange(row, COL.TARGET_CATEGORY).setValue(editedCategory);
  sheet.getRange(row, COL.STATUS).setValue(CURATION_STATUS);
}

function deletePhase2Row(row) {
  const sheet = SpreadsheetApp.getActiveSheet();
  assertPhase2Pending_(sheet, row);
  sheet.deleteRow(row);
}

function ensurePublishedDateHeader_() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const header = String(sheet.getRange(1, COL.PUBLISHED_DATE).getValue() ?? "").trim();
  if (header === "") {
    sheet.getRange(1, COL.PUBLISHED_DATE).setValue("Published Date");
  }
}

function selectPublication() {
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
    const publications = JSON.parse(response.getContentText());
    const target = publications.find((p) => p.name === "Godot Weekly");
    if (!target) {
      throw new Error("Publication 'Godot Weekly' not found.");
    }
    PropertiesService.getScriptProperties().setProperty(PUBLICATION_ID_PROPERTY, String(target.id));
    SpreadsheetApp.getUi().alert("Publication set:\n" + target.name + " (ID: " + target.id + ")");
  } catch (error) {
    console.error("Failed to select publication:", error);
    throw error;
  }
}

function publishToCurated() {
  const token = PropertiesService.getScriptProperties().getProperty(TOKEN_PROPERTY);
  if (!token) {
    throw new Error("API token not set. Use the 'Set API Token' menu item first.");
  }

  const pubId = PropertiesService.getScriptProperties().getProperty(PUBLICATION_ID_PROPERTY);
  if (!pubId) {
    throw new Error("Publication ID not set. Use the 'Set Publication ID' menu item first.");
  }

  const html = HtmlService.createTemplateFromFile("PublishProgress")
    .evaluate()
    .setWidth(700)
    .setHeight(500);
  SpreadsheetApp.getUi().showModalDialog(html, "Publish to Curated");
}

function getYouTubeVideoId_(url) {
  try {
    if (!url) return null;
    const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (watchMatch) return watchMatch[1];
    const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (shortMatch) return shortMatch[1];
    const embedMatch = url.match(/youtube\.com\/(?:embed|shorts)\/([a-zA-Z0-9_-]{11})/);
    if (embedMatch) return embedMatch[1];
  } catch (e) {}
  return null;
}

function extractYouTubeThumbnail_(url) {
  const videoId = getYouTubeVideoId_(url);
  if (!videoId) return null;
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}

function getLinksToPublish() {
  ensurePublishedDateHeader_();

  const sheet = SpreadsheetApp.getActiveSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < DATA_START_ROW) {
    return { links: [], skipped: [] };
  }

  const numRows = lastRow - DATA_START_ROW + 1;
  const statuses = sheet.getRange(DATA_START_ROW, COL.STATUS, numRows, 1).getValues();

  const links = [];
  const skipped = [];

  for (let i = 0; i < statuses.length; i++) {
    const row = DATA_START_ROW + i;
    if (String(statuses[i][0] ?? "").trim() !== CURATION_STATUS) {
      continue;
    }

    const values = sheet.getRange(row, 1, 1, 10).getValues()[0];
    const newTitle = cleanNewTitle_(values[COL.NEW_TITLE - 1]);
    const oldTitle = String(values[COL.OLD_TITLE - 1] ?? "");
    const title = newTitle || oldTitle;

    const newUrl = String(values[COL.NEW_URL - 1] ?? "").trim();
    const oldUrl = String(values[COL.URL - 1] ?? "").trim();
    const url = newUrl || oldUrl;

    const category = String(values[COL.TARGET_CATEGORY - 1] ?? "").trim().toLowerCase();

    if (!url) {
      skipped.push({ title: title || "(no title)", reason: "No URL set" });
      console.warn(`Skipped: "${title}" — no URL set`);
      continue;
    }
    if (!category) {
      skipped.push({ title: title || "(no title)", reason: "No category set" });
      console.warn(`Skipped: "${title}" — no category set`);
      continue;
    }

    const image = extractYouTubeThumbnail_(url);
    links.push({ row, title, url, category, image });
  }

  return { links, skipped };
}

function postLinkToCurated(link) {
  const token = PropertiesService.getScriptProperties().getProperty(TOKEN_PROPERTY);
  const pubId = PropertiesService.getScriptProperties().getProperty(PUBLICATION_ID_PROPERTY);

  const params = [];
  params.push(`url=${encodeURIComponent(link.url)}`);
  params.push(`title=${encodeURIComponent(link.title)}`);
  if (link.category) {
    params.push(`category=${encodeURIComponent(link.category)}`);
  }
  if (link.image) {
    params.push(`image=${encodeURIComponent(link.image)}`);
  }

  const apiUrl = `${CURATED_API_URL}/${pubId}/links?${params.join("&")}`;

  console.log(`POST ${apiUrl}`);

  try {
    const response = UrlFetchApp.fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Token token="${token}"`,
        "Content-Type": "application/json",
      },
      muteHttpExceptions: true,
    });

    const code = response.getResponseCode();
    const body = response.getContentText();
    console.log(`Response ${code}: ${body.substring(0, 200)}`);

    if (code >= 200 && code < 300) {
      let data;
      try {
        data = JSON.parse(body);
      } catch (parseErr) {
        return { success: false, httpCode: code, error: "Invalid JSON response: " + body.substring(0, 100) };
      }
      return { success: true, httpCode: code, linkId: data.id };
    } else {
      let errorMsg;
      try {
        const errData = JSON.parse(body);
        errorMsg = errData.error || errData.message || errData.errors || body.substring(0, 200);
        if (typeof errorMsg === "object") errorMsg = JSON.stringify(errorMsg);
      } catch (_) {
        errorMsg = body.substring(0, 200);
      }
      return { success: false, httpCode: code, error: errorMsg };
    }
  } catch (err) {
    console.error("postLinkToCurated_ failed:", err);
    return { success: false, httpCode: 0, error: err.message };
  }
}

function markRowPublished(row) {
  const sheet = SpreadsheetApp.getActiveSheet();
  sheet.getRange(row, COL.STATUS).setValue(PUBLISHED_STATUS);
  sheet.getRange(row, COL.PUBLISHED_DATE).setValue(new Date());
}
