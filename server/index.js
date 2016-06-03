var http = require('http');
var dispatcher = require('httpdispatcher');
var fs = require('fs');
var Cookies = require('cookies');
var Keygrip = require('keygrip');
var url = require('url');
var SocketIo = require('socket.io');
var port = process.env.PORT || 3000;
var Room = require('./Room.js');
var HoganServer = require('./HoganServer.js');

var SESSION_COOKIE = "rbuserid";
var JAVASCRIPT_COOKIE = "javascript";
var ROOM_COOKIE = "rbroom";

function log() {
	if (true) {
		console.log.apply(console, Array.prototype.slice.call(arguments));
	}
}

var comment1k = fs.readFileSync("./comment1k.html", "utf-8");

HoganServer.compileAll();

function handleRequest(req, res) {
	var cookies = new Cookies(req, res);
	var ustruct = url.parse(req.url, true);
	var query = ustruct.query;
	var patha = ustruct.pathname.split("/");
	var myId = cookies.get(SESSION_COOKIE);
	var myRoom = cookies.get(ROOM_COOKIE);
	var hasJS = cookies.get(JAVASCRIPT_COOKIE);

	while(patha.length && patha[0] == "") {
		patha.shift();
	}

	var command = patha[0];

	if (query.name && query.phone) {
		// TODO: Validate name & phone, no slashes, etc.
		myId = query.name + "/" + query.phone;
		cookies.set(SESSION_COOKIE, myId);
	}

	var s = {
		request: req,
		response: res,
		cookies: cookies,
		command: command,
		data: ustruct.query,
		myId: myId,
		myRoom: myRoom,
		hasJS: hasJS
	};

	res.setHeader('Content-type', 'text/html');

	if (!myId) {
		handleRest('home', s);
		return;
	}

	if (command == 'join' && myRoom && ! s.data.room) {
		s.data.room = myRoom;
	}

	if (!myRoom && command != 'join') {
		handleRest('home', s);
		return;
	}

	handleRest(command, s);
}

var server = http.createServer(handleRequest);
var io = SocketIo(server);

server.listen(port, function () {
  log('Server listening at port %d', port);
});

function keepOpen(response, owner) {
	log("Keeping a response open", owner);

	response.on('timeout', function () {
		log("Got timeout on open response", owner);
	});

	response.on('close', function () {
		log("Got close on open response", owner);
	});

	// Prime the pump so the browser will decide to render
	response.write(comment1k);
}

function finishUp(response) {
	if (!response.finished) {
		response.end(HoganServer.render('tail', {}));
	}
}

var Rest = {
	// join or create a room
	'join': function (params) {
		if (params.data.hasOwnProperty("room")) { // we have a room to join
			if (params.myRoom && params.myRoom != params.data.room) { // leave the old room first
				var oldRoom = Room(params.myRoom, io, HoganServer);
				oldRoom.leave(params.myId, params.socket || params.response);
			}
			var newRoom = Room(params.data.room, io, HoganServer);
			newRoom.join(params.myId, params.socket || params.response);
			if (params.response) {
				params.cookies.set(ROOM_COOKIE, newRoom.id);
				if (params.hasJS == null) {
					params.keepOpen = true;
					keepOpen(params.response, params.myId);
				}
			}
			render(params, {
				template: "join",
				data: {
					room: newRoom.id,
					history: newRoom.history()
				}
			});
		}
	},
	// leave the room
	'leave': function (params) {
		if (params.myRoom) {
			var room = Room(params.myRoom, io, HoganServer);
			room.leave(params.myId, params.socket || params.response);
		}
		if (params.response) {
			params.cookies.set(ROOM_COOKIE);
		}
		render(params, {
			template: "home",
			data: {
				name: "",
				phone: "",
				room: ""
			}
		});
	},
	// add a chat message to the room
	'say': function (params) {
		if (params.myRoom) {
			var room = Room(params.myRoom, io, HoganServer);
			room.say(params.myId, params.data.message);
			if (params.response) {
				log("redirecting to join", params.myId);
				params.response.writeHead(302, { "Location": "/join" });
				params.response.end();
			}
		}
	},
	// display the login page
	'home': function (params) {
		var data = {};
		if (params.myId) {
			var a = params.myId.split("/");
			data.name = a[0];
			data.phone = a[1];
		}
		if (params.myRoom) {
			data.room = params.myRoom;
		}
		render(params, {
			template: 'home',
			data: data
		});
	}
};

function handleRest(command, params) {
	if (Rest[command]) {
		log("handling rest command", command, params.data);
		Rest[command](params);
		return;
	}
	log("unknown rest command", command);
}

function render(params, output) {
	if (params.socket) {
		log("rendering to a socket", params.myId);
		params.socket.emit(output.template, output.data);
	} else if (params.response) {
		log("rendering to a response", params.myId);
		params.response.write(HoganServer.render('head', {
			hasJS: params.hasJS
		}));
		params.response.write(HoganServer.render(output.template, output.data));
		if (!params.keepOpen) {
			console.log("Rendinering the tail");
			params.response.end(HoganServer.render('tail', {}));
		}
	}
}

io.on('connection', function (socket) {
	// NOTE: Can't call set on this cookies since there is no response object.
	var cookies = new Cookies(socket.request, null);
	var myId = cookies.get(myId);
	var myRoom = cookies.get(myRoom);

	for (var command in Rest) {
		socket.on(command, function (data) {
			handleRest(command, {
				socket: socket,
				cookies: cookies,
				command: command,
				data: data,
				myId: myId,
				myRoom: myRoom,
				hasJS: true
			});
		});
	}

  // when the user disconnects.. perform this
  socket.on('disconnect', function () {
		handleRest('leave', {
			socket: socket,
			cookies: cookies,
			command: 'leave',
			myId: myId,
			myRoom: myRoom
		});
  });
});
