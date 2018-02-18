# Hampi
Hampi is a Facebook bot that helps you to track your favourite news in Twitter.

![Cover](https://github.com/alexzaitsev/hampi/blob/master/fb_cover.jpg)

The whole project consists of the next parts:
* bot module (you are here)
* cron module
* mongodb database
* botanalytics account
* Twitter account
* Facebook page  
Below you may find extended description for each point.

## Bot module 
It's written on Javascript without any bot frameworks (such as Microsoft Bot Framework or Chatfuel). Optimized to be run on the Heroku (be sure that you use at least hobby duno for it). The only setup is needed is to edit [config](https://github.com/alexzaitsev/hampi/blob/master/routes/config.json) file.

## Cron module
Performs tweets search and sends them to users according to their prefereces.

## Mongodb database
TBW

## Others
Just create your Facebook page, setup it according to the docs. Create application in your Twitter account and profide necessary information in config. Create Botanalytics account and provide token in the [config](https://github.com/alexzaitsev/hampi/blob/master/routes/config.json) file.
