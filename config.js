var config = {};

config.getMongoDbUrl = function () {
	return process.env.MONGODB_URI;
};

module.exports = config;