const mongoose = require('mongoose');
const validator = require('validator');

const User = require('../models/user');
const Post = require('../models/post');

const clearImage = require('../utils/clearImage');

exports.getPublicPosts = async (req, res, next) => {
  try {
    const posts = await Post.find(
      { postStatus: 'public' } || { postStatus: 'PUBLIC' } || {
          postStatus: 'Public',
        }
    ).populate('creator', '-password');
    if (!posts) {
      const error = new Error('No post founded!');
      error.code = 404;
      throw error;
    }
    return res.status(200).json(posts);
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.getAllPosts = async (req, res, next) => {
  if (!req.isAuth) {
    const error = new Error('You do not have access to all posts!');
    error.code = 401;
    throw error;
  }
  try {
    const posts = await Post.find().populate('creator', '-password');
    if (!posts) {
      const error = new Error('No post founded!');
      error.code = 404;
      throw error;
    }

    if (req.user.role.toLowerCase() !== 'admin') {
      const error = new Error('You do not have permission to all posts!');
      error.code = 401;
      throw error;
    }
    return res.status(200).json(posts);
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.getPrivatePosts = async (req, res, next) => {
  if (!req.isAuth) {
    const error = new Error('Not authenticated!');
    error.code = 401;
    throw error;
  }
  try {
    const user = await User.findById(req.user.userId)
      .select('-password')
      .populate('posts');

    if (!user.posts) {
      const error = new Error('No post founded!');
      error.code = 404;
      throw error;
    }

    return res.status(200).json(user.posts);
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.getPost = async (req, res, next) => {
  if (!req.isAuth) {
    const error = new Error('Not authenticated!');
    error.code = 401;
    throw error;
  }
  const { id } = req.params;
  try {
    const post = await Post.findById(id).populate('creator', 'name email');
    if (!post) {
      const error = new Error('No post founded!');
      error.code = 404;
      throw error;
    }
    if (post.postStatus === 'private' && !req.isAuth) {
      const error = new Error('Not authenticated!');
      error.code = 401;
      throw error;
    }
    return res.status(200).json(post);
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.createPost = async (req, res, next) => {
  const { title, content, postStatus } = req.body;

  if (!req.isAuth) {
    const error = new Error('Not authenticated!');
    error.code = 401;
    throw error;
  }

  const errors = [];
  if (
    validator.isEmpty(title) ||
    validator.isEmpty(content) ||
    validator.isEmpty(postStatus)
  ) {
    errors.push({ message: 'Please fill all inputs!' });
  }
  if (errors.length > 0) {
    const error = new Error('Invalid input.');
    error.data = errors;
    error.code = 422;
    throw error;
  }

  try {
    const user = await User.findById(req.user.userId).select('-password');

    if (!user) {
      const error = new Error('Invalid user.');
      error.code = 401;
      throw error;
    }

    const post = new Post({
      title,
      content,
      postStatus,
      imageUrl: req.file ? req.file.path : null,
      creator: user,
    });
    const createdPost = await post.save();
    user.posts.push(createdPost);
    await user.save();
    return res.status(200).json(post);
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.updatePost = async (req, res, next) => {
  const { title, content, postStatus } = req.body;
  const { id } = req.params;

  if (!req.isAuth) {
    const error = new Error('Not authenticated!');
    error.code = 401;
    throw error;
  }

  const errors = [];
  if (
    validator.isEmpty(title) ||
    validator.isEmpty(content) ||
    validator.isEmpty(postStatus)
  ) {
    errors.push({ message: 'Please fill all inputs!' });
  }
  if (errors.length > 0) {
    const error = new Error('Invalid input.');
    error.data = errors;
    error.code = 422;
    throw error;
  }

  try {
    const findPost = await Post.findById(id).populate('creator', '_id');
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      const error = new Error('Invalid user.');
      error.code = 401;
      throw error;
    }

    if (findPost.creator._id.toString() !== req.user.userId.toString()) {
      const error = new Error('You do NOT have access to update this post!');
      error.code = 401;
      throw error;
    }

    let imageUrl = req.body.imageUrl;
    if (req.file) {
      imageUrl = req.file.path;
    }

    if (imageUrl !== findPost.imageUrl && findPost.imageUrl) {
      clearImage(findPost.imageUrl);
    }

    findPost.title = title;
    findPost.content = content;
    findPost.postStatus = postStatus;
    findPost.imageUrl = imageUrl;
    findPost.creator = user;

    if (!imageUrl || !req.file) {
      delete findPost.imageUrl;
    }

    const updatedPost = await findPost.save();

    user.posts.pull(id);
    user.posts.push(updatedPost);
    await user.save();
    return res.status(201).json(updatedPost);
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.deletePost = async (req, res, next) => {
  const { id } = req.params;

  if (!req.isAuth) {
    const error = new Error('Not authenticated!');
    error.code = 401;
    throw error;
  }

  try {
    const post = await Post.findById(id).populate('creator', '_id');
    if (req.user.role.toLowerCase() === 'admin') {
      if (post.imageUrl) {
        clearImage(post.imageUrl);
      }

      const user = await User.findById(post.creator._id).populate('posts');
      user.posts.pull(id);
      await user.save();
      await Post.findByIdAndDelete(id);
      return res.status(201).json(id);
    } else {
      const user = await User.findById(req.user.userId).populate('posts');
      if (post.creator._id.toString() !== req.user.userId.toString()) {
        const error = new Error('Not authorized!');
        error.code = 401;
        throw error;
      }

      if (post.imageUrl) {
        clearImage(post.imageUrl);
      }

      user.posts.pull(id);
      await user.save();
      await Post.findByIdAndDelete(id);
      return res.status(201).json(id);
    }
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.updatePostStatus = async (req, res, next) => {
  const { status } = req.body;
  const { id } = req.params;

  if (!req.isAuth) {
    const error = new Error('Not authenticated!');
    error.code = 401;
    throw error;
  }

  try {
    const post = await Post.findById(id).populate('creator', '_id');

    if (post.creator._id.toString() !== req.user.userId.toString()) {
      const error = new Error('Not authorized!');
      error.code = 401;
      throw error;
    }

    await Post.findOneAndUpdate(
      { _id: id },
      { $set: { postStatus: status } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.status(201).json({
      postId: id,
      status,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.addComment = async (req, res, next) => {
  const { text } = req.body;
  const { postId } = req.params;

  if (!req.isAuth) {
    const error = new Error('Not authenticated!');
    error.code = 401;
    throw error;
  }

  try {
    const post = await Post.findById(postId).populate('creator', '_id');
    if (!post) {
      const error = new Error('Post does not exist!');
      error.code = 404;
      throw error;
    }

    const commentId = new mongoose.Types.ObjectId();

    post.comments.push({ _id: commentId, user: req.user.userId, text });
    await post.save();

    return res.status(200).json({
      _id: commentId,
      userId: req.user.userId,
      postId: postId,
      text: text,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.deleteComment = async (req, res, next) => {
  const { postId, commentId } = req.params;
  if (!req.isAuth) {
    const error = new Error('Not authenticated!');
    error.code = 401;
    throw error;
  }

  try {
    const post = await Post.findById(postId).populate('creator', '_id');
    if (!post) {
      const error = new Error('Post does not exist!');
      error.code = 404;
      throw error;
    }

    const findComment = post.comments.find(
      (comment) => comment._id.toString() === commentId.toString()
    );
    if (!findComment) {
      const error = new Error('This comment does not exist!');
      error.code = 404;
      throw error;
    }

    if (findComment.user.toString() !== req.user.userId.toString()) {
      const error = new Error('Not authorized.');
      error.code = 400;
      throw error;
    }

    post.comments.pull(commentId);
    await post.save();
    return res.status(200).json({
      postId,
      commentId,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.likePost = async (req, res, next) => {
  const { postId } = req.params;

  if (!req.isAuth) {
    const error = new Error('Not authenticated!');
    error.code = 401;
    throw error;
  }

  try {
    const post = await Post.findById(postId).populate('creator', '_id');
    if (!post) {
      const error = new Error('Post does not exist!');
      error.code = 404;
      throw error;
    }

    const checkIfLiked = post.likes.find(
      (p) => p.user.toString() === req.user.userId.toString()
    );
    const checkIfUnliked = post.unlikes.find(
      (p) => p.user.toString() === req.user.userId.toString()
    );

    if (
      checkIfLiked &&
      checkIfLiked.user.toString() !== req.user.userId.toString()
    ) {
      const error = new Error('Not authorized.');
      error.code = 400;
      throw error;
    }

    // if is not liked
    if (!checkIfLiked) {
      const likeId = new mongoose.Types.ObjectId();
      if (checkIfUnliked) {
        await Post.findOneAndUpdate(
          { _id: postId },
          { $pull: { unlikes: { user: req.user.userId } } },
          { new: true, upsert: true, setDefaultsOnInsert: true }
        );
      }
      post.likes.push({ _id: likeId, user: req.user.userId });
      await post.save();
      return res.status(201).json({
        _id: likeId,
        postId,
      });
    } else {
      // if is liked
      post.likes.pull(checkIfLiked._id);
      await post.save();
      return res.status(201).json({
        _id: checkIfLiked._id,
        postId,
      });
    }
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.unlikePost = async (req, res, next) => {
  const { postId } = req.params;

  if (!req.isAuth) {
    const error = new Error('Not authenticated!');
    error.code = 401;
    throw error;
  }

  try {
    const post = await Post.findById(postId).populate('creator', '_id');
    if (!post) {
      const error = new Error('Post does not exist!');
      error.code = 404;
      throw error;
    }

    const checkIfLiked = post.likes.find(
      (p) => p.user.toString() === req.user.userId.toString()
    );
    const checkIfUnliked = post.unlikes.find(
      (p) => p.user.toString() === req.user.userId.toString()
    );

    if (
      checkIfUnliked &&
      checkIfUnliked.user.toString() !== req.user.userId.toString()
    ) {
      const error = new Error('Not authorized.');
      error.code = 400;
      throw error;
    }

    // if is not unliked
    if (!checkIfUnliked) {
      const unlikeId = new mongoose.Types.ObjectId();
      if (checkIfLiked) {
        await Post.findOneAndUpdate(
          { _id: postId },
          { $pull: { likes: { user: req.user.userId } } },
          { new: true, upsert: true, setDefaultsOnInsert: true }
        );
      }
      post.unlikes.push({ _id: unlikeId, user: req.user.userId });
      await post.save();
      return res.status(201).json({
        _id: unlikeId,
        postId,
      });
    } else {
      // if is unliked
      post.unlikes.pull(checkIfUnliked._id);
      await post.save();
      return res.status(201).json({
        _id: checkIfUnliked._id,
        postId,
      });
    }
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.favoritePost = async (req, res, next) => {
  const { postId } = req.params;

  if (!req.isAuth) {
    const error = new Error('Not authenticated!');
    error.code = 401;
    throw error;
  }

  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      const error = new Error('User does not exist!');
      error.code = 404;
      throw error;
    }

    if (user.favorites.toString().includes(postId.toString())) {
      user.favorites = user.favorites.filter((p) => p.toString() !== postId);
    } else {
      user.favorites.push(postId);
    }

    await user.save();
    return res.status(200).json({
      postId,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};
