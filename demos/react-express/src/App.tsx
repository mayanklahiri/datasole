import { useDatasole } from './hooks/useDatasole';
import { Layout } from './components/Layout';
import { MetricsDashboard } from './components/MetricsDashboard';
import { ChatRoom } from './components/ChatRoom';
import { RpcDemo } from './components/RpcDemo';

export function App() {
  const { ds, connectionState } = useDatasole();

  return (
    <Layout connectionState={connectionState}>
      <MetricsDashboard ds={ds} />
      <ChatRoom ds={ds} />
      <RpcDemo ds={ds} />
    </Layout>
  );
}
