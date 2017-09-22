var express = require('express');
var router = express.Router();
var Model = require('../model');

/* GET home page. */
router.get('/', function(req, res, next) {
  	res.render('index', { title: 'Express' });
});

/* POST Create PR. */
router.post('/pr', function(req, res, next) {
	var name = req.body.user_name;
	var response = {
		text: name + ' cannot do that now!',
		attachments: []
	};
	var host = req.headers.host;
	var protocol = host.match(/.*localhost.*/) ? 'http' : 'https';

	var redirectUri = encodeURIComponent(protocol + '://' +  host + '/users/github?user=' + req.body.user_id);

	if (process.env.SLACK_TOKEN == req.body.token) {
		Model.User.find({
			user_id: req.body.user_id
		}, function (err, user) {
			if (!err) {
				response.attachments.push({
					text: '<https://github.com/login/oauth/authorize?scope=repo&client_id=' +
						process.env.GITHUB_CLIENTID + '&redirect_uri=' + redirectUri + '"|You should talk to Github>'
				});
				var success = false;
				if (user.length) {
					if (user.github_token) {
						var command = req.body.text.match(/\@[^\s]+ pr ([^\s]+) ([^\s]+) [“"]([^”"]+)[”"](?: [“"]([^”"]+)[”"])?/);
						var autoMerge = false;
						if (res[1].match(/.*staging.*/)) {
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

						    	var repo = body.channel.topic.value;

						    	if (!repo) {
						    		response.attachments = [{
										text: 'The gods need knowledge of the channel\'s topic, set it to the {owner}/{repo}.'
									}];
									res.send(response);
						    	} else {
						    		request.post({
										url: 'https://api.github.com/repos/' + repo + '/pulls',
										headers: {
								        	Authorization: 'token ' + user.github_token
								        },
								        form: {
								        	title: res[3],
								        	head: res[2],
								        	base: res[1],
								        	body: res[4] ? res[4] : ''
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
												    	response.text = name + ' successfully created a PR (auto-merged)';
														response.attachments = [];
														success = true;
												    }
												});
									    	} else {
									    		response.text = name + ' successfully created a PR (requires code review)';
												response.attachments = [];
												success = true;
									    	}
									    }
									});
						    	}
						    }
						});
					}
				}

				if (!success) {
					var user = new Model.User({
						user_id: req.body.user_id
					});
					user.save();
				}

				res.send(response);
			} else {
				response.attachments.push({
					text: 'The gods cannot find you human.'
				});
				res.send(response);
			}
		}).limit(1);
	} else {
		// Just quit by default for non-slack
		res.send(response);
	}

})

module.exports = router;
