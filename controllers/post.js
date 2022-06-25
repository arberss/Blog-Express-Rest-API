const mongoose = require('mongoose');
const validator = require('validator');
const moment = require('moment');

const User = require('../models/user');
const { Post } = require('../models/post');
const { Category, Notification } = require('../models/post');

const clearImage = require('../utils/clearImage');

exports.getPublicPosts = async (req, res, next) => {
  const { page, size, search } = req.query;

  try {
    const posts = await Post.find({
      $or: [
        { postStatus: 'public' },
        { postStatus: 'PUBLIC' },
        {
          postStatus: 'Public',
        },
      ],
    })
      .skip((+page - 1) * size)
      .limit(+size)
      .populate('creator', '-password -posts -favorites');

    const countDoc = await Post.find({
      $or: [
        { postStatus: 'public' },
        { postStatus: 'PUBLIC' },
        {
          postStatus: 'Public',
        },
      ],
    }).countDocuments();

    if (!posts) {
      const error = new Error('No post found!');
      error.statusCode = 404;
      throw error;
    }

    return res.status(200).json({
      data: posts,
      total: countDoc,
      page,
      size,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.getAllPosts = async (req, res, next) => {
  const { category } = req.params;
  const { page, size, search } = req.query;

  if (!req.isAuth) {
    const error = new Error('You do not have access to all posts!');
    error.statusCode = 401;
    throw error;
  }
  try {
    let posts, countDoc;

    if (category) {
      const ObjectId = mongoose.Types.ObjectId;
      posts = await Post.find({
        categories: { $all: [ObjectId(category)] },
        title: { $regex: search, $options: 'i' },
      })
        .skip((+page - 1) * size)
        .limit(+size)
        .sort({ createdAt: -1 })
        .select('createdAt creator imageUrl postStatus title categories')
        .populate('categories', 'category')
        .populate('creator', '-password -posts');

      countDoc = await Post.find({
        categories: { $all: [ObjectId(category)] },
      }).countDocuments();
    } else {
      posts = await Post.find({ title: { $regex: search, $options: 'i' } })
        .skip((+page - 1) * size)
        .limit(+size)
        .sort({ createdAt: -1 })
        .select('createdAt creator imageUrl postStatus title')
        .populate('creator', '-password -posts');

      countDoc = await Post.find().countDocuments();
    }

    if (!posts) {
      const error = new Error('No post founded!');
      error.statusCode = 404;
      throw error;
    }

    // if (req.user.role.toLowerCase() !== 'admin' ) {
    // if (!req.isAuth) {
    //   const error = new Error('You do not have permission to all posts!');
    //   error.statusCode = 401;
    //   throw error;
    // }

    const returnObj = posts.map((post) => {
      return {
        ...post._doc,
        creator: {
          _id: post.creator._id,
          email: post.creator.email,
          name: post.creator.name,
          imageUrl: post.creator.imageUrl,
        },
      };
    });

    return res.status(200).json({
      data: returnObj,
      total: countDoc,
      page,
      size,
    });
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
    error.statusCode = 401;
    throw error;
  }
  try {
    const user = await User.findById(req.user.userId)
      .select('-password')
      .populate(
        'posts',
        'createdAt creator imageUrl postStatus title categories'
      );

    if (!user.posts) {
      const error = new Error('No post founded!');
      error.statusCode = 404;
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
  const { id } = req.params;
  try {
    const post = await Post.findById(id)
      .populate('creator', 'name email imageUrl')
      .select('-comments');

    const ObjectId = mongoose.Types.ObjectId;
    let commentsLength = await Post.aggregate([
      { $match: { _id: ObjectId(id) } },
      { $project: { comments: { $size: '$comments' } } },
    ]);

    if (!post) {
      const error = new Error('No post founded!');
      error.statusCode = 404;
      throw error;
    }

    if (post.postStatus === 'public' && (!req.isAuth || req.isAuth)) {
      return res
        .status(200)
        .json({ ...post._doc, comments: commentsLength[0].comments });
    }

    if (post.postStatus === 'private' && !req.isAuth) {
      const error = new Error('Not authenticated!');
      error.statusCode = 401;
      throw error;
    }

    return res
      .status(200)
      .json({ ...post._doc, comments: commentsLength[0].comments });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.createPost = async (req, res, next) => {
  const { title, content, postStatus, categories } = req.body;

  if (!req.isAuth) {
    const error = new Error('Not authenticated!');
    error.statusCode = 401;
    throw error;
  }

  const errors = [];
  if (
    validator.isEmpty(title) ||
    validator.isEmpty(content) ||
    validator.isEmpty(postStatus) ||
    categories.length < 1
  ) {
    errors.push({ message: 'Please fill all inputs!' });
  }
  if (errors.length > 0) {
    const error = new Error('Invalid input.');
    error.data = errors;
    error.statusCode = 422;
    throw error;
  }

  try {
    const user = await User.findById(req.user.userId).select('-password');

    if (!user) {
      const error = new Error('Invalid user.');
      error.statusCode = 401;
      throw error;
    }

    let fileImageUrl = req.body.imageUrl;
    if (req.file) {
      fileImageUrl = req.file.path;
    }

    let ctgList = categories.split(',');
    ctgList = ctgList.map((ctg) => {
      return { _id: ctg };
    });

    const post = new Post({
      title,
      content,
      postStatus,
      categories: ctgList,
      imageUrl: req.file ? fileImageUrl : null,
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
  const { title, content, postStatus, categories } = req.body;
  const { id } = req.params;

  if (!req.isAuth) {
    const error = new Error('Not authenticated!');
    error.statusCode = 401;
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
    error.statusCode = 422;
    throw error;
  }

  try {
    const findPost = await Post.findById(id).populate('creator', '_id');
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      const error = new Error('Invalid user.');
      error.statusCode = 401;
      throw error;
    }

    if (findPost.creator._id.toString() !== req.user.userId.toString()) {
      const error = new Error('You do NOT have access to update this post!');
      error.statusCode = 401;
      throw error;
    }

    let imageUrl = req.body.imageUrl;
    if (req.file) {
      imageUrl = req.file.path;
    }

    if (imageUrl !== findPost.imageUrl && findPost.imageUrl) {
      clearImage(findPost.imageUrl);
    }

    let ctgList = categories.split(',');
    ctgList = ctgList.map((ctg) => {
      return { _id: ctg };
    });

    findPost.title = title;
    findPost.content = content;
    findPost.postStatus = postStatus;
    findPost.imageUrl = imageUrl;
    findPost.creator = req.user.userId;
    findPost.categories = ctgList;

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
    error.statusCode = 401;
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
        error.statusCode = 401;
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
    error.statusCode = 401;
    throw error;
  }

  try {
    const post = await Post.findById(id).populate('creator', '_id');

    if (post.creator._id.toString() !== req.user.userId.toString()) {
      const error = new Error('Not authorized!');
      error.statusCode = 401;
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

exports.getComments = async (req, res, next) => {
  const { postId } = req.params;
  try {
    const comments = await Post.findById(postId)
      .select('comments')
      .populate('comments.user', 'email name imageUrl role date edited');

    if (!comments) {
      const error = new Error('Post does not exist!');
      error.statusCode = 404;
      throw error;
    }

    return res.status(200).json({
      data: comments?.comments,
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
    error.statusCode = 401;
    throw error;
  }

  try {
    const post = await Post.findById(postId).populate('creator', '_id');
    const user = await User.findById(req.user.userId).select(
      'role name imageUrl email'
    );

    if (!post) {
      const error = new Error('Post does not exist!');
      error.statusCode = 404;
      throw error;
    }

    const commentId = new mongoose.Types.ObjectId();

    post.comments.push({
      _id: commentId,
      user: req.user.userId,
      text,
    });
    await post.save();

    return res.status(200).json({
      _id: commentId,
      user: user,
      text: text,
      createdAt: moment().valueOf(),
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.editComment = async (req, res, next) => {
  const { text } = req.body;
  const { postId, commentId } = req.params;
  if (!req.isAuth) {
    const error = new Error('Not authenticated!');
    error.statusCode = 401;
    throw error;
  }

  try {
    const post = await Post.findById(postId).populate(
      'comments.user',
      'email name imageUrl role'
    );

    if (!post) {
      const error = new Error('Post does not exist!');
      error.statusCode = 404;
      throw error;
    }

    const commentIndex = post.comments.findIndex(
      (c) => c?._id.toString() === commentId.toString()
    );

    if (
      req.user.userId.toString() !==
      post.comments[commentIndex].user._id.toString()
    ) {
      const error = new Error('Not authorized!');
      error.statusCode = 401;
      throw error;
    }

    let isEdited;
    if (post.comments[commentIndex].edited) {
      isEdited = true;
    } else if (
      !post.comments[commentIndex].edited &&
      post.comments[commentIndex].text !== text
    ) {
      isEdited = true;
    }

    await Post.findOneAndUpdate(
      { _id: postId, 'comments._id': commentId },
      {
        $set: {
          'comments.$.text': text,
          'comments.$.edited': isEdited,
        },
      }
    );

    return res.status(201).json({
      postId,
      commentId: commentId,
      text,
      edited: isEdited,
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
    error.statusCode = 401;
    throw error;
  }

  try {
    const post = await Post.findById(postId).populate('creator', '_id');
    if (!post) {
      const error = new Error('Post does not exist!');
      error.statusCode = 404;
      throw error;
    }

    const findComment = post.comments.find(
      (comment) => comment._id.toString() === commentId.toString()
    );
    if (!findComment) {
      const error = new Error('This comment does not exist!');
      error.statusCode = 404;
      throw error;
    }

    if (findComment.user.toString() !== req.user.userId.toString()) {
      const error = new Error('Not authorized.');
      error.statusCode = 400;
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
    error.statusCode = 401;
    throw error;
  }

  try {
    const post = await Post.findById(postId).populate('creator', '_id name');
    const user = await User.findById(req.user.userId).select('_id name');
    if (!post) {
      const error = new Error('Post does not exist!');
      error.statusCode = 404;
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
      error.statusCode = 400;
      throw error;
    }

    // if is not liked
    if (!checkIfLiked) {
      const likeId = new mongoose.Types.ObjectId();
      if (checkIfUnliked) {
        await Post.findOneAndUpdate(
          { _id: postId },
          { $pull: { unlikes: { user: req.user.userId } } },
          {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true,
            useFindAndModify: false,
          }
        );
      }
      post.likes.push({
        _id: likeId,
        user: req.user.userId,
      });
      await post.save();

      const notification = new Notification({
        message: `${user.name} has liked your post`,
        sender: req.user.userId,
        to: post.creator._id,
        post: post._id,
        isRead: false,
      });

      await notification.save();

      return res.status(201).json({
        _id: likeId,
        postId,
        user: req.user.userId,
      });
    } else {
      // if is liked
      post.likes.pull(checkIfLiked._id);
      await post.save();
      return res.status(201).json({
        _id: checkIfLiked._id,
        postId,
        user: req.user.userId,
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
    error.statusCode = 401;
    throw error;
  }

  try {
    const post = await Post.findById(postId).populate('creator', '_id');
    if (!post) {
      const error = new Error('Post does not exist!');
      error.statusCode = 404;
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
      error.statusCode = 400;
      throw error;
    }

    // if is not unliked
    if (!checkIfUnliked) {
      const unlikeId = new mongoose.Types.ObjectId();
      if (checkIfLiked) {
        await Post.findOneAndUpdate(
          { _id: postId },
          { $pull: { likes: { user: req.user.userId } } },
          {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true,
            useFindAndModify: false,
          }
        );
      }
      post.unlikes.push({ _id: unlikeId, user: req.user.userId, postId });
      await post.save();
      return res.status(201).json({
        _id: unlikeId,
        postId,
        user: req.user.userId,
      });
    } else {
      // if is unliked
      post.unlikes.pull(checkIfUnliked._id);
      await post.save();
      return res.status(201).json({
        _id: checkIfUnliked._id,
        postId,
        user: req.user.userId,
      });
    }
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.getFavorites = async (req, res, next) => {
  if (!req.isAuth) {
    const error = new Error('Not authenticated!');
    error.statusCode = 401;
    throw error;
  }

  try {
    const favorites = await User.findById(req.user.userId)
      .select('favorites')
      .populate({
        path: 'favorites',
        select: {
          likes: 0,
          unlikes: 0,
          comments: 0,
        },
        populate: {
          path: 'creator',
          select: {
            name: 1,
          },
        },
      });

    if (!favorites) {
      const error = new Error('User does not exist!');
      error.statusCode = 404;
      throw error;
    }

    return res.status(200).json(favorites);
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
    error.statusCode = 401;
    throw error;
  }

  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      const error = new Error('User does not exist!');
      error.statusCode = 404;
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

exports.getCategories = async (req, res, next) => {
  try {
    let categories = await Category.find();
    const allCtg = categories.find((ctg) => ctg?.category === 'All');
    if (allCtg) {
      categories = categories?.filter((ctg) => ctg?.category !== 'All');
      return res.status(200).json({
        categories: [allCtg, ...categories],
      });
    }

    return res.status(200).json({
      categories,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.addCategory = async (req, res, next) => {
  const { category } = req.body;

  try {
    const ctg = new Category({
      category,
    });
    const data = await ctg.save();
    await ctg.save();
    return res.status(200).json(data);
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};
