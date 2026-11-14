# After Hours

A personal field journal, published at https://mrmaes.github.io/after-hours/.

## Update the notebook

Open the site's **Writing desk**, then **Open the editor**. Pages CMS provides forms for journal entries, images, Garage, and Now. Saving in that editor writes the changes to GitHub, which automatically publishes the website. There is no JSON copy-and-paste step.

On the first visit, sign in with GitHub, install Pages CMS for the `MrMaes.github.io` repository, and select its `main` branch. This is a separate connection from any GitHub connection in ChatGPT. GitHub grants the CMS repository-wide access, which also covers the teaching-site files in this repository. The configured forms edit only the hobby journal. Review GitHub's permission screen before authorizing the connection.

Use **Journal entries** to expand an existing note or add a new one. The photo picker uploads to `after-hours/photos/` and fills the image address automatically. Use **Journal details, Garage & Now** for the journal name, introduction, bike setup, and current interests. Save when the content is ready to be public; uploaded photos and saved content are stored in the public repository.

Earlier browser-local drafts stay on the device where they were saved. The Writing desk offers recovery and private backup without publishing them. Keep private backups out of the public repository. Keep original photographs separately.

The root `.pages.yml` defines the forms. Both forms merge their own fields into `after-hours/content.json` so journal entries and settings do not overwrite one another. Existing entry IDs retain their links; newly created notes receive a hidden stable UUID.

## Files

- `index.html`, `garage/`, `now/`, `entry/`, `studio/`: static page entry points.
- `app.js`, `core.js`, `studio.js`: public navigation, rendering, editor access, and local draft recovery.
- `styles.css`: the earthy Garamond design, with all text upright.
- `content.json`: published journal text and settings.
- `fonts/`: self-hosted EB Garamond normal fonts and their Open Font License.

The public journal runs on GitHub Pages. Pages CMS supplies the editing interface and requires its own GitHub authorization. No GitHub credentials are embedded in the public website. The existing files at the repository root serve the separate teaching website.
