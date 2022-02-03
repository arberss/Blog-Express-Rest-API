const express = require('express');
const router = express.Router();

const postController = require('../controllers/post');

const isAuth = require('../middlewares/isAuth');

// @route    GET api/post
// @desc     Get public posts
// @access   Public
router.get('/public', postController.getPublicPosts);

// @route    GET api/post/all
// @desc     Get all posts
// @access   Private [Only Admin]
router.get('/all/:category?', [isAuth], postController.getAllPosts);

// @route    GET api/post/private
// @desc     Get all private posts
// @access   Private [Current User Posts]
router.get('/private', [isAuth], postController.getPrivatePosts);

// @route    GET api/post/id
// @desc     Get single post
// @access   Private
router.get('/:id', [isAuth], postController.getPost);

// @route    POST api/post
// @desc     Create post
// @access   Private
router.post('/', [isAuth], postController.createPost);

// @route    POST api/post
// @desc     Update post
// @access   Private
router.put('/:id', [isAuth], postController.updatePost);

// @route    Delete api/post/:id
// @desc     Delete post
// @access   Private
router.delete('/:id', [isAuth], postController.deletePost);

// @route    PUT api/post/status/:id
// @desc     Update post status
// @access   Private
router.put('/status/:id', [isAuth], postController.updatePostStatus);

// @route    GET api/post/comments/:postId
// @desc     Get Comments
// @access   Private
router.get('/comments/:postId', [isAuth], postController.getComments);

// @route    PUT api/post/comment/:postId
// @desc     Add Comment
// @access   Private
router.put('/comment/:postId', [isAuth], postController.addComment);

// @route    Edit api/post/comment/edit/:postId/:commentId
// @desc     Edit Comment
// @access   Private
router.put(
  '/comment/edit/:postId/:commentId',
  [isAuth],
  postController.editComment
);

// @route    DELETE api/post/comment/:postId/:commentId
// @desc     Delete Comment
// @access   Private
router.delete(
  '/comment/:postId/:commentId',
  [isAuth],
  postController.deleteComment
);

// @route    PUT api/post/like/:postId
// @desc     Like Post
// @access   Private
router.put('/like/:postId', [isAuth], postController.likePost);

// @route    PUT api/post/unlike/:postId/:likeId
// @desc     Unlike Post
// @access   Private
router.put('/unlike/:postId', [isAuth], postController.unlikePost);

// @route    GET api/post/favorite
// @desc     Get favorite posts
// @access   Private
router.get('/favorite/all', [isAuth], postController.getFavorites);

// @route    PUT api/post/favorite
// @desc     Favorite/Unfavorite Post
// @access   Private
router.put('/favorite/:postId', [isAuth], postController.favoritePost);

// @route    GET api/post/categories
// @desc     Get Categories
// @access   Public
router.get('/categories/all', postController.getCategories);

// @route    POST api/post/categories
// @desc     Add Category
// @access   Private
router.post('/categories', [isAuth], postController.getCategories);

module.exports = router;
