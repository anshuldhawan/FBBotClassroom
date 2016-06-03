var http = require('http');
var fs = require('fs');
var Cookies = require('cookies');
var Keygrip = require('keygrip');
var url = require('url');
var SocketIo = require('socket.io');
var port = process.env.PORT || 3000;
var Room = require('./Room.js');
var HoganServer = require('./HoganServer.js');

var NAME_COOKIE = "name";
var PHONE_COOKIE = "phone";
var JAVASCRIPT_COOKIE = "javascript";
var SUPPRESS_JS_COOKIE = "supress_js";
var ROOM_COOKIE = "room";

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
	var myName = cookies.get(NAME_COOKIE);
	var myPhone = cookies.get(PHONE_COOKIE);
	var myRoom = cookies.get(ROOM_COOKIE);
	var suppressJS = cookies.get(SUPPRESS_JS_COOKIE);
	var hasJS = cookies.get(JAVASCRIPT_COOKIE);
	var myId = null;

	if (suppressJS == "YES") {
		hasJS = null;
	}

	if (query.name && query.phone) {
		// TODO: Validate name & phone, no slashes, etc.
		myName = query.name;
		myPhone = query.phone;
		cookies.set(NAME_COOKIE, myName);
		cookies.set(PHONE_COOKIE, myPhone);
	}

	if (myName && myPhone) {
		myId = myName + "/" + myPhone;
	}

	while(patha.length && patha[0] == "") {
		patha.shift();
	}

	var command = patha[0] || "home";

	var s = {
		request: req,
		response: res,
		cookies: cookies,
		command: command,
		patha: patha,
		data: ustruct.query,
		myId: myId,
		myName: myName,
		myPhone: myPhone,
		myRoom: myRoom,
		hasJS: hasJS
	};


	if (command == "assets") {
		handleAssets(s);
		return;
	}

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
				if (params.hasJS == null) {
					params.keepOpen = true;
					keepOpen(params.response, params.myId);
				}
			}
			render(params, {
				template: "join",
				data: {
					room: newRoom.id,
					viewer: params.data.name || params.myName,
					history: newRoom.history()
				},
				cookies: {
					room: newRoom.id,
					name: params.data.name || params.myName,
					phone: params.data.phone || params.myPhone
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
				name: params.myName,
				phone: params.myPhone,
				room: ""
			},
			cookies: {
				room: null
			}
		});
	},
	// add a chat message to the room
	'say': function (params) {
		if (params.myRoom) {
			var room = Room(params.myRoom, io, HoganServer);
			room.say(params.myName, params.data.message);
			if (params.response) {
				log("redirecting to join", params.myId);
				params.response.writeHead(302, { "Location": "/join" });
				params.response.end();
			}
		}
	},
	// display the login page
	'home': function (params) {
		var data = {
			name: params.myName,
			phone: params.myPhone,
			room: params.myRoom
		};
		render(params, {
			template: 'home',
			data: data
		});
	}
};

function do404(command, response) {
	if (response) {
		response.writeHead(404, { "Content-type": "text/plain" });
		response.end("Not found: " + command);
	}
}

function handleAssets(params) {
	var req = params.request;
	var res = params.response;
	if (params.patha[1] == "lib" && params.patha[2]) {
		var contentType = "text/plain";
		var suffix = params.patha[2].match(/\..*$/);
		if (suffix) {
			switch(suffix[0]) {
			case ".js":
				contentType = "text/javascript";
				break;
			case ".jpg":
				contentType = "image/jpeg";
				break;
			case ".png":
				contentType = "image/png";
				break;
			}
		}
		try {
			var file = fs.readFileSync('../lib/' + params.patha[2]);
			res.writeHead(200, {
				"Content-type": contentType,
				"cache-control": "public, max-age=31536000"
				});
			res.end(file);
			return;
		} catch (e) {
			console.log("missing file", params.patha[2]);
		}
	}
	do404(req.url, res);
}
function handleRest(command, params) {
	if (Rest[command]) {
		log("handling rest command", command, params.data);
		Rest[command](params);
		return;
	}
	log("unknown rest command", command);
	do404(command, params.response);
}

function render(params, output) {
	if (params.socket) {
		log("rendering to a socket", params.myId);
		params.socket.emit('event', output);
	} else if (params.response) {
		log("rendering to a response", params.myId);
		if (output.cookies && params.cookies) {
			for (var key in output.cookies) {
				params.cookies.set(key, output.cookies[key]);
			}
		}
		if (params.keepOpen) {
			// Prime the pump so the browser will decide to render
			params.response.write(comment1k);
		}
		params.response.write(HoganServer.render('head', {
			hasJS: params.hasJS,
			name: params.myName
		}));
		params.response.write(HoganServer.render(output.template, output.data));
		if (!params.keepOpen) {
			console.log("Rendering the tail");
			params.response.end(HoganServer.render('tail', {}));
		}
	}
}

io.on('connection', function (socket) {
	// NOTE: Can't call set on this cookies since there is no response object.
	// instead, we send the cookies we want to set on the socket message and set them
	// on the client via javascript.
	var cookies = new Cookies(socket.request, null);
	var myName = cookies.get(NAME_COOKIE);
	var myPhone = cookies.get(PHONE_COOKIE);
	var myId = null;
	var myRoom = cookies.get(ROOM_COOKIE);

	if (myName && myPhone) {
		myId = myName + "/" + myPhone;
	}

	log("server got socket connection for", myId);

	socket.on('event', function (input) {
		log("handling socket rest request", input);

		// Set some default values if they weren't passed in
		input.data.room = input.data.room || myRoom;
		input.data.name = input.data.name || myName;
		input.data.phone = input.data.phone || myPhone;

		handleRest(input.command, {
			socket: socket,
			cookies: cookies,
			command: input.command,
			data: input.data,
			myId: myId,
			myName: myName,
			myPhone: myPhone,
			myRoom: myRoom,
			hasJS: true
		});
	});

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
