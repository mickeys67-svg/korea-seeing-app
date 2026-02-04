import React from 'react';
import { Sparkles, CheckCircle2, Heart, Calendar, Share2, Home, Settings } from 'lucide-react';
import { motion } from 'framer-motion';

interface ThankYouProps {
    amount: string;
    frequency: string;
    email: string;
    onReset: () => void;
}

const ThankYou: React.FC<ThankYouProps> = ({ amount, frequency, email, onReset }) => {
    const numAmount = parseFloat(amount) || 0;

    const getImpacts = (val: number) => {
        const impacts = [];
        if (val >= 1 && val < 10) {
            impacts.push("Every dollar reflects your kindness.");
            impacts.push("Your gift directly covers daily feeding costs for our colony.");
        } else if (val >= 10 && val < 25) {
            impacts.push(`Feeds ${Math.floor(val / 2)} cats for a full day of comfort`);
            impacts.push("Powers our critical neighborhood medical and rescue fund");
        } else if (val >= 25 && val < 50) {
            impacts.push("Ensures our entire colony is fed and happy for several days");
            impacts.push("Funds high-precision components for our community telescope");
            impacts.push("Makes upcoming community star parties possible for all");
        } else if (val >= 50 && val < 100) {
            impacts.push("Provides comprehensive vaccines and checkups for multiple rescues");
            impacts.push("Significant contribution towards the 24-inch telescope mirror");
            impacts.push("Sponsors local student attendance at astronomical events");
        } else if (val >= 100) {
            impacts.push("A transformative gift—you are a pillar of both Earth and Stars");
            impacts.push("Enables us to plan major rescue and builds with total confidence");
            impacts.push("Your generosity changes the landscape of what's possible here");
        }

        if (frequency === 'monthly') {
            const annual = val * 12;
            impacts.push(`🔥 Annual Impact: $${annual} — This sustained support is our lifeblood!`);
        }
        return impacts;
    };

    const impacts = getImpacts(numAmount);

    return (
        <section className="py-20 px-6 max-w-3xl mx-auto">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gray-800/50 border-2 border-blue-500/30 rounded-[3rem] p-10 md:p-20 text-center space-y-12 relative overflow-hidden backdrop-blur-2xl shadow-[0_0_100px_rgba(59,130,246,0.15)]"
            >
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[100px] -mr-32 -mt-32"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 blur-[100px] -ml-32 -mb-32"></div>

                <div className="relative z-10 flex flex-col items-center gap-6">
                    <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-2xl animate-bounce">
                        <Sparkles className="w-12 h-12 text-white" />
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-4xl font-bold text-white tracking-tight">YOU'RE AMAZING!</h2>
                        <p className="text-gray-400 italic">Thank you for trusting us with your gift of ${numAmount}</p>
                    </div>
                </div>

                <div className="relative z-10 space-y-6 pt-8 border-t border-gray-700/50">
                    <div className="flex items-center gap-2 justify-center mb-2">
                        <Heart className="w-4 h-4 text-red-400 fill-red-400/20" />
                        <h3 className="text-xs font-bold text-white uppercase tracking-[0.2em]">Your Specific Impact</h3>
                    </div>

                    <div className="space-y-4 text-left max-w-md mx-auto">
                        {impacts.map((text, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3 + (i * 0.1) }}
                                className="flex items-start gap-3 bg-white/5 p-4 rounded-2xl border border-white/5"
                            >
                                <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                                <p className="text-sm text-gray-200 leading-relaxed">{text}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>

                <div className="relative z-10 pt-8 border-t border-gray-700/50 flex flex-col items-center gap-4">
                    <div className="flex flex-col items-center gap-1">
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Confirmation sent to</p>
                        <div className="bg-gray-900/50 px-4 py-1.5 rounded-full border border-gray-800 text-xs text-blue-300 font-mono">
                            {email}
                        </div>
                    </div>
                    {frequency === 'monthly' && (
                        <div className="flex items-center gap-2 text-[10px] text-gray-500 bg-blue-500/5 px-3 py-1 rounded-lg border border-blue-500/10">
                            <Calendar className="w-3 h-3" />
                            <span>Next gift active: March 5th, 2026</span>
                        </div>
                    )}
                </div>

                <div className="relative z-10 pt-10 flex flex-wrap justify-center gap-4">
                    <button
                        onClick={onReset}
                        className="px-8 py-4 bg-white text-black rounded-2xl font-bold flex items-center gap-2 hover:bg-gray-200 transition-all active:scale-95 shadow-xl shadow-white/5"
                    >
                        <Home className="w-4 h-4" /> Home
                    </button>
                    <button className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all active:scale-95 shadow-xl shadow-blue-600/20">
                        <Share2 className="w-4 h-4" /> Share
                    </button>
                    <button className="px-6 py-4 bg-gray-800 text-gray-400 rounded-2xl font-bold flex items-center gap-2 hover:bg-gray-700 transition-all active:scale-95">
                        <Settings className="w-4 h-4" /> Manage
                    </button>
                </div>

                <div className="relative z-10 pt-10">
                    <p className="text-gray-600 italic text-sm font-light">
                        "No gift is too small. Every dollar feeds hope."
                    </p>
                </div>
            </motion.div>
        </section>
    );
};

export default ThankYou;
