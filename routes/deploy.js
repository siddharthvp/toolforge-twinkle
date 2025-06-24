const path = require('path');
const { spawn } = require("child_process");
const express = require('express');
require('express-async-errors');
const fs = require('fs-extra');
const ansiHtml = require('ansi-html');
const {logger} = require('../logger');
const conf = require('../conf');

const router = express.Router();

router.get('/', async (req, res) => {
	res.redirect(308, 'https://gadget-deploy.toolforge.org/');
});

export default router;