var express = require('express');
var request = require('request');
var router = express.Router();
var Model = require('../model');

/* GET home page. */
router.get('/', function(req, res, next) {
    res.render('index', { title: 'Express' });
});

/* POST Create PR. */
router.post('/pr', function(req, res, next) {
    var name = req.body.user_name;
    var thisResponse = {
        text: 'Jeez! ' + name + ' cannot do that now.',
        attachments: [{
            color: 'danger'
        }],
    };
    var host = req.headers.host;
    var protocol = host.match(/.*localhost.*/) ? 'http' : 'https';

    var redirectUri = encodeURIComponent(protocol + '://' +  host + '/users/github?user=' + req.body.user_id);

    if (process.env.SLACK_TOKEN == req.body.token) {
        Model.User.find({
            user_id: req.body.user_id
        }, function (err, user) {
            if (!err) {
                thisResponse.attachments[0].text = 'Please <https://github.com/login/oauth/authorize?scope=repo&client_id=' +
                        process.env.GITHUB_CLIENTID + '&redirect_uri=' + redirectUri + '|go ask Github> for permission';

                if (user.length) {
                    user = user[0];
                    if (user.github_token) {
                        var command = req.body.text.match(/([^\s]+) ([^\s]+)(?: [“"]([^”"]+)[”"])?(?: [“"]([^”"]+)[”"])?/);
                        var autoMerge = false;
                        var title = command[3];
                        var doPullRequest = function () {
                            request.post({
                                url: 'https://slack.com/api/channels.info',
                                form: {
                                    token: process.env.SLACK_AUTH,
                                    channel: req.body.channel_id
                                }
                            }, function (error, response, body) {
                                if (!error && response.statusCode == 200) {
                                    body = JSON.parse(body);

                                    var repo = body.channel.topic.value;

                                    if (!repo) {
                                        thisResponse.attachments[0].text = 'The gods need knowledge of the channel\'s topic, set it to the {owner}/{repo}.';
                                        res.send(thisResponse);
                                    } else {
                                        request.post({
                                            url: 'https://api.github.com/repos/' + repo + '/pulls',
                                            headers: {
                                                Authorization: 'token ' + user.github_token
                                            },
                                            form: {
                                                title: title,
                                                head: command[2],
                                                base: command[1],
                                                body: command[4] ? command[4] : ''
                                            }
                                        }, function (error, response, body) {
                                            if (!error && response.statusCode == 200) {
                                                body = JSON.parse(body);

                                                if (autoMerge) {
                                                    request.put({
                                                        url: 'https://api.github.com/repos/' + repo + '/pulls/' + body.number + '/merge',
                                                        headers: {
                                                            Authorization: 'token ' + user.github_token
                                                        }
                                                    }, function (error, response, body) {
                                                        if (!error && response.statusCode == 200) {
                                                            
                                                            thisResponse.text = 'Banzai! ' + name + ' successfully created a PR';
                                                            thisResponse.attachments[0].color = 'good';
                                                            thisResponse.attachments[0].text = 'Pull request was auto-merged';
                                                            res.send(thisResponse);
                                                        } else {
                                                            console.log(error);
                                                            res.send(thisResponse);
                                                        }
                                                    });
                                                } else {
                                                    thisResponse.text = 'Banzai! ' + name + ' successfully created a PR';
                                                    thisResponse.attachments[0].color = 'good';
                                                    thisResponse.attachments[0].text = 'Pull request requires code review for merging';
                                                    res.send(thisResponse);
                                                }
                                            } else {
                                                console.log(error);
                                                res.send(thisResponse);
                                            }
                                        });
                                    }
                                } else {
                                    console.log(error);
                                    res.send(thisResponse);
                                }
                            });
                        }
                        
                        if (command[1].match(/.*staging.*/)) {
                            autoMerge = true;
                        }

                        if (!title) {
                            request.get({
                                url: 'https://api.github.com/repos/Bywave/footlocker-release-api/compare/' + command[1] + '...' + command[2],
                            }, function (error, response, body) {
                                if (!error && response.statusCode == 200) {
                                    title = body.commits[0].commit.message

                                    doPullRequest();
                                } else {
                                    console.log(error);
                                    res.send(thisResponse);
                                }
                            });
                        } else {
                            doPullRequest();
                        }

                    }
                } else {
                    var user = new Model.User({
                        user_id: req.body.user_id
                    });
                    user.save(function (err) {
                        if (err) {
                            console.log(err);
                        }
                    })
                }
                
            } else {
                thisResponse.attachments[0].text = 'The gods cannot find you human.';
                res.send(thisResponse);
            }
        }).limit(1);
    } else {
        // Just quit by default for non-slack
        res.send(thisResponse);
    }

})

module.exports = router;
