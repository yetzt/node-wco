# Wikitext Coordinates

`wco` extract coordinates from MediaWiki Templates. It knows the `{{coord}}` and `{{coordinate}}` markup variants.

## Usage

### wco(<str> article[, <bool> strict[, <str> title]]);
	
* `article` – mediawiki markup text
* `strict` – if true, only coordinates relating to the article itself are returned (`display=title` or `article=/`)
* `title` – shown in debug output

## Example

```
var wco = require("wco");

var coords = wco('{{Coord|13.24|52.31|display=t}}', true);

```

