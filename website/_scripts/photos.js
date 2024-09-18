import GooglePhotosAlbum from 'google-photos-album-image-url-fetch';
import _ from 'lodash';

export async function fetchPhotos(el) {
    el.addCollection("photos_year", async () => {
        const urls = await GooglePhotosAlbum.fetchImageUrls(process.env.PHOTOS_ALBUM);
        const photos = _.chain(urls)
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
