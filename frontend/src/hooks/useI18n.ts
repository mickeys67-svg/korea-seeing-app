import { useMemo } from 'react';
import en from '../i18n/en';
import ko from '../i18n/ko';
import ja from '../i18n/ja';
import zh from '../i18n/zh';

const detectLang = (): 'ko' | 'ja' | 'zh' | 'en' => {
    const lang = (navigator.language || 'en').toLowerCase();
    if (lang.startsWith('ko')) return 'ko';
    if (lang.startsWith('ja')) return 'ja';
    if (lang.startsWith('zh')) return 'zh';
    return 'en';
};

const translations = { en, ko, ja, zh };

const useI18n = () => {
    const lang = useMemo(detectLang, []);
    return translations[lang];
};


export default useI18n;
