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
                        var command = req.body.text.match(/([^\s]+) ([^\s]+)(?: (\@[^\s]+))?(?: [“"]([^”"]+)[”"])?(?: [“"]([^”"]+)[”"])?/);
                        var autoMerge = false;
                        var title = command[4];
                        var mention = command[3];
                        var repo = '';
                        var sha = '';
                        var doPullRequest = function () {

                            request.post({
                                url: 'https://api.github.com/repos/' + repo + '/pulls',
                                headers: {
                                    'User-Agent': process.env.APP_NAME,
                                    'Authorization': 'token ' + user.github_token
                                },
                                json: {
                                    title: title,
                                    head: command[2],
                                    base: command[1],
                                    body: command[5] || ''
                                }
                            }, function (error, response, body) {
                                thisResponse.text = 'Bomb! The gods cannot create your PR';

                                if (!error) {
                                    if (autoMerge) {
                                        var pullNumber = body.number;
                                        var searchPr = false;
                                        if (pullNumber || (searchPr = body.errors[0].message.match(/.*already exists.*/))) {

                                            var mergePr = function () {
                                                request.put({
                                                    url: 'https://api.github.com/repos/' + repo + '/pulls/' + pullNumber + '/merge',
                                                    json: {
                                                        sha: sha
                                                    },
                                                    headers: {
                                                        'User-Agent': process.env.APP_NAME,
                                                        'Authorization': 'token ' + user.github_token
                                                    }
                                                }, function (error, response, body) {
                                                    if (!error) {
                                                        if (response.statusCode == 405) {
                                                            body.message += '. Checkout ' + command[1] + ' then merge ' + command[2] +
                                                                ' or <https://github.com/' + repo + '/pull/' + pullNumber + '/conflicts|use Github> to resolve conflict';
                                                        }

                                                        thisResponse.text = 'Banzai! ' + name + ' successfully created a PR';
                                                        thisResponse.attachments[0].color = 'good';
                                                        thisResponse.attachments[0].text = body.message;
                                                        res.send(thisResponse);
                                                    } else {
                                                        console.log(body);
                                                        res.send(thisResponse);
                                                    }
                                                });
                                            }

                                            if (searchPr) {
                                                request.get({
                                                    url: 'https://api.github.com/repos/' + repo + '/pulls',
                                                    json: {
                                                        head: command[2],
                                                        base: command[1]
                                                    },
                                                    headers: {
                                                        'User-Agent': process.env.APP_NAME,
                                                        'Authorization': 'token ' + user.github_token
                                                    }
                                                }, function (error, response, body) {
                                                    console.log(body);
                                                    if (!error && response.statusCode == 200 && body.length) {
                                                        pullNumber = body[0].number;
                                                        mergePr();
                                                    } else {
                                                        thisResponse.attachments[0].text = 'For some reason, the gods cannot merge your request. Mankind lies in your hands';
                                                        res.send(thisResponse);
                                                    }

                                                });
                                            } else {
                                                mergePr();
                                            }
                                            

                                        } else {
                                            thisResponse.attachments[0].text = body.errors[0].message;
                                            res.send(thisResponse);
                                        }
                                    } else {
                                        if (!body.errors) {
                                            var appendText = '';

                                            if (!command[2].match(new RegExp('.*(' + process.env.MASTER_BRANCHES + ').*'))) {
                                                appendText += ': ';
                                                if (mention) {
                                                    appendText += mention + ' ';
                                                }

                                                appendText += '<' + body.html_url + '|#' + body.number + ' ' + body.title + '>';
                                                thisResponse.response_type = 'in_channel';

                                            }

                                            thisResponse.text = 'Banzai! ' + name + ' successfully created a PR';
                                            thisResponse.attachments[0].color = 'good';
                                            thisResponse.attachments[0].text = 'Pull request requires code review for merging' + appendText;
                                            res.send(thisResponse);
                                        } else {
                                            thisResponse.attachments[0].text = body.errors[0].message;
                                            res.send(thisResponse);
                                        }
                                    }
                                } else {
                                    console.log(body);
                                    thisResponse.attachments[0].text = body.message;
                                    res.send(thisResponse);
                                }
                            });
                        }
                        
                        if (command[1].match(new RegExp('.*(' + process.env.STAGING_BRANCHES + ').*'))) {
                            autoMerge = true;
                        }

                        request.post({
                            url: 'https://slack.com/api/channels.info',
                            form: {
                                token: process.env.SLACK_AUTH,
                                channel: req.body.channel_id
                            }
                        }, function (error, response, body) {
                            if (!error && response.statusCode == 200) {
                                body = JSON.parse(body);

                                repo = body.channel.topic.value;

                                if (!repo) {
                                    thisResponse.attachments[0].text = 'The gods need knowledge of the channel\'s topic, set it to the {owner}/{repo}.';
                                    res.send(thisResponse);
                                } else {
                                    if (!title) {
                                        request.get({
                                            url: 'https://api.github.com/repos/' + repo + '/compare/' + command[1] + '...' + command[2],
                                            headers: {
                                                'User-Agent': process.env.APP_NAME,
                                                'Authorization': 'token ' + user.github_token
                                            },
                                        }, function (error, response, body) {
                                            body = JSON.parse(body);
                                            if (!error && response.statusCode == 200) {
                                                if (body.commits.length) {
                                                    title = body.commits[0].commit.message;
                                                    sha = body.commits[0].sha;

                                                    doPullRequest();
                                                } else {
                                                    thisResponse.attachments[0].text = 'Don\'t overwork man! its already on ' + command[1];
                                                    res.send(thisResponse);
                                                }
                                            } else {
                                                console.log(body);
                                                var message = body.message;
                                                if (message === 'Not Found') {
                                                    message = 'This hooman\'s commit is nowhere to be found.';
                                                }
                                                thisResponse.attachments[0].text = message;
                                                res.send(thisResponse);
                                            }
                                        });
                                    } else {
                                        doPullRequest();
                                    }
                                }
                            } else {
                                console.log(body);
                                res.send(thisResponse);
                            }
                        });

                    } else {
                        res.send(thisResponse);
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
                thisResponse.attachments[0].text = 'The gods cannot find you hooman.';
                res.send(thisResponse);
            }
        }).limit(1);
    } else {
        // Just quit by default for non-slack
        res.send(thisResponse);
    }

})

module.exports = router;
