const path = require("node:path");
const { spawn } = require("node:child_process");
const express = require('express');
require('express-async-errors');
const fs = require("fs-extra");
const Ansi = require('ansi-to-html');
const conf = require('../.conf');

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
		console.log(`[W] Client closed the connection`); // Use morgan
		res.end();
	});

	const ansi = new Ansi();

	function output(content) {
		res.write(`data: ${btoa(ansi.toHtml(content.toString()))}\n\n`);
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
		return outputFailure('ERROR: Could not find repo. Please check if ~/repos/twinkle exists.');
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
			console.log('Error in access_token fetch: ', await tokenResponse.json());
			return outputFailure(`ERROR: Failed to fetch access token. Status: ${tokenResponse.status}: ${tokenResponse.statusText}`);
		}
	} catch (err) {
		return outputFailure(`ERROR: Network error while fetching access token: ${err.message}`);
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

	async function runCommand(cmd, args, label, cwd) {
		return new Promise((resolve, reject) => {
			const proc = spawn(cmd, args, {
				cwd,
				env: {
					...process.env,
					FORCE_COLOR: true
				}
			});
			output(`${'='.repeat(80)}\n$ ${cmd} ${args.join(' ')}\n`);
			proc.stdout.on('data', data => output(data));
			proc.stderr.on('data', data => output(data));
			proc.on('close', code => {
				if (code !== 0) {
					output(`ERROR: ${label} failed with exit code ${code}`);
					reject(new Error(`${label} failed`));
				} else {
					resolve();
				}
			});
			proc.on('error', err => {
				output(`ERROR: ${label} process error: ${err.message}`);
				reject(err);
			});
		});
	}

	try {
		// await runCommand('git', ['checkout', 'master'], 'git checkout master', repoPath);
		await runCommand('git', ['pull'], 'git pull', repoPath);
		await runCommand('npm', ['install'], 'npm install', repoPath);
		await runCommand('npm', ['run', 'deploy:cd'], 'npm run deploy:cd', repoPath);
		outputSuccess();
	} catch (e) {
		outputFailure(`Aborted: ${e.message}`);
	}
});

module.exports = router;
