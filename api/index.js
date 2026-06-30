import axios from 'axios';

function getLargeImageUrl(thumbUrl) {
    if (!thumbUrl) return '';
    let large = thumbUrl;
    large = large.replace(/\/c\/[^\/]+/, '');
    large = large.replace('/custom-thumb/', '/img-master/');
    large = large.replace('_custom1200', '_master1200');
    large = large.replace('_square1200', '_master1200');
    return large;
}

export default async function handler(req, res) {
    // CORS解放
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { type, id, url, word, mode, p, s_mode, order } = req.query;

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
            const page = p || 1;
            const sMode = s_mode || 's_tag_full';
            const orderStr = order || 'date_d';
            const url = `https://www.pixiv.net/ajax/search/artworks/${encodeURIComponent(word)}?word=${encodeURIComponent(word)}&order=${orderStr}&mode=all&p=${page}&s_mode=${sMode}&type=all`;
            
            const response = await axios.get(url, {
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
                    large: getLargeImageUrl(item.url)
                },
                tags: item.tags || [],
                page_count: item.pageCount || 1
            }));
            return res.status(200).json({ illusts });
        }

        // 2. 小説検索
        if (type === 'search_novel') {
            const page = p || 1;
            const sMode = s_mode || 's_tag';
            const orderStr = order || 'date_d';
            const url = `https://www.pixiv.net/ajax/search/novels/${encodeURIComponent(word)}?word=${encodeURIComponent(word)}&order=${orderStr}&p=${page}&s_mode=${sMode}`;
            
            const response = await axios.get(url, {
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
                text_length: item.textCount,
                tags: item.tags || []
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
                    large: getLargeImageUrl(item.url)
                },
                tags: item.tags || [],
                page_count: item.page_count || 1
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
                    large: getLargeImageUrl(item.url)
                },
                caption: item.description || '',
                tags: item.tags || [],
                page_count: item.pageCount || 1
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

        // 6. ユーザー（絵師）検索
        if (type === 'search_user') {
            const page = p || 1;
            const response = await axios.get(`https://www.pixiv.net/ajax/search/users?nick=${encodeURIComponent(word)}&s_mode=s_usr&p=${page}`, {
                headers: {
                    ...webApiHeaders,
                    'Referer': `https://www.pixiv.net/search_user.php?nick=${encodeURIComponent(word)}&s_mode=s_usr`
                }
            });
            const rawData = response.data.body?.users || [];
            const users = rawData.map(item => ({
                id: item.userId.toString(),
                name: item.name,
                avatar: item.imageBig || item.image,
                comment: item.comment || ''
            }));
            return res.status(200).json({ users });
        }

        // 7. 作者詳細プロフィール
        if (type === 'user_detail') {
            const response = await axios.get(`https://www.pixiv.net/ajax/user/${id}?full=1`, {
                headers: webApiHeaders
            });
            const body = response.data.body || {};
            return res.status(200).json({
                id: body.userId,
                name: body.name,
                avatar: body.imageBig || body.image,
                comment: body.comment || ''
            });
        }

        // 8. 作者作品一覧 (ページネーション対応)
        if (type === 'user_illusts') {
            const page = p || 1;
            const allRes = await axios.get(`https://www.pixiv.net/ajax/user/${id}/profile/all`, {
                headers: webApiHeaders
            });
            const illustsObj = allRes.data.body?.illusts || {};
            const allIds = Object.keys(illustsObj).map(Number).sort((a, b) => b - a);
            const total = allIds.length;
            
            if (total === 0) {
                return res.status(200).json({ illusts: [], total: 0 });
            }
            
            const pageSize = 24;
            const pageIds = allIds.slice((page - 1) * pageSize, page * pageSize);
            if (pageIds.length === 0) {
                return res.status(200).json({ illusts: [], total });
            }
            
            const idsQuery = pageIds.map(pid => `ids[]=${pid}`).join('&');
            const worksUrl = `https://www.pixiv.net/ajax/user/${id}/profile/illusts?${idsQuery}&work_category=illust&is_first_page=0`;
            const worksRes = await axios.get(worksUrl, {
                headers: {
                    ...webApiHeaders,
                    'Referer': `https://www.pixiv.net/users/${id}/illustrations`
                }
            });
            
            const works = worksRes.data.body?.works || {};
            const illusts = pageIds.map(pid => {
                const w = works[pid];
                if (!w) return null;
                return {
                    id: w.id.toString(),
                    title: w.title,
                    x_restrict: w.xRestrict,
                    user: { id: w.userId, name: w.userName },
                    image_urls: {
                        square_medium: w.url,
                        large: getLargeImageUrl(w.url)
                    },
                    tags: w.tags || [],
                    page_count: w.pageCount || 1
                };
            }).filter(Boolean);
            
            return res.status(200).json({ illusts, total });
        }

        // 9. イラスト複数枚画像 (全ページ)
        if (type === 'illust_pages') {
            const response = await axios.get(`https://www.pixiv.net/ajax/illust/${id}/pages`, {
                headers: webApiHeaders
            });
            const rawPages = response.data.body || [];
            const pages = rawPages.map(page => ({
                urls: {
                    medium: page.urls.medium,
                    large: getLargeImageUrl(page.urls.medium) || page.urls.regular
                }
            }));
            return res.status(200).json({ pages });
        }

        // 10. おすすめ小説
        if (type === 'recommended_novel') {
            const response = await axios.get(`https://www.pixiv.net/ajax/top/novel?mode=all`, {
                headers: webApiHeaders
            });
            const rawData = response.data.body?.thumbnails?.novel || [];
            const novels = rawData.map(item => ({
                id: item.id,
                title: item.title,
                x_restrict: item.xRestrict,
                user: { id: item.userId, name: item.userName },
                image_urls: {
                    large: item.url
                },
                tags: item.tags || [],
                text_length: item.textCount
            }));
            return res.status(200).json({ novels });
        }

        // 11. 作者小説一覧 (ページネーション対応)
        if (type === 'user_novels') {
            const page = p || 1;
            const allRes = await axios.get(`https://www.pixiv.net/ajax/user/${id}/profile/all`, {
                headers: webApiHeaders
            });
            const novelsObj = allRes.data.body?.novels || {};
            const allIds = Object.keys(novelsObj).map(Number).sort((a, b) => b - a);
            const total = allIds.length;
            
            if (total === 0) {
                return res.status(200).json({ novels: [], total: 0 });
            }
            
            const pageSize = 24;
            const pageIds = allIds.slice((page - 1) * pageSize, page * pageSize);
            if (pageIds.length === 0) {
                return res.status(200).json({ novels: [], total });
            }
            
            const idsQuery = pageIds.map(pid => `ids[]=${pid}`).join('&');
            const worksUrl = `https://www.pixiv.net/ajax/user/${id}/profile/novels?${idsQuery}&work_category=novel&is_first_page=0`;
            const worksRes = await axios.get(worksUrl, {
                headers: {
                    ...webApiHeaders,
                    'Referer': `https://www.pixiv.net/users/${id}/novels`
                }
            });
            
            const works = worksRes.data.body?.works || {};
            const novels = pageIds.map(pid => {
                const w = works[pid];
                if (!w) return null;
                return {
                    id: w.id.toString(),
                    title: w.title,
                    x_restrict: w.xRestrict,
                    user: { id: w.userId, name: w.userName },
                    image_urls: {
                        large: w.url
                    },
                    tags: w.tags || [],
                    text_length: w.textCount
                };
            }).filter(Boolean);
            
            return res.status(200).json({ novels, total });
        }

        // 12. 画像バイナリ中継
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