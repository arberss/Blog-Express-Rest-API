const path = require('path');

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const multer = require('multer');
const process = require('process');
const moment = require('moment');
const helmet = require("helmet");

const userRoutes = require('./routes/user');
const postRoutes = require('./routes/post');

require('dotenv').config();

const app = express();

const generateRandomString = require('./utils/generateRandomString');

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'images');
  },
  filename: (req, file, cb) => {
    cb(null, generateRandomString(12) + '-' + file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === 'image/png' ||
    file.mimetype === 'image/jpg' ||
    file.mimetype === 'image/jpeg'
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

// app.use(bodyParser.urlencoded()); // x-www-form-urlencoded <form>
app.use(bodyParser.json({limit: '50mb'})); // application/json
app.use(
  multer({ storage: fileStorage, fileFilter: fileFilter }).single('imageUrl')
);
app.use('/images', express.static(path.join(__dirname, 'images')));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'OPTIONS, GET, POST, PUT, PATCH, DELETE'
  );
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

app.use('/api/user', userRoutes);
app.use('/api/post', postRoutes);

app.use(helmet());

app.use((error, req, res, next) => {
  console.log(error);
  const status = error.statusCode || 500;
  const message = error.message;
  res.status(status).json({ message: message });
});

const dbConnection = async () => {
  try {
    await mongoose.connect(`${process.env.MONGO_CONNECT}`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('connected');
    const server = app.listen(process.env.PORT || 5000);

    const sck = require('./socket');
    const io = sck.init(server);

    let onlineUsers = [];

    io.on('connection', (socket) => {
      console.log('Socket connected');

      socket.on('newUser', (user) => {
        if (user?.userId) {
          sck.addUser(onlineUsers, user);
        }

        socket.on('sendNotification', (data) => {
          const postCreator = sck.findUser(onlineUsers, data.to);

          if (postCreator) {
            const currentUser = sck.getCurrentUser(onlineUsers, socket.id);
            const newId = new mongoose.Types.ObjectId();

            socket.broadcast.to(postCreator.socketId).emit('newNotification', {
              _id: newId,
              message: `${postCreator.userName} has liked your post`,
              sender: currentUser.userId,
              to: postCreator.userId,
              createdAt: moment().format('h:mm A'),
              isRead: false,
              post: { _id: data.post.id, postStatus: data.post.postStatus },
            });
          }
        });
      });

      socket.on('disconnect', () => {
        console.log('user disconected');

        const newList = sck.removeUser(onlineUsers, socket.id);
        if (newList) {
          onlineUsers = newList;
        }
      });
    });
  } catch (error) {
    console.log(error);
  }
};

// call DB function
dbConnection();
