import React, { useEffect, useState } from 'react';

interface AppInfo {
  name: string;
  version: string;
  platform: string;
}

declare global {
  interface Window {
    electron: {
      app: {
        getName: () => Promise<string>;
        getVersion: () => Promise<string>;
      };
      platform: string;
    };
  }
}

function App(): React.ReactElement {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAppInfo = async (): Promise<void> => {
      try {
        const [name, version] = await Promise.all([
          window.electron.app.getName(),
          window.electron.app.getVersion(),
        ]);
        
        setAppInfo({
          name,
          version,
          platform: window.electron.platform,
        });
      } catch (error) {
        console.error('Failed to load app info:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAppInfo();
  }, []);

  if (loading) {
    return (
      <div className="app">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo-container">
          <h1>⚡ Lightfast Desktop</h1>
        </div>
        
        <div className="info-container">
          <h2>Hello World!</h2>
          <p>Welcome to the Lightfast Desktop Application</p>
          
          {appInfo && (
            <div className="app-info">
              <p><strong>App:</strong> {appInfo.name}</p>
              <p><strong>Version:</strong> {appInfo.version}</p>
              <p><strong>Platform:</strong> {appInfo.platform}</p>
            </div>
          )}

          <div className="actions">
            <p className="update-info">Auto-update enabled</p>
          </div>

          <div className="tech-stack">
            <h3>Built with:</h3>
            <ul>
              <li>Electron + TypeScript</li>
              <li>React 18</li>
              <li>Vite</li>
              <li>Type-safe IPC</li>
            </ul>
          </div>
        </div>
      </header>
    </div>
  );
}

export default App;