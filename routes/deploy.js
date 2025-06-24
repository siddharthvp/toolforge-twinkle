const express = require('express');
require('express-async-errors');

const router = express.Router();

router.get('/', async (req, res) => {
	res.redirect(308, 'https://gadget-deploy.toolforge.org/');
});

module.exports = router;