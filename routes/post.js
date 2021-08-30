const express = require('express');
const router = express.Router();

const postController = require('../controllers/post');

const isAuth = require('../middlewares/isAuth');

// @route    GET api/post
// @desc     Get public posts 
// @access   Public
router.get('/', postController.getPublicPosts);

// @route    GET api/post/all
// @desc     Get all posts 
// @access   Private [Only Admin]
router.get('/all', [isAuth], postController.getAllPosts);

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

// @route    Delete api/post
// @desc     Delete post
// @access   Private 
router.delete('/:id', [isAuth], postController.deletePost);

// @route    PUT api/post/status/:id
// @desc     Update post status
// @access   Private 
router.put('/status/:id', [isAuth], postController.updatePostStatus);

// @route    PUT api/post/comment/:postId
// @desc     Add Comment
// @access   Private 
router.put('/comment/:postId', [isAuth], postController.addComment);

// @route    DELETE api/post/comment/:postId/:commentId
// @desc     Delete Comment
// @access   Private 
router.delete('/comment/:postId/:commentId', [isAuth], postController.deleteComment);

// @route    PUT api/post/like/:postId
// @desc     Like Post
// @access   Private 
router.put('/like/:postId', [isAuth], postController.likePost);

// @route    DELETE api/post/like/:postId/:likeId
// @desc     Unlike Post
// @access   Private 
router.delete('/like/:postId/:likeId', [isAuth], postController.unlikePost);

// @route    PUT api/post/favorite/:postId
// @desc     Favorite/Unfavorite Post
// @access   Private 
router.put('/favorite/:postId', [isAuth], postController.favoritePost);

module.exports = router;