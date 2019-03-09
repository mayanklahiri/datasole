# datasole

### Notes

- Webpack is not in `devDependencies` because recursive devDependencies are not currently installed by npm, and Webpack is required for developing the client and server components of any project. In the future, Webpack and other large dev dependencies can be moved to `devDependencies` by requiring a global npm install of `datasole` for development.
