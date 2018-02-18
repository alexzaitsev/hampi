var db = require('./db');
var config = require('./config');
var strings = require('./config_en');
var twitter = require('./tw_logic');
var core = require('./fb_core');

var MAIN_DOMAIN = config.mainDomain;

Promise.prototype.thenReturn = function(value) {
    return this.then(function() {
        return value; 
    });
};

String.prototype.format = function() {
   var content = this;
   for (var i=0; i < arguments.length; i++) {
        var replacement = '{' + i + '}';
        content = content.replace(replacement, arguments[i]);  
   }
   return content;
};

this.webhook = function(pool, data) {
	return core.webhook(pool, data);
};

this.loginError = function(senderID) {
	sendErrorMessage(senderID);
}

this.loginSuccess = function(senderID) {
	sendMenuFirstTime(senderID);
}

this.notifySearchResult = function(senderID, tweetText, tweetUrl) {
	sendTweet(senderID, tweetText, tweetUrl);
}

this.receivedMessage = function(pool, senderID, messageText, messageAttachments) {
	db.getTemporaryUser(pool, function(err, user) {
		if (err != null) {
			// there is an error in the database
			sendErrorMessage(senderID);
		} else if (err == null && user == null) {
			// there is no such user in the temporary_user collection - it's a new user or authorized one
			db.getUser(pool, function(err, user) {
				if (err != null) {
					sendErrorMessage(senderID);
				} else if (user == null) {
					// new user is coming to us
					startLogin(senderID); // send welcome message and start authorization
				} else {
					// user is authorized
					if (messageText) {
						switch (messageText) {

							default:
								if (user.flags == config.USER_FLAG_PENDING) { // we're waiting for a new query
									onPendingRequestCreate(pool, user, messageText);
								} else {
									sendMenu(senderID);
								}
						}
					} else if (messageAttachments) {
						sendMenu(senderID);
					}
				}
			}, senderID);
		} else {
			console.log('Authorization not finished for this user. Proceeding..');
			restartLogin(senderID);
		}
	}, senderID);
}

this.receivedPostback = function(pool, senderID, payload) {
	db.getUser(pool, function(err, user) {
		if (err != null) {
			sendErrorMessage(senderID);
		} else if (user == null) {
			// user was logged out and then pressed postback button
			startLogin(senderID); // send welcome message and start authorization
		} else {

			// user is authorized

			switch(payload) {
				case 'GET_STARTED_PAYLOAD':
					sendMenu(senderID);
					break;

				case '/create':
					if (user.type == config.USER_TYPE_USER) {
						// user, check how much queries he already has
						db.getQueriesForUser(pool, function(err, result){
							if (err || !result) {
								sendErrorMessage(senderID);
							} else {
								if (result.length == config.MAX_QUERIES_FOR_USER) {
									sendTextMessage(senderID, strings.quota);
								} else {
									sendCreateButton(pool, senderID);
								}
							}
						}, senderID);
					} else {
						// admin, proceed
						sendCreateButton(pool, senderID);
					}
					break;

				case '/select':
					db.getQueriesForUser(pool, function(err, result){
						if (err || !result) {
							sendErrorMessage(senderID);
						} else {
							if (result.length > 0) {

								Promise.resolve(0).then(function loop(i) {
								    if (i < result.length) {
								        return new Promise(function(resolve) {
								        	var statusBadge = result[i].status == config.QUERY_STATUS_ON ? strings.status_ok : strings.status_off;
											var statusAction = result[i].status == config.QUERY_STATUS_ON ? strings.turn_off : strings.turn_on;
											var query = statusBadge + " " + result[i].query;
											sendQueryButton(senderID, result[i]._id, query, statusAction, function() {
												resolve();
											});
								        }).thenReturn(i + 1).then(loop);
								    }
								}).then(function() {	   
								}).catch(function(e) {
								    console.error("select error", JSON.stringify(e));
								    sendErrorMessage(senderID);
								});

							} else {
								sendNoQueriesMenu(senderID);
							}
						}
					}, senderID);
					break;

				case '/create_cancel':
					db.storeUserFlags(pool, function(err, result){
						if (err || !result) {
							sendErrorMessage(senderID);
						} else {
							sendTextMessage(senderID, strings.ok);
						}
					}, senderID, config.USER_FLAG_CLEAR);
					break;

				case '/logout':
					db.removeUser(pool, function(err, result){
						if (err) {
							sendErrorMessage(senderID);
						} else {
							sendTextMessage(senderID, strings.ok);
						}
					}, senderID);
					break;

				default:
					if (payload.startsWith("/query_remove_")) {
						var queryId = payload.substring("/query_remove_".length);
						db.removeQuery(pool, function(err, result){
							if (err || !result) {
								sendErrorMessage(senderID);
							} else {
								sendTextMessage(senderID, strings.ok);
							}
						}, queryId);
					} else if (payload.startsWith("/query_status_switch_")) {
						var queryId = payload.substring("/query_status_switch_".length);
						db.switchQueryStatus(pool, function(err, result) {
							if (err || !result) {
								sendErrorMessage(senderID);
							} else {
								sendTextMessage(senderID, strings.ok);
							}
						}, queryId);
					} else {
						sendErrorMessage(senderID);
					}
					break;
			}
		}
	}, senderID);
}

