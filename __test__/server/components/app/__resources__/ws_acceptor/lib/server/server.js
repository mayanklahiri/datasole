const { log, runtime } = require(process.env.DATASOLE_PATH);

runtime.registerWsAuthHandler(wsAuthRequest => {
  const { clientId, remoteIp } = wsAuthRequest;
  log.debug(
    `ACCEPTING session authorization request for client ${clientId} from ${remoteIp}.`
  );
});

runtime.signalReady();
