import { useEffect } from 'react';

// Calls onNavigate when the browser moves through the history, which the Back and Forward buttons do. Writing the page's own
// address does not fire popstate.
export const useUrlSync = (onNavigate: () => void): void => {
    useEffect(() => {
        window.addEventListener('popstate', onNavigate);
        return () => {
            window.removeEventListener('popstate', onNavigate);
        };
    }, [onNavigate]);
};
