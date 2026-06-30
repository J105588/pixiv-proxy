const VERCEL_BASE_URL = "https://あなたのプロジェクト名.vercel.app";

function doGet(e) {
    const type = e.parameter.type;
    const apiType = e.parameter.apiType;
    const word = e.parameter.word;
    const id = e.parameter.id;
    const imageUrl = e.parameter.url;
    const mode = e.parameter.mode;

    // 1. トップページのレンダリング
    if (!type) {
        const response = UrlFetchApp.fetch(VERCEL_BASE_URL + "/index.html");
        return HtmlService.createHtmlOutput(response.getContentText())
            .setTitle("pixiv Portal")
            .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
            .addMetaTag('viewport', 'width=device-width, initial-scale=1');
    }

    // 2. イラスト/小説の検索
    if (type === 'search') {
        const vercelUrl = `${VERCEL_BASE_URL}/api?type=${apiType}&word=${encodeURIComponent(word)}`;
        const response = UrlFetchApp.fetch(vercelUrl, { muteHttpExceptions: true });
        return ContentService.createTextOutput(response.getContentText()).setMimeType(ContentService.MimeType.JSON);
    }

    // 3. ランキング / おすすめ データの横流し (AppAPI直撃モード)
    if (type === 'custom') {
        const vercelUrl = `${VERCEL_BASE_URL}/api?type=${apiType}&mode=${mode || ''}`;
        const response = UrlFetchApp.fetch(vercelUrl, { muteHttpExceptions: true });
        return ContentService.createTextOutput(response.getContentText()).setMimeType(ContentService.MimeType.JSON);
    }

    // 4. 小説本文の取得
    if (type === 'novel_body') {
        const vercelUrl = `${VERCEL_BASE_URL}/api?type=novel_text&id=${id}`;
        const response = UrlFetchApp.fetch(vercelUrl, { muteHttpExceptions: true });
        return ContentService.createTextOutput(response.getContentText()).setMimeType(ContentService.MimeType.JSON);
    }

    // 5. 画像バイナリ中継
    if (type === 'image') {
        const vercelUrl = `${VERCEL_BASE_URL}/api?type=image&url=${encodeURIComponent(imageUrl)}`;
        const response = UrlFetchApp.fetch(vercelUrl, { muteHttpExceptions: true });
        return response.getBlob();
    }

    return ContentService.createTextOutput(JSON.stringify({ error: "Invalid Request" })).setMimeType(ContentService.MimeType.JSON);
}