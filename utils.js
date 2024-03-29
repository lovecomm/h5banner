"use strict";

const Promise = require("bluebird"),
			fs = Promise.promisifyAll(require("fs-extra")),
			path = require('path'),
			{ resolve } = require('path'),
			camel = require('to-camel-case'),
			pug = require("pug"),
			colors = require("colors"),
			imagemin = require('imagemin'),
			imageminJpegtran = require('imagemin-jpegtran'),
			imageminPngquant = require('imagemin-pngquant'),
			merge = require('merge-objects'),
			moment = require('moment'),
			browserSync = require('browser-sync').create();

const utils = {
	handle_error(e, default_message) { // We don't want to just throw an error object at a user.. so when we reject promises we can give useful error messages. But in the event that it's not an error we're aware of, we still want a default message for that specific h5banner command.
		if(typeof(e) !== "string") e = default_message;
		console.error(colors.red(`Error! ${e}`));
	},
	handle_notice(message) {
		console.log(colors.yellow(`Notice: ${message}`));
	},
	handle_success(message) {
		console.log(colors.green(`Success! ${message}`));
	},
	is_hidden (filename) {
		if (/^\./.test(filename)) {
			return true;
		} else {
			return false;
		}
	},
	read_path: async function(filePath) { // return file if exists, return false if it doesn't
		try {
			return Promise.resolve(await fs.readFileAsync(filePath, "utf8"));
		} catch (e) {
			return Promise.resolve(false)
		}
	},
	read_dir: async function(dirPath) {
		try {
			let files = await fs.readdirAsync(dirPath, {hidden: true});
			files = files.filter((file) => file !== ".DS_Store");
			if (files.length > 0) {
				return Promise.resolve(files);
			} else {
				return Promise.resolve(false);
			}
		} catch(e) {
			return Promise.resolve(false);
		}
	},
	vendorify: async function(config, banner_info, vendor_name, vendor_path) {
		const vendor = config.vendors[vendor_name],
		size = banner_info.layer_name,
		destPath = "./preview/" + config.project + "-handoff/" + vendor_name + "/" + size,

		source_path = "./banners/" + size + ".html";

		try {
			let source = await fs.readFileAsync(source_path, "utf8");
			source = this.replace_string_regex(source, "<!-- ANIONE: vendorScriptHeader -->", vendor.scriptHeader);
			source = this.replace_string_regex(source, "<!-- ANIONE: vendorScriptFooter -->", vendor.scriptFooter);
			source = this.replace_string_regex(source, "#ANIONE:vendorLink", vendor.link);
			source = this.replace_string_regex(source, "../assets/images/" + size + "/", "");
			source = source.replace(/return \(function\(\) \{/, '(function() {');

			return Promise.resolve({
				file: source,
				path: destPath,
				size: size,
			});
		} catch (e) {
			return Promise.reject("Failed to vendorify.\nBanner: ${banner.filename}.\nVendor: ${vendor_name}.")
		}
	},
	get_images_for: async function (size, copy, destination) {
		let img_array = [];
		try {
			const files = await fs.readdirAsync(`./assets/images/${size}/`);
			for (let i = 0; i < files.length; i++) {
				let filename = files[i];

				if (!this.is_hidden(filename)) { // we don't want hidden files
					let layer_name = camel(filename.split('.')[0]);
						img_array.push({
							"filename" : filename,
							"layer_name" : layer_name
						});
				}
			}
			if (copy) {
				await imagemin([`./assets/images/${size}/*.{jpg,png,gif,svg}`],
					{
						destination: destination,
						plugins: [
							imageminJpegtran(),
							imageminPngquant({
								quality: [0.6, 0.8]
							})
						]
					}
				);
			}
			return Promise.resolve(img_array);
		} catch (e) {
			return Promise.reject("Problem finding image assets.")
		}
	},
	get_directory_size: async function(dir) {
		try{
			const subdirs = (await fs.readdir(dir));
			const files = await Promise.all(subdirs.map(async (subdir) => {
				const res = resolve(dir, subdir);
				const s = (await fs.stat(res));
				return s.isDirectory() ? get_directory_size(res) : (s.size);
			}));
			return Promise.resolve( files.reduce((a, f) => a+f, 0) );
		}catch(e){
			return Promise.reject('Failed to get file or directory.');
		}
	},
	process_templates: {
		banner: async function (config, image_list) {
			const $ = utils;
			const banner_file = await $.read_path(`./banners/${config.sizes[0]}.html`),
			templatePath = `${__dirname}/${$.paths.template.banner}`,
			options = {
				pretty: true,
				filename: "index.html",
			},
			locals = {
				images: image_list,
				imgPath: $.paths.directories.images + config.sizes[0],
				width: config.sizes[0].split("x")[0],
				height: config.sizes[0].split("x")[1],
				pageTitle: config.sizes[0],
			},
			html = pug.renderFile(templatePath, Object.assign(options, locals));

			if (banner_file) return $.handle_notice(`Your first banner, ${config.sizes[0]} already exists. You can regenerate it from the template by deleting ${config.sizes[0]}.html and running 'h5banner one' again.`);

			try {
				await fs.writeFileAsync(`./banners/${config.sizes[0]}.html`, html);
				return Promise.resolve();
			} catch (e) {
				return Promise.reject("Failed to process banner template.")
			}
		},
		dev: async function () {
			const $ = utils;
			try {
				let 	banner_files = await fs.readdirAsync("./banners/"),
				scrubber = await $.read_path(`${__dirname}/assets/GSDevTools.js`),
				templatePath = `${__dirname}/${$.paths.template.dev}`;
				banner_files = banner_files.filter((filename) => !$.is_hidden(filename));
				const options = {
					pretty: true,
					filename: "index.html",
				},
				locals = {
					banners: banner_files,
					scrubber: scrubber
				},
				html = pug.renderFile(templatePath, Object.assign(options, locals));
				await fs.writeFileAsync("./index.html", html);
			} catch (e) {
				return Promise.reject("Failed to process development template.")
			}
		},
		preview: async function () {
			const $ = utils,
			config = JSON.parse(await $.read_path("./h5banner-conf.json"));
			if (!config) return Promise.reject("No config found. Preview failed.");

			try {
				let animated_banners = await $.get_files_in("./banners/"),
						static_banners = await $.get_files_in("./assets/statics/");
				let allbannerscombined = {};

				animated_banners = await Promise.all(animated_banners.map(async(banner) => {
					const newPath = banner.path.replace(/\.\/banners\//ig, "banners/"),
								size = banner.layer_name;

					// Images File Size
					let fileSize = await $.get_directory_size(`./assets/images/${size}`);

					// Add HTML file size
					fileSize = fileSize + fs.statSync(newPath)["size"]
					// Convert to kB
					fileSize = (fileSize / 1024).toFixed(2) + "kB";

					return banner = Object.assign(banner, {
						path: newPath,
						width: size.split("x")[0],
						height: size.split("x")[1],
						fileSize: fileSize,
						animated: true
					})
				}));

				static_banners = await Promise.all(static_banners.map(async(banner) => {
					const newPath = banner.path.replace(/\.\/assets\//ig, "assets/");
					let fileSize = fs.statSync(newPath)["size"];
					fileSize = (fileSize / 1024).toFixed(2) + "kB";

					return banner = Object.assign(banner, {
						path: newPath,
						fileSize: fileSize,
						animated: false
					})
				}));

				for ( var i=0; i<animated_banners.length; i++ ) {
					let tempData = { 'animated_banner': animated_banners[i]};
					allbannerscombined[animated_banners[i].layer_name] = tempData;
				}

				for ( var i=0; i<static_banners.length; i++ ) {
					let tempData = { 'static_banner': static_banners[i]};
					if( typeof(allbannerscombined[static_banners[i].layer_name]) == 'object'){
						let bannersCombined = merge( allbannerscombined[static_banners[i].layer_name], tempData );
						allbannerscombined[static_banners[i].layer_name] = bannersCombined;
					} else {
						allbannerscombined[static_banners[i].layer_name] = tempData;
					}
				}

				let date_obj = moment().format('MMMM Do YYYY, h:mm:ss a');

				const templatePath = `${__dirname}/${$.paths.template.preview}`,
					options = {
						pretty: true,
						filename: "index.html",
					},
					locals = {
						genDate: date_obj,
						randomNumber: Math.random(),
						banners: allbannerscombined,
						pageTitle: config.project,
					},
					html = pug.renderFile(templatePath, Object.assign(options, locals));
				await fs.writeFileAsync("./preview/index.html", html)
				return Promise.resolve();
			} catch(e) {
				return Promise.reject("Cannot find banners or image directories. Preview Failed.")
			}
		},
	},
	watch: async function() {
		const config = await this.read_path("./h5banner-conf.json");
		if (!config) return Promise.reject("No config found. Watch failed.")

		browserSync.init({
			server: {
				baseDir: './'
			},
			files: this.paths.watch,
			logPrefix: config.project,
			reloadOnRestart: true,
			notify: false
		});
		browserSync.watch(this.paths.watch);
		return Promise.resolve();
	},
	replace_string_regex (source, pattern, newString) {
		const re = new RegExp(pattern, "g");
		return source.replace(re, newString);
	},
	get_files_in: async function (filePath) {
		try {
			const files = await fs.readdirAsync(filePath);
			let files_array = [];
			for (let filename of files) {
				if (filename && !this.is_hidden(filename)) { // we don't want hidden files
					let layer_name = camel(filename.split('.')[0]);
					files_array.push({
						'filename' : filename,
						"layer_name" : layer_name,
						"path": filePath + filename,
					});
				}
			}
			return Promise.resolve(files_array);
		} catch (e) {
			return Promise.reject(`Problem getting files in ${filePath}`)
		}
	},
	copy_files_in: async function (srcPath, targetPath) {
		try {
			let srcFiles = await this.read_dir(srcPath);
			if (srcFiles) {
				await fs.copyAsync(srcPath, targetPath);
				return Promise.resolve(true);
			} else {
				return Promise.resolve(false);
			}
		} catch (e) {
			return Promise.reject(`Problem copying files from ${srcPath} to ${targetPath}.`);
		}
	},
	str_replace_in_files: async function (file_path, target, replacement) {
		try {
			let result = await fs.readFileAsync(file_path, "utf8");
			result = result.replace(target, replacement);
			await fs.writeFileAsync(file_path, result);
			return Promise.resolve();
		} catch (e) {
			return Promise.reject(e);
		}
	},
	build_directories: async function() {
		for (let i = 0; i <= this.paths.build_directories.length; i++) {
			const directory = this.paths.build_directories[i];
			if (directory) {
				try {
					const directoryStat = await this.read_path(directory);
					if (!directoryStat) await fs.mkdirAsync(directory);
				} catch (e) {
					return this.handle_notice(`Couldn't create project directory, ${directory}`);
				}
			}
		}
		return Promise.resolve();
	},
	paths: {
		build_directories: [ // these are the directories that are generated during `h5banner init`
			"./assets",
			"./assets/statics",
			"./assets/images",
			"./banners"
		],
		directories: {
			"images": "../assets/images/",
		},
		template: {
			"banner" : "templates/banner.pug",
			"dev" : "templates/dev.pug",
			"preview" : "templates/preview.pug",
		},
		watch: [
			"banners/**",
			"assets/**",
			"index.html",
		],
	}
};

module.exports = utils;
