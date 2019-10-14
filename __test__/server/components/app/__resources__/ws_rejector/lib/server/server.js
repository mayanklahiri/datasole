const { log, runtime } = require(process.env.DATASOLE_PATH);

runtime.registerWsAuthHandler(wsAuthRequest => {
  const { clientId, remoteIp } = wsAuthRequest;
  const error = new Error(
    `REJECTING session authorization request for client ${clientId} from ${remoteIp}.`
  );
  log.debug(error);
  throw error;
});

runtime.signalReady();
