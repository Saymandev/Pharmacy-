/** Barcodes are identifiers: preserve case and leading zeroes. */
export function barcodeValue(value:string){return value.trim();}
export function barcodeError(value:string){const code=barcodeValue(value);if(!code)return 'Scan or enter a barcode first.';if(code.length>256||/[\u0000-\u001f\u007f]/.test(code))return 'Use a barcode of up to 256 characters without control characters.';return '';}
export function exactBarcodeMatch<T extends {barcode?:string|null}>(items:T[],value:string):T|undefined{const code=barcodeValue(value);const exact=items.filter(item=>item.barcode===code);return exact.length===1?exact[0]:undefined;}
