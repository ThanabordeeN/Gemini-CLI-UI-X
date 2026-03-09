import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { X, FolderSearch, Plus, AlertCircle } from 'lucide-react';
import { api } from '../utils/api';

const ManualProjectModal = ({ isOpen, onClose, onProjectAdded }) => {
    const [path, setPath] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    if (!isOpen) return null;

    const handleBrowse = async () => {
        try {
            const response = await api.pickDirectory();
            if (response.ok) {
                const result = await response.json();
                if (result.path) {
                    setPath(result.path);
                }
            }
        } catch (err) {
            console.error('Error picking directory:', err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!path.trim()) return;

        setIsLoading(true);
        setError(null);

        try {
            const response = await api.createProject(path.trim());
            const result = await response.json();

            if (response.ok) {
                if (onProjectAdded) onProjectAdded(result.project);
                setPath('');
                onClose();

                // Refresh projects list
                if (window.refreshProjects) {
                    window.refreshProjects();
                }
            } else {
                setError(result.error || 'Failed to add project');
            }
        } catch (err) {
            setError(err.message || 'An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="relative w-full max-w-md bg-card border border-border rounded-xl shadow-2xl animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Plus className="w-4 h-4 text-primary" />
                        </div>
                        <h2 className="text-lg font-semibold text-foreground">Add Project</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">
                            Project Directory Path
                        </label>
                        <div className="flex gap-2">
                            <Input
                                value={path}
                                onChange={(e) => setPath(e.target.value)}
                                placeholder="C:\Users\name\project or /path/to/project"
                                className="flex-1 h-10"
                                autoFocus
                                disabled={isLoading}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                className="h-10 px-3 shrink-0"
                                onClick={handleBrowse}
                                disabled={isLoading}
                                title="Browse for folder"
                            >
                                <FolderSearch className="w-4 h-4" />
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Tip: You can paste an absolute path or browse to find it.
                        </p>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            className="flex-1"
                            onClick={onClose}
                            disabled={isLoading}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1"
                            disabled={!path.trim() || isLoading}
                        >
                            {isLoading ? 'Adding...' : 'Add Project'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ManualProjectModal;
