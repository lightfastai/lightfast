import { useHotReload } from '../hooks/useHotReload';

export interface HotReloadStatusProps {
  /**
   * Whether to show detailed information
   * @default false
   */
  detailed?: boolean;
  
  /**
   * CSS class name for the container
   */
  className?: string;
}

/**
 * Component that displays the current hot-reload status and compilation information
 */
export function HotReloadStatus({ detailed = false, className = '' }: HotReloadStatusProps) {
  const [state, actions] = useHotReload({
    debug: process.env.NODE_ENV === 'development',
    onCompileSuccess: () => {
      // Optionally show a toast notification
      if (typeof window !== 'undefined') {
        console.log('🔥 Configuration reloaded successfully!');
      }
    },
    onCompileError: (error) => {
      // Optionally show error notification
      if (typeof window !== 'undefined') {
        console.error('❌ Configuration compilation failed:', error);
      }
    }
  });
  
  const getStatusColor = () => {
    if (!state.connected) return 'text-red-500';
    if (state.isCompiling) return 'text-yellow-500';
    if (state.lastCompilationResult?.success === false) return 'text-red-500';
    if (state.lastCompilationResult?.success === true) return 'text-green-500';
    return 'text-gray-500';
  };
  
  const getStatusText = () => {
    if (!state.connected) return 'Disconnected';
    if (state.isCompiling) return 'Compiling...';
    if (state.lastCompilationResult?.success === false) return 'Compilation Error';
    if (state.lastCompilationResult?.success === true) return 'Ready';
    return 'Watching';
  };
  
  const getStatusIcon = () => {
    if (!state.connected) return '🔴';
    if (state.isCompiling) return '🔄';
    if (state.lastCompilationResult?.success === false) return '❌';
    if (state.lastCompilationResult?.success === true) return '✅';
    return '👁️';
  };
  
  return (
    <div className={`p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-lg">{getStatusIcon()}</span>
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Hot Reload
          </h3>
          <span className={`text-xs font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={() => actions.forceCompile()}
            disabled={state.isCompiling || !state.connected}
            className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
            title="Force recompile configuration"
          >
            {state.isCompiling ? '⏳' : '🔄'}
          </button>
          
          <button
            onClick={() => actions.reconnect()}
            disabled={state.connected}
            className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
            title="Reconnect to hot reload service"
          >
            🔌
          </button>
        </div>
      </div>
      
      {detailed && (
        <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="font-medium">Watched Files:</span> {state.watchedPaths.length}
            </div>
            <div>
              <span className="font-medium">Compilations:</span> {state.compilationCount}
            </div>
          </div>
          
          {state.watchedPaths.length > 0 && (
            <div>
              <div className="font-medium mb-1">Configuration Files:</div>
              <ul className="space-y-1">
                {state.watchedPaths.map((path, index) => (
                  <li key={index} className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                    {path.replace(process.cwd?.() || '', '').replace(/^\//, '')}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {state.lastCompilationResult && (
            <div>
              <div className="font-medium mb-1">Last Compilation:</div>
              <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded">
                <div className="flex justify-between items-center mb-1">
                  <span className={state.lastCompilationResult.success ? 'text-green-600' : 'text-red-600'}>
                    {state.lastCompilationResult.success ? 'Success' : 'Failed'}
                  </span>
                  <span className="text-gray-500">
                    {state.lastCompilationResult.compilationTime
                      ? `${state.lastCompilationResult.compilationTime.toFixed(1)}ms`
                      : 'N/A'}
                  </span>
                </div>
                
                {state.lastCompilationResult.sourcePath && (
                  <div className="font-mono text-xs mb-1">
                    {state.lastCompilationResult.sourcePath.replace(process.cwd?.() || '', '').replace(/^\//, '')}
                  </div>
                )}
                
                {state.lastCompilationResult.warnings && state.lastCompilationResult.warnings.length > 0 && (
                  <div className="text-yellow-600">
                    <div className="font-medium">Warnings:</div>
                    <ul className="list-disc list-inside">
                      {state.lastCompilationResult.warnings.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {state.lastCompilationResult.errors && state.lastCompilationResult.errors.length > 0 && (
                  <div className="text-red-600">
                    <div className="font-medium">Errors:</div>
                    <ul className="list-disc list-inside">
                      {state.lastCompilationResult.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {state.error && (
            <div className="text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">
              <div className="font-medium">Connection Error:</div>
              <div>{state.error}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default HotReloadStatus;