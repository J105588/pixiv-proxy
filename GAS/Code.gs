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
        const cache = CacheService.getScriptCache();
        let htmlText = cache.get("index_html");
        
        if (!htmlText) {
            try {
                const response = UrlFetchApp.fetch(baseUrl + "/index.html");
                htmlText = response.getContentText();
                
                // GAS Web App の公開URLを動的に取得してHTML内に埋め込む
                const webAppUrl = ScriptApp.getService().getUrl();
                htmlText = htmlText.replace(
                    /const GAS_URL\s*=\s*isGas\s*\?\s*window\.location\.href\.split\('\?'\)\[0\]\s*:\s*'';/, 
                    `const GAS_URL = "${webAppUrl}";`
                );
                
                // スクリプトキャッシュに最大6時間保存
                cache.put("index_html", htmlText, 21600);
            } catch (e) {
                console.error("Failed to fetch or inject Web App URL:", e.message);
                if (!htmlText) {
                    return HtmlService.createHtmlOutput("<p>システム一時エラー。しばらく経ってから再読み込みしてください。</p>");
                }
            }
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

function searchIllustOrNovel(apiType, word, page, s_mode, order) {
    const baseUrl = VERCEL_BASE_URL.replace(/\/$/, "");
    const url = `${baseUrl}/api?type=${apiType}&word=${encodeURIComponent(word)}&p=${page || 1}&s_mode=${s_mode || ''}&order=${order || ''}`;
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    return response.getContentText();
}

function searchUsers(word, page) {
    const baseUrl = VERCEL_BASE_URL.replace(/\/$/, "");
    const url = `${baseUrl}/api?type=search_user&word=${encodeURIComponent(word)}&p=${page || 1}`;
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    return response.getContentText();
}

function getUserDetail(userId) {
    const baseUrl = VERCEL_BASE_URL.replace(/\/$/, "");
    const response = UrlFetchApp.fetch(`${baseUrl}/api?type=user_detail&id=${userId}`, { muteHttpExceptions: true });
    return response.getContentText();
}

function getUserIllusts(userId, page) {
    const baseUrl = VERCEL_BASE_URL.replace(/\/$/, "");
    const response = UrlFetchApp.fetch(`${baseUrl}/api?type=user_illusts&id=${userId}&p=${page || 1}`, { muteHttpExceptions: true });
    return response.getContentText();
}

function getIllustPages(illustId) {
    const baseUrl = VERCEL_BASE_URL.replace(/\/$/, "");
    const response = UrlFetchApp.fetch(`${baseUrl}/api?type=illust_pages&id=${illustId}`, { muteHttpExceptions: true });
    return response.getContentText();
}

function getRecommendedNovels() {
    const baseUrl = VERCEL_BASE_URL.replace(/\/$/, "");
    const response = UrlFetchApp.fetch(`${baseUrl}/api?type=recommended_novel`, { muteHttpExceptions: true });
    return response.getContentText();
}

function getUserNovels(userId, page) {
    const baseUrl = VERCEL_BASE_URL.replace(/\/$/, "");
    const response = UrlFetchApp.fetch(`${baseUrl}/api?type=user_novels&id=${userId}&p=${page || 1}`, { muteHttpExceptions: true });
    return response.getContentText();
}

function getRelatedIllusts(illustId) {
    const baseUrl = VERCEL_BASE_URL.replace(/\/$/, "");
    const response = UrlFetchApp.fetch(`${baseUrl}/api?type=related_illusts&id=${illustId}`, { muteHttpExceptions: true });
    return response.getContentText();
}

function getRelatedNovels(novelId) {
    const baseUrl = VERCEL_BASE_URL.replace(/\/$/, "");
    const response = UrlFetchApp.fetch(`${baseUrl}/api?type=related_novels&id=${novelId}`, { muteHttpExceptions: true });
    return response.getContentText();
}

function getNovelText(id) {
    const baseUrl = VERCEL_BASE_URL.replace(/\/$/, "");
    const response = UrlFetchApp.fetch(`${baseUrl}/api?type=novel_text&id=${id}`, { muteHttpExceptions: true });
    return response.getContentText();
}

function getImageBase64(imageUrl) {
    try {
        const response = UrlFetchApp.fetch(imageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.pixiv.net/'
            },
            muteHttpExceptions: true
        });
        const code = response.getResponseCode();
        if (code >= 400) {
            return JSON.stringify({ error: `Pixiv error ${code}` });
        }
        const blob = response.getBlob();
        const base64 = Utilities.base64Encode(blob.getBytes());
        const contentType = response.getHeaders()['Content-Type'] || response.getHeaders()['content-type'] || 'image/jpeg';
        return JSON.stringify({ contentType: contentType, base64: base64 });
    } catch (e) {
        return JSON.stringify({ error: e.message });
    }
}