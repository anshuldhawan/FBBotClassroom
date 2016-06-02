if (typeof module != "undefined") {
	var hogan = require('hogan.js');
	var fs = require('fs');
	var HoganTemplates = require('../lib/HoganTemplates.js');
}

var HoganServer = (function () {
	var tail, jscode, templates = {}, templatesjs = [], templatesource = {};
	// If you add a new .hogan file, you must add it to this list.
	// TODO: we could get all fancy and read the directory
	var alltemplates = [
		"head",
		"join",
		"say",
		"tail",
		"home"
	];

	function compileAll() {
		alltemplates.forEach(function (fname) {
			var f = fs.readFileSync('../lib/' + fname + '.hogan', 'utf8');
			templates[fname] = hogan.compile(f);
			if (fname != "head") {
				templatesource[fname] = f;
				templatesjs.push(fname + ":" + hogan.compile(f, { asString: true } ).replace(/\<\/script/g, '</s"+"cript'));
			}
		});
		jscode = '<script type="text/javascript">\n' +
			"var hoganTemplates = {" + templatesjs.join(",\n") + "};\n" +
			"var hoganTemplateSources = " + JSON.stringify(templatesource) + ";\n" +
			';\n</script>\n' +
			'<script src="/assets/hogan.js"></script>\n' +
			'<script src="/assets/lib/HoganTemplates.js"></script>\n' +
			'<script src="/assets/lib/Client.js"></script>\n'
			;
	}

	/**
	 * return a string of HTML to send to the browser
	 * @t String|Array the template or templates to render
	 * @obj the data to send to the template[s]
	 * @includeJS if true, the client has indicated it runs javascript, so send it on down
	 */
	function render(t, obj, includeJS) {
		if (obj.hasOwnProperty('hasJS')) {
			obj.jscode = obj.hasJS ? jscode : "";
		}
		return HoganTemplates.render(t, obj, templates);
	}

	return {
		compileAll: compileAll,
		render: render
	};
}());

if (typeof module != "undefined") {
	module.exports = HoganServer;
}
