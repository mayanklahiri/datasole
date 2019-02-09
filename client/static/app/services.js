/**
 * Maintains a persistent connection to the server and accepts server state updates.
 */
class WebSocketService {
  constructor(wsUrl, scope) {
    console.log(`Connecting to websocket: ${wsUrl}`);
    const socket = new WebSocket(wsUrl);
    socket.addEventListener("open", this.onOpen.bind(this, socket));
    socket.addEventListener("close", this.onClose.bind(this, socket));
    socket.addEventListener("error", this.onError.bind(this, socket));
    socket.addEventListener("message", this.onMessage.bind(this, socket));
    this.scope = scope;
  }

  onOpen(socket, event) {
    console.log("opened", event);
  }

  onClose(socket, event) {
    console.log("closed", event);
  }

  onError(socket, event) {
    console.error("error", event);
  }

  onMessage(socket, msg) {
    console.info("msg", msg);
    const payload = JSON.parse(msg.data);
    const scope = this.scope;
    scope.$apply(() => {
      scope.console = scope.console || [];
      scope.console.push(payload);
    });
  }
}

app.factory("ws", [
  "$rootScope",
  $rootScope => new WebSocketService($state.config.procInfo.wsUrl, $rootScope)
]);
