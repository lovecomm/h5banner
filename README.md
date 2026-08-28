# H5banner

A CLI (NPM) tool to ease the repetitiveness that comes with coding HTML5 banner ads. Animate one banner with Greensock's animation library, resize it, preview it, package it, done. H5banner lets you focus on the animation.

Once you've animated your first banner, you can run _resize_ and then easily tweak that animation for each size, giving you full control over each size.

After that, it's often necessary to send the banners for review to a client or within an agency, that's what the _preview_ command is for. Just drag and drop the preview folder on a publicly accessible server and it's ready for sharing.

Once you're ready to package the banners, just run the _handoff_ command. This command grabs all related images and global css/js assets for each banner. Then makes a version of the banner for each vendor, and zips it up. Then all banners are zipped into one nice packaged file.

If you have several H5banner projects in sibling folders, _batch_ will run preview in each child project and copy the resulting preview folders into one collection directory. Pass _--handoff_ to also package each project before collecting.

## Development Experience

H5banner is all about making the development experience of HTML5 banner animation easier and more pleasant. As such, there is a centralized view where you can ajax load each banner with a timeline scrubber. This view is loaded with Browser Sync after both of the _h5banner one_, _h5banner resize_, and _h5banner watch_ commands.

## Commands:

- _init_ – Builds H5banner project directory structure and config.
- _one_ – Generates first banner from template.
- _resize_ – Resize your first banner into all remaining sizes selected during configuration. These can also be found in your h5banner-conf.json file.
- _watch_ - Run a BrowserSync server to watch the banners and launch the generated index.html
- _preview_ - Generate a drag n' drop preview webpage to showcase the banners.
- _handoff_ - Zip/Package/Compress the Banner-Ads for ad-network delivery.
- _batch_ `<name>` - Run preview in each child project and collect the preview folders into a directory named **name**. Pass **--handoff** to also package each project.

## Options:

- -h, --help output usage information
- -V, --version output the version number
- --handoff (with _batch_) also run handoff in each child project before collecting previews

## Asset naming conventions

### Layers for HTML5 Banners

These are images that you'll use within the HTML5 banners. Be sure that each banner has it's own images. Even if banners use the same image, each banner will need their own. Place all of these images in **assets/images/** during development. These will be copied into each individual banner directory when you run the **handoff** command.

### Static backups

These are often used by vendors as statics when HTML5 banners aren't able to load in a visitors browser. To work an H5banner, you'll want to put them within the **assets/statics/** dir, and name them as follows: **size.extension** (Example: 300x600.png).

## Generated Project Structure

- h5banner-conf.json
- README.md
- .gitignore
- assets
  - statics
    - (size.jpg)
    - (size.png)
      ...
  - images
    - (size)
      _ (layer.jpg)
      _ (layer.png)
      ...
- banners
  - (size.html)
    ...
