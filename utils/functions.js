const isBase64 = require('is-base64');

const base64Mimetype = (base64) => {
  return base64
    .substring(base64.indexOf(':') + 1, base64.indexOf(';'))
    .split('/')[1];
};

const checkBase64 = (url) => {
  return isBase64(url, { allowMime: true });
};

module.exports = base64Mimetype;
module.exports = checkBase64;