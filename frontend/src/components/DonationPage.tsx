import React, { useState } from 'react';
import Hero from './Donation/Hero';
import ImpactStory from './Donation/ImpactStory';
import ProjectSelection from './Donation/ProjectSelection';
import AmountInput from './Donation/AmountInput';
import PaymentForm from './Donation/PaymentForm';
import ThankYou from './Donation/ThankYou';

const DonationPage: React.FC = () => {
    const [step, setStep] = useState<'donate' | 'success'>('donate');
    const [selectedProjects, setSelectedProjects] = useState<string[]>(['feed', 'optics']);
    const [amount, setAmount] = useState<string>("");
    const [frequency, setFrequency] = useState<'monthly' | 'one-time'>('monthly');
    const [donorInfo, setDonorInfo] = useState({ name: '', email: '' });

    const toggleProject = (id: string) => {
        if (selectedProjects.includes(id)) {
            setSelectedProjects(selectedProjects.filter(p => p !== id));
        } else {
            setSelectedProjects([...selectedProjects, id]);
        }
    };

    const selectAll = () => {
        setSelectedProjects(['feed', 'health', 'optics', 'educate']);
    };

    const handlePaymentSuccess = (data: any) => {
        setDonorInfo({ name: data.name, email: data.email });
        setStep('success');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const reset = () => {
        setStep('donate');
        setAmount("");
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (step === 'success') {
        return (
            <div className="min-h-screen bg-gray-900 text-gray-100 font-sans selection:bg-blue-500 selection:text-white pb-20">
                <ThankYou
                    amount={amount}
                    frequency={frequency}
                    email={donorInfo.email}
                    onReset={reset}
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 font-sans selection:bg-blue-500 selection:text-white pb-32">
            <Hero />

            <main className="divide-y divide-gray-800/50">
                <ImpactStory />

                <div className="bg-gradient-to-b from-gray-900 to-blue-900/10">
                    <ProjectSelection
                        selectedProjects={selectedProjects}
                        onToggleProject={toggleProject}
                        onSelectAll={selectAll}
                    />
                </div>

                <div className="bg-gradient-to-b from-blue-900/10 to-gray-900">
                    <AmountInput
                        amount={amount}
                        onAmountChange={setAmount}
                        frequency={frequency}
                        onFrequencyChange={setFrequency}
                    />
                </div>

                <div id="payment-section">
                    <PaymentForm
                        amount={amount}
                        frequency={frequency}
                        onSuccess={handlePaymentSuccess}
                    />
                </div>
            </main>

            {/* Spark CTA Section */}
            <section className="py-20 px-6 max-w-2xl mx-auto text-center border-t border-gray-800">
                <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-12 rounded-[3rem] border-2 border-gray-700 space-y-8 relative shadow-2xl overflow-hidden group">
                    <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative z-10 space-y-6">
                        <blockquote className="space-y-4">
                            <p className="text-2xl font-bold text-white tracking-tight italic leading-snug">
                                "We don't just build telescopes and feed cats. We build HOPE. We build WONDER."
                            </p>
                        </blockquote>
                        <div className="w-12 h-1 bg-blue-500 mx-auto rounded-full" />
                        <div className="space-y-4 text-gray-400 font-light leading-relaxed">
                            <p>Your gift—whatever it is—joins hundreds of others to create something beautiful.</p>
                            <p>Every bowl filled. Every star shared. Every life changed.</p>
                            <p className="text-white font-bold text-lg pt-4">That's the power of what we build together.</p>
                        </div>
                        <button
                            onClick={() => document.getElementById('payment-section')?.scrollIntoView({ behavior: 'smooth' })}
                            className="mt-6 bg-blue-500 hover:bg-blue-600 text-white font-black py-5 px-10 rounded-full text-sm uppercase tracking-[0.2em] shadow-lg shadow-blue-500/30 hover:scale-105 active:scale-95 transition-all flex items-center gap-3 mx-auto"
                        >
                            ⚡ Be The Spark
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default DonationPage;
