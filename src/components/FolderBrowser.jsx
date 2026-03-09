import React, { useState, useEffect, useCallback } from 'react';
import { Folder, FolderOpen, ArrowUp, Check, X, Loader2, Home, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { api } from '../utils/api';

export default function FolderBrowser({ onSelect, onCancel }) {
  const [currentPath, setCurrentPath] = useState('');
  const [parentPath, setParentPath] = useState(null);
  const [directories, setDirectories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pathInput, setPathInput] = useState('');

  const fetchDirectories = useCallback(async (dirPath) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.browseDirectories(dirPath || undefined);
      if (response.ok) {
        const data = await response.json();
        setCurrentPath(data.current);
        setParentPath(data.parent);
        setDirectories(data.directories);
        setPathInput(data.current);
      } else {
        const err = await response.json();
        setError(err.error || 'Failed to load directories');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDirectories('');
  }, [fetchDirectories]);

  const navigateTo = (dirName) => {
    const newPath = currentPath + '/' + dirName;
    fetchDirectories(newPath);
  };

  const navigateUp = () => {
    if (parentPath) {
      fetchDirectories(parentPath);
    }
  };

  const navigateHome = () => {
    fetchDirectories('');
  };

  const handlePathInputKeyDown = (e) => {
    if (e.key === 'Enter' && pathInput.trim()) {
      fetchDirectories(pathInput.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <FolderOpen className="w-4 h-4 text-primary" />
            Select Folder
          </div>
          <button
            onClick={onCancel}
            className="w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Path bar */}
        <div className="flex items-center gap-1 p-3 border-b border-border">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 px-0 shrink-0"
            onClick={navigateHome}
            title="Home directory"
          >
            <Home className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 px-0 shrink-0"
            onClick={navigateUp}
            disabled={!parentPath}
            title="Go up"
          >
            <ArrowUp className="w-4 h-4" />
          </Button>
          <Input
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            onKeyDown={handlePathInputKeyDown}
            placeholder="/path/to/directory"
            className="text-xs h-8 font-mono"
          />
        </div>

        {/* Directory listing */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-2">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Loading...
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-8 text-destructive gap-2">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">{error}</span>
              </div>
            ) : directories.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No subdirectories found
              </div>
            ) : (
              directories.map((dir) => (
                <button
                  key={dir}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent text-left transition-colors"
                  onDoubleClick={() => navigateTo(dir)}
                  onClick={() => {
                    setPathInput(currentPath + '/' + dir);
                  }}
                >
                  <Folder className="w-4 h-4 text-primary shrink-0" />
                  <span className="truncate">{dir}</span>
                </button>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="border-t border-border p-3">
          <div className="text-xs text-muted-foreground mb-2 truncate" title={pathInput}>
            Selected: <span className="font-mono">{pathInput || currentPath}</span>
          </div>
          <div className="flex gap-2 text-xs text-muted-foreground mb-2 italic">
            💡 Double-click to open a folder, single-click to select it
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onCancel}
              className="flex-1 h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => onSelect(pathInput || currentPath)}
              className="flex-1 h-8 text-xs"
            >
              <Check className="w-3 h-3 mr-1" />
              Select Folder
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
