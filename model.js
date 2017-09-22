var model = {};

var config = require('./config');
var mongoose = require('mongoose');

mongoose.connect(config.getMongoDbUrl());

var Schema = mongoose.Schema;

/**
 * Models
 */
var userSchema = new Schema({
	_id: String,
	user_id: String,
	github_token: String,
	added_at: {type: Date, default: Date.now}
});

model.User = mongoose.model('User', userSchema);

module.exports = model;