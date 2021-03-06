const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
  email: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  imageUrl: {
    type: String,
  },
  role: {
    type: String,
    required: true,
    default: 'USER',
  },
  posts: [
    {
      type: Schema.Types.ObjectId,
      ref: 'Post',
    },
  ],
  favorites: [{ type: Schema.Types.ObjectId, ref: 'Post' }],
  passwordResetToken: String,
  passwordResetExpires: Date,
});

module.exports = mongoose.model('User', userSchema);
