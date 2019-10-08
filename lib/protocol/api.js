const url = require("url");
const { genRequestId } = require("./request-id");

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

function makeApiRequestFromExpressRequest(req, apiUrlPrefix) {
  const genericPath = req.originalUrl.substr(apiUrlPrefix.length);
  const parsedUrl = url.parse(genericPath);
  return {
    reqId: genRequestId(),
    method: req.method.toLowerCase(),
    protocol: req.protocol,
    query: req.query,
    originalUrl: req.originalUrl,
    path: parsedUrl.pathname,
    hostname: req.hostname,
    ip: req.ip,
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

function makeApiResponseJson(reqId, statusCode, response) {
  const jsonResp = JSON.stringify(response);
  return {
    type: "api_response",
    statusCode,
    reqId,
    headers: {
      "Content-Type": "application/json",
      "Content-Length": jsonResp.length
    },
    body: jsonResp
  };
}

module.exports = {
  makeApiRequest,
  makeApiResponse,
  makeApiResponseJson,
  makeApiRequestFromExpressRequest
};
