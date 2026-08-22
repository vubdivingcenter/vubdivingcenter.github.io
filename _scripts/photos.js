import _ from 'lodash';
import json5 from 'json5';

const USER_AGENT = {
    'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
};
const EXCLUDED_UID = 'AF1QipMwWfBqAl2JbLbSopbhz5uCOjB71Qc3kQPG5MYw';
const MAX_PAGES = 100;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetches a URL as text with a few retries. Returns null on final failure.
 */
async function fetchText(url, tries = 4) {
    for (let i = 0; i < tries; i++) {
        try {
            const res = await fetch(url, { headers: USER_AGENT, redirect: 'follow' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.text();
        } catch (error) {
            await sleep(1000);
        }
    }
    return null;
}

/**
 * Fetches the shared album once, following redirects so short share links
 * (e.g. photos.app.goo.gl/...) resolve to the canonical photos.google.com URL
 * that carries the full album id and access key. Returns { canonicalUrl, html }.
 */
async function resolveAlbum(albumUrl, tries = 4) {
    for (let i = 0; i < tries; i++) {
        try {
            const res = await fetch(albumUrl, { headers: USER_AGENT, redirect: 'follow' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return { canonicalUrl: res.url, html: await res.text() };
        } catch (error) {
            await sleep(1000);
        }
    }
    return { canonicalUrl: albumUrl, html: null };
}

/**
 * Splits a shared-album URL into its album id and access key.
 */
function albumParts(albumUrl) {
    const u = new URL(albumUrl);
    const segments = u.pathname.split('/').filter(Boolean);
    const albumId = segments[segments.length - 1];
    const key = u.searchParams.get('key') || '';
    return { albumId, key };
}

/**
 * Builds the public URL for a single item in a shared album.
 */
function itemUrl(albumUrl, uid) {
    const { albumId, key } = albumParts(albumUrl);
    return `https://photos.google.com/share/${albumId}/photo/${uid}${key ? `?key=${key}` : ''}`;
}

/**
 * Pulls the first page of raw items and the next-page cursor out of the
 * shared-album HTML. Google paginates albums (~300 items per page); `data[1]`
 * holds the items and `data[2]` the cursor for the next page.
 */
function parseAlbumData(html) {
    if (!html) return { items: [], cursor: '' };
    const re = /(?<=AF_initDataCallback\()(?=.*data)(\{[\s\S]*?)(\);<\/script>)/g;
    const match = [...html.matchAll(re)].map(m => m[1]).reduce((a, b) => (a.length > b.length ? a : b), '');
    if (!match) return { items: [], cursor: '' };
    const data = json5.parse(match).data;
    return {
        items: Array.isArray(data[1]) ? data[1] : [],
        cursor: typeof data[2] === 'string' ? data[2] : ''
    };
}

/**
 * Fetches one subsequent album page using the `snAcKc` batchexecute RPC.
 * Returns the decoded payload array, whose [1] is the next batch of items and
 * [2] the cursor for the following page (an empty string means the album is done).
 */
async function fetchNextPage(albumId, key, cursor, tries = 4) {
    const inner = JSON.stringify([albumId, cursor, null, key]);
    const body = 'f.req=' + encodeURIComponent(JSON.stringify([[['snAcKc', inner, null, 'generic']]]));
    const url = `https://photos.google.com/_/PhotosUi/data/batchexecute?rpcids=snAcKc&source-path=%2Fshare%2F${albumId}`;
    for (let i = 0; i < tries; i++) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { ...USER_AGENT, 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
                body
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const raw = await res.text();
            const outer = JSON.parse(raw.replace(/^\)\]\}'\s*/, ''));
            return JSON.parse(outer[0][2]);
        } catch (error) {
            await sleep(1000);
        }
    }
    return null;
}

/**
 * Walks every album page (first page from the HTML, the rest via batchexecute)
 * until the cursor is exhausted, collecting all raw items.
 */
async function fetchAllItems(canonicalUrl, firstHtml) {
    const { albumId, key } = albumParts(canonicalUrl);
    const { items: firstItems, cursor: nextCursor } = parseAlbumData(firstHtml);
    const all = [...firstItems];
    let cursor = nextCursor;
    let pages = 1;
    while (cursor && pages < MAX_PAGES) {
        const payload = await fetchNextPage(albumId, key, cursor);
        if (!payload) break;
        all.push(...(Array.isArray(payload[1]) ? payload[1] : []));
        cursor = typeof payload[2] === 'string' ? payload[2] : '';
        pages++;
    }
    return { items: all, pages };
}

/**
 * Converts a raw album item into a photo object. Video items carry a `76647426`
 * metadata block (item[9]) that photos do not have, which we use to flag them.
 */
function itemToPhoto(e) {
    if (!Array.isArray(e) || e.length < 6) return null;
    const uid = e[0];
    const detail = e[1];
    if (typeof uid !== 'string' || !Array.isArray(detail) || detail.length < 3) return null;
    const url = detail[0];
    const width = detail[1];
    const height = detail[2];
    if (typeof url !== 'string' || typeof width !== 'number' || typeof height !== 'number') return null;
    const meta = e[9];
    const type = (meta && typeof meta === 'object' && meta['76647426']) ? 'video' : 'photo';
    return {
        uid,
        url,
        width,
        height,
        imageUpdateDate: e[2],
        albumAddDate: e[5],
        type
    };
}

/**
 * Fetches a video item page and extracts the direct MP4 stream URL.
 *
 * This URL is signed by Google and rotates per request, so it may expire. Callers
 * should always keep the stable item page URL as a fallback.
 */
async function getVideoStreamUrl(albumUrl, uid) {
    const html = await fetchText(itemUrl(albumUrl, uid));
    if (!html) return undefined;
    const match = html.match(/https:\/\/video-downloads\.googleusercontent\.com\/[A-Za-z0-9_\-]+/);
    return match ? match[0] : undefined;
}

export async function fetchPhotos(el) {
    el.addCollection("photos_year", async () => {
        if (!process.env.PHOTOS_ALBUM) {
            console.warn("No Google Photos album ID provided.");
            return [];
        }
        const albumUrl = process.env.PHOTOS_ALBUM;

        // Resolve the album to its canonical URL (follows redirects for short share
        // links) and fetch every page of items so the whole album is rendered.
        const { canonicalUrl, html } = await resolveAlbum(albumUrl);
        const { items, pages } = await fetchAllItems(canonicalUrl, html);

        const photos = items.map(itemToPhoto).filter(Boolean);
        console.log(`Fetched ${photos.length} photos from Google Photos album (${pages} page(s)).`);
        const videoCount = photos.filter(p => p.type === 'video').length;
        if (videoCount > 0) {
            console.log(`Detected ${videoCount} video(s) in album.`);
        }

        // Filter by uid
        const filtered = photos.filter(photo => photo.uid !== EXCLUDED_UID);

        const resolved = await Promise.all(filtered.map(async photo => {
            const videoUrl = photo.type === 'video' ? await getVideoStreamUrl(canonicalUrl, photo.uid) : undefined;
            return {
                aspect: photo.width / photo.height,
                itemUrl: itemUrl(canonicalUrl, photo.uid),
                videoUrl,
                ...photo
            };
        }));

        const grouped = _.chain(resolved)
            .sort((a, b) => a.imageUpdateDate - b.imageUpdateDate)
            .groupBy((photo) => new Date(photo.imageUpdateDate).getFullYear())
            .toPairs()
            .reverse()
            .value();
        if (grouped.length === 0) {
            throw new Error(`Unable to fetch photos!`);
        }
        return grouped;
    });
}
