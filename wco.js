var debug = require("debug")("wco");

function wco(content, strict){
	return (this instanceof wco) ? this.parse(content, strict) : new wco(content, strict);
};

wco.prototype.parse = function(content, strict) {
	var self = this;
	
	self.strict = !!strict;
	
	var templates = this.templates(content);
	
	var coordinates = templates.filter(function(template){
		// filter coordinate templates
		return (["coordinate","coord"].indexOf(template.name) >= 0)
	}).map(function(template){
		return self.coord(template);
	}).filter(function(coord){
		return (!!coord && coord.indexOf(null) < 0);
	});
		
	return coordinates;
	
};

wco.prototype.coord = function(template){
	var self = this;

	// parse values
	var coord = template.values.split(/\|/g).reduce(function(tmpl,v){
		val = self.trim(v);
		
		// check if key=value
		if (v.indexOf("=") > 0) {
			v=v.split(/=/g).map(function(vv){ return self.trim(vv); });
			tmpl.kv[v.shift().toLowerCase()] = v.join("=");
		} else if (v.indexOf(":") > 0) {
			v=v.split(/:/g).map(function(vv){ return self.trim(vv); });
			tmpl.kv[v.shift().toLowerCase()] = v.join(":");
		} else {
			tmpl.v.push(val);
		}
		
		return tmpl;
	},(function(t){ return t.kv={},t.v=[],t })(template));

	// debug("<coord> %j", coord);

	switch (coord.name) {
		case "coord": // enwiki style: https://en.wikipedia.org/wiki/Template:Coord

			// check if template relates to main article
			if (self.strict && (!coord.kv.display || ["title","inline,title","title,inline","t","ti","it"].indexOf(coord.kv.display.toLowerCase()) < 0)) return debug("<fail> display not title"), null;
			
			if (coord.v.length === 2 && /^(\+|\-)?[0-9]+(\.[0-9]+)?$/.test(coord.v[0]) && /^(\+|\-)?[0-9]+(\.[0-9]+)?$/.test(coord.v[1])) { // float format
				
				return [ parseFloat(coord.v[1]), parseFloat(coord.v[0]) ]
				
			} else { // other format

				// empty values are for zero
				coord.v = coord.v.map(function(v){ return (!!v) ? v : 0; });
				
				switch (coord.v.length) {
					case 4:
						var ns = coord.v.slice(0,2);
						var ew = coord.v.slice(2,4);
					break;
					case 6:
						var ns = coord.v.slice(0,3);
						var ew = coord.v.slice(3,6);
					break;
					case 8:
						var ns = coord.v.slice(0,4);
						var ew = coord.v.slice(4,8);
					break;
					default:
						return debug("<fail> unrecognized format: %j", coord.v), null; // not a known format
					break;
				}
				
				return [
					self.lonlat(ew),
					self.lonlat(ns)
				];

			}

		break;
		case "coordinate": // dewiki style: https://de.wikipedia.org/wiki/Vorlage:Coordinate

			// check if template relates to main article
			if (self.strict && coord.kv.article !== '/') return debug("<fail> article not '/': %j", coord.kv), null;
			
			// check if data is complete
			if (!coord.kv.ew || !coord.kv.ns) return debug("<fail> incomplete: %j", coord.kv), null;
			
			return [
				self.lonlat(coord.kv.ew.split(/\//g)),
				self.lonlat(coord.kv.ns.split(/\//g))
			];
			
		break;
	}
	
};

// parse lon/lat
wco.prototype.lonlat = function(l){

	var h = (/^[NSEWO]$/i.test(l[l.length-1])) ? l.pop().toLowerCase() : null;
	
	var d = parseFloat(l.shift()||0);
	var m = parseFloat(l.shift()||0);
	var s = parseFloat(l.shift()||0);
	
	if (d < 0 && !!h) debug("<fail> negative degrees and specific hemisphere: %d,%d,%d,%s",d,m,s,h);

	return this.dms(d,m,s,h)

};

// extract templates
wco.prototype.templates = function(content){
	var self = this;

	// remove comments
	content = content.replace(/<!--.*?-->/gs,'');

	// collect template tags
	var templates = [];
	var found;
	do {
		found = false;
		content = content.replace(/\{\{.([^\}\{]|[\}\{][^\}\{])*\}\}/gs,function(res){
			found = true;
			templates.push(res);
			return "";
		});
	} while (found);
	
	// template
	templates = templates.map(function(template){
		
		template = template.match(/^\{\{([^\|]+)(\|(.*))?\}\}$/s);
		
		if (!template) return null;
		
		// normalize name
		return {
			name: self.trim(template[1]).toLowerCase(),
			values: (template[3]||null)
		}
		
	});
	
	return templates;
}

// convert dms to float
wco.prototype.dms = function(d,m,s,h) {
	return (this.float(d) + ((this.float(m)||0)/60) + ((this.float(s)||0)/3600)) * (!h||("neo".indexOf(this.trim(h).toLowerCase().substr(0,1)) >= 0) ? 1 : -1);
};

// convert string to float
wco.prototype.float = function(v){
	return parseFloat(this.trim(v));
};

// trim string
wco.prototype.trim = function(v){
	return v.toString().replace(/^\s+|\s+$/g,'');
};

module.exports = wco;
