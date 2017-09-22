var express = require('express');
var router = express.Router();
var request = require('request');
var Model = require('../model');

/* GET users github auth callback. */
router.get('/github', function(req, res, next) {
	if (req.query.code) {
		request.post({
			url: 'https://github.com/login/oauth/access_token',
			headers: {
	        	Accept: 'application/json'
	        },
			method: 'POST',
			form: {
				client_id: process.env.GITHUB_CLIENTID,
				client_secret: process.env.GITHUB_SECRET,
				code: req.query.code
			}
		}, function (error, response, body) {
		    if (!error && response.statusCode == 200) {
		    	body = JSON.parse(body);
		    	var accessToken = body.access_token;
		    	if (!body.error && accessToken) {

		    		// Save to our database
		    		Model.User.findOneAndUpdate({
		    			user_id: req.query.user
		    		}, {
		    			github_token: body.access_token
		    		}, {}, function (error, response, body) {
					    if (!error && response.statusCode == 200) {
					    	res.send('1');
					    }
		    		});

		    	} else {
		    		res.send('0');
		    	}
		    } else {
		    	res.send('0');
		    }
		})
	} else {
		res.send('0');
	}
});

module.exports = router;
