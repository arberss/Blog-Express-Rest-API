const jwt = require('jsonwebtoken');
require('dotenv').config();

module.exports = (req, res, next) => {
  const authHeader = req.get('Authorization');
  if (!authHeader) {
    req.isAuth = false;
    return next();
  }
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    req.isAuth = false;
    return next();
  }

  try {
    jwt.verify(token, `${process.env.LOGIN_TOKEN}`, (error, decoded) => {
      if (error) {
        req.isAuth = false;
        return next();
      } else {
        req.isAuth = true;
        req.user = decoded;
        next();
      }
    });
  } catch (err) {
    req.isAuth = false;
    res.status(500).json({ msg: 'Server Error' });
  }
};