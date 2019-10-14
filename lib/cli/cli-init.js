const fs = require("fs").promises;
const colors = require("colors");
const { ensureDir, copy } = require("fs-extra");
const { spawn } = require("child_process");
const log = require("../logging").getLogger();
const { projectTemplate } = require("../util/path-util");
const _init = require("./_init");

async function main(config) {
  const projectRoot = config.getCheckedKey("app") || process.cwd();
  const force = !!config.getKey("force") || false;
  const installDeps = !!config.getKey("install") || false;
  const projectType = config.getKey("type") || "minimal";

  // Check project type.
  const srcPath = projectTemplate(projectType);
  try {
    await fs.access(srcPath, fs.F_OK);
  } catch (e) {
    throw new Error(`Project type "${projectType}" cannot be found: ${e}`);
  }

  // Check target directory.
  try {
    await ensureDir(projectRoot);
    const dirListing = (await fs.readdir(projectRoot)).filter(
      f => f[0] !== "."
    );
    if (dirListing.length && !force) {
      throw new Error(
        `Directory "${projectRoot}" is not empty; use --force to force init (overwrites files).`
      );
    }
  } catch (e) {
    throw new Error(`Project cannot be initialized in "${projectRoot}": ${e}`);
  }

  // Copy project template.
  log.info(
    colors.green(
      `Generating "${colors.yellow(
        projectType
      )}" project stub in: ${colors.bold(projectRoot)}`
    )
  );
  await copy(srcPath, projectRoot, {
    preserveTimestamps: true,
    overwrite: force
  });

  log.info(
    colors.green(
      `Project stub generated using template "${colors.yellow(projectType)}"`
    )
  );

  // Install dependencies.
  if (installDeps) {
    log.info(`Running 'npm install' in ${projectRoot}...`);
    await spawn("npm install", {
      cwd: projectRoot,
      shell: true,
      stdio: "inherit"
    });
  }

  return process.exit(0);
}

if (require.main === module) {
  try {
    _init(main, require("./args-init"));
  } catch (e) {
    log.error(e);
    return process.exit(1);
  }
} else {
  module.exports = main;
}
