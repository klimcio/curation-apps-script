const CURATED_API_URL = "https://api.curated.co/api/v3/publications";
const TOKEN_PROPERTY = "CURATED_API_TOKEN";

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("Curated")
    .addItem("Set API Token", "setCuratedApiToken")
    .addItem("Fetch Publications", "fetchPublications")
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
    console.log(JSON.parse(response.getContentText()));
  } catch (error) {
    console.error("Failed to fetch publications:", error);
    throw error;
  }
}
