import { DatasoleProvider } from './hooks/useDatasole';
import { Layout } from './components/Layout';
import { MetricsDashboard } from './components/MetricsDashboard';
import { ChatRoom } from './components/ChatRoom';
import { RpcDemo } from './components/RpcDemo';

export function App() {
  return (
    <DatasoleProvider>
      <Layout>
        <MetricsDashboard />
        <ChatRoom />
        <RpcDemo />
      </Layout>
    </DatasoleProvider>
  );
}
