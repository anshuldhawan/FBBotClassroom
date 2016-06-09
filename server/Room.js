/*
 * A chat room, closely tied to a socketio room concept, but also remembers chat
 * history and can talk to dumb http clients as well as sockets
 */

var Room = (function () {
	var rooms = {};

	// return this object if it looks like a socket
	// otherwise return null
	function isSocket(obj) {
		return typeof obj.join == "function" ? obj : null;
	}

	// return this object if it looks like an http response
	// otherwise return null
	function isResponse(obj) {
		return typeof obj.setHeader == "function" ? obj: null;
	}

	function randomRoomId() {
		var s = "";
		for (var i = 0; i < 6; i++) {
			s += String.fromCharCode(65 + Math.floor(Math.random() * 26));
			if (i == 2) {
				s += "-";
			}
		}
		console.log("Assigning Random Room id", s);
		return s;
	}

	function createRoom(roomid, io, hogan) {
		//TODO do this right w/prototypes
		var history = [];
		var openResponses = {};
		return {
			id: roomid,
			join: function (userid, socketOrResponse) {
				var socket = isSocket(socketOrResponse);
				var response = isResponse(socketOrResponse);
				if (socket) {
					socket.join(roomid);
				}
				if (response) {
					if (openResponses[userid]) {
						console.log("join room: replacing one response with another", userid);
					}
					openResponses[userid] = response;
				}
			},
			leave: function (userid, socketOrResponse) {
				var socket = isSocket(socketOrResponse);
				var response = isResponse(socketOrResponse);
				if (socket) {
					socket.leave(roomid);
				}
				if (response) {
					delete openResponses[userid];
				}
			},
			say: function (name, message) {
				var msgStruct = {
					name: name,
					message: message,
					timestamp: + new Date()
				};
				history.push(msgStruct);
				io.to(roomid).emit('event', {
					template: 'say',
					data: msgStruct
				});
				var html = null;
				for (var uid in openResponses) {
					var res = openResponses[uid];
					console.log("Write Unless Finished", uid, res.finished);
					if (res.finished) {
						setTimeout(function () {
							delete openResponses[uid];
						}, 0);
					} else {
						html = html || hogan.render('say', msgStruct);
						res.write(html);
					}
				}
			},
			history: function () {
				return history;
			}
		};
	}

	function findOrCreateRoom (roomid, io, hogan) {
		roomid = roomid || randomRoomId();
		if (!rooms[roomid]) {
			rooms[roomid] = createRoom(roomid, io, hogan);
		}
		return rooms[roomid];
	}

	return findOrCreateRoom;

}());

module.exports = Room;
