var express = require('express');
var app = express();
var routes = require('./routes/index');
var config = require('./routes/config');
var bodyParser = require('body-parser')
var mongo = require('mongodb').MongoClient;
var logger = require('mongodb').Logger;
require('es6-promise').polyfill();

app.set('port', process.env.PORT || 3000);
app.use(bodyParser.urlencoded({extended: false})) // Process application/x-www-form-urlencoded
app.use(bodyParser.json()) // Process application/json
app.set('views', __dirname + '/views'); 
app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/public'));
app.use('/', routes);

app.listen(app.get('port'), function () {
	console.log('Listening on port', app.get('port'));
});

mongo.connect(config.mongoUrl, function (err, database) {
	if (err) {
		console.log(err);
	} 
	//logger.setLevel('debug');
	app.set('mongodb', database);
});               
