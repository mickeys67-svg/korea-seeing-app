import { useMemo } from 'react';
import en from '../i18n/en';
import ko from '../i18n/ko';
import ja from '../i18n/ja';

const detectLang = (): 'ko' | 'ja' | 'en' => {
    const lang = (navigator.language || 'en').toLowerCase();
    if (lang.startsWith('ko')) return 'ko';
    if (lang.startsWith('ja')) return 'ja';
    return 'en';
};

const translations = { en, ko, ja };

const useI18n = () => {
    const lang = useMemo(detectLang, []);
    return translations[lang];
};

export default useI18n;
