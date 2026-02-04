import React from 'react';
import { Sparkles, Cat, Telescope } from 'lucide-react';

const Hero: React.FC = () => {
    return (
        <section className="text-center py-20 px-4 bg-gradient-to-b from-gray-900 via-blue-900/20 to-gray-900 border-b border-gray-800">
            <div className="max-w-4xl mx-auto flex flex-col items-center">
                <div className="relative mb-8">
                    <Telescope className="w-20 h-20 text-blue-400 opacity-20 absolute -top-10 -left-10 rotate-12" />
                    <Cat className="w-16 h-16 text-purple-400 opacity-20 absolute -bottom-8 -right-8 -rotate-12" />
                    <div className="w-24 h-24 rounded-full bg-blue-500/20 flex items-center justify-center border-2 border-blue-400/30 animate-pulse">
                        <Sparkles className="w-12 h-12 text-blue-400" />
                    </div>
                </div>
                <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
                    Stars & Whiskers
                </h1>
                <p className="text-xl md:text-2xl text-gray-300 max-w-2xl leading-relaxed font-light italic">
                    "Every bowl filled. Every star shared. Every life changed."
                </p>
                <div className="mt-10 w-16 h-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full opacity-50"></div>
            </div>
        </section>
    );
};

export default Hero;
