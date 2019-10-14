const { makeId } = require("../util/make-id");
const { getRemoteIp } = require("../util");

function makeWsAuthRequest(request, clientId) {
  return {
    type: "ws_auth_request",
    clientId: clientId || makeId(),
    remoteIp: getRemoteIp(request),
    data: {
      url: request.url,
      method: request.method,
      headers: request.headers,
      cookies: request.cookies,
      query: request.query
    }
  };
}

function makeWsAuthResponse(wsAuthRequest, statusCode, fields) {
  return Object.assign({}, fields, {
    type: "ws_auth_response",
    clientId: wsAuthRequest.clientId,
    wsAuthRequest
  });
}

module.exports = {
  makeWsAuthRequest,
  makeWsAuthResponse
};
