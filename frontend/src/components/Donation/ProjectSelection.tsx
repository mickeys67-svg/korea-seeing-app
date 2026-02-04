import React from 'react';
import { Coffee, GraduationCap, Heart, Search, Microscope, Sparkles } from 'lucide-react';

interface Project {
    id: string;
    icon: React.ElementType;
    title: string;
    description: string;
    color: string;
}

const projects: Project[] = [
    { id: 'feed', icon: Coffee, title: 'FEED CATS', description: 'Daily meals for rescue cats', color: 'bg-orange-500' },
    { id: 'health', icon: Heart, title: 'HEALTH CARE', description: 'Vet care, vaccines, TNR', color: 'bg-red-500' },
    { id: 'optics', icon: Microscope, title: 'OPTICS PROJECT', description: 'Building our telescope', color: 'bg-blue-500' },
    { id: 'educate', icon: GraduationCap, title: 'EDUCATE YOUTH', description: 'Free star nights for all', color: 'bg-purple-500' }
];

interface ProjectSelectionProps {
    selectedProjects: string[];
    onToggleProject: (id: string) => void;
    onSelectAll: () => void;
}

const ProjectSelection: React.FC<ProjectSelectionProps> = ({ selectedProjects, onToggleProject, onSelectAll }) => {
    return (
        <section className="py-20 px-6 max-w-5xl mx-auto space-y-12">
            <div className="text-center space-y-4">
                <h2 className="text-sm uppercase tracking-[0.3em] text-purple-400 font-semibold">Choose Your Mission</h2>
                <h3 className="text-3xl md:text-4xl font-bold text-white">Where does your heart lead?</h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                {projects.map((proj) => {
                    const isSelected = selectedProjects.includes(proj.id);
                    const Icon = proj.icon;
                    return (
                        <button
                            key={proj.id}
                            onClick={() => onToggleProject(proj.id)}
                            className={`flex flex-col items-center p-6 rounded-3xl border-2 transition-all duration-300 group ${isSelected
                                    ? `border-transparent ring-2 ring-offset-2 ring-offset-gray-900 ring-white ${proj.color}/90 scale-105 shadow-lg shadow-${proj.color.split('-')[1]}-500/20`
                                    : 'border-gray-800 bg-gray-800/20 hover:border-gray-600'
                                }`}
                        >
                            <div className={`p-4 rounded-xl mb-4 transition-transform group-hover:scale-110 ${isSelected ? 'bg-white/20' : 'bg-gray-800'}`}>
                                <Icon className={`w-8 h-8 ${isSelected ? 'text-white' : 'text-gray-400'}`} />
                            </div>
                            <h4 className={`text-xs font-bold tracking-widest mb-1 ${isSelected ? 'text-white' : 'text-gray-300'}`}>{proj.title}</h4>
                            <p className={`text-[10px] text-center leading-tight ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>{proj.description}</p>

                            <div className={`mt-4 w-6 h-6 rounded-full border flex items-center justify-center transition-colors ${isSelected ? 'bg-white border-white' : 'border-gray-700'}`}>
                                {isSelected && <div className="w-2 h-2 rounded-full bg-blue-500 animate-scale-in" />}
                            </div>
                        </button>
                    );
                })}
            </div>

            <div className="flex justify-center pt-4">
                <button
                    onClick={onSelectAll}
                    className="group relative flex flex-col items-center bg-gray-800/40 border border-dashed border-gray-600 p-8 rounded-[2rem] w-full max-w-lg hover:border-blue-400/50 hover:bg-blue-400/5 transition-all"
                >
                    <div className="flex items-center gap-4 mb-4">
                        <div className="bg-blue-400/10 p-3 rounded-full">
                            <Sparkles className="w-6 h-6 text-blue-400" />
                        </div>
                        <div className="text-left">
                            <h4 className="font-bold text-white text-lg tracking-tight uppercase">Trust us to decide</h4>
                            <p className="text-gray-500 text-sm">We'll use your gift where it's needed most urgently right now</p>
                        </div>
                    </div>
                    <div className="w-full h-px bg-gray-700/50 mb-4"></div>
                    <span className="text-blue-400 font-semibold text-sm group-hover:translate-x-1 transition-transform inline-flex items-center gap-2">
                        Select All & Trust Us <Search className="w-3 h-3" />
                    </span>
                </button>
            </div>
        </section>
    );
};

export default ProjectSelection;
