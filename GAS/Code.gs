const VERCEL_BASE_URL = "https://pixiv-proxy-puce.vercel.app";

function fetchFromVercel(url) {
    try {
        const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
        const code = response.getResponseCode();
        const text = response.getContentText();

        if (code >= 400) {
            return ContentService.createTextOutput(JSON.stringify({
                error: `Vercel API returned status ${code}`,
                url: url,
                body: text.substring(0, 1000)
            })).setMimeType(ContentService.MimeType.JSON);
        }

        try {
            JSON.parse(text);
            return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
        } catch (e) {
            return ContentService.createTextOutput(JSON.stringify({
                error: "Vercel API returned non-JSON content",
                url: url,
                body: text.substring(0, 1000)
            })).setMimeType(ContentService.MimeType.JSON);
        }
    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({
            error: "GAS UrlFetchApp failed",
            url: url,
            message: error.message
        })).setMimeType(ContentService.MimeType.JSON);
    }
}

function doGet(e) {
    // 末尾のスラッシュを削除してURLをクリーンにする安全対策
    const baseUrl = VERCEL_BASE_URL.replace(/\/$/, "");

    const type = e.parameter.type;
    const apiType = e.parameter.apiType;
    const word = e.parameter.word;
    const id = e.parameter.id;
    const imageUrl = e.parameter.url;
    const mode = e.parameter.mode;

    // 1. トップページのレンダリング
    if (!type) {
        const response = UrlFetchApp.fetch(baseUrl + "/index.html");
        let htmlText = response.getContentText();
        
        // GAS Web App の公開URLを動的に取得してHTML内に埋め込む
        try {
            const webAppUrl = ScriptApp.getService().getUrl();
            htmlText = htmlText.replace(
                /const GAS_URL\s*=\s*isGas\s*\?\s*window\.location\.href\.split\('\?'\)\[0\]\s*:\s*'';/, 
                `const GAS_URL = "${webAppUrl}";`
            );
        } catch (e) {
            console.error("Failed to get or inject Web App URL:", e.message);
        }
        
        return HtmlService.createHtmlOutput(htmlText)
            .setTitle("pixiv Portal")
            .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
            .addMetaTag('viewport', 'width=device-width, initial-scale=1');
    }

    // 2. イラスト/小説 of 検索
    if (type === 'search') {
        const vercelUrl = `${baseUrl}/api?type=${apiType}&word=${encodeURIComponent(word)}`;
        return fetchFromVercel(vercelUrl);
    }

    // 3. ランキング / おすすめ データの横流し (AppAPI直撃モード)
    if (type === 'custom') {
        const vercelUrl = `${baseUrl}/api?type=${apiType}&mode=${mode || ''}`;
        return fetchFromVercel(vercelUrl);
    }

    // 4. 小説本文の取得
    if (type === 'novel_body') {
        const vercelUrl = `${baseUrl}/api?type=novel_text&id=${id}`;
        return fetchFromVercel(vercelUrl);
    }

    // 5. 画像バイナリをBase64 JSONとして取得
    if (type === 'image') {
        const vercelUrl = `${baseUrl}/api?type=image&url=${encodeURIComponent(imageUrl)}`;
        try {
            const response = UrlFetchApp.fetch(vercelUrl, { muteHttpExceptions: true });
            const code = response.getResponseCode();
            if (code >= 400) {
                return ContentService.createTextOutput(JSON.stringify({ error: `Vercel error ${code}` })).setMimeType(ContentService.MimeType.JSON);
            }
            const blob = response.getBlob();
            const base64 = Utilities.base64Encode(blob.getBytes());
            const contentType = response.getHeaders()['Content-Type'] || response.getHeaders()['content-type'] || 'image/jpeg';
            
            return ContentService.createTextOutput(JSON.stringify({
                contentType: contentType,
                base64: base64
            })).setMimeType(ContentService.MimeType.JSON);
        } catch (e) {
            return ContentService.createTextOutput(JSON.stringify({ error: e.message })).setMimeType(ContentService.MimeType.JSON);
        }
    }

    return ContentService.createTextOutput(JSON.stringify({ error: "Invalid Request" })).setMimeType(ContentService.MimeType.JSON);
}

// ==========================================
// google.script.run から直接呼び出せるサーバーサイドAPI
// ==========================================

function getRecommended() {
    const baseUrl = VERCEL_BASE_URL.replace(/\/$/, "");
    const response = UrlFetchApp.fetch(`${baseUrl}/api?type=recommended`, { muteHttpExceptions: true });
    return response.getContentText();
}

function getRanking(mode) {
    const baseUrl = VERCEL_BASE_URL.replace(/\/$/, "");
    const response = UrlFetchApp.fetch(`${baseUrl}/api?type=ranking&mode=${mode || ''}`, { muteHttpExceptions: true });
    return response.getContentText();
}

function searchIllustOrNovel(apiType, word) {
    const baseUrl = VERCEL_BASE_URL.replace(/\/$/, "");
    const response = UrlFetchApp.fetch(`${baseUrl}/api?type=${apiType}&word=${encodeURIComponent(word)}`, { muteHttpExceptions: true });
    return response.getContentText();
}

function getNovelText(id) {
    const baseUrl = VERCEL_BASE_URL.replace(/\/$/, "");
    const response = UrlFetchApp.fetch(`${baseUrl}/api?type=novel_text&id=${id}`, { muteHttpExceptions: true });
    return response.getContentText();
}

function getImageBase64(imageUrl) {
    const baseUrl = VERCEL_BASE_URL.replace(/\/$/, "");
    try {
        const response = UrlFetchApp.fetch(`${baseUrl}/api?type=image&url=${encodeURIComponent(imageUrl)}`, { muteHttpExceptions: true });
        const code = response.getResponseCode();
        if (code >= 400) {
            return JSON.stringify({ error: `Vercel error ${code}` });
        }
        const blob = response.getBlob();
        const base64 = Utilities.base64Encode(blob.getBytes());
        const contentType = response.getHeaders()['Content-Type'] || response.getHeaders()['content-type'] || 'image/jpeg';
        return JSON.stringify({ contentType: contentType, base64: base64 });
    } catch (e) {
        return JSON.stringify({ error: e.message });
    }
}