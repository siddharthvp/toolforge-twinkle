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
	if (!req.query.code || !req.query.state) {
		res.status(200).render('deploy-landing', {
			clientId: encodeURIComponent(conf.clientId),
			redirectUri: encodeURIComponent(conf.redirectUri),
			restApiUrl: conf.restApiUrl,
		});
	} else {
		res.status(200).render('deploy-result', {
			code: encodeURIComponent(req.query.code),
			state: encodeURIComponent(req.query.state),
		});
	}
});

router.get('/stream', async (req, res) => {
	const {code, state} = req.query;

	res.writeHead(200, {
		"Connection": "keep-alive",
		"Cache-Control": "no-cache",
		"Content-Type": "text/event-stream",
	});

	res.on('close', () => {
		logger.info(`Client closed the connection`);
		res.end();
	});

	function output(content) {
		// Use ansiHtml to convert ANSI escape codes used for terminal coloring to HTML styles.
		// Note: ansiHtml does not support all chalk colors or options.
		res.write(`data: ${btoa(ansiHtml(content.toString()))}\n\n`);
	}
	function outputSuccess() {
		output('end:success');
		res.end();
	}
	function outputFailure(content) {
		output(content);
		output('end:failure');
		res.end();
	}

	const repoPath = path.resolve(__dirname, '../repos/twinkle');
	if (!await fs.exists(repoPath)) {
		return outputFailure('ERROR: Could not find repo. Please check if ~/www/js/repos/twinkle exists.');
	}

	let tokenResponse;
	try {
		tokenResponse = await fetch(conf.restApiUrl + '/oauth2/access_token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				grant_type: 'authorization_code',
				client_id: conf.clientId,
				client_secret: conf.clientSecret,
				code: code,
				redirect_uri: conf.redirectUri,
			}).toString(),
		});
		if (!tokenResponse.ok) {
			outputFailure(`ERROR: Failed to fetch access token. Status: ${tokenResponse.status}: ${tokenResponse.statusText}`);
			logger.error('Error in access_token fetch: ', await tokenResponse.json());
			return;
		}
	} catch (err) {
		outputFailure(`ERROR: Network error while fetching access token: ${err.message}`);
		logger.error('Network error while fetching access token');
		logger.error(err.stack);
		return;
	}
	const tokenData = await tokenResponse.json();
	if (!tokenData.access_token) {
		return outputFailure(`ERROR: No access_token in response: ${JSON.stringify(tokenData)}`);
	}

	try {
		await fs.writeJson(path.join(repoPath, 'scripts/credentials.json'), {
			'site': state,
			'accessToken': tokenData.access_token,
		});
	} catch (e) {
		return outputFailure(`ERROR: Failed to write credentials.json: ${e.message}`);
	}

	const env = { ...process.env, FORCE_COLOR: true };

	async function runCommand(cmd, args, label, cwd) {
		return new Promise((resolve, reject) => {
			const proc = spawn(cmd, args, { cwd, env });
			output(`\n${'='.repeat(80)}\n$ ${cmd} ${args.join(' ')}\n`);
			proc.stdout.on('data', data => output(data));
			proc.stderr.on('data', data => output(data));
			proc.on('close', code => {
				if (code !== 0) {
					output(`ERROR: ${label} failed with exit code ${code}\n`);
					reject(new Error(`${label} failed`));
				} else {
					resolve();
				}
			});
			proc.on('error', err => {
				output(`ERROR: ${label} process error: ${err.message}\n`);
				reject(err);
			});
		});
	}

	try {
		if (!process.env.ALLOW_NON_MASTER_DEPLOY) {
			await runCommand('git', ['checkout', 'master'], 'git checkout', repoPath);
		}
		await runCommand('git', ['pull', '--ff-only', 'origin', 'master'], 'git pull', repoPath);
		await runCommand('npm', ['install'], 'npm install', repoPath);
		await runCommand('npm', ['run', 'deploy:cd'], 'deploy script', repoPath);
		outputSuccess();
	} catch (e) {
		outputFailure(`Aborted: ${e.message}`);
	}
});

module.exports = router;
