import React from 'react';
import { X } from 'lucide-react';

interface InfoModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description: string;
    ranges?: { label: string; value: string }[];
}

const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose, title, description, ranges }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div
                className="glass-card p-6 w-full max-w-sm shadow-2xl relative animate-scale-in"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>

                <h3 className="text-lg font-semibold text-[var(--text-bright)] mb-3 pr-6">{title}</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
                    {description}
                </p>

                {ranges && (
                    <div className="glass-card-inner p-4 space-y-2.5">
                        {ranges.map((range, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                                <span className="text-[var(--text-tertiary)]">{range.label}</span>
                                <span className="font-data font-medium text-[var(--text-primary)]">{range.value}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default InfoModal;
