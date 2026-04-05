'use client';

import { useState } from 'react';

interface FigmaExportProps {
  onExport: (accessToken: string, fileKey: string) => Promise<void>;
  disabled?: boolean;
}

export default function FigmaExport({ onExport, disabled }: FigmaExportProps) {
  const [accessToken, setAccessToken] = useState('');
  const [fileKey, setFileKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleExport = async () => {
    if (!accessToken.trim() || !fileKey.trim()) {
      setError('Please provide both access token and file key');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await onExport(accessToken, fileKey);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-6 border border-gray-300 rounded-lg bg-white">
      <h3 className="text-lg font-semibold">Export to Figma</h3>

      <div className="flex flex-col gap-2">
        <label htmlFor="accessToken" className="text-sm font-medium">
          Figma Access Token
        </label>
        <input
          id="accessToken"
          type="password"
          value={accessToken}
          onChange={e => setAccessToken(e.target.value)}
          placeholder="figd_..."
          disabled={disabled || loading}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
        />
        <a
          href="https://help.figma.com/hc/en-us/articles/8085703771159-Manage-personal-access-tokens"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline"
        >
          How to get your access token
        </a>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="fileKey" className="text-sm font-medium">
          Figma File Key
        </label>
        <input
          id="fileKey"
          type="text"
          value={fileKey}
          onChange={e => setFileKey(e.target.value)}
          placeholder="abc123def456"
          disabled={disabled || loading}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
        />
        <p className="text-xs text-gray-600">
          Found in your Figma file URL: figma.com/file/<strong>FILE_KEY</strong>/...
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-300 rounded-lg text-red-800 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 border border-green-300 rounded-lg text-green-800 text-sm">
          Successfully exported to Figma!
        </div>
      )}

      <button
        onClick={handleExport}
        disabled={disabled || loading}
        className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
      >
        {loading ? 'Exporting...' : 'Export to Figma'}
      </button>
    </div>
  );
}
