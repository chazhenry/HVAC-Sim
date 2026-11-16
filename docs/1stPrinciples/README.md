# First Principles videos

Video files in this folder (`.mp4`, `.m4v`, `.webm`, `.mov`, `.ogv`) appear in the app under
**Tool bag > Hands & access > First Principles**. The title shown is the file name without its
extension, with `_` and `-` turned into spaces.

- **Locally** the API serves them straight from this folder.
- **On the server** `bash deploy/deploy-backend.sh` copies them to `/var/lib/hvac-sim/videos`,
  uploading only new or changed files and removing ones deleted here.

The videos are not committed to git (see `.gitignore`); only this README is.
