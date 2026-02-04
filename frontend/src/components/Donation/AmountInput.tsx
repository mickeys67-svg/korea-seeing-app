import React, { useState, useEffect } from 'react';
import { DollarSign, Zap, Coffee, Heart, Telescope, Users, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AmountInputProps {
    amount: string;
    onAmountChange: (val: string) => void;
    frequency: 'monthly' | 'one-time';
    onFrequencyChange: (freq: 'monthly' | 'one-time') => void;
}

const AmountInput: React.FC<AmountInputProps> = ({ amount, onAmountChange, frequency, onFrequencyChange }) => {
    const [isFocused, setIsFocused] = useState(false);

    const numAmount = parseFloat(amount) || 0;

    const getImpacts = (val: number) => {
        const list = [];
        if (val >= 1) list.push({ icon: Heart, text: "Every dollar protects a life" });
        if (val >= 5) list.push({ icon: Coffee, text: `Feeds ${Math.floor(val / 5)} cats for a full day` });
        if (val >= 15) list.push({ icon: Zap, text: "Supports critical vet care & vaccines" });
        if (val >= 25) list.push({ icon: Telescope, text: "Funds precision optics for our telescope" });
        if (val >= 50) list.push({ icon: Users, text: "Sponsors free star-gazing education" });
        return list;
    };

    const impacts = getImpacts(numAmount);

    return (
        <section className="py-20 px-6 max-w-4xl mx-auto">
            <div className="bg-gray-800/30 border border-gray-700/50 rounded-[3rem] p-8 md:p-16 space-y-12 backdrop-blur-xl relative shadow-2xl">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-500 px-6 py-2 rounded-full text-xs font-bold tracking-widest uppercase shadow-lg shadow-blue-500/20">
                    Your Gift, Your Way
                </div>

                <div className="text-center space-y-4 max-w-xl mx-auto">
                    <h3 className="text-3xl font-bold text-white tracking-tight italic">"What feels right to you?"</h3>
                    <p className="text-gray-400 font-light leading-relaxed">
                        We believe in transparency over pressure. There's no minimum, no maximum. Just what your heart and budget decide today.
                    </p>
                </div>

                {/* Frequency Toggle */}
                <div className="flex flex-col items-center space-y-6">
                    <div className="bg-gray-900/80 p-1 rounded-2xl flex border border-gray-800 w-full max-w-md">
                        <button
                            onClick={() => onFrequencyChange('monthly')}
                            className={`flex-1 py-4 rounded-xl text-sm font-bold transition-all ${frequency === 'monthly' ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            Monthly Support
                            <span className="block text-[10px] font-normal opacity-60 mt-0.5">Helps us plan and sustain</span>
                        </button>
                        <button
                            onClick={() => onFrequencyChange('one-time')}
                            className={`flex-1 py-4 rounded-xl text-sm font-bold transition-all ${frequency === 'one-time' ? 'bg-gray-700 text-white shadow-xl' : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            One-Time Gift
                            <span className="block text-[10px] font-normal opacity-60 mt-0.5">Give as you can</span>
                        </button>
                    </div>
                </div>

                {/* Amount Input */}
                <div className="flex flex-col items-center space-y-4">
                    <label className="text-[10px] uppercase tracking-[0.3em] text-blue-400 font-bold">What amount feels right?</label>
                    <div className={`relative transition-all duration-300 group ${isFocused ? 'scale-110' : ''}`}>
                        <DollarSign className={`absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 transition-colors ${isFocused ? 'text-blue-400' : 'text-gray-600'}`} />
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => onAmountChange(e.target.value)}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                            placeholder="0.00"
                            className="bg-gray-900/50 border-2 border-gray-800 rounded-[2rem] py-8 pl-14 pr-8 text-4xl font-bold text-white w-full max-w-sm text-center focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 placeholder:text-gray-800 appearance-none"
                        />
                    </div>
                    <p className="text-[10px] text-gray-500 italic">Enter any amount ($1 technical minimum)</p>
                </div>

                {/* Impact Preview */}
                <div className="pt-8 border-t border-gray-800 overflow-hidden">
                    <div className="flex items-center gap-2 mb-6 justify-center">
                        <Zap className="w-4 h-4 text-yellow-400" />
                        <span className="text-xs font-bold text-white uppercase tracking-widest">Impact Preview</span>
                    </div>

                    <div className="min-h-[160px] flex flex-col items-center">
                        {numAmount <= 0 ? (
                            <div className="flex flex-col items-center text-center opacity-40">
                                <Info className="w-10 h-10 text-gray-600 mb-2" />
                                <p className="text-sm text-gray-500 italic max-w-xs">
                                    We'll show you exactly what your specific gift will accomplish after you enter your amount.
                                </p>
                            </div>
                        ) : (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="w-full max-w-md space-y-4"
                            >
                                <p className="text-center font-bold text-lg mb-4 text-blue-300">
                                    ✨ Here's what your ${numAmount} will do:
                                </p>
                                <div className="grid grid-cols-1 gap-3">
                                    <AnimatePresence mode="popLayout">
                                        {impacts.map((impact, i) => {
                                            const Icon = impact.icon;
                                            return (
                                                <motion.div
                                                    key={impact.text}
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: 20 }}
                                                    transition={{ delay: i * 0.1 }}
                                                    className="flex items-center gap-4 bg-blue-500/5 border border-blue-500/10 p-4 rounded-2xl"
                                                >
                                                    <Icon className="w-5 h-5 text-blue-400 shrink-0" />
                                                    <span className="text-sm text-gray-300">{impact.text}</span>
                                                </motion.div>
                                            );
                                        })}
                                    </AnimatePresence>
                                </div>
                                {numAmount > 0 && (
                                    <p className="text-center text-gray-500 text-xs mt-4">
                                        Your generosity is truly appreciated! 💙
                                    </p>
                                )}
                            </motion.div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default AmountInput;
