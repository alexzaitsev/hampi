var logic = require('./fb_logic');
var request = require('request');
var config = require('./config');
var analytics = require('./analytics.js');

this.webhook = function(pool, data) {
	// Make sure this is a page subscription
	if (data.object == 'page') {
		// Iterate over each entry
		// There may be multiple if batched
		data.entry.forEach(function(pageEntry) {
			var pageID = pageEntry.id;
			var timeOfEvent = pageEntry.time;

			// Iterate over each messaging event
			pageEntry.messaging.forEach(function(messagingEvent) {
				/*if (messagingEvent.optin) {
					receivedAuthentication(messagingEvent);
				} else*/ 
				if (messagingEvent.message) {
					receivedMessage(pool, messagingEvent);
				} else if (messagingEvent.postback) {
					receivedPostback(pool, messagingEvent);
				} else {
					console.error("Webhook received unknown messagingEvent: ", messagingEvent);
				}
			});
		});

		return true;
	}
	return false;
};

/*
 * Message Event
 *
 * This event is called when a message is sent to your page. The 'message' 
 * object format can vary depending on the kind of message that was received.
 * Read more at https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-received
 *
 * For this example, we're going to echo any text that we get. If we get some 
 * special keywords ('button', 'generic', 'receipt'), then we'll send back
 * examples of those bubbles to illustrate the special message bubbles we've 
 * created. If we receive a message with an attachment (image, video, audio), 
 * then we'll simply confirm that we've received the attachment.
 * 
 */
function receivedMessage(pool, event) {
	var senderID = event.sender.id;
	var recipientID = event.recipient.id;
	var timeOfMessage = event.timestamp;
	var message = event.message;

	console.log("Received message for user %d and page %d at %d with message:", 
			senderID, recipientID, timeOfMessage);
	console.log(JSON.stringify(message));

	var isEcho = message.is_echo;
	var messageId = message.mid;
	var appId = message.app_id;
	var metadata = message.metadata;

	// You may get a text or attachment but not both
	var messageText = message.text;
	var messageAttachments = message.attachments;
	var quickReply = message.quick_reply;

	if (isEcho) {
		// Just logging message echoes to console
		console.log("Received echo for message %s and app %d with metadata %s", 
				messageId, appId, metadata);
		return;
	} else if (quickReply) {
		var quickReplyPayload = quickReply.payload;
		console.log("Quick reply for message %s with payload %s",
				messageId, quickReplyPayload);
		return;
	}

	logic.receivedMessage(pool, senderID, messageText, messageAttachments);	
}

/*
 * Postback Event
 *
 * This event is called when a postback is tapped on a Structured Message. 
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/postback-received
 * 
 */
function receivedPostback(pool, event) {
	var senderID = event.sender.id;
	var recipientID = event.recipient.id;
	var timeOfPostback = event.timestamp;

	// The 'payload' param is a developer-defined field which is set in a postback 
	// button for Structured Messages. 
	var payload = event.postback.payload;

	console.log("Received postback for user %d and page %d with payload '%s' " + 
		"at %d", senderID, recipientID, payload, timeOfPostback);

	logic.receivedPostback(pool, senderID, payload);
}

/*
 * Send a text message using the Send API.
 *
 */
this.sendTextMessage = function(recipientId, messageText) {
	var messageData = {
		recipient: {
			id: recipientId
		},
		message: {
			text: messageText,
			metadata: "DEVELOPER_DEFINED_METADATA"
		}
	};

	this.callSendAPI(messageData);
}

this.callSendAPI = function(messageData) {
	this.callSendAPIAndCallback(messageData, null);
}

/*
 * Call the Send API. The message data goes in the body. If successful, we'll 
 * get the message id in a response 
 *
 */
this.callSendAPIAndCallback = function(messageData, callback) {
	request({
		uri: 'https://graph.facebook.com/v2.6/me/messages',
		qs: { access_token: config.fbPageAccessToken },
		method: 'POST',
		json: messageData

		}, function (error, response, body) {
			analytics.track(messageData.recipient.id, messageData.message);
			if (callback != null) {
				callback();
			}
			if (!error && response.statusCode == 200) {
				var recipientId = body.recipient_id;
				var messageId = body.message_id;

				if (messageId) {
					console.log("Successfully sent message with id %s to recipient %s", 
							messageId, recipientId);
				} else {
					console.log("Successfully called Send API for recipient %s", 
							recipientId);
				}
			} else {
				console.error("Failed calling Send API", response.statusCode, response.statusMessage, body.error);
			}
		});  
}