this.login = function(pool, senderID, callback) {
	db.getUser(pool, function(err, user) {
		if (user) {
			sendTextMessage(senderID, strings.loggedInAlready);
			callback("OK", null);
		} else {
			twitter.startLogin(function(err, result) {
				if (err || !result) {
					callback(strings.errorMessage, null);
				} else {
					db.storeTemporaryUser(pool, function(err, dbResult) {
						if (err || !dbResult) {
							callback(strings.errorMessage, null);
						} else {
							callback(null, result.redirectUrl);
						}
					}, senderID, result.requestToken, result.requestTokenSecret);
				}
			});
		}
	}, senderID);
}

function sendTextMessage(senderID, messageText) {
	core.sendTextMessage(senderID, messageText);
}

function sendLoginButton(senderID, message, loginUrl) {
	var messageData = {
		recipient: {
			id: senderID
		},
		message: {
			attachment: {
				type: "template",
				payload: {
					template_type: "button",
					text: message,
					buttons:[{
						type: "web_url",
						url: loginUrl,
						title: strings.login
					}]
				}
			}
		}
	};  

	core.callSendAPI(messageData);
}

function sendTweet(senderID, tweetText, tweetUrl) {
	sendTextMessage(senderID, tweetText + "\n" + strings.tweet_url + " " + tweetUrl);
}

function sendMenu(senderID) {
	sendMenuWithMessage(senderID, strings.menuText);
}

function sendMenuFirstTime(senderID) {
	sendMenuWithMessage(senderID, strings.loginSuccess + strings.menuText);
}

function sendMenuWithMessage(senderID, message) {
	var messageData = {
		recipient: {
			id: senderID
		},
		message: {
			attachment: {
				type: "template",
				payload: {
					template_type: "button",
					text: message,
					buttons:[{
						type: "postback",
						payload: "/create",
						title: strings.menuCreate
					},
					{
						type: "postback",
						payload: "/select",
						title: strings.menuSelect
					},
					{
						type: "postback",
						payload: "/logout",
						title: strings.menuLogOut
					}]
				}
			}
		}
	};  

	core.callSendAPI(messageData);
}

function sendNoQueriesMenu(senderID) {
	var messageData = {
		recipient: {
			id: senderID
		},
		message: {
			attachment: {
				type: "template",
				payload: {
					template_type: "button",
					text: strings.noQueries,
					buttons:[{
						type: "postback",
						payload: "/create",
						title: strings.menuCreate
					}]
				}
			}
		}
	};  

	core.callSendAPI(messageData);
}

function sendErrorMessage(senderID) {
	sendTextMessage(senderID, strings.errorMessage);
}

function sendCreateButton(pool, senderID) {
	db.storeUserFlags(pool, function(err, result){
		if (err || !result) {
			sendErrorMessage(senderID);
		} else {
			var messageData = {
				recipient: {
					id: senderID
				},
				message: {
					attachment: {
						type: "template",
						payload: {
							template_type: "button",
							text: strings.createWelcome,
							buttons:[{
								type: "postback",
								payload: "/create_cancel",
								title: strings.cancel
							}]
						}
					}
				}
			};  
			core.callSendAPI(messageData);
		}
	}, senderID, config.USER_FLAG_PENDING);
}

function sendQueryButton(senderID, queryID, queryText, queryTextStatus, callback) {
	var messageData = {
		recipient: {
			id: senderID
		},
		message: {
			attachment: {
				type: "template",
				payload: {
					template_type: "button",
					text: queryText,
					buttons:[{
						type: "postback",
						payload: "/query_remove_" + queryID,
						title: strings.remove
					},
					{
						type: "postback",
						payload: "/query_status_switch_" + queryID,
						title: queryTextStatus
					}]
				}
			}
		}
	};  

	core.callSendAPIAndCallback(messageData, callback);
}

function getUserIntervalString(user) {
	switch(user.type) {
		case config.USER_TYPE_ADMIN:
			return strings.timeIntervalAdmin;
		case config.USER_TYPE_USER:
			return strings.timeIntervalUser;
	}
	return null;
}

function onPendingRequestCreate(pool, user, messageText) {
	db.storeQuery(pool, function(err, result){
		if (err || !result) {
			sendErrorMessage(user._id);
		} else {
			// query stored, now reset pending flag
			db.storeUserFlags(pool, function(err, result){
				if (err || !result) {
					sendErrorMessage(user._id);
				} else {
					var successMessage = strings.createSuccess.format(getUserIntervalString(user));
					sendTextMessage(user._id, successMessage); 
				}
			}, user._id, config.USER_FLAG_CLEAR);	
		}
	}, user._id, messageText);
}

function startLogin(senderID) {
	sendLoginButton(senderID, strings.welcome, config.twitterLogin.format(senderID)); 
}

function restartLogin(senderID) {
	sendLoginButton(senderID, strings.authorizationNotFinished, config.twitterLogin.format(senderID)); 
}
