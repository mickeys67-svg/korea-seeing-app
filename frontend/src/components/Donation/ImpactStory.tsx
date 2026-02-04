import React from 'react';
import { Cat, Telescope, Heart, Star, CheckCircle2 } from 'lucide-react';

const ImpactStory: React.FC = () => {
    return (
        <section className="py-20 px-6 max-w-5xl mx-auto space-y-20">
            <div className="text-center space-y-4">
                <h2 className="text-sm uppercase tracking-[0.3em] text-blue-400 font-semibold">Our Dual Mission</h2>
                <h3 className="text-3xl md:text-4xl font-bold text-white">Making a Difference on Earth and Beyond</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* On Earth */}
                <div className="bg-gray-800/40 border border-gray-700 p-10 rounded-3xl space-y-6 hover:border-blue-500/50 transition-colors group">
                    <div className="w-14 h-14 bg-orange-500/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Cat className="w-8 h-8 text-orange-400" />
                    </div>
                    <h4 className="text-2xl font-bold text-white">🐾 ON EARTH</h4>
                    <p className="text-gray-400 leading-relaxed text-lg">
                        We rescue and care for 50+ stray cats in our neighborhood through TNR programs and daily feeding.
                    </p>
                    <div className="pt-4 italic border-t border-gray-700/50">
                        <p className="text-blue-300">"You are the guardian they've been waiting for."</p>
                    </div>
                </div>

                {/* Reaching the Stars */}
                <div className="bg-gray-800/40 border border-gray-700 p-10 rounded-3xl space-y-6 hover:border-purple-500/50 transition-colors group">
                    <div className="w-14 h-14 bg-purple-500/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Telescope className="w-8 h-8 text-purple-400" />
                    </div>
                    <h4 className="text-2xl font-bold text-white">🔭 REACHING THE STARS</h4>
                    <p className="text-gray-400 leading-relaxed text-lg">
                        We're building a community telescope—a 24-inch "light bucket" to inspire the next generation of dreamers and scientists.
                    </p>
                    <div className="pt-4 italic border-t border-gray-700/50">
                        <p className="text-purple-300">"You are the architect of this discovery."</p>
                    </div>
                </div>
            </div>

            <div className="bg-blue-900/10 border border-blue-500/20 p-12 rounded-[2.5rem] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[100px] -mr-32 -mt-32"></div>

                <div className="relative z-10 space-y-8">
                    <div className="flex items-center gap-3 mb-2">
                        <Heart className="w-6 h-6 text-red-400 fill-red-400/20" />
                        <h4 className="text-xl font-bold text-white uppercase tracking-wider">What your support makes possible</h4>
                    </div>

                    <p className="text-gray-400 text-lg italic">Every contribution, no matter the size:</p>

                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-12">
                        {[
                            "Feeds hungry cats in our community",
                            "Provides medical care and vaccines",
                            "Builds our community telescope",
                            "Hosts free star-gazing events",
                            "Inspires the next generation"
                        ].map((item, i) => (
                            <li key={i} className="flex items-center gap-3 text-gray-300">
                                <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0" />
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>

                    <div className="pt-6 border-t border-blue-500/10">
                        <p className="text-xl font-medium bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                            You decide what feels right to give.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default ImpactStory;
