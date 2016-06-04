var SocketClient = (function () {
	var socketUrl = document.location.protocol + "//" + document.location.host;
	var socket = io(socketUrl);

	function renderToDiv(div, template, data, append) {
		div = document.querySelector(div);
		if (div) {
			var html = HoganTemplates.render(template, data, hoganTemplates, hoganTemplateSources);
			if (!append) {
				div.innerHTML = "";
			}
			div.innerHTML = div.innerHTML + html;
		}
	}

	function handleCookies(cookieObj) {
		var val;
		for (var key in cookieObj) {
			val = cookieObj[key];
			if (val) {
				document.cookie = key + "=" + val + "; path=/";
			} else {
				// falsy value means clear the cookie.
				document.cookie = key + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC";
			}
		}
	}

	var Render = {
		join: function (data) {
			renderToDiv("body", "join", data, false);
			convertForms();
		},
		say: function (data) {
			renderToDiv(".join .history", "say", data, true);
		},
		home: function (data) {
			renderToDiv("body", "home", data, false);
			convertForms();
		}
	};

	socket.on('connect', function () {
		console.log("connected to socket!");
		if (document.location.pathname.match(/join/)) {
			socketRest('join', {});
		}
	});
	socket.on('event', function (output) {
		console.log("event on socket", output);
		if (output.cookies) {
			handleCookies(output.cookies);
		}
		if (output.template && Render[output.template]) {
			Render[output.template](output.data);
		}
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
				var messageInput = form.querySelector("input.message");
				if (messageInput) {
					messageInput.value = "";
				}
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
