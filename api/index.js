import axios from 'axios';

// refresh_tokenを使って有効期限1時間のaccess_tokenを再生成する
async function getPixivAccessToken(refreshToken) {
    const response = await axios.post('https://oauth.secure.pixiv.net/auth/token', new URLSearchParams({
        client_id: 'MOBrBmqYJNYCqaaamG7ubg', // Pixiv公式アプリの固定クライアントID
        client_secret: 'lsACTRACNY9teS9vN96tcyg',
        grant_type: 'refresh_token',
        refresh_token: refreshToken
    }).toString(), {
        headers: {
            'User-Agent': 'PixivAndroidApp/5.0.234',
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });
    return response.data.response.access_token;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { type, id, url, word, page } = req.query;
    const refreshToken = process.env.PIXIV_REFRESH_TOKEN;

    if (!refreshToken) {
        return res.status(500).json({ error: 'Vercelの環境変数 PIXIV_REFRESH_TOKEN が設定されていません。' });
    }

    try {
        const accessToken = await getPixivAccessToken(refreshToken);
        const offset = page ? (parseInt(page) - 1) * 30 : 0;

        // 1. イラスト・マンガ検索
        if (type === 'search_illust') {
            const response = await axios.get(`https://app-api.pixiv.net/v1/search/illust?word=${encodeURIComponent(word)}&search_target=partial_match_for_tags&offset=${offset}`, {
                headers: {
                    'User-Agent': 'PixivAndroidApp/5.0.234',
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept-Language': 'ja-jp'
                }
            });
            return res.status(200).json(response.data);
        }

        // 2. 小説検索
        if (type === 'search_novel') {
            const response = await axios.get(`https://app-api.pixiv.net/v1/search/novel?word=${encodeURIComponent(word)}&search_target=partial_match_for_tags&offset=${offset}`, {
                headers: {
                    'User-Agent': 'PixivAndroidApp/5.0.234',
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept-Language': 'ja-jp'
                }
            });
            return res.status(200).json(response.data);
        }

        // 3. 小説本文の取得
        if (type === 'novel_text') {
            const response = await axios.get(`https://app-api.pixiv.net/v1/novel/text?novel_id=${id}`, {
                headers: {
                    'User-Agent': 'PixivAndroidApp/5.0.234',
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept-Language': 'ja-jp'
                }
            });
            return res.status(200).json(response.data);
        }

        // 4. 画像バイナリの取得と中継
        if (type === 'image') {
            if (!url) return res.status(400).json({ error: 'url パラメータが必要です。' });
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'PixivAndroidApp/5.0.234',
                    'Authorization': `Bearer ${accessToken}`,
                    'Referer': 'https://www.pixiv.net/'
                },
                responseType: 'arraybuffer'
            });
            res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
            return res.status(200).send(Buffer.from(response.data));
        }

        return res.status(400).json({ error: '不正な type です。' });

    } catch (error) {
        return res.status(500).json({ error: 'Pixiv通信エラー', details: error.response ? error.response.data : error.message });
    }
}