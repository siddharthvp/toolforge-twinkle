const express = require('express');
const router = express.Router();
const fs = require('fs');

const memory = {};
const CACHE_HEADER = 'public, max-age=86400, s-maxage=86400';

router.get('/', function(req, res, next) {
	const {language} = req.query;

	if (memory[language]) {
		res.set('Cache-Control', CACHE_HEADER).type('json').send(memory[language]);

	} else {
		fs.readFile(`../static/twinkle-core/build-i18n/${language}.json`, (err, data) => {
			if (err) {
				res.status(500).send('Error: ' + String(err));
			} else {
				var jsonStr = data.toString();
				res.set('Cache-Control', CACHE_HEADER).type('json').send(jsonStr);
				memory[language] = jsonStr;
			}
		});
	}
});

module.exports = router;
