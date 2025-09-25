export function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    socket.on('meeting:join', ({ meetingId, userId }) => {
      socket.join(meetingId);
      socket.to(meetingId).emit('meeting:user_joined', { userId });
    });

    socket.on('meeting:leave', ({ meetingId, userId }) => {
      socket.leave(meetingId);
      socket.to(meetingId).emit('meeting:user_left', { userId });
    });

    socket.on('disconnect', () => {});
  });
}


