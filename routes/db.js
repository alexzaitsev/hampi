var ObjectID = require('mongodb').ObjectID;
var config = require('./config');

Promise.prototype.thenReturn = function(value) {
    return this.then(function() {
        return value; 
    });
};

// ====================================================================================
// ================================ USER TERPORARY ====================================
// ====================================================================================

this.getTemporaryUser = function(db, callback, userId) {
	var args = {'_id': userId};
	console.log("database: user_temporary.findOne(%s)", JSON.stringify(args));
	db.collection('user_temporary').findOne(args, function(err, result){
		if(err) {
			console.error(JSON.stringify(err));
		} 
		callback(err, result);
	});
};

this.storeTemporaryUser = function(db, callback, userId, requestToken, requestTokenSecret) {
	var args = {'_id': userId};
	var update = {'request_token': requestToken, 'request_secret': requestTokenSecret};
	console.log("database: user_temporary.update(%s, %s)", JSON.stringify(args), JSON.stringify(update));
	db.collection('user_temporary').update(args, update, {upsert: true}, function(err, result) {
		if(err) {
			console.error(JSON.stringify(err));
		} 
		callback(err, result);
	});
};

this.getTemporaryUserByToken = function(db, callback, requestToken) {
	var args = {'request_token': requestToken};
	console.log("database: user_temporary.findOne(%s)", JSON.stringify(args));
	db.collection('user_temporary').findOne(args, function(err, result){
		if(err) {
			console.error(JSON.stringify(err));
		} 
		callback(err, result);
	});
};

// ====================================================================================
// ==================================== USERS =========================================
// ====================================================================================

this.getUser = function(db, callback, userId) {
	var args = {'_id': userId};
	console.log("database: user.findOne(%s)", JSON.stringify(args));
	db.collection('user').findOne(args, function(err, result){
		if(err) {
			console.error(JSON.stringify(err));
		} 
		callback(err, result);
	});
};

this.deleteUser = function(db, callback, userId) {
	var args = {'_id': userId};
	console.log("database: user.deleteOne(%s)", JSON.stringify(args));
	db.collection('user').deleteOne(args, function(err, results){
		if(err) {
			console.error(JSON.stringify(err));
		} else {
			var queryFindIdsArgs = {'user_id': userId};
			console.log("database: query.find(%s)", JSON.stringify(queryFindIdsArgs));
			db.collection('query').find(queryFindIdsArgs).toArray(function(err, results){
				if (!err) {
					var queryIds = results.map(function(a) {return a._id;});
					var queryDeleteArgs = {'_id': {$in: queryIds}};
					console.log("database: query.delete(%s)", JSON.stringify(queryDeleteArgs));
					db.collection('query').delete(queryDeleteArgs);
				}
				callback(err, results);
			});	
		}
	});
}

this.getUserFlags = function(db, callback, userId) {
	var args = {'_id': userId};
	console.log("database: user.findOne(%s)", JSON.stringify(args));
	db.collection('user').findOne(args, function(err, result){
		if(err) {
			console.error(JSON.stringify(err));
		}
		callback(err, result ? result.flags : null);
	});
};

this.storeUserFlags = function(db, callback, userId, flags) {
	var args = {'_id': userId};
	var update = {$set: {'flags': flags}};
	console.log("database: user.update(%s, %s)", JSON.stringify(args), JSON.stringify(update));
	db.collection('user').update(args, update, function(err, result) {
		if(err) {
			console.error(JSON.stringify(err));
		} 
		callback(err, result);
	});
};

this.storeUser = function(db, callback, userId, accessToken, accessTokenSecret) {
	var args = {'_id': userId, 'access_token': accessToken, 'access_secret': accessTokenSecret, 'flags': config.USER_FLAG_CLEAR, 'type': config.USER_TYPE_USER};
	console.log("database: user.insertOne(%s)", JSON.stringify(args));
	db.collection('user').insertOne(args, function(err, result) {
		if(err) {
			console.error(JSON.stringify(err));
		} else {
			db.collection('user').createIndex({'type': -1}); 
			db.collection('user_temporary').deleteOne({'_id': userId});
		}
		callback(err, result);
	});
};

this.removeUser = function(db, callback, userId) {
	var args = {'_id': userId};
	console.log("database: user.deleteOne(%s)", JSON.stringify(args));
	db.collection('user').deleteOne(args, function(err, results){
		if(err) {
			console.error(JSON.stringify(err));
			callback(err, null);
		} else {
			var argsQuery = {'user_id': userId};
			console.log("database: query.remove(%s)", JSON.stringify(argsQuery));
			db.collection('query').remove(argsQuery, function(err, results) {
				if(err) {
					console.error(JSON.stringify(err));
				}
				callback(err, results);
			});
		}
	});
}

