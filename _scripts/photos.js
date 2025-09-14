import GooglePhotosAlbum from 'google-photos-album-image-url-fetch';
import _ from 'lodash';

export async function fetchPhotos(el) {
    el.addCollection("photos_year", async () => {
        if (!process.env.PHOTOS_ALBUM) {
            console.warn("No Google Photos album ID provided.");
            return [];
        }
        const urls = await GooglePhotosAlbum.fetchImageUrls(process.env.PHOTOS_ALBUM);
        console.log(`Fetched ${urls.length} photos from Google Photos album.`);
        
        // Filter by uid
        // TODO: FIX VIDEOS
        const filteredUrls = urls.filter(photo => photo.uid != "AF1QipMwWfBqAl2JbLbSopbhz5uCOjB71Qc3kQPG5MYw");

        const photos = _.chain(filteredUrls)
            .sort((a, b) => a.imageUpdateDate - b.imageUpdateDate)
            .map(photo => {
                return {
                    aspect: photo.width / photo.height,
                    ...photo
                };
            })
            .groupBy((photo) => new Date(photo.imageUpdateDate).getFullYear())
            .toPairs()
            .reverse()
            .value();
        if (photos.length === 0) {
            throw new Error(`Unable to fetch photos!`);
        }
        return photos;
    });
}
