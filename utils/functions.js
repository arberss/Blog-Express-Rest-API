const base64Mimetype = (base64) => {
  return base64.substring(base64.indexOf(':') + 1, base64.indexOf(';')).split('/')[1];
};

module.exports = base64Mimetype
