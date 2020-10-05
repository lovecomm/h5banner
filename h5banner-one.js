"use strict";

const 	Promise = require("bluebird"),
				fs = Promise.promisifyAll(require("fs")),
				$ = require("./utils");

exports.one = async function () {
	const config = JSON.parse(await $.read_path("./h5banner-conf.json"));
	if (!config) return $.handle_error("No config file found, please run 'h5banner init'.");

	try {
		const image_list = await $.get_images_for(config.sizes[0]);
		await $.process_templates.banner(config, image_list);
		await $.process_templates.dev();
		await $.watch();
	} catch (e) {
		$.handle_error(e, "Failed to generate first banner.")
	}
};

exports.one();
