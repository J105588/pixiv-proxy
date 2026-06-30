import axios from 'axios';

export default async function handler(req, res) {
    // CORS解放
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { type, id, url, word, mode } = req.query;

    // Vercelの環境変数から PHPSESSID を読み込む
    const phpSessId = process.env.PIXIV_PHPSESSID;

    if (!phpSessId) {
        return res.status(500).json({
            error: 'Vercelの環境変数 PIXIV_PHPSESSID が設定されていません。'
        });
    }

    // Web API用の共通ヘッダー
    const webApiHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Cookie': `PHPSESSID=${phpSessId}`,
        'Accept-Language': 'ja-jp',
        'Referer': 'https://www.pixiv.net/'
    };

    try {
        // 1. 插画・漫画検索
        if (type === 'search_illust') {
            const response = await axios.get(`https://www.pixiv.net/ajax/search/artworks/${encodeURIComponent(word)}?word=${encodeURIComponent(word)}&order=date_d&mode=all&p=1&s_mode=s_tag_full&type=all`, {
                headers: webApiHeaders
            });
            const rawData = response.data.body?.illustManga?.data || [];
            const illusts = rawData.map(item => ({
                id: item.id,
                title: item.title,
                x_restrict: item.xRestrict,
                user: { id: item.userId, name: item.userName },
                image_urls: {
                    square_medium: item.url,
                    large: item.url
                }
            }));
            return res.status(200).json({ illusts });
        }

        // 2. 小説検索
        if (type === 'search_novel') {
            const response = await axios.get(`https://www.pixiv.net/ajax/search/novels/${encodeURIComponent(word)}?word=${encodeURIComponent(word)}&order=date_d&p=1&s_mode=s_tag`, {
                headers: webApiHeaders
            });
            const rawData = response.data.body?.novel?.data || [];
            const novels = rawData.map(item => ({
                id: item.id,
                title: item.title,
                x_restrict: item.xRestrict,
                user: { id: item.userId, name: item.userName },
                image_urls: {
                    large: item.url
                },
                text_length: item.textCount
            }));
            return res.status(200).json({ novels });
        }

        // 3. ランキング
        if (type === 'ranking') {
            const modeMap = {
                'day': 'daily',
                'day_male': 'male',
                'day_female': 'female',
                'day_r18': 'daily_r18',
                'day_male_r18': 'male_r18'
            };
            const targetMode = modeMap[mode] || modeMap['day'];
            const response = await axios.get(`https://www.pixiv.net/ranking.php?mode=${targetMode}&format=json`, {
                headers: webApiHeaders
            });
            const rawData = response.data.contents || [];
            const illusts = rawData.map(item => ({
                id: item.illust_id.toString(),
                title: item.title,
                x_restrict: item.tags?.includes('R-18') ? 1 : 0,
                user: { id: item.user_id.toString(), name: item.user_name },
                image_urls: {
                    square_medium: item.url,
                    large: item.url
                }
            }));
            return res.status(200).json({ illusts });
        }

        // 4. おすすめ
        if (type === 'recommended') {
            const response = await axios.get(`https://www.pixiv.net/ajax/top/illust?mode=all`, {
                headers: webApiHeaders
            });
            const rawData = response.data.body?.thumbnails?.illust || [];
            const illusts = rawData.map(item => ({
                id: item.id,
                title: item.title,
                x_restrict: item.xRestrict,
                user: { id: item.userId, name: item.userName },
                image_urls: {
                    square_medium: item.url,
                    large: item.url
                },
                caption: item.description || ''
            }));
            return res.status(200).json({ illusts });
        }

        // 5. 小説本文
        if (type === 'novel_text') {
            const response = await axios.get(`https://www.pixiv.net/ajax/novel/${id}`, {
                headers: webApiHeaders
            });
            return res.status(200).json({
                novel_text: response.data.body?.content || ''
            });
        }

        // 6. 画像バイナリ中継
        if (type === 'image') {
            if (!url || url === 'undefined' || url === '') return res.status(400).json({ error: 'url パラメータが必要です。' });
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': webApiHeaders['User-Agent'],
                    'Referer': 'https://www.pixiv.net/',
                    'Cookie': webApiHeaders['Cookie']
                },
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