const GooglePhotosAlbum = require('google-photos-album-image-url-fetch');
const _ = require("lodash");

function fetchPhotos(el) {
    el.addCollection("photos_year", async () => {
        return _.chain(await GooglePhotosAlbum.fetchImageUrls(process.env.PHOTOS_ALBUM))
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
    });
}

module.exports = fetchPhotos;