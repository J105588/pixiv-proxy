const VERCEL_BASE_URL = "https://pixiv-proxy-puce.vercel.app";
const BASE_URL = VERCEL_BASE_URL.replace(/\/$/, "");

const jsonOut = obj => ContentService.createTextOutput(typeof obj === 'string' ? obj : JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);

function fetchFromVercel(url) {
  let text;
  try {
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const code = res.getResponseCode();
    text = res.getContentText();
    if (code >= 400) return jsonOut({ error: `Vercel API returned status ${code}`, url, body: text.substring(0, 1000) });
    JSON.parse(text);
    return jsonOut(text);
  } catch (e) {
    return jsonOut(text !== undefined 
      ? { error: "Vercel API returned non-JSON content", url, body: text.substring(0, 1000) }
      : { error: "GAS UrlFetchApp failed", url, message: e.message }
    );
  }
}

function doGet(e) {
  const { type, apiType, word, id, url, mode } = e.parameter;
  if (!type) {
    let html = UrlFetchApp.fetch(`${BASE_URL}/index.html`).getContentText();
    try {
      html = html.replace(
        /const GAS_URL\s*=\s*isGas\s*\?\s*window\.location\.href\.split\('\?'\)\[0\]\s*:\s*'';/,
        `const GAS_URL = "${ScriptApp.getService().getUrl()}";`
      );
    } catch (err) {
      console.error("Failed to get or inject Web App URL:", err.message);
    }
    return HtmlService.createHtmlOutput(html)
      .setTitle("pixiv Portal")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  if (type === 'search') return fetchFromVercel(`${BASE_URL}/api?type=${apiType}&word=${encodeURIComponent(word)}`);
  if (type === 'custom') return fetchFromVercel(`${BASE_URL}/api?type=${apiType}&mode=${mode || ''}`);
  if (type === 'novel_body') return fetchFromVercel(`${BASE_URL}/api?type=novel_text&id=${id}`);
  if (type === 'image') return jsonOut(getImageBase64(url));
  return jsonOut({ error: "Invalid Request" });
}

// google.script.run Server-Side APIs
const fetchContent = query => UrlFetchApp.fetch(`${BASE_URL}/api?${query}`, { muteHttpExceptions: true }).getContentText();

function getRecommended() { return fetchContent("type=recommended"); }
function getRanking(mode) { return fetchContent(`type=ranking&mode=${mode || ''}`); }
function searchIllustOrNovel(apiType, word, page, s_mode, order) { return fetchContent(`type=${apiType}&word=${encodeURIComponent(word)}&p=${page || 1}&s_mode=${s_mode || ''}&order=${order || ''}`); }
function searchUsers(word, page) { return fetchContent(`type=search_user&word=${encodeURIComponent(word)}&p=${page || 1}`); }
function getUserDetail(userId) { return fetchContent(`type=user_detail&id=${userId}`); }
function getUserIllusts(userId, page) { return fetchContent(`type=user_illusts&id=${userId}&p=${page || 1}`); }
function getIllustPages(illustId) { return fetchContent(`type=illust_pages&id=${illustId}`); }
function getRecommendedNovels() { return fetchContent("type=recommended_novel"); }
function getUserNovels(userId, page) { return fetchContent(`type=user_novels&id=${userId}&p=${page || 1}`); }
function getRelatedIllusts(illustId) { return fetchContent(`type=related_illusts&id=${illustId}`); }
function getRelatedNovels(novelId) { return fetchContent(`type=related_novels&id=${novelId}`); }
function getNovelText(id) { return fetchContent(`type=novel_text&id=${id}`); }

function getImageBase64(imageUrl) {
  try {
    const res = UrlFetchApp.fetch(`${BASE_URL}/api?type=image&url=${encodeURIComponent(imageUrl)}`, { muteHttpExceptions: true });
    if (res.getResponseCode() >= 400) return JSON.stringify({ error: `Vercel error ${res.getResponseCode()}` });
    const headers = res.getHeaders();
    return JSON.stringify({
      contentType: headers['Content-Type'] || headers['content-type'] || 'image/jpeg',
      base64: Utilities.base64Encode(res.getBlob().getBytes())
    });
  } catch (e) {
    return JSON.stringify({ error: e.message });
  }
}