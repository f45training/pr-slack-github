var express = require('express');
var router = express.Router();
var request = require('request');
var Model = require('../model');

/* GET users github auth callback. */
router.get('/github/:user', function(req, res, next) {

    if (req.params.code) {
        request.post({
            url: 'https://github.com/login/oauth/access_token',
            headers: {
                Accept: 'application/json'
            },
            method: 'POST',
            form: {
                client_id: process.env.GITHUB_CLIENTID,
                client_secret: process.env.GITHUB_SECRET,
                code: req.params.code
            }
        }, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                body = JSON.parse(body);

                var accessToken = body.access_token;
                if (!body.error && accessToken) {

                    // Save to our database
                    Model.User.findOneAndUpdate({
                        user_id: req.params.user
                    }, {
                        github_token: body.access_token,
                    }, {}, function (err, user) {
                        if (!err) {
                            res.render('github');
                        } else {
                            console.log(err);
                            res.render('github');
                        }
                    });

                } else {
                    console.log(body);
                    res.render('github');
                }
            } else {
                res.render('github');
            }
        })
    } else {
        res.render('github');
    }
});

module.exports = router;
