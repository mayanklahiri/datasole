// E2E: test WebSocket connection
window.__test_connect = async function (url) {
  const client = new Datasole.DatasoleClient({ url });
  try {
    await client.connect();
    return { success: true, state: client.getConnectionState() };
  } catch (e) {
    return { success: false, error: e.message };
  }
};
