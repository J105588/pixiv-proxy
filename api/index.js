import axios from 'axios';

export default async function handler(req, res) {
    // CORS解放
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { type, id, url, word, mode } = req.query;

    // Vercelの環境変数から2つのトークンを読み込む
    const phpSessId = process.env.PIXIV_PHPSESSID;
    const deviceToken = process.env.PIXIV_DEVICE_TOKEN;

    if (!phpSessId || !deviceToken) {
        return res.status(500).json({
            error: 'Vercelの環境変数 PIXIV_PHPSESSID または PIXIV_DEVICE_TOKEN が設定されていません。'
        });
    }

    // PHPSESSID と device_token をセットで送り、ログイン維持能力を最大化
    const appApiHeaders = {
        'User-Agent': 'PixivAndroidApp/5.0.234',
        'Cookie': `PHPSESSID=${phpSessId}; device_token=${deviceToken}`,
        'Accept-Language': 'ja-jp',
        'Referer': 'https://www.pixiv.net/'
    };

    try {
        // 1. 插画・漫画検索
        if (type === 'search_illust') {
            const response = await axios.get(`https://app-api.pixiv.net/v1/search/illust?word=${encodeURIComponent(word)}&search_target=partial_match_for_tags&sort=date_desc`, {
                headers: appApiHeaders
            });
            return res.status(200).json(response.data);
        }

        // 2. 小説検索
        if (type === 'search_novel') {
            const response = await axios.get(`https://app-api.pixiv.net/v1/search/novel?word=${encodeURIComponent(word)}&search_target=partial_match_for_tags&sort=date_desc`, {
                headers: appApiHeaders
            });
            return res.status(200).json(response.data);
        }

        // 3. ランキング
        if (type === 'ranking') {
            const targetMode = mode || 'day';
            const response = await axios.get(`https://app-api.pixiv.net/v1/illust/ranking?mode=${targetMode}`, {
                headers: appApiHeaders
            });
            return res.status(200).json(response.data);
        }

        // 4. おすすめ
        if (type === 'recommended') {
            const response = await axios.get(`https://app-api.pixiv.net/v1/illust/recommended?content_type=illust`, {
                headers: appApiHeaders
            });
            return res.status(200).json(response.data);
        }

        // 5. 小説本文
        if (type === 'novel_text') {
            const response = await axios.get(`https://app-api.pixiv.net/v1/novel/text?novel_id=${id}`, {
                headers: appApiHeaders
            });
            return res.status(200).json(response.data);
        }

        // 6. 画像バイナリ中継
        if (type === 'image') {
            if (!url) return res.status(400).json({ error: 'url パラメータが必要です。' });
            const response = await axios.get(url, {
                headers: appApiHeaders,
                responseType: 'arraybuffer'
            });
            res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
            return res.status(200).send(Buffer.from(response.data));
        }

        return res.status(400).json({ error: '不正な type です。' });

    } catch (error) {
        console.error(error.message);
        return res.status(500).json({
            error: 'Pixiv API通信エラー',
            details: error.response ? JSON.stringify(error.response.data) : error.message
        });
    }
}