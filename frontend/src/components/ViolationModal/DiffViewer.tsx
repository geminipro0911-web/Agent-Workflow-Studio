import React from 'react';
import { GitCommit, Copy, Check } from 'lucide-react';

interface DiffViewerProps {
  diffText: string;
  filePath: string;
  status?: string;
}

interface ParsedLine {
  type: 'add' | 'del' | 'chunk' | 'normal';
  content: string;
  oldNum?: number;
  newNum?: number;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ diffText, filePath, status = 'modified' }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(diffText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Simple unified diff parser
  const parsedLines: ParsedLine[] = React.useMemo(() => {
    if (!diffText) return [];
    const rawLines = diffText.split('\n');
    const result: ParsedLine[] = [];

    let oldLine = 1;
    let newLine = 1;

    for (const line of rawLines) {
      if (line.startsWith('@@')) {
        // Chunk header @@ -1,4 +1,5 @@
        const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (match) {
          oldLine = parseInt(match[1], 10);
          newLine = parseInt(match[2], 10);
        }
        result.push({ type: 'chunk', content: line });
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        result.push({
          type: 'add',
          content: line.slice(1),
          newNum: newLine++,
        });
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        result.push({
          type: 'del',
          content: line.slice(1),
          oldNum: oldLine++,
        });
      } else if (line.startsWith('---') || line.startsWith('+++')) {
        // Skip file headers or treat as chunk info
        result.push({ type: 'chunk', content: line });
      } else {
        result.push({
          type: 'normal',
          content: line.startsWith(' ') ? line.slice(1) : line,
          oldNum: oldLine++,
          newNum: newLine++,
        });
      }
    }
    return result;
  }, [diffText]);

  const additions = parsedLines.filter((l) => l.type === 'add').length;
  const deletions = parsedLines.filter((l) => l.type === 'del').length;

  return (
    <div className="flex flex-col border border-gray-700/80 rounded-lg overflow-hidden bg-[#0D1117] shadow-inner text-sm font-mono">
      {/* File Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-[#161B22] border-b border-gray-700/80">
        <div className="flex items-center gap-2 overflow-hidden">
          <GitCommit className="w-4 h-4 text-gray-400 shrink-0" />
          <span className="font-semibold text-gray-200 truncate">{filePath}</span>
          <span
            className={`text-xs px-2 py-0.5 rounded uppercase font-sans font-medium ${
              status === 'added' || status === 'untracked'
                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-700/50'
                : status === 'deleted'
                ? 'bg-rose-950/80 text-rose-400 border border-rose-700/50'
                : 'bg-amber-950/80 text-amber-400 border border-amber-700/50'
            }`}
          >
            {status}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-emerald-400 font-bold">+{additions}</span>
            <span className="text-rose-400 font-bold">-{deletions}</span>
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 px-2 py-1 bg-gray-800/80 hover:bg-gray-700 rounded transition"
            title="Copy diff to clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Diff Content Lines */}
      <div className="overflow-x-auto max-h-[360px] scrollbar-thin scrollbar-thumb-gray-700">
        {parsedLines.length === 0 ? (
          <div className="p-6 text-center text-gray-500 italic">No diff content available for this file.</div>
        ) : (
          <table className="w-full text-xs font-mono border-collapse">
            <tbody>
              {parsedLines.map((line, idx) => {
                if (line.type === 'chunk') {
                  return (
                    <tr key={idx} className="bg-[#1c2438] text-cyan-300 font-medium select-none">
                      <td colSpan={2} className="px-2 py-1 text-right text-gray-500 w-16 select-none border-r border-gray-700/60">
                        ...
                      </td>
                      <td className="px-3 py-1 font-mono">{line.content}</td>
                    </tr>
                  );
                }

                if (line.type === 'add') {
                  return (
                    <tr key={idx} className="bg-emerald-950/35 hover:bg-emerald-900/30 text-emerald-200">
                      <td className="px-1.5 py-0.5 text-right text-emerald-600/70 select-none w-8 text-[11px] border-r border-gray-800"></td>
                      <td className="px-1.5 py-0.5 text-right text-emerald-400 select-none w-8 text-[11px] border-r border-emerald-800/40">
                        {line.newNum}
                      </td>
                      <td className="px-3 py-0.5 whitespace-pre">
                        <span className="text-emerald-400 font-bold mr-1.5 select-none">+</span>
                        {line.content}
                      </td>
                    </tr>
                  );
                }

                if (line.type === 'del') {
                  return (
                    <tr key={idx} className="bg-rose-950/35 hover:bg-rose-900/30 text-rose-200">
                      <td className="px-1.5 py-0.5 text-right text-rose-400 select-none w-8 text-[11px] border-r border-gray-800">
                        {line.oldNum}
                      </td>
                      <td className="px-1.5 py-0.5 text-right text-rose-600/70 select-none w-8 text-[11px] border-r border-rose-800/40"></td>
                      <td className="px-3 py-0.5 whitespace-pre">
                        <span className="text-rose-400 font-bold mr-1.5 select-none">-</span>
                        {line.content}
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={idx} className="hover:bg-gray-800/30 text-gray-300">
                    <td className="px-1.5 py-0.5 text-right text-gray-500 select-none w-8 text-[11px] border-r border-gray-800">
                      {line.oldNum}
                    </td>
                    <td className="px-1.5 py-0.5 text-right text-gray-500 select-none w-8 text-[11px] border-r border-gray-800">
                      {line.newNum}
                    </td>
                    <td className="px-3 py-0.5 whitespace-pre text-gray-300">
                      <span className="text-transparent mr-1.5 select-none">&nbsp;</span>
                      {line.content}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
