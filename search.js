var db_logic = require('./routes/db')
var fb_logic = require('./routes/fb_logic')
var tw_logic = require('./routes/tw_logic')
var config = require('./routes/config');
var mongo = require('mongodb').MongoClient;
var logger = require('mongodb').Logger;

Promise.prototype.thenReturn = function(value) {
    return this.then(function() {
        return value; 
    });
};

this.search = function(userType) {
	mongo.connect(config.mongoUrl, function (err, db) {
		if (err) {
			console.log(JSON.stringify(err));
		} 
		
		//logger.setLevel('debug');
		
		db_logic.getQueries(db, function(err, result) {
			if (err || !result) {
				console.error("Cannot get queries");
			} else {

				Promise.resolve(0).then(function loop(i) {
				    if (i < result.length) {
				        return searchQuery(db, result[i]).thenReturn(i + 1).then(loop);
				    }
				}).then(function() {
					var queryIds = result.map(function(a) {return a._id});
					db_logic.checkTweetSize(db, queryIds, function() {
						console.log("search is done");
				    	db.close();
					}); 				   
				}).catch(function(e) {
				    console.error("search error", JSON.stringify(e));
				    db.close();
				});
			}
		}, userType);
	}); 
}

function searchQuery(db, queryData) {
    return new Promise(function(resolve) {
    	console.log("starting search for query:", queryData.query);
        tw_logic.search(function(err, results){
			if (err || !results) {
				console.error("Cannot search", JSON.stringify(queryData.query));
				resolve();
			} else {
				Promise.resolve(0).then(function loop(i) {
				    if (i < results.statuses.length) {
				    	var tweet = results.statuses[i];
				        return checkTweet(db, queryData, tweet).thenReturn(i + 1).then(loop);
				    }
				}).then(function() {
					resolve();
				}).catch(function(e) {
				    console.error("twitter check error", JSON.stringify(e));
				    resolve();
				});
			}
		}, queryData);
    });
}

function checkTweet(db, queryData, tweet) {
	return new Promise(function(resolve) {
		var url = 'https://twitter.com/' + tweet.user.screen_name + '/status/' + tweet.id_str;
		console.log("checking tweet", tweet.id_str, "with timestamp", tweet.created_at);

		if (tweet.text.startsWith('RT @')) {
			// retweet, skip
			resolve();
			return;
		} 

		var newTweet = true;
		for (var j=0; j<queryData.tweets.length; j++) {
			if (tweet.id_str == queryData.tweets[j]) {
				newTweet = false;
				break;
			}
		}

		if (newTweet) {
			// insert in the table
			db_logic.storeTweet(db, function(err, results){
				if (err) {
					console.error("Cannot storeTweet", tweet.id_str);
					resolve();
				} else {
					// inserted, notify
					fb_logic.notifySearchResult(queryData.user_id, tweet.text, url);
					resolve();
				}
			}, queryData._id, tweet.id_str);
		} else {
			resolve();
		}
	});
}