"use strict";

const 	Promise = require("bluebird"),
				fs = Promise.promisifyAll(require("fs-extra")),
				$ = require("./utils");

const REMOTE_URL = /^(?:https?:|\/\/|data:)/i;

function withCacheBust(url, token) {
	const trimmed = url.trim();
	if (!trimmed || REMOTE_URL.test(trimmed) || /[?&]v=/.test(trimmed)) return url;
	const hashIndex = trimmed.indexOf("#");
	const base = hashIndex === -1 ? trimmed : trimmed.slice(0, hashIndex);
	const hash = hashIndex === -1 ? "" : trimmed.slice(hashIndex);
	const join = base.includes("?") ? "&" : "?";
	const leading = url.match(/^\s*/)[0];
	const trailing = url.match(/\s*$/)[0];
	return `${leading}${base}${join}v=${token}${hash}${trailing}`;
}

function cacheBustAssetUrls(html, token) {
	html = html.replace(/(<img\b[^>]*?\ssrc\s*=\s*)(["'])([^"']*)\2/gi, (match, prefix, quote, url) => {
		return `${prefix}${quote}${withCacheBust(url, token)}${quote}`;
	});
	html = html.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (match, quote, url) => {
		if (REMOTE_URL.test(url.trim())) return match;
		return `url(${quote}${withCacheBust(url, token)}${quote})`;
	});
	return html;
}

exports.preview = async function () {
	const config = JSON.parse(await $.read_path("./h5banner-conf.json"));
	if (!config) return $.handle_error("No config file found, please run 'h5banner init'.");

	try {
		const previewDir = `./${config.project}-preview`;
		const cacheBust = Date.now();
		await fs.remove(previewDir);
		await fs.copyAsync(__dirname + "/assets/preview/", previewDir);
		await fs.copyAsync("./banners/", `${previewDir}/banners`);
		await fs.copyAsync("./assets/", `${previewDir}/assets`);
		await $.process_templates.preview(previewDir, cacheBust);
		const banner_files = await fs.readdirAsync(`${previewDir}/banners/`);

		for (let banner_file of banner_files) {
			if (!/\.html?$/i.test(banner_file)) continue;
			const bannerPath = `${previewDir}/banners/${banner_file}`;
			let html = await fs.readFileAsync(bannerPath, "utf8");
			html = html.replace("return (function() {", "(function() {");
			html = cacheBustAssetUrls(html, cacheBust);
			await fs.writeFileAsync(bannerPath, html);
		}
	} catch(e) {
		$.handle_error(e, "Failed to generate preview.")
	}
};

if (require.main === module) {
	exports.preview();
}
