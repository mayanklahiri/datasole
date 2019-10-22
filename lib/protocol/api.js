const url = require("url");
const { makeId } = require("../util/make-id");
const { getRemoteIp } = require("../util");

function makeApiRequest(reqId, method, url, mergeFields) {
  return Object.assign(
    {},
    {
      type: "api_request",
      method,
      url,
      reqId
    },
    mergeFields
  );
}

function makeApiRequestFromExpressRequest(req, apiUrlPrefix, reqId) {
  const genericPath = req.originalUrl.substr(apiUrlPrefix.length) || "/";
  const parsedUrl = url.parse(genericPath);
  return {
    type: "api_request",
    time: Date.now(),
    reqId: reqId || makeId(),
    method: req.method.toLowerCase(),
    protocol: req.protocol.toLowerCase(),
    query: req.query,
    originalUrl: req.originalUrl,
    path: parsedUrl.pathname,
    hostname: req.hostname,
    remoteIp: getRemoteIp(req),
    cookies: req.cookies,
    body: req.body,
    headers: req.headers
  };
}

function makeApiResponse(reqId, statusCode, headers, body, mergeFields) {
  return Object.assign(
    {},
    {
      type: "api_response",
      statusCode,
      headers,
      reqId,
      body
    },
    mergeFields
  );
}

function makeApiResponseJson(reqId, statusCode, response, extraHeaders) {
  const jsonResp = JSON.stringify(response);
  const headers = Object.assign({}, extraHeaders, {
    "Content-Type": "application/json",
    "Content-Length": jsonResp.length
  });
  return makeApiResponse(reqId, statusCode, headers, jsonResp);
}

module.exports = {
  makeApiRequest,
  makeApiResponse,
  makeApiResponseJson,
  makeApiRequestFromExpressRequest
};
