var request = require('request')
var config = require('./config');

this.track = function(recipient, message){
    request({
        url: 'https://botanalytics.co/api/v1/messages/facebook-messenger',
        body: JSON.stringify({message: message,
                    recipient: recipient,
                    timestamp: new Date().getTime()}),
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Token ' + config.botanalyticsToken
        }
    }, function(error, response, body){
        if(error) {
            console.error("analytics:", error)
        } else {
            //console.log("analytics:", response.statusCode, body)
        }
    })
}