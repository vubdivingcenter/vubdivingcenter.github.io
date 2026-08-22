import GooglePhotosAlbum from 'google-photos-album-image-url-fetch';
import _ from 'lodash';
import json5 from 'json5';

const USER_AGENT = {
    'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
};

async function sleep(ms) {
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
 * Parses the raw shared-album HTML and returns the set of item uids that are videos.
 *
 * The `google-photos-album-image-url-fetch` library only exposes the preview image
 * for a video and provides no type flag. In the raw album data, video items carry a
 * `76647426` metadata block that photos do not have, which we use to detect them.
 */
function parseVideoUids(html) {
    const videoUids = new Set();
    if (!html) return videoUids;
    const re = /(?<=AF_initDataCallback\()(?=.*data)(\{[\s\S]*?)(\);<\/script>)/g;
    const match = [...html.matchAll(re)].reduce((a, b) => (a.length > b[1].length ? a : b[1]), '');
    if (!match) return videoUids;
    const data = json5.parse(match);
    const items = data?.data?.[1];
    if (Array.isArray(items)) {
        for (const item of items) {
            if (!Array.isArray(item) || typeof item[0] !== 'string') continue;
            const meta = item[9];
            if (meta && typeof meta === 'object' && meta['76647426']) {
                videoUids.add(item[0]);
            }
        }
    }
    return videoUids;
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
        const urls = await GooglePhotosAlbum.fetchImageUrls(albumUrl);
        console.log(`Fetched ${urls.length} photos from Google Photos album.`);

        // Resolve the album to its canonical URL (follows redirects for short share
        // links) and detect which items are videos. Item/stream URLs are built from
        // the canonical URL so they always carry the full album id and access key.
        const { canonicalUrl, html } = await resolveAlbum(albumUrl);
        const videoUids = parseVideoUids(html);
        if (videoUids.size > 0) {
            console.log(`Detected ${videoUids.size} video(s) in album.`);
        }

        // Filter by uid
        // TODO: FIX VIDEOS
        const filteredUrls = urls.filter(photo => photo.uid != "AF1QipMwWfBqAl2JbLbSopbhz5uCOjB71Qc3kQPG5MYw");

        const photos = await Promise.all(filteredUrls.map(async photo => {
            const type = videoUids.has(photo.uid) ? 'video' : 'photo';
            const videoUrl = type === 'video' ? await getVideoStreamUrl(canonicalUrl, photo.uid) : undefined;
            return {
                aspect: photo.width / photo.height,
                type,
                itemUrl: itemUrl(canonicalUrl, photo.uid),
                videoUrl,
                ...photo
            };
        }));

        const grouped = _.chain(photos)
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
