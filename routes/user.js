const express = require('express');
const router = express.Router();

const userController = require('../controllers/user');

const isAuth = require('../middlewares/isAuth');

// @route    POST api/user/create
// @desc     Create user 
// @access   Public
router.post('/create', userController.createUser);

// @route    POST api/user/login
// @desc     lOGIN
// @access   Public
router.post('/login', userController.login);

// @route    GET api/user
// @desc     Get current user
// @access   Private
router.get('/', [isAuth], userController.currentUser);

// @route    PUT api/user
// @desc     Update current user
// @access   Private
router.put('/', [isAuth], userController.updateUser);

// @route    GET api/user/all
// @desc     Get all users
// @access   Private
router.get('/all', [isAuth], userController.allUsers);

// @route    PUT api/user/admin-role/:userId
// @desc     Admin Update Roles
// @access   Private
router.put('/admin-role/:userId', [isAuth], userController.adminUpdateRoles);

// @route    PUT api/user/user-role
// @desc     User Update Roles
// @access   Private
router.put('/user-role', [isAuth], userController.updateUserRole);

// @route    POST api/user/forgot-password
// @desc     Forgot Password
// @access   Public
router.post('/forgot-password', userController.forgotPassword);

// @route    POST api/user/reset-password/:token
// @desc     Forgot Password
// @access   Public
router.post('/reset-password/:token', userController.resetPassword);

// @route    DELETE api/user
// @desc     Delete User
// @access   Private
router.delete('/:id', [isAuth], userController.deleteUser);

module.exports = router;