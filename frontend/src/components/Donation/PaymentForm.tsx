import React from 'react';
import { CreditCard, Mail, User, ShieldCheck, Apple, CheckCircle2 } from 'lucide-react';
import { useForm } from 'react-hook-form';

interface PaymentFormProps {
    amount: string;
    frequency: string;
    onSuccess: (data: any) => void;
}

const PaymentForm: React.FC<PaymentFormProps> = ({ amount, frequency, onSuccess }) => {
    const { register, handleSubmit, formState: { errors } } = useForm();

    const onSubmit = (data: any) => {
        // Mocking Stripe successful payment
        onSuccess(data);
    };

    const numAmount = parseFloat(amount) || 0;

    return (
        <section className="py-20 px-6 max-w-4xl mx-auto">
            <div className="bg-gray-800/40 border border-gray-700/50 rounded-[3rem] p-8 md:p-12 space-y-10">
                <div className="flex items-center gap-3">
                    <CreditCard className="w-6 h-6 text-blue-400" />
                    <h3 className="text-2xl font-bold text-white uppercase tracking-tight">Complete Your Gift</h3>
                </div>

                <div className="bg-blue-600/20 border border-blue-500/20 p-6 rounded-2xl flex justify-between items-center">
                    <div>
                        <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mb-1">Your Chosen Gift</p>
                        <p className="text-2xl font-bold text-white">${numAmount === 0 ? '--' : numAmount}</p>
                    </div>
                    <div className="text-right">
                        <span className="inline-block bg-blue-500 text-[10px] font-bold px-3 py-1 rounded-full text-white uppercase">
                            {frequency}
                        </span>
                    </div>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                    <div className="space-y-6">
                        <div className="flex gap-4">
                            <button type="button" className="flex-1 bg-white hover:bg-gray-100 py-3 rounded-xl flex items-center justify-center gap-2 transition-colors">
                                <CreditCard className="w-4 h-4 text-black" />
                                <span className="text-black font-bold text-sm">Card</span>
                            </button>
                            <button type="button" className="flex-1 bg-gray-900 border border-gray-700 hover:border-gray-500 py-3 rounded-xl flex items-center justify-center gap-2 transition-colors">
                                <Apple className="w-4 h-4 text-white" />
                                <span className="text-white font-bold text-sm">Apple Pay</span>
                            </button>
                        </div>

                        <div className="space-y-4 pt-4">
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Card Information</h4>
                            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-4 opacity-50 cursor-not-allowed">
                                <CreditCard className="w-5 h-5 text-gray-600" />
                                <span className="text-gray-600 text-sm">Stripe Elements Embedded Here (SECURE)</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 flex items-center gap-2 uppercase tracking-wider">
                                    <Mail className="w-3 h-3" /> Email *
                                </label>
                                <input
                                    {...register("email", { required: true })}
                                    type="email"
                                    placeholder="your@email.com"
                                    className="w-full bg-gray-900 border border-gray-800 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-blue-500 placeholder:text-gray-700"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 flex items-center gap-2 uppercase tracking-wider">
                                    <User className="w-3 h-3" /> Name *
                                </label>
                                <input
                                    {...register("name", { required: true })}
                                    type="text"
                                    placeholder="Your Full Name"
                                    className="w-full bg-gray-900 border border-gray-800 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-blue-500 placeholder:text-gray-700"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input type="checkbox" className="w-5 h-5 rounded-lg border-gray-800 bg-gray-900 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900" />
                                <span className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">Yes, send me impact updates from the colony & observatory</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input type="checkbox" className="w-5 h-5 rounded-lg border-gray-800 bg-gray-900 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900" />
                                <span className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">Invite me to local telescope star-gazing events</span>
                            </label>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-gray-800 space-y-6">
                        <div className="flex items-center gap-2 text-gray-500">
                            <ShieldCheck className="w-4 h-4" />
                            <span className="text-[10px] uppercase font-bold tracking-widest">Tax-deductible Contribution • EIN: 12-3456789</span>
                        </div>

                        <button
                            type="submit"
                            disabled={numAmount < 1}
                            className={`w-full py-6 rounded-[2rem] text-xl font-bold flex items-center justify-center gap-3 transition-all ${numAmount >= 1
                                    ? 'bg-gradient-to-r from-blue-500 via-blue-600 to-purple-600 text-white shadow-2xl shadow-blue-600/40 hover:scale-[1.02] active:scale-95'
                                    : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                                }`}
                        >
                            🌟 GIVE ${numAmount === 0 ? '--' : numAmount} {frequency === 'monthly' ? '/ MONTH' : 'NOW'}
                        </button>

                        <div className="text-center space-y-1">
                            <p className="text-[10px] text-gray-600 flex items-center justify-center gap-1">
                                <ShieldCheck className="w-3 h-3" /> Secure & encrypted processing
                            </p>
                            <p className="text-[10px] text-gray-600 italic">Cancel monthly support anytime, no questions asked</p>
                        </div>
                    </div>
                </form>
            </div>
        </section>
    );
};

export default PaymentForm;
