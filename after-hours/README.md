# After Hours

A personal field journal, published at https://mrmaes.github.io/after-hours/.

## Update the notebook

Open the site's **Writing desk** to write, preview, prepare changes, and download or copy the publication file. The final publication happens when you replace `after-hours/content.json` in GitHub and commit the change. GitHub Pages then updates the website.

The writing desk keeps drafts on that browser only. They are not synchronized between devices. Keep a downloaded backup for anything you want to retain. Only entries explicitly prepared for publication are included in the publication file. Do not upload draft backups to this public repository.

Photo files belong in `after-hours/photos/`. Upload them through GitHub, then add their relative path, for example `photos/weekend-ride.jpg`, in the Writing desk. Keep the original photographs separately.

You can also edit `content.json` directly on GitHub. It contains the published entries, garage details, and Now page. Keep the JSON syntax valid.

## Files

- `index.html`, `garage/`, `now/`, `entry/`, `studio/`: static page entry points.
- `app.js`, `core.js`, `studio.js`: public navigation, rendering, and local writing desk.
- `styles.css`: the earthy Garamond design, with all text upright.
- `content.json`: published journal text and settings.
- `fonts/`: self-hosted EB Garamond normal fonts and their Open Font License.

This journal runs entirely on GitHub Pages. It does not require a ChatGPT runtime, account, API, database, or secret token. GitHub controls permission to commit changes. The existing files at the repository root serve the separate teaching website.
