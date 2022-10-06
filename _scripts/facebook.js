const axios = require('axios');
const crypto = require('crypto');

const accessToken = process.env.META_APP_TOKEN;
const appSecret = process.env.META_APP_SECRET;
const appSecretProof = crypto.createHmac('sha256', appSecret).update(accessToken).digest('hex');
const page = "vubrooster";

async function fetchPosts(el) {
    return new Promise((resolve, reject) => {
        const url = `https://graph.facebook.com/v2.2/${page}/feed?access_token=${accessToken}&appsecret_proof=${appSecretProof}`;
        axios.get(url).then(response => {
            const posts = response.data.data;
            
            resolve();
        }).catch(reject)
    });
}

fetchPosts(undefined);

module.exports = fetchPosts;
