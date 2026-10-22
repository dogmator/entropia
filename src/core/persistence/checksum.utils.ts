// FNV-1a over UTF-16 code units. It detects truncated or altered payloads. It is not a security measure.
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const HEX_RADIX = 16;
const HEX_DIGITS = 8;

export const checksumOf = (text: string): string => {
    let hash = FNV_OFFSET_BASIS;
    for (let index = 0; index < text.length; index++) {
        hash = Math.imul(hash ^ text.charCodeAt(index), FNV_PRIME) >>> 0;
    }
    return hash.toString(HEX_RADIX).padStart(HEX_DIGITS, '0');
};
