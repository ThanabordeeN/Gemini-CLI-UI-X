import React, { useState, useEffect } from 'react';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Folder, FolderOpen, File, FileText, FileCode, List, TableProperties, Eye, FilePlus, FolderPlus, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import CodeEditor from './CodeEditor';
import ImageViewer from './ImageViewer';
import { api } from '../utils/api';

function FileTree({ selectedProject }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState(new Set());
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [viewMode, setViewMode] = useState('detailed'); // 'simple', 'detailed', 'compact'
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [modalConfig, setModalConfig] = useState(null);

  useEffect(() => {
    if (selectedProject) {
      fetchFiles(false); // initial load, show loading indicator
    }
  }, [selectedProject]);

  // Auto-refresh when files are created/modified
  useEffect(() => {
    if (!selectedProject) return;

    // Set up auto-refresh on file operations
    const handleFileOperation = (event) => {
      // Custom event triggered when files are created/modified
      if (event.detail?.projectName === selectedProject.name) {
        // console.log('File operation detected, refreshing file tree...');
        fetchFiles(true); // background refresh
      }
    };

    // Listen for file operation events
    window.addEventListener('file-operation', handleFileOperation);

    // Also refresh when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && selectedProject) {
        const timeSinceRefresh = Date.now() - lastRefresh;
        // Only refresh if more than 2 seconds have passed
        if (timeSinceRefresh > 2000) {
          fetchFiles(true); // background refresh
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Set up periodic refresh (every 5 seconds if panel is active)
    const intervalId = setInterval(() => {
      const filesPanel = document.querySelector('[data-panel="files"]');
      if (filesPanel && !filesPanel.classList.contains('hidden')) {
        fetchFiles(true); // background refresh
      }
    }, 5000);

    return () => {
      window.removeEventListener('file-operation', handleFileOperation);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(intervalId);
    };
  }, [selectedProject, lastRefresh]);

  // Load view mode preference from localStorage
  useEffect(() => {
    const savedViewMode = localStorage.getItem('file-tree-view-mode');
    if (savedViewMode && ['simple', 'detailed', 'compact'].includes(savedViewMode)) {
      setViewMode(savedViewMode);
    }
  }, []);

  const fetchFiles = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const response = await api.getFiles(selectedProject.name);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ File fetch failed:', response.status, errorText);
        setFiles([]);
        return;
      }

      const data = await response.json();
      setFiles(data);
      setLastRefresh(Date.now());
    } catch (error) {
      console.error('❌ Error fetching files:', error);
      setFiles([]);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  // Expose refresh function globally for other components to trigger
  useEffect(() => {
    if (selectedProject) {
      window.refreshFileTree = () => {
        // console.log('Manual file tree refresh triggered');
        fetchFiles(true);
      };
    }
    return () => {
      delete window.refreshFileTree;
    };
  }, [selectedProject]);

  const handleCreateFile = (currentPath = null) => {
    if (!selectedProject) return;
    setModalConfig({
      type: 'prompt',
      title: 'Create File',
      message: 'Enter file name (e.g., newfile.txt):',
      placeholder: 'newfile.txt',
      onConfirm: async (name) => {
        if (!name?.trim()) { setModalConfig(null); return; }
        setModalConfig(null);

        // Construct absolute path
        const targetDir = currentPath || selectedProject.path;
        const separator = targetDir.includes('\\') || selectedProject.path.includes('\\') ? '\\' : '/';
        const fullPath = `${targetDir}${separator}${name.trim()}`;

        try {
          const response = await api.createFile(selectedProject.name, fullPath);
          if (response.ok) fetchFiles(true);
          else {
            let errMsg = 'Failed to create file';
            try { const err = await response.json(); errMsg = err.error || errMsg; } catch (_) { errMsg = `Server error (${response.status})`; }
            setModalConfig({ type: 'alert', title: 'Error', message: `${errMsg}\n(Did you restart the server?)`, onConfirm: () => setModalConfig(null) });
          }
        } catch (e) {
          setModalConfig({ type: 'alert', title: 'Error', message: e.message, onConfirm: () => setModalConfig(null) });
        }
      }
    });
  };

  const handleCreateFolder = (currentPath = null) => {
    if (!selectedProject) return;
    setModalConfig({
      type: 'prompt',
      title: 'Create Folder',
      message: 'Enter folder name:',
      placeholder: 'New Folder',
      onConfirm: async (name) => {
        if (!name?.trim()) { setModalConfig(null); return; }
        setModalConfig(null);

        const targetDir = currentPath || selectedProject.path;
        const separator = targetDir.includes('\\') || selectedProject.path.includes('\\') ? '\\' : '/';
        const fullPath = `${targetDir}${separator}${name.trim()}`;

        try {
          const response = await api.createFolder(selectedProject.name, fullPath);
          if (response.ok) fetchFiles(true);
          else {
            let errMsg = 'Failed to create folder';
            try { const err = await response.json(); errMsg = err.error || errMsg; } catch (_) { errMsg = `Server error (${response.status})`; }
            setModalConfig({ type: 'alert', title: 'Error', message: `${errMsg}\n(Did you restart the server?)`, onConfirm: () => setModalConfig(null) });
          }
        } catch (e) {
          setModalConfig({ type: 'alert', title: 'Error', message: e.message, onConfirm: () => setModalConfig(null) });
        }
      }
    });
  };

  const handleDelete = (item) => {
    if (!selectedProject) return;
    const isFolder = item.type === 'directory';

    setModalConfig({
      type: 'confirm',
      title: `Delete ${isFolder ? 'Folder' : 'File'}`,
      message: `Are you sure you want to delete this ${isFolder ? 'folder' : 'file'}?\n${item.name}`,
      onConfirm: async () => {
        setModalConfig(null);
        try {
          const response = isFolder
            ? await api.deleteFolder(selectedProject.name, item.path)
            : await api.deleteFile(selectedProject.name, item.path);

          if (response.ok) fetchFiles(true);
          else {
            let errMsg = 'Failed to delete';
            try { const err = await response.json(); errMsg = err.error || errMsg; } catch (_) { errMsg = `Server error (${response.status})`; }
            setModalConfig({ type: 'alert', title: 'Error', message: `${errMsg}\n(Did you restart the server?)`, onConfirm: () => setModalConfig(null) });
          }
        } catch (e) {
          setModalConfig({ type: 'alert', title: 'Error', message: e.message, onConfirm: () => setModalConfig(null) });
        }
      }
    });
  };

  const toggleDirectory = (path) => {
    const newExpanded = new Set(expandedDirs);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedDirs(newExpanded);
  };

  // Change view mode and save preference
  const changeViewMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem('file-tree-view-mode', mode);
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Format date as relative time
  const formatRelativeTime = (date) => {
    if (!date) return '-';
    const now = new Date();
    const past = new Date(date);
    const diffInSeconds = Math.floor((now - past) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return past.toLocaleDateString();
  };

  const renderFileTree = (items, level = 0) => {
    return items.map((item) => (
      <div key={item.path} className="select-none relative group">
        <div className="flex items-center w-full">
          <Button
            variant="ghost"
            className={cn(
              "flex-1 justify-start p-2 h-auto font-normal text-left hover:bg-accent",
            )}
            style={{ paddingLeft: `${level * 16 + 12}px` }}
            onClick={() => {
              if (item.type === 'directory') {
                toggleDirectory(item.path);
              } else if (isImageFile(item.name)) {
                // Open image in viewer
                setSelectedImage({
                  name: item.name,
                  path: item.path,
                  projectPath: selectedProject.path,
                  projectName: selectedProject.name
                });
              } else {
                // Open file in editor
                setSelectedFile({
                  name: item.name,
                  path: item.path,
                  projectPath: selectedProject.path,
                  projectName: selectedProject.name
                });
              }
            }}
          >
            <div className="flex items-center gap-2 min-w-0 w-full">
              {item.type === 'directory' ? (
                expandedDirs.has(item.path) ? (
                  <FolderOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
                ) : (
                  <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                )
              ) : (
                getFileIcon(item.name)
              )}
              <span className="text-sm truncate text-foreground pr-16">
                {item.name}
              </span>
            </div>
          </Button>

          <div className="hidden group-hover:flex items-center absolute right-2 bg-background/90 px-1 py-0.5 gap-1 rounded-md shadow-sm border border-border z-50 pointer-events-auto">
            {item.type === 'directory' && (
              <>
                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleCreateFile(item.path); }} title="New File">
                  <FilePlus className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground pointer-events-none" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleCreateFolder(item.path); }} title="New Folder">
                  <FolderPlus className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground pointer-events-none" />
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(item); }} title="Delete">
              <Trash2 className="h-3.5 w-3.5 pointer-events-none" />
            </Button>
          </div>
        </div>

        {item.type === 'directory' &&
          expandedDirs.has(item.path) &&
          item.children &&
          item.children.length > 0 && (
            <div>
              {renderFileTree(item.children, level + 1)}
            </div>
          )}
      </div>
    ));
  };

  const isImageFile = (filename) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'];
    return imageExtensions.includes(ext);
  };

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop()?.toLowerCase();

    const codeExtensions = ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'php', 'rb', 'go', 'rs'];
    const docExtensions = ['md', 'txt', 'doc', 'pdf'];
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'];

    if (codeExtensions.includes(ext)) {
      return <FileCode className="w-4 h-4 text-green-500 flex-shrink-0" />;
    } else if (docExtensions.includes(ext)) {
      return <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />;
    } else if (imageExtensions.includes(ext)) {
      return <File className="w-4 h-4 text-purple-500 flex-shrink-0" />;
    } else {
      return <File className="w-4 h-4 text-muted-foreground flex-shrink-0" />;
    }
  };

  // Render detailed view with table-like layout
  const renderDetailedView = (items, level = 0) => {
    return items.map((item) => (
      <div key={item.path} className="select-none relative group">
        <div className="flex items-center w-full">
          <div
            className={cn(
              "flex-1 grid grid-cols-12 gap-2 p-2 hover:bg-accent cursor-pointer items-center",
            )}
            style={{ paddingLeft: `${level * 16 + 12}px` }}
            onClick={() => {
              if (item.type === 'directory') {
                toggleDirectory(item.path);
              } else if (isImageFile(item.name)) {
                setSelectedImage({
                  name: item.name,
                  path: item.path,
                  projectPath: selectedProject.path,
                  projectName: selectedProject.name
                });
              } else {
                setSelectedFile({
                  name: item.name,
                  path: item.path,
                  projectPath: selectedProject.path,
                  projectName: selectedProject.name
                });
              }
            }}
          >
            <div className="col-span-5 flex items-center gap-2 min-w-0 pointer-events-none">
              {item.type === 'directory' ? (
                expandedDirs.has(item.path) ? (
                  <FolderOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
                ) : (
                  <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                )
              ) : (
                getFileIcon(item.name)
              )}
              <span className="text-sm truncate text-foreground pr-16">
                {item.name}
              </span>
            </div>
            <div className="col-span-2 text-sm text-muted-foreground pointer-events-none">
              {item.type === 'file' ? formatFileSize(item.size) : '-'}
            </div>
            <div className="col-span-3 text-sm text-muted-foreground pointer-events-none">
              {formatRelativeTime(item.modified)}
            </div>
            <div className="col-span-2 text-sm text-muted-foreground font-mono pointer-events-none">
              {item.permissionsRwx || '-'}
            </div>
          </div>

          <div className="hidden group-hover:flex items-center absolute right-[30%] bg-background/90 px-1 py-0.5 gap-1 rounded-md shadow-sm border border-border z-50 pointer-events-auto">
            {item.type === 'directory' && (
              <>
                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleCreateFile(item.path); }} title="New File">
                  <FilePlus className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground pointer-events-none" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleCreateFolder(item.path); }} title="New Folder">
                  <FolderPlus className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground pointer-events-none" />
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(item); }} title="Delete">
              <Trash2 className="h-3.5 w-3.5 pointer-events-none" />
            </Button>
          </div>
        </div>

        {item.type === 'directory' &&
          expandedDirs.has(item.path) &&
          item.children &&
          renderDetailedView(item.children, level + 1)}
      </div>
    ));
  };

  // Render compact view with inline details
  const renderCompactView = (items, level = 0) => {
    return items.map((item) => (
      <div key={item.path} className="select-none relative group">
        <div className="flex items-center w-full">
          <div
            className={cn(
              "flex-1 flex items-center justify-between p-2 hover:bg-accent cursor-pointer",
            )}
            style={{ paddingLeft: `${level * 16 + 12}px` }}
            onClick={() => {
              if (item.type === 'directory') {
                toggleDirectory(item.path);
              } else if (isImageFile(item.name)) {
                setSelectedImage({
                  name: item.name,
                  path: item.path,
                  projectPath: selectedProject.path,
                  projectName: selectedProject.name
                });
              } else {
                setSelectedFile({
                  name: item.name,
                  path: item.path,
                  projectPath: selectedProject.path,
                  projectName: selectedProject.name
                });
              }
            }}
          >
            <div className="flex items-center gap-2 min-w-0 pointer-events-none pr-16">
              {item.type === 'directory' ? (
                expandedDirs.has(item.path) ? (
                  <FolderOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
                ) : (
                  <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                )
              ) : (
                getFileIcon(item.name)
              )}
              <span className="text-sm truncate text-foreground">
                {item.name}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground pointer-events-none">
              {item.type === 'file' && (
                <>
                  <span>{formatFileSize(item.size)}</span>
                  <span className="font-mono">{item.permissionsRwx}</span>
                </>
              )}
            </div>
          </div>

          <div className="hidden group-hover:flex items-center absolute right-2 bg-background/90 px-1 py-0.5 gap-1 rounded-md shadow-sm border border-border z-50 pointer-events-auto">
            {item.type === 'directory' && (
              <>
                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleCreateFile(item.path); }} title="New File">
                  <FilePlus className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground pointer-events-none" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleCreateFolder(item.path); }} title="New Folder">
                  <FolderPlus className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground pointer-events-none" />
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(item); }} title="Delete">
              <Trash2 className="h-3.5 w-3.5 pointer-events-none" />
            </Button>
          </div>
        </div>

        {item.type === 'directory' &&
          expandedDirs.has(item.path) &&
          item.children &&
          renderCompactView(item.children, level + 1)}
      </div>
    ));
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">
          Loading files...
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-card">
      {/* View Mode Toggle */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Files</h3>
        <div className="flex gap-2 items-center">
          <div className="flex gap-0.5 border-r border-border pr-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => handleCreateFile()}
              title="New File in Root"
              disabled={!selectedProject}
            >
              <FilePlus className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => handleCreateFolder()}
              title="New Folder in Root"
              disabled={!selectedProject}
            >
              <FolderPlus className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex gap-1">
            <Button
              variant={viewMode === 'simple' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => changeViewMode('simple')}
              title="Simple view"
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'compact' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => changeViewMode('compact')}
              title="Compact view"
            >
              <Eye className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'detailed' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => changeViewMode('detailed')}
              title="Detailed view"
            >
              <TableProperties className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Column Headers for Detailed View */}
      {viewMode === 'detailed' && files.length > 0 && (
        <div className="px-4 pt-2 pb-1 border-b border-border">
          <div className="grid grid-cols-12 gap-2 px-2 text-xs font-medium text-muted-foreground">
            <div className="col-span-5">Name</div>
            <div className="col-span-2">Size</div>
            <div className="col-span-3">Modified</div>
            <div className="col-span-2">Permissions</div>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1 p-4">
        {files.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mx-auto mb-3">
              <Folder className="w-6 h-6 text-muted-foreground" />
            </div>
            <h4 className="font-medium text-foreground mb-1">No files found</h4>
            <p className="text-sm text-muted-foreground">
              Check if the project path is accessible
            </p>
          </div>
        ) : (
          <div className={viewMode === 'detailed' ? '' : 'space-y-1'}>
            {viewMode === 'simple' && renderFileTree(files)}
            {viewMode === 'compact' && renderCompactView(files)}
            {viewMode === 'detailed' && renderDetailedView(files)}
          </div>
        )}
      </ScrollArea>

      {/* Code Editor Modal */}
      {selectedFile && (
        <CodeEditor
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
          projectPath={selectedFile.projectPath}
        />
      )}

      {/* Image Viewer Modal */}
      {selectedImage && (
        <ImageViewer
          file={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}

      {/* Custom Modal for Prompts/Confirms/Alerts */}
      {modalConfig && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
          <div className="bg-background border border-border rounded-lg shadow-lg p-5 w-full max-w-sm">
            <h3 className="text-lg font-medium mb-2 text-foreground">{modalConfig.title}</h3>
            {modalConfig.message && (
              <p className="text-sm text-muted-foreground mb-4 whitespace-pre-wrap">{modalConfig.message}</p>
            )}
            {modalConfig.type === 'prompt' && (
              <input
                type="text"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors mb-4 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder={modalConfig.placeholder}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    modalConfig.onConfirm(e.target.value);
                  } else if (e.key === 'Escape') {
                    setModalConfig(null);
                  }
                }}
                id="prompt-input"
              />
            )}
            <div className="flex justify-end gap-2 mt-2">
              {modalConfig.type !== 'alert' && (
                <Button variant="outline" onClick={() => setModalConfig(null)}>
                  Cancel
                </Button>
              )}
              <Button
                variant={modalConfig.type === 'confirm' && modalConfig.title.includes('Delete') ? 'destructive' : 'default'}
                onClick={() => {
                  if (modalConfig.type === 'prompt') {
                    const val = document.getElementById('prompt-input')?.value;
                    modalConfig.onConfirm(val);
                  } else {
                    modalConfig.onConfirm();
                  }
                }}
              >
                {modalConfig.type === 'alert' ? 'OK' : 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FileTree;