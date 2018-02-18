var express = require('express');
var router = express.Router();
var path = require('path');
var fbLogic = require('./fb_logic');
var twLogic = require('./tw_logic');
var analytics = require('./analytics.js');
var config = require('./config');

router.get('/', function (req, res, next) {
	res.redirect(config.indexUrl);  			       
});

router.get('/privacy_policy', function (req, res) {
	res.sendFile(path.join(__dirname + '/../public/privacypolicy.htm'));
});

router.get('/webhook', function(req, res) {
	analytics.track(null, req.body);
	if (req.query['hub.mode'] === 'subscribe' &&
		req.query['hub.verify_token'] === 'some_marker_to_check_security') {
		console.log("Validating webhook");
		res.status(200).send(req.query['hub.challenge']);
	} else {
		console.error("Failed validation. Make sure the validation tokens match.");
		res.sendStatus(403);          
	}  
});

router.post('/webhook', function (req, res) {
	var data = req.body;
	if (fbLogic.webhook(req.app.get('mongodb'), data)) {
		// Assume all went well.
		//
		// You must send back a 200, within 20 seconds, to let us know you've 
		// successfully received the callback. Otherwise, the request will time out.
		res.sendStatus(200);
	}
});

router.get('/twitter_callback', function(req, res) {
	var requestToken = req.query.oauth_token;
	var oauthVerifier = req.query.oauth_verifier;
	if (requestToken && oauthVerifier) {
		twLogic.continueLogin(req.app.get('mongodb'), function (err, result, userId) {
			if (err || !result) {
				console.error("Cannot obtain access token and secret for the user " + userId);
				if (userId) {
					fbLogic.loginError(userId);
				}
			} else {
				fbLogic.loginSuccess(userId);
			}
		}, requestToken, oauthVerifier);
	}
	res.sendStatus(200);
});

router.get('/twitter_login', function(req, res) {
	if (req.query.id) {
		fbLogic.login(req.app.get('mongodb'), req.query.id, function(err, url) {
			if (err || !url) {
				res.send(err); // send error text
			} else {
				res.redirect(url); // redirect to twitter
			}
		});
	} else {
		res.sendStatus(403);
	}
});

module.exports = router;
