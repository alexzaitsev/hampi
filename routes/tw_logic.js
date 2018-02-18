var twitterAPI = require('node-twitter-api');
var config = require('./config');
var db = require('./db');

var TWITTER_CALLBACK = config.twitterCallback;
var TWITTER_KEY = config.twitterConsumerKey;
var TWITTER_SECRET = config.twitterConsumerSecret;

function getTwitter() {
	return new twitterAPI({
	    consumerKey: TWITTER_KEY,
	    consumerSecret: TWITTER_SECRET,
	    callback: TWITTER_CALLBACK
	});
}

this.startLogin = function(callback) {
	var twitter = getTwitter();
	twitter.getRequestToken(function(error, requestToken, requestTokenSecret, results){
	    if (error) {
	        console.error("Error getting OAuth request token : " + JSON.stringify(error));
	        callback(err, null);
	    } else {
	    	var result = new Object();
	    	result.requestToken = requestToken;
	    	result.requestTokenSecret = requestTokenSecret;
	    	result.redirectUrl = twitter.getAuthUrl(requestToken);
	    	callback(null, result);
	    }
	});
}

this.continueLogin = function(pool, callback, requestToken, oauthVerifier) {
	db.getTemporaryUserByToken(pool, function(err, result) {
		if (err || !result) {
			callback(err, result, null);
		} else {
			var twitter = getTwitter();
			twitter.getAccessToken(requestToken, result.request_secret, oauthVerifier, 
				function(error, accessToken, accessTokenSecret, results) {
				    if (error) {
				        console.error(error);
				        callback(err, null, result._id);
				    } else {
				        db.storeUser(pool, function(err, resultStore) {
				        	callback(err, resultStore, result._id);
				        }, result._id, accessToken, accessTokenSecret);
				    }
				});
		}
	}, requestToken);
}

this.search = function(callback, queryData) {
	var twitter = getTwitter();
	var query = new Object();
	query.q = encodeURI(queryData.query);
	twitter.search(
		query,
	    queryData.access_token,
	    queryData.access_secret,
	    function(error, data, response) {
	        if (error) {
	            console.error(JSON.stringify(error));
	        } 
	        callback(error, data);
	    }
	);
}