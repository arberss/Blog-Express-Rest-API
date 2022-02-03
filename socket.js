let io;
let socketData;

const addUser = (list, data) => {
  const checkUser = list?.find((ls) => ls?.userId === data?.userId);
  if (!checkUser) {
    list.push(data);
  }
};

const findUser = (list, user) => {
  const checkUser = list?.find((ls) => ls?.userId === user);
  return checkUser;
};

const getCurrentUser = (list, user) => {
  const checkUser = list?.find((ls) => ls?.socketId === user);
  return checkUser;
};

const removeUser = (list, user) => {
  const checkUser = list?.filter((ls) => ls?.socketId !== user);
  return checkUser;
};

module.exports = {
  init: (httpServer) => {
    io = require('socket.io')(httpServer, { cors: { origin: '*' } });
    return io;
  },
  getIO: () => {
    if (!io) {
      throw new Error('Socket.io not initialized!');
    }
    return io;
  },
  setSocket: (socket) => {
    socketData = socket;
    return socketData;
  },
  getSocket: () => {
    return socketData;
  },
  addUser,
  findUser,
  removeUser,
  getCurrentUser,
};
