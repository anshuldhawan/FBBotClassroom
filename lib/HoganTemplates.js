var HoganTemplates = (function () {
	/**
	 * return a string of HTML to render in the browser
	 * Built to operate on the client or the server.
	 * @t String|Array the template or templates to render
	 * @data the data to send to the template[s]
	 * @templates map off all the templates
	 */
	function render(t, data, templates, sources) {
		var s = "";
		//var debug = "\n<pre>" + JSON.stringify(data, null, 2) + "</pre>\n";

		if (!Array.isArray(t)) {
			t = [t];
		}
		t.forEach(function (tt) {
			if (templates[tt]) {
				// cook the template if it is raw.
				if (!templates[tt].b) {
					templates[tt] = new Hogan.Template(templates[tt], sources[tt], Hogan, {});
				}
				s += templates[tt].render(data);
			}
		});
		return s;
	}

	return {
		render: render
	};
}());

if (typeof module != "undefined") {
	module.exports = HoganTemplates;
}
