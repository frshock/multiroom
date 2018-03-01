const express = require('express'),
          app = express(),
       server = require('http').createServer(app),
           io = require('socket.io')(server),
         PORT = process.env.PORT || 8080,
    usernames = {},
        rooms = ['Lobby','Learning Room','Random']


app.use(express.static('build'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

//All sockets run through this process on connection, and force them through our chat pipeline.
io.sockets.on('connection', socket=>{
  /*
    Socket event listener for when a user first joins the chat.  We first assign the socket the username that they sent with the prompt, or assign it a predefined name of
    Anonymous if they cancel out of the prompt so that they aren't named null.  We put all new users into Room 1 right away so that they have access to the room structure
    that's defined throughout our app.  Then we broadcast to all the other sockets that are in Room 1 that a new user has joined the chat.
  */
  socket.on('adduser', (username)=>{
    username === null ? username = 'Anonymous' : username //Use default value or the value provided if there is one.
		socket.username = username //Assign username to the socket.
		socket.room = 'Lobby' //Assign default room to the socket.
		usernames[username] = username //Add username to the list of usernames.
		socket.join('Lobby') //Connect the socket to the default room.
    socket.emit('client:joinchat', username, socket.room) //Tell the client that they're connected to the chat.
		socket.broadcast.to(socket.room).emit('updatechat', 'SERVER',username+' has joined the channel.') //Notify all other sockets that a new user has joined.
		socket.emit('updaterooms', rooms, `${socket.room}`) //Update the room list for the client.
	})

  /*
    Event listener for adding a NEW room to our list.
    We start by updating the array of our chat rooms by pushing the new room value into our array of rooms. We then remove the user from the room that they're currently in, as
    it's generally safe to assume that by creating a room they want to move into that room directly.  We then make them join the newly created room, and broadcast to the previous
    room that the user left their room.  We then notify the user that they have joined a new room.  A more sophisticated approach to this would be to first check if a room with
    the name they entered exists first, and if it does, simply connect them to that room.
  */
	socket.on('addroom', room=>{
    rooms.push(room.roomname) //Add room to array.
    socket.leave(socket.room) //Remove user from previous room.
    socket.join(room.roomname) //Join new room.
    socket.broadcast.to(socket.room).emit('updatechat', 'SERVER', socket.username+' has left this room') //Broadcast that user left old room.
    socket.room = room.roomname //Assign the room name to the socket.
    socket.emit('client:joinchat', socket.username, room.roomname) //Emit to client that they've joined new room.
    io.emit('updaterooms', rooms, room.roomname) //Emit to all sockets that there is a new room on the list.
	})

  /*
    Event listener for switching rooms.
    Similar to adding a new room, we start by removing the client from their old room, then joining a new room.  We then tell the client they've joined a new room, and broadcast
    to all other clients that a user has left their room.  We then broadcast to the new room that a new user has joined their room.  We finish by updating the list of rooms.
  */
  socket.on('switchRoom', newroom=>{
    if(newroom !== socket.room){
      socket.leave(socket.room)
      socket.join(newroom)
      socket.emit('client:joinchat', 'SERVER', newroom)
      socket.broadcast.to(socket.room).emit('updatechat', 'SERVER', socket.username+' has left this room')
      socket.room = newroom
      socket.broadcast.to(newroom).emit('updatechat', 'SERVER', socket.username+' has joined this room')
      socket.emit('updaterooms', rooms, newroom)
    }
    else{
      socket.emit('client:channelerror', 'SERVER', 'You\'re already in that channel!')
    }
	})

  // Whenever we see a sendchat event, we simply send the text and the user that sent it along to all the sockets in the users room.
	socket.on('sendchat', data=> {
		io.sockets.in(socket.room).emit('updatechat', socket.username, data);
	})

  /*
    Event listener for a socket disconnecting.
    When we see a socket disconnect, we remove their username from our hashtable of all the users.  We then emit to all users that a user has disconnected from the chat, we then
    remove the socket from the room that they were in last.
  */
	socket.on('disconnect', ()=>{
		delete usernames[socket.username] //Remove the username from our table of usernames.
		io.sockets.emit('updateusers', usernames) //Update the userlist on each of our clients.
		socket.broadcast.emit('updatechat', 'SERVER', socket.username + ' has disconnected') //Broadcast that a user has disconnected from the chat.
		socket.leave(socket.room) //Remove the socket from the room that they were in last.
	})
})

app.get('*', (req,res)=>{
  res.sendFile(__dirname + '/build/index.html')
})

/*
  Tell our server to listen on the port that's specified when executing the file || 8080
*/
server.listen(PORT, ()=>{
    console.log(`Listening on ${PORT}`)
})
