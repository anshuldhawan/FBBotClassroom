var SocketClient = (function () {
	var socketUrl = document.location.protocol + "//" + document.location.host;
	var socket = io(socketUrl);
	socket.on('connect', function () {
		console.log("connected to socket!");
		if (document.location.pathname.match(/join/)) {
			socketRest('join', {});
		}
	});
	socket.on('event', function (output) {
		console.log("event on socket", output);
	});
	socket.on('disconnect', function () {
	});

	function socketRest(command, data) {
		console.log("sending a command", command, data);
		socket.emit('event', {
			command: command,
			data: data
		});
	}

	function convertForms() {
		var forms = document.querySelectorAll("form");
		Array.prototype.forEach.call(forms, function (form) {
			console.log("converting form", form);
			var command = form.action.replace(/^.*\//, "");
			form.onsubmit = function () {
				console.log("intercept submit", form.action);
				var inputs = form.querySelectorAll("input[type=text]");
				var data = {};
				Array.prototype.forEach.call(inputs, function (input) {
					data[input.name] = input.value;
				});
				socketRest(command, data);
				return false;
			};
		});
	}

	document.addEventListener('DOMContentLoaded', function () {
		console.log("DOCUMENT LOADED, CONVERTING FORMS");
		convertForms();
	});

	return socketRest;

}());
