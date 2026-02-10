export const MADA_TIMEZONE_OFFSET = 3 * 60 * 60 * 1000; // UTC+3

/**
 * Obtient une date décalée au fuseau horaire de Madagascar (UTC+3)
 * @param date Date source (par défaut maintenant)
 */
export const getMadaTime = (date: Date = new Date()): Date => {
    return new Date(date.getTime() + MADA_TIMEZONE_OFFSET);
};

/**
 * Obtient les composants de la date (jour, mois, année, heure) selon Madagascar
 */
export const getMadaDateComponents = (date: Date = new Date()) => {
    const madaTime = getMadaTime(date);
    return {
        day: madaTime.getUTCDate(),
        month: madaTime.getUTCMonth() + 1,
        year: madaTime.getUTCFullYear(),
        hours: madaTime.getUTCHours(),
        minutes: madaTime.getUTCMinutes()
    };
};

/**
 * Obtient la date sous forme de chaîne YYYY-MM-DD selon Madagascar
 * Utile pour comparer des jours
 */
export const getMadaDateString = (date: Date = new Date()): string => {
    const madaTime = getMadaTime(date);
    // toISOString retourne YYYY-MM-DDTHH:mm:ss.sssZ
    // Comme madaTime est décalé, la partie date ISO correspond à la date locale Mada
    return madaTime.toISOString().split('T')[0];
};

/**
 * Vérifie si deux dates correspondent au même jour à Madagascar
 */
export const isSameMadaDay = (date1: Date, date2: Date): boolean => {
    return getMadaDateString(date1) === getMadaDateString(date2);
};
