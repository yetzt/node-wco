var debug = require("debug")("wco");

function wco(content, strict, title){
	return (this instanceof wco) ? this.parse(content, strict, title) : new wco(content, strict, title);
};

// parse wikitext
wco.prototype.parse = function(content, strict, title) {
	var self = this;
	
	self.strict = !!strict;
	self.title = title || "-";
	
	var templates = this.templates(content);

	var coordinates = templates.filter(function(template){
		if (!template) debug("<parse problem> [%s]", self.title);
		// filter coordinate templates
		return (!!template && ["coordinate","coord"].indexOf(template.name) >= 0)
	}).map(function(template){
		return self.coord(template);
	}).filter(function(coord){
		return (!!coord && coord.indexOf(null) < 0);
	});
		
	return coordinates;
	
};

// extract coordinates
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
			if (val !== "") tmpl.v.push(val);
		}
		
		return tmpl;
	},(function(t){ return t.kv={},t.v=[],t })(template));

	// debug("<coord> %j", coord);

	switch (coord.name) {
		case "coord": // enwiki style: https://en.wikipedia.org/wiki/Template:Coord

			// check if template relates to main article
			if (self.strict && (!coord.kv.display || ["title","inline,title","title,inline","t","ti","it"].indexOf(coord.kv.display.toLowerCase()) < 0)) return /* debug("<fail> display not title"), */ null;
			
			if (coord.v.length === 2 && /^(\+|\-)?[0-9]+(\.[0-9]*)?$/.test(coord.v[0]) && /^(\+|\-)?[0-9]+(\.[0-9]*)?$/.test(coord.v[1])) { // float format
				
				return [ parseFloat(coord.v[1]), parseFloat(coord.v[0]) ]
				
			} else { // other format

				// filter everything that isn't a coordinate or hemisphere
				coord.v = coord.v.filter(function(v){ return /^([0-9]+(\.[0-9]*)?|[nsweo])$/i.test(v); });
				
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
						return debug("<fail> [%s] unrecognized format: %j", self.title, coord.v), null; // not a known format
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
			if (self.strict && coord.kv.article !== '/') return /*debug("<fail> article not '/': %j", coord.kv), */null;
			
			// check if data is complete
			if (!coord.kv.ew || !coord.kv.ns) return debug("<fail> [%s] incomplete: %j", self.title, coord.kv), null;
			
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
	
	if (d < 0 && !!h) debug("<fail> [%s] negative degrees and specific hemisphere: %d,%d,%d,%s",self.title,d,m,s,h);

	return this.dms(d,m,s,h)

};

// extract templates
wco.prototype.templates = function(content){
	var self = this;

	// remove comments
	content = content.replace(/<!--.*?-->/gs,'');

	// remove links
	content = content.replace(/\[\[[^\]]*\]\]/gs,'');

	// remove math markup, because it may confuse the parser
	content = content.replace(/<math>.*?<\/math>/gs,'');

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
		
		// purge bad habit of some people doing `|}}` or `|=}}`
		template = template.replace(/\|\=?\}\}$/,'}}');
		
		template = template.match(/^\{\{([^\|]+)(\|(.*))?\}\}$/s);
		
		if (!template) return null;
		
		// normalize name
		return {
			name: self.trim(template[1]).toLowerCase(),
			values: (template[3]||"")

		}
	});

	return templates;

};

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
