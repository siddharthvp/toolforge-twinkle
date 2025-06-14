const express = require('express');
const router = express.Router();
const {exec} = require('child_process');

/* GET users listing. */
router.get('/', function (req, res, next) {

	let {repo, commit} = req.query;
	if (repo && commit) {
		repo = repo.replace(/[^A-Za-z0-9-/]/g, '');
		commit = commit.replace(/[^A-Za-z0-9-/]/g, '');
		exec(`
		  cd repos/${repo} &&
		  git pull &&
		  git checkout ${commit} &&
		  npm install &&
		  npm run build  
		`, (err, stdout, stderr) => {
			if (err) return res.render('error', {error: err, message: err.message});
			exec(`cat repos/${repo}/build/twinkle.js`, (err, stdout) => {
				if (err) return res.render('error', {error: err, message: err.message});
				res.set('content-type', 'text/plain');
				res.end(stdout);
			});
		});

	} else {
		res.render('build-landing', {});
	}

});

module.exports = router;
