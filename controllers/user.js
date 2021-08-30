const bcrypt = require('bcryptjs');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const User = require('../models/user');
const Post = require('../models/post');

require('dotenv').config();

const clearImage = require('../utils/clearImage');

exports.createUser = async (req, res, next) => {
  const { email, name, password, confirmPassword } = req.body;

  const errors = [];
  if (!validator.isEmail(email)) {
    errors.push({ message: 'E-Mail is invalid.' });
  }
  if (validator.isEmpty(name)) {
    errors.push({ message: 'Name can not be empty!' });
  }
  if (
    validator.isEmpty(password) ||
    !validator.isLength(password, { min: 5 })
  ) {
    errors.push({ message: 'Password too short!' });
  }
  if (errors.length > 0) {
    const error = new Error('Validation failed.');
    error.statusCode = 422;
    error.data = errors;
    throw error;
  }

  try {
    const existingUser = await User.findOne({ email }).select('-password');
    if (existingUser) {
      const error = new Error('User already exist!');
      error.statusCode = 409;
      throw error;
    }

    if (password !== confirmPassword) {
      const error = new Error('Password does not match!');
      error.statusCode = 409;
      throw error;
    }

    const hashedPw = await bcrypt.hash(password, 12);

    const user = new User({
      email,
      name,
      imageUrl: req.file ? req.file.path : null,
      password: hashedPw,
    });

    const createdUser = await user.save();
    return res.status(200).json(createdUser);
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.login = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      const error = new Error('This user does not exist');
      error.status = 404;
      throw error;
    }
    const isEqual = await bcrypt.compare(password, user.password);
    if (!isEqual) {
      const error = new Error('Password is incorrect.');
      error.code = 401;
      throw error;
    }
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      },
      `${process.env.LOGIN_TOKEN}`,
      { expiresIn: '1h' }
    );

    return res.status(200).json({ token, userId: user._id });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.currentUser = async (req, res, next) => {
  if (!req.isAuth) {
    const error = new Error('Not authenticated!');
    error.code = 401;
    throw error;
  }
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      const error = new Error('This user does not exist');
      error.status = 404;
      throw error;
    }
    return res.status(200).json(user);
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.updateUser = async (req, res, next) => {
  if (!req.isAuth) {
    const error = new Error('Not authenticated!');
    error.code = 401;
    throw error;
  }

  const { email, name, password, confirmPassword } = req.body;

  const errors = [];
  if (!validator.isEmail(email)) {
    errors.push({ message: 'E-Mail is invalid.' });
  }
  if (validator.isEmpty(name)) {
    errors.push({ message: 'Name can not be empty!' });
  }
  if (
    validator.isEmpty(password) ||
    !validator.isLength(password, { min: 5 })
  ) {
    errors.push({ message: 'Password too short!' });
  }
  if (errors.length > 0) {
    const error = new Error('Validation failed.');
    error.statusCode = 422;
    error.data = errors;
    throw error;
  }

  if (password !== confirmPassword) {
    const error = new Error('Password does NOT match!');
    throw error;
  }

  try {
    const user = await User.findById(req.user.userId).populate('posts');
    const hashedPw = await bcrypt.hash(password, 12);

    let imageUrl = req.body.imageUrl;
    if (req.file) {
      imageUrl = req.file.path;
    }

    if (imageUrl !== user.imageUrl && user.imageUrl) {
      clearImage(user.imageUrl);
    }

    user.email = email;
    user.name = name;
    user.imageUrl = imageUrl;
    user.password = hashedPw;

    if (!imageUrl || !req.file) {
      delete user.imageUrl;
    }

    const savedUser = await user.save();

    return res.status(201).json(savedUser);
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.allUsers = async (req, res, next) => {
  if (!req.isAuth) {
    const error = new Error('Not authenticated!');
    error.code = 401;
    throw error;
  }
  try {
    const users = await User.find().select('-password');
    if (!users) {
      const error = new Error('This user does not exist');
      error.status = 404;
      throw error;
    }
    return res.status(200).json(users);
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.adminUpdateRoles = async (req, res, next) => {
  const { role } = req.body;
  const { userId } = req.params;

  if (!req.isAuth) {
    const error = new Error('Not authenticated!');
    error.code = 401;
    throw error;
  }
  try {
    if (req.user.role.toLowerCase() === 'admin') {
      const newRole = await User.findByIdAndUpdate(
        { _id: userId },
        { $set: { role: role.toUpperCase() } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      return res.status(201).json({
        userId: newRole._id,
        role: newRole.role,
      });
    }
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.updateUserRole = async (req, res, next) => {
  const { role } = req.body;

  if (!req.isAuth) {
    const error = new Error('Not authenticated!');
    error.code = 401;
    throw error;
  }

  try {
    const newRole = await User.findByIdAndUpdate(
      { _id: req.user.userId },
      { $set: { role: role.toUpperCase() } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.status(201).json({
      userId: newRole._id,
      role: newRole.role,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.forgotPassword = async (req, res, next) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      const error = new Error('This user does not exist');
      error.status = 404;
      throw error;
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
      },
     `${process.env.FORGOT_EMAIL_SECRET}`,
      { expiresIn: 60 * 15 }
    );

    const expiresDate = new Date() * 60 * 15;

    user.passwordResetToken = token;
    user.passwordResetExpires = expiresDate.valueOf().toString();
    await user.save();

    // create reusable transporter object using the default SMTP transport
    let transporter = nodemailer.createTransport({
      host: 'smtp-mail.outlook.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: `${process.env.SEND_MAIL_USER}`,
        pass: `${process.env.SEND_MAIL_PASS}`, 
      },
    });

    // send mail with defined transport object
    let info = await transporter.sendMail({
      from: 'BlogExpress', // sender address
      to: email, // list of receivers
      subject: 'Reset Password - BlogExpress', // Subject line
      text: `Blog Express`, // plain text body
      html: `<h1>Link:</h1> http://localhost:8080/api/user/reset-password/${token}`, // html body
    });

    return res.status(200).json({ email, messageId: info.messageId });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.resetPassword = async (req, res, next) => {
  const { password, confirmPassword } = req.body;
  const { token } = req.params;
  try {
    const decodedToken = jwt.verify(token, `${process.env.FORGOT_EMAIL_SECRET}`);
    if (!decodedToken) {
      const error = new Error('Token is invalid or has expired!');
      error.status = 400;
      throw error;
    }

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date().valueOf().toString() },
    });
    if (!user) {
      const error = new Error('Token is invalid or has expired!');
      error.status = 400;
      throw error;
    }

    if (password !== confirmPassword) {
      const error = new Error('Password does NOT match!');
      throw error;
    }

    const hashedPw = await bcrypt.hash(password, 12);

    user.password = hashedPw;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    return res.status(200).json({ email: user.email });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.deleteUser = async (req, res, next) => {
  const { id } = req.params;

  if (!req.isAuth) {
    const error = new Error('Not authenticated!');
    error.code = 401;
    throw error;
  }

  try {
    if (req.user.role.toLowerCase() === 'admin') {
      await Promise.all([
        Post.deleteMany({ creator: { _id: id } }),
        User.findByIdAndDelete(id),
      ]);
      return res.status(201).json({ id });
    } else {
      const user = await User.findById(id);
      if (user._id.toString() !== req.user.userId.toString()) {
        const error = new Error('Not authorized!');
        error.code = 401;
        throw error;
      }

      await Promise.all([
        Post.deleteMany({ creator: { _id: id } }),
        User.findByIdAndDelete(id),
      ]);
      return res.status(201).json({ id });
    }
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};