// ====================================================================================
// =================================== QUERIES ========================================
// ====================================================================================

this.storeQuery = function(db, callback, userId, userQuery) {
	var args = {'query': userQuery, 'user_id': userId, 'status': config.QUERY_STATUS_ON, 'tweets': [], 'tweets_size': 0, 
		'created': new Date()};
	console.log("database: query.insertOne(%s)", JSON.stringify(args));
	db.collection('query').insertOne(args, function(err, result) {
		if(err) {
			console.error(JSON.stringify(err));
		} 
		callback(err, result);
	});
}

this.getQueries = function(db, callback, userType) {
	console.log("database: user.aggregate {type: %s}", userType);

	db.collection('user').aggregate([{$match: {'type': userType}}, {$group: {'_id': null, 'listId': {$push: "$_id"}}}], 
		function(err, results) {
			if(err) {
				console.error(JSON.stringify(err));
				callback(err, null);
			} 

			var userIds = results.map(function(a) {return a.listId;});
			var queryFindArgs = {'user_id': {$in: userIds[0]}, 'status': {$ne: config.QUERY_STATUS_OFF}};
			console.log("database: query.find(%s)", JSON.stringify(queryFindArgs));
			db.collection('query').find(queryFindArgs).toArray(function(err, results) {
				if(err) {
					console.error(JSON.stringify(err));
				}
				console.log(JSON.stringify(results));
				callback(err, results);
			});
		});
}

this.getQueriesForUser = function(db, callback, userId) {
	var args = {'user_id': userId};
	console.log("database: query.find(%s)", JSON.stringify(args));
	db.collection('query').find(args).sort({'created': 1}).toArray(function(err, results){
		if(err) {
			console.error(JSON.stringify(err));
		} 
		callback(err, results);
	});
}

this.removeQuery = function(db, callback, queryId) {
	var args = {'_id': new ObjectID(queryId)};
	console.log("database: query.deleteOne(%s)", JSON.stringify(args));
	db.collection('query').deleteOne(args, function(err, results){
		if(err) {
			console.error(JSON.stringify(err));
		}
		callback(err, results);
	});
}

this.storeTweet = function(db, callback, queryId, tweetId) {
	var args = {'_id': queryId};
	var push = {$push: {'tweets': tweetId}};
	console.log("database: query.update(%s, %s)", JSON.stringify(args), JSON.stringify(push));
	db.collection('query').update(args, push, function(err, result) {
		if(err) {
			console.error(JSON.stringify(err));
			callback(err, null);
		} else {
			var inc = {$inc: {'tweets_size': 1}};
			console.log("database: query.update(%s, %s)", JSON.stringify(args), JSON.stringify(inc));
			db.collection('query').update(args, inc, function(err, result) {
				if(err) {
					console.error(JSON.stringify(err));
				}
				callback(err, result);
			});
		}
	});
}

this.checkTweetSize = function(db, queryIds, callback) {
	var maxTweets = config.MAX_TWEETS;
	var args = {'_id': {$in: queryIds}, 'tweets_size': {$gt: maxTweets}};
	console.log("database: deleting old tweets");
	db.collection('query').find(args).toArray(function(err, results) {
		if (err) {
			console.error(JSON.stringify(err));
			callback();
		} else {
			
			// now we have queries that need tweet clearing

			Promise.resolve(0).then(function loop(i) {
			    if (i < results.length) {
			        return new Promise(function(resolve) {

						var tweetsToRemove = [];
						for (var j=0; j<results[i].tweets_size-maxTweets; j++) {
							tweetsToRemove.push(results[i].tweets[j]);
						}
						if (tweetsToRemove.length > 0) {

							db.collection('query').update({'_id': results[i]._id}, {$pull: {'tweets': {$in: tweetsToRemove}}}, {multi: true},
								function(err, results1) {
									if(err) {
										console.error(JSON.stringify(err));
										resolve();
									} else {
										db.collection('query').update({'_id': results[i]._id}, {$set: {'tweets_size': maxTweets}}, 
											function(err, results2) {
												if (err) {
													console.error(JSON.stringify(err));
												}
												resolve();
											}
										);
									}
								});

						} else {
							resolve();
						}

			        }).thenReturn(i + 1).then(loop);
			    }
			}).then(function() {
				callback();				   
			}).catch(function(e) {
			    console.error(JSON.stringify(err));
			    callback();
			});

		}
	});
}

this.switchQueryStatus = function(db, callback, queryId) {
	var args = {'_id': new ObjectID(queryId)};
	var bit = {$bit: {'status': {xor: 1}}};
	console.log("database: query.update(%s, %s)", JSON.stringify(args), JSON.stringify(bit));
	db.collection('query').update(args, bit, function(err, result) {
		if (err) {
			console.error(JSON.stringify(err));
		}
		callback(err, result);
	});
}