/*-----------------------------------------------------------------------------
This template demonstrates how to use Waterfalls to collect input from a user using a sequence of steps.
For a complete walkthrough of creating this type of bot see the article at
https://aka.ms/abs-node-waterfall
-----------------------------------------------------------------------------*/
"use strict";
var builder = require("botbuilder");
var botbuilder_azure = require("botbuilder-azure");
var path = require('path');
var request = require('request');
var customVisionKey = process.env.customVisionKey;
var customVisionAPI = process.env.customVisionAPI;
var referenceState;
var actualState;

var useEmulator = (process.env.NODE_ENV == 'development');

var connector = useEmulator ? new builder.ChatConnector() : new botbuilder_azure.BotServiceConnector({
    appId: process.env['MicrosoftAppId'],
    appPassword: process.env['MicrosoftAppPassword'],
    openIdMetadata: process.env['BotOpenIdMetadata']
});

/*----------------------------------------------------------------------------------------
* Bot Storage: This is a great spot to register the private state storage for your bot. 
* We provide adapters for Azure Table, CosmosDb, SQL Azure, or you can implement your own!
* For samples and documentation, see: https://github.com/Microsoft/BotBuilder-Azure
* ---------------------------------------------------------------------------------------- */

var tableName = 'botdata';
var azureTableClient = new botbuilder_azure.AzureTableClient(tableName, process.env['AzureWebJobsStorage']);
var tableStorage = new botbuilder_azure.AzureBotStorage({ gzipData: false }, azureTableClient);

var bot = new builder.UniversalBot(connector);
bot.localePath(path.join(__dirname, './locale'));
bot.set('storage', tableStorage);

bot.dialog('/', [
    // function (session) {
    //     builder.Prompts.text(session, "Hello... Which shop are you in?");
    // },
    function (session) {
    //    session.userData.shop = results.response;
        builder.Prompts.attachment(session, "Please upload your reference state picture - click the image icon below this text");
    },

    function (session, results) {
        var msg = session.message;
        var attachment = msg.attachments[0];
        session.send('Thank you, analysing...');

        // Now we send the request
        // Set the headers
        var headers = {
            'Prediction-Key': customVisionKey,
            'Content-Type': 'application/json'
        };
        // Configure the request

        var options = {
            url: customVisionAPI,
            method: 'POST',
            headers: headers,
            json: { 'Url': attachment.contentUrl }
        };

        //     session.send('sending to ' + customVisionAPI + " | " + attachment.contentUrl + " | " + customVisionKey);
        request(options, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                referenceState = body.Predictions[0].Tag;
                session.send('Your reference configuration is: ' + body.Predictions[0].Tag + " (Probability " + body.Predictions[0].Probability + ")");

                builder.Prompts.attachment(session, "Now upload the actual state");
            }
        });
    },

    function (session, results) {
        var msg = session.message;
        var attachment = msg.attachments[0];
        session.send('Thank you, analysing again...');

        // Now we send the request
        // Set the headers
        var headers = {
            'Prediction-Key': customVisionKey,
            'Content-Type': 'application/json'
        };
        // Configure the request

        var options = {
            url: customVisionAPI,
            method: 'POST',
            headers: headers,
            json: { 'Url': attachment.contentUrl }
        };

        request(options, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                actualState = body.Predictions[0].Tag;
                session.send('Your actual state is: ' + body.Predictions[0].Tag + " (Probability " + body.Predictions[0].Probability + ")");

                if (referenceState == actualState) {
                    session.send('The desired state matches the reference state ' + referenceState);
                }
                else {
                    session.send('Anomaly detected between desired and actual state - manual check required')
                }
            }
        });


        session.endDialogWithResult(results);
    },
    function (session) {
        builder.Prompts.text(session, "Hello... Which shop are you in?");
    }

]);

if (useEmulator) {
    var restify = require('restify');
    var server = restify.createServer();
    server.listen(3978, function() {
        console.log('test bot endpont at http://localhost:3978/api/messages');
    });
    server.post('/api/messages', connector.listen());    
} else {
    module.exports = connector.listen();
}
