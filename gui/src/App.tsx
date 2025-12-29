import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './routes/Dashboard';
import { Accounts } from './routes/Accounts';
import { ApiProxy } from './routes/ApiProxy';
import { Settings } from './routes/Settings';
import { PlaygroundFull } from './routes/PlaygroundFull';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/proxy" element={<ApiProxy />} />
        <Route path="/playground" element={<PlaygroundFull />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  );
}
