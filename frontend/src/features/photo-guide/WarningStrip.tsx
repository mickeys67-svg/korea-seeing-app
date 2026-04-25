/**
 * v5.1 Photo Guide — Warning strip
 *
 * HERO 바로 아래에 나타나는 작은 경고 배너. 경고가 없으면 렌더 안 함.
 */
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { PhotoWarning } from './objectExtractor';

interface Props {
    warnings: PhotoWarning[];
}

const WarningStrip: React.FC<Props> = ({ warnings }) => {
    if (!warnings || warnings.length === 0) return null;

    return (
        <div className="space-y-1.5">
            {warnings.map((w) => (
                <div
                    key={w.id}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
                    style={{
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        color: '#fca5a5',
                    }}
                >
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span className="flex-1">{w.text}</span>
                </div>
            ))}
        </div>
    );
};

export default WarningStrip;
