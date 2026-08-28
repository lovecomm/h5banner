"use strict";

const path = require("path"),
	program = require("commander"),
	Promise = require("bluebird"),
	fs = Promise.promisifyAll(require("fs-extra")),
	$ = require("./utils"),
	preview = require("./h5banner-preview").preview,
	handoff = require("./h5banner-handoff").handoff;

exports.batch = async function (name, runHandoff) {
	const origin = process.cwd();
	const destDir = path.join(origin, name);

	let entries;
	try {
		entries = await fs.readdirAsync(origin);
	} catch (e) {
		return $.handle_error(e, "Failed to read current directory.");
	}

	const projects = [];
	for (const entry of entries) {
		if ($.is_hidden(entry) || entry === name) continue;

		const childPath = path.join(origin, entry);
		let stat;
		try {
			stat = await fs.statAsync(childPath);
		} catch (e) {
			continue;
		}
		if (!stat.isDirectory()) continue;

		const hasConfig = await $.read_path(path.join(childPath, "h5banner-conf.json"));
		if (!hasConfig) {
			$.handle_notice(`Skipping ${entry}: no h5banner-conf.json found.`);
			continue;
		}
		projects.push(entry);
	}

	if (projects.length === 0) {
		return $.handle_error("No h5banner projects found in child directories.");
	}

	try {
		await fs.remove(destDir);
	} catch (e) {
		return $.handle_error(e, `Failed to clear collection directory ${name}.`);
	}

	for (const entry of projects) {
		const childPath = path.join(origin, entry);
		try {
			$.handle_notice(`Running preview in ${entry}.`);
			process.chdir(childPath);
			await preview();
			if (runHandoff) {
				$.handle_notice(`Running handoff in ${entry}.`);
				await handoff();
			}
		} catch (e) {
			$.handle_error(e, `Failed in ${entry}. Continuing with remaining projects.`);
		} finally {
			process.chdir(origin);
		}
	}

	try {
		await fs.ensureDir(destDir);
	} catch (e) {
		return $.handle_error(e, `Failed to create collection directory ${name}.`);
	}

	const copied = [];
	for (const entry of projects) {
		const childPath = path.join(origin, entry);
		let childEntries;
		try {
			childEntries = await fs.readdirAsync(childPath);
		} catch (e) {
			$.handle_notice(`Could not read ${entry} while collecting previews.`);
			continue;
		}

		for (const childEntry of childEntries) {
			if (!/-preview$/.test(childEntry)) continue;

			const src = path.join(childPath, childEntry);
			let srcStat;
			try {
				srcStat = await fs.statAsync(src);
			} catch (e) {
				continue;
			}
			if (!srcStat.isDirectory()) continue;

			const dest = path.join(destDir, childEntry);
			if (await fs.pathExists(dest)) {
				$.handle_notice(`Preview folder ${childEntry} already exists in ${name}; overwriting.`);
			}

			try {
				await fs.copyAsync(src, dest, { overwrite: true });
				copied.push(childEntry);
			} catch (e) {
				$.handle_error(e, `Failed to copy ${childEntry} from ${entry}.`);
			}
		}
	}

	if (copied.length === 0) {
		return $.handle_error("No preview directories were found to collect.");
	}
	$.handle_success(`Collected ${copied.length} preview folder(s) into ${destDir}.`);
};

program
	.option("--handoff", "Also run handoff in each child project")
	.parse(process.argv);

const name = program.args[0];
if (!name) {
	$.handle_error("A collection directory name is required. Usage: h5banner batch <name> [--handoff]");
} else if (require.main === module) {
	exports.batch(name, !!program.handoff);
}
