function makeRpcResponse(rpcId, clientId, mergeFields) {
  return Object.assign(
    {},
    {
      type: "rpc_response",
      rpcId,
      clientId
    },
    mergeFields
  );
}

function makeRpcRequest(fnName, rpcId, mergeFields) {
  return Object.assign(
    {},
    {
      type: "rpc_request",
      rpcId,
      fnName
    },
    mergeFields
  );
}

module.exports = {
  makeRpcResponse,
  makeRpcRequest
};
