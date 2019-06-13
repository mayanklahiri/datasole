module.exports = function checkUrlPrefixes(config) {
  let { urlRootPath, urlWsRelPath } = config;

  // Ensure URL root path ends with a trailing slash.
  if (urlRootPath) {
    while (urlRootPath.length && urlRootPath[urlRootPath.length - 1] === "/") {
      urlRootPath = urlRootPath.substr(0, urlRootPath.length - 1);
    }
  } else {
    urlRootPath = "";
  }
  urlRootPath += "/";

  // Ensure WS relative path does not start with a slash.
  if (urlWsRelPath && urlWsRelPath[0] === "/") {
    urlWsRelPath = urlWsRelPath.slice(1);
  }

  Object.assign(config, {
    urlRootPath,
    urlWsRelPath
  });
};
