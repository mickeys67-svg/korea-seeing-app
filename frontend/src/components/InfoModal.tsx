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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative animate-in fade-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white"
                >
                    <X className="w-5 h-5" />
                </button>

                <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
                <p className="text-gray-300 text-sm leading-relaxed mb-4">
                    {description}
                </p>

                {ranges && (
                    <div className="bg-gray-700/50 rounded-lg p-3 space-y-2">
                        {ranges.map((range, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                                <span className="text-gray-400">{range.label}</span>
                                <span className="text-white font-medium">{range.value}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default InfoModal;
