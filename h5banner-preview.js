"use strict";

const 	Promise = require("bluebird"),
				fs = Promise.promisifyAll(require("fs-extra")),
				$ = require("./utils");

exports.preview = async function () {
	const config = JSON.parse(await $.read_path("./h5banner-conf.json"));
	if (!config) return $.handle_error("No config file found, please run 'h5banner init'.");

	try {
		const previewDir = `./${config.project}-preview`;
		await fs.remove(previewDir);
		await fs.copyAsync(__dirname + "/assets/preview/", previewDir);
		await fs.copyAsync("./banners/", `${previewDir}/banners`);
		await fs.copyAsync("./assets/", `${previewDir}/assets`);
		await $.process_templates.preview(previewDir);
		const banner_files = await fs.readdirAsync(`${previewDir}/banners/`);

		for (let banner_file of banner_files) {
			await $.str_replace_in_files(
				`${previewDir}/banners/${banner_file}`,
				"return (function() {",
				"\(function\(\) \{"
			)
		}
	} catch(e) {
		$.handle_error(e, "Failed to generate preview.")
	}
};

if (require.main === module) {
	exports.preview();
}
