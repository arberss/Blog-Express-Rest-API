const ImageKit = require('imagekit');
require('dotenv').config();

exports.imagekit = new ImageKit({
  publicKey: `${process.env.IMAGEKIT_PUBLIC_KEY}`,
  privateKey: `${process.env.IMAGEKIT_PRIVATE_KEY}`,
  urlEndpoint: `${process.env.IMAGEKIT_URL}`,
});